'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { Badge } from '@/components/ui/badge';
import { CreatorHistoryButton } from '@/components/record-history';
import { Plus, Search, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCan } from '@/hooks/use-can';

interface Season {
  id: string;
  name: string;
  color: string;
}

interface Destination {
  id: string;
  name: string;
  description: string;
  seasonId: string | null;
  season: Season | null;
  _count: { bookings: number };
  creatorName?: string | null;
}

export default function DestinationsPage() {
  const can = useCan();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', seasonId: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const fetchData = async (pageArg?: number) => {
    try {
      const currentPage = pageArg ?? page;
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(currentPage));
      params.set('limit', String(limit));

      const [destRes, seasRes] = await Promise.all([
        fetch(`/api/destinations?${params.toString()}`),
        fetch('/api/seasons'),
      ]);
      if (destRes.ok) {
        const json = await destRes.json();
        setDestinations(json.data || json);
        if (json.pagination) setPagination(json.pagination);
      }
      if (seasRes.ok) setSeasons(await seasRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(page); }, [page, limit]);

  // Debounce search, then jump back to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchData(1);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleLimitChange = (n: number) => {
    setLimit(n);
    setPage(1);
  };

  const filtered = destinations.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', description: '', seasonId: '' });
    setIsModalOpen(true);
  };

  const openEdit = (dest: Destination) => {
    setEditing(dest);
    setFormData({
      name: dest.name,
      description: dest.description,
      seasonId: dest.seasonId || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/destinations/${editing.id}` : '/api/destinations';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          seasonId: formData.seasonId || null,
        }),
      });
      if (res.ok) {
        toast.success(editing ? 'Destino actualizado' : 'Destino creado');
        setIsModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/destinations/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Destino eliminado');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Destinos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tus destinos de viaje</p>
        </div>
        {can('destinos', 'create') && (<Button data-tour="page-action" onClick={openCreate} variant="gradient">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Destino
        </Button>)}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input data-tour="page-filters"
            placeholder="Buscar destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Card>
        {/* Mobile/tablet: stacked cards (no horizontal scroll) */}
        <div data-tour="page-list" className="lg:hidden divide-y divide-gray-200 dark:divide-gray-800">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay destinos registrados</div>
          ) : (
            filtered.map((dest) => (
              <div key={dest.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium truncate">{dest.name}</span>
                    </div>
                    {dest.description && (
                      <p className="text-sm text-muted-foreground truncate">{dest.description}</p>
                    )}
                  </div>
                  <CreatorHistoryButton entity="destinations" entityId={dest.id} creatorName={dest.creatorName} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {dest.season ? (
                      <Badge variant="outline" style={{ borderColor: dest.season.color, color: dest.season.color }}>
                        {dest.season.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin temporada</span>
                    )}
                    <span className="text-sm text-muted-foreground">{dest._count.bookings} ventas</span>
                  </div>
                  <div className="flex gap-1">
                    {can('destinos', 'edit') && (<Button variant="ghost" size="icon" onClick={() => openEdit(dest)}>
                      <Pencil className="w-4 h-4" />
                    </Button>)}
                    {can('destinos', 'delete') && (<Button variant="ghost" size="icon" onClick={() => setDeleteId(dest.id)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop/tablet-landscape: full table */}
        <div data-tour="page-list" className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destino</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Temporada</TableHead>
              <TableHead className="text-center">Ventas</TableHead>
              <TableHead className="text-center">Creado por</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay destinos registrados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dest) => (
                <TableRow key={dest.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{dest.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {dest.description || '—'}
                  </TableCell>
                  <TableCell>
                    {dest.season ? (
                      <Badge variant="outline" style={{ borderColor: dest.season.color, color: dest.season.color }}>
                        {dest.season.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{dest._count.bookings}</TableCell>
                  <TableCell className="text-center">
                    <CreatorHistoryButton entity="destinations" entityId={dest.id} creatorName={dest.creatorName} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {can('destinos', 'edit') && (<Button variant="ghost" size="icon" onClick={() => openEdit(dest)}>
                        <Pencil className="w-4 h-4" />
                      </Button>)}
                      {can('destinos', 'delete') && (<Button variant="ghost" size="icon" onClick={() => setDeleteId(dest.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        <PaginationFooter
          page={page}
          limit={limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          onLimitChange={handleLimitChange}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Destino' : 'Nuevo Destino'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre del Destino *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Cancún - Riviera Maya"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del destino..."
                rows={3}
              />
            </div>
            <div>
              <Label>Temporada (opcional)</Label>
              <Select
                value={formData.seasonId || 'none'}
                onValueChange={(v) => setFormData({ ...formData, seasonId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin temporada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin temporada</SelectItem>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Guardar Cambios' : 'Crear Destino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Destino</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">¿Estás seguro de que deseas eliminar este destino? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
