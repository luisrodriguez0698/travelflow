'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { LayoutTemplate, Plus, Search, Loader2, Pencil, Trash2, ShoppingCart, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionGate } from '@/components/permission-gate';
import { TemplateItemsSummary, templateNetCost } from '@/components/template-actions';
import type { PackageTemplateSummary } from '@/lib/package-template';
import { CreatorHistoryButton } from '@/components/record-history';
import { RowsSkeleton } from '@/components/skeletons';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PackageTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PackageTemplateSummary | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await fetch(`/api/templates${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchTemplates, 300);
    return () => clearTimeout(timer);
  }, [fetchTemplates]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/templates/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Plantilla eliminada');
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plantillas</h1>
          <p className="text-muted-foreground">
            Paquetes armados para crear ventas y cotizaciones sin capturar todo de nuevo
          </p>
        </div>
        <Link href="/templates/new">
          <Button data-tour="page-action" variant="gradient">
            <Plus className="w-4 h-4 mr-2" />
            Nueva plantilla
          </Button>
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-tour="page-filters" placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RowsSkeleton rows={3} />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-10 text-center">
          <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-blue-500 opacity-40" />
          <p className="font-medium">{search ? 'Sin resultados' : 'Aún no hay plantillas'}</p>
          {!search && (
            <p className="text-sm text-muted-foreground mt-1">
              Crea una aquí o usa &quot;Guardar como plantilla&quot; al capturar una venta o cotización.
            </p>
          )}
        </Card>
      ) : (
        <div data-tour="page-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const net = templateNetCost(t.items);
            const profit = t.totalPrice - net;
            return (
              <Card key={t.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{t.name}</p>
                    {t.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
                  </div>
                  <div className="flex items-center shrink-0">
                    <CreatorHistoryButton entity="templates" entityId={t.id} title={t.name} />
                    <Link href={`/templates/${t.id}`}>
                      <Button variant="ghost" size="icon" title="Editar"><Pencil className="w-4 h-4" /></Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Eliminar"
                      onClick={() => setDeleteTarget(t)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <TemplateItemsSummary items={t.items} />

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Neto</p>
                    <p className="text-sm font-semibold">{formatCurrency(net)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Precio</p>
                    <p className="text-sm font-semibold">{formatCurrency(t.totalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ganancia</p>
                    <p className={`text-sm font-semibold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {formatCurrency(profit)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-auto">
                  <PermissionGate module="ventas">
                    <Link href={`/sales/new?template=${t.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" />Crear venta
                      </Button>
                    </Link>
                  </PermissionGate>
                  <PermissionGate module="cotizaciones">
                    <Link href={`/quotations/new?template=${t.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <FileText className="w-3.5 h-3.5" />Crear cotización
                      </Button>
                    </Link>
                  </PermissionGate>
                </div>

                {t.creatorName && (
                  <p className="text-[11px] text-muted-foreground">Creada por {t.creatorName}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar <strong>{deleteTarget?.name}</strong>? Las ventas y cotizaciones creadas con ella no se modifican.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
