import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        departureDate: { not: null, lte: endOfMonth },
        returnDate: { not: null, gte: startOfMonth },
      },
      include: {
        client: { select: { fullName: true } },
        destination: { select: { name: true } },
        hotel: { select: { name: true } },
        payments: { select: { status: true } },
      },
      orderBy: { departureDate: 'asc' },
    });

    const events = bookings.map((b) => ({
      id: b.id,
      clientName: b.client?.fullName || 'Sin cliente',
      destinationName: b.destination?.name || '',
      hotelName: b.hotel?.name || null,
      departureDate: b.departureDate,
      returnDate: b.returnDate,
      totalPrice: b.totalPrice,
      paymentType: b.paymentType,
      hasPendingPayments: b.payments.some((p) => p.status === 'PENDING'),
      pendingCount: b.payments.filter((p) => p.status === 'PENDING').length,
      totalPayments: b.payments.length,
    }));

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Error fetching calendar events' }, { status: 500 });
  }
}
