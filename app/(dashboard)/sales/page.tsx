'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, Search, Pencil, Trash2, ShoppingCart, Loader2, Eye, TrendingUp, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Client {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
}

interface Season {
  id: string;
  name: string;
  color: string;
}

interface Destination {
  id: string;
  name: string;
  description: string;
  season?: Season | null;
}

interface Supplier {
  id: string;
  name: string;
  serviceType: string;
}

interface Sale {
  id: string;
  clientId: string;
  destinationId?: string;
  totalPrice: number;
  netCost: number;
  paymentType: string;
  downPayment: number;
  numberOfPayments: number;
  saleDate: string;
  status: string;
  notes?: string;
  departureDate?: string;
  returnDate?: string;
  priceAdult: number;
  priceChild: number;
  numAdults: number;
  numChildren: number;
  supplierId?: string;
  supplierDeadline?: string;
  client: Client;
  destination?: Destination;
  supplier?: Supplier;
}

interface FormData {
  clientId: string;
  destinationId: string;
  departureDate: Date | null;
  returnDate: Date | null;
  priceAdult: number;
  priceChild: number;
  numAdults: number;
  numChildren: number;
  totalPrice: number;
  paymentType: 'CASH' | 'CREDIT';
  downPayment: number;
  numberOfPayments: number;
  notes: string;
  supplierId: string;
  supplierDeadline: Date | null;
}

const initialFormData: FormData = {
  clientId: '',
  destinationId: '',
  departureDate: null,
  returnDate: null,
  priceAdult: 0,
  priceChild: 0,
  numAdults: 1,
  numChildren: 0,
  totalPrice: 0,
  paymentType: 'CASH',
  downPayment: 0,
  numberOfPayments: 1,
  notes: '',
  supplierId: '',
  supplierDeadline: null,
};

export default function SalesPage() {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Main modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Inline creation/edit modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({ fullName: '', phone: '', email: '' });
  const [newDestination, setNewDestination] = useState({ name: '', description: '', seasonId: '' });
  const [savingInline, setSavingInline] = useState(false);

  // Combobox open states
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [destinationComboOpen, setDestinationComboOpen] = useState(false);

  // Search and pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, clientsRes, destRes, seasonsRes, suppRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/clients?all=true'),
        fetch('/api/destinations'),
        fetch('/api/seasons'),
        fetch('/api/suppliers?all=true'),
      ]);
      if (salesRes.ok) setSales(await salesRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (destRes.ok) setDestinations(await destRes.json());
      if (seasonsRes.ok) setSeasons(await seasonsRes.json());
      if (suppRes.ok) setSuppliers(await suppRes.json());
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    if (!search.trim()) return sales;
    const s = search.toLowerCase();
    return sales.filter(
      (sale) =>
        sale.client?.fullName?.toLowerCase().includes(s) ||
        sale.destination?.name?.toLowerCase().includes(s)
    );
  }, [sales, search]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Auto-calculate total price
  const recalcTotal = (data: Partial<FormData>) => {
    const d = { ...formData, ...data };
    const total = (d.priceAdult * d.numAdults) + (d.priceChild * d.numChildren);
    return { ...d, totalPrice: total };
  };

  const openCreateModal = () => {
    setEditingSale(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setFormData({
      clientId: sale.clientId,
      destinationId: sale.destinationId || '',
      departureDate: sale.departureDate ? new Date(sale.departureDate) : null,
      returnDate: sale.returnDate ? new Date(sale.returnDate) : null,
      priceAdult: sale.priceAdult || 0,
      priceChild: sale.priceChild || 0,
      numAdults: sale.numAdults || 1,
      numChildren: sale.numChildren || 0,
      totalPrice: sale.totalPrice,
      paymentType: sale.paymentType as 'CASH' | 'CREDIT',
      downPayment: sale.downPayment,
      numberOfPayments: sale.numberOfPayments,
      notes: sale.notes || '',
      supplierId: sale.supplierId || '',
      supplierDeadline: sale.supplierDeadline ? new Date(sale.supplierDeadline) : null,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.clientId || !formData.destinationId) {
      toast({ title: 'Error', description: 'Selecciona un cliente y un destino', variant: 'destructive' });
      return;
    }
    if (formData.totalPrice <= 0) {
      toast({ title: 'Error', description: 'El precio total debe ser mayor a 0', variant: 'destructive' });
      return;
    }
    if (formData.paymentType === 'CREDIT' && formData.downPayment >= formData.totalPrice) {
      toast({ title: 'Error', description: 'El enganche debe ser menor al precio total', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const url = editingSale ? `/api/sales/${editingSale.id}` : '/api/sales';
      const method = editingSale ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId,
          destinationId: formData.destinationId,
          departureDate: formData.departureDate?.toISOString() || null,
          returnDate: formData.returnDate?.toISOString() || null,
          priceAdult: formData.priceAdult,
          priceChild: formData.priceChild,
          numAdults: formData.numAdults,
          numChildren: formData.numChildren,
          totalPrice: formData.totalPrice,
          paymentType: formData.paymentType,
          downPayment: formData.downPayment,
          numberOfPayments: formData.numberOfPayments,
          notes: formData.notes || null,
          supplierId: formData.supplierId || null,
          supplierDeadline: formData.supplierDeadline ? formData.supplierDeadline.toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error('Error saving');
      toast({ title: 'Éxito', description: editingSale ? 'Venta actualizada' : 'Venta creada' });
      setIsModalOpen(false);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la venta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSale) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${deletingSale.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting');
      toast({ title: 'Éxito', description: 'Venta eliminada' });
      setIsDeleteModalOpen(false);
      setDeletingSale(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar la venta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Inline client creation/edit
  const handleSaveClient = async () => {
    if (!newClient.fullName.trim() || !newClient.phone.trim()) {
      toast({ title: 'Error', description: 'Nombre y teléfono son requeridos', variant: 'destructive' });
      return;
    }
    setSavingInline(true);
    try {
      const isEdit = !!editingClientId;
      const url = isEdit ? `/api/clients/${editingClientId}` : '/api/clients';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        if (isEdit) {
          setClients((prev) => prev.map((c) => c.id === editingClientId ? { ...c, ...newClient } : c));
          toast({ title: 'Cliente actualizado' });
        } else {
          const created = await res.json();
          setClients((prev) => [...prev, created]);
          setFormData((prev) => ({ ...prev, clientId: created.id }));
          toast({ title: 'Cliente creado' });
        }
        setShowClientModal(false);
        setEditingClientId(null);
        setNewClient({ fullName: '', phone: '', email: '' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al guardar cliente', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSavingInline(false);
    }
  };

  const openEditClient = () => {
    const client = clients.find((c) => c.id === formData.clientId);
    if (!client) return;
    setEditingClientId(client.id);
    setNewClient({ fullName: client.fullName, phone: client.phone, email: client.email || '' });
    setShowClientModal(true);
  };

  // Inline destination creation/edit
  const handleSaveDestination = async () => {
    if (!newDestination.name.trim()) {
      toast({ title: 'Error', description: 'El nombre del destino es requerido', variant: 'destructive' });
      return;
    }
    setSavingInline(true);
    try {
      const isEdit = !!editingDestinationId;
      const url = isEdit ? `/api/destinations/${editingDestinationId}` : '/api/destinations';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDestination.name,
          description: newDestination.description,
          seasonId: newDestination.seasonId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (isEdit) {
          setDestinations((prev) => prev.map((d) => d.id === editingDestinationId ? { ...d, ...data } : d));
          toast({ title: 'Destino actualizado' });
        } else {
          setDestinations((prev) => [...prev, data]);
          setFormData((prev) => ({ ...prev, destinationId: data.id }));
          toast({ title: 'Destino creado' });
        }
        setShowDestinationModal(false);
        setEditingDestinationId(null);
        setNewDestination({ name: '', description: '', seasonId: '' });
      } else {
        const errData = await res.json();
        toast({ title: 'Error', description: errData.error || 'Error al guardar destino', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSavingInline(false);
    }
  };

  const openEditDestination = () => {
    const dest = destinations.find((d) => d.id === formData.destinationId);
    if (!dest) return;
    setEditingDestinationId(dest.id);
    setNewDestination({ name: dest.name, description: dest.description || '', seasonId: dest.season?.id || '' });
    setShowDestinationModal(true);
  };

  const formatDateStr = (date: string) => format(new Date(date), "d 'de' MMM, yyyy", { locale: es });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      ACTIVE: 'default', COMPLETED: 'secondary', CANCELLED: 'destructive',
    };
    const labels: Record<string, string> = {
      ACTIVE: 'Activa', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tus ventas y pagos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales/margins">
            <Button variant="outline">
              <TrendingUp className="w-4 h-4 mr-2" />
              Márgenes
            </Button>
          </Link>
          <Button onClick={openCreateModal} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por cliente o destino..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Table */}
      {sales.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.client?.fullName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {sale.destination?.name || '—'}
                      {sale.destination?.season && (
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: sale.destination.season.color }}
                          title={sale.destination.season.name}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sale.departureDate ? formatDateStr(sale.departureDate) : '—'}
                  </TableCell>
                  <TableCell>
                    {sale.supplier ? <span className="text-sm">{sale.supplier.name}</span> : <span className="text-sm text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sale.paymentType === 'CASH' ? 'default' : 'secondary'}>
                      {sale.paymentType === 'CASH' ? 'Contado' : 'Crédito'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    ${sale.totalPrice?.toLocaleString('es-MX')}
                  </TableCell>
                  <TableCell>{getStatusBadge(sale.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/sales/${sale.id}`}>
                        <Button size="sm" variant="outline" title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(sale)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setDeletingSale(sale); setIsDeleteModalOpen(true); }} title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredSales.length)} de {filteredSales.length}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay ventas registradas</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Comienza registrando tu primera venta</p>
          <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Nueva Venta</Button>
        </Card>
      )}

      {/* ===== CREATE/EDIT SALE MODAL ===== */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSale ? 'Editar Venta' : 'Nueva Venta'}</DialogTitle>
            <DialogDescription>
              {editingSale ? 'Modifica los datos de la venta' : 'Registra una nueva venta'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client + inline create/edit */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={clientComboOpen} className="flex-1 justify-between font-normal">
                      {formData.clientId
                        ? clients.find((c) => c.id === formData.clientId)?.fullName || 'Selecciona un cliente'
                        : 'Selecciona un cliente'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.fullName} ${c.phone}`}
                              onSelect={() => {
                                setFormData((p) => ({ ...p, clientId: c.id }));
                                setClientComboOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', formData.clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.fullName} - {c.phone}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={openEditClient} disabled={!formData.clientId} title="Editar cliente">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); setShowClientModal(true); }} title="Nuevo cliente">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Destination + inline create/edit */}
            <div className="space-y-2">
              <Label>Destino *</Label>
              <div className="flex gap-2">
                <Popover open={destinationComboOpen} onOpenChange={setDestinationComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={destinationComboOpen} className="flex-1 justify-between font-normal">
                      {formData.destinationId ? (
                        <span className="flex items-center gap-2">
                          {destinations.find((d) => d.id === formData.destinationId)?.name || 'Selecciona un destino'}
                          {destinations.find((d) => d.id === formData.destinationId)?.season && (
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: destinations.find((d) => d.id === formData.destinationId)?.season?.color }} />
                          )}
                        </span>
                      ) : 'Selecciona un destino'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar destino..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron destinos.</CommandEmpty>
                        <CommandGroup>
                          {destinations.map((d) => (
                            <CommandItem
                              key={d.id}
                              value={d.name}
                              onSelect={() => {
                                setFormData((p) => ({ ...p, destinationId: d.id }));
                                setDestinationComboOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', formData.destinationId === d.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="flex items-center gap-2">
                                {d.name}
                                {d.season && (
                                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.season.color }} />
                                )}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={openEditDestination} disabled={!formData.destinationId} title="Editar destino">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => { setEditingDestinationId(null); setNewDestination({ name: '', description: '', seasonId: '' }); setShowDestinationModal(true); }} title="Nuevo destino">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Salida</Label>
                <DatePicker
                  value={formData.departureDate || undefined}
                  onChange={(date) => setFormData((p) => ({ ...p, departureDate: date || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Regreso</Label>
                <DatePicker
                  value={formData.returnDate || undefined}
                  onChange={(date) => setFormData((p) => ({ ...p, returnDate: date || null }))}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio Adulto ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.priceAdult || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setFormData((p) => recalcTotal({ ...p, priceAdult: v }));
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio Niño ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.priceChild || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setFormData((p) => recalcTotal({ ...p, priceChild: v }));
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Passengers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adultos</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.numAdults}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 1);
                    setFormData((p) => recalcTotal({ ...p, numAdults: v }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Niños</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.numChildren}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value) || 0);
                    setFormData((p) => recalcTotal({ ...p, numChildren: v }));
                  }}
                />
              </div>
            </div>

            {/* Total Price */}
            <div className="space-y-2">
              <Label>Precio Total ($) *</Label>
              <Input
                type="number"
                value={formData.totalPrice || ''}
                onChange={(e) => setFormData((p) => ({ ...p, totalPrice: parseFloat(e.target.value) || 0 }))}
                className="text-lg font-semibold"
                placeholder="0"
              />
              {formData.priceAdult > 0 && (
                <p className="text-xs text-muted-foreground">
                  Cálculo: ({formData.numAdults} × ${formData.priceAdult.toLocaleString('es-MX')}) + ({formData.numChildren} × ${formData.priceChild.toLocaleString('es-MX')}) = ${((formData.priceAdult * formData.numAdults) + (formData.priceChild * formData.numChildren)).toLocaleString('es-MX')}
                </p>
              )}
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Tipo de Pago *</Label>
              <Select value={formData.paymentType} onValueChange={(v: 'CASH' | 'CREDIT') => setFormData((p) => ({ ...p, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Contado</SelectItem>
                  <SelectItem value="CREDIT">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit Options */}
            {formData.paymentType === 'CREDIT' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Enganche</Label>
                  <Input
                    type="number" min={0}
                    value={formData.downPayment || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, downPayment: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de Pagos</Label>
                  <Input
                    type="number" min={1} max={24}
                    value={formData.numberOfPayments}
                    onChange={(e) => setFormData((p) => ({ ...p, numberOfPayments: Math.min(24, Math.max(1, parseInt(e.target.value) || 1)) }))}
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            {/* Supplier */}
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proveedor (opcional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={formData.supplierId} onValueChange={(v) => setFormData((p) => ({ ...p, supplierId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.serviceType})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Límite</Label>
                  <DatePicker
                    value={formData.supplierDeadline || undefined}
                    onChange={(date) => setFormData((p) => ({ ...p, supplierDeadline: date || null }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSale ? 'Guardar Cambios' : 'Crear Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== INLINE CLIENT CREATE/EDIT MODAL ===== */}
      <Dialog open={showClientModal} onOpenChange={(open) => { setShowClientModal(open); if (!open) { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClientId ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>{editingClientId ? 'Modifica los datos del cliente' : 'Crea un cliente rápidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input value={newClient.fullName} onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} placeholder="Teléfono" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newClient.email} onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))} placeholder="Email (opcional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={savingInline}>
              {savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingClientId ? 'Guardar Cambios' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== INLINE DESTINATION CREATE/EDIT MODAL ===== */}
      <Dialog open={showDestinationModal} onOpenChange={(open) => { setShowDestinationModal(open); if (!open) { setEditingDestinationId(null); setNewDestination({ name: '', description: '', seasonId: '' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDestinationId ? 'Editar Destino' : 'Nuevo Destino'}</DialogTitle>
            <DialogDescription>{editingDestinationId ? 'Modifica los datos del destino' : 'Crea un destino rápidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Destino *</Label>
              <Input value={newDestination.name} onChange={(e) => setNewDestination((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Cancún - Riviera Maya" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={newDestination.description} onChange={(e) => setNewDestination((p) => ({ ...p, description: e.target.value }))} placeholder="Descripción del destino..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Temporada (opcional)</Label>
              <Select value={newDestination.seasonId || 'none'} onValueChange={(v) => setNewDestination((p) => ({ ...p, seasonId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin temporada" /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowDestinationModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveDestination} disabled={savingInline}>
              {savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDestinationId ? 'Guardar Cambios' : 'Crear Destino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE MODAL ===== */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar venta?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la venta de <strong>{deletingSale?.client?.fullName}</strong> y todos sus pagos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
