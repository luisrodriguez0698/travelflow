'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Loader2 } from 'lucide-react';
import { AuditTimeline, type AuditEntry } from '@/components/record-history';
import { AUDIT_ENTITIES } from '@/lib/audit-labels';

interface UserOption { id: string; name: string | null; email: string; }

const ACTIONS = [
  { value: 'CREATE', label: 'Creaciones' },
  { value: 'UPDATE', label: 'Modificaciones' },
  { value: 'DELETE', label: 'Eliminaciones' },
];

function dayLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  const label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filters, setFilters] = useState({ entity: 'all', userId: 'all', action: 'all' });

  const load = useCallback(
    async (pageToLoad: number) => {
      const params = new URLSearchParams({ page: String(pageToLoad), limit: '40' });
      if (filters.entity !== 'all') params.set('entity', filters.entity);
      if (filters.userId !== 'all') params.set('userId', filters.userId);
      if (filters.action !== 'all') params.set('action', filters.action);
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      return data.data as AuditEntry[];
    },
    [filters]
  );

  useEffect(() => {
    setLoading(true);
    setError('');
    setPage(1);
    load(1)
      .then(setEntries)
      .catch((err) => setError(err.message || 'Error al cargar la bitácora'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    fetch('/api/users?limit=100')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setUsers(d.data || []))
      .catch(() => setUsers([]));
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const more = await load(next);
      setEntries((prev) => [...prev, ...more]);
      setPage(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Agrupar por dia
  const groups = entries.reduce<{ day: string; items: AuditEntry[] }[]>((acc, entry) => {
    const day = dayLabel(entry.createdAt);
    const last = acc[acc.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else acc.push({ day, items: [entry] });
    return acc;
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-6 h-6 text-blue-500" />
          Bitácora
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Quién creó, modificó o eliminó información en la agencia
        </p>
      </div>

      <Card data-tour="page-filters" className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={filters.entity} onValueChange={(entity) => setFilters((f) => ({ ...f, entity }))}>
            <SelectTrigger><SelectValue placeholder="Apartado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los apartados</SelectItem>
              {Object.entries(AUDIT_ENTITIES).map(([key, e]) => (
                <SelectItem key={key} value={key}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.userId} onValueChange={(userId) => setFilters((f) => ({ ...f, userId }))}>
            <SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.action} onValueChange={(action) => setFilters((f) => ({ ...f, action }))}>
            <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-red-500">{error}</Card>
      ) : entries.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin movimientos</p>
          <p className="text-sm mt-1">Prueba con otros filtros.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">{total.toLocaleString('es-MX')} movimientos</p>
          {groups.map((group) => (
            <div key={group.day}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur py-1 z-10">
                {group.day}
              </h2>
              <Card className="p-5">
                <AuditTimeline entries={group.items} showRecord />
              </Card>
            </div>
          ))}
          {page < totalPages && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cargar más
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
