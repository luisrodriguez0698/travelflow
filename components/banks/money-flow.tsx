'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Landmark, Truck, Users, Waypoints, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') gsap.registerPlugin(MotionPathPlugin);

// Flujo de dinero del mes: de donde entro (clientes / otros ingresos), cuanto
// quedo en tus cuentas y a donde salio (proveedores / otros gastos). Las lineas
// "corren" y unas monedas viajan por ellas; el grosor depende del monto.

interface Flow {
  month: string;
  clients: number;
  otherIncome: number;
  suppliers: number;
  otherExpense: number;
  income: number;
  expense: number;
  net: number;
  balance: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const s = new Date(y, m - 1, 15).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shift = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Coordenadas (viewBox 100 x 100, se estira al ancho de la tarjeta)
const PATHS = {
  clients: 'M 22 25 C 38 25, 38 50, 50 50',
  otherIncome: 'M 22 75 C 38 75, 38 50, 50 50',
  suppliers: 'M 50 50 C 62 50, 62 25, 78 25',
  otherExpense: 'M 50 50 C 62 50, 62 75, 78 75',
} as const;

function Node({ icon: Icon, label, value, tone, className }: { icon: typeof Users; label: string; value: number; tone: string; className?: string }) {
  return (
    <div data-flow-node className={cn('rounded-xl border bg-card p-3 shadow-sm', className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', tone)} />
        {label}
      </p>
      <p data-count={value} className={cn('mt-0.5 text-lg font-bold tabular-nums', tone)}>
        {money(value)}
      </p>
    </div>
  );
}

export function MoneyFlow() {
  const root = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(thisMonth);
  const [flow, setFlow] = useState<Flow | null>(null);

  const load = useCallback(async (key: string) => {
    const res = await fetch(`/api/bank-accounts/flow?month=${key}`);
    if (res.ok) setFlow(await res.json());
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  useEffect(() => {
    const el = root.current;
    if (!el || !flow || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-flow-node]', { y: 16, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' });
      // Numeros que cuentan
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((n) => {
        const target = Number(n.dataset.count);
        const state = { v: 0 };
        gsap.to(state, { v: target, duration: 1.2, ease: 'power3.out', onUpdate: () => { n.textContent = money(state.v); } });
      });
      // Las lineas corren y las monedas viajan
      gsap.to('[data-flow-line]', { strokeDashoffset: -40, duration: 1.6, repeat: -1, ease: 'none' });
      gsap.utils.toArray<SVGCircleElement>('[data-coin]').forEach((coin, i) => {
        const path = el.querySelector<SVGPathElement>(`[data-flow-path="${coin.dataset.path}"]`);
        if (!path) return;
        gsap.to(coin, {
          motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
          duration: 2.4,
          repeat: -1,
          ease: 'none',
          delay: (i % 3) * 0.8,
          // Ocultas hasta que empiezan a viajar (si no, se ven en la esquina)
          onStart: () => {
            gsap.set(coin, { opacity: 1 });
          },
        });
      });
    }, el);
    return () => ctx.revert();
  }, [flow]);

  if (!flow) return null;

  const max = Math.max(flow.clients, flow.otherIncome, flow.suppliers, flow.otherExpense, 1);
  const width = (v: number) => (v > 0 ? 1.5 + (v / max) * 7 : 0);
  const lines: { key: keyof typeof PATHS; value: number; color: string }[] = [
    { key: 'clients', value: flow.clients, color: '#10b981' },
    { key: 'otherIncome', value: flow.otherIncome, color: '#22d3ee' },
    { key: 'suppliers', value: flow.suppliers, color: '#f97316' },
    { key: 'otherExpense', value: flow.otherExpense, color: '#ef4444' },
  ];

  return (
    <Card className="overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Waypoints className="h-4 w-4 text-primary" />
          Flujo de dinero
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => shift(m, -1))} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-medium">{monthLabel(flow.month)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => shift(m, 1))} disabled={month >= thisMonth()} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={root} className="relative">
        {/* Lineas (solo en pantallas anchas) */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" aria-hidden>
          {lines.map((l) =>
            l.value > 0 ? (
              <g key={l.key}>
                <path data-flow-path={l.key} d={PATHS[l.key]} fill="none" stroke={l.color} strokeOpacity="0.18" strokeWidth={width(l.value) * 3} vectorEffect="non-scaling-stroke" />
                <path data-flow-line d={PATHS[l.key]} fill="none" stroke={l.color} strokeWidth="2" strokeDasharray="6 14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {[0, 1, 2].map((i) => (
                  <circle key={i} data-coin data-path={l.key} r="1.1" fill={l.color} opacity="0" />
                ))}
              </g>
            ) : null
          )}
        </svg>

        <div className="relative grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.1fr_1fr] md:gap-16">
          {/* Entradas */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-10">
            <Node icon={Users} label="De clientes" value={flow.clients} tone="text-emerald-600 dark:text-emerald-400" />
            <Node icon={ArrowDownRight} label="Otros ingresos" value={flow.otherIncome} tone="text-cyan-600 dark:text-cyan-400" />
          </div>

          {/* Cuentas */}
          <div className="flex items-center">
            <div data-flow-node className="w-full rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-cyan-500/5 p-4 text-center shadow-md">
              <Landmark className="mx-auto h-6 w-6 text-primary" />
              <p className="mt-1 text-xs font-medium text-muted-foreground">Tus cuentas · saldo actual</p>
              <p data-count={flow.balance} className="text-2xl font-black tabular-nums">
                {money(flow.balance)}
              </p>
              <p className={cn('mt-1 text-xs font-semibold', flow.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {flow.net >= 0 ? '▲' : '▼'} {money(Math.abs(flow.net))} {flow.net >= 0 ? 'más' : 'menos'} este mes
              </p>
            </div>
          </div>

          {/* Salidas */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-10">
            <Node icon={Truck} label="A proveedores" value={flow.suppliers} tone="text-orange-600 dark:text-orange-400" />
            <Node icon={ArrowUpRight} label="Otros gastos" value={flow.otherExpense} tone="text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          Entró <b className="text-foreground tabular-nums">{money(flow.income)}</b> · Salió <b className="text-foreground tabular-nums">{money(flow.expense)}</b>
        </span>
        <span>Las transferencias entre tus cuentas no cuentan.</span>
      </div>
    </Card>
  );
}
