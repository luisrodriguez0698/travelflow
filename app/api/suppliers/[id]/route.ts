import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Logo: solo una URL https (la que devuelve la subida); cualquier otra cosa se descarta. */
function cleanLogo(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\/\S+$/i.test(value.trim()) && value.length <= 1000 ? value.trim() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess(['proveedores', 'ventas', 'cotizaciones']);
    const tenantId = access.tenantId;
    const { id } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching supplier:', error);
    return NextResponse.json({ error: 'Error al cargar proveedor' }, { status: 500 });
  }
}

async function updateSupplier(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireAccess('proveedores', 'edit');
    const tenantId = access.tenantId;
    const { id } = await params;
    const body = await request.json();

    const { name, phone, email, serviceType, logo } = body;

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
        // Sin el campo en el cuerpo, el logo se conserva
        ...(logo !== undefined && { logo: cleanLogo(logo) }),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Proveedor actualizado' });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
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
    const access = await requireAccess('proveedores', 'delete');
    const tenantId = access.tenantId;
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
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 });
  }
}
