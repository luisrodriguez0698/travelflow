import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const seasons = await prisma.season.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { departures: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch creator names
    const creatorIds = [...new Set(seasons.map((s) => s.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    return NextResponse.json(seasons.map((s) => ({
      ...s,
      creatorName: s.createdBy ? creatorMap[s.createdBy] || null : null,
    })));
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Error al obtener temporadas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const sessionUser = await getSessionUser();

    const season = await prisma.season.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description || '',
        color: body.color || '#3B82F6',
        createdBy: sessionUser?.id || null,
      },
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json({ error: 'Error al crear temporada' }, { status: 500 });
  }
}
