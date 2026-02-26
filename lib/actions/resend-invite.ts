'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';

export async function resendInvite(invitationId: string) {
  const tenantId = await requirePermission('usuarios');
  const sessionUser = await getSessionUser();

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId, status: 'PENDING' },
    include: { role: { select: { name: true } } },
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

  // Resend email via Brevo
  const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const INVITE_LINK = `${BASE_URL}/auth/accept-invite?token=${invitation.token}`;

  try {
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: parseInt(process.env.BREVO_TEMPLATE_ID || '1'),
        to: [{ email: invitation.email }],
        sender: { name: 'TravelFlow', email: process.env.BREVO_SENDER_EMAIL || '' },
        params: { INVITE_LINK },
      }),
    });

    if (!brevoResponse.ok) {
      console.error('Brevo error on resend:', await brevoResponse.text());
    }
  } catch (err) {
    console.error('Error resending email via Brevo:', err);
  }

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
