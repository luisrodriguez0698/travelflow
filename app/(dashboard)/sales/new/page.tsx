'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Plus, Pencil, Loader2, Save, ArrowLeft, Check, ChevronsUpDown,
  X, Plane,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { BookingItemsForm, BookingItemData } from '@/components/booking-items-form';
import { useToast } from '@/hooks/use-toast';
import { TemplateActions, applyTemplate, type AppliedTemplate } from '@/components/template-actions';
import { PageSkeleton } from '@/components/skeletons';
import { AgentSelect } from '@/components/agent-select';
import { PaymentPlanEditor } from '@/components/payment-plan-editor';
import { InitialPaymentAccount } from '@/components/initial-payment-account';
import { DEFAULT_PAYMENT_METHOD } from '@/lib/payment-methods';
import { MoneySummary } from '@/components/money-summary';
import { SupplierAllocation, allocationError, type AllocationValue } from '@/components/supplier-allocation';
import { planError } from '@/lib/payment-plan';
import { saleTotalFromItems } from '@/lib/booking-pricing';

interface Client { id: string; fullName: string; phone: string | null; email?: string; }
interface Season { id: string; name: string; color: string; }
interface Destination { id: string; name: string; description: string; season?: Season | null; }
interface Supplier { id: string; name: string; phone: string; serviceType: string; }
interface FormData {
  clientId: string;
  departureDate: Date | null;
  returnDate: Date | null;
  totalPrice: number;
  paymentType: 'CASH' | 'CREDIT';
  downPayment: number;
  numberOfPayments: number;
  paymentFrequency: 'QUINCENAL' | 'MENSUAL' | 'PERSONALIZADO';
  paymentStartDate: Date | null;
  notes: string;
}

const initialFormData: FormData = {
  clientId: '', departureDate: null, returnDate: null,
  totalPrice: 0, paymentType: 'CASH', downPayment: 0, numberOfPayments: 1,
  paymentFrequency: 'QUINCENAL', paymentStartDate: null, notes: '',
};

export default function NewSalePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  // Agente al que pertenece (por defecto quien la crea)
  const [sellerId, setSellerId] = useState<string | null>(null);
  // Montos del plan editados a mano (null = reparto sugerido)
  const [paymentAmounts, setPaymentAmounts] = useState<number[] | null>(null);
  // Plan personalizado: fecha pactada de cada pago
  const [paymentDates, setPaymentDates] = useState<Date[] | null>(null);
  // Cuenta donde entra el anticipo / pago de contado (obligatoria si hay dinero)
  const [bankAccountId, setBankAccountId] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [initialMethod, setInitialMethod] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [bankAccountName, setBankAccountName] = useState('');
  // Resumen de a donde va el dinero, antes de crear la venta
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [supplierAllocations, setSupplierAllocations] = useState<AllocationValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bookingItems, setBookingItems] = useState<BookingItemData[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [clientComboOpen, setClientComboOpen] = useState(false);

  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({ fullName: '', phone: '', email: '' });
  const [savingInline, setSavingInline] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients?all=true').then(r => r.ok ? r.json() : []),
      fetch('/api/destinations').then(r => r.ok ? r.json() : []),
      fetch('/api/seasons').then(r => r.ok ? r.json() : []),
      fetch('/api/suppliers?all=true').then(r => r.ok ? r.json() : []),
    ]).then(([c, d, s, sup]) => {
      setClients(c);
      setDestinations(d);
      setSeasons(s);
      setSuppliers(sup);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const netCost = bookingItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  // Con precio de venta por servicio, el total es la suma de los servicios
  const servicesTotal = saleTotalFromItems(bookingItems);
  // Lo que se le debera a cada proveedor (costo de sus servicios) para repartir el anticipo
  const formSupplierDebts = Object.values(
    bookingItems.reduce<Record<string, { supplierId: string; name: string; pending: number }>>((acc, item) => {
      const supplierId = (item as { supplierId?: string }).supplierId;
      if (!supplierId || !(item.cost > 0)) return acc;
      const name = suppliers.find((s) => s.id === supplierId)?.name || 'Proveedor';
      acc[supplierId] = { supplierId, name, pending: (acc[supplierId]?.pending || 0) + item.cost };
      return acc;
    }, {})
  );
  useEffect(() => {
    if (servicesTotal !== null) setFormData((p) => (p.totalPrice === servicesTotal ? p : { ...p, totalPrice: servicesTotal }));
  }, [servicesTotal]);

  const handleApplyTemplate = ({ items, totalPrice, notes }: AppliedTemplate) => {
    const cost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
    setBookingItems(items);
    setFormData(p => ({ ...p, totalPrice: Math.max(totalPrice, cost), notes: notes || p.notes }));
  };

  // /sales/new?template=<id> o /quotations/new?template=<id>
  useEffect(() => {
    const templateId = new URLSearchParams(window.location.search).get('template');
    if (!templateId) return;
    fetch(`/api/templates/${encodeURIComponent(templateId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(t => { if (t) handleApplyTemplate(applyTemplate(t)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const profit = formData.totalPrice - netCost;
  const profitPercent = netCost > 0 ? ((profit / netCost) * 100) : 0;

  const handleSave = async (confirmed = false) => {
    if (!formData.clientId) {
      toast({ title: 'Error', description: 'Selecciona un cliente', variant: 'destructive' });
      return;
    }
    if (formData.totalPrice <= 0) {
      toast({ title: 'Error', description: 'El precio total debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (formData.paymentType === 'CREDIT' && formData.downPayment >= formData.totalPrice) {
      toast({ title: 'Error', description: 'El anticipo debe ser menor al precio total', variant: 'destructive' });
      return;
    }
    const initialAmount = formData.paymentType === 'CASH' ? formData.totalPrice : formData.downPayment || 0;
    if (initialAmount > 0 && !bankAccountId) {
      toast({
        title: 'Falta la cuenta bancaria',
        description: `Selecciona la cuenta donde entra ${formData.paymentType === 'CASH' ? 'el pago de contado' : 'el anticipo'}`,
        variant: 'destructive',
      });
      return;
    }
    const allocIssue = allocationError(supplierAllocations, formSupplierDebts, initialAmount);
    if (allocIssue) {
      toast({ title: 'Pago a proveedores', description: allocIssue, variant: 'destructive' });
      return;
    }
    if (formData.paymentType === 'CREDIT' && paymentAmounts) {
      const planIssue = planError(paymentAmounts, formData.totalPrice - (formData.downPayment || 0));
      if (planIssue) {
        toast({ title: 'Plan de pagos', description: planIssue, variant: 'destructive' });
        return;
      }
    }
    if (initialAmount > 0 && !confirmed) {
      setConfirmOpen(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          sellerId,
          paymentAmounts: formData.paymentType === 'CREDIT' ? paymentAmounts : null,
          paymentDates:
            formData.paymentType === 'CREDIT' && formData.paymentFrequency === 'PERSONALIZADO' && paymentDates
              ? paymentDates.map((d) => d.toISOString())
              : null,
          bankAccountId: bankAccountId || null,
          supplierAllocations: bankAccountId ? supplierAllocations : [],
          initialPaymentNote: bankAccountId ? initialNote : null,
          initialPaymentMethod: bankAccountId ? initialMethod : null,
          departureDate: formData.departureDate?.toISOString() || null,
          returnDate: formData.returnDate?.toISOString() || null,
          totalPrice: formData.totalPrice,
          paymentType: formData.paymentType,
          downPayment: formData.downPayment,
          numberOfPayments: formData.numberOfPayments,
          notes: formData.notes || null,
          paymentFrequency: formData.paymentFrequency,
          paymentStartDate: formData.paymentStartDate?.toISOString() || null,
          items: bookingItems.map((item, idx) => ({
            ...item,
            sortOrder: idx,
            departureTime: item.departureTime?.toISOString() || null,
            arrivalTime: item.arrivalTime?.toISOString() || null,
            tourDate: item.tourDate instanceof Date ? item.tourDate.toISOString() : item.tourDate || null,
            supplierDeadline: item.supplierDeadline instanceof Date ? item.supplierDeadline.toISOString() : item.supplierDeadline || null,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '');
      const created = await res.json();
      toast({ title: 'Exito', description: 'Venta creada exitosamente' });
      router.push(`/sales/${created.id}`);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo crear la venta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClient = async () => {
    if (!newClient.fullName.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }
    setSavingInline(true);
    try {
      const isEdit = !!editingClientId;
      const url = isEdit ? `/api/clients/${editingClientId}` : '/api/clients';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient) });
      if (res.ok) {
        if (isEdit) {
          setClients(prev => prev.map(c => c.id === editingClientId ? { ...c, ...newClient } : c));
          toast({ title: 'Cliente actualizado' });
        } else {
          const created = await res.json();
          setClients(prev => [...prev, created]);
          setFormData(prev => ({ ...prev, clientId: created.id }));
          toast({ title: 'Cliente creado' });
        }
        setShowClientModal(false);
        setEditingClientId(null);
        setNewClient({ fullName: '', phone: '', email: '' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al guardar cliente', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Error de conexion', variant: 'destructive' }); }
    finally { setSavingInline(false); }
  };

  if (loading) {
    return (
      <PageSkeleton variant="form" />
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Nueva Venta</h1>
            <p className="text-xs text-muted-foreground">Completa la informacion y los servicios del paquete</p>
          </div>
        </div>
        <div data-tour="form-actions" className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-end gap-2 w-full sm:w-auto">
          <TemplateActions items={bookingItems} totalPrice={formData.totalPrice} notes={formData.notes} onApply={handleApplyTemplate} />
          <Button onClick={() => handleSave()} disabled={saving} variant="gradient" className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Crear Venta
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Card 1: Client, Dates */}
          <Card data-tour="form-client" className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente y Fechas</p>

            {/* Client */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                      {formData.clientId ? clients.find(c => c.id === formData.clientId)?.fullName || 'Selecciona un cliente' : 'Selecciona un cliente'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                        <CommandGroup>
                          {clients.map(c => (
                            <CommandItem key={c.id} value={`${c.fullName} ${c.phone}`} onSelect={() => { setFormData(p => ({ ...p, clientId: c.id })); setClientComboOpen(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', formData.clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.fullName} — {c.phone}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" title="Editar cliente" disabled={!formData.clientId}
                  onClick={() => { const c = clients.find(c => c.id === formData.clientId); if (c) { setEditingClientId(c.id); setNewClient({ fullName: c.fullName, phone: c.phone || '', email: c.email || '' }); setShowClientModal(true); } }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" title="Nuevo cliente"
                  onClick={() => { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); setShowClientModal(true); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <AgentSelect module="ventas" value={sellerId} onChange={setSellerId} />

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Salida</Label>
                <DatePicker
                  value={formData.departureDate || undefined}
                  maxDate={formData.returnDate || undefined}
                  onChange={(date) => setFormData(p => ({
                    ...p,
                    departureDate: date || null,
                    returnDate: date && p.returnDate && date > p.returnDate ? null : p.returnDate,
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Regreso</Label>
                <DatePicker
                  value={formData.returnDate || undefined}
                  minDate={formData.departureDate || undefined}
                  disabled={!formData.departureDate}
                  placeholder={formData.departureDate ? undefined : 'Primero selecciona salida'}
                  onChange={(date) => setFormData(p => ({ ...p, returnDate: date || null }))}
                />
              </div>
            </div>
          </Card>

          {/* Card 2: Pricing */}
          <Card data-tour="form-pricing" className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precios y Pagos</p>

            {/* Sale Price + Profit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de Venta ($) *</Label>
                <Input
                  type="number"
                  value={formData.totalPrice || ''}
                  onChange={(e) => setFormData(p => ({ ...p, totalPrice: parseFloat(e.target.value) || 0 }))}
                  onBlur={() => { if (servicesTotal === null && netCost > 0 && formData.totalPrice < netCost) setFormData(p => ({ ...p, totalPrice: netCost })); }}
                  readOnly={servicesTotal !== null}
                  className={`text-lg font-semibold ${servicesTotal !== null ? 'bg-muted/60 cursor-not-allowed' : ''}`}
                  placeholder="0"
                  min={netCost || 0}
                />
                {servicesTotal !== null ? (
                  <p className="text-xs text-muted-foreground">Suma del precio de venta de cada servicio (edítalo en cada servicio)</p>
                ) : (
                  netCost > 0 && formData.totalPrice < netCost && <p className="text-xs text-red-500">No puede ser menor al costo neto</p>
                )}
              </div>
              {netCost > 0 && formData.totalPrice > 0 && (
                <div className="space-y-2">
                  <Label>Ganancia</Label>
                  <div className={`flex items-center h-10 px-3 rounded-md border font-semibold text-lg ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
                    ${profit.toLocaleString('es-MX')}
                  </div>
                  <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>Margen: {profitPercent.toFixed(1)}%</p>
                </div>
              )}
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Tipo de Pago *</Label>
              <Select value={formData.paymentType} onValueChange={(v: 'CASH' | 'CREDIT') => setFormData(p => ({ ...p, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CASH">Contado</SelectItem><SelectItem value="CREDIT">Credito</SelectItem></SelectContent>
              </Select>
            </div>

            {/* Credit options */}
            {formData.paymentType === 'CREDIT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Anticipo</Label><Input type="number" min={0} value={formData.downPayment || ''} onChange={(e) => setFormData(p => ({ ...p, downPayment: parseFloat(e.target.value) || 0 }))} /></div>
                  <div className="space-y-2"><Label>Numero de Pagos</Label><Input type="number" min={1} max={24} value={formData.numberOfPayments} onChange={(e) => setFormData(p => ({ ...p, numberOfPayments: Math.min(24, Math.max(1, parseInt(e.target.value) || 1)) }))} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia de Pagos</Label>
                  <Select value={formData.paymentFrequency} onValueChange={(v: 'QUINCENAL' | 'MENSUAL' | 'PERSONALIZADO') => setFormData(p => ({ ...p, paymentFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="QUINCENAL">Quincenal</SelectItem><SelectItem value="MENSUAL">Mensual</SelectItem><SelectItem value="PERSONALIZADO">Personalizado (fechas libres)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de primer pago</Label>
                  <DatePicker
                    value={formData.paymentStartDate || undefined}
                    onChange={(date) => setFormData(p => ({ ...p, paymentStartDate: date || null }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.paymentFrequency === 'QUINCENAL'
                      ? 'Selecciona desde qué fecha inicia el plan quincenal (15 o fin de mes)'
                      : formData.paymentFrequency === 'PERSONALIZADO'
                        ? 'Solo sirve para sugerir fechas; en el plan de abajo eliges la fecha pactada de cada pago'
                        : 'Selecciona el mes a partir del cual inicia el plan mensual'}
                  </p>
                </div>
                {/* Plan de pagos (montos editables; sugerido por defecto) */}
                {formData.totalPrice > 0 && formData.numberOfPayments > 0 && (
                  <PaymentPlanEditor
                    remaining={formData.totalPrice - (formData.downPayment || 0)}
                    count={formData.numberOfPayments}
                    frequency={formData.paymentFrequency}
                    startDate={formData.paymentStartDate}
                    amounts={paymentAmounts}
                    onChange={setPaymentAmounts}
                    dates={paymentDates}
                    onDatesChange={setPaymentDates}
                    onCountChange={(n) => setFormData((p) => ({ ...p, numberOfPayments: n }))}
                  />
                )}
              </div>
            )}

            {/* Cuenta donde entra el anticipo o el pago de contado */}
            <InitialPaymentAccount
              amount={formData.paymentType === 'CASH' ? formData.totalPrice : formData.downPayment || 0}
              cash={formData.paymentType === 'CASH'}
              value={bankAccountId}
              onChange={setBankAccountId}
              onAccountName={setBankAccountName}
              note={initialNote}
              onNoteChange={setInitialNote}
              method={initialMethod}
              onMethodChange={setInitialMethod}
            />
            {bankAccountId && (
              <SupplierAllocation
                amount={formData.paymentType === 'CASH' ? formData.totalPrice : formData.downPayment || 0}
                debts={formSupplierDebts}
                value={supplierAllocations}
                onChange={setSupplierAllocations}
              />
            )}

          </Card>

          {/* Card 3: Notes */}
          <Card className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalles Adicionales</p>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionales..." rows={2} />
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: Services ── */}
        <div className="lg:sticky lg:top-4">
          <Card data-tour="form-services" className="overflow-hidden border-2 border-blue-100 dark:border-blue-900/50">
            <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <div className="flex items-center gap-2 mb-1">
                <Plane className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-sm">Servicios del Paquete</h2>
              </div>
              <p className="text-[11px] text-muted-foreground">Agrega hospedaje, vuelos, tours y otros servicios</p>
              {(netCost > 0 || formData.totalPrice > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {netCost > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Costo neto</p>
                      <p className="font-semibold text-sm">${netCost.toLocaleString('es-MX')}</p>
                    </div>
                  )}
                  {formData.totalPrice > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Precio venta</p>
                      <p className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">${formData.totalPrice.toLocaleString('es-MX')}</p>
                    </div>
                  )}
                  {netCost > 0 && formData.totalPrice > 0 && (
                    <div className="col-span-2 border-t pt-1.5 mt-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Ganancia</p>
                      <p className={`font-semibold text-sm ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        ${profit.toLocaleString('es-MX')} ({profitPercent.toFixed(1)}%)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 lg:max-h-[calc(100vh-340px)] lg:overflow-y-auto">
              <BookingItemsForm
                items={bookingItems}
                onChange={(newItems) => {
                  setBookingItems(newItems);
                  const cost = newItems.reduce((s, i) => s + (i.cost || 0), 0);
                  if (saleTotalFromItems(newItems) === null && cost > 0 && formData.totalPrice < cost) setFormData(p => ({ ...p, totalPrice: cost }));
                }}
                destinations={destinations}
                suppliers={suppliers}
                isSale={true}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ── Inline Client Modal ── */}
      <Dialog open={showClientModal} onOpenChange={(open) => { setShowClientModal(open); if (!open) { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClientId ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>{editingClientId ? 'Modifica los datos del cliente' : 'Crea un cliente rapidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre completo *</Label><Input value={newClient.fullName} onChange={(e) => setNewClient(p => ({ ...p, fullName: e.target.value }))} placeholder="Nombre completo" /></div>
            <div className="space-y-2"><Label>Telefono</Label><PhoneInput value={newClient.phone} onChange={(v) => setNewClient(p => ({ ...p, phone: v }))} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={newClient.email} onChange={(e) => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="Email (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={savingInline}>{savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingClientId ? 'Guardar Cambios' : 'Crear Cliente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirmacion: a donde va el dinero */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirma antes de crear la venta</DialogTitle>
            <DialogDescription>Revisa a dónde va el dinero. Después solo se corrige desde Bancos.</DialogDescription>
          </DialogHeader>
          <MoneySummary
            concept={formData.paymentType === 'CASH' ? 'Pago de contado' : 'Anticipo'}
            clientName={clients.find((c) => c.id === formData.clientId)?.fullName}
            amount={formData.paymentType === 'CASH' ? formData.totalPrice : formData.downPayment || 0}
            accountName={bankAccountName || 'Cuenta seleccionada'}
            allocations={supplierAllocations.map((a) => ({
              name: formSupplierDebts.find((d) => d.supplierId === a.supplierId)?.name || 'Proveedor',
              amount: a.amount,
            }))}
            extra={
              formData.paymentType === 'CREDIT'
                ? [`Resto a crédito: $${(formData.totalPrice - (formData.downPayment || 0)).toLocaleString('es-MX')} en ${formData.numberOfPayments} pago(s) ${formData.paymentFrequency === 'MENSUAL' ? 'mensuales' : formData.paymentFrequency === 'PERSONALIZADO' ? 'en las fechas pactadas' : 'quincenales'}.`]
                : undefined
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Revisar</Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                handleSave(true);
              }}
              disabled={saving}
            >
              Confirmar y crear venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
