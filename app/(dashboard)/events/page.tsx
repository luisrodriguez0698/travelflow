'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Copy, Edit, ExternalLink, MapPin, PartyPopper, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/empty-state';
import { RowsSkeleton } from '@/components/skeletons';
import { useCan } from '@/hooks/use-can';
import { useLiveList } from '@/hooks/use-live-list';
import { EventFormDialog } from '@/components/events/event-form-dialog';
import { eventDateLabel, type SpecialEventRow } from '@/components/events/event-types';
import { cn } from '@/lib/utils';

export default function EventsPage() {
  const can = useCan();
  const router = useRouter();
  const [events, setEvents] = useState<SpecialEventRow[]>([]);
  const [domainHint, setDomainHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SpecialEventRow | null>(null);
  const [deleting, setDeleting] = useState<SpecialEventRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data.events);
      setDomainHint(data.domainHint);
    } catch {
      toast.error('Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLiveList('special_events', load);

  const remove = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/events/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Evento eliminado');
      setDeleting(null);
      load();
    } else {
      toast.error('No se pudo eliminar el evento');
    }
  };

  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => toast.success('Link copiado'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
          <p className="text-muted-foreground">Invitaciones virtuales con confirmación y QR para la entrada</p>
        </div>
        {can('eventos', 'create') && (
          <Button
            data-tour="page-action"
            variant="gradient"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo evento
          </Button>
        )}
      </div>

      {loading ? (
        <RowsSkeleton rows={3} />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState
            icon={PartyPopper}
            title="Aún no hay eventos"
            description="Crea tu aniversario, posada o lanzamiento, agrega a tus invitados y mándales una invitación que pueden confirmar."
            action={
              can('eventos', 'create') && (
                <Button variant="gradient" onClick={() => setFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear el primero
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div data-tour="page-list" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => {
            const s = e.stats ?? { total: 0, confirmed: 0, declined: 0, pending: 0, arrived: 0 };
            const past = new Date(e.startsAt).getTime() < Date.now();
            const pct = s.total ? Math.round((s.confirmed / s.total) * 100) : 0;
            return (
              <Card key={e.id} className={cn('flex flex-col overflow-hidden', past && 'opacity-80')}>
                <Link href={`/events/${e.id}`} className="block bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold leading-tight">{e.name}</h2>
                    {past ? (
                      <Badge className="bg-white/20 text-white hover:bg-white/20">Realizado</Badge>
                    ) : e.status === 'CLOSED' ? (
                      <Badge className="bg-white/20 text-white hover:bg-white/20">Cerrado</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-white/90">
                    <CalendarDays className="h-4 w-4" />
                    {eventDateLabel(e.startsAt)}
                  </p>
                  {e.venueName && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
                      <MapPin className="h-4 w-4" />
                      {e.venueName}
                    </p>
                  )}
                </Link>

                <div className="flex-1 space-y-3 p-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: 'Invitados', value: s.total, className: '' },
                      { label: 'Confirmados', value: s.confirmed, className: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Pendientes', value: s.pending, className: 'text-amber-600 dark:text-amber-400' },
                      { label: 'Llegaron', value: s.arrived, className: 'text-sky-600 dark:text-sky-400' },
                    ].map((x) => (
                      <div key={x.label}>
                        <p className={cn('text-xl font-bold', x.className)}>{x.value}</p>
                        <p className="text-[11px] text-muted-foreground">{x.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {e.publicUrl && (
                    <div className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.publicUrl.replace(/^https?:\/\//, '')}</span>
                      <button type="button" onClick={() => copy(e.publicUrl!)} className="rounded p-1 hover:bg-background" aria-label="Copiar link">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a href={e.publicUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 hover:bg-background" aria-label="Abrir invitación">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t p-3">
                  <Button size="sm" className="flex-1" variant="gradient" onClick={() => router.push(`/events/${e.id}`)}>
                    <Users className="mr-1.5 h-4 w-4" />
                    Invitados
                  </Button>
                  {can('eventos', 'edit') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(e);
                        setFormOpen(true);
                      }}
                      aria-label="Editar evento"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {can('eventos', 'delete') && (
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeleting(e)} aria-label="Eliminar evento">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        domainHint={domainHint}
        onSaved={(id) => {
          load();
          if (!editing && id) router.push(`/events/${id}`);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el evento con toda su lista de invitados y sus confirmaciones. Los links que ya mandaste dejarán de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
