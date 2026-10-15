import { cn } from '@/lib/utils';

/** Logo del proveedor o, si no tiene, sus iniciales. */
export function SupplierLogo({ name, logo, className }: { name: string; logo: string | null | undefined; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white text-xs font-bold text-slate-500 dark:bg-slate-100',
        className
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-full w-full object-contain p-1" loading="lazy" />
      ) : (
        initials
      )}
    </span>
  );
}
