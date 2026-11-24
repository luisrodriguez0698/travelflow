'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Check, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SaleFlightCard } from './sale-flight-card';
import { STATUS_META, prefersReducedMotion, shortDate, type TowerSale } from './types';

// Radar de vuelos: cada venta es un avion en su pista. Que tan lejos va = cuanto
// lleva pagado; el color dice si va al corriente, con pago cercano o atrasado.

const PAGE = 20;

export function FlightRadar({ sales }: { sales: TowerSale[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(PAGE);
  const visible = sales.slice(0, limit);
  const key = visible.map((s) => `${s.id}:${s.pct}:${s.status}`).join('|');

  useEffect(() => {
    setLimit(PAGE);
  }, [sales.length]);

  // Despegue: cada avion vuela desde el inicio hasta su avance; los atrasados tiemblan
  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-lane]').forEach((lane, i) => {
        const pct = Number(lane.dataset.pct);
        const plane = lane.querySelector('[data-plane]');
        const trail = lane.querySelector('[data-trail]');
        const tl = gsap.timeline({ delay: i * 0.05 });
        tl.fromTo(trail, { width: '0%' }, { width: `${pct}%`, duration: 1.3, ease: 'power3.out' }, 0);
        tl.fromTo(plane, { left: '0%', opacity: 0 }, { left: `${pct}%`, opacity: 1, duration: 1.3, ease: 'power3.out' }, 0);
        if (lane.dataset.status === 'OVERDUE') {
          tl.to(plane, { rotation: 8, duration: 0.09, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        }
        if (lane.dataset.status === 'SETTLED') {
          tl.fromTo(lane.querySelector('[data-landed]'), { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
        }
      });
      // Las nubes del fondo pasan despacio
      gsap.to('[data-radar-cloud]', { xPercent: 400, duration: 40, repeat: -1, ease: 'none', stagger: 9 });
    }, el);
    return () => ctx.revert();
  }, [key]);

  if (!sales.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No hay ventas con estos filtros.</p>;
  }

  return (
    <div ref={root} className="relative overflow-hidden">
      {/* Fondo de cielo tenue */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-500/[0.04] to-transparent" />
      {[12, 45, 78].map((top, i) => (
        <span
          key={i}
          data-radar-cloud
          aria-hidden
          className="pointer-events-none absolute -left-24 h-6 w-24 rounded-full bg-sky-400/10 blur-md"
          style={{ top: `${top}%` }}
        />
      ))}

      {/* Escala */}
      <div className="relative mb-2 grid grid-cols-[minmax(0,9rem)_1fr] gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid-cols-[minmax(0,12rem)_1fr]">
        <span />
        <div className="flex justify-between">
          <span>Reservado</span>
          <span className="hidden sm:inline">50%</span>
          <span>🏝️ Viaje pagado</span>
        </div>
      </div>

      <div className="relative space-y-1">
        {visible.map((s) => {
          const meta = STATUS_META[s.status];
          return (
            <Popover key={s.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-lane
                  data-pct={s.pct}
                  data-status={s.status}
                  className="group grid w-full grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,12rem)_1fr]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.client}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {s.pct}% · {s.departureDate ? `viaja ${shortDate(s.departureDate)}` : 'sin fecha'}
                    </span>
                  </span>

                  {/* Pista */}
                  <span className="relative block h-8">
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-border" />
                    <span
                      data-trail
                      className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                      style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, transparent, ${meta.color})` }}
                    />
                    {/* Destino */}
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm opacity-60">🏝️</span>
                    {/* Avion */}
                    <span data-plane className="absolute top-1/2" style={{ left: `${s.pct}%` }}>
                      <span className="relative -ml-3.5 -mt-3.5 flex h-7 w-7 items-center justify-center">
                        {s.status === 'OVERDUE' && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />}
                        <span
                          className="relative flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md ring-2 transition-transform group-hover:scale-110"
                          style={{ ['--tw-ring-color' as string]: meta.color }}
                        >
                          <Plane className="h-4 w-4 rotate-45" style={{ color: meta.color, fill: meta.color }} />
                        </span>
                        {s.status === 'SETTLED' && (
                          <span data-landed className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto">
                <SaleFlightCard sale={s} />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {sales.length > limit && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            Ver {Math.min(PAGE, sales.length - limit)} más ({sales.length - limit} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
