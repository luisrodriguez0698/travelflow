import { prisma } from '@/lib/prisma';
import { requireTenantId } from '@/lib/get-tenant';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { PaymentAlerts } from '@/components/dashboard/payment-alerts';
import { RecentSales } from '@/components/dashboard/recent-sales';
import { SalesChart, type MonthlySalesPoint } from '@/components/dashboard/sales-chart';

export const dynamic = 'force-dynamic';

// Los meses se cuentan en hora de Mexico: el servidor corre en UTC y una venta
// de las 7 pm del ultimo dia caeria en el mes siguiente.
const TIME_ZONE = 'America/Mexico_City';
const CHART_MONTHS = 12;

const monthKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' });
const monthKey = (d: Date) => monthKeyFormat.format(d).slice(0, 7); // "2026-10"

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
  const tenantId = await requireTenantId();

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
          tenantId,
          type: 'SALE',
          status: { not: 'CANCELLED' },
          saleDate: { gte: chartFrom },
        },
        select: { saleDate: true, totalPrice: true, netCost: true },
      }),

      // Active clients
      prisma.client.count({
        where: { tenantId },
      }),

      // Upcoming payments (next 7 days)
      prisma.paymentPlan.findMany({
        where: {
          booking: { tenantId },
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
          booking: { tenantId },
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
        where: { tenantId, type: 'SALE' },
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

  const metrics = {
    monthlySales: currentMonth.sales,
    salesCount: currentMonth.count,
    activeClients,
    upcomingPaymentsCount: upcomingPayments.length,
    overduePaymentsCount: overduePayments.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Vista general de tu agencia
        </p>
      </div>

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
