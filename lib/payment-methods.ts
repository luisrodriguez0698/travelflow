// Forma en que el cliente pago un cobro (anticipo, contado o abono). Es un dato
// interno de la agencia: no aparece en el recibo del cliente.

export const PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DEPOSIT', label: 'Depósito' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'TRANSFER';

/** Valor valido o null (lo que llegue del formulario). */
export function cleanPaymentMethod(value: unknown): PaymentMethod | null {
  return PAYMENT_METHODS.some((m) => m.value === value) ? (value as PaymentMethod) : null;
}

export function paymentMethodLabel(value: string | null | undefined) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? null;
}
