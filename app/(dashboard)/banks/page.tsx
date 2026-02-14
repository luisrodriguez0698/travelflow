'use client';

import { useState, useEffect } from 'react';
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
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  Eye,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const MEXICAN_BANKS = [
  'BBVA', 'Banorte', 'Santander', 'HSBC', 'Scotiabank', 'Citibanamex',
  'Banco Azteca', 'BanCoppel', 'Inbursa', 'Banco del Bienestar',
  'Nu', 'Hey Banco', 'Mercado Pago', 'Spin by OXXO', 'Stori', 'Albo', 'Otro',
];

const ACCOUNT_TYPES = [
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'AHORRO', label: 'Ahorro' },
];

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  referenceName: string;
  initialBalance: number;
  currentBalance: number;
  createdAt: string;
}

interface BankTransaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  reference?: string;
  date: string;
  bookingId?: string;
  destinationAccountId?: string;
  booking?: {
    client?: { fullName: string };
  };
}

interface AccountFormData {
  bankName: string;
  accountNumber: string;
  accountType: string;
  referenceName: string;
  initialBalance: string;
}

const initialAccountForm: AccountFormData = {
  bankName: '',
  accountNumber: '',
  accountType: 'DEBITO',
  referenceName: '',
  initialBalance: '0',
};

export default function BanksPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View state
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txFilter, setTxFilter] = useState('ALL');

  // Account modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormData>(initialAccountForm);
  const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null);

  // Transaction modals
  const [txModalType, setTxModalType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER' | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txReference, setTxReference] = useState('');
  const [txDestAccountId, setTxDestAccountId] = useState('');
  const [confirmTx, setConfirmTx] = useState(false);

  // Cancel transaction
  const [cancellingTx, setCancellingTx] = useState<BankTransaction | null>(null);

  // Monthly summary
  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bank-accounts?all=true');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las cuentas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (accountId: string, page = 1, filter = 'ALL') => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (filter !== 'ALL') params.set('type', filter);

      const res = await fetch(`/api/bank-accounts/${accountId}/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data);
        setTxTotal(data.pagination.total);
        if (data.account) {
          setSelectedAccount(data.account);
        }

        // Calculate monthly summary from all transactions
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let income = 0;
        let expense = 0;
        data.data.forEach((tx: BankTransaction) => {
          if (new Date(tx.date) >= monthStart && tx.status !== 'CANCELLED') {
            if (tx.type === 'INCOME') income += tx.amount;
            if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') expense += tx.amount;
          }
        });
        setMonthlySummary({ income, expense });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los movimientos', variant: 'destructive' });
    } finally {
      setTxLoading(false);
    }
  };

  const viewAccount = (account: BankAccount) => {
    setSelectedAccount(account);
    setTxPage(1);
    setTxFilter('ALL');
    fetchTransactions(account.id, 1, 'ALL');
  };

  const backToAccounts = () => {
    setSelectedAccount(null);
    setTransactions([]);
    fetchAccounts();
  };

  // Account CRUD
  const openCreateAccount = () => {
    setEditingAccount(null);
    setAccountForm(initialAccountForm);
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setAccountForm({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      referenceName: account.referenceName,
      initialBalance: account.initialBalance.toString(),
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.bankName || !accountForm.accountNumber || !accountForm.referenceName) {
      toast({ title: 'Error', description: 'Completa los campos requeridos', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const url = editingAccount ? `/api/bank-accounts/${editingAccount.id}` : '/api/bank-accounts';
      const method = editingAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...accountForm,
          initialBalance: parseFloat(accountForm.initialBalance) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }

      toast({ title: 'Éxito', description: editingAccount ? 'Cuenta actualizada' : 'Cuenta creada' });
      setIsAccountModalOpen(false);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bank-accounts/${deleteAccount.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      toast({ title: 'Éxito', description: 'Cuenta eliminada' });
      setDeleteAccount(null);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Transaction creation
  const openTxModal = (type: 'INCOME' | 'EXPENSE' | 'TRANSFER') => {
    setTxModalType(type);
    setTxAmount('');
    setTxDescription('');
    setTxReference('');
    setTxDestAccountId('');
    setConfirmTx(false);
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccount || !txModalType) return;

    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0 || !txDescription) {
      toast({ title: 'Error', description: 'Completa monto y descripción', variant: 'destructive' });
      return;
    }

    if (txModalType === 'TRANSFER' && !txDestAccountId) {
      toast({ title: 'Error', description: 'Selecciona cuenta destino', variant: 'destructive' });
      return;
    }

    if (!confirmTx) {
      setConfirmTx(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/bank-accounts/${selectedAccount.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txModalType,
          amount,
          description: txDescription,
          reference: txReference || null,
          destinationAccountId: txDestAccountId || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }

      const typeLabels = { INCOME: 'Ingreso', EXPENSE: 'Egreso', TRANSFER: 'Transferencia' };
      toast({ title: 'Éxito', description: `${typeLabels[txModalType]} registrado correctamente` });
      setTxModalType(null);
      fetchTransactions(selectedAccount.id, txPage, txFilter);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo registrar', variant: 'destructive' });
      setConfirmTx(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!cancellingTx || !selectedAccount) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bank-accounts/${selectedAccount.id}/transactions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: cancellingTx.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      toast({ title: 'Éxito', description: 'Movimiento cancelado correctamente' });
      setCancellingTx(null);
      fetchTransactions(selectedAccount.id, txPage, txFilter);
      fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo cancelar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) => format(new Date(date), "d MMM yyyy", { locale: es });
  const formatCurrency = (n: number) => `$${n.toLocaleString('es-MX')}`;

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const getTxTypeBadge = (type: string, status?: string) => {
    if (status === 'CANCELLED') return <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 line-through">Cancelado</Badge>;
    if (type === 'INCOME') return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Ingreso</Badge>;
    if (type === 'EXPENSE') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Egreso</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Transferencia</Badge>;
  };

  const getAccountTypeBadge = (type: string) => {
    const labels: Record<string, string> = { DEBITO: 'Débito', CREDITO: 'Crédito', AHORRO: 'Ahorro' };
    return <Badge variant="secondary">{labels[type] || type}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Transaction detail view
  if (selectedAccount) {
    const txTotalPages = Math.ceil(txTotal / 15);
    const otherAccounts = accounts.filter((a) => a.id !== selectedAccount.id);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={backToAccounts}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{selectedAccount.referenceName}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedAccount.bankName} - {selectedAccount.accountNumber}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Saldo Actual</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(selectedAccount.currentBalance)}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600 font-medium">Ingresos del mes</p>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
              {formatCurrency(monthlySummary.income)}
            </p>
          </Card>
          <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-600 font-medium">Egresos del mes</p>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
              {formatCurrency(monthlySummary.expense)}
            </p>
          </Card>
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-blue-600 font-medium">Balance del mes</p>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
              {formatCurrency(monthlySummary.income - monthlySummary.expense)}
            </p>
          </Card>
        </div>

        {/* Action Buttons + Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => openTxModal('INCOME')} className="bg-green-600 hover:bg-green-700">
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Nuevo Ingreso
            </Button>
            <Button onClick={() => openTxModal('EXPENSE')} variant="destructive">
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Nuevo Egreso
            </Button>
            {otherAccounts.length > 0 && (
              <Button onClick={() => openTxModal('TRANSFER')} variant="outline">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transferir
              </Button>
            )}
          </div>
          <Select
            value={txFilter}
            onValueChange={(v) => {
              setTxFilter(v);
              setTxPage(1);
              fetchTransactions(selectedAccount.id, 1, v);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="INCOME">Ingresos</SelectItem>
              <SelectItem value="EXPENSE">Egresos</SelectItem>
              <SelectItem value="TRANSFER">Transferencias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transactions Table */}
        <Card>
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : transactions.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const isCancelled = tx.status === 'CANCELLED';
                    return (
                      <TableRow key={tx.id} className={isCancelled ? 'opacity-50' : ''}>
                        <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                        <TableCell>{getTxTypeBadge(tx.type, tx.status)}</TableCell>
                        <TableCell>
                          <div>
                            <p className={isCancelled ? 'line-through' : ''}>{tx.description}</p>
                            {tx.booking?.client && (
                              <p className="text-xs text-gray-500">Cliente: {tx.booking.client.fullName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">{tx.reference || '-'}</TableCell>
                        <TableCell className={`text-right font-semibold ${isCancelled ? 'text-gray-400 line-through' : tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isCancelled && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setCancellingTx(tx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {txTotalPages > 1 && (
                <div className="flex justify-between items-center p-4 border-t">
                  <p className="text-sm text-gray-500">{txTotal} movimientos</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={txPage === 1} onClick={() => { setTxPage(txPage - 1); fetchTransactions(selectedAccount.id, txPage - 1, txFilter); }}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={txPage === txTotalPages} onClick={() => { setTxPage(txPage + 1); fetchTransactions(selectedAccount.id, txPage + 1, txFilter); }}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Landmark className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay movimientos registrados</p>
            </div>
          )}
        </Card>

        {/* Transaction Modal */}
        <Dialog open={txModalType !== null} onOpenChange={(open) => { if (!open) setTxModalType(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {txModalType === 'INCOME' && 'Nuevo Ingreso'}
                {txModalType === 'EXPENSE' && 'Nuevo Egreso'}
                {txModalType === 'TRANSFER' && 'Nueva Transferencia'}
              </DialogTitle>
              <DialogDescription>
                Cuenta: {selectedAccount.referenceName} - Saldo: {formatCurrency(selectedAccount.currentBalance)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => { setTxAmount(e.target.value); setConfirmTx(false); }}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Textarea
                  value={txDescription}
                  onChange={(e) => { setTxDescription(e.target.value); setConfirmTx(false); }}
                  placeholder={
                    txModalType === 'EXPENSE'
                      ? 'Ej: Renta de oficina, Compra de insumos...'
                      : txModalType === 'TRANSFER'
                      ? 'Ej: Transferencia para gastos...'
                      : 'Ej: Depósito, Abono de cliente...'
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Referencia (opcional)</Label>
                <Input
                  value={txReference}
                  onChange={(e) => setTxReference(e.target.value)}
                  placeholder="No. de referencia, folio, etc."
                />
              </div>

              {txModalType === 'TRANSFER' && (
                <div className="space-y-2">
                  <Label>Cuenta Destino *</Label>
                  <Select value={txDestAccountId} onValueChange={(v) => { setTxDestAccountId(v); setConfirmTx(false); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cuenta destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.referenceName} - {acc.bankName} ({formatCurrency(acc.currentBalance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {confirmTx && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                    ¿Confirmar {txModalType === 'INCOME' ? 'ingreso' : txModalType === 'EXPENSE' ? 'egreso' : 'transferencia'} de {formatCurrency(parseFloat(txAmount) || 0)}?
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTxModalType(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTransaction} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirmTx ? 'Confirmar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Transaction Confirmation */}
        <AlertDialog open={cancellingTx !== null} onOpenChange={(open) => { if (!open) setCancellingTx(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar movimiento?</AlertDialogTitle>
              <AlertDialogDescription>
                {cancellingTx && (
                  <>
                    Se cancelará el movimiento de <strong>{formatCurrency(cancellingTx.amount)}</strong> ({cancellingTx.description}).
                    <br /><br />
                    {cancellingTx.type === 'INCOME' && 'El monto se restará del saldo de la cuenta.'}
                    {cancellingTx.type === 'EXPENSE' && 'El monto se devolverá al saldo de la cuenta.'}
                    {cancellingTx.type === 'TRANSFER' && 'El monto se devolverá a esta cuenta y se restará de la cuenta destino.'}
                    {cancellingTx.bookingId && (
                      <>
                        <br /><br />
                        <strong>Este movimiento está vinculado a una venta.</strong> El abono también se revertirá en el plan de pagos.
                      </>
                    )}
                    <br /><br />
                    El movimiento quedará visible como cancelado pero no afectará los saldos.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>No, mantener</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelTransaction} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sí, cancelar movimiento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Accounts list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bancos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tus cuentas bancarias y movimientos</p>
        </div>
        <Button
          onClick={openCreateAccount}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Total Balance Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-blue-600" />
          <div>
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Saldo Total</p>
            <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </Card>

      {/* Accounts Grid */}
      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{account.referenceName}</h3>
                  <p className="text-sm text-gray-500">{account.bankName}</p>
                </div>
                {getAccountTypeBadge(account.accountType)}
              </div>
              <p className="text-sm text-gray-500 mb-1">
                {account.accountNumber}
              </p>
              <p className="text-2xl font-bold text-green-600 mb-4">
                {formatCurrency(account.currentBalance)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => viewAccount(account)}>
                  <Eye className="w-4 h-4 mr-1" />
                  Movimientos
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditAccount(account)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => setDeleteAccount(account)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Landmark className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay cuentas bancarias</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Comienza agregando tu primera cuenta bancaria
          </p>
          <Button onClick={openCreateAccount}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cuenta
          </Button>
        </Card>
      )}

      {/* Account Create/Edit Modal */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Modifica los datos de la cuenta' : 'Agrega una nueva cuenta bancaria'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de Referencia *</Label>
              <Input
                value={accountForm.referenceName}
                onChange={(e) => setAccountForm({ ...accountForm, referenceName: e.target.value })}
                placeholder="Ej: Cuenta principal, Ahorro viajes..."
              />
            </div>

            <div className="space-y-2">
              <Label>Banco *</Label>
              <Select
                value={accountForm.bankName}
                onValueChange={(v) => setAccountForm({ ...accountForm, bankName: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona banco" />
                </SelectTrigger>
                <SelectContent>
                  {MEXICAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de Cuenta *</Label>
                <Input
                  value={accountForm.accountNumber}
                  onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                  placeholder="Cuenta o CLABE"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Cuenta *</Label>
                <Select
                  value={accountForm.accountType}
                  onValueChange={(v) => setAccountForm({ ...accountForm, accountType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingAccount && (
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={accountForm.initialBalance}
                  onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccountModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAccount} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAccount ? 'Guardar Cambios' : 'Crear Cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteAccount !== null} onOpenChange={(open) => { if (!open) setDeleteAccount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la cuenta <strong>{deleteAccount?.referenceName}</strong> ({deleteAccount?.bankName}).
              Solo se puede eliminar si no tiene movimientos registrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
