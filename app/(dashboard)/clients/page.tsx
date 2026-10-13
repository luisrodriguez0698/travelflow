'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { CreatorHistoryButton } from '@/components/record-history';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
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
import { Plus, Users, Edit, Trash2, ChevronLeft, ChevronRight, Search, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { CreatorFilter, type CreatorOption } from '@/components/creator-filter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCan } from '@/hooks/use-can';
import { PageSkeleton } from '@/components/skeletons';
import { EmptyState } from '@/components/empty-state';
import { useLiveList } from '@/hooks/use-live-list';

interface Client {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  ine: string | null;
  passport: string | null;
  curp: string | null;
  birthDate: string | null;
  creatorName?: string | null;
}

const ITEMS_PER_PAGE = 10;

type SortField = 'createdAt' | 'fullName' | 'phone' | 'email' | 'createdBy';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Más recientes primero' },
  { value: 'createdAt:asc', label: 'Más antiguos primero' },
  { value: 'fullName:asc', label: 'Nombre (A → Z)' },
  { value: 'fullName:desc', label: 'Nombre (Z → A)' },
  { value: 'phone:asc', label: 'Teléfono (ascendente)' },
  { value: 'phone:desc', label: 'Teléfono (descendente)' },
  { value: 'email:asc', label: 'Email (A → Z)' },
  { value: 'email:desc', label: 'Email (Z → A)' },
  { value: 'createdBy:asc', label: 'Creado por (A → Z)' },
  { value: 'createdBy:desc', label: 'Creado por (Z → A)' },
];

/** Encabezado de columna que ordena al dar clic (otro clic invierte el orden). */
function SortHead({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: 'asc' | 'desc' };
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground font-semibold' : ''}`}
      >
        {label}
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'opacity-40'}`} />
      </button>
    </TableHead>
  );
}

export default function ClientsPage() {
  const can = useCan();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    ine: '',
    passport: '',
    curp: '',
    birthDate: null as Date | null,
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  // Filtro "Creado por" (vacio = todos) y orden de la tabla
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });

  const fetchCreators = useCallback(() => {
    fetch('/api/clients?creators=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCreatorOptions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  const toggleSort = (field: SortField) => {
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }));
    setCurrentPage(1);
  };

  const fetchClients = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
        sort: sort.field,
        dir: sort.dir,
        ...(search ? { search } : {}),
        ...(creatorFilter.length ? { createdBy: creatorFilter.join(',') } : {}),
      });
      const res = await fetch(`/api/clients?${params}`);
      if (res.ok) {
        const result = await res.json();
        setClients(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotalClients(result.pagination.total);
      }
    } catch (error) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, [creatorFilter, sort]);

  // Tiempo real: si otro usuario cambia algo, la lista se actualiza sola
  const live = useLiveList('clients', () => { fetchClients(currentPage, searchTerm); fetchCreators(); });

  useEffect(() => {
    fetchClients(currentPage, searchTerm);
  }, [fetchClients, currentPage, searchTerm]);

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300);
    setSearchTimeout(timeout);
  };

  const paginatedClients = clients;

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      ine: '',
      passport: '',
      curp: '',
      birthDate: null,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      fullName: client.fullName,
      email: client.email || '',
      phone: client.phone || '',
      ine: client.ine || '',
      passport: client.passport || '',
      curp: client.curp || '',
      birthDate: client.birthDate ? new Date(client.birthDate) : null,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.fullName) {
      toast.error('El nombre es requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          birthDate: formData.birthDate ? formData.birthDate.toISOString() : null,
        }),
      });
      if (res.ok) {
        toast.success('Cliente creado exitosamente');
        setIsCreateModalOpen(false);
        fetchClients(currentPage, searchTerm);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al crear cliente');
      }
    } catch (error) {
      toast.error('Error al crear cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedClient || !formData.fullName) {
      toast.error('El nombre es requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          birthDate: formData.birthDate ? formData.birthDate.toISOString() : null,
        }),
      });
      if (res.ok) {
        toast.success('Cliente actualizado exitosamente');
        setIsEditModalOpen(false);
        fetchClients(currentPage, searchTerm);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al actualizar cliente');
      }
    } catch (error) {
      toast.error('Error al actualizar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Cliente eliminado exitosamente');
        setIsDeleteDialogOpen(false);
        fetchClients(currentPage, searchTerm);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar cliente');
      }
    } catch (error) {
      toast.error('Error al eliminar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form JSX - defined inline to avoid re-render issues
  const formFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nombre Completo *</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
          placeholder="Ej: Juan Pérez García"
        />
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">Teléfono</Label>
          <PhoneInput id="phone" value={formData.phone} onChange={(v) => setFormData(prev => ({ ...prev, phone: v }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="correo@ejemplo.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ine">INE</Label>
          <Input
            id="ine"
            value={formData.ine}
            onChange={(e) => setFormData(prev => ({ ...prev, ine: e.target.value }))}
            placeholder="Número de INE"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="passport">Pasaporte</Label>
          <Input
            id="passport"
            value={formData.passport}
            onChange={(e) => setFormData(prev => ({ ...prev, passport: e.target.value }))}
            placeholder="Número de pasaporte"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="curp">CURP</Label>
          <Input
            id="curp"
            value={formData.curp}
            onChange={(e) => setFormData(prev => ({ ...prev, curp: e.target.value.toUpperCase() }))}
            placeholder="CURP (18 caracteres)"
            maxLength={18}
          />
        </div>
        <div className="grid gap-2">
          <Label>Fecha de Nacimiento</Label>
          <DatePicker
            value={formData.birthDate}
            onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date || null }))}
            placeholder="Selecciona fecha"
            fromYear={1920}
            toYear={new Date().getFullYear()}
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <PageSkeleton variant="list" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gestiona tu directorio de clientes</p>
        </div>
        {can('clientes', 'create') && (<Button data-tour="page-action"
          onClick={openCreateModal}
          variant="gradient"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </Button>)}
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input data-tour="page-filters"
            type="search"
            autoComplete="off"
            placeholder="Buscar por nombre, email o teléfono..."
            defaultValue={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CreatorFilter
            options={creatorOptions}
            value={creatorFilter}
            onChange={(v) => {
              setCreatorFilter(v);
              setCurrentPage(1);
            }}
          />
          <Select
            value={`${sort.field}:${sort.dir}`}
            onValueChange={(v) => {
              const [field, dir] = v.split(':') as [SortField, 'asc' | 'desc'];
              setSort({ field, dir });
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-auto min-w-[210px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {/* Mobile/tablet: stacked cards (no horizontal scroll) */}
        <div data-tour="page-list" className="lg:hidden divide-y divide-border">
          {paginatedClients.length > 0 ? (
            paginatedClients.map((client) => (
              <div key={client.id} className={`p-4 space-y-2 ${live.isHighlighted(client.id) ? 'live-highlight' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{client.fullName}</p>
                    <p className="text-sm text-muted-foreground">{client.phone || '-'}</p>
                  </div>
                  <CreatorHistoryButton entity="clients" entityId={client.id} creatorName={client.creatorName} size="sm" />
                </div>
                {client.email && (
                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {can('clientes', 'edit') && (<Button variant="outline" size="sm" onClick={() => openEditModal(client)}>
                    <Edit className="w-4 h-4" />
                  </Button>)}
                  {can('clientes', 'delete') && (<Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openDeleteDialog(client)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>)}
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={Users} title={searchTerm || creatorFilter.length ? 'Sin resultados' : 'Aún no hay clientes'} description={searchTerm ? `No hay clientes que coincidan con "${searchTerm}".` : creatorFilter.length ? 'Ningún cliente coincide con el filtro de "Creado por".' : 'Da de alta a tus clientes para venderles, cotizarles y dar seguimiento a sus pagos.'} action={searchTerm || creatorFilter.length ? <Button variant="outline" onClick={() => { setSearchTerm(''); setCreatorFilter([]); }}>Limpiar filtros</Button> : can('clientes', 'create') ? <Button variant="gradient" onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Nuevo cliente</Button> : undefined} />
          )}
        </div>

        {/* Desktop/tablet-landscape: full table */}
        <div data-tour="page-list" className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Nombre" field="fullName" sort={sort} onSort={toggleSort} />
                <SortHead label="Teléfono" field="phone" sort={sort} onSort={toggleSort} />
                <SortHead label="Email" field="email" sort={sort} onSort={toggleSort} />
                <TableHead className="hidden xl:table-cell">INE/Pasaporte</TableHead>
                <TableHead className="hidden xl:table-cell">CURP</TableHead>
                <TableHead className="hidden xl:table-cell">Fecha Nac.</TableHead>
                <SortHead label="Creado por" field="createdBy" sort={sort} onSort={toggleSort} className="text-center" />
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <TableRow key={client.id} className={live.isHighlighted(client.id) ? 'live-highlight' : undefined}>
                    <TableCell className="font-medium">{client.fullName}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.email || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.ine || client.passport || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.curp || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {client.birthDate
                        ? format(new Date(client.birthDate), 'dd/MM/yyyy', { locale: es })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <CreatorHistoryButton entity="clients" entityId={client.id} creatorName={client.creatorName} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {can('clientes', 'edit') && (<Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(client)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>)}
                        {can('clientes', 'delete') && (<Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(client)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8}><EmptyState icon={Users} title={searchTerm || creatorFilter.length ? 'Sin resultados' : 'Aún no hay clientes'} description={searchTerm ? `No hay clientes que coincidan con "${searchTerm}".` : creatorFilter.length ? 'Ningún cliente coincide con el filtro de "Creado por".' : 'Da de alta a tus clientes para venderles, cotizarles y dar seguimiento a sus pagos.'} action={searchTerm || creatorFilter.length ? <Button variant="outline" onClick={() => { setSearchTerm(''); setCreatorFilter([]); }}>Limpiar filtros</Button> : can('clientes', 'create') ? <Button variant="gradient" onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Nuevo cliente</Button> : undefined} /></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalClients)} de{' '}
              {totalClients} clientes
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 5) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => (
                    <span key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8"
                      >
                        {page}
                      </Button>
                    </span>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo cliente. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                'Crear Cliente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Modifica los datos del cliente. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{' '}
              <span className="font-semibold">{selectedClient?.fullName}</span> y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
