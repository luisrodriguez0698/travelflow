// Gastos fijos: tipos, frecuencias y calculo de fechas. Sin dependencias de
// servidor (lo usan la pantalla y las APIs). Las fechas se guardan a las 12:00
// UTC del dia elegido para que ninguna zona horaria las cambie de dia.

export const EXPENSE_CATEGORIES = {
  LUZ: { label: 'Luz', color: '#f59e0b' },
  AGUA: { label: 'Agua', color: '#0ea5e9' },
  RENTA: { label: 'Renta', color: '#8b5cf6' },
  INTERNET: { label: 'Internet', color: '#6366f1' },
  TELEFONO: { label: 'Teléfono', color: '#14b8a6' },
  GAS: { label: 'Gas', color: '#ef4444' },
  NOMINA: { label: 'Nómina', color: '#22c55e' },
  IMPUESTOS: { label: 'Impuestos', color: '#64748b' },
  SEGURO: { label: 'Seguro', color: '#0891b2' },
  SOFTWARE: { label: 'Software / suscripciones', color: '#ec4899' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: '#a16207' },
  OTRO: { label: 'Otro', color: '#94a3b8' },
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_FREQUENCIES = {
  WEEKLY: { label: 'Semanal', months: 0, days: 7, perMonth: 52 / 12 },
  BIWEEKLY: { label: 'Quincenal', months: 0, days: 14, perMonth: 26 / 12 },
  MONTHLY: { label: 'Mensual', months: 1, days: 0, perMonth: 1 },
  BIMONTHLY: { label: 'Bimestral', months: 2, days: 0, perMonth: 1 / 2 },
  QUARTERLY: { label: 'Trimestral', months: 3, days: 0, perMonth: 1 / 3 },
  SEMIANNUAL: { label: 'Semestral', months: 6, days: 0, perMonth: 1 / 6 },
  YEARLY: { label: 'Anual', months: 12, days: 0, perMonth: 1 / 12 },
} as const;
export type ExpenseFrequency = keyof typeof EXPENSE_FREQUENCIES;

export const REMIND_OPTIONS = [1, 2, 3, 5, 7, 10, 15] as const;

const TIME_ZONE = 'America/Mexico_City';

/** "2026-10-15" -> fecha guardable (12:00 UTC de ese dia). */
export function dayToDate(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`);
}

/** Fecha -> "2026-10-15" segun el calendario de Mexico. */
export function dateToDay(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(date)
  );
}

/** Dias que faltan para la fecha (negativo = vencido). */
export function daysUntil(due: Date | string, now: Date = new Date()): number {
  const a = Date.parse(`${dateToDay(due)}T00:00:00Z`);
  const b = Date.parse(`${dateToDay(now)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** Siguiente vencimiento segun la frecuencia (respeta el dia del mes; 31 -> fin de mes). */
export function advanceDueDate(current: Date, frequency: string, dueDay?: number | null): Date {
  const f = EXPENSE_FREQUENCIES[frequency as ExpenseFrequency] ?? EXPENSE_FREQUENCIES.MONTHLY;
  if (f.days) return new Date(current.getTime() + f.days * 86_400_000);
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth() + f.months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(dueDay ?? current.getUTCDate(), lastDay);
  return new Date(Date.UTC(y, m, day, 12));
}

/** Equivalente mensual (para el total "cuanto gasto al mes"). */
export function monthlyEquivalent(amount: number, frequency: string) {
  return amount * (EXPENSE_FREQUENCIES[frequency as ExpenseFrequency]?.perMonth ?? 1);
}

export type DueStatus = 'overdue' | 'today' | 'soon' | 'upcoming';

/** Estado del vencimiento: vencido, hoy, pronto (dentro del aviso) o despues. */
export function dueStatus(due: Date | string, remindDaysBefore: number, now: Date = new Date()): DueStatus {
  const d = daysUntil(due, now);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= remindDaysBefore) return 'soon';
  return 'upcoming';
}
