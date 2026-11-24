import { prisma } from '@/lib/prisma';
import type { Access } from '@/lib/access';

// Analitica extra del Dashboard: cobranza por semana, ranking de agentes,
// destinos/hoteles top, embudo de cotizaciones y contado vs credito.
// Todo respeta el alcance del usuario (bookingScope / "solo lo mio").

const TIME_ZONE = 'America/Mexico_City';
const DAY = 86_400_000;
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 00:00 de hoy en Mexico (UTC-6, sin horario de verano desde 2022). */
function startOfTodayMx(now: Date) {
  const [y, m, d] = dayKeyFormat.format(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6));
}

const shortDay = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TIME_ZONE }).replace('.', '');
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ForecastWeek {
  label: string;
  expected: number;
  collected: number;
  current: boolean;
  past: boolean;
}

export interface AgentRank {
  name: string;
  total: number;
  count: number;
  profit: number;
}

export interface TopItem {
  name: string;
  count: number;
  total: number;
}

export interface QuoteFunnel {
  created: number;
  converted: number;
  openCount: number;
  openAmount: number;
}

export interface PaymentMix {
  cashCount: number;
  cashTotal: number;
  creditCount: number;
  creditTotal: number;
  avgTicket: number;
}

/** Ventas del mes por tramo de dias (1-7, 8-14...), para "Tu ritmo del mes". */
export interface PaceWeek {
  label: string;
  total: number;
  count: number;
  current: boolean;
  future: boolean;
}

export interface DashboardInsights {
  forecast: ForecastWeek[];
  pace: PaceWeek[];
  agents: AgentRank[] | null; // null = "solo lo mio" (un ranking de una persona no aporta)
  destinations: TopItem[];
  hotels: TopItem[];
  funnel: QuoteFunnel;
  mix: PaymentMix;
}

const WEEKS_BACK = 3;
const WEEKS_AHEAD = 5;
const TOP_DAYS = 90;

export async function getDashboardInsights(access: Access, monthStart: Date, now: Date = new Date()): Promise<DashboardInsights> {
  const today = startOfTodayMx(now);
  // Semanas que arrancan en lunes (getUTCDay sobre la medianoche de Mexico + 6h = mismo dia)
  const weekday = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(today.getTime() - weekday * DAY);
  const forecastFrom = new Date(thisMonday.getTime() - WEEKS_BACK * 7 * DAY);
  const forecastTo = new Date(thisMonday.getTime() + (WEEKS_AHEAD + 1) * 7 * DAY);
  const topFrom = new Date(Math.min(today.getTime() - TOP_DAYS * DAY, monthStart.getTime()));
  const saleScope = { ...access.bookingScope, type: 'SALE', status: { not: 'CANCELLED' } };

  const [plans, sales, quotesCreated, conversions, openQuotes] = await Promise.all([
    prisma.paymentPlan.findMany({
      where: { booking: saleScope, dueDate: { gte: forecastFrom, lt: forecastTo } },
      select: { dueDate: true, amount: true, paidAmount: true },
    }),
    prisma.booking.findMany({
      where: { ...saleScope, saleDate: { gte: topFrom } },
      select: {
        saleDate: true,
        totalPrice: true,
        netCost: true,
        paymentType: true,
        createdBy: true,
        hotelId: true,
        destination: { select: { name: true } },
        hotel: { select: { destination: { select: { name: true } } } },
        // Destino y hotel tambien pueden venir por servicio (ventas con varios servicios)
        items: {
          where: { OR: [{ hotelId: { not: null } }, { destinationId: { not: null } }] },
          select: {
            type: true,
            hotelId: true,
            destination: { select: { name: true } },
            hotel: { select: { destination: { select: { name: true } } } },
          },
        },
      },
    }),
    // Cotizaciones creadas este mes que siguen siendo cotizacion (las convertidas se suman abajo)
    prisma.booking.count({
      where: { ...access.bookingScope, type: 'QUOTATION', createdAt: { gte: monthStart } },
    }),
    // Conversiones del mes: cambio de type QUOTATION -> SALE
    prisma.auditLog.findMany({
      where: {
        tenantId: access.tenantId,
        entity: 'sales',
        action: 'UPDATE',
        createdAt: { gte: monthStart },
        changes: { path: ['type', 'new'], equals: 'SALE' },
      },
      select: { entityId: true },
    }),
    prisma.booking.aggregate({
      where: {
        ...access.bookingScope,
        type: 'QUOTATION',
        status: { not: 'CANCELLED' },
        OR: [{ expirationDate: null }, { expirationDate: { gte: today } }],
      },
      _count: true,
      _sum: { totalPrice: true },
    }),
  ]);

  // ─── Cobranza por semana ───
  const forecast: ForecastWeek[] = Array.from({ length: WEEKS_BACK + 1 + WEEKS_AHEAD }, (_, i) => {
    const start = new Date(forecastFrom.getTime() + i * 7 * DAY);
    return { label: shortDay(start), expected: 0, collected: 0, current: i === WEEKS_BACK, past: i < WEEKS_BACK };
  });
  for (const p of plans) {
    const idx = Math.floor((p.dueDate.getTime() - forecastFrom.getTime()) / (7 * DAY));
    const w = forecast[idx];
    if (!w) continue;
    w.expected += p.amount;
    w.collected += Math.min(p.paidAmount || 0, p.amount);
  }
  forecast.forEach((w) => {
    w.expected = round2(w.expected);
    w.collected = round2(w.collected);
  });

  // ─── Ventas del mes: ranking y mezcla de pago ───
  const monthSales = sales.filter((s) => s.saleDate >= monthStart);
  let agents: AgentRank[] | null = null;
  if (!access.ownOnly) {
    const byAgent = new Map<string, { total: number; count: number; profit: number }>();
    for (const s of monthSales) {
      const key = s.createdBy || '';
      const a = byAgent.get(key) ?? { total: 0, count: 0, profit: 0 };
      a.total += s.totalPrice;
      a.count += 1;
      a.profit += s.totalPrice - s.netCost;
      byAgent.set(key, a);
    }
    const ids = [...byAgent.keys()].filter(Boolean);
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids }, tenantId: access.tenantId }, select: { id: true, name: true, email: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name?.trim() || u.email.split('@')[0]]));
    agents = [...byAgent.entries()]
      .map(([id, a]) => ({ name: names.get(id) ?? 'Sin agente', total: round2(a.total), count: a.count, profit: round2(a.profit) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }

  // ─── Ritmo del mes (semanas del mes: 1-7, 8-14, 15-21, 22-28, 29-fin) ───
  const dayOfMonth = (d: Date) => Number(dayKeyFormat.format(d).slice(8, 10));
  const todayDom = dayOfMonth(now);
  const monthLabel = monthStart.toLocaleDateString('es-MX', { month: 'short', timeZone: TIME_ZONE }).replace('.', '');
  const lastDom = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const pace: PaceWeek[] = [0, 1, 2, 3, 4]
    .filter((i) => i * 7 + 1 <= lastDom)
    .map((i) => {
      const from = i * 7 + 1;
      const to = i === 4 ? lastDom : Math.min(from + 6, lastDom);
      return { label: `${from}–${to} ${monthLabel}`, total: 0, count: 0, current: todayDom >= from && todayDom <= to, future: todayDom < from };
    });
  for (const s of monthSales) {
    const w = pace[Math.min(Math.floor((dayOfMonth(s.saleDate) - 1) / 7), pace.length - 1)];
    w.total += s.totalPrice;
    w.count += 1;
  }
  pace.forEach((w) => {
    w.total = round2(w.total);
  });

  const cash = monthSales.filter((s) => s.paymentType !== 'CREDIT');
  const credit = monthSales.filter((s) => s.paymentType === 'CREDIT');
  const sum = (arr: typeof monthSales) => round2(arr.reduce((t, s) => t + s.totalPrice, 0));
  const mix: PaymentMix = {
    cashCount: cash.length,
    cashTotal: sum(cash),
    creditCount: credit.length,
    creditTotal: sum(credit),
    avgTicket: monthSales.length ? round2(sum(monthSales) / monthSales.length) : 0,
  };

  // ─── Destinos y hoteles top (ultimos 90 dias) ───
  const recent = sales.filter((s) => s.saleDate.getTime() >= today.getTime() - TOP_DAYS * DAY);
  const destMap = new Map<string, TopItem>();
  const hotelMap = new Map<string, { count: number; total: number }>();
  for (const s of recent) {
    // Destino de la venta; si no tiene, el del primer servicio/hotel que lo traiga
    const fromItem = s.items.map((it) => it.destination?.name || it.hotel?.destination?.name).find(Boolean);
    const dn = (s.destination?.name || s.hotel?.destination?.name || fromItem || '').trim() || 'Sin destino';
    const d = destMap.get(dn) ?? { name: dn, count: 0, total: 0 };
    d.count += 1;
    d.total += s.totalPrice;
    destMap.set(dn, d);
    const hotelIds = new Set<string>(s.items.filter((it) => it.type === 'HOTEL').map((it) => it.hotelId).filter((h): h is string => !!h));
    if (hotelIds.size === 0 && s.hotelId) hotelIds.add(s.hotelId);
    for (const h of hotelIds) {
      const e = hotelMap.get(h) ?? { count: 0, total: 0 };
      e.count += 1;
      e.total += s.totalPrice / hotelIds.size;
      hotelMap.set(h, e);
    }
  }
  const destSorted = [...destMap.values()].sort((a, b) => b.total - a.total);
  const destinations = destSorted.slice(0, 5).map((d) => ({ ...d, total: round2(d.total) }));
  const rest = destSorted.slice(5);
  if (rest.length) {
    destinations.push({ name: 'Otros', count: rest.reduce((t, d) => t + d.count, 0), total: round2(rest.reduce((t, d) => t + d.total, 0)) });
  }

  const topHotelIds = [...hotelMap.entries()].sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total).slice(0, 5);
  const hotelRows = topHotelIds.length
    ? await prisma.hotel.findMany({ where: { id: { in: topHotelIds.map(([id]) => id) }, tenantId: access.tenantId }, select: { id: true, name: true } })
    : [];
  const hotelNames = new Map(hotelRows.map((h) => [h.id, h.name]));
  const hotels = topHotelIds.map(([id, h]) => ({ name: hotelNames.get(id) ?? 'Hotel', count: h.count, total: round2(h.total) }));

  // ─── Embudo de cotizaciones ───
  // Conversiones del mes (de la bitacora) limitadas al alcance del usuario; las
  // que se crearon este mes tambien cuentan como "cotizaciones del mes".
  const convertedIds = [...new Set(conversions.map((c) => c.entityId))];
  const [converted, convertedCreatedThisMonth] = convertedIds.length
    ? await Promise.all([
        prisma.booking.count({ where: { ...access.bookingScope, id: { in: convertedIds } } }),
        prisma.booking.count({ where: { ...access.bookingScope, id: { in: convertedIds }, createdAt: { gte: monthStart } } }),
      ])
    : [0, 0];
  const funnel: QuoteFunnel = {
    created: quotesCreated + convertedCreatedThisMonth,
    converted,
    openCount: openQuotes._count,
    openAmount: round2(openQuotes._sum.totalPrice ?? 0),
  };

  return { forecast, pace, agents, destinations, hotels, funnel, mix };
}
