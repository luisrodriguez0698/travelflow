import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { computeCommissions, dayToDate, payoutSchema, PREVIOUS_PAYOUT_NOTE } from '@/lib/commissions';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Historial de pagos a agentes (con "solo lo mio", los propios). */
export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('comisiones');
    const userId = request.nextUrl.searchParams.get('userId') || undefined;
    const payouts = await prisma.commissionPayout.findMany({
      where: {
        tenantId: access.tenantId,
        ...(access.ownOnly ? { userId: access.userId } : userId ? { userId } : {}),
      },
      include: { items: { select: { bookingId: true, amount: true, booking: { select: { client: { select: { fullName: true } } } } } } },
      orderBy: { paidAt: 'desc' },
      take: 200,
    });
    const userIds = [...new Set(payouts.flatMap((p) => [p.userId, p.createdBy].filter((x): x is string => !!x)))];
    const accountIds = [...new Set(payouts.map((p) => p.bankAccountId).filter((x): x is string => !!x))];
    const [users, accounts] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds }, tenantId: access.tenantId }, select: { id: true, name: true, email: true } }),
      prisma.bankAccount.findMany({ where: { id: { in: accountIds }, tenantId: access.tenantId }, select: { id: true, referenceName: true } }),
    ]);
    const nameOf = new Map(users.map((u) => [u.id, u.name?.trim() || u.email.split('@')[0]]));
    const accountOf = new Map(accounts.map((a) => [a.id, a.referenceName]));
    return NextResponse.json(
      payouts.map((p) => ({
        id: p.id,
        userId: p.userId,
        agent: nameOf.get(p.userId) ?? 'Agente',
        commissionAmount: p.commissionAmount,
        salaryAmount: p.salaryAmount,
        bonusAmount: p.bonusAmount,
        deductionAmount: p.deductionAmount,
        total: p.total,
        account: p.bankAccountId ? accountOf.get(p.bankAccountId) ?? 'Cuenta' : null,
        paidAt: p.paidAt.toISOString(),
        notes: p.notes,
        status: p.status,
        createdBy: p.createdBy ? nameOf.get(p.createdBy) ?? null : null,
        items: p.items.map((i) => ({ bookingId: i.bookingId, amount: i.amount, client: i.booking?.client?.fullName ?? 'Cliente' })),
      }))
    );
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading payouts:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los pagos' }, { status: 500 });
  }
}

/** Registra un pago a un agente: comisiones de ventas elegidas + sueldo + bono - descuentos. */
export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('comisiones', 'payments');
    if (access.ownOnly) return NextResponse.json({ error: 'No puedes registrar pagos de comisiones' }, { status: 403 });
    const parsed = payoutSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const previous = parsed.data.previous === true;
    const { userId, items, paidAt } = parsed.data;
    // Pago previo: solo comisiones que ya se pagaron fuera del sistema, sin mover Bancos
    const salaryAmount = previous ? 0 : parsed.data.salaryAmount;
    const bonusAmount = previous ? 0 : parsed.data.bonusAmount;
    const deductionAmount = previous ? 0 : parsed.data.deductionAmount;
    const bankAccountId = previous ? null : parsed.data.bankAccountId;
    const extra = parsed.data.notes?.trim();
    const notes = previous ? (extra ? `${PREVIOUS_PAYOUT_NOTE}: ${extra}` : PREVIOUS_PAYOUT_NOTE) : extra;
    if (previous && items.length === 0) return NextResponse.json({ error: 'Elige las comisiones que ya se pagaron' }, { status: 400 });

    const agent = await prisma.user.findFirst({ where: { id: userId, tenantId: access.tenantId }, select: { id: true, name: true, email: true } });
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
    const agentName = agent.name?.trim() || agent.email.split('@')[0];

    // Cada venta solo puede pagar lo que tiene pendiente (o descontar lo que se pago de mas)
    const { rows } = await computeCommissions(access, { userId });
    const byId = new Map(rows.map((r) => [r.bookingId, r]));
    const seen = new Set<string>();
    for (const it of items) {
      const row = byId.get(it.bookingId);
      if (!row || seen.has(it.bookingId)) return NextResponse.json({ error: 'Una de las ventas no tiene comisión pendiente' }, { status: 400 });
      seen.add(it.bookingId);
      const lo = Math.min(0, row.pending) - 0.01;
      const hi = Math.max(0, row.pending) + 0.01;
      if (it.amount < lo || it.amount > hi || Math.abs(it.amount) < 0.005) {
        return NextResponse.json({ error: `La comisión de ${row.client} no puede ser ${money(it.amount)} (pendiente ${money(row.pending)})` }, { status: 400 });
      }
    }
    const commissionAmount = round2(items.reduce((t, i) => t + i.amount, 0));
    const total = round2(commissionAmount + salaryAmount + bonusAmount - deductionAmount);
    if (total <= 0) return NextResponse.json({ error: 'El total a pagar debe ser mayor a $0' }, { status: 400 });

    let bank: { id: string; currentBalance: number; referenceName: string } | null = null;
    if (bankAccountId) {
      bank = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, ...access.bankScope, isActive: true },
        select: { id: true, currentBalance: true, referenceName: true },
      });
      if (!bank) return NextResponse.json({ error: 'Cuenta bancaria no válida' }, { status: 400 });
      if (bank.currentBalance < total) return NextResponse.json({ error: `Saldo insuficiente en ${bank.referenceName}` }, { status: 400 });
    }

    const date = paidAt ? dayToDate(paidAt) : new Date();
    const parts = [
      commissionAmount !== 0 && `comisiones ${money(commissionAmount)}`,
      salaryAmount > 0 && `sueldo ${money(salaryAmount)}`,
      bonusAmount > 0 && `bono ${money(bonusAmount)}`,
      deductionAmount > 0 && `descuento ${money(deductionAmount)}`,
    ].filter(Boolean);

    const payout = await prisma.$transaction(async (tx) => {
      let bankTransactionId: string | null = null;
      if (bank) {
        const bankTx = await tx.bankTransaction.create({
          data: {
            tenantId: access.tenantId,
            bankAccountId: bank.id,
            type: 'EXPENSE',
            amount: total,
            description: `Pago a ${agentName}: ${parts.join(', ')}`,
            reference: 'Comisiones y sueldos',
            createdBy: access.userId,
            date,
          },
        });
        bankTransactionId = bankTx.id;
        await tx.bankAccount.update({ where: { id: bank.id }, data: { currentBalance: { decrement: total } } });
      }
      return tx.commissionPayout.create({
        data: {
          tenantId: access.tenantId,
          userId,
          commissionAmount,
          salaryAmount,
          bonusAmount,
          deductionAmount,
          total,
          bankAccountId: bank?.id ?? null,
          bankTransactionId,
          paidAt: date,
          notes: notes || null,
          createdBy: access.userId,
          items: { create: items.map((i) => ({ bookingId: i.bookingId, amount: round2(i.amount) })) },
        },
      });
    });
    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating payout:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 });
  }
}
