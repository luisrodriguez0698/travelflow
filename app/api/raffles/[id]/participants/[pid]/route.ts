import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { participantSchema, setParticipantTickets } from '@/lib/raffles';
import { validateParticipant } from '@/lib/raffle-participants';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string; pid: string } };

async function findOwnParticipant(raffleId: string, pid: string, access: { tenantId: string; ownOnly: boolean; userId: string }) {
  return prisma.raffleParticipant.findFirst({
    where: { id: pid, raffleId, tenantId: access.tenantId, ...(access.ownOnly && { sellerId: access.userId }) },
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'edit');
    const { id, pid } = await params;
    const existing = await findOwnParticipant(id, pid, access);
    if (!existing) return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 });

    const parsed = participantSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const body = parsed.data;

    const check = await validateParticipant(access, id, body);
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.raffleParticipant.update({
        where: { id: pid },
        data: {
          name: body.name,
          phone: body.phone || null,
          clientId: body.clientId || null,
          sellerId: check.sellerId,
        },
      });
      await setParticipantTickets(tx, id, pid, body.tickets);
      return p;
    });
    return NextResponse.json(updated);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Error al actualizar el participante' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('rifas', 'delete');
    const { id, pid } = await params;
    const existing = await findOwnParticipant(id, pid, access);
    if (!existing) return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 });

    const check = await validateParticipant(access, id, {});
    if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status });

    await prisma.raffleParticipant.delete({ where: { id: pid } }); // sus boletos se borran en cascada
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting participant:', error);
    return NextResponse.json({ error: 'Error al eliminar el participante' }, { status: 500 });
  }
}
