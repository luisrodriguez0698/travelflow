import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findEventByHost } from '@/lib/special-events';
import { EventInvitationPage } from '@/components/events/event-invitation-page';

export const dynamic = 'force-dynamic';

interface Props {
  params: { hostname: string; slug: string };
  searchParams: { pase?: string | string[] };
}

// Invitacion privada de cada invitado: nunca se indexa ni instala como app
export const metadata: Metadata = {
  title: 'Invitación especial',
  manifest: null,
  robots: { index: false, follow: false, nocache: true },
};

/** Invitacion en el dominio de la agencia: viajaentrenubes.com/<slug>?pase=<token> */
export default async function EventBySlugPage({ params, searchParams }: Props) {
  const { hostname, slug } = await params;
  const event = await findEventByHost(decodeURIComponent(hostname).toLowerCase(), decodeURIComponent(slug));
  if (!event) notFound();
  return <EventInvitationPage event={event} pase={searchParams.pase} />;
}
