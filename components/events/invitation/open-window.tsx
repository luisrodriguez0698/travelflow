'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import confetti from 'canvas-confetti';
import { ChevronsDown, Pointer } from 'lucide-react';
import { ASSETS } from './assets';
import { onTilt, requestMotionPermission } from './device-motion';
import { chime, pop, sparkle, unlockAudio } from './sound';
import { celebrate } from './celebrate';

// Portada: ventanilla de avion ya abierta con el "1" de nube adentro y globos
// alrededor. Al tocarla los globos salen volando, cae confeti y aparecen
// bocadillos con mensajes al azar.

/** Forma de ventanilla: esquinas muy redondeadas (igual en cada capa). */
const WINDOW_RADIUS = '46% / 34%';

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

  // Entrada + flotado + avioncito que cruza la ventanilla de vez en cuando
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      gsap.from('[data-ow-logo]', { y: -30, opacity: 0, duration: 0.8, ease: 'power3.out' });
      gsap.from(tilt.current, { y: 80, rotationX: 25, scale: 0.85, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.15 });
      gsap.from('[data-ow-balloon]', { y: 260, opacity: 0, duration: 1.6, stagger: 0.12, ease: 'power2.out', delay: 0.4 });
      if (reduce) return;
      gsap.to('[data-ow-float]', { y: -10, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(one.current, { y: -6, rotation: 2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.utils.toArray<HTMLElement>('[data-ow-balloon]').forEach((b, i) => {
        gsap.to(b, { y: '-=16', rotation: `+=${i % 2 ? -5 : 5}`, duration: 2.4 + i * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.8 + i * 0.2 });
      });
      gsap
        .timeline({ repeat: -1, repeatDelay: 5, delay: 2 })
        .fromTo('[data-ow-plane]', { xPercent: -160, yPercent: 120, rotation: -10, opacity: 1 }, { xPercent: 260, yPercent: -140, rotation: -22, duration: 3, ease: 'power1.inOut' });

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
    } else {
      celebrate();
    }

    const slots = shuffle([...BUBBLE_SLOTS]).slice(0, 3);
    nextMessages(3).forEach((text, i) => spawnBubble(text, slots[i], 0.15 + i * 0.45));
  };

  return (
    <section ref={root} className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-10 pt-16">
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
              <div
                className="absolute inset-0 p-[8%]"
                style={{
                  borderRadius: WINDOW_RADIUS,
                  background: 'linear-gradient(150deg, #ffffff 0%, #e8edf3 35%, #c5cfdc 75%, #aab6c6 100%)',
                  boxShadow:
                    '0 50px 90px -25px rgba(2,6,23,0.65), 0 18px 30px -12px rgba(2,6,23,0.35), inset 0 3px 2px #ffffff, inset 0 -10px 18px rgba(71,85,105,0.35)',
                }}
              >
                <div
                  className="h-full w-full p-[4%]"
                  style={{
                    borderRadius: WINDOW_RADIUS,
                    background: 'linear-gradient(160deg, #94a3b8 0%, #f1f5f9 35%, #e2e8f0 60%, #8a99ad 100%)',
                    boxShadow: 'inset 0 10px 20px rgba(15,23,42,0.45), 0 2px 0 rgba(255,255,255,0.8)',
                  }}
                >
                  <div
                    className="relative h-full w-full overflow-hidden"
                    style={{ borderRadius: WINDOW_RADIUS, background: 'linear-gradient(180deg, #1d4ed8 0%, #3b82f6 35%, #93c5fd 75%, #dbeafe 100%)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ASSETS.cloud} alt="" className="absolute -left-1/4 bottom-[-8%] w-[150%] max-w-none opacity-90" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ASSETS.cloud} alt="" className="absolute -right-1/3 top-[10%] w-[90%] max-w-none opacity-50" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img data-ow-plane src={ASSETS.plane} alt="" className="absolute left-0 top-[45%] w-[46%] opacity-0 drop-shadow-[0_10px_12px_rgba(15,23,42,0.35)]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={one}
                      src={ASSETS.cloudOne}
                      alt="1"
                      className="absolute left-[24%] top-[18%] w-[52%] drop-shadow-[0_10px_20px_rgba(30,58,138,0.35)]"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        borderRadius: WINDOW_RADIUS,
                        background: 'linear-gradient(125deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 45%, transparent 70%, rgba(255,255,255,0.12) 85%)',
                        boxShadow: 'inset 0 0 28px rgba(15,23,42,0.5)',
                      }}
                    />
                  </div>
                </div>
              </div>
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
