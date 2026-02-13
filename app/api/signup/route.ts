import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, agencyName, phone, address } = body;

    // Validate required fields
    if (!email || !password || !agencyName || !phone) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
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

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: agencyName,
          email: email,
          phone: phone,
          address: address || '',
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: agencyName,
          tenantId: tenant.id,
          role: 'ADMIN',
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
