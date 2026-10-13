import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { fixedExpenseSchema, toFixedExpenseData } from '@/lib/fixed-expenses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await requireAccess('gastos');
    const expenses = await prisma.fixedExpense.findMany({
      where: { tenantId: access.tenantId },
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
      include: {
        bankAccount: { select: { id: true, referenceName: true, bankName: true } },
        payments: { where: { status: 'ACTIVE' }, orderBy: { paidAt: 'desc' }, take: 1, select: { amount: true, paidAt: true } },
      },
    });
    return NextResponse.json(expenses.map(({ payments, ...e }) => ({ ...e, lastPayment: payments[0] ?? null })));
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading fixed expenses:', error);
    return NextResponse.json({ error: 'Error al cargar los gastos fijos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('gastos', 'create');
    const parsed = fixedExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const built = await toFixedExpenseData(access, parsed.data);
    if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 });
    const expense = await prisma.fixedExpense.create({
      data: { ...built.data, tenantId: access.tenantId, createdBy: access.userId },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating fixed expense:', error);
    return NextResponse.json({ error: 'Error al crear el gasto fijo' }, { status: 500 });
  }
}
