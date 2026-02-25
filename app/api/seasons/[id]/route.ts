import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requirePermission('temporadas');
    const season = await prisma.season.findFirst({
      where: { id: params?.id, tenantId },
      include: {
        departures: {
          include: {
            package: {
              select: { id: true, name: true },
            },
          },
          orderBy: { departureDate: 'asc' },
        },
      },
    });
    if (!season) return NextResponse.json({ error: 'Temporada no encontrada' }, { status: 404 });
    return NextResponse.json(season);
  } catch (error) {
    console.error('Error fetching season:', error);
    return NextResponse.json({ error: 'Error al obtener temporada' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requirePermission('temporadas');
    const body = await request.json();

    const existing = await prisma.season.findFirst({
      where: { id: params?.id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Temporada no encontrada' }, { status: 404 });
    }

    const season = await prisma.season.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description || '',
        color: body.color || '#3B82F6',
      },
    });

    return NextResponse.json(season);
  } catch (error) {
    console.error('Error updating season:', error);
    return NextResponse.json({ error: 'Error al actualizar temporada' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requirePermission('temporadas');

    const existing = await prisma.season.findFirst({
      where: { id: params?.id, tenantId },
      include: {
        _count: { select: { departures: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Temporada no encontrada' }, { status: 404 });
    }

    // Allow deletion - departures will have seasonId set to null
    await prisma.season.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json({ error: 'Error al eliminar temporada' }, { status: 500 });
  }
}
