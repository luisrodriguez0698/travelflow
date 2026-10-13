'use client';

import { useMemo, useState } from 'react';
import { endOfMonth, isSameDay, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Periodo (en lugar de varios botones) ─────────────────────────────────────

type Range = { from?: Date; to?: Date };

const PERIODS: { key: string; label: string; range: () => { from: Date; to: Date } }[] = [
  { key: 'this-month', label: 'Este mes', range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { key: 'last-month', label: 'Mes pasado', range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { key: 'last-3', label: 'Últimos 3 meses', range: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { key: 'this-year', label: 'Este año', range: () => ({ from: startOfYear(new Date()), to: endOfMonth(new Date()) }) },
];

/** Selector de periodo rapido; si el rango no coincide con ninguno, muestra "Personalizado". */
export function PeriodSelect({ value, onChange, className }: { value: Range; onChange: (range: { from: Date; to: Date }) => void; className?: string }) {
  const current =
    PERIODS.find((p) => {
      const r = p.range();
      return value.from && value.to && isSameDay(value.from, r.from) && isSameDay(value.to, r.to);
    })?.key ?? 'custom';
  return (
    <Select value={current} onValueChange={(k) => k !== 'custom' && onChange(PERIODS.find((p) => p.key === k)!.range())}>
      <SelectTrigger className={cn('w-full sm:w-44', className)}>
        <span className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.key} value={p.key}>
            {p.label}
          </SelectItem>
        ))}
        <SelectItem value="custom" disabled>
          Personalizado
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// ── Ordenamiento de listas ───────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  field: K;
  dir: SortDir;
}

type Accessor<T> = (item: T) => string | number | Date | null | undefined;

/**
 * Ordena en el navegador (las listas de ventas/cotizaciones ya vienen completas).
 * Los vacios quedan siempre al final.
 */
export function useListSort<T, K extends string>(items: T[], accessors: Record<K, Accessor<T>>, initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    const get = accessors[sort.field];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const ea = va === null || va === undefined || va === '';
      const eb = vb === null || vb === undefined || vb === '';
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
      const na = va instanceof Date ? va.getTime() : va;
      const nb = vb instanceof Date ? vb.getTime() : vb;
      if (typeof na === 'number' && typeof nb === 'number') return (na - nb) * factor;
      return String(na).localeCompare(String(nb), 'es', { sensitivity: 'base', numeric: true }) * factor;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort]);
  const toggle = (field: K) => setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }));
  return { sorted, sort, setSort, toggle };
}

/** Encabezado que ordena al dar clic (otro clic invierte). */
export function SortableHead<K extends string>({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: K;
  sort: SortState<K>;
  onSort: (field: K) => void;
  className?: string;
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground font-semibold')}
      >
        {label}
        <Icon className={cn('w-3.5 h-3.5', active ? 'text-primary' : 'opacity-40')} />
      </button>
    </TableHead>
  );
}

/** Selector de orden (util en celular, donde no hay encabezados de tabla). */
export function SortSelect<K extends string>({
  options,
  sort,
  onChange,
  className,
}: {
  options: { field: K; label: string; ascLabel?: string; descLabel?: string }[];
  sort: SortState<K>;
  onChange: (sort: SortState<K>) => void;
  className?: string;
}) {
  return (
    <Select
      value={`${sort.field}:${sort.dir}`}
      onValueChange={(v) => {
        const [field, dir] = v.split(':') as [K, SortDir];
        onChange({ field, dir });
      }}
    >
      <SelectTrigger className={cn('w-full sm:w-56', className)}>
        <span className="flex items-center gap-2 min-w-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.flatMap((o) => [
          <SelectItem key={`${o.field}:asc`} value={`${o.field}:asc`}>
            {o.label} {o.ascLabel ?? '(A → Z)'}
          </SelectItem>,
          <SelectItem key={`${o.field}:desc`} value={`${o.field}:desc`}>
            {o.label} {o.descLabel ?? '(Z → A)'}
          </SelectItem>,
        ])}
      </SelectContent>
    </Select>
  );
}
