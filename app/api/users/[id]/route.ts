import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, getSessionUser, getTenantOwnerId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  roleId: z.string().min(1, 'Rol requerido').optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('usuarios');
    const sessionUser = await getSessionUser();
    const { id } = await params;

    const parsed = updateUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { name, phone, roleId, isActive } = parsed.data;

    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { roleRef: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const roleChanged = roleId !== undefined && roleId !== user.roleId;
    const activeChanged = isActive !== undefined && isActive !== user.isActive;

    if (roleChanged || activeChanged) {
      if (sessionUser && id === sessionUser.id) {
        return NextResponse.json(
          { error: 'No puedes cambiar tu propio rol ni desactivarte' },
          { status: 400 }
        );
      }
      if (id === (await getTenantOwnerId(tenantId))) {
        return NextResponse.json(
          { error: 'El propietario de la agencia no puede cambiar de rol ni desactivarse' },
          { status: 400 }
        );
      }
    }

    const data: {
      name?: string;
      phone?: string | null;
      roleId?: string;
      role?: string;
      isActive?: boolean;
    } = {};

    if (name !== undefined && name !== user.name) {
      data.name = name;
    }

    if (phone !== undefined && (phone || null) !== user.phone) {
      data.phone = phone || null;
    }

    if (roleChanged) {
      // Verify role belongs to tenant
      const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId },
      });

      if (!role) {
        return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
      }

      data.roleId = role.id;
      data.role = role.name;
    }

    if (activeChanged) {
      data.isActive = isActive;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { roleRef: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      roleId: updated.roleId,
      isActive: updated.isActive,
      roleRef: updated.roleRef,
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}
