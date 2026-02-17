'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { PackageImageUpload } from '@/components/package-image-upload';
import {
  Plus, Search, Pencil, Trash2, Loader2, Hotel as HotelIcon,
  Star, Diamond, X,
} from 'lucide-react';
import { toast } from 'sonner';

interface Destination {
  id: string;
  name: string;
}

interface Hotel {
  id: string;
  name: string;
  destinationId: string;
  destination: { id: string; name: string };
  stars: number;
  diamonds: number;
  plan: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  checkInNote: string | null;
  checkOutNote: string | null;
  idRequirement: string | null;
  includes: string[];
  notIncludes: string[];
  images: string[];
  creatorName?: string | null;
}

const defaultForm = {
  name: '',
  destinationId: '',
  stars: 0,
  diamonds: 0,
  plan: '',
  roomType: '',
  checkIn: '',
  checkOut: '',
  checkInNote: '',
  checkOutNote: '',
  idRequirement: '',
  includes: [] as string[],
  notIncludes: [] as string[],
  images: [] as string[],
};

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Dynamic list temp inputs
  const [newInclude, setNewInclude] = useState('');
  const [newNotInclude, setNewNotInclude] = useState('');

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDest) params.set('destinationId', filterDest);
      if (search) params.set('search', search);

      const [hotelsRes, destRes] = await Promise.all([
        fetch(`/api/hotels?${params.toString()}`),
        fetch('/api/destinations'),
      ]);
      if (hotelsRes.ok) {
        const json = await hotelsRes.json();
        setHotels(json.data || json);
      }
      if (destRes.ok) setDestinations(await destRes.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterDest]);

  const filtered = hotels.filter((h) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(s) ||
      h.plan.toLowerCase().includes(s) ||
      h.destination?.name.toLowerCase().includes(s)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({ ...defaultForm });
    setNewInclude('');
    setNewNotInclude('');
    setIsModalOpen(true);
  };

  const openEdit = (hotel: Hotel) => {
    setEditing(hotel);
    setFormData({
      name: hotel.name,
      destinationId: hotel.destinationId,
      stars: hotel.stars,
      diamonds: hotel.diamonds,
      plan: hotel.plan,
      roomType: hotel.roomType,
      checkIn: hotel.checkIn,
      checkOut: hotel.checkOut,
      checkInNote: hotel.checkInNote || '',
      checkOutNote: hotel.checkOutNote || '',
      idRequirement: hotel.idRequirement || '',
      includes: [...hotel.includes],
      notIncludes: [...hotel.notIncludes],
      images: [...hotel.images],
    });
    setNewInclude('');
    setNewNotInclude('');
    setIsModalOpen(true);
  };

  const addInclude = () => {
    const val = newInclude.trim();
    if (!val) return;
    setFormData({ ...formData, includes: [...formData.includes, val] });
    setNewInclude('');
  };

  const removeInclude = (index: number) => {
    setFormData({ ...formData, includes: formData.includes.filter((_, i) => i !== index) });
  };

  const addNotInclude = () => {
    const val = newNotInclude.trim();
    if (!val) return;
    setFormData({ ...formData, notIncludes: [...formData.notIncludes, val] });
    setNewNotInclude('');
  };

  const removeNotInclude = (index: number) => {
    setFormData({ ...formData, notIncludes: formData.notIncludes.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!formData.destinationId) {
      toast.error('El destino es requerido');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/hotels/${editing.id}` : '/api/hotels';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          destinationId: formData.destinationId,
          stars: formData.stars,
          diamonds: formData.diamonds,
          plan: formData.plan.trim(),
          roomType: formData.roomType.trim(),
          checkIn: formData.checkIn.trim(),
          checkOut: formData.checkOut.trim(),
          checkInNote: formData.checkInNote.trim() || null,
          checkOutNote: formData.checkOutNote.trim() || null,
          idRequirement: formData.idRequirement.trim() || null,
          includes: formData.includes,
          notIncludes: formData.notIncludes,
          images: formData.images,
        }),
      });
      if (res.ok) {
        toast.success(editing ? 'Hotel actualizado' : 'Hotel creado');
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
      const res = await fetch(`/api/hotels/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Hotel eliminado');
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

  const renderStars = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
    ));

  const renderDiamonds = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <Diamond key={i} className="w-3.5 h-3.5 fill-blue-400 text-blue-400" />
    ));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hoteles</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestiona los hoteles por destino</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Hotel
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar hotel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDest || 'all'} onValueChange={(v) => setFilterDest(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Todos los destinos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los destinos</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hotel</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Habitación</TableHead>
              <TableHead className="text-center">Creado por</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay hoteles registrados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((hotel) => (
                <TableRow key={hotel.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HotelIcon className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{hotel.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{hotel.destination?.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {hotel.stars > 0 && (
                        <div className="flex items-center gap-0.5">{renderStars(hotel.stars)}</div>
                      )}
                      {hotel.diamonds > 0 && (
                        <div className="flex items-center gap-0.5">{renderDiamonds(hotel.diamonds)}</div>
                      )}
                      {hotel.stars === 0 && hotel.diamonds === 0 && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{hotel.plan || '—'}</TableCell>
                  <TableCell className="text-sm">{hotel.roomType || '—'}</TableCell>
                  <TableCell className="text-center">
                    {hotel.creatorName ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs font-semibold cursor-default">
                              {hotel.creatorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent><p>{hotel.creatorName}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(hotel)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(hotel.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Hotel' : 'Nuevo Hotel'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Hotel *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Grand Oasis Cancún"
                />
              </div>
              <div>
                <Label>Destino *</Label>
                <Select
                  value={formData.destinationId || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, destinationId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar destino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Seleccionar destino</SelectItem>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stars & Diamonds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Estrellas</Label>
                <Select
                  value={String(formData.stars)}
                  onValueChange={(v) => setFormData({ ...formData, stars: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'Sin estrellas' : `${n} estrella${n > 1 ? 's' : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diamantes</Label>
                <Select
                  value={String(formData.diamonds)}
                  onValueChange={(v) => setFormData({ ...formData, diamonds: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'Sin diamantes' : `${n} diamante${n > 1 ? 's' : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Plan & Room Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Plan</Label>
                <Input
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  placeholder="Ej: Todo Incluido"
                />
              </div>
              <div>
                <Label>Tipo de Habitación</Label>
                <Input
                  value={formData.roomType}
                  onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                  placeholder="Ej: Suite Junior"
                />
              </div>
            </div>

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Check-In</Label>
                <Input
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                  placeholder="Ej: 16:00 HRS"
                />
              </div>
              <div>
                <Label>Check-Out</Label>
                <Input
                  value={formData.checkOut}
                  onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                  placeholder="Ej: 13:00 HRS"
                />
              </div>
            </div>

            {/* Check-in / Check-out Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nota de Check-In</Label>
                <Textarea
                  value={formData.checkInNote}
                  onChange={(e) => setFormData({ ...formData, checkInNote: e.target.value })}
                  placeholder="Ej: Puede llegar desde la 1pm"
                  rows={2}
                />
              </div>
              <div>
                <Label>Nota de Check-Out</Label>
                <Textarea
                  value={formData.checkOutNote}
                  onChange={(e) => setFormData({ ...formData, checkOutNote: e.target.value })}
                  placeholder="Ej: Salida antes de las 12pm"
                  rows={2}
                />
              </div>
            </div>

            {/* ID Requirement */}
            <div>
              <Label>Requisito de Identificación</Label>
              <Textarea
                value={formData.idRequirement}
                onChange={(e) => setFormData({ ...formData, idRequirement: e.target.value })}
                placeholder="Ej: INE, PASAPORTE O LICENCIA DE CONDUCIR VIGENTE"
                rows={2}
              />
            </div>

            {/* Includes - Dynamic List */}
            <div>
              <Label>Incluye</Label>
              <div className="space-y-2 mt-1">
                {formData.includes.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-md">
                      {item}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeInclude(index)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newInclude}
                    onChange={(e) => setNewInclude(e.target.value)}
                    placeholder="Ej: Desayuno buffet"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInclude())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addInclude}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Not Includes - Dynamic List */}
            <div>
              <Label>No Incluye</Label>
              <div className="space-y-2 mt-1">
                {formData.notIncludes.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-md">
                      {item}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeNotInclude(index)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newNotInclude}
                    onChange={(e) => setNewNotInclude(e.target.value)}
                    placeholder="Ej: Propinas"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNotInclude())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addNotInclude}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <Label>Imágenes (máx. 6)</Label>
              <div className="mt-1">
                <PackageImageUpload
                  images={formData.images}
                  onImagesChange={(imgs) =>
                    setFormData({ ...formData, images: imgs.slice(0, 6) })
                  }
                />
                {formData.images.length >= 6 && (
                  <p className="text-sm text-amber-600 mt-1">Máximo de 6 imágenes alcanzado</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Guardar Cambios' : 'Crear Hotel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Hotel</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este hotel? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
