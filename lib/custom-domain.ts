import { prismaBase } from './prisma';

// Dominio propio de cada agencia (viajaentrenubes.com). Para usarlo en links se
// exige que este VERIFICADO: que al visitarlo responda este mismo servidor
// (no basta con que el dominio exista: podria apuntar a Wix u otro hosting).

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/;
const APP_HOSTNAME = (process.env.NEXT_PUBLIC_APP_HOSTNAME ?? 'localhost').toLowerCase();
export const PING_SIGNATURE = 'travelflow';

/** "https://www.Agencia.com/algo" -> "www.agencia.com" (o null si no es un dominio valido). */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const domain = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  return DOMAIN_RE.test(domain) ? domain : null;
}

/** Dominios del propio sistema: ninguna agencia puede reclamarlos. */
export function isReservedDomain(domain: string) {
  return domain === APP_HOSTNAME || domain.endsWith(`.${APP_HOSTNAME}`) || domain.endsWith('.railway.app') || domain.endsWith('.up.railway.app');
}

/** ¿El dominio responde desde este servidor? (visita /api/portal/ping) */
export async function domainRespondsHere(domain: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://${domain}/api/portal/ping`, { signal: controller.signal, cache: 'no-store', redirect: 'follow' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.app === PING_SIGNATURE;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Verifica el dominio de la agencia y guarda el resultado. */
export async function verifyTenantDomain(tenantId: string, domain: string) {
  const ok = await domainRespondsHere(domain);
  await prismaBase.tenant.update({ where: { id: tenantId }, data: { customDomainVerifiedAt: ok ? new Date() : null } });
  return ok;
}

// Reintento automatico de dominios pendientes (como mucho cada 10 min por dominio)
const retryCache = new Map<string, number>();

/**
 * Direccion base para links publicos de la agencia: su dominio si esta
 * verificado (o se verifica ahora), si no el dominio del sistema.
 */
export async function tenantPublicBase(
  tenant: { id: string; customDomain: string | null; customDomainVerifiedAt: Date | null },
  fallbackOrigin: string
) {
  const fallback = (process.env.NEXTAUTH_URL || fallbackOrigin).replace(/\/$/, '');
  const domain = normalizeDomain(tenant.customDomain);
  if (!domain) return fallback;
  if (tenant.customDomainVerifiedAt) return `https://${domain}`;

  const last = retryCache.get(domain) ?? 0;
  if (Date.now() - last < 10 * 60 * 1000) return fallback;
  retryCache.set(domain, Date.now());
  return (await verifyTenantDomain(tenant.id, domain)) ? `https://${domain}` : fallback;
}
