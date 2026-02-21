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
import { Plus, Hotel, Plane, MapPin, Trash2, Pencil, Check, ChevronsUpDown, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────

export interface BookingItemData {
  id?: string;
  type: 'HOTEL' | 'FLIGHT' | 'TOUR' | 'OTHER';
  description?: string;
  cost: number;
  sortOrder: number;
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
  direction?: 'IDA' | 'REGRESO';
  // Tour
  tourName?: string;
  tourDate?: Date | null;
  numPeople?: number;
  pricePerPerson?: number;
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

function parseTimeInput(timeStr: string): Date | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
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
      Object.assign(newItem, { direction: 'IDA', flightClass: 'ECONOMICA' });
    } else if (type === 'TOUR') {
      Object.assign(newItem, { numPeople: 1, pricePerPerson: 0 });
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
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <div className="flex justify-center gap-4 mb-2.5 text-muted-foreground/30">
            <Hotel className="w-5 h-5" />
            <Plane className="w-5 h-5" />
            <MapPin className="w-5 h-5" />
          </div>
          <p className="text-sm text-muted-foreground">Sin servicios agregados</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Usa los botones para agregar hospedaje, vuelos o tours</p>
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
    OTHER: 'border-l-gray-400',
  }[item.type];

  const iconColor = {
    HOTEL: 'text-blue-500',
    FLIGHT: 'text-cyan-500',
    TOUR: 'text-amber-500',
    OTHER: 'text-gray-500',
  }[item.type];

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border border-l-4 bg-card p-3', borderColor)}>
      {/* Icon */}
      <div className={cn('mt-0.5 shrink-0', iconColor)}>
        {item.type === 'HOTEL' && <Hotel className="w-4 h-4" />}
        {item.type === 'FLIGHT' && <Plane className="w-4 h-4" />}
        {item.type === 'TOUR' && <MapPin className="w-4 h-4" />}
      </div>

      {/* Summary */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {item.type === 'HOTEL' && (
          <>
            <p className="text-sm font-medium leading-tight truncate">
              {item.roomType || 'Habitacion'}
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
            <p className="text-sm font-medium leading-tight">
              {item.airline || 'Aerolinea'}{item.flightNumber ? ` · ${item.flightNumber}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.origin || '?'} → {item.flightDestination || '?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.direction === 'IDA' ? 'Ida' : 'Regreso'} · {item.flightClass || 'Economica'}
            </p>
          </>
        )}
        {item.type === 'TOUR' && (
          <>
            <p className="text-sm font-medium leading-tight">{item.tourName || 'Tour'}</p>
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
  return (
    <div className="space-y-4">
      {/* Direction + Class */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Direccion</Label>
          <Select value={item.direction || 'IDA'} onValueChange={(v) => onChange({ direction: v as 'IDA' | 'REGRESO' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IDA">Ida</SelectItem>
              <SelectItem value="REGRESO">Regreso</SelectItem>
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

      {/* Airline + Flight Number */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Aerolinea</Label>
          <Input
            value={item.airline || ''}
            onChange={(e) => onChange({ airline: e.target.value })}
            placeholder="Ej: Aeromexico"
          />
        </div>
        <div className="space-y-1.5">
          <Label>No. Vuelo</Label>
          <Input
            value={item.flightNumber || ''}
            onChange={(e) => onChange({ flightNumber: e.target.value })}
            placeholder="Ej: AM123"
          />
        </div>
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

      {/* Departure + Arrival times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Hora Salida</Label>
          <Input
            type="time"
            value={item.departureTime ? formatTime(item.departureTime) : ''}
            onChange={(e) => onChange({ departureTime: parseTimeInput(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hora Llegada</Label>
          <Input
            type="time"
            value={item.arrivalTime ? formatTime(item.arrivalTime) : ''}
            onChange={(e) => onChange({ arrivalTime: parseTimeInput(e.target.value) })}
          />
        </div>
      </div>

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
