import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estado vacio amigable: icono en un circulo de color, titulo, explicacion y
 * (opcional) una accion para empezar. Reemplaza los "No se encontraron..." sueltos.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" aria-hidden />
        <div className="relative w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
