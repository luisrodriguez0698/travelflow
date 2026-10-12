import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma, prismaBase } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { drawNextTicket, ticketsNeeded } from '@/lib/raffles';
import { publishToTenant } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const ERRORS: Record<string, [string, number]> = {
  NOT_FOUND: ['Rifa no encontrada', 404],
  FINISHED: ['El sorteo ya terminó', 400],
  NOT_ENOUGH_TICKETS: ['No hay suficientes boletos para sortear todos los premios', 400],
};

// Estado completo para la pantalla del sorteo (todos los boletos, sin filtrar
// por agente: el sorteo es de toda la agencia)
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas');
    const { id } = await params;
    const raffle = await prisma.raffle.findFirst({
      where: { id, tenantId: access.tenantId },
      select: {
        id: true, name: true, description: true, prizes: true, drawMode: true, drawPosition: true, style: true,
        status: true, terms: true, drawDate: true, tenant: { select: { name: true, logo: true } },
      },
    });
    if (!raffle) return NextResponse.json({ error: 'Rifa no encontrada' }, { status: 404 });

    const tickets = await prismaBase.raffleTicket.findMany({
      where: { raffleId: id },
      orderBy: { number: 'asc' },
      select: {
        id: true, number: true, drawnOrder: true, prizeIndex: true, participantId: true,
        participant: { select: { name: true } },
      },
    });
    return NextResponse.json({
      raffle: { ...raffle, ticketsNeeded: ticketsNeeded(raffle) },
      tickets: tickets.map(({ participant, ...t }) => ({ ...t, participantName: participant.name })),
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading draw:', error);
    return NextResponse.json({ error: 'Error al cargar el sorteo' }, { status: 500 });
  }
}

// Sacar el siguiente boleto (azar criptografico en el servidor)
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'edit');
    const { id } = await params;
    const result = await drawNextTicket(id, access.tenantId);

    const user = await getSessionUser();
    if (user) {
      const t = result.ticket;
      await logAudit({
        tenantId: access.tenantId,
        userId: user.id,
        userName: user.name,
        action: 'UPDATE',
        entity: 'raffles',
        entityId: id,
        changes: {
          _context: `Sorteo: salió el boleto #${t.number}`,
          participante: { old: null, new: t.participantName },
          ...(t.prizeIndex !== null && { lugar: { old: null, new: `${t.prizeIndex + 1}° lugar` } }),
          ...(result.finalWinner && { ganador: { old: null, new: `#${result.finalWinner.number} ${result.finalWinner.participantName}` } }),
        },
      });
    }
    // Quien vea la rifa en otra pantalla se entera en vivo
    publishToTenant(access.tenantId, 'raffle-draw', { raffleId: id, ...result });

    return NextResponse.json(result);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    const known = ERRORS[(error as Error)?.message];
    if (known) return NextResponse.json({ error: known[0] }, { status: known[1] });
    console.error('Error drawing ticket:', error);
    return NextResponse.json({ error: 'No se pudo sacar el boleto. Intenta de nuevo.' }, { status: 500 });
  }
}

// Reiniciar el sorteo (p. ej. despues de un ensayo): todos los boletos vuelven a la tombola
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'edit');
    const { id } = await params;
    const raffle = await prisma.raffle.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!raffle) return NextResponse.json({ error: 'Rifa no encontrada' }, { status: 404 });

    await prismaBase.$transaction([
      prismaBase.raffleTicket.updateMany({ where: { raffleId: id }, data: { drawnOrder: null, drawnAt: null, prizeIndex: null } }),
      prismaBase.raffle.update({ where: { id }, data: { status: 'OPEN' } }),
    ]);
    publishToTenant(access.tenantId, 'raffle-draw', { raffleId: id, reset: true });
    const user = await getSessionUser();
    if (user) {
      await logAudit({
        tenantId: access.tenantId,
        userId: user.id,
        userName: user.name,
        action: 'UPDATE',
        entity: 'raffles',
        entityId: id,
        changes: { _context: 'Sorteo reiniciado: todos los boletos regresaron a la tómbola' },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error resetting draw:', error);
    return NextResponse.json({ error: 'Error al reiniciar el sorteo' }, { status: 500 });
  }
}
