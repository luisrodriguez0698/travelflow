'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Loader2, Plane, Smartphone, Volume2 } from 'lucide-react';
import { ASSETS } from './assets';
import { sparkle, unlockAudio } from './sound';
import { isTouchDevice, motionNeedsPermission, requestMotionPermission } from './device-motion';

// Bienvenida antes de la ventanilla: pide subir el volumen y, en iPhone, prepara
// el aviso del sistema para el sensor de movimiento (ese aviso no se puede
// personalizar, pero asi aparece aqui y no a mitad de la experiencia).
// Su boton es ademas el toque que el navegador exige para permitir el sonido.

export function WelcomeGate({ onEnter, eventName }: { onEnter: () => void; eventName: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [needsMotion, setNeedsMotion] = useState(false);
  const [touch, setTouch] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNeedsMotion(motionNeedsPermission());
    setTouch(isTouchDevice());
    const ctx = gsap.context(() => {
      gsap.from('[data-gate]', { y: 30, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
      gsap.to('[data-gate-plane]', { y: -8, rotation: -6, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      // Barras del ecualizador junto a "sube el volumen"
      gsap.utils.toArray<HTMLElement>('[data-eq]').forEach((bar, i) => {
        gsap.fromTo(bar, { scaleY: 0.3 }, { scaleY: 1, duration: 0.35 + i * 0.12, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const enter = async (withMotion: boolean) => {
    unlockAudio();
    sparkle();
    if (withMotion && needsMotion) {
      setBusy(true);
      await requestMotionPermission();
      setBusy(false);
    } else if (withMotion) {
      requestMotionPermission();
    }
    gsap.to(root.current, { opacity: 0, scale: 1.04, duration: 0.45, ease: 'power2.in', onComplete: onEnter });
  };

  return (
    <div ref={root} className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-12 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-gate src={ASSETS.logo} alt="" className="w-40 drop-shadow-lg" />

      <div data-gate className="mt-8 w-full max-w-sm rounded-3xl border border-white/20 bg-blue-950/35 p-6 text-center shadow-[0_20px_50px_-20px_rgba(2,6,23,0.6)] backdrop-blur-xl">
        <div data-gate-plane className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-lg">
          <Plane className="h-7 w-7 -rotate-45" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Antes de abordar</p>
        <h1 className="mt-1 text-2xl font-black leading-tight">Tu invitación está lista ✨</h1>
        <p className="mt-1 text-sm text-white/75">{eventName}</p>

        <div className="mt-6 space-y-3 text-left">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Volume2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Sube el volumen 🔊</p>
              <p className="text-xs text-white/70">Para una mejor experiencia</p>
            </div>
            <span className="flex h-6 items-end gap-0.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} data-eq className="block w-1 rounded-full bg-sky-300" style={{ height: `${10 + i * 4}px` }} />
              ))}
            </span>
          </div>
          {touch && (
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">Mueve tu celular 📱</p>
                <p className="text-xs text-white/70">
                  {needsMotion ? 'Cuando tu celular lo pregunte, toca “Permitir”.' : 'Inclínalo y agítalo durante la invitación.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => enter(true)}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-base font-black text-blue-700 shadow-lg transition-transform active:scale-95 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plane className="h-5 w-5 -rotate-45" />}
          Abrir mi invitación
        </button>
        {needsMotion && (
          <button type="button" onClick={() => enter(false)} className="mt-3 text-xs text-white/60 underline underline-offset-2">
            Continuar sin movimiento
          </button>
        )}
      </div>
    </div>
  );
}
