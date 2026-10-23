'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  FileText,
  Plus,
  Loader2,
  Download,
  Calendar,
  User,
  MapPin,
  CreditCard,
  Truck,
  CalendarClock,
  Check,
  Hotel,
  Plane,
  MapPinned,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { generateReceiptPdf } from '@/lib/generate-receipt-pdf';
import { InitialPaymentBanner, type InitialPaymentInfo } from '@/components/initial-payment-banner';
import { MoneySummary } from '@/components/money-summary';
import { SaleCollections } from '@/components/sale-collections';
import { ClientLinkButton } from '@/components/client-link-dialog';
import { SupplierAllocation, allocationError, useSupplierDebts, type AllocationValue } from '@/components/supplier-allocation';
import { DatePicker } from '@/components/ui/date-picker';
import { PaymentMethodSelect } from '@/components/payment-method-select';
import { DEFAULT_PAYMENT_METHOD, paymentMethodLabel } from '@/lib/payment-methods';
import { HistoryButton } from '@/components/record-history';
import { useCan } from '@/hooks/use-can';
import { ItemPriceBlock, ItemPriceCells, ItemPriceHeads } from '@/components/item-price';
import { PageSkeleton } from '@/components/skeletons';

interface PaymentPlan {
  id: string;
  paymentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  paidDate?: string;
  notes?: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  referenceName: string;
  currentBalance: number;
}

interface BookingItem {
  id: string;
  type: string;
  description?: string;
  cost: number;
  sortOrder: number;
  hotelId?: string;
  hotel?: {
    id: string;
    name: string;
    stars?: number;
    diamonds?: number;
    plan?: string;
    checkIn?: string;
    checkOut?: string;
    checkInNote?: string;
    checkOutNote?: string;
    idRequirement?: string;
    includes?: string[];
    notIncludes?: string[];
    images?: string[];
  };
  roomType?: string;
  reservationNumber?: string;
  numAdults?: number;
  numChildren?: number;
  freeChildren?: number;
  pricePerNight?: number;
  numNights?: number;
  plan?: string;
  airline?: string;
  flightNumber?: string;
  origin?: string;
  flightDestination?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightClass?: string;
  direction?: string;
  tourName?: string;
  tourDate?: string;
  numPeople?: number;
  pricePerPerson?: number;
  transportType?: string;
  isInternational?: boolean;
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  returnFlightNumber?: string;
}

interface Sale {
  id: string;
  initialPayment?: InitialPaymentInfo;
  totalPrice: number;
  netCost: number;
  paymentType: string;
  downPayment: number;
  numberOfPayments: number;
  saleDate: string;
  status: string;
  notes?: string;
  client: {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
  };
  departureDate?: string;
  returnDate?: string;
  numAdults?: number;
  numChildren?: number;
  destination?: {
    id: string;
    name: string;
    season?: {
      id: string;
      name: string;
      color: string;
    };
  };
  payments: PaymentPlan[];
  tenant?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logo?: string;
    policies?: string | null;
  };
  supplierId?: string;
  supplierDeadline?: string;
  supplier?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    serviceType: string;
  };
  items?: BookingItem[];
  reservationNumber?: string;
  creatorName?: string;
  paymentFrequency?: string;
}

export default function SaleDetailPage() {
  const can = useCan();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');

  // Modal for payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPlan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  // Parte del abono que se paga en ese momento a proveedores
  const [paymentAllocations, setPaymentAllocations] = useState<AllocationValue[]>([]);
  // Segundo paso del modal: resumen antes de registrar
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const supplierDebts = useSupplierDebts(id, isPaymentModalOpen);
  const [paymentNotes, setPaymentNotes] = useState('');
  // Dia en que realmente entro el dinero (por defecto hoy)
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState<Date | undefined>(undefined);
  const [savingDeadline, setSavingDeadline] = useState(false);

  useEffect(() => {
    fetchSale();
    fetch('/api/bank-accounts?all=true')
      .then((r) => r.json())
      .then((d) => setBankAccounts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [id]);

  const fetchSale = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${id}/payments`);
      if (res.ok) {
        const data = await res.json();
        setSale(data);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la venta',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isCash = sale?.paymentType === 'CASH';
  const totalPaid = isCash
    ? (sale?.totalPrice || 0)
    : (sale?.payments?.reduce((sum, p) => sum + (p.paidAmount || 0), 0) || 0) + (sale?.downPayment || 0);
  const remaining = (sale?.totalPrice || 0) - totalPaid;
  const progress = sale?.totalPrice ? Math.round((totalPaid / sale.totalPrice) * 100) : 0;

  const openPaymentModal = (payment: PaymentPlan) => {
    setSelectedPayment(payment);
    const pendingAmount = payment.amount - (payment.paidAmount || 0);
    setPaymentAmount(pendingAmount.toString());
    setPaymentNotes('');
    setPaymentDate(new Date());
    setPaymentMethod(DEFAULT_PAYMENT_METHOD);
    setSelectedBankAccountId('');
    setPaymentAllocations([]);
    setPaymentConfirming(false);
    setIsPaymentModalOpen(true);
  };

  /** Hoy: la hora actual. Otro dia: a mediodia (evita que cambie de dia por zona horaria). */
  const paidAtValue = (d: Date) => {
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return now;
    const at = new Date(d);
    at.setHours(12, 0, 0, 0);
    return at;
  };

  const handleRegisterPayment = async () => {
    if (!selectedPayment) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Ingresa un monto válido',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedBankAccountId) {
      toast({
        title: 'Error',
        description: 'Selecciona una cuenta bancaria',
        variant: 'destructive',
      });
      return;
    }

    const allocIssue = allocationError(paymentAllocations, supplierDebts, amount);
    if (allocIssue) {
      toast({ title: 'Pago a proveedores', description: allocIssue, variant: 'destructive' });
      return;
    }

    // Validar que no exceda el saldo total pendiente
    if (amount > remaining) {
      toast({
        title: 'Error',
        description: `El monto máximo es el saldo total pendiente: $${remaining.toLocaleString('es-MX')}`,
        variant: 'destructive',
      });
      return;
    }

    if (!paymentConfirming) {
      setPaymentConfirming(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          amount,
          notes: paymentNotes,
          bankAccountId: selectedBankAccountId,
          paidAt: paidAtValue(paymentDate).toISOString(),
          paymentMethod,
          supplierAllocations: paymentAllocations,
        }),
      });

      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '');

      const data = await res.json();

      toast({
        title: 'Éxito',
        description: data.message || 'Abono registrado correctamente',
      });

      setIsPaymentModalOpen(false);
      fetchSale();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'No se pudo registrar el abono',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!sale) return;
    setGeneratingPdf(true);
    try {
      await generateReceiptPdf(sale);
      toast({
        title: 'Éxito',
        description: 'PDF descargado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSaveDeadline = async () => {
    setSavingDeadline(true);
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierDeadline: deadlineValue ? deadlineValue.toISOString() : null }),
      });
      if (res.ok) {
        toast({ title: 'Fecha limite actualizada' });
        setEditingDeadline(false);
        fetchSale();
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    } finally {
      setSavingDeadline(false);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "d 'de' MMM, yyyy", { locale: es });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      PAID: 'default',
      PENDING: 'secondary',
      OVERDUE: 'destructive',
    };
    const labels: Record<string, string> = {
      PAID: 'Pagado',
      PENDING: 'Pendiente',
      OVERDUE: 'Vencido',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <PageSkeleton variant="detail" />
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Venta no encontrada</p>
        <Link href="/sales">
          <Button className="mt-4">Volver a Ventas</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Detalle de Venta</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted-foreground">
                Folio: {sale.id.slice(-8).toUpperCase()}
              </p>
              {sale.creatorName && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-[10px] font-semibold">
                    {sale.creatorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                  Agente: {sale.creatorName}
                </span>
              )}
              <HistoryButton entity="sales" entityId={sale.id} title={`Folio ${sale.id.slice(-8).toUpperCase()}`} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientLinkButton saleId={sale.id} />
          <Button
            onClick={handleDownloadReceipt}
            disabled={generatingPdf}
            variant="gradient"
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Descargar Estado de Cuenta
          </Button>
        </div>
      </div>

      {/* Client & Trip Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Cliente</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{sale.client?.fullName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium">{sale.client?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{sale.client?.email || '-'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold">Viaje</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">{sale.destination?.name}</p>
              {sale.destination?.season && (
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: sale.destination.season.color }}
                  title={sale.destination.season.name}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Salida</p>
                <p className="font-medium">{sale.departureDate ? formatDate(sale.departureDate) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regreso</p>
                <p className="font-medium">{sale.returnDate ? formatDate(sale.returnDate) : '—'}</p>
              </div>
            </div>
            {sale.destination?.season && (
              <div>
                <p className="text-sm text-muted-foreground">Temporada</p>
                <p className="font-medium">{sale.destination.season.name}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Supplier Info */}
      {sale.supplier && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold">Proveedor</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{sale.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo de Servicio</p>
              <Badge variant="secondary">{sale.supplier.serviceType}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teléfono</p>
              <p className="font-medium">{sale.supplier.phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha Limite</p>
              {editingDeadline ? (
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={deadlineValue}
                    onChange={(date) => setDeadlineValue(date)}
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveDeadline} disabled={savingDeadline}>
                    {savingDeadline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-600" />}
                  </Button>
                </div>
              ) : (
                <p
                  className="font-medium cursor-pointer hover:text-blue-600 flex items-center gap-1"
                  onClick={() => {
                    setDeadlineValue(sale.supplierDeadline ? new Date(sale.supplierDeadline) : undefined);
                    setEditingDeadline(true);
                  }}
                >
                  <CalendarClock className="w-4 h-4" />
                  {sale.supplierDeadline ? formatDate(sale.supplierDeadline) : 'Sin fecha - click para agregar'}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Booking Items / Services */}
      {sale.items && sale.items.length > 0 && (() => {
        const hotelItems = sale.items!.filter(i => i.type === 'HOTEL');
        const flightItems = sale.items!.filter(i => i.type === 'FLIGHT');
        const tourItems = sale.items!.filter(i => i.type === 'TOUR');
        const otherItems = sale.items!.filter(i => !['HOTEL', 'FLIGHT', 'TOUR'].includes(i.type));
        const totalItemsCost = sale.items!.reduce((sum, i) => sum + (i.cost || 0), 0);
        const planLabels: Record<string, string> = { AI: 'All Inclusive', EP: 'Solo Hospedaje', MAP: 'Media Pensión', AP: 'Pensión Completa', BB: 'Bed & Breakfast' };
        const formatTime = (d?: string) => d ? format(new Date(d), "HH:mm") : '';
        const formatItemDate = (d?: string) => d ? format(new Date(d), "d MMM yyyy", { locale: es }) : '';

        return (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">Servicios del Paquete</h3>
              </div>
              <Badge variant="secondary">{sale.items!.length} servicio{sale.items!.length !== 1 ? 's' : ''}</Badge>
            </div>

            <div className="space-y-4">
              {/* Hotel Items */}
              {hotelItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Hotel className="w-4 h-4 text-blue-500" />
                    <h4 className="font-medium text-blue-700 dark:text-blue-400">Hospedaje</h4>
                  </div>
                  {/* Mobile/tablet: stacked cards */}
                  <div className="lg:hidden space-y-2">
                    {hotelItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-medium">{item.hotel?.name || item.description || '-'}</p>
                          <ItemPriceBlock item={item} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{item.roomType || '-'}</span>
                          <span>{item.plan ? (planLabels[item.plan] || item.plan) : '-'}</span>
                          <span>{item.numAdults || 0}A {(item.numChildren || 0) > 0 ? `+ ${item.numChildren}N` : ''}</span>
                          <span>{item.numNights || '-'} noches</span>
                          <span>${(item.pricePerNight || 0).toLocaleString('es-MX')}/noche</span>
                        </div>
                        {item.reservationNumber && (
                          <span className="inline-block font-mono text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                            {item.reservationNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Desktop/tablet-landscape: full table */}
                  <div className="hidden lg:block rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-blue-950/30">
                          <TableHead>Hotel</TableHead>
                          <TableHead># Reservación</TableHead>
                          <TableHead>Tipo Hab.</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-center">Ocupación</TableHead>
                          <TableHead className="text-center">Noches</TableHead>
                          <TableHead className="text-right">$/Noche</TableHead>
                          <ItemPriceHeads />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hotelItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.hotel?.name || item.description || '-'}</TableCell>
                            <TableCell>
                              {item.reservationNumber
                                ? <span className="font-mono text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">{item.reservationNumber}</span>
                                : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>{item.roomType || '-'}</TableCell>
                            <TableCell>{item.plan ? (planLabels[item.plan] || item.plan) : '-'}</TableCell>
                            <TableCell className="text-center">
                              {item.numAdults || 0}A {(item.numChildren || 0) > 0 ? `+ ${item.numChildren}N` : ''}
                            </TableCell>
                            <TableCell className="text-center">{item.numNights || '-'}</TableCell>
                            <TableCell className="text-right">${(item.pricePerNight || 0).toLocaleString('es-MX')}</TableCell>
                            <ItemPriceCells item={item} />
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Flight Items */}
              {flightItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Plane className="w-4 h-4 text-cyan-500" />
                    <h4 className="font-medium text-cyan-700 dark:text-cyan-400">Vuelos</h4>
                  </div>
                  {/* Mobile/tablet: stacked cards */}
                  <div className="lg:hidden space-y-2">
                    {flightItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-cyan-50/50 dark:bg-cyan-950/20 space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={item.direction === 'IDA' ? 'default' : 'secondary'}>
                              {item.direction === 'IDA' ? 'Ida' : 'Regreso'}
                            </Badge>
                            <p className="font-medium">{item.airline || '-'}</p>
                          </div>
                          <ItemPriceBlock item={item} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{item.origin} → {item.flightDestination}</span>
                          <span>{item.flightNumber || '-'}</span>
                          <span>
                            {item.departureTime ? formatTime(item.departureTime) : '-'}
                            {item.arrivalTime ? ` - ${formatTime(item.arrivalTime)}` : ''}
                          </span>
                          <span>{item.flightClass || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop/tablet-landscape: full table */}
                  <div className="hidden lg:block rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-cyan-50 dark:bg-cyan-950/30">
                          <TableHead>Dirección</TableHead>
                          <TableHead>Aerolínea</TableHead>
                          <TableHead>Vuelo</TableHead>
                          <TableHead>Ruta</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead>Clase</TableHead>
                          <ItemPriceHeads />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flightItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Badge variant={item.direction === 'IDA' ? 'default' : 'secondary'}>
                                {item.direction === 'IDA' ? 'Ida' : 'Regreso'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{item.airline || '-'}</TableCell>
                            <TableCell>{item.flightNumber || '-'}</TableCell>
                            <TableCell>{item.origin} → {item.flightDestination}</TableCell>
                            <TableCell>
                              {item.departureTime ? formatTime(item.departureTime) : '-'}
                              {item.arrivalTime ? ` - ${formatTime(item.arrivalTime)}` : ''}
                            </TableCell>
                            <TableCell>{item.flightClass || '-'}</TableCell>
                            <ItemPriceCells item={item} />
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Tour Items */}
              {tourItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPinned className="w-4 h-4 text-amber-500" />
                    <h4 className="font-medium text-amber-700 dark:text-amber-400">Tours</h4>
                  </div>
                  {/* Mobile/tablet: stacked cards */}
                  <div className="lg:hidden space-y-2">
                    {tourItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-medium">{item.tourName || item.description || '-'}</p>
                          <ItemPriceBlock item={item} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{item.tourDate ? formatItemDate(item.tourDate) : '-'}</span>
                          <span>{item.numPeople || '-'} personas</span>
                          <span>${(item.pricePerPerson || 0).toLocaleString('es-MX')}/persona</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop/tablet-landscape: full table */}
                  <div className="hidden lg:block rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                          <TableHead>Tour</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-center">Personas</TableHead>
                          <TableHead className="text-right">$/Persona</TableHead>
                          <ItemPriceHeads />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tourItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.tourName || item.description || '-'}</TableCell>
                            <TableCell>{item.tourDate ? formatItemDate(item.tourDate) : '-'}</TableCell>
                            <TableCell className="text-center">{item.numPeople || '-'}</TableCell>
                            <TableCell className="text-right">${(item.pricePerPerson || 0).toLocaleString('es-MX')}</TableCell>
                            <ItemPriceCells item={item} />
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Other Items */}
              {otherItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-medium text-foreground/80">Otros</h4>
                  </div>
                  {/* Mobile/tablet: stacked cards */}
                  <div className="lg:hidden space-y-2">
                    {otherItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-muted/40 flex justify-between items-start gap-2">
                        <p className="font-medium">{item.description || '-'}</p>
                        <ItemPriceBlock item={item} />
                      </div>
                    ))}
                  </div>
                  {/* Desktop/tablet-landscape: full table */}
                  <div className="hidden lg:block rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Descripción</TableHead>
                          <ItemPriceHeads />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.description || '-'}</TableCell>
                            <ItemPriceCells item={item} />
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Costo Neto Total de Servicios</p>
                  <p className="text-xl font-bold">${totalItemsCost.toLocaleString('es-MX')}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Profit Summary */}
      {sale.netCost > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-muted/50 border-border">
            <p className="text-sm text-muted-foreground font-medium">Costo Neto</p>
            <p className="text-2xl font-bold text-foreground/80 mt-1">
              ${sale.netCost?.toLocaleString('es-MX')}
            </p>
          </Card>
          <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Ganancia</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              ${(sale.totalPrice - sale.netCost).toLocaleString('es-MX')}
            </p>
          </Card>
          <Card className="p-4 bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800">
            <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">Margen</p>
            <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300 mt-1">
              {sale.netCost > 0 ? ((sale.totalPrice - sale.netCost) / sale.netCost * 100).toFixed(1) : 0}%
            </p>
          </Card>
        </div>
      )}

      {/* Anticipo / pago de contado: en que banco entro */}
      <InitialPaymentBanner saleId={sale.id} cash={isCash} info={sale.initialPayment} onRegistered={fetchSale} />

      {/* Cobros registrados: corregir cuenta/proveedor o anular en un paso */}
      <SaleCollections saleId={sale.id} clientName={sale.client?.fullName} accounts={bankAccounts} refreshKey={sale} onChanged={fetchSale} />

      {/* Financial Summary */}
      {isCash ? (
        <Card className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Total del Viaje</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                ${sale.totalPrice?.toLocaleString('es-MX')}
              </p>
            </div>
            <Badge className="bg-emerald-600 text-white text-sm px-3 py-1">
              <Check className="w-4 h-4 mr-1" />
              Pagado de Contado
            </Badge>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total del Viaje</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
                ${sale.totalPrice?.toLocaleString('es-MX')}
              </p>
            </Card>
            {sale.downPayment > 0 && (
              <Card className="p-6 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Anticipo</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                  ${sale.downPayment?.toLocaleString('es-MX')}
                </p>
              </Card>
            )}
            <Card className="p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Abonado</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                ${totalPaid.toLocaleString('es-MX')}
              </p>
            </Card>
            <Card className="p-6 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Saldo Pendiente</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                ${remaining.toLocaleString('es-MX')}
              </p>
            </Card>
          </div>

          {/* Progress Bar */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progreso de pago</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>

          {/* Payment Plan Table */}
          <Card>
            <div className="p-6 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Plan de Pagos</h3>
                {sale.paymentFrequency && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {sale.paymentFrequency === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Mobile/tablet: stacked cards */}
            <div className="lg:hidden divide-y">
              {sale.payments?.map((payment) => {
                const pending = Math.max(0, payment.amount - (payment.paidAmount || 0));
                return (
                  <div key={payment.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        #{payment.paymentNumber} · {formatDate(payment.dueDate)}
                      </span>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">Monto</span>
                      <span className="font-semibold">${payment.amount.toLocaleString('es-MX')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600 font-medium">
                        Abonado: ${(payment.paidAmount || 0).toLocaleString('es-MX')}
                      </span>
                      <span className="text-orange-600 font-medium">
                        Pendiente: ${pending.toLocaleString('es-MX')}
                      </span>
                    </div>
                    {payment.status !== 'PAID' && can('ventas', 'payments') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => openPaymentModal(payment)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Abonar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet-landscape: full table */}
            <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Fecha de Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.payments?.map((payment) => {
                  const pending = Math.max(0, payment.amount - (payment.paidAmount || 0));
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        ${payment.amount.toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        ${(payment.paidAmount || 0).toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">
                        ${pending.toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-right">
                        {payment.status !== 'PAID' && can('ventas', 'payments') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPaymentModal(payment)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Abonar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </Card>
        </>
      )}

      {/* Notes */}
      {sale.notes && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Notas</h3>
          <p className="text-muted-foreground">{sale.notes}</p>
        </Card>
      )}

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Abono</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1">
                <p>Pago #{selectedPayment?.paymentNumber} - Cuota: ${selectedPayment?.amount.toLocaleString('es-MX')}</p>
                <p className="text-orange-600 font-medium">
                  Saldo total pendiente: ${remaining.toLocaleString('es-MX')}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {paymentConfirming ? (
            <div className="py-4">
              <MoneySummary
                concept="Abono"
                clientName={sale.client?.fullName}
                amount={parseFloat(paymentAmount) || 0}
                accountName={(() => {
                  const acc = bankAccounts.find((a) => a.id === selectedBankAccountId);
                  return acc ? `${acc.referenceName} · ${acc.bankName}` : 'Cuenta seleccionada';
                })()}
                allocations={paymentAllocations.map((a) => ({
                  name: supplierDebts.find((d) => d.supplierId === a.supplierId)?.name || 'Proveedor',
                  amount: a.amount,
                }))}
                extra={[
                  `Fecha del abono: ${format(paymentDate, "d 'de' MMMM yyyy", { locale: es })} · ${paymentMethodLabel(paymentMethod)}`,
                  `Se aplica desde el pago #${selectedPayment?.paymentNumber}; si sobra, pasa a los siguientes.`,
                ]}
              />
            </div>
          ) : (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 Puedes abonar cualquier cantidad. Si el monto excede esta cuota, 
                el excedente se aplicará automáticamente a las siguientes cuotas.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cuenta Bancaria *</Label>
              <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cuenta destino" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.referenceName} - {acc.bankName} (${acc.currentBalance.toLocaleString('es-MX')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bankAccounts.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No hay cuentas bancarias disponibles. Primero da de alta una cuenta en Bancos (o pide que te compartan una).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Forma de pago *</Label>
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
            <div className="space-y-2">
              <Label>Fecha en que se recibió *</Label>
              <DatePicker
                value={paymentDate}
                onChange={(d) => d && setPaymentDate(d)}
                maxDate={new Date()}
                fromYear={new Date().getFullYear() - 2}
                toYear={new Date().getFullYear()}
              />
              <p className="text-xs text-muted-foreground">Si el cliente depositó otro día, elige esa fecha.</p>
            </div>
            <div className="space-y-2">
              <Label>Monto del Abono *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={remaining}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Ingresa el monto"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo: $1 | Máximo: ${remaining.toLocaleString('es-MX')} (para liquidar)
              </p>
            </div>
            <SupplierAllocation
              amount={parseFloat(paymentAmount) || 0}
              debts={supplierDebts}
              value={paymentAllocations}
              onChange={setPaymentAllocations}
            />
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Referencia del banco, etc."
                rows={2}
              />
            </div>
          </div>

          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => (paymentConfirming ? setPaymentConfirming(false) : setIsPaymentModalOpen(false))}
              disabled={saving}
            >
              {paymentConfirming ? 'Volver' : 'Cancelar'}
            </Button>
            <Button onClick={handleRegisterPayment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {paymentConfirming ? 'Confirmar abono' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
