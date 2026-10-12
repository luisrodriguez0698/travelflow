'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { sfx } from './draw-sounds';
import { ticketDigits, type StageProps } from './draw-types';

const easeOutBack = (t: number) => {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Tragamonedas: un rodillo por digito del numero de boleto. Los rodillos se
 * detienen de izquierda a derecha; abajo pasan nombres hasta revelar al dueno.
 */
export function SlotStage({ pool, target, spinId, durationMs, onDone }: StageProps) {
  const digits = ticketDigits(pool.length ? pool : target ? [target] : []);
  const [offsets, setOffsets] = useState<number[]>(() => Array(digits).fill(0));
  const [name, setName] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setOffsets((o) => (o.length === digits ? o : Array(digits).fill(0)));
  }, [digits]);

  useEffect(() => {
    if (!target || !spinId) return;
    const targetDigits = String(target.number).padStart(digits, '0').split('').map(Number);
    const start = offsetsRef.current.length === digits ? offsetsRef.current : Array(digits).fill(0);
    // Cada rodillo recorre varias vueltas y termina en su digito
    const plans = targetDigits.map((d, i) => {
      const from = start[i];
      const loops = 3 + i * 2 + Math.round(durationMs / 900);
      const delta = loops * 10 + ((d - (Math.round(from) % 10) + 10) % 10);
      const stopAt = durationMs * (0.5 + (0.5 * (i + 1)) / digits) - 300;
      return { from: Math.round(from), delta, stopAt };
    });
    const t0 = performance.now();
    let raf = 0;
    let lastTick = 0;
    let lastCell = -1;
    let lastName = 0;
    let stopped = 0;
    setSpinning(true);
    setName(null);

    const frame = (now: number) => {
      const t = now - t0;
      const next = plans.map((p) => p.from + p.delta * easeOutBack(Math.min(1, t / p.stopAt)));
      setOffsets(next);

      // Tic del rodillo que sigue girando mas a la derecha
      const moving = plans.findIndex((p) => t < p.stopAt);
      if (moving >= 0) {
        const cell = Math.floor(next[plans.length - 1]);
        if (cell !== lastCell && now - lastTick > 45) {
          lastCell = cell;
          lastTick = now;
          sfx.tick(1 + moving * 0.08);
        }
      }
      const nowStopped = plans.filter((p) => t >= p.stopAt).length;
      if (nowStopped > stopped) {
        stopped = nowStopped;
        sfx.rattle();
      }
      // Nombres pasando
      if (t < plans[plans.length - 1].stopAt && now - lastName > 90) {
        lastName = now;
        const p = poolRef.current;
        if (p.length) setName(p[Math.floor(Math.random() * p.length)].participantName);
      }
      if (t >= plans[plans.length - 1].stopAt + 350) {
        setOffsets(plans.map((p) => p.from + p.delta));
        setName(target.participantName);
        setSpinning(false);
        sfx.reveal();
        onDoneRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spinId, target, durationMs, digits]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-2">
      <div className="relative rounded-[2rem] p-3 sm:p-5 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_60px_rgba(245,158,11,0.35)]">
        {/* Focos del marco */}
        <div className="absolute inset-0 rounded-[2rem] pointer-events-none">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={cn('absolute w-2 h-2 rounded-full bg-yellow-100', spinning ? 'animate-pulse' : 'opacity-60')}
              style={{
                left: `${i < 9 ? 6 + i * 11 : 6 + (i - 9) * 11}%`,
                top: i < 9 ? 4 : undefined,
                bottom: i >= 9 ? 4 : undefined,
                animationDelay: `${(i % 3) * 150}ms`,
                boxShadow: '0 0 8px #fde047',
              }}
            />
          ))}
        </div>
        <div className="flex gap-2 sm:gap-3 rounded-2xl bg-slate-950 p-2 sm:p-3 shadow-inner">
          {Array.from({ length: digits }).map((_, i) => (
            <Reel key={i} offset={offsets[i] ?? 0} />
          ))}
        </div>
      </div>

      <div className="min-h-[3.5rem] flex items-center justify-center text-center">
        <p
          className={cn(
            'font-bold tracking-tight transition-all duration-300 max-w-[90vw] truncate',
            spinning ? 'text-2xl sm:text-3xl text-white/50 blur-[1px]' : name ? 'text-3xl sm:text-5xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'text-xl text-white/40'
          )}
        >
          {name ?? '¿Quién será?'}
        </p>
      </div>
    </div>
  );
}

function Reel({ offset }: { offset: number }) {
  const base = Math.floor(offset);
  const frac = offset - base;
  return (
    <div className="relative w-16 h-24 sm:w-24 sm:h-36 lg:w-28 lg:h-44 overflow-hidden rounded-xl bg-gradient-to-b from-slate-200 via-white to-slate-200">
      <div className="absolute inset-x-0" style={{ top: '0', transform: `translateY(${(-frac - 1) * 100}%)`, height: '100%' }}>
        {[-1, 0, 1, 2].map((k) => (
          <div key={k} className="h-full flex items-center justify-center text-5xl sm:text-7xl lg:text-8xl font-black text-slate-900 tabular-nums">
            {(((base + k) % 10) + 10) % 10}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/40" />
    </div>
  );
}
