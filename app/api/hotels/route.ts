import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos');
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const destinationId = searchParams.get('destinationId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (destinationId) where.destinationId = destinationId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { plan: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    if (all) {
      const hotels = await prisma.hotel.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { destination: { select: { id: true, name: true } } },
      });
      return NextResponse.json(hotels);
    }

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { destination: { select: { id: true, name: true } } },
      }),
      prisma.hotel.count({ where }),
    ]);

    const creatorIds = [...new Set(hotels.map((h) => h.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    return NextResponse.json({
      data: hotels.map((h) => ({
        ...h,
        creatorName: h.createdBy ? creatorMap[h.createdBy] || null : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return NextResponse.json({ error: 'Error al cargar hoteles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos');
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
        createdBy: sessionUser?.id || null,
      },
      include: { destination: { select: { id: true, name: true } } },
    });

    return NextResponse.json(hotel, { status: 201 });
  } catch (error) {
    console.error('Error creating hotel:', error);
    return NextResponse.json({ error: 'Error al crear hotel' }, { status: 500 });
  }
}
