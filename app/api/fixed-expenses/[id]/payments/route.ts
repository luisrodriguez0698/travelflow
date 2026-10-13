import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** Historial de pagos del gasto fijo. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('gastos');
    const { id } = await params;
    const expense = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
    if (!expense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    const payments = await prisma.fixedExpensePayment.findMany({
      where: { fixedExpenseId: id },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });
    const bankIds = [...new Set(payments.map((p) => p.bankAccountId).filter(Boolean))] as string[];
    const banks = bankIds.length
      ? await prisma.bankAccount.findMany({
          where: { id: { in: bankIds }, tenantId: access.tenantId },
          select: { id: true, referenceName: true, bankName: true },
        })
      : [];
    const bankBy = Object.fromEntries(banks.map((b) => [b.id, `${b.referenceName} · ${b.bankName}`]));
    return NextResponse.json(payments.map((p) => ({ ...p, bankName: p.bankAccountId ? bankBy[p.bankAccountId] ?? null : null })));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading fixed expense payments:', error);
    return NextResponse.json({ error: 'Error al cargar el historial' }, { status: 500 });
  }
}

/**
 * Deshace el ultimo pago (?paymentId=): cancela su egreso en Bancos (regresa el
 * saldo) y el gasto vuelve a su vencimiento anterior.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('gastos', 'payments');
    const { id } = await params;
    const paymentId = new URL(request.url).searchParams.get('paymentId') || '';
    const expense = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!expense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    const latest = await prisma.fixedExpensePayment.findFirst({
      where: { fixedExpenseId: id, status: 'ACTIVE' },
      orderBy: { dueDate: 'desc' },
    });
    if (!latest || latest.id !== paymentId) {
      return NextResponse.json({ error: 'Solo se puede deshacer el último pago' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (latest.bankTransactionId) {
        const bankTx = await tx.bankTransaction.findFirst({ where: { id: latest.bankTransactionId, status: 'ACTIVE' } });
        if (bankTx) {
          await tx.bankTransaction.update({ where: { id: bankTx.id }, data: { status: 'CANCELLED' } });
          await tx.bankAccount.update({ where: { id: bankTx.bankAccountId }, data: { currentBalance: { increment: bankTx.amount } } });
        }
      }
      await tx.fixedExpensePayment.update({ where: { id: latest.id }, data: { status: 'CANCELLED' } });
      await tx.fixedExpense.update({
        where: { id },
        data: { nextDueDate: latest.dueDate, lastReminderDue: null, lastReminderStage: null, lastReminderAt: null },
      });
    });
    return NextResponse.json({ success: true, nextDueDate: latest.dueDate });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error undoing fixed expense payment:', error);
    return NextResponse.json({ error: 'No se pudo deshacer el pago' }, { status: 500 });
  }
}
