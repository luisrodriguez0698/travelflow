'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Link2, Loader2, MessageCircle, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import { ClientLinkDialog, shareMessage, whatsappTo, type ShareInfo } from '@/components/client-link-dialog';

/**
 * Acceso rapido al link del cliente desde la tabla de ventas: icono verde si
 * esta activo, gris si no. Copiar, WhatsApp, abrir, activar o mas opciones.
 */
export function SaleLinkMenu({ saleId, active, onChanged }: { saleId: string; active: boolean; onChanged?: () => void }) {
  const can = useCan();
  const { toast } = useToast();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canEdit = can('ventas', 'edit');

  // La direccion se pide al abrir el menu (depende del dominio verificado de la agencia)
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/share`);
      if (res.ok) setInfo(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setInfo(data);
      await navigator.clipboard?.writeText(data.url).catch(() => {});
      toast({ title: 'Link activado y copiado', description: 'Ya puedes pegarlo en WhatsApp o abrirlo.' });
      onChanged?.();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo activar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!info?.url) return;
    navigator.clipboard?.writeText(info.url).then(
      () => toast({ title: 'Link copiado' }),
      () => toast({ title: 'No se pudo copiar', variant: 'destructive' })
    );
  };

  const enabled = info ? info.enabled : active;
  const firstName = info?.clientName.split(/\s+/)[0] ?? 'cliente';

  return (
    <>
      <DropdownMenu modal={false} onOpenChange={(open) => open && load()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            title={enabled ? 'Link del cliente (activo)' : 'Link del cliente (sin activar)'}
            className={cn(
              'relative',
              enabled ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40' : 'text-muted-foreground'
            )}
          >
            <Link2 className="w-4 h-4" />
            {enabled && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center justify-between">
            Link del cliente
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : (
              <span className={cn('text-[11px] font-medium', enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                {enabled ? 'Activo' : 'Sin activar'}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {enabled ? (
            <>
              <DropdownMenuItem disabled={!info?.url} onSelect={copy}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar link
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!info?.url} asChild>
                <a href={info ? whatsappTo(info.clientPhone, shareMessage(info)) : '#'} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2 text-emerald-500" />
                  Enviar por WhatsApp a {firstName}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!info?.url} asChild>
                <a href={info?.url ?? '#'} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir página
                </a>
              </DropdownMenuItem>
              {info && info.views > 0 && (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  Abierto {info.views} {info.views === 1 ? 'vez' : 'veces'} por el cliente
                </p>
              )}
            </>
          ) : canEdit ? (
            <DropdownMenuItem onSelect={enable} disabled={loading}>
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              Activar y copiar link
            </DropdownMenuItem>
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Pide a alguien con permiso de editar ventas que lo active.</p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTimeout(() => setDialogOpen(true), 0)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Más opciones (PIN, regenerar…)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientLinkDialog
        saleId={saleId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={() => {
          setInfo(null);
          onChanged?.();
        }}
      />
    </>
  );
}
