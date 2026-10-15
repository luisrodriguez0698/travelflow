import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { publishEventChange } from '@/lib/special-events';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** El QR trae el link personal (…?pase=TOKEN); tambien se acepta el token solo. */
function tokenFromCode(code: string) {
  const raw = code.trim();
  try {
    const fromUrl = new URL(raw).searchParams.get('pase');
    if (fromUrl) return fromUrl;
  } catch {
    // no es URL: puede ser el token directo
  }
  return /^[A-Za-z0-9_-]{20,64}$/.test(raw) ? raw : null;
}

/**
 * Registro de llegada en la entrada (escaneo del QR).
 * result: 'ok' (bienvenido) | 'already' (ya habia entrado) | 'invalid' (no es de este evento)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'edit');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.code === 'string' ? tokenFromCode(body.code) : null;
    if (!token) return NextResponse.json({ result: 'invalid', message: 'Este código no es una invitación' });

    const guest = await prisma.eventGuest.findFirst({
      where: { token, eventId: id, tenantId: access.tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        checkedInAt: true,
        supplier: { select: { name: true, logo: true } },
      },
    });
    if (!guest) return NextResponse.json({ result: 'invalid', message: 'Esta invitación no es de este evento' });

    const info = { id: guest.id, name: guest.name, status: guest.status, supplier: guest.supplier };
    if (guest.checkedInAt) {
      return NextResponse.json({ result: 'already', guest: info, checkedInAt: guest.checkedInAt });
    }

    const updated = await prisma.eventGuest.update({
      where: { id: guest.id },
      // Si llega sin haber confirmado, cuenta como confirmado
      data: { checkedInAt: new Date(), checkedInBy: access.userId, ...(guest.status !== 'CONFIRMED' && { status: 'CONFIRMED', respondedAt: new Date() }) },
      select: { checkedInAt: true },
    });
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json({ result: 'ok', guest: info, checkedInAt: updated.checkedInAt });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error checking in guest:', error);
    return NextResponse.json({ error: 'Error al registrar la llegada' }, { status: 500 });
  }
}
