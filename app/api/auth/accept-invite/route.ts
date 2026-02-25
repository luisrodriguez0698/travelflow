import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres'),
  phone: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// Validate invitation token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, reason: 'Token requerido' }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ valid: false, reason: 'Invitación no encontrada' });
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json({ valid: false, reason: 'Esta invitación ya fue aceptada' });
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ valid: false, reason: 'Esta invitación ha expirado' });
    }

    if (invitation.status === 'EXPIRED') {
      return NextResponse.json({ valid: false, reason: 'Esta invitación ha expirado' });
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      tenantName: invitation.tenant.name,
      roleName: invitation.role.name,
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json({ valid: false, reason: 'Error al validar invitación' }, { status: 500 });
  }
}

// Accept invitation and create user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { token, name, password, phone } = parsed.data;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { role: true },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invitación no válida o ya utilizada' },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ error: 'Invitación expirada' }, { status: 400 });
    }

    // Check email not already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este correo ya está registrado' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          name,
          phone: phone || null,
          tenantId: invitation.tenantId,
          roleId: invitation.roleId,
          role: invitation.role.name,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Error al aceptar la invitación' },
      { status: 500 }
    );
  }
}
