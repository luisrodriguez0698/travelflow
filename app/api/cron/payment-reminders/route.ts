import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToTenant } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UPCOMING_WINDOW_DAYS = 2;
const OVERDUE_RENOTIFY_DAYS = 3;

function formatCurrency(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const upcomingLimit = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const overdueRenotifyBefore = new Date(now.getTime() - OVERDUE_RENOTIFY_DAYS * 24 * 60 * 60 * 1000);

  // Due soon: never reminded yet, due within the next N days.
  const upcoming = await prisma.paymentPlan.findMany({
    where: {
      status: 'PENDING',
      lastReminderSentAt: null,
      dueDate: { gte: now, lte: upcomingLimit },
    },
    include: { booking: { include: { client: true } } },
  });

  // Overdue: either never reminded, or last reminder was far enough back to nudge again.
  const overdue = await prisma.paymentPlan.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
      OR: [{ lastReminderSentAt: null }, { lastReminderSentAt: { lt: overdueRenotifyBefore } }],
    },
    include: { booking: { include: { client: true } } },
  });

  let sent = 0;

  for (const payment of upcoming) {
    const tenantId = payment.booking.tenantId;
    const clientName = payment.booking.client?.fullName || 'Cliente';
    await sendPushToTenant(tenantId, {
      title: 'Pago próximo a vencer',
      body: `${clientName}: ${formatCurrency(payment.amount - payment.paidAmount)} vence el ${new Date(payment.dueDate).toLocaleDateString('es-MX')}`,
      url: `/sales/${payment.bookingId}`,
    });
    await prisma.paymentPlan.update({ where: { id: payment.id }, data: { lastReminderSentAt: now } });
    sent++;
  }

  for (const payment of overdue) {
    const tenantId = payment.booking.tenantId;
    const clientName = payment.booking.client?.fullName || 'Cliente';
    await sendPushToTenant(tenantId, {
      title: 'Pago vencido',
      body: `${clientName}: ${formatCurrency(payment.amount - payment.paidAmount)} venció el ${new Date(payment.dueDate).toLocaleDateString('es-MX')}`,
      url: `/sales/${payment.bookingId}`,
    });
    await prisma.paymentPlan.update({ where: { id: payment.id }, data: { lastReminderSentAt: now } });
    sent++;
  }

  return NextResponse.json({ upcoming: upcoming.length, overdue: overdue.length, notificationsSent: sent });
}
