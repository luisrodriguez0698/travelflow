import { z } from 'zod';

export const SERVICE_TYPES = ['FLIGHT', 'TOUR', 'TRANSFER'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

const text = (max = 120) => z.string().trim().max(max).nullable().optional();

export const serviceSchema = z.object({
  type: z.enum(SERVICE_TYPES),
  name: z.string().trim().max(160).optional().default(''),
  supplierId: z.string().nullable().optional(),
  isInternational: z.boolean().optional().default(false),
  cost: z.coerce.number().min(0, 'El costo no puede ser negativo').default(0),
  notes: text(2000),
  origin: text(),
  destination: text(),
  direction: z.enum(['IDA', 'REGRESO', 'IDA_Y_VUELTA']).nullable().optional(),
  departureTime: time,
  arrivalTime: time,
  returnDepartureTime: time,
  returnArrivalTime: time,
  airline: text(),
  flightNumber: text(40),
  flightClass: z.enum(['ECONOMICA', 'BUSINESS', 'PRIMERA']).nullable().optional(),
  returnFlightNumber: text(40),
  transportType: text(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

/** Nombre a mostrar en el catalogo; para vuelos/transportes se genera si viene vacio. */
export function resolveServiceName(s: ServiceInput): string {
  if (s.name) return s.name;
  const route = s.origin || s.destination ? `${s.origin || '?'} → ${s.destination || '?'}` : '';
  const base = s.type === 'FLIGHT' ? s.airline : s.type === 'TRANSFER' ? s.transportType : '';
  return [base, route].filter(Boolean).join(' ') || '';
}

/** Solo guarda los campos que aplican al tipo de servicio. */
export function toServiceData(s: ServiceInput) {
  const isFlight = s.type === 'FLIGHT';
  const hasRoute = s.type !== 'TOUR';
  const roundTrip = hasRoute && s.direction === 'IDA_Y_VUELTA';
  return {
    type: s.type,
    name: resolveServiceName(s),
    supplierId: s.supplierId || null,
    isInternational: s.isInternational,
    cost: s.cost,
    notes: s.notes || null,
    origin: hasRoute ? s.origin || null : null,
    destination: hasRoute ? s.destination || null : null,
    direction: hasRoute ? s.direction || 'IDA' : null,
    departureTime: hasRoute ? s.departureTime || null : null,
    arrivalTime: hasRoute ? s.arrivalTime || null : null,
    returnDepartureTime: roundTrip ? s.returnDepartureTime || null : null,
    returnArrivalTime: roundTrip ? s.returnArrivalTime || null : null,
    airline: isFlight ? s.airline || null : null,
    flightNumber: isFlight ? s.flightNumber || null : null,
    flightClass: isFlight ? s.flightClass || 'ECONOMICA' : null,
    returnFlightNumber: isFlight && roundTrip ? s.returnFlightNumber || null : null,
    transportType: s.type === 'TRANSFER' ? s.transportType || null : null,
  };
}
