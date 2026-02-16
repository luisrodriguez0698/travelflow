'use client';

import { motion } from 'framer-motion';
import { UserPlus, MapPin, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Registra tu Agencia',
    description: 'Crea tu cuenta en menos de 2 minutos. Sin tarjeta de crédito, sin compromisos. Configura el nombre, logo y datos de tu agencia.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Configura Destinos',
    description: 'Agrega tus destinos, temporadas y precios. Organiza todo por temporadas como Semana Santa, Verano o Día de las Madres.',
    color: 'from-emerald-500 to-green-500',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Empieza a Vender',
    description: 'Crea cotizaciones, conviértelas a ventas, gestiona pagos y genera recibos PDF profesionales para tus clientes.',
    color: 'from-purple-500 to-pink-500',
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            Cómo Funciona
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Empieza en{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              3 simples pasos
            </span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-[80%] border-t-2 border-dashed border-gray-300 dark:border-gray-700" />
              )}

              <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-gray-700 text-center hover:shadow-xl transition-shadow duration-300">
                {/* Number badge */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br ${step.color} text-white font-bold text-lg mb-6 shadow-lg`}>
                  {step.number}
                </div>

                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.color} bg-opacity-10 flex items-center justify-center mb-5`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
