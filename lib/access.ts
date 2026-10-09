import { NextResponse } from 'next/server';
import { getSessionUser } from './get-tenant';
import { can, type PermissionAction } from './permissions';

// Control de acceso de las APIs:
// 1. Permiso de modulo: el rol debe tener al menos uno de los modulos indicados.
// 2. Alcance de datos: si el rol tiene "ownDataOnly", el usuario solo ve las
//    ventas/cotizaciones que creo y los clientes que creo o a los que les vendio.

export interface Access {
  tenantId: string;
  userId: string;
  ownOnly: boolean;
  /** Filtro para prisma.booking (ventas y cotizaciones). */
  bookingScope: { tenantId: string; createdBy?: string };
  /** Filtro para prisma.client. */
  clientScope: { tenantId: string; AND?: object[] };
}

function buildAccess(user: { id: string; tenantId: string; ownDataOnly: boolean }): Access {
  const ownOnly = user.ownDataOnly;
  return {
    tenantId: user.tenantId,
    userId: user.id,
    ownOnly,
    bookingScope: ownOnly ? { tenantId: user.tenantId, createdBy: user.id } : { tenantId: user.tenantId },
    clientScope: ownOnly
      ? {
          tenantId: user.tenantId,
          // AND para no chocar con un OR de busqueda en el mismo where
          AND: [{ OR: [{ createdBy: user.id }, { bookings: { some: { createdBy: user.id } } }] }],
        }
      : { tenantId: user.tenantId },
  };
}

function allows(user: { role: string; permissions: string[] }, modules: string[], action: PermissionAction) {
  // Legacy ADMIN sin arreglo de permisos: acceso total
  if (user.role === 'ADMIN' && user.permissions.length === 0) return true;
  return modules.some((m) => can(user.permissions, m, action));
}

/**
 * Exige sesion y la accion en al menos uno de los modulos
 * (p. ej. requireAccess('ventas', 'edit')). Lanza 'Unauthorized' / 'Forbidden'.
 */
export async function requireAccess(modules: string | string[], action: PermissionAction = 'view'): Promise<Access> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');
  if (!allows(user, Array.isArray(modules) ? modules : [modules], action)) throw new Error('Forbidden');
  return buildAccess(user);
}

/** Como requireAccess pero devuelve null en vez de lanzar (para paneles opcionales). */
export async function getAccess(modules: string | string[]): Promise<Access | null> {
  const user = await getSessionUser();
  if (!user || !allows(user, Array.isArray(modules) ? modules : [modules], 'view')) return null;
  return buildAccess(user);
}

/** Convierte los errores de acceso en 401/403; null si es otro error. */
export function accessErrorResponse(error: unknown): NextResponse | null {
  const message = (error as { message?: string } | null)?.message;
  if (message === 'Unauthorized') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (message === 'Forbidden') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  return null;
}
