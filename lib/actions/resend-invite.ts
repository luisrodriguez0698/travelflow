'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';
import { sendInviteEmail } from '@/lib/emails/invite-email';
import type { InviteResult } from './send-invite';

// Devuelve el error en vez de lanzarlo (ver send-invite.ts).
// roleId opcional: al reenviar desde "Invitar usuario" con otro rol, se actualiza.
export async function resendInvite(invitationId: string, roleId?: string): Promise<InviteResult> {
  try {
    let tenantId: string;
    try {
      tenantId = await requirePermission('usuarios', 'create');
    } catch {
      return { success: false, error: 'No tienes permiso para reenviar invitaciones' };
    }
    const sessionUser = await getSessionUser();

    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, tenantId, status: 'PENDING' },
      include: { role: { select: { name: true } }, tenant: { select: { name: true } } },
    });

    if (!invitation) {
      return { success: false, error: 'Invitación no encontrada o ya no está pendiente' };
    }

    let roleName = invitation.role.name;
    if (roleId && roleId !== invitation.roleId) {
      const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
      if (!role) return { success: false, error: 'Rol no válido' };
      roleName = role.name;
    }

    // Extend expiry 7 days from now (also serves as "last sent" timestamp)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { expiresAt, ...(roleId && roleId !== invitation.roleId && { roleId }) },
    });

    await sendInviteEmail({
      to: invitation.email,
      token: invitation.token,
      tenantName: invitation.tenant.name,
      roleName,
      inviterName: sessionUser?.name,
    });

    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'UPDATE',
        entity: 'invitations',
        entityId: invitationId,
        changes: {
          email: invitation.email,
          action: 'resend',
          ...(roleName !== invitation.role.name && { role: { old: invitation.role.name, new: roleName } }),
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error resending invite:', error);
    return { success: false, error: 'No se pudo reenviar la invitación. Intenta de nuevo.' };
  }
}
