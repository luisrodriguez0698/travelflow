import { prisma } from './prisma';

// Ayudas comunes para listas del catalogo (destinos, hoteles, servicios):
// filtro "Creado por", opciones del filtro y orden por nombre de quien creo.

export type SortDir = 'asc' | 'desc';

/** ?createdBy=id1,id2,none -> condicion de Prisma (o null si no hay filtro). */
export function creatorWhere(searchParams: URLSearchParams): object | null {
  const values = (searchParams.get('createdBy') || '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, 50);
  if (!values.length) return null;
  const ids = values.filter((v) => v !== 'none');
  return {
    OR: [...(ids.length ? [{ createdBy: { in: ids } }] : []), ...(values.includes('none') ? [{ createdBy: null }] : [])],
  };
}

/** ?sort=campo&dir=asc|desc, limitado a los campos permitidos. */
export function parseSort<K extends string>(searchParams: URLSearchParams, allowed: readonly K[], fallback: { field: K; dir: SortDir }) {
  const field = searchParams.get('sort') as K | null;
  const dir = searchParams.get('dir');
  return {
    field: field && allowed.includes(field) ? field : fallback.field,
    dir: dir === 'asc' || dir === 'desc' ? dir : fallback.dir,
  } as { field: K; dir: SortDir };
}

/** Nombre visible de cada usuario (id -> nombre). */
export async function userNames(ids: (string | null)[], tenantId: string) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({ where: { id: { in: unique }, tenantId }, select: { id: true, name: true, email: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name || u.email || 'Usuario']));
}

/** Opciones del filtro "Creado por" a partir de un groupBy por createdBy. */
export async function creatorOptions(groups: { createdBy: string | null; _count: { _all: number } }[], tenantId: string) {
  const ids = groups.map((g) => g.createdBy).filter(Boolean) as string[];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true, email: true, avatar: true } })
    : [];
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return groups
    .map((g) => ({
      id: g.createdBy ?? 'none',
      name: g.createdBy ? byId[g.createdBy]?.name || byId[g.createdBy]?.email || 'Usuario eliminado' : 'Sin registro',
      avatar: g.createdBy ? byId[g.createdBy]?.avatar ?? null : null,
      count: g._count._all,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Orden por "Creado por" (nombre del usuario, que no es una columna): ordena
 * los ids en memoria y devuelve solo los de la pagina pedida.
 */
export async function idsSortedByCreator(
  rows: { id: string; createdBy: string | null; label: string }[],
  tenantId: string,
  dir: SortDir,
  skip: number,
  take: number
) {
  const names = await userNames(rows.map((r) => r.createdBy), tenantId);
  const key = (r: (typeof rows)[number]) => (r.createdBy ? (names[r.createdBy] ?? '').toLowerCase() : '￿');
  rows.sort((a, b) => {
    const cmp = key(a).localeCompare(key(b), 'es') || a.label.localeCompare(b.label, 'es');
    return dir === 'asc' ? cmp : -cmp;
  });
  return { total: rows.length, pageIds: rows.slice(skip, skip + take).map((r) => r.id) };
}

/** Reordena registros segun la lista de ids. */
export function inIdOrder<T extends { id: string }>(items: T[], ids: string[]) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
}
