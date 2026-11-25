'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cake, Landmark, MessageCircle, Plane, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Count, Section, useReveal } from '@/components/dashboard/insights';
import type { PaceWeek } from '@/lib/dashboard-insights';
import type { MonthCashFlow, Recontact } from '@/lib/dashboard-today';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('es-MX')}`;
const compact = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

// ─────────────────────────── Tu ritmo del mes ───────────────────────────
// Se muestra en lugar del ranking cuando solo vende una persona (o con "solo lo mio").
export function MonthPace({ weeks, agentName }: { weeks: PaceWeek[]; agentName?: string }) {
  const ref = useReveal(weeks.map((w) => w.total).join('|'));
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const total = weeks.reduce((t, w) => t + w.total, 0);
  const count = weeks.reduce((t, w) => t + w.count, 0);
  const elapsed = weeks.filter((w) => !w.future);
  const avgWeek = elapsed.length ? total / elapsed.length : 0;
  const best = weeks.reduce((b, w, i) => (w.total > (weeks[b]?.total ?? 0) ? i : b), 0);

  return (
    <Section
      icon={<TrendingUp className="h-4 w-4 text-primary" />}
      title="Tu ritmo del mes"
      subtitle={agentName ? `Ventas de ${agentName} por semana.` : 'Ventas por semana de este mes.'}
    >
      <div ref={ref}>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div data-row className="rounded-xl bg-primary/10 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vendido</p>
            <Count value={total} fmt="money" className="text-base font-bold" />
          </div>
          <div data-row className="rounded-xl bg-muted p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ventas</p>
            <Count value={count} className="text-base font-bold" />
          </div>
          <div data-row className="rounded-xl bg-muted p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prom. semana</p>
            <Count value={avgWeek} fmt="money" className="text-base font-bold" />
          </div>
        </div>
        <div className="flex h-36 items-end gap-2">
          {weeks.map((w, i) => (
            <div
              key={w.label}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-lg">
                  <p className="font-semibold">{w.label}</p>
                  <p className="tabular-nums">
                    {money(w.total)} · {w.count} venta{w.count === 1 ? '' : 's'}
                  </p>
                </div>
              )}
              <span className="mb-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {w.total > 0 ? compact(w.total) : ''}
                {i === best && w.total > 0 ? ' 🔥' : ''}
              </span>
              <div
                data-bar-y
                className={cn(
                  'w-full rounded-t-md transition-opacity',
                  w.future ? 'border-2 border-dashed border-muted-foreground/30 bg-transparent' : w.current ? 'bg-gradient-to-t from-primary to-sky-400' : 'bg-primary/50',
                  hover !== null && hover !== i && 'opacity-40'
                )}
                style={{ height: w.future ? '12%' : `${Math.max(3, (w.total / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 border-t pt-1.5">
          {weeks.map((w) => (
            <span key={w.label} className={cn('flex-1 text-center text-[10px] leading-tight', w.current ? 'font-bold text-primary' : 'text-muted-foreground')}>
              {w.current ? 'Esta' : w.label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────── Para recontactar ───────────────────────────
export function RecontactCard({ people }: { people: Recontact[] }) {
  const ref = useReveal(people.map((p) => p.id).join('|'));
  return (
    <Section icon={<Cake className="h-4 w-4 text-pink-500" />} title="Para recontactar" subtitle="Cumpleaños del mes y quienes viajaron hace un año.">
      <div ref={ref}>
        {people.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nadie por recontactar este mes.</p>
        ) : (
          <ul className="space-y-1.5">
            {people.map((p) => (
              <li key={p.id} data-row className={cn('flex items-center gap-3 rounded-xl p-2', p.today ? 'bg-pink-500/10' : 'hover:bg-muted/60')}>
                <span
                  data-pop=""
                  className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', p.reason === 'birthday' ? 'bg-pink-500/15 text-pink-600' : 'bg-sky-500/15 text-sky-600')}
                >
                  {p.reason === 'birthday' ? <Cake className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                </span>
                <Link href={`/clients/${p.id.slice(2)}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{p.detail}</span>
                </Link>
                {p.whatsapp && (
                  <a
                    href={p.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Enviar WhatsApp"
                    aria-label={`Enviar WhatsApp a ${p.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-110"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// ─────────────────────────── Flujo de bancos del mes ───────────────────────────
export function MonthCashFlowCard({ flow }: { flow: MonthCashFlow }) {
  const ref = useReveal(`${flow.income}-${flow.net}`);
  const [hover, setHover] = useState<string | null>(null);
  const out = flow.suppliers + flow.fixed + flow.commissions + flow.variable + flow.withdrawals + flow.other;
  const max = Math.max(1, flow.income, out);
  const outs = [
    { key: 'suppliers', label: 'Proveedores', value: flow.suppliers, color: 'bg-violet-500' },
    { key: 'fixed', label: 'Gastos fijos', value: flow.fixed, color: 'bg-amber-400' },
    { key: 'commissions', label: 'Comisiones y sueldos', value: flow.commissions, color: 'bg-fuchsia-400' },
    { key: 'variable', label: 'Gastos varios', value: flow.variable, color: 'bg-orange-400' },
    { key: 'withdrawals', label: 'Retiros', value: flow.withdrawals, color: 'bg-cyan-500' },
    { key: 'other', label: 'No es gasto', value: flow.other, color: 'bg-slate-400' },
  ].filter((o) => o.value > 0);
  const positive = flow.net >= 0;

  return (
    <Section
      icon={<Landmark className="h-4 w-4 text-primary" />}
      title="Flujo de bancos del mes"
      subtitle="Dinero que entró y salió de tus cuentas."
      action={
        <Link href="/banks" className="text-xs font-medium text-primary hover:underline">
          Bancos →
        </Link>
      }
    >
      <div ref={ref} className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Entró</span>
            <Count value={flow.income} fmt="money" className="font-bold" />
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-muted">
            <div data-bar-x className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${(flow.income / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-rose-700 dark:text-rose-400">Salió</span>
            <Count value={out} fmt="money" className="font-bold" />
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(2, (out / max) * 100)}%` }} data-bar-x>
            {outs.map((o) => (
              <div
                key={o.key}
                className={cn('h-full transition-opacity', o.color, hover && hover !== o.key && 'opacity-30')}
                style={{ width: `${out > 0 ? (o.value / out) * 100 : 0}%` }}
                onMouseEnter={() => setHover(o.key)}
                onMouseLeave={() => setHover(null)}
                title={`${o.label}: ${money(o.value)}`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {outs.map((o) => (
              <li
                key={o.key}
                className={cn('flex items-center gap-1.5 text-[11px] transition-opacity', hover && hover !== o.key && 'opacity-40')}
                onMouseEnter={() => setHover(o.key)}
                onMouseLeave={() => setHover(null)}
              >
                <span className={cn('h-2 w-2 rounded-full', o.color)} />
                {o.label} <b className="tabular-nums">{money(o.value)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div data-row className={cn('flex items-center justify-between rounded-xl p-3', positive ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Neto del mes</span>
          <Count value={flow.net} fmt="money" className={cn('text-xl font-black', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} />
        </div>
      </div>
    </Section>
  );
}
