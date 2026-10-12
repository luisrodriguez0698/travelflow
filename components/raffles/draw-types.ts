export interface DrawTicket {
  id: string;
  number: number;
  participantId: string;
  participantName: string;
  drawnOrder: number | null;
  prizeIndex: number | null;
}

/** Props comunes de los escenarios (tombola, tragamonedas, ruleta) */
export interface StageProps {
  /** Boletos que siguen en juego (incluye el que esta por salir) */
  pool: DrawTicket[];
  /** Boleto que debe "salir" en esta tirada; null = en reposo */
  target: DrawTicket | null;
  /** Cambia en cada tirada para reiniciar la animacion */
  spinId: number;
  durationMs: number;
  onDone: () => void;
  /** Cambia cada vez que se pide "revolver" sin sacar boleto (solo tombola) */
  stirId?: number;
}

export const ticketDigits = (pool: { number: number }[]) =>
  Math.max(3, String(pool.reduce((m, t) => Math.max(m, t.number), 0)).length);

/** Color estable por numero (esferas, segmentos) */
export function ticketHue(n: number) {
  return (n * 137.508) % 360;
}

/** Retraso CSS del foco i para que la luz "corra" por el marco (6 grupos) */
export function casinoDelay(i: number) {
  return `calc(var(--casino-speed, 1.6s) * ${(i % 6) - 6} / 6)`;
}
