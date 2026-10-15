import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { eventPublicUrl, eventSchema, guestLink, publishEventChange } from '@/lib/special-events';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

/** Evento con sus invitados (cada uno con su link personal). */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos');
    const { id } = await params;
    const event = await prisma.specialEvent.findFirst({
      where: { id, tenantId: access.tenantId },
      include: {
        tenant: { select: { id: true, name: true, customDomain: true, customDomainVerifiedAt: true } },
        guests: {
          orderBy: [{ createdAt: 'asc' }],
          include: { supplier: { select: { id: true, name: true, logo: true } } },
        },
      },
    });
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    const { tenant, guests, ...rest } = event;
    const [publicUrl, suppliers] = await Promise.all([
      eventPublicUrl(event, tenant, request.nextUrl.origin),
      // Para elegir el proveedor de cada invitado (solo nombre y logo)
      prisma.supplier.findMany({ where: { tenantId: access.tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, logo: true } }),
    ]);
    return NextResponse.json({
      ...rest,
      publicUrl,
      agencyName: tenant.name,
      suppliers,
      guests: guests.map(({ phoneKey: _phoneKey, ...g }) => ({ ...g, link: guestLink(publicUrl, g.token) })),
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading event:', error);
    return NextResponse.json({ error: 'Error al cargar el evento' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'edit');
    const { id } = await params;
    const existing = await prisma.specialEvent.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    const taken = await prisma.specialEvent.findFirst({
      where: { tenantId: access.tenantId, slug: parsed.data.slug, id: { not: id } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: 'Ya tienes un evento con esa dirección' }, { status: 400 });

    const event = await prisma.specialEvent.update({ where: { id }, data: parsed.data });
    publishEventChange(access.tenantId, id, access.userId);
    return NextResponse.json(event);
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Error al actualizar el evento' }, { status: 500 });
  }
}

/** Elimina el evento y su lista de invitados. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const access = await requireAccess('eventos', 'delete');
    const { id } = await params;
    const existing = await prisma.specialEvent.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    await prisma.specialEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Error al eliminar el evento' }, { status: 500 });
  }
}
