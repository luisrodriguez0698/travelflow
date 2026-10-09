'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * "Pilo", la mascota de TravelFlow: un avioncito con la marca (azul-cyan).
 * mood: idle (flota), wave (agita el ala para saludar), happy (salta contento).
 */
export function PlaneMascot({
  size = 32,
  mood = 'idle',
  className,
}: {
  size?: number;
  mood?: 'idle' | 'wave' | 'happy';
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const still = !!reduce;

  return (
    <motion.svg
      viewBox="0 0 72 52"
      width={size}
      height={(size * 52) / 72}
      className={className}
      aria-hidden
      animate={
        still
          ? undefined
          : mood === 'happy'
            ? { y: [0, -6, 0, -3, 0], rotate: [0, -6, 0, 4, 0] }
            : { y: [0, -2.5, 0], rotate: [0, -2, 0] }
      }
      transition={{ duration: mood === 'happy' ? 0.9 : 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      {/* Estelas de viento */}
      {!still &&
        [14, 26, 36].map((y, i) => (
          <motion.line
            key={y}
            x1="2"
            x2="10"
            y1={y}
            y2={y}
            stroke="#06b6d4"
            strokeWidth="2"
            strokeLinecap="round"
            animate={{ x: [0, -4, 0], opacity: [0, 0.7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}

      {/* Cola */}
      <path d="M14 22 L9 8 Q9 6 11 6.5 L19 9 L24 21 Z" fill={`url(#${id}-wing)`} />

      {/* Ala trasera */}
      <path d="M30 27 L22 40 Q21.5 42 23.5 42 L29 42 L40 30 Z" fill="#1e40af" opacity="0.55" />

      {/* Cuerpo */}
      <ellipse cx="36" cy="25" rx="24" ry="12" fill={`url(#${id}-body)`} />
      <ellipse cx="38" cy="30" rx="17" ry="5" fill="#ffffff" opacity="0.28" />
      <ellipse cx="34" cy="18" rx="13" ry="3" fill="#ffffff" opacity="0.22" />

      {/* Ala delantera (saluda) */}
      <motion.path
        d="M32 28 L25 44 Q24.6 46 26.6 46 L32 46 L43 31 Z"
        fill={`url(#${id}-wing)`}
        style={{ originX: '40px', originY: '30px' }}
        animate={!still && mood === 'wave' ? { rotate: [0, -22, 0, -22, 0] } : { rotate: 0 }}
        transition={{ duration: 1.2, repeat: mood === 'wave' ? Infinity : 0, repeatDelay: 0.8 }}
      />

      {/* Ojos (parpadean) */}
      <motion.g
        style={{ originY: '21px' }}
        animate={still ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
      >
        <ellipse cx="46" cy="21" rx="3.4" ry="4" fill="#ffffff" />
        <ellipse cx="54" cy="21" rx="3" ry="3.6" fill="#ffffff" />
        <circle cx="47" cy="21.6" r="1.8" fill="#0f172a" />
        <circle cx="54.6" cy="21.6" r="1.6" fill="#0f172a" />
        <circle cx="47.6" cy="20.8" r="0.6" fill="#ffffff" />
        <circle cx="55.1" cy="20.8" r="0.5" fill="#ffffff" />
      </motion.g>

      {/* Mejillas y sonrisa */}
      <circle cx="43" cy="27" r="1.8" fill="#f472b6" opacity="0.55" />
      <circle cx="57" cy="26.5" r="1.5" fill="#f472b6" opacity="0.55" />
      <path
        d={mood === 'happy' ? 'M47 27 Q50.5 31.5 54 27' : 'M47.5 27.5 Q50.5 30 53.5 27.5'}
        stroke="#0f172a"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Helice que gira */}
      <rect x="59.5" y="22" width="3" height="6" rx="1.5" fill="#1e40af" />
      <motion.ellipse
        cx="63.5"
        cy="25"
        rx="1.6"
        ry="9"
        fill="#94a3b8"
        opacity="0.75"
        style={{ originY: '25px' }}
        animate={still ? undefined : { scaleY: [1, 0.15, 1] }}
        transition={{ duration: 0.18, repeat: Infinity, ease: 'linear' }}
      />
    </motion.svg>
  );
}
