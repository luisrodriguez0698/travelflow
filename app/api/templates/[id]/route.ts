import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { sanitizeTemplateItems, templateSchema } from '@/lib/package-template';

export const dynamic = 'force-dynamic';

function errorResponse(error: any, fallback: string) {
  if (error?.message === 'Unauthorized') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;
    const template = await prisma.packageTemplate.findFirst({ where: { id, tenantId } });
    if (!template) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    return errorResponse(error, 'Error al cargar plantilla');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const existing = await prisma.packageTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    const parsed = templateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const template = await prisma.packageTemplate.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        totalPrice: parsed.data.totalPrice,
        notes: parsed.data.notes || null,
        items: sanitizeTemplateItems(parsed.data.items) as any,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    return errorResponse(error, 'Error al actualizar plantilla');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await requireTenantId();
    const { id } = await params;

    const existing = await prisma.packageTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }

    await prisma.packageTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Error al eliminar plantilla');
  }
}
