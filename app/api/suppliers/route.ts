import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess(['proveedores', 'ventas', 'cotizaciones']);
    const tenantId = access.tenantId;
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { serviceType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    if (all) {
      const suppliers = await prisma.supplier.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true, serviceType: true },
      });
      return NextResponse.json(suppliers);
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    // Fetch creator names
    const creatorIds = [...new Set(suppliers.map((s) => s.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    return NextResponse.json({
      data: suppliers.map((s) => ({
        ...s,
        creatorName: s.createdBy ? creatorMap[s.createdBy] || null : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Error al cargar proveedores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('proveedores', 'create');
    const tenantId = access.tenantId;
    const body = await request.json();

    const { name, phone, email, serviceType } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        serviceType: serviceType || 'OTRO',
        createdBy: sessionUser?.id || null,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}
