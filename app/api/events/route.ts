import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { eventPublicUrl, eventSchema } from '@/lib/special-events';
import { normalizeDomain, tenantPublicBase } from '@/lib/custom-domain';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess('eventos');
    const [events, tenant, counts, arrived] = await Promise.all([
      prisma.specialEvent.findMany({ where: { tenantId: access.tenantId }, orderBy: { startsAt: 'desc' } }),
      prisma.tenant.findUnique({ where: { id: access.tenantId }, select: { id: true, customDomain: true, customDomainVerifiedAt: true } }),
      prisma.eventGuest.groupBy({ by: ['eventId', 'status'], where: { tenantId: access.tenantId }, _count: { _all: true } }),
      prisma.eventGuest.groupBy({ by: ['eventId'], where: { tenantId: access.tenantId, checkedInAt: { not: null } }, _count: { _all: true } }),
    ]);

    const stats = (eventId: string) => {
      const rows = counts.filter((c) => c.eventId === eventId);
      const by = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
      return {
        total: rows.reduce((sum, r) => sum + r._count._all, 0),
        confirmed: by('CONFIRMED'),
        declined: by('DECLINED'),
        pending: by('PENDING'),
        arrived: arrived.find((a) => a.eventId === eventId)?._count._all ?? 0,
      };
    };

    // Dominio propio verificado: la invitacion vive en <dominio>/<slug>
    const base = tenant ? await tenantPublicBase(tenant, request.nextUrl.origin) : '';
    const domain = normalizeDomain(tenant?.customDomain);
    const domainHint = domain && base === `https://${domain}` ? `${domain}/` : null;

    return NextResponse.json({
      domainHint,
      events: await Promise.all(
        events.map(async (e) => ({
          ...e,
          stats: stats(e.id),
          publicUrl: tenant ? await eventPublicUrl(e, tenant, request.nextUrl.origin) : null,
        }))
      ),
    });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error loading events:', error);
    return NextResponse.json({ error: 'Error al cargar los eventos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess('eventos', 'create');
    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const taken = await prisma.specialEvent.findFirst({ where: { tenantId: access.tenantId, slug: parsed.data.slug }, select: { id: true } });
    if (taken) return NextResponse.json({ error: 'Ya tienes un evento con esa dirección' }, { status: 400 });

    const event = await prisma.specialEvent.create({
      data: { ...parsed.data, tenantId: access.tenantId, createdBy: access.userId },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    const accessError = accessErrorResponse(error);
    if (accessError) return accessError;
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Error al crear el evento' }, { status: 500 });
  }
}
