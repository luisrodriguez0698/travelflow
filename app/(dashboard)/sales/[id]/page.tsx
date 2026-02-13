'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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

interface Sale {
  id: string;
  totalPrice: number;
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
  departure: {
    id: string;
    departureDate: string;
    returnDate: string;
    package: {
      id: string;
      name: string;
    };
    season?: {
      id: string;
      name: string;
      color: string;
    };
  };
  payments: PaymentPlan[];
}

export default function SaleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Modal for payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentPlan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetchSale();
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

  const totalPaid = sale?.payments?.reduce((sum, p) => sum + (p.paidAmount || 0), 0) || 0;
  const remaining = (sale?.totalPrice || 0) - totalPaid;
  const progress = sale?.totalPrice ? Math.round((totalPaid / sale.totalPrice) * 100) : 0;

  const openPaymentModal = (payment: PaymentPlan) => {
    setSelectedPayment(payment);
    const pendingAmount = payment.amount - (payment.paidAmount || 0);
    setPaymentAmount(pendingAmount.toString());
    setPaymentNotes('');
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
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/sales/${id}/receipt`);
      
      if (!res.ok) {
        throw new Error('Error generating PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estado_cuenta_${sale?.client?.fullName?.replace(/\s+/g, '_') || 'cliente'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

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
              <p className="font-medium">{sale.departure?.package?.name}</p>
              {sale.departure?.season && (
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: sale.departure.season.color }}
                  title={sale.departure.season.name}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Salida</p>
                <p className="font-medium">{formatDate(sale.departure?.departureDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Regreso</p>
                <p className="font-medium">{formatDate(sale.departure?.returnDate)}</p>
              </div>
            </div>
            {sale.departure?.season && (
              <div>
                <p className="text-sm text-gray-500">Temporada</p>
                <p className="font-medium">{sale.departure.season.name}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total del Viaje</p>
          <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
            ${sale.totalPrice?.toLocaleString('es-MX')}
          </p>
        </Card>
        {sale.paymentType === 'CREDIT' && sale.downPayment > 0 && (
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
