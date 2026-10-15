'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  MapPin,
  MessageCircle,
  MoreVertical,
  PartyPopper,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Trash2,
  Undo2,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { PageSkeleton } from '@/components/skeletons';
import { SupplierLogo } from '@/components/supplier-logo';
import { whatsappTo } from '@/components/client-link-dialog';
import { useCan } from '@/hooks/use-can';
import { useLiveList } from '@/hooks/use-live-list';
import { EventFormDialog } from '@/components/events/event-form-dialog';
import { AddGuestsDialog, EditGuestDialog, GuestQrDialog } from '@/components/events/guest-dialogs';
import { CheckinScanner } from '@/components/events/checkin-scanner';
import {
  GUEST_STATUS_CLASS,
  GUEST_STATUS_LABEL,
  eventDateLabel,
  invitationMessage,
  type EventDetail,
  type EventGuestRow,
} from '@/components/events/event-types';
import { cn } from '@/lib/utils';

const TZ = 'America/Mexico_City';
const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ });

type StatusFilter = 'all' | 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'ARRIVED';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSupplierId, setAddSupplierId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<EventGuestRow | null>(null);
  const [qrGuest, setQrGuest] = useState<EventGuestRow | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<EventGuestRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      setEvent(await res.json());
    } catch {
      toast.error('Error al cargar el evento');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useLiveList('special_events', load);

  const guests = useMemo(() => event?.guests ?? [], [event]);
  const stats = useMemo(
    () => ({
      total: guests.length,
      confirmed: guests.filter((g) => g.status === 'CONFIRMED').length,
      pending: guests.filter((g) => g.status === 'PENDING').length,
      declined: guests.filter((g) => g.status === 'DECLINED').length,
      arrived: guests.filter((g) => g.checkedInAt).length,
    }),
    [guests]
  );

  // Filtros y agrupado por proveedor (los "sin proveedor" al final)
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = guests.filter((g) => {
      if (statusFilter === 'ARRIVED' ? !g.checkedInAt : statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && (g.supplierId ?? 'none') !== supplierFilter) return false;
      return !q || `${g.name} ${g.phone}`.toLowerCase().includes(q);
    });
    const map = new Map<string, { key: string; supplier: EventGuestRow['supplier']; guests: EventGuestRow[] }>();
    for (const g of filtered) {
      const key = g.supplier?.id ?? 'none';
      if (!map.has(key)) map.set(key, { key, supplier: g.supplier, guests: [] });
      map.get(key)!.guests.push(g);
    }
    return [...map.values()].sort((a, b) => (a.supplier ? (b.supplier ? a.supplier.name.localeCompare(b.supplier.name) : -1) : 1));
  }, [guests, search, statusFilter, supplierFilter]);

  const patchGuest = async (guest: EventGuestRow, body: object, success?: string) => {
    const res = await fetch(`/api/events/${id}/guests/${guest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error('No se pudo actualizar');
      return;
    }
    if (success) toast.success(success);
    load();
  };

  const sendWhatsApp = (guest: EventGuestRow) => {
    if (!event) return;
    window.open(whatsappTo(guest.phone, invitationMessage(event, guest)), '_blank', 'noopener,noreferrer');
    if (!guest.sentAt && can('eventos', 'edit')) patchGuest(guest, { action: 'sent' });
  };

  const copy = (text: string, label = 'Link copiado') => navigator.clipboard?.writeText(text).then(() => toast.success(label));

  const removeGuest = async () => {
    if (!deletingGuest) return;
    const res = await fetch(`/api/events/${id}/guests/${deletingGuest.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Invitado eliminado');
      setDeletingGuest(null);
      load();
    } else {
      toast.error('No se pudo eliminar');
    }
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (notFound || !event) {
    return (
      <Card>
        <EmptyState
          icon={PartyPopper}
          title="Evento no encontrado"
          description="Puede que lo hayan eliminado."
          action={
            <Button asChild variant="outline">
              <Link href="/events">Volver a eventos</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const usedSuppliers = event.suppliers.filter((s) => guests.some((g) => g.supplierId === s.id));
  const hasNoSupplier = guests.some((g) => !g.supplierId);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="space-y-4">
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Eventos
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {eventDateLabel(event.startsAt)}
              </span>
              {event.venueName && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venueName}
                </span>
              )}
              {event.status === 'CLOSED' && <Badge variant="secondary">Confirmaciones cerradas</Badge>}
            </div>
            {event.publicUrl && (
              <div className="mt-3 flex max-w-xl items-center gap-1 rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{event.publicUrl.replace(/^https?:\/\//, '')}</span>
                <button type="button" onClick={() => copy(event.publicUrl!)} className="rounded p-1 hover:bg-background" aria-label="Copiar link general">
                  <Copy className="h-4 w-4" />
                </button>
                <a href={event.publicUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 hover:bg-background" aria-label="Abrir invitación">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {can('eventos', 'edit') && (
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {can('eventos', 'edit') && (
              <Button variant="outline" onClick={() => setScanOpen(true)}>
                <ScanLine className="mr-2 h-4 w-4" />
                Escanear QR
              </Button>
            )}
            {can('eventos', 'create') && (
              <Button
                data-tour="page-action"
                variant="gradient"
                onClick={() => {
                  setAddSupplierId(null);
                  setAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar invitados
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: 'all' as const, label: 'Invitados', value: stats.total, className: '' },
          { key: 'CONFIRMED' as const, label: 'Confirmados', value: stats.confirmed, className: 'text-emerald-600 dark:text-emerald-400' },
          { key: 'PENDING' as const, label: 'Pendientes', value: stats.pending, className: 'text-amber-600 dark:text-amber-400' },
          { key: 'DECLINED' as const, label: 'No asistirán', value: stats.declined, className: 'text-slate-500' },
          { key: 'ARRIVED' as const, label: 'Llegaron', value: stats.arrived, className: 'text-sky-600 dark:text-sky-400' },
        ].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter((f) => (f === s.key ? 'all' : s.key))}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50',
              statusFilter === s.key && s.key !== 'all' && 'border-primary ring-1 ring-primary'
            )}
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.className)}>{s.value}</p>
            {s.key === 'ARRIVED' && stats.confirmed > 0 && <p className="text-[11px] text-muted-foreground">de {stats.confirmed} confirmados</p>}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <Card data-tour="page-filters" className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="CONFIRMED">Confirmados</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="DECLINED">No asistirán</SelectItem>
              <SelectItem value="ARRIVED">Ya llegaron</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {usedSuppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              {hasNoSupplier && <SelectItem value="none">Sin proveedor</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Invitados por proveedor */}
      {guests.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Aún no hay invitados"
            description="Agrega a las personas de cada proveedor con su teléfono. Después les mandas su invitación por WhatsApp."
            action={
              can('eventos', 'create') && (
                <Button variant="gradient" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar invitados
                </Button>
              )
            }
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Sin resultados" description="Ningún invitado coincide con los filtros." />
        </Card>
      ) : (
        <div data-tour="page-list" className="space-y-4">
          {groups.map((group) => {
            const confirmed = group.guests.filter((g) => g.status === 'CONFIRMED').length;
            return (
              <Card key={group.key} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {group.supplier ? (
                      <SupplierLogo name={group.supplier.name} logo={group.supplier.logo} className="h-10 w-14" />
                    ) : (
                      <span className="flex h-10 w-14 items-center justify-center rounded-lg border bg-background">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{group.supplier?.name ?? 'Sin proveedor'}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.guests.length} invitado{group.guests.length === 1 ? '' : 's'} · {confirmed} confirmado{confirmed === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  {can('eventos', 'create') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddSupplierId(group.supplier?.id ?? null);
                        setAddOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Agregar</span>
                    </Button>
                  )}
                </div>

                <div className="divide-y">
                  {group.guests.map((g) => (
                    <div
                      key={g.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{g.name}</p>
                          <Badge variant="secondary" className={GUEST_STATUS_CLASS[g.status]}>
                            {GUEST_STATUS_LABEL[g.status]}
                          </Badge>
                          {g.checkedInAt && (
                            <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                              <UserCheck className="mr-1 h-3 w-3" />
                              Llegó {shortDate(g.checkedInAt)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{g.phone}</span>
                          {g.sentAt && (
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Enviada
                            </span>
                          )}
                          {g.views > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              La abrió{g.lastViewedAt ? ` · ${shortDate(g.lastViewedAt)}` : ''}
                            </span>
                          )}
                          {g.respondedAt && g.status !== 'PENDING' && <span>Respondió {shortDate(g.respondedAt)}</span>}
                        </div>
                        {g.note && <p className="mt-1 text-xs italic text-muted-foreground">“{g.note}”</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-emerald-700 dark:text-emerald-400" onClick={() => sendWhatsApp(g)}>
                          <MessageCircle className="mr-1.5 h-4 w-4" />
                          {g.sentAt ? 'Reenviar' : 'Enviar'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setQrGuest(g)} aria-label="Ver QR">
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" aria-label="Más acciones">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => copy(g.link)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar su link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(g.link, '_blank', 'noopener,noreferrer')}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Ver su invitación
                            </DropdownMenuItem>
                            {can('eventos', 'edit') && (
                              <>
                                <DropdownMenuSeparator />
                                {g.status !== 'CONFIRMED' && (
                                  <DropdownMenuItem onClick={() => patchGuest(g, { action: 'status', status: 'CONFIRMED' }, 'Marcado como confirmado')}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Marcar confirmado
                                  </DropdownMenuItem>
                                )}
                                {g.status !== 'DECLINED' && (
                                  <DropdownMenuItem onClick={() => patchGuest(g, { action: 'status', status: 'DECLINED' }, 'Marcado como "no asistirá"')}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Marcar “no asistirá”
                                  </DropdownMenuItem>
                                )}
                                {g.status !== 'PENDING' && (
                                  <DropdownMenuItem onClick={() => patchGuest(g, { action: 'status', status: 'PENDING' }, 'Marcado como pendiente')}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Volver a pendiente
                                  </DropdownMenuItem>
                                )}
                                {g.checkedInAt ? (
                                  <DropdownMenuItem onClick={() => patchGuest(g, { action: 'undo-checkin' }, 'Llegada quitada')}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Quitar llegada
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => patchGuest(g, { action: 'checkin' }, 'Llegada registrada')}>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Registrar llegada
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setEditingGuest(g)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                              </>
                            )}
                            {can('eventos', 'delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeletingGuest(g)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={event}
        domainHint={event.publicUrl && !event.publicUrl.includes('/evento/') ? `${event.publicUrl.replace(/^https?:\/\//, '').split('/')[0]}/` : null}
        onSaved={load}
      />
      <AddGuestsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={event.id}
        suppliers={event.suppliers}
        defaultSupplierId={addSupplierId}
        onSaved={load}
      />
      <EditGuestDialog guest={editingGuest} onOpenChange={(o) => !o && setEditingGuest(null)} eventId={event.id} suppliers={event.suppliers} onSaved={load} />
      <GuestQrDialog guest={qrGuest} onOpenChange={(o) => !o && setQrGuest(null)} />
      <CheckinScanner open={scanOpen} onOpenChange={setScanOpen} eventId={event.id} guests={guests} onCheckedIn={load} />

      <AlertDialog open={!!deletingGuest} onOpenChange={(o) => !o && setDeletingGuest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deletingGuest?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Su link y su QR dejarán de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeGuest} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
