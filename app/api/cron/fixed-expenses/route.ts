import { NextRequest, NextResponse } from 'next/server';
import { runFixedExpenseReminders } from '@/lib/fixed-expense-reminders';

export const dynamic = 'force-dynamic';

/** Igual que el programador interno, para dispararlo desde un cron externo (opcional). */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await runFixedExpenseReminders());
}
