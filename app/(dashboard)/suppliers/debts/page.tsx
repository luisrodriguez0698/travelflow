'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Loader2,
  Truck,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Eye,
  CreditCard,
  History,
  ChevronDown,
  ChevronUp,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────

interface SupplierSummary {
  id: string;
  name: string;
  phone: string;
  serviceType: string;
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  salesCount: number;
  overdueCount: number;
}

interface SupplierPayment {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
  status: string;
  bankAccount: {
    id: string;
    bankName: string;
    referenceName: string;
  };
}

interface SaleDebt {
  id: string;
  saleDate: string;
  departureDate: string | null;
  returnDate: string | null;
  netCost: number;
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  supplierDeadline: string | null;
  trafficLight: 'gray' | 'green' | 'yellow' | 'red';
  status: string;
  client: { fullName: string; phone: string } | null;
  destination: { name: string; season?: { name: string; color: string } | null } | null;
  payments: SupplierPayment[];
}

interface SupplierDetail {
  supplier: { id: string; name: string; phone: string; serviceType: string };
  sales: SaleDebt[];
  summary: { totalDebt: number; totalPaid: number; totalRemaining: number };
}

interface BankAccount {
  id: string;
  bankName: string;
  referenceName: string;
  currentBalance: number;
}

// ─── Helpers ─────────────────────────────────────────────

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

const SERVICE_COLORS: Record<string, string> = {
  HOTEL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  TRANSPORTE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  TOUR: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  RESTAURANTE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  OTRO: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const SERVICE_LABELS: Record<string, string> = {
  HOTEL: 'Hotel',
  TRANSPORTE: 'Transporte',
  TOUR: 'Tour',
  RESTAURANTE: 'Restaurante',
  OTRO: 'Otro',
};

const TRAFFIC_LIGHT_STYLES: Record<string, { bg: string; label: string }> = {
  green: { bg: 'bg-emerald-500', label: 'Al día' },
  yellow: { bg: 'bg-yellow-500', label: 'Por vencer' },
  red: { bg: 'bg-red-500', label: 'Vencido' },
  gray: { bg: 'bg-gray-400', label: 'Sin plazo' },
};

// ─── Component ───────────────────────────────────────────

export default function SupplierDebtsPage() {
  // Level 1 state
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [totals, setTotals] = useState({ totalDebt: 0, totalPaid: 0, totalRemaining: 0 });
  const [loading, setLoading] = useState(true);

  // Level 2 state
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Cancel payment state
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);

  // Expanded payment history
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // ─── Fetchers ────────────────────────────────────────

  const fetchSuppliersSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers/debts');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.data);
        setTotals(data.totals);
      }
    } catch {
      toast.error('Error al cargar deudas de proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSupplierDetail = useCallback(async (supplierId: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}/debts`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSupplier(data);
      }
    } catch {
      toast.error('Error al cargar detalle del proveedor');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-accounts');
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSuppliersSummary();
    fetchBankAccounts();
  }, [fetchSuppliersSummary, fetchBankAccounts]);

  // ─── Actions ─────────────────────────────────────────

  const viewSupplierDebts = (supplierId: string) => {
    setExpandedSaleId(null);
    fetchSupplierDetail(supplierId);
  };

  const backToList = () => {
    setSelectedSupplier(null);
    setExpandedSaleId(null);
    fetchSuppliersSummary();
  };

  const openPaymentModal = (sale: SaleDebt) => {
    setPaymentBookingId(sale.id);
    setPaymentAmount('');
    setPaymentBankAccountId('');
    setPaymentNotes('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setIsPaymentModalOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!selectedSupplier || !paymentBookingId || !paymentBankAccountId) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }

    const selectedBank = bankAccounts.find((b) => b.id === paymentBankAccountId);
    if (selectedBank && amount > selectedBank.currentBalance) {
      toast.error(`Saldo insuficiente. La cuenta tiene ${formatCurrency(selectedBank.currentBalance)}`);
      return;
    }

    const sale = selectedSupplier.sales.find((s) => s.id === paymentBookingId);
    if (sale && amount > sale.remaining + 0.01) {
      toast.error(`El monto excede la deuda pendiente (${formatCurrency(sale.remaining)})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.supplier.id}/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: paymentBookingId,
          bankAccountId: paymentBankAccountId,
          amount,
          notes: paymentNotes || null,
          date: paymentDate,
        }),
      });

      if (res.ok) {
        toast.success('Pago registrado exitosamente');
        setIsPaymentModalOpen(false);
        fetchSupplierDetail(selectedSupplier.supplier.id);
        fetchBankAccounts();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al registrar pago');
      }
    } catch {
      toast.error('Error al registrar pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!selectedSupplier || !cancelPaymentId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/suppliers/${selectedSupplier.supplier.id}/debts?paymentId=${cancelPaymentId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        toast.success('Pago cancelado exitosamente');
        setCancelPaymentId(null);
        fetchSupplierDetail(selectedSupplier.supplier.id);
        fetchBankAccounts();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al cancelar pago');
      }
    } catch {
      toast.error('Error al cancelar pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────

  if (loading && !selectedSupplier) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ─── Level 2: Supplier Detail ────────────────────────

  if (selectedSupplier) {
    const { supplier, sales, summary } = selectedSupplier;
    const currentSale = sales.find((s) => s.id === paymentBookingId);
    const selectedBank = bankAccounts.find((b) => b.id === paymentBankAccountId);
    const parsedAmount = parseFloat(paymentAmount) || 0;
    const exceedsBalance = !!(selectedBank && parsedAmount > 0 && parsedAmount > selectedBank.currentBalance);
    const exceedsDebt = !!(currentSale && parsedAmount > 0 && parsedAmount > currentSale.remaining + 0.01);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={backToList}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{supplier.name}</h1>
              <Badge variant="secondary" className={SERVICE_COLORS[supplier.serviceType] || SERVICE_COLORS.OTRO}>
                {SERVICE_LABELS[supplier.serviceType] || supplier.serviceType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{supplier.phone}</p>
          </div>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Deuda Total</p>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(summary.totalDebt)}
                </p>
              </Card>

              <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Pagado</p>
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </Card>

              <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Pendiente</p>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {formatCurrency(summary.totalRemaining)}
                </p>
              </Card>
            </div>

            {/* Sales Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Costo Neto</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead className="text-center">Fecha Límite</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay ventas con deuda para este proveedor
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => {
                      const tl = TRAFFIC_LIGHT_STYLES[sale.trafficLight];
                      const isExpanded = expandedSaleId === sale.id;

                      return (
                        <>
                          <TableRow key={sale.id}>
                            <TableCell className="font-mono text-xs">
                              {sale.id.slice(-8).toUpperCase()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {sale.client?.fullName || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {sale.destination?.season && (
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: sale.destination.season.color }}
                                  />
                                )}
                                {sale.destination?.name || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(sale.netCost)}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(sale.totalPaid)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${sale.remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {formatCurrency(sale.remaining)}
                            </TableCell>
                            <TableCell className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-2">
                                      <span className={`w-3 h-3 rounded-full ${tl.bg}`} />
                                      {sale.supplierDeadline && (
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(sale.supplierDeadline), 'd MMM yyyy', { locale: es })}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{tl.label}</p>
                                    {sale.supplierDeadline && sale.trafficLight === 'red' && (
                                      <p className="text-xs text-red-300">
                                        Venció el {format(new Date(sale.supplierDeadline), "d 'de' MMMM yyyy", { locale: es })}
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {sale.payments.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                                    title="Ver historial"
                                  >
                                    <History className="w-4 h-4" />
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3 ml-1" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3 ml-1" />
                                    )}
                                  </Button>
                                )}
                                {sale.remaining > 0 && (
                                  <Button
                                    size="sm"
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                                    onClick={() => openPaymentModal(sale)}
                                  >
                                    <CreditCard className="w-4 h-4 mr-1" />
                                    Abonar
                                  </Button>
                                )}
                                <Link href={`/sales/${sale.id}`}>
                                  <Button variant="outline" size="sm" title="Ver venta">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded payment history */}
                          {isExpanded && sale.payments.length > 0 && (
                            <TableRow key={`${sale.id}-history`} className="bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="px-6 py-3">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                                    Historial de Pagos ({sale.payments.length})
                                  </p>
                                  <div className="space-y-2">
                                    {sale.payments.map((payment) => (
                                      <div
                                        key={payment.id}
                                        className="flex items-center justify-between bg-background rounded-lg px-4 py-2 border"
                                      >
                                        <div className="flex items-center gap-4">
                                          <span className="text-sm font-medium">
                                            {formatCurrency(payment.amount)}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(payment.date), "d MMM yyyy", { locale: es })}
                                          </span>
                                          <Badge variant="outline" className="text-xs">
                                            {payment.bankAccount.bankName} - {payment.bankAccount.referenceName}
                                          </Badge>
                                          {payment.notes && (
                                            <span className="text-xs text-muted-foreground italic">
                                              {payment.notes}
                                            </span>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => setCancelPaymentId(payment.id)}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        )}

        {/* Payment Modal */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
              <DialogDescription>
                {currentSale && (
                  <>
                    Folio: {currentSale.id.slice(-8).toUpperCase()} — {currentSale.client?.fullName || 'N/A'}
                    <br />
                    Deuda pendiente: <span className="font-semibold text-red-600">{formatCurrency(currentSale.remaining)}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Cuenta Bancaria *</Label>
                <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.bankName} - {acc.referenceName} ({formatCurrency(acc.currentBalance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBank && (
                  <p className="text-xs text-muted-foreground">
                    Saldo disponible: <span className="font-medium">{formatCurrency(selectedBank.currentBalance)}</span>
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Monto *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className={exceedsBalance || exceedsDebt ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {currentSale && currentSale.remaining > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => setPaymentAmount(String(currentSale.remaining))}
                    >
                      Pago completo
                    </Button>
                  )}
                </div>
                {exceedsBalance && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Saldo insuficiente. La cuenta tiene {formatCurrency(selectedBank!.currentBalance)}
                  </p>
                )}
                {exceedsDebt && !exceedsBalance && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    El monto excede la deuda pendiente ({formatCurrency(currentSale!.remaining)})
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notas (opcional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Pago parcial #2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleRegisterPayment}
                disabled={isSubmitting || !paymentBankAccountId || !paymentAmount || !!exceedsBalance || !!exceedsDebt}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                ) : (
                  'Registrar Pago'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Payment Confirmation */}
        <AlertDialog open={!!cancelPaymentId} onOpenChange={(open) => !open && setCancelPaymentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar pago?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción cancelará el pago y restaurará el saldo en la cuenta bancaria.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No, mantener</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelPayment}
                className="bg-red-600 hover:bg-red-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                ) : (
                  'Sí, cancelar pago'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Level 1: Suppliers List ─────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Deudas a Proveedores</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Control de pagos pendientes a proveedores por venta
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Deuda Total</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(totals.totalDebt)}
          </p>
        </Card>

        <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Pagado</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totals.totalPaid)}
          </p>
        </Card>

        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Total Pendiente</p>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
            {formatCurrency(totals.totalRemaining)}
          </p>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tipo Servicio</TableHead>
              <TableHead className="text-center">Ventas</TableHead>
              <TableHead className="text-right">Deuda Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead className="text-center">Vencidas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay proveedores con deudas pendientes</p>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={SERVICE_COLORS[supplier.serviceType] || SERVICE_COLORS.OTRO}>
                      {SERVICE_LABELS[supplier.serviceType] || supplier.serviceType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{supplier.salesCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(supplier.totalDebt)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(supplier.totalPaid)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${supplier.totalRemaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(supplier.totalRemaining)}
                  </TableCell>
                  <TableCell className="text-center">
                    {supplier.overdueCount > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {supplier.overdueCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewSupplierDebts(supplier.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Deudas
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
