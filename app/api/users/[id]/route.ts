import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('usuarios');
    const sessionUser = await getSessionUser();
    const { id } = await params;
    const body = await request.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json({ error: 'Rol requerido' }, { status: 400 });
    }

    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      include: { roleRef: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verify role belongs to tenant
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { roleId, role: role.name },
      include: { roleRef: { select: { id: true, name: true } } },
    });

    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'users',
        entityId: id,
        changes: {
          role: { old: user.roleRef?.name || user.role, new: role.name },
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
