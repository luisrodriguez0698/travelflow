'use client';

import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { Flag, Plane, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Carrera de metas: cada agente es un avion volando hacia la meta del mes.
// Va adelante quien lleva mayor porcentaje; al llegar al 100% cae el sello de
// "¡META!" y hay confeti.

export interface RaceRunner {
  userId: string;
  userName: string;
  totalSales: number;
  goalAmount: number;
  progress: number; // %
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function GoalRace({ runners, title }: { runners: RaceRunner[]; title: string }) {
  const root = useRef<HTMLDivElement>(null);
  // Solo quien tiene meta corre; ordenados por quien va adelante
  const lanes = useMemo(
    () =>
      runners
        .filter((r) => r.goalAmount > 0)
        .sort((a, b) => b.progress - a.progress)
        .map((r, i) => ({ ...r, color: COLORS[i % COLORS.length], pos: Math.min(100, r.progress), reached: r.progress >= 100 })),
    [runners]
  );
  const key = lanes.map((l) => `${l.userId}:${Math.round(l.progress)}`).join('|');

  useEffect(() => {
    const el = root.current;
    if (!el || !lanes.length) return;
    if (reduced()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-runner]').forEach((lane, i) => {
        const pos = Number(lane.dataset.pos);
        const tl = gsap.timeline({ delay: 0.15 + i * 0.12 });
        tl.fromTo(lane.querySelector('[data-runner-trail]'), { width: '0%' }, { width: `${pos}%`, duration: 1.6, ease: 'power2.out' }, 0)
          .fromTo(lane.querySelector('[data-runner-plane]'), { left: '0%' }, { left: `${pos}%`, duration: 1.6, ease: 'power2.out' }, 0)
          // Pequeño "bamboleo" de vuelo
          .to(lane.querySelector('[data-runner-plane] > span'), { y: -3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        const stamp = lane.querySelector('[data-runner-stamp]');
        if (stamp) {
          tl.fromTo(stamp, { scale: 2.6, opacity: 0, rotation: -35 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.35, ease: 'power4.in' }, 1.6);
        }
      });
      gsap.from('[data-race-title]', { y: 12, opacity: 0, duration: 0.5 });
    }, el);

    // Confeti si alguien ya llego a su meta
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (lanes.some((l) => l.reached)) {
      timer = setTimeout(() => {
        const colors = ['#0ea5e9', '#22d3ee', '#fbbf24', '#10b981', '#f472b6'];
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 }, colors });
      }, 1900 + lanes.length * 120);
    }
    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!lanes.length) return null;
  const leader = lanes[0];

  return (
    <Card className="overflow-hidden p-4 sm:p-6">
      <div ref={root}>
        <div data-race-title className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Flag className="h-4 w-4 text-primary" />
              Carrera de metas · {title}
            </h3>
            <p className="text-xs text-muted-foreground">Cada avión vuela hacia la meta de su agente. ¿Quién aterriza primero?</p>
          </div>
          {leader.progress > 0 && (
            <p className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Trophy className="h-3.5 w-3.5" />
              Va adelante: {leader.userName.split(' ')[0]} ({Math.round(leader.progress)}%)
            </p>
          )}
        </div>

        <div className="space-y-2">
          {lanes.map((l, i) => (
            <div key={l.userId} data-runner data-pos={l.pos} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <span className="truncate">{l.userName}</span>
                </p>
                <p className="truncate pl-5 text-[11px] text-muted-foreground">
                  {money(l.totalSales)} / {money(l.goalAmount)}
                </p>
              </div>

              {/* Pista */}
              <div className="relative h-10 rounded-full bg-muted/50">
                <span className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-border" />
                <span
                  data-runner-trail
                  className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                  style={{ width: `${l.pos}%`, background: `linear-gradient(90deg, transparent, ${l.color})` }}
                />
                {/* Meta */}
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-base">🏁</span>
                {/* Avion */}
                <span data-runner-plane className="absolute top-1/2" style={{ left: `${l.pos}%` }}>
                  <span className="relative -ml-4 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-md">
                    <Plane className="h-5 w-5 rotate-45" style={{ color: l.color, fill: l.color }} />
                  </span>
                </span>
                {/* Porcentaje */}
                <span
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums',
                    l.pos > 75 ? 'right-9' : 'right-8'
                  )}
                  style={{ color: l.color }}
                >
                  {Math.round(l.progress)}%
                </span>
                {l.reached && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span
                      data-runner-stamp
                      className="rounded-md border-[3px] border-double border-emerald-600 bg-background/80 px-2 text-xs font-black tracking-widest text-emerald-600"
                      style={{ transform: 'rotate(-12deg)' }}
                    >
                      ¡META!
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
