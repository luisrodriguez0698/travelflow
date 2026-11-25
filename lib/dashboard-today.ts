import { prisma } from '@/lib/prisma';
import type { Access } from '@/lib/access';
import { monthlyEquivalent } from '@/lib/fixed-expense-rules';
import { monthCommissions } from '@/lib/commissions';
import { EXPENSE_CATEGORIES, isExpenseCategory, type ExpenseCategory } from '@/lib/bank-categories';

// ─── Clasificacion de egresos de Bancos ───
type ExpenseKind = 'suppliers' | 'fixed' | 'commissions' | 'variable' | 'withdrawals' | 'other';
interface ExpenseTx {
  id: string;
  description: string;
  reference: string | null;
  category: string | null;
  supplierPayment: { id: string } | null;
}
const EXPENSE_SELECT = { id: true, type: true, amount: true, description: true, reference: true, category: true, supplierPayment: { select: { id: true } } } as const;

function classifyExpense(t: ExpenseTx, fixedIds: Set<string | null>): ExpenseKind {
  if (t.supplierPayment || t.reference === 'Pago a proveedor desde cobro' || t.description.startsWith('Pago a proveedor')) return 'suppliers';
  if (fixedIds.has(t.id) || t.reference === 'Gasto fijo') return 'fixed';
  if (t.reference === 'Comisiones y sueldos') return 'commissions';
  // Cierre de una cuenta archivada: no es gasto
  if (t.description.startsWith('Ajuste de cierre')) return 'other';
  if (t.category === 'RETIRO') return 'withdrawals';
  if (t.category === 'NO_GASTO') return 'other';
  return 'variable'; // capturado a mano (sin categoria = "Otro gasto")
}

async function monthFixedPaymentIds(tenantId: string, monthStart: Date) {
  const rows = await prisma.fixedExpensePayment.findMany({
    where: { tenantId, status: 'ACTIVE', paidAt: { gte: monthStart }, bankTransactionId: { not: null } },
    select: { bankTransactionId: true },
  });
  return new Set(rows.map((r) => r.bankTransactionId));
}

// "Que hago hoy" (acciones concretas del dia, cada una con su boton) y la
// utilidad neta del mes (ganancia de ventas - gastos fijos).

const TIME_ZONE = 'America/Mexico_City';
const DAY = 86_400_000;
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const shortDate = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: TIME_ZONE });

function startOfTodayMx(now: Date) {
  const [y, m, d] = dayKeyFormat.format(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6));
}
/** Dias calendario (en Mexico) desde hoy hasta la fecha: -3 = hace 3 dias. */
const daysFrom = (today: Date, d: Date) => Math.floor((startOfTodayMx(d).getTime() - today.getTime()) / DAY);

/** Link de WhatsApp (null si no hay un telefono valido). 10 digitos = Mexico. */
function whatsapp(phone: string | null | undefined, text: string) {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = `52${digits}`;
  if (digits.length < 11) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
const firstWord = (name: string) => name.trim().split(/\s+/)[0] || name;

export type TodayKind = 'overdue' | 'due' | 'supplier' | 'quote' | 'departure';

export interface TodayTask {
  id: string; // estable por dia (para marcar "hecho")
  kind: TodayKind;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
  whatsapp: string | null;
  urgency: number; // menor = mas urgente
}

const MAX_TASKS = 7;

export async function getTodayTasks(access: Access, agencyName: string, now: Date = new Date()): Promise<{ tasks: TodayTask[]; more: number }> {
  const today = startOfTodayMx(now);
  const in3 = new Date(today.getTime() + 4 * DAY); // hasta el final del 3er dia
  const tomorrowEnd = new Date(today.getTime() + 2 * DAY);
  const saleScope = { ...access.bookingScope, type: 'SALE', status: { not: 'CANCELLED' } };
  const sign = agencyName ? `\n\n${agencyName}` : '';
  const canSales = access.can('ventas');
  const canQuotes = access.can('cotizaciones');
  const canSuppliers = access.can('proveedores');

  const [plans, quotes, departures, supplierBookings] = await Promise.all([
    // Abonos vencidos o que vencen hoy (pendientes)
    canSales
      ? prisma.paymentPlan.findMany({
          where: { booking: saleScope, status: { not: 'PAID' }, dueDate: { lt: new Date(today.getTime() + DAY) } },
          select: { bookingId: true, dueDate: true, amount: true, paidAmount: true, booking: { select: { client: { select: { fullName: true, phone: true } } } } },
          orderBy: { dueDate: 'asc' },
        })
      : Promise.resolve([]),
    // Cotizaciones que vencen en los proximos 3 dias
    canQuotes
      ? prisma.booking.findMany({
          where: { ...access.bookingScope, type: 'QUOTATION', status: { not: 'CANCELLED' }, expirationDate: { gte: today, lt: in3 } },
          select: { id: true, totalPrice: true, expirationDate: true, client: { select: { fullName: true, phone: true } }, destination: { select: { name: true } } },
          orderBy: { expirationDate: 'asc' },
          take: 5,
        })
      : Promise.resolve([]),
    // Salidas de manana: mensaje de buen viaje / recordatorio
    canSales
      ? prisma.booking.findMany({
          where: { ...saleScope, departureDate: { gte: new Date(today.getTime() + DAY), lt: tomorrowEnd } },
          select: { id: true, client: { select: { fullName: true, phone: true } }, destination: { select: { name: true } } },
          take: 5,
        })
      : Promise.resolve([]),
    // Pagos a proveedores con fecha limite vencida o en los proximos 3 dias
    canSuppliers
      ? prisma.booking.findMany({
          where: {
            ...saleScope,
            OR: [
              { items: { some: { supplierId: { not: null }, cost: { gt: 0 }, supplierDeadline: { lt: in3 } } } },
              { supplierId: { not: null }, netCost: { gt: 0 }, supplierDeadline: { lt: in3 }, items: { none: { supplierId: { not: null } } } },
            ],
          },
          select: {
            id: true,
            supplierId: true,
            netCost: true,
            supplierDeadline: true,
            client: { select: { fullName: true } },
            supplier: { select: { name: true } },
            items: {
              where: { supplierId: { not: null }, cost: { gt: 0 } },
              select: { supplierId: true, cost: true, supplierDeadline: true, supplier: { select: { name: true } } },
            },
            supplierPayments: { where: { status: 'ACTIVE' }, select: { supplierId: true, amount: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const tasks: TodayTask[] = [];
  const todayKey = dayKeyFormat.format(today);

  // ─── Cobranza: un pendiente por venta (suma de sus abonos atrasados) ───
  const byBooking = new Map<string, { name: string; phone: string | null; owed: number; oldest: Date }>();
  for (const p of plans) {
    const owed = p.amount - (p.paidAmount || 0);
    if (owed <= 0.01) continue;
    const e = byBooking.get(p.bookingId) ?? { name: p.booking.client?.fullName ?? 'Cliente', phone: p.booking.client?.phone ?? null, owed: 0, oldest: p.dueDate };
    e.owed += owed;
    if (p.dueDate < e.oldest) e.oldest = p.dueDate;
    byBooking.set(p.bookingId, e);
  }
  for (const [bookingId, e] of byBooking) {
    const days = -daysFrom(today, e.oldest);
    const isToday = days <= 0;
    tasks.push({
      id: `pay-${bookingId}-${todayKey}`,
      kind: isToday ? 'due' : 'overdue',
      title: isToday ? `Cobrar a ${e.name}` : `Llamar a ${e.name}`,
      detail: isToday ? 'Su abono vence hoy' : `Debe desde hace ${days} día${days === 1 ? '' : 's'}`,
      amount: Math.round(e.owed * 100) / 100,
      href: `/sales/${bookingId}`,
      whatsapp: whatsapp(
        e.phone,
        isToday
          ? `Hola ${firstWord(e.name)} 👋, te recordamos que hoy vence tu abono de ${money(e.owed)} de tu viaje. ¡Gracias!${sign}`
          : `Hola ${firstWord(e.name)} 👋, te recordamos que tienes un saldo pendiente de ${money(e.owed)} de tu viaje (desde el ${shortDate(e.oldest)}). ¿Nos ayudas a ponerte al corriente? ¡Gracias!${sign}`
      ),
      // Lo mas atrasado y lo mas grande primero
      urgency: isToday ? 20 : 10 - Math.min(days, 9) / 10,
    });
  }

  // ─── Proveedores: lo que falta pagar por venta y proveedor ───
  for (const b of supplierBookings) {
    const debts = new Map<string, { name: string; cost: number; deadline: Date | null }>();
    const lines = b.items.length
      ? b.items.map((it) => ({ id: it.supplierId!, name: it.supplier?.name ?? 'Proveedor', cost: it.cost, deadline: it.supplierDeadline }))
      : b.supplierId
        ? [{ id: b.supplierId, name: b.supplier?.name ?? 'Proveedor', cost: b.netCost, deadline: b.supplierDeadline }]
        : [];
    for (const l of lines) {
      const d = debts.get(l.id) ?? { name: l.name, cost: 0, deadline: null };
      d.cost += l.cost;
      if (l.deadline && (!d.deadline || l.deadline < d.deadline)) d.deadline = l.deadline;
      debts.set(l.id, d);
    }
    for (const [supplierId, d] of debts) {
      if (!d.deadline || d.deadline >= in3) continue;
      const paid = b.supplierPayments.filter((p) => p.supplierId === supplierId).reduce((t, p) => t + p.amount, 0);
      const remaining = d.cost - paid;
      if (remaining <= 0.01) continue;
      const days = daysFrom(today, d.deadline);
      tasks.push({
        id: `sup-${b.id}-${supplierId}-${todayKey}`,
        kind: 'supplier',
        title: `Pagar a ${d.name}`,
        detail: `${b.client?.fullName ?? 'Cliente'} · ${days < 0 ? `venció hace ${-days} día${days === -1 ? '' : 's'}` : days === 0 ? 'vence hoy' : `vence en ${days} día${days === 1 ? '' : 's'}`}`,
        amount: Math.round(remaining * 100) / 100,
        href: `/sales/${b.id}`,
        whatsapp: null,
        urgency: days < 0 ? 11 : 15 + days,
      });
    }
  }

  // ─── Cotizaciones por vencer ───
  for (const q of quotes) {
    const days = q.expirationDate ? daysFrom(today, q.expirationDate) : 0;
    const name = q.client?.fullName ?? 'Cliente';
    tasks.push({
      id: `quote-${q.id}-${todayKey}`,
      kind: 'quote',
      title: `Seguimiento a ${name}`,
      detail: `Su cotización${q.destination?.name ? ` a ${q.destination.name}` : ''} ${days === 0 ? 'vence hoy' : days === 1 ? 'vence mañana' : `vence en ${days} días`}`,
      amount: q.totalPrice,
      href: `/quotations/${q.id}`,
      whatsapp: whatsapp(
        q.client?.phone,
        `Hola ${firstWord(name)} 👋, ¿pudiste revisar tu cotización${q.destination?.name ? ` para ${q.destination.name}` : ''}? Está vigente hasta el ${q.expirationDate ? shortDate(q.expirationDate) : 'pronto'}. Con gusto te ayudo a apartar tu lugar ✈️${sign}`
      ),
      urgency: 30 + days,
    });
  }

  // ─── Salen manana ───
  for (const d of departures) {
    const name = d.client?.fullName ?? 'Cliente';
    tasks.push({
      id: `dep-${d.id}-${todayKey}`,
      kind: 'departure',
      title: `${name} viaja mañana`,
      detail: `Mándale un mensaje de buen viaje${d.destination?.name ? ` a ${d.destination.name}` : ''}`,
      amount: null,
      href: `/sales/${d.id}`,
      whatsapp: whatsapp(
        d.client?.phone,
        `Hola ${firstWord(name)} 👋, ¡mañana empieza tu viaje${d.destination?.name ? ` a ${d.destination.name}` : ''}! ✈️ Revisa tus documentos e identificaciones. Cualquier cosa aquí estamos. ¡Buen viaje!${sign}`
      ),
      urgency: 40,
    });
  }

  tasks.sort((a, b) => a.urgency - b.urgency || (b.amount ?? 0) - (a.amount ?? 0));
  return { tasks: tasks.slice(0, MAX_TASKS), more: Math.max(0, tasks.length - MAX_TASKS) };
}

// ─────────────────────────── Utilidad neta del mes ───────────────────────────
export interface NetProfit {
  sales: number;
  supplierCost: number;
  grossProfit: number;
  fixedExpenses: number; // gasto fijo mensual (equivalente)
  fixedPaid: number; // pagado este mes
  commissions: number; // comision generada por las ventas del mes
  variableExpenses: number; // egresos capturados a mano en Bancos (oficina, publicidad...)
  variableByCategory: { label: string; emoji: string; amount: number }[];
  net: number;
}

/** Solo para quien ve todo el negocio y tiene acceso a Gastos (null si no). */
export async function getNetProfit(access: Access, month: { sales: number; profit: number }, monthStart: Date): Promise<NetProfit | null> {
  if (access.ownOnly || !access.can('gastos')) return null;
  const [expenses, paid, commissions, bankExpenses, fixedIds] = await Promise.all([
    prisma.fixedExpense.findMany({ where: { tenantId: access.tenantId, isActive: true }, select: { amount: true, frequency: true } }),
    prisma.fixedExpensePayment.aggregate({
      where: { tenantId: access.tenantId, status: 'ACTIVE', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    monthCommissions(access, monthStart),
    prisma.bankTransaction.findMany({
      where: { tenantId: access.tenantId, status: 'ACTIVE', type: 'EXPENSE', date: { gte: monthStart } },
      select: EXPENSE_SELECT,
    }),
    monthFixedPaymentIds(access.tenantId, monthStart),
  ]);
  // Gastos variables del mes: lo capturado a mano en Bancos que si es gasto del negocio
  const byCat = new Map<ExpenseCategory, number>();
  for (const t of bankExpenses) {
    if (classifyExpense(t, fixedIds) !== 'variable') continue;
    const cat: ExpenseCategory = isExpenseCategory(t.category) ? t.category : 'OTRO';
    byCat.set(cat, (byCat.get(cat) ?? 0) + t.amount);
  }
  const variable = Math.round([...byCat.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const fixed = Math.round(expenses.reduce((t, e) => t + monthlyEquivalent(e.amount, e.frequency), 0) * 100) / 100;
  return {
    sales: month.sales,
    supplierCost: month.sales - month.profit,
    grossProfit: month.profit,
    fixedExpenses: fixed,
    fixedPaid: paid._sum.amount ?? 0,
    commissions,
    variableExpenses: variable,
    variableByCategory: [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, amount]) => ({ label: EXPENSE_CATEGORIES[k].label, emoji: EXPENSE_CATEGORIES[k].emoji, amount: Math.round(amount * 100) / 100 })),
    net: Math.round((month.profit - fixed - commissions - variable) * 100) / 100,
  };
}

// ─────────────────────────── Clientes para recontactar ───────────────────────────
export interface Recontact {
  id: string;
  name: string;
  reason: 'birthday' | 'anniversary';
  detail: string;
  whatsapp: string | null;
  today: boolean;
}

/** Cumpleaneros del mes y quienes viajaron hace ~1 año (sin venta nueva desde entonces). */
export async function getRecontacts(access: Access, agencyName: string, now: Date = new Date()): Promise<Recontact[] | null> {
  if (!access.can('clientes') && !access.can('ventas')) return null;
  const today = startOfTodayMx(now);
  const [, curMonth, curDay] = dayKeyFormat.format(today).split('-').map(Number);
  const sign = agencyName ? `\n\n${agencyName}` : '';
  const yearAgoFrom = new Date(today.getTime() - 380 * DAY);
  const yearAgoTo = new Date(today.getTime() - 335 * DAY);

  const [withBirthday, trips] = await Promise.all([
    prisma.client.findMany({
      where: { ...access.clientScope, birthDate: { not: null } },
      select: { id: true, fullName: true, phone: true, birthDate: true },
    }),
    prisma.booking.findMany({
      where: { ...access.bookingScope, type: 'SALE', status: { not: 'CANCELLED' }, departureDate: { gte: yearAgoFrom, lt: yearAgoTo } },
      select: {
        departureDate: true,
        clientId: true,
        destination: { select: { name: true } },
        client: { select: { fullName: true, phone: true } },
      },
      orderBy: { departureDate: 'asc' },
      take: 40,
    }),
  ]);

  // La fecha de nacimiento se guarda como dia (00:00 UTC): se lee en UTC
  const birthdays: Recontact[] = withBirthday
    .filter((c) => c.birthDate && c.birthDate.getUTCMonth() + 1 === curMonth && c.birthDate.getUTCDate() >= curDay)
    .sort((a, b) => a.birthDate!.getUTCDate() - b.birthDate!.getUTCDate())
    .slice(0, 5)
    .map((c) => {
      const day = c.birthDate!.getUTCDate();
      const isToday = day === curDay;
      return {
        id: `b-${c.id}`,
        name: c.fullName,
        reason: 'birthday' as const,
        detail: isToday ? '¡Cumple años hoy! 🎂' : `Cumple el ${day}`,
        today: isToday,
        whatsapp: whatsapp(c.phone, `¡Feliz cumpleaños, ${firstWord(c.fullName)}! 🎉🎂 Te deseamos un año lleno de viajes increíbles. Si quieres celebrar con una escapada, aquí estamos ✈️${sign}`),
      };
    });

  // Solo quienes no han vuelto a comprar desde ese viaje
  const tripClientIds = [...new Set(trips.map((t) => t.clientId))];
  const boughtAgain = tripClientIds.length
    ? await prisma.booking.findMany({
        where: { ...access.bookingScope, type: 'SALE', clientId: { in: tripClientIds }, saleDate: { gte: yearAgoFrom } },
        select: { clientId: true, departureDate: true },
      })
    : [];
  const seen = new Set<string>();
  const anniversaries: Recontact[] = [];
  for (const t of trips) {
    if (seen.has(t.clientId)) continue;
    seen.add(t.clientId);
    // Tiene otro viaje despues de este: ya volvio a comprar
    if (boughtAgain.some((b) => b.clientId === t.clientId && b.departureDate && t.departureDate && b.departureDate > t.departureDate)) continue;
    const name = t.client?.fullName ?? 'Cliente';
    const dest = t.destination?.name;
    anniversaries.push({
      id: `a-${t.clientId}`,
      name,
      reason: 'anniversary',
      detail: `Viajó${dest ? ` a ${dest}` : ''} hace un año`,
      today: false,
      whatsapp: whatsapp(
        t.client?.phone,
        `Hola ${firstWord(name)} 👋, ¡hace un año estabas de viaje${dest ? ` en ${dest}` : ''}! 🌴 ¿Ya estás pensando en tu próxima aventura? Tenemos opciones increíbles para ti ✈️${sign}`
      ),
    });
    if (anniversaries.length >= 5) break;
  }

  return [...birthdays, ...anniversaries];
}

// ─────────────────────────── Flujo de bancos del mes ───────────────────────────
export interface MonthCashFlow {
  income: number;
  suppliers: number;
  fixed: number;
  commissions: number;
  variable: number; // gastos varios capturados a mano
  withdrawals: number; // retiros del dueño/socio
  other: number; // no es gasto (devoluciones, ajustes)
  net: number;
}

/** Lo que entro y salio de las cuentas que el usuario puede ver (sin transferencias). */
export async function getMonthCashFlow(access: Access, monthStart: Date): Promise<MonthCashFlow | null> {
  if (!access.can('bancos')) return null;
  const [txs, fixedIds] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { tenantId: access.tenantId, status: 'ACTIVE', date: { gte: monthStart }, type: { in: ['INCOME', 'EXPENSE'] }, bankAccount: access.bankScope },
      select: EXPENSE_SELECT,
    }),
    monthFixedPaymentIds(access.tenantId, monthStart),
  ]);
  const flow = { income: 0, suppliers: 0, fixed: 0, commissions: 0, variable: 0, withdrawals: 0, other: 0 };
  for (const t of txs) {
    if (t.type === 'INCOME') {
      // La entrada de una transferencia entre cuentas propias no es dinero nuevo
      if (!t.description.startsWith('Transferencia desde')) flow.income += t.amount;
      continue;
    }
    flow[classifyExpense(t, fixedIds)] += t.amount;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    income: r(flow.income),
    suppliers: r(flow.suppliers),
    fixed: r(flow.fixed),
    commissions: r(flow.commissions),
    variable: r(flow.variable),
    withdrawals: r(flow.withdrawals),
    other: r(flow.other),
    net: r(flow.income - flow.suppliers - flow.fixed - flow.commissions - flow.variable - flow.withdrawals - flow.other),
  };
}
