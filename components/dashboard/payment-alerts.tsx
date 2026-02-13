'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Payment {
  id: string;
  dueDate: Date;
  amount: number;
  booking: {
    id: string;
    client: {
      fullName: string;
    };
  };
}

interface PaymentAlertsProps {
  upcomingPayments: Payment[];
  overduePayments: Payment[];
}

export function PaymentAlerts({
  upcomingPayments,
  overduePayments,
}: PaymentAlertsProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-6">
        <AlertCircle className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Alertas de Cobranza
        </h2>
      </div>

      <div className="space-y-6">
        {/* Overdue Payments */}
        {overduePayments?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
              Pagos Vencidos ({overduePayments.length})
            </h3>
            <div className="space-y-2">
              {overduePayments.slice(0, 5).map((payment) => (
                <Link
                  key={payment?.id}
                  href={`/sales/${payment?.booking?.id}`}
                  className="block p-3 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {payment?.booking?.client?.fullName}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Venció: {format(new Date(payment?.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400 text-sm">
                        ${payment?.amount?.toLocaleString('es-MX')}
                      </p>
                      <Badge variant="destructive" className="text-xs mt-1">
                        Vencido
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Payments */}
        {upcomingPayments?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-3">
              Próximos 7 Días ({upcomingPayments.length})
            </h3>
            <div className="space-y-2">
              {upcomingPayments.slice(0, 5).map((payment) => (
                <Link
                  key={payment?.id}
                  href={`/sales/${payment?.booking?.id}`}
                  className="block p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {payment?.booking?.client?.fullName}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Vence: {format(new Date(payment?.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600 dark:text-orange-400 text-sm">
                        ${payment?.amount?.toLocaleString('es-MX')}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1 border-orange-300 text-orange-600">
                        <Clock className="w-3 h-3 mr-1" />
                        Pendiente
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {upcomingPayments?.length === 0 && overduePayments?.length === 0 && (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No hay pagos pendientes próximos
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
