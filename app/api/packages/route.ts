import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const packages = await prisma.package.findMany({
      where: { tenantId },
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
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json({ error: 'Error al obtener paquetes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const { departures, ...packageData } = body;

    // Create package with departures in a transaction
    const pkg = await prisma.package.create({
      data: {
        tenantId,
        name: packageData.name,
        description: packageData.description || '',
        images: packageData.images || [],
        servicesIncluded: packageData.servicesIncluded || '[]',
        servicesNotIncluded: packageData.servicesNotIncluded || '[]',
        departures: departures && departures.length > 0 ? {
          create: departures.map((dep: { seasonId?: string | null; departureDate: string; returnDate: string; priceAdult: number; priceChild: number; availableSlots?: number }) => ({
            seasonId: dep.seasonId || null,
            departureDate: new Date(dep.departureDate),
            returnDate: new Date(dep.returnDate),
            priceAdult: dep.priceAdult,
            priceChild: dep.priceChild || 0,
            availableSlots: dep.availableSlots || 50,
          })),
        } : undefined,
      },
      include: {
        departures: {
          include: {
            season: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: 'Error al crear paquete' }, { status: 500 });
  }
}
