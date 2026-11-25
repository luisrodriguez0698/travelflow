// Reglas y tipos de comisiones (sin dependencias de servidor: se usa en API y en UI)

export const COMMISSION_BASES = {
  PROFIT: { label: 'Ganancia (precio − costo)', short: 'de la ganancia' },
  SALE: { label: 'Total vendido', short: 'del total vendido' },
} as const;
export type CommissionBase = keyof typeof COMMISSION_BASES;

export const EARNED_WHEN = {
  PAID: { label: 'Cuando el cliente liquida', hint: 'Se gana completa cuando la venta queda pagada.' },
  PROPORTIONAL: { label: 'Según lo cobrado', hint: 'Si el cliente lleva 50%, ya ganó el 50% de su comisión.' },
  SALE: { label: 'Al vender', hint: 'Se gana completa desde que se registra la venta.' },
} as const;
export type EarnedWhen = keyof typeof EARNED_WHEN;

export const SALARY_FREQUENCIES = {
  SEMANAL: { label: 'Semanal', perMonth: 52 / 12 },
  QUINCENAL: { label: 'Quincenal', perMonth: 2 },
  MENSUAL: { label: 'Mensual', perMonth: 1 },
} as const;
export type SalaryFrequency = keyof typeof SALARY_FREQUENCIES;

export type CommissionStatus = 'WAITING' | 'PARTIAL' | 'EARNED' | 'PAID' | 'CANCELLED' | 'CLAWBACK';

export interface CommissionRow {
  bookingId: string;
  folio: string;
  client: string;
  saleDate: string;
  agentId: string;
  total: number;
  cost: number;
  baseAmount: number;
  rate: number;
  commission: number; // comision completa de la venta
  collectedPct: number;
  earned: number; // lo ya ganado segun la regla
  paid: number;
  pending: number; // earned - paid (negativo = se pago de mas: a descontar)
  status: CommissionStatus;
  cancelled: boolean;
  override: { rate: number | null; amount: number | null; note: string | null } | null;
}

export interface AgentSummary {
  userId: string;
  name: string;
  avatar: string | null;
  setting: {
    baseSalary: number;
    salaryFrequency: SalaryFrequency;
    commissionRate: number;
    commissionBase: CommissionBase;
    earnedWhen: EarnedWhen;
    startDate: string;
    isActive: boolean;
    notes: string | null;
  } | null;
  salesCount: number;
  generated: number; // comision de todas sus ventas (ganada o por ganar)
  earned: number;
  paid: number;
  pending: number; // ganado y sin pagar
  toDeduct: number; // pagado de mas (ventas canceladas)
  waiting: number; // por ganar (falta que el cliente pague)
  monthGenerated: number; // comision de las ventas de este mes
  lastPayoutAt: string | null;
}

