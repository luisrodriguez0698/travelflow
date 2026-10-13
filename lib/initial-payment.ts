import { prisma } from './prisma';
import type { Access } from './access';

// Pago inicial de una venta: el anticipo (credito) o el total (contado). Ese
// dinero entra a una cuenta bancaria; se registra como ingreso vinculado a la
// venta con una de estas referencias.
export const INITIAL_PAYMENT_REFS = {
  DOWN_PAYMENT: 'Anticipo de venta',
  CASH: 'Pago de contado',
  /** Usada antes por la conversion de cotizaciones */
  LEGACY_CONVERT: 'Conversión de cotización a venta',
} as const;

const ALL_REFS = Object.values(INITIAL_PAYMENT_REFS);

/** Cuanto dinero entra al hacer la venta. */
export function initialPaymentAmount(b: { paymentType: string; totalPrice: number; downPayment: number }) {
  return b.paymentType === 'CASH' ? b.totalPrice : b.downPayment || 0;
}

/** Movimiento bancario (activo) del pago inicial, si ya se registro. */
export function findInitialPayment(bookingId: string) {
  return prisma.bankTransaction.findFirst({
    where: { bookingId, type: 'INCOME', status: 'ACTIVE', reference: { in: [...ALL_REFS] } },
    include: { bankAccount: { select: { id: true, referenceName: true, bankName: true } } },
  });
}

/**
 * Valida la cuenta a la que entra el pago inicial. Siempre debe existir una
 * cuenta: sin cuentas registradas no se puede recibir dinero.
 */
export async function validateInitialPaymentAccount(
  access: Access,
  bankAccountId: unknown
): Promise<{ bankAccountId: string } | { error: string; status: number }> {
  if (typeof bankAccountId !== 'string' || !bankAccountId) {
    const any = await prisma.bankAccount.count({ where: { ...access.bankScope, isActive: true } });
    return any
      ? { error: 'Selecciona la cuenta bancaria donde entra el anticipo', status: 400 }
      : { error: 'No hay cuentas bancarias registradas. Primero da de alta una cuenta en Bancos.', status: 400 };
  }
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, ...access.bankScope, isActive: true },
    select: { id: true },
  });
  return account ? { bankAccountId: account.id } : { error: 'Cuenta bancaria no válida', status: 400 };
}

/** Registra el ingreso del pago inicial y suma el saldo a la cuenta. */
export async function registerInitialPayment(params: {
  tenantId: string;
  booking: { id: string; paymentType: string; totalPrice: number; downPayment: number; saleDate: Date };
  bankAccountId: string;
  clientName: string;
  date?: Date;
}) {
  const amount = initialPaymentAmount(params.booking);
  if (amount <= 0) return null;
  const cash = params.booking.paymentType === 'CASH';
  const folio = params.booking.id.slice(-8).toUpperCase();
  const [transaction] = await prisma.$transaction([
    prisma.bankTransaction.create({
      data: {
        tenantId: params.tenantId,
        bankAccountId: params.bankAccountId,
        type: 'INCOME',
        amount,
        description: `${cash ? 'Pago de contado' : 'Anticipo'} - ${params.clientName} (venta ${folio})`,
        reference: cash ? INITIAL_PAYMENT_REFS.CASH : INITIAL_PAYMENT_REFS.DOWN_PAYMENT,
        bookingId: params.booking.id,
        date: params.date ?? new Date(),
      },
    }),
    prisma.bankAccount.update({
      where: { id: params.bankAccountId },
      data: { currentBalance: { increment: amount } },
    }),
  ]);
  return transaction;
}
