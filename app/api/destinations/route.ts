import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos');
    const { searchParams } = new URL(request.url);
    // page/limit are opt-in: other consumers (dropdowns) rely on getting the full array
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const paginated = pageParam !== null || limitParam !== null;
    const page = parseInt(pageParam || '1', 10);
    const limit = parseInt(limitParam || '20', 10);
    const search = searchParams.get('search') || '';

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const destinations = await prisma.destination.findMany({
      where,
      include: {
        season: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { name: 'asc' },
      ...(paginated ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    // Fetch creator names
    const creatorIds = [...new Set(destinations.map((d) => d.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    const withCreator = destinations.map((d) => ({
      ...d,
      creatorName: d.createdBy ? creatorMap[d.createdBy] || null : null,
    }));

    if (!paginated) {
      return NextResponse.json(withCreator);
    }

    const total = await prisma.destination.count({ where });
    return NextResponse.json({
      data: withCreator,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching destinations:', error);
    return NextResponse.json({ error: 'Error fetching destinations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requirePermission('destinos');
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
    console.error('Error creating destination:', error);
    return NextResponse.json({ error: 'Error creating destination' }, { status: 500 });
  }
}
