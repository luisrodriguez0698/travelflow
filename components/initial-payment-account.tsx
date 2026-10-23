'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Landmark } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/hooks/use-can';

interface Account {
  id: string;
  referenceName: string;
  bankName: string;
  currentBalance: number;
}

/**
 * Cuenta bancaria donde entra el anticipo (o el pago de contado). Es
 * obligatoria: sin cuentas registradas avisa que primero hay que crear una.
 */
export function InitialPaymentAccount({
  amount,
  cash,
  value,
  onChange,
  onAccountName,
  note,
  onNoteChange,
}: {
  amount: number;
  cash: boolean;
  value: string;
  onChange: (id: string) => void;
  /** Nombre legible de la cuenta elegida (para el resumen antes de guardar) */
  onAccountName?: (name: string) => void;
  /** Referencia del banco / notas del pago (opcional): se muestra si se pasa onNoteChange */
  note?: string;
  onNoteChange?: (note: string) => void;
}) {
  const can = useCan();
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    fetch('/api/bank-accounts?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const acc = accounts?.find((a) => a.id === value);
    if (onAccountName) onAccountName(acc ? `${acc.referenceName} · ${acc.bankName}` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, value]);

  if (amount <= 0) return null;
  const what = cash ? 'el pago de contado' : 'el anticipo';

  if (accounts && accounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">No hay cuentas bancarias registradas</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Para recibir {what} de ${amount.toLocaleString('es-MX')} primero da de alta la cuenta donde entra el dinero.
          </p>
          {can('bancos', 'create') ? (
            <Link href="/banks" target="_blank" className="text-xs font-medium text-primary underline mt-1 inline-block">
              Crear cuenta en Bancos
            </Link>
          ) : (
            <p className="text-xs mt-1">Pide a un administrador que registre una cuenta (o que te comparta una).</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Landmark className="w-4 h-4 text-primary" />
        Cuenta donde entra {what} (${amount.toLocaleString('es-MX')}) *
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className={!value ? 'border-amber-500/50' : undefined}>
          <SelectValue placeholder={accounts ? 'Selecciona la cuenta' : 'Cargando cuentas…'} />
        </SelectTrigger>
        <SelectContent>
          {(accounts ?? []).map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.referenceName} · {a.bankName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onNoteChange && (
        <Input
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={200}
          placeholder="Referencia del banco / notas (opcional)"
        />
      )}
    </div>
  );
}
