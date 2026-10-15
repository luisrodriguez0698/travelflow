import { Plane } from 'lucide-react';
import { fileUrl } from '@/lib/client-portal';
import { findGuestByToken, toPublicEvent, toPublicGuest, type PublicEvent } from '@/lib/special-events';
import { EventInvitation } from './event-invitation';

export function EventUnavailable() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-700 via-sky-600 to-cyan-500 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center text-slate-700 shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
          <Plane className="h-7 w-7 -rotate-45" />
        </div>
        <h1 className="text-lg font-bold">Esta invitación no está disponible</h1>
        <p className="mt-2 text-sm text-slate-500">Revisa el link o pide uno nuevo a quien te invitó.</p>
      </div>
    </div>
  );
}

/** Arma los datos publicos (evento + invitado si trae su pase) y pinta la invitacion. */
export async function EventInvitationPage({ event, pase }: { event: PublicEvent; pase?: string | string[] }) {
  const token = typeof pase === 'string' ? pase : undefined;
  const guest = token ? await findGuestByToken(event.id, token) : null;
  const data = toPublicEvent(event);
  data.agency.logo = await fileUrl(event.tenant.logo);
  // Sin identificarse solo se ve el nombre y la fecha: el lugar es para invitados
  if (!guest) {
    Object.assign(data, { message: null, venueName: null, address: null, googleMapsUrl: null, appleMapsUrl: null, dressCode: null });
  }
  return <EventInvitation event={data} guest={guest ? toPublicGuest(guest) : null} invalidPass={!!token && !guest} />;
}
