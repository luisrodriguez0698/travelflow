'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { Gauge as GaugeIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Cabina de vuelo: instrumentos del mes con aguja. Meta (cuanto llevas de la meta
// de ventas), Margen (ganancia sobre el costo) y Cobranza al dia (de lo que
// vencio este mes, cuanto ya se cobro).

export interface CockpitData {
  goalPct: number | null; // null = sin meta asignada
  monthSales: number;
  goalAmount: number;
  /** Sin meta asignada: promedio de ventas de los 3 meses anteriores (null si no hay historial) */
  suggestedGoal: number | null;
  /** Puede asignar metas (lleva a Metas) */
  canSetGoal: boolean;
  marginPct: number;
  profit: number;
  collectionPct: number | null; // null = nada vencio este mes
  dueThisMonth: number;
  collectedThisMonth: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Semicirculo: de -90° (izquierda) a 90° (derecha)
const R = 70;
const ARC = Math.PI * R;

function Instrument({
  label,
  value,
  max = 100,
  suffix = '%',
  caption,
  colorFor,
  empty,
  maxPlus,
  footer,
}: {
  footer?: ReactNode;
  maxPlus?: boolean;
  label: string;
  value: number;
  max?: number;
  suffix?: string;
  caption: string;
  colorFor: (pct: number) => string;
  empty?: string;
}) {
  const needle = useRef<SVGGElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const num = useRef<SVGTextElement>(null);
  const shown = Math.max(0, Math.min(value, max));
  const ratio = shown / max;
  const color = colorFor(value);

  useEffect(() => {
    if (!needle.current || !arc.current || !num.current) return;
    const target = { a: -90 + ratio * 180, off: ARC * (1 - ratio), n: value };
    if (reduced() || empty) {
      gsap.set(needle.current, { rotation: target.a, svgOrigin: '90 90' });
      gsap.set(arc.current, { strokeDashoffset: target.off });
      num.current.textContent = empty ? '—' : `${Math.round(value)}${suffix}`;
      return;
    }
    const state = { n: 0 };
    const tl = gsap.timeline({ delay: 0.2 });
    tl.fromTo(needle.current, { rotation: -90, svgOrigin: '90 90' }, { rotation: target.a, duration: 1.6, ease: 'elastic.out(1, 0.6)' }, 0)
      .fromTo(arc.current, { strokeDashoffset: ARC }, { strokeDashoffset: target.off, duration: 1.4, ease: 'power3.out' }, 0)
      .to(state, { n: value, duration: 1.4, ease: 'power3.out', onUpdate: () => {
            if (num.current) num.current.textContent = `${Math.round(state.n)}${suffix}`;
          },
        }, 0);
    return () => {
      tl.kill();
    };
  }, [ratio, value, suffix, empty]);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 126" className="w-full max-w-[220px]" role="img" aria-label={`${label}: ${empty ? 'sin datos' : `${Math.round(value)}${suffix}`}`}>
        {/* Escala */}
        <path d={`M ${90 - R} 90 A ${R} ${R} 0 0 1 ${90 + R} 90`} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
        <path
          ref={arc}
          d={`M ${90 - R} 90 A ${R} ${R} 0 0 1 ${90 + R} 90`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={ARC}
          strokeDashoffset={ARC}
        />
        {/* Marcas */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI - (i / 10) * Math.PI;
          const r1 = R - 14;
          const r2 = i % 5 === 0 ? R - 22 : R - 18;
          return (
            <line
              key={i}
              x1={90 + r1 * Math.cos(a)}
              y1={90 - r1 * Math.sin(a)}
              x2={90 + r2 * Math.cos(a)}
              y2={90 - r2 * Math.sin(a)}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity="0.5"
              strokeWidth={i % 5 === 0 ? 2 : 1}
            />
          );
        })}
        {/* Limites de la escala: cada instrumento tiene su propio maximo */}
        <text x={90 - R} y="108" textAnchor="middle" className="fill-muted-foreground" style={{ font: '600 9px system-ui, sans-serif' }}>
          0{suffix}
        </text>
        <text x={90 + R} y="108" textAnchor="middle" className="fill-muted-foreground" style={{ font: '600 9px system-ui, sans-serif' }}>
          {max}
          {suffix}
          {maxPlus ? '+' : ''}
        </text>
        {/* Aguja */}
        <g ref={needle} transform="rotate(-90 90 90)">
          <path d="M 87 90 L 90 32 L 93 90 Z" fill={color} />
        </g>
        <circle cx="90" cy="90" r="7" fill="hsl(var(--background))" stroke={color} strokeWidth="3" />
        <text ref={num} x="90" y="122" textAnchor="middle" className="fill-foreground" style={{ font: '800 18px system-ui, sans-serif' }}>
          {empty ? '—' : `0${suffix}`}
        </text>
      </svg>
      <p className="-mt-1 text-sm font-semibold">{label}</p>
      <p className="text-center text-[11px] text-muted-foreground">{empty ?? caption}</p>
      {footer}
    </div>
  );
}

export function CockpitGauges({ data }: { data: CockpitData }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <GaugeIcon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Cabina de vuelo</h3>
        <span className="text-xs text-muted-foreground">· instrumentos del mes</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Instrument
          label={data.goalPct === null && data.suggestedGoal ? 'Meta sugerida' : 'Meta del mes'}
          value={data.goalPct ?? (data.suggestedGoal ? (data.monthSales / data.suggestedGoal) * 100 : 0)}
          max={120}
          caption={
            data.goalPct === null && data.suggestedGoal
              ? `${money(data.monthSales)} de ${money(data.suggestedGoal)} (tu promedio de 3 meses)`
              : `${money(data.monthSales)} de ${money(data.goalAmount)}`
          }
          colorFor={(p) => (p >= 100 ? '#10b981' : p >= 60 ? '#0ea5e9' : '#f59e0b')}
          empty={data.goalPct === null && !data.suggestedGoal ? 'Sin meta asignada este mes' : undefined}
          footer={
            data.goalPct === null && data.canSetGoal ? (
              <Link href="/sales/goals" className="mt-1 text-[11px] font-semibold text-primary hover:underline">
                Asignar meta →
              </Link>
            ) : undefined
          }
        />
        <Instrument
          label="Margen"
          value={data.marginPct}
          max={40}
          maxPlus
          caption={`Ganancia ${money(data.profit)}`}
          colorFor={(p) => (p >= 15 ? '#10b981' : p >= 8 ? '#0ea5e9' : '#ef4444')}
        />
        <Instrument
          label="Cobranza al día"
          value={data.collectionPct ?? 0}
          caption={`${money(data.collectedThisMonth)} de ${money(data.dueThisMonth)} que vencieron`}
          colorFor={(p) => (p >= 90 ? '#10b981' : p >= 70 ? '#f59e0b' : '#ef4444')}
          empty={data.collectionPct === null ? 'Aún no vence ningún pago este mes' : undefined}
        />
      </div>
    </Card>
  );
}
