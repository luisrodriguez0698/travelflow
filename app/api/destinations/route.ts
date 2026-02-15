import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const destinations = await prisma.destination.findMany({
      where: { tenantId },
      include: {
        season: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(destinations);
  } catch (error) {
    console.error('Error fetching destinations:', error);
    return NextResponse.json({ error: 'Error fetching destinations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const destination = await prisma.destination.create({
      data: {
        tenantId,
        name: body.name.trim(),
        description: body.description?.trim() || '',
        seasonId: body.seasonId || null,
      },
      include: { season: true },
    });

    return NextResponse.json(destination, { status: 201 });
  } catch (error) {
    console.error('Error creating destination:', error);
    return NextResponse.json({ error: 'Error creating destination' }, { status: 500 });
  }
}
