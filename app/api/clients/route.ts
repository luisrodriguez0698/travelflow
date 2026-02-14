import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // Return all clients without pagination (for dropdowns)
    if (all) {
      const clients = await prisma.client.findMany({
        where: { tenantId },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      return NextResponse.json(clients);
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await request.json();

    const { fullName, ine, passport, curp, phone, email, birthDate } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        tenantId,
        fullName,
        ine: ine || null,
        passport: passport || null,
        curp: curp || null,
        phone,
        email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
    });

    // Audit log
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      await logAudit({
        tenantId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        action: 'CREATE',
        entity: 'clients',
        entityId: client.id,
        changes: { fullName, phone, email },
      });
    }

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
