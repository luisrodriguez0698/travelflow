'use client';

import { DollarSign, ShoppingCart, Users, AlertCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface MetricsCardsProps {
  metrics: {
    monthlySales: number;
    salesCount: number;
    activeClients: number;
    upcomingPaymentsCount: number;
    overduePaymentsCount: number;
  };
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Ventas del Mes',
      value: `$${metrics.monthlySales?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Número de Ventas',
      value: metrics.salesCount?.toString() ?? '0',
      icon: ShoppingCart,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Clientes Activos',
      value: metrics.activeClients?.toString() ?? '0',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Pagos Próximos (7 días)',
      value: metrics.upcomingPaymentsCount?.toString() ?? '0',
      icon: Clock,
      color: 'from-orange-500 to-yellow-500',
    },
    {
      title: 'Pagos Vencidos',
      value: metrics.overduePaymentsCount?.toString() ?? '0',
      icon: AlertCircle,
      color: 'from-red-500 to-rose-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          // 5 tarjetas en 2 columnas: la ultima ocupa la fila completa en movil
          className={index === cards.length - 1 ? 'col-span-2 lg:col-span-1' : undefined}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="h-full p-3.5 sm:p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex flex-col-reverse sm:flex-row items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 leading-tight">
                  {card.title}
                </p>
                <h3 className="text-lg sm:text-2xl font-bold text-foreground truncate">
                  {card.value}
                </h3>
              </div>
              <div
                className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md shrink-0`}
              >
                <card.icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
