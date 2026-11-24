'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SaleFlightCard } from './sale-flight-card';
import { longDate, money, prefersReducedMotion, type TowerSale } from './types';

// Linea de tiempo de cobros: una fila por cliente con sus pagos en el calendario.
// ● pagado · ○ pendiente · rojo = atrasado · ✈️ dia del viaje · linea de HOY.

const RANGES = [
  { months: 3, label: '3 meses' },
  { months: 6, label: '6 meses' },
  { months: 12, label: '12 meses' },
] as const;

const MONTH = (d: Date) => d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }).replace('.', '');

export function PaymentTimeline({ sales }: { sales: TowerSale[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [months, setMonths] = useState<number>(6);
  const [limit, setLimit] = useState(25);
  const visible = sales.slice(0, limit);

  // Desde el mes pasado hasta N meses adelante
  const { start, end, ticks } = useMemo(() => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - 1 + months, 1);
    const t: Date[] = [];
    for (let d = new Date(s); d < e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) t.push(d);
    return { start: s.getTime(), end: e.getTime(), ticks: t };
  }, [months]);

  const pos = (iso: string) => ((new Date(iso).getTime() - start) / (end - start)) * 100;
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };
  const todayPct = pos(new Date().toISOString());
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  const key = `${months}|${visible.map((s) => s.id).join(',')}`;
  useEffect(() => {
    if (!root.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-dot]', { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)', stagger: { each: 0.008, from: 'start' } });
      gsap.fromTo('[data-today]', { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'power3.out', transformOrigin: '50% 0%' });
      gsap.to('[data-late]', { scale: 1.35, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.9 });
    }, root);
    return () => ctx.revert();
  }, [key]);

  if (!sales.length) return <p className="py-10 text-center text-sm text-muted-foreground">No hay ventas con estos filtros.</p>;

  return (
    <div ref={root}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Pagado</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-slate-400" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Atrasado</span>
          <span className="flex items-center gap-1"><Plane className="h-3 w-3 rotate-45 text-sky-500" /> Viaje</span>
        </div>
        <div className="flex rounded-lg border p-0.5">
          {RANGES.map((r) => (
            <Button
              key={r.months}
              size="sm"
              variant={months === r.months ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setMonths(r.months)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Meses */}
          <div className="grid grid-cols-[11rem_1fr] gap-3 border-b pb-1">
            <span />
            <div className="relative h-5">
              {ticks.map((t) => (
                <span
                  key={t.getTime()}
                  className="absolute top-0 -translate-x-0 border-l pl-1 text-[10px] font-semibold uppercase text-muted-foreground"
                  style={{ left: `${((t.getTime() - start) / (end - start)) * 100}%` }}
                >
                  {MONTH(t)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Linea de HOY */}
            {todayPct >= 0 && todayPct <= 100 && (
              <div className="pointer-events-none absolute inset-y-0 grid w-full grid-cols-[11rem_1fr] gap-3">
                <span />
                <div className="relative">
                  <div data-today className="absolute inset-y-0 w-0.5 bg-primary/70" style={{ left: `${todayPct}%` }}>
                    <span className="absolute -top-0.5 left-1 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">HOY</span>
                  </div>
                </div>
              </div>
            )}

            {visible.map((s) => (
              <div key={s.id} className="grid grid-cols-[11rem_1fr] items-center gap-3 border-b border-border/50 py-1.5 last:border-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="min-w-0 rounded-md px-1 text-left hover:bg-muted">
                      <span className="block truncate text-sm font-medium">{s.client}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {money(s.paid)} / {money(s.total)}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto">
                    <SaleFlightCard sale={s} />
                  </PopoverContent>
                </Popover>

                <div className="relative h-7">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  {s.payments.filter((p) => inRange(p.dueDate)).map((p) => {
                    const paid = p.paidAmount >= p.amount - 0.01;
                    const late = !paid && new Date(p.dueDate).getTime() < todayStart;
                    const partial = !paid && p.paidAmount > 0;
                    return (
                      <span
                        key={p.number}
                        className="absolute top-1/2 -ml-[7px] -mt-[7px]"
                        style={{ left: `${pos(p.dueDate)}%` }}
                        title={`Pago #${p.number} · ${longDate(p.dueDate)} · ${money(p.amount)}${paid ? ' · pagado' : partial ? ` · abonado ${money(p.paidAmount)}` : late ? ' · ATRASADO' : ' · pendiente'}`}
                      >
                        <span
                          data-dot
                          {...(late ? { 'data-late': '' } : {})}
                          className={cn(
                            'block h-3.5 w-3.5 rounded-full border-2',
                            paid
                              ? 'border-emerald-500 bg-emerald-500'
                              : late
                                ? 'border-red-500 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                                : partial
                                  ? 'border-amber-500 bg-amber-500/40'
                                  : 'border-slate-400 bg-background'
                          )}
                        />
                      </span>
                    );
                  })}
                  {s.departureDate && inRange(s.departureDate) && (
                    <span
                      className="absolute top-1/2 -ml-2.5 -mt-2.5"
                      style={{ left: `${pos(s.departureDate)}%` }}
                      title={`Viaje: ${longDate(s.departureDate)}`}
                    >
                      <Plane data-dot className="h-5 w-5 rotate-45 fill-sky-500 text-sky-500" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sales.length > limit && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 25)}>
            Ver más ({sales.length - limit} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
