'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { AlertTriangle, CalendarClock, CheckCircle2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { money, prefersReducedMotion, type TowerData } from './types';

/** Numero que "cuenta" hasta su valor con GSAP. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    if (!el.current) return;
    if (prefersReducedMotion()) {
      el.current.textContent = format(value);
      shown.current = value;
      return;
    }
    const state = { n: shown.current };
    const tween = gsap.to(state, {
      n: value,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => {
        if (el.current) el.current.textContent = format(Math.round(state.n * 100) / 100);
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, format]);
  return <span ref={el}>{format(0)}</span>;
}

const asMoney = (n: number) => money(Math.round(n));
const asInt = (n: number) => String(Math.round(n));

export function TowerKpis({ kpis }: { kpis: TowerData['kpis'] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-kpi]', { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
    }, root);
    return () => ctx.revert();
  }, []);

  const cards = [
    {
      label: 'Cobrado este mes',
      value: kpis.collectedMonth,
      format: asMoney,
      sub: 'Anticipos y abonos que ya entraron',
      icon: Wallet,
      tone: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Por cobrar en 7 días',
      value: kpis.dueNext7,
      format: asMoney,
      sub: `${kpis.dueNext7Count} cliente${kpis.dueNext7Count === 1 ? '' : 's'}`,
      icon: CalendarClock,
      tone: 'from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Atrasado',
      value: kpis.overdue,
      format: asMoney,
      sub: `${kpis.overdueCount} cliente${kpis.overdueCount === 1 ? '' : 's'} por contactar`,
      icon: AlertTriangle,
      tone: 'from-red-500/15 to-red-500/0 text-red-600 dark:text-red-400',
      alert: kpis.overdue > 0,
    },
    {
      label: 'Ventas liquidadas',
      value: kpis.settled,
      format: asInt,
      sub: `de ${kpis.active} ventas a crédito en vuelo`,
      icon: CheckCircle2,
      tone: 'from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-400',
    },
  ];

  return (
    <div ref={root} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          data-kpi
          className={cn(
            'relative overflow-hidden rounded-2xl border bg-card p-4',
            c.alert && 'border-red-500/40'
          )}
        >
          <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', c.tone.split(' ').slice(0, 2).join(' '))} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <c.icon className={cn('h-4 w-4', c.tone.split(' ').slice(2).join(' '))} />
            </div>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums sm:text-3xl', c.tone.split(' ').slice(2).join(' '))}>
              <CountUp value={c.value} format={c.format} />
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
