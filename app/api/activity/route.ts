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

function parseIds(body: { ids?: unknown }): string[] {
  return Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100) : [];
}

// Marcar como leidos: { ids: [...] } o { all: true }. Con { read: false } vuelven a "no leido".
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids = parseIds(body);
  if (!body.all && ids.length === 0) {
    return NextResponse.json({ error: 'Nada que marcar' }, { status: 400 });
  }
  const read = body.read !== false;

  await prisma.activityNotification.updateMany({
    where: { userId: user.id, read: !read, ...(body.all ? {} : { id: { in: ids } }) },
    data: { read },
  });

  return NextResponse.json({ success: true });
}

// Eliminar avisos propios: { ids: [...] } o { read: true } (todos los ya leidos)
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids = parseIds(body);
  if (body.read !== true && ids.length === 0) {
    return NextResponse.json({ error: 'Nada que eliminar' }, { status: 400 });
  }

  const { count } = await prisma.activityNotification.deleteMany({
    where: { userId: user.id, ...(body.read === true ? { read: true } : { id: { in: ids } }) },
  });

  return NextResponse.json({ success: true, count });
}
