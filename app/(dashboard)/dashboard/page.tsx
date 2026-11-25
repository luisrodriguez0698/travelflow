import { prisma } from '@/lib/prisma';
import { requireAccess } from '@/lib/access';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { PaymentAlerts } from '@/components/dashboard/payment-alerts';
import { RecentSales } from '@/components/dashboard/recent-sales';
import { SalesChart, type MonthlySalesPoint } from '@/components/dashboard/sales-chart';
import { LiveRefresh } from '@/components/live-refresh';
import { DashboardGreeting } from '@/components/dashboard/greeting';
import { CockpitGauges, type CockpitData } from '@/components/dashboard/cockpit-gauges';
import { getDashboardInsights } from '@/lib/dashboard-insights';
import { getMonthCashFlow, getNetProfit, getRecontacts, getTodayTasks } from '@/lib/dashboard-today';
import { MonthCashFlowCard, MonthPace, RecontactCard } from '@/components/dashboard/extras';
import { DashboardSections, type DashboardSection } from '@/components/dashboard/dashboard-sections';
import { TodayTasks } from '@/components/dashboard/today-tasks';
import { NetProfitCard } from '@/components/dashboard/net-profit';
import { AgentRanking, CollectionForecast, PaymentMixCard, QuoteFunnelCard, TopDestinations } from '@/components/dashboard/insights';

export const dynamic = 'force-dynamic';

// Los meses se cuentan en hora de Mexico: el servidor corre en UTC y una venta
// de las 7 pm del ultimo dia caeria en el mes siguiente.
const TIME_ZONE = 'America/Mexico_City';
const CHART_MONTHS = 12;

const monthKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' });
const monthKey = (d: Date) => monthKeyFormat.format(d).slice(0, 7); // "2026-10"
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (d: Date) => dayKeyFormat.format(d); // "2026-10-09"

function lastMonths(now: Date, count: number) {
  const [year, month] = monthKey(now).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 15));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: d.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
      fullLabel: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      start: d,
    };
  });
}

export default async function DashboardPage() {
  // Con "solo lo mio" los indicadores muestran solo las ventas/clientes del usuario
  const access = await requireAccess('dashboard');

  // Get current month metrics
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Run all queries in parallel for faster load
  // 24 meses: los 12 de la grafica + los 12 anteriores para comparar contra el año pasado
  const months = lastMonths(now, CHART_MONTHS * 2);
  // Un dia de margen antes del primer mes por la diferencia de zona horaria
  const chartFrom = new Date(Date.UTC(months[0].start.getUTCFullYear(), months[0].start.getUTCMonth(), 1) - 86_400_000);

  const [chartSales, activeClients, upcomingPayments, overduePayments, recentSales] =
    await Promise.all([
      // Ventas de los ultimos 12 meses (grafica + tarjetas del mes)
      prisma.booking.findMany({
        where: {
          ...access.bookingScope,
          type: 'SALE',
          status: { not: 'CANCELLED' },
          saleDate: { gte: chartFrom },
        },
        select: { saleDate: true, totalPrice: true, netCost: true },
      }),

      // Active clients
      prisma.client.count({
        where: access.clientScope,
      }),

      // Upcoming payments (next 7 days)
      prisma.paymentPlan.findMany({
        where: {
          booking: access.bookingScope,
          status: 'PENDING',
          dueDate: {
            gte: now,
            lte: nextWeek,
          },
        },
        include: {
          booking: {
            include: {
              client: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      }),

      // Overdue payments
      prisma.paymentPlan.findMany({
        where: {
          booking: access.bookingScope,
          status: 'PENDING',
          dueDate: {
            lt: now,
          },
        },
        include: {
          booking: {
            include: {
              client: true,
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      }),

      // Recent sales (las cotizaciones no: el enlace va a /sales/[id])
      prisma.booking.findMany({
        where: { ...access.bookingScope, type: 'SALE' },
        include: {
          client: true,
          destination: true,
        },
        orderBy: {
          saleDate: 'desc',
        },
        take: 5,
      }),
    ]);

  const byMonth = new Map<string, MonthlySalesPoint>(
    months.map((m) => [m.key, { month: m.key, label: m.label, fullLabel: m.fullLabel, sales: 0, profit: 0, count: 0 }])
  );
  for (const sale of chartSales) {
    const point = byMonth.get(monthKey(sale.saleDate));
    if (!point) continue;
    point.sales += sale.totalPrice;
    point.profit += sale.totalPrice - sale.netCost;
    point.count += 1;
  }
  const allPoints = [...byMonth.values()];
  const chartData = allPoints.slice(-CHART_MONTHS).map((p, i) => ({ ...p, lastYear: allPoints[i].sales }));
  const currentMonth = chartData[chartData.length - 1];

  // ─── Saludo: nombre y lo de hoy ───
  const todayKey = dayKey(now);
  const [me, departuresSoon] = await Promise.all([
    prisma.user.findUnique({ where: { id: access.userId }, select: { name: true, tenant: { select: { name: true } } } }),
    prisma.booking.findMany({
      where: {
        ...access.bookingScope,
        type: 'SALE',
        status: { not: 'CANCELLED' },
        departureDate: { gte: new Date(now.getTime() - 36 * 3600_000), lte: new Date(now.getTime() + 36 * 3600_000) },
      },
      select: { departureDate: true },
    }),
  ]);
  // El propietario suele llamarse igual que la agencia: en ese caso no se usa como nombre
  const rawName = me?.name?.trim() || '';
  const firstName =
    rawName && rawName.toLowerCase() !== (me?.tenant.name || '').trim().toLowerCase()
      ? rawName.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase())
      : null;
  const paymentsDueToday = [...upcomingPayments, ...overduePayments].filter((p) => dayKey(p.dueDate) === todayKey).length;
  const departuresToday = departuresSoon.filter((b) => b.departureDate && dayKey(b.departureDate) === todayKey).length;
  const overdueBeforeToday = overduePayments.filter((p) => dayKey(p.dueDate) !== todayKey).length;

  // ─── Cabina de vuelo: meta, margen y cobranza del mes ───
  const [cy, cm] = currentMonth.month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(cy, cm - 1, 1, 6)); // 00:00 en Mexico (UTC-6)
  // Comparacion justa: el mes en curso contra el mismo tramo del mes pasado
  // (del 1 al mismo dia), no contra el mes pasado completo.
  const prevMonthStart = new Date(Date.UTC(cy, cm - 2, 1, 6));
  const prevCutoff = new Date(Math.min(prevMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()));
  const prevPeriod = chartSales.filter((s) => s.saleDate >= prevMonthStart && s.saleDate < prevCutoff);
  const prevLastDay = new Date(prevCutoff.getTime() - 1);
  const prevLabel = `vs 1–${prevLastDay.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TIME_ZONE }).replace('.', '')}`;

  const [goals, dueThisMonth, insights, today, netProfit, recontacts, cashFlow] = await Promise.all([
    prisma.salesGoal.findMany({
      // Con "solo lo mio" se compara contra la meta propia; si no, la del equipo
      where: { tenantId: access.tenantId, month: cm, year: cy, ...(access.ownOnly && { userId: access.userId }) },
      select: { goalAmount: true },
    }),
    prisma.paymentPlan.findMany({
      where: { booking: { ...access.bookingScope, type: 'SALE', status: { not: 'CANCELLED' } }, dueDate: { gte: monthStart, lte: now } },
      select: { amount: true, paidAmount: true },
    }),
    getDashboardInsights(access, monthStart, now),
    getTodayTasks(access, me?.tenant.name ?? '', now),
    getNetProfit(access, currentMonth, monthStart),
    getRecontacts(access, me?.tenant.name ?? '', now),
    getMonthCashFlow(access, monthStart),
  ]);
  const goalAmount = goals.reduce((sum, g) => sum + g.goalAmount, 0);
  const due = dueThisMonth.reduce((sum, p) => sum + p.amount, 0);
  const collected = dueThisMonth.reduce((sum, p) => sum + Math.min(p.paidAmount || 0, p.amount), 0);
  const cockpit: CockpitData = {
    goalPct: goalAmount > 0 ? (currentMonth.sales / goalAmount) * 100 : null,
    monthSales: currentMonth.sales,
    goalAmount,
    suggestedGoal: (() => {
      // Promedio de los 3 meses completos anteriores (los que tuvieron ventas)
      const prev3 = chartData.slice(-4, -1).filter((p) => p.sales > 0);
      return prev3.length ? Math.round(prev3.reduce((t, p) => t + p.sales, 0) / prev3.length) : null;
    })(),
    canSetGoal: access.can('ventas', 'edit'),
    // Margen sobre el costo (igual que en Margenes y en cada venta)
    marginPct: currentMonth.sales - currentMonth.profit > 0 ? (currentMonth.profit / (currentMonth.sales - currentMonth.profit)) * 100 : 0,
    profit: currentMonth.profit,
    collectionPct: due > 0 ? (collected / due) * 100 : null,
    dueThisMonth: due,
    collectedThisMonth: collected,
  };

  const metrics = {
    monthlySales: currentMonth.sales,
    salesCount: currentMonth.count,
    activeClients,
    upcomingPaymentsCount: upcomingPayments.length,
    overduePaymentsCount: overduePayments.length,
    prevMonthlySales: prevPeriod.reduce((t, s) => t + s.totalPrice, 0),
    prevSalesCount: prevPeriod.length,
    prevLabel,
  };

  // Con un solo agente (o "solo lo mio") el ranking no aporta: se muestra el ritmo del mes
  const soloAgent = !insights.agents || insights.agents.length <= 1;
  const sections: DashboardSection[] = [
    { id: 'cobranza', label: 'Cobranza que viene', wide: true, node: <CollectionForecast weeks={insights.forecast} /> },
    soloAgent
      ? { id: 'ritmo', label: 'Tu ritmo del mes', node: <MonthPace weeks={insights.pace} agentName={insights.agents?.[0]?.name ?? firstName ?? undefined} /> }
      : { id: 'ritmo', label: 'Ranking de agentes', node: <AgentRanking agents={insights.agents!} /> },
    ...(cashFlow ? [{ id: 'flujo', label: 'Flujo de bancos del mes', node: <MonthCashFlowCard flow={cashFlow} /> }] : []),
    ...(recontacts ? [{ id: 'recontactar', label: 'Para recontactar', node: <RecontactCard people={recontacts} /> }] : []),
    { id: 'destinos', label: 'Destinos y hoteles top', node: <TopDestinations destinations={insights.destinations} hotels={insights.hotels} /> },
    { id: 'embudo', label: 'Embudo de cotizaciones', node: <QuoteFunnelCard funnel={insights.funnel} /> },
    { id: 'mezcla', label: 'Contado vs crédito', node: <PaymentMixCard mix={insights.mix} /> },
    {
      id: 'alertas',
      label: 'Alertas de cobranza',
      tour: 'dash-activity',
      node: <PaymentAlerts upcomingPayments={upcomingPayments} overduePayments={overduePayments} />,
    },
    { id: 'recientes', label: 'Ventas recientes', node: <RecentSales sales={recentSales} /> },
  ];

  return (
    <div className="space-y-6">
      <DashboardGreeting
        firstName={firstName}
        paymentsDueToday={paymentsDueToday}
        departuresToday={departuresToday}
        overdueCount={overdueBeforeToday}
      />

      {/* Tiempo real: si alguien vende o registra un abono, el Dashboard se actualiza solo */}
      <LiveRefresh entities={['sales', 'clients']} />

      {/* Lista de trabajo del dia: cobrar, pagar, dar seguimiento */}
      <div data-tour="dash-today">
        <TodayTasks tasks={today.tasks} more={today.more} />
      </div>

      <div data-tour="dash-metrics">
        <MetricsCards metrics={metrics} />
      </div>

      <div data-tour="dash-cockpit">
        <CockpitGauges data={cockpit} />
      </div>

      {netProfit && (
        <div data-tour="dash-net">
          <NetProfitCard data={netProfit} />
        </div>
      )}

      <div data-tour="dash-chart">
        <SalesChart data={chartData} />
      </div>

      {/* Analitica: cada persona puede ocultar y ordenar estas secciones */}
      <DashboardSections sections={sections} />
    </div>
  );
}
