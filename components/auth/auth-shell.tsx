'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowLeft, Plane } from 'lucide-react';

type Mode = 'login' | 'register';

const COPY: Record<Mode, { kicker: string; words: string[]; highlight: string; text: string }> = {
  login: {
    kicker: 'Bienvenido de vuelta',
    words: ['Tu', 'agencia', 'te', 'está'],
    highlight: 'esperando',
    text: 'Ventas, abonos y avisos de tu equipo, justo donde los dejaste.',
  },
  register: {
    kicker: 'Empieza hoy',
    words: ['Despega', 'tu', 'agencia', 'en'],
    highlight: 'minutos',
    text: 'Cotiza, cobra y comparte el viaje con tu cliente. Sin hojas de cálculo.',
  },
};

const FEED = [
  { emoji: '🛒', title: 'Nueva venta', body: 'Luis registró una venta a Ana López · $9,699' },
  { emoji: '💳', title: 'Abono registrado', body: 'Brayan pagó $2,500 · BBVA Principal' },
  { emoji: '👀', title: 'Tu cliente abrió su link', body: 'Ana revisó su viaje a Cancún' },
  { emoji: '🎯', title: '¡Meta alcanzada! 🎉', body: 'Sandy llegó a su meta del mes' },
  { emoji: '🧾', title: 'Próximo pago: Luz', body: 'Vence en 3 días · $1,240' },
];

const CHIPS = ['🔗 Link para tu cliente', '💳 Planes de pago', '🔔 Avisos al instante', '🎟️ Rifas'];

/** Animacion escalonada para los campos del formulario. */
const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/** Envuelve el contenido del formulario para que sus campos entren uno por uno. */
export function AuthFields({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

/** Un campo (o bloque) dentro de AuthFields. */
export function AuthItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/** Mensaje de error que entra con una pequeña sacudida. */
export function AuthError({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -5, 5, 0] }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden"
        >
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Notificaciones que van llegando en el panel lateral. */
function LiveFeed() {
  const [items, setItems] = useState<{ key: number; index: number }[]>([{ key: 0, index: 0 }]);

  useEffect(() => {
    let n = 1;
    const id = setInterval(() => {
      const next = { key: n, index: n % FEED.length };
      n += 1;
      setItems((prev) => [next, ...prev].slice(0, 3));
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {items.map((it, i) => {
          const f = FEED[it.index];
          return (
            <motion.div
              key={it.key}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1 - i * 0.25, y: 0, scale: 1 - i * 0.03 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-md"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400">
                <Plane className="h-4 w-4 -rotate-45" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {f.emoji} {f.title}
                  </p>
                  <span className="text-[10px] text-white/50">ahora</span>
                </div>
                <p className="text-xs text-white/70">{f.body}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Panel izquierdo (escritorio): ruta con avion, titulo animado y avisos en vivo. */
function ShowcasePanel({ mode }: { mode: Mode }) {
  const reduce = useReducedMotion();
  const copy = COPY[mode];
  const route = 'M -20 420 C 120 300, 220 380, 330 250 S 520 120, 640 60';

  return (
    <div className="relative hidden overflow-hidden bg-gray-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Fondo: manchas de color y cuadricula */}
      <motion.div
        aria-hidden
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      {/* Ruta de vuelo */}
      <svg aria-hidden viewBox="0 0 620 480" className="pointer-events-none absolute inset-x-0 top-24 w-full opacity-70">
        <defs>
          <linearGradient id="auth-route" x1="0" x2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <motion.path
          d={route}
          fill="none"
          stroke="url(#auth-route)"
          strokeWidth="2"
          strokeDasharray="6 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
        <circle cx="330" cy="250" r="5" fill="#38bdf8">
          <animate attributeName="r" values="4;9;4" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
        {!reduce && (
          <g>
            <path d="M -9 -4 L 9 0 L -9 4 L -5 0 Z" fill="white" />
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path={route} />
          </g>
        )}
      </svg>

      {/* Logo */}
      <Link href="/" className="relative z-10 flex w-fit items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-cyan-500/30">
          <Plane className="h-6 w-6" />
        </span>
        <span className="text-2xl font-bold">TravelFlow</span>
      </Link>

      {/* Titulo y avisos */}
      <div className="relative z-10 max-w-md">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold uppercase tracking-widest text-cyan-300"
        >
          {copy.kicker}
        </motion.p>
        <h2 className="mt-3 text-4xl font-extrabold leading-tight xl:text-5xl">
          {copy.words.map((w, i) => (
            <motion.span
              key={w + i}
              className="mr-[0.25em] inline-block"
              initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
            >
              {w}
            </motion.span>
          ))}
          <motion.span
            className="inline-block bg-gradient-to-r from-sky-300 to-teal-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.15 + copy.words.length * 0.08, duration: 0.5 }}
          >
            {copy.highlight}
          </motion.span>
        </h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 text-gray-400"
        >
          {copy.text}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-8"
        >
          <LiveFeed />
        </motion.div>
      </div>

      {/* Chips */}
      <div className="relative z-10 flex flex-wrap gap-2">
        {CHIPS.map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 + i * 0.08 }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

interface AuthShellProps {
  mode: Mode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Pantalla de login/registro con el mismo estilo animado de la landing. */
export function AuthShell({ mode, title, subtitle, children }: AuthShellProps) {
  const reduce = useReducedMotion();

  return (
    <div className="grid min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 lg:grid-cols-2">
      <ShowcasePanel mode={mode} />

      <div className="relative flex items-center justify-center overflow-hidden p-4 py-10 sm:p-8">
        {/* Manchas suaves detras de la tarjeta */}
        <motion.div
          aria-hidden
          className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/10"
          animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl dark:bg-blue-500/10"
          animate={reduce ? undefined : { scale: [1.1, 1, 1.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        <Link
          href="/"
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-900 dark:hover:bg-white/5 dark:hover:text-white sm:left-6 sm:top-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-2xl shadow-blue-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/80 sm:p-8">
            <div className="mb-8 flex flex-col items-center">
              <motion.div
                initial={{ rotate: -30, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
                whileHover={{ rotate: -10, scale: 1.06 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-cyan-500/30"
              >
                <motion.span
                  animate={reduce ? undefined : { y: [0, -3, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Plane className="h-8 w-8 text-white" />
                </motion.span>
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
            </div>
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
