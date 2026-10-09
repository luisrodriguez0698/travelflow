'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
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
import { Plane, MapPin, Bus, Plus, Search, Loader2, Pencil, Trash2, Truck, Globe, ArrowLeftRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreatorHistoryButton } from '@/components/record-history';
import { useCan } from '@/hooks/use-can';
import { RowsSkeleton } from '@/components/skeletons';

type ServiceType = 'FLIGHT' | 'TOUR' | 'TRANSFER';
type Direction = 'IDA' | 'REGRESO' | 'IDA_Y_VUELTA';

interface Service {
  id: string;
  type: ServiceType;
  name: string;
  supplierId: string | null;
  supplier: { id: string; name: string; serviceType: string } | null;
  isInternational: boolean;
  cost: number;
  notes: string | null;
  origin: string | null;
  destination: string | null;
  direction: Direction | null;
  departureTime: string | null;
  arrivalTime: string | null;
  returnDepartureTime: string | null;
  returnArrivalTime: string | null;
  airline: string | null;
  flightNumber: string | null;
  flightClass: string | null;
  returnFlightNumber: string | null;
  transportType: string | null;
}

interface Supplier { id: string; name: string; serviceType: string; }

const TYPE_CONFIG: Record<ServiceType, {
  tab: string;
  singular: string;
  icon: typeof Plane;
  color: string;
  costLabel: string;
}> = {
  FLIGHT: { tab: 'Vuelos', singular: 'Vuelo', icon: Plane, color: 'text-cyan-500', costLabel: 'Costo neto del vuelo ($)' },
  TOUR: { tab: 'Tours', singular: 'Tour', icon: MapPin, color: 'text-amber-500', costLabel: 'Costo neto por persona ($)' },
  TRANSFER: { tab: 'Transporte', singular: 'Transporte', icon: Bus, color: 'text-emerald-500', costLabel: 'Costo neto por pasajero ($)' },
};

const DIRECTION_LABELS: Record<Direction, string> = { IDA: 'Ida', REGRESO: 'Regreso', IDA_Y_VUELTA: 'Ida y Vuelta' };
const CLASS_LABELS: Record<string, string> = { ECONOMICA: 'Económica', BUSINESS: 'Business', PRIMERA: 'Primera' };

const emptyForm = {
  name: '',
  supplierId: '',
  isInternational: false,
  cost: '',
  notes: '',
  origin: '',
  destination: '',
  direction: 'IDA' as Direction,
  departureTime: '',
  arrivalTime: '',
  returnDepartureTime: '',
  returnArrivalTime: '',
  airline: '',
  flightNumber: '',
  flightClass: 'ECONOMICA',
  returnFlightNumber: '',
  transportType: '',
};
type FormState = typeof emptyForm;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function ServicesPage() {
  const can = useCan();
  const [activeType, setActiveType] = useState<ServiceType>('FLIGHT');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const config = TYPE_CONFIG[activeType];

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: activeType });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/services?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServices(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  }, [activeType, search]);

  useEffect(() => {
    const timer = setTimeout(fetchServices, 300);
    return () => clearTimeout(timer);
  }, [fetchServices]);

  useEffect(() => {
    fetch('/api/suppliers?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSuppliers(Array.isArray(data) ? data : data.data || []))
      .catch(() => setSuppliers([]));
  }, []);

  const set = (updates: Partial<FormState>) => setForm((prev) => ({ ...prev, ...updates }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      supplierId: s.supplierId || '',
      isInternational: s.isInternational,
      cost: s.cost ? String(s.cost) : '',
      notes: s.notes || '',
      origin: s.origin || '',
      destination: s.destination || '',
      direction: s.direction || 'IDA',
      departureTime: s.departureTime || '',
      arrivalTime: s.arrivalTime || '',
      returnDepartureTime: s.returnDepartureTime || '',
      returnArrivalTime: s.returnArrivalTime || '',
      airline: s.airline || '',
      flightNumber: s.flightNumber || '',
      flightClass: s.flightClass || 'ECONOMICA',
      returnFlightNumber: s.returnFlightNumber || '',
      transportType: s.transportType || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (activeType === 'TOUR' && !form.name.trim()) {
      toast.error('El nombre del tour es requerido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/services/${editing.id}` : '/api/services', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          type: activeType,
          supplierId: form.supplierId || null,
          cost: parseFloat(form.cost) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? `${config.singular} actualizado` : `${config.singular} agregado al catálogo`);
      setModalOpen(false);
      fetchServices();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/services/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Servicio eliminado');
      setDeleteTarget(null);
      fetchServices();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const tabClasses = (type: ServiceType) =>
    cn(
      'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
      activeType === type
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  const isRoundTrip = form.direction === 'IDA_Y_VUELTA';
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servicios</h1>
          <p className="text-muted-foreground">
            Vuelos, tours y transportes listos para agregar a ventas y cotizaciones
          </p>
        </div>
        {can('destinos', 'create') && (<Button data-tour="page-action" onClick={openCreate} variant="gradient">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo {config.singular}
        </Button>)}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav data-tour="page-tabs" className="flex space-x-2 overflow-x-auto">
          {(Object.keys(TYPE_CONFIG) as ServiceType[]).map((type) => {
            const TabIcon = TYPE_CONFIG[type].icon;
            return (
              <button key={type} onClick={() => setActiveType(type)} className={tabClasses(type)}>
                <TabIcon className="w-4 h-4" />
                {TYPE_CONFIG[type].tab}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-tour="page-filters"
          placeholder={`Buscar ${config.tab.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RowsSkeleton rows={3} />
        </div>
      ) : services.length === 0 ? (
        <Card className="p-10 text-center">
          <Icon className={cn('w-10 h-10 mx-auto mb-3 opacity-40', config.color)} />
          <p className="font-medium">
            {search ? 'Sin resultados' : `Aún no hay ${config.tab.toLowerCase()} en el catálogo`}
          </p>
          {!search && (
            <p className="text-sm text-muted-foreground mt-1">
              Dalos de alta una vez y selecciónalos al capturar ventas o cotizaciones.
            </p>
          )}
        </Card>
      ) : (
        <div data-tour="page-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight truncate">{s.name}</p>
                  {s.type !== 'TOUR' && (s.origin || s.destination) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {s.origin || '?'} → {s.destination || '?'}
                    </p>
                  )}
                </div>
                {s.isInternational && (
                  <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium shrink-0">
                    <Globe className="w-3 h-3" />Intl
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {s.type === 'FLIGHT' && (
                  <p>
                    {[s.flightNumber, s.flightClass && CLASS_LABELS[s.flightClass]].filter(Boolean).join(' · ')}
                  </p>
                )}
                {s.type !== 'TOUR' && s.direction && (
                  <p className="flex items-center gap-1">
                    {s.direction === 'IDA_Y_VUELTA' && <ArrowLeftRight className="w-3 h-3" />}
                    {DIRECTION_LABELS[s.direction]}
                    {s.departureTime && (
                      <span className="flex items-center gap-1 ml-1">
                        <Clock className="w-3 h-3" />
                        {s.departureTime}{s.arrivalTime && ` → ${s.arrivalTime}`}
                      </span>
                    )}
                  </p>
                )}
                {s.supplier && (
                  <p className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />{s.supplier.name}
                  </p>
                )}
                {s.notes && <p className="line-clamp-2">{s.notes}</p>}
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Costo neto{s.type === 'FLIGHT' ? '' : s.type === 'TOUR' ? ' / persona' : ' / pasajero'}
                  </p>
                  <p className="font-semibold">{formatCurrency(s.cost)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <CreatorHistoryButton entity="services" entityId={s.id} title={s.name} />
                  {can('destinos', 'edit') && (<Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>)}
                  {can('destinos', 'delete') && (<Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(s)}
                    className="text-red-500 hover:text-red-700"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: create / edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={cn('w-4 h-4', config.color)} />
              {editing ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}
            </DialogTitle>
            <DialogDescription>
              Estos datos se copiarán a la venta o cotización; ahí podrás ajustar el costo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <Label className="text-sm font-medium">Internacional</Label>
              </div>
              <Switch checked={form.isInternational} onCheckedChange={(v) => set({ isInternational: v })} />
            </div>

            <div className="space-y-1.5">
              <Label>
                {activeType === 'TOUR' ? 'Nombre del tour *' : 'Nombre'}
                {activeType !== 'TOUR' && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(opcional — se genera con la ruta)</span>
                )}
              </Label>
              <Input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={
                  activeType === 'FLIGHT' ? 'Ej: Aeroméxico CDMX → CUN'
                    : activeType === 'TOUR' ? 'Ej: Chichén Itzá, Xcaret'
                    : 'Ej: Traslado aeropuerto - hotel'
                }
              />
            </div>

            {activeType === 'FLIGHT' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Aerolínea</Label>
                  <Input value={form.airline} onChange={(e) => set({ airline: e.target.value })} placeholder="Ej: Aeroméxico" />
                </div>
                <div className="space-y-1.5">
                  <Label>Clase</Label>
                  <Select value={form.flightClass} onValueChange={(v) => set({ flightClass: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLASS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {activeType === 'TRANSFER' && (
              <div className="space-y-1.5">
                <Label>Tipo de unidad</Label>
                <Input
                  value={form.transportType}
                  onChange={(e) => set({ transportType: e.target.value })}
                  placeholder="Ej: Sprinter, Bus, Combi, Sedán"
                />
              </div>
            )}

            {activeType !== 'TOUR' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Origen</Label>
                    <Input value={form.origin} onChange={(e) => set({ origin: e.target.value })} placeholder="Ej: CDMX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Destino</Label>
                    <Input value={form.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="Ej: CUN" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Dirección</Label>
                    <Select value={form.direction} onValueChange={(v) => set({ direction: v as Direction })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeType === 'FLIGHT' && (
                    <div className="space-y-1.5">
                      <Label>No. vuelo</Label>
                      <Input value={form.flightNumber} onChange={(e) => set({ flightNumber: e.target.value })} placeholder="Ej: AM123" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hora salida</Label>
                    <Input type="time" value={form.departureTime} onChange={(e) => set({ departureTime: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hora llegada</Label>
                    <Input type="time" value={form.arrivalTime} onChange={(e) => set({ arrivalTime: e.target.value })} />
                  </div>
                </div>

                {isRoundTrip && (
                  <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Regreso
                    </p>
                    {activeType === 'FLIGHT' && (
                      <div className="space-y-1.5">
                        <Label>No. vuelo regreso</Label>
                        <Input
                          value={form.returnFlightNumber}
                          onChange={(e) => set({ returnFlightNumber: e.target.value })}
                          placeholder="Ej: AM456"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Hora salida</Label>
                        <Input type="time" value={form.returnDepartureTime} onChange={(e) => set({ returnDepartureTime: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Hora llegada</Label>
                        <Input type="time" value={form.returnArrivalTime} onChange={(e) => set({ returnArrivalTime: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label>{config.costLabel}</Label>
              <Input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => set({ cost: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Proveedor
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Select value={form.supplierId || 'none'} onValueChange={(v) => set({ supplierId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>{sup.name} ({sup.serviceType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Detalles internos: equipaje, punto de encuentro, qué incluye..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} variant="gradient">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{deleteTarget?.name}</strong> del catálogo? Las ventas y cotizaciones que ya lo
              usan conservan sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
