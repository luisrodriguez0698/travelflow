'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import confetti from 'canvas-confetti';
import { ChevronsDown, Pointer } from 'lucide-react';
import { ASSETS } from './assets';
import { onTilt, requestMotionPermission } from './device-motion';
import { chime, pop, sparkle, unlockAudio } from './sound';

// Portada: ventanilla de avion ya abierta con el "1" de nube adentro y globos
// alrededor. Al tocarla los globos salen volando, cae confeti y aparecen
// bocadillos con mensajes al azar.

/** Lugares alrededor de la ventanilla donde salen los bocadillos (% del contenedor). */
const BUBBLE_SLOTS = [
  { left: 3, top: 20, tail: 'right' },
  { left: 56, top: 14, tail: 'left' },
  { left: 2, top: 52, tail: 'right' },
  { left: 58, top: 46, tail: 'left' },
  { left: 8, top: 74, tail: 'right' },
  { left: 54, top: 70, tail: 'left' },
] as const;

const BALLOONS = [
  { src: ASSETS.balloonSilver, className: 'left-[2%] top-[12%] w-16 sm:w-20', rotate: -8 },
  { src: ASSETS.balloonBlue, className: 'left-[6%] top-[46%] w-14 sm:w-[72px]', rotate: 6 },
  { src: ASSETS.balloonGold, className: 'right-[3%] top-[18%] w-20 sm:w-24', rotate: 8 },
  { src: ASSETS.balloonSilver, className: 'right-[8%] top-[52%] w-12 sm:w-16', rotate: -6 },
  { src: ASSETS.balloonBlue, className: 'right-[1%] top-[36%] w-10 sm:w-14', rotate: 10 },
];

/**
 * Marco de ventanilla en SVG con el centro hueco: plastico exterior + bisel
 * interior con sombra de profundidad y un reflejo suave del vidrio.
 */
function WindowFrame() {
  const id = useId().replace(/:/g, '');
  // viewBox 300x400; mismas proporciones de esquina en cada capa
  const outer = { x: 0, y: 0, w: 300, h: 400, rx: 138, ry: 136 };
  const bezel = { x: 22, y: 22, w: 256, h: 356, rx: 116, ry: 118 };
  const hole = { x: 34, y: 34, w: 232, h: 332, rx: 104, ry: 110 };
  const rect = (r: typeof outer, props: React.SVGProps<SVGRectElement>) => (
    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} ry={r.ry} {...props} />
  );
  return (
    <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full overflow-visible" style={{ filter: 'drop-shadow(0 30px 40px rgba(2,6,23,0.45)) drop-shadow(0 8px 12px rgba(2,6,23,0.3))' }} aria-hidden>
      <defs>
        <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#eef2f7" />
          <stop offset="75%" stopColor="#c8d2df" />
          <stop offset="100%" stopColor="#a9b5c5" />
        </linearGradient>
        <linearGradient id={`${id}-bezel`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#8f9db0" />
          <stop offset="30%" stopColor="#f1f5f9" />
          <stop offset="65%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#8796aa" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="85%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <mask id={`${id}-cut-frame`}>
          {rect(outer, { fill: 'white' })}
          {rect(bezel, { fill: 'black' })}
        </mask>
        <mask id={`${id}-cut-bezel`}>
          {rect(bezel, { fill: 'white' })}
          {rect(hole, { fill: 'black' })}
        </mask>
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id={`${id}-hole`}>{rect(hole, {})}</clipPath>
      </defs>

      {/* Plastico exterior */}
      {rect(outer, { fill: `url(#${id}-frame)`, mask: `url(#${id}-cut-frame)` })}
      {rect({ ...outer, x: 1.5, y: 1.5, w: 297, h: 397 }, { fill: 'none', stroke: 'white', strokeOpacity: 0.9, strokeWidth: 2 })}
      {/* Bisel */}
      {rect(bezel, { fill: `url(#${id}-bezel)`, mask: `url(#${id}-cut-bezel)` })}
      {/* Profundidad: sombra hacia adentro del hueco */}
      <g clipPath={`url(#${id}-hole)`}>
        {rect(hole, { fill: 'none', stroke: 'rgba(15,23,42,0.55)', strokeWidth: 16, filter: `url(#${id}-blur)` })}
        {rect(hole, { fill: `url(#${id}-glass)` })}
      </g>
    </svg>
  );
}

function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function OpenWindow({ title, messages }: { title: string; messages: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLButtonElement>(null);
  const one = useRef<HTMLImageElement>(null);
  const bubbleLayer = useRef<HTMLDivElement>(null);
  const [tapped, setTapped] = useState(false);
  const messageQueue = useRef<string[]>([]);

  // Entrada + flotado
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      gsap.from('[data-ow-logo]', { y: -30, opacity: 0, duration: 0.8, ease: 'power3.out' });
      gsap.from(tilt.current, { y: 80, rotationX: 25, scale: 0.85, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.15 });
      gsap.from('[data-ow-balloon]', { scale: 0, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'back.out(1.8)', delay: 0.6 });
      if (reduce) return;
      gsap.to('[data-ow-float]', { y: -10, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(one.current, { y: -6, rotation: 2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.utils.toArray<HTMLElement>('[data-ow-balloon]').forEach((b, i) => {
        gsap.to(b, { y: '-=16', rotation: `+=${i % 2 ? -5 : 5}`, duration: 2.4 + i * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.8 + i * 0.2 });
      });

      const split = SplitText.create('[data-ow-title]', { type: 'chars' });
      gsap.from(split.chars, { yPercent: 100, rotationX: -90, opacity: 0, transformOrigin: '50% 100%', stagger: 0.05, duration: 0.8, ease: 'back.out(1.8)', delay: 0.9 });
      gsap.to('[data-ow-hint]', { scale: 1.06, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }, root);
    return () => ctx.revert();
  }, []);

  // Inclinacion 3D (mouse en computadora, sensor en celular)
  useEffect(() => {
    const el = tilt.current;
    if (!el) return;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3' });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      rx(-(e.clientY / window.innerHeight - 0.5) * 14);
      ry((e.clientX / window.innerWidth - 0.5) * 18);
    };
    window.addEventListener('pointermove', onMove);
    const offTilt = onTilt((x, y) => {
      rx(-y * 12);
      ry(x * 16);
    });
    return () => {
      window.removeEventListener('pointermove', onMove);
      offTilt();
    };
  }, []);

  /** Bocadillo con un mensaje (texto puesto con textContent: sin HTML). */
  const spawnBubble = useCallback((text: string, slot: (typeof BUBBLE_SLOTS)[number], delay: number) => {
    const layer = bubbleLayer.current;
    if (!layer) return;
    const bubble = document.createElement('div');
    bubble.className =
      'absolute max-w-[46%] rounded-2xl bg-white px-3 py-2 text-[13px] font-bold leading-snug text-blue-800 shadow-[0_10px_25px_-8px_rgba(2,6,23,0.5)] sm:text-sm';
    bubble.style.left = `${slot.left}%`;
    bubble.style.top = `${slot.top}%`;
    bubble.textContent = text;
    const tail = document.createElement('span');
    tail.className = 'absolute -bottom-1.5 h-3 w-3 rotate-45 bg-white';
    tail.style[slot.tail === 'right' ? 'right' : 'left'] = '18px';
    bubble.appendChild(tail);
    layer.appendChild(bubble);
    gsap
      .timeline({ delay, onStart: pop, onComplete: () => bubble.remove() })
      .fromTo(bubble, { scale: 0, opacity: 0, rotation: slot.tail === 'right' ? -10 : 10, transformOrigin: slot.tail === 'right' ? '85% 100%' : '15% 100%' }, { scale: 1, opacity: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.2)' })
      .to(bubble, { y: -14, duration: 2.6, ease: 'sine.inOut' })
      .to(bubble, { opacity: 0, y: -30, scale: 0.9, duration: 0.5, ease: 'power2.in' });
  }, []);

  /** Globos que brotan de los costados de la ventanilla y suben hasta perderse. */
  const sideBalloons = useCallback(() => {
    const layer = bubbleLayer.current;
    const frame = tilt.current;
    if (!layer || !frame) return;
    const box = layer.getBoundingClientRect();
    const win = frame.getBoundingClientRect();
    const sources = [ASSETS.balloonSilver, ASSETS.balloonBlue, ASSETS.balloonGold];
    for (let i = 0; i < 6; i++) {
      const left = i % 2 === 0;
      const img = document.createElement('img');
      img.src = sources[i % sources.length];
      img.alt = '';
      const size = gsap.utils.random(46, 78);
      // Junto al borde izquierdo o derecho de la ventanilla, a media altura
      const x = (left ? win.left - box.left - size * 0.6 : win.right - box.left - size * 0.4) + gsap.utils.random(-12, 12);
      const y = win.top - box.top + win.height * gsap.utils.random(0.35, 0.75);
      img.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px`;
      layer.appendChild(img);
      gsap
        .timeline({ delay: i * 0.12, onComplete: () => img.remove() })
        .fromTo(img, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' })
        .to(img, { y: -(y + 260), x: (left ? -1 : 1) * gsap.utils.random(20, 70), rotation: gsap.utils.random(-15, 15), duration: gsap.utils.random(2.4, 3.4), ease: 'power1.in' })
        .to(img, { opacity: 0, duration: 0.6 }, '-=0.7');
    }
  }, []);

  const nextMessages = useCallback(
    (count: number) => {
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        if (!messageQueue.current.length) messageQueue.current = shuffle(messages);
        out.push(messageQueue.current.pop() as string);
      }
      return out;
    },
    [messages]
  );

  const onTap = () => {
    unlockAudio();
    requestMotionPermission();
    sparkle();
    navigator.vibrate?.(40);

    // La ventanilla "salta" y el 1 da una vuelta
    gsap.fromTo(tilt.current, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    gsap.fromTo(one.current, { rotationY: 0 }, { rotationY: 360, duration: 1, ease: 'power2.inOut' });

    const colors = ['#1d4ed8', '#38bdf8', '#e2e8f0', '#ffffff', '#fbbf24'];
    const rect = tilt.current?.getBoundingClientRect();
    const origin = rect
      ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
      : { x: 0.5, y: 0.4 };
    confetti({ particleCount: 110, spread: 100, startVelocity: 38, origin, colors });

    if (!tapped) {
      // Los globos de alrededor se van volando
      gsap.utils.toArray<HTMLElement>('[data-ow-balloon]', root.current).forEach((b, i) => {
        gsap.killTweensOf(b);
        gsap.to(b, {
          y: -(window.innerHeight * 1.1),
          x: gsap.utils.random(-60, 60),
          rotation: gsap.utils.random(-25, 25),
          duration: gsap.utils.random(2.2, 3.4),
          delay: i * 0.08,
          ease: 'power2.in',
          onStart: i % 2 ? pop : undefined,
        });
        gsap.to(b, { opacity: 0, duration: 0.6, delay: 1.8 + i * 0.08 });
      });
      setTimeout(chime, 300);
      setTapped(true);
    }
    sideBalloons();

    const slots = shuffle([...BUBBLE_SLOTS]).slice(0, 3);
    nextMessages(3).forEach((text, i) => spawnBubble(text, slots[i], 0.15 + i * 0.45));
  };

  return (
    <section ref={root} className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden pb-10 pt-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-ow-logo src={ASSETS.logo} alt="" className="mb-6 w-36 drop-shadow-lg sm:w-44" />

      <div className="relative w-full max-w-md">
        {/* Globos alrededor */}
        {BALLOONS.map((b, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            data-ow-balloon
            src={b.src}
            alt=""
            aria-hidden
            className={`pointer-events-none absolute z-20 ${b.className}`}
            style={{ rotate: `${b.rotate}deg` }}
          />
        ))}

        {/* Bocadillos */}
        <div ref={bubbleLayer} className="pointer-events-none absolute inset-0 z-30" />

        {/* Ventanilla abierta */}
        <div className="flex justify-center" style={{ perspective: 1100 }}>
          <div data-ow-float>
            <button
              ref={tilt}
              type="button"
              onClick={onTap}
              aria-label="Toca la ventana"
              className="relative block w-[min(64vw,270px)] cursor-pointer outline-none"
              style={{ transformStyle: 'preserve-3d', aspectRatio: '3 / 4' }}
            >
              <WindowFrame />
              {/* El "1" flota en el hueco, sobre el cielo de fondo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={one}
                src={ASSETS.cloudOne}
                alt="1"
                className="absolute left-[23%] top-[25%] w-[54%] drop-shadow-[0_14px_22px_rgba(15,23,42,0.4)]"
              />
            </button>
          </div>
        </div>
      </div>

      <h1 data-ow-title className="mt-8 text-center text-3xl font-black uppercase tracking-[0.12em] text-white drop-shadow [perspective:600px] sm:text-4xl">
        {title}
      </h1>

      <div className="mt-6 flex flex-col items-center text-white">
        {!tapped ? (
          <p data-ow-hint className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            <Pointer className="h-4 w-4" />
            Toca la ventana
          </p>
        ) : (
          <div className="flex flex-col items-center gap-1 text-sm font-medium text-white/85">
            Desliza para ver tu ruta
            <ChevronsDown className="h-6 w-6 animate-bounce" />
          </div>
        )}
      </div>
    </section>
  );
}
