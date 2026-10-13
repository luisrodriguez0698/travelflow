'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, UserCheck, X, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ParticipantValue {
  id?: string;
  name: string;
  phone: string | null;
  clientId: string | null;
  sellerId: string | null;
  tickets: number;
}

interface Options {
  clients: { id: string; fullName: string; phone: string | null }[];
  sellers: { id: string; name: string | null; email: string }[];
  banks: { id: string; referenceName: string; bankName: string }[];
  ownOnly: boolean;
  me: string;
}

const formatMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export function ParticipantDialog({
  open,
  onOpenChange,
  raffle,
  participant,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffle: { id: string; sellTickets: boolean; ticketPrice: number | null; bankAccountId: string | null };
  participant?: ParticipantValue | null;
  onSaved: () => void;
}) {
  const editing = !!participant?.id;
  const [form, setForm] = useState<ParticipantValue>({ name: '', phone: '', clientId: null, sellerId: null, tickets: 1 });
  const [clientName, setClientName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Options | null>(null);
  const [charge, setCharge] = useState(true);
  const [amount, setAmount] = useState<number>(0);
  const [bankId, setBankId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(participant ? { ...participant } : { name: '', phone: '', clientId: null, sellerId: null, tickets: 1 });
    setClientName(participant?.clientId ? participant.name : null);
    setSearch('');
    setCharge(raffle.sellTickets);
    setBankId(raffle.bankAccountId ?? '');
  }, [open, participant, raffle.sellTickets, raffle.bankAccountId]);

  // Buscador de clientes (y catalogos)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetch(`/api/raffles/options?search=${encodeURIComponent(search.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setOptions(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [open, search]);

  useEffect(() => {
    setAmount(+(form.tickets * (raffle.ticketPrice ?? 0)).toFixed(2));
  }, [form.tickets, raffle.ticketPrice]);

  const set = <K extends keyof ParticipantValue>(key: K, value: ParticipantValue[K]) => setForm((f) => ({ ...f, [key]: value }));

  const pickClient = (c: Options['clients'][number]) => {
    setForm((f) => ({ ...f, clientId: c.id, name: c.fullName, phone: c.phone || f.phone }));
    setClientName(c.fullName);
    setSearch('');
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    if (form.tickets < 1) return toast.error('Mínimo 1 boleto');
    const payment = !editing && raffle.sellTickets && charge && amount > 0 ? { amount, bankAccountId: bankId } : null;
    if (payment && !payment.bankAccountId) return toast.error('Elige la cuenta donde entra el pago');
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/raffles/${raffle.id}/participants/${participant!.id}` : `/api/raffles/${raffle.id}/participants`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, payment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Participante actualizado' : `${form.name} agregado con ${form.tickets} boleto(s)`);
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar participante' : 'Agregar participante'}</DialogTitle>
          <DialogDescription>Elige un cliente existente o escribe el nombre de la persona.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente existente */}
          {clientName ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium min-w-0">
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">Cliente: {clientName}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Quitar cliente"
                onClick={() => {
                  setClientName(null);
                  set('clientId', null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Buscar en clientes (opcional)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="search" autoComplete="off" className="pl-9" placeholder="Nombre o teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {search.trim() && (
                <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                  {options?.clients.length ? (
                    options.clients.map((c) => (
                      <button key={c.id} type="button" onClick={() => pickClient(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                        <span className="font-medium">{c.fullName}</span>
                        {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias: escribe el nombre abajo.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <PhoneInput value={form.phone ?? ''} onChange={(v) => set('phone', v)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Boletos *</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" onClick={() => set('tickets', Math.max(1, form.tickets - 1))}><Minus className="w-4 h-4" /></Button>
                <Input type="number" min={1} max={5000} className="text-center" value={form.tickets} onChange={(e) => set('tickets', Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
                <Button type="button" variant="outline" size="icon" onClick={() => set('tickets', Math.min(5000, form.tickets + 1))}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
            {options && !options.ownOnly && (
              <div className="space-y-1.5">
                <Label>Agente / usuario</Label>
                <Select value={form.sellerId ?? options.me} onValueChange={(v) => set('sellerId', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!editing && raffle.sellTickets && (
            <div className={cn('rounded-xl border p-3 space-y-3', charge && 'border-emerald-500/40 bg-emerald-500/5')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Registrar cobro ({formatMoney(raffle.ticketPrice ?? 0)} c/u)</p>
                <Switch checked={charge} onCheckedChange={setCharge} />
              </div>
              {charge && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monto</Label>
                    <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cuenta</Label>
                    <Select value={bankId} onValueChange={setBankId}>
                      <SelectTrigger><SelectValue placeholder="Elegir cuenta" /></SelectTrigger>
                      <SelectContent>
                        {options?.banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.referenceName} · {b.bankName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? 'Guardar' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
