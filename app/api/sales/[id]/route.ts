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
      where: { id, tenantId, type: 'SALE' },
      include: {
        client: true,
        destination: {
          include: { season: true },
        },
        payments: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json({ error: 'Error fetching sale' }, { status: 500 });
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

    // Verify ownership
    const existing = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'SALE' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Calculate net cost - from items if provided, otherwise from legacy fields
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

    // Delete old payment plans if payment type or number changed
    if (
      existing.paymentType !== body.paymentType ||
      existing.numberOfPayments !== body.numberOfPayments ||
      existing.downPayment !== body.downPayment ||
      existing.totalPrice !== body.totalPrice
    ) {
      await prisma.paymentPlan.deleteMany({
        where: { bookingId: id },
      });
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
        pricePerNight,
        numNights,
        freeChildren,
        totalPrice: body.totalPrice,
        netCost,
        paymentType: body.paymentType,
        downPayment: body.downPayment || 0,
        numberOfPayments: body.numberOfPayments || 1,
        notes: body.notes || null,
        saleDate: body.saleDate ? new Date(body.saleDate) : existing.saleDate,
        status: body.status || existing.status,
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
        hotelId: body.hotelId !== undefined ? (body.hotelId || null) : existing.hotelId,
        reservationNumber: body.reservationNumber !== undefined ? (body.reservationNumber || null) : existing.reservationNumber,
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
        await prisma.bookingItem.createMany({
          data: body.items.map((item: any, idx: number) => ({
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
            transportType: item.transportType || null,
            isInternational: item.isInternational ?? false,
            returnDepartureTime: item.returnDepartureTime ? new Date(item.returnDepartureTime) : null,
            returnArrivalTime: item.returnArrivalTime ? new Date(item.returnArrivalTime) : null,
            returnFlightNumber: item.returnFlightNumber || null,
          })),
        });
      }
    }

    // Create new payment plan if credit and payments were deleted
    const existingPayments = await prisma.paymentPlan.count({
      where: { bookingId: id },
    });

    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0 && existingPayments === 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const paymentAmount = Math.floor(remaining / body.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (body.numberOfPayments - 1));
      const payments = [];

      const frequency = body.paymentFrequency || existing.paymentFrequency || 'QUINCENAL';
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

      for (let i = 0; i < body.numberOfPayments; i++) {
        const startDate = new Date();
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
        destination: {
          include: { season: true },
        },
        payments: true,
        supplier: true,
        hotel: true,
        passengers: true,
        items: {
          include: { hotel: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'bookings',
        entityId: id,
        changes: { totalPrice: body.totalPrice, status: body.status },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating sale:', error);
    return NextResponse.json({ error: 'Error updating sale' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'SALE' },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.supplierDeadline !== undefined) {
      updateData.supplierDeadline = body.supplierDeadline ? new Date(body.supplierDeadline) : null;
    }
    if (body.supplierId !== undefined) {
      updateData.supplierId = body.supplierId || null;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json({ error: 'Error al actualizar la venta' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'SALE' },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete payment plans first (cascade should handle this but being explicit)
    await prisma.paymentPlan.deleteMany({
      where: { bookingId: id },
    });

    await prisma.booking.delete({
      where: { id },
    });

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'DELETE',
        entity: 'bookings',
        entityId: id,
        changes: { clientId: existing.clientId, totalPrice: existing.totalPrice },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json({ error: 'Error deleting sale' }, { status: 500 });
  }
}
