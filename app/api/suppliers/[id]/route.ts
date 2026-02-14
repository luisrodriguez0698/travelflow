import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json({ error: 'Error al cargar proveedor' }, { status: 500 });
  }
}

async function updateSupplier(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const { name, phone, email, serviceType } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    const result = await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: {
        name,
        phone,
        email: email || null,
        serviceType: serviceType || 'OTRO',
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Proveedor actualizado' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return updateSupplier(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return updateSupplier(request, context);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const hasBookings = await prisma.booking.findFirst({
      where: { supplierId: id, tenantId },
    });

    if (hasBookings) {
      return NextResponse.json(
        { error: 'No se puede eliminar un proveedor con ventas asignadas' },
        { status: 400 }
      );
    }

    const result = await prisma.supplier.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Proveedor eliminado' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 });
  }
}
