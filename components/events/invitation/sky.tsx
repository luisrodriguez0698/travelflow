'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ASSETS } from './assets';
import { onTilt } from './device-motion';

// Cielo de fondo: degradado azul + nubes que cruzan a distintas velocidades y
// alturas, globos dorados desenfocados (como en el flyer), un avion que cruza de
// vez en cuando dejando su estela, y profundidad (parallax) con el mouse o al
// inclinar el celular.

const CLOUDS = [
  { top: '6%', width: 'min(90vw, 620px)', opacity: 0.55, duration: 95, depth: 10, blur: 1 },
  { top: '28%', width: 'min(70vw, 460px)', opacity: 0.35, duration: 140, depth: 5, blur: 2 },
  { top: '52%', width: 'min(110vw, 760px)', opacity: 0.45, duration: 80, depth: 16, blur: 0 },
  { top: '78%', width: 'min(80vw, 520px)', opacity: 0.6, duration: 110, depth: 22, blur: 0 },
];

const BOKEH = [
  { className: '-left-16 bottom-[8%] w-40 sm:w-56', depth: 28, delay: 0 },
  { className: '-right-14 top-[42%] w-32 sm:w-44', depth: 34, delay: 1.5 },
  { className: 'right-[12%] -top-10 w-20 sm:w-28 opacity-70', depth: 18, delay: 0.8 },
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
      if (reduce) return;

      // Globos dorados que flotan despacio
      gsap.utils.toArray<HTMLElement>('[data-bokeh]').forEach((b, i) => {
        gsap.to(b, { y: -24, x: i % 2 ? -10 : 10, rotation: i % 2 ? -6 : 6, duration: 4 + i, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: BOKEH[i].delay });
      });

      // Avion que cruza el cielo cada cierto tiempo con su estela
      // Recorrido en diagonal (abajo-izquierda -> arriba-derecha); la estela sigue el mismo angulo
      const dx = () => window.innerWidth + 320;
      const dy = () => window.innerHeight * 0.54;
      const angle = () => (-Math.atan2(dy(), dx()) * 180) / Math.PI;
      const flight = gsap.timeline({ repeat: -1, repeatDelay: 9, delay: 4 });
      flight
        .set('[data-sky-plane]', { x: -160, y: () => window.innerHeight * 0.72, rotation: () => angle() - 4, opacity: 1 })
        .set('[data-trail]', { x: -160, y: () => window.innerHeight * 0.72, rotation: angle, width: () => Math.hypot(dx(), dy()), scaleX: 0, opacity: 0.7 })
        .to('[data-sky-plane]', { x: () => window.innerWidth + 160, y: () => window.innerHeight * 0.18, duration: 7, ease: 'none' })
        .to('[data-trail]', { scaleX: 1, duration: 7, ease: 'none' }, '<')
        .to('[data-trail]', { opacity: 0, duration: 2 });
    }, el);

    // Parallax: mouse en computadora, inclinacion en celular
    const layers = gsap.utils.toArray<HTMLElement>('[data-depth]', el).map((layer) => ({
      x: gsap.quickTo(layer, 'xPercent', { duration: 1.2, ease: 'power3' }),
      y: gsap.quickTo(layer, 'yPercent', { duration: 1.2, ease: 'power3' }),
      depth: Number(layer.dataset.depth),
    }));
    const move = (nx: number, ny: number) =>
      layers.forEach((l) => {
        l.x(-nx * l.depth * 0.6);
        l.y(-ny * l.depth * 0.6);
      });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      move(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    let offTilt = () => {};
    if (!reduce) {
      window.addEventListener('pointermove', onMove);
      offTilt = onTilt((x, y) => move(x * 0.6, y * 0.6));
    }

    return () => {
      window.removeEventListener('pointermove', onMove);
      offTilt();
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

      {/* Estela + avion lejano */}
      <div
        data-trail
        className="absolute left-0 top-0 h-[2px] origin-left opacity-0"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55))',
          filter: 'blur(1px)',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-sky-plane src={ASSETS.plane} alt="" className="absolute left-0 top-0 w-20 opacity-0 sm:w-24" style={{ marginLeft: -40, marginTop: -30 }} />

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

      {BOKEH.map((b, i) => (
        <div key={i} data-depth={b.depth} className={`absolute ${b.className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-bokeh src={ASSETS.balloonGold} alt="" className="w-full" />
        </div>
      ))}
    </div>
  );
}
