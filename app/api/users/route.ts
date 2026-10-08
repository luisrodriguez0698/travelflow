import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser, getTenantOwnerId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    // Los usuarios eliminados (borrado logico) no se listan
    const where: any = { tenantId, deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total, totalCount, ownerId] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          isActive: true,
          createdAt: true,
          roleRef: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { tenantId, deletedAt: null } }),
      getTenantOwnerId(tenantId),
    ]);

    return NextResponse.json({
      data: users.map((u) => ({ ...u, isOwner: u.id === ownerId })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalCount,
      },
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios');
    const sessionUser = await getSessionUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    if (sessionUser && id === sessionUser.id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (id === (await getTenantOwnerId(tenantId))) {
      return NextResponse.json(
        { error: 'No se puede eliminar al propietario de la agencia' },
        { status: 400 }
      );
    }

    // Borrado logico: se conserva el registro para que ventas, pagos, etc.
    // sigan mostrando quien los hizo. El email se libera (es unico) para
    // poder volver a invitar a esa persona en el futuro.
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted.${Date.now()}.${user.email}`,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });


    return NextResponse.json({ success: true, message: 'Usuario eliminado' });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
