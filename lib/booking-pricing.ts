// Precio de venta por servicio (habitacion, vuelo, tour, transporte). Sin
// dependencias de servidor: lo usan los formularios y las APIs.
//
// Regla: si al menos un servicio tiene precio de venta, el precio total de la
// venta/cotizacion es la suma de los servicios (los que no tienen precio se
// toman a costo). Ventas anteriores sin precios por servicio siguen con su
// total capturado a mano.

type PricedItem = { cost?: number | null; salePrice?: number | string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function hasSalePrice(item: PricedItem) {
  return item.salePrice !== null && item.salePrice !== undefined && item.salePrice !== '';
}

/** Precio de venta del servicio (o su costo si no tiene). */
export function itemSalePrice(item: PricedItem) {
  return hasSalePrice(item) ? Number(item.salePrice) || 0 : item.cost || 0;
}

/** Total de venta calculado de los servicios, o null si se captura a mano. */
export function saleTotalFromItems(items: PricedItem[] | null | undefined): number | null {
  if (!items?.length || !items.some(hasSalePrice)) return null;
  return round2(items.reduce((sum, item) => sum + itemSalePrice(item), 0));
}

/** Valor a guardar en BookingItem.salePrice. */
export function salePriceToStore(item: PricedItem): number | null {
  if (!hasSalePrice(item)) return null;
  const value = Number(item.salePrice);
  return Number.isFinite(value) && value >= 0 ? round2(value) : null;
}

/** Margen en % sobre el costo (igual que el resumen de la venta); null sin costo. */
export function marginPercent(profit: number, cost: number): number | null {
  return cost > 0 ? (profit / cost) * 100 : null;
}

/** " (16.0%)" o "" si no hay costo. */
export function marginLabel(profit: number, cost: number): string {
  const m = marginPercent(profit, cost);
  return m === null ? '' : ` (${m.toFixed(1)}%)`;
}
