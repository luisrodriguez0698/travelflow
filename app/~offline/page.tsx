'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Pantalla que el service worker muestra cuando se abre la app sin internet
// (next-pwa la guarda en cache como respaldo de navegacion). Al volver la
// senal recarga sola la pagina que se queria abrir.

const ARCS = [
  'M10 26 a26 26 0 0 1 44 0', // externo
  'M18 34 a16 16 0 0 1 28 0', // medio
  'M26 42 a7 7 0 0 1 12 0', // interno
];

export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setTimeout(() => window.location.reload(), 700);
    };
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, []);

  const retry = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/health?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        setOnline(true);
        window.location.reload();
        return;
      }
    } catch {
      /* sigue sin conexion */
    }
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <main
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Brillo de fondo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-[70%] rounded-full bg-red-500/25 blur-3xl"
        animate={{ opacity: [0.45, 0.8, 0.45], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Icono Wi-Fi animado */}
        <svg viewBox="0 0 64 56" className="mx-auto mb-8 h-32 w-32 sm:h-36 sm:w-36" fill="none" aria-hidden>
          {ARCS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              className="text-white/25"
              animate={{ opacity: [0.25, 0.7, 0.25] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: (ARCS.length - i) * 0.25 }}
            />
          ))}
          <motion.circle cx="32" cy="49" r="3.6" className="fill-white/40" animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }} />
          {/* Linea roja que se "dibuja" */}
          <motion.path
            d="M14 6 L50 50"
            stroke="#ef4444"
            strokeWidth="5.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: online ? 0 : 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: online ? 0 : 0.3 }}
          />
        </svg>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl font-bold tracking-tight"
        >
          {online ? '¡Volviste!' : 'Sin conexión'}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-3 text-base leading-relaxed text-white/65"
        >
          {online
            ? 'La conexión regresó. Cargando TravelFlow…'
            : 'Parece que no tienes internet. Revisa tu Wi-Fi o tus datos; volvemos en cuanto regrese la señal.'}
        </motion.p>

        <motion.button
          type="button"
          onClick={retry}
          disabled={checking || online}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 h-14 w-full rounded-full bg-white text-base font-semibold text-slate-950 shadow-lg shadow-black/30 transition-opacity disabled:opacity-70"
        >
          {checking ? 'Comprobando…' : 'Reintentar'}
        </motion.button>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-white/70" role="status" aria-live="polite">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </span>
          {online ? 'Conexión detectada' : 'Esperando señal…'}
        </div>
      </div>
    </main>
  );
}
