// Montos del plan de pagos (ventas y cotizaciones a credito). Sin dependencias
// de servidor: lo usan los formularios y las APIs.

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Reparto sugerido: pagos iguales en pesos enteros; el ultimo absorbe el resto. */
export function suggestedAmounts(remaining: number, count: number): number[] {
  if (count <= 0) return [];
  const each = Math.floor(remaining / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? round2(remaining - each * (count - 1)) : each));
}

/**
 * Reparte lo que falta entre los pagos que el usuario no ha tocado, para que el
 * plan siempre sume el saldo. `locked` = indices editados a mano.
 */
export function rebalance(amounts: number[], locked: Set<number>, remaining: number): number[] {
  const free = amounts.map((_, i) => i).filter((i) => !locked.has(i));
  if (!free.length) return amounts;
  const lockedSum = amounts.reduce((s, a, i) => (locked.has(i) ? s + a : s), 0);
  const spread = suggestedAmounts(Math.max(0, round2(remaining - lockedSum)), free.length);
  const next = [...amounts];
  free.forEach((idx, k) => (next[idx] = spread[k]));
  return next;
}

/** Error del plan personalizado, o null si es valido. */
export function planError(amounts: number[], remaining: number): string | null {
  if (amounts.some((a) => !Number.isFinite(a))) return 'Hay un monto no válido';
  const sum = round2(amounts.reduce((s, a) => s + a, 0));
  const diff = round2(sum - remaining);
  if (diff > 0.01) return `Los pagos se pasan del saldo por $${diff.toLocaleString('es-MX')}`;
  if (amounts.some((a) => a <= 0)) return 'Cada pago debe ser mayor a $0 (reduce otro pago o el número de pagos)';
  if (diff < -0.01) return `Faltan $${Math.abs(diff).toLocaleString('es-MX')} por programar`;
  return null;
}

/**
 * Lee los montos personalizados que manda el formulario (null = reparto
 * automatico). Valida cantidad de pagos y que sumen exactamente el saldo.
 */
export function parsePaymentAmounts(
  input: unknown,
  count: number,
  remaining: number
): { amounts: number[] } | { error: string } {
  if (input == null) return { amounts: suggestedAmounts(remaining, count) };
  if (!Array.isArray(input) || input.length !== count) return { error: 'El plan de pagos no coincide con el número de pagos' };
  const amounts = input.map((a) => round2(Number(a)));
  const error = planError(amounts, remaining);
  return error ? { error } : { amounts };
}

/** Pagos ya guardados contra los montos nuevos: no se puede bajar de lo ya abonado. */
export function planUpdateError(
  plans: { paymentNumber: number; paidAmount: number }[],
  amounts: number[]
): string | null {
  if (plans.length !== amounts.length) return 'El plan de pagos cambió; recarga la página';
  const sorted = [...plans].sort((a, b) => a.paymentNumber - b.paymentNumber);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].paidAmount > amounts[i] + 0.01) {
      return `El pago #${sorted[i].paymentNumber} ya tiene abonados $${sorted[i].paidAmount.toLocaleString('es-MX')}: no puede ser menor`;
    }
  }
  return null;
}

/** Siguiente fecha quincenal (15 o fin de mes), `count` veces desde `fromDate`. */
export function nextQuincenalDate(fromDate: Date, count: number): Date {
  const result = new Date(fromDate);
  for (let i = 0; i < count; i++) {
    const currentDay = result.getDate();
    const currentMonth = result.getMonth();
    const lastDayOfMonth = new Date(result.getFullYear(), currentMonth + 1, 0).getDate();
    if (currentDay < 15) result.setDate(15);
    else if (currentDay < lastDayOfMonth) result.setDate(lastDayOfMonth);
    else {
      result.setDate(1);
      result.setMonth(currentMonth + 1);
      result.setDate(15);
    }
  }
  return result;
}

/** Fin de mes, `count` meses despues de `fromDate`. */
export function nextMonthlyDate(fromDate: Date, count: number): Date {
  const result = new Date(fromDate);
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  result.setDate(new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate());
  return result;
}

/** Fechas de vencimiento del plan (misma regla que usan las APIs). */
export function planDueDates(start: Date, count: number, frequency: string): Date[] {
  return Array.from({ length: count }, (_, i) =>
    frequency === 'MENSUAL' ? nextMonthlyDate(start, i) : nextQuincenalDate(start, i + 1)
  );
}
