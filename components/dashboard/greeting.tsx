'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarClock, PlaneTakeoff, AlertCircle, Sparkles } from 'lucide-react';
import { PlaneMascot } from '@/components/plane-mascot';

// Frases sin genero gramatical (no sabemos el genero de cada persona y
// adivinarlo por el nombre puede equivocarse). Cambian cada dia.
const PHRASES = [
  '¿Preparamos nuevas ventas hoy?',
  'Hoy es un gran día para cerrar ventas ✈️',
  'Tus clientes están por despegar. ¡Vamos!',
  'Cada gran viaje empieza con una buena cotización.',
  'Un paso más cerca de tu meta del mes.',
  'Que hoy despeguen muchas reservaciones 🛫',
];

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return { text: 'Buenos días', emoji: '☀️' };
  if (hour >= 12 && hour < 19) return { text: 'Buenas tardes', emoji: '🌤️' };
  return { text: 'Buenas noches', emoji: '🌙' };
}

export function DashboardGreeting({
  firstName,
  paymentsDueToday,
  departuresToday,
  overdueCount,
}: {
  firstName: string | null;
  paymentsDueToday: number;
  departuresToday: number;
  overdueCount: number;
}) {
  // La hora del dispositivo (no la del servidor), calculada al montar
  const [now, setNow] = useState<Date | null>(null);
  const [mood, setMood] = useState<'wave' | 'idle'>('wave');
  useEffect(() => {
    setNow(new Date());
    const t = setTimeout(() => setMood('idle'), 3500); // saluda al entrar y luego flota
    return () => clearTimeout(t);
  }, []);

  const greet = now ? greetingFor(now.getHours()) : null;
  const dayIndex = now ? Math.floor(now.getTime() / 86_400_000) : 0;
  const phrase = PHRASES[dayIndex % PHRASES.length];
  const allClear = paymentsDueToday === 0 && departuresToday === 0 && overdueCount === 0;

  const chips = [
    paymentsDueToday > 0 && {
      href: '/sales',
      icon: CalendarClock,
      label: `${paymentsDueToday} pago${paymentsDueToday !== 1 ? 's' : ''} vence${paymentsDueToday !== 1 ? 'n' : ''} hoy`,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    },
    departuresToday > 0 && {
      href: '/calendar',
      icon: PlaneTakeoff,
      label: `${departuresToday} viaje${departuresToday !== 1 ? 's' : ''} sale${departuresToday !== 1 ? 'n' : ''} hoy`,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    overdueCount > 0 && {
      href: '/sales',
      icon: AlertCircle,
      label: `${overdueCount} pago${overdueCount !== 1 ? 's' : ''} vencido${overdueCount !== 1 ? 's' : ''}`,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
  ].filter(Boolean) as { href: string; icon: typeof CalendarClock; label: string; className: string }[];

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <motion.div
        initial={{ x: -40, opacity: 0, rotate: -10 }}
        animate={{ x: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="shrink-0"
      >
        <PlaneMascot size={64} mood={mood} className="sm:w-[76px] sm:h-[55px]" />
      </motion.div>

      <div className="min-w-0">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl sm:text-3xl font-bold text-foreground leading-tight"
        >
          {greet ? (
            <>
              {greet.text}
              {firstName ? `, ${firstName}` : ''} <span aria-hidden>{greet.emoji}</span>
            </>
          ) : (
            <>¡Hola{firstName ? `, ${firstName}` : ''}!</>
          )}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground mt-0.5"
        >
          {phrase}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2 mt-2.5"
        >
          {allClear ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-1 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Todo al día por hoy
            </span>
          ) : (
            chips.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform hover:scale-[1.03] active:scale-95 ${c.className}`}
              >
                <c.icon className="w-3.5 h-3.5" /> {c.label}
              </Link>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
