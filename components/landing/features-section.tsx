'use client';

import { motion } from 'framer-motion';
import {
  Users,
  ShoppingCart,
  CreditCard,
  Truck,
  Landmark,
  BarChart3,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Gestión de Clientes',
    description: 'Registra y administra toda la información de tus clientes en un solo lugar. Historial de viajes, documentos y contacto.',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: ShoppingCart,
    title: 'Ventas y Cotizaciones',
    description: 'Crea cotizaciones como borradores y conviértelas a ventas en un click. Control total de tu proceso de venta.',
    color: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: CreditCard,
    title: 'Control de Pagos',
    description: 'Planes de pago a plazos, anticipo, abonos parciales y seguimiento automático de pagos pendientes y vencidos.',
    color: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    icon: Truck,
    title: 'Gestión de Proveedores',
    description: 'Administra tus proveedores, fechas límite de pago y tipos de servicio para mantener todo bajo control.',
    color: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    icon: Landmark,
    title: 'Control Bancario',
    description: 'Múltiples cuentas bancarias, registro de ingresos, egresos y transferencias con saldo actualizado en tiempo real.',
    color: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
  },
  {
    icon: BarChart3,
    title: 'Reportes y Dashboard',
    description: 'Visualiza las métricas clave de tu agencia: ventas del mes, pagos pendientes, márgenes de ganancia y más.',
    color: 'from-rose-500 to-red-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
  },
];

export function FeaturesSection() {
  return (
    <section id="servicios" className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            Servicios
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Todo lo que necesitas en{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              un solo lugar
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Herramientas diseñadas específicamente para agencias de viaje.
            Simplifica tu operación diaria y enfócate en vender.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className={`${feature.bg} rounded-2xl p-8 border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full`}>
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
