import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { setEditing, editorsOf } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

// "Fulano esta editando esta venta": la pantalla de edicion avisa al entrar y
// al salir. Al cerrar la pestaña tambien se limpia (al cortarse su conexion SSE).
const RESOURCE = /^(sales|quotations):[a-z0-9]{10,40}$/;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const resource = typeof body.resource === 'string' ? body.resource : '';
  if (!RESOURCE.test(resource)) return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });

  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, avatar: true } });
  setEditing(
    user.tenantId, // la clave incluye la agencia: nunca se mezclan agencias
    resource,
    { id: user.id, name: profile?.name || profile?.email || user.name, avatar: profile?.avatar ?? null },
    body.active !== false
  );

  return NextResponse.json({ editors: editorsOf(user.tenantId, resource) });
}
