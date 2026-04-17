import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LandingRenderer } from '@/components/landings/LandingRenderer';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ hostname: string }>;
}

/**
 * Busca el tenant por customDomain o subdomain y renderiza su template.
 * El middleware reescribe dominios personalizados/subdominios a esta ruta.
 */
async function getTenant(hostname: string) {
  return prisma.tenant.findFirst({
    where: {
      OR: [
        { customDomain: hostname },
        { subdomain: hostname },
      ],
    },
    select: {
      id: true,
      name: true,
      logo: true,
      email: true,
      phone: true,
      address: true,
      landingTemplate: true,
      facebookReviewUrl: true,
      googleReviewUrl: true,
      hotels: {
        where: { showInWeb: true },
        select: {
          id: true,
          name: true,
          webDescription: true,
          packagePrice: true,
          packageCurrency: true,
          images: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      testimonials: {
        select: {
          id: true,
          name: true,
          text: true,
          rating: true,
          source: true,
          avatarUrl: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

// ── Metadata por tenant ───────────────────────────────────────────────────────
// Clave: hostname del dominio personalizado o subdomain.
// Si un tenant no está aquí, se usa title=nombre y description genérica.
// Para agregar una nueva agencia, añade su hostname y datos.
const TENANT_METADATA: Record<string, { title: string; description: string; keywords?: string[] }> = {
  'viajaentrenubes.com': {
    title: 'Viaja Entre Nubes | Agencia de Viajes',
    description: 'Encuentra los mejores paquetes de viaje nacionales e internacionales. Tours, bodas, lunas de miel y más. ¡Tu aventura comienza aquí!',
    keywords: ['agencia de viajes', 'paquetes de viaje', 'tours', 'viajes nacionales', 'viajes internacionales', 'bodas', 'luna de miel'],
  },
  // 'otraagencia.com': {
  //   title: 'Otra Agencia | Viajes de Ensueño',
  //   description: 'Descripción personalizada para la otra agencia.',
  // },
};

function toAbsoluteUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const appHost = process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost:3000';
  return `https://${appHost}/api/files/${path}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hostname } = await params;
  const tenant = await getTenant(hostname);
  if (!tenant) return { title: 'Agencia de Viajes' };

  const custom = TENANT_METADATA[hostname];
  const logoUrl = toAbsoluteUrl(tenant.logo);

  return {
    title:       custom?.title       ?? tenant.name,
    description: custom?.description ?? `Bienvenido a ${tenant.name}`,
    keywords:    custom?.keywords,
    icons: {
      icon:  logoUrl,
      apple: logoUrl,
    },
    openGraph: {
      title:       custom?.title       ?? tenant.name,
      description: custom?.description ?? `Bienvenido a ${tenant.name}`,
      images: logoUrl ? [logoUrl] : [],
      type: 'website',
      url: `https://${hostname}`,
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { hostname } = await params;
  const tenant = await getTenant(hostname);

  if (!tenant) notFound();

  return <LandingRenderer tenant={tenant} />;
}
