import { ArrowDown, Landmark, Truck, User, Wallet } from 'lucide-react';

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

/**
 * Resumen de a donde va el dinero antes de guardar un cobro: cuanto paga el
 * cliente, a que cuenta entra, que parte sale a proveedores y cuanto queda.
 */
export function MoneySummary({
  concept,
  clientName,
  amount,
  accountName,
  allocations,
  extra,
}: {
  /** "Anticipo", "Pago de contado", "Abono" */
  concept: string;
  clientName?: string | null;
  amount: number;
  accountName: string;
  allocations: { name: string; amount: number }[];
  /** Lineas adicionales (p. ej. el plan de pagos) */
  extra?: string[];
}) {
  const toSuppliers = allocations.reduce((s, a) => s + a.amount, 0);
  const stays = Math.max(0, Math.round((amount - toSuppliers) * 100) / 100);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <User className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{concept} del cliente</p>
          <p className="font-medium truncate">{clientName || 'Cliente'}</p>
        </div>
        <p className="font-bold">{money(amount)}</p>
      </div>
      <ArrowDown className="w-4 h-4 mx-auto text-muted-foreground" />
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Landmark className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Entra a la cuenta</p>
          <p className="font-medium truncate">{accountName}</p>
        </div>
        <p className="font-bold text-emerald-600 dark:text-emerald-400">+{money(amount)}</p>
      </div>
      {allocations.length > 0 && (
        <>
          <ArrowDown className="w-4 h-4 mx-auto text-muted-foreground" />
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-orange-500" />
              Sale de esa cuenta para pagar a proveedores
            </p>
            {allocations.map((a) => (
              <div key={a.name} className="flex items-center justify-between">
                <span className="truncate">{a.name}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">-{money(a.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Wallet className="w-4 h-4" />
          Se queda en {accountName}
        </span>
        <span className="font-bold">{money(stays)}</span>
      </div>
      {extra?.map((line) => (
        <p key={line} className="text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
