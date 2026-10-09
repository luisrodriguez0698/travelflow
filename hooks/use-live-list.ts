'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtimeEvent } from '@/components/realtime-provider';

interface DataChanged {
  entity: string;
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actorId: string;
}

const HIGHLIGHT_MS = 3500;

/**
 * Lista "viva": cuando OTRO usuario crea o modifica un registro de esta lista,
 * se recarga sola (agrupando cambios seguidos) y la fila queda resaltada unos
 * segundos. Los cambios propios no se resaltan (el usuario ya los ve).
 */
export function useLiveList(entities: string | string[], refetch: () => void) {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const list = Array.isArray(entities) ? entities : [entities];
  const key = list.join(',');

  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const firstReady = useRef(true);

  const scheduleRefetch = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => refetchRef.current(), 450);
  }, []);

  useRealtimeEvent<DataChanged>('data-changed', (e) => {
    if (!key.split(',').includes(e.entity) || e.actorId === myId) return;
    scheduleRefetch();
    if (e.action === 'DELETE') return;
    setHighlighted((prev) => new Set(prev).add(e.id));
    setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        next.delete(e.id);
        return next;
      });
    }, HIGHLIGHT_MS);
  });

  // Al reconectar el stream, sincroniza por si hubo cambios mientras tanto
  useRealtimeEvent('ready', () => {
    if (firstReady.current) {
      firstReady.current = false;
      return;
    }
    scheduleRefetch();
  });

  useEffect(() => () => clearTimeout(debounce.current), []);

  return {
    isHighlighted: useCallback((id: string) => highlighted.has(id), [highlighted]),
  };
}
