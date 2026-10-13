'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCan } from '@/hooks/use-can';
import { InitialPaymentAccount } from '@/components/initial-payment-account';
import { SupplierAllocation, allocationError, useSupplierDebts, type AllocationValue } from '@/components/supplier-allocation';

export interface InitialPaymentInfo {
  amount: number;
  account: { name: string; bank: string; date: string } | null;
}

/**
 * Estado del anticipo / pago de contado de una venta: en que cuenta entro o,
 * si se guardo sin cuenta (ventas anteriores), permite registrarlo en un banco.
 */
export function InitialPaymentBanner({
  saleId,
  cash,
  info,
  onRegistered,
}: {
  saleId: string;
  cash: boolean;
  info: InitialPaymentInfo | undefined;
  onRegistered: () => void;
}) {
  const can = useCan();
  const { toast } = useToast();
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [allocations, setAllocations] = useState<AllocationValue[]>([]);
  const pendingRegistration = !!info && info.amount > 0 && !info.account;
  const debts = useSupplierDebts(saleId, pendingRegistration);

  if (!info || info.amount <= 0) return null;
  const what = cash ? 'pago de contado' : 'anticipo';
  const amount = `$${info.amount.toLocaleString('es-MX')}`;

  if (info.account) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        {cash ? 'Pago de contado' : 'Anticipo'} de {amount} registrado en <b className="text-foreground">{info.account.name}</b> ({info.account.bank})
      </p>
    );
  }

  const register = async () => {
    const allocIssue = allocationError(allocations, debts, info.amount);
    if (allocIssue) {
      toast({ title: 'Pago a proveedores', description: allocIssue, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/initial-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: accountId, supplierAllocations: allocations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Registrado en el banco', description: `El ${what} de ${amount} ya aparece en la cuenta.` });
      onRegistered();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo registrar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 border-amber-500/40 bg-amber-500/10 space-y-3">
      <div className="flex gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="font-medium">El {what} de {amount} no está registrado en ningún banco</p>
          <p className="text-sm text-muted-foreground">
            Se cuenta como pagado en la venta, pero no aparece en Bancos. Indica a qué cuenta entró para que los saldos cuadren
            (se registra con la fecha de la venta).
          </p>
        </div>
      </div>
      {can('ventas', 'payments') ? (
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <InitialPaymentAccount amount={info.amount} cash={cash} value={accountId} onChange={setAccountId} />
          </div>
          <Button onClick={register} disabled={!accountId || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar en banco
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Pide a alguien con permiso de registrar abonos que lo asigne.</p>
      )}
      {can('ventas', 'payments') && accountId && (
        <SupplierAllocation amount={info.amount} debts={debts} value={allocations} onChange={setAllocations} />
      )}
    </Card>
  );
}
