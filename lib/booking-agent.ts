import { prisma } from './prisma';
import type { Access } from './access';

/**
 * Agente al que pertenece una venta/cotizacion (se guarda en booking.createdBy,
 * que es lo que usan "solo lo suyo", Metas y estadisticas). Por defecto queda
 * quien la crea; cambiarlo requiere el permiso "Asignar" del apartado.
 */
export async function resolveAgent(
  access: Access,
  module: 'ventas' | 'cotizaciones',
  requested: unknown,
  current: string | null
): Promise<{ agentId: string | null } | { error: string; status: number }> {
  if (typeof requested !== 'string' || !requested || requested === current) return { agentId: current };
  if (!access.can(module, 'assign')) {
    return { error: 'No tienes permiso para asignar otro agente', status: 403 };
  }
  const user = await prisma.user.findFirst({
    where: { id: requested, tenantId: access.tenantId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!user) return { error: 'Agente no válido', status: 400 };
  return { agentId: user.id };
}
