import { decrypt } from './encryption';

// Datos opcionales de una cuenta: numero de tarjeta y CLABE (se guardan cifrados)

const digits = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');

/** Devuelve los valores limpios (solo digitos; '' = sin dato) o un error. */
export function parseBankExtras(body: { cardNumber?: unknown; clabe?: unknown }):
  | { cardNumber: string; clabe: string }
  | { error: string } {
  const cardNumber = digits(body.cardNumber);
  const clabe = digits(body.clabe);
  if (cardNumber && (cardNumber.length < 15 || cardNumber.length > 19)) {
    return { error: 'El número de tarjeta debe tener entre 15 y 19 dígitos' };
  }
  if (clabe && clabe.length !== 18) return { error: 'La CLABE debe tener 18 dígitos' };
  return { cardNumber, clabe };
}

/** Numero de cuenta, tarjeta y CLABE descifrados (nunca mandar los valores "enc:" al navegador). */
export function decryptAccountFields(a: { accountNumber: string; cardNumber?: string | null; clabe?: string | null }) {
  return {
    accountNumber: decrypt(a.accountNumber),
    cardNumber: a.cardNumber ? decrypt(a.cardNumber) : null,
    clabe: a.clabe ? decrypt(a.clabe) : null,
  };
}
