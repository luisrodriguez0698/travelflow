import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { raffleSchema, drawStarted } from '@/lib/raffles';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas');
    const { id } = await params;
    const raffle = await prisma.raffle.findFirst({
      where: { id, tenantId: access.tenantId },
      include: { bankAccount: { select: { id: true, referenceName: true, bankName: true } } },
    });
    if (!raffle) return NextResponse.json({ error: 'Rifa no encontrada' }, { status: 404 });

    // "Solo lo suyo": cada agente ve sus propios participantes
    const participants = await prisma.raffleParticipant.findMany({
      where: { raffleId: id, ...(access.ownOnly && { sellerId: access.userId }) },
      orderBy: { createdAt: 'asc' },
      include: {
        seller: { select: { id: true, name: true, email: true, avatar: true } },
        tickets: { select: { number: true, drawnOrder: true, prizeIndex: true }, orderBy: { number: 'asc' } },
      },
    });
    const [ticketsCount, drawnCount] = await Promise.all([
      prisma.raffleTicket.count({ where: { raffleId: id } }),
      prisma.raffleTicket.count({ where: { raffleId: id, drawnOrder: { not: null } } }),
    ]);
    return NextResponse.json({ ...raffle, participants, ticketsCount, drawnCount, started: drawnCount > 0 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching raffle:', error);
    return NextResponse.json({ error: 'Error al cargar la rifa' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'edit');
    const { id } = await params;
    const existing = await prisma.raffle.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: 'Rifa no encontrada' }, { status: 404 });

    const parsed = raffleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const { acceptTerms: _accepted, ...data } = parsed.data;

    // Con el sorteo iniciado ya no se cambian las reglas (seria injusto)
    if (await drawStarted(id)) {
      const changedRules =
        data.drawMode !== existing.drawMode ||
        (data.drawMode === 'NTH' && data.drawPosition !== existing.drawPosition) ||
        data.prizes.length !== existing.prizes.length;
      if (changedRules) {
        return NextResponse.json(
          { error: 'El sorteo ya empezó: no se pueden cambiar el modo ni el número de premios. Reinícialo si es necesario.' },
          { status: 400 }
        );
      }
    }
    if (data.sellTickets && data.bankAccountId) {
      const bank = await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId, ...access.bankScope } });
      if (!bank) return NextResponse.json({ error: 'Cuenta bancaria no válida' }, { status: 400 });
    }

    const raffle = await prisma.raffle.update({
      where: { id },
      data: {
        ...data,
        drawPosition: data.drawMode === 'NTH' ? data.drawPosition : null,
        ticketPrice: data.sellTickets ? data.ticketPrice : null,
        bankAccountId: data.sellTickets ? data.bankAccountId || null : null,
        autoMinAmount: data.autoTickets ? data.autoMinAmount : null,
        termsAcceptedBy: access.userId,
        termsAcceptedAt: new Date(),
      },
    });
    return NextResponse.json(raffle);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating raffle:', error);
    return NextResponse.json({ error: 'Error al actualizar la rifa' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'delete');
    const { id } = await params;
    const existing = await prisma.raffle.findFirst({ where: { id, tenantId: access.tenantId } });
    if (!existing) return NextResponse.json({ error: 'Rifa no encontrada' }, { status: 404 });
    await prisma.raffle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting raffle:', error);
    return NextResponse.json({ error: 'Error al eliminar la rifa' }, { status: 500 });
  }
}
