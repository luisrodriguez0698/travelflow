import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Avisos de actividad del usuario en sesion. La campana lo consulta cada ~15 s,
// asi que debe ser ligero: ultimos 30 + conteo de no leidos.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.activityNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, type: true, title: true, body: true, url: true, read: true, actorName: true, createdAt: true },
    }),
    prisma.activityNotification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ items, unread });
}

// Marcar como leidos: { ids: [...] } o { all: true }
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === 'string').slice(0, 100) : [];
  if (!body.all && ids.length === 0) {
    return NextResponse.json({ error: 'Nada que marcar' }, { status: 400 });
  }

  await prisma.activityNotification.updateMany({
    where: { userId: user.id, read: false, ...(body.all ? {} : { id: { in: ids } }) },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
