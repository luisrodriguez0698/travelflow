'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CalendarClock, Crown, Filter, MapPin, Wallet, Hotel as HotelIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AgentRank, ForecastWeek, PaymentMix, QuoteFunnel, TopItem } from '@/lib/dashboard-insights';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('es-MX')}`;
const compact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
const FORMATS = {
  money,
  int: (n: number) => Math.round(n).toLocaleString('es-MX'),
  pct: (n: number) => `${Math.round(n)}%`,
};
type Fmt = keyof typeof FORMATS;

/** Numero que cuenta con GSAP (lo anima useReveal). El SSR ya trae el valor final. */
export function Count({ value, fmt = 'int', className }: { value: number; fmt?: Fmt; className?: string }) {
  return (
    <span data-count={value} data-fmt={fmt} className={cn('tabular-nums', className)}>
      {FORMATS[fmt](value)}
    </span>
  );
}

/**
 * Animaciones comunes al entrar en pantalla (una sola vez):
 * barras verticales/horizontales que crecen, numeros que cuentan, filas que entran
 * y segmentos de dona que se dibujan. Respeta "reducir movimiento".
 */
export function useReveal(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      tl.from('[data-row]', { y: 14, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' }, 0);
      tl.from('[data-bar-y]', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, stagger: 0.05, ease: 'back.out(1.4)' }, 0.1);
      tl.from('[data-bar-x]', { scaleX: 0, transformOrigin: '0% 50%', duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.15);
      el.querySelectorAll<SVGCircleElement>('[data-seg]').forEach((seg, i) => {
        const full = seg.getAttribute('stroke-dasharray') || '0 0';
        const c = Number(seg.dataset.seg);
        tl.fromTo(seg, { attr: { 'stroke-dasharray': `0 ${c}` } }, { attr: { 'stroke-dasharray': full }, duration: 0.7, ease: 'power2.out' }, 0.2 + i * 0.12);
      });
      tl.from('[data-pop]', { scale: 0, rotation: -25, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.1 }, 0.4);
      el.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
        const target = Number(n.dataset.count) || 0;
        const fmt = FORMATS[(n.dataset.fmt as Fmt) || 'int'];
        const st = { v: 0 };
        tl.to(st, { v: target, duration: 1.2, ease: 'power3.out', onUpdate: () => { n.textContent = fmt(st.v); } }, 0.1);
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}

export function Section({ icon, title, subtitle, children, action, className }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-4 sm:p-6', className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

// ─────────────────────────── Cobranza que viene ───────────────────────────
export function CollectionForecast({ weeks }: { weeks: ForecastWeek[] }) {
  const ref = useReveal(weeks.map((w) => `${w.expected}-${w.collected}`).join('|'));
  const max = Math.max(1, ...weeks.map((w) => w.expected));
  const ahead = weeks.filter((w) => !w.past);
  const pendingAhead = ahead.reduce((t, w) => t + Math.max(0, w.expected - w.collected), 0);
  const pastMissing = weeks.filter((w) => w.past).reduce((t, w) => t + Math.max(0, w.expected - w.collected), 0);
  const [hover, setHover] = useState<number | null>(null);

  return (
    <Section
      icon={<CalendarClock className="h-4 w-4 text-primary" />}
      title="Cobranza que viene"
      subtitle="Por semana: lo que vence (claro) contra lo ya cobrado (fuerte)."
      action={
        <Link href="/sales/tower" className="shrink-0 text-xs font-medium text-primary hover:underline">
          Torre →
        </Link>
      }
    >
      <div ref={ref}>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div data-row className="rounded-xl bg-sky-500/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">Por cobrar (6 semanas)</p>
            <Count value={pendingAhead} fmt="money" className="text-lg font-bold" />
          </div>
          <div data-row className={cn('rounded-xl p-3', pastMissing > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10')}>
            <p className={cn('text-[11px] font-medium uppercase tracking-wide', pastMissing > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300')}>
              Atrasado (3 semanas)
            </p>
            <Count value={pastMissing} fmt="money" className="text-lg font-bold" />
          </div>
        </div>
        <div className="flex h-40 items-end gap-1.5 sm:gap-2">
          {weeks.map((w, i) => {
            const h = (w.expected / max) * 100;
            const paidH = w.expected > 0 ? (Math.min(w.collected, w.expected) / w.expected) * 100 : 0;
            return (
              <Link
                key={i}
                href="/sales/tower"
                className={cn('relative flex h-full flex-1 flex-col items-center justify-end transition-opacity', hover !== null && hover !== i && 'opacity-40')}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Semana del ${w.label}: vence ${money(w.expected)}, cobrado ${money(w.collected)}`}
              >
                {hover === i && (
                  <div
                    className={cn(
                      'pointer-events-none absolute -top-2 z-10 min-w-[150px] -translate-y-full rounded-lg border bg-popover px-3 py-2 text-[11px] text-popover-foreground shadow-lg',
                      i < 2 ? 'left-0' : i > weeks.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    )}
                  >
                    <p className="mb-1 font-semibold">{w.current ? 'Esta semana' : `Semana del ${w.label}`}</p>
                    <p className="flex justify-between gap-3"><span className="text-muted-foreground">Vence</span><b className="tabular-nums">{money(w.expected)}</b></p>
                    <p className="flex justify-between gap-3"><span className="text-muted-foreground">Cobrado</span><b className="tabular-nums text-emerald-600 dark:text-emerald-400">{money(w.collected)}</b></p>
                    {w.expected - w.collected > 0.01 && (
                      <p className="flex justify-between gap-3"><span className="text-muted-foreground">{w.past ? 'Atrasado' : 'Falta'}</span><b className={cn('tabular-nums', w.past && 'text-red-600 dark:text-red-400')}>{money(w.expected - w.collected)}</b></p>
                    )}
                    <p className="mt-1 border-t pt-1 text-[10px] text-primary">Clic para ver en la Torre →</p>
                  </div>
                )}
                <span className="mb-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {w.expected > 0 ? compact(w.expected) : ''}
                </span>
                <div
                  data-bar-y
                  className={cn(
                    'relative w-full overflow-hidden rounded-t-md',
                    w.current ? 'bg-primary/25 ring-2 ring-primary/50' : w.past ? 'bg-red-400/25' : 'bg-sky-400/25'
                  )}
                  style={{ height: `${Math.max(h, w.expected > 0 ? 3 : 0)}%` }}
                >
                  <div className={cn('absolute inset-x-0 bottom-0', w.past ? 'bg-emerald-500' : 'bg-primary')} style={{ height: `${paidH}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 border-t pt-1.5 sm:gap-2">
          {weeks.map((w, i) => (
            <span key={i} className={cn('flex-1 text-center text-[10px] leading-tight', w.current ? 'font-bold text-primary' : 'text-muted-foreground')}>
              {w.current ? 'Esta' : w.label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────── Ranking de agentes ───────────────────────────
const MEDALS = ['🥇', '🥈', '🥉'];

export function AgentRanking({ agents }: { agents: AgentRank[] }) {
  const ref = useReveal(agents.map((a) => `${a.name}-${a.total}`).join('|'));
  const max = Math.max(1, ...agents.map((a) => a.total));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <Section icon={<Crown className="h-4 w-4 text-amber-500" />} title="Ranking de agentes" subtitle="Ventas del mes por persona.">
      <div ref={ref}>
        {agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay ventas este mes. ¡A despegar! 🛫</p>
        ) : (
          <ul className="space-y-3">
            {agents.map((a, i) => (
              <li
                key={a.name + i}
                data-row
                className={cn('rounded-lg transition-opacity', hover !== null && hover !== i && 'opacity-40')}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span data-pop={i < 3 ? '' : undefined} className="inline-block w-6 text-center text-lg leading-none">
                      {MEDALS[i] ?? <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
                    </span>
                    <span className="truncate font-medium">{a.name}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Count value={a.total} fmt="money" className="font-bold" />
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {a.count} venta{a.count === 1 ? '' : 's'} · gan. {money(a.profit)}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    data-bar-x
                    className={cn(
                      'h-full rounded-full',
                      i === 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300' : i === 2 ? 'bg-gradient-to-r from-orange-500 to-amber-600' : 'bg-primary/60'
                    )}
                    style={{ width: `${(a.total / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// ─────────────────────────── Dona reutilizable ───────────────────────────
const DONUT_R = 52;
const DONUT_C = 2 * Math.PI * DONUT_R;

function Donut({
  parts,
  center,
  active,
  onActive,
}: {
  parts: { value: number; color: string; label: string; name: string; display: string }[];
  center: ReactNode;
  active: number | null;
  onActive: (i: number | null) => void;
}) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  const cur = active !== null ? parts[active] : null;
  let offset = 0;
  return (
    <div className="relative mx-auto h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={DONUT_R} fill="none" strokeWidth="14" className="stroke-muted" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.value / total) * DONUT_C;
            const gap = parts.length > 1 ? Math.min(2, len / 3) : 0;
            const el = (
              <circle
                key={i}
                data-seg={DONUT_C}
                cx="60"
                cy="60"
                r={DONUT_R}
                fill="none"
                stroke={p.color}
                strokeWidth={active === i ? 18 : 14}
                strokeOpacity={active !== null && active !== i ? 0.35 : 1}
                strokeDasharray={`${Math.max(0, len - gap)} ${DONUT_C}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width,stroke-opacity] duration-200"
                onMouseEnter={() => onActive(i)}
                onMouseLeave={() => onActive(null)}
              >
                <title>{p.label}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        {cur ? (
          <>
            <span className="max-w-full truncate text-[11px] font-semibold" style={{ color: cur.color }}>{cur.name}</span>
            <span className="text-base font-black tabular-nums">{cur.display}</span>
            <span className="text-[10px] text-muted-foreground">{total > 0 ? Math.round((cur.value / total) * 100) : 0}%</span>
          </>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

const PALETTE = ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#a855f7', '#94a3b8'];

// ─────────────────────────── Destinos y hoteles ───────────────────────────
export function TopDestinations({ destinations, hotels }: { destinations: TopItem[]; hotels: TopItem[] }) {
  const ref = useReveal(destinations.map((d) => `${d.name}-${d.total}`).join('|') + hotels.length);
  const total = destinations.reduce((t, d) => t + d.total, 0);
  const trips = destinations.reduce((t, d) => t + d.count, 0);
  const maxHotel = Math.max(1, ...hotels.map((h) => h.count));
  const [active, setActive] = useState<number | null>(null);
  return (
    <Section icon={<MapPin className="h-4 w-4 text-primary" />} title="Destinos y hoteles top" subtitle="Últimos 90 días.">
      <div ref={ref}>
        {destinations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas en los últimos 90 días.</p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Donut
                parts={destinations.map((d, i) => ({
                  value: d.total,
                  color: PALETTE[i % PALETTE.length],
                  label: `${d.name}: ${money(d.total)}`,
                  name: d.name,
                  display: `${d.count} viaje${d.count === 1 ? '' : 's'}`,
                }))}
                active={active}
                onActive={setActive}
                center={
                  <>
                    <Count value={trips} className="text-2xl font-black" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">viajes</span>
                  </>
                }
              />
              <ul className="w-full min-w-0 flex-1 space-y-1.5">
                {destinations.map((d, i) => (
                  <li
                    key={d.name}
                    data-row
                    className={cn('flex cursor-default items-center gap-2 rounded-md px-1 text-sm transition-opacity', active !== null && active !== i && 'opacity-40')}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    title={`${d.name}: ${money(d.total)} en ${d.count} viaje${d.count === 1 ? '' : 's'}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{total > 0 ? Math.round((d.total / total) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
            {hotels.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <HotelIcon className="h-3.5 w-3.5" /> Hoteles más vendidos
                </p>
                <ul className="space-y-2">
                  {hotels.map((h) => (
                    <li key={h.name} data-row>
                      <div className="mb-0.5 flex justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{h.name}</span>
                        <span className="shrink-0 text-muted-foreground">{h.count} venta{h.count === 1 ? '' : 's'}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div data-bar-x className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400" style={{ width: `${(h.count / maxHotel) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

// ─────────────────────────── Embudo de cotizaciones ───────────────────────────
export function QuoteFunnelCard({ funnel }: { funnel: QuoteFunnel }) {
  const ref = useReveal(`${funnel.created}-${funnel.converted}-${funnel.openCount}`);
  const rate = funnel.created > 0 ? Math.min(100, (funnel.converted / funnel.created) * 100) : 0;
  const steps = [
    { label: 'Cotizaciones del mes', value: funnel.created, width: 100, color: 'from-sky-500 to-blue-500' },
    { label: 'Convertidas a venta', value: funnel.converted, width: funnel.created > 0 ? Math.max(55, rate) : 55, color: 'from-emerald-500 to-teal-500' },
  ];
  return (
    <Section
      icon={<Filter className="h-4 w-4 text-primary" />}
      title="Embudo de cotizaciones"
      subtitle="Cuántas cotizaciones se vuelven venta."
      action={
        <Link href="/quotations" className="text-xs font-medium text-primary hover:underline">
          Ver →
        </Link>
      }
    >
      <div ref={ref} className="space-y-4">
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.label} data-row className="flex justify-center">
              <div
                data-bar-x
                className={cn('flex h-11 items-center justify-between rounded-lg bg-gradient-to-r px-3 text-white shadow-sm', s.color)}
                style={{ width: `${s.width}%`, transformOrigin: '50% 50%' }}
              >
                <span className="truncate text-xs font-medium">{s.label}</span>
                <Count value={s.value} className="ml-2 text-lg font-black" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div data-row className="rounded-xl bg-emerald-500/10 p-3 text-center">
            <Count value={rate} fmt="pct" className="text-2xl font-black text-emerald-600 dark:text-emerald-400" />
            <p className="text-[11px] text-muted-foreground">de conversión</p>
          </div>
          <div data-row className="rounded-xl bg-amber-500/10 p-3 text-center">
            <Count value={funnel.openAmount} fmt="money" className="text-lg font-black text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] text-muted-foreground">
              en {funnel.openCount} cotizaci{funnel.openCount === 1 ? 'ón abierta' : 'ones abiertas'}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────── Contado vs crédito ───────────────────────────
export function PaymentMixCard({ mix }: { mix: PaymentMix }) {
  const ref = useReveal(`${mix.cashTotal}-${mix.creditTotal}`);
  const total = mix.cashTotal + mix.creditTotal;
  const [active, setActive] = useState<number | null>(null);
  const rows = [
    { label: 'Contado', count: mix.cashCount, total: mix.cashTotal, color: '#10b981' },
    { label: 'Crédito', count: mix.creditCount, total: mix.creditTotal, color: '#6366f1' },
  ];
  return (
    <Section icon={<Wallet className="h-4 w-4 text-primary" />} title="Contado vs crédito" subtitle="Ventas de este mes.">
      <div ref={ref}>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ventas este mes todavía.</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Donut
              parts={rows.map((r) => ({ value: r.total, color: r.color, label: `${r.label}: ${money(r.total)}`, name: r.label, display: money(r.total) }))}
              active={active}
              onActive={setActive}
              center={
                <>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticket prom.</span>
                  <Count value={mix.avgTicket} fmt="money" className="text-base font-black" />
                </>
              }
            />
            <div className="grid w-full grid-cols-2 gap-3">
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  data-row
                  className={cn('rounded-xl border p-3 transition-opacity', active !== null && active !== i && 'opacity-40')}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                    {r.label} · {Math.round((r.total / total) * 100)}%
                  </p>
                  <Count value={r.total} fmt="money" className="mt-1 block text-base font-bold" />
                  <p className="text-[11px] text-muted-foreground">
                    {r.count} venta{r.count === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
