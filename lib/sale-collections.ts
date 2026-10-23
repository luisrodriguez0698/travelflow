import { prisma } from './prisma';
import { logAudit } from './audit';
import type { Access } from './access';
import { INITIAL_PAYMENT_REFS } from './initial-payment';
import { bookingSupplierDebts, validateAllocations, type Allocation, type SupplierDebt } from './supplier-allocation';

// Cobros de una venta (anticipo, pago de contado, abonos) con los pagos a
// proveedores que salieron de cada uno. Permite corregir (cuenta y/o reparto
// a proveedores) o anular un cobro completo en un solo paso.

const SUPPLIER_REF = 'Pago a proveedor desde cobro';
const INITIAL_REFS = Object.values(INITIAL_PAYMENT_REFS) as string[];
const round2 = (n: number) => Math.round(n * 100) / 100;
/** En anticipo/contado la referencia del banco va al final de la descripcion. */
const NOTE_MARK = ' · Ref. ';

function noteOf(kind: CollectionKind, income: { reference: string | null; description: string }) {
  if (kind === 'abono') return income.reference ?? '';
  const i = income.description.indexOf(NOTE_MARK);
  return i >= 0 ? income.description.slice(i + NOTE_MARK.length) : '';
}

function withNote(description: string, note: string) {
  const i = description.indexOf(NOTE_MARK);
  const base = i >= 0 ? description.slice(0, i) : description;
  return note ? `${base}${NOTE_MARK}${note}` : base;
}

const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

export type CollectionKind = 'anticipo' | 'contado' | 'abono';

export interface CollectionView {
  id: string;
  kind: CollectionKind;
  amount: number;
  date: Date;
  description: string;
  /** Referencia del banco / notas */
  note: string;
  account: { id: string; name: string; bank: string };
  suppliers: { transactionId: string; supplierId: string; name: string; amount: number }[];
}

function kindOf(reference: string | null): CollectionKind {
  if (reference === INITIAL_PAYMENT_REFS.CASH) return 'contado';
  return INITIAL_REFS.includes(reference ?? '') ? 'anticipo' : 'abono';
}

/** Ingresos activos de la venta y, para cada uno, sus pagos a proveedores. */
async function loadCollections(bookingId: string, tenantId: string) {
  const [incomes, expenses] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { bookingId, tenantId, type: 'INCOME', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: { bankAccount: { select: { id: true, referenceName: true, bankName: true } } },
    }),
    prisma.bankTransaction.findMany({
      where: { bookingId, tenantId, type: 'EXPENSE', status: 'ACTIVE', reference: SUPPLIER_REF },
      orderBy: { createdAt: 'asc' },
      include: { supplierPayment: { select: { id: true, supplierId: true, supplier: { select: { name: true } } } } },
    }),
  ]);

  const claimed = new Set<string>();
  return incomes.map((income) => {
    const linked = expenses.filter((e) => {
      if (claimed.has(e.id)) return false;
      if (e.sourceTransactionId) return e.sourceTransactionId === income.id;
      // Pagos anteriores al vinculo: los registrados hasta 2 min despues del cobro
      const gap = e.createdAt.getTime() - income.createdAt.getTime();
      return gap >= 0 && gap <= 120_000;
    });
    linked.forEach((e) => claimed.add(e.id));
    return { income, linked };
  });
}

export async function listCollections(bookingId: string, tenantId: string): Promise<CollectionView[]> {
  const rows = await loadCollections(bookingId, tenantId);
  return rows.map(({ income, linked }) => ({
    id: income.id,
    kind: kindOf(income.reference),
    amount: income.amount,
    date: income.date,
    description: income.description,
    note: noteOf(kindOf(income.reference), income),
    account: { id: income.bankAccount.id, name: income.bankAccount.referenceName, bank: income.bankAccount.bankName },
    suppliers: linked
      .filter((e) => e.supplierPayment)
      .map((e) => ({
        transactionId: e.id,
        supplierId: e.supplierPayment!.supplierId,
        name: e.supplierPayment!.supplier.name,
        amount: e.amount,
      })),
  }));
}

async function findCollection(bookingId: string, tenantId: string, incomeId: string) {
  const rows = await loadCollections(bookingId, tenantId);
  return rows.find((r) => r.income.id === incomeId) ?? null;
}

type Result = { ok: true; message: string } | { ok: false; error: string; status: number };

/**
 * Corrige un cobro: lo pasa a otra cuenta, cambia el reparto a proveedores, la
 * fecha en que entro el dinero y/o la referencia del banco.
 * Todo se aplica en una sola transaccion (o nada).
 */
export async function correctCollection(params: {
  access: Access;
  bookingId: string;
  incomeId: string;
  bankAccountId: unknown;
  allocations: unknown;
  /** Fecha en que entro el dinero (ISO). Sin valor = no cambia. */
  date?: unknown;
  /** Referencia del banco / notas. undefined = no cambia. */
  note?: unknown;
  user: { id: string; name: string } | null;
}): Promise<Result> {
  const { access, bookingId, incomeId, user } = params;
  const found = await findCollection(bookingId, access.tenantId, incomeId);
  if (!found) return { ok: false, error: 'Cobro no encontrado', status: 404 };
  const { income, linked } = found;
  const kind = kindOf(income.reference);

  let newDate = income.date;
  if (typeof params.date === 'string' && params.date) {
    const parsed = new Date(params.date);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'Fecha no válida', status: 400 };
    if (parsed.getTime() > Date.now() + 60 * 60 * 1000) return { ok: false, error: 'La fecha no puede ser futura', status: 400 };
    if (!sameDay(parsed, income.date)) newDate = parsed;
  }
  const dateChanged = newDate !== income.date;
  const oldNote = noteOf(kind, income);
  const newNote = typeof params.note === 'string' ? params.note.trim().slice(0, 200) : oldNote;
  const noteChanged = newNote !== oldNote;

  const targetId = typeof params.bankAccountId === 'string' && params.bankAccountId ? params.bankAccountId : income.bankAccountId;
  const target = await prisma.bankAccount.findFirst({ where: { id: targetId, ...access.bankScope, isActive: true } });
  if (!target) return { ok: false, error: 'Cuenta bancaria no válida', status: 400 };

  // Lo que se le debe a cada proveedor, sumando de vuelta lo que salio de este cobro
  const debts: SupplierDebt[] = (await bookingSupplierDebts(bookingId, access.tenantId)).map((d) => {
    const fromThis = linked.filter((e) => e.supplierPayment?.supplierId === d.supplierId).reduce((s, e) => s + e.amount, 0);
    return { ...d, pending: round2(d.pending + fromThis) };
  });
  const check = validateAllocations(params.allocations, debts, income.amount);
  if ('error' in check) return { ok: false, error: check.error, status: 400 };
  const allocations: Allocation[] = check.allocations;

  // ¿Cambia el reparto? (mismos proveedores y montos = solo se mueve de cuenta)
  const current = new Map<string, number>();
  for (const e of linked) if (e.supplierPayment) current.set(e.supplierPayment.supplierId, round2((current.get(e.supplierPayment.supplierId) ?? 0) + e.amount));
  const sameAllocation =
    current.size === allocations.length && allocations.every((a) => Math.abs((current.get(a.supplierId) ?? -1) - a.amount) < 0.01);
  const moving = target.id !== income.bankAccountId;
  if (!moving && sameAllocation && !dateChanged && !noteChanged) return { ok: true, message: 'No hubo cambios' };

  if (!sameAllocation && !access.can('proveedores', 'payments')) {
    return { ok: false, error: 'No tienes permiso para cambiar pagos a proveedores', status: 403 };
  }

  const folio = bookingId.slice(-8).toUpperCase();
  await prisma.$transaction(async (tx) => {
    // 0) Fecha y referencia del cobro
    if (dateChanged || noteChanged) {
      await tx.bankTransaction.update({
        where: { id: income.id },
        data: {
          ...(dateChanged && { date: newDate }),
          ...(noteChanged && (kind === 'abono' ? { reference: newNote || null } : { description: withNote(income.description, newNote) })),
        },
      });
    }
    if (dateChanged) {
      // Los pagos a proveedores que salieron de este cobro llevan la misma fecha
      for (const e of linked) {
        await tx.bankTransaction.update({ where: { id: e.id }, data: { date: newDate } });
        if (e.supplierPayment) await tx.supplierPayment.update({ where: { id: e.supplierPayment.id }, data: { date: newDate } });
      }
      // Abono: las cuotas que liquido ese dia toman la nueva fecha de pago
      if (kind === 'abono') {
        const start = new Date(income.date);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        await tx.paymentPlan.updateMany({ where: { bookingId, paidDate: { gte: start, lt: end } }, data: { paidDate: newDate } });
      }
    }

    // 1) El cobro pasa a la cuenta correcta
    if (moving) {
      await tx.bankTransaction.update({ where: { id: income.id }, data: { bankAccountId: target.id } });
      await tx.bankAccount.update({ where: { id: income.bankAccountId }, data: { currentBalance: { decrement: income.amount } } });
      await tx.bankAccount.update({ where: { id: target.id }, data: { currentBalance: { increment: income.amount } } });
    }

    if (sameAllocation) {
      // 2a) Mismo reparto: los pagos a proveedores tambien se mueven de cuenta
      for (const e of linked) {
        await tx.bankTransaction.update({ where: { id: e.id }, data: { bankAccountId: target.id, sourceTransactionId: income.id } });
        await tx.bankAccount.update({ where: { id: e.bankAccountId }, data: { currentBalance: { increment: e.amount } } });
        await tx.bankAccount.update({ where: { id: target.id }, data: { currentBalance: { decrement: e.amount } } });
        if (e.supplierPayment) await tx.supplierPayment.update({ where: { id: e.supplierPayment.id }, data: { bankAccountId: target.id } });
      }
      return;
    }

    // 2b) Reparto distinto: se cancelan los pagos anteriores (vuelve la deuda y el dinero)...
    for (const e of linked) {
      await tx.bankTransaction.update({ where: { id: e.id }, data: { status: 'CANCELLED' } });
      await tx.bankAccount.update({ where: { id: e.bankAccountId }, data: { currentBalance: { increment: e.amount } } });
      if (e.supplierPayment) await tx.supplierPayment.update({ where: { id: e.supplierPayment.id }, data: { status: 'CANCELLED' } });
    }
    // ...y se registran los nuevos desde la cuenta correcta
    const source = kindOf(income.reference) === 'abono' ? 'abono' : kindOf(income.reference) === 'contado' ? 'pago de contado' : 'anticipo';
    for (const a of allocations) {
      const name = debts.find((d) => d.supplierId === a.supplierId)?.name || 'Proveedor';
      const expense = await tx.bankTransaction.create({
        data: {
          tenantId: access.tenantId,
          bankAccountId: target.id,
          type: 'EXPENSE',
          amount: a.amount,
          description: `Pago a proveedor: ${name} (desde ${source}, venta ${folio})`,
          reference: SUPPLIER_REF,
          bookingId,
          sourceTransactionId: income.id,
          date: newDate,
        },
      });
      await tx.supplierPayment.create({
        data: {
          tenantId: access.tenantId,
          bookingId,
          supplierId: a.supplierId,
          bankAccountId: target.id,
          bankTransactionId: expense.id,
          amount: a.amount,
          notes: `Pagado desde ${source} del cliente (corregido)`,
          date: newDate,
          createdBy: user?.id ?? access.userId,
        },
      });
      await tx.bankAccount.update({ where: { id: target.id }, data: { currentBalance: { decrement: a.amount } } });
    }
  });

  if (user) {
    await logAudit({
      tenantId: access.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'sales',
      entityId: bookingId,
      changes: {
        _context: `Cobro corregido: ${income.description} ($${income.amount.toLocaleString('es-MX')})`,
        ...(moving && { bankAccountId: { old: income.bankAccountId, new: target.id } }),
        ...(dateChanged && { fecha: { old: income.date.toISOString().slice(0, 10), new: newDate.toISOString().slice(0, 10) } }),
        ...(noteChanged && { referencia: { old: oldNote || '—', new: newNote || '—' } }),
        ...(!sameAllocation && {
          proveedores: {
            old: [...current.entries()].map(([id, amt]) => `${debts.find((d) => d.supplierId === id)?.name ?? id}: $${amt}`).join(', ') || 'ninguno',
            new: allocations.map((a) => `${debts.find((d) => d.supplierId === a.supplierId)?.name ?? a.supplierId}: $${a.amount}`).join(', ') || 'ninguno',
          },
        }),
      },
    });
  }
  return { ok: true, message: 'Cobro corregido' };
}

/**
 * Anula un cobro completo: cancela el ingreso y los pagos a proveedores que
 * salieron de el. Si era un abono, se revierte en el plan de pagos; si era el
 * anticipo/contado, la venta vuelve a mostrarlo como "sin banco".
 */
export async function voidCollection(params: {
  access: Access;
  bookingId: string;
  incomeId: string;
  user: { id: string; name: string } | null;
}): Promise<Result> {
  const { access, bookingId, incomeId, user } = params;
  const found = await findCollection(bookingId, access.tenantId, incomeId);
  if (!found) return { ok: false, error: 'Cobro no encontrado', status: 404 };
  const { income, linked } = found;
  if (linked.length && !access.can('proveedores', 'payments')) {
    return { ok: false, error: 'Este cobro incluye pagos a proveedores: se necesita permiso de pagos a proveedores', status: 403 };
  }
  const isAbono = kindOf(income.reference) === 'abono';

  await prisma.$transaction(async (tx) => {
    for (const e of linked) {
      await tx.bankTransaction.update({ where: { id: e.id }, data: { status: 'CANCELLED' } });
      await tx.bankAccount.update({ where: { id: e.bankAccountId }, data: { currentBalance: { increment: e.amount } } });
      if (e.supplierPayment) await tx.supplierPayment.update({ where: { id: e.supplierPayment.id }, data: { status: 'CANCELLED' } });
    }
    await tx.bankTransaction.update({ where: { id: income.id }, data: { status: 'CANCELLED' } });
    await tx.bankAccount.update({ where: { id: income.bankAccountId }, data: { currentBalance: { decrement: income.amount } } });

    if (isAbono) {
      // Se quita del plan de pagos, empezando por el ultimo pago abonado
      const plans = await tx.paymentPlan.findMany({ where: { bookingId }, orderBy: { paymentNumber: 'desc' } });
      let toReverse = income.amount;
      for (const p of plans) {
        if (toReverse <= 0) break;
        if ((p.paidAmount || 0) <= 0) continue;
        const take = Math.min(toReverse, p.paidAmount || 0);
        const paid = round2((p.paidAmount || 0) - take);
        await tx.paymentPlan.update({
          where: { id: p.id },
          data: { paidAmount: paid, status: paid >= p.amount ? 'PAID' : 'PENDING', paidDate: paid >= p.amount ? p.paidDate : null },
        });
        toReverse = round2(toReverse - take);
      }
      await tx.booking.updateMany({ where: { id: bookingId, status: 'COMPLETED' }, data: { status: 'ACTIVE' } });
    }
  });

  if (user) {
    await logAudit({
      tenantId: access.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'UPDATE',
      entity: 'sales',
      entityId: bookingId,
      changes: {
        _context: `Cobro anulado: ${income.description} ($${income.amount.toLocaleString('es-MX')})${linked.length ? ` y ${linked.length} pago(s) a proveedor` : ''}`,
      },
    });
  }
  return { ok: true, message: isAbono ? 'Abono anulado' : 'Anticipo anulado: vuelve a registrarlo con la cuenta correcta' };
}
