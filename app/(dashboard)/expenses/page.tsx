'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AppWindow,
  Bell,
  BellOff,
  CircleDollarSign,
  Droplets,
  Flame,
  History,
  Home,
  Landmark,
  Loader2,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  Undo2,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useCan } from '@/hooks/use-can';
import { useLiveList } from '@/hooks/use-live-list';
import { cn } from '@/lib/utils';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_FREQUENCIES,
  REMIND_OPTIONS,
  advanceDueDate,
  dateToDay,
  daysUntil,
  dueStatus,
  monthlyEquivalent,
  type ExpenseCategory,
} from '@/lib/fixed-expense-rules';

const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  LUZ: Zap,
  AGUA: Droplets,
  RENTA: Home,
  INTERNET: Wifi,
  TELEFONO: Phone,
  GAS: Flame,
  NOMINA: Users,
  IMPUESTOS: Landmark,
  SEGURO: ShieldCheck,
  SOFTWARE: AppWindow,
  MANTENIMIENTO: Wrench,
  OTRO: CircleDollarSign,
};

interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: keyof typeof EXPENSE_FREQUENCIES;
  dueDay: number | null;
  nextDueDate: string;
  notify: boolean;
  remindDaysBefore: number;
  bankAccountId: string | null;
  bankAccount: { id: string; referenceName: string; bankName: string } | null;
  notes: string | null;
  isActive: boolean;
  lastPayment: { amount: number; paidAt: string } | null;
}

interface Account {
  id: string;
  referenceName: string;
  bankName: string;
  currentBalance: number;
}

interface Payment {
  id: string;
  dueDate: string;
  amount: number;
  paidAt: string;
  status: string;
  bankName: string | null;
  notes: string | null;
}

interface FormState {
  name: string;
  category: ExpenseCategory;
  amount: string;
  frequency: keyof typeof EXPENSE_FREQUENCIES;
  nextDueDate: string;
  notify: boolean;
  remindDaysBefore: number;
  bankAccountId: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'LUZ',
  amount: '',
  frequency: 'BIMONTHLY',
  nextDueDate: '',
  notify: true,
  remindDaysBefore: 3,
  bankAccountId: '',
  notes: '',
};

const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const fmtDay = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const NO_ACCOUNT = '__none__';

function statusBadge(e: Expense) {
  const days = daysUntil(e.nextDueDate);
  const status = dueStatus(e.nextDueDate, e.remindDaysBefore);
  if (status === 'overdue') return { text: `Vencido hace ${-days} día${days === -1 ? '' : 's'}`, className: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  if (status === 'today') return { text: 'Vence hoy', className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' };
  if (status === 'soon') return { text: `En ${days} día${days === 1 ? '' : 's'}`, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  return { text: `En ${days} días`, className: 'bg-muted text-muted-foreground' };
}

export default function FixedExpensesPage() {
  const can = useCan();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [paying, setPaying] = useState<Expense | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payAccountId, setPayAccountId] = useState(NO_ACCOUNT);
  const [payNotes, setPayNotes] = useState('');

  const [historyOf, setHistoryOf] = useState<Expense | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/fixed-expenses');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExpenses(data);
    } catch (err) {
      toast.error((err as Error).message || 'Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/bank-accounts?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]));
  }, [load]);
  useLiveList('fixed_expenses', load);

  const active = expenses.filter((e) => e.isActive);
  const paused = expenses.filter((e) => !e.isActive);
  const summary = useMemo(() => {
    const monthly = active.reduce((s, e) => s + monthlyEquivalent(e.amount, e.frequency), 0);
    const next7 = active.filter((e) => {
      const d = daysUntil(e.nextDueDate);
      return d >= 0 && d <= 7;
    });
    const overdue = active.filter((e) => daysUntil(e.nextDueDate) < 0);
    return {
      monthly,
      next7Amount: next7.reduce((s, e) => s + e.amount, 0),
      next7Count: next7.length,
      overdueAmount: overdue.reduce((s, e) => s + e.amount, 0),
      overdueCount: overdue.length,
    };
  }, [active]);

  // ── Crear / editar ──
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, name: EXPENSE_CATEGORIES.LUZ.label });
    setFormOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      name: e.name,
      category: e.category,
      amount: String(e.amount),
      frequency: e.frequency,
      nextDueDate: dateToDay(e.nextDueDate),
      notify: e.notify,
      remindDaysBefore: e.remindDaysBefore,
      bankAccountId: e.bankAccountId ?? '',
      notes: e.notes ?? '',
    });
    setFormOpen(true);
  };

  const pickCategory = (category: ExpenseCategory) => {
    setForm((f) => {
      // Si el nombre era el de la categoria anterior (o vacio), se cambia por el nuevo
      const wasDefault = !f.name.trim() || f.name === EXPENSE_CATEGORIES[f.category].label;
      const frequency = category === 'LUZ' || category === 'AGUA' ? 'BIMONTHLY' : f.frequency === 'BIMONTHLY' ? 'MONTHLY' : f.frequency;
      return { ...f, category, name: wasDefault ? EXPENSE_CATEGORIES[category].label : f.name, frequency: editing ? f.frequency : frequency };
    });
  };

  const saveForm = async () => {
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    if (!(parseFloat(form.amount) > 0)) return toast.error('El monto debe ser mayor a 0');
    if (!form.nextDueDate) return toast.error('Indica cuándo vence');
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/fixed-expenses/${editing.id}` : '/api/fixed-expenses', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), bankAccountId: form.bankAccountId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Gasto actualizado' : 'Gasto fijo creado');
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Pagar ──
  const openPay = (e: Expense) => {
    setPaying(e);
    setPayAmount(String(e.amount));
    setPayDate(dateToDay(new Date()));
    setPayAccountId(e.bankAccountId && accounts.some((a) => a.id === e.bankAccountId) ? e.bankAccountId : NO_ACCOUNT);
    setPayNotes('');
  };

  const pay = async () => {
    if (!paying) return;
    if (!(parseFloat(payAmount) > 0)) return toast.error('El monto debe ser mayor a 0');
    setSaving(true);
    try {
      const res = await fetch(`/api/fixed-expenses/${paying.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          paidAt: payDate || undefined,
          bankAccountId: payAccountId === NO_ACCOUNT ? null : payAccountId,
          notes: payNotes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`${paying.name} pagado`, { description: `Próximo vencimiento: ${fmtDay(data.nextDueDate)}` });
      setPaying(null);
      load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  // ── Historial / deshacer ──
  const openHistory = async (e: Expense) => {
    setHistoryOf(e);
    setHistory([]);
    const res = await fetch(`/api/fixed-expenses/${e.id}/payments`);
    if (res.ok) setHistory(await res.json());
  };

  const undoPayment = async (p: Payment) => {
    if (!historyOf) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fixed-expenses/${historyOf.id}/payments?paymentId=${p.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success('Pago deshecho', { description: `Vuelve a vencer el ${fmtDay(data.nextDueDate)}` });
      openHistory(historyOf);
      load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo deshacer');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (e: Expense) => {
    const res = await fetch(`/api/fixed-expenses/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !e.isActive }),
    });
    if (res.ok) {
      toast.success(e.isActive ? 'Gasto pausado: no enviará recordatorios' : 'Gasto reactivado');
      load();
    } else toast.error('No se pudo actualizar');
  };

  const remove = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/fixed-expenses/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Gasto eliminado');
      setDeleting(null);
      load();
    } else toast.error('No se pudo eliminar');
  };

  const latestActivePaymentId = history.filter((p) => p.status === 'ACTIVE').sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0]?.id;

  const renderCard = (e: Expense) => {
    const Icon = CATEGORY_ICONS[e.category] ?? CircleDollarSign;
    const color = EXPENSE_CATEGORIES[e.category]?.color ?? '#94a3b8';
    const badge = statusBadge(e);
    return (
      <Card key={e.id} className={cn('p-4 flex flex-col gap-3', !e.isActive && 'opacity-60')}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{e.name}</p>
            <p className="text-xs text-muted-foreground">
              {EXPENSE_CATEGORIES[e.category]?.label} · {EXPENSE_FREQUENCIES[e.frequency]?.label}
            </p>
          </div>
          <p className="text-lg font-bold shrink-0">{money(e.amount)}</p>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Vence {fmtDay(e.nextDueDate)}</span>
          {e.isActive ? (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>{badge.text}</span>
          ) : (
            <Badge variant="outline">Pausado</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {e.notify ? <Bell className="w-3.5 h-3.5 text-primary" /> : <BellOff className="w-3.5 h-3.5" />}
            {e.notify ? `Aviso ${e.remindDaysBefore} día${e.remindDaysBefore === 1 ? '' : 's'} antes` : 'Sin aviso'}
          </span>
          {e.bankAccount && (
            <span className="flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" />
              {e.bankAccount.referenceName}
            </span>
          )}
          {e.lastPayment && <span>Último pago {fmtDay(e.lastPayment.paidAt)}</span>}
        </div>

        <div className="flex items-center gap-2 mt-auto">
          {e.isActive && can('gastos', 'payments') && (
            <Button size="sm" variant="gradient" className="flex-1" onClick={() => openPay(e)}>
              <Wallet className="w-3.5 h-3.5 mr-1.5" />
              Pagar
            </Button>
          )}
          <Button size="icon" variant="ghost" title="Historial de pagos" onClick={() => openHistory(e)}>
            <History className="w-4 h-4" />
          </Button>
          {can('gastos', 'edit') && (
            <>
              <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(e)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" title={e.isActive ? 'Pausar' : 'Reactivar'} onClick={() => toggleActive(e)}>
                {e.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </>
          )}
          {can('gastos', 'delete') && (
            <Button size="icon" variant="ghost" title="Eliminar" className="text-red-500 hover:text-red-700" onClick={() => setDeleting(e)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const payNext = paying ? advanceDueDate(new Date(paying.nextDueDate), paying.frequency, paying.dueDay) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gastos fijos</h1>
          <p className="text-muted-foreground">Luz, agua, renta y demás pagos recurrentes, con recordatorios antes de que venzan</p>
        </div>
        {can('gastos', 'create') && (
          <Button data-tour="page-action" variant="gradient" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo gasto
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Gasto fijo al mes (aprox.)</p>
            <p className="text-2xl font-bold">{money(Math.round(summary.monthly))}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Por pagar en los próximos 7 días</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{money(summary.next7Amount)}</p>
            <p className="text-xs text-muted-foreground">{summary.next7Count} gasto(s)</p>
          </Card>
          <Card className={cn('p-4', summary.overdueCount > 0 && 'border-red-500/40 bg-red-500/5')}>
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className={cn('text-2xl font-bold', summary.overdueCount > 0 && 'text-red-600 dark:text-red-400')}>{money(summary.overdueAmount)}</p>
            <p className="text-xs text-muted-foreground">{summary.overdueCount} gasto(s)</p>
          </Card>
        </div>
      )}

      {loading ? (
        <RowsSkeleton rows={3} />
      ) : expenses.length === 0 ? (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="Aún no hay gastos fijos"
            description="Registra la luz, el agua, la renta o cualquier pago recurrente y te avisamos antes de que venza."
            action={
              can('gastos', 'create') && (
                <Button variant="gradient" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar el primero
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div data-tour="page-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map(renderCard)}
          </div>
          {paused.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Pausados ({paused.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{paused.map(renderCard)}</div>
            </div>
          )}
        </>
      )}

      {/* ── Crear / editar ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</DialogTitle>
            <DialogDescription>Elige el tipo de gasto, cuánto es y cada cuándo se paga.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((key) => {
                const Icon = CATEGORY_ICONS[key];
                const selected = form.category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickCategory(key)}
                    className={cn(
                      'rounded-xl border p-2 flex flex-col items-center gap-1 text-center transition-all',
                      selected ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:border-primary/50'
                    )}
                  >
                    <Icon className="w-5 h-5" style={{ color: EXPENSE_CATEGORIES[key].color }} />
                    <span className="text-[11px] leading-tight">{EXPENSE_CATEGORIES[key].label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Luz oficina centro" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cada cuándo se paga</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as FormState['frequency'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_FREQUENCIES).map(([key, f]) => (
                      <SelectItem key={key} value={key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Próximo vencimiento *</Label>
                <DatePicker
                  value={form.nextDueDate ? parseISO(form.nextDueDate) : null}
                  onChange={(d) => setForm({ ...form, nextDueDate: d ? format(d, 'yyyy-MM-dd') : '' })}
                  placeholder="¿Cuándo vence?"
                  toYear={new Date().getFullYear() + 5}
                />
              </div>
            </div>

            <div className={cn('rounded-lg border p-3 space-y-3', form.notify && 'border-primary/30 bg-primary/5')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-primary" />
                    Recordatorio
                  </p>
                  <p className="text-xs text-muted-foreground">Aviso en la campana y en el celular antes de que venza, el día que vence y si se pasa.</p>
                </div>
                <Switch checked={form.notify} onCheckedChange={(v) => setForm({ ...form, notify: v })} />
              </div>
              {form.notify && (
                <div className="flex items-center gap-2 text-sm">
                  <span>Avisarme</span>
                  <Select value={String(form.remindDaysBefore)} onValueChange={(v) => setForm({ ...form, remindDaysBefore: Number(v) })}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMIND_OPTIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} día{d === 1 ? '' : 's'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>antes</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Cuenta con la que se paga (opcional)</Label>
              <Select value={form.bankAccountId || NO_ACCOUNT} onValueChange={(v) => setForm({ ...form, bankAccountId: v === NO_ACCOUNT ? '' : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>Sin cuenta predeterminada</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.referenceName} · {a.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Se propone al registrar el pago para descontarlo de esa cuenta.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="No. de servicio, contrato, referencia de pago…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="gradient" onClick={saveForm} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear gasto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pagar ── */}
      <Dialog open={!!paying} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar {paying?.name}</DialogTitle>
            <DialogDescription>Vencimiento del {paying ? fmtDay(paying.nextDueDate) : ''}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto pagado *</Label>
                <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de pago</Label>
                <DatePicker
                  value={payDate ? parseISO(payDate) : null}
                  onChange={(d) => setPayDate(d ? format(d, 'yyyy-MM-dd') : dateToDay(new Date()))}
                  maxDate={new Date()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>¿De qué cuenta salió?</Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>No registrar en Bancos (efectivo u otro)</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.referenceName} · {a.bankName} ({money(a.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {payAccountId !== NO_ACCOUNT && (
                <p className="text-[11px] text-muted-foreground">Se registra como egreso en esa cuenta y baja su saldo.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Folio, referencia…" />
            </div>
            {payNext && (
              <p className="text-sm rounded-lg bg-muted/60 px-3 py-2">
                Siguiente vencimiento: <b>{fmtDay(payNext.toISOString())}</b>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="gradient" onClick={pay} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Historial ── */}
      <Dialog open={!!historyOf} onOpenChange={(open) => !open && setHistoryOf(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagos de {historyOf?.name}</DialogTitle>
            <DialogDescription>Si te equivocaste en el último pago, deshazlo y vuelve a registrarlo.</DialogDescription>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay pagos registrados.</p>
          ) : (
            <div className="divide-y">
              {history.map((p) => (
                <div key={p.id} className={cn('py-3 flex items-center gap-3', p.status === 'CANCELLED' && 'opacity-50')}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {money(p.amount)} <span className="text-xs text-muted-foreground font-normal">· vencía {fmtDay(p.dueDate)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pagado {fmtDay(p.paidAt)} · {p.bankName ?? 'Sin registro en Bancos'}
                      {p.status === 'CANCELLED' && ' · deshecho'}
                    </p>
                  </div>
                  {p.id === latestActivePaymentId && can('gastos', 'payments') && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => undoPayment(p)}>
                      <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                      Deshacer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Eliminar ── */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto fijo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{deleting?.name}</strong> y su historial? Los egresos ya registrados en Bancos se conservan. Si solo quieres dejar de
              recibir avisos, mejor páusalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
