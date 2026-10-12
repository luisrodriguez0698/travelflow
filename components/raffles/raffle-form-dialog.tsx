'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Trophy, Dices, CircleDot, Disc3, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { DEFAULT_TERMS } from '@/lib/raffle-rules';
import { STYLE_INFO, MODE_INFO } from './raffle-ui';

export interface RaffleFormValue {
  id?: string;
  name: string;
  description: string | null;
  prizes: string[];
  drawDate: string | null;
  drawMode: string;
  drawPosition: number | null;
  style: string;
  sellTickets: boolean;
  ticketPrice: number | null;
  bankAccountId: string | null;
  autoTickets: boolean;
  autoMinAmount: number | null;
  autoTicketsPerSale: number;
  terms: string | null;
}

const EMPTY: RaffleFormValue = {
  name: '',
  description: '',
  prizes: [''],
  drawDate: null,
  drawMode: 'FIRST',
  drawPosition: 5,
  style: 'TOMBOLA',
  sellTickets: false,
  ticketPrice: null,
  bankAccountId: null,
  autoTickets: false,
  autoMinAmount: null,
  autoTicketsPerSale: 1,
  terms: DEFAULT_TERMS,
};

/** "2026-10-12..." -> fecha local (sin corrimiento por zona horaria) */
function parseDay(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

const STYLE_ICONS = { TOMBOLA: CircleDot, SLOT: Dices, WHEEL: Disc3 } as const;

export function RaffleFormDialog({
  open,
  onOpenChange,
  raffle,
  started = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffle?: RaffleFormValue | null;
  /** Con el sorteo iniciado no se cambia el modo ni la cantidad de premios */
  started?: boolean;
  onSaved: (raffle: { id: string }) => void;
}) {
  const [form, setForm] = useState<RaffleFormValue>(EMPTY);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<{ id: string; referenceName: string; bankName: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(raffle ? { ...EMPTY, ...raffle, prizes: raffle.prizes.length ? raffle.prizes : [''] } : EMPTY);
    setAccepted(false);
    fetch('/api/raffles/options')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBanks(d.banks))
      .catch(() => {});
  }, [open, raffle]);

  const set = <K extends keyof RaffleFormValue>(key: K, value: RaffleFormValue[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setPrize = (i: number, value: string) =>
    setForm((f) => ({ ...f, prizes: f.prizes.map((p, idx) => (idx === i ? value : p)) }));

  const save = async () => {
    const prizes = form.prizes.map((p) => p.trim()).filter(Boolean);
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    if (!prizes.length) return toast.error('Agrega al menos un premio');
    if (!accepted) return toast.error('Acepta los términos para continuar');
    setSaving(true);
    try {
      const res = await fetch(raffle?.id ? `/api/raffles/${raffle.id}` : '/api/raffles', {
        method: raffle?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prizes, drawDate: form.drawDate || null, acceptTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(raffle?.id ? 'Rifa actualizada' : 'Rifa creada');
      onOpenChange(false);
      onSaved(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la rifa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{raffle?.id ? 'Editar rifa' : 'Nueva rifa'}</DialogTitle>
          <DialogDescription>Configura los premios, cómo se elige al ganador y el estilo del sorteo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Datos generales */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="raffle-name">Nombre *</Label>
              <Input id="raffle-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Gran rifa de verano" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="raffle-desc">Descripción</Label>
              <Textarea id="raffle-desc" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Cómo participar, redes sociales, etc." />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <Label>Fecha del sorteo</Label>
              <DatePicker
                value={parseDay(form.drawDate)}
                onChange={(d) => set('drawDate', d ? format(d, 'yyyy-MM-dd') : null)}
                placeholder="Sin fecha definida"
              />
            </div>
          </section>

          {/* Premios */}
          <section className="space-y-2">
            <Label className="flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" />Premios (en orden: 1er lugar primero)</Label>
            {form.prizes.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 text-center text-sm font-semibold text-muted-foreground">{i + 1}°</span>
                <Input value={p} onChange={(e) => setPrize(i, e.target.value)} placeholder={i === 0 ? 'Ej. Viaje a Cancún para 2' : 'Premio'} maxLength={160} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={form.prizes.length === 1 || started}
                  onClick={() => setForm((f) => ({ ...f, prizes: f.prizes.filter((_, idx) => idx !== i) }))}
                  title="Quitar premio"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {form.prizes.length < 10 && !started && (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, prizes: [...f.prizes, ''] }))}>
                <Plus className="w-4 h-4 mr-1" />Agregar premio
              </Button>
            )}
          </section>

          {/* Modo */}
          <section className="space-y-2">
            <Label>¿Quién gana?</Label>
            {started && <p className="text-xs text-amber-600 dark:text-amber-400">El sorteo ya empezó: el modo y los premios quedan fijos.</p>}
            <div className="grid sm:grid-cols-3 gap-2">
              {Object.entries(MODE_INFO).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  disabled={started}
                  onClick={() => set('drawMode', key)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all disabled:opacity-60',
                    form.drawMode === key ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:border-primary/50'
                  )}
                >
                  <p className="font-medium text-sm">{info.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{info.hint}</p>
                </button>
              ))}
            </div>
            {form.drawMode === 'NTH' && (
              <div className="flex items-center gap-2 text-sm">
                <span>Gana el boleto número</span>
                <Input
                  type="number"
                  min={2}
                  className="w-24"
                  disabled={started}
                  value={form.drawPosition ?? ''}
                  onChange={(e) => set('drawPosition', e.target.value ? Number(e.target.value) : null)}
                />
                <span className="text-muted-foreground">en salir (los anteriores se descartan)</span>
              </div>
            )}
          </section>

          {/* Estilo */}
          <section className="space-y-2">
            <Label>Estilo del sorteo</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STYLE_INFO).map(([key, info]) => {
                const Icon = STYLE_ICONS[key as keyof typeof STYLE_ICONS];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('style', key)}
                    className={cn(
                      'rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center transition-all',
                      form.style === key ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:border-primary/50'
                    )}
                  >
                    <Icon className="w-6 h-6 text-primary" />
                    <span className="font-medium text-sm">{info.label}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{info.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Opcional: venta de boletos */}
          <section className="rounded-xl border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Vender boletos</p>
                <p className="text-xs text-muted-foreground">Registra el cobro como ingreso en Bancos. Apágalo si la rifa es gratuita.</p>
              </div>
              <Switch checked={form.sellTickets} onCheckedChange={(v) => set('sellTickets', v)} />
            </div>
            {form.sellTickets && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Precio por boleto</Label>
                  <Input type="number" min={0} step="0.01" value={form.ticketPrice ?? ''} onChange={(e) => set('ticketPrice', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cuenta sugerida</Label>
                  <Select value={form.bankAccountId ?? ''} onValueChange={(v) => set('bankAccountId', v)}>
                    <SelectTrigger><SelectValue placeholder="Elegir cuenta" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.referenceName} · {b.bankName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* Opcional: boletos automaticos por venta */}
          <section className="rounded-xl border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Boletos automáticos por venta</p>
                <p className="text-xs text-muted-foreground">Cada venta registrada le regala boletos al cliente (mientras el sorteo no empiece).</p>
              </div>
              <Switch checked={form.autoTickets} onCheckedChange={(v) => set('autoTickets', v)} />
            </div>
            {form.autoTickets && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Venta mínima</Label>
                  <Input type="number" min={0} value={form.autoMinAmount ?? ''} onChange={(e) => set('autoMinAmount', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Boletos por venta</Label>
                  <Input type="number" min={1} max={100} value={form.autoTicketsPerSale} onChange={(e) => set('autoTicketsPerSale', Math.max(1, Number(e.target.value) || 1))} />
                </div>
              </div>
            )}
          </section>

          {/* Terminos y condiciones de la agencia */}
          <section className="space-y-2">
            <Label htmlFor="raffle-terms" className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" />Términos y condiciones</Label>
            <Textarea id="raffle-terms" rows={6} className="text-xs" value={form.terms ?? ''} onChange={(e) => set('terms', e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Se muestran al pie de la pantalla del sorteo. Ajústalos a tu agencia.</p>
            <label className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <span className="text-xs leading-relaxed">
                Acepto que la agencia organiza esta rifa bajo su propia responsabilidad, que los términos anteriores son correctos y que cumple con la normatividad aplicable. TravelFlow solo proporciona la herramienta.
              </span>
            </label>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !accepted}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {raffle?.id ? 'Guardar cambios' : 'Crear rifa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
