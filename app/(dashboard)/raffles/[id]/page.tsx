'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { ArrowLeft, Plus, Pencil, Trash2, Play, Ticket, Users, Trophy, Search, Lock, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/user-avatar';
import { CreatorHistoryButton } from '@/components/record-history';
import { useCan } from '@/hooks/use-can';
import { useLiveList } from '@/hooks/use-live-list';
import { useRealtimeEvent } from '@/components/realtime-provider';
import { cn } from '@/lib/utils';
import { RaffleFormDialog, type RaffleFormValue } from '@/components/raffles/raffle-form-dialog';
import { ParticipantDialog, type ParticipantValue } from '@/components/raffles/participant-dialog';
import { STATUS_INFO, STYLE_INFO, modeSummary, ticketLabel } from '@/components/raffles/raffle-ui';

interface Participant {
  id: string;
  name: string;
  phone: string | null;
  clientId: string | null;
  sellerId: string | null;
  source: string;
  paidAmount: number;
  seller: { id: string; name: string | null; email: string; avatar: string | null } | null;
  tickets: { number: number; drawnOrder: number | null; prizeIndex: number | null }[];
}

interface RaffleDetail extends RaffleFormValue {
  id: string;
  status: string;
  participants: Participant[];
  ticketsCount: number;
  drawnCount: number;
  started: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RaffleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const [raffle, setRaffle] = useState<RaffleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Participant | null>(null);

  const fetchRaffle = useCallback(async () => {
    try {
      const res = await fetch(`/api/raffles/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRaffle(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar la rifa');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRaffle();
  }, [fetchRaffle]);
  useLiveList('raffles', fetchRaffle);
  useRealtimeEvent<{ raffleId: string }>('raffle-draw', (d) => d.raffleId === id && fetchRaffle());

  const filtered = useMemo(() => {
    if (!raffle) return [];
    const q = search.trim().toLowerCase();
    if (!q) return raffle.participants;
    return raffle.participants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone?.includes(q) || p.tickets.some((t) => String(t.number) === q.replace('#', ''))
    );
  }, [raffle, search]);

  const winners = useMemo(() => {
    if (!raffle) return [];
    return raffle.participants
      .flatMap((p) => p.tickets.filter((t) => t.prizeIndex !== null).map((t) => ({ ...t, name: p.name, phone: p.phone })))
      .sort((a, b) => a.prizeIndex! - b.prizeIndex!);
  }, [raffle]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/raffles/${id}/participants/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Participante eliminado');
      setDeleteTarget(null);
      fetchRaffle();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (!raffle) {
    return (
      <Card>
        <EmptyState icon={Ticket} title="Rifa no encontrada" action={<Link href="/raffles"><Button variant="outline">Volver a rifas</Button></Link>} />
      </Card>
    );
  }

  const status = STATUS_INFO[raffle.status] ?? STATUS_INFO.OPEN;
  const locked = raffle.started || raffle.status !== 'OPEN';
  const myTickets = raffle.participants.reduce((sum, p) => sum + p.tickets.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/raffles">
            <Button variant="ghost" size="icon" title="Volver"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{raffle.name}</h1>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {STYLE_INFO[raffle.style]?.label} · {modeSummary(raffle)}
            </p>
            {raffle.description && <p className="text-sm mt-1 whitespace-pre-line">{raffle.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CreatorHistoryButton entity="raffles" entityId={raffle.id} title={raffle.name} />
          {can('rifas', 'edit') && (
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>
          )}
          <Link href={`/sorteo/${raffle.id}`}>
            <Button variant="gradient"><Play className="w-4 h-4 mr-2" />{raffle.status === 'DRAWN' ? 'Ver sorteo' : 'Ir al sorteo'}</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" />Participantes</p>
          <p className="text-2xl font-bold">{raffle.participants.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="w-3.5 h-3.5" />Boletos</p>
          <p className="text-2xl font-bold">
            {myTickets}
            {myTickets !== raffle.ticketsCount && <span className="text-sm font-normal text-muted-foreground"> de {raffle.ticketsCount}</span>}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sacados</p>
          <p className="text-2xl font-bold">{raffle.drawnCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />Premios</p>
          <p className="text-2xl font-bold">{raffle.prizes.length}</p>
        </Card>
      </div>

      {/* Premios y ganadores */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />Premios</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {raffle.prizes.map((prize, i) => {
            const w = winners.find((x) => x.prizeIndex === i);
            return (
              <div key={i} className={cn('rounded-xl border p-3 flex items-center gap-3', w && 'border-amber-400/60 bg-amber-500/5')}>
                <span className="text-2xl w-8 text-center">{MEDALS[i] ?? `${i + 1}°`}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{prize}</p>
                  {w ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
                      {ticketLabel(w.number)} · {w.name}
                      {w.phone && <> · {w.phone}</>}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Por sortear</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Participantes */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Participantes</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="search" autoComplete="off" placeholder="Nombre, teléfono o #boleto" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {can('rifas', 'create') && !locked && (
              <Button
                variant="gradient"
                onClick={() => {
                  setEditingParticipant(null);
                  setParticipantOpen(true);
                }}
              >
                <Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Agregar</span>
              </Button>
            )}
          </div>
        </div>

        {locked && (
          <p className="text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5" />El sorteo ya empezó: la lista de participantes quedó cerrada.
          </p>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'Sin resultados' : 'Aún no hay participantes'}
            description={search ? undefined : 'Agrega a tus clientes o a cualquier persona; cada boleto es una oportunidad de ganar.'}
          />
        ) : (
          <div className="divide-y">
            {filtered.map((p) => {
              const won = p.tickets.some((t) => t.prizeIndex !== null);
              return (
                <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 sm:w-64 shrink-0">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0', won ? 'bg-amber-400 text-amber-950' : 'bg-primary/10 text-primary')}>
                      {won ? '🏆' : p.tickets.length}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                        {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                        {p.source === 'AUTO' && <span className="text-primary">Por venta</span>}
                        {p.paidAmount > 0 && <span className="text-emerald-600 dark:text-emerald-400">Pagó ${p.paidAmount.toLocaleString('es-MX')}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {p.tickets.slice(0, 40).map((t) => (
                      <span
                        key={t.number}
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[11px] font-mono',
                          t.prizeIndex !== null
                            ? 'bg-amber-400 text-amber-950 font-bold'
                            : t.drawnOrder !== null
                              ? 'bg-muted text-muted-foreground line-through'
                              : 'bg-primary/10 text-primary'
                        )}
                      >
                        {ticketLabel(t.number)}
                      </span>
                    ))}
                    {p.tickets.length > 40 && <span className="text-[11px] text-muted-foreground">+{p.tickets.length - 40}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.seller && (
                      <span title={`Agente: ${p.seller.name || p.seller.email}`}>
                        <UserAvatar name={p.seller.name || p.seller.email} src={p.seller.avatar} className="w-7 h-7 text-[10px]" />
                      </span>
                    )}
                    {!locked && can('rifas', 'edit') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => {
                          setEditingParticipant({ id: p.id, name: p.name, phone: p.phone, clientId: p.clientId, sellerId: p.sellerId, tickets: p.tickets.length });
                          setParticipantOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {!locked && can('rifas', 'delete') && (
                      <Button variant="ghost" size="icon" title="Eliminar" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <RaffleFormDialog open={editOpen} onOpenChange={setEditOpen} raffle={raffle} started={raffle.started} onSaved={fetchRaffle} />
      <ParticipantDialog open={participantOpen} onOpenChange={setParticipantOpen} raffle={raffle} participant={editingParticipant} onSaved={fetchRaffle} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar participante</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar a <strong>{deleteTarget?.name}</strong> y sus {deleteTarget?.tickets.length} boleto(s)? Los números quedan libres para otros participantes.
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
