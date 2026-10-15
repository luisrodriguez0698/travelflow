import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prismaBase } from './prisma';
import { parsePhone, phoneError } from './phone';
import { normalizeDomain, tenantPublicBase } from './custom-domain';
import { publishToTenant } from './realtime';

// Eventos especiales: invitacion virtual por invitado (link personal o telefono)
// con QR para registrar la llegada. Solo se expone al invitado lo suyo.

export const GUEST_STATUSES = ['PENDING', 'CONFIRMED', 'DECLINED'] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

/** Rutas que ya existen en el dominio de la agencia: no pueden ser direccion de un evento. */
const RESERVED_SLUGS = new Set(['v', 'api', 'evento', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'login', 'register', 'dashboard', '_next']);

export function normalizeSlug(input: string) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Solo links https (evita "javascript:" y similares en los botones del mapa). */
const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), 'El link debe empezar con https://');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const eventSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del evento').max(120),
  slug: z
    .string()
    .transform(normalizeSlug)
    .refine((v) => v.length >= 3, 'La dirección debe tener al menos 3 letras')
    .refine((v) => !RESERVED_SLUGS.has(v), 'Esa dirección está reservada, elige otra'),
  message: optionalText(3000),
  startsAt: z.coerce.date({ invalid_type_error: 'Fecha inválida' }),
  venueName: optionalText(160),
  address: optionalText(300),
  googleMapsUrl: httpsUrl,
  appleMapsUrl: httpsUrl,
  dressCode: optionalText(120),
  rsvpDeadline: z.coerce.date().optional().nullable().transform((v) => v ?? null),
  status: z.enum(['ACTIVE', 'CLOSED']).default('ACTIVE'),
});
export type EventInput = z.infer<typeof eventSchema>;

export const guestSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del invitado').max(120),
  phone: z.string().trim().min(1, 'Escribe el teléfono'),
  supplierId: z.string().optional().nullable().transform((v) => v || null),
});

/** "+52 961 123 4567" / "9611234567" -> "529611234567" (para buscar y evitar duplicados). */
export function phoneKey(phone: string) {
  const { country, national } = parsePhone(phone);
  return `${country.dial}${national.replace(/\D/g, '')}`;
}

/** Error del telefono o null. Exige el numero completo. */
export function guestPhoneError(phone: string) {
  const { national } = parsePhone(phone);
  if (!national) return 'Escribe el teléfono';
  return phoneError(phone);
}

export function newGuestToken() {
  return randomBytes(24).toString('base64url');
}

/**
 * Direccion publica del evento: dominio propio verificado -> https://dominio/<slug>;
 * si no, la del sistema -> /evento/<id>.
 */
export async function eventPublicUrl(
  event: { id: string; slug: string },
  tenant: { id: string; customDomain: string | null; customDomainVerifiedAt: Date | null },
  fallbackOrigin: string
) {
  const base = await tenantPublicBase(tenant, fallbackOrigin);
  const domain = normalizeDomain(tenant.customDomain);
  return domain && base === `https://${domain}` ? `${base}/${event.slug}` : `${base}/evento/${event.id}`;
}

export function guestLink(eventUrl: string, token: string) {
  return `${eventUrl}?pase=${encodeURIComponent(token)}`;
}

/** Avisa a las pantallas abiertas del evento (lista en vivo). */
export function publishEventChange(tenantId: string, eventId: string, actorId: string | null = null) {
  publishToTenant(tenantId, 'data-changed', { entity: 'special_events', id: eventId, action: 'UPDATE', actorId });
}

/** El invitado ya no puede responder: evento cerrado, ya paso o vencio el plazo. */
export function rsvpClosedReason(event: { status: string; startsAt: Date; rsvpDeadline: Date | null }): string | null {
  if (event.status !== 'ACTIVE') return 'Las confirmaciones para este evento ya cerraron.';
  if (event.startsAt.getTime() < Date.now()) return 'Este evento ya se realizó.';
  if (event.rsvpDeadline && event.rsvpDeadline.getTime() < Date.now()) return 'El plazo para confirmar ya terminó.';
  return null;
}

// ── Lado publico ────────────────────────────────────────────────────────────

const publicEventSelect = {
  id: true,
  tenantId: true,
  name: true,
  slug: true,
  message: true,
  startsAt: true,
  venueName: true,
  address: true,
  googleMapsUrl: true,
  appleMapsUrl: true,
  dressCode: true,
  rsvpDeadline: true,
  status: true,
  tenant: { select: { name: true, logo: true, phone: true, customDomain: true } },
} as const;

/** Evento por dominio de la agencia + direccion (viajaentrenubes.com/<slug>). */
export function findEventByHost(hostname: string, slug: string) {
  if (!slug || slug.length > 60) return Promise.resolve(null);
  return prismaBase.specialEvent.findFirst({
    where: { slug: normalizeSlug(slug), tenant: { OR: [{ customDomain: hostname }, { subdomain: hostname }] } },
    select: publicEventSelect,
  });
}

/** Evento por id (link del dominio del sistema: /evento/<id>). */
export function findEventById(id: string) {
  if (!id || id.length > 40) return Promise.resolve(null);
  return prismaBase.specialEvent.findUnique({ where: { id }, select: publicEventSelect });
}

export type PublicEvent = NonNullable<Awaited<ReturnType<typeof findEventById>>>;

/** Invitado por su link personal, solo dentro de SU evento. Cuenta la visita. */
export async function findGuestByToken(eventId: string, token: string) {
  if (!token || token.length < 20 || token.length > 64) return null;
  const guest = await prismaBase.eventGuest.findFirst({
    where: { token, eventId },
    select: {
      id: true,
      name: true,
      token: true,
      status: true,
      respondedAt: true,
      checkedInAt: true,
      supplier: { select: { name: true, logo: true } },
    },
  });
  if (guest) {
    await prismaBase.eventGuest.update({
      where: { id: guest.id },
      data: { views: { increment: 1 }, lastViewedAt: new Date() },
    });
  }
  return guest;
}

export type PublicGuest = NonNullable<Awaited<ReturnType<typeof findGuestByToken>>>;

/** Lo que la pagina publica recibe (fechas como texto, sin ids internos de la agencia). */
export function toPublicEvent(e: PublicEvent) {
  return {
    id: e.id,
    name: e.name,
    message: e.message,
    startsAt: e.startsAt.toISOString(),
    venueName: e.venueName,
    address: e.address,
    googleMapsUrl: e.googleMapsUrl,
    appleMapsUrl: e.appleMapsUrl,
    dressCode: e.dressCode,
    rsvpDeadline: e.rsvpDeadline?.toISOString() ?? null,
    closedReason: rsvpClosedReason(e),
    agency: { name: e.tenant.name, logo: e.tenant.logo, phone: e.tenant.phone },
  };
}

export function toPublicGuest(g: PublicGuest) {
  return {
    name: g.name,
    token: g.token,
    status: g.status as GuestStatus,
    checkedIn: !!g.checkedInAt,
    supplier: g.supplier ? { name: g.supplier.name, logo: g.supplier.logo } : null,
  };
}

export type InvitationEvent = ReturnType<typeof toPublicEvent>;
export type InvitationGuest = ReturnType<typeof toPublicGuest>;
