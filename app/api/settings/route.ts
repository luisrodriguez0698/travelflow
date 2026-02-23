import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Obtener configuración de la agencia
export async function GET() {
  try {
    const tenantId = await requireTenantId();

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logo: true,
        email: true,
        phone: true,
        address: true,
        policies: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

// Actualizar configuración de la agencia
export async function PUT(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const { name, logo, email, phone, address, policies } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la agencia es obligatorio' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: name.trim(),
        logo: logo || null,
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        address: address?.trim() || null,
        policies: policies?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        logo: true,
        email: true,
        phone: true,
        address: true,
        policies: true,
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
