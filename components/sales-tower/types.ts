// Torre de control de ventas: tipos y estilos compartidos.

export type TowerStatus = 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'SETTLED';

export interface TowerPayment {
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
}

export interface TowerSale {
  id: string;
  folio: string;
  client: string;
  phone: string | null;
  agentId: string;
  agent: string | null;
  total: number;
  paid: number;
  pct: number;
  status: TowerStatus;
  overdueAmount: number;
  saleDate: string;
  departureDate: string | null;
  next: { number: number; dueDate: string; pending: number } | null;
  payments: TowerPayment[];
}

export interface TowerUpcoming {
  saleId: string;
  client: string;
  phone: string | null;
  agent: string | null;
  status: TowerStatus;
  number: number;
  dueDate: string;
  pending: number;
}

export interface TowerData {
  kpis: {
    collectedMonth: number;
    dueNext7: number;
    dueNext7Count: number;
    overdue: number;
    overdueCount: number;
    settled: number;
    active: number;
  };
  sales: TowerSale[];
  upcoming: TowerUpcoming[];
}

export const STATUS_META: Record<TowerStatus, { label: string; short: string; color: string; badge: string; order: number }> = {
  OVERDUE: { label: 'Atrasado', short: 'ATRASADO', color: '#ef4444', badge: 'bg-red-500/15 text-red-600 dark:text-red-400', order: 0 },
  DUE_SOON: { label: 'Pago en 7 días', short: 'PRÓXIMO', color: '#f59e0b', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', order: 1 },
  ON_TRACK: { label: 'Al corriente', short: 'A TIEMPO', color: '#10b981', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', order: 2 },
  SETTLED: { label: 'Liquidada', short: 'LIQUIDADO', color: '#0ea5e9', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400', order: 3 },
};

const TZ = 'America/Mexico_City';
export const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TZ }).replace('.', '');
export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });

/** Dias que faltan (negativo = ya paso). */
export function daysFrom(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

export function whenLabel(iso: string) {
  const d = daysFrom(iso);
  if (d < -1) return `hace ${-d} días`;
  if (d === -1) return 'ayer';
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  return `en ${d} días`;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
