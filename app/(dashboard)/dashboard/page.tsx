import { prisma } from '@/lib/prisma';
import { requireAccess } from '@/lib/access';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { PaymentAlerts } from '@/components/dashboard/payment-alerts';
import { RecentSales } from '@/components/dashboard/recent-sales';
import { SalesChart, type MonthlySalesPoint } from '@/components/dashboard/sales-chart';
import { LiveRefresh } from '@/components/live-refresh';
import { DashboardGreeting } from '@/components/dashboard/greeting';

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
  const months = lastMonths(now, CHART_MONTHS);
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
  const chartData = [...byMonth.values()];
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

  const metrics = {
    monthlySales: currentMonth.sales,
    salesCount: currentMonth.count,
    activeClients,
    upcomingPaymentsCount: upcomingPayments.length,
    overduePaymentsCount: overduePayments.length,
  };

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

      <div data-tour="dash-metrics">
        <MetricsCards metrics={metrics} />
      </div>

      <div data-tour="dash-chart">
        <SalesChart data={chartData} />
      </div>

      <div data-tour="dash-activity" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentAlerts
          upcomingPayments={upcomingPayments}
          overduePayments={overduePayments}
        />
        <RecentSales sales={recentSales} />
      </div>
    </div>
  );
}
