import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { creatorOptions, creatorWhere, idsSortedByCreator, inIdOrder, parseSort, userNames } from '@/lib/list-query';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess(['destinos', 'ventas', 'cotizaciones']);
    const tenantId = access.tenantId;
    const { searchParams } = new URL(request.url);

    // Opciones del filtro "Creado por"
    if (searchParams.get('creators') === 'true') {
      const groups = await prisma.destination.groupBy({ by: ['createdBy'], where: { tenantId }, _count: { _all: true } });
      return NextResponse.json(await creatorOptions(groups, tenantId));
    }

    // page/limit are opt-in: other consumers (dropdowns) rely on getting the full array
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const paginated = pageParam !== null || limitParam !== null;
    const page = parseInt(pageParam || '1', 10);
    const limit = parseInt(limitParam || '20', 10);
    const search = searchParams.get('search') || '';

    const and: object[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    const byCreator = creatorWhere(searchParams);
    if (byCreator) and.push(byCreator);
    const where = { tenantId, ...(and.length ? { AND: and } : {}) };

    const sort = parseSort(searchParams, ['name', 'season', 'sales', 'createdBy', 'createdAt'] as const, { field: 'name', dir: 'asc' });
    const include = { season: true, _count: { select: { bookings: true } } };

    let destinations;
    let total: number | null = null;
    if (paginated && sort.field === 'createdBy') {
      const rows = await prisma.destination.findMany({ where, select: { id: true, createdBy: true, name: true } });
      const sorted = await idsSortedByCreator(rows.map((r) => ({ ...r, label: r.name })), tenantId, sort.dir, (page - 1) * limit, limit);
      total = sorted.total;
      destinations = inIdOrder(await prisma.destination.findMany({ where: { id: { in: sorted.pageIds } }, include }), sorted.pageIds);
    } else {
      const orderBy =
        sort.field === 'season'
          ? [{ season: { name: sort.dir } }, { name: 'asc' as const }]
          : sort.field === 'sales'
            ? [{ bookings: { _count: sort.dir } }, { name: 'asc' as const }]
            : sort.field === 'createdAt'
              ? [{ createdAt: sort.dir }]
              : [{ name: sort.dir }];
      destinations = await prisma.destination.findMany({
        where,
        include,
        orderBy,
        ...(paginated ? { skip: (page - 1) * limit, take: limit } : {}),
      });
    }

    const names = await userNames(destinations.map((d) => d.createdBy), tenantId);
    const withCreator = destinations.map((d) => ({ ...d, creatorName: d.createdBy ? names[d.createdBy] || null : null }));

    if (!paginated) {
      return NextResponse.json(withCreator);
    }

    total ??= await prisma.destination.count({ where });
    return NextResponse.json({
      data: withCreator,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching destinations:', error);
    return NextResponse.json({ error: 'Error fetching destinations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos', 'create');
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();

    const destination = await prisma.destination.create({
      data: {
        tenantId,
        name: body.name.trim(),
        description: body.description?.trim() || '',
        seasonId: body.seasonId || null,
        createdBy: sessionUser?.id || null,
      },
      include: { season: true },
    });

    return NextResponse.json(destination, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating destination:', error);
    return NextResponse.json({ error: 'Error creating destination' }, { status: 500 });
  }
}
