'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'María García López',
    agency: 'Viajes Paraíso',
    location: 'Guadalajara, JAL',
    text: 'TravelFlow transformó nuestra agencia. Antes llevábamos todo en Excel y se nos escapaban pagos. Ahora tenemos el control total de cada venta.',
    rating: 5,
    initials: 'MG',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Carlos Hernández',
    agency: 'Tours del Sureste',
    location: 'Tuxtla Gutiérrez, CHIS',
    text: 'Las cotizaciones son increíbles. Puedo mostrarle al cliente cómo quedaría su plan de pagos y convertirlo a venta al instante. Mis ventas subieron 40%.',
    rating: 5,
    initials: 'CH',
    color: 'from-emerald-500 to-green-500',
  },
  {
    name: 'Ana Sofía Martínez',
    agency: 'Destinos MX Travel',
    location: 'Monterrey, NL',
    text: 'El control bancario es lo mejor. Sé exactamente cuánto dinero entra, cuánto sale y el saldo real de cada cuenta. Indispensable.',
    rating: 5,
    initials: 'AM',
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Roberto Sánchez',
    agency: 'Viajes Azteca',
    location: 'CDMX',
    text: 'Llevamos 8 meses con TravelFlow y no podemos imaginar volver a como trabajábamos antes. La gestión de proveedores y fechas límite nos salva todos los días.',
    rating: 5,
    initials: 'RS',
    color: 'from-orange-500 to-amber-500',
  },
  {
    name: 'Patricia Ruiz',
    agency: 'Viajes Maravilla',
    location: 'Cancún, QR',
    text: 'Lo recomiendo a todas las agencias. El dashboard te da una vista completa de tu negocio, y los PDFs que genera son súper profesionales para los clientes.',
    rating: 5,
    initials: 'PR',
    color: 'from-rose-500 to-red-500',
  },
  {
    name: 'Fernando Torres',
    agency: 'ViajaConmigo',
    location: 'Mérida, YUC',
    text: 'Mis empleados aprendieron a usarlo en 10 minutos. La interfaz es intuitiva y el sistema de roles me permite controlar qué puede ver cada quien.',
    rating: 5,
    initials: 'FT',
    color: 'from-cyan-500 to-teal-500',
  },
];

// Duplicate for infinite scroll
const allTestimonials = [...testimonials, ...testimonials];

function TestimonialCard({ t }: { t: typeof testimonials[0] }) {
  return (
    <div className="w-[350px] flex-shrink-0 mx-3">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 h-full">
        <Quote className="w-8 h-8 text-cyan-500/30 mb-3" />
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-5">
          &ldquo;{t.text}&rdquo;
        </p>
        <div className="flex items-center gap-1 mb-4">
          {Array.from({ length: t.rating }).map((_, i) => (
            <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
            {t.initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.agency} - {t.location}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section id="testimonios" className="py-24 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            Testimonios
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Lo que dicen{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              nuestros clientes
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Agencias de viaje en todo México confían en TravelFlow.
          </p>
        </motion.div>
      </div>

      {/* Infinite scroll carousel */}
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white dark:from-gray-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white dark:from-gray-950 to-transparent z-10 pointer-events-none" />

        {/* Row 1 - scroll left */}
        <div className="flex mb-6 animate-scroll-left">
          {allTestimonials.map((t, i) => (
            <TestimonialCard key={`row1-${i}`} t={t} />
          ))}
        </div>

        {/* Row 2 - scroll right */}
        <div className="flex animate-scroll-right">
          {[...allTestimonials].reverse().map((t, i) => (
            <TestimonialCard key={`row2-${i}`} t={t} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-scroll-left {
          animation: scroll-left 40s linear infinite;
        }
        .animate-scroll-right {
          animation: scroll-right 40s linear infinite;
        }
        .animate-scroll-left:hover,
        .animate-scroll-right:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
