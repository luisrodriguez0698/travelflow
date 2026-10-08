'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { BookingItemsForm, BookingItemData } from '@/components/booking-items-form';
import { templateItemsToFormItems } from '@/lib/package-template';

interface Season { id: string; name: string; color: string; }
interface Destination { id: string; name: string; description: string; season?: Season | null; }
interface Supplier { id: string; name: string; phone: string; serviceType: string; }

// /templates/new crea; /templates/<id> edita
export default function TemplateEditorPage({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<BookingItemData[]>([]);
  const [form, setForm] = useState({ name: '', description: '', totalPrice: 0, notes: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/destinations').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/suppliers?all=true').then((r) => (r.ok ? r.json() : [])),
      isNew ? Promise.resolve(null) : fetch(`/api/templates/${params.id}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, sup, template]) => {
        setDestinations(Array.isArray(d) ? d : []);
        setSuppliers(Array.isArray(sup) ? sup : []);
        if (!isNew) {
          if (!template) {
            toast.error('Plantilla no encontrada');
            router.push('/templates');
            return;
          }
          setForm({
            name: template.name,
            description: template.description || '',
            totalPrice: template.totalPrice || 0,
            notes: template.notes || '',
          });
          setItems(templateItemsToFormItems(template.items || []));
        }
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [isNew, params.id, router]);

  const netCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
  const profit = form.totalPrice - netCost;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isNew ? '/api/templates' : `/api/templates/${params.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(isNew ? 'Plantilla creada' : 'Plantilla actualizada');
      router.push('/templates');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/templates">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{isNew ? 'Nueva plantilla' : 'Editar plantilla'}</h1>
            <p className="text-xs text-muted-foreground">Sin cliente ni fechas: se definen al usarla en una venta o cotización</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="gradient">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isNew ? 'Crear plantilla' : 'Guardar cambios'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-6 items-start">
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos de la plantilla</p>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Cancún 4 noches todo incluido + vuelo"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Para identificarla rápido (opcional)"
                rows={2}
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precio sugerido</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de venta ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.totalPrice || ''}
                  onChange={(e) => setForm((p) => ({ ...p, totalPrice: parseFloat(e.target.value) || 0 }))}
                  className="text-lg font-semibold"
                  placeholder="0"
                />
              </div>
              {netCost > 0 && form.totalPrice > 0 && (
                <div className="space-y-2">
                  <Label>Ganancia</Label>
                  <div className={`flex items-center h-11 px-3 rounded-lg border font-semibold text-lg ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    ${profit.toLocaleString('es-MX')}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Se copian a la venta o cotización"
                rows={3}
              />
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4">
          <Card className="overflow-hidden border-2 border-blue-100 dark:border-blue-900/50">
            <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
              <div className="flex items-center gap-2 mb-1">
                <LayoutTemplate className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-sm">Servicios de la plantilla</h2>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pasajeros, fechas de tours y números de reservación se capturan al usarla
              </p>
            </div>
            <div className="p-4 lg:max-h-[calc(100vh-300px)] lg:overflow-y-auto">
              <BookingItemsForm
                items={items}
                onChange={setItems}
                destinations={destinations}
                suppliers={suppliers}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
