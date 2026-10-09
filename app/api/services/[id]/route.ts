import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { serviceSchema, toServiceData } from '@/lib/service-catalog';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('destinos', 'edit');
    const { id } = await params;

    const existing = await prisma.serviceCatalog.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    const parsed = serviceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = toServiceData(parsed.data);
    if (!data.name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, tenantId } });
      if (!supplier) return NextResponse.json({ error: 'Proveedor no válido' }, { status: 400 });
    }

    const service = await prisma.serviceCatalog.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, name: true, serviceType: true } } },
    });

    return NextResponse.json(service);
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Error al actualizar servicio' }, { status: 500 });
  }
}

// Las ventas que lo usaron conservan sus datos (se copiaron al agregarlo);
// solo se pierde la referencia (serviceId -> null).
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requirePermission('destinos', 'delete');
    const { id } = await params;

    const existing = await prisma.serviceCatalog.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    await prisma.serviceCatalog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Error al eliminar servicio' }, { status: 500 });
  }
}
