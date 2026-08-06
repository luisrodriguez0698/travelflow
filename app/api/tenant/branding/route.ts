import { NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/get-tenant';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

// Lightweight tenant branding lookup (name + logo), available to any authenticated
// user regardless of module permissions — unlike /api/settings which requires 'configuracion'.
export async function GET() {
  try {
    const tenantId = await requireTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logo: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const logoUrl = tenant.logo ? await getFileUrl(tenant.logo, true) : null;

    return NextResponse.json({ name: tenant.name, logoUrl });
  } catch (error) {
    console.error('Error fetching tenant branding:', error);
    return NextResponse.json({ error: 'Error fetching tenant branding' }, { status: 500 });
  }
}
