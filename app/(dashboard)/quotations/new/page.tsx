'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Plus, Pencil, Loader2, Save, ArrowLeft, Check, ChevronsUpDown,
  X, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { BookingItemsForm, BookingItemData } from '@/components/booking-items-form';
import { useToast } from '@/hooks/use-toast';

interface Client { id: string; fullName: string; phone: string; email?: string; }
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
  paymentFrequency: 'QUINCENAL' | 'MENSUAL';
  paymentStartDate: Date | null;
  notes: string;
  expirationDate: Date | null;
}

const initialFormData: FormData = {
  clientId: '', departureDate: null, returnDate: null,
  totalPrice: 0, paymentType: 'CASH', downPayment: 0, numberOfPayments: 1,
  paymentFrequency: 'QUINCENAL', paymentStartDate: null, notes: '', expirationDate: null,
};

const getNextQuincenalDate = (fromDate: Date, count: number): Date => {
  const result = new Date(fromDate);
  for (let i = 0; i < count; i++) {
    const currentDay = result.getDate();
    const currentMonth = result.getMonth();
    const currentYear = result.getFullYear();
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    if (currentDay < 15) { result.setDate(15); }
    else if (currentDay < lastDayOfMonth) { result.setDate(lastDayOfMonth); }
    else { result.setMonth(currentMonth + 1); result.setDate(15); }
  }
  return result;
};

const getNextMonthlyDate = (fromDate: Date, count: number): Date => {
  const result = new Date(fromDate);
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  result.setDate(new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate());
  return result;
};

export default function NewQuotationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
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
  const profit = formData.totalPrice - netCost;
  const profitPercent = netCost > 0 ? ((profit / netCost) * 100) : 0;

  const handleSave = async () => {
    if (!formData.clientId) {
      toast({ title: 'Error', description: 'Selecciona un cliente', variant: 'destructive' });
      return;
    }
    if (formData.totalPrice <= 0) {
      toast({ title: 'Error', description: 'El precio total debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          departureDate: formData.departureDate?.toISOString() || null,
          returnDate: formData.returnDate?.toISOString() || null,
          totalPrice: formData.totalPrice,
          paymentType: formData.paymentType,
          downPayment: formData.downPayment,
          numberOfPayments: formData.numberOfPayments,
          notes: formData.notes || null,
          expirationDate: formData.expirationDate ? formData.expirationDate.toISOString() : null,
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
      if (!res.ok) throw new Error();
      const created = await res.json();
      toast({ title: 'Exito', description: 'Cotizacion creada exitosamente' });
      router.push(`/quotations/${created.id}`);
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la cotizacion', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClient = async () => {
    if (!newClient.fullName.trim() || !newClient.phone.trim()) {
      toast({ title: 'Error', description: 'Nombre y telefono son requeridos', variant: 'destructive' });
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quotations">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Nueva Cotizacion</h1>
            <p className="text-xs text-muted-foreground">Completa la informacion y los servicios del paquete</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Crear Cotizacion
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Card 1: Client, Dates */}
          <Card className="p-5 space-y-4">
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
                  onClick={() => { const c = clients.find(c => c.id === formData.clientId); if (c) { setEditingClientId(c.id); setNewClient({ fullName: c.fullName, phone: c.phone, email: c.email || '' }); setShowClientModal(true); } }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" title="Nuevo cliente"
                  onClick={() => { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); setShowClientModal(true); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Salida</Label>
                <DatePicker value={formData.departureDate || undefined} onChange={(date) => setFormData(p => ({ ...p, departureDate: date || null }))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Regreso</Label>
                <DatePicker value={formData.returnDate || undefined} onChange={(date) => setFormData(p => ({ ...p, returnDate: date || null }))} />
              </div>
            </div>
          </Card>

          {/* Card 2: Pricing */}
          <Card className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precios y Pagos</p>

            {/* Sale Price + Profit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de Venta ($) *</Label>
                <Input
                  type="number"
                  value={formData.totalPrice || ''}
                  onChange={(e) => setFormData(p => ({ ...p, totalPrice: parseFloat(e.target.value) || 0 }))}
                  onBlur={() => { if (netCost > 0 && formData.totalPrice < netCost) setFormData(p => ({ ...p, totalPrice: netCost })); }}
                  className="text-lg font-semibold"
                  placeholder="0"
                  min={netCost || 0}
                />
                {netCost > 0 && formData.totalPrice < netCost && <p className="text-xs text-red-500">No puede ser menor al costo neto</p>}
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
                  <Select value={formData.paymentFrequency} onValueChange={(v: 'QUINCENAL' | 'MENSUAL') => setFormData(p => ({ ...p, paymentFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="QUINCENAL">Quincenal</SelectItem><SelectItem value="MENSUAL">Mensual</SelectItem></SelectContent>
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
                      : 'Selecciona el mes a partir del cual inicia el plan mensual'}
                  </p>
                </div>
                {/* Live payment preview */}
                {formData.totalPrice > 0 && formData.numberOfPayments > 0 && (() => {
                  const startDate = formData.paymentStartDate || new Date();
                  const remaining = formData.totalPrice - (formData.downPayment || 0);
                  const paymentAmount = Math.floor(remaining / formData.numberOfPayments);
                  const lastPayment = remaining - (paymentAmount * (formData.numberOfPayments - 1));
                  const payments = Array.from({ length: formData.numberOfPayments }, (_, i) => ({
                    number: i + 1,
                    dueDate: formData.paymentFrequency === 'MENSUAL'
                      ? getNextMonthlyDate(startDate, i)
                      : getNextQuincenalDate(startDate, i + 1),
                    amount: i === formData.numberOfPayments - 1 ? lastPayment : paymentAmount,
                  }));
                  return (
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vista previa del plan de pagos</span>
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {formData.paymentFrequency === 'QUINCENAL' ? 'Quincenal' : 'Mensual'}
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-muted/30">
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-1.5 font-medium">#</th>
                              <th className="text-left px-3 py-1.5 font-medium">Fecha</th>
                              <th className="text-right px-3 py-1.5 font-medium">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p) => (
                              <tr key={p.number} className="border-t border-border/50">
                                <td className="px-3 py-1.5 text-muted-foreground">{p.number}</td>
                                <td className="px-3 py-1.5 font-medium">
                                  {p.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-3 py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                  ${p.amount.toLocaleString('es-MX')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </Card>

          {/* Card 3: Notes, Expiration */}
          <Card className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalles Adicionales</p>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionales..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Fecha de Expiracion</Label>
              <DatePicker value={formData.expirationDate || undefined} onChange={(date) => setFormData(p => ({ ...p, expirationDate: date || null }))} />
              <p className="text-xs text-muted-foreground">Fecha hasta la cual esta cotizacion es valida</p>
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: Services ── */}
        <div className="lg:sticky lg:top-4">
          <Card className="overflow-hidden border-2 border-amber-100 dark:border-amber-900/50">
            <div className="p-4 border-b bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-amber-500" />
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
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Precio cotizado</p>
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
                  if (cost > 0 && formData.totalPrice < cost) setFormData(p => ({ ...p, totalPrice: cost }));
                }}
                destinations={destinations}
                suppliers={suppliers}
                isSale={false}
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
            <div className="space-y-2"><Label>Telefono *</Label><Input value={newClient.phone} onChange={(e) => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="Telefono" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={newClient.email} onChange={(e) => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="Email (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={savingInline}>{savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingClientId ? 'Guardar Cambios' : 'Crear Cliente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
