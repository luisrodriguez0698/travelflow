import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('usuarios');
    const { id } = await params;
    const body = await request.json();
    const { name, permissions } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Nombre y permisos requeridos' },
        { status: 400 }
      );
    }

    const role = await prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    // Check name uniqueness (exclude self)
    const duplicate = await prisma.role.findFirst({
      where: { tenantId, name, NOT: { id } },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Ya existe un rol con ese nombre' },
        { status: 400 }
      );
    }

    const updated = await prisma.role.update({
      where: { id },
      data: { name, permissions },
      include: { _count: { select: { users: true, invitations: true } } },
    });

    // Update the role name string on all users with this role
    await prisma.user.updateMany({
      where: { roleId: id },
      data: { role: name },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('usuarios');
    const { id } = await params;

    const role = await prisma.role.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }

    if (role.isDefault) {
      return NextResponse.json(
        { error: 'No se puede eliminar un rol predeterminado' },
        { status: 400 }
      );
    }

    if (role._count.users > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: ${role._count.users} usuario(s) tienen este rol asignado` },
        { status: 400 }
      );
    }

    await prisma.role.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Rol eliminado' });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
  }
}
