import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prismaBase } from '@/lib/prisma';
import { notifyActivity } from '@/lib/activity';
import { publishEventChange, rsvpClosedReason } from '@/lib/special-events';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  response: z.enum(['CONFIRMED', 'DECLINED']),
  note: z.string().trim().max(300).optional().nullable(),
});

/** El invitado confirma o avisa que no podra asistir (con su link personal). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
    const { token, response, note } = parsed.data;

    const guest = await prismaBase.eventGuest.findFirst({
      where: { token, eventId: id },
      select: {
        id: true,
        name: true,
        status: true,
        tenantId: true,
        supplier: { select: { name: true } },
        event: { select: { id: true, name: true, status: true, startsAt: true, rsvpDeadline: true } },
      },
    });
    if (!guest) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });

    const closed = rsvpClosedReason(guest.event);
    if (closed) return NextResponse.json({ error: closed }, { status: 400 });

    await prismaBase.eventGuest.update({
      where: { id: guest.id },
      data: { status: response, respondedAt: new Date(), note: note || null },
    });

    if (guest.status !== response) {
      publishEventChange(guest.tenantId, id);
      const who = guest.supplier ? `${guest.name} (${guest.supplier.name})` : guest.name;
      await notifyActivity({
        tenantId: guest.tenantId,
        actor: { id: '', name: guest.name },
        type: 'EVENT_RSVP',
        title: response === 'CONFIRMED' ? `🎉 ${guest.name} confirmó su asistencia` : `${guest.name} no podrá asistir`,
        body: `${who} · ${guest.event.name}${note ? ` · “${note}”` : ''}`,
        url: `/events/${id}`,
      });
    }

    return NextResponse.json({ success: true, status: response });
  } catch (error) {
    console.error('Error saving RSVP:', error);
    return NextResponse.json({ error: 'No se pudo guardar tu respuesta. Intenta de nuevo.' }, { status: 500 });
  }
}
