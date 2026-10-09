import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { sanitizeRolePermissions } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requirePermission('usuarios');

    const roles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { users: { where: { deletedAt: null } }, invitations: true } },
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
    const tenantId = await requirePermission('usuarios', 'create');
    const body = await request.json();
    const { name } = body;
    const ownDataOnly = body.ownDataOnly === true;
    // Formato nuevo; cualquier accion implica "ver"
    const permissions = sanitizeRolePermissions(body.permissions);

    if (!name || permissions.length === 0) {
      return NextResponse.json(
        { error: 'Nombre y al menos un permiso requeridos' },
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
      data: { tenantId, name, permissions, ownDataOnly },
      include: { _count: { select: { users: { where: { deletedAt: null } }, invitations: true } } },
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
