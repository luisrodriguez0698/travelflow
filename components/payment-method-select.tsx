'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/lib/payment-methods';

/** Selector de forma de pago (Transferencia, Efectivo, Deposito, Tarjeta, Otro). */
export function PaymentMethodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Forma de pago" />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
