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
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Número de Ventas',
      value: metrics.salesCount?.toString() ?? '0',
      icon: ShoppingCart,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Clientes Activos',
      value: metrics.activeClients?.toString() ?? '0',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Pagos Próximos (7 días)',
      value: metrics.upcomingPaymentsCount?.toString() ?? '0',
      icon: Clock,
      color: 'from-orange-500 to-yellow-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      title: 'Pagos Vencidos',
      value: metrics.overduePaymentsCount?.toString() ?? '0',
      icon: AlertCircle,
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {card.title}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {card.value}
                </h3>
              </div>
              <div
                className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center`}
              >
                <card.icon className="w-6 h-6 text-current" style={{ color: 'inherit' }} />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
