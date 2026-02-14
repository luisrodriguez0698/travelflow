import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requirePermission('usuarios');

    const roles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { users: true, invitations: true } },
      },
    });

    return NextResponse.json({ data: roles });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios');
    const body = await request.json();
    const { name, permissions } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Nombre y permisos requeridos' },
        { status: 400 }
      );
    }

    // Check unique name within tenant
    const existing = await prisma.role.findFirst({
      where: { tenantId, name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un rol con ese nombre' },
        { status: 400 }
      );
    }

    const role = await prisma.role.create({
      data: { tenantId, name, permissions },
      include: { _count: { select: { users: true, invitations: true } } },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
  }
}
