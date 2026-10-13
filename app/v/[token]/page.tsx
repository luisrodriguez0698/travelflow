import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Plane } from 'lucide-react';
import {
  cookieMatches,
  fileUrl,
  findSharedBooking,
  loadPortalData,
  pinFromPhone,
  portalCookieName,
} from '@/lib/client-portal';
import { PortalUnlock } from '@/components/portal/portal-unlock';
import { TripPortal } from '@/components/portal/trip-portal';

export const dynamic = 'force-dynamic';

// El portal es privado de cada cliente: nunca se indexa en buscadores
export const metadata: Metadata = {
  title: 'Mi viaje',
  robots: { index: false, follow: false, nocache: true },
};

const APP_HOSTNAME = process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost';

/** El link vale en el dominio del sistema y en el dominio propio de SU agencia. */
function hostAllowed(host: string, customDomain: string | null) {
  if (host === APP_HOSTNAME || host.endsWith(`.${APP_HOSTNAME}`) || host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  if (!customDomain) return false;
  const domain = customDomain.toLowerCase();
  return host === domain || host === `www.${domain}`;
}

function Unavailable() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-400 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center text-slate-700 shadow-2xl">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
          <Plane className="w-7 h-7 -rotate-45" />
        </div>
        <h1 className="text-lg font-bold">Este link ya no está disponible</h1>
        <p className="text-sm text-slate-500 mt-2">Pide a tu agencia de viajes que te comparta el link actualizado.</p>
      </div>
    </div>
  );
}

export default async function TripPortalPage({ params }: { params: { token: string } }) {
  const { token } = await params;
  const booking = await findSharedBooking(token);
  const host = (headers().get('host') ?? '').split(':')[0].toLowerCase();
  if (!booking || !hostAllowed(host, booking.tenant.customDomain)) return <Unavailable />;

  const pin = pinFromPhone(booking.client.phone);
  if (booking.sharePinRequired && pin) {
    const unlocked = cookieMatches(cookies().get(portalCookieName(token))?.value, token, pin);
    if (!unlocked) {
      return <PortalUnlock token={token} agencyName={booking.tenant.name} logo={await fileUrl(booking.tenant.logo)} />;
    }
  }

  const data = await loadPortalData(booking.id);
  if (!data) return <Unavailable />;
  return <TripPortal data={data} />;
}
