import { z } from 'zod';
import type { BookingItemData } from '@/components/booking-items-form';

// Campos de un servicio que se guardan en la plantilla. Se omiten los datos
// propios de cada viaje: fechas (tourDate, supplierDeadline), pasajeros,
// numero de reservacion e id del item.
const TEMPLATE_ITEM_KEYS = [
  'type', 'description', 'cost', 'isInternational',
  // Hotel
  'hotelId', 'destinationId', 'roomType', 'plan', 'numAdults', 'numChildren', 'freeChildren',
  'pricePerNight', 'numNights', 'priceAdult', 'priceChild', 'pricePackage',
  // Flight / Transfer
  'airline', 'flightNumber', 'origin', 'flightDestination', 'flightClass', 'direction',
  'departureTime', 'arrivalTime', 'returnDepartureTime', 'returnArrivalTime', 'returnFlightNumber',
  'transportType',
  // Tour
  'tourName', 'numPeople', 'pricePerPerson',
  // Supplier / catalog
  'supplierId', 'serviceId',
] as const;

const ITEM_TYPES = ['HOTEL', 'FLIGHT', 'TOUR', 'TRANSFER', 'OTHER'];
const TIME_KEYS = ['departureTime', 'arrivalTime', 'returnDepartureTime', 'returnArrivalTime'] as const;

export type TemplateItem = Partial<Record<(typeof TEMPLATE_ITEM_KEYS)[number], unknown>>;

/** Deja solo campos permitidos con tipos primitivos (string/number/boolean). */
export function sanitizeTemplateItems(raw: unknown): TemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object' && ITEM_TYPES.includes((it as any).type))
    .slice(0, 50)
    .map((it) => {
      const clean: TemplateItem = {};
      for (const key of TEMPLATE_ITEM_KEYS) {
        let value = it[key];
        if (value instanceof Date) value = value.toISOString();
        if (typeof value === 'string') {
          if (value.length > 500) value = value.slice(0, 500);
        } else if (typeof value === 'number') {
          if (!Number.isFinite(value)) continue;
        } else if (typeof value !== 'boolean') {
          continue;
        }
        clean[key] = value;
      }
      clean.cost = typeof clean.cost === 'number' ? clean.cost : 0;
      return clean;
    });
}

/** Plantilla -> items del formulario (horas como Date, como espera el TimePicker). */
export function templateItemsToFormItems(items: TemplateItem[]): BookingItemData[] {
  return items.map((it, idx) => {
    const item = { ...it, sortOrder: idx } as unknown as BookingItemData;
    for (const key of TIME_KEYS) {
      const value = it[key];
      (item as any)[key] = typeof value === 'string' && value ? new Date(value) : null;
    }
    if (item.type === 'HOTEL') item.passengers = [];
    return item;
  });
}

export interface PackageTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  totalPrice: number;
  notes: string | null;
  items: TemplateItem[];
  creatorName?: string | null;
  updatedAt: string;
}

export const templateSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  totalPrice: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(5000).nullable().optional(),
  items: z.array(z.unknown()).max(50, 'Máximo 50 servicios por plantilla'),
});
