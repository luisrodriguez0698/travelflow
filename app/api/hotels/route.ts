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
      const groups = await prisma.hotel.groupBy({ by: ['createdBy'], where: { tenantId }, _count: { _all: true } });
      return NextResponse.json(await creatorOptions(groups, tenantId));
    }

    const all = searchParams.get('all') === 'true';
    const destinationId = searchParams.get('destinationId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const and: object[] = [];
    if (destinationId) and.push({ destinationId });
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { plan: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    const byCreator = creatorWhere(searchParams);
    if (byCreator) and.push(byCreator);
    const where = { tenantId, ...(and.length ? { AND: and } : {}) };
    const include = { destination: { select: { id: true, name: true } } };

    if (all) {
      const hotels = await prisma.hotel.findMany({ where, orderBy: { name: 'asc' }, include });
      return NextResponse.json(hotels);
    }

    const sort = parseSort(searchParams, ['name', 'destination', 'stars', 'plan', 'roomType', 'web', 'createdBy', 'createdAt'] as const, {
      field: 'createdAt',
      dir: 'desc',
    });

    let hotels;
    let total: number;
    if (sort.field === 'createdBy') {
      const rows = await prisma.hotel.findMany({ where, select: { id: true, createdBy: true, name: true } });
      const sorted = await idsSortedByCreator(rows.map((r) => ({ ...r, label: r.name })), tenantId, sort.dir, skip, limit);
      total = sorted.total;
      hotels = inIdOrder(await prisma.hotel.findMany({ where: { id: { in: sorted.pageIds } }, include }), sorted.pageIds);
    } else {
      const orderBy =
        sort.field === 'destination'
          ? [{ destination: { name: sort.dir } }, { name: 'asc' as const }]
          : sort.field === 'stars'
            ? [{ stars: sort.dir }, { diamonds: sort.dir }, { name: 'asc' as const }]
            : sort.field === 'web'
              ? [{ showInWeb: sort.dir }, { name: 'asc' as const }]
              : sort.field === 'plan' || sort.field === 'roomType' || sort.field === 'name'
                ? [{ [sort.field]: sort.dir }, ...(sort.field === 'name' ? [] : [{ name: 'asc' as const }])]
                : [{ createdAt: sort.dir }];
      [hotels, total] = await Promise.all([
        prisma.hotel.findMany({ where, orderBy, skip, take: limit, include }),
        prisma.hotel.count({ where }),
      ]);
    }

    const names = await userNames(hotels.map((h) => h.createdBy), tenantId);
    return NextResponse.json({
      data: hotels.map((h) => ({ ...h, creatorName: h.createdBy ? names[h.createdBy] || null : null })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching hotels:', error);
    return NextResponse.json({ error: 'Error al cargar hoteles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos', 'create');
    const body = await request.json();
    const { name, destinationId } = body;

    if (!name || !destinationId) {
      return NextResponse.json({ error: 'Nombre y destino son requeridos' }, { status: 400 });
    }

    const destination = await prisma.destination.findFirst({
      where: { id: destinationId, tenantId },
    });
    if (!destination) {
      return NextResponse.json({ error: 'Destino no encontrado' }, { status: 404 });
    }

    const sessionUser = await getSessionUser();

    const hotel = await prisma.hotel.create({
      data: {
        tenantId,
        destinationId,
        name: name.trim(),
        stars: body.stars || 0,
        diamonds: body.diamonds || 0,
        plan: body.plan?.trim() || '',
        roomType: body.roomType?.trim() || '',
        checkIn: body.checkIn?.trim() || '',
        checkOut: body.checkOut?.trim() || '',
        checkInNote: body.checkInNote?.trim() || null,
        checkOutNote: body.checkOutNote?.trim() || null,
        idRequirement: body.idRequirement?.trim() || null,
        includes: body.includes || [],
        notIncludes: body.notIncludes || [],
        images: body.images || [],
        webDescription: body.webDescription?.trim() || null,
        packagePrice: body.packagePrice != null ? Number(body.packagePrice) : null,
        packageCurrency: body.packageCurrency || 'MXN',
        showInWeb: body.showInWeb !== undefined ? Boolean(body.showInWeb) : true,
        createdBy: sessionUser?.id || null,
      },
      include: { destination: { select: { id: true, name: true } } },
    });

    return NextResponse.json(hotel, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating hotel:', error);
    return NextResponse.json({ error: 'Error al crear hotel' }, { status: 500 });
  }
}
