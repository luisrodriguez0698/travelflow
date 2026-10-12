import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Catalogos para los formularios de rifas (clientes, agentes, cuentas). Va
 * aparte de /api/clients y /api/users porque quien maneja rifas no siempre
 * tiene esos modulos; se respeta "solo lo suyo".
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('rifas');
    const search = (new URL(request.url).searchParams.get('search') || '').trim().slice(0, 80);

    const [clients, sellers, banks] = await Promise.all([
      prisma.client.findMany({
        where: {
          ...access.clientScope,
          ...(search && {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }),
        },
        orderBy: { fullName: 'asc' },
        take: 20,
        select: { id: true, fullName: true, phone: true },
      }),
      access.ownOnly
        ? []
        : prisma.user.findMany({
            where: { tenantId: access.tenantId, deletedAt: null, isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, email: true, avatar: true },
          }),
      prisma.bankAccount.findMany({
        where: { tenantId: access.tenantId, deletedAt: null, isActive: true },
        orderBy: { referenceName: 'asc' },
        select: { id: true, referenceName: true, bankName: true },
      }),
    ]);
    return NextResponse.json({ clients, sellers, banks, ownOnly: access.ownOnly, me: access.userId });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading raffle options:', error);
    return NextResponse.json({ error: 'Error al cargar las opciones' }, { status: 500 });
  }
}
