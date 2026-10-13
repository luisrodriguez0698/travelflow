import { prismaBase as prisma } from './prisma'; // sin bitacora: corre en segundo plano, sin usuario
import { notifyActivity, formatMoney } from './activity';
import { daysUntil, EXPENSE_CATEGORIES, type ExpenseCategory } from './fixed-expense-rules';

// Recordatorios de gastos fijos. Avisa (campana + push) a quien tiene acceso a
// "Gastos fijos": N dias antes, el dia que vence y, si se vence, cada 3 dias.
// Es idempotente: se puede ejecutar cada hora sin repetir avisos.

const OVERDUE_RENOTIFY_MS = 3 * 86_400_000;
const SYSTEM_ACTOR = { id: 'system', name: 'TravelFlow' };

type Stage = 'BEFORE' | 'DUE' | 'OVERDUE';

export async function runFixedExpenseReminders(now: Date = new Date()) {
  // Candidatos: activos, con aviso, que vencen dentro de 15 dias o ya vencieron
  const horizon = new Date(now.getTime() + 16 * 86_400_000);
  const expenses = await prisma.fixedExpense.findMany({
    where: { isActive: true, notify: true, nextDueDate: { lte: horizon } },
  });

  let sent = 0;
  for (const e of expenses) {
    const days = daysUntil(e.nextDueDate, now);
    let stage: Stage | null = null;
    if (days < 0) stage = 'OVERDUE';
    else if (days === 0) stage = 'DUE';
    else if (days <= e.remindDaysBefore) stage = 'BEFORE';
    if (!stage) continue;

    const sameDue = e.lastReminderDue?.getTime() === e.nextDueDate.getTime();
    const already =
      sameDue &&
      e.lastReminderStage === stage &&
      (stage !== 'OVERDUE' || (e.lastReminderAt && now.getTime() - e.lastReminderAt.getTime() < OVERDUE_RENOTIFY_MS));
    if (already) continue;

    const category = EXPENSE_CATEGORIES[e.category as ExpenseCategory]?.label ?? 'Gasto';
    const due = e.nextDueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const title =
      stage === 'OVERDUE' ? `Gasto vencido: ${e.name}` : stage === 'DUE' ? `Hoy vence: ${e.name}` : `Próximo pago: ${e.name}`;
    const body =
      stage === 'OVERDUE'
        ? `${category} de ${formatMoney(e.amount)} venció el ${due} (hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}).`
        : stage === 'DUE'
          ? `${category} de ${formatMoney(e.amount)} vence hoy.`
          : `${category} de ${formatMoney(e.amount)} vence el ${due} (en ${days} día${days === 1 ? '' : 's'}).`;

    await notifyActivity({ tenantId: e.tenantId, actor: SYSTEM_ACTOR, type: 'FIXED_EXPENSE', title, body, url: '/expenses' });
    await prisma.fixedExpense.update({
      where: { id: e.id },
      data: { lastReminderDue: e.nextDueDate, lastReminderStage: stage, lastReminderAt: now },
    });
    sent++;
  }
  return { checked: expenses.length, sent };
}
