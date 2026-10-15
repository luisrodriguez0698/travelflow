import { headers } from 'next/headers';
import { findEventById } from '@/lib/special-events';
import { EventInvitationPage, EventUnavailable } from '@/components/events/event-invitation-page';

export const dynamic = 'force-dynamic';

const APP_HOSTNAME = process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost';

/** El link vale en el dominio del sistema y en el dominio propio de SU agencia. */
function hostAllowed(host: string, customDomain: string | null) {
  if (host === APP_HOSTNAME || host.endsWith(`.${APP_HOSTNAME}`) || host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  if (!customDomain) return false;
  const domain = customDomain.toLowerCase();
  return host === domain || host === `www.${domain}`;
}

/** Invitacion en el dominio del sistema: /evento/<id>?pase=<token> */
export default async function EventByIdPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { pase?: string | string[] };
}) {
  const { id } = await params;
  const event = await findEventById(id);
  const host = (headers().get('host') ?? '').split(':')[0].toLowerCase();
  if (!event || !hostAllowed(host, event.tenant.customDomain)) return <EventUnavailable />;
  return <EventInvitationPage event={event} pase={searchParams.pase} />;
}
