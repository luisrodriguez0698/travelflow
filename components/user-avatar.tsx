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
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const showImage = !!src && !failed;
  return (
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
}
