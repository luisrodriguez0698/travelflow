'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import gsap from 'gsap';
import { Lock } from 'lucide-react';
import { ASSETS, TZ } from './assets';
import { onTilt } from './device-motion';
import type { InvitationEvent, InvitationGuest } from '@/lib/special-events';

// Pase de abordar en 3D: sale "impreso" de una ranura, se inclina con el mouse,
// tiene brillo holografico y, al confirmar, le cae el sello de CONFIRMADO y se
// activa el QR del talon.

export interface BoardingPassHandle {
  stamp: () => void;
}

function passDate(iso: string) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('es-MX', { weekday: 'short', timeZone: TZ }).replace('.', '');
  const day = d.toLocaleDateString('es-MX', { day: '2-digit', timeZone: TZ });
  const month = d.toLocaleDateString('es-MX', { month: 'short', timeZone: TZ }).replace('.', '');
  return `${weekday} ${day} ${month}`.toUpperCase();
}

function passTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }).toUpperCase().replace(/\s?([AP])\.?\s?M\.?/, ' $1M');
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

interface Props {
  event: InvitationEvent;
  guest: InvitationGuest;
  confirmed: boolean;
  qr: string | null;
  /** Animacion de impresion al aparecer. */
  print?: boolean;
  /** false = esperar (p. ej. hasta que el pase entre en pantalla) para imprimirlo. */
  active?: boolean;
}

export const BoardingPass = forwardRef<BoardingPassHandle, Props>(function BoardingPass({ event, guest, confirmed, qr, print = true, active = true }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const holo = useRef<HTMLDivElement>(null);
  const stampEl = useRef<HTMLDivElement>(null);
  const qrEl = useRef<HTMLDivElement>(null);
  const [printed, setPrinted] = useState(!print);

  // Impresion: el pase sale suave de la ranura (con una ligera curva de papel),
  // se asienta y le pasa un destello de luz
  useEffect(() => {
    if (!print || !card.current) return;
    const ctx = gsap.context(() => {
      // Aun no le toca: queda escondido dentro de la ranura
      if (!active) {
        gsap.set(card.current, { yPercent: -102 });
        return;
      }
      gsap
        .timeline({ delay: 0.3, onComplete: () => setPrinted(true) })
        .fromTo(
          card.current,
          { yPercent: -102, rotationX: -14, transformOrigin: '50% 0%' },
          { yPercent: 0, rotationX: 0, duration: 2.1, ease: 'power3.out' }
        )
        .to(card.current, { y: 5, duration: 0.25, ease: 'sine.out' }, '-=0.35')
        .to(card.current, { y: 0, duration: 0.5, ease: 'sine.inOut' })
        .to('[data-slot]', { opacity: 0, scaleX: 0.9, duration: 0.5 }, '<')
        .fromTo('[data-glint]', { xPercent: -120, opacity: 1 }, { xPercent: 220, duration: 1.1, ease: 'power2.inOut' }, '<');
    }, wrap);
    return () => ctx.revert();
  }, [print, active]);

  // Inclinacion 3D + brillo holografico que sigue al mouse/dedo
  useEffect(() => {
    if (!printed || !card.current || !holo.current) return;
    const el = card.current;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    const hx = gsap.quickTo(holo.current, '--hx', { duration: 0.6, ease: 'power3' });
    const hy = gsap.quickTo(holo.current, '--hy', { duration: 0.6, ease: 'power3' });

    // Brillo que pasa solo cada cierto tiempo (en celular no hay mouse)
    const idle = gsap.to(holo.current, { '--hx': 100, duration: 3.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x < -0.3 || x > 1.3 || y < -0.3 || y > 1.3) return;
      idle.pause();
      ry((x - 0.5) * 16);
      rx(-(y - 0.5) * 12);
      hx(x * 100);
      hy(y * 100);
    };
    const onLeave = () => {
      rx(0);
      ry(0);
      idle.resume();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    // En celular: inclinar el telefono mueve el pase y su brillo
    const offTilt = onTilt((x, y) => {
      idle.pause();
      ry(x * 14);
      rx(-y * 10);
      hx(50 + x * 50);
      hy(50 + y * 50);
    });
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      offTilt();
      idle.kill();
    };
  }, [printed]);

  // QR que aparece al confirmar
  useEffect(() => {
    if (!confirmed || !qr || !qrEl.current) return;
    gsap.fromTo(qrEl.current, { scale: 0.6, opacity: 0, filter: 'blur(8px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'back.out(1.6)' });
  }, [confirmed, qr]);

  useImperativeHandle(ref, () => ({
    stamp: () => {
      if (!stampEl.current || !card.current) return;
      gsap
        .timeline()
        .fromTo(stampEl.current, { scale: 2.8, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: -14, duration: 0.32, ease: 'power4.in' })
        .to(card.current, { x: -5, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' })
        .to(card.current, { x: 0, duration: 0.05 });
    },
  }));

  return (
    <div ref={wrap} className="relative mx-auto w-full max-w-[380px]">
      {/* Ranura de la impresora */}
      {print && !printed && (
        <div data-slot className="relative z-10 mx-auto h-3 w-[104%] -translate-x-[2%] rounded-full bg-gradient-to-b from-slate-950 to-slate-700 shadow-[0_2px_6px_rgba(2,6,23,0.6)]" />
      )}

      <div className={printed ? '' : 'overflow-hidden'} style={{ perspective: 1200 }}>
        <div ref={card} className="relative" style={{ transformStyle: 'preserve-3d' }}>
          <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-20px_rgba(2,6,23,0.6)]">
            {/* Banda superior */}
            <div className="relative flex items-center justify-between bg-gradient-to-r from-blue-900 via-blue-700 to-sky-500 px-5 py-4 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.logo} alt={event.agency.name} className="h-9 object-contain" />
              <div className="text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/70">Pase de abordar</p>
                <p className="text-sm font-black tracking-widest">PRIMERA CLASE</p>
              </div>
            </div>

            {/* Datos */}
            <div className="px-5 pb-5 pt-5">
              <p className="text-2xl font-black tracking-tight text-blue-900">{guest.name}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Invitado especial</p>

              <div className="mt-4 rounded-2xl border border-blue-950/10 bg-blue-950/[0.06] p-4 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08)] backdrop-blur-md">
                <div className="grid grid-cols-3 gap-x-3">
                  <Field label="Fecha" value={passDate(event.startsAt)} />
                  <Field label="Hora" value={passTime(event.startsAt)} />
                  <Field
                    label="Operador"
                    value={
                      guest.supplier ? (
                        guest.supplier.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={guest.supplier.logo} alt={guest.supplier.name} className="mt-0.5 h-7 max-w-[90px] object-contain" />
                        ) : (
                          guest.supplier.name
                        )
                      ) : (
                        event.agency.name
                      )
                    }
                  />
                </div>
                {event.dressCode && <Field label="Vestimenta" value={event.dressCode} className="mt-3 border-t border-slate-200/70 pt-3" />}
              </div>
            </div>

            {/* Perforacion */}
            <div className="relative h-6">
              <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-blue-950/60" />
              <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-blue-950/60" />
              <div className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-slate-200" />
            </div>

            {/* Talon con QR */}
            <div className="flex items-center gap-4 px-5 pb-5 pt-2">
              <div className="relative h-28 w-28 shrink-0 rounded-xl border border-slate-200 bg-white p-1.5">
                {confirmed && qr ? (
                  <div ref={qrEl}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="Código de acceso" className="h-full w-full" />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[repeating-linear-gradient(45deg,#f1f5f9_0_6px,#e2e8f0_6px_12px)] text-slate-400">
                    <Lock className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Código de acceso</p>
                <p className="mt-1 text-sm font-semibold leading-snug text-slate-700">
                  {confirmed ? 'Muestra este código en la entrada. ¡Te esperamos!' : 'Confirma tu asistencia para activar tu pase.'}
                </p>
              </div>
            </div>

            {/* Destello al terminar de imprimir */}
            <div
              data-glint
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-0"
              style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.75), transparent)' }}
            />

            {/* Brillo holografico */}
            <div
              ref={holo}
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={
                {
                  '--hx': 30,
                  '--hy': 30,
                  background:
                    'radial-gradient(circle at calc(var(--hx) * 1%) calc(var(--hy) * 1%), rgba(255,255,255,0.75), transparent 45%), linear-gradient(115deg, transparent 25%, rgba(56,189,248,0.35) 40%, rgba(244,114,182,0.25) 50%, rgba(250,204,21,0.25) 60%, transparent 75%)',
                  backgroundSize: '100% 100%, 250% 250%',
                  backgroundPosition: '0 0, calc(var(--hx) * 1%) calc(var(--hy) * 1%)',
                } as React.CSSProperties
              }
            />

            {/* Sello */}
            <div
              ref={stampEl}
              className="pointer-events-none absolute right-6 top-[46%] rounded-xl border-[5px] border-double border-emerald-600 px-3 py-1 text-2xl font-black tracking-widest text-emerald-600"
              style={{ opacity: confirmed ? 0.85 : 0, transform: 'rotate(-14deg)', mixBlendMode: 'multiply' }}
            >
              CONFIRMADO
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
