'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface Sale {
  id: string;
  totalPrice: number;
  netCost: number;
  saleDate: string;
  status: string;
  paymentType: string;
  client: { fullName: string } | null;
  departure: {
    package: { name: string } | null;
  } | null;
  supplier: { businessName: string } | null;
}

const formatCurrency = (value: number) =>
  `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

const presets = [
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mes pasado', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 meses', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { label: 'Este año', getRange: () => ({ from: startOfYear(new Date()), to: endOfMonth(new Date()) }) },
];

export default function MarginsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch('/api/sales');
        if (res.ok) {
          const data = await res.json();
          setSales(data);
        }
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, []);

  const filteredSales = useMemo(() => {
    if (!dateRange.from) return sales;
    return sales.filter((s) => {
      const date = new Date(s.saleDate);
      const from = dateRange.from!;
      const to = dateRange.to || from;
      return date >= from && date <= new Date(to.getTime() + 86400000 - 1);
    });
  }, [sales, dateRange]);

  const metrics = useMemo(() => {
    const withCost = filteredSales.filter((s) => s.netCost > 0);
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalCost = filteredSales.reduce((sum, s) => sum + s.netCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin =
      withCost.length > 0
        ? withCost.reduce((sum, s) => {
            const margin = s.netCost > 0 ? ((s.totalPrice - s.netCost) / s.netCost) * 100 : 0;
            return sum + margin;
          }, 0) / withCost.length
        : 0;
    return { totalRevenue, totalCost, totalProfit, avgMargin, count: filteredSales.length };
  }, [filteredSales]);

  const barChartData = useMemo(() => {
    return filteredSales
      .filter((s) => s.netCost > 0)
      .map((s) => ({
        name: s.client?.fullName?.split(' ').slice(0, 2).join(' ') || 'N/A',
        'Precio Venta': s.totalPrice,
        'Costo Neto': s.netCost,
        Ganancia: s.totalPrice - s.netCost,
      }));
  }, [filteredSales]);

  const lineChartData = useMemo(() => {
    return filteredSales
      .filter((s) => s.netCost > 0)
      .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
      .map((s) => ({
        fecha: format(new Date(s.saleDate), 'dd MMM', { locale: es }),
        'Margen %': Number(((s.totalPrice - s.netCost) / s.netCost * 100).toFixed(1)),
        Ganancia: s.totalPrice - s.netCost,
      }));
  }, [filteredSales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Márgenes de Ganancia</h1>
            <p className="text-sm text-muted-foreground">Análisis de rentabilidad por venta</p>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => setDateRange(preset.getRange())}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Ventas</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(metrics.totalRevenue)}
          </p>
          <p className="text-xs text-blue-500 mt-1">{metrics.count} ventas</p>
        </Card>

        <Card className="p-4 bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Costo Neto Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {formatCurrency(metrics.totalCost)}
          </p>
        </Card>

        <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-1">
            {metrics.totalProfit >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Ganancia Total</p>
          </div>
          <p className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
            {formatCurrency(metrics.totalProfit)}
          </p>
        </Card>

        <Card className="p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Margen Promedio</p>
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {metrics.avgMargin.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Charts */}
      {barChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Revenue vs Cost */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-4">Precio de Venta vs Costo Neto</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Bar dataKey="Precio Venta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Costo Neto" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Line Chart - Margin Trend */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-4">Tendencia del Margen de Ganancia</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'Margen %' ? `${value}%` : formatCurrency(value)
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Margen %"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Detail Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Paquete</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Precio Venta</TableHead>
              <TableHead className="text-right">Costo Neto</TableHead>
              <TableHead className="text-right">Ganancia</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No hay ventas en el período seleccionado
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => {
                const profit = sale.totalPrice - sale.netCost;
                const margin = sale.netCost > 0 ? (profit / sale.netCost) * 100 : 0;
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {sale.client?.fullName || '—'}
                    </TableCell>
                    <TableCell>{sale.departure?.package?.name || '—'}</TableCell>
                    <TableCell>
                      {format(new Date(sale.saleDate), "d 'de' MMM, yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.totalPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.netCost > 0 ? formatCurrency(sale.netCost) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {sale.netCost > 0 ? formatCurrency(profit) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.netCost > 0 ? (
                        <Badge
                          variant="outline"
                          className={
                            margin >= 10
                              ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
                              : margin >= 0
                              ? 'border-yellow-300 text-yellow-700 dark:text-yellow-400'
                              : 'border-red-300 text-red-700 dark:text-red-400'
                          }
                        >
                          {margin.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sale.status === 'COMPLETED' ? 'default' : sale.status === 'CANCELLED' ? 'destructive' : 'secondary'}
                      >
                        {sale.status === 'ACTIVE' ? 'Activa' : sale.status === 'COMPLETED' ? 'Completada' : 'Cancelada'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
