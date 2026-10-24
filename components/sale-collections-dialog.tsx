'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { SaleCollections } from '@/components/sale-collections';

interface Account {
  id: string;
  referenceName: string;
  bankName: string;
}

/** Cobros de una venta (anticipo y abonos) sin salir de la lista de ventas. */
export function SaleCollectionsDialog({
  sale,
  onOpenChange,
  onChanged,
}: {
  sale: { id: string; clientName?: string | null } | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  // Cuentas para "Corregir": se piden la primera vez que se abre
  useEffect(() => {
    if (!sale || accounts) return;
    fetch('/api/bank-accounts?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]));
  }, [sale, accounts]);

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Cobros de {sale?.clientName || 'la venta'}</DialogTitle>
          <DialogDescription>
            Folio {sale?.id.slice(-8).toUpperCase()} · anticipo y abonos con quién los registró, cuenta y referencia.
          </DialogDescription>
        </DialogHeader>
        {sale && (
          <SaleCollections
            key={sale.id}
            saleId={sale.id}
            clientName={sale.clientName}
            accounts={accounts ?? []}
            onChanged={() => onChanged?.()}
            showEmpty
          />
        )}
        {sale && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/sales/${sale.id}`}>
                <Eye className="mr-1.5 h-4 w-4" />
                Ver detalle de la venta
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
