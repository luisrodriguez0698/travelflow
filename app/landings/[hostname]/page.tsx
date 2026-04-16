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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hostname } = await params;
  const tenant = await getTenant(hostname);
  if (!tenant) return { title: 'Agencia de Viajes' };
  return {
    title: tenant.name,
    description: `Bienvenido a ${tenant.name}`,
  };
}

export default async function LandingPage({ params }: Props) {
  const { hostname } = await params;
  const tenant = await getTenant(hostname);

  if (!tenant) notFound();

  return <LandingRenderer tenant={tenant} />;
}
