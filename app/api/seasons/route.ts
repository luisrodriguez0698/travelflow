import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
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
    return NextResponse.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Error al obtener temporadas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const season = await prisma.season.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description || '',
        color: body.color || '#3B82F6',
      },
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json({ error: 'Error al crear temporada' }, { status: 500 });
  }
}
