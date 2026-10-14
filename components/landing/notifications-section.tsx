'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { Bell, Plane } from 'lucide-react';

const FEED = [
  { emoji: '🛒', title: 'Nueva venta', body: 'Luis registró una venta a Ana López por $9,699' },
  { emoji: '💳', title: 'Abono registrado', body: 'Brayan pagó $2,500 · BBVA Principal' },
  { emoji: '🧾', title: 'Próximo pago: Luz', body: 'Vence en 3 días · $1,240' },
  { emoji: '🎯', title: '¡Meta alcanzada! 🎉', body: 'Sandy llegó a su meta del mes' },
  { emoji: '⏰', title: 'Pago próximo a vencer', body: 'Marissa: $869 vence mañana' },
  { emoji: '👀', title: 'Tu cliente abrió su link', body: 'Ana revisó su viaje a Cancún' },
];

const POINTS = [
  { title: 'Al instante', text: 'Ventas, abonos e ingresos aparecen en la campana sin recargar la página.' },
  { title: 'En tu celular', text: 'Instala la app y recibe los avisos aunque esté cerrada.' },
  { title: 'Recordatorios', text: 'Pagos de clientes por vencer y gastos fijos antes de su fecha.' },
  { title: 'Solo lo que te toca', text: 'Cada quien recibe lo que su rol le permite ver.' },
];

/** Celular con notificaciones que van llegando. */
function LockScreen({ play }: { play: boolean }) {
  const [items, setItems] = useState<{ key: number; index: number }[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    if (!play) return;
    const push = () => {
      const index = counter.current % FEED.length;
      counter.current += 1;
      setItems((prev) => [{ key: counter.current, index }, ...prev].slice(0, 4));
    };
    push();
    const id = setInterval(push, 2200);
    return () => clearInterval(id);
  }, [play]);

  return (
    <div className="relative mx-auto w-[280px] rounded-[2.8rem] bg-gray-900 p-3 shadow-2xl shadow-indigo-900/30">
      <div className="absolute left-1/2 top-4 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-[560px] overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400">
        <div className="pt-16 text-center text-white">
          <p className="text-sm text-white/80">martes 13 de octubre</p>
          <p className="text-6xl font-light tracking-tight">10:24</p>
        </div>
        <div className="mt-6 space-y-2 px-3">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const n = FEED[it.index];
              return (
                <motion.div
                  key={it.key}
                  layout
                  initial={{ opacity: 0, y: -30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className="flex items-start gap-2.5 rounded-2xl bg-white/80 p-3 text-slate-800 shadow-lg backdrop-blur-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-white">
                    <Plane className="h-4 w-4 -rotate-45" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs font-bold">
                        {n.emoji} {n.title}
                      </p>
                      <span className="text-[10px] text-slate-500">ahora</span>
                    </div>
                    <p className="text-[11px] leading-snug text-slate-600">{n.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setCount((c) => (c >= 9 ? 1 : c + 1)), 2200);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <section id="avisos" className="relative overflow-hidden py-24 bg-gray-950 text-white">
      <div aria-hidden className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div aria-hidden className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div ref={ref} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="flex items-center gap-3">
            <motion.span
              key={count}
              animate={{ rotate: [0, -18, 14, -8, 0] }}
              transition={{ duration: 0.7 }}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"
            >
              <Bell className="h-6 w-6 text-amber-300" />
              <motion.span
                key={`b${count}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold"
              >
                {count}
              </motion.span>
            </motion.span>
            <span className="text-sm font-semibold uppercase tracking-widest text-amber-300">Avisos</span>
          </div>
          <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
            Te enteras de todo,{' '}
            <span className="bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">sin preguntar</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Tu equipo vende, cobra y paga; tú lo ves en tiempo real. Sin llamadas, sin “¿ya pagó?”.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {POINTS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-gray-400">{p.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 4 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <LockScreen play={inView} />
        </motion.div>
      </div>
    </section>
  );
}
