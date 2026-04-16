import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// ─── Dominio principal del SaaS ─────────────────────────────────────────────
// Configura NEXT_PUBLIC_APP_HOSTNAME en Railway con el hostname real,
// sin protocolo ni barra final (e.g. "travelflow.up.railway.app")
const APP_HOSTNAME = process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost';

/**
 * Retorna true si el hostname pertenece al dominio principal del SaaS.
 * Cubre: dominio exacto, www., subdominio *.travelflow…, y localhost/127.0.0.1.
 */
function isAppDomain(hostname: string): boolean {
  return (
    hostname === APP_HOSTNAME ||
    hostname === `www.${APP_HOSTNAME}` ||
    hostname.endsWith(`.${APP_HOSTNAME}`) ||
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1')
  );
}

/** Rutas SaaS que no requieren autenticación (públicas). */
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/signup',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

// Middleware de autenticación reutilizado para las rutas del SaaS
const authMiddleware = withAuth({
  pages: { signIn: '/login' },
});

// ─── Middleware principal ─────────────────────────────────────────────────────
export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const hostname = (req.headers.get('host') ?? '').split(':')[0]; // strip port
  const { pathname } = req.nextUrl;

  // Siempre pasar activos estáticos y rutas internas de Next.js
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // ── 1. Dominio personalizado → rewrite a la landing del tenant ──────────────
  if (!isAppDomain(hostname)) {
    // El hostname completo se pasa como segmento dinámico.
    // La página /landings/[hostname] buscará el tenant en la BD.
    const url = req.nextUrl.clone();
    url.pathname = `/landings/${hostname}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── 2. Subdominio interno (agenciapato.travelflow…) → rewrite a landing ─────
  // Un subdominio válido contiene exactamente un nivel antes del APP_HOSTNAME.
  const subdomain = hostname.replace(`.${APP_HOSTNAME}`, '');
  const isSubdomain =
    hostname !== APP_HOSTNAME &&
    hostname !== `www.${APP_HOSTNAME}` &&
    subdomain.length > 0 &&
    !subdomain.includes('.'); // evitar falsos positivos

  if (isSubdomain) {
    const url = req.nextUrl.clone();
    url.pathname = `/landings/${subdomain}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── 3. Dominio principal del SaaS → aplicar auth de next-auth ───────────────
  // Las rutas /landings/* son públicas (ya se llegó aquí sólo si es el dominio principal)
  if (pathname.startsWith('/landings') || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return authMiddleware(req as Parameters<typeof authMiddleware>[0], event);
}

export const config = {
  // Ejecutar en todas las rutas excepto activos estáticos compilados
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
