import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { DEFAULT_ROLES } from '@/lib/permissions';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const signupSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres'),
  agencyName: z.string().min(1, 'El nombre de la agencia es requerido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { email, password, agencyName, phone, address } = parsed.data;

    // Rate limit: 5 registros por IP por hora
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados registros desde esta dirección. Intenta de nuevo más tarde.' },
        { status: 429 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este correo ya está registrado' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create tenant, user, and default roles in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: {
          name: agencyName,
          email: email,
          phone: phone,
          address: address || '',
        },
      });

      // Create default roles
      const createdRoles = [];
      for (const roleData of DEFAULT_ROLES) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleData.name,
            permissions: roleData.permissions,
            isDefault: roleData.isDefault,
          },
        });
        createdRoles.push(role);
      }

      // Find Admin role
      const adminRole = createdRoles.find((r: any) => r.name === 'Admin');

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: agencyName,
          tenantId: tenant.id,
          role: 'Admin',
          roleId: adminRole?.id,
        },
      });

      return { tenant, user };
    });

    return NextResponse.json(
      {
        message: 'Agencia registrada exitosamente',
        tenantId: result.tenant.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Error al registrar la agencia' },
      { status: 500 }
    );
  }
}
