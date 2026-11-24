'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarRange, Radar, Search, Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { useLiveList } from '@/hooks/use-live-list';
import { cn } from '@/lib/utils';
import { TowerKpis } from '@/components/sales-tower/tower-kpis';
import { FlightRadar } from '@/components/sales-tower/flight-radar';
import { DeparturesBoard } from '@/components/sales-tower/departures-board';
import { PaymentTimeline } from '@/components/sales-tower/payment-timeline';
import { CollectionMode } from '@/components/sales-tower/collection-mode';
import { STATUS_META, type TowerData, type TowerStatus } from '@/components/sales-tower/types';

const STATUS_FILTERS: (TowerStatus | 'ALL')[] = ['ALL', 'OVERDUE', 'DUE_SOON', 'ON_TRACK', 'SETTLED'];

/**
 * Torre de control: las ventas a credito de un vistazo. Indicadores, radar de
 * vuelos (avance de pago), tablero de proximos cobros y linea de tiempo.
 */
export default function SalesTowerPage() {
  const [data, setData] = useState<TowerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [status, setStatus] = useState<TowerStatus | 'ALL'>('ALL');
  const [collecting, setCollecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sales/tower');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  // Un abono o una venta nueva de otro usuario actualizan la torre sola
  useLiveList('sales', load);

  const agentOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    for (const s of data?.sales ?? []) {
      const o = map.get(s.agentId) ?? { id: s.agentId, label: s.agent || 'Sin agente', count: 0 };
      o.count += 1;
      map.set(s.agentId, o);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  // Filtros comunes (busqueda y agente); el estado se aplica aparte para poder contar cada uno
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.sales ?? []).filter(
      (s) =>
        (agentIds.length === 0 || agentIds.includes(s.agentId)) &&
        (!q || `${s.client} ${s.folio}`.toLowerCase().includes(q))
    );
  }, [data, search, agentIds]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: base.length };
    for (const s of base) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [base]);

  // Atrasados primero, luego pago cercano, al corriente y liquidadas; dentro, el que menos lleva
  const sales = useMemo(
    () =>
      base
        .filter((s) => status === 'ALL' || s.status === status)
        .sort((a, b) => STATUS_META[a.status].order - STATUS_META[b.status].order || a.pct - b.pct),
    [base, status]
  );

  const upcoming = useMemo(() => {
    const ids = new Set(base.map((s) => s.id));
    return (data?.upcoming ?? []).filter((u) => ids.has(u.saleId)).slice(0, 8);
  }, [data, base]);

  if (loading) return <PageSkeleton variant="list" />;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Ventas
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Radar className="h-6 w-6 text-primary" />
              Torre de control
            </h1>
            <p className="text-muted-foreground">Tus ventas a crédito de un vistazo: quién va al corriente, quién está atrasado y qué cobros vienen.</p>
          </div>
          {data && data.sales.length > 0 && (
            <Button
              onClick={() => setCollecting(true)}
              className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20 hover:opacity-90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Modo cobranza
              {(counts.OVERDUE ?? 0) + (counts.DUE_SOON ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-white/25 px-1.5 text-xs font-bold">{(counts.OVERDUE ?? 0) + (counts.DUE_SOON ?? 0)}</span>
              )}
            </Button>
          )}
        </div>
      </div>

      {!data || data.sales.length === 0 ? (
        <Card>
          <EmptyState
            icon={Radar}
            title="Aún no hay ventas a crédito en vuelo"
            description="Cuando registres ventas a crédito, aquí verás su avance de pago, los próximos cobros y quién está atrasado."
          />
        </Card>
      ) : (
        <>
          <TowerKpis kpis={data.kpis} />

          {/* Filtros */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente o folio…" className="h-9 pl-9" />
              </div>
              <MultiSelectFilter label="Agente" icon={UserCheck} options={agentOptions} value={agentIds} onChange={setAgentIds} placeholder="Buscar agente…" />
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => {
                  const active = status === f;
                  const label = f === 'ALL' ? 'Todas' : STATUS_META[f].label;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatus(f)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                    >
                      {f !== 'ALL' && <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[f].color }} />}
                      {label}
                      <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>{counts[f] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Radar + tablero de salidas */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-4 sm:p-6 xl:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Radar className="h-4 w-4 text-primary" />
                  Radar de vuelos
                </h2>
                <p className="text-xs text-muted-foreground">Toca un avión para ver su detalle</p>
              </div>
              <FlightRadar sales={sales} />
            </Card>
            <div>
              <DeparturesBoard items={upcoming} />
            </div>
          </div>

          {/* Linea de tiempo */}
          <Card className="p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <CalendarRange className="h-4 w-4 text-primary" />
              Línea de tiempo de cobros
            </h2>
            <PaymentTimeline sales={sales} />
          </Card>
        </>
      )}

      <CollectionMode
        open={collecting}
        onOpenChange={(o) => {
          setCollecting(o);
          if (!o) load(); // por si registraron abonos mientras tanto
        }}
        sales={base}
      />
    </div>
  );
}
