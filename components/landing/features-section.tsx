'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  CreditCard,
  Landmark,
  Link2,
  ReceiptText,
  ShoppingCart,
  Ticket,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  span?: string;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Link2,
    title: 'Link para tu cliente',
    description: 'Una página con su viaje, fotos del hotel y una barra que avanza con cada abono. Se actualiza sola: adiós a reenviar PDFs.',
    color: 'from-sky-500 to-cyan-400',
    span: 'md:col-span-2',
    badge: 'Nuevo',
  },
  {
    icon: ShoppingCart,
    title: 'Ventas y cotizaciones',
    description: 'Cotiza, convierte a venta en un clic y ve tu ganancia por cada habitación, vuelo o tour.',
    color: 'from-emerald-500 to-green-400',
  },
  {
    icon: CreditCard,
    title: 'Planes de pago',
    description: 'Quincenal o mensual, con montos editables, anticipos y abonos que se reparten solos.',
    color: 'from-violet-500 to-fuchsia-400',
  },
  {
    icon: Bell,
    title: 'Avisos en tiempo real',
    description: 'Nuevas ventas, abonos y metas al instante, en la campana y en tu celular.',
    color: 'from-amber-500 to-orange-400',
  },
  {
    icon: Landmark,
    title: 'Bancos',
    description: 'Cada anticipo y abono entra a su cuenta, con pago directo al proveedor si lo necesitas.',
    color: 'from-blue-600 to-indigo-400',
  },
  {
    icon: Ticket,
    title: 'Rifas para tus seguidores',
    description: 'Tómbola, tragamonedas o ruleta con animaciones y sorteo justo y registrado.',
    color: 'from-pink-500 to-rose-400',
    span: 'md:col-span-2',
    badge: 'Divertido',
  },
  {
    icon: Truck,
    title: 'Proveedores y deudas',
    description: 'Lo que debes a cada hotel o transportista, con fechas límite y pagos registrados.',
    color: 'from-orange-500 to-amber-400',
  },
  {
    icon: ReceiptText,
    title: 'Gastos fijos',
    description: 'Luz, agua, renta… con recordatorios antes de que venzan.',
    color: 'from-teal-500 to-emerald-400',
  },
  {
    icon: Users,
    title: 'Equipo con permisos',
    description: 'Roles a la medida, “solo lo suyo” por agente y bitácora de cada cambio.',
    color: 'from-cyan-500 to-blue-400',
  },
  {
    icon: BarChart3,
    title: 'Metas y márgenes',
    description: 'Metas por agente con confeti al lograrlas y márgenes claros por venta.',
    color: 'from-lime-500 to-emerald-400',
  },
];

/** Tarjeta con brillo que sigue al mouse. */
function SpotlightCard({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = feature.icon;
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - r.left}px`);
    el.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.08 }}
      whileHover={{ y: -6 }}
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl dark:border-white/10 dark:bg-gray-900',
        feature.span
      )}
    >
      {/* Brillo que sigue al mouse */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(380px circle at var(--x) var(--y), rgba(56,189,248,0.14), transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <motion.div
            whileHover={{ rotate: -8, scale: 1.08 }}
            className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg', feature.color)}
          >
            <Icon className="h-6 w-6" />
          </motion.div>
          {feature.badge && (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              {feature.badge}
            </span>
          )}
        </div>
        <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{feature.description}</p>
      </div>
    </motion.div>
  );
}

export function FeaturesSection() {
  return (
    <section id="servicios" className="py-24 bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Todo en un lugar</span>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">
            Lo que tu agencia necesita,{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">sin hojas de cálculo</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Desde la primera cotización hasta el último abono, y hasta la rifa para tus seguidores.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <SpotlightCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
