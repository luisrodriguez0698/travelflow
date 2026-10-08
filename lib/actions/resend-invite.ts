'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';
import { sendInviteEmail } from '@/lib/emails/invite-email';

export async function resendInvite(invitationId: string) {
  const tenantId = await requirePermission('usuarios');
  const sessionUser = await getSessionUser();

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId, status: 'PENDING' },
    include: { role: { select: { name: true } }, tenant: { select: { name: true } } },
  });

  if (!invitation) {
    throw new Error('Invitación no encontrada o ya no está pendiente');
  }

  // Extend expiry 7 days from now (also serves as "last sent" timestamp)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { expiresAt },
  });

  await sendInviteEmail({
    to: invitation.email,
    token: invitation.token,
    tenantName: invitation.tenant.name,
    roleName: invitation.role.name,
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
      changes: { email: invitation.email, action: 'resend' },
    });
  }

  return { success: true };
}
