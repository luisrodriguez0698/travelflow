'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvent } from './realtime-provider';

/**
 * Para paginas que se arman en el servidor (Dashboard): cuando cambian datos de
 * las entidades indicadas, vuelve a pedir la pagina (router.refresh) sin
 * recargar ni perder el scroll. Agrupa cambios seguidos en una sola recarga.
 */
export function LiveRefresh({ entities }: { entities: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 600);
  };

  useRealtimeEvent<{ entity: string }>('data-changed', (e) => {
    if (entities.includes(e.entity)) schedule();
  });

  return null;
}
