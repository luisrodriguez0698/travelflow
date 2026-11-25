'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Secciones de analitica del Dashboard que cada persona puede ocultar y reordenar.
// La preferencia vive en este navegador (es una comodidad personal, no un dato del negocio).

export interface DashboardSection {
  id: string;
  label: string;
  node: ReactNode;
  /** Ocupa dos columnas en pantallas grandes */
  wide?: boolean;
  tour?: string;
}

const STORAGE_KEY = 'tf-dashboard-layout';
interface Layout {
  order: string[];
  hidden: string[];
}

function readLayout(): Layout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Layout>;
    return {
      order: Array.isArray(v.order) ? v.order.filter((x): x is string => typeof x === 'string') : [],
      hidden: Array.isArray(v.hidden) ? v.hidden.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return null;
  }
}

function saveLayout(layout: Layout | null) {
  try {
    if (layout) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sin almacenamiento: se usa el orden normal */
  }
}

export function DashboardSections({ sections }: { sections: DashboardSection[] }) {
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    setLayout(readLayout());
  }, []);

  // Orden guardado + secciones nuevas al final (y sin las que ya no existen)
  const ordered = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.id, s]));
    const saved = (layout?.order ?? []).filter((id) => byId.has(id));
    const rest = sections.map((s) => s.id).filter((id) => !saved.includes(id));
    return [...saved, ...rest].map((id) => byId.get(id)!);
  }, [sections, layout]);
  const hidden = new Set(layout?.hidden ?? []);

  const update = (next: Layout | null) => {
    setLayout(next);
    saveLayout(next);
  };
  const move = (index: number, dir: -1 | 1) => {
    const ids = ordered.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    update({ order: ids, hidden: [...hidden] });
  };
  const toggle = (id: string) => {
    const h = new Set(hidden);
    if (h.has(id)) h.delete(id);
    else h.add(id);
    update({ order: ordered.map((s) => s.id), hidden: [...h] });
  };

  const visible = ordered.filter((s) => !hidden.has(s.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Análisis del negocio</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-tour="dash-customize">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Personalizar
              {hidden.size > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">{hidden.size} oculta{hidden.size === 1 ? '' : 's'}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">Muestra, oculta y ordena las secciones. Se guarda en este navegador.</p>
            <ul className="space-y-0.5">
              {ordered.map((s, i) => {
                const isHidden = hidden.has(s.id);
                return (
                  <li key={s.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60">
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={cn('flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm', isHidden && 'text-muted-foreground line-through')}
                      aria-pressed={!isHidden}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5 shrink-0" /> : <Eye className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <span className="truncate">{s.label}</span>
                    </button>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Subir ${s.label}`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === ordered.length - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={`Bajar ${s.label}`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {layout && (
              <button type="button" onClick={() => update(null)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Restablecer
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ocultaste todas las secciones. Usa «Personalizar» para mostrarlas.</p>
      ) : (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <div key={s.id} data-tour={s.tour} className={cn('min-w-0 [&>*]:h-full', s.wide && 'md:col-span-2')}>
              {s.node}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
