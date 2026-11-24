'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PiggyBank } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { NetProfit } from '@/lib/dashboard-today';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

// Utilidad neta del mes en cascada: Ventas - Proveedores = Ganancia - Gastos fijos = Utilidad neta.

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('es-MX')}`;

export function NetProfitCard({ data }: { data: NetProfit }) {
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(1, data.sales, data.grossProfit, data.fixedExpenses);
  const positive = data.net >= 0;

  // Cada escalon: desde donde empieza la barra y cuanto mide (en % del maximo)
  const steps = [
    { label: 'Ventas del mes', value: data.sales, from: 0, size: data.sales, color: 'bg-sky-500', sign: '' },
    { label: 'Costo de proveedores', value: -data.supplierCost, from: Math.max(0, data.grossProfit), size: data.supplierCost, color: 'bg-rose-400', sign: '−' },
    { label: 'Ganancia de ventas', value: data.grossProfit, from: 0, size: Math.max(0, data.grossProfit), color: 'bg-emerald-500', sign: '' },
    { label: 'Gastos fijos del mes', value: -data.fixedExpenses, from: Math.max(0, data.net), size: Math.min(data.fixedExpenses, Math.max(0, data.grossProfit)) || data.fixedExpenses, color: 'bg-amber-400', sign: '−' },
  ];

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      tl.from('[data-wf]', { scaleX: 0, transformOrigin: '0% 50%', duration: 0.6, stagger: 0.25, ease: 'power3.out' });
      tl.from('[data-wf-label]', { opacity: 0, x: -10, duration: 0.3, stagger: 0.25 }, 0);
      const n = el.querySelector<HTMLElement>('[data-net]');
      if (n) {
        const st = { v: 0 };
        tl.to(st, { v: data.net, duration: 1.1, ease: 'power3.out', onUpdate: () => { n.textContent = money(st.v); } }, '-=0.3');
      }
      tl.from('[data-net-badge]', { scale: 0, duration: 0.5, ease: 'back.out(2.5)' }, '-=0.4');
    }, el);
    return () => ctx.revert();
  }, [data.net, data.sales, data.fixedExpenses]);

  return (
    <Card className="p-4 sm:p-6">
      <div ref={root} className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <PiggyBank className="h-4 w-4 text-primary" />
              Utilidad neta del mes
            </h3>
            <Link href="/expenses" className="text-xs font-medium text-primary hover:underline">
              Gastos →
            </Link>
          </div>
          <ul className="space-y-2.5">
            {steps.map((s) => (
              <li key={s.label}>
                <div data-wf-label className="mb-0.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums">
                    {s.sign}
                    {money(Math.abs(s.value))}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-muted/60">
                  <div
                    data-wf
                    className={cn('absolute inset-y-0 rounded-full', s.color)}
                    style={{ left: `${(s.from / max) * 100}%`, width: `${Math.max(0.5, (s.size / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn('rounded-2xl p-5 text-center', positive ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Te queda</p>
          <p data-net className={cn('mt-1 text-3xl font-black tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {money(data.net)}
          </p>
          <span
            data-net-badge
            className={cn(
              'mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold',
              positive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            )}
          >
            {positive ? 'El mes ya deja dinero ✅' : `Faltan ${money(-data.net)} para cubrir gastos`}
          </span>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Gastos fijos pagados este mes: <b className="tabular-nums">{money(data.fixedPaid)}</b> de {money(data.fixedExpenses)}
          </p>
        </div>
      </div>
    </Card>
  );
}
