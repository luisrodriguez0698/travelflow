import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requirePermission('usuarios');

    const invitations = await prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        role: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: invitations });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Error al obtener invitaciones' }, { status: 500 });
  }
}
