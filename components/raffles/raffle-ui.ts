// Textos compartidos de las pantallas de rifas

export const STYLE_INFO: Record<string, { label: string; hint: string }> = {
  TOMBOLA: { label: 'Tómbola', hint: 'Esferas que giran; ideal para muchos boletos' },
  SLOT: { label: 'Tragamonedas', hint: 'Rodillos con el número del boleto' },
  WHEEL: { label: 'Ruleta', hint: 'Rueda de la fortuna; mejor con pocos boletos' },
};

export const MODE_INFO: Record<string, { label: string; hint: string }> = {
  FIRST: { label: 'El primero en salir', hint: 'El 1er boleto gana el 1er premio, el 2do el 2do…' },
  NTH: { label: 'El N-ésimo en salir', hint: 'Se van descartando hasta llegar al número elegido' },
  LAST: { label: 'El último en quedar', hint: 'Se descartan uno a uno; el último que queda gana' },
};

export const STATUS_INFO: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Abierta', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  DRAWN: { label: 'Sorteada', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  CANCELLED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
};

export function modeSummary(r: { drawMode: string; drawPosition: number | null }) {
  if (r.drawMode === 'NTH') return `Gana el boleto #${r.drawPosition} en salir`;
  return MODE_INFO[r.drawMode]?.label ?? r.drawMode;
}

export const ticketLabel = (n: number) => `#${String(n).padStart(3, '0')}`;
