import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { creatorOptions, creatorWhere, idsSortedByCreator, inIdOrder, parseSort, userNames } from '@/lib/list-query';

export const dynamic = 'force-dynamic';

/** Logo: solo una URL https (la que devuelve la subida); cualquier otra cosa se descarta. */
function cleanLogo(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\/\S+$/i.test(value.trim()) && value.length <= 1000 ? value.trim() : null;
}

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

    // Opciones del filtro "Creado por"
    if (searchParams.get('creators') === 'true') {
      const groups = await prisma.supplier.groupBy({ by: ['createdBy'], where: { tenantId }, _count: { _all: true } });
      return NextResponse.json(await creatorOptions(groups, tenantId));
    }

    const and: object[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { serviceType: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    const serviceType = searchParams.get('serviceType');
    if (serviceType) and.push({ serviceType });
    const byCreator = creatorWhere(searchParams);
    if (byCreator) and.push(byCreator);
    const where = { tenantId, ...(and.length ? { AND: and } : {}) };
    const sort = parseSort(searchParams, ['name', 'phone', 'email', 'serviceType', 'createdBy', 'createdAt'] as const, {
      field: 'createdAt',
      dir: 'desc',
    });

    if (all) {
      const suppliers = await prisma.supplier.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true, serviceType: true, logo: true },
      });
      return NextResponse.json(suppliers);
    }

    let suppliers;
    let total: number;
    if (sort.field === 'createdBy') {
      const rows = await prisma.supplier.findMany({ where, select: { id: true, createdBy: true, name: true } });
      const sorted = await idsSortedByCreator(rows.map((r) => ({ ...r, label: r.name })), tenantId, sort.dir, skip, limit);
      total = sorted.total;
      suppliers = inIdOrder(await prisma.supplier.findMany({ where: { id: { in: sorted.pageIds } } }), sorted.pageIds);
    } else {
      const orderBy =
        sort.field === 'phone' || sort.field === 'email'
          ? [{ [sort.field]: { sort: sort.dir, nulls: 'last' as const } }, { name: 'asc' as const }]
          : sort.field === 'serviceType'
            ? [{ serviceType: sort.dir }, { name: 'asc' as const }]
            : sort.field === 'name'
              ? [{ name: sort.dir }]
              : [{ createdAt: sort.dir }];
      [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({ where, orderBy, skip, take: limit }),
        prisma.supplier.count({ where }),
      ]);
    }

    const creatorMap = await userNames(suppliers.map((s) => s.createdBy), tenantId);

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

    const { name, phone, email, serviceType, logo } = body;

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
        logo: cleanLogo(logo),
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
