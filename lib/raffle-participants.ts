import { prisma } from './prisma';
import type { Access } from './access';
import { drawStarted } from './raffles';

/** Validaciones comunes de alta/edicion de participantes. Devuelve error o null. */
export async function validateParticipant(
  access: Access,
  raffleId: string,
  body: { sellerId?: string | null; clientId?: string | null }
): Promise<{ error: string; status: number } | { raffle: NonNullable<Awaited<ReturnType<typeof prisma.raffle.findFirst>>>; sellerId: string }> {
  const raffle = await prisma.raffle.findFirst({ where: { id: raffleId, tenantId: access.tenantId } });
  if (!raffle) return { error: 'Rifa no encontrada', status: 404 };
  if (raffle.status !== 'OPEN' || (await drawStarted(raffleId))) {
    return { error: 'El sorteo ya empezó: los participantes no se pueden modificar', status: 400 };
  }
  // "Solo lo suyo": siempre a su nombre. Si no, el agente elegido (de la agencia).
  const sellerId = access.ownOnly ? access.userId : body.sellerId || access.userId;
  const seller = await prisma.user.findFirst({ where: { id: sellerId, tenantId: access.tenantId, deletedAt: null } });
  if (!seller) return { error: 'Agente no válido', status: 400 };
  if (body.clientId) {
    const client = await prisma.client.findFirst({ where: { id: body.clientId, ...access.clientScope } });
    if (!client) return { error: 'Cliente no válido', status: 400 };
  }
  return { raffle, sellerId };
}
