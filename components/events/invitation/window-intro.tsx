'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ChevronsUp } from 'lucide-react';
import { ASSETS } from './assets';
import { chime, planeFlyby, shadeSlide, sparkle, unlockAudio } from './sound';
import { onTilt, requestMotionPermission } from './device-motion';

// Entrada: ventanilla de avion en 3D con la persiana cerrada. El invitado la sube
// con el dedo (o la toca) y aparece el cielo con el "1" de nube y el avion
// cruzando; despues la camara "atraviesa" la ventanilla hacia la invitacion.

/** Forma de ventanilla: esquinas muy redondeadas (igual en cada capa). */
const WINDOW_RADIUS = '46% / 34%';

export function WindowIntro({ onDone, subtitle }: { onDone: () => void; subtitle: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLImageElement>(null);
  const one = useRef<HTMLImageElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const state = useRef({ open: 0 }); // 0 cerrada … 1 abierta
  const drag = useRef<{ y: number; open: number; moved: boolean } | null>(null);
  const opened = useRef(false);
  const [done, setDone] = useState(false);

  const applyShade = useCallback(() => {
    if (shade.current) gsap.set(shade.current, { yPercent: -state.current.open * 100 });
    if (hint.current) gsap.set(hint.current, { opacity: 1 - state.current.open * 2 });
  }, []);

  // Aparicion de la escena + flotado suave
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-intro-title] > *', { y: 30, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out' });
      gsap.from(tilt.current, { y: 80, rotationX: 25, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.2 });
      gsap.to('[data-float]', { y: -10, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to('[data-hint-arrow]', { y: -8, duration: 0.8, yoyo: true, repeat: -1, ease: 'power1.inOut' });
      // La persiana "invita" a subirla
      gsap.to(state.current, { open: 0.08, duration: 0.6, delay: 1.6, yoyo: true, repeat: 3, repeatDelay: 1.2, ease: 'power2.inOut', onUpdate: applyShade });
    }, stage);
    return () => ctx.revert();
  }, [applyShade]);

  // Inclinacion 3D con el mouse
  useEffect(() => {
    const el = tilt.current;
    if (!el) return;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3' });
    const onMove = (e: PointerEvent) => {
      if (drag.current || e.pointerType !== 'mouse') return;
      rx(-(e.clientY / window.innerHeight - 0.5) * 14);
      ry((e.clientX / window.innerWidth - 0.5) * 18);
    };
    window.addEventListener('pointermove', onMove);
    // En celular: inclinar el telefono inclina la ventanilla
    const offTilt = onTilt((x, y) => {
      if (drag.current) return;
      rx(-y * 12);
      ry(x * 16);
    });
    return () => {
      window.removeEventListener('pointermove', onMove);
      offTilt();
    };
  }, []);

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    chime();
    gsap
      .timeline({ onComplete: onDone })
      .to('[data-intro-title], [data-intro-hint]', { opacity: 0, y: -20, duration: 0.4, stagger: 0.05 })
      .to(tilt.current, { scale: 5, rotationX: 0, rotationY: 0, duration: 1, ease: 'power3.in' }, '<')
      .to(stage.current, { opacity: 0, duration: 0.45 }, '-=0.45');
  }, [done, onDone]);

  const open = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    gsap.killTweensOf(state.current);
    shadeSlide();
    const viewWidth = view.current?.offsetWidth ?? 300;
    gsap
      .timeline({ onComplete: () => void setTimeout(finish, 500) })
      .to(state.current, { open: 1, duration: 0.7, ease: 'power3.out', onUpdate: applyShade })
      .fromTo(one.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.7)', onStart: sparkle }, '-=0.3')
      .fromTo(
        plane.current,
        { x: -viewWidth * 0.9, y: viewWidth * 0.55, scale: 0.5, rotation: -6, opacity: 1 },
        { x: viewWidth * 1.15, y: -viewWidth * 0.45, scale: 0.95, rotation: -24, opacity: 1, duration: 2.4, ease: 'power1.inOut', onStart: () => planeFlyby(2.4) },
        '-=0.6'
      );
  }, [applyShade, finish]);

  // ── Arrastre de la persiana ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (opened.current) return;
    unlockAudio();
    gsap.killTweensOf(state.current);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, open: state.current.open, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !view.current) return;
    const delta = (drag.current.y - e.clientY) / view.current.offsetHeight;
    if (Math.abs(delta) > 0.02) drag.current.moved = true;
    state.current.open = Math.min(1, Math.max(0, drag.current.open + delta));
    applyShade();
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    // iPhone solo acepta el permiso de sensores al soltar el dedo
    requestMotionPermission();
    const { moved } = drag.current;
    drag.current = null;
    // Un toque sin arrastrar tambien la abre
    if (!moved || state.current.open > 0.35) open();
    else gsap.to(state.current, { open: 0, duration: 0.4, ease: 'power2.out', onUpdate: applyShade });
  };

  return (
    <div ref={stage} className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div data-intro-title className="mb-6 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.saveThe} alt="Save the" className="w-52 drop-shadow-lg sm:w-64" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.date} alt="Date" className="-mt-5 w-36 drop-shadow-lg sm:w-44" />
        <p className="mt-3 rounded bg-blue-950/70 px-3 py-1 text-sm font-medium tracking-wide text-white">{subtitle}</p>
      </div>

      {/* Ventanilla */}
      <div style={{ perspective: 1100 }}>
        <div data-float>
          <div ref={tilt} className="relative w-[min(68vw,290px)]" style={{ transformStyle: 'preserve-3d', aspectRatio: '3 / 4' }}>
            {/* Marco exterior (plastico de la cabina) */}
            <div
              className="absolute inset-0 p-[8%]"
              style={{
                borderRadius: WINDOW_RADIUS,
                background: 'linear-gradient(150deg, #ffffff 0%, #e8edf3 35%, #c5cfdc 75%, #aab6c6 100%)',
                boxShadow:
                  '0 50px 90px -25px rgba(2,6,23,0.65), 0 18px 30px -12px rgba(2,6,23,0.35), inset 0 3px 2px #ffffff, inset 0 -10px 18px rgba(71,85,105,0.35)',
              }}
            >
              {/* Bisel interior */}
              <div
                className="h-full w-full p-[4%]"
                style={{
                  borderRadius: WINDOW_RADIUS,
                  background: 'linear-gradient(160deg, #94a3b8 0%, #f1f5f9 35%, #e2e8f0 60%, #8a99ad 100%)',
                  boxShadow: 'inset 0 10px 20px rgba(15,23,42,0.45), 0 2px 0 rgba(255,255,255,0.8)',
                }}
              >
                {/* Vista al cielo */}
                <div
                  ref={view}
                  className="relative h-full w-full touch-none overflow-hidden"
                  style={{ borderRadius: WINDOW_RADIUS, background: 'linear-gradient(180deg, #1d4ed8 0%, #3b82f6 35%, #93c5fd 75%, #dbeafe 100%)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ASSETS.cloud} alt="" className="absolute -left-1/4 bottom-[-8%] w-[150%] max-w-none opacity-90" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ASSETS.cloud} alt="" className="absolute -right-1/3 top-[12%] w-[90%] max-w-none opacity-50" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={one}
                    src={ASSETS.cloudOne}
                    alt="1"
                    className="absolute left-1/2 top-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2 opacity-0 drop-shadow-[0_10px_20px_rgba(30,58,138,0.35)]"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img ref={plane} src={ASSETS.plane} alt="" className="absolute left-0 top-[38%] w-[62%] max-w-none opacity-0 drop-shadow-[0_12px_14px_rgba(15,23,42,0.35)]" />

                  {/* Persiana */}
                  <div
                    ref={shade}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="absolute inset-0 z-10 cursor-grab touch-none select-none active:cursor-grabbing"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(15,23,42,0.18), transparent 18%, transparent 82%, rgba(15,23,42,0.18)), repeating-linear-gradient(180deg, #f8fafc 0px, #f1f5f9 13px, #dbe2ea 14px, #f8fafc 15px)',
                      boxShadow: 'inset 0 -6px 0 #cbd5e1, 0 6px 14px rgba(15,23,42,0.35)',
                    }}
                    role="button"
                    aria-label="Sube la persiana para abrir tu invitación"
                  >
                    <div className="absolute bottom-[5%] left-1/2 flex h-4 w-[34%] -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-b from-slate-200 to-slate-400 shadow-[inset_0_1px_1px_white,0_2px_4px_rgba(15,23,42,0.35)]">
                      <span className="h-1 w-1/2 rounded-full bg-slate-500/50" />
                    </div>
                  </div>

                  {/* Reflejo del vidrio + sombra interior */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20"
                    style={{
                      borderRadius: WINDOW_RADIUS,
                      background: 'linear-gradient(125deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 30%, transparent 45%, transparent 70%, rgba(255,255,255,0.12) 85%)',
                      boxShadow: 'inset 0 0 28px rgba(15,23,42,0.5)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={hint} data-intro-hint className="mt-8 flex flex-col items-center text-white">
        <ChevronsUp data-hint-arrow className="h-7 w-7" />
        <p className="text-sm font-medium tracking-wide">Sube la persiana para abrir tu invitación</p>
        <p className="mt-1 text-xs text-white/70">🔊 Sube el volumen para una mejor experiencia</p>
      </div>

      <button
        type="button"
        onClick={() => {
          unlockAudio();
          requestMotionPermission();
          finish();
        }}
        className="absolute bottom-5 right-5 text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
        Saltar
      </button>
    </div>
  );
}
