'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, ShoppingCart, Loader2, Eye } from 'lucide-react';
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

interface PackageItem {
  id: string;
  name: string;
}

interface Departure {
  id: string;
  packageId: string;
  seasonId?: string;
  departureDate: string;
  returnDate: string;
  priceAdult: number;
  priceChild: number;
  availableSlots: number;
  package: PackageItem;
  season?: Season;
}

interface PaymentPlan {
  id: string;
  paymentNumber: number;
  dueDate: string;
  amount: number;
  status: string;
}

interface Supplier {
  id: string;
  name: string;
  serviceType: string;
}

interface Sale {
  id: string;
  clientId: string;
  departureId: string;
  supplierId?: string;
  supplierDeadline?: string;
  totalPrice: number;
  paymentType: string;
  downPayment: number;
  numberOfPayments: number;
  saleDate: string;
  status: string;
  notes?: string;
  client: Client;
  departure: Departure;
  payments: PaymentPlan[];
  supplier?: Supplier;
}

interface FormData {
  clientId: string;
  departureId: string;
  totalPrice: number;
  paymentType: 'CASH' | 'CREDIT';
  downPayment: number;
  numberOfPayments: number;
  notes: string;
  numAdults: number;
  numChildren: number;
  supplierId: string;
  supplierDeadline: string;
}

const initialFormData: FormData = {
  clientId: '',
  departureId: '',
  totalPrice: 0,
  paymentType: 'CASH',
  downPayment: 0,
  numberOfPayments: 1,
  notes: '',
  numAdults: 1,
  numChildren: 0,
  supplierId: '',
  supplierDeadline: '',
};

export default function SalesPage() {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<(PackageItem & { departures: Departure[] })[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Search and pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection state
  const [selectedPackageId, setSelectedPackageId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, clientsRes, packagesRes, suppliersRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/clients?all=true'),
        fetch('/api/packages'),
        fetch('/api/suppliers?all=true'),
      ]);

      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSales(salesData);
      }
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData);
      }
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter sales based on search
  const filteredSales = useMemo(() => {
    if (!search.trim()) return sales;
    const searchLower = search.toLowerCase();
    return sales.filter(
      (sale) =>
        sale.client?.fullName?.toLowerCase().includes(searchLower) ||
        sale.departure?.package?.name?.toLowerCase().includes(searchLower) ||
        sale.departure?.season?.name?.toLowerCase().includes(searchLower)
    );
  }, [sales, search]);

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get departures for selected package
  const availableDepartures = useMemo(() => {
    if (!selectedPackageId) return [];
    const pkg = packages.find((p) => p.id === selectedPackageId);
    return pkg?.departures || [];
  }, [selectedPackageId, packages]);

  // Calculate total price based on passengers
  const calculateTotalPrice = (departureId: string, numAdults: number, numChildren: number) => {
    const pkg = packages.find((p) => p.departures?.some((d) => d.id === departureId));
    const departure = pkg?.departures?.find((d) => d.id === departureId);
    if (!departure) return 0;
    return (departure.priceAdult * numAdults) + (departure.priceChild * numChildren);
  };

  const openCreateModal = () => {
    setEditingSale(null);
    setFormData(initialFormData);
    setSelectedPackageId('');
    setIsModalOpen(true);
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    // Find the package for this departure
    const pkg = packages.find((p) => p.departures?.some((d) => d.id === sale.departureId));
    setSelectedPackageId(pkg?.id || '');
    
    // Reverse calculate passengers (estimate)
    const departure = pkg?.departures?.find((d) => d.id === sale.departureId);
    let numAdults = 1;
    let numChildren = 0;
    if (departure && departure.priceAdult > 0) {
      // Simple estimate: assume mostly adults
      numAdults = Math.round(sale.totalPrice / departure.priceAdult) || 1;
    }

    setFormData({
      clientId: sale.clientId,
      departureId: sale.departureId,
      totalPrice: sale.totalPrice,
      paymentType: sale.paymentType as 'CASH' | 'CREDIT',
      downPayment: sale.downPayment,
      numberOfPayments: sale.numberOfPayments,
      notes: sale.notes || '',
      numAdults,
      numChildren,
      supplierId: sale.supplierId || '',
      supplierDeadline: sale.supplierDeadline ? sale.supplierDeadline.split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (sale: Sale) => {
    setDeletingSale(sale);
    setIsDeleteModalOpen(true);
  };

  const handleDepartureChange = (departureId: string) => {
    setFormData((prev) => {
      const newTotal = calculateTotalPrice(departureId, prev.numAdults, prev.numChildren);
      return { ...prev, departureId, totalPrice: newTotal };
    });
  };

  const handlePassengerChange = (field: 'numAdults' | 'numChildren', value: number) => {
    setFormData((prev) => {
      const newVal = Math.max(field === 'numAdults' ? 1 : 0, value);
      const newData = { ...prev, [field]: newVal };
      newData.totalPrice = calculateTotalPrice(prev.departureId, newData.numAdults, newData.numChildren);
      return newData;
    });
  };

  const handleSave = async () => {
    if (!formData.clientId || !formData.departureId) {
      toast({
        title: 'Error',
        description: 'Selecciona un cliente y una salida',
        variant: 'destructive',
      });
      return;
    }

    if (formData.totalPrice <= 0) {
      toast({
        title: 'Error',
        description: 'El precio total debe ser mayor a 0',
        variant: 'destructive',
      });
      return;
    }

    if (formData.paymentType === 'CREDIT' && formData.downPayment >= formData.totalPrice) {
      toast({
        title: 'Error',
        description: 'El enganche debe ser menor al precio total',
        variant: 'destructive',
      });
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
          ...formData,
          supplierId: formData.supplierId || null,
          supplierDeadline: formData.supplierDeadline || null,
        }),
      });

      if (!res.ok) throw new Error('Error saving');

      toast({
        title: 'Éxito',
        description: editingSale ? 'Venta actualizada correctamente' : 'Venta creada correctamente',
      });

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la venta',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSale) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/sales/${deletingSale.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Error deleting');

      toast({
        title: 'Éxito',
        description: 'Venta eliminada correctamente',
      });

      setIsDeleteModalOpen(false);
      setDeletingSale(null);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la venta',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "d 'de' MMM, yyyy", { locale: es });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      ACTIVE: 'default',
      COMPLETED: 'secondary',
      CANCELLED: 'destructive',
    };
    const labels: Record<string, string> = {
      ACTIVE: 'Activa',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
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
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por cliente, paquete o temporada..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
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
                <TableHead>Paquete</TableHead>
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
                      {sale.departure?.package?.name}
                      {sale.departure?.season && (
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: sale.departure.season.color }}
                          title={sale.departure.season.name}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDate(sale.departure?.departureDate)}
                  </TableCell>
                  <TableCell>
                    {sale.supplier ? (
                      <span className="text-sm">{sale.supplier.name}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
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
                        <Button size="sm" variant="outline" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(sale)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => openDeleteModal(sale)}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, filteredSales.length)} de {filteredSales.length}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay ventas registradas</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Comienza registrando tu primera venta
          </p>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
          </Button>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSale ? 'Editar Venta' : 'Nueva Venta'}</DialogTitle>
            <DialogDescription>
              {editingSale ? 'Modifica los datos de la venta' : 'Registra una nueva venta'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.fullName} - {client.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Package Selection */}
            <div className="space-y-2">
              <Label>Paquete *</Label>
              <Select
                value={selectedPackageId}
                onValueChange={(value) => {
                  setSelectedPackageId(value);
                  setFormData((prev) => ({ ...prev, departureId: '', totalPrice: 0 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un paquete" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Departure Selection */}
            {selectedPackageId && (
              <div className="space-y-2">
                <Label>Fecha de Salida *</Label>
                <Select value={formData.departureId} onValueChange={handleDepartureChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepartures.map((dep) => (
                      <SelectItem key={dep.id} value={dep.id}>
                        <div className="flex items-center gap-2">
                          {formatDate(dep.departureDate)}
                          {dep.season && (
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: dep.season.color }}
                              title={dep.season.name}
                            />
                          )}
                          <span className="text-gray-500 text-sm">
                            (${dep.priceAdult.toLocaleString('es-MX')} adulto)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Passengers */}
            {formData.departureId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adultos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.numAdults}
                    onChange={(e) => handlePassengerChange('numAdults', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Niños</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.numChildren}
                    onChange={(e) => handlePassengerChange('numChildren', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            {/* Total Price */}
            <div className="space-y-2">
              <Label>Precio Total</Label>
              <Input
                type="number"
                value={formData.totalPrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, totalPrice: parseFloat(e.target.value) || 0 }))
                }
                className="text-lg font-semibold"
              />
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Tipo de Pago *</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value: 'CASH' | 'CREDIT') =>
                  setFormData((prev) => ({ ...prev, paymentType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                    type="number"
                    min={0}
                    value={formData.downPayment}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, downPayment: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de Pagos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={formData.numberOfPayments}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        numberOfPayments: Math.min(12, Math.max(1, parseInt(e.target.value) || 1)),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre la venta..."
                rows={3}
              />
            </div>

            {/* Supplier */}
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proveedor (opcional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, supplierId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.serviceType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Límite</Label>
                  <Input
                    type="date"
                    value={formData.supplierDeadline}
                    onChange={(e) => setFormData((prev) => ({ ...prev, supplierDeadline: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSale ? 'Guardar Cambios' : 'Crear Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar venta?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la venta de{' '}
              <strong>{deletingSale?.client?.fullName}</strong> y todos sus pagos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
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
