import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { SERVICE_TYPES, serviceSchema, toServiceData } from '@/lib/service-catalog';

export const dynamic = 'force-dynamic';

const supplierSelect = { select: { id: true, name: true, serviceType: true } };

// Lectura abierta a cualquier usuario de la agencia: el catalogo se usa al
// capturar ventas/cotizaciones, no solo desde la pantalla de catalogo.
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search')?.trim() || '';

    const where: any = { tenantId };
    if (type && (SERVICE_TYPES as readonly string[]).includes(type)) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { airline: { contains: search, mode: 'insensitive' } },
        { origin: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { transportType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const services = await prisma.serviceCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { supplier: supplierSelect },
    });

    return NextResponse.json(services);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Error al cargar servicios' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos', 'create');
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

    const sessionUser = await getSessionUser();
    const service = await prisma.serviceCatalog.create({
      data: { ...data, tenantId, createdBy: sessionUser?.id || null },
      include: { supplier: supplierSelect },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Error al crear servicio' }, { status: 500 });
  }
}
