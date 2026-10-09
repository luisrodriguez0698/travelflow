'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ShoppingCart, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Sale {
  id: string;
  totalPrice: number;
  paymentType: string;
  saleDate: Date;
  client: {
    fullName: string;
  };
  destination?: {
    name: string;
  } | null;
}

interface RecentSalesProps {
  sales: Sale[];
}

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-foreground">
            Ventas Recientes
          </h2>
        </div>
        <Link href="/sales">
          <Button variant="ghost" size="sm">
            Ver todas
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {sales?.length > 0 ? (
          sales.map((sale) => (
            <div
              key={sale?.id}
              className="p-4 bg-muted/50 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {sale?.client?.fullName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sale?.destination?.name}
                  </p>
                </div>
                <Link href={`/sales/${sale?.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Badge variant={sale?.paymentType === 'CASH' ? 'default' : 'secondary'}>
                    {sale?.paymentType === 'CASH' ? 'Contado' : 'Crédito'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(sale?.saleDate), "d 'de' MMM, yyyy", { locale: es })}
                  </span>
                </div>
                <p className="font-bold text-green-600 dark:text-green-400">
                  ${sale?.totalPrice?.toLocaleString('es-MX')}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay ventas registradas</p>
          </div>
        )}
      </div>
    </Card>
  );
}
