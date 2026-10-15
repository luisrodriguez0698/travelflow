'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import type { SpecialEventRow } from './event-types';

// Horas cada 30 min (7:00 a 23:30)
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return { value, label };
});

function slugify(v: string) {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function timeOf(d: Date) {
  const minutes = Math.round((d.getHours() * 60 + d.getMinutes()) / 30) * 30;
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

interface FormState {
  name: string;
  slug: string;
  date: Date | null;
  time: string;
  venueName: string;
  address: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
  dressCode: string;
  rsvpDeadline: Date | null;
  message: string;
  active: boolean;
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  date: null,
  time: '17:00',
  venueName: '',
  address: '',
  googleMapsUrl: '',
  appleMapsUrl: '',
  dressCode: '',
  rsvpDeadline: null,
  message: '',
  active: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: SpecialEventRow | null;
  /** "viajaentrenubes.com/" si la agencia tiene su dominio conectado. */
  domainHint: string | null;
  onSaved: (id: string) => void;
}

export function EventFormDialog({ open, onOpenChange, event, domainHint, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      const start = new Date(event.startsAt);
      setForm({
        name: event.name,
        slug: event.slug,
        date: start,
        time: timeOf(start),
        venueName: event.venueName ?? '',
        address: event.address ?? '',
        googleMapsUrl: event.googleMapsUrl ?? '',
        appleMapsUrl: event.appleMapsUrl ?? '',
        dressCode: event.dressCode ?? '',
        rsvpDeadline: event.rsvpDeadline ? new Date(event.rsvpDeadline) : null,
        message: event.message ?? '',
        active: event.status === 'ACTIVE',
      });
      setSlugTouched(true);
    } else {
      setForm(EMPTY);
      setSlugTouched(false);
    }
  }, [open, event]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) return toast.error('Escribe el nombre del evento');
    if (!form.date) return toast.error('Elige la fecha del evento');
    const [h, m] = form.time.split(':').map(Number);
    const startsAt = new Date(form.date);
    startsAt.setHours(h, m, 0, 0);
    // Fecha limite: hasta el final de ese dia
    const deadline = form.rsvpDeadline ? new Date(form.rsvpDeadline) : null;
    deadline?.setHours(23, 59, 59, 0);

    setSaving(true);
    try {
      const res = await fetch(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          startsAt: startsAt.toISOString(),
          venueName: form.venueName,
          address: form.address,
          googleMapsUrl: form.googleMapsUrl,
          appleMapsUrl: form.appleMapsUrl,
          dressCode: form.dressCode,
          rsvpDeadline: deadline?.toISOString() ?? null,
          message: form.message,
          status: form.active ? 'ACTIVE' : 'CLOSED',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error || 'No se pudo guardar el evento');
      toast.success(event ? 'Evento actualizado' : 'Evento creado');
      onOpenChange(false);
      onSaved(data.id);
    } catch {
      toast.error('No se pudo guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          <DialogDescription>Los datos que verán tus invitados en su invitación.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ev-name">Nombre del evento *</Label>
            <Input
              id="ev-name"
              value={form.name}
              placeholder="Ej: 1er Aniversario Entre Nubes"
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, ...(!slugTouched && { slug: slugify(name) }) }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ev-slug">Dirección de la invitación *</Label>
            <div className="flex items-center rounded-md border bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0 pl-3 text-sm text-muted-foreground">{domainHint ?? 'tudominio.com/'}</span>
              <input
                id="ev-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                }}
                placeholder="invitacionespecial"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
              />
            </div>
            {!domainHint && (
              <p className="text-xs text-muted-foreground">
                Se usa cuando conectas tu dominio en Configuración. Mientras, la invitación abre con el link del sistema.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
            <div className="grid gap-2">
              <Label>Fecha *</Label>
              <DatePicker value={form.date} onChange={(d) => set('date', d ?? null)} placeholder="Elige la fecha" />
            </div>
            <div className="grid gap-2">
              <Label>Hora *</Label>
              <Select value={form.time} onValueChange={(v) => set('time', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ev-venue">Lugar</Label>
              <Input id="ev-venue" value={form.venueName} onChange={(e) => set('venueName', e.target.value)} placeholder="Ej: Salón Las Nubes" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-dress">Vestimenta</Label>
              <Input id="ev-dress" value={form.dressCode} onChange={(e) => set('dressCode', e.target.value)} placeholder="Ej: Casual elegante" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ev-address">Dirección del lugar</Label>
            <Input id="ev-address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Calle, número, colonia, ciudad" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ev-gmaps">Link de Google Maps</Label>
              <Input id="ev-gmaps" value={form.googleMapsUrl} onChange={(e) => set('googleMapsUrl', e.target.value.trim())} placeholder="https://maps.app.goo.gl/…" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-amaps">Link de Mapas de Apple</Label>
              <Input id="ev-amaps" value={form.appleMapsUrl} onChange={(e) => set('appleMapsUrl', e.target.value.trim())} placeholder="https://maps.apple.com/…" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Confirmar a más tardar (opcional)</Label>
            <DatePicker value={form.rsvpDeadline} onChange={(d) => set('rsvpDeadline', d ?? null)} placeholder="Sin fecha límite" maxDate={form.date} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ev-message">Texto de la invitación (opcional)</Label>
            <Textarea
              id="ev-message"
              rows={3}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder="Un mensaje especial para tus invitados"
            />
          </div>

          {event && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Recibir confirmaciones</p>
                <p className="text-xs text-muted-foreground">Apágalo para cerrar la lista; la invitación se sigue viendo.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {event ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
