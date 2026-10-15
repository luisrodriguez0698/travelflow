// Tipos y textos del apartado de eventos (lado del sistema).

export interface EventStats {
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
  arrived: number;
}

export interface SpecialEventRow {
  id: string;
  name: string;
  slug: string;
  message: string | null;
  startsAt: string;
  venueName: string | null;
  address: string | null;
  googleMapsUrl: string | null;
  appleMapsUrl: string | null;
  dressCode: string | null;
  rsvpDeadline: string | null;
  status: 'ACTIVE' | 'CLOSED';
  publicUrl: string | null;
  stats?: EventStats;
}

export interface EventGuestRow {
  id: string;
  name: string;
  phone: string;
  token: string;
  link: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  respondedAt: string | null;
  note: string | null;
  checkedInAt: string | null;
  views: number;
  lastViewedAt: string | null;
  sentAt: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string; logo: string | null } | null;
}

export interface SupplierOption {
  id: string;
  name: string;
  logo: string | null;
}

export interface EventDetail extends SpecialEventRow {
  agencyName: string;
  suppliers: SupplierOption[];
  guests: EventGuestRow[];
}

export const GUEST_STATUS_LABEL: Record<EventGuestRow['status'], string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  DECLINED: 'No asistirá',
};

export const GUEST_STATUS_CLASS: Record<EventGuestRow['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  DECLINED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const TZ = 'America/Mexico_City';

export function eventDateLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** Mensaje de WhatsApp con la invitacion personal. */
export function invitationMessage(event: Pick<EventDetail, 'name' | 'startsAt' | 'agencyName'>, guest: Pick<EventGuestRow, 'name' | 'link'>) {
  const first = guest.name.split(/\s+/)[0];
  const d = new Date(event.startsAt);
  const day = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  return (
    `¡Hola ${first}! ✈️\n\n` +
    `${event.agencyName} te invita a *${event.name}* el ${day} a las ${time}.\n\n` +
    `Esta es tu invitación personal, ahí mismo puedes confirmar tu asistencia:\n${guest.link}\n\n` +
    '¡Nos encantará verte! 💙'
  );
}
