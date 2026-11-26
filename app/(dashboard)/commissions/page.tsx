'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import gsap from 'gsap';
import { toast } from 'sonner';
import { Ban, CalendarClock, Coins, HandCoins, Hourglass, Loader2, Pencil, Settings2, SlidersHorizontal, Undo2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EmptyState } from '@/components/empty-state';
import { RowsSkeleton } from '@/components/skeletons';
import { cn } from '@/lib/utils';
import {
  COMMISSION_BASES,
  EARNED_WHEN,
  SALARY_FREQUENCIES,
  type AgentSummary,
  type CommissionBase,
  type CommissionRow,
  type CommissionStatus,
  type EarnedWhen,
  type SalaryFrequency,
} from '@/lib/commission-rules';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
const todayStr = () => format(new Date(), 'yyyy-MM-dd');
// Mes (en Mexico) de una fecha: "2026-11" y su nombre "noviembre 2026"
const monthKeyOf = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7);
const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const monthsOf = (rows: CommissionRow[]) =>
  [...new Set(rows.map((r) => (r.earnedAt ? monthKeyOf(r.earnedAt) : null)).filter((k): k is string => !!k))].sort().reverse();

/** Dia 1 del mes actual: fecha sugerida para empezar a comisionar */
const monthStartStr = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

const STATUS: Record<CommissionStatus, { label: string; cls: string }> = {
  WAITING: { label: 'Por ganar', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  PARTIAL: { label: 'Ganando', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  EARNED: { label: 'Por pagar', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  PAID: { label: 'Pagada', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' },
  CLAWBACK: { label: 'A descontar', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

interface Payout {
  id: string;
  userId: string;
  agent: string;
  commissionAmount: number;
  salaryAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  total: number;
  account: string | null;
  paidAt: string;
  notes: string | null;
  status: string;
  createdBy: string | null;
  items: { bookingId: string; amount: number; client: string }[];
}

interface Account {
  id: string;
  referenceName: string;
  bankName: string;
  currentBalance: number;
}

function ruleText(s: AgentSummary['setting']) {
  if (!s) return 'Sin configurar';
  const parts: string[] = [];
  if (s.commissionRate > 0) parts.push(`${s.commissionRate}% ${COMMISSION_BASES[s.commissionBase].short} · ${EARNED_WHEN[s.earnedWhen].label.toLowerCase()}`);
  else parts.push('Sin comisión');
  return parts.join('');
}

// ─────────────────────────── Configurar agente ───────────────────────────
function SettingDialog({ agent, onClose, onSaved }: { agent: AgentSummary | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    baseSalary: '',
    salaryFrequency: 'QUINCENAL' as SalaryFrequency,
    commissionRate: '',
    commissionBase: 'PROFIT' as CommissionBase,
    earnedWhen: 'PAID' as EarnedWhen,
    startDate: monthStartStr(),
    isActive: true,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent) return;
    const s = agent.setting;
    setForm({
      baseSalary: s ? String(s.baseSalary || '') : '',
      salaryFrequency: s?.salaryFrequency ?? 'QUINCENAL',
      commissionRate: s ? String(s.commissionRate || '') : '',
      commissionBase: s?.commissionBase ?? 'PROFIT',
      earnedWhen: s?.earnedWhen ?? 'PAID',
      startDate: s?.startDate ?? monthStartStr(),
      isActive: s?.isActive ?? true,
      notes: s?.notes ?? '',
    });
  }, [agent]);

  const rate = Number(form.commissionRate) || 0;
  const example = form.commissionBase === 'PROFIT' ? 4000 : 20000;

  const save = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await fetch('/api/commissions/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: agent.userId,
          baseSalary: Number(form.baseSalary) || 0,
          salaryFrequency: form.salaryFrequency,
          commissionRate: rate,
          commissionBase: form.commissionBase,
          earnedWhen: form.earnedWhen,
          startDate: form.startDate,
          isActive: form.isActive,
          notes: form.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      toast.success(`Configuración de ${agent.name} guardada`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sueldo y comisión · {agent?.name}</DialogTitle>
          <DialogDescription>Cómo se le paga a esta persona. Puedes cambiarlo cuando quieras.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sueldo base</Label>
              <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
            </div>
            <div>
              <Label>Cada cuándo</Label>
              <Select value={form.salaryFrequency} onValueChange={(v) => setForm({ ...form, salaryFrequency: v as SalaryFrequency })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SALARY_FREQUENCIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div>
              <Label>Comisión %</Label>
              <Input type="number" min={0} max={100} step="0.1" inputMode="decimal" placeholder="0" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
            </div>
            <div>
              <Label>Sobre</Label>
              <Select value={form.commissionBase} onValueChange={(v) => setForm({ ...form, commissionBase: v as CommissionBase })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMISSION_BASES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>¿Cuándo se gana la comisión?</Label>
            <div className="mt-1.5 grid gap-2">
              {(Object.keys(EARNED_WHEN) as EarnedWhen[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, earnedWhen: k })}
                  className={cn('rounded-lg border p-2.5 text-left transition-colors', form.earnedWhen === k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/60')}
                >
                  <p className="text-sm font-medium">
                    {EARNED_WHEN[k].label}
                    {k === 'PAID' && <span className="ml-1.5 text-[10px] font-semibold text-primary">RECOMENDADO</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{EARNED_WHEN[k].hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label>Comisiona desde</Label>
              <DatePicker value={form.startDate ? parseISO(form.startDate) : null} onChange={(d) => setForm({ ...form, startDate: d ? format(d, 'yyyy-MM-dd') : monthStartStr() })} />
            </div>
            <label className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
              Activo
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </label>
          </div>

          <p className="-mt-2 text-xs text-muted-foreground">
            {EARNED_WHEN[form.earnedWhen].since} Cada comisión cuenta en el mes en que se gana.
          </p>

          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej: en grupos la comisión es fija" />
          </div>

          {rate > 0 && (
            <p className="rounded-lg bg-primary/5 p-3 text-xs">
              Ejemplo: en una venta con {form.commissionBase === 'PROFIT' ? `$${example.toLocaleString('es-MX')} de ganancia` : `$${example.toLocaleString('es-MX')} de total`}, ganaría{' '}
              <b>{money((example * rate) / 100)}</b>.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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

// ─────────────────────────── Ajustar comision de una venta ───────────────────────────
function OverrideDialog({ row, agentName, onClose, onSaved }: { row: CommissionRow | null; agentName: string; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'rule' | 'rate' | 'amount'>('rule');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const o = row.override;
    setMode(o?.amount != null ? 'amount' : o?.rate != null ? 'rate' : 'rule');
    setValue(o?.amount != null ? String(o.amount) : o?.rate != null ? String(o.rate) : '');
    setNote(o?.note ?? '');
  }, [row]);

  const preview = !row ? 0 : mode === 'amount' ? Number(value) || 0 : mode === 'rate' ? (row.baseAmount * (Number(value) || 0)) / 100 : null;

  const save = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const res = await fetch('/api/commissions/override', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: row.bookingId,
          rate: mode === 'rate' ? Number(value) || 0 : null,
          amount: mode === 'amount' ? Number(value) || 0 : null,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      toast.success('Comisión actualizada');
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comisión de esta venta</DialogTitle>
          <DialogDescription>
            {row?.client} · Folio {row?.folio} · {agentName}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold">{money(row.total)}</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-muted-foreground">Ganancia</p>
                <p className="font-semibold">{money(row.total - row.cost)}</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-muted-foreground">Base</p>
                <p className="font-semibold">{money(row.baseAmount)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['rule', 'Regla del agente'],
                  ['rate', 'Otro %'],
                  ['amount', 'Monto fijo'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  className={cn('rounded-lg border px-2 py-2 text-xs font-medium', mode === k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/60')}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode !== 'rule' && (
              <div>
                <Label>{mode === 'rate' ? 'Porcentaje para esta venta' : 'Monto de la comisión'}</Label>
                <Input type="number" min={0} step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              </div>
            )}
            <div>
              <Label>Motivo (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: venta compartida, grupo, promoción" />
            </div>
            <p className="rounded-lg bg-primary/5 p-3 text-sm">
              Comisión: <b>{preview === null ? 'según la regla del agente' : money(preview)}</b>
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving || (mode !== 'rule' && value === '')}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Pagar a un agente ───────────────────────────
function PayDialog({
  agent,
  rows,
  accounts,
  onClose,
  onSaved,
}: {
  agent: AgentSummary | null;
  rows: CommissionRow[];
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const payable = useMemo(() => rows.filter((r) => agent && r.agentId === agent.userId && Math.abs(r.pending) > 0.005), [rows, agent]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payMonth, setPayMonth] = useState('all');
  const payMonths = useMemo(() => monthsOf(payable), [payable]);
  const [includeSalary, setIncludeSalary] = useState(false);
  const [salary, setSalary] = useState('');
  const [bonus, setBonus] = useState('');
  const [deduction, setDeduction] = useState('');
  const [accountId, setAccountId] = useState<string>('none');
  const [paidAt, setPaidAt] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setSelected(new Set(payable.map((r) => r.bookingId)));
    setPayMonth('all');
    const base = agent.setting?.baseSalary ?? 0;
    setIncludeSalary(base > 0);
    setSalary(base > 0 ? String(base) : '');
    setBonus('');
    setDeduction('');
    setAccountId('none');
    setPaidAt(todayStr());
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  const commission = payable.filter((r) => selected.has(r.bookingId)).reduce((t, r) => t + r.pending, 0);
  const salaryN = includeSalary ? Number(salary) || 0 : 0;
  const total = Math.round((commission + salaryN + (Number(bonus) || 0) - (Number(deduction) || 0)) * 100) / 100;
  const account = accounts.find((a) => a.id === accountId);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await fetch('/api/commissions/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: agent.userId,
          items: payable.filter((r) => selected.has(r.bookingId)).map((r) => ({ bookingId: r.bookingId, amount: r.pending })),
          salaryAmount: salaryN,
          bonusAmount: Number(bonus) || 0,
          deductionAmount: Number(deduction) || 0,
          bankAccountId: accountId === 'none' ? null : accountId,
          paidAt,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pago');
      toast.success(`Pago de ${money(total)} a ${agent.name} registrado`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagar a {agent?.name}</DialogTitle>
          <DialogDescription>Elige las comisiones que pagas y, si toca, su sueldo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comisiones ganadas sin pagar</p>
              {payMonths.length > 1 && (
                <Select
                  value={payMonth}
                  onValueChange={(v) => {
                    setPayMonth(v);
                    // Palomea solo las ganadas en ese mes (y siempre los descuentos pendientes)
                    setSelected(new Set(payable.filter((r) => v === 'all' || r.pending < 0 || (r.earnedAt && monthKeyOf(r.earnedAt) === v)).map((r) => r.bookingId)));
                  }}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    {payMonths.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="capitalize">Ganadas en {monthName(k)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {payable.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No tiene comisiones pendientes por pagar.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                {payable.map((r) => (
                  <li key={r.bookingId}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md p-2 hover:bg-muted/60">
                      <Checkbox checked={selected.has(r.bookingId)} onCheckedChange={() => toggle(r.bookingId)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.client}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Folio {r.folio} · vendida {shortDate(r.saleDate)}
                          {r.earnedAt && r.pending > 0 && ` · ganada ${shortDate(r.earnedAt)}`}
                          {r.pending < 0 && ' · venta cancelada, se descuenta'}
                        </span>
                      </span>
                      <span className={cn('text-sm font-semibold tabular-nums', r.pending < 0 && 'text-red-600 dark:text-red-400')}>{money(r.pending)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>
                Incluir sueldo
                {agent?.setting?.baseSalary ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({SALARY_FREQUENCIES[agent.setting.salaryFrequency].label.toLowerCase()} {money(agent.setting.baseSalary)})
                  </span>
                ) : null}
              </span>
              <Switch checked={includeSalary} onCheckedChange={setIncludeSalary} />
            </label>
            {includeSalary && <Input type="number" min={0} step="0.01" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Sueldo" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bono</Label>
              <Input type="number" min={0} step="0.01" inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Descuento</Label>
              <Input type="number" min={0} step="0.01" inputMode="decimal" value={deduction} onChange={(e) => setDeduction(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sale de la cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin movimiento en Bancos</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.referenceName} ({money(a.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <DatePicker value={parseISO(paidAt)} onChange={(d) => setPaidAt(d ? format(d, 'yyyy-MM-dd') : todayStr())} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: quincena del 1 al 15 de noviembre" />
          </div>

          <div className="space-y-1 rounded-xl bg-primary/5 p-3 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">Comisiones</span><span className="tabular-nums">{money(commission)}</span></p>
            {salaryN > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Sueldo</span><span className="tabular-nums">{money(salaryN)}</span></p>}
            {Number(bonus) > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Bono</span><span className="tabular-nums">{money(Number(bonus))}</span></p>}
            {Number(deduction) > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Descuento</span><span className="tabular-nums text-red-600">-{money(Number(deduction))}</span></p>}
            <p className="flex justify-between border-t pt-1 text-base font-bold"><span>Total a pagar</span><span className="tabular-nums">{money(total)}</span></p>
            {account && account.currentBalance < total && <p className="text-xs font-medium text-red-600">Saldo insuficiente en {account.referenceName}.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving || total <= 0 || (!!account && account.currentBalance < total)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Pagina ───────────────────────────
export default function CommissionsPage() {
  const [data, setData] = useState<{ agents: AgentSummary[]; rows: CommissionRow[]; ownOnly: boolean; canEdit: boolean; canPay: boolean } | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('agents');
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [configuring, setConfiguring] = useState<AgentSummary | null>(null);
  const [adjusting, setAdjusting] = useState<CommissionRow | null>(null);
  const [paying, setPaying] = useState<AgentSummary | null>(null);
  const [cancelling, setCancelling] = useState<Payout | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([fetch('/api/commissions'), fetch('/api/commissions/payouts')]);
      const cd = await c.json();
      if (!c.ok) throw new Error(cd.error || 'Error al cargar');
      setData(cd);
      const pd = await p.json().catch(() => []);
      setPayouts(Array.isArray(pd) ? pd : []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.canPay) return;
    fetch('/api/bank-accounts?all=true')
      .then((r) => r.json())
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]));
  }, [data?.canPay]);

  const agents = data?.agents ?? [];
  const rows = data?.rows ?? [];
  const nameOf = useMemo(() => new Map(agents.map((a) => [a.userId, a.name])), [agents]);
  const totals = useMemo(
    () => ({
      pending: agents.reduce((t, a) => t + a.pending, 0),
      waiting: agents.reduce((t, a) => t + a.waiting, 0),
      toDeduct: agents.reduce((t, a) => t + a.toDeduct, 0),
      monthEarned: agents.reduce((t, a) => t + a.monthEarned, 0),
    }),
    [agents]
  );
  const earnedMonths = useMemo(() => monthsOf(rows), [rows]);
  const filteredRows = rows.filter(
    (r) =>
      (agentFilter === 'all' || r.agentId === agentFilter) &&
      (statusFilter === 'all' || r.status === statusFilter) &&
      (monthFilter === 'all' || (r.earnedAt && monthKeyOf(r.earnedAt) === monthFilter))
  );
  const filteredEarned = filteredRows.reduce((t, r) => t + r.earned, 0);

  // Entrada: tarjetas en cascada y montos contando
  useEffect(() => {
    const el = root.current;
    if (!el || loading || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-kpi], [data-agent]', { y: 16, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' });
      el.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
        const target = Number(n.dataset.count) || 0;
        const st = { v: 0 };
        gsap.to(st, { v: target, duration: 1.1, ease: 'power3.out', onUpdate: () => { n.textContent = money(st.v); } });
      });
    }, el);
    return () => ctx.revert();
  }, [loading, tab]);

  const cancelPayout = async () => {
    if (!cancelling) return;
    try {
      const res = await fetch(`/api/commissions/payouts/${cancelling.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo anular');
      toast.success('Pago anulado: las comisiones vuelven a quedar pendientes');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div ref={root} className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comisiones</h1>
          <p className="text-muted-foreground">
            {data?.ownOnly ? 'Lo que llevas ganado por tus ventas y lo que ya se te pagó.' : 'Sueldos y comisiones por venta de cada agente: cuánto se ha ganado, cuánto falta por pagar y el historial.'}
          </p>
        </div>
      </div>

      {loading ? (
        <RowsSkeleton rows={6} />
      ) : (
        <>
          <div data-tour="page-summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: data?.ownOnly ? 'Te deben' : 'Por pagar', hint: 'Ganado y sin pagar', value: totals.pending, icon: Wallet, cls: 'text-amber-600 dark:text-amber-400' },
              { label: 'Por ganar', hint: 'Falta que los clientes paguen', value: totals.waiting, icon: Hourglass, cls: 'text-sky-600 dark:text-sky-400' },
              { label: 'Ganado este mes', hint: 'Comisiones que se ganaron este mes', value: totals.monthEarned, icon: Coins, cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'A descontar', hint: 'Pagadas de ventas canceladas', value: totals.toDeduct, icon: Ban, cls: totals.toDeduct > 0 ? 'text-red-600 dark:text-red-400' : '' },
            ].map((k) => (
              <Card key={k.label} data-kpi className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p data-count={k.value} className={cn('mt-1 text-xl font-bold tabular-nums sm:text-2xl', k.cls)}>
                  {money(k.value)}
                </p>
                <p className="text-[11px] text-muted-foreground">{k.hint}</p>
              </Card>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList data-tour="comm-tabs">
              <TabsTrigger value="agents">{data?.ownOnly ? 'Mi resumen' : 'Agentes'}</TabsTrigger>
              <TabsTrigger value="sales">Por venta</TabsTrigger>
              <TabsTrigger value="payouts">Pagos</TabsTrigger>
            </TabsList>

            {/* ── Agentes ── */}
            <TabsContent value="agents" className="mt-4">
              {agents.length === 0 ? (
                <EmptyState icon={HandCoins} title="Sin agentes" description="Agrega usuarios en Usuarios para configurar sus comisiones." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {agents.map((a, i) => (
                    <Card key={a.userId} data-agent data-tour={i === 0 ? 'comm-agent' : undefined} className={cn('flex flex-col p-4', a.setting && !a.setting.isActive && 'opacity-60')}>
                      <div className="flex items-start gap-3">
                        {a.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 font-bold text-white">
                            {a.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{a.name}</p>
                          <p className={cn('text-xs', a.setting ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400')}>{ruleText(a.setting)}</p>
                          {a.setting && a.setting.baseSalary > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Sueldo {money(a.setting.baseSalary)} {SALARY_FREQUENCIES[a.setting.salaryFrequency].label.toLowerCase()}
                            </p>
                          )}
                        </div>
                        {a.setting && !a.setting.isActive && <Badge variant="outline">Inactivo</Badge>}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-amber-500/10 p-2">
                          <p className="text-[10px] uppercase text-muted-foreground">Por pagar</p>
                          <p className="text-sm font-bold tabular-nums">{money(a.pending)}</p>
                        </div>
                        <div className="rounded-lg bg-sky-500/10 p-2">
                          <p className="text-[10px] uppercase text-muted-foreground">Por ganar</p>
                          <p className="text-sm font-bold tabular-nums">{money(a.waiting)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2">
                          <p className="text-[10px] uppercase text-muted-foreground">Pagado</p>
                          <p className="text-sm font-bold tabular-nums">{money(a.paid)}</p>
                        </div>
                      </div>
                      {a.toDeduct > 0 && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{money(a.toDeduct)} a descontar por ventas canceladas</p>}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {a.salesCount} venta{a.salesCount === 1 ? '' : 's'} con comisión
                        {a.lastPayoutAt && ` · último pago ${shortDate(a.lastPayoutAt)}`}
                      </p>

                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {data?.canEdit && (
                          <Button size="sm" variant="outline" data-tour={i === 0 ? 'comm-configure' : undefined} onClick={() => setConfiguring(a)}>
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            {a.setting ? 'Configurar' : 'Configurar sueldo y %'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAgentFilter(a.userId);
                            setTab('sales');
                          }}
                        >
                          Ver ventas
                        </Button>
                        {data?.canPay && (a.pending > 0 || (a.setting?.baseSalary ?? 0) > 0) && (
                          <Button size="sm" variant="gradient" className="ml-auto" data-tour="comm-pay" onClick={() => setPaying(a)}>
                            <HandCoins className="mr-1.5 h-3.5 w-3.5" />
                            Pagar
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Por venta ── */}
            <TabsContent value="sales" className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {!data?.ownOnly && (
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los agentes</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.userId} value={a.userId}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="w-44">
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {(Object.keys(STATUS) as CommissionStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {STATUS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ganadas en cualquier mes</SelectItem>
                    {earnedMonths.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="capitalize">Ganadas en {monthName(k)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {monthFilter !== 'all' && (
                  <span className="self-center text-sm text-muted-foreground">
                    Total ganado: <b className="tabular-nums text-foreground">{money(filteredEarned)}</b>
                  </span>
                )}
              </div>
              {filteredRows.length === 0 ? (
                <EmptyState
                  icon={Coins}
                  title="Sin comisiones"
                  description={agents.some((a) => a.setting) ? 'No hay ventas con comisión con estos filtros.' : 'Configura el % de cada agente en la pestaña Agentes.'}
                />
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="p-3 text-left font-medium">Venta</th>
                        {!data?.ownOnly && <th className="p-3 text-left font-medium">Agente</th>}
                        <th className="p-3 text-right font-medium">Base</th>
                        <th className="p-3 text-right font-medium">%</th>
                        <th className="p-3 text-right font-medium">Comisión</th>
                        <th className="p-3 text-right font-medium">Cobrado</th>
                        <th className="p-3 text-right font-medium">Pagada</th>
                        <th className="p-3 text-right font-medium">Pendiente</th>
                        <th className="p-3 text-left font-medium">Estado</th>
                        {data?.canEdit && <th className="p-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.bookingId} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="p-3">
                            <Link href={`/sales/${r.bookingId}`} className="font-medium hover:underline">
                              {r.client}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">
                              {r.folio} · {shortDate(r.saleDate)}
                            </p>
                          </td>
                          {!data?.ownOnly && <td className="p-3 text-xs">{nameOf.get(r.agentId) ?? '—'}</td>}
                          <td className="p-3 text-right tabular-nums">{money(r.baseAmount)}</td>
                          <td className="p-3 text-right tabular-nums">
                            {r.override?.amount != null ? 'Fijo' : `${r.rate}%`}
                            {r.override && <span title={r.override.note ?? 'Ajustada'} className="ml-1 text-primary">✎</span>}
                          </td>
                          <td className="p-3 text-right font-semibold tabular-nums">{money(r.commission)}</td>
                          <td className="p-3 text-right">
                            <span className="tabular-nums">{r.collectedPct}%</span>
                            <div className="ml-auto mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.collectedPct}%` }} />
                            </div>
                          </td>
                          <td className="p-3 text-right tabular-nums">{money(r.paid)}</td>
                          <td className={cn('p-3 text-right font-semibold tabular-nums', r.pending < 0 && 'text-red-600 dark:text-red-400')}>{money(r.pending)}</td>
                          <td className="p-3">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                            {r.earnedAt && r.earned > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Ganada el {shortDate(r.earnedAt)}</p>}
                          </td>
                          {data?.canEdit && (
                            <td className="p-3 text-right">
                              {!r.cancelled && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAdjusting(r)} aria-label="Ajustar comisión">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </TabsContent>

            {/* ── Pagos ── */}
            <TabsContent value="payouts" className="mt-4">
              {payouts.length === 0 ? (
                <EmptyState icon={CalendarClock} title="Sin pagos registrados" description="Aquí aparecerá cada pago de comisiones y sueldo." />
              ) : (
                <div className="space-y-3">
                  {payouts.map((p) => (
                    <Card key={p.id} className={cn('p-4', p.status === 'CANCELLED' && 'opacity-60')}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {p.agent}
                            {p.status === 'CANCELLED' && <Badge variant="outline" className="ml-2">Anulado</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shortDate(p.paidAt)}
                            {p.account ? ` · desde ${p.account}` : ' · sin movimiento en Bancos'}
                            {p.createdBy && ` · registró ${p.createdBy}`}
                          </p>
                          {p.notes && <p className="mt-1 text-xs">{p.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className={cn('text-lg font-bold tabular-nums', p.status === 'CANCELLED' && 'line-through')}>{money(p.total)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {[
                              p.commissionAmount !== 0 && `Comisiones ${money(p.commissionAmount)}`,
                              p.salaryAmount > 0 && `Sueldo ${money(p.salaryAmount)}`,
                              p.bonusAmount > 0 && `Bono ${money(p.bonusAmount)}`,
                              p.deductionAmount > 0 && `Desc. -${money(p.deductionAmount)}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                      {p.items.length > 0 && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            {p.items.length} venta{p.items.length === 1 ? '' : 's'}
                          </summary>
                          <ul className="mt-1 space-y-0.5 pl-3">
                            {p.items.map((i) => (
                              <li key={i.bookingId} className="flex justify-between gap-2">
                                <Link href={`/sales/${i.bookingId}`} className="truncate hover:underline">
                                  {i.client}
                                </Link>
                                <span className="tabular-nums">{money(i.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {data?.canPay && p.status === 'ACTIVE' && (
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setCancelling(p)}>
                            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                            Anular
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <SettingDialog agent={configuring} onClose={() => setConfiguring(null)} onSaved={load} />
      <OverrideDialog row={adjusting} agentName={adjusting ? nameOf.get(adjusting.agentId) ?? '' : ''} onClose={() => setAdjusting(null)} onSaved={load} />
      <PayDialog agent={paying} rows={rows} accounts={accounts} onClose={() => setPaying(null)} onSaved={load} />

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              El pago de {cancelling && money(cancelling.total)} a {cancelling?.agent} se anula
              {cancelling?.account ? ', el dinero regresa a la cuenta' : ''} y sus comisiones vuelven a quedar pendientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelPayout} className="bg-red-600 hover:bg-red-700">
              Anular pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
