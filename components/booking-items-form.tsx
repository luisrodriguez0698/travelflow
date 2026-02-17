'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, X, ChevronDown, Hotel, Plane, MapPin, Trash2,
  Check, ChevronsUpDown,
} from 'lucide-react';
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
  plan?: string;
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
}

interface HotelOption {
  id: string;
  name: string;
  stars: number;
  diamonds: number;
  plan: string;
  roomType: string;
}

interface BookingItemsFormProps {
  items: BookingItemData[];
  onChange: (items: BookingItemData[]) => void;
  hotels: HotelOption[];
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

// ─── Main Component ──────────────────────────────────

export function BookingItemsForm({ items, onChange, hotels }: BookingItemsFormProps) {
  const totalCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  const addItem = (type: BookingItemData['type']) => {
    const newItem: BookingItemData = {
      type,
      cost: 0,
      sortOrder: items.length,
    };

    if (type === 'HOTEL') {
      newItem.numAdults = 2;
      newItem.numChildren = 0;
      newItem.freeChildren = 0;
      newItem.pricePerNight = 0;
      newItem.numNights = 1;
    } else if (type === 'FLIGHT') {
      newItem.direction = 'IDA';
      newItem.flightClass = 'ECONOMICA';
    } else if (type === 'TOUR') {
      newItem.numPeople = 1;
      newItem.pricePerPerson = 0;
    }

    onChange([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<BookingItemData>) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const merged = { ...item, ...updates };

      // Auto-calculate cost for HOTEL items
      if (merged.type === 'HOTEL') {
        const pn = merged.pricePerNight || 0;
        const nn = merged.numNights || 0;
        merged.cost = pn * nn;
      }

      // Auto-calculate cost for TOUR items
      if (merged.type === 'TOUR') {
        const pp = merged.pricePerPerson || 0;
        const np = merged.numPeople || 0;
        merged.cost = pp * np;
      }

      return merged;
    });
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  // Group items by type for display
  const hotelItems = items.map((item, i) => ({ item, index: i })).filter(({ item }) => item.type === 'HOTEL');
  const flightItems = items.map((item, i) => ({ item, index: i })).filter(({ item }) => item.type === 'FLIGHT');
  const tourItems = items.map((item, i) => ({ item, index: i })).filter(({ item }) => item.type === 'TOUR');
  const otherItems = items.map((item, i) => ({ item, index: i })).filter(({ item }) => item.type === 'OTHER');

  return (
    <div className="space-y-3">
      {/* Add Service Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-muted-foreground">Agregar Servicio:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => addItem('HOTEL')} className="gap-1.5">
          <Hotel className="w-3.5 h-3.5" />
          Habitación
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addItem('FLIGHT')} className="gap-1.5">
          <Plane className="w-3.5 h-3.5" />
          Vuelo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addItem('TOUR')} className="gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Tour
        </Button>
      </div>

      {/* Hotel Items */}
      {hotelItems.length > 0 && (
        <ServiceSection
          title="Hospedaje"
          icon={<Hotel className="w-4 h-4" />}
          color="blue"
          total={hotelItems.reduce((s, { item }) => s + (item.cost || 0), 0)}
        >
          {hotelItems.map(({ item, index }, i) => (
            <HotelItemForm
              key={index}
              item={item}
              index={i}
              hotels={hotels}
              onChange={(updates) => updateItem(index, updates)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ServiceSection>
      )}

      {/* Flight Items */}
      {flightItems.length > 0 && (
        <ServiceSection
          title="Vuelos"
          icon={<Plane className="w-4 h-4" />}
          color="cyan"
          total={flightItems.reduce((s, { item }) => s + (item.cost || 0), 0)}
        >
          {flightItems.map(({ item, index }, i) => (
            <FlightItemForm
              key={index}
              item={item}
              index={i}
              onChange={(updates) => updateItem(index, updates)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ServiceSection>
      )}

      {/* Tour Items */}
      {tourItems.length > 0 && (
        <ServiceSection
          title="Tours"
          icon={<MapPin className="w-4 h-4" />}
          color="amber"
          total={tourItems.reduce((s, { item }) => s + (item.cost || 0), 0)}
        >
          {tourItems.map(({ item, index }, i) => (
            <TourItemForm
              key={index}
              item={item}
              index={i}
              onChange={(updates) => updateItem(index, updates)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ServiceSection>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <span className="text-sm font-medium text-muted-foreground">Costo Neto Total (Servicios)</span>
          <span className="font-semibold text-lg">{formatCurrency(totalCost)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Service Section Wrapper ─────────────────────────

function ServiceSection({
  title,
  icon,
  color,
  total,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: 'blue' | 'cyan' | 'amber' | 'emerald';
  total: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  const colorMap = {
    blue: 'border-blue-200 dark:border-blue-800',
    cyan: 'border-cyan-200 dark:border-cyan-800',
    amber: 'border-amber-200 dark:border-amber-800',
    emerald: 'border-emerald-200 dark:border-emerald-800',
  };

  const bgMap = {
    blue: 'bg-blue-50 dark:bg-blue-950/30',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/30',
    amber: 'bg-amber-50 dark:bg-amber-950/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30',
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('rounded-lg border', colorMap[color])}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-t-lg',
              bgMap[color]
            )}
          >
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {formatCurrency(total)}
              </Badge>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3 border-t">
            <div className="pt-3 space-y-3">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Hotel Item Form ─────────────────────────────────

function HotelItemForm({
  item,
  index,
  hotels,
  onChange,
  onRemove,
}: {
  item: BookingItemData;
  index: number;
  hotels: HotelOption[];
  onChange: (updates: Partial<BookingItemData>) => void;
  onRemove: () => void;
}) {
  const [hotelOpen, setHotelOpen] = useState(false);
  const selectedHotel = hotels.find((h) => h.id === item.hotelId);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Habitación {index + 1}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Hotel selector */}
      {hotels.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Hotel</Label>
          <Popover open={hotelOpen} onOpenChange={setHotelOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm h-9">
                {selectedHotel ? selectedHotel.name : 'Seleccionar hotel'}
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
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
                      Sin hotel específico
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
        </div>
      )}

      {/* Room type + Plan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de Habitación</Label>
          <Input
            value={item.roomType || ''}
            onChange={(e) => onChange({ roomType: e.target.value })}
            placeholder="Ej: Suite, Doble"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Plan</Label>
          <Select value={item.plan || 'none'} onValueChange={(v) => onChange({ plan: v === 'none' ? undefined : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin plan</SelectItem>
              <SelectItem value="All Inclusive">All Inclusive</SelectItem>
              <SelectItem value="EP">EP (Solo hospedaje)</SelectItem>
              <SelectItem value="MAP">MAP (Media pensión)</SelectItem>
              <SelectItem value="AP">AP (Pensión completa)</SelectItem>
              <SelectItem value="BB">BB (Desayuno)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price per night + Nights */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Precio por Noche ($)</Label>
          <Input
            type="number"
            min={0}
            value={item.pricePerNight || ''}
            onChange={(e) => onChange({ pricePerNight: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Noches</Label>
          <Input
            type="number"
            min={1}
            value={item.numNights || ''}
            onChange={(e) => onChange({ numNights: Math.max(1, parseInt(e.target.value) || 1) })}
            placeholder="1"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Adults + Children */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Adultos</Label>
          <Input
            type="number"
            min={1}
            value={item.numAdults || ''}
            onChange={(e) => onChange({ numAdults: Math.max(1, parseInt(e.target.value) || 1) })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Menores</Label>
          <Input
            type="number"
            min={0}
            value={item.numChildren ?? ''}
            onChange={(e) => onChange({ numChildren: Math.max(0, parseInt(e.target.value) || 0) })}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Cost display */}
      <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">Costo habitación</span>
        <span className="text-sm font-semibold">{formatCurrency(item.cost || 0)}</span>
      </div>
    </div>
  );
}

// ─── Flight Item Form ────────────────────────────────

function FlightItemForm({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: BookingItemData;
  index: number;
  onChange: (updates: Partial<BookingItemData>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Vuelo {index + 1} — {item.direction === 'IDA' ? 'Ida' : 'Regreso'}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Direction + Class */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Dirección</Label>
          <Select value={item.direction || 'IDA'} onValueChange={(v) => onChange({ direction: v as 'IDA' | 'REGRESO' })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IDA">Ida</SelectItem>
              <SelectItem value="REGRESO">Regreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Clase</Label>
          <Select value={item.flightClass || 'ECONOMICA'} onValueChange={(v) => onChange({ flightClass: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ECONOMICA">Económica</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="PRIMERA">Primera</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Airline + Flight Number */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Aerolínea</Label>
          <Input
            value={item.airline || ''}
            onChange={(e) => onChange({ airline: e.target.value })}
            placeholder="Ej: Aeroméxico"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">No. Vuelo</Label>
          <Input
            value={item.flightNumber || ''}
            onChange={(e) => onChange({ flightNumber: e.target.value })}
            placeholder="Ej: AM123"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Origin + Destination */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Origen</Label>
          <Input
            value={item.origin || ''}
            onChange={(e) => onChange({ origin: e.target.value })}
            placeholder="Ej: CDMX"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Destino</Label>
          <Input
            value={item.flightDestination || ''}
            onChange={(e) => onChange({ flightDestination: e.target.value })}
            placeholder="Ej: CUN"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Departure + Arrival Times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Hora Salida</Label>
          <Input
            type="time"
            value={item.departureTime ? formatTime(item.departureTime) : ''}
            onChange={(e) => onChange({ departureTime: parseTimeInput(e.target.value) })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hora Llegada</Label>
          <Input
            type="time"
            value={item.arrivalTime ? formatTime(item.arrivalTime) : ''}
            onChange={(e) => onChange({ arrivalTime: parseTimeInput(e.target.value) })}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Cost */}
      <div className="space-y-1.5">
        <Label className="text-xs">Costo del Vuelo ($)</Label>
        <Input
          type="number"
          min={0}
          value={item.cost || ''}
          onChange={(e) => onChange({ cost: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}

// ─── Tour Item Form ──────────────────────────────────

function TourItemForm({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: BookingItemData;
  index: number;
  onChange: (updates: Partial<BookingItemData>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tour {index + 1}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tour Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre del Tour</Label>
        <Input
          value={item.tourName || ''}
          onChange={(e) => onChange({ tourName: e.target.value })}
          placeholder="Ej: Chichén Itzá, Xcaret"
          className="h-9 text-sm"
        />
      </div>

      {/* Date + People */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha del Tour</Label>
          <DatePicker
            value={item.tourDate || undefined}
            onChange={(date) => onChange({ tourDate: date || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Personas</Label>
          <Input
            type="number"
            min={1}
            value={item.numPeople || ''}
            onChange={(e) => onChange({ numPeople: Math.max(1, parseInt(e.target.value) || 1) })}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Price per person */}
      <div className="space-y-1.5">
        <Label className="text-xs">Precio por Persona ($)</Label>
        <Input
          type="number"
          min={0}
          value={item.pricePerPerson || ''}
          onChange={(e) => onChange({ pricePerPerson: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          className="h-9 text-sm"
        />
      </div>

      {/* Cost display */}
      <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {item.numPeople || 0} persona{(item.numPeople || 0) !== 1 ? 's' : ''} × {formatCurrency(item.pricePerPerson || 0)}
        </span>
        <span className="text-sm font-semibold">{formatCurrency(item.cost || 0)}</span>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────

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
