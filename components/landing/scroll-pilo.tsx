'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion';
import { PlaneMascot } from '@/components/plane-mascot';

/** Lo que Pilo comenta en cada seccion de la pagina. */
const LINES: { id: string; text: string }[] = [
  { id: 'inicio', text: '¡Hola! Soy Pilo ✈️ Te enseño TravelFlow' },
  { id: 'servicios', text: 'Todo tu negocio en un solo lugar 🧳' },
  { id: 'tu-cliente', text: 'Así ve tu cliente su viaje 😍' },
  { id: 'avisos', text: 'Te aviso de todo, al instante 🔔' },
  { id: 'como-funciona', text: 'Empezar toma minutos ⏱️' },
  { id: 'testimonios', text: 'Agencias que ya vuelan alto 💙' },
  { id: 'empezar', text: '¿Despegamos juntos? 🚀' },
];

/** Barra de avance de lectura (arriba de todo). */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 25 });
  return (
    <motion.div
      className="fixed top-0 inset-x-0 h-1 origin-left z-[60] bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
      style={{ scaleX }}
    />
  );
}

/**
 * Pilo acompaña al visitante: baja por el costado mientras se hace scroll,
 * se inclina segun la velocidad y comenta la seccion que se esta viendo.
 */
export function ScrollPilo() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 18 });
  const top = useTransform(smooth, [0, 1], ['16vh', '74vh']);
  const velocity = useVelocity(scrollYProgress);
  const tilt = useSpring(useTransform(velocity, [-0.6, 0, 0.6], [-28, 0, 28]), { stiffness: 140, damping: 14 });
  const [active, setActive] = useState(0);
  const [bubble, setBubble] = useState(true);

  // Seccion visible -> frase de Pilo
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    LINES.forEach((line, index) => {
      const el = document.getElementById(line.id);
      if (!el) return;
      const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setActive(index), { threshold: 0.35 });
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // El globo aparece unos segundos en cada cambio de seccion
  useEffect(() => {
    setBubble(true);
    const t = setTimeout(() => setBubble(false), 4200);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <motion.button
      type="button"
      aria-label="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onMouseEnter={() => setBubble(true)}
      className="fixed right-4 xl:right-8 z-40 hidden md:flex items-center gap-2 cursor-pointer"
      style={{ top: reduce ? '70vh' : top }}
    >
      <AnimatePresence mode="wait">
        {bubble && (
          <motion.span
            key={active}
            initial={{ opacity: 0, x: 12, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative max-w-[220px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-left text-xs font-medium text-gray-800 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:text-gray-100"
          >
            {LINES[active].text}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span className="relative block" style={{ rotate: reduce ? 0 : tilt }}>
        {/* Estela */}
        <span className="absolute right-full top-1/2 -translate-y-1/2 mr-1 flex flex-col gap-1 opacity-60">
          <span className="block h-0.5 w-6 rounded-full bg-gradient-to-l from-cyan-300 to-transparent" />
          <span className="block h-0.5 w-4 rounded-full bg-gradient-to-l from-blue-300 to-transparent" />
        </span>
        <motion.span
          className="block drop-shadow-xl"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <PlaneMascot size={64} mood={active === LINES.length - 1 ? 'happy' : 'wave'} />
        </motion.span>
      </motion.span>
    </motion.button>
  );
}
