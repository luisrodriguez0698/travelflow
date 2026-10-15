'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { SupplierLogo } from '@/components/supplier-logo';
import { phoneError } from '@/lib/phone';
import type { EventGuestRow, SupplierOption } from './event-types';

const NO_SUPPLIER = 'none';

function SupplierSelect({ value, onChange, suppliers }: { value: string; onChange: (v: string) => void; suppliers: SupplierOption[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Elige el proveedor" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NO_SUPPLIER}>Sin proveedor</SelectItem>
        {suppliers.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <div className="flex items-center gap-2">
              <SupplierLogo name={s.name} logo={s.logo} className="h-6 w-8 rounded" />
              {s.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Agregar invitados (varios a la vez, de un mismo proveedor) ──────────────
interface Row {
  key: number;
  name: string;
  phone: string;
}

export function AddGuestsDialog({
  open,
  onOpenChange,
  eventId,
  suppliers,
  defaultSupplierId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  suppliers: SupplierOption[];
  defaultSupplierId?: string | null;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState(NO_SUPPLIER);
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: '', phone: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ?? NO_SUPPLIER);
    setRows([
      { key: 0, name: '', phone: '' },
      { key: 1, name: '', phone: '' },
    ]);
  }, [open, defaultSupplierId]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { key: Math.max(...rs.map((r) => r.key)) + 1, name: '', phone: '' }]);

  const save = async () => {
    const filled = rows.filter((r) => r.name.trim() || r.phone.replace(/\D/g, ''));
    if (!filled.length) return toast.error('Escribe al menos un invitado');
    for (const r of filled) {
      if (r.name.trim().length < 2) return toast.error('Falta el nombre de un invitado');
      if (!r.phone.replace(/\+\d+\s?/, '').replace(/\D/g, '')) return toast.error(`Falta el teléfono de ${r.name}`);
      const err = phoneError(r.phone);
      if (err) return toast.error(`${r.name}: ${err}`);
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId === NO_SUPPLIER ? null : supplierId,
          guests: filled.map((r) => ({ name: r.name.trim(), phone: r.phone })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error || 'No se pudieron agregar');
      toast.success(`${data.count} invitado${data.count === 1 ? '' : 's'} agregado${data.count === 1 ? '' : 's'}`);
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('No se pudieron agregar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Agregar invitados</DialogTitle>
          <DialogDescription>Elige el proveedor y escribe a las personas que invita.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <SupplierSelect value={supplierId} onChange={setSupplierId} suppliers={suppliers} />
          </div>

          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto] sm:border-0 sm:p-0">
                <Input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  placeholder={`Nombre del invitado ${i + 1}`}
                  className="col-span-1"
                />
                <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <PhoneInput value={r.phone} onChange={(phone) => update(r.key, { phone })} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="col-start-2 row-start-1 text-muted-foreground hover:text-red-600 sm:col-start-auto sm:row-start-auto"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                  disabled={rows.length === 1}
                  aria-label="Quitar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={rows.length >= 50}>
              <Plus className="mr-1.5 h-4 w-4" />
              Otro invitado
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Editar un invitado ──────────────────────────────────────────────────────
export function EditGuestDialog({
  guest,
  onOpenChange,
  eventId,
  suppliers,
  onSaved,
}: {
  guest: EventGuestRow | null;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  suppliers: SupplierOption[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [supplierId, setSupplierId] = useState(NO_SUPPLIER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!guest) return;
    setName(guest.name);
    setPhone(guest.phone);
    setSupplierId(guest.supplierId ?? NO_SUPPLIER);
  }, [guest]);

  const save = async () => {
    if (!guest) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, supplierId: supplierId === NO_SUPPLIER ? null : supplierId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error || 'No se pudo guardar');
      toast.success('Invitado actualizado');
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!guest} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Editar invitado</DialogTitle>
          <DialogDescription>Su link personal y su QR no cambian.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="guest-name">Nombre</Label>
            <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Teléfono</Label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div className="grid gap-2">
            <Label>Proveedor</Label>
            <SupplierSelect value={supplierId} onChange={setSupplierId} suppliers={suppliers} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── QR de un invitado (para mandarlo o imprimirlo) ──────────────────────────
export function GuestQrDialog({ guest, onOpenChange }: { guest: EventGuestRow | null; onOpenChange: (open: boolean) => void }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    setQr(null);
    if (!guest) return;
    QRCode.toDataURL(guest.link, { width: 480, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1e3a8a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [guest]);

  const download = () => {
    if (!qr || !guest) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `pase-${guest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
  };

  return (
    <Dialog open={!!guest} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{guest?.name}</DialogTitle>
          <DialogDescription>{guest?.supplier?.name ?? 'Sin proveedor'} · código de acceso</DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-60 rounded-2xl border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt={`QR de ${guest?.name}`} className="w-full" /> : <div className="aspect-square animate-pulse rounded-lg bg-muted" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={download} disabled={!qr} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Descargar QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
