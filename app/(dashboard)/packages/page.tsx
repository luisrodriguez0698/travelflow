'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package as PackageIcon, Edit, Trash2, ChevronLeft, ChevronRight, Search, Loader2, Calendar, X, Check, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Season {
  id: string;
  name: string;
  color: string;
}

interface Departure {
  id?: string;
  seasonId?: string | null;
  season?: Season | null;
  departureDate: Date | null;
  returnDate: Date | null;
  priceAdult: number;
  priceChild: number;
  availableSlots: number;
}

interface Package {
  id: string;
  name: string;
  description: string;
  images: string[];
  servicesIncluded: string;
  servicesNotIncluded: string;
  departures: {
    id: string;
    seasonId?: string | null;
    season?: Season | null;
    departureDate: string;
    returnDate: string;
    priceAdult: number;
    priceChild: number;
    availableSlots: number;
  }[];
}

const ITEMS_PER_PAGE = 10;

const emptyDeparture = (): Departure => ({
  seasonId: null,
  departureDate: null,
  returnDate: null,
  priceAdult: 0,
  priceChild: 0,
  availableSlots: 50,
});

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    images: [] as string[],
    servicesIncluded: '',
    servicesNotIncluded: '',
  });
  const [departures, setDepartures] = useState<Departure[]>([]);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const res = await fetch('/api/seasons');
      if (res.ok) {
        const data = await res.json();
        setSeasons(data);
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
    fetchSeasons();
  }, [fetchPackages, fetchSeasons]);

  // Filter packages by search term
  const filteredPackages = packages.filter((pkg) =>
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredPackages.length / ITEMS_PER_PAGE);
  const paginatedPackages = filteredPackages.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Get next departure for a package
  const getNextDeparture = (pkg: Package) => {
    const now = new Date();
    const futureDepartures = pkg.departures
      .filter((d) => new Date(d.departureDate) >= now)
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
    return futureDepartures[0] || null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      images: [],
      servicesIncluded: '',
      servicesNotIncluded: '',
    });
    setDepartures([]);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (pkg: Package) => {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description,
      images: pkg.images || [],
      servicesIncluded: pkg.servicesIncluded || '',
      servicesNotIncluded: pkg.servicesNotIncluded || '',
    });
    setDepartures(
      pkg.departures.map((d) => ({
        id: d.id,
        seasonId: d.seasonId || null,
        season: d.season || null,
        departureDate: new Date(d.departureDate),
        returnDate: new Date(d.returnDate),
        priceAdult: d.priceAdult,
        priceChild: d.priceChild,
        availableSlots: d.availableSlots,
      }))
    );
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (pkg: Package) => {
    setSelectedPackage(pkg);
    setIsDeleteDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('El nombre del paquete es requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          departures: departures.map((d) => ({
            seasonId: d.seasonId || null,
            departureDate: d.departureDate?.toISOString(),
            returnDate: d.returnDate?.toISOString(),
            priceAdult: d.priceAdult,
            priceChild: d.priceChild,
            availableSlots: d.availableSlots,
          })),
        }),
      });
      if (res.ok) {
        toast.success('Paquete creado exitosamente');
        setIsCreateModalOpen(false);
        fetchPackages();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al crear paquete');
      }
    } catch (error) {
      toast.error('Error al crear paquete');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPackage || !formData.name) {
      toast.error('El nombre del paquete es requerido');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/packages/${selectedPackage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          departures: departures.map((d) => ({
            id: d.id,
            seasonId: d.seasonId || null,
            departureDate: d.departureDate?.toISOString(),
            returnDate: d.returnDate?.toISOString(),
            priceAdult: d.priceAdult,
            priceChild: d.priceChild,
            availableSlots: d.availableSlots,
          })),
        }),
      });
      if (res.ok) {
        toast.success('Paquete actualizado exitosamente');
        setIsEditModalOpen(false);
        fetchPackages();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al actualizar paquete');
      }
    } catch (error) {
      toast.error('Error al actualizar paquete');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPackage) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/packages/${selectedPackage.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Paquete eliminado exitosamente');
        setIsDeleteDialogOpen(false);
        fetchPackages();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar paquete');
      }
    } catch (error) {
      toast.error('Error al eliminar paquete');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Departure management
  const [isDepartureModalOpen, setIsDepartureModalOpen] = useState(false);
  const [editingDepartureIndex, setEditingDepartureIndex] = useState<number | null>(null);
  const [departureForm, setDepartureForm] = useState<Departure>(emptyDeparture());
  const [deleteDepartureIndex, setDeleteDepartureIndex] = useState<number | null>(null);

  const openAddDeparture = () => {
    setDepartureForm(emptyDeparture());
    setEditingDepartureIndex(-1); // -1 means new
    setIsDepartureModalOpen(true);
  };

  const openEditDeparture = (index: number) => {
    setDepartureForm({ ...departures[index] });
    setEditingDepartureIndex(index);
    setIsDepartureModalOpen(true);
  };

  const confirmDeleteDeparture = (index: number) => {
    setDeleteDepartureIndex(index);
  };

  const removeDeparture = () => {
    if (deleteDepartureIndex !== null) {
      setDepartures((prev) => prev.filter((_, i) => i !== deleteDepartureIndex));
      setDeleteDepartureIndex(null);
      toast.success('Salida eliminada');
    }
  };

  const saveDeparture = () => {
    // Validations
    if (!departureForm.departureDate) {
      toast.error('Selecciona la fecha de salida');
      return;
    }
    if (!departureForm.returnDate) {
      toast.error('Selecciona la fecha de regreso');
      return;
    }
    if (departureForm.returnDate < departureForm.departureDate) {
      toast.error('La fecha de regreso no puede ser anterior a la fecha de salida');
      return;
    }
    if (!departureForm.priceAdult || departureForm.priceAdult <= 0) {
      toast.error('El precio de adulto debe ser mayor a 0');
      return;
    }

    if (editingDepartureIndex === -1) {
      setDepartures((prev) => [...prev, departureForm]);
      toast.success('Salida agregada');
    } else if (editingDepartureIndex !== null) {
      setDepartures((prev) =>
        prev.map((d, i) => (i === editingDepartureIndex ? departureForm : d))
      );
      toast.success('Salida actualizada');
    }
    setIsDepartureModalOpen(false);
    setEditingDepartureIndex(null);
    setDepartureForm(emptyDeparture());
  };

  const closeDepartureModal = () => {
    setIsDepartureModalOpen(false);
    setEditingDepartureIndex(null);
    setDepartureForm(emptyDeparture());
  };

  // Form fields JSX
  const formFields = (
    <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-2">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre del Destino *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ej: Cancún Todo Incluido"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe el paquete turístico..."
          rows={2}
        />
      </div>

      {/* Departures Section */}
      <div className="border-t pt-4 mt-2">
        <div className="flex justify-between items-center mb-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Salidas Programadas ({departures.length})
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={openAddDeparture}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        </div>

        {/* Departures Table */}
        {departures.length === 0 ? (
          <div className="text-center py-6 border rounded-lg border-dashed">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay salidas programadas</p>
            <p className="text-xs text-muted-foreground">Agrega salidas con fechas y precios</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-2">Temporada</TableHead>
                  <TableHead className="text-xs py-2">Fechas</TableHead>
                  <TableHead className="text-xs py-2">Adulto</TableHead>
                  <TableHead className="text-xs py-2">Niño</TableHead>
                  <TableHead className="text-xs py-2 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departures.map((dep, index) => {
                  const seasonInfo = dep.seasonId 
                    ? seasons.find(s => s.id === dep.seasonId) || dep.season 
                    : null;
                  return (
                    <TableRow key={index}>
                      <TableCell className="py-2">
                        {seasonInfo ? (
                          <div className="flex items-center gap-1.5">
                            <div 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: seasonInfo.color }} 
                            />
                            <span className="text-xs truncate max-w-[80px]">{seasonInfo.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-sm">
                          {dep.departureDate ? format(dep.departureDate, "d MMM", { locale: es }) : '-'}
                          {' - '}
                          {dep.returnDate ? format(dep.returnDate, "d MMM yy", { locale: es }) : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-medium text-green-600 dark:text-green-400">
                        ${dep.priceAdult.toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">
                        {dep.priceChild > 0 ? `$${dep.priceChild.toLocaleString('es-MX')}` : '-'}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDeparture(index)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => confirmDeleteDeparture(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );

  // Departure form modal content
  const departureFormModal = (
    <Dialog open={isDepartureModalOpen} onOpenChange={(open) => !open && closeDepartureModal()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {editingDepartureIndex === -1 ? 'Nueva Salida' : 'Editar Salida'}
          </DialogTitle>
          <DialogDescription>
            {editingDepartureIndex === -1 
              ? 'Agrega una nueva fecha de salida con sus precios.' 
              : 'Modifica los datos de esta salida programada.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Season Selector */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Temporada
            </Label>
            <Select
              value={departureForm.seasonId || 'none'}
              onValueChange={(value) => setDepartureForm((prev) => ({ 
                ...prev, 
                seasonId: value === 'none' ? null : value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin temporada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Sin temporada</span>
                </SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: season.color }} 
                      />
                      {season.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Fecha Salida *</Label>
              <DatePicker
                value={departureForm.departureDate}
                onChange={(date) => {
                  setDepartureForm((prev) => ({
                    ...prev,
                    departureDate: date || null,
                    returnDate: prev.returnDate && date && prev.returnDate < date ? null : prev.returnDate,
                  }));
                }}
                placeholder="Seleccionar"
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Fecha Regreso *</Label>
              <DatePicker
                value={departureForm.returnDate}
                onChange={(date) => setDepartureForm((prev) => ({ ...prev, returnDate: date || null }))}
                placeholder="Seleccionar"
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 3}
                disabled={!departureForm.departureDate}
              />
            </div>
          </div>
          {departureForm.departureDate && (
            <p className="text-xs text-muted-foreground -mt-2">
              La fecha de regreso debe ser igual o posterior a la salida
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Precio Adulto ($) *</Label>
              <Input
                type="number"
                value={departureForm.priceAdult || ''}
                onChange={(e) => setDepartureForm((prev) => ({ ...prev, priceAdult: parseFloat(e.target.value) || 0 }))}
                placeholder="10,999"
              />
            </div>
            <div className="grid gap-2">
              <Label>Precio Niño ($)</Label>
              <Input
                type="number"
                value={departureForm.priceChild || ''}
                onChange={(e) => setDepartureForm((prev) => ({ ...prev, priceChild: parseFloat(e.target.value) || 0 }))}
                placeholder="8,999"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeDepartureModal}>
            Cancelar
          </Button>
          <Button onClick={saveDeparture}>
            <Check className="w-4 h-4 mr-1" />
            {editingDepartureIndex === -1 ? 'Agregar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Departure delete confirmation - usando Dialog simple en lugar de AlertDialog para evitar conflictos
  const departureDeleteDialog = (
    <Dialog open={deleteDepartureIndex !== null} onOpenChange={(open) => { if (!open) setDeleteDepartureIndex(null); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">¿Eliminar esta salida?</DialogTitle>
          <DialogDescription>
            {deleteDepartureIndex !== null && departures[deleteDepartureIndex] && (
              <>
                Estás a punto de eliminar la salida del{' '}
                <strong>
                  {departures[deleteDepartureIndex].departureDate 
                    ? format(departures[deleteDepartureIndex].departureDate!, "d 'de' MMMM 'de' yyyy", { locale: es })
                    : '-'}
                </strong>
                . Esta acción no se puede deshacer.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setDeleteDepartureIndex(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={removeDeparture}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paquetes Turísticos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona tus destinos y fechas de salida</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Paquete
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre del Paquete</TableHead>
              <TableHead className="hidden md:table-cell">Descripción</TableHead>
              <TableHead>Próxima Salida</TableHead>
              <TableHead className="hidden sm:table-cell">Precio Base</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPackages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <PackageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchTerm ? 'No se encontraron paquetes' : 'No hay paquetes registrados'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPackages.map((pkg) => {
                const nextDep = getNextDeparture(pkg);
                return (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                          <PackageIcon className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pkg.departures.length} salida{pkg.departures.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs">
                      <p className="truncate text-sm text-muted-foreground">{pkg.description || '-'}</p>
                    </TableCell>
                    <TableCell>
                      {nextDep ? (
                        <div className="text-sm">
                          <p className="font-medium">
                            {format(new Date(nextDep.departureDate), "d MMM yy", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            al {format(new Date(nextDep.returnDate), "d MMM yy", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin salidas</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {nextDep ? (
                        <div>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            ${nextDep.priceAdult.toLocaleString('es-MX')}
                          </p>
                          {nextDep.priceChild > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Niño: ${nextDep.priceChild.toLocaleString('es-MX')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => openEditModal(pkg)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(pkg)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredPackages.length)} de{' '}
              {filteredPackages.length} paquetes
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nuevo Paquete</DialogTitle>
            <DialogDescription>
              Crea un nuevo paquete turístico con sus fechas de salida y precios.
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
                'Crear Paquete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Paquete</DialogTitle>
            <DialogDescription>
              Modifica los datos del paquete y sus fechas de salida.
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

      {/* Departure Form Modal */}
      {departureFormModal}

      {/* Departure Delete Confirmation */}
      {departureDeleteDialog}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar paquete?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el paquete
              <span className="font-semibold"> {selectedPackage?.name}</span> y todas sus salidas programadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600"
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
