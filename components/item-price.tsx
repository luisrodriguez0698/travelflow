import { TableCell, TableHead } from '@/components/ui/table';
import { hasSalePrice, itemSalePrice, marginLabel } from '@/lib/booking-pricing';
import { cn } from '@/lib/utils';

// Costo, venta y ganancia de cada servicio en el detalle de ventas/cotizaciones
// (solo para uso interno: el PDF del cliente muestra unicamente el total).

type Item = { cost: number; salePrice?: number | null };

const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
const profitClass = (n: number) => (n < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400');

export function ItemPriceHeads() {
  return (
    <>
      <TableHead className="text-right">Costo</TableHead>
      <TableHead className="text-right">Venta</TableHead>
      <TableHead className="text-right">Ganancia</TableHead>
    </>
  );
}

export function ItemPriceCells({ item }: { item: Item }) {
  const priced = hasSalePrice(item);
  const profit = itemSalePrice(item) - (item.cost || 0);
  return (
    <>
      <TableCell className="text-right font-medium">{money(item.cost || 0)}</TableCell>
      <TableCell className="text-right">{priced ? money(itemSalePrice(item)) : '—'}</TableCell>
      <TableCell className={cn('text-right font-medium whitespace-nowrap', priced && profitClass(profit))}>
        {priced ? `${money(profit)}${marginLabel(profit, item.cost || 0)}` : '—'}
      </TableCell>
    </>
  );
}

/** Version compacta (tarjetas en movil). */
export function ItemPriceBlock({ item }: { item: Item }) {
  if (!hasSalePrice(item)) return <p className="font-semibold shrink-0">{money(item.cost || 0)}</p>;
  const profit = itemSalePrice(item) - (item.cost || 0);
  return (
    <div className="text-right shrink-0 leading-tight">
      <p className="font-semibold">{money(itemSalePrice(item))}</p>
      <p className="text-[11px] text-muted-foreground">Costo {money(item.cost || 0)}</p>
      <p className={cn('text-[11px] font-medium', profitClass(profit))}>
        Gana {money(profit)}
        {marginLabel(profit, item.cost || 0)}
      </p>
    </div>
  );
}
