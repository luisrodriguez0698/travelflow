'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { CalendarDays, Check, CheckCheck, Copy, Link2, Monitor, Plane, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative w-[260px] sm:w-[280px] rounded-[2.8rem] bg-gray-900 p-3 shadow-2xl shadow-sky-900/20', className)}>
      <div className="absolute left-1/2 top-4 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-[540px] overflow-hidden rounded-[2.2rem] bg-sky-50">{children}</div>
    </div>
  );
}

const MILESTONES = ['💳', '🗺️', '🧳', '🕶️', '🏝️'];

/** Mini version del portal del cliente con la barra que avanza. */
function PortalMock({ play }: { play: boolean }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!play) return;
    // La barra sube por etapas, como si fueran abonos
    const steps = [25, 52, 78];
    let i = 0;
    setProgress(10);
    const id = setInterval(() => {
      setProgress(steps[i] ?? 78);
      i++;
      if (i >= steps.length) clearInterval(id);
    }, 1100);
    return () => clearInterval(id);
  }, [play]);

  const message = progress >= 75 ? '¡Ya casi! Alista el bloqueador 😎' : progress >= 50 ? '¡Más de la mitad! 🧳' : '¡Tu aventura comenzó! ✨';

  return (
    <div className="h-full text-slate-800">
      <div className="bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-400 px-5 pt-12 pb-16 text-white">
        <p className="text-sm text-white/90">¡Hola, Ana! 👋</p>
        <p className="text-2xl font-black leading-tight">Tu viaje a Cancún</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs">
          <CalendarDays className="h-3.5 w-3.5" />
          12 dic — 18 dic
        </p>
        <p className="mt-3 text-3xl font-black">
          42 <span className="text-sm font-medium">días para tu viaje</span>
        </p>
      </div>
      <div className="-mt-10 px-3 space-y-3">
        <div className="rounded-2xl bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold">{message}</p>
            <motion.p key={progress} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-2xl font-black text-sky-500">
              {progress}%
            </motion.p>
          </div>
          <div className="relative mt-5 h-2.5 rounded-full bg-slate-100">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.span
              className="absolute -top-3 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-sky-400 bg-white text-sky-500 shadow"
              animate={{ left: `${progress}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <Plane className="h-4 w-4 rotate-45" />
            </motion.span>
          </div>
          <div className="mt-4 flex justify-between text-lg">
            {MILESTONES.map((m, i) => (
              <span key={m} className={cn('transition-all duration-500', progress >= i * 25 ? '' : 'grayscale opacity-30')}>
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 p-4 text-white shadow-lg">
          <p className="text-xs text-white/90">Tu próximo pago</p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black">$2,500</p>
            <p className="text-xs">15 de noviembre</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-lg">
          <div className="relative h-20 overflow-hidden rounded-xl bg-gradient-to-b from-sky-300 via-cyan-300 to-amber-200">
            <span className="absolute right-3 top-2 text-2xl">☀️</span>
            <span className="absolute bottom-0 left-2 text-3xl">🌴</span>
            <span className="absolute bottom-1 right-6 text-xl">⛱️</span>
            <span className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-sky-500/70 to-transparent" />
          </div>
          <p className="mt-2 text-sm font-bold">Hotel frente al mar · Todo incluido</p>
        </div>
      </div>
    </div>
  );
}

/** Chat de WhatsApp: la agencia manda el link. */
function WhatsAppMock({ play }: { play: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!play) return;
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 600);
    const t2 = setTimeout(() => setStep(2), 2000);
    const t3 = setTimeout(() => setStep(3), 3400);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [play]);

  return (
    <div className="flex h-full flex-col bg-[#efeae2]">
      <div className="flex items-center gap-2 bg-[#075e54] px-4 pt-11 pb-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">EN</span>
        <div>
          <p className="text-sm font-semibold">Entre Nubes Viajes</p>
          <p className="text-[10px] text-white/70">{step === 1 ? 'escribiendo…' : 'en línea'}</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 p-3 text-[13px]">
        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="max-w-[90%] rounded-xl rounded-tl-none bg-white p-2.5 shadow-sm"
            >
              <p>¡Hola Ana! ✈️ Aquí puedes ver tu viaje y tus pagos, siempre actualizados:</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                <div className="h-16 bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-400 p-2 text-white">
                  <p className="text-[10px] opacity-90">viajaentrenubes.com</p>
                  <p className="text-xs font-bold">Tu viaje a Cancún</p>
                </div>
                <p className="px-2 py-1 text-[11px] text-sky-600 underline">viajaentrenubes.com/v/k8Jq2…</p>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">Para entrar escribe los 4 últimos dígitos de tu teléfono.</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                10:24 <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
              </p>
            </motion.div>
          )}
          {step >= 3 && (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="ml-auto max-w-[80%] rounded-xl rounded-tr-none bg-[#d9fdd3] p-2.5 shadow-sm"
            >
              ¡Qué bonito! Ya vi que me falta poquito 🥹🏝️
              <p className="mt-1 text-right text-[10px] text-slate-400">10:26</p>
            </motion.div>
          )}
        </AnimatePresence>
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex gap-1 rounded-xl bg-white px-3 py-2.5 shadow-sm">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** Version de escritorio: la tabla de ventas con el menu del link. */
function DesktopMock({ play }: { play: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!play) return;
    setCopied(false);
    const t = setTimeout(() => setCopied(true), 1600);
    return () => clearTimeout(t);
  }, [play]);

  const rows = [
    { folio: '3LSMKR6S', client: 'Ana López', total: '$9,699', on: true },
    { folio: 'KE8EKYUW', client: 'Blanca Torres', total: '$12,999', on: false },
    { folio: '171Q9XHU', client: 'Marissa Solís', total: '$14,918', on: true },
  ];

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/10">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-3 rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-white/5">travelflow · Ventas</span>
      </div>
      <div className="relative p-5">
        <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-3 border-b border-gray-100 pb-2 text-xs font-semibold text-gray-500 dark:border-white/10">
          <span>Folio</span>
          <span>Cliente</span>
          <span className="text-right">Total</span>
          <span>Link</span>
        </div>
        {rows.map((r, i) => (
          <motion.div
            key={r.folio}
            initial={{ opacity: 0, x: -10 }}
            animate={play ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="grid grid-cols-[1fr_2fr_1fr_auto] items-center gap-3 border-b border-gray-50 py-3 text-sm dark:border-white/5"
          >
            <span className="font-mono text-xs text-gray-400">{r.folio}</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">{r.client}</span>
            <span className="text-right font-semibold text-emerald-600">{r.total}</span>
            <span
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-lg border',
                r.on ? 'border-emerald-400/50 text-emerald-500' : 'text-gray-400 border-gray-200 dark:border-white/10'
              )}
            >
              <Link2 className="h-4 w-4" />
              {r.on && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />}
            </span>
          </motion.div>
        ))}

        {/* Menu abierto del primer link */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -6 }}
          animate={play ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ delay: 0.9, type: 'spring', stiffness: 260, damping: 20 }}
          className="absolute right-6 top-24 w-56 rounded-xl border border-gray-200 bg-white p-1.5 text-sm shadow-2xl dark:border-white/10 dark:bg-gray-800"
        >
          <p className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500">
            Link del cliente <span className="text-emerald-500">Activo</span>
          </p>
          {[
            { icon: copied ? Check : Copy, label: copied ? '¡Link copiado!' : 'Copiar link', active: copied },
            { icon: Smartphone, label: 'Enviar por WhatsApp a Ana' },
            { icon: Monitor, label: 'Abrir página' },
          ].map((item) => (
            <span
              key={item.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-200',
                item.active && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export function ShowcaseSection() {
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, amount: 0.35 });
  const [cycle, setCycle] = useState(0);

  // Cada vez que se vuelve a ver la seccion o se cambia de vista, la animacion arranca de nuevo
  useEffect(() => {
    if (inView) setCycle((c) => c + 1);
  }, [inView, device]);

  return (
    <section id="tu-cliente" className="relative overflow-hidden py-24 bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">Para tus clientes</span>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">
            Un link que da{' '}
            <span className="bg-gradient-to-r from-sky-500 to-teal-400 bg-clip-text text-transparent">ganas de pagar</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Tu cliente ve su viaje, las fotos del hotel y cómo avanza su pago con un avión que despega con cada abono. Protegido
            con los 4 últimos dígitos de su teléfono.
          </p>
        </motion.div>

        {/* Selector de vista */}
        <div className="mt-10 flex justify-center">
          <div className="relative inline-flex rounded-full bg-gray-100 p-1 dark:bg-white/5">
            {(
              [
                { key: 'phone', label: 'Celular', icon: Smartphone },
                { key: 'desktop', label: 'Computadora', icon: Monitor },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDevice(opt.key)}
                className={cn(
                  'relative z-10 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors',
                  device === opt.key ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                )}
              >
                {device === opt.key && (
                  <motion.span
                    layoutId="device-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-gray-900 dark:bg-sky-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={ref} className="mt-12 flex min-h-[600px] items-start justify-center">
          <AnimatePresence mode="wait">
            {device === 'phone' ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-10 md:flex-row md:items-start md:gap-12"
              >
                <div className="text-center">
                  <motion.div whileHover={{ rotate: -2, y: -6 }}>
                    <PhoneFrame>
                      <PortalMock key={`portal-${cycle}`} play={inView} />
                    </PhoneFrame>
                  </motion.div>
                  <p className="mt-4 text-sm text-gray-500">Lo que ve tu cliente</p>
                </div>
                <div className="text-center md:mt-16">
                  <motion.div whileHover={{ rotate: 2, y: -6 }}>
                    <PhoneFrame>
                      <WhatsAppMock key={`wa-${cycle}`} play={inView} />
                    </PhoneFrame>
                  </motion.div>
                  <p className="mt-4 text-sm text-gray-500">Se lo envías por WhatsApp en un clic</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="desktop"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="flex w-full flex-col items-center"
              >
                <DesktopMock key={`desk-${cycle}`} play={inView} />
                <p className="mt-4 text-sm text-gray-500">Desde la tabla de ventas: activa, copia o envía el link sin entrar a la venta</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
