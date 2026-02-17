import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const hotel = await prisma.hotel.findFirst({
      where: { id, tenantId },
      include: { destination: { select: { id: true, name: true } } },
    });

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    }

    return NextResponse.json(hotel);
  } catch (error) {
    console.error('Error fetching hotel:', error);
    return NextResponse.json({ error: 'Error al cargar hotel' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.hotel.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    }

    if (body.destinationId) {
      const dest = await prisma.destination.findFirst({ where: { id: body.destinationId, tenantId } });
      if (!dest) return NextResponse.json({ error: 'Destino no encontrado' }, { status: 404 });
    }

    const hotel = await prisma.hotel.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.destinationId !== undefined && { destinationId: body.destinationId }),
        ...(body.stars !== undefined && { stars: body.stars }),
        ...(body.diamonds !== undefined && { diamonds: body.diamonds }),
        ...(body.plan !== undefined && { plan: body.plan.trim() }),
        ...(body.roomType !== undefined && { roomType: body.roomType.trim() }),
        ...(body.checkIn !== undefined && { checkIn: body.checkIn.trim() }),
        ...(body.checkOut !== undefined && { checkOut: body.checkOut.trim() }),
        ...(body.checkInNote !== undefined && { checkInNote: body.checkInNote?.trim() || null }),
        ...(body.checkOutNote !== undefined && { checkOutNote: body.checkOutNote?.trim() || null }),
        ...(body.idRequirement !== undefined && { idRequirement: body.idRequirement?.trim() || null }),
        ...(body.includes !== undefined && { includes: body.includes }),
        ...(body.notIncludes !== undefined && { notIncludes: body.notIncludes }),
        ...(body.images !== undefined && { images: body.images }),
      },
      include: { destination: { select: { id: true, name: true } } },
    });

    return NextResponse.json(hotel);
  } catch (error) {
    console.error('Error updating hotel:', error);
    return NextResponse.json({ error: 'Error al actualizar hotel' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const hotel = await prisma.hotel.findFirst({ where: { id, tenantId } });
    if (!hotel) {
      return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });
    }

    const bookingCount = await prisma.booking.count({ where: { hotelId: id } });
    if (bookingCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${bookingCount} venta(s) vinculada(s)` },
        { status: 400 }
      );
    }

    await prisma.hotel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hotel:', error);
    return NextResponse.json({ error: 'Error al eliminar hotel' }, { status: 500 });
  }
}
