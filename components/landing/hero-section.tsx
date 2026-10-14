'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { ArrowRight, Bell, CheckCircle2, Globe, MessageCircle, Plane, Shield, Sparkles, TrendingUp } from 'lucide-react';

const HEADLINE = ['Gestiona', 'tu', 'agencia', 'y', 'enamora', 'a', 'tus', 'viajeros'];
const HIGHLIGHT = new Set(['enamora', 'viajeros']);

/** Tarjeta flotante que se mueve con el mouse (profundidad = cuanto se mueve). */
function FloatCard({
  mx,
  my,
  depth,
  className,
  delay = 0,
  children,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  className: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div style={{ x, y }} className={`absolute ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: [0, -10, 0], scale: 1 }}
        transition={{
          opacity: { delay, duration: 0.6 },
          scale: { delay, duration: 0.6 },
          y: { delay: delay + 0.6, duration: 5 + depth * 3, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 15 });
  const my = useSpring(rawY, { stiffness: 60, damping: 15 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width - 0.5) * 40);
    rawY.set(((e.clientY - r.top) / r.height - 0.5) * 40);
  };

  return (
    <section id="inicio" ref={ref} onMouseMove={onMove} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Cielo */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-blue-950 to-cyan-950" />
      {/* Aurora en movimiento */}
      <motion.div
        aria-hidden
        className="absolute -top-40 -right-40 w-[34rem] h-[34rem] rounded-full bg-blue-500/25 blur-3xl"
        animate={reduce ? undefined : { x: [0, -60, 20, 0], y: [0, 40, -20, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/2 -left-48 w-[30rem] h-[30rem] rounded-full bg-cyan-400/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, 80, 0], y: [0, -50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-0 right-1/3 w-80 h-80 rounded-full bg-fuchsia-500/15 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, -30, 0], y: [0, -30, 10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Cuadricula */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Ruta de vuelo con avion */}
      <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <motion.path
          d="M -40 760 C 260 620, 420 820, 720 560 S 1180 260, 1500 160"
          fill="none"
          stroke="url(#route)"
          strokeWidth="2"
          strokeDasharray="6 10"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.4, ease: 'easeInOut', delay: 0.4 }}
        />
        <defs>
          <linearGradient id="route" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {!reduce && (
          <g>
            <animateMotion dur="14s" repeatCount="indefinite" rotate="auto" path="M -40 760 C 260 620, 420 820, 720 560 S 1180 260, 1500 160" />
            <path d="M0 -6 L18 0 L0 6 L4 0 Z" fill="#e0f2fe" />
          </g>
        )}
      </svg>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Texto */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-6"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-200 font-medium">Hecho para agencias de viaje en México</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
              {HEADLINE.map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.25em]"
                  initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  {HIGHLIGHT.has(word) ? (
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-400 bg-clip-text text-transparent">{word}</span>
                  ) : (
                    word
                  )}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-6 text-lg sm:text-xl text-gray-300 leading-relaxed max-w-xl"
            >
              Clientes, ventas, cotizaciones, pagos, proveedores y bancos en una sola plataforma. Y para tus clientes, un link
              precioso donde ven su viaje y cómo avanza su pago.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.6 }}
              className="mt-8 flex flex-col sm:flex-row gap-4"
            >
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register"
                  className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-2 overflow-hidden px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-lg shadow-2xl shadow-blue-500/30"
                >
                  {/* Brillo que cruza el boton */}
                  <motion.span
                    aria-hidden
                    className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/30"
                    animate={reduce ? undefined : { x: ['0%', '450%'] }}
                    transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                  />
                  <span className="relative">Comenzar gratis</span>
                  <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-lg hover:bg-white/20 transition-all duration-300"
              >
                Iniciar sesión
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-gray-400"
            >
              <span className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-emerald-400" />
                Datos cifrados y seguros
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-cyan-400" />
                Tu propio dominio
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                Gratis para empezar
              </span>
            </motion.div>
          </div>

          {/* Composicion de tarjetas flotantes */}
          <div className="relative hidden lg:block h-[520px]">
            <div aria-hidden className="absolute inset-10 rounded-[2.5rem] bg-gradient-to-br from-blue-500/20 to-cyan-400/10 blur-2xl" />

            {/* Panel principal: ventas del mes */}
            <FloatCard mx={mx} my={my} depth={0.35} className="left-6 top-16 w-[340px]" delay={0.4}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/70">Ventas del mes</p>
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] text-emerald-300">
                  <TrendingUp className="w-3 h-3" />
                  +24%
                </span>
              </div>
              <p className="mt-1 text-3xl font-black">$128,450</p>
              <div className="mt-4 flex h-24 items-end gap-2">
                {[38, 54, 46, 70, 62, 88, 76].map((h, i) => (
                  <motion.span
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500 to-cyan-300"
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.9 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
            </FloatCard>

            {/* Avance de pago del cliente */}
            <FloatCard mx={mx} my={my} depth={0.8} className="right-0 top-0 w-[250px]" delay={0.7}>
              <p className="text-xs text-white/70">Ana · Tu viaje a Cancún</p>
              <p className="mt-1 text-sm font-semibold">¡Ya casi! Alista el bloqueador 😎</p>
              <div className="relative mt-4 h-2.5 rounded-full bg-white/15">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
                  initial={{ width: 0 }}
                  animate={{ width: '78%' }}
                  transition={{ delay: 1.2, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.span
                  className="absolute -top-2.5 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white text-sky-500 shadow-lg"
                  initial={{ left: '0%' }}
                  animate={{ left: '78%' }}
                  transition={{ delay: 1.2, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Plane className="h-3.5 w-3.5 rotate-45" />
                </motion.span>
              </div>
              <p className="mt-3 text-right text-xs font-bold text-emerald-300">78% pagado</p>
            </FloatCard>

            {/* Notificacion */}
            <FloatCard mx={mx} my={my} depth={1.1} className="right-6 bottom-24 w-[270px]" delay={1}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Abono registrado</p>
                  <p className="text-xs text-white/70">Brayan pagó $2,500 · hace un momento</p>
                </div>
              </div>
            </FloatCard>

            {/* WhatsApp */}
            <FloatCard mx={mx} my={my} depth={0.6} className="left-0 bottom-6 w-[260px]" delay={1.2}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-500/25 text-green-300">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1">
                    Link enviado <CheckCircle2 className="h-3.5 w-3.5 text-sky-300" />
                  </p>
                  <p className="text-xs text-white/70">viajaentrenubes.com/v/…</p>
                </div>
              </div>
            </FloatCard>
          </div>
        </div>
      </div>

      {/* Indicador de scroll */}
      <motion.div
        aria-hidden
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex h-10 w-6 justify-center rounded-full border border-white/30 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        <motion.span
          className="h-2 w-1 rounded-full bg-white/70"
          animate={reduce ? undefined : { y: [0, 12, 0], opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      </motion.div>
    </section>
  );
}
