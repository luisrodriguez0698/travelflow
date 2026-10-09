import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

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

    // Un correo solo puede pertenecer a una agencia: si ya tiene cuenta, la
    // invitacion nunca podra aceptarse y se marca para que se cancele.
    const pendingEmails = invitations.filter((i) => i.status === 'PENDING').map((i) => i.email.toLowerCase());
    const existingUsers = pendingEmails.length
      ? await prisma.user.findMany({
          where: { email: { in: pendingEmails, mode: 'insensitive' } },
          select: { email: true, tenantId: true },
        })
      : [];
    const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));
    const now = new Date();

    const data = invitations.map((inv) => {
      const user = inv.status === 'PENDING' ? userByEmail.get(inv.email.toLowerCase()) : undefined;
      return {
        ...inv,
        // Pendiente pero vencida: se muestra como expirada
        status: inv.status === 'PENDING' && inv.expiresAt < now ? 'EXPIRED' : inv.status,
        blockedReason: user
          ? user.tenantId === tenantId
            ? 'Este correo ya es usuario de tu agencia'
            : 'Este correo ya tiene cuenta en TravelFlow con otra agencia'
          : null,
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Error al obtener invitaciones' }, { status: 500 });
  }
}

// Cancelar una invitacion que aun no se acepta (el enlace del correo deja de funcionar)
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await requirePermission('usuarios', 'delete');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const invitation = await prisma.invitation.findFirst({
      where: { id, tenantId },
      include: { role: { select: { name: true } } },
    });
    if (!invitation) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'La invitación ya fue aceptada' }, { status: 400 });
    }

    await prisma.invitation.delete({ where: { id } });

    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'DELETE',
        entity: 'invitations',
        entityId: id,
        changes: { email: invitation.email, role: invitation.role.name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error deleting invitation:', error);
    return NextResponse.json({ error: 'Error al cancelar la invitación' }, { status: 500 });
  }
}
