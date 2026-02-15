import { prisma } from '@/lib/prisma';
import { requireTenantId } from '@/lib/get-tenant';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { PaymentAlerts } from '@/components/dashboard/payment-alerts';
import { RecentSales } from '@/components/dashboard/recent-sales';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const tenantId = await requireTenantId();

  // Get current month metrics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Run all queries in parallel for faster load
  const [monthlySales, activeClients, upcomingPayments, overduePayments, recentSales] =
    await Promise.all([
      // Monthly sales
      prisma.booking.aggregate({
        where: {
          tenantId,
          saleDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: { not: 'CANCELLED' },
        },
        _sum: {
          totalPrice: true,
        },
        _count: true,
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

      // Recent sales
      prisma.booking.findMany({
        where: { tenantId },
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

  const metrics = {
    monthlySales: monthlySales._sum.totalPrice ?? 0,
    salesCount: monthlySales._count,
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

      <MetricsCards metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentAlerts
          upcomingPayments={upcomingPayments}
          overduePayments={overduePayments}
        />
        <RecentSales sales={recentSales} />
      </div>
    </div>
  );
}
