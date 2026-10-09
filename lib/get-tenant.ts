import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { ALL_MODULES } from './permissions';
import { prisma } from './prisma';

export async function getTenantId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.tenantId ?? null;
}

export async function requireTenantId(): Promise<string> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error('Unauthorized');
  }
  return tenantId;
}

export async function getSessionUser(): Promise<{
  id: string;
  tenantId: string;
  name: string;
  role: string;
  permissions: string[];
  ownDataOnly: boolean;
} | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.tenantId) return null;

  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name || user.email || '',
    role: user.role,
    permissions: user.permissions ?? (user.role === 'ADMIN' ? [...ALL_MODULES] : []),
    ownDataOnly: user.ownDataOnly === true,
  };
}

export async function requirePermission(module: string): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error('Unauthorized');

  // Legacy ADMIN users without permissions array get full access
  if (user.role === 'ADMIN' && user.permissions.length === 0) {
    return user.tenantId;
  }

  if (!user.permissions.includes(module)) {
    throw new Error('Forbidden');
  }

  return user.tenantId;
}

/**
 * El propietario de la agencia es el primer usuario creado en el tenant
 * (el que la registro en /register). No se puede desactivar, eliminar ni
 * cambiar de rol.
 */
export async function getTenantOwnerId(tenantId: string): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return owner?.id ?? null;
}

/** Igual que requirePermission pero devuelve boolean en lugar de lanzar error. */
export async function hasPermission(module: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.role === 'ADMIN' && user.permissions.length === 0) return true;
  return user.permissions.includes(module);
}
