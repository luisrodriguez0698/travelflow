import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { payFixedExpenseSchema } from '@/lib/fixed-expenses';
import { advanceDueDate, dayToDate, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/fixed-expense-rules';

export const dynamic = 'force-dynamic';

/**
 * Marca como pagado el vencimiento actual: (opcional) egreso en la cuenta
 * elegida y el gasto pasa a su siguiente vencimiento.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAccess('gastos', 'payments');
    const { id } = await params;
    const parsed = payFixedExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { amount, paidAt, bankAccountId, notes } = parsed.data;

    const expense = await prisma.fixedExpense.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!expense) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });

    let bank: { id: string; currentBalance: number; referenceName: string } | null = null;
    if (bankAccountId) {
      bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, ...access.bankScope, isActive: true },
        select: { id: true, currentBalance: true, referenceName: true },
      });
      if (!bank) return NextResponse.json({ error: 'Cuenta bancaria no válida' }, { status: 400 });
      if (bank.currentBalance < amount) {
        return NextResponse.json({ error: `Saldo insuficiente en ${bank.referenceName}` }, { status: 400 });
      }
    }

    const date = paidAt ? dayToDate(paidAt) : new Date();
    const category = EXPENSE_CATEGORIES[expense.category as ExpenseCategory]?.label ?? 'Gasto';
    const period = expense.nextDueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const next = advanceDueDate(expense.nextDueDate, expense.frequency, expense.dueDay);

    const payment = await prisma.$transaction(async (tx) => {
      let bankTransactionId: string | null = null;
      if (bank) {
        const bankTx = await tx.bankTransaction.create({
          data: {
            tenantId: access.tenantId,
            bankAccountId: bank.id,
            type: 'EXPENSE',
            amount,
            description: `Gasto fijo: ${expense.name} (${category}, vence ${period})`,
            reference: 'Gasto fijo',
            date,
          },
        });
        bankTransactionId = bankTx.id;
        await tx.bankAccount.update({ where: { id: bank.id }, data: { currentBalance: { decrement: amount } } });
      }
      const created = await tx.fixedExpensePayment.create({
        data: {
          tenantId: access.tenantId,
          fixedExpenseId: expense.id,
          dueDate: expense.nextDueDate,
          amount,
          paidAt: date,
          bankAccountId: bank?.id ?? null,
          bankTransactionId,
          notes: notes || null,
          createdBy: access.userId,
        },
      });
      await tx.fixedExpense.update({
        where: { id: expense.id },
        data: { nextDueDate: next, lastReminderDue: null, lastReminderStage: null, lastReminderAt: null },
      });
      return created;
    });

    return NextResponse.json({ payment, nextDueDate: next }, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error paying fixed expense:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 });
  }
}
