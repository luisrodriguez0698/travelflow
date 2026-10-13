import { NextRequest, NextResponse } from 'next/server';
import {
  attemptsBlocked,
  clearAttempts,
  findSharedBooking,
  pinFromPhone,
  portalCookieName,
  portalCookieValue,
  registerFailedAttempt,
} from '@/lib/client-portal';

export const dynamic = 'force-dynamic';

/** Desbloquea el portal con los 4 ultimos digitos del telefono del cliente. */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = await params;
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  const key = `${token}:${ip}`;

  const blockedMinutes = attemptsBlocked(key);
  if (blockedMinutes) {
    return NextResponse.json({ error: `Demasiados intentos. Intenta de nuevo en ${blockedMinutes} min.` }, { status: 429 });
  }

  const booking = await findSharedBooking(token);
  // Mismo mensaje si el link no existe: no revela si es valido
  const pin = booking ? pinFromPhone(booking.client.phone) : null;
  const body = await request.json().catch(() => ({}));
  const given = String(body?.pin ?? '').replace(/\D/g, '');

  if (!booking || !pin || given !== pin) {
    const left = registerFailedAttempt(key);
    return NextResponse.json(
      { error: left > 0 ? `Los dígitos no coinciden. Te quedan ${left} intento${left === 1 ? '' : 's'}.` : 'Demasiados intentos. Espera 15 minutos.' },
      { status: 401 }
    );
  }

  clearAttempts(key);
  const res = NextResponse.json({ success: true });
  res.cookies.set(portalCookieName(token), portalCookieValue(token, pin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias en ese dispositivo
  });
  return res;
}
