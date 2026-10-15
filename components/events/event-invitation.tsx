'use client';

// Invitacion virtual: ventanilla con persiana -> check-in con telefono -> pase de
// abordar personal (confirmar, QR, calendario, mapas). Animaciones con GSAP.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { CalendarPlus, Download, Loader2, MapPin, Navigation, PartyPopper, Plane, Shirt, Volume2, VolumeX, X } from 'lucide-react';
import { toast } from 'sonner';
import { COUNTRIES, DEFAULT_COUNTRY, formatPhone } from '@/lib/phone';
import type { InvitationEvent, InvitationGuest } from '@/lib/special-events';
import { ASSETS, DEFAULT_MESSAGE, TZ } from './invitation/assets';
import { Sky } from './invitation/sky';
import { WindowIntro } from './invitation/window-intro';
import { BoardingPass, type BoardingPassHandle } from './invitation/boarding-pass';
import { FlapCountdown } from './invitation/flap-countdown';
import { celebrate } from './invitation/celebrate';
import { passImage } from './invitation/pass-image';
import { chime, isMuted, setMuted, unlockAudio } from './invitation/sound';

function fmtDay(iso: string) {
  const day = new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  return day.charAt(0).toUpperCase() + day.slice(1);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}

/** Archivo .ics para agregar el evento al calendario del celular (3 h de duracion). */
function icsFile(event: InvitationEvent) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const esc = (v: string) => v.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const location = [event.venueName, event.address].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelFlow//Eventos//ES',
    'BEGIN:VEVENT',
    `UID:${event.id}@travelflow`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.name)}`,
    location ? `LOCATION:${esc(location)}` : '',
    `DESCRIPTION:${esc(`Invitación de ${event.agency.name}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function downloadBlob(content: Blob, name: string) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

const glass = 'rounded-3xl border border-white/20 bg-white/10 shadow-[0_20px_50px_-20px_rgba(2,6,23,0.6)] backdrop-blur-md';

function SoundToggle() {
  const [muted, setState] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        setMuted(!isMuted());
        setState(isMuted());
      }}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
      aria-label={muted ? 'Activar sonido' : 'Silenciar'}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}

// ── Check-in: el invitado escribe su telefono ───────────────────────────────
function CheckIn({ event, invalidPass }: { event: InvitationEvent; invalidPass: boolean }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLFormElement>(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY.code);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(invalidPass ? 'Tu link no es válido. Escribe tu teléfono para encontrar tu invitación.' : '');
  const [loading, setLoading] = useState(false);
  const c = COUNTRIES.find((x) => x.code === country) ?? DEFAULT_COUNTRY;

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-in]', { y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' });
    }, root);
    return () => ctx.revert();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/evento/${event.id}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatPhone(c, digits) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No encontramos tu invitación');
        if (card.current) gsap.fromTo(card.current, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      router.replace(`?pase=${encodeURIComponent(data.token)}`);
      router.refresh();
    } catch {
      setError('Sin conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={root} className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-in src={ASSETS.logo} alt={event.agency.name} className="w-44 drop-shadow-lg" />
      <p data-in className="mt-6 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">Invitación especial</p>
      <h1 data-in className="mt-2 max-w-md text-center text-3xl font-black leading-tight text-white drop-shadow sm:text-4xl">
        {event.name}
      </h1>
      <p data-in className="mt-2 text-white/85">
        {fmtDay(event.startsAt)} · {fmtTime(event.startsAt)}
      </p>

      <form data-in ref={card} onSubmit={submit} className={`mt-8 w-full max-w-sm p-6 text-white ${glass}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow">
            <Plane className="h-5 w-5 -rotate-45" />
          </span>
          <div>
            <p className="font-bold">Documenta tu llegada</p>
            <p className="text-xs text-white/75">Escribe el teléfono con el que te invitamos</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="País"
            className="h-12 rounded-xl border border-white/25 bg-white/15 px-2 text-sm font-semibold text-white outline-none focus:border-white [&>option]:text-slate-900"
          >
            {COUNTRIES.map((x) => (
              <option key={x.code} value={x.code}>
                {x.code} +{x.dial}
              </option>
            ))}
          </select>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, c.max))}
            placeholder={'0'.repeat(c.max).replace(/0/g, '•')}
            aria-label="Número de teléfono"
            className="h-12 min-w-0 flex-1 rounded-xl border border-white/25 bg-white/15 px-4 text-lg font-semibold tracking-widest text-white placeholder:text-white/40 outline-none focus:border-white"
          />
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-500/25 px-3 py-2 text-sm text-white">{error}</p>}
        <button
          type="submit"
          disabled={loading || digits.length < c.min}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-blue-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plane className="h-5 w-5 -rotate-45" />}
          Ver mi pase de abordar
        </button>
      </form>
    </div>
  );
}

// ── Invitacion personal ─────────────────────────────────────────────────────
function GuestView({ event, guest }: { event: InvitationEvent; guest: InvitationGuest }) {
  const root = useRef<HTMLDivElement>(null);
  const pass = useRef<BoardingPassHandle>(null);
  const [status, setStatus] = useState(guest.status);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [saving, setSaving] = useState<'CONFIRMED' | 'DECLINED' | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const closed = event.closedReason;
  const firstName = guest.name.split(/\s+/)[0];
  const confirmed = status === 'CONFIRMED';

  const passUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}?pase=${encodeURIComponent(guest.token)}`),
    [guest.token]
  );

  useEffect(() => {
    if (!confirmed || !passUrl) return;
    QRCode.toDataURL(passUrl, { width: 520, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e3a8a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [confirmed, passUrl]);

  // Entrada de la pantalla y globos que flotan junto al saludo
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-hero] > *', { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' });
      gsap.from('[data-balloon]', { y: 200, opacity: 0, duration: 1.6, stagger: 0.25, ease: 'power2.out' });
      gsap.to('[data-balloon]', { y: '-=14', rotation: 4, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.6, delay: 1.6 });
    }, root);
    return () => ctx.revert();
  }, []);

  // Al confirmar: sello, globos y ding-dong
  useEffect(() => {
    if (!justConfirmed) return;
    pass.current?.stamp();
    chime();
    celebrate();
  }, [justConfirmed]);

  const respond = useCallback(
    async (response: 'CONFIRMED' | 'DECLINED') => {
      unlockAudio();
      setSaving(response);
      try {
        const res = await fetch(`/api/evento/${event.id}/rsvp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: guest.token, response, note: response === 'DECLINED' ? note : null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || 'No se pudo guardar tu respuesta');
          return;
        }
        setStatus(response);
        setDeclining(false);
        setJustConfirmed(response === 'CONFIRMED');
      } catch {
        toast.error('Sin conexión. Intenta de nuevo.');
      } finally {
        setSaving(null);
      }
    },
    [event.id, guest.token, note]
  );

  const savePass = async () => {
    if (!qr) return;
    setSavingImage(true);
    try {
      const blob = await passImage(event, guest, qr);
      if (blob) downloadBlob(blob, `pase-${firstName.toLowerCase()}.png`);
    } finally {
      setSavingImage(false);
    }
  };

  const message = event.message || DEFAULT_MESSAGE;

  return (
    <div ref={root} className="relative mx-auto w-full max-w-xl px-4 pb-16 pt-16">
      {/* Globos decorativos */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-balloon src={ASSETS.balloonBlue} alt="" aria-hidden className="pointer-events-none absolute -left-2 top-24 w-16 opacity-90 sm:-left-16 sm:w-24" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-balloon src={ASSETS.balloonSilver} alt="" aria-hidden className="pointer-events-none absolute -right-2 top-10 w-14 opacity-90 sm:-right-14 sm:w-20" />

      <div data-hero className="relative text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.logo} alt={event.agency.name} className="mx-auto w-40 drop-shadow-lg" />
        <p className="mt-6 text-lg text-white/90">¡Hola, {firstName}! ✈️</p>
        <p className="mt-1 text-sm uppercase tracking-[0.3em] text-sky-200">Tienes un lugar reservado en</p>
        <h1 className="mt-2 text-3xl font-black leading-tight drop-shadow sm:text-4xl">{event.name}</h1>
        <p className="mt-2 text-white/85">
          {fmtDay(event.startsAt)} · {fmtTime(event.startsAt)}
        </p>
      </div>

      {/* Pase */}
      <div className="mt-8">
        <BoardingPass ref={pass} event={event} guest={guest} confirmed={confirmed} qr={qr} />
      </div>

      {/* Respuesta */}
      <div className="mt-6">
        {confirmed && !declining ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => downloadBlob(new Blob([icsFile(event)], { type: 'text/calendar' }), 'evento.ics')}
                className={`flex h-12 items-center justify-center gap-2 text-sm font-semibold text-white transition hover:bg-white/20 ${glass}`}
              >
                <CalendarPlus className="h-4 w-4" />
                Agendar
              </button>
              <button
                type="button"
                onClick={savePass}
                disabled={!qr || savingImage}
                className={`flex h-12 items-center justify-center gap-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 ${glass}`}
              >
                {savingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Guardar pase
              </button>
            </div>
            {!closed && !guest.checkedIn && (
              <button type="button" onClick={() => setDeclining(true)} className="mx-auto block text-xs text-white/60 underline underline-offset-2 hover:text-white">
                Ya no podré asistir
              </button>
            )}
          </div>
        ) : status === 'DECLINED' && !declining ? (
          <div className={`p-5 text-center text-white ${glass}`}>
            <p>Gracias por avisarnos, {firstName}. ¡Te vamos a extrañar! 💙</p>
            {!closed && (
              <button
                type="button"
                onClick={() => respond('CONFIRMED')}
                disabled={!!saving}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-blue-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PartyPopper className="h-4 w-4" />}
                ¡Siempre sí podré ir!
              </button>
            )}
          </div>
        ) : closed ? (
          <p className={`p-4 text-center text-sm text-white ${glass}`}>{closed}</p>
        ) : declining ? (
          <div className={`space-y-3 p-5 text-white ${glass}`}>
            <p className="font-semibold">¿Nos dejas un mensaje? (opcional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Escribe aquí…"
              className="w-full rounded-xl border border-white/25 bg-white/10 p-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeclining(false)} className="h-11 rounded-xl border border-white/30 text-sm font-semibold">
                Volver
              </button>
              <button
                type="button"
                onClick={() => respond('DECLINED')}
                disabled={!!saving}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/90 text-sm font-bold text-slate-800 disabled:opacity-60"
              >
                {saving === 'DECLINED' && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <motion.button
              type="button"
              onClick={() => respond('CONFIRMED')}
              disabled={!!saving}
              whileTap={{ scale: 0.96 }}
              animate={{ boxShadow: ['0 0 0 0 rgba(255,255,255,0.55)', '0 0 0 14px rgba(255,255,255,0)'] }}
              transition={{ boxShadow: { duration: 1.8, repeat: Infinity } }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-lg font-black text-blue-700 disabled:opacity-70"
            >
              {saving === 'CONFIRMED' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plane className="h-5 w-5 -rotate-45" />}
              Confirmar mi abordaje
            </motion.button>
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
              No podré asistir
            </button>
          </div>
        )}
      </div>

      {/* Cuenta regresiva */}
      <Reveal className={`mt-8 p-5 text-center ${glass}`}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Salida programada en</p>
        <FlapCountdown to={event.startsAt} />
      </Reveal>

      {/* Mensaje */}
      <Reveal className={`relative mt-5 overflow-hidden p-6 text-white ${glass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.icon} alt="" aria-hidden className="pointer-events-none absolute -right-6 -top-4 w-32 opacity-15" />
        <p className="relative whitespace-pre-line text-[15px] leading-relaxed text-white/90">{message}</p>
        <p className="relative mt-4 text-sm font-semibold text-sky-200">Con cariño, {event.agency.name} 💙</p>
      </Reveal>

      {/* Lugar */}
      {(event.venueName || event.address || event.dressCode || event.googleMapsUrl || event.appleMapsUrl) && (
        <Reveal className={`mt-5 space-y-4 p-6 text-white ${glass}`}>
          {(event.venueName || event.address) && (
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                {event.venueName && <p className="font-bold">{event.venueName}</p>}
                {event.address && <p className="text-sm text-white/80">{event.address}</p>}
              </div>
            </div>
          )}
          {event.dressCode && (
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Shirt className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">Vestimenta</p>
                <p className="font-semibold">{event.dressCode}</p>
              </div>
            </div>
          )}
          {(event.googleMapsUrl || event.appleMapsUrl) && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {event.googleMapsUrl && (
                <a
                  href={event.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-blue-700"
                >
                  <Navigation className="h-4 w-4" />
                  Google Maps
                </a>
              )}
              {event.appleMapsUrl && (
                <a
                  href={event.appleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/40 text-sm font-bold text-white"
                >
                  <Navigation className="h-4 w-4" />
                  Mapas de Apple
                </a>
              )}
            </div>
          )}
        </Reveal>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.logo} alt="" aria-hidden className="mx-auto mt-12 w-28 opacity-70" />
    </div>
  );
}

export function EventInvitation({
  event,
  guest,
  invalidPass,
}: {
  event: InvitationEvent;
  guest: InvitationGuest | null;
  invalidPass: boolean;
}) {
  const introKey = `tf-ev-intro-${event.id}`;
  // La ventanilla se ve una vez por visita (al volver con su link ya no se repite)
  const [phase, setPhase] = useState<'boot' | 'intro' | 'main'>('boot');

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(introKey) === '1';
    } catch {
      // sin almacenamiento: siempre se muestra
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(seen || reduce ? 'main' : 'intro');
  }, [introKey]);

  const endIntro = useCallback(() => {
    try {
      sessionStorage.setItem(introKey, '1');
    } catch {
      // ignorar
    }
    setPhase('main');
  }, [introKey]);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden text-white">
      <Sky />
      <SoundToggle />
      <div className="relative z-10">
        {phase === 'intro' && <WindowIntro onDone={endIntro} subtitle={event.name} />}
        {phase === 'main' &&
          (guest ? <GuestView key={guest.token} event={event} guest={guest} /> : <CheckIn event={event} invalidPass={invalidPass} />)}
      </div>
    </div>
  );
}
