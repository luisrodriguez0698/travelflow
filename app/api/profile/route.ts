import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSessionUser, getTenantOwnerId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } from '@/lib/password';

export const dynamic = 'force-dynamic';

// Perfil del usuario en sesion: cualquier usuario puede editar sus propios
// datos, sin depender de los permisos de su rol.
const profileSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('info'),
    name: z.string().trim().min(1, 'El nombre es requerido').max(120),
    phone: z.string().trim().max(30).nullable().optional(),
  }),
  z.object({
    type: z.literal('email'),
    email: z.string().trim().toLowerCase().email('Correo inválido'),
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  }),
  z.object({
    type: z.literal('password'),
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE),
  }),
]);

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: sessionUser.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      roleRef: { select: { name: true } },
      role: true,
      tenant: { select: { name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    roleName: user.roleRef?.name || user.role,
    tenantName: user.tenant.name,
    isOwner: user.id === (await getTenantOwnerId(sessionUser.tenantId)),
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const body = parsed.data;

    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, deletedAt: null },
    });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Cambiar correo o contraseña exige la contraseña actual
    if (body.type === 'email' || body.type === 'password') {
      const rl = rateLimit(`profile-password:${user.id}`, 5, 15 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Demasiados intentos. Intenta de nuevo en ${rl.retryAfterSeconds} segundos.` },
          { status: 429 }
        );
      }
      const valid = await bcrypt.compare(body.currentPassword, user.password);
      if (!valid) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
      }
    }

    if (body.type === 'info') {
      const phone = body.phone || null;
      await prisma.user.update({
        where: { id: user.id },
        data: { name: body.name, phone },
      });
    } else if (body.type === 'email') {
      if (body.email === user.email.toLowerCase()) {
        return NextResponse.json({ error: 'Ese ya es tu correo actual' }, { status: 400 });
      }
      const taken = await prisma.user.findFirst({
        where: { email: { equals: body.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { email: body.email },
      });
    } else {
      if (await bcrypt.compare(body.newPassword, user.password)) {
        return NextResponse.json(
          { error: 'La nueva contraseña debe ser diferente a la actual' },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(body.newPassword, 12),
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 });
  }
}
