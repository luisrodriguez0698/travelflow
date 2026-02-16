'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Plus, Users, Edit, Trash2, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Client {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  ine: string | null;
  passport: string | null;
  curp: string | null;
  birthDate: string | null;
  creatorName?: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function ClientsPage() {
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

  const fetchClients = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
        ...(search ? { search } : {}),
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
  }, []);

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
      phone: client.phone,
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
    if (!formData.fullName || !formData.phone) {
      toast.error('Nombre y teléfono son requeridos');
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
    if (!selectedClient || !formData.fullName || !formData.phone) {
      toast.error('Nombre y teléfono son requeridos');
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="Ej: 5512345678"
          />
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tu directorio de clientes</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            defaultValue={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">INE/Pasaporte</TableHead>
                <TableHead className="hidden lg:table-cell">CURP</TableHead>
                <TableHead className="hidden xl:table-cell">Fecha Nac.</TableHead>
                <TableHead className="text-center">Creado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.fullName}</TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.email || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.ine || client.passport || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.curp || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {client.birthDate
                        ? format(new Date(client.birthDate), 'dd/MM/yyyy', { locale: es })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {client.creatorName ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold cursor-default">
                                {client.creatorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p>{client.creatorName}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(client)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(client)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No se encontraron clientes</p>
                    {searchTerm && (
                      <Button
                        variant="link"
                        onClick={() => setSearchTerm('')}
                        className="mt-2"
                      >
                        Limpiar búsqueda
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
                        <span className="px-2 text-gray-400">...</span>
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
