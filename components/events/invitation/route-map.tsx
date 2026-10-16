'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Camera, Compass, Heart, MapPin, Palmtree, Star, Sun } from 'lucide-react';
import { ASSETS } from './assets';
import { planeFlyby, shutter } from './sound';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, DrawSVGPlugin);

// Mapa de ruta con el scroll: el avion baja en forma de "S" dejando un caminito
// punteado y a los lados aparecen las fotos (polaroid con chinche) y dibujitos.
// Todo va pegado al scroll: al subir, el avion regresa, el caminito se borra y
// las fotos se van.

const DOODLES = [Camera, Palmtree, Sun, Heart, Compass, Star, MapPin];

export function RouteMap({ photos }: { photos: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const maskId = `route-mask-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Curva en S: alterna izquierda/derecha; cada foto va del lado contrario
  const layout = useMemo(() => {
    if (!width || photos.length === 0) return null;
    const seg = Math.max(360, Math.min(500, width * 1.05));
    const top = 40;
    const height = top + photos.length * seg + 140;
    const photoWidth = Math.min(width * 0.44, 220);
    const points = [{ x: width / 2, y: 0 }];
    const items = photos.map((src, i) => {
      const y = top + i * seg + seg / 2;
      const curveLeft = i % 2 === 0;
      points.push({ x: width * (curveLeft ? 0.2 : 0.8), y });
      return {
        src,
        y,
        x: width * (curveLeft ? 0.7 : 0.3),
        side: curveLeft ? 'right' : 'left',
        rotate: (curveLeft ? 1 : -1) * (3 + ((i * 7) % 5)),
      };
    });
    points.push({ x: width / 2, y: height });
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dy = b.y - a.y;
      d += ` C ${a.x} ${a.y + dy * 0.55}, ${b.x} ${b.y - dy * 0.55}, ${b.x} ${b.y}`;
    }
    // Dibujitos en las orillas, entre foto y foto
    const doodles = items.slice(0, -1).map((item, i) => ({ y: item.y + seg / 2, x: width * (i % 2 ? 0.86 : 0.14), Icon: DOODLES[i % DOODLES.length] }));
    doodles.push({ y: top + 10, x: width * 0.12, Icon: DOODLES[(photos.length + 2) % DOODLES.length] });
    return { d, height, items, doodles, photoWidth };
  }, [width, photos]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!layout || !el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const path = el.querySelector<SVGPathElement>('[data-route]');
      const body = el.querySelector<HTMLElement>('[data-plane-body]');
      if (!path || !body) return;

      if (reduce) {
        gsap.set('[data-mask-path]', { drawSVG: '100%' });
        gsap.set('[data-plane]', { opacity: 0 });
        gsap.utils.toArray<HTMLElement>('[data-photo]').forEach((p) => gsap.set(p, { opacity: 1, rotation: Number(p.dataset.rot) }));
        return;
      }

      // Inclinacion del avion segun la velocidad del scroll (se ladea al girar)
      const bankX = gsap.quickTo(body, 'rotationX', { duration: 0.5, ease: 'power2' });
      const bankY = gsap.quickTo(body, 'rotationY', { duration: 0.5, ease: 'power2' });
      let lastSound = 0;
      const flyby = () => {
        if (Date.now() - lastSound < 5000) return;
        lastSound = Date.now();
        planeFlyby(2.2);
      };

      gsap.set('[data-mask-path]', { drawSVG: '0%' });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top 55%',
          end: 'bottom 70%',
          scrub: 0.8,
          onEnter: flyby,
          onEnterBack: flyby,
          onUpdate: (self) => {
            const v = gsap.utils.clamp(-45, 45, self.getVelocity() / 50);
            bankX(v);
            bankY(-v * 0.4);
          },
        },
      });
      tl.to('[data-plane]', { motionPath: { path, align: path, alignOrigin: [0.5, 0.5], autoRotate: true }, ease: 'none', duration: 1 }, 0)
        .to('[data-mask-path]', { drawSVG: '100%', ease: 'none', duration: 1 }, 0)
        // Sube y baja de "altura" (se acerca y se aleja) en cada curva
        .to(body, { scale: 1.3, duration: 1 / (layout.items.length * 2), yoyo: true, repeat: layout.items.length * 2 - 1, ease: 'sine.inOut' }, 0);
      tl.progress(0.001).progress(0);

      // Fotos que aparecen al llegar el avion (y se van al subir)
      gsap.utils.toArray<HTMLElement>('[data-photo]').forEach((photo) => {
        const rot = Number(photo.dataset.rot);
        const fromRight = photo.dataset.side === 'right';
        gsap
          .timeline({
            scrollTrigger: { trigger: photo, start: 'top 82%', toggleActions: 'play none none reverse', onEnter: shutter },
          })
          .fromTo(
            photo,
            { opacity: 0, scale: 0.4, rotation: rot * 5, rotationY: fromRight ? -70 : 70, y: 70 },
            { opacity: 1, scale: 1, rotation: rot, rotationY: 0, y: 0, duration: 0.85, ease: 'back.out(1.5)' }
          )
          .fromTo(photo.querySelector('[data-pin]'), { y: -40, opacity: 0, scale: 1.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'bounce.out' }, '-=0.25');
      });

      // Dibujitos que se "dibujan" solos
      gsap.utils.toArray<HTMLElement>('[data-doodle]').forEach((doodle) => {
        const strokes = doodle.querySelectorAll('path, circle, line, polyline, polygon, rect');
        gsap.fromTo(
          strokes,
          { drawSVG: '0%' },
          {
            drawSVG: '100%',
            duration: 1.2,
            stagger: 0.12,
            ease: 'power1.inOut',
            scrollTrigger: { trigger: doodle, start: 'top 85%', toggleActions: 'play none none reverse' },
          }
        );
      });
    }, el);

    // Lo de arriba (portada, fuentes) puede cambiar de alto al cargar
    const t = setTimeout(() => ScrollTrigger.refresh(), 600);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [layout]);

  if (photos.length === 0) return null;

  return (
    <section ref={root} aria-label="Nuestra ruta" className="relative w-full" style={{ height: layout?.height ?? photos.length * 420 }}>
      {layout && (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${layout.height}`} aria-hidden>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="-50" y="-50" width={width + 100} height={layout.height + 100}>
                <path data-mask-path d={layout.d} fill="none" stroke="white" strokeWidth="14" strokeLinecap="round" />
              </mask>
            </defs>
            {/* Ruta completa (guia del avion, invisible) */}
            <path data-route d={layout.d} fill="none" stroke="none" />
            {/* Caminito punteado que se va dibujando */}
            <path
              d={layout.d}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="3"
              strokeDasharray="10 12"
              strokeLinecap="round"
              mask={`url(#${maskId})`}
              style={{ filter: 'drop-shadow(0 2px 3px rgba(2,6,23,0.35))' }}
            />
          </svg>

          {layout.doodles.map(({ x, y, Icon }, i) => (
            <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
              <div data-doodle style={{ rotate: `${i % 2 ? 12 : -10}deg` }}>
                <Icon className="h-11 w-11 text-white/70" strokeWidth={1.6} />
              </div>
            </div>
          ))}

          {layout.items.map((item, i) => (
            <div
              key={item.src}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: item.x, top: item.y, width: layout.photoWidth, perspective: 900 }}
            >
              <figure
                data-photo
                data-rot={item.rotate}
                data-side={item.side}
                className="relative rounded-[3px] bg-white p-2 pb-9 shadow-[0_25px_45px_-15px_rgba(2,6,23,0.6)]"
                style={{ opacity: 0 }}
              >
                {/* Chinche */}
                <span
                  data-pin
                  className="absolute left-1/2 top-1 z-10 h-4 w-4 -translate-x-1/2 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #fcd34d, #b45309 70%)',
                    boxShadow: '0 3px 4px rgba(2,6,23,0.45)',
                  }}
                />
                <div className="aspect-[3/4] overflow-hidden bg-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt={`Foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </div>
              </figure>
            </div>
          ))}

          {/* Avion 3D con sombra */}
          <div data-plane className="pointer-events-none absolute left-0 top-0 z-20 w-24 sm:w-28" style={{ perspective: 600 }}>
            <div data-plane-body className="relative" style={{ transformStyle: 'preserve-3d' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.plane} alt="" className="absolute inset-0 translate-x-3 translate-y-7 opacity-30 blur-[3px] brightness-0" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.plane} alt="" className="relative w-full" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
