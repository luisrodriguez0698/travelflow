'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ASSETS } from './assets';

// Cielo de fondo: degradado azul + nubes que cruzan a distintas velocidades y
// alturas, con profundidad (parallax) al mover el mouse.

const CLOUDS = [
  { top: '6%', width: 'min(90vw, 620px)', opacity: 0.55, duration: 95, depth: 10, blur: 1 },
  { top: '28%', width: 'min(70vw, 460px)', opacity: 0.35, duration: 140, depth: 5, blur: 2 },
  { top: '52%', width: 'min(110vw, 760px)', opacity: 0.45, duration: 80, depth: 16, blur: 0 },
  { top: '78%', width: 'min(80vw, 520px)', opacity: 0.6, duration: 110, depth: 22, blur: 0 },
];

export function Sky() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      // Nubes cruzando de izquierda a derecha, cada una en un punto distinto del recorrido
      gsap.utils.toArray<HTMLElement>('[data-cloud]').forEach((cloud, i) => {
        if (reduce) return;
        const tween = gsap.fromTo(
          cloud,
          { x: () => -cloud.offsetWidth },
          { x: () => window.innerWidth, duration: CLOUDS[i].duration, ease: 'none', repeat: -1, invalidateOnRefresh: true }
        );
        tween.progress((i * 0.31 + 0.15) % 1);
      });

      // Rayos de luz que respiran
      gsap.to('[data-rays]', { opacity: 0.55, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }, el);

    // Parallax con el mouse (en celular las nubes solo cruzan)
    const layers = gsap.utils.toArray<HTMLElement>('[data-depth]', el).map((layer) => ({
      x: gsap.quickTo(layer, 'xPercent', { duration: 1.2, ease: 'power3' }),
      y: gsap.quickTo(layer, 'yPercent', { duration: 1.2, ease: 'power3' }),
      depth: Number(layer.dataset.depth),
    }));
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      layers.forEach((l) => {
        l.x(-nx * l.depth * 0.6);
        l.y(-ny * l.depth * 0.6);
      });
    };
    if (!reduce) window.addEventListener('pointermove', onMove);

    return () => {
      window.removeEventListener('pointermove', onMove);
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0b3fb0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.background} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-transparent to-blue-950/50" />
      <div
        data-rays
        className="absolute -top-1/3 left-1/2 h-[140vh] w-[140vw] -translate-x-1/2 opacity-30"
        style={{ background: 'conic-gradient(from 180deg at 50% 0%, transparent 0deg, rgba(255,255,255,0.18) 12deg, transparent 24deg, rgba(255,255,255,0.12) 40deg, transparent 56deg, rgba(255,255,255,0.15) 300deg, transparent 316deg)' }}
      />
      {CLOUDS.map((c, i) => (
        <div key={i} data-depth={c.depth} className="absolute left-0" style={{ top: c.top }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-cloud
            src={ASSETS.cloud}
            alt=""
            className="max-w-none"
            style={{ width: c.width, opacity: c.opacity, filter: c.blur ? `blur(${c.blur}px)` : undefined }}
          />
        </div>
      ))}
    </div>
  );
}
