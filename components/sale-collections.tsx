'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Pencil, Receipt, Truck, Undo2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCan } from '@/hooks/use-can';
import { MoneySummary } from '@/components/money-summary';
import { SupplierAllocation, allocationError, useSupplierDebts, type AllocationValue } from '@/components/supplier-allocation';

interface Collection {
  id: string;
  kind: 'anticipo' | 'contado' | 'abono';
  amount: number;
  date: string;
  description: string;
  note: string;
  account: { id: string; name: string; bank: string };
  suppliers: { transactionId: string; supplierId: string; name: string; amount: number }[];
}

interface Account {
  id: string;
  referenceName: string;
  bankName: string;
}

const KIND_LABEL = { anticipo: 'Anticipo', contado: 'Pago de contado', abono: 'Abono' } as const;
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
/** Mediodia del dia elegido: evita que cambie de dia por la zona horaria. */
const middayOf = (d: Date) => {
  const at = new Date(d);
  at.setHours(12, 0, 0, 0);
  return at;
};

/**
 * Cobros registrados de la venta. Cada uno se puede corregir (cuenta y/o
 * reparto a proveedores) o anular junto con sus pagos a proveedores, en un paso.
 */
export function SaleCollections({
  saleId,
  clientName,
  accounts,
  refreshKey,
  onChanged,
}: {
  saleId: string;
  clientName?: string | null;
  accounts: Account[];
  /** Cambia cuando la venta se recarga (p. ej. tras un abono) */
  refreshKey?: unknown;
  onChanged: () => void;
}) {
  const can = useCan();
  const { toast } = useToast();
  const [items, setItems] = useState<Collection[]>([]);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [voiding, setVoiding] = useState<Collection | null>(null);
  const [accountId, setAccountId] = useState('');
  const [allocations, setAllocations] = useState<AllocationValue[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const rawDebts = useSupplierDebts(saleId, !!editing);

  const load = useCallback(() => {
    fetch(`/api/sales/${saleId}/collections`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
  }, [saleId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Lo que se le debe a cada proveedor contando de vuelta lo que salio de este cobro
  const debts = useMemo(() => {
    if (!editing) return rawDebts;
    const list = rawDebts.map((d) => ({
      ...d,
      pending: d.pending + editing.suppliers.filter((s) => s.supplierId === d.supplierId).reduce((t, s) => t + s.amount, 0),
    }));
    for (const s of editing.suppliers) {
      if (!list.some((d) => d.supplierId === s.supplierId)) list.push({ supplierId: s.supplierId, name: s.name, pending: s.amount });
    }
    return list;
  }, [rawDebts, editing]);

  const openEdit = (c: Collection) => {
    setEditing(c);
    setAccountId(c.account.id);
    setDate(new Date(c.date));
    setNote(c.note || '');
    const merged = new Map<string, number>();
    for (const s of c.suppliers) merged.set(s.supplierId, (merged.get(s.supplierId) ?? 0) + s.amount);
    setAllocations([...merged.entries()].map(([supplierId, amount]) => ({ supplierId, amount })));
  };

  const submit = async (action: 'correct' | 'void', c: Collection) => {
    if (action === 'correct') {
      const issue = allocationError(allocations, debts, c.amount);
      if (issue) {
        toast({ title: 'Pago a proveedores', description: issue, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/collections/${c.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'void'
            ? { action }
            : {
                action,
                bankAccountId: accountId,
                supplierAllocations: allocations,
                // Solo si se eligio otro dia
                date: date.toDateString() !== new Date(c.date).toDateString() ? middayOf(date).toISOString() : undefined,
                note,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast({ title: action === 'void' ? 'Cobro anulado' : 'Cobro corregido', description: data.message });
      setEditing(null);
      setVoiding(null);
      load();
      onChanged();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo aplicar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!items.length) return null;
  const canFix = can('ventas', 'payments');
  const targetName = (() => {
    const a = accounts.find((x) => x.id === accountId);
    return a ? `${a.referenceName} · ${a.bankName}` : editing?.account.name || '';
  })();

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <Receipt className="w-4 h-4 text-primary" />
        Cobros registrados
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        ¿Se registró en la cuenta equivocada o con otro proveedor? Corrígelo aquí en un solo paso.
      </p>
      <div className="divide-y">
        {items.map((c) => (
          <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{KIND_LABEL[c.kind]}</Badge>
                <span className="font-semibold">{money(c.amount)}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(c.date)}</span>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                {c.account.name} · {c.account.bank}
              </p>
              {c.note && <p className="text-xs text-muted-foreground">Ref. {c.note}</p>}
              {c.suppliers.length > 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5 flex-wrap">
                  <Truck className="w-3.5 h-3.5" />
                  {c.suppliers.map((s) => `${s.name} ${money(s.amount)}`).join(' · ')}
                </p>
              )}
            </div>
            {canFix && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Corregir
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setVoiding(c)}>
                  <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                  Anular
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Corregir: cuenta y reparto a proveedores en un paso */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Corregir {editing ? KIND_LABEL[editing.kind].toLowerCase() : ''}</DialogTitle>
            <DialogDescription>
              Cambia la cuenta, la fecha, la referencia y/o a qué proveedores se pagó. El monto y la venta no cambian; los saldos y deudas se ajustan solos.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Cuenta donde entró el dinero</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!accounts.some((a) => a.id === editing.account.id) && (
                      <SelectItem value={editing.account.id}>
                        {editing.account.name} · {editing.account.bank}
                      </SelectItem>
                    )}
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.referenceName} · {a.bankName}
                        {a.id === editing.account.id ? ' (actual)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha en que entró el dinero</Label>
                  <DatePicker
                    value={date}
                    onChange={(d) => d && setDate(d)}
                    maxDate={new Date()}
                    fromYear={new Date().getFullYear() - 2}
                    toYear={new Date().getFullYear()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Referencia del banco / notas</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej. 0119498527" />
                </div>
              </div>
              <SupplierAllocation amount={editing.amount} debts={debts} value={allocations} onChange={setAllocations} />
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Así quedará</p>
                <MoneySummary
                  concept={KIND_LABEL[editing.kind]}
                  clientName={clientName}
                  amount={editing.amount}
                  accountName={targetName}
                  allocations={allocations.map((a) => ({
                    name: debts.find((d) => d.supplierId === a.supplierId)?.name || 'Proveedor',
                    amount: a.amount,
                  }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => editing && submit('correct', editing)} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular: cobro + pagos a proveedores que salieron de el */}
      <AlertDialog open={!!voiding} onOpenChange={(open) => !open && setVoiding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este cobro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {voiding && (
                  <>
                    <p>
                      Se cancela el {KIND_LABEL[voiding.kind].toLowerCase()} de <b>{money(voiding.amount)}</b> en {voiding.account.name}
                      {voiding.suppliers.length > 0 && <> y sus {voiding.suppliers.length} pago(s) a proveedor (la deuda vuelve a quedar pendiente)</>}.
                    </p>
                    <p>
                      {voiding.kind === 'abono'
                        ? 'El abono se quita del plan de pagos del cliente.'
                        : 'La venta volverá a mostrar el aviso de "sin banco" para registrarlo de nuevo con los datos correctos.'}
                    </p>
                    <p className="text-muted-foreground">Usa esto si el monto estaba mal. Si solo fue la cuenta o el proveedor, mejor usa Corregir.</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (voiding) submit('void', voiding);
              }}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
