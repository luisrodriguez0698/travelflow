'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Loader2,
  Download,
  User,
  MapPin,
  CreditCard,
  Truck,
  ShoppingCart,
  CalendarClock,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { generateQuotationPdf } from '@/lib/generate-quotation-pdf';

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

interface Quotation {
  id: string;
  totalPrice: number;
  netCost: number;
  paymentType: string;
  downPayment: number;
  numberOfPayments: number;
  saleDate: string;
  status: string;
  notes?: string;
  expirationDate?: string;
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
  creatorName?: string;
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuotation(data);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la cotización',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error al cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isCash = quotation?.paymentType === 'CASH';

  const handleDownloadReceipt = async () => {
    if (!quotation) return;
    setGeneratingPdf(true);
    try {
      await generateQuotationPdf(quotation);
      toast({
        title: 'PDF descargado',
        description: 'Cotización descargada correctamente',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleConvertToSale = async () => {
    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Error');
      toast({
        title: 'Convertida a venta',
        description: 'La cotización se ha convertido a venta exitosamente',
      });
      router.push('/sales');
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo convertir la cotización',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
      setShowConvertDialog(false);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "d 'de' MMM, yyyy", { locale: es });
  };

  const getExpirationBadge = () => {
    if (!quotation?.expirationDate) return null;
    const exp = new Date(quotation.expirationDate);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Vencida
        </Badge>
      );
    }
    if (diffDays <= 3) {
      return (
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
          <Clock className="w-3 h-3 mr-1" />
          Vence en {diffDays} día{diffDays !== 1 ? 's' : ''}
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
        <Clock className="w-3 h-3 mr-1" />
        Vigente hasta {formatDate(quotation.expirationDate)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cotización no encontrada</p>
        <Link href="/quotations">
          <Button className="mt-4">Volver a Cotizaciones</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/quotations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Detalle de Cotización</h1>
              {getExpirationBadge()}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-600 dark:text-gray-400">
                Folio: {quotation.id.slice(-8).toUpperCase()}
              </p>
              {quotation.creatorName && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white text-[10px] font-semibold">
                    {quotation.creatorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                  Creado por {quotation.creatorName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadReceipt}
            disabled={generatingPdf}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Descargar Cotización PDF
          </Button>
          <Button
            onClick={() => setShowConvertDialog(true)}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Convertir a Venta
          </Button>
        </div>
      </div>

      {/* Client & Trip Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold">Cliente</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium">{quotation.client?.fullName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="font-medium">{quotation.client?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{quotation.client?.email || '-'}</p>
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
              <p className="font-medium">{quotation.destination?.name}</p>
              {quotation.destination?.season && (
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: quotation.destination.season.color }}
                  title={quotation.destination.season.name}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Salida</p>
                <p className="font-medium">{quotation.departureDate ? formatDate(quotation.departureDate) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Regreso</p>
                <p className="font-medium">{quotation.returnDate ? formatDate(quotation.returnDate) : '—'}</p>
              </div>
            </div>
            {quotation.expirationDate && (
              <div>
                <p className="text-sm text-gray-500">Fecha de Expiración</p>
                <p className="font-medium flex items-center gap-1">
                  <CalendarClock className="w-4 h-4" />
                  {formatDate(quotation.expirationDate)}
                </p>
              </div>
            )}
            {quotation.destination?.season && (
              <div>
                <p className="text-sm text-gray-500">Temporada</p>
                <p className="font-medium">{quotation.destination.season.name}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Supplier Info */}
      {quotation.supplier && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold">Proveedor</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium">{quotation.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo de Servicio</p>
              <Badge variant="secondary">{quotation.supplier.serviceType}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Teléfono</p>
              <p className="font-medium">{quotation.supplier.phone}</p>
            </div>
            {quotation.supplierDeadline && (
              <div>
                <p className="text-sm text-gray-500">Fecha Limite</p>
                <p className="font-medium flex items-center gap-1">
                  <CalendarClock className="w-4 h-4" />
                  {formatDate(quotation.supplierDeadline)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Financial Summary */}
      {isCash ? (
        <Card className="p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Total del Viaje</p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                ${quotation.totalPrice?.toLocaleString('es-MX')}
              </p>
            </div>
            <Badge className="bg-amber-600 text-white text-sm px-3 py-1">
              Pago de Contado
            </Badge>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total del Viaje</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
                ${quotation.totalPrice?.toLocaleString('es-MX')}
              </p>
            </Card>
            {quotation.downPayment > 0 && (
              <Card className="p-6 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Enganche</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                  ${quotation.downPayment?.toLocaleString('es-MX')}
                </p>
              </Card>
            )}
            <Card className="p-6 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">{quotation.numberOfPayments} Pagos de</p>
              <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                ${quotation.numberOfPayments > 0
                  ? Math.floor((quotation.totalPrice - (quotation.downPayment || 0)) / quotation.numberOfPayments).toLocaleString('es-MX')
                  : 0}
              </p>
            </Card>
          </div>

          {/* Payment Plan Table - Read Only */}
          <Card>
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Plan de Pagos Propuesto</h3>
                <Badge variant="secondary" className="ml-2">Vista previa</Badge>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Fecha de Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.payments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      ${payment.amount.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Pendiente</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Notes */}
      {quotation.notes && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Notas</h3>
          <p className="text-gray-600 dark:text-gray-400">{quotation.notes}</p>
        </Card>
      )}

      {/* Convert to Sale Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Venta</DialogTitle>
            <DialogDescription>
              Esta cotización se convertirá en una venta real. El plan de pagos se regenerará con fechas a partir de hoy.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Cliente: {quotation.client?.fullName}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Destino: {quotation.destination?.name || '-'}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Total: ${quotation.totalPrice?.toLocaleString('es-MX')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConvertDialog(false)}
              disabled={converting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConvertToSale}
              disabled={converting}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              {converting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ShoppingCart className="w-4 h-4 mr-2" />
              Confirmar Conversión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
