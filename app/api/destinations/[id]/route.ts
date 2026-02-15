import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();
    const destination = await prisma.destination.findFirst({
      where: { id: params.id, tenantId },
      include: { season: true },
    });
    if (!destination) {
      return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
    }
    return NextResponse.json(destination);
  } catch (error) {
    console.error('Error fetching destination:', error);
    return NextResponse.json({ error: 'Error fetching destination' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const existing = await prisma.destination.findFirst({
      where: { id: params.id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
    }

    const destination = await prisma.destination.update({
      where: { id: params.id },
      data: {
        name: body.name?.trim() || existing.name,
        description: body.description?.trim() ?? existing.description,
        seasonId: body.seasonId === '' ? null : (body.seasonId ?? existing.seasonId),
      },
      include: { season: true },
    });

    return NextResponse.json(destination);
  } catch (error) {
    console.error('Error updating destination:', error);
    return NextResponse.json({ error: 'Error updating destination' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();

    const destination = await prisma.destination.findFirst({
      where: { id: params.id, tenantId },
      include: { _count: { select: { bookings: true } } },
    });

    if (!destination) {
      return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
    }

    if (destination._count.bookings > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${destination._count.bookings} venta(s) asociada(s)` },
        { status: 400 }
      );
    }

    await prisma.destination.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting destination:', error);
    return NextResponse.json({ error: 'Error deleting destination' }, { status: 500 });
  }
}
