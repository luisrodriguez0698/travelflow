import { runFixedExpenseReminders } from './fixed-expense-reminders';

// Programador interno: el servidor de Railway corre todo el tiempo, asi que los
// recordatorios no dependen de configurar un cron externo. Cada tarea es
// idempotente (no repite avisos), asi que correr de mas no hace dano.

const HOUR = 60 * 60 * 1000;
const globalForScheduler = globalThis as unknown as { travelflowScheduler?: boolean };

async function tick() {
  try {
    await runFixedExpenseReminders();
  } catch (error) {
    console.error('Scheduler: fixed expense reminders failed', error);
  }
}

export function startScheduler() {
  if (globalForScheduler.travelflowScheduler) return; // una sola vez por proceso
  globalForScheduler.travelflowScheduler = true;
  setTimeout(tick, 60 * 1000); // primer repaso 1 min despues de arrancar
  setInterval(tick, HOUR).unref?.();
}
