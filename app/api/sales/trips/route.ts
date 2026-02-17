import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const now = new Date();

    // 15 days in the past and future window
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 15);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 15);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        departureDate: { not: null },
        returnDate: { not: null },
        OR: [
          // Upcoming: departs within 15 days
          { departureDate: { gte: now, lte: futureDate } },
          // In transit: departed but not returned
          { departureDate: { lte: now }, returnDate: { gte: now } },
          // Returned: returned within last 15 days
          { returnDate: { gte: pastDate, lt: now } },
        ],
      },
      include: {
        client: { select: { fullName: true } },
        destination: { select: { name: true } },
        supplier: { select: { name: true } },
        hotel: { select: { name: true } },
        payments: { select: { status: true } },
      },
      orderBy: { departureDate: 'asc' },
    });

    // Enrich with agent names
    const creatorIds = [...new Set(bookings.map((b) => b.createdBy).filter(Boolean))] as string[];
    const creators =
      creatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const creatorMap = Object.fromEntries(
      creators.map((u) => [u.id, u.name || u.email || 'Usuario'])
    );

    const trips = bookings.map((b) => {
      const departure = new Date(b.departureDate!);
      const returnDate = new Date(b.returnDate!);

      let tripStatus: 'IN_TRANSIT' | 'UPCOMING' | 'RETURNED';
      if (departure <= now && now <= returnDate) {
        tripStatus = 'IN_TRANSIT';
      } else if (departure > now) {
        tripStatus = 'UPCOMING';
      } else {
        tripStatus = 'RETURNED';
      }

      const isCerrado =
        b.paymentType === 'CASH' ||
        (b.payments.length > 0 && b.payments.every((p) => p.status === 'PAID'));

      return {
        id: b.id,
        clientName: b.client?.fullName || 'Sin cliente',
        destinationName: b.destination?.name || '',
        hotelName: b.hotel?.name || null,
        supplierName: b.supplier?.name || null,
        departureDate: b.departureDate,
        returnDate: b.returnDate,
        totalPrice: b.totalPrice,
        paymentType: b.paymentType,
        paymentStatus: isCerrado ? 'CERRADO' : 'SALDO',
        tripStatus,
        agentName: b.createdBy ? creatorMap[b.createdBy] || null : null,
      };
    });

    return NextResponse.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json({ error: 'Error fetching trips' }, { status: 500 });
  }
}
