import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId, type: 'QUOTATION' },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Convert to sale
    await prisma.booking.update({
      where: { id },
      data: {
        type: 'SALE',
        saleDate: new Date(),
        expirationDate: null,
        status: booking.paymentType === 'CASH' ? 'COMPLETED' : 'ACTIVE',
      },
    });

    // Regenerate payment plan with fresh dates for credit sales
    if (booking.paymentType === 'CREDIT' && booking.numberOfPayments > 0) {
      await prisma.paymentPlan.deleteMany({ where: { bookingId: id } });

      const remaining = booking.totalPrice - (booking.downPayment || 0);
      const paymentAmount = Math.floor(remaining / booking.numberOfPayments);
      const lastPayment = remaining - (paymentAmount * (booking.numberOfPayments - 1));
      const payments = [];

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

      const startDate = new Date();
      for (let i = 0; i < booking.numberOfPayments; i++) {
        const dueDate = getNextQuincenalDate(startDate, i + 1);
        payments.push({
          bookingId: id,
          paymentNumber: i + 1,
          dueDate,
          amount: i === booking.numberOfPayments - 1 ? lastPayment : paymentAmount,
          status: 'PENDING',
        });
      }

      await prisma.paymentPlan.createMany({ data: payments });
    }

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'quotations',
        entityId: id,
        changes: { action: 'CONVERT_TO_SALE', totalPrice: booking.totalPrice },
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error converting quotation:', error);
    return NextResponse.json({ error: 'Error al convertir la cotización' }, { status: 500 });
  }
}
