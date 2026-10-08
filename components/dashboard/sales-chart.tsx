'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface MonthlySalesPoint {
  /** "2026-10" */
  month: string;
  /** "oct" (eje) */
  label: string;
  /** "octubre 2026" (tooltip / tabla) */
  fullLabel: string;
  sales: number;
  profit: number;
  count: number;
}

// Colores: slots 1 y 2 de la paleta categorica, validados en claro y oscuro (globals.css)
const SERIES = [
  { key: 'sales', name: 'Vendido', color: 'var(--chart-series-1)' },
  { key: 'profit', name: 'Ganancia', color: 'var(--chart-series-2)' },
] as const;

const RANGES = [6, 12] as const;

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

const compactMoney = (n: number) =>
  '$' + new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const margin = (p: MonthlySalesPoint) => (p.sales > 0 ? (p.profit / p.sales) * 100 : 0);

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as MonthlySalesPoint;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg text-xs min-w-[180px]">
      <p className="font-semibold text-sm mb-1.5 capitalize">{point.fullLabel}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
          <span className="font-semibold tabular-nums">{money(point[s.key])}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t flex justify-between text-muted-foreground">
        <span>{point.count} venta{point.count !== 1 ? 's' : ''}</span>
        <span>Margen {margin(point).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function SalesChart({ data }: { data: MonthlySalesPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(6);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const points = data.slice(-range);
  const totals = points.reduce(
    (acc, p) => ({ sales: acc.sales + p.sales, profit: acc.profit + p.profit, count: acc.count + p.count }),
    { sales: 0, profit: 0, count: 0 }
  );
  const hasData = points.some((p) => p.sales !== 0 || p.profit !== 0);
  const lastIndex = points.length - 1;

  // Etiqueta directa solo en el mes actual (no un numero en cada barra)
  const renderCurrentLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (index !== lastIndex || !value) return null;
    return (
      <text
        x={x + width / 2}
        y={value >= 0 ? y - 6 : y + 14}
        textAnchor="middle"
        className="fill-muted-foreground"
        fontSize={11}
      >
        {compactMoney(value)}
      </text>
    );
  };

  return (
    <Card className="p-5">
      {/* Header: titulo + controles en una sola fila */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Ventas por mes</h2>
          <p className="text-sm text-muted-foreground">Lo vendido y tu ganancia (precio de venta − costo neto)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Periodo">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  range === r ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {r} meses
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-label={view === 'chart' ? 'Ver como tabla' : 'Ver como gráfica'}
          >
            {view === 'chart' ? <Table2 className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {view === 'chart' ? 'Tabla' : 'Gráfica'}
          </button>
        </div>
      </div>

      {/* Leyenda con totales del periodo (el color identifica; el texto va en tinta normal) */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <div className="leading-tight">
              <p className="text-xs text-muted-foreground">{s.name}</p>
              <p className="text-base font-semibold tabular-nums">{money(totals[s.key])}</p>
            </div>
          </div>
        ))}
        <div className="leading-tight pl-5">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="text-base font-semibold tabular-nums">{totals.count}</p>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left font-medium py-2">Mes</th>
                <th className="text-right font-medium py-2">Ventas</th>
                <th className="text-right font-medium py-2">Vendido</th>
                <th className="text-right font-medium py-2">Ganancia</th>
                <th className="text-right font-medium py-2">Margen</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.month} className="border-b last:border-0">
                  <td className="py-2 capitalize">{p.fullLabel}</td>
                  <td className="py-2 text-right tabular-nums">{p.count}</td>
                  <td className="py-2 text-right tabular-nums">{money(p.sales)}</td>
                  <td className="py-2 text-right tabular-nums">{money(p.profit)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{margin(p).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hasData ? (
        <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aún no hay ventas en este periodo</p>
        </div>
      ) : (
        <div
          className="h-[260px] -ml-2"
          role="img"
          aria-label={`Ventas de los últimos ${range} meses: ${money(totals.sales)} vendidos, ${money(totals.profit)} de ganancia.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} barGap={2} barCategoryGap="28%" margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.7} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={compactMoney}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6, radius: 6 } as any}
              />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28}>
                  <LabelList dataKey={s.key} content={renderCurrentLabel} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
