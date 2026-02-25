'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';

export async function sendInvite(email: string, roleId: string) {
  const tenantId = await requirePermission('usuarios');
  const sessionUser = await getSessionUser();

  if (!email || !roleId) {
    throw new Error('Email y rol requeridos');
  }

  // Check email not already a user in this tenant
  const existingUser = await prisma.user.findFirst({
    where: { email, tenantId },
  });

  if (existingUser) {
    throw new Error('Este usuario ya existe en tu agencia');
  }

  // Check no pending invitation for same email in this tenant
  const pendingInvite = await prisma.invitation.findFirst({
    where: { email, tenantId, status: 'PENDING' },
  });

  if (pendingInvite) {
    throw new Error('Ya existe una invitación pendiente para este email');
  }

  // Validate roleId belongs to tenant
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
  });

  if (!role) {
    throw new Error('Rol no válido');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: { tenantId, email, roleId, expiresAt },
  });

  // Send email via Brevo API v3
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
        to: [{ email }],
        sender: { name: 'TravelFlow', email: process.env.BREVO_SENDER_EMAIL || '' },
        params: { INVITE_LINK },
      }),
    });

    if (!brevoResponse.ok) {
      console.error('Brevo error:', await brevoResponse.text());
    }
  } catch (err) {
    console.error('Error sending email via Brevo:', err);
  }

  if (sessionUser) {
    await logAudit({
      tenantId,
      userId: sessionUser.id,
      userName: sessionUser.name,
      action: 'CREATE',
      entity: 'invitations',
      entityId: invitation.id,
      changes: { email, role: role.name },
    });
  }

  return { success: true, invitationId: invitation.id };
}
