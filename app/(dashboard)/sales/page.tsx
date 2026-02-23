'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Search, Pencil, Trash2, ShoppingCart, Loader2, Eye, TrendingUp, Check, ChevronsUpDown, ChevronDown, DollarSign, X, Filter, Hotel, UserPlus, Target, Plane, MapPin } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { BookingItemsForm, BookingItemData } from '@/components/booking-items-form';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
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
  phone: string;
  serviceType: string;
}

interface HotelOption { id: string; name: string; stars: number; diamonds: number; plan: string; roomType: string; }
interface Passenger { name: string; type: 'ADULT' | 'MINOR'; age: number | null; isHolder: boolean; }

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
  createdAt: string;
  status: string;
  notes?: string;
  departureDate?: string;
  returnDate?: string;
  priceAdult: number;
  priceChild: number;
  numAdults: number;
  numChildren: number;
  pricePerNight: number;
  numNights: number;
  freeChildren: number;
  supplierId?: string;
  supplierDeadline?: string;
  createdBy?: string;
  creatorName?: string;
  client: Client;
  destination?: Destination;
  supplier?: Supplier;
  items?: { type: string }[];
}

const datePresets = [
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mes pasado', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Últimos 3 meses', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) }) },
  { label: 'Este año', getRange: () => ({ from: startOfYear(new Date()), to: endOfMonth(new Date()) }) },
];

interface FormData {
  clientId: string;
  destinationId: string;
  departureDate: Date | null;
  returnDate: Date | null;
  priceAdult: number;
  priceChild: number;
  numAdults: number;
  numChildren: number;
  pricePerNight: number;
  numNights: number;
  freeChildren: number;
  hasFreeChildren: boolean;
  totalPrice: number;
  paymentType: 'CASH' | 'CREDIT';
  downPayment: number;
  numberOfPayments: number;
  paymentFrequency: 'QUINCENAL' | 'MENSUAL';
  notes: string;
  supplierId: string;
  supplierDeadline: Date | null;
  hotelId: string;
  reservationNumber: string;
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
  pricePerNight: 0,
  numNights: 0,
  freeChildren: 0,
  hasFreeChildren: false,
  totalPrice: 0,
  paymentType: 'CASH',
  downPayment: 0,
  numberOfPayments: 1,
  paymentFrequency: 'QUINCENAL',
  notes: '',
  supplierId: '',
  supplierDeadline: null,
  hotelId: '',
  reservationNumber: '',
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
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', serviceType: 'OTRO' });
  const [savingInline, setSavingInline] = useState(false);

  // Combobox open states
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [destinationComboOpen, setDestinationComboOpen] = useState(false);
  const [supplierComboOpen, setSupplierComboOpen] = useState(false);
  const [hotelComboOpen, setHotelComboOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  // Hotels, Passengers & Booking Items
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [bookingItems, setBookingItems] = useState<BookingItemData[]>([]);
  const [newPassengerName, setNewPassengerName] = useState('');
  const [newPassengerType, setNewPassengerType] = useState<'ADULT' | 'MINOR'>('ADULT');
  const [newPassengerAge, setNewPassengerAge] = useState('');

  // Search and pagination
  const [folioSearch, setFolioSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [filterClientId, setFilterClientId] = useState('');
  const [filterClientOpen, setFilterClientOpen] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('dateFrom', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) params.set('dateTo', format(dateRange.to, 'yyyy-MM-dd'));
      if (filterClientId) params.set('clientId', filterClientId);
      if (folioSearch.trim()) params.set('folio', folioSearch.trim());
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (res.ok) setSales(await res.json());
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las ventas', variant: 'destructive' });
    }
  }, [dateRange, filterClientId, folioSearch, toast]);

  const fetchCatalogs = useCallback(async () => {
    try {
      const [clientsRes, destRes, seasonsRes, suppRes] = await Promise.all([
        fetch('/api/clients?all=true'),
        fetch('/api/destinations'),
        fetch('/api/seasons'),
        fetch('/api/suppliers?all=true'),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (destRes.ok) setDestinations(await destRes.json());
      if (seasonsRes.ok) setSeasons(await seasonsRes.json());
      if (suppRes.ok) setSuppliers(await suppRes.json());
    } catch {
      // catalogs fail silently
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSales(), fetchCatalogs()]);
      setLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSales();
    setCurrentPage(1);
  }, [dateRange, filterClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced folio search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSales();
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [folioSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch hotels when destination changes in the form
  useEffect(() => {
    if (formData.destinationId) {
      fetch(`/api/hotels?destinationId=${formData.destinationId}&all=true`)
        .then((r) => r.ok ? r.json() : [])
        .then(setHotels)
        .catch(() => setHotels([]));
    } else {
      setHotels([]);
    }
  }, [formData.destinationId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSales(), fetchCatalogs()]);
    setLoading(false);
  };

  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const paginatedSales = sales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const hasActiveFilters = filterClientId || folioSearch.trim();

  const clearFilters = () => {
    setFilterClientId('');
    setFolioSearch('');
    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  };

  // Auto-calculate net cost and adjust total price if needed
  const calcNetCost = (d: FormData) => {
    const paidChildren = Math.max(0, d.numChildren - (d.hasFreeChildren ? d.freeChildren : 0));
    return (d.priceAdult * d.numAdults) + (d.priceChild * paidChildren) + (d.pricePerNight * d.numNights);
  };

  const recalcTotal = (data: Partial<FormData>) => {
    const d = { ...formData, ...data } as FormData;
    const nc = calcNetCost(d);
    const totalPrice = d.totalPrice < nc ? nc : d.totalPrice;
    return { ...d, totalPrice };
  };

  // Computed values
  const itemsCost = bookingItems.reduce((sum, item) => sum + (item.cost || 0), 0);
  const legacyNetCost = calcNetCost(formData);
  const netCost = bookingItems.length > 0 ? itemsCost : legacyNetCost;
  const profit = formData.totalPrice - netCost;
  const profitPercent = netCost > 0 ? ((profit / netCost) * 100) : 0;

  const openCreateModal = () => {
    setEditingSale(null);
    setFormData(initialFormData);
    setPassengers([]);
    setBookingItems([]);
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
      pricePerNight: sale.pricePerNight || 0,
      numNights: sale.numNights || 0,
      freeChildren: sale.freeChildren || 0,
      hasFreeChildren: (sale.freeChildren || 0) > 0,
      totalPrice: sale.totalPrice,
      paymentType: sale.paymentType as 'CASH' | 'CREDIT',
      downPayment: sale.downPayment,
      numberOfPayments: sale.numberOfPayments,
      notes: sale.notes || '',
      supplierId: sale.supplierId || '',
      supplierDeadline: sale.supplierDeadline ? new Date(sale.supplierDeadline) : null,
      hotelId: (sale as any).hotelId || '',
      paymentFrequency: ((sale as any).paymentFrequency as 'QUINCENAL' | 'MENSUAL') || 'QUINCENAL',
      reservationNumber: (sale as any).reservationNumber || '',
    });
    setPassengers((sale as any).passengers?.map((p: any) => ({
      name: p.name,
      type: p.type as 'ADULT' | 'MINOR',
      age: p.age,
      isHolder: p.isHolder,
    })) || []);
    setBookingItems(((sale as any).items || []).map((item: any) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      cost: item.cost || 0,
      sortOrder: item.sortOrder || 0,
      hotelId: item.hotelId || undefined,
      roomType: item.roomType || undefined,
      numAdults: item.numAdults ?? undefined,
      numChildren: item.numChildren ?? undefined,
      freeChildren: item.freeChildren ?? undefined,
      pricePerNight: item.pricePerNight ?? undefined,
      numNights: item.numNights ?? undefined,
      plan: item.plan || undefined,
      airline: item.airline || undefined,
      flightNumber: item.flightNumber || undefined,
      origin: item.origin || undefined,
      flightDestination: item.flightDestination || undefined,
      departureTime: item.departureTime ? new Date(item.departureTime) : null,
      arrivalTime: item.arrivalTime ? new Date(item.arrivalTime) : null,
      flightClass: item.flightClass || undefined,
      direction: item.direction || undefined,
      tourName: item.tourName || undefined,
      tourDate: item.tourDate ? new Date(item.tourDate) : null,
      numPeople: item.numPeople ?? undefined,
      pricePerPerson: item.pricePerPerson ?? undefined,
    })));
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
      toast({ title: 'Error', description: 'El anticipo debe ser menor al precio total', variant: 'destructive' });
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
          pricePerNight: formData.pricePerNight,
          numNights: formData.numNights,
          freeChildren: formData.hasFreeChildren ? formData.freeChildren : 0,
          totalPrice: formData.totalPrice,
          paymentType: formData.paymentType,
          downPayment: formData.downPayment,
          numberOfPayments: formData.numberOfPayments,
          notes: formData.notes || null,
          supplierId: formData.supplierId || null,
          supplierDeadline: formData.supplierDeadline ? formData.supplierDeadline.toISOString() : null,
          hotelId: formData.hotelId || null,
          reservationNumber: formData.reservationNumber || null,
          paymentFrequency: formData.paymentFrequency,
          passengers,
          items: bookingItems.map((item, idx) => ({
            ...item,
            sortOrder: idx,
            departureTime: item.departureTime?.toISOString() || null,
            arrivalTime: item.arrivalTime?.toISOString() || null,
            tourDate: item.tourDate instanceof Date ? item.tourDate.toISOString() : item.tourDate || null,
          })),
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

  // Inline supplier creation/edit
  const handleSaveSupplier = async () => {
    if (!newSupplier.name.trim() || !newSupplier.phone.trim()) {
      toast({ title: 'Error', description: 'Nombre y teléfono son requeridos', variant: 'destructive' });
      return;
    }
    setSavingInline(true);
    try {
      const isEdit = !!editingSupplierId;
      const url = isEdit ? `/api/suppliers/${editingSupplierId}` : '/api/suppliers';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      if (res.ok) {
        if (isEdit) {
          setSuppliers((prev) => prev.map((s) => s.id === editingSupplierId ? { ...s, ...newSupplier } : s));
          toast({ title: 'Proveedor actualizado' });
        } else {
          const created = await res.json();
          setSuppliers((prev) => [...prev, created]);
          setFormData((prev) => ({ ...prev, supplierId: created.id }));
          toast({ title: 'Proveedor creado' });
        }
        setShowSupplierModal(false);
        setEditingSupplierId(null);
        setNewSupplier({ name: '', phone: '', email: '', serviceType: 'OTRO' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Error al guardar proveedor', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    } finally {
      setSavingInline(false);
    }
  };

  const openEditSupplier = () => {
    const supplier = suppliers.find((s) => s.id === formData.supplierId);
    if (!supplier) return;
    setEditingSupplierId(supplier.id);
    setNewSupplier({ name: supplier.name, phone: supplier.phone || '', email: '', serviceType: supplier.serviceType || 'OTRO' });
    setShowSupplierModal(true);
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
          <Link href="/sales/goals">
            <Button variant="outline">
              <Target className="w-4 h-4 mr-2" />
              Metas
            </Button>
          </Link>
          <Link href="/sales/margins">
            <Button variant="outline">
              <TrendingUp className="w-4 h-4 mr-2" />
              Márgenes
            </Button>
          </Link>
          <Link href="/sales/new">
            <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Date range + presets */}
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <div className="flex flex-wrap gap-2">
              {datePresets.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" onClick={() => setDateRange(preset.getRange())}>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Entity filters + folio search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Folio search */}
            <div className="relative w-44">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar folio..."
                value={folioSearch}
                onChange={(e) => setFolioSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            {/* Client filter */}
            <Popover open={filterClientOpen} onOpenChange={setFilterClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('justify-between gap-2 min-w-[160px]', filterClientId && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20')}>
                  <span className="truncate max-w-[120px]">
                    {filterClientId ? clients.find((c) => c.id === filterClientId)?.fullName || 'Cliente' : 'Cliente'}
                  </span>
                  {filterClientId ? (
                    <X className="h-3 w-3 shrink-0 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setFilterClientId(''); }} />
                  ) : (
                    <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem key={c.id} value={`${c.fullName} ${c.phone}`} onSelect={() => { setFilterClientId(c.id); setFilterClientOpen(false); }}>
                          <Check className={cn('mr-2 h-4 w-4', filterClientId === c.id ? 'opacity-100' : 'opacity-0')} />
                          {c.fullName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      {sales.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Creado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded">
                      {sale.id.slice(-8).toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {sale.createdAt ? format(new Date(sale.createdAt), "d MMM yyyy", { locale: es }) : '—'}
                  </TableCell>
                  <TableCell className="font-medium">{sale.client?.fullName}</TableCell>
                  <TableCell>
                    {(() => {
                      const types = [...new Set((sale.items || []).map((i) => i.type))];
                      if (types.length === 0) return <span className="text-sm text-gray-400">—</span>;
                      return (
                        <div className="flex items-center gap-1">
                          {types.map((t) => (
                            <TooltipProvider key={t}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                    {t === 'HOTEL' && <Hotel className="w-3.5 h-3.5" />}
                                    {t === 'FLIGHT' && <Plane className="w-3.5 h-3.5" />}
                                    {t === 'TOUR' && <MapPin className="w-3.5 h-3.5" />}
                                    {(t === 'TRANSFER' || t === 'OTHER') && <span className="text-[10px] font-medium">{t === 'TRANSFER' ? 'TX' : '+'}</span>}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t === 'HOTEL' ? 'Hotel' : t === 'FLIGHT' ? 'Vuelo' : t === 'TOUR' ? 'Tour' : t === 'TRANSFER' ? 'Traslado' : 'Otro'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {sale.departureDate ? formatDateStr(sale.departureDate) : '—'}
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
                  <TableCell className="text-center">
                    {sale.creatorName ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold cursor-default">
                              {sale.creatorName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{sale.creatorName}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
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
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sales.length)} de {sales.length}
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
          <Link href="/sales/new"><Button><Plus className="w-4 h-4 mr-2" />Nueva Venta</Button></Link>
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
                                setFormData((p) => ({ ...p, destinationId: d.id, hotelId: '' }));
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

            {/* Hotel (optional, loads when destination selected) */}
            {formData.destinationId && hotels.length > 0 && (
              <div className="space-y-2">
                <Label>Hotel (opcional)</Label>
                <Popover open={hotelComboOpen} onOpenChange={setHotelComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={hotelComboOpen} className="w-full justify-between font-normal">
                      {formData.hotelId
                        ? hotels.find((h) => h.id === formData.hotelId)?.name || 'Selecciona hotel'
                        : 'Sin hotel'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar hotel..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron hoteles.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="__none__" onSelect={() => { setFormData((p) => ({ ...p, hotelId: '' })); setHotelComboOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', !formData.hotelId ? 'opacity-100' : 'opacity-0')} />
                            Sin hotel
                          </CommandItem>
                          {hotels.map((h) => (
                            <CommandItem key={h.id} value={h.name} onSelect={() => { setFormData((p) => ({ ...p, hotelId: h.id })); setHotelComboOpen(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', formData.hotelId === h.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="flex flex-col">
                                <span>{h.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {h.stars > 0 && `${h.stars}★`}{h.diamonds > 0 && ` ${h.diamonds}◆`}{h.plan && ` · ${h.plan}`}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

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

            {/* ── Servicios (Items) ── */}
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Servicios del Paquete
              </h3>
              <BookingItemsForm
                items={bookingItems}
                onChange={(newItems) => {
                  setBookingItems(newItems);
                  // Auto-adjust totalPrice if needed
                  const newItemsCost = newItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                  if (newItemsCost > 0 && formData.totalPrice < newItemsCost) {
                    setFormData((p) => ({ ...p, totalPrice: newItemsCost }));
                  }
                }}
                destinations={destinations}
                suppliers={suppliers}
              />
            </div>

            {/* Pricing Section - Collapsible (Direct costs - optional if items used) */}
            <Collapsible open={pricingOpen} onOpenChange={setPricingOpen}>
              <div className="rounded-lg border">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">
                        {bookingItems.length > 0 ? 'Costos Directos (opcional)' : 'Detalles de Costos'}
                      </span>
                      {legacyNetCost > 0 && !pricingOpen && (
                        <Badge variant="secondary" className="ml-2 font-mono">
                          ${legacyNetCost.toLocaleString('es-MX')}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', pricingOpen && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 p-3 pt-0 border-t">
                    {/* Precio por Noche / Noches */}
                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div className="space-y-2">
                        <Label>Precio por Noche ($)</Label>
                        <Input type="number" min={0} value={formData.pricePerNight || ''} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData((p) => recalcTotal({ ...p, pricePerNight: v })); }} placeholder="0 (opcional)" />
                      </div>
                      <div className="space-y-2">
                        <Label>Noches</Label>
                        <Input type="number" min={0} value={formData.numNights || ''} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); setFormData((p) => recalcTotal({ ...p, numNights: v })); }} placeholder="0" />
                      </div>
                    </div>

                    {/* Precio Adulto / Adultos */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Precio Adulto ($)</Label>
                        <Input type="number" min={0} value={formData.priceAdult || ''} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData((p) => recalcTotal({ ...p, priceAdult: v })); }} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Adultos</Label>
                        <Input type="number" min={1} value={formData.numAdults} onChange={(e) => { const v = Math.max(1, parseInt(e.target.value) || 1); setFormData((p) => recalcTotal({ ...p, numAdults: v })); }} />
                      </div>
                    </div>

                    {/* Precio Niño / Niños */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Precio Niño ($)</Label>
                        <Input type="number" min={0} value={formData.priceChild || ''} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setFormData((p) => recalcTotal({ ...p, priceChild: v })); }} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Niños</Label>
                        <Input type="number" min={0} value={formData.numChildren} onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); setFormData((p) => recalcTotal({ ...p, numChildren: v })); }} />
                      </div>
                    </div>

                    {/* Free Children Switch */}
                    {formData.numChildren > 0 && (
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Niños Gratis</Label>
                          <p className="text-xs text-muted-foreground">Marcar si hay niños que no pagan</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {formData.hasFreeChildren && (
                            <Input type="number" min={1} max={formData.numChildren} value={formData.freeChildren || 1} onChange={(e) => { const v = Math.min(formData.numChildren, Math.max(1, parseInt(e.target.value) || 1)); setFormData((p) => recalcTotal({ ...p, freeChildren: v })); }} className="w-20 h-8 text-center" />
                          )}
                          <Switch checked={formData.hasFreeChildren} onCheckedChange={(checked) => { setFormData((p) => recalcTotal({ ...p, hasFreeChildren: checked, freeChildren: checked ? Math.min(p.freeChildren || 1, p.numChildren) : 0 })); }} />
                        </div>
                      </div>
                    )}

                    {/* Net Cost Summary */}
                    {netCost > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Costo Neto</span>
                          <span className="font-semibold text-lg">${netCost.toLocaleString('es-MX')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formData.priceAdult > 0 && `${formData.numAdults} adulto${formData.numAdults !== 1 ? 's' : ''} × $${formData.priceAdult.toLocaleString('es-MX')}`}
                          {formData.priceChild > 0 && (() => {
                            const paidChildren = Math.max(0, formData.numChildren - (formData.hasFreeChildren ? formData.freeChildren : 0));
                            return paidChildren > 0 ? ` + ${paidChildren} niño${paidChildren !== 1 ? 's' : ''} × $${formData.priceChild.toLocaleString('es-MX')}` : '';
                          })()}
                          {formData.pricePerNight > 0 && formData.numNights > 0 && ` + ${formData.numNights} noche${formData.numNights !== 1 ? 's' : ''} × $${formData.pricePerNight.toLocaleString('es-MX')}`}
                          {formData.hasFreeChildren && formData.freeChildren > 0 && ` · ${formData.freeChildren} niño${formData.freeChildren !== 1 ? 's' : ''} gratis`}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

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

            {/* Credit Options */}
            {formData.paymentType === 'CREDIT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Anticipo</Label>
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
                <div className="space-y-2">
                  <Label>Frecuencia de Pagos</Label>
                  <Select value={formData.paymentFrequency} onValueChange={(v: 'QUINCENAL' | 'MENSUAL') => setFormData((p) => ({ ...p, paymentFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                      <SelectItem value="MENSUAL">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Reservation Number (solo ventas) */}
            <div className="space-y-2">
              <Label>Número de Reservación</Label>
              <Input
                value={formData.reservationNumber}
                onChange={(e) => setFormData((p) => ({ ...p, reservationNumber: e.target.value }))}
                placeholder="Ej: RES-2026-001"
              />
            </div>

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

            {/* Passengers */}
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Pasajeros
              </h3>
              <div className="space-y-3">
                {passengers.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm font-medium">
                      {p.isHolder && <Badge variant="secondary" className="mr-2 text-xs">Titular</Badge>}
                      {p.name}
                    </span>
                    <Badge variant={p.type === 'ADULT' ? 'default' : 'outline'} className="text-xs">
                      {p.type === 'ADULT' ? 'Adulto' : `Menor${p.age ? ` (${p.age} años)` : ''}`}
                    </Badge>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setPassengers((prev) => prev.filter((_, i) => i !== idx))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={newPassengerName}
                    onChange={(e) => setNewPassengerName(e.target.value)}
                    placeholder="Nombre del pasajero"
                    className="flex-1 min-w-[150px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newPassengerName.trim()) {
                          setPassengers((prev) => [...prev, {
                            name: newPassengerName.trim(),
                            type: newPassengerType,
                            age: newPassengerType === 'MINOR' ? (parseInt(newPassengerAge) || null) : null,
                            isHolder: prev.length === 0,
                          }]);
                          setNewPassengerName('');
                          setNewPassengerAge('');
                        }
                      }
                    }}
                  />
                  <Select value={newPassengerType} onValueChange={(v: 'ADULT' | 'MINOR') => setNewPassengerType(v)}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">Adulto</SelectItem>
                      <SelectItem value="MINOR">Menor</SelectItem>
                    </SelectContent>
                  </Select>
                  {newPassengerType === 'MINOR' && (
                    <Input
                      type="number"
                      min={0}
                      max={17}
                      value={newPassengerAge}
                      onChange={(e) => setNewPassengerAge(e.target.value)}
                      placeholder="Edad"
                      className="w-[70px]"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newPassengerName.trim()) {
                        setPassengers((prev) => [...prev, {
                          name: newPassengerName.trim(),
                          type: newPassengerType,
                          age: newPassengerType === 'MINOR' ? (parseInt(newPassengerAge) || null) : null,
                          isHolder: prev.length === 0,
                        }]);
                        setNewPassengerName('');
                        setNewPassengerAge('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {passengers.length === 0 && (
                  <p className="text-xs text-muted-foreground">El primer pasajero será marcado como titular</p>
                )}
              </div>
            </div>

            {/* Supplier */}
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proveedor (opcional)</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <div className="flex gap-2">
                    <Popover open={supplierComboOpen} onOpenChange={setSupplierComboOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={supplierComboOpen} className="flex-1 justify-between font-normal">
                          {formData.supplierId
                            ? (() => { const s = suppliers.find((s) => s.id === formData.supplierId); return s ? `${s.name} (${s.serviceType})` : 'Selecciona proveedor'; })()
                            : 'Selecciona proveedor'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar proveedor..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setFormData((p) => ({ ...p, supplierId: '' }));
                                  setSupplierComboOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', !formData.supplierId ? 'opacity-100' : 'opacity-0')} />
                                Sin proveedor
                              </CommandItem>
                              {suppliers.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={`${s.name} ${s.serviceType}`}
                                  onSelect={() => {
                                    setFormData((p) => ({ ...p, supplierId: s.id }));
                                    setSupplierComboOpen(false);
                                  }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', formData.supplierId === s.id ? 'opacity-100' : 'opacity-0')} />
                                  {s.name} ({s.serviceType})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="icon" onClick={openEditSupplier} disabled={!formData.supplierId} title="Editar proveedor">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => { setEditingSupplierId(null); setNewSupplier({ name: '', phone: '', email: '', serviceType: 'OTRO' }); setShowSupplierModal(true); }} title="Nuevo proveedor">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fecha Límite Proveedor</Label>
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

      {/* ===== INLINE SUPPLIER CREATE/EDIT MODAL ===== */}
      <Dialog open={showSupplierModal} onOpenChange={(open) => { setShowSupplierModal(open); if (!open) { setEditingSupplierId(null); setNewSupplier({ name: '', phone: '', email: '', serviceType: 'OTRO' }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplierId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
            <DialogDescription>{editingSupplierId ? 'Modifica los datos del proveedor' : 'Crea un proveedor rápidamente'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={newSupplier.name} onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))} placeholder="Nombre del proveedor" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={newSupplier.phone} onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))} placeholder="Teléfono" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newSupplier.email} onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))} placeholder="Email (opcional)" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Servicio</Label>
              <Select value={newSupplier.serviceType} onValueChange={(v) => setNewSupplier((p) => ({ ...p, serviceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOTEL">Hotel</SelectItem>
                  <SelectItem value="TRANSPORTE">Transporte</SelectItem>
                  <SelectItem value="TOUR">Tour</SelectItem>
                  <SelectItem value="SEGURO">Seguro</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveSupplier} disabled={savingInline}>
              {savingInline && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSupplierId ? 'Guardar Cambios' : 'Crear Proveedor'}
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
