'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Lock, Plane } from 'lucide-react';

/** Pantalla para escribir los 4 ultimos digitos del telefono antes de ver el viaje. */
export function PortalUnlock({ token, agencyName, logo }: { token: string; agencyName: string; logo: string | null }) {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const submit = async (pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${encodeURIComponent(token)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo verificar');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setDigits(['', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (i: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    // Pegar los 4 digitos de golpe
    if (clean.length > 1) {
      const next = clean.slice(0, 4).split('');
      while (next.length < 4) next.push('');
      setDigits(next);
      if (next.every(Boolean)) submit(next.join(''));
      else refs.current[Math.min(clean.length, 3)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 3) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-400 p-4 relative overflow-hidden">
      {/* Nubes */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/20 blur-2xl"
          style={{ width: 220 + i * 80, height: 90 + i * 30, top: `${15 + i * 28}%` }}
          initial={{ x: '-40vw' }}
          animate={{ x: '120vw' }}
          transition={{ duration: 40 + i * 15, repeat: Infinity, ease: 'linear', delay: i * 6 }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-full max-w-sm rounded-3xl bg-white/95 backdrop-blur shadow-2xl p-7 text-center text-slate-800"
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={agencyName} className="h-14 mx-auto object-contain mb-3" />
        ) : (
          <p className="font-bold text-lg mb-3">{agencyName}</p>
        )}
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [0, 4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/30"
        >
          <Plane className="w-8 h-8 -rotate-45" />
        </motion.div>
        <h1 className="text-xl font-bold">Tu viaje te espera</h1>
        <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Escribe los 4 últimos dígitos de tu teléfono
        </p>

        <div className="flex justify-center gap-3 mt-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              autoFocus={i === 0}
              disabled={loading}
              aria-label={`Dígito ${i + 1}`}
              className="w-14 h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 text-center text-2xl font-bold text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
            />
          ))}
        </div>

        <div className="h-10 mt-4 flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
          ) : error ? (
            <motion.p initial={{ x: -8 }} animate={{ x: [8, -6, 4, 0] }} className="text-sm text-red-500">
              {error}
            </motion.p>
          ) : null}
        </div>
        <p className="text-[11px] text-slate-400">Protegemos tu información: solo tú puedes ver los detalles de tu viaje.</p>
      </motion.div>
    </div>
  );
}
