'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { LayoutTemplate, BookmarkPlus, Loader2, Search, Hotel, Plane, MapPin, Bus } from 'lucide-react';
import { toast } from 'sonner';
import type { BookingItemData } from '@/components/booking-items-form';
import { templateItemsToFormItems, type PackageTemplateSummary, type TemplateItem } from '@/lib/package-template';
import { RowsSkeleton } from '@/components/skeletons';

export interface AppliedTemplate {
  items: BookingItemData[];
  totalPrice: number;
  notes: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

/** Iconos con conteo por tipo de servicio, p. ej. 🏨2 ✈1 */
export function TemplateItemsSummary({ items }: { items: TemplateItem[] }) {
  const counts = items.reduce<Record<string, number>>((acc, it) => {
    const type = String(it.type);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const icons = [
    { type: 'HOTEL', icon: Hotel, color: 'text-blue-500' },
    { type: 'FLIGHT', icon: Plane, color: 'text-cyan-500' },
    { type: 'TOUR', icon: MapPin, color: 'text-amber-500' },
    { type: 'TRANSFER', icon: Bus, color: 'text-emerald-500' },
  ];
  if (items.length === 0) return <span className="text-xs text-muted-foreground">Sin servicios</span>;
  return (
    <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
      {icons.filter((i) => counts[i.type]).map(({ type, icon: Icon, color }) => (
        <span key={type} className="flex items-center gap-0.5">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          {counts[type]}
        </span>
      ))}
    </span>
  );
}

export const templateNetCost = (items: TemplateItem[]) =>
  items.reduce((sum, it) => sum + (typeof it.cost === 'number' ? it.cost : 0), 0);

/** Convierte una plantilla del API a datos listos para el formulario. */
export function applyTemplate(t: PackageTemplateSummary): AppliedTemplate {
  return {
    items: templateItemsToFormItems(t.items),
    totalPrice: t.totalPrice,
    notes: t.notes || '',
  };
}

export function TemplateActions({
  items,
  totalPrice,
  notes,
  onApply,
}: {
  items: BookingItemData[];
  totalPrice: number;
  notes: string;
  onApply: (data: AppliedTemplate) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templates, setTemplates] = useState<PackageTemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (!pickerOpen) return;
    setLoading(true);
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [pickerOpen]);

  const filtered = templates.filter((t) =>
    `${t.name} ${t.description || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handlePick = (t: PackageTemplateSummary) => {
    if (items.length > 0 && !window.confirm('Se reemplazarán los servicios que ya agregaste. ¿Continuar?')) return;
    onApply(applyTemplate(t));
    setPickerOpen(false);
    toast.success(`Plantilla "${t.name}" aplicada. Ajusta lo que necesites.`);
  };

  const handleSave = async () => {
    if (!saveForm.name.trim()) {
      toast.error('Ponle un nombre a la plantilla');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saveForm, totalPrice, notes, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Plantilla guardada');
      setSaveOpen(false);
      setSaveForm({ name: '', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5 min-w-0">
          <LayoutTemplate className="w-4 h-4 shrink-0" />
          <span className="truncate">Usar plantilla</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSaveOpen(true)}
          disabled={items.length === 0}
          title={items.length === 0 ? 'Agrega al menos un servicio' : undefined}
          className="gap-1.5 min-w-0"
        >
          <BookmarkPlus className="w-4 h-4 shrink-0" />
          {/* En celular no cabe el texto largo */}
          <span className="truncate sm:hidden">Guardar plantilla</span>
          <span className="hidden sm:inline">Guardar como plantilla</span>
        </Button>
      </div>

      {/* Picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-blue-500" />
              Usar plantilla
            </DialogTitle>
            <DialogDescription>
              Se cargan los servicios, el precio sugerido y las notas. Todo sigue siendo editable.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <RowsSkeleton rows={3} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {templates.length === 0
                  ? 'Aún no hay plantillas. Arma un paquete y usa "Guardar como plantilla".'
                  : 'Sin resultados'}
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePick(t)}
                  className="w-full text-left rounded-lg border p-3 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="mt-1.5"><TemplateItemsSummary items={t.items} /></div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Precio</p>
                      <p className="font-semibold text-sm">{formatCurrency(t.totalPrice)}</p>
                      <p className="text-[10px] text-muted-foreground">Neto {formatCurrency(templateNetCost(t.items))}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-blue-500" />
              Guardar como plantilla
            </DialogTitle>
            <DialogDescription>
              Se guardan {items.length} servicio{items.length !== 1 ? 's' : ''}, el precio y las notas. No se guardan
              cliente, fechas ni pasajeros.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={saveForm.name}
                onChange={(e) => setSaveForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Cancún 4 noches todo incluido + vuelo"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={saveForm.description}
                onChange={(e) => setSaveForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} variant="gradient">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
