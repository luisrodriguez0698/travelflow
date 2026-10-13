'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { planDueDates, planError, rebalance, suggestedAmounts } from '@/lib/payment-plan';

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

/**
 * Plan de pagos con montos editables. Muestra el reparto sugerido; al cambiar
 * un monto, los pagos que no se han tocado se reparten solos para que el plan
 * siga sumando el saldo. `amounts` null = reparto automatico.
 */
export function PaymentPlanEditor({
  remaining,
  count,
  frequency,
  startDate,
  amounts,
  onChange,
}: {
  /** Saldo a financiar (total - anticipo) */
  remaining: number;
  count: number;
  frequency: string;
  startDate: Date | null;
  amounts: number[] | null;
  onChange: (amounts: number[] | null) => void;
}) {
  const suggested = useMemo(() => suggestedAmounts(remaining, count), [remaining, count]);
  const dates = useMemo(() => planDueDates(startDate || new Date(), count, frequency), [startDate, count, frequency]);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  // Si cambia el saldo o el numero de pagos, el plan personalizado ya no cuadra: vuelve al sugerido
  const baseKey = `${remaining}|${count}`;
  const prevKey = useRef(baseKey);
  useEffect(() => {
    if (prevKey.current === baseKey) return;
    prevKey.current = baseKey;
    setLocked(new Set());
    setDrafts({});
    if (amounts) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  const values = amounts && amounts.length === count ? amounts : suggested;
  const custom = !!amounts;
  const error = custom ? planError(values, remaining) : null;
  const sum = values.reduce((s, a) => s + a, 0);

  const commit = (i: number) => {
    const raw = drafts[i];
    setDrafts(({ [i]: _, ...rest }) => rest);
    if (raw === undefined) return;
    const value = Math.round((parseFloat(raw.replace(/[^0-9.]/g, '')) || 0) * 100) / 100;
    if (value === values[i]) return;
    const nextLocked = new Set(locked).add(i);
    const next = [...values];
    next[i] = value;
    setLocked(nextLocked);
    // Se ajustan los pagos siguientes que no se han editado; si no hay, los anteriores
    const later = values.some((_, k) => k > i && !nextLocked.has(k));
    const fixed = new Set(nextLocked);
    if (later) values.forEach((_, k) => k < i && fixed.add(k));
    onChange(rebalance(next, fixed, remaining));
  };

  const reset = () => {
    setLocked(new Set());
    setDrafts({});
    onChange(null);
  };

  return (
    <div className={cn('rounded-lg border overflow-hidden', error && 'border-red-500/50')}>
      <div className="px-3 py-2 bg-muted/50 border-b flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan de pagos</span>
        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
          {frequency === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
        </span>
        <span className="text-xs text-muted-foreground">{custom ? 'Personalizado' : 'Sugerido'}</span>
        {custom && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-xs gap-1" onClick={reset}>
            <RotateCcw className="w-3 h-3" />
            Usar sugerido
          </Button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr className="text-muted-foreground">
              <th className="text-left px-3 py-1.5 font-medium w-10">#</th>
              <th className="text-left px-3 py-1.5 font-medium">Fecha</th>
              <th className="text-right px-3 py-1.5 font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {values.map((amount, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1 font-medium">
                  {dates[i]?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-2 py-1 text-right">
                  <div className="inline-flex items-center gap-1">
                    {locked.has(i) && <Pencil className="w-3 h-3 text-primary" aria-label="Editado" />}
                    <span className="text-muted-foreground">$</span>
                    <input
                      inputMode="decimal"
                      aria-label={`Monto del pago ${i + 1}`}
                      value={drafts[i] ?? String(amount)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => commit(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className={cn(
                        'w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-semibold tabular-nums',
                        'hover:border-border focus:border-primary focus:bg-background focus:outline-none',
                        amount <= 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className={cn(
          'px-3 py-2 border-t text-xs flex flex-wrap items-center gap-x-3 gap-y-1',
          error ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-muted/30 text-muted-foreground'
        )}
      >
        {error ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        <span>
          Suma: <b className="tabular-nums">{money(sum)}</b> de <b className="tabular-nums">{money(remaining)}</b>
        </span>
        {error ? <span className="font-medium">{error}</span> : <span>Haz clic en un monto para ajustarlo; los demás se reparten solos.</span>}
      </div>
    </div>
  );
}
