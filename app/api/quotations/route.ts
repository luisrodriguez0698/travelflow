import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const bookings = await prisma.booking.findMany({
      where: { tenantId, type: 'QUOTATION' },
      include: {
        client: true,
        destination: {
          include: { season: true },
        },
        payments: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch creator names
    const creatorIds = [...new Set(bookings.map((b) => b.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    const bookingsWithCreator = bookings.map((b) => ({
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

    const numAdults = body.numAdults || 1;
    const numChildren = body.numChildren || 0;
    const priceAdult = body.priceAdult || 0;
    const priceChild = body.priceChild || 0;
    const netCost = (priceAdult * numAdults) + (priceChild * numChildren);

    const sessionUser = await getSessionUser();

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        type: 'QUOTATION',
        clientId: body.clientId,
        destinationId: body.destinationId,
        departureDate: body.departureDate ? new Date(body.departureDate) : null,
        returnDate: body.returnDate ? new Date(body.returnDate) : null,
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
        saleDate: new Date(),
        status: 'ACTIVE',
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        createdBy: sessionUser?.id || null,
      },
    });

    // Create preview payment plan for credit quotations
    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const paymentAmount = Math.floor(remaining / body.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (body.numberOfPayments - 1));
      const payments = [];

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

      const startDate = new Date();
      for (let i = 0; i < body.numberOfPayments; i++) {
        const dueDate = getNextQuincenalDate(startDate, i + 1);
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
