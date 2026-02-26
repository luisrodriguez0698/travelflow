import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'QUOTATION' },
      include: {
        client: true,
        destination: { include: { season: true } },
        payments: { orderBy: { paymentNumber: 'asc' } },
        tenant: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true, passengers: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Fetch creator name
    let creatorName: string | null = null;
    if (booking.createdBy) {
      const creator = await prisma.user.findUnique({
        where: { id: booking.createdBy },
        select: { name: true, email: true },
      });
      creatorName = creator?.name || creator?.email || null;
    }

    return NextResponse.json({ ...booking, creatorName });
  } catch (error) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json({ error: 'Error fetching quotation' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'QUOTATION' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

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

    // Delete old payment plans and recreate
    if (
      existing.paymentType !== body.paymentType ||
      existing.numberOfPayments !== body.numberOfPayments ||
      existing.downPayment !== body.downPayment ||
      existing.totalPrice !== body.totalPrice
    ) {
      await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        clientId: body.clientId,
        destinationId: body.destinationId,
        departureDate: body.departureDate ? new Date(body.departureDate) : existing.departureDate,
        returnDate: body.returnDate ? new Date(body.returnDate) : existing.returnDate,
        priceAdult,
        priceChild,
        numAdults,
        numChildren,
        totalPrice: body.totalPrice,
        netCost,
        paymentType: body.paymentType,
        downPayment: body.downPayment || 0,
        numberOfPayments: body.paymentType === 'CASH' ? 0 : (body.numberOfPayments || 1),
        notes: body.notes || null,
        status: 'ACTIVE',
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : existing.expirationDate,
        hotelId: body.hotelId !== undefined ? (body.hotelId || null) : existing.hotelId,
        paymentFrequency: body.paymentFrequency || existing.paymentFrequency,
      },
    });

    // Update passengers if provided
    if (body.passengers !== undefined) {
      await prisma.bookingPassenger.deleteMany({ where: { bookingId: id } });
      if (Array.isArray(body.passengers) && body.passengers.length > 0) {
        await prisma.bookingPassenger.createMany({
          data: body.passengers.map((p: any) => ({
            bookingId: id,
            name: p.name,
            type: p.type || 'ADULT',
            age: p.age || null,
            isHolder: p.isHolder || false,
          })),
        });
      }
    }

    // Update booking items if provided
    if (body.items !== undefined) {
      await prisma.bookingItem.deleteMany({ where: { bookingId: id } });
      if (Array.isArray(body.items) && body.items.length > 0) {
        for (let idx = 0; idx < body.items.length; idx++) {
          const item = body.items[idx];
          const itemPassengers: any[] = item.type === 'HOTEL' && Array.isArray(item.passengers) ? item.passengers : [];
          const createdItem = await prisma.bookingItem.create({
            data: {
              bookingId: id,
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
              priceAdult: item.priceAdult ?? null,
              priceChild: item.priceChild ?? null,
              pricePackage: item.pricePackage ?? null,
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
              transportType: item.transportType || null,
              isInternational: item.isInternational ?? false,
              returnDepartureTime: item.returnDepartureTime ? new Date(item.returnDepartureTime) : null,
              returnArrivalTime: item.returnArrivalTime ? new Date(item.returnArrivalTime) : null,
              returnFlightNumber: item.returnFlightNumber || null,
            },
          });
          if (itemPassengers.length > 0) {
            await prisma.bookingItemPassenger.createMany({
              data: itemPassengers.map((p: any) => ({
                bookingItemId: createdItem.id,
                name: p.name,
                type: p.type || 'ADULT',
                age: p.age || null,
                isHolder: p.isHolder || false,
              })),
            });
          }
        }
      }
    }

    // Recreate payment plan if needed
    const existingPayments = await prisma.paymentPlan.count({ where: { bookingId: id } });

    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0 && existingPayments === 0) {
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
          if (currentDay < 15) { result.setDate(15); }
          else if (currentDay < lastDayOfMonth) { result.setDate(lastDayOfMonth); }
          else { result.setMonth(currentMonth + 1); result.setDate(15); }
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

      const startDate = body.paymentStartDate ? new Date(body.paymentStartDate) : new Date();
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
          include: { hotel: true, passengers: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'quotations',
        entityId: id,
        changes: { totalPrice: body.totalPrice },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating quotation:', error);
    return NextResponse.json({ error: 'Error updating quotation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const existing = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'QUOTATION' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });
    await prisma.booking.delete({ where: { id } });

    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'DELETE',
        entity: 'quotations',
        entityId: id,
        changes: { clientId: existing.clientId, totalPrice: existing.totalPrice },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json({ error: 'Error deleting quotation' }, { status: 500 });
  }
}
