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
  Hotel,
  Plane,
  MapPinned,
  Package,
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
  creatorName?: string;
  paymentFrequency?: string;
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

      {/* Booking Items / Services */}
      {quotation.items && quotation.items.length > 0 && (() => {
        const hotelItems = quotation.items!.filter(i => i.type === 'HOTEL');
        const flightItems = quotation.items!.filter(i => i.type === 'FLIGHT');
        const tourItems = quotation.items!.filter(i => i.type === 'TOUR');
        const otherItems = quotation.items!.filter(i => !['HOTEL', 'FLIGHT', 'TOUR'].includes(i.type));
        const totalItemsCost = quotation.items!.reduce((sum, i) => sum + (i.cost || 0), 0);
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
              <Badge variant="secondary">{quotation.items!.length} servicio{quotation.items!.length !== 1 ? 's' : ''}</Badge>
            </div>

            <div className="space-y-4">
              {/* Hotel Items */}
              {hotelItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Hotel className="w-4 h-4 text-blue-500" />
                    <h4 className="font-medium text-blue-700 dark:text-blue-400">Hospedaje</h4>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 dark:bg-blue-950/30">
                          <TableHead>Hotel</TableHead>
                          <TableHead>Tipo Hab.</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-center">Ocupación</TableHead>
                          <TableHead className="text-center">Noches</TableHead>
                          <TableHead className="text-right">$/Noche</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hotelItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.hotel?.name || item.description || '-'}</TableCell>
                            <TableCell>{item.roomType || '-'}</TableCell>
                            <TableCell>{item.plan ? (planLabels[item.plan] || item.plan) : '-'}</TableCell>
                            <TableCell className="text-center">
                              {item.numAdults || 0}A {(item.numChildren || 0) > 0 ? `+ ${item.numChildren}N` : ''}
                            </TableCell>
                            <TableCell className="text-center">{item.numNights || '-'}</TableCell>
                            <TableCell className="text-right">${(item.pricePerNight || 0).toLocaleString('es-MX')}</TableCell>
                            <TableCell className="text-right font-medium">${item.cost.toLocaleString('es-MX')}</TableCell>
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
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-cyan-50 dark:bg-cyan-950/30">
                          <TableHead>Dirección</TableHead>
                          <TableHead>Aerolínea</TableHead>
                          <TableHead>Vuelo</TableHead>
                          <TableHead>Ruta</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead>Clase</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
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
                            <TableCell className="text-right font-medium">${item.cost.toLocaleString('es-MX')}</TableCell>
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
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                          <TableHead>Tour</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-center">Personas</TableHead>
                          <TableHead className="text-right">$/Persona</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tourItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.tourName || item.description || '-'}</TableCell>
                            <TableCell>{item.tourDate ? formatItemDate(item.tourDate) : '-'}</TableCell>
                            <TableCell className="text-center">{item.numPeople || '-'}</TableCell>
                            <TableCell className="text-right">${(item.pricePerPerson || 0).toLocaleString('es-MX')}</TableCell>
                            <TableCell className="text-right font-medium">${item.cost.toLocaleString('es-MX')}</TableCell>
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
                    <Package className="w-4 h-4 text-gray-500" />
                    <h4 className="font-medium text-gray-700 dark:text-gray-400">Otros</h4>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-950/30">
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.description || '-'}</TableCell>
                            <TableCell className="text-right font-medium">${item.cost.toLocaleString('es-MX')}</TableCell>
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
                  <p className="text-sm text-gray-500">Costo Neto Total de Servicios</p>
                  <p className="text-xl font-bold">${totalItemsCost.toLocaleString('es-MX')}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

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
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Anticipo</p>
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
              <div className="flex items-center gap-2 flex-wrap">
                <CreditCard className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Plan de Pagos Propuesto</h3>
                <Badge variant="secondary" className="ml-2">Vista previa</Badge>
                {quotation.paymentFrequency && (
                  <Badge variant="outline" className="text-xs">
                    {quotation.paymentFrequency === 'MENSUAL' ? 'Mensual' : 'Quincenal'}
                  </Badge>
                )}
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
