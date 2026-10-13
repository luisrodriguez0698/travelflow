'use client';

import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';

export interface SupplierDebtView {
  supplierId: string;
  name: string;
  pending: number;
}

export interface AllocationValue {
  supplierId: string;
  amount: number;
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Error del reparto en pantalla (el servidor vuelve a validar). */
export function allocationError(value: AllocationValue[], debts: SupplierDebtView[], amount: number): string | null {
  for (const a of value) {
    const d = debts.find((x) => x.supplierId === a.supplierId);
    if (d && a.amount > d.pending + 0.01) return `A ${d.name} solo se le deben ${money(d.pending)}`;
  }
  const total = value.reduce((s, a) => s + a.amount, 0);
  if (total > amount + 0.01) return `A proveedores van ${money(total)}, más que el cobro de ${money(amount)}`;
  return null;
}

/** Carga lo que se debe a cada proveedor de una venta/cotizacion ya guardada. */
export function useSupplierDebts(bookingId: string | null | undefined, enabled = true) {
  const [debts, setDebts] = useState<SupplierDebtView[]>([]);
  useEffect(() => {
    if (!bookingId || !enabled) return;
    fetch(`/api/bookings/${bookingId}/supplier-debts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDebts(Array.isArray(d) ? d : []))
      .catch(() => setDebts([]));
  }, [bookingId, enabled]);
  return debts;
}

/**
 * "¿Pagar al proveedor desde este cobro?": reparte el anticipo/abono entre la
 * cuenta de la agencia y uno o varios proveedores de la venta.
 */
export function SupplierAllocation({
  amount,
  debts,
  value,
  onChange,
}: {
  amount: number;
  debts: SupplierDebtView[];
  value: AllocationValue[];
  onChange: (value: AllocationValue[]) => void;
}) {
  const can = useCan();
  const [enabled, setEnabled] = useState(value.length > 0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const payable = debts.filter((d) => d.pending > 0);

  if (!can('proveedores', 'payments') || !payable.length || amount <= 0) return null;

  const amountFor = (id: string) => value.find((a) => a.supplierId === id)?.amount ?? 0;
  const toSuppliers = round2(value.reduce((s, a) => s + a.amount, 0));
  const error = allocationError(value, payable, amount);

  const setAmount = (supplierId: string, next: number) => {
    const rest = value.filter((a) => a.supplierId !== supplierId);
    onChange(next > 0 ? [...rest, { supplierId, amount: round2(next) }] : rest);
  };

  const toggle = (on: boolean) => {
    setEnabled(on);
    if (!on) {
      onChange([]);
      setDrafts({});
    }
  };

  return (
    <div className={cn('rounded-lg border p-3 space-y-3', enabled && 'border-orange-500/40 bg-orange-500/5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-orange-500" />
            ¿Pagar al proveedor desde este cobro?
          </p>
          <p className="text-xs text-muted-foreground">
            El dinero entra a la cuenta y en ese momento sale al proveedor (baja su deuda en esta venta).
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>

      {enabled && (
        <>
          <div className="space-y-2">
            {payable.map((d) => {
              const current = amountFor(d.supplierId);
              const othersTotal = toSuppliers - current;
              const max = round2(Math.min(d.pending, Math.max(0, amount - othersTotal)));
              return (
                <div key={d.supplierId} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">Se le debe {money(d.pending)}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    inputMode="decimal"
                    className="w-28 text-right"
                    placeholder="0"
                    value={drafts[d.supplierId] ?? (current ? String(current) : '')}
                    onChange={(e) => setDrafts((p) => ({ ...p, [d.supplierId]: e.target.value }))}
                    onBlur={() => {
                      const raw = drafts[d.supplierId];
                      setDrafts(({ [d.supplierId]: _, ...rest }) => rest);
                      if (raw !== undefined) setAmount(d.supplierId, parseFloat(raw.replace(/[^0-9.]/g, '')) || 0);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={max <= 0} onClick={() => setAmount(d.supplierId, max)}>
                    Máx.
                  </Button>
                </div>
              );
            })}
          </div>
          <div className={cn('rounded-md px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1', error ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-muted/50')}>
            <span>
              A proveedores: <b>{money(toSuppliers)}</b>
            </span>
            <span>
              Se queda en la cuenta: <b>{money(Math.max(0, round2(amount - toSuppliers)))}</b>
            </span>
            {error && <span className="font-medium">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
