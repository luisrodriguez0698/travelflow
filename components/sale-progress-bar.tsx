'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Plane } from 'lucide-react';

/** Barra de avance de pago con un avioncito que vuela hasta el porcentaje. */
export function SaleProgressBar({ progress }: { progress: number }) {
  const bar = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  const pct = Math.max(0, Math.min(100, progress));

  useEffect(() => {
    if (!bar.current || !plane.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(bar.current, { width: `${pct}%` });
      gsap.set(plane.current, { left: `${pct}%` });
      shown.current = pct;
      return;
    }
    const from = shown.current;
    const tl = gsap.timeline();
    tl.fromTo(bar.current, { width: `${from}%` }, { width: `${pct}%`, duration: 1.4, ease: 'power3.out' }, 0)
      .fromTo(plane.current, { left: `${from}%` }, { left: `${pct}%`, duration: 1.4, ease: 'power3.out' }, 0)
      .fromTo(plane.current.firstElementChild, { rotation: -10 }, { rotation: 0, duration: 1.4, ease: 'power3.out' }, 0);
    shown.current = pct;
    return () => {
      tl.kill();
    };
  }, [pct]);

  return (
    <div className="relative pt-3">
      <div className="h-3 w-full rounded-full bg-muted">
        <div ref={bar} className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: '0%' }} />
      </div>
      <div ref={plane} className="absolute top-0" style={{ left: '0%' }}>
        <div className="-ml-3.5 flex h-7 w-7 -translate-y-0.5 items-center justify-center rounded-full border-2 border-sky-400 bg-background text-sky-500 shadow">
          <Plane className="h-3.5 w-3.5 rotate-45" />
        </div>
      </div>
      <span className="absolute -top-1 right-0 text-base">🏝️</span>
    </div>
  );
}
