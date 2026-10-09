'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'sonner';

// UNA conexion SSE por pestaña y la reparte a toda la app: avisos, cambios de
// datos, presencia, quien edita que, celebraciones y eventos de sesion.

export interface PresenceUser {
  id: string;
  name: string;
  avatar: string | null;
}

interface RealtimeContextValue {
  bus: EventTarget;
  online: PresenceUser[];
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const EVENTS = ['ready', 'activity', 'data-changed', 'presence', 'editing', 'session', 'celebrate'] as const;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { update } = useSession();
  const busRef = useRef<EventTarget>();
  busRef.current ??= new EventTarget();
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const bus = busRef.current!;
    const source = new EventSource('/api/activity/stream');

    for (const name of EVENTS) {
      source.addEventListener(name, (event) => {
        let data: unknown = {};
        try {
          data = JSON.parse((event as MessageEvent).data || '{}');
        } catch {
          return; // evento mal formado
        }
        bus.dispatchEvent(new CustomEvent(name, { detail: data }));
      });
    }

    source.addEventListener('ready', () => {
      setConnected(true);
      // El stream (re)conecto: el servidor esta vivo -> indicador de conexion
      window.dispatchEvent(new Event('tf-server-ok'));
    });
    source.addEventListener('error', () => {
      setConnected(false);
      // Si se cae teniendo internet, que el indicador verifique el servidor
      if (navigator.onLine) window.dispatchEvent(new Event('tf-server-suspect'));
    });

    const onPresence = (e: Event) => setOnline(((e as CustomEvent).detail as { online: PresenceUser[] }).online ?? []);
    bus.addEventListener('presence', onPresence);

    // Sesion: el Admin desactivo al usuario o cambio sus permisos -> reaccion inmediata
    const onSession = async (e: Event) => {
      const { reason } = (e as CustomEvent).detail as { reason: string };
      if (reason === 'revoked') {
        await signOut({ callbackUrl: '/login?disabled=1' });
      } else if (reason === 'permissions') {
        await update(); // vuelve a leer permisos del servidor
        router.refresh();
        toast.info('Tus permisos se actualizaron', { description: 'Lo que puedes ver y hacer cambió.' });
      }
    };
    bus.addEventListener('session', onSession);

    return () => {
      source.close();
      bus.removeEventListener('presence', onPresence);
      bus.removeEventListener('session', onSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RealtimeContext.Provider value={{ bus: busRef.current, online, connected }}>{children}</RealtimeContext.Provider>
  );
}

/** Escucha un evento de tiempo real ("activity", "data-changed", ...). */
export function useRealtimeEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const ctx = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    const listener = (e: Event) => handlerRef.current((e as CustomEvent).detail as T);
    ctx.bus.addEventListener(event, listener);
    return () => ctx.bus.removeEventListener(event, listener);
  }, [ctx, event]);
}

/** Usuarios de la agencia conectados ahora mismo. */
export function usePresence() {
  const ctx = useContext(RealtimeContext);
  const online = ctx?.online ?? [];
  const isOnline = useCallback((userId: string) => online.some((u) => u.id === userId), [online]);
  return { online, isOnline };
}

export function useRealtimeConnected() {
  return useContext(RealtimeContext)?.connected ?? false;
}
