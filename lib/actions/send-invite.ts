'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';
import { sendInviteEmail } from '@/lib/emails/invite-email';

const MAX_USERS = 5;

export async function sendInvite(email: string, roleId: string) {
  const tenantId = await requirePermission('usuarios');
  const sessionUser = await getSessionUser();

  if (!email || !roleId) {
    throw new Error('Email y rol requeridos');
  }

  // Check tenant user limit
  const userCount = await prisma.user.count({ where: { tenantId, deletedAt: null } });
  if (userCount >= MAX_USERS) {
    throw new Error(`Tu agencia ha alcanzado el límite de ${MAX_USERS} usuarios`);
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

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  await sendInviteEmail({
    to: email,
    token: invitation.token,
    tenantName: tenant?.name || 'tu agencia',
    roleName: role.name,
    inviterName: sessionUser?.name,
  });

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
