import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, getSessionUser } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { sanitizeTemplateItems, templateSchema } from '@/lib/package-template';

export const dynamic = 'force-dynamic';

// Las plantillas son compartidas por toda la agencia y cualquier usuario
// (sin importar su rol) puede usarlas, crearlas y editarlas.

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const search = new URL(request.url).searchParams.get('search')?.trim() || '';

    const templates = await prisma.packageTemplate.findMany({
      where: {
        tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    const creatorIds = [...new Set(templates.map((t) => t.createdBy).filter(Boolean))] as string[];
    const creators = creatorIds.length
      ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, email: true } })
      : [];
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name || u.email]));

    return NextResponse.json(
      templates.map((t) => ({ ...t, creatorName: t.createdBy ? creatorMap[t.createdBy] || null : null }))
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Error al cargar plantillas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const parsed = templateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const template = await prisma.packageTemplate.create({
      data: {
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        totalPrice: parsed.data.totalPrice,
        notes: parsed.data.notes || null,
        items: sanitizeTemplateItems(parsed.data.items) as any,
        createdBy: sessionUser?.id || null,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
  }
}
