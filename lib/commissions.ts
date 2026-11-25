import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { Access } from '@/lib/access';

// Comisiones de agentes. No se guardan "calculadas": se obtienen de las ventas
// + la regla de cada agente (AgentPaySetting) + los ajustes por venta, y lo
// pagado sale de CommissionPayoutItem. Asi, si cambia un precio o se cancela una
// venta, la comision se recalcula sola.

import type { AgentSummary, CommissionBase, CommissionRow, CommissionStatus, EarnedWhen, SalaryFrequency } from '@/lib/commission-rules';

export * from '@/lib/commission-rules';

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const paySettingSchema = z.object({
  userId: z.string().min(1),
  baseSalary: z.number().min(0).max(10_000_000),
  salaryFrequency: z.enum(['SEMANAL', 'QUINCENAL', 'MENSUAL']),
  commissionRate: z.number().min(0).max(100),
  commissionBase: z.enum(['PROFIT', 'SALE']),
  earnedWhen: z.enum(['PAID', 'PROPORTIONAL', 'SALE']),
  startDate: dayStr,
  isActive: z.boolean(),
  notes: z.string().max(1000).optional().nullable(),
});

export const overrideSchema = z.object({
  bookingId: z.string().min(1),
  // null en ambos = quitar el ajuste (vuelve a la regla del agente)
  rate: z.number().min(0).max(100).nullable(),
  amount: z.number().min(0).max(10_000_000).nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const payoutSchema = z.object({
  userId: z.string().min(1),
  items: z.array(z.object({ bookingId: z.string().min(1), amount: z.number() })).max(500),
  salaryAmount: z.number().min(0).max(10_000_000),
  bonusAmount: z.number().min(0).max(10_000_000),
  deductionAmount: z.number().min(0).max(10_000_000),
  bankAccountId: z.string().min(1).nullable(),
  paidAt: dayStr.optional(),
  notes: z.string().max(1000).optional().nullable(),
});

/** "2026-11-25" -> Date a las 12:00 de Mexico (no se corre de dia por la zona horaria) */
export const dayToDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 18));
};

function statusOf(r: { cancelled: boolean; commission: number; earned: number; paid: number; pending: number }): CommissionStatus {
  if (r.cancelled) return r.paid > 0.01 ? 'CLAWBACK' : 'CANCELLED';
  if (r.pending < -0.01) return 'CLAWBACK';
  if (r.earned <= 0.01) return 'WAITING';
  if (r.paid >= r.commission - 0.01) return 'PAID';
  if (r.earned < r.commission - 0.01) return 'PARTIAL';
  return 'EARNED';
}

/**
 * Comisiones de las ventas de los agentes con regla configurada.
 * Con "solo lo mio" solo las del usuario. `userId` filtra a un agente.
 */
export async function computeCommissions(access: Access, opts: { userId?: string } = {}) {
  const onlyUser = access.ownOnly ? access.userId : opts.userId;
  const settings = await prisma.agentPaySetting.findMany({
    where: { tenantId: access.tenantId, ...(onlyUser && { userId: onlyUser }) },
  });
  const settingByUser = new Map(settings.map((s) => [s.userId, s]));

  // Ventas desde la fecha de inicio de cada agente, mas cualquier venta con pagos de comision
  const agentConditions = settings.map((s) => ({ createdBy: s.userId, saleDate: { gte: s.startDate } }));
  const paidBookingIds = (
    await prisma.commissionPayoutItem.findMany({
      where: { payout: { tenantId: access.tenantId, status: 'ACTIVE', ...(onlyUser && { userId: onlyUser }) } },
      select: { bookingId: true },
      distinct: ['bookingId'],
    })
  ).map((i) => i.bookingId);

  if (agentConditions.length === 0 && paidBookingIds.length === 0) return { rows: [] as CommissionRow[], settingByUser };

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: access.tenantId,
      type: 'SALE',
      OR: [...agentConditions, ...(paidBookingIds.length ? [{ id: { in: paidBookingIds } }] : [])],
    },
    select: {
      id: true,
      createdBy: true,
      saleDate: true,
      totalPrice: true,
      netCost: true,
      status: true,
      downPayment: true,
      client: { select: { fullName: true } },
      payments: { select: { paidAmount: true } },
      commissionOverride: { select: { rate: true, amount: true, note: true } },
      commissionItems: { where: { payout: { status: 'ACTIVE' } }, select: { amount: true, payout: { select: { userId: true } } } },
    },
    orderBy: { saleDate: 'desc' },
  });

  const rows: CommissionRow[] = [];
  for (const b of bookings) {
    const agentId = b.createdBy || b.commissionItems[0]?.payout.userId || '';
    if (!agentId || (onlyUser && agentId !== onlyUser)) continue;
    const setting = settingByUser.get(agentId);
    const cancelled = b.status === 'CANCELLED';
    const total = b.totalPrice;
    const cost = b.netCost;
    const base = setting?.commissionBase === 'SALE' ? total : Math.max(0, total - cost);
    const inRange = !!setting && b.saleDate >= setting.startDate;
    const rate = b.commissionOverride?.rate ?? (inRange ? setting!.commissionRate : 0);
    const commission = cancelled
      ? 0
      : round2(b.commissionOverride?.amount ?? (inRange || b.commissionOverride?.rate != null ? (base * rate) / 100 : 0));

    const collected = (b.downPayment || 0) + b.payments.reduce((t, p) => t + (p.paidAmount || 0), 0);
    const collectedPct = b.status === 'COMPLETED' || total <= 0 ? 1 : Math.min(1, collected / total);
    const when = setting?.earnedWhen ?? 'PAID';
    const earned = cancelled ? 0 : round2(when === 'SALE' ? commission : when === 'PAID' ? (collectedPct >= 0.999 ? commission : 0) : commission * collectedPct);
    const paid = round2(b.commissionItems.reduce((t, i) => t + i.amount, 0));
    const pending = round2(earned - paid);
    if (commission === 0 && paid === 0) continue;

    rows.push({
      bookingId: b.id,
      folio: b.id.slice(-8).toUpperCase(),
      client: b.client?.fullName ?? 'Cliente',
      saleDate: b.saleDate.toISOString(),
      agentId,
      total: round2(total),
      cost: round2(cost),
      baseAmount: round2(base),
      rate,
      commission,
      collectedPct: Math.round(collectedPct * 100),
      earned,
      paid,
      pending,
      status: statusOf({ cancelled, commission, earned, paid, pending }),
      cancelled,
      override: b.commissionOverride,
    });
  }
  return { rows, settingByUser };
}

/** Resumen por agente (todos los usuarios activos de la agencia, o solo el propio). */
export async function agentSummaries(access: Access, monthStart: Date): Promise<{ agents: AgentSummary[]; rows: CommissionRow[] }> {
  const { rows, settingByUser } = await computeCommissions(access);
  const users = await prisma.user.findMany({
    where: { tenantId: access.tenantId, deletedAt: null, ...(access.ownOnly && { id: access.userId }) },
    select: { id: true, name: true, email: true, avatar: true, isActive: true },
    orderBy: { name: 'asc' },
  });
  const lastPayouts = await prisma.commissionPayout.groupBy({
    by: ['userId'],
    where: { tenantId: access.tenantId, status: 'ACTIVE' },
    _max: { paidAt: true },
  });
  const lastByUser = new Map(lastPayouts.map((p) => [p.userId, p._max.paidAt]));

  const agents: AgentSummary[] = users
    // Usuarios inactivos solo si tienen algo de comisiones
    .filter((u) => u.isActive || settingByUser.has(u.id) || rows.some((r) => r.agentId === u.id))
    .map((u) => {
      const mine = rows.filter((r) => r.agentId === u.id);
      const s = settingByUser.get(u.id);
      const sum = (f: (r: CommissionRow) => number) => round2(mine.reduce((t, r) => t + f(r), 0));
      return {
        userId: u.id,
        name: u.name?.trim() || u.email.split('@')[0],
        avatar: u.avatar,
        setting: s
          ? {
              baseSalary: s.baseSalary,
              salaryFrequency: s.salaryFrequency as SalaryFrequency,
              commissionRate: s.commissionRate,
              commissionBase: s.commissionBase as CommissionBase,
              earnedWhen: s.earnedWhen as EarnedWhen,
              startDate: s.startDate.toISOString().slice(0, 10),
              isActive: s.isActive,
              notes: s.notes,
            }
          : null,
        salesCount: mine.filter((r) => !r.cancelled).length,
        generated: sum((r) => r.commission),
        earned: sum((r) => r.earned),
        paid: sum((r) => r.paid),
        pending: sum((r) => Math.max(0, r.pending)),
        toDeduct: sum((r) => Math.max(0, -r.pending)),
        waiting: sum((r) => Math.max(0, r.commission - r.earned)),
        monthGenerated: sum((r) => (new Date(r.saleDate) >= monthStart ? r.commission : 0)),
        lastPayoutAt: lastByUser.get(u.id)?.toISOString() ?? null,
      };
    });
  return { agents, rows };
}

/** Comision generada por las ventas del mes (para la utilidad neta del Dashboard). */
export async function monthCommissions(access: Access, monthStart: Date) {
  const { rows } = await computeCommissions(access);
  return round2(rows.reduce((t, r) => t + (new Date(r.saleDate) >= monthStart ? r.commission : 0), 0));
}
