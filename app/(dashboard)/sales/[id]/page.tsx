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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { generateReceiptPdf } from '@/lib/generate-receipt-pdf';
import { DatePicker } from '@/components/ui/date-picker';

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

interface Sale {
  id: string;
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
}

export default function SaleDetailPage() {
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
  const [paymentNotes, setPaymentNotes] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState<Date | undefined>(undefined);
  const [savingDeadline, setSavingDeadline] = useState(false);

  useEffect(() => {
    fetchSale();
    fetch('/api/bank-accounts?all=true')
      .then((r) => r.json())
      .then(setBankAccounts)
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
    setSelectedBankAccountId('');
    setIsPaymentModalOpen(true);
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

    // Validar que no exceda el saldo total pendiente
    if (amount > remaining) {
      toast({
        title: 'Error',
        description: `El monto máximo es el saldo total pendiente: $${remaining.toLocaleString('es-MX')}`,
        variant: 'destructive',
      });
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
        }),
      });

      if (!res.ok) throw new Error('Error');

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
        description: 'No se pudo registrar el abono',
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Venta no encontrada</p>
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
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Folio: {sale.id.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
        <Button
          onClick={handleDownloadReceipt}
          disabled={generatingPdf}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          {generatingPdf ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Descargar Estado de Cuenta
        </Button>
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
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium">{sale.client?.fullName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-medium">{sale.client?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
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
                <p className="text-sm text-gray-500">Salida</p>
                <p className="font-medium">{sale.departureDate ? formatDate(sale.departureDate) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Regreso</p>
                <p className="font-medium">{sale.returnDate ? formatDate(sale.returnDate) : '—'}</p>
              </div>
            </div>
            {sale.destination?.season && (
              <div>
                <p className="text-sm text-gray-500">Temporada</p>
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
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium">{sale.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo de Servicio</p>
              <Badge variant="secondary">{sale.supplier.serviceType}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Teléfono</p>
              <p className="font-medium">{sale.supplier.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha Limite</p>
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

      {/* Profit Summary */}
      {sale.netCost > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Costo Neto</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">
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
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Enganche</p>
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
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>

          {/* Payment Plan Table */}
          <Card>
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Plan de Pagos</h3>
              </div>
            </div>
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
                        {payment.status !== 'PAID' && (
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
          </Card>
        </>
      )}

      {/* Notes */}
      {sale.notes && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Notas</h3>
          <p className="text-gray-600 dark:text-gray-400">{sale.notes}</p>
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
              <p className="text-xs text-gray-500">
                Mínimo: $1 | Máximo: ${remaining.toLocaleString('es-MX')} (para liquidar)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Método de pago, referencia, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
