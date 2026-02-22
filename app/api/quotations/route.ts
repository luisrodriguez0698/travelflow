import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const clientId = searchParams.get('clientId');
    const destinationId = searchParams.get('destinationId');
    const supplierId = searchParams.get('supplierId');
    const folio = searchParams.get('folio');

    const where: any = { tenantId, type: 'QUOTATION' };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (clientId) where.clientId = clientId;
    if (destinationId) where.destinationId = destinationId;
    if (supplierId) where.supplierId = supplierId;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        client: true,
        destination: {
          include: { season: true },
        },
        payments: true,
        supplier: true,
        hotel: { include: { destination: true } },
        passengers: true,
        items: {
          include: { hotel: true, destination: { include: { season: true } }, supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filteredBookings = folio
      ? bookings.filter((b) => b.id.slice(-8).toUpperCase().includes(folio.toUpperCase()))
      : bookings;

    // Fetch creator names
    const creatorIds = [...new Set(filteredBookings.map((b) => b.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    const bookingsWithCreator = filteredBookings.map((b) => ({
      ...b,
      creatorName: b.createdBy ? creatorMap[b.createdBy] || null : null,
    }));

    return NextResponse.json(bookingsWithCreator);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json({ error: 'Error fetching quotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const items: any[] = body.items || [];
    let netCost: number;

    const numAdults = body.numAdults || 1;
    const numChildren = body.numChildren || 0;
    const priceAdult = body.priceAdult || 0;
    const priceChild = body.priceChild || 0;
    const pricePerNight = body.pricePerNight || 0;
    const numNights = body.numNights || 0;
    const freeChildren = body.freeChildren || 0;
    const paidChildren = Math.max(0, numChildren - freeChildren);

    if (items.length > 0) {
      netCost = items.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
    } else {
      netCost = (priceAdult * numAdults) + (priceChild * paidChildren) + (pricePerNight * numNights);
    }

    const sessionUser = await getSessionUser();

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        type: 'QUOTATION',
        clientId: body.clientId,
        destinationId: body.destinationId || null,
        departureDate: body.departureDate ? new Date(body.departureDate) : null,
        returnDate: body.returnDate ? new Date(body.returnDate) : null,
        priceAdult,
        priceChild,
        numAdults,
        numChildren,
        pricePerNight,
        numNights,
        freeChildren,
        totalPrice: body.totalPrice,
        netCost,
        paymentType: body.paymentType,
        downPayment: body.downPayment || 0,
        numberOfPayments: body.paymentType === 'CASH' ? 0 : (body.numberOfPayments || 1),
        notes: body.notes || null,
        saleDate: new Date(),
        status: 'ACTIVE',
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        hotelId: body.hotelId || null,

        createdBy: sessionUser?.id || null,
        paymentFrequency: body.paymentFrequency || 'QUINCENAL',
      },
    });

    // Create passengers if provided
    if (body.passengers && Array.isArray(body.passengers) && body.passengers.length > 0) {
      await prisma.bookingPassenger.createMany({
        data: body.passengers.map((p: any) => ({
          bookingId: booking.id,
          name: p.name,
          type: p.type || 'ADULT',
          age: p.age || null,
          isHolder: p.isHolder || false,
        })),
      });
    }

    // Create booking items if provided
    if (items.length > 0) {
      await prisma.bookingItem.createMany({
        data: items.map((item: any, idx: number) => ({
          bookingId: booking.id,
          type: item.type || 'OTHER',
          description: item.description || null,
          cost: item.cost || 0,
          sortOrder: item.sortOrder ?? idx,
          hotelId: item.hotelId || null,
          roomType: item.roomType || null,
          numAdults: item.numAdults ?? null,
          numChildren: item.numChildren ?? null,
          freeChildren: item.freeChildren ?? null,
          pricePerNight: item.pricePerNight ?? null,
          numNights: item.numNights ?? null,
          plan: item.plan || null,
          airline: item.airline || null,
          flightNumber: item.flightNumber || null,
          origin: item.origin || null,
          flightDestination: item.flightDestination || null,
          departureTime: item.departureTime ? new Date(item.departureTime) : null,
          arrivalTime: item.arrivalTime ? new Date(item.arrivalTime) : null,
          flightClass: item.flightClass || null,
          direction: item.direction || null,
          tourName: item.tourName || null,
          tourDate: item.tourDate ? new Date(item.tourDate) : null,
          numPeople: item.numPeople ?? null,
          pricePerPerson: item.pricePerPerson ?? null,
          destinationId: item.destinationId || null,
          supplierId: item.supplierId || null,
          supplierDeadline: item.supplierDeadline ? new Date(item.supplierDeadline) : null,
        })),
      });
    }

    // Create preview payment plan for credit quotations
    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const paymentAmount = Math.floor(remaining / body.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (body.numberOfPayments - 1));
      const payments = [];

      const frequency = body.paymentFrequency || 'QUINCENAL';

      const getNextQuincenalDate = (fromDate: Date, count: number): Date => {
        const result = new Date(fromDate);
        for (let i = 0; i < count; i++) {
          const currentDay = result.getDate();
          const currentMonth = result.getMonth();
          const currentYear = result.getFullYear();
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (currentDay < 15) {
            result.setDate(15);
          } else if (currentDay < lastDayOfMonth) {
            result.setDate(lastDayOfMonth);
          } else {
            result.setMonth(currentMonth + 1);
            result.setDate(15);
          }
        }
        return result;
      };

      const getNextMonthlyDate = (fromDate: Date, count: number): Date => {
        const result = new Date(fromDate);
        result.setDate(1); // avoid overflow
        result.setMonth(result.getMonth() + count);
        result.setDate(new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate());
        return result;
      };

      const startDate = new Date();
      for (let i = 0; i < body.numberOfPayments; i++) {
        const dueDate = frequency === 'MENSUAL'
          ? getNextMonthlyDate(startDate, i)
          : getNextQuincenalDate(startDate, i + 1);
        payments.push({
          bookingId: booking.id,
          paymentNumber: i + 1,
          dueDate,
          amount: i === body.numberOfPayments - 1 ? lastPayment : paymentAmount,
          status: 'PENDING',
        });
      }

      await prisma.paymentPlan.createMany({ data: payments });
    }

    const result = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        client: true,
        destination: { include: { season: true } },
        payments: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true, destination: { include: { season: true } }, supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'CREATE',
        entity: 'quotations',
        entityId: booking.id,
        changes: { clientId: body.clientId, totalPrice: body.totalPrice },
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating quotation:', error);
    return NextResponse.json({ error: 'Error creating quotation' }, { status: 500 });
  }
}
