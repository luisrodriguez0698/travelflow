import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    
    const booking = await prisma.booking.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        departure: {
          include: {
            package: true,
            season: true,
          },
        },
        payments: true,
        supplier: true,
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
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get departure info
    const departure = await prisma.packageDeparture.findUnique({
      where: { id: body.departureId },
    });

    if (!departure) {
      return NextResponse.json({ error: 'Departure not found' }, { status: 400 });
    }

    // Calculate net cost
    const numAdults = body.numAdults || 1;
    const numChildren = body.numChildren || 0;
    const netCost = (departure.priceAdult * numAdults) + (departure.priceChild * numChildren);

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
        packageId: departure.packageId,
        departureId: body.departureId,
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
      },
    });

    // Create new payment plan if credit and payments were deleted
    const existingPayments = await prisma.paymentPlan.count({
      where: { bookingId: id },
    });

    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0 && existingPayments === 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const paymentAmount = Math.floor(remaining / body.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (body.numberOfPayments - 1));
      const payments = [];

      for (let i = 0; i < body.numberOfPayments; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + ((i + 1) * 15));
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
        departure: {
          include: {
            package: true,
            season: true,
          },
        },
        payments: true,
        supplier: true,
      },
    });

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
      where: { id, tenantId },
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
      where: { id, tenantId },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json({ error: 'Error deleting sale' }, { status: 500 });
  }
}
