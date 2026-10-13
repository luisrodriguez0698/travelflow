import { NextRequest, NextResponse } from 'next/server';
import { phoneError } from '@/lib/phone';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess(['clientes', 'ventas', 'cotizaciones']);
    const tenantId = access.tenantId;
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    // Quienes han dado de alta clientes (para el filtro "Creado por")
    if (searchParams.get('creators') === 'true') {
      const groups = await prisma.client.groupBy({
        by: ['createdBy'],
        where: { ...access.clientScope },
        _count: { _all: true },
      });
      const ids = groups.map((g) => g.createdBy).filter(Boolean) as string[];
      const users = ids.length
        ? await prisma.user.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true, email: true, avatar: true } })
        : [];
      const byId = Object.fromEntries(users.map((u) => [u.id, u]));
      return NextResponse.json(
        groups
          .map((g) => ({
            id: g.createdBy ?? 'none',
            name: g.createdBy ? byId[g.createdBy]?.name || byId[g.createdBy]?.email || 'Usuario eliminado' : 'Sin registro',
            avatar: g.createdBy ? byId[g.createdBy]?.avatar ?? null : null,
            count: g._count._all,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      );
    }

    // Filtro "Creado por": uno o varios (ids separados por coma; "none" = sin registro)
    const creatorFilter = (searchParams.get('createdBy') || '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, 50);
    const filterIds = creatorFilter.filter((v) => v !== 'none');
    const includeNone = creatorFilter.includes('none');

    const where = {
      ...access.clientScope,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(creatorFilter.length
        ? {
            AND: [
              ...((access.clientScope as { AND?: object[] }).AND ?? []),
              { OR: [...(filterIds.length ? [{ createdBy: { in: filterIds } }] : []), ...(includeNone ? [{ createdBy: null }] : [])] },
            ],
          }
        : {}),
    };

    // Orden: nombre, telefono, email, creado por o fecha de alta
    const sort = searchParams.get('sort') || 'createdAt';
    const dir: 'asc' | 'desc' = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

    // Return all clients without pagination (for dropdowns)
    if (all) {
      const clients = await prisma.client.findMany({
        where: { ...access.clientScope },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      return NextResponse.json(clients);
    }

    let clients;
    let total: number;
    if (sort === 'createdBy') {
      // Por nombre de quien lo creo: se ordenan los ids en memoria y se pide solo la pagina
      const rows = await prisma.client.findMany({ where, select: { id: true, createdBy: true, fullName: true } });
      const userIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as string[];
      const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
      const nameOf = Object.fromEntries(users.map((u) => [u.id, (u.name || u.email || '').toLowerCase()]));
      rows.sort((a, b) => {
        const na = a.createdBy ? nameOf[a.createdBy] ?? '' : '\uffff';
        const nb = b.createdBy ? nameOf[b.createdBy] ?? '' : '\uffff';
        const cmp = na.localeCompare(nb, 'es') || a.fullName.localeCompare(b.fullName, 'es');
        return dir === 'asc' ? cmp : -cmp;
      });
      total = rows.length;
      const pageIds = rows.slice(skip, skip + limit).map((r) => r.id);
      const found = await prisma.client.findMany({ where: { id: { in: pageIds } } });
      const position = new Map(pageIds.map((id, i) => [id, i]));
      clients = found.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
    } else {
      const orderBy =
        sort === 'fullName'
          ? [{ fullName: dir }]
          : sort === 'phone' || sort === 'email'
            ? [{ [sort]: { sort: dir, nulls: 'last' as const } }, { fullName: 'asc' as const }]
            : [{ createdAt: dir }];
      [clients, total] = await Promise.all([
        prisma.client.findMany({ where, orderBy, skip, take: limit }),
        prisma.client.count({ where }),
      ]);
    }

    // Fetch creator names
    const creatorIds = [...new Set(clients.map((c) => c.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email || 'Usuario']));

    return NextResponse.json({
      data: clients.map((c) => ({
        ...c,
        creatorName: c.createdBy ? creatorMap[c.createdBy] || null : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess(['clientes', 'ventas', 'cotizaciones'], 'create');
    const tenantId = access.tenantId;
    const body = await request.json();

    const { fullName, ine, passport, curp, phone, email, birthDate } = body;

    if (!fullName) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Telefono con clave de pais ("+52 9611234567"): debe tener los digitos del pais
    const phoneIssue = phoneError(phone);
    if (phoneIssue) {
      return NextResponse.json({ error: `Teléfono: ${phoneIssue}` }, { status: 400 });
    }

    const sessionUser = await getSessionUser();

    const client = await prisma.client.create({
      data: {
        tenantId,
        fullName,
        ine: ine || null,
        passport: passport || null,
        curp: curp || null,
        phone: phone || null,
        email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        createdBy: sessionUser?.id || null,
      },
    });


    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
