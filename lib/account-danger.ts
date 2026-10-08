import bcrypt from 'bcryptjs';
import { getSessionUser, getTenantOwnerId } from './get-tenant';
import { prisma } from './prisma';
import { rateLimit } from './rate-limit';

// Restablecer o eliminar la agencia: solo el propietario (quien la registro)
// y siempre confirmando su contraseña.

export const RESET_SCOPES = ['sales', 'supplierPayments', 'banks', 'clients', 'goals', 'audit'] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

export const RESET_CONFIRM_PHRASE = 'RESTABLECER';

type OwnerCheck =
  | { ok: true; user: { id: string; tenantId: string; name: string } }
  | { ok: false; status: number; error: string };

export async function requireOwner(): Promise<OwnerCheck> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: 'No autorizado' };
  if (user.id !== (await getTenantOwnerId(user.tenantId))) {
    return { ok: false, status: 403, error: 'Solo el propietario de la agencia puede hacer esto' };
  }
  return { ok: true, user };
}

export async function verifyOwnerPassword(userId: string, password: unknown): Promise<string | null> {
  const rl = rateLimit(`danger-zone:${userId}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return `Demasiados intentos. Intenta de nuevo en ${rl.retryAfterSeconds} segundos.`;
  if (typeof password !== 'string' || !password) return 'Ingresa tu contraseña';
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!dbUser || !(await bcrypt.compare(password, dbUser.password))) return 'La contraseña es incorrecta';
  return null;
}

/**
 * Dependencias entre lo que se borra:
 * - Clientes -> sus ventas se borran en cascada, asi que exige "sales".
 * - Cuentas bancarias -> los pagos a proveedores apuntan a ellas (onDelete: Restrict).
 * - Ventas -> sus pagos a proveedores se borran en cascada.
 */
export function resolveScopes(requested: ResetScope[]): Set<ResetScope> {
  const scopes = new Set(requested.filter((s) => RESET_SCOPES.includes(s)));
  if (scopes.has('clients')) scopes.add('sales');
  if (scopes.has('banks') || scopes.has('sales')) scopes.add('supplierPayments');
  return scopes;
}
