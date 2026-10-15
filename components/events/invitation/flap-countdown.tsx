'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Cuenta regresiva estilo pantalla de salidas del aeropuerto (letreros que giran).

function FlapDigit({ value }: { value: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (el.current) {
      gsap.fromTo(el.current, { rotationX: -90, opacity: 0.4 }, { rotationX: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)', transformPerspective: 300 });
    }
  }, [value]);
  return (
    <span className="relative flex h-10 w-[26px] items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-slate-800 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_8px_rgba(0,0,0,0.4)] min-[380px]:h-11 min-[380px]:w-[30px] sm:h-14 sm:w-10">
      <span ref={el} className="font-mono text-xl font-bold text-amber-300 sm:text-3xl" style={{ transformOrigin: '50% 50%' }}>
        {value}
      </span>
      <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />
    </span>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-0.5 sm:gap-1">
        {text.split('').map((d, i) => (
          <FlapDigit key={`${text.length}-${i}`} value={d} />
        ))}
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/70 sm:text-[10px] sm:tracking-[0.2em]">{label}</span>
    </div>
  );
}

export function FlapCountdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <div className="h-20" />;

  const diff = Math.max(0, new Date(to).getTime() - now);
  if (diff === 0) return null;
  return (
    <div className="flex items-start justify-center gap-1.5 sm:gap-3">
      <Unit value={Math.floor(diff / 86_400_000)} label="Días" />
      <Unit value={Math.floor((diff % 86_400_000) / 3_600_000)} label="Horas" />
      <Unit value={Math.floor((diff % 3_600_000) / 60_000)} label="Min" />
      <Unit value={Math.floor((diff % 60_000) / 1000)} label="Seg" />
    </div>
  );
}
