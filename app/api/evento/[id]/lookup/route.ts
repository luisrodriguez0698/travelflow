import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { attemptsBlocked, clearAttempts, registerFailedAttempt } from '@/lib/client-portal';
import { phoneKey } from '@/lib/special-events';
import { parsePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/** El invitado escribe su telefono y recibe su pase (token de su link personal). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const key = `event:${id}:${ip}`;

  const blockedMinutes = attemptsBlocked(key);
  if (blockedMinutes) {
    return NextResponse.json({ error: `Demasiados intentos. Intenta de nuevo en ${blockedMinutes} min.` }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  const { national } = parsePhone(phone);

  const guest =
    national.length >= 7 && id.length <= 40
      ? await prismaBase.eventGuest.findFirst({ where: { eventId: id, phoneKey: phoneKey(phone) }, select: { token: true } })
      : null;

  if (!guest) {
    const left = registerFailedAttempt(key);
    return NextResponse.json(
      {
        error:
          left > 0
            ? 'No encontramos ese número en la lista de invitados. Revisa que sea el mismo que diste a la agencia.'
            : 'Demasiados intentos. Espera 15 minutos.',
      },
      { status: 404 }
    );
  }

  clearAttempts(key);
  return NextResponse.json({ token: guest.token });
}
