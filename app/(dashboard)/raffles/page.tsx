'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Plus, Ticket, Users, Trophy, Pencil, Trash2, Play, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { RowsSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { useCan } from '@/hooks/use-can';
import { useLiveList } from '@/hooks/use-live-list';
import { cn } from '@/lib/utils';
import { RaffleFormDialog, type RaffleFormValue } from '@/components/raffles/raffle-form-dialog';
import { STATUS_INFO, STYLE_INFO, modeSummary } from '@/components/raffles/raffle-ui';

interface RaffleRow extends RaffleFormValue {
  id: string;
  status: string;
  participantsCount: number;
  ticketsCount: number;
  drawnCount: number;
}

export default function RafflesPage() {
  const can = useCan();
  const [raffles, setRaffles] = useState<RaffleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RaffleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RaffleRow | null>(null);

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRaffles(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar las rifas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaffles();
  }, [fetchRaffles]);
  useLiveList('raffles', fetchRaffles);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/raffles/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Rifa eliminada');
      setDeleteTarget(null);
      fetchRaffles();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rifas</h1>
          <p className="text-muted-foreground">Organiza sorteos para tus clientes y seguidores, con boletos numerados</p>
        </div>
        {can('rifas', 'create') && (
          <Button
            data-tour="page-action"
            variant="gradient"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva rifa
          </Button>
        )}
      </div>

      {loading ? (
        <RowsSkeleton rows={3} />
      ) : raffles.length === 0 ? (
        <Card>
          <EmptyState
            icon={Ticket}
            title="Aún no hay rifas"
            description="Crea una rifa, agrega participantes con sus boletos y haz el sorteo en vivo con tómbola, tragamonedas o ruleta."
            action={
              can('rifas', 'create') && (
                <Button variant="gradient" onClick={() => setFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />Crear la primera
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div data-tour="page-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {raffles.map((r) => {
            const status = STATUS_INFO[r.status] ?? STATUS_INFO.OPEN;
            return (
              <Card key={r.id} className="p-4 flex flex-col gap-3 overflow-hidden relative">
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-pink-500/20 blur-xl" aria-hidden />
                <div className="flex items-start justify-between gap-2 relative">
                  <Link href={`/raffles/${r.id}`} className="min-w-0 group">
                    <p className="font-semibold leading-tight group-hover:text-primary transition-colors">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {STYLE_INFO[r.style]?.label} · {modeSummary(r)}
                    </p>
                  </Link>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.label}</span>
                </div>

                <div className="space-y-1">
                  {r.prizes.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-sm flex items-center gap-1.5 truncate">
                      <Trophy className={cn('w-3.5 h-3.5 shrink-0', i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-600')} />
                      <span className="truncate">{p}</span>
                    </p>
                  ))}
                  {r.prizes.length > 3 && <p className="text-xs text-muted-foreground">+{r.prizes.length - 3} premios más</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1"><Users className="w-3 h-3" />Personas</p>
                    <p className="text-sm font-semibold">{r.participantsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1"><Ticket className="w-3 h-3" />Boletos</p>
                    <p className="text-sm font-semibold">{r.ticketsCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sacados</p>
                    <p className="text-sm font-semibold">{r.drawnCount}</p>
                  </div>
                </div>

                {r.drawDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {new Date(r.drawDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto">
                  <Link href={`/raffles/${r.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Users className="w-3.5 h-3.5" />Participantes
                    </Button>
                  </Link>
                  <Link href={`/sorteo/${r.id}`} className="flex-1">
                    <Button size="sm" variant="gradient" className="w-full gap-1.5">
                      <Play className="w-3.5 h-3.5" />{r.status === 'DRAWN' ? 'Resultados' : 'Sorteo'}
                    </Button>
                  </Link>
                  {can('rifas', 'edit') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => {
                        setEditing(r);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {can('rifas', 'delete') && (
                    <Button variant="ghost" size="icon" title="Eliminar" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RaffleFormDialog open={formOpen} onOpenChange={setFormOpen} raffle={editing} started={!!editing?.drawnCount} onSaved={fetchRaffles} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar rifa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{deleteTarget?.name}</strong>? Se borran sus participantes, boletos y resultados. Los ingresos registrados en Bancos no se modifican.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
