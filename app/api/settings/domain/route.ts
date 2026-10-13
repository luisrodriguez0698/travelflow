import { NextRequest, NextResponse } from 'next/server';
import { requireAccess, accessErrorResponse } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { isReservedDomain, normalizeDomain, verifyTenantDomain } from '@/lib/custom-domain';

export const dynamic = 'force-dynamic';

async function status(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { customDomain: true, customDomainVerifiedAt: true },
  });
  return {
    domain: t?.customDomain ?? null,
    verified: !!t?.customDomainVerifiedAt,
    verifiedAt: t?.customDomainVerifiedAt ?? null,
  };
}

function handleError(error: unknown, fallback: string) {
  const accessError = accessErrorResponse(error);
  if (accessError) return accessError;
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const access = await requireAccess('configuracion');
    return NextResponse.json(await status(access.tenantId));
  } catch (error) {
    return handleError(error, 'Error al cargar el dominio');
  }
}

/** Guardar (o cambiar) el dominio: queda pendiente y se intenta verificar de inmediato. */
export async function PUT(request: NextRequest) {
  try {
    const access = await requireAccess('configuracion', 'edit');
    const body = await request.json().catch(() => ({}));
    const domain = normalizeDomain(body.domain);
    if (!domain) return NextResponse.json({ error: 'Escribe un dominio válido, por ejemplo: miagencia.com' }, { status: 400 });
    if (isReservedDomain(domain)) return NextResponse.json({ error: 'Ese dominio pertenece al sistema' }, { status: 400 });

    const taken = await prisma.tenant.findFirst({
      where: { customDomain: domain, NOT: { id: access.tenantId } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: 'Ese dominio ya está registrado por otra agencia' }, { status: 400 });

    await prisma.tenant.update({ where: { id: access.tenantId }, data: { customDomain: domain, customDomainVerifiedAt: null } });
    await verifyTenantDomain(access.tenantId, domain);
    return NextResponse.json(await status(access.tenantId));
  } catch (error) {
    return handleError(error, 'Error al guardar el dominio');
  }
}

/** Verificar conexion: el dominio debe responder desde este servidor. */
export async function POST() {
  try {
    const access = await requireAccess('configuracion', 'edit');
    const current = await status(access.tenantId);
    if (!current.domain) return NextResponse.json({ error: 'Primero guarda tu dominio' }, { status: 400 });
    await verifyTenantDomain(access.tenantId, current.domain);
    return NextResponse.json(await status(access.tenantId));
  } catch (error) {
    return handleError(error, 'Error al verificar el dominio');
  }
}

export async function DELETE() {
  try {
    const access = await requireAccess('configuracion', 'edit');
    await prisma.tenant.update({ where: { id: access.tenantId }, data: { customDomain: null, customDomainVerifiedAt: null } });
    return NextResponse.json(await status(access.tenantId));
  } catch (error) {
    return handleError(error, 'Error al quitar el dominio');
  }
}
