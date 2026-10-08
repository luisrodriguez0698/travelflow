'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { History, Plus, Pencil, Trash2, Loader2, ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { actionTitle, fieldLabel, formatAuditValue } from '@/lib/audit-labels';

export interface AuditEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  entity: string;
  entityId: string;
  userId: string;
  userName: string;
  createdAt: string;
  changes: Record<string, any>;
  recordName?: string | null;
}

const ACTION_STYLE: Record<string, { icon: typeof Plus; dot: string }> = {
  CREATE: { icon: Plus, dot: 'bg-emerald-500 shadow-emerald-500/30' },
  UPDATE: { icon: Pencil, dot: 'bg-blue-500 shadow-blue-500/30' },
  DELETE: { icon: Trash2, dot: 'bg-red-500 shadow-red-500/30' },
};

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);

export function relativeTime(date: string | Date): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) {
    const d = Math.floor(diff / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }
  return new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fullDate = (date: string | Date) =>
  new Date(date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Registros nuevos guardan {old,new}; los antiguos solo el valor. */
function toChange(value: any): { old: unknown; new: unknown } {
  if (value && typeof value === 'object' && ('old' in value || 'new' in value)) return value;
  return { old: undefined, new: value };
}

function ChangeList({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const fields = Object.entries(entry.changes).filter(([k]) => !k.startsWith('_') && k !== 'action');
  if (fields.length === 0) return null;

  // Altas: lista de datos; ediciones: antes -> despues
  const isSnapshot = entry.action !== 'UPDATE';
  const limit = isSnapshot ? 4 : 6;
  const visible = expanded ? fields : fields.slice(0, limit);

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 divide-y divide-border/60 text-xs">
      {visible.map(([field, raw]) => {
        const c = toChange(raw);
        const value = entry.action === 'DELETE' ? c.old ?? c.new : c.new;
        return (
          <div key={field} className="px-3 py-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground shrink-0">{fieldLabel(field)}</span>
            {isSnapshot || c.old === undefined ? (
              <span className="font-medium break-words min-w-0">{formatAuditValue(field, value)}</span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="line-through text-muted-foreground/80 break-words">{formatAuditValue(field, c.old)}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="font-medium break-words">{formatAuditValue(field, c.new)}</span>
              </span>
            )}
          </div>
        );
      })}
      {fields.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-1.5 text-left text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Ver menos' : `Ver ${fields.length - limit} más`}
        </button>
      )}
    </div>
  );
}

export function AuditTimeline({ entries, showRecord = false }: { entries: AuditEntry[]; showRecord?: boolean }) {
  return (
    <ol className="relative">
      {entries.map((entry, idx) => {
        const style = ACTION_STYLE[entry.action] || ACTION_STYLE.UPDATE;
        const Icon = style.icon;
        const context = entry.changes?._context;
        const isLast = idx === entries.length - 1;
        return (
          <li key={entry.id} className="relative pl-10 pb-6">
            {!isLast && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden />}
            <span
              className={cn(
                'absolute left-0 top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md',
                style.dot
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold">{actionTitle(entry.action, entry.entity)}</p>
              {context && (
                <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 font-medium">{context}</span>
              )}
            </div>
            {showRecord && entry.recordName && (
              <p className="text-sm text-foreground/80 truncate">{entry.recordName}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-[9px] font-semibold">
                {initials(entry.userName)}
              </span>
              <span className="font-medium text-foreground/80">{entry.userName}</span>
              <span>·</span>
              <time title={fullDate(entry.createdAt)}>{relativeTime(entry.createdAt)}</time>
            </div>

            <ChangeList entry={entry} />
          </li>
        );
      })}
    </ol>
  );
}

/** Panel lateral con la linea de tiempo de un registro. */
export function RecordHistorySheet({
  entity,
  entityId,
  title,
  open,
  onOpenChange,
}: {
  entity: string;
  entityId: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetch(`/api/audit?entity=${encodeURIComponent(entity)}&entityId=${encodeURIComponent(entityId)}&limit=100`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setEntries(data.data);
      })
      .catch((err) => setError(err.message || 'Error al cargar el historial'))
      .finally(() => setLoading(false));
  }, [open, entity, entityId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            Historial
          </SheetTitle>
          <SheetDescription>{title || 'Quién creó y modificó este registro'}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin movimientos registrados</p>
            <p className="text-xs mt-1">Los cambios se registran a partir de esta versión del sistema.</p>
          </div>
        ) : (
          <AuditTimeline entries={entries} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Avatar de "Creado por" (con tooltip) que al hacer clic abre el historial.
 * Si no hay creador muestra solo el icono de historial.
 */
export function CreatorHistoryButton({
  entity,
  entityId,
  creatorName,
  title,
  size = 'md',
}: {
  entity: string;
  entityId: string;
  creatorName?: string | null;
  title?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {creatorName ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                  'relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold',
                  'ring-offset-background transition hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  dim
                )}
                aria-label={`Creado por ${creatorName}. Ver historial`}
              >
                {initials(creatorName)}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center">
                  <History className="w-2.5 h-2.5 text-blue-500" />
                </span>
              </button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(true)}
                className={dim}
                aria-label="Ver historial"
              >
                <History className="w-4 h-4" />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            {creatorName && <p className="font-medium">Creado por {creatorName}</p>}
            <p className="text-xs opacity-80">Clic para ver el historial</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <RecordHistorySheet entity={entity} entityId={entityId} title={title} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Boton "Historial" para paginas de detalle. */
export function HistoryButton({ entity, entityId, title }: { entity: string; entityId: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 px-2 gap-1.5 text-xs">
        <History className="w-3.5 h-3.5" />
        Historial
      </Button>
      <RecordHistorySheet entity={entity} entityId={entityId} title={title} open={open} onOpenChange={setOpen} />
    </>
  );
}
