import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, prismaBase } from './prisma';
import { prizeFor, ticketsNeeded } from './raffle-rules';

export * from './raffle-rules';

/** Cuantas extracciones hacen falta para terminar (LAST: todas). */
function drawsToFinish(raffle: { drawMode: string; drawPosition: number | null; prizes: string[] }, total: number) {
  if (raffle.drawMode === 'LAST') return total;
  return ticketsNeeded(raffle);
}

export async function drawStarted(raffleId: string) {
  return (await prismaBase.raffleTicket.count({ where: { raffleId, drawnOrder: { not: null } } })) > 0;
}

/**
 * Ajusta los boletos de un participante: agrega numeros libres consecutivos al
 * subir; al bajar libera sus numeros mas altos. Solo antes de empezar el sorteo.
 */
/** Transaccion del cliente auditado (prisma.$transaction(async (tx) => ...)) */
type TicketTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function setParticipantTickets(
  tx: TicketTx,
  raffleId: string,
  participantId: string,
  count: number
) {
  const current = await tx.raffleTicket.findMany({
    where: { participantId },
    orderBy: { number: 'asc' },
    select: { id: true, number: true },
  });
  if (count < current.length) {
    const remove = current.slice(count).map((t) => t.id);
    await tx.raffleTicket.deleteMany({ where: { id: { in: remove } } });
    return;
  }
  const missing = count - current.length;
  if (missing === 0) return;
  // Numeros libres mas bajos (reutiliza los que quedaron libres al quitar boletos)
  const used = new Set(
    (await tx.raffleTicket.findMany({ where: { raffleId }, select: { number: true } })).map((t) => t.number)
  );
  const numbers: number[] = [];
  for (let n = 1; numbers.length < missing; n++) if (!used.has(n)) numbers.push(n);
  await tx.raffleTicket.createMany({ data: numbers.map((number) => ({ raffleId, participantId, number })) });
}

export interface DrawResult {
  ticket: { id: string; number: number; participantName: string; participantId: string; drawnOrder: number; prizeIndex: number | null };
  /** En modo LAST, al quedar uno solo se corona automaticamente */
  finalWinner?: { id: string; number: number; participantName: string; participantId: string; drawnOrder: number; prizeIndex: number };
  remaining: number;
  finished: boolean;
}

/**
 * Saca el siguiente boleto con azar criptografico. Transaccion serializable:
 * dos clics simultaneos no pueden sacar dos boletos a la vez.
 */
export async function drawNextTicket(raffleId: string, tenantId: string): Promise<DrawResult> {
  return prismaBase.$transaction(
    async (tx) => {
      const raffle = await tx.raffle.findFirst({ where: { id: raffleId, tenantId } });
      if (!raffle) throw new Error('NOT_FOUND');
      if (raffle.status !== 'OPEN') throw new Error('FINISHED');

      const total = await tx.raffleTicket.count({ where: { raffleId } });
      if (total < ticketsNeeded(raffle)) throw new Error('NOT_ENOUGH_TICKETS');

      const pending = await tx.raffleTicket.findMany({
        where: { raffleId, drawnOrder: null },
        select: { id: true, number: true, participantId: true, participant: { select: { name: true } } },
        orderBy: { number: 'asc' },
      });
      if (pending.length === 0) throw new Error('FINISHED');

      const drawnCount = total - pending.length;
      const order = drawnCount + 1;
      const pick = pending[randomInt(pending.length)];
      const prizeIndex = prizeFor(order, total, raffle);
      const now = new Date();

      await tx.raffleTicket.update({ where: { id: pick.id }, data: { drawnOrder: order, drawnAt: now, prizeIndex } });

      let finalWinner: DrawResult['finalWinner'];
      let remaining = pending.length - 1;
      // LAST: si solo queda uno, ese es el 1er lugar
      if (raffle.drawMode === 'LAST' && remaining === 1) {
        const last = pending.find((p) => p.id !== pick.id)!;
        await tx.raffleTicket.update({ where: { id: last.id }, data: { drawnOrder: total, drawnAt: now, prizeIndex: 0 } });
        finalWinner = {
          id: last.id,
          number: last.number,
          participantId: last.participantId,
          participantName: last.participant.name,
          drawnOrder: total,
          prizeIndex: 0,
        };
        remaining = 0;
      }

      const drawsDone = finalWinner ? total : order;
      const finished = drawsDone >= drawsToFinish(raffle, total) || remaining === 0;
      if (finished) await tx.raffle.update({ where: { id: raffleId }, data: { status: 'DRAWN' } });

      return {
        ticket: {
          id: pick.id,
          number: pick.number,
          participantId: pick.participantId,
          participantName: pick.participant.name,
          drawnOrder: order,
          prizeIndex,
        },
        finalWinner,
        remaining,
        finished,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/**
 * Boletos automaticos: al registrar una venta, cada rifa abierta con esta
 * opcion (y sin sorteo iniciado) suma boletos al cliente si la venta alcanza
 * el monto minimo. Nunca lanza error: no debe afectar la venta.
 */
export async function addAutoTicketsForSale(sale: {
  tenantId: string;
  bookingId: string;
  clientId: string;
  sellerId: string | null;
  totalPrice: number;
}) {
  try {
    const raffles = await prisma.raffle.findMany({
      where: { tenantId: sale.tenantId, status: 'OPEN', autoTickets: true, autoMinAmount: { lte: sale.totalPrice } },
    });
    if (raffles.length === 0) return;
    const client = await prisma.client.findUnique({ where: { id: sale.clientId }, select: { fullName: true, phone: true } });
    if (!client) return;

    for (const raffle of raffles) {
      if (await drawStarted(raffle.id)) continue;
      await prisma.$transaction(async (tx) => {
        const existing = await tx.raffleParticipant.findFirst({ where: { raffleId: raffle.id, clientId: sale.clientId } });
        const participant =
          existing ??
          (await tx.raffleParticipant.create({
            data: {
              raffleId: raffle.id,
              tenantId: sale.tenantId,
              name: client.fullName,
              phone: client.phone,
              clientId: sale.clientId,
              sellerId: sale.sellerId,
              bookingId: sale.bookingId,
              source: 'AUTO',
              createdBy: sale.sellerId,
            },
          }));
        const current = await tx.raffleTicket.count({ where: { participantId: participant.id } });
        await setParticipantTickets(tx, raffle.id, participant.id, current + raffle.autoTicketsPerSale);
      });
    }
  } catch (error) {
    console.error('Auto raffle tickets error:', error);
  }
}
