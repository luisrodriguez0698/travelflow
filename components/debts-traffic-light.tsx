'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { Siren } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Semaforo de deudas: medidor de cuanto ya se pago a proveedores contra lo que
// se debe, y las fechas limite mas cercanas latiendo segun su urgencia.

export interface DebtDeadline {
  bookingId: string;
  supplierId: string;
  supplier: string;
  client: string;
  remaining: number;
  deadline: string;
  daysRemaining: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const TZ = 'America/Mexico_City';
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TZ }).replace('.', '');

function level(days: number) {
  if (days < 0) return { color: '#ef4444', label: `Venció hace ${-days} día${days === -1 ? '' : 's'}`, pulse: 'fast' as const };
  if (days <= 2) return { color: '#ef4444', label: days === 0 ? 'Vence hoy' : `Vence en ${days} día${days === 1 ? '' : 's'}`, pulse: 'fast' as const };
  if (days <= 7) return { color: '#f59e0b', label: `Vence en ${days} días`, pulse: 'slow' as const };
  return { color: '#10b981', label: `Vence en ${days} días`, pulse: null };
}

export function DebtsTrafficLight({
  totals,
  deadlines,
}: {
  totals: { totalDebt: number; totalPaid: number; totalRemaining: number };
  deadlines: DebtDeadline[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const pct = totals.totalDebt > 0 ? Math.min(100, (totals.totalPaid / totals.totalDebt) * 100) : 100;
  const key = `${Math.round(pct)}|${deadlines.map((d) => d.bookingId + d.supplierId).join(',')}`;

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-meter]', { width: '0%' }, { width: `${pct}%`, duration: 1.4, ease: 'power3.out' });
      const state = { v: 0 };
      gsap.to(state, {
        v: pct,
        duration: 1.4,
        ease: 'power3.out',
        onUpdate: () => {
          const n = el.querySelector('[data-meter-pct]');
          if (n) n.textContent = `${Math.round(state.v)}%`;
        },
      });
      gsap.from('[data-deadline]', { x: -16, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' });
      gsap.to('[data-pulse="fast"]', { scale: 1.6, opacity: 0, duration: 0.9, repeat: -1, ease: 'power1.out' });
      gsap.to('[data-pulse="slow"]', { scale: 1.5, opacity: 0, duration: 1.6, repeat: -1, ease: 'power1.out' });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const overdue = deadlines.filter((d) => d.daysRemaining < 0).length;

  return (
    <Card className="p-4 sm:p-6">
      <div ref={root} className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Medidor */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Siren className="h-4 w-4 text-primary" />
            Semáforo de deudas
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Cuánto llevas pagado a proveedores de lo que debes.</p>
          <div className="mt-4 flex items-end justify-between">
            <span data-meter-pct className="text-4xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {Math.round(pct)}%
            </span>
            <span className="text-right text-xs text-muted-foreground">
              Pagado {money(totals.totalPaid)}
              <br />
              de {money(totals.totalDebt)}
            </span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-gradient-to-r from-red-500/20 via-amber-500/20 to-emerald-500/20">
            <div data-meter className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs">
            Falta pagar <b className="tabular-nums">{money(totals.totalRemaining)}</b>
            {overdue > 0 && <span className="ml-1 font-semibold text-red-600 dark:text-red-400">· {overdue} vencida{overdue === 1 ? '' : 's'}</span>}
          </p>
        </div>

        {/* Fechas limite */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Próximas fechas límite</p>
          {deadlines.length === 0 ? (
            <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
              Sin fechas límite en los próximos 30 días. 👌
            </p>
          ) : (
            <ul className="space-y-1.5">
              {deadlines.map((d) => {
                const lv = level(d.daysRemaining);
                return (
                  <li key={`${d.bookingId}-${d.supplierId}`} data-deadline>
                    <Link href={`/sales/${d.bookingId}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                      <span className="relative flex h-3 w-3 shrink-0">
                        {lv.pulse && <span data-pulse={lv.pulse} className="absolute inset-0 rounded-full" style={{ background: lv.color }} />}
                        <span className="relative h-3 w-3 rounded-full" style={{ background: lv.color }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.supplier}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {d.client} · {shortDate(d.deadline)}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold tabular-nums">{money(d.remaining)}</span>
                        <span className={cn('block text-[11px] font-medium')} style={{ color: lv.color }}>
                          {lv.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
