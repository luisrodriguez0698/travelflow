import { z } from 'zod';

// Sin dependencias de servidor: se usa tambien en las pantallas.
// ─── Rifas: reglas del sorteo ────────────────────────────────────────────────

export const DRAW_MODES = ['FIRST', 'NTH', 'LAST'] as const;
export const DRAW_STYLES = ['TOMBOLA', 'SLOT', 'WHEEL'] as const;

export const DEFAULT_TERMS = `1. La participación es gratuita y no requiere compra (salvo que la agencia indique lo contrario).
2. Cada boleto tiene la misma probabilidad de ganar. El sorteo se realiza con un generador aleatorio y queda registrado.
3. El ganador será contactado por los medios que proporcionó. Si no responde en un plazo razonable, la agencia podrá sortear nuevamente el premio.
4. El premio no es canjeable por dinero en efectivo ni transferible, salvo que la agencia lo autorice.
5. La agencia organizadora es la única responsable de la rifa y de cumplir la normatividad aplicable.`;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const raffleSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(120),
    description: optionalText(2000),
    prizes: z.array(z.string().trim().min(1).max(160)).min(1, 'Agrega al menos un premio').max(10, 'Máximo 10 premios'),
    drawDate: z.coerce.date().nullable().optional(),
    drawMode: z.enum(DRAW_MODES).default('FIRST'),
    drawPosition: z.coerce.number().int().min(2, 'El número debe ser 2 o mayor').max(10000).nullable().optional(),
    style: z.enum(DRAW_STYLES).default('TOMBOLA'),
    sellTickets: z.boolean().default(false),
    ticketPrice: z.coerce.number().min(0).nullable().optional(),
    bankAccountId: z.string().nullable().optional(),
    autoTickets: z.boolean().default(false),
    autoMinAmount: z.coerce.number().min(0).nullable().optional(),
    autoTicketsPerSale: z.coerce.number().int().min(1).max(100).default(1),
    terms: optionalText(10000),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la responsabilidad legal de la rifa' }) }),
  })
  .refine((r) => r.drawMode !== 'NTH' || !!r.drawPosition, { message: 'Indica qué número de boleto gana', path: ['drawPosition'] })
  .refine((r) => !r.sellTickets || (r.ticketPrice ?? 0) > 0, { message: 'Indica el precio del boleto', path: ['ticketPrice'] })
  .refine((r) => !r.autoTickets || (r.autoMinAmount ?? -1) >= 0, { message: 'Indica el monto mínimo de venta', path: ['autoMinAmount'] });

export type RaffleInput = z.infer<typeof raffleSchema>;

export const participantSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(160),
  phone: optionalText(30),
  clientId: z.string().nullable().optional(),
  sellerId: z.string().nullable().optional(),
  tickets: z.coerce.number().int().min(1, 'Mínimo 1 boleto').max(5000, 'Máximo 5,000 boletos'),
  // Solo si la rifa vende boletos
  payment: z
    .object({ amount: z.coerce.number().positive(), bankAccountId: z.string().min(1) })
    .nullable()
    .optional(),
});

/** ¿Este boleto gana, y que lugar? (orden = posicion en que salio, desde 1) */
export function prizeFor(
  order: number,
  total: number,
  raffle: { drawMode: string; drawPosition: number | null; prizes: string[] }
): number | null {
  const prizes = raffle.prizes.length;
  if (raffle.drawMode === 'FIRST') return order <= prizes ? order - 1 : null;
  if (raffle.drawMode === 'NTH') {
    const n = raffle.drawPosition ?? 1;
    return order % n === 0 && order / n <= prizes ? order / n - 1 : null;
  }
  // LAST: el ultimo en quedar es el 1er lugar, el penultimo el 2do...
  const fromEnd = total - order + 1;
  return fromEnd <= prizes ? fromEnd - 1 : null;
}

/** Boletos necesarios para poder sortear todos los premios. */
export function ticketsNeeded(raffle: { drawMode: string; drawPosition: number | null; prizes: string[] }) {
  const prizes = raffle.prizes.length;
  if (raffle.drawMode === 'NTH') return (raffle.drawPosition ?? 1) * prizes;
  return prizes;
}
