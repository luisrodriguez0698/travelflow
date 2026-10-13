'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, Globe, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCan } from '@/hooks/use-can';

interface DomainStatus {
  domain: string | null;
  verified: boolean;
  verifiedAt: string | null;
}

/**
 * Dominio propio de la agencia (miagencia.com): su pagina web y los links que
 * se mandan a los clientes. Solo se usa cuando esta verificado.
 */
export function CustomDomainCard() {
  const can = useCan();
  const { toast } = useToast();
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'save' | 'verify' | 'remove' | null>(null);
  const canEdit = can('configuracion', 'edit');

  useEffect(() => {
    fetch('/api/settings/domain')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DomainStatus | null) => {
        if (!d) return;
        setStatus(d);
        setInput(d.domain ?? '');
      })
      .catch(() => {});
  }, []);

  const call = async (kind: 'save' | 'verify' | 'remove') => {
    setBusy(kind);
    try {
      const res = await fetch('/api/settings/domain', {
        method: kind === 'save' ? 'PUT' : kind === 'verify' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: kind === 'save' ? JSON.stringify({ domain: input }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setStatus(data);
      setInput(data.domain ?? '');
      if (kind === 'remove') toast({ title: 'Dominio quitado', description: 'Los links usarán el dominio del sistema.' });
      else if (data.verified) toast({ title: '¡Dominio conectado!', description: `Tus clientes verán ${data.domain}.` });
      else toast({ title: 'Aún no está conectado', description: 'Revisa los pasos de abajo y vuelve a verificar en unos minutos.', variant: 'destructive' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message || 'No se pudo completar', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (!status) return null;
  const changed = input.trim().toLowerCase() !== (status.domain ?? '');

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Dominio propio</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Tu página web y los links que envías a tus clientes (su viaje y sus pagos) se verán con tu marca, por ejemplo{' '}
        <span className="font-medium text-foreground">miagencia.com</span>. Es opcional: sin dominio propio todo sigue funcionando con el dominio del sistema.
      </p>

      {status.domain && (
        <div
          className={`mb-5 flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
            status.verified ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'
          }`}
        >
          {status.verified ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{status.domain}</p>
            <p className="text-xs text-muted-foreground">
              {status.verified
                ? `Conectado · verificado el ${new Date(status.verifiedAt!).toLocaleDateString('es-MX', { dateStyle: 'medium' })}`
                : 'Pendiente de conectar: mientras tanto se usa el dominio del sistema'}
            </p>
          </div>
          {status.verified && (
            <a href={`https://${status.domain}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Ver página
              </Button>
            </a>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => call('verify')} disabled={!!busy}>
              {busy === 'verify' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Verificar conexión
            </Button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>Tu dominio</Label>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="miagencia.com" autoComplete="off" spellCheck={false} />
          </div>
          <Button onClick={() => call('save')} disabled={!!busy || !input.trim() || !changed}>
            {busy === 'save' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {status.domain ? 'Cambiar dominio' : 'Guardar dominio'}
          </Button>
          {status.domain && (
            <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => call('remove')} disabled={!!busy}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {!status.verified && (
        <div className="mt-5 rounded-lg bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">¿Cómo conectarlo?</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Escribe tu dominio y guárdalo (por ejemplo, el que ya usas o uno nuevo).</li>
            <li>Pide a soporte de TravelFlow que lo dé de alta en el servidor: te compartirá los registros DNS (CNAME).</li>
            <li>Agrega esos registros donde compraste tu dominio (GoDaddy, Hostinger, Namecheap…).</li>
            <li>Espera a que se propaguen (de minutos a unas horas) y da clic en <b>Verificar conexión</b>.</li>
          </ol>
        </div>
      )}
    </Card>
  );
}
