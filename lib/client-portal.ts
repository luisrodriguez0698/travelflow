import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { prismaBase } from './prisma';
import { getFileUrl } from './s3';
import { bookingDestination } from './booking-destination';
import { decrypt } from './encryption';

// Portal del cliente: link unico por venta (token aleatorio) + PIN opcional (4
// ultimos digitos del telefono del cliente). Solo lectura y SOLO datos que el
// cliente debe ver: nunca costos, ganancias, proveedores ni notas internas.

const COOKIE_PREFIX = 'tf_trip_';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function newShareToken() {
  return randomBytes(24).toString('base64url'); // 192 bits: imposible de adivinar
}

/** Ultimos 4 digitos del telefono (o null si no hay suficientes para usarlo de PIN). */
export function pinFromPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function portalCookieName(token: string) {
  return `${COOKIE_PREFIX}${token.slice(0, 16)}`;
}

/** Valor de la cookie de acceso: firma de token + PIN (cambia si cambian). */
export function portalCookieValue(token: string, pin: string) {
  const secret = process.env.NEXTAUTH_SECRET || 'travelflow';
  return createHmac('sha256', secret).update(`${token}:${pin}`).digest('base64url');
}

export function cookieMatches(value: string | undefined, token: string, pin: string) {
  if (!value) return false;
  const expected = Buffer.from(portalCookieValue(token, pin));
  const given = Buffer.from(value);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ── Limite de intentos de PIN (memoria del servidor; un solo proceso en Railway) ──
const globalForPortal = globalThis as unknown as { portalAttempts?: Map<string, { count: number; until: number }> };
const attempts = (globalForPortal.portalAttempts ??= new Map());

export function attemptsBlocked(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;
  if (entry.until && entry.until > Date.now()) return Math.ceil((entry.until - Date.now()) / 60000);
  if (entry.until && entry.until <= Date.now()) attempts.delete(key);
  return 0;
}

export function registerFailedAttempt(key: string) {
  const entry = attempts.get(key) ?? { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.until = Date.now() + LOCK_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
  return MAX_ATTEMPTS - entry.count;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

/** Venta con el link activo (o null). */
export function findSharedBooking(token: string) {
  if (!token || token.length < 20 || token.length > 64) return Promise.resolve(null);
  return prismaBase.booking.findFirst({
    where: { shareToken: token, shareEnabled: true, type: 'SALE' },
    select: {
      id: true,
      tenantId: true,
      sharePinRequired: true,
      client: { select: { phone: true, fullName: true } },
      tenant: { select: { name: true, logo: true, customDomain: true } },
    },
  });
}

/** URL firmada de un archivo (logo/fotos) para el portal publico. */
export async function fileUrl(path: string | null | undefined) {
  if (!path) return null;
  try {
    return await getFileUrl(path, path.includes('/public/'));
  } catch {
    return null;
  }
}

export type PortalData = Awaited<ReturnType<typeof loadPortalData>>;

/** Datos del portal (solo lo que el cliente puede ver). Cuenta la visita. */
export async function loadPortalData(bookingId: string) {
  const b = await prismaBase.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: { select: { fullName: true } },
      tenant: { select: { name: true, logo: true, phone: true, email: true, address: true, policies: true } },
      destination: { select: { name: true, season: { select: { name: true } } } },
      payments: { orderBy: { paymentNumber: 'asc' } },
      passengers: { select: { name: true, type: true, isHolder: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          destination: { select: { name: true } },
          hotel: {
            select: {
              name: true,
              stars: true,
              diamonds: true,
              plan: true,
              checkIn: true,
              checkOut: true,
              checkInNote: true,
              checkOutNote: true,
              idRequirement: true,
              includes: true,
              notIncludes: true,
              images: true,
              destination: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!b) return null;

  await prismaBase.booking.update({
    where: { id: b.id },
    data: { shareViews: { increment: 1 }, shareLastViewedAt: new Date() },
  });

  const cash = b.paymentType === 'CASH';
  const paid = cash ? b.totalPrice : (b.downPayment || 0) + b.payments.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const total = b.totalPrice;
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;

  // Cuentas para depositar (solo las marcadas como visibles para clientes)
  const accounts = await prismaBase.bankAccount.findMany({
    where: { tenantId: b.tenantId, isActive: true, showToClients: true },
    select: { bankName: true, referenceName: true, accountNumber: true, cardNumber: true, clabe: true },
    orderBy: { referenceName: 'asc' },
  });

  const hotels = await Promise.all(
    b.items
      .filter((i) => i.type === 'HOTEL' && i.hotel)
      .map(async (i) => ({
        name: i.hotel!.name,
        destination: i.hotel!.destination?.name ?? i.destination?.name ?? null,
        stars: i.hotel!.stars,
        diamonds: i.hotel!.diamonds,
        plan: i.plan || i.hotel!.plan || null,
        roomType: i.roomType || null,
        nights: i.numNights || null,
        adults: i.numAdults || 0,
        children: i.numChildren || 0,
        reservationNumber: i.reservationNumber || null,
        checkIn: i.hotel!.checkIn || null,
        checkOut: i.hotel!.checkOut || null,
        checkInNote: i.hotel!.checkInNote,
        checkOutNote: i.hotel!.checkOutNote,
        idRequirement: i.hotel!.idRequirement,
        includes: i.hotel!.includes,
        notIncludes: i.hotel!.notIncludes,
        images: (await Promise.all(i.hotel!.images.slice(0, 10).map(fileUrl))).filter(Boolean) as string[],
      }))
  );

  return {
    folio: b.id.slice(-8).toUpperCase(),
    agency: {
      name: b.tenant.name,
      logo: await fileUrl(b.tenant.logo),
      phone: b.tenant.phone,
      email: b.tenant.email,
      address: b.tenant.address,
      policies: b.tenant.policies,
    },
    clientName: b.client.fullName,
    destination: bookingDestination(b).name,
    departureDate: b.departureDate?.toISOString() ?? null,
    returnDate: b.returnDate?.toISOString() ?? null,
    paymentType: b.paymentType,
    total,
    downPayment: b.downPayment || 0,
    paid: Math.round(paid * 100) / 100,
    remaining,
    progress,
    payments: b.payments.map((p) => ({
      number: p.paymentNumber,
      dueDate: p.dueDate.toISOString(),
      amount: p.amount,
      paidAmount: p.paidAmount || 0,
      status: p.status,
    })),
    passengers: b.passengers.map((p) => ({ name: p.name, type: p.type, isHolder: p.isHolder })),
    hotels,
    flights: b.items
      .filter((i) => i.type === 'FLIGHT')
      .map((i) => ({
        airline: i.airline,
        flightNumber: i.flightNumber,
        origin: i.origin,
        destination: i.flightDestination,
        departureTime: i.departureTime?.toISOString() ?? null,
        arrivalTime: i.arrivalTime?.toISOString() ?? null,
        direction: i.direction,
        flightClass: i.flightClass,
        returnDepartureTime: i.returnDepartureTime?.toISOString() ?? null,
        returnArrivalTime: i.returnArrivalTime?.toISOString() ?? null,
        returnFlightNumber: i.returnFlightNumber,
      })),
    tours: b.items
      .filter((i) => i.type === 'TOUR')
      .map((i) => ({ name: i.tourName || i.description || 'Tour', date: i.tourDate?.toISOString() ?? null, people: i.numPeople || null })),
    transfers: b.items
      .filter((i) => i.type === 'TRANSFER')
      .map((i) => ({
        type: i.transportType,
        origin: i.origin,
        destination: i.flightDestination,
        direction: i.direction,
        departureTime: i.departureTime?.toISOString() ?? null,
        people: i.numPeople || null,
      })),
    accounts: accounts.map((a) => ({
      bankName: a.bankName,
      holder: a.referenceName,
      accountNumber: safeDecrypt(a.accountNumber),
      cardNumber: a.cardNumber ? safeDecrypt(a.cardNumber) : null,
      clabe: a.clabe ? safeDecrypt(a.clabe) : null,
    })),
  };
}

function safeDecrypt(value: string) {
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}
