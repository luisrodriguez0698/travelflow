'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function initialsOf(name?: string | null) {
  return (name || '').split(/[\s@.]+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/**
 * Foto de perfil; si no hay o no carga, muestra las iniciales sobre el
 * degradado de la marca (el mismo estilo que se usaba antes en toda la app).
 */
export function UserAvatar({
  name,
  src,
  className,
  online,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  /** Punto verde de "en linea" (presencia en tiempo real) */
  online?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const showImage = !!src && !failed;
  const avatar = (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full font-semibold text-white',
        'bg-gradient-to-br from-blue-500 to-cyan-500 w-8 h-8 text-xs',
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || 'Foto de perfil'} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );

  if (online === undefined) return avatar;
  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      {online && (
        <span className="absolute bottom-0 right-0 flex h-3 w-3" aria-label="En línea" title="En línea">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
        </span>
      )}
    </span>
  );
}
