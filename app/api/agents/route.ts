import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const USER_SELECT = { id: true, name: true, email: true, avatar: true } as const;

/**
 * Agentes para el selector de ventas/cotizaciones. Con permiso "Asignar" se
 * devuelven todos los usuarios activos; sin el, solo el usuario actual y el
 * agente actual del registro (?current=), para mostrarlo sin poder cambiarlo.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module') === 'cotizaciones' ? 'cotizaciones' : 'ventas';
    const current = searchParams.get('current');
    const access = await requireAccess(module);
    const canAssign = access.can(module, 'assign');

    const agents = await prisma.user.findMany({
      where: canAssign
        ? { tenantId: access.tenantId, deletedAt: null, isActive: true }
        : { tenantId: access.tenantId, id: { in: [access.userId, ...(current ? [current] : [])] } },
      orderBy: { name: 'asc' },
      select: USER_SELECT,
    });
    // Si el agente actual ya no esta activo, igual se muestra (sin poder elegirlo de nuevo)
    if (canAssign && current && !agents.some((a) => a.id === current)) {
      const former = await prisma.user.findFirst({ where: { id: current, tenantId: access.tenantId }, select: USER_SELECT });
      if (former) agents.push(former);
    }
    return NextResponse.json({ canAssign, me: access.userId, agents });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading agents:', error);
    return NextResponse.json({ error: 'Error al cargar agentes' }, { status: 500 });
  }
}
