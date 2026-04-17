import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Sirve el favicon del tenant para dominios personalizados.
 * Google y los navegadores lo usan para el ícono en resultados de búsqueda
 * y en la pestaña del navegador.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hostname: string }> }
) {
  const { hostname } = await params;

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { customDomain: hostname },
        { subdomain: hostname },
      ],
    },
    select: { logo: true },
  });

  if (!tenant?.logo) {
    return new NextResponse(null, { status: 404 });
  }

  // Si el logo es una URL absoluta (Cloudflare R2, UploadThing, etc.) → redirect directo
  if (tenant.logo.startsWith('http://') || tenant.logo.startsWith('https://')) {
    return NextResponse.redirect(tenant.logo, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  }

  // Si es un path relativo → redirigir a la API de archivos del SaaS
  const appHost = process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost:3000';
  return NextResponse.redirect(`https://${appHost}/api/files/${tenant.logo}`, {
    status: 302,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
