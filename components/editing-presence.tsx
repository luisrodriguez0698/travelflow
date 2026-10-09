'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { UserAvatar } from './user-avatar';
import { useRealtimeEvent, type PresenceUser } from './realtime-provider';

/**
 * Aviso "Luis está editando esta venta": evita que dos personas sobrescriban
 * los cambios del otro. resource = "sales:<id>" o "quotations:<id>".
 */
export function EditingPresence({ resource, noun }: { resource: string; noun: string }) {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  const [editors, setEditors] = useState<PresenceUser[]>([]);

  const announce = useCallback(
    (active: boolean) =>
      fetch('/api/realtime/editing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, active }),
        keepalive: !active, // que el aviso de salida llegue aunque se cierre la pagina
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setEditors(d.editors))
        .catch(() => {}),
    [resource]
  );

  useEffect(() => {
    announce(true);
    const leave = () => announce(false);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [announce]);

  useRealtimeEvent<{ resource: string; users: PresenceUser[] }>('editing', (e) => {
    if (e.resource === resource) setEditors(e.users);
  });
  // Si el servidor se reinicio, volver a anunciarse al reconectar
  useRealtimeEvent('ready', () => announce(true));

  const others = editors.filter((u) => u.id !== myId);
  const names =
    others.length === 1 ? others[0].name : `${others.slice(0, -1).map((u) => u.name).join(', ')} y ${others[others.length - 1]?.name}`;

  return (
    <AnimatePresence>
      {others.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          className="overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <div className="flex -space-x-2 shrink-0">
              {others.slice(0, 3).map((u) => (
                <span key={u.id} className="rounded-full ring-2 ring-card">
                  <UserAvatar name={u.name} src={u.avatar} className="w-8 h-8" online />
                </span>
              ))}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-warning shrink-0" />
                {names} {others.length === 1 ? 'está' : 'están'} editando {noun} ahora mismo
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Pónganse de acuerdo: si ambos guardan, se conservarán los últimos cambios guardados.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
