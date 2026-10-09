import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Siluetas de carga: muestran la forma del contenido mientras llega, en lugar
// de un circulo girando. Se perciben mas rapidas y evitan "saltos" al cargar.

/** Renglones de una lista o tabla. */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('w-full space-y-3 py-2 text-left', className)} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5" style={{ width: `${70 - (i % 3) * 15}%` }} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64 max-w-[60vw]" />
      </div>
      {withAction && <Skeleton className="h-10 w-32 rounded-lg shrink-0" />}
    </div>
  );
}

/** Pagina completa mientras carga, segun su tipo. */
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'detail' | 'form' }) {
  if (variant === 'form') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6">
          <div className="space-y-5">
            {[0, 1].map((card) => (
              <div key={card} className="rounded-xl border bg-card p-5 space-y-4">
                <Skeleton className="h-3 w-28" />
                {[0, 1, 2].map((f) => (
                  <div key={f} className="space-y-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-3 h-fit">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando">
        <HeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1].map((card) => (
            <div key={card} className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-36" />
              {[0, 1, 2, 3].map((r) => (
                <div key={r} className="flex justify-between gap-4">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <RowsSkeleton rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <HeaderSkeleton />
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <RowsSkeleton rows={6} />
      </div>
    </div>
  );
}
