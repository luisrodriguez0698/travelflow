'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, KeyRound, Link2, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCan } from '@/hooks/use-can';

interface ShareInfo {
  enabled: boolean;
  url: string | null;
  pinRequired: boolean;
  pinAvailable: boolean;
  pinHint: string | null;
  clientPhone: string | null;
  clientName: string;
  views: number;
  lastViewedAt: string | null;
}

function whatsappTo(phone: string | null, text: string) {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = `52${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Link del cliente: pagina con su viaje y pagos (siempre actualizada).
 * Activar/desactivar, PIN con los 4 ultimos digitos, copiar, WhatsApp y regenerar.
 */
export function ClientLinkButton({ saleId }: { saleId: string }) {
  const can = useCan();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const canEdit = can('ventas', 'edit');

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/${saleId}/share`);
    if (res.ok) setInfo(await res.json());
  }, [saleId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const act = async (action: 'enable' | 'disable' | 'regenerate' | 'pin', extra: object = {}) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setInfo(data);
      if (action === 'regenerate') toast({ title: 'Link nuevo generado', description: 'El anterior ya no funciona.' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo actualizar', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!info?.url) return;
    navigator.clipboard?.writeText(info.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const firstName = info?.clientName.split(/\s+/)[0] ?? '';
  const message = info?.url
    ? `¡Hola ${firstName}! ✈️ Aquí puedes ver tu viaje y tus pagos, siempre actualizados:\n${info.url}${
        info.pinRequired ? '\n\nPara entrar escribe los 4 últimos dígitos de tu teléfono.' : ''
      }`
    : '';

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Link2 className="w-4 h-4 mr-2" />
        Link para el cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link para el cliente</DialogTitle>
            <DialogDescription>
              Una página bonita con su viaje, fotos del hotel y el avance de sus pagos. Se actualiza sola con cada abono: ya no hace falta
              reenviar el PDF.
            </DialogDescription>
          </DialogHeader>

          {!info ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !info.enabled ? (
            <div className="py-4 space-y-4 text-center">
              <p className="text-sm text-muted-foreground">El link de esta venta aún no está activo.</p>
              {canEdit && (
                <Button variant="gradient" onClick={() => act('enable')} disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Activar link
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <p className="flex-1 truncate font-mono text-xs px-1">{info.url}</p>
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <a href={info.url ?? '#'} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" title="Abrir">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>

              <a href={whatsappTo(info.clientPhone, message)} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enviar por WhatsApp a {firstName}
                </Button>
              </a>

              <div className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-primary" />
                    Pedir los 4 últimos dígitos del teléfono
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {info.pinAvailable
                      ? `Si el link se reenvía, nadie más puede verlo. El PIN de este cliente termina en ${info.pinHint}.`
                      : 'El cliente no tiene un teléfono válido registrado: el link se abre sin PIN.'}
                  </p>
                </div>
                <Switch
                  checked={info.pinRequired}
                  disabled={!info.pinAvailable || busy || !canEdit}
                  onCheckedChange={(v) => act('pin', { pinRequired: v })}
                />
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {info.views > 0
                  ? `Abierto ${info.views} ${info.views === 1 ? 'vez' : 'veces'} · última: ${new Date(info.lastViewedAt!).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'El cliente aún no lo ha abierto'}
              </p>

              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  <Button variant="ghost" size="sm" onClick={() => act('regenerate')} disabled={busy}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Generar link nuevo
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => act('disable')} disabled={busy}>
                    Desactivar link
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
