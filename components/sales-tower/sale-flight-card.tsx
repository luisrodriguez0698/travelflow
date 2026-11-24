'use client';

import Link from 'next/link';
import { CalendarClock, MessageCircle, Plane, Receipt, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappTo } from '@/components/client-link-dialog';
import { cn } from '@/lib/utils';
import { STATUS_META, longDate, money, whenLabel, type TowerSale } from './types';

/** Mensaje amable de recordatorio de pago. */
function reminderText(s: TowerSale) {
  const first = s.client.split(/\s+/)[0];
  if (!s.next) return `¡Hola ${first}! ✈️`;
  const late = s.status === 'OVERDUE';
  return (
    `¡Hola ${first}! ✈️ Te escribimos por tu viaje (folio ${s.folio}).\n\n` +
    (late
      ? `Tienes un pago pendiente de ${money(s.overdueAmount || s.next.pending)} que vencía el ${longDate(s.next.dueDate)}.`
      : `Tu próximo pago es de ${money(s.next.pending)} y vence el ${longDate(s.next.dueDate)}.`) +
    '\n\nCualquier duda estamos para ayudarte 💙'
  );
}

/** Tarjeta tipo pase de abordar con el estado de una venta. */
export function SaleFlightCard({ sale }: { sale: TowerSale }) {
  const meta = STATUS_META[sale.status];
  return (
    <div className="w-72 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{sale.client}</p>
          <p className="font-mono text-[11px] text-muted-foreground">Folio {sale.folio}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', meta.badge)}>{meta.label}</span>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Pagado</span>
          <span>
            <b className="tabular-nums">{money(sale.paid)}</b> <span className="text-muted-foreground">de {money(sale.total)}</span>
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${sale.pct}%`, background: meta.color }} />
        </div>
        <p className="mt-0.5 text-right text-[11px] font-semibold tabular-nums" style={{ color: meta.color }}>
          {sale.pct}%
        </p>
      </div>

      <div className="space-y-1.5 text-xs">
        {sale.next && (
          <p className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            Pago #{sale.next.number}: <b className="tabular-nums">{money(sale.next.pending)}</b>
            <span className={cn('ml-auto', sale.status === 'OVERDUE' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
              {whenLabel(sale.next.dueDate)}
            </span>
          </p>
        )}
        {sale.overdueAmount > 0 && (
          <p className="rounded-md bg-red-500/10 px-2 py-1 font-medium text-red-600 dark:text-red-400">
            Atrasado: {money(sale.overdueAmount)}
          </p>
        )}
        {sale.departureDate && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Plane className="h-3.5 w-3.5" />
            Viaja el {longDate(sale.departureDate)}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" />
          {sale.agent ?? 'Sin agente'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild size="sm" variant="gradient" className="h-8 text-xs">
          <Link href={`/sales/${sale.id}`}>
            <Receipt className="mr-1 h-3.5 w-3.5" />
            Registrar abono
          </Link>
        </Button>
        {sale.phone && sale.next ? (
          <Button asChild size="sm" variant="outline" className="h-8 text-xs text-emerald-700 dark:text-emerald-400">
            <a href={whatsappTo(sale.phone, reminderText(sale))} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              Recordar
            </a>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href={`/sales/${sale.id}`}>Ver venta</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
