'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Target,
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  Eye,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────

interface GoalWithUser {
  id: string;
  tenantId: string;
  userId: string;
  month: number;
  year: number;
  goalAmount: number;
  userName: string | null;
}

interface UserSalesStats {
  userId: string;
  userName: string;
  totalSales: number;
  salesCount: number;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface UserCardData {
  userId: string;
  userName: string;
  totalSales: number;
  salesCount: number;
  goalAmount: number;
  goalId: string | null;
  progress: number;
}

interface MonthlySale {
  id: string;
  totalPrice: number;
  netCost: number;
  saleDate: string;
  status: string;
  creatorName?: string;
  client: { fullName: string } | null;
  destination?: { name: string } | null;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

// ─── Page Component ──────────────────────────────────

export default function SalesGoalsPage() {
  const { toast } = useToast();
  const now = new Date();

  // View control
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Data
  const [goals, setGoals] = useState<GoalWithUser[]>([]);
  const [stats, setStats] = useState<UserSalesStats[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Annual data
  const [annualGoals, setAnnualGoals] = useState<GoalWithUser[]>([]);
  const [annualStats, setAnnualStats] = useState<UserSalesStats[]>([]);

  // Monthly sales list
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);

  // Edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // ─── Fetch Monthly Data ──────────────────────────

  const fetchMonthlyData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      month: String(selectedMonth),
      year: String(selectedYear),
    });

    // Date range for sales list
    const dateFrom = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const dateTo = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();
    const salesParams = new URLSearchParams({ dateFrom, dateTo });

    try {
      const [goalsRes, statsRes, usersRes, salesRes] = await Promise.all([
        fetch(`/api/sales/goals?${params}`),
        fetch(`/api/sales/stats?${params}`),
        fetch('/api/sales/goals/users'),
        fetch(`/api/sales?${salesParams}`),
      ]);

      if (goalsRes.ok) setGoals(await goalsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());
      if (salesRes.ok) setMonthlySales(await salesRes.json());
    } catch {
      toast({ title: 'Error', description: 'Error al cargar datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, toast]);

  // ─── Fetch Annual Data ───────────────────────────

  const fetchAnnualData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(selectedYear) });

    try {
      const [goalsRes, statsRes] = await Promise.all([
        fetch(`/api/sales/goals?${params}`),
        fetch(`/api/sales/stats?${params}`),
      ]);

      if (goalsRes.ok) setAnnualGoals(await goalsRes.json());
      if (statsRes.ok) setAnnualStats(await statsRes.json());
    } catch {
      toast({ title: 'Error', description: 'Error al cargar datos anuales', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, toast]);

  useEffect(() => {
    if (viewMode === 'monthly') {
      fetchMonthlyData();
    } else {
      fetchAnnualData();
    }
  }, [viewMode, fetchMonthlyData, fetchAnnualData]);

  // ─── Computed Values ─────────────────────────────

  const userCards = useMemo<UserCardData[]>(() => {
    return allUsers.map((user) => {
      const goal = goals.find((g) => g.userId === user.id);
      const stat = stats.find((s) => s.userId === user.id);
      const totalSales = stat?.totalSales ?? 0;
      const goalAmount = goal?.goalAmount ?? 0;
      const progress = goalAmount > 0 ? (totalSales / goalAmount) * 100 : 0;
      return {
        userId: user.id,
        userName: user.name || user.email || 'Usuario',
        totalSales,
        salesCount: stat?.salesCount ?? 0,
        goalAmount,
        goalId: goal?.id ?? null,
        progress,
      };
    });
  }, [allUsers, goals, stats]);

  const globalSummary = useMemo(() => {
    const totalGoal = userCards.reduce((sum, c) => sum + c.goalAmount, 0);
    const totalSales = userCards.reduce((sum, c) => sum + c.totalSales, 0);
    const progress = totalGoal > 0 ? (totalSales / totalGoal) * 100 : 0;
    return {
      totalGoal,
      totalSales,
      progress,
      usersWithGoals: userCards.filter((c) => c.goalAmount > 0).length,
    };
  }, [userCards]);

  const barChartData = useMemo(() => {
    return userCards
      .filter((c) => c.goalAmount > 0 || c.totalSales > 0)
      .map((c) => ({
        name: c.userName.split(' ')[0],
        Meta: c.goalAmount,
        Ventas: c.totalSales,
      }));
  }, [userCards]);

  // Annual chart data
  const annualChartData = useMemo(() => {
    return MONTHS.map((monthName, i) => {
      const m = i + 1;
      const monthGoals = annualGoals.filter((g) => g.month === m);
      const totalGoal = monthGoals.reduce((sum, g) => sum + g.goalAmount, 0);
      const totalSales = annualStats
        .filter((s) => s.userId !== '__unassigned__')
        .reduce((sum, s) => sum + s.totalSales, 0);
      return { name: monthName.slice(0, 3), Meta: totalGoal, Ventas: 0 };
    });
  }, [annualGoals, annualStats]);

  // For annual view, we need monthly breakdown from bookings
  // We'll fetch all bookings for the year and aggregate by month on the client
  const [annualBookings, setAnnualBookings] = useState<{ totalPrice: number; saleDate: string; createdBy: string | null }[]>([]);

  const fetchAnnualBookings = useCallback(async () => {
    try {
      const dateFrom = new Date(selectedYear, 0, 1).toISOString();
      const dateTo = new Date(selectedYear, 11, 31, 23, 59, 59, 999).toISOString();
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/sales?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAnnualBookings(data.map((b: any) => ({
          totalPrice: b.totalPrice,
          saleDate: b.saleDate,
          createdBy: b.createdBy,
        })));
      }
    } catch {
      // silent
    }
  }, [selectedYear]);

  useEffect(() => {
    if (viewMode === 'annual') {
      fetchAnnualBookings();
    }
  }, [viewMode, fetchAnnualBookings]);

  const annualLineData = useMemo(() => {
    return MONTHS.map((monthName, i) => {
      const m = i + 1;
      const monthGoals = annualGoals.filter((g) => g.month === m);
      const totalGoal = monthGoals.reduce((sum, g) => sum + g.goalAmount, 0);
      const monthSales = annualBookings
        .filter((b) => {
          const d = new Date(b.saleDate);
          return d.getMonth() + 1 === m;
        })
        .reduce((sum, b) => sum + b.totalPrice, 0);
      return { name: monthName.slice(0, 3), Meta: totalGoal, Ventas: monthSales };
    });
  }, [annualGoals, annualBookings]);

  const annualTotals = useMemo(() => {
    const totalGoal = annualGoals.reduce((sum, g) => sum + g.goalAmount, 0);
    const totalSales = annualBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const progress = totalGoal > 0 ? (totalSales / totalGoal) * 100 : 0;
    return { totalGoal, totalSales, progress };
  }, [annualGoals, annualBookings]);

  // ─── Handlers ────────────────────────────────────

  const handleSaveGoal = async (userId: string) => {
    const amount = parseFloat(editingAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sales/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          month: selectedMonth,
          year: selectedYear,
          goalAmount: amount,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Meta guardada' });
      setEditingUserId(null);
      fetchMonthlyData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la meta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────

  const years = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ventas
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Metas de Ventas
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona las metas de ventas por agente
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className={viewMode === 'monthly' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : ''}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Mensual
            </Button>
            <Button
              variant={viewMode === 'annual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('annual')}
              className={viewMode === 'annual' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : ''}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Anual
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : viewMode === 'monthly' ? (
        <MonthlyView
          userCards={userCards}
          globalSummary={globalSummary}
          barChartData={barChartData}
          monthlySales={monthlySales}
          editingUserId={editingUserId}
          editingAmount={editingAmount}
          saving={saving}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onEditStart={(userId, currentAmount) => {
            setEditingUserId(userId);
            setEditingAmount(String(currentAmount || ''));
          }}
          onEditChange={setEditingAmount}
          onSave={handleSaveGoal}
          onCancel={() => setEditingUserId(null)}
        />
      ) : (
        <AnnualView
          lineData={annualLineData}
          totals={annualTotals}
          selectedYear={selectedYear}
        />
      )}
    </div>
  );
}

// ─── Monthly View ────────────────────────────────────

function MonthlyView({
  userCards,
  globalSummary,
  barChartData,
  monthlySales,
  editingUserId,
  editingAmount,
  saving,
  selectedMonth,
  selectedYear,
  onEditStart,
  onEditChange,
  onSave,
  onCancel,
}: {
  userCards: UserCardData[];
  globalSummary: { totalGoal: number; totalSales: number; progress: number; usersWithGoals: number };
  barChartData: { name: string; Meta: number; Ventas: number }[];
  monthlySales: MonthlySale[];
  editingUserId: string | null;
  editingAmount: string;
  saving: boolean;
  selectedMonth: number;
  selectedYear: number;
  onEditStart: (userId: string, currentAmount: number) => void;
  onEditChange: (value: string) => void;
  onSave: (userId: string) => void;
  onCancel: () => void;
}) {
  const [salesPage, setSalesPage] = useState(1);
  const salesPerPage = 10;
  const totalSalesPages = Math.ceil(monthlySales.length / salesPerPage);
  const paginatedSales = monthlySales.slice(
    (salesPage - 1) * salesPerPage,
    salesPage * salesPerPage
  );
  return (
    <>
      {/* Global Summary Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                Meta de Ventas Global — {MONTHS[selectedMonth - 1]} {selectedYear}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Vendido</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(globalSummary.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Total</p>
                <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                  {formatCurrency(globalSummary.totalGoal)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso del equipo</span>
              <span
                className={`font-bold text-lg ${
                  globalSummary.progress >= 100
                    ? 'text-emerald-600'
                    : 'text-blue-600'
                }`}
              >
                {globalSummary.progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-white/50 dark:bg-gray-800/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  globalSummary.progress >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: `${Math.min(globalSummary.progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{globalSummary.usersWithGoals} agentes con meta asignada</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Per-User Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {userCards.map((card) => (
          <UserGoalCard
            key={card.userId}
            card={card}
            isEditing={editingUserId === card.userId}
            editingAmount={editingAmount}
            saving={saving}
            onEditStart={() => onEditStart(card.userId, card.goalAmount)}
            onEditChange={onEditChange}
            onSave={() => onSave(card.userId)}
            onCancel={onCancel}
          />
        ))}
      </div>

      {/* Bar Chart */}
      {barChartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Meta vs Ventas Reales por Agente
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              />
              <Legend />
              <Bar dataKey="Meta" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Monthly Sales Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            Ventas del Mes — {MONTHS[selectedMonth - 1]} {selectedYear}
          </h3>
          <span className="text-xs text-muted-foreground">
            {monthlySales.length} ventas registradas
          </span>
        </div>

        {monthlySales.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No hay ventas registradas en este mes.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-center">Agente</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Costo Neto</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.map((sale) => {
                    const folio = sale.id.slice(-8).toUpperCase();
                    const saleDate = new Date(sale.saleDate);
                    const statusColor =
                      sale.status === 'COMPLETED'
                        ? 'bg-emerald-500'
                        : sale.status === 'ACTIVE'
                        ? 'bg-blue-500'
                        : sale.status === 'CANCELLED'
                        ? 'bg-red-500'
                        : 'bg-yellow-500';
                    const statusLabel =
                      sale.status === 'COMPLETED'
                        ? 'Completada'
                        : sale.status === 'ACTIVE'
                        ? 'Activa'
                        : sale.status === 'CANCELLED'
                        ? 'Cancelada'
                        : sale.status;

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{folio}</TableCell>
                        <TableCell className="text-sm">
                          {saleDate.toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {sale.client?.fullName || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.destination?.name || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {sale.creatorName ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold cursor-default">
                                    {sale.creatorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>{sale.creatorName}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(sale.totalPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(sale.netCost)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusColor} text-white text-xs`}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={`/sales/${sale.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-700">
                              <Eye className="w-3 h-3 mr-1" />
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalSalesPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Mostrando {(salesPage - 1) * salesPerPage + 1}–
                  {Math.min(salesPage * salesPerPage, monthlySales.length)} de{' '}
                  {monthlySales.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={salesPage === 1}
                    onClick={() => setSalesPage((p) => p - 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalSalesPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === salesPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSalesPage(p)}
                      className={`h-8 w-8 p-0 ${
                        p === salesPage ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : ''
                      }`}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={salesPage === totalSalesPages}
                    onClick={() => setSalesPage((p) => p + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

// ─── User Goal Card ──────────────────────────────────

function UserGoalCard({
  card,
  isEditing,
  editingAmount,
  saving,
  onEditStart,
  onEditChange,
  onSave,
  onCancel,
}: {
  card: UserCardData;
  isEditing: boolean;
  editingAmount: string;
  saving: boolean;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const progressColor =
    card.progress >= 100
      ? 'bg-emerald-500'
      : card.progress >= 75
      ? 'bg-blue-500'
      : card.progress >= 50
      ? 'bg-yellow-500'
      : 'bg-red-400';

  const progressTextColor =
    card.progress >= 100
      ? 'text-emerald-600'
      : card.progress >= 75
      ? 'text-blue-600'
      : card.progress >= 50
      ? 'text-yellow-600'
      : 'text-red-500';

  const initials = card.userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* User header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </span>
          <span className="font-semibold text-sm">{card.userName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {card.salesCount} ventas
        </Badge>
      </div>

      {/* Sales total */}
      <div>
        <p className="text-xs text-muted-foreground">Total Vendido</p>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {formatCurrency(card.totalSales)}
        </p>
      </div>

      {/* Goal display or edit */}
      {isEditing ? (
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              value={editingAmount}
              onChange={(e) => onEditChange(e.target.value)}
              placeholder="0.00"
              className="h-9 pl-7"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
            />
          </div>
          <Button size="sm" onClick={onSave} disabled={saving} className="h-9 w-9 p-0">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-9 w-9 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Meta de Ventas</p>
            <p className="font-semibold">
              {card.goalAmount > 0 ? formatCurrency(card.goalAmount) : '— Sin meta'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditStart}
            className="text-blue-600 text-xs h-7 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            <Pencil className="w-3 h-3 mr-1" />
            {card.goalAmount > 0 ? 'Editar Meta' : 'Agregar Meta'}
          </Button>
        </div>
      )}

      {/* Progress bar */}
      {card.goalAmount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progreso</span>
            <span className={`font-semibold ${progressTextColor}`}>
              {card.progress.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(card.progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Annual View ─────────────────────────────────────

function AnnualView({
  lineData,
  totals,
  selectedYear,
}: {
  lineData: { name: string; Meta: number; Ventas: number }[];
  totals: { totalGoal: number; totalSales: number; progress: number };
  selectedYear: number;
}) {
  return (
    <>
      {/* Annual Summary */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                Resumen Anual — {selectedYear}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Vendido</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(totals.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Anual Acumulada</p>
                <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                  {formatCurrency(totals.totalGoal)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso anual</span>
              <span
                className={`font-bold text-lg ${
                  totals.progress >= 100 ? 'text-emerald-600' : 'text-blue-600'
                }`}
              >
                {totals.progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-white/50 dark:bg-gray-800/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  totals.progress >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: `${Math.min(totals.progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Line Chart: Monthly trend */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Tendencia Mensual: Meta vs Ventas — {selectedYear}
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Meta"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#94a3b8', r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Ventas"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4">Desglose Mensual</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead className="text-right">Cumplimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineData.map((row, i) => {
                const diff = row.Ventas - row.Meta;
                const pct = row.Meta > 0 ? (row.Ventas / row.Meta) * 100 : 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{MONTHS[i]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.Meta)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.Ventas)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        diff >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {diff >= 0 ? '+' : ''}
                      {formatCurrency(diff)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.Meta > 0 ? (
                        <Badge
                          variant={pct >= 100 ? 'default' : 'secondary'}
                          className={
                            pct >= 100
                              ? 'bg-emerald-500 hover:bg-emerald-600'
                              : pct >= 75
                              ? 'bg-blue-500 hover:bg-blue-600 text-white'
                              : ''
                          }
                        >
                          {pct.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
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
  );
}
