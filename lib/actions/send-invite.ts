'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { logAudit } from '@/lib/audit';
import { sendInviteEmail } from '@/lib/emails/invite-email';

const MAX_USERS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PendingInvite {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  /** Ultimo envio (ISO): expiresAt - 7 dias */
  sentAt: string;
}

export type InviteResult =
  | { success: true; invitationId?: string }
  | { success: false; error: string; code?: 'PENDING_INVITE'; pending?: PendingInvite };

// Las server actions NO deben lanzar errores esperados: en produccion Next.js
// oculta el mensaje ("An error occurred in the Server Components render").
// Se devuelven como { success: false, error } para mostrarlos en pantalla.
export async function sendInvite(rawEmail: string, roleId: string): Promise<InviteResult> {
  try {
    let tenantId: string;
    try {
      tenantId = await requirePermission('usuarios');
    } catch {
      return { success: false, error: 'No tienes permiso para invitar usuarios' };
    }
    const sessionUser = await getSessionUser();

    const email = (rawEmail || '').trim().toLowerCase();
    if (!email || !roleId) return { success: false, error: 'Correo y rol son requeridos' };
    if (!EMAIL_RE.test(email)) return { success: false, error: 'El correo no es válido' };

    const userCount = await prisma.user.count({ where: { tenantId, deletedAt: null } });
    if (userCount >= MAX_USERS) {
      return { success: false, error: `Tu agencia ha alcanzado el límite de ${MAX_USERS} usuarios` };
    }

    // El correo es unico en todo el sistema: si ya tiene cuenta (aqui o en otra
    // agencia) la invitacion no podria aceptarse.
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { tenantId: true },
    });
    if (existingUser) {
      return {
        success: false,
        error: existingUser.tenantId === tenantId
          ? 'Este correo ya es usuario de tu agencia'
          : 'Este correo ya tiene una cuenta en TravelFlow con otra agencia',
      };
    }

    const pendingInvite = await prisma.invitation.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, tenantId, status: 'PENDING' },
      include: { role: { select: { name: true } } },
    });
    if (pendingInvite) {
      if (pendingInvite.expiresAt > new Date()) {
        // La pantalla ofrece reenviarla en lugar de mostrar un error
        return {
          success: false,
          code: 'PENDING_INVITE',
          error: 'Ya hay una invitación pendiente para este correo',
          pending: {
            id: pendingInvite.id,
            email: pendingInvite.email,
            roleId: pendingInvite.roleId,
            roleName: pendingInvite.role.name,
            sentAt: new Date(pendingInvite.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        };
      }
      // Vencida: se marca y se permite enviar una nueva
      await prisma.invitation.update({ where: { id: pendingInvite.id }, data: { status: 'EXPIRED' } });
    }

    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) return { success: false, error: 'Rol no válido' };

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
  } catch (error) {
    console.error('Error sending invite:', error);
    return { success: false, error: 'No se pudo enviar la invitación. Intenta de nuevo.' };
  }
}
