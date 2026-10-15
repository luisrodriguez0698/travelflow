'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Bus,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  History,
  Hotel,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Star,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { AnimatedNumber } from '@/components/animated-number';
import { daysUntil } from '@/lib/fixed-expense-rules';
import type { PortalData, PortalTrip } from '@/lib/client-portal';
import { cn } from '@/lib/utils';

type Data = NonNullable<PortalData>;
type Trip = Omit<PortalTrip, 'pinRequired'>;

const TZ = 'America/Mexico_City';
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('es-MX', { ...opts, timeZone: TZ });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

/** Etapas del progreso de pago (mensaje para animar a seguir pagando). */
const MILESTONES = [
  { at: 0, icon: '💳', label: 'Reservado' },
  { at: 25, icon: '🗺️', label: 'Planeando' },
  { at: 50, icon: '🧳', label: 'Maletas' },
  { at: 75, icon: '🕶️', label: 'Últimos detalles' },
  { at: 100, icon: '🏝️', label: '¡A viajar!' },
];

function stageMessage(progress: number, destination: string | null) {
  const place = destination ? ` a ${destination}` : '';
  if (progress >= 100) return { title: '¡Tu viaje está pagado! 🎉', text: 'Todo listo. Ahora solo falta disfrutar ✈️' };
  if (progress >= 75) return { title: '¡Ya casi! 😎', text: 'Alista el bloqueador y los lentes de sol: tu viaje está a la vuelta de la esquina.' };
  if (progress >= 50) return { title: '¡Más de la mitad! 🧳', text: `Ve sacando la maleta, cada abono te acerca más${place}.` };
  if (progress >= 25) return { title: '¡Vas muy bien! 🙌', text: `Ya llevas una buena parte de tu viaje${place}.` };
  return { title: '¡Tu aventura ya comenzó! ✨', text: `Cada abono te acerca más${place}.` };
}

function whatsappLink(phone: string | null | undefined, text: string) {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = `52${digits}`;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value.replace(/\s/g, '')).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

const group = (v: string, size: number) => v.replace(/\D/g, '').replace(new RegExp(`(\\d{${size}})(?=\\d)`, 'g'), '$1 ');

// ── Barra de progreso con el avion ──────────────────────────────────────────
function PaymentProgress({ data }: { data: Data }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const stage = stageMessage(data.progress, data.destination);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!inView || data.progress < 100 || celebrated.current) return;
    celebrated.current = true;
    const colors = ['#0ea5e9', '#22d3ee', '#fbbf24', '#f472b6', '#34d399'];
    const fire = (x: number) => confetti({ particleCount: 90, spread: 75, startVelocity: 45, origin: { x, y: 0.6 }, colors });
    setTimeout(() => fire(0.25), 1300);
    setTimeout(() => fire(0.75), 1500);
    setTimeout(() => confetti({ particleCount: 160, spread: 120, origin: { y: 0.45 }, colors }), 1900);
  }, [inView, data.progress]);

  return (
    <div ref={ref} className="rounded-3xl bg-white p-5 sm:p-7 shadow-xl shadow-sky-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg sm:text-xl font-bold text-slate-800">{stage.title}</p>
          <p className="text-sm text-slate-500 mt-1">{stage.text}</p>
        </div>
        <p className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-sky-500 to-teal-400 bg-clip-text text-transparent tabular-nums">
          {inView ? <AnimatedNumber value={data.progress} duration={1.6} /> : 0}%
        </p>
      </div>

      {/* Pista con avion */}
      <div className="relative mt-8 mb-3 h-4 rounded-full bg-slate-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400"
          initial={{ width: 0 }}
          animate={inView ? { width: `${data.progress}%` } : {}}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="absolute -top-5"
          initial={{ left: '0%' }}
          animate={inView ? { left: `${data.progress}%` } : {}}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ x: '-50%' }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="w-10 h-10 rounded-full bg-white shadow-lg shadow-sky-500/30 border-2 border-sky-400 flex items-center justify-center text-sky-500"
          >
            <Plane className="w-5 h-5 rotate-45" />
          </motion.div>
        </motion.div>
      </div>

      {/* Etapas */}
      <div className="grid grid-cols-5 gap-1 mt-6">
        {MILESTONES.map((m, i) => {
          const reached = data.progress >= m.at;
          return (
            <motion.div
              key={m.at}
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="flex flex-col items-center text-center"
            >
              <motion.span
                animate={reached && inView ? { scale: [1, 1.25, 1] } : {}}
                transition={{ delay: 0.6 + i * 0.25, duration: 0.5 }}
                className={cn('text-2xl sm:text-3xl transition-all', !reached && 'grayscale opacity-30')}
              >
                {m.icon}
              </motion.span>
              <span className={cn('text-[10px] sm:text-xs mt-1 leading-tight', reached ? 'text-slate-700 font-medium' : 'text-slate-400')}>
                {m.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">Has pagado</p>
          <p className="text-xl font-bold text-emerald-700">{money(data.paid)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{data.remaining > 0 ? 'Te falta' : 'Total del viaje'}</p>
          <p className="text-xl font-bold text-slate-800">{money(data.remaining > 0 ? data.remaining : data.total)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Carrusel de fotos del hotel ─────────────────────────────────────────────
function PhotoCarousel({ images, name }: { images: string[]; name: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    const timer = setInterval(() => api.scrollNext(), 4500);
    return () => {
      api.off('select', onSelect);
      clearInterval(timer);
    };
  }, [api]);

  if (!images.length) return null;
  return (
    <div className="relative">
      <Carousel setApi={setApi} opts={{ loop: true }}>
        <CarouselContent>
          {images.map((src, i) => (
            <CarouselItem key={src + i}>
              <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${name} ${i + 1}`} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      {images.length > 1 && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Foto ${i + 1}`}
              className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Hotel; title: string; children: React.ReactNode }) {
  return (
    <Reveal className="rounded-3xl bg-white p-5 sm:p-6 shadow-lg shadow-sky-900/5">
      <h2 className="flex items-center gap-2 font-bold text-slate-800 mb-4">
        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </h2>
      {children}
    </Reveal>
  );
}

// ── Selector de viajes (cuando el cliente tiene varios con link activo) ─────
function TripSwitcher({ trips, currentToken }: { trips: Trip[]; currentToken: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Deja visible el viaje actual aunque la lista sea larga
  useEffect(() => {
    setPending(null);
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentToken]);

  if (trips.length < 2) return null;
  const upcomingCount = trips.filter((t) => !t.past).length;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-5">
      <p className="text-xs font-medium text-white/80 mb-2">Tus viajes ({trips.length})</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trips.map((t, i) => {
          const active = t.token === currentToken;
          return (
            <div key={t.token} className="flex shrink-0 items-center gap-2">
              {i === upcomingCount && i > 0 && (
                <span className="flex items-center gap-1 pl-1 text-[11px] text-white/70">
                  <History className="h-3.5 w-3.5" />
                  Anteriores
                </span>
              )}
              <Link
                ref={active ? activeRef : undefined}
                href={`/v/${t.token}`}
                scroll
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  if (active) e.preventDefault();
                  else setPending(t.token);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-2xl px-3.5 py-2 text-left text-sm transition-all',
                  active ? 'bg-white text-sky-700 shadow-lg shadow-sky-900/20' : 'bg-white/15 text-white hover:bg-white/25',
                  t.past && !active && 'opacity-70'
                )}
              >
                {pending === t.token ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Plane className={cn('h-4 w-4 shrink-0 -rotate-45', active ? 'text-sky-500' : 'text-white/80')} />
                )}
                <span className="leading-tight">
                  <span className="block max-w-[11rem] truncate font-semibold">{t.destination || 'Mi viaje'}</span>
                  <span className={cn('block text-[11px]', active ? 'text-sky-600/80' : 'text-white/75')}>
                    {t.departureDate ? fmtDate(t.departureDate, { month: 'short', year: 'numeric' }) : 'Sin fecha'}
                  </span>
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Portal ──────────────────────────────────────────────────────────────────
export function TripPortal({ data, trips = [], currentToken = '' }: { data: Data; trips?: Trip[]; currentToken?: string }) {
  const firstName = data.clientName.split(/\s+/)[0];
  const days = data.departureDate ? daysUntil(data.departureDate) : null;
  const nextPayment = data.payments.find((p) => p.paidAmount < p.amount - 0.01);
  const nextDays = nextPayment ? daysUntil(nextPayment.dueDate) : null;
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const proofLink = whatsappLink(data.agency.phone, `Hola, soy ${data.clientName}. Te envío mi comprobante de pago del viaje (folio ${data.folio}).`);
  const helpLink = whatsappLink(data.agency.phone, `Hola, soy ${data.clientName}. Tengo una duda sobre mi viaje (folio ${data.folio}).`);

  return (
    <div className="min-h-[100dvh] bg-sky-50 text-slate-800">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-400 text-white pb-24 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/15 blur-2xl"
            style={{ width: 260 + i * 120, height: 100 + i * 40, top: `${20 + i * 35}%` }}
            initial={{ x: '-50vw' }}
            animate={{ x: '120vw' }}
            transition={{ duration: 45 + i * 20, repeat: Infinity, ease: 'linear', delay: i * 8 }}
          />
        ))}
        <div className="relative max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between">
            {data.agency.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.agency.logo} alt={data.agency.name} className="h-10 max-w-[160px] object-contain rounded-lg bg-white/90 p-1" />
            ) : (
              <span className="font-bold">{data.agency.name}</span>
            )}
            <span className="text-xs bg-white/20 rounded-full px-3 py-1">Folio {data.folio}</span>
          </div>

          <TripSwitcher trips={trips} currentToken={currentToken} />

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mt-8">
            <p className="text-white/90 text-lg">¡Hola, {firstName}! 👋</p>
            <h1 className="text-3xl sm:text-4xl font-black mt-1 leading-tight">
              {data.destination ? (
                <>
                  Tu viaje a <span className="whitespace-nowrap">{data.destination}</span>
                </>
              ) : (
                'Tu viaje'
              )}
            </h1>
            {data.departureDate && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm">
                <CalendarDays className="w-4 h-4" />
                {fmtDate(data.departureDate, { day: 'numeric', month: 'short' })}
                {data.returnDate && ` — ${fmtDate(data.returnDate, { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </p>
            )}
          </motion.div>

          {days !== null && days >= 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="mt-5 flex items-end gap-2"
            >
              <span className="text-5xl font-black tabular-nums">
                <AnimatedNumber value={days} duration={1.2} />
              </span>
              <span className="pb-2 text-white/90">{days === 0 ? '¡Hoy es el gran día! 🎉' : days === 1 ? 'día para tu viaje' : 'días para tu viaje'}</span>
            </motion.div>
          )}
        </div>
      </header>

      <main className="relative max-w-2xl mx-auto px-4 -mt-16 pb-12 space-y-5">
        <Reveal>
          <PaymentProgress data={data} />
        </Reveal>

        {/* Proximo pago */}
        {nextPayment && data.remaining > 0 && (
          <Reveal className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-400 p-5 text-white shadow-lg shadow-orange-500/20">
            <p className="text-sm text-white/90 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Tu próximo pago
            </p>
            <div className="flex items-end justify-between gap-3 mt-1">
              <p className="text-3xl font-black">{money(nextPayment.amount - nextPayment.paidAmount)}</p>
              <p className="text-right text-sm">
                {fmtDate(nextPayment.dueDate, { day: 'numeric', month: 'long' })}
                <br />
                <span className="text-white/90">
                  {nextDays === null ? '' : nextDays > 1 ? `en ${nextDays} días` : nextDays === 1 ? 'mañana' : nextDays === 0 ? 'hoy' : 'aún estás a tiempo 💛'}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.accounts.length > 0 && (
                <a href="#como-pagar" className="rounded-full bg-white text-orange-600 px-4 py-2 text-sm font-semibold">
                  ¿Cómo pagar?
                </a>
              )}
              {proofLink && (
                <a href={proofLink} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  Enviar comprobante
                </a>
              )}
            </div>
          </Reveal>
        )}

        {/* Cuentas para depositar */}
        {data.accounts.length > 0 && data.remaining > 0 && (
          <div id="como-pagar" className="scroll-mt-4">
            <Section icon={Landmark} title="¿Cómo pagar?">
              <div className="space-y-3">
                {data.accounts.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{a.bankName}</p>
                      <p className="text-xs text-slate-500">{a.holder}</p>
                    </div>
                    {a.clabe && (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-slate-500">CLABE</p>
                          <p className="font-mono font-semibold tracking-wide">{group(a.clabe, 3)}</p>
                        </div>
                        <CopyButton value={a.clabe} label="CLABE" />
                      </div>
                    )}
                    {a.cardNumber && (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            Tarjeta
                          </p>
                          <p className="font-mono font-semibold tracking-wide">{group(a.cardNumber, 4)}</p>
                        </div>
                        <CopyButton value={a.cardNumber} label="tarjeta" />
                      </div>
                    )}
                    {a.accountNumber && !a.clabe && !a.cardNumber && (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-slate-500">Cuenta</p>
                          <p className="font-mono font-semibold">{a.accountNumber}</p>
                        </div>
                        <CopyButton value={a.accountNumber} label="cuenta" />
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-slate-500">Al pagar, envíanos tu comprobante por WhatsApp para registrarlo y que tu barra avance 🚀</p>
              </div>
            </Section>
          </div>
        )}

        {/* Hoteles */}
        {data.hotels.map((h, i) => (
          <Section key={i} icon={Hotel} title={h.name}>
            <PhotoCarousel images={h.images} name={h.name} />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {h.stars > 0 && (
                <span className="inline-flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: h.stars }).map((_, k) => (
                    <Star key={k} className="w-4 h-4 fill-current" />
                  ))}
                </span>
              )}
              {h.destination && (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {h.destination}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {h.plan && <span className="rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-medium">{h.plan}</span>}
              {h.roomType && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{h.roomType}</span>}
              {h.nights && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{h.nights} noche{h.nights === 1 ? '' : 's'}</span>}
              {(h.adults > 0 || h.children > 0) && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {h.adults} adulto{h.adults === 1 ? '' : 's'}
                  {h.children > 0 && `, ${h.children} menor${h.children === 1 ? '' : 'es'}`}
                </span>
              )}
            </div>
            {(h.checkIn || h.checkOut) && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {h.checkIn && (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Check-in</p>
                    <p className="font-semibold">{h.checkIn}</p>
                  </div>
                )}
                {h.checkOut && (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Check-out</p>
                    <p className="font-semibold">{h.checkOut}</p>
                  </div>
                )}
              </div>
            )}
            {h.includes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Incluye</p>
                <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
                  {h.includes.map((x, k) => (
                    <li key={k} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {h.notIncludes.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">No incluye</p>
                <ul className="grid sm:grid-cols-2 gap-1.5 text-sm text-slate-500">
                  {h.notIncludes.map((x, k) => (
                    <li key={k} className="flex items-start gap-1.5">
                      <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {h.idRequirement && <p className="mt-3 text-xs text-slate-500 rounded-xl bg-amber-50 p-3">🪪 {h.idRequirement}</p>}
          </Section>
        ))}

        {/* Vuelos */}
        {data.flights.length > 0 && (
          <Section icon={Plane} title="Vuelos">
            <div className="space-y-3">
              {data.flights.map((f, i) => (
                <div key={i} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {f.airline || 'Vuelo'} {f.flightNumber && `· ${f.flightNumber}`}
                    </span>
                    <span>{f.direction === 'REGRESO' ? 'Regreso' : f.direction === 'IDA_Y_VUELTA' ? 'Ida y vuelta' : 'Ida'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 font-bold text-lg">
                    <span>{f.origin || '—'}</span>
                    <Plane className="w-4 h-4 text-sky-500 rotate-45" />
                    <span>{f.destination || '—'}</span>
                  </div>
                  {f.departureTime && (
                    <p className="text-sm text-slate-500 mt-1">
                      {fmtDate(f.departureTime, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(f.departureTime)}
                      {f.arrivalTime && ` → ${fmtTime(f.arrivalTime)}`}
                    </p>
                  )}
                  {f.returnDepartureTime && (
                    <p className="text-sm text-slate-500">
                      Regreso: {fmtDate(f.returnDepartureTime, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtTime(f.returnDepartureTime)}
                      {f.returnArrivalTime && ` → ${fmtTime(f.returnArrivalTime)}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tours y transporte */}
        {(data.tours.length > 0 || data.transfers.length > 0) && (
          <Section icon={MapPin} title="Experiencias y traslados">
            <div className="space-y-2">
              {data.tours.map((t, i) => (
                <div key={`t${i}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="text-xl">🗺️</span>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {t.date ? fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Fecha por confirmar'}
                      {t.people ? ` · ${t.people} persona${t.people === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {data.transfers.map((t, i) => (
                <div key={`r${i}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <Bus className="w-5 h-5 text-sky-500" />
                  <div>
                    <p className="font-medium">
                      {t.type || 'Traslado'} {t.origin && t.destination ? `· ${t.origin} → ${t.destination}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.direction === 'IDA_Y_VUELTA' ? 'Ida y vuelta' : t.direction === 'REGRESO' ? 'Regreso' : 'Ida'}
                      {t.departureTime ? ` · ${fmtDate(t.departureTime, { day: 'numeric', month: 'short' })} ${fmtTime(t.departureTime)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Plan de pagos */}
        {(data.payments.length > 0 || data.downPayment > 0) && (
          <Section icon={CalendarDays} title="Tus pagos">
            <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {data.downPayment > 0 && data.paymentType !== 'CASH' && (
                <li className="relative flex items-center gap-3">
                  <span className="relative z-10 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">Anticipo</p>
                    <p className="text-xs text-slate-500">Pagado</p>
                  </div>
                  <p className="font-semibold text-emerald-600">{money(data.downPayment)}</p>
                </li>
              )}
              {data.payments.map((p) => {
                const done = p.paidAmount >= p.amount - 0.01;
                const partial = !done && p.paidAmount > 0;
                const late = !done && daysUntil(p.dueDate) < 0;
                return (
                  <li key={p.number} className="relative flex items-center gap-3">
                    <span
                      className={cn(
                        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                        done ? 'bg-emerald-500 text-white' : late ? 'bg-amber-100 text-amber-600' : p === nextPayment ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {done ? <Check className="w-4 h-4" /> : p.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Pago {p.number}</p>
                      <p className="text-xs text-slate-500">
                        {fmtDate(p.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {done ? ' · Pagado' : partial ? ` · Abonado ${money(p.paidAmount)}` : late ? ' · Pendiente' : ''}
                      </p>
                    </div>
                    <p className={cn('font-semibold', done ? 'text-emerald-600' : 'text-slate-700')}>{money(p.amount)}</p>
                  </li>
                );
              })}
            </ol>
          </Section>
        )}

        {/* Politicas */}
        {data.agency.policies && (
          <Reveal className="rounded-3xl bg-white shadow-lg shadow-sky-900/5 overflow-hidden">
            <button type="button" onClick={() => setPoliciesOpen((v) => !v)} className="w-full flex items-center justify-between p-5 text-left font-bold">
              Políticas y condiciones
              <ChevronDown className={cn('w-5 h-5 transition-transform', policiesOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {policiesOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-slate-600 whitespace-pre-line">{data.agency.policies}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Reveal>
        )}

        {/* Contacto */}
        <Reveal className="text-center space-y-3 pt-2">
          <p className="text-sm text-slate-500">¿Tienes dudas? Estamos para ayudarte</p>
          <div className="flex flex-wrap justify-center gap-2">
            {helpLink && (
              <a href={helpLink} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-500 text-white px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            )}
            {data.agency.phone && (
              <a href={`tel:${data.agency.phone.replace(/\s/g, '')}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5 shadow">
                <Phone className="w-4 h-4" />
                Llamar
              </a>
            )}
            {data.agency.email && (
              <a href={`mailto:${data.agency.email}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold inline-flex items-center gap-1.5 shadow">
                <Mail className="w-4 h-4" />
                Correo
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-400 pt-4">
            {data.agency.name} · Folio {data.folio} · Información actualizada al momento
          </p>
        </Reveal>
      </main>
    </div>
  );
}
