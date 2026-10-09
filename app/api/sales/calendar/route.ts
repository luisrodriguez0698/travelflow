import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('ventas');
    const tenantId = access.tenantId;
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    let startOfRange: Date;
    let endOfRange: Date;

    if (startDateParam && endDateParam) {
      startOfRange = new Date(startDateParam + 'T00:00:00');
      endOfRange = new Date(endDateParam + 'T23:59:59.999');
    } else {
      startOfRange = new Date(year, month - 1, 1);
      endOfRange = new Date(year, month, 0, 23, 59, 59, 999);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        ...access.bookingScope,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        departureDate: { not: null, lte: endOfRange },
        returnDate: { not: null, gte: startOfRange },
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
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Error fetching calendar events' }, { status: 500 });
  }
}
