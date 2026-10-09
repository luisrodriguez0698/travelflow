'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Numero que "cuenta" hasta su valor: al cargar sube desde 0 y, si el valor
 * cambia en vivo (otra venta), anima del valor anterior al nuevo.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString('es-MX'),
  duration = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className="tabular-nums">{format(display)}</span>;
}
