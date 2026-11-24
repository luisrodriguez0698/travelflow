import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SUPPLIER_REF = 'Pago a proveedor desde cobro';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Flujo de dinero del mes en las cuentas que el usuario puede ver:
 * entradas (clientes / otras) -> cuentas -> salidas (proveedores / otras).
 * Las transferencias entre cuentas no cuentan (no entra ni sale dinero).
 * ?month=2026-11 (por defecto el mes actual)
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('bancos');
    const param = new URL(request.url).searchParams.get('month');
    const now = new Date();
    const [y, m] = param && /^\d{4}-\d{2}$/.test(param) ? param.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    // Mes en hora de Mexico (UTC-6)
    const start = new Date(Date.UTC(y, m - 1, 1, 6));
    const end = new Date(Date.UTC(y, m, 1, 6));

    const accounts = await prisma.bankAccount.findMany({
      where: { ...access.bankScope, isActive: true },
      select: { id: true, currentBalance: true },
    });
    const ids = accounts.map((a) => a.id);

    const txs = ids.length
      ? await prisma.bankTransaction.findMany({
          where: { bankAccountId: { in: ids }, status: 'ACTIVE', type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: start, lt: end } },
          select: { type: true, amount: true, bookingId: true, reference: true, supplierPayment: { select: { id: true } } },
        })
      : [];

    const flow = { clients: 0, otherIncome: 0, suppliers: 0, otherExpense: 0 };
    for (const t of txs) {
      if (t.type === 'INCOME') {
        if (t.bookingId) flow.clients += t.amount;
        else flow.otherIncome += t.amount;
      } else if (t.supplierPayment || t.reference === SUPPLIER_REF) {
        flow.suppliers += t.amount;
      } else {
        flow.otherExpense += t.amount;
      }
    }

    const income = flow.clients + flow.otherIncome;
    const expense = flow.suppliers + flow.otherExpense;
    return NextResponse.json({
      month: `${y}-${String(m).padStart(2, '0')}`,
      clients: round2(flow.clients),
      otherIncome: round2(flow.otherIncome),
      suppliers: round2(flow.suppliers),
      otherExpense: round2(flow.otherExpense),
      income: round2(income),
      expense: round2(expense),
      net: round2(income - expense),
      balance: round2(accounts.reduce((s, a) => s + a.currentBalance, 0)),
      accounts: accounts.length,
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading money flow:', error);
    return NextResponse.json({ error: 'Error al cargar el flujo de dinero' }, { status: 500 });
  }
}
