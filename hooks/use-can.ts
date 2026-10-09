'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { can, type PermissionAction } from '@/lib/permissions';

/**
 * Permisos del usuario en pantalla (para ocultar botones). La validacion real
 * esta en el servidor; esto solo evita mostrar acciones que serian rechazadas.
 */
export function useCan() {
  const { data: session } = useSession();
  const user = session?.user as { permissions?: string[]; role?: string } | undefined;

  return useCallback(
    (module: string, action: PermissionAction = 'view') => {
      if (!user) return false;
      // Legacy ADMIN sin arreglo de permisos: acceso total
      if (!user.permissions && user.role === 'ADMIN') return true;
      return can(user.permissions, module, action);
    },
    [user]
  );
}
