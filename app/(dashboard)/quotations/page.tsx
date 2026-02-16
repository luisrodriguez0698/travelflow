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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, Pencil, Trash2, FileText, Loader2, Eye, Check, ChevronsUpDown, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isPast, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Client { id: string; fullName: string; phone: string; email?: string; }
interface Season { id: string; name: string; color: string; }
interface Destination { id: string; name: string; description: string; season?: Season | null; }
interface Supplier { id: string; name: string; serviceType: string; }

interface Quotation {
  id: string;
  clientId: string;
  destinationId?: string;
  totalPrice: number;
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
  expirationDate?: string;
  creatorName?: string;
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
  expirationDate: Date | null;
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
  expirationDate: null,
};

export default function QuotationsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [deletingQuotation, setDeletingQuotation] = useState<Quotation | null>(null);
  const [convertingQuotation, setConvertingQuotation] = useState<Quotation | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [showClientModal, setShowClientModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({ fullName: '', phone: '', email: '' });
  const [newDestination, setNewDestination] = useState({ name: '', description: '', seasonId: '' });
  const [savingInline, setSavingInline] = useState(false);

  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [destinationComboOpen, setDestinationComboOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [quotRes, clientsRes, destRes, seasonsRes, suppRes] = await Promise.all([
        fetch('/api/quotations'),
        fetch('/api/clients?all=true'),
        fetch('/api/destinations'),
        fetch('/api/seasons'),
        fetch('/api/suppliers?all=true'),
      ]);
      if (quotRes.ok) setQuotations(await quotRes.json());
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

  const filteredQuotations = useMemo(() => {
    if (!search.trim()) return quotations;
    const s = search.toLowerCase();
    return quotations.filter(
      (q) => q.client?.fullName?.toLowerCase().includes(s) || q.destination?.name?.toLowerCase().includes(s)
    );
  }, [quotations, search]);

  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
  const paginatedQuotations = filteredQuotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const recalcTotal = (data: Partial<FormData>) => {
    const d = { ...formData, ...data };
    const netCost = (d.priceAdult * d.numAdults) + (d.priceChild * d.numChildren);
    const totalPrice = d.totalPrice < netCost ? netCost : d.totalPrice;
    return { ...d, totalPrice };
  };

  const netCost = (formData.priceAdult * formData.numAdults) + (formData.priceChild * formData.numChildren);
  const profit = formData.totalPrice - netCost;
  const profitPercent = netCost > 0 ? ((profit / netCost) * 100) : 0;

  const openCreateModal = () => {
    setEditingQuotation(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (q: Quotation) => {
    setEditingQuotation(q);
    setFormData({
      clientId: q.clientId,
      destinationId: q.destinationId || '',
      departureDate: q.departureDate ? new Date(q.departureDate) : null,
      returnDate: q.returnDate ? new Date(q.returnDate) : null,
      priceAdult: q.priceAdult || 0,
      priceChild: q.priceChild || 0,
      numAdults: q.numAdults || 1,
      numChildren: q.numChildren || 0,
      totalPrice: q.totalPrice,
      paymentType: q.paymentType as 'CASH' | 'CREDIT',
      downPayment: q.downPayment,
      numberOfPayments: q.numberOfPayments,
      notes: q.notes || '',
      supplierId: q.supplierId || '',
      supplierDeadline: q.supplierDeadline ? new Date(q.supplierDeadline) : null,
      expirationDate: q.expirationDate ? new Date(q.expirationDate) : null,
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

    setSaving(true);
    try {
      const url = editingQuotation ? `/api/quotations/${editingQuotation.id}` : '/api/quotations';
      const method = editingQuotation ? 'PUT' : 'POST';
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
          expirationDate: formData.expirationDate ? formData.expirationDate.toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error('Error saving');
      toast({ title: 'Éxito', description: editingQuotation ? 'Cotización actualizada' : 'Cotización creada' });
      setIsModalOpen(false);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la cotización', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingQuotation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${deletingQuotation.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting');
      toast({ title: 'Éxito', description: 'Cotización eliminada' });
      setIsDeleteModalOpen(false);
      setDeletingQuotation(null);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar la cotización', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!convertingQuotation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${convertingQuotation.id}/convert`, { method: 'POST' });
      if (!res.ok) throw new Error('Error converting');
      toast({ title: 'Éxito', description: 'Cotización convertida a venta' });
      setIsConvertModalOpen(false);
      router.push(`/sales/${convertingQuotation.id}`);
    } catch {
      toast({ title: 'Error', description: 'No se pudo convertir la cotización', variant: 'destructive' });
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
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient) });
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
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); }
    finally { setSavingInline(false); }
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
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newDestination.name, description: newDestination.description, seasonId: newDestination.seasonId || null }) });
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
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }); }
    finally { setSavingInline(false); }
  };

  const openEditDestination = () => {
    const dest = destinations.find((d) => d.id === formData.destinationId);
    if (!dest) return;
    setEditingDestinationId(dest.id);
    setNewDestination({ name: dest.name, description: dest.description || '', seasonId: dest.season?.id || '' });
    setShowDestinationModal(true);
  };

  const formatDateStr = (date: string) => format(new Date(date), "d 'de' MMM, yyyy", { locale: es });

  const getExpirationBadge = (expirationDate?: string) => {
    if (!expirationDate) return <span className="text-sm text-gray-400">Sin fecha</span>;
    const expDate = new Date(expirationDate);
    const expired = isPast(expDate);
    const daysLeft = differenceInDays(expDate, new Date());

    if (expired) return <Badge variant="destructive">Vencida</Badge>;
    if (daysLeft <= 3) return <Badge className="bg-orange-500 hover:bg-orange-600">{formatDateStr(expirationDate)}</Badge>;
    return <Badge className="bg-green-600 hover:bg-green-700">{formatDateStr(expirationDate)}</Badge>;
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
          <h1 className="text-3xl font-bold">Cotizaciones</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tus cotizaciones y borradores</p>
        </div>
        <Button onClick={openCreateModal} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cotización
        </Button>
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
      {quotations.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Expiración</TableHead>
                <TableHead className="text-center">Creado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQuotations.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.client?.fullName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {q.destination?.name || '—'}
                      {q.destination?.season && (
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: q.destination.season.color }} title={q.destination.season.name} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{q.departureDate ? formatDateStr(q.departureDate) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={q.paymentType === 'CASH' ? 'default' : 'secondary'}>
                      {q.paymentType === 'CASH' ? 'Contado' : 'Crédito'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    ${q.totalPrice?.toLocaleString('es-MX')}
                  </TableCell>
                  <TableCell>{getExpirationBadge(q.expirationDate)}</TableCell>
                  <TableCell className="text-center">
                    {q.creatorName ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white text-xs font-semibold cursor-default">
                              {q.creatorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent><p>{q.creatorName}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/quotations/${q.id}`}>
                        <Button size="sm" variant="outline" title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => openEditModal(q)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => { setConvertingQuotation(q); setIsConvertModalOpen(true); }} title="Convertir a venta">
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setDeletingQuotation(q); setIsDeleteModalOpen(true); }} title="Eliminar">
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
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredQuotations.length)} de {filteredQuotations.length}
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
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay cotizaciones registradas</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Comienza creando tu primera cotización</p>
          <Button onClick={openCreateModal}><Plus className="w-4 h-4 mr-2" />Nueva Cotización</Button>
        </Card>
      )}

      {/* ===== CREATE/EDIT QUOTATION MODAL ===== */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuotation ? 'Editar Cotización' : 'Nueva Cotización'}</DialogTitle>
            <DialogDescription>
              {editingQuotation ? 'Modifica los datos de la cotización' : 'Crea una nueva cotización'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={clientComboOpen} className="flex-1 justify-between font-normal">
                      {formData.clientId ? clients.find((c) => c.id === formData.clientId)?.fullName || 'Selecciona un cliente' : 'Selecciona un cliente'}
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
                            <CommandItem key={c.id} value={`${c.fullName} ${c.phone}`} onSelect={() => { setFormData((p) => ({ ...p, clientId: c.id })); setClientComboOpen(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', formData.clientId === c.id ? 'opacity-100' : 'opacity-0')} />
                              {c.fullName} - {c.phone}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={openEditClient} disabled={!formData.clientId} title="Editar cliente"><Pencil className="w-4 h-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={() => { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); setShowClientModal(true); }} title="Nuevo cliente"><Plus className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* Destination */}
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
                            <CommandItem key={d.id} value={d.name} onSelect={() => { setFormData((p) => ({ ...p, destinationId: d.id })); setDestinationComboOpen(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', formData.destinationId === d.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="flex items-center gap-2">{d.name}{d.season && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.season.color }} />}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={openEditDestination} disabled={!formData.destinationId} title="Editar destino"><Pencil className="w-4 h-4" /></Button>
                <Button type="button" variant="outline" size="icon" onClick={() => { setEditingDestinationId(null); setNewDestination({ name: '', description: '', seasonId: '' }); setShowDestinationModal(true); }} title="Nuevo destino"><Plus className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Salida</Label>
                <DatePicker value={formData.departureDate || undefined} onChange={(date) => setFormData((p) => ({ ...p, departureDate: date || null }))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Regreso</Label>
                <DatePicker value={formData.returnDate || undefined} onChange={(date) => setFormData((p) => ({ ...p, returnDate: date || null }))} />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio Adulto ($)</Label>
                <Input type="number" min={0} value={formData.priceAdult || ''} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData((p) => recalcTotal({ ...p, priceAdult: v })); }} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Precio Niño ($)</Label>
                <Input type="number" min={0} value={formData.priceChild || ''} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData((p) => recalcTotal({ ...p, priceChild: v })); }} placeholder="0" />
              </div>
            </div>

            {/* Passengers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adultos</Label>
                <Input type="number" min={1} value={formData.numAdults} onChange={(e) => { const v = Math.max(1, parseInt(e.target.value) || 1); setFormData((p) => recalcTotal({ ...p, numAdults: v })); }} />
              </div>
              <div className="space-y-2">
                <Label>Niños</Label>
                <Input type="number" min={0} value={formData.numChildren} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); setFormData((p) => recalcTotal({ ...p, numChildren: v })); }} />
              </div>
            </div>

            {/* Net Cost (read-only) */}
            {netCost > 0 && (
              <div className="space-y-2">
                <Label>Costo Neto ($)</Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground font-semibold text-lg">
                  ${netCost.toLocaleString('es-MX')}
                </div>
                <p className="text-xs text-muted-foreground">
                  ({formData.numAdults} × ${formData.priceAdult.toLocaleString('es-MX')}) + ({formData.numChildren} × ${formData.priceChild.toLocaleString('es-MX')})
                </p>
              </div>
            )}

            {/* Sale Price + Profit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de Venta ($) *</Label>
                <Input
                  type="number"
                  value={formData.totalPrice || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setFormData((p) => ({ ...p, totalPrice: v }));
                  }}
                  onBlur={() => {
                    if (netCost > 0 && formData.totalPrice < netCost) {
                      setFormData((p) => ({ ...p, totalPrice: netCost }));
                    }
                  }}
                  className="text-lg font-semibold"
                  placeholder="0"
                  min={netCost || 0}
                />
                {netCost > 0 && formData.totalPrice < netCost && (
                  <p className="text-xs text-red-500">No puede ser menor al costo neto</p>
                )}
              </div>
              {netCost > 0 && formData.totalPrice > 0 && (
                <div className="space-y-2">
                  <Label>Ganancia</Label>
                  <div className={`flex items-center h-10 px-3 rounded-md border font-semibold text-lg ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
                    ${profit.toLocaleString('es-MX')}
                  </div>
                  <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    Margen: {profitPercent.toFixed(1)}%
                  </p>
                </div>
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

            {formData.paymentType === 'CREDIT' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Enganche</Label>
                  <Input type="number" min={0} value={formData.downPayment || ''} onChange={(e) => setFormData((p) => ({ ...p, downPayment: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Número de Pagos</Label>
                  <Input type="number" min={1} max={24} value={formData.numberOfPayments} onChange={(e) => setFormData((p) => ({ ...p, numberOfPayments: Math.min(24, Math.max(1, parseInt(e.target.value) || 1)) }))} />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionales..." rows={2} />
            </div>

            {/* Expiration Date */}
            <div className="border-t pt-4 mt-2">
              <div className="space-y-2">
                <Label>Fecha de Expiración</Label>
                <DatePicker value={formData.expirationDate || undefined} onChange={(date) => setFormData((p) => ({ ...p, expirationDate: date || null }))} />
                <p className="text-xs text-muted-foreground">Fecha hasta la cual esta cotización es válida</p>
              </div>
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
                  <DatePicker value={formData.supplierDeadline || undefined} onChange={(date) => setFormData((p) => ({ ...p, supplierDeadline: date || null }))} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingQuotation ? 'Guardar Cambios' : 'Crear Cotización'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== INLINE CLIENT MODAL ===== */}
      <Dialog open={showClientModal} onOpenChange={(open) => { setShowClientModal(open); if (!open) { setEditingClientId(null); setNewClient({ fullName: '', phone: '', email: '' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClientId ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>{editingClientId ? 'Modifica los datos del cliente' : 'Crea un cliente rápidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre completo *</Label><Input value={newClient.fullName} onChange={(e) => setNewClient((p) => ({ ...p, fullName: e.target.value }))} placeholder="Nombre completo" /></div>
            <div className="space-y-2"><Label>Teléfono *</Label><Input value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} placeholder="Teléfono" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={newClient.email} onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))} placeholder="Email (opcional)" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={savingInline}>{savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingClientId ? 'Guardar Cambios' : 'Crear Cliente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== INLINE DESTINATION MODAL ===== */}
      <Dialog open={showDestinationModal} onOpenChange={(open) => { setShowDestinationModal(open); if (!open) { setEditingDestinationId(null); setNewDestination({ name: '', description: '', seasonId: '' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDestinationId ? 'Editar Destino' : 'Nuevo Destino'}</DialogTitle>
            <DialogDescription>{editingDestinationId ? 'Modifica los datos del destino' : 'Crea un destino rápidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre del Destino *</Label><Input value={newDestination.name} onChange={(e) => setNewDestination((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Cancún - Riviera Maya" /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={newDestination.description} onChange={(e) => setNewDestination((p) => ({ ...p, description: e.target.value }))} placeholder="Descripción del destino..." rows={2} /></div>
            <div className="space-y-2">
              <Label>Temporada (opcional)</Label>
              <Select value={newDestination.seasonId || 'none'} onValueChange={(v) => setNewDestination((p) => ({ ...p, seasonId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin temporada" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Sin temporada</SelectItem>{seasons.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDestinationModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveDestination} disabled={savingInline}>{savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingDestinationId ? 'Guardar Cambios' : 'Crear Destino'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE MODAL ===== */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar cotización?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la cotización de <strong>{deletingQuotation?.client?.fullName}</strong>.
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

      {/* ===== CONVERT TO SALE MODAL ===== */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Convertir a venta?</DialogTitle>
            <DialogDescription>
              Se convertirá la cotización de <strong>{convertingQuotation?.client?.fullName}</strong> en una venta.
              {convertingQuotation?.paymentType === 'CREDIT' && ' El plan de pagos se generará con fechas a partir de hoy.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleConvert} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Convertir a Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
