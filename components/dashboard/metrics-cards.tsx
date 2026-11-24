'use client';

import { DollarSign, ShoppingCart, Users, AlertCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/animated-number';

interface MetricsCardsProps {
  metrics: {
    monthlySales: number;
    salesCount: number;
    activeClients: number;
    upcomingPaymentsCount: number;
    overduePaymentsCount: number;
    /** Mes pasado, para la flecha de tendencia */
    prevMonthlySales?: number;
    prevSalesCount?: number;
    /** p. ej. "vs 1–24 oct" */
    prevLabel?: string;
  };
}

/** "▲ 12% vs mes pasado" (null si el mes pasado fue 0: no hay contra que comparar) */
function trendOf(current: number, prev?: number) {
  if (prev === undefined || prev <= 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return { pct, up: pct >= 0 };
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Ventas del Mes',
      value: metrics.monthlySales ?? 0,
      format: (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
      trend: trendOf(metrics.monthlySales ?? 0, metrics.prevMonthlySales),
    },
    {
      title: 'Número de Ventas',
      value: metrics.salesCount ?? 0,
      format: undefined as ((n: number) => string) | undefined,
      icon: ShoppingCart,
      color: 'from-blue-500 to-cyan-500',
      trend: trendOf(metrics.salesCount ?? 0, metrics.prevSalesCount),
    },
    {
      title: 'Clientes Activos',
      value: metrics.activeClients ?? 0,
      format: undefined as ((n: number) => string) | undefined,
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      trend: null,
    },
    {
      title: 'Pagos Próximos (7 días)',
      value: metrics.upcomingPaymentsCount ?? 0,
      format: undefined as ((n: number) => string) | undefined,
      icon: Clock,
      color: 'from-orange-500 to-yellow-500',
      trend: null,
    },
    {
      title: 'Pagos Vencidos',
      value: metrics.overduePaymentsCount ?? 0,
      format: undefined as ((n: number) => string) | undefined,
      icon: AlertCircle,
      color: 'from-red-500 to-rose-500',
      trend: null,
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
                  <AnimatedNumber value={card.value} format={card.format} />
                </h3>
                {card.trend && (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${card.trend.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {card.trend.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {card.trend.up ? '+' : ''}
                    {Math.round(card.trend.pct)}%<span className="font-normal text-muted-foreground">{metrics.prevLabel ?? 'vs mes pasado'}</span>
                  </motion.p>
                )}
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
