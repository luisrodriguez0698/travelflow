'use client';

import { motion, useReducedMotion } from 'framer-motion';

const ROW_A = [
  '🔗 Link para tus clientes',
  '💳 Planes de pago editables',
  '🏦 Bancos y anticipos',
  '🔔 Avisos en tiempo real',
  '🎟️ Rifas con tómbola',
  '🧾 Gastos fijos con recordatorio',
  '🎯 Metas de venta',
  '📄 PDF de estado de cuenta',
];
const ROW_B = [
  '🏨 Catálogo de hoteles con fotos',
  '✈️ Vuelos, tours y traslados',
  '🤝 Proveedores y deudas',
  '👥 Roles y permisos',
  '🕓 Bitácora de cambios',
  '🌐 Tu propio dominio',
  '📱 App instalable',
  '📊 Márgenes por servicio',
];

function Row({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-3 pr-3"
        animate={reduce ? undefined : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((label, i) => (
          <span
            key={i}
            className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
          >
            {label}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/** Franja infinita con todo lo que incluye el sistema. */
export function MarqueeStrip() {
  return (
    <section aria-label="Lo que incluye TravelFlow" className="py-10 bg-gray-50 dark:bg-gray-900 space-y-3">
      <Row items={ROW_A} />
      <Row items={ROW_B} reverse />
    </section>
  );
}
