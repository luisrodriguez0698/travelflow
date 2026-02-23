'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Plus, Hotel, Plane, MapPin, Trash2, Pencil, Check, ChevronsUpDown, Truck, Bus, Globe, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────

export interface BookingItemData {
  id?: string;
  type: 'HOTEL' | 'FLIGHT' | 'TOUR' | 'TRANSFER' | 'OTHER';
  description?: string;
  cost: number;
  sortOrder: number;
  isInternational?: boolean;
  // Hotel
  hotelId?: string;
  roomType?: string;
  numAdults?: number;
  numChildren?: number;
  freeChildren?: number;
  pricePerNight?: number;
  numNights?: number;
  priceAdult?: number;
  priceChild?: number;
  plan?: string;
  // Destination (for HOTEL)
  destinationId?: string;
  // Flight
  airline?: string;
  flightNumber?: string;
  origin?: string;
  flightDestination?: string;
  departureTime?: Date | null;
  arrivalTime?: Date | null;
  flightClass?: string;
  direction?: 'IDA' | 'REGRESO' | 'IDA_Y_VUELTA';
  // Return leg (IDA_Y_VUELTA)
  returnDepartureTime?: Date | null;
  returnArrivalTime?: Date | null;
  returnFlightNumber?: string;
  // Tour
  tourName?: string;
  tourDate?: Date | null;
  numPeople?: number;
  pricePerPerson?: number;
  // Transport (TRANSFER)
  transportType?: string;
  // Supplier (per item)
  supplierId?: string;
  supplierDeadline?: Date | null;
}

interface HotelOption {
  id: string;
  name: string;
  stars: number;
  diamonds: number;
  plan: string;
  roomType: string;
}

interface Season { id: string; name: string; color: string; }
interface Destination { id: string; name: string; description: string; season?: Season | null; }
interface Supplier { id: string; name: string; phone: string; serviceType: string; }

interface BookingItemsFormProps {
  items: BookingItemData[];
  onChange: (items: BookingItemData[]) => void;
  destinations: Destination[];
  suppliers: Supplier[];
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── TimePicker Component (custom HH:MM — no native browser picker) ──

function TimePicker({
  value,
  onChange,
}: {
  value?: Date | null;
  onChange: (date: Date | null) => void;
}) {
  const toHH = (d?: Date | null) => (d && !isNaN(d.getTime()) ? String(d.getHours()).padStart(2, '0') : '');
  const toMM = (d?: Date | null) => (d && !isNaN(d.getTime()) ? String(d.getMinutes()).padStart(2, '0') : '');

  const [hh, setHh] = useState(toHH(value));
  const [mm, setMm] = useState(toMM(value));

  useEffect(() => {
    setHh(toHH(value));
    setMm(toMM(value));
  }, [value]);

  const commit = (newHh: string, newMm: string) => {
    const h = newHh.trim();
    const m = newMm.trim();
    if (!h && !m) { onChange(null); return; }
    const hNum = Math.min(23, Math.max(0, parseInt(h) || 0));
    const mNum = Math.min(59, Math.max(0, parseInt(m) || 0));
    const d = new Date();
    d.setHours(hNum, mNum, 0, 0);
    onChange(d);
  };

  const blurHh = (raw: string) => {
    const padded = raw.trim() ? String(Math.min(23, Math.max(0, parseInt(raw) || 0))).padStart(2, '0') : '';
    setHh(padded);
    commit(padded, mm);
  };

  const blurMm = (raw: string) => {
    const padded = raw.trim() ? String(Math.min(59, Math.max(0, parseInt(raw) || 0))).padStart(2, '0') : '';
    setMm(padded);
    commit(hh, padded);
  };

  return (
    <div className="flex items-center h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <input
        type="number"
        min={0}
        max={23}
        value={hh}
        placeholder="HH"
        onChange={(e) => { setHh(e.target.value); commit(e.target.value, mm); }}
        onBlur={(e) => blurHh(e.target.value)}
        className="w-8 text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-muted-foreground/50"
      />
      <span className="text-muted-foreground select-none">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={mm}
        placeholder="MM"
        onChange={(e) => { setMm(e.target.value); commit(hh, e.target.value); }}
        onBlur={(e) => blurMm(e.target.value)}
        className="w-8 text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────

export function BookingItemsForm({ items, onChange, destinations, suppliers }: BookingItemsFormProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftItem, setDraftItem] = useState<BookingItemData | null>(null);

  const openAddModal = (type: BookingItemData['type']) => {
    const newItem: BookingItemData = { type, cost: 0, sortOrder: items.length };
    if (type === 'HOTEL') {
      Object.assign(newItem, { numAdults: 2, numChildren: 0, freeChildren: 0, pricePerNight: 0, numNights: 1, priceAdult: 0, priceChild: 0 });
    } else if (type === 'FLIGHT') {
      Object.assign(newItem, { direction: 'IDA', flightClass: 'ECONOMICA', returnDepartureTime: null, returnArrivalTime: null, returnFlightNumber: '' });
    } else if (type === 'TOUR') {
      Object.assign(newItem, { numPeople: 1, pricePerPerson: 0 });
    } else if (type === 'TRANSFER') {
      Object.assign(newItem, { direction: 'IDA', numPeople: 1, pricePerPerson: 0, transportType: '', returnDepartureTime: null, returnArrivalTime: null });
    }
    setDraftItem(newItem);
    setEditingIndex(null);
    setModalOpen(true);
  };

  const openEditModal = (index: number) => {
    setDraftItem({ ...items[index] });
    setEditingIndex(index);
    setModalOpen(true);
  };

  const updateDraft = (updates: Partial<BookingItemData>) => {
    if (!draftItem) return;
    const merged = { ...draftItem, ...updates };
    // When switching away from IDA_Y_VUELTA, clear return fields
    if (updates.direction && updates.direction !== 'IDA_Y_VUELTA') {
      merged.returnDepartureTime = null;
      merged.returnArrivalTime = null;
      merged.returnFlightNumber = '';
    }
    if (merged.type === 'HOTEL') {
      const paidChildren = Math.max(0, (merged.numChildren || 0) - (merged.freeChildren || 0));
      merged.cost =
        (merged.pricePerNight || 0) * (merged.numNights || 0) +
        (merged.priceAdult || 0) * (merged.numAdults || 0) +
        (merged.priceChild || 0) * paidChildren;
    }
    if (merged.type === 'TOUR') {
      merged.cost = (merged.pricePerPerson || 0) * (merged.numPeople || 0);
    }
    if (merged.type === 'TRANSFER') {
      merged.cost = (merged.pricePerPerson || 0) * (merged.numPeople || 0);
    }
    setDraftItem(merged);
  };

  const handleConfirm = () => {
    if (!draftItem) return;
    if (editingIndex === null) {
      onChange([...items, draftItem]);
    } else {
      onChange(items.map((item, i) => (i === editingIndex ? draftItem : item)));
    }
    setModalOpen(false);
    setDraftItem(null);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const totalCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  return (
    <div className="space-y-3">
      {/* Add Service Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agregar:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => openAddModal('HOTEL')} className="gap-1.5 h-8">
          <Hotel className="w-3.5 h-3.5" />Habitacion
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openAddModal('FLIGHT')} className="gap-1.5 h-8">
          <Plane className="w-3.5 h-3.5" />Vuelo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openAddModal('TOUR')} className="gap-1.5 h-8">
          <MapPin className="w-3.5 h-3.5" />Tour
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openAddModal('TRANSFER')} className="gap-1.5 h-8">
          <Bus className="w-3.5 h-3.5" />Transporte
        </Button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <div className="flex justify-center gap-4 mb-2.5 text-muted-foreground/30">
            <Hotel className="w-5 h-5" />
            <Plane className="w-5 h-5" />
            <MapPin className="w-5 h-5" />
            <Bus className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground">Sin servicios agregados</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Usa los botones para agregar hospedaje, vuelos, tours o transporte</p>
        </div>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <ItemCard
              key={index}
              item={item}
              destinations={destinations}
              suppliers={suppliers}
              onEdit={() => openEditModal(index)}
              onDelete={() => removeItem(index)}
            />
          ))}
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 mt-1">
          <span className="text-sm font-medium text-muted-foreground">Costo Neto Total</span>
          <span className="font-semibold text-lg">{formatCurrency(totalCost)}</span>
        </div>
      )}

      {/* ─── Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setDraftItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {draftItem?.type === 'HOTEL' && (
                <><Hotel className="w-4 h-4 text-blue-500" />{editingIndex === null ? 'Agregar Habitacion' : 'Editar Habitacion'}</>
              )}
              {draftItem?.type === 'FLIGHT' && (
                <><Plane className="w-4 h-4 text-cyan-500" />{editingIndex === null ? 'Agregar Vuelo' : 'Editar Vuelo'}</>
              )}
              {draftItem?.type === 'TOUR' && (
                <><MapPin className="w-4 h-4 text-amber-500" />{editingIndex === null ? 'Agregar Tour' : 'Editar Tour'}</>
              )}
              {draftItem?.type === 'TRANSFER' && (
                <><Bus className="w-4 h-4 text-emerald-500" />{editingIndex === null ? 'Agregar Transporte' : 'Editar Transporte'}</>
              )}
            </DialogTitle>
          </DialogHeader>

          {draftItem && (
            <div className="space-y-4 py-1">
              {draftItem.type === 'HOTEL' && (
                <HotelForm item={draftItem} destinations={destinations} suppliers={suppliers} onChange={updateDraft} />
              )}
              {draftItem.type === 'FLIGHT' && (
                <FlightForm item={draftItem} suppliers={suppliers} onChange={updateDraft} />
              )}
              {draftItem.type === 'TOUR' && (
                <TourForm item={draftItem} suppliers={suppliers} onChange={updateDraft} />
              )}
              {draftItem.type === 'TRANSFER' && (
                <TransportForm item={draftItem} suppliers={suppliers} onChange={updateDraft} />
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setModalOpen(false); setDraftItem(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              {editingIndex === null ? 'Agregar' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Internacional Toggle (shared) ───────────────────

function InternacionalToggle({
  value,
  onChange,
}: {
  value?: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-blue-500" />
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Internacional</Label>
          <p className="text-xs text-muted-foreground">Marcar si este servicio es internacional</p>
        </div>
      </div>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Supplier Section (shared by all forms) ──────────

function SupplierSection({
  item,
  suppliers,
  onChange,
}: {
  item: BookingItemData;
  suppliers: Supplier[];
  onChange: (updates: Partial<BookingItemData>) => void;
}) {
  const [supplierOpen, setSupplierOpen] = useState(false);
  const selectedSupplier = suppliers.find((s) => s.id === item.supplierId);

  return (
    <div className="space-y-3 pt-3 border-t">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" /> Proveedor
      </p>
      <div className="space-y-1.5">
        <Label>Proveedor</Label>
        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              {selectedSupplier ? `${selectedSupplier.name} (${selectedSupplier.serviceType})` : 'Sin proveedor'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar proveedor..." />
              <CommandList>
                <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={() => { onChange({ supplierId: undefined, supplierDeadline: null }); setSupplierOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', !item.supplierId ? 'opacity-100' : 'opacity-0')} />
                    Sin proveedor
                  </CommandItem>
                  {suppliers.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.serviceType}`}
                      onSelect={() => { onChange({ supplierId: s.id }); setSupplierOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', item.supplierId === s.id ? 'opacity-100' : 'opacity-0')} />
                      {s.name} ({s.serviceType})
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {item.supplierId && (
        <div className="space-y-1.5">
          <Label>Fecha Limite Proveedor</Label>
          <DatePicker
            value={item.supplierDeadline || undefined}
            onChange={(date) => onChange({ supplierDeadline: date || null })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Item Card (compact summary) ─────────────────────

function ItemCard({
  item,
  destinations,
  suppliers,
  onEdit,
  onDelete,
}: {
  item: BookingItemData;
  destinations: Destination[];
  suppliers: Supplier[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const selectedDestination = destinations.find((d) => d.id === item.destinationId);
  const selectedSupplier = suppliers.find((s) => s.id === item.supplierId);

  const borderColor = {
    HOTEL: 'border-l-blue-400',
    FLIGHT: 'border-l-cyan-400',
    TOUR: 'border-l-amber-400',
    TRANSFER: 'border-l-emerald-400',
    OTHER: 'border-l-gray-400',
  }[item.type] ?? 'border-l-gray-400';

  const iconColor = {
    HOTEL: 'text-blue-500',
    FLIGHT: 'text-cyan-500',
    TOUR: 'text-amber-500',
    TRANSFER: 'text-emerald-500',
    OTHER: 'text-gray-500',
  }[item.type] ?? 'text-gray-500';

  const directionLabel = item.direction === 'IDA' ? 'Ida' : item.direction === 'REGRESO' ? 'Regreso' : 'Ida y Vuelta';

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-l-4 bg-card p-3', borderColor)}>
      {/* Icon */}
      <div className={cn('mt-0.5 shrink-0', iconColor)}>
        {item.type === 'HOTEL' && <Hotel className="w-4 h-4" />}
        {item.type === 'FLIGHT' && <Plane className="w-4 h-4" />}
        {item.type === 'TOUR' && <MapPin className="w-4 h-4" />}
        {item.type === 'TRANSFER' && <Bus className="w-4 h-4" />}
      </div>

      {/* Summary */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {item.type === 'HOTEL' && (
          <>
            <p className="text-sm font-medium leading-tight truncate flex items-center gap-1.5">
              {item.roomType || 'Habitacion'}
              {item.isInternational && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium">
                  <Globe className="w-2.5 h-2.5" />Internacional
                </span>
              )}
            </p>
            {selectedDestination && (
              <p className="text-xs text-muted-foreground">{selectedDestination.name}</p>
            )}
            {(item.roomType || item.plan) && (
              <p className="text-xs text-muted-foreground">
                {[item.roomType, item.plan].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {item.numNights || 0} noche{(item.numNights || 0) !== 1 ? 's' : ''} · {item.numAdults || 0} adulto{(item.numAdults || 0) !== 1 ? 's' : ''}
              {(item.numChildren || 0) > 0 && ` · ${item.numChildren} menor${(item.numChildren || 0) !== 1 ? 'es' : ''}`}
            </p>
          </>
        )}
        {item.type === 'FLIGHT' && (
          <>
            <p className="text-sm font-medium leading-tight flex items-center gap-1.5">
              {item.airline || 'Aerolinea'}{item.flightNumber ? ` · ${item.flightNumber}` : ''}
              {item.isInternational && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium">
                  <Globe className="w-2.5 h-2.5" />Internacional
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.origin || '?'} → {item.flightDestination || '?'}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {item.direction === 'IDA_Y_VUELTA' && <ArrowLeftRight className="w-3 h-3" />}
              {directionLabel} · {item.flightClass || 'Economica'}
            </p>
            {item.departureTime && (
              <p className="text-xs text-muted-foreground">
                Salida: {formatTime(item.departureTime)}
                {item.arrivalTime && ` → Llegada: ${formatTime(item.arrivalTime)}`}
              </p>
            )}
            {item.direction === 'IDA_Y_VUELTA' && item.returnDepartureTime && (
              <p className="text-xs text-muted-foreground">
                Regreso: {formatTime(item.returnDepartureTime)}
                {item.returnArrivalTime && ` → ${formatTime(item.returnArrivalTime)}`}
              </p>
            )}
          </>
        )}
        {item.type === 'TOUR' && (
          <>
            <p className="text-sm font-medium leading-tight flex items-center gap-1.5">
              {item.tourName || 'Tour'}
              {item.isInternational && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium">
                  <Globe className="w-2.5 h-2.5" />Internacional
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.numPeople || 0} persona{(item.numPeople || 0) !== 1 ? 's' : ''} × {formatCurrency(item.pricePerPerson || 0)}
            </p>
            {item.tourDate && (
              <p className="text-xs text-muted-foreground">
                {new Date(item.tourDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </>
        )}
        {item.type === 'TRANSFER' && (
          <>
            <p className="text-sm font-medium leading-tight flex items-center gap-1.5">
              {item.transportType || 'Transporte'}
              {item.isInternational && (
                <span className="inline-flex items-center gap-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 font-medium">
                  <Globe className="w-2.5 h-2.5" />Internacional
                </span>
              )}
            </p>
            {(item.origin || item.flightDestination) && (
              <p className="text-xs text-muted-foreground">
                {item.origin || '?'} → {item.flightDestination || '?'}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {item.direction === 'IDA_Y_VUELTA' && <ArrowLeftRight className="w-3 h-3" />}
              {directionLabel} · {item.numPeople || 0} pasajero{(item.numPeople || 0) !== 1 ? 's' : ''}
            </p>
            {item.departureTime && (
              <p className="text-xs text-muted-foreground">
                Salida: {formatTime(item.departureTime)}
                {item.arrivalTime && ` → Llegada: ${formatTime(item.arrivalTime)}`}
              </p>
            )}
            {item.direction === 'IDA_Y_VUELTA' && item.returnDepartureTime && (
              <p className="text-xs text-muted-foreground">
                Regreso: {formatTime(item.returnDepartureTime)}
                {item.returnArrivalTime && ` → ${formatTime(item.returnArrivalTime)}`}
              </p>
            )}
          </>
        )}
        {selectedSupplier && (
          <p className="text-xs text-muted-foreground/80 flex items-center gap-1 mt-0.5">
            <Truck className="w-3 h-3" /> {selectedSupplier.name}
          </p>
        )}
      </div>

      {/* Cost + Actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-sm font-semibold">{formatCurrency(item.cost || 0)}</span>
        <div className="flex gap-0.5">
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hotel Form (inside modal) ────────────────────────

function HotelForm({
  item,
  destinations,
  suppliers,
  onChange,
}: {
  item: BookingItemData;
  destinations: Destination[];
  suppliers: Supplier[];
  onChange: (updates: Partial<BookingItemData>) => void;
}) {
  const [destOpen, setDestOpen] = useState(false);
  const [hotelOpen, setHotelOpen] = useState(false);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(false);

  const selectedDestination = destinations.find((d) => d.id === item.destinationId);
  const selectedHotel = hotels.find((h) => h.id === item.hotelId);

  // Load hotels when destination changes
  useEffect(() => {
    if (item.destinationId) {
      setLoadingHotels(true);
      fetch(`/api/hotels?destinationId=${item.destinationId}&all=true`)
        .then(r => r.ok ? r.json() : [])
        .then(setHotels)
        .catch(() => setHotels([]))
        .finally(() => setLoadingHotels(false));
    } else {
      setHotels([]);
    }
  }, [item.destinationId]);

  return (
    <div className="space-y-4">
      {/* Internacional toggle */}
      <InternacionalToggle value={item.isInternational} onChange={(v) => onChange({ isInternational: v })} />

      {/* Destination selector */}
      <div className="space-y-1.5">
        <Label>Destino *</Label>
        <Popover open={destOpen} onOpenChange={setDestOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              {selectedDestination ? (
                <span className="flex items-center gap-2">
                  {selectedDestination.name}
                  {selectedDestination.season && (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: selectedDestination.season.color }} />
                  )}
                </span>
              ) : 'Selecciona un destino'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar destino..." />
              <CommandList>
                <CommandEmpty>No se encontraron destinos.</CommandEmpty>
                <CommandGroup>
                  {destinations.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={d.name}
                      onSelect={() => {
                        onChange({ destinationId: d.id, hotelId: undefined });
                        setDestOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', item.destinationId === d.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex items-center gap-2">
                        {d.name}
                        {d.season && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.season.color }} />}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Hotel selector */}
      {item.destinationId && (
        <div className="space-y-1.5">
          <Label>Hotel (opcional)</Label>
          {loadingHotels ? (
            <p className="text-xs text-muted-foreground">Cargando hoteles...</p>
          ) : (
            <Popover open={hotelOpen} onOpenChange={setHotelOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedHotel ? selectedHotel.name : 'Sin hotel'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar hotel..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron hoteles.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__none__" onSelect={() => { onChange({ hotelId: undefined, plan: undefined }); setHotelOpen(false); }}>
                        <Check className={cn('mr-2 h-4 w-4', !item.hotelId ? 'opacity-100' : 'opacity-0')} />
                        Sin hotel especifico
                      </CommandItem>
                      {hotels.map((h) => (
                        <CommandItem
                          key={h.id}
                          value={h.name}
                          onSelect={() => {
                            onChange({ hotelId: h.id, plan: h.plan || undefined, roomType: h.roomType || undefined });
                            setHotelOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', item.hotelId === h.id ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex flex-col">
                            <span>{h.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {h.stars > 0 && `${h.stars}★`}{h.diamonds > 0 && ` ${h.diamonds}◆`}{h.plan && ` · ${h.plan}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Room type + Plan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo de Habitacion</Label>
          <Input
            value={item.roomType || ''}
            onChange={(e) => onChange({ roomType: e.target.value })}
            placeholder="Ej: Suite, Doble"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={item.plan || 'none'} onValueChange={(v) => onChange({ plan: v === 'none' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin plan</SelectItem>
              <SelectItem value="All Inclusive">All Inclusive</SelectItem>
              <SelectItem value="EP">EP (Solo hospedaje)</SelectItem>
              <SelectItem value="MAP">MAP (Media pension)</SelectItem>
              <SelectItem value="AP">AP (Pension completa)</SelectItem>
              <SelectItem value="BB">BB (Desayuno)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price per night + Nights */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Precio por Noche ($)</Label>
          <Input
            type="number" min={0}
            value={item.pricePerNight || ''}
            onChange={(e) => onChange({ pricePerNight: parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Noches</Label>
          <Input
            type="number" min={1}
            value={item.numNights || ''}
            onChange={(e) => onChange({ numNights: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
      </div>

      {/* Adults + Children */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Adultos</Label>
          <Input
            type="number" min={1}
            value={item.numAdults || ''}
            onChange={(e) => onChange({ numAdults: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Menores</Label>
          <Input
            type="number" min={0}
            value={item.numChildren ?? ''}
            onChange={(e) => onChange({ numChildren: Math.max(0, parseInt(e.target.value) || 0) })}
          />
        </div>
      </div>

      {/* Price per adult + child */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Precio por Adulto ($)</Label>
          <Input
            type="number" min={0}
            value={item.priceAdult || ''}
            onChange={(e) => onChange({ priceAdult: parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Precio por Nino ($)</Label>
          <Input
            type="number" min={0}
            value={item.priceChild || ''}
            onChange={(e) => onChange({ priceChild: parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Free children toggle */}
      {(item.numChildren || 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Ninos Gratis</Label>
            <p className="text-xs text-muted-foreground">Menores que no pagan</p>
          </div>
          <div className="flex items-center gap-3">
            {(item.freeChildren || 0) > 0 && (
              <Input
                type="number"
                min={1}
                max={item.numChildren}
                value={item.freeChildren || 1}
                onChange={(e) => {
                  const v = Math.min(item.numChildren || 1, Math.max(1, parseInt(e.target.value) || 1));
                  onChange({ freeChildren: v });
                }}
                className="w-20 h-8 text-center"
              />
            )}
            <Switch
              checked={(item.freeChildren || 0) > 0}
              onCheckedChange={(checked) => {
                onChange({ freeChildren: checked ? Math.min(1, item.numChildren || 1) : 0 });
              }}
            />
          </div>
        </div>
      )}

      {/* Cost preview */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
        {(item.pricePerNight || 0) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.numNights || 0} noche{(item.numNights || 0) !== 1 ? 's' : ''} × {formatCurrency(item.pricePerNight || 0)}</span>
            <span>{formatCurrency((item.pricePerNight || 0) * (item.numNights || 0))}</span>
          </div>
        )}
        {(item.priceAdult || 0) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.numAdults || 0} adulto{(item.numAdults || 0) !== 1 ? 's' : ''} × {formatCurrency(item.priceAdult || 0)}</span>
            <span>{formatCurrency((item.priceAdult || 0) * (item.numAdults || 0))}</span>
          </div>
        )}
        {(item.priceChild || 0) > 0 && (item.numChildren || 0) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {Math.max(0, (item.numChildren || 0) - (item.freeChildren || 0))} menor{Math.max(0, (item.numChildren || 0) - (item.freeChildren || 0)) !== 1 ? 'es' : ''} × {formatCurrency(item.priceChild || 0)}
              {(item.freeChildren || 0) > 0 && ` (${item.freeChildren} gratis)`}
            </span>
            <span>{formatCurrency((item.priceChild || 0) * Math.max(0, (item.numChildren || 0) - (item.freeChildren || 0)))}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-sm font-medium">Total habitacion</span>
          <span className="font-semibold text-lg">{formatCurrency(item.cost || 0)}</span>
        </div>
      </div>

      {/* Supplier */}
      <SupplierSection item={item} suppliers={suppliers} onChange={onChange} />
    </div>
  );
}

// ─── Flight Form (inside modal) ───────────────────────

function FlightForm({
  item,
  suppliers,
  onChange,
}: {
  item: BookingItemData;
  suppliers: Supplier[];
  onChange: (updates: Partial<BookingItemData>) => void;
}) {
  const isRoundTrip = item.direction === 'IDA_Y_VUELTA';

  return (
    <div className="space-y-4">
      {/* Internacional toggle */}
      <InternacionalToggle value={item.isInternational} onChange={(v) => onChange({ isInternational: v })} />

      {/* Direction + Class */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Direccion</Label>
          <Select value={item.direction || 'IDA'} onValueChange={(v) => onChange({ direction: v as BookingItemData['direction'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IDA">Ida</SelectItem>
              <SelectItem value="REGRESO">Regreso</SelectItem>
              <SelectItem value="IDA_Y_VUELTA">Ida y Vuelta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Clase</Label>
          <Select value={item.flightClass || 'ECONOMICA'} onValueChange={(v) => onChange({ flightClass: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ECONOMICA">Economica</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="PRIMERA">Primera</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Airline */}
      <div className="space-y-1.5">
        <Label>Aerolinea</Label>
        <Input
          value={item.airline || ''}
          onChange={(e) => onChange({ airline: e.target.value })}
          placeholder="Ej: Aeromexico"
        />
      </div>

      {/* Origin + Destination */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Origen</Label>
          <Input
            value={item.origin || ''}
            onChange={(e) => onChange({ origin: e.target.value })}
            placeholder="Ej: CDMX"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Destino</Label>
          <Input
            value={item.flightDestination || ''}
            onChange={(e) => onChange({ flightDestination: e.target.value })}
            placeholder="Ej: CUN"
          />
        </div>
      </div>

      {/* ── Vuelo de Ida ── */}
      <div className={cn('space-y-3 rounded-lg p-3', isRoundTrip ? 'border bg-muted/20' : '')}>
        {isRoundTrip && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5" /> Vuelo de Ida
          </p>
        )}

        {/* Flight Number + Departure/Arrival Times (outbound) */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>No. Vuelo</Label>
            <Input
              value={item.flightNumber || ''}
              onChange={(e) => onChange({ flightNumber: e.target.value })}
              placeholder="Ej: AM123"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hora Salida</Label>
              <TimePicker
                value={item.departureTime}
                onChange={(d) => onChange({ departureTime: d })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora Llegada</Label>
              <TimePicker
                value={item.arrivalTime}
                onChange={(d) => onChange({ arrivalTime: d })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Vuelo de Regreso (only when IDA_Y_VUELTA) ── */}
      {isRoundTrip && (
        <div className="space-y-3 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/20 p-3">
          <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Vuelo de Regreso
          </p>

          <div className="space-y-1.5">
            <Label>No. Vuelo Regreso</Label>
            <Input
              value={item.returnFlightNumber || ''}
              onChange={(e) => onChange({ returnFlightNumber: e.target.value })}
              placeholder="Ej: AM456"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hora Salida Regreso</Label>
              <TimePicker
                value={item.returnDepartureTime}
                onChange={(d) => onChange({ returnDepartureTime: d })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora Llegada Regreso</Label>
              <TimePicker
                value={item.returnArrivalTime}
                onChange={(d) => onChange({ returnArrivalTime: d })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Cost */}
      <div className="space-y-1.5">
        <Label>Costo del Vuelo ($)</Label>
        <Input
          type="number" min={0}
          value={item.cost || ''}
          onChange={(e) => onChange({ cost: parseFloat(e.target.value) || 0 })}
          placeholder="0"
        />
      </div>

      {/* Supplier */}
      <SupplierSection item={item} suppliers={suppliers} onChange={onChange} />
    </div>
  );
}

// ─── Tour Form (inside modal) ─────────────────────────

function TourForm({
  item,
  suppliers,
  onChange,
}: {
  item: BookingItemData;
  suppliers: Supplier[];
  onChange: (updates: Partial<BookingItemData>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Internacional toggle */}
      <InternacionalToggle value={item.isInternational} onChange={(v) => onChange({ isInternational: v })} />

      {/* Tour Name */}
      <div className="space-y-1.5">
        <Label>Nombre del Tour</Label>
        <Input
          value={item.tourName || ''}
          onChange={(e) => onChange({ tourName: e.target.value })}
          placeholder="Ej: Chichen Itza, Xcaret"
        />
      </div>

      {/* Date + People */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Fecha del Tour</Label>
          <DatePicker
            value={item.tourDate || undefined}
            onChange={(date) => onChange({ tourDate: date || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Personas</Label>
          <Input
            type="number" min={1}
            value={item.numPeople || ''}
            onChange={(e) => onChange({ numPeople: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
      </div>

      {/* Price per person */}
      <div className="space-y-1.5">
        <Label>Precio por Persona ($)</Label>
        <Input
          type="number" min={0}
          value={item.pricePerPerson || ''}
          onChange={(e) => onChange({ pricePerPerson: parseFloat(e.target.value) || 0 })}
          placeholder="0"
        />
      </div>

      {/* Cost preview */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {item.numPeople || 0} persona{(item.numPeople || 0) !== 1 ? 's' : ''} × {formatCurrency(item.pricePerPerson || 0)}
        </span>
        <span className="font-semibold text-lg">{formatCurrency(item.cost || 0)}</span>
      </div>

      {/* Supplier */}
      <SupplierSection item={item} suppliers={suppliers} onChange={onChange} />
    </div>
  );
}

// ─── Transport Form (inside modal) ────────────────────

function TransportForm({
  item,
  suppliers,
  onChange,
}: {
  item: BookingItemData;
  suppliers: Supplier[];
  onChange: (updates: Partial<BookingItemData>) => void;
}) {
  const isRoundTrip = item.direction === 'IDA_Y_VUELTA';

  return (
    <div className="space-y-4">
      {/* Internacional toggle */}
      <InternacionalToggle value={item.isInternational} onChange={(v) => onChange({ isInternational: v })} />

      {/* Tipo de unidad */}
      <div className="space-y-1.5">
        <Label>Tipo de Unidad</Label>
        <Input
          value={item.transportType || ''}
          onChange={(e) => onChange({ transportType: e.target.value })}
          placeholder="Ej: Sprinter, Bus, Combi, Sedan"
        />
      </div>

      {/* Direction */}
      <div className="space-y-1.5">
        <Label>Direccion</Label>
        <Select value={item.direction || 'IDA'} onValueChange={(v) => onChange({ direction: v as BookingItemData['direction'] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IDA">Ida</SelectItem>
            <SelectItem value="REGRESO">Regreso</SelectItem>
            <SelectItem value="IDA_Y_VUELTA">Ida y Vuelta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Origin + Destination */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Origen</Label>
          <Input
            value={item.origin || ''}
            onChange={(e) => onChange({ origin: e.target.value })}
            placeholder="Ej: CDMX"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Destino</Label>
          <Input
            value={item.flightDestination || ''}
            onChange={(e) => onChange({ flightDestination: e.target.value })}
            placeholder="Ej: Cancun"
          />
        </div>
      </div>

      {/* ── Transporte de Ida ── */}
      <div className={cn('space-y-3 rounded-lg p-3', isRoundTrip ? 'border bg-muted/20' : '')}>
        {isRoundTrip && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Bus className="w-3.5 h-3.5" /> Transporte de Ida
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Hora Salida</Label>
            <TimePicker
              value={item.departureTime}
              onChange={(d) => onChange({ departureTime: d })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hora Llegada</Label>
            <TimePicker
              value={item.arrivalTime}
              onChange={(d) => onChange({ arrivalTime: d })}
            />
          </div>
        </div>
      </div>

      {/* ── Transporte de Regreso (only when IDA_Y_VUELTA) ── */}
      {isRoundTrip && (
        <div className="space-y-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-3">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transporte de Regreso
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hora Salida Regreso</Label>
              <TimePicker
                value={item.returnDepartureTime}
                onChange={(d) => onChange({ returnDepartureTime: d })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora Llegada Regreso</Label>
              <TimePicker
                value={item.returnArrivalTime}
                onChange={(d) => onChange({ returnArrivalTime: d })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Passengers + Price per person */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pasajeros</Label>
          <Input
            type="number" min={1}
            value={item.numPeople || ''}
            onChange={(e) => onChange({ numPeople: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Precio por Pasajero ($)</Label>
          <Input
            type="number" min={0}
            value={item.pricePerPerson || ''}
            onChange={(e) => onChange({ pricePerPerson: parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Cost preview */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {item.numPeople || 0} pasajero{(item.numPeople || 0) !== 1 ? 's' : ''} × {formatCurrency(item.pricePerPerson || 0)}
        </span>
        <span className="font-semibold text-lg">{formatCurrency(item.cost || 0)}</span>
      </div>

      {/* Supplier */}
      <SupplierSection item={item} suppliers={suppliers} onChange={onChange} />
    </div>
  );
}
