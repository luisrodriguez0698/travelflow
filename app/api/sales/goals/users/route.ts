import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { ALL_MODULES, can, resolvePermissionList } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// Personas que aparecen en Metas: quienes VENDEN (rol con "Ventas -> Crear").
// Tambien quien ya tiene una meta o ventas registradas, para no esconder su
// historial si despues le cambian el rol (p. ej. un Contador que solo cobra).
export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('ventas');
    const tenantId = access.tenantId;

    const [users, goalOwners, sellers] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          roleRef: { select: { permissions: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.salesGoal.findMany({ where: { tenantId }, select: { userId: true }, distinct: ['userId'] }),
      prisma.booking.findMany({
        where: { tenantId, type: 'SALE', createdBy: { not: null } },
        select: { createdBy: true },
        distinct: ['createdBy'],
      }),
    ]);

    const withHistory = new Set<string>([
      ...goalOwners.map((g) => g.userId),
      ...sellers.map((s) => s.createdBy as string),
    ]);

    const result = users
      .filter((u) => {
        const permissions = u.roleRef
          ? resolvePermissionList(u.roleRef.permissions)
          : u.role === 'ADMIN'
            ? resolvePermissionList([...ALL_MODULES])
            : [];
        return can(permissions, 'ventas', 'create') || withHistory.has(u.id);
      })
      .map(({ roleRef: _roleRef, ...u }) => u);

    return NextResponse.json(result);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
  }
}
