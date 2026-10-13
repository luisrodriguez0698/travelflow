import { prisma } from './prisma';
import { logAudit } from './audit';
import type { Access } from './access';

// Pagar al proveedor desde un cobro: el dinero del cliente (anticipo, pago de
// contado o abono) entra a la cuenta de la agencia y, en el mismo momento, una
// parte (o todo) sale como pago a uno o varios proveedores de esa venta.
// Se registran los dos movimientos (ingreso + egreso) y baja la deuda.

export interface SupplierDebt {
  supplierId: string;
  name: string;
  debt: number;
  paid: number;
  pending: number;
}

export interface Allocation {
  supplierId: string;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deuda con cada proveedor de una venta (costo de sus servicios - pagos activos). */
export async function bookingSupplierDebts(bookingId: string, tenantId: string): Promise<SupplierDebt[]> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    select: {
      supplierId: true,
      netCost: true,
      supplier: { select: { name: true } },
      items: {
        where: { supplierId: { not: null }, cost: { gt: 0 } },
        select: { supplierId: true, cost: true, supplier: { select: { name: true } } },
      },
    },
  });
  if (!booking) return [];

  const debts = new Map<string, { name: string; debt: number }>();
  for (const item of booking.items) {
    const entry = debts.get(item.supplierId!) ?? { name: item.supplier?.name || 'Proveedor', debt: 0 };
    entry.debt += item.cost;
    debts.set(item.supplierId!, entry);
  }
  // Ventas anteriores: proveedor a nivel venta (misma regla que Proveedores > Deudas)
  if (booking.supplierId && !debts.has(booking.supplierId)) {
    debts.set(booking.supplierId, { name: booking.supplier?.name || 'Proveedor', debt: booking.netCost });
  }
  if (!debts.size) return [];

  const payments = await prisma.supplierPayment.groupBy({
    by: ['supplierId'],
    where: { bookingId, status: 'ACTIVE' },
    _sum: { amount: true },
  });
  const paidBy = Object.fromEntries(payments.map((p) => [p.supplierId, p._sum.amount ?? 0]));

  return [...debts.entries()].map(([supplierId, d]) => {
    const paid = round2(paidBy[supplierId] ?? 0);
    return { supplierId, name: d.name, debt: round2(d.debt), paid, pending: Math.max(0, round2(d.debt - paid)) };
  });
}

/** Deudas de una venta que aun no existe (formulario de nueva venta). */
export async function debtsFromFormItems(items: { supplierId?: string | null; cost?: number }[], tenantId: string): Promise<SupplierDebt[]> {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.supplierId && (item.cost || 0) > 0) totals.set(item.supplierId, (totals.get(item.supplierId) ?? 0) + (item.cost || 0));
  }
  if (!totals.size) return [];
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: [...totals.keys()] }, tenantId },
    select: { id: true, name: true },
  });
  return suppliers.map((s) => {
    const debt = round2(totals.get(s.id) ?? 0);
    return { supplierId: s.id, name: s.name, debt, paid: 0, pending: debt };
  });
}

/**
 * Valida el reparto: cada monto > 0, proveedor de esta venta, sin pasar su
 * deuda pendiente, y la suma no puede pasar el monto cobrado.
 */
export function validateAllocations(
  input: unknown,
  debts: SupplierDebt[],
  paymentAmount: number
): { allocations: Allocation[] } | { error: string } {
  if (input == null || (Array.isArray(input) && input.length === 0)) return { allocations: [] };
  if (!Array.isArray(input)) return { error: 'Reparto a proveedores no válido' };

  const merged = new Map<string, number>();
  for (const raw of input) {
    const supplierId = typeof raw?.supplierId === 'string' ? raw.supplierId : '';
    const amount = round2(Number(raw?.amount));
    if (!supplierId || !Number.isFinite(amount) || amount < 0) return { error: 'Reparto a proveedores no válido' };
    if (amount === 0) continue;
    merged.set(supplierId, round2((merged.get(supplierId) ?? 0) + amount));
  }

  const allocations: Allocation[] = [];
  for (const [supplierId, amount] of merged) {
    const debt = debts.find((d) => d.supplierId === supplierId);
    if (!debt) return { error: 'El proveedor no pertenece a esta venta' };
    if (amount > debt.pending + 0.01) {
      return { error: `A ${debt.name} solo se le deben $${debt.pending.toLocaleString('es-MX')} en esta venta` };
    }
    allocations.push({ supplierId, amount });
  }
  const total = allocations.reduce((s, a) => s + a.amount, 0);
  if (total > paymentAmount + 0.01) {
    return { error: `Lo que va a proveedores ($${round2(total).toLocaleString('es-MX')}) no puede ser mayor al cobro ($${paymentAmount.toLocaleString('es-MX')})` };
  }
  return { allocations };
}

/** Solo quien puede registrar pagos a proveedores puede repartir un cobro. */
export function allocationPermissionError(access: Access, allocations: Allocation[]): string | null {
  return allocations.length && !access.can('proveedores', 'payments')
    ? 'No tienes permiso para registrar pagos a proveedores'
    : null;
}

/**
 * Registra los pagos a proveedores desde la cuenta donde entro el cobro:
 * un egreso por proveedor + su pago (baja la deuda) + descuenta el saldo.
 */
export async function paySuppliersFromIncome(params: {
  access: Access;
  bookingId: string;
  bankAccountId: string;
  allocations: Allocation[];
  debts: SupplierDebt[];
  source: string; // "anticipo", "pago de contado", "abono"
  user: { id: string; name: string } | null;
  date?: Date;
  /** Ingreso (cobro) del que sale el dinero, para corregirlo o anularlo junto */
  sourceTransactionId?: string | null;
}) {
  const { access, bookingId, bankAccountId, allocations, debts, source, user } = params;
  if (!allocations.length) return [];
  const date = params.date ?? new Date();
  const folio = bookingId.slice(-8).toUpperCase();

  const created = await prisma.$transaction(async (tx) => {
    const result = [];
    for (const a of allocations) {
      const name = debts.find((d) => d.supplierId === a.supplierId)?.name || 'Proveedor';
      const bankTx = await tx.bankTransaction.create({
        data: {
          tenantId: access.tenantId,
          bankAccountId,
          type: 'EXPENSE',
          amount: a.amount,
          description: `Pago a proveedor: ${name} (desde ${source}, venta ${folio})`,
          reference: 'Pago a proveedor desde cobro',
          bookingId,
          sourceTransactionId: params.sourceTransactionId ?? null,
          date,
        },
      });
      const sp = await tx.supplierPayment.create({
        data: {
          tenantId: access.tenantId,
          bookingId,
          supplierId: a.supplierId,
          bankAccountId,
          bankTransactionId: bankTx.id,
          amount: a.amount,
          notes: `Pagado desde ${source} del cliente`,
          date,
          createdBy: user?.id ?? access.userId,
        },
      });
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: { currentBalance: { decrement: a.amount } } });
      result.push(sp);
    }
    return result;
  });

  if (user) {
    for (const sp of created) {
      await logAudit({
        tenantId: access.tenantId,
        userId: user.id,
        userName: user.name,
        action: 'CREATE',
        entity: 'supplier_payments',
        entityId: sp.id,
        changes: { supplierId: sp.supplierId, bookingId, amount: sp.amount, bankAccountId, _context: `Desde ${source}` },
      });
    }
  }
  return created;
}
