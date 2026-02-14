import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const bookings = await prisma.booking.findMany({
      where: { tenantId },
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
      orderBy: { saleDate: 'desc' },
    });
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Error fetching sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    // Get package for packageId
    const departure = await prisma.packageDeparture.findUnique({
      where: { id: body.departureId },
      include: { package: true },
    });

    if (!departure) {
      return NextResponse.json({ error: 'Departure not found' }, { status: 400 });
    }

    // Calculate net cost from departure prices
    const numAdults = body.numAdults || 1;
    const numChildren = body.numChildren || 0;
    const netCost = (departure.priceAdult * numAdults) + (departure.priceChild * numChildren);

    const booking = await prisma.booking.create({
      data: {
        tenantId,
        clientId: body.clientId,
        packageId: departure.packageId,
        departureId: body.departureId,
        totalPrice: body.totalPrice,
        netCost,
        paymentType: body.paymentType,
        downPayment: body.downPayment || 0,
        numberOfPayments: body.numberOfPayments || 1,
        notes: body.notes || null,
        saleDate: body.saleDate ? new Date(body.saleDate) : new Date(),
        supplierId: body.supplierId || null,
        supplierDeadline: body.supplierDeadline ? new Date(body.supplierDeadline) : null,
      },
    });

    // Create payment plan for credit sales
    if (body.paymentType === 'CREDIT' && body.numberOfPayments > 0) {
      const remaining = body.totalPrice - (body.downPayment || 0);
      const paymentAmount = Math.floor(remaining / body.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (body.numberOfPayments - 1));
      const payments = [];

      // Helper function to get next quincenal date (15th or last day of month)
      const getNextQuincenalDate = (fromDate: Date, count: number): Date => {
        const result = new Date(fromDate);
        
        for (let i = 0; i < count; i++) {
          const currentDay = result.getDate();
          const currentMonth = result.getMonth();
          const currentYear = result.getFullYear();
          
          // Get last day of current month
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          
          if (currentDay < 15) {
            // Move to day 15 of current month
            result.setDate(15);
          } else if (currentDay < lastDayOfMonth) {
            // Move to last day of current month
            result.setDate(lastDayOfMonth);
          } else {
            // Move to day 15 of next month
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json({ error: 'Error creating sale' }, { status: 500 });
  }
}
