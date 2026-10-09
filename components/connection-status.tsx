'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { WifiOff, ServerCrash, Wifi } from 'lucide-react';

/**
 * Indicador de conexion tipo "isla" (arriba al centro):
 *  - offline: el dispositivo perdio internet (Wi-Fi / datos)
 *  - server:  hay internet pero TravelFlow (o su base de datos) no responde
 *  - back:    se recupero; se muestra unos segundos y desaparece
 * Sin sondeo constante: solo verifica el servidor cuando algo falla, y mientras
 * siga fallando reintenta con espera creciente.
 */

type Status = 'ok' | 'offline' | 'server' | 'back';

const HEALTH_URL = '/api/health';
const RETRY_STEPS_MS = [2000, 4000, 8000, 15000];
const BACK_VISIBLE_MS = 2500;

const COPY: Record<Exclude<Status, 'ok'>, { title: string; detail: string }> = {
  offline: { title: 'Sin conexión', detail: 'Revisa tu Wi-Fi o datos' },
  server: { title: 'Servidor no disponible', detail: 'Reconectando' },
  back: { title: 'Conexión restablecida', detail: 'Todo funciona de nuevo' },
};

function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function ConnectionStatus() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('ok');
  const statusRef = useRef<Status>('ok');
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const backTimer = useRef<ReturnType<typeof setTimeout>>();
  const attempt = useRef(0);
  const originalFetch = useRef<typeof fetch>();

  const update = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const recovered = useCallback(() => {
    clearTimeout(retryTimer.current);
    attempt.current = 0;
    if (statusRef.current === 'ok' || statusRef.current === 'back') return;
    update('back');
    clearTimeout(backTimer.current);
    backTimer.current = setTimeout(() => update('ok'), BACK_VISIBLE_MS);
  }, [update]);

  // Pregunta al servidor si esta vivo (incluye la base de datos)
  const checkServer = useCallback(async () => {
    clearTimeout(retryTimer.current);
    if (!navigator.onLine) {
      update('offline');
      return;
    }
    try {
      const doFetch = originalFetch.current ?? fetch;
      const res = await doFetch(`${HEALTH_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        recovered();
        return;
      }
      update('server');
    } catch {
      update(navigator.onLine ? 'server' : 'offline');
    }
    // Sigue fallando: reintentar con espera creciente
    const wait = RETRY_STEPS_MS[Math.min(attempt.current, RETRY_STEPS_MS.length - 1)];
    attempt.current += 1;
    retryTimer.current = setTimeout(checkServer, wait);
  }, [recovered, update]);

  useEffect(() => {
    if (!navigator.onLine) update('offline');

    const goOffline = () => {
      clearTimeout(retryTimer.current);
      clearTimeout(backTimer.current);
      update('offline');
    };
    const goOnline = () => {
      attempt.current = 0;
      checkServer();
    };
    // Al volver a la app (celular desbloqueado, pestaña activa) confirmar si habia falla
    const onVisible = () => {
      if (document.visibilityState === 'visible' && statusRef.current !== 'ok') checkServer();
    };
    // Otros componentes (p. ej. el stream de avisos) pueden reportar sospecha de caida
    const onSuspect = () => {
      if (statusRef.current === 'ok') checkServer();
    };
    // El stream SSE logro reconectar: prueba directa de que el servidor volvio
    const onServerOk = () => {
      if (statusRef.current === 'server') recovered();
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener('tf-server-suspect', onSuspect);
    window.addEventListener('tf-server-ok', onServerOk);
    document.addEventListener('visibilitychange', onVisible);

    // Detecta fallas en las peticiones de la app sin sondear: si una peticion al
    // propio servidor no llega o responde 502/503/504, se verifica la salud.
    originalFetch.current = window.fetch;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      try {
        const res = await nativeFetch(input, init);
        if ([502, 503, 504].includes(res.status) && isSameOrigin(input) && statusRef.current === 'ok') {
          checkServer();
        }
        return res;
      } catch (error) {
        const aborted = (error as { name?: string })?.name === 'AbortError';
        if (!aborted && isSameOrigin(input) && statusRef.current === 'ok') checkServer();
        throw error;
      }
    };

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('tf-server-suspect', onSuspect);
      window.removeEventListener('tf-server-ok', onServerOk);
      document.removeEventListener('visibilitychange', onVisible);
      if (originalFetch.current) window.fetch = originalFetch.current;
      clearTimeout(retryTimer.current);
      clearTimeout(backTimer.current);
    };
  }, [checkServer, recovered, update]);

  // En la pantalla completa "sin conexion" la pildora seria redundante
  const visible = status !== 'ok' && pathname !== '/~offline';
  const copy = visible ? COPY[status as Exclude<Status, 'ok'>] : null;
  const tone =
    status === 'back'
      ? { ring: 'bg-emerald-500', icon: 'bg-emerald-500', pulse: false }
      : status === 'server'
        ? { ring: 'bg-amber-500', icon: 'bg-amber-500', pulse: true }
        : { ring: 'bg-red-500', icon: 'bg-red-500', pulse: true };
  const Icon = status === 'back' ? Wifi : status === 'server' ? ServerCrash : WifiOff;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible && copy && (
          <motion.div
            key="connection-pill"
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-950/95 text-white pl-1.5 pr-5 py-1.5 shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur-md"
          >
            <span className="relative flex h-9 w-9 items-center justify-center">
              {tone.pulse && (
                <span className={`absolute inset-0 rounded-full ${tone.ring} opacity-60 animate-ping`} aria-hidden />
              )}
              <motion.span
                key={status}
                initial={{ scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full ${tone.icon}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </motion.span>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">{copy.title}</span>
              <span className="flex items-center gap-1 text-xs text-white/70">
                {copy.detail}
                {status !== 'back' && (
                  <span className="inline-flex gap-0.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1 w-1 rounded-full bg-white/80"
                        animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </span>
                )}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
