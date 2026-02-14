import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { ALL_MODULES } from './permissions';

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
