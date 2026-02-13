import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();
    const pkg = await prisma.package.findFirst({
      where: { id: params?.id, tenantId },
      include: {
        departures: {
          include: {
            season: {
              select: { id: true, name: true, color: true },
            },
          },
          orderBy: { departureDate: 'asc' },
        },
      },
    });
    if (!pkg) return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
    return NextResponse.json(pkg);
  } catch (error) {
    console.error('Error fetching package:', error);
    return NextResponse.json({ error: 'Error al obtener paquete' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.package.findFirst({
      where: { id: params?.id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
    }

    const { departures, ...packageData } = body;

    // Update package and departures in a transaction
    const pkg = await prisma.$transaction(async (tx: any) => {
      // Update package data
      await tx.package.update({
        where: { id: params.id },
        data: {
          name: packageData.name,
          description: packageData.description || '',
          images: packageData.images,
          servicesIncluded: packageData.servicesIncluded,
          servicesNotIncluded: packageData.servicesNotIncluded,
        },
      });

      // Delete existing departures that are not in the new list
      const newDepartureIds = departures
        ?.filter((d: { id?: string }) => d.id)
        .map((d: { id: string }) => d.id) || [];

      await tx.packageDeparture.deleteMany({
        where: {
          packageId: params.id,
          id: { notIn: newDepartureIds },
        },
      });

      // Upsert departures
      if (departures && departures.length > 0) {
        for (const dep of departures) {
          if (dep.id) {
            // Update existing
            await tx.packageDeparture.update({
              where: { id: dep.id },
              data: {
                seasonId: dep.seasonId || null,
                departureDate: new Date(dep.departureDate),
                returnDate: new Date(dep.returnDate),
                priceAdult: dep.priceAdult,
                priceChild: dep.priceChild || 0,
                availableSlots: dep.availableSlots || 50,
              },
            });
          } else {
            // Create new
            await tx.packageDeparture.create({
              data: {
                packageId: params.id,
                seasonId: dep.seasonId || null,
                departureDate: new Date(dep.departureDate),
                returnDate: new Date(dep.returnDate),
                priceAdult: dep.priceAdult,
                priceChild: dep.priceChild || 0,
                availableSlots: dep.availableSlots || 50,
              },
            });
          }
        }
      }

      // Return updated package with departures
      return tx.package.findUnique({
        where: { id: params.id },
        include: {
          departures: {
            include: {
              season: {
                select: { id: true, name: true, color: true },
              },
            },
            orderBy: { departureDate: 'asc' },
          },
        },
      });
    });

    return NextResponse.json(pkg);
  } catch (error) {
    console.error('Error updating package:', error);
    return NextResponse.json({ error: 'Error al actualizar paquete' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Redirect to PUT for compatibility
  return PUT(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tenantId = await requireTenantId();
    
    // Check if package has bookings
    const pkg = await prisma.package.findFirst({
      where: { id: params?.id, tenantId },
      include: {
        departures: {
          include: {
            bookings: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
    }

    // Check for existing bookings
    const hasBookings = pkg.departures.some((d: any) => d.bookings.length > 0);
    if (hasBookings) {
      return NextResponse.json(
        { error: 'No se puede eliminar un paquete con ventas asociadas' },
        { status: 400 }
      );
    }

    await prisma.package.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Paquete eliminado' });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json({ error: 'Error al eliminar paquete' }, { status: 500 });
  }
}
