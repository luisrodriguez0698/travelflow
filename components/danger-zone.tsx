'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { AlertTriangle, RotateCcw, Trash2, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const CONFIRM_PHRASE = 'RESTABLECER';

type Scope = 'sales' | 'supplierPayments' | 'banks' | 'clients' | 'goals' | 'audit';

interface Counts {
  sales: number;
  quotations: number;
  supplierPayments: number;
  bankAccounts: number;
  bankTransactions: number;
  clients: number;
  goals: number;
  audit: number;
}

const SCOPE_OPTIONS: { value: Scope; label: string; detail: (c: Counts) => string }[] = [
  {
    value: 'sales',
    label: 'Ventas y cotizaciones',
    detail: (c) => `${c.sales} ventas y ${c.quotations} cotizaciones, con sus servicios, pasajeros, planes de pago y deudas con proveedores`,
  },
  {
    value: 'supplierPayments',
    label: 'Pagos a proveedores',
    detail: (c) => `${c.supplierPayments} pagos registrados`,
  },
  {
    value: 'banks',
    label: 'Bancos',
    detail: (c) => `${c.bankAccounts} cuentas y ${c.bankTransactions} movimientos`,
  },
  {
    value: 'clients',
    label: 'Clientes',
    detail: (c) => `${c.clients} clientes (también borra sus ventas)`,
  },
  { value: 'goals', label: 'Metas de venta', detail: (c) => `${c.goals} metas` },
  { value: 'audit', label: 'Bitácora', detail: (c) => `${c.audit} registros de historial` },
];

const KEPT = ['Proveedores', 'Hoteles', 'Destinos', 'Temporadas', 'Servicios', 'Plantillas', 'Usuarios y roles', 'Configuración'];

/** Mismas dependencias que valida el servidor (lib/account-danger.ts). */
function withDependencies(scopes: Set<Scope>): Set<Scope> {
  const result = new Set(scopes);
  if (result.has('clients')) result.add('sales');
  if (result.has('banks') || result.has('sales')) result.add('supplierPayments');
  return result;
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="current-password"
        placeholder="Tu contraseña actual"
        className="pr-10"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        onClick={() => setShow(!show)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function DangerZone() {
  const [isOwner, setIsOwner] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selected, setSelected] = useState<Set<Scope>>(new Set(['sales', 'supplierPayments', 'banks', 'goals']));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        setIsOwner(!!p?.isOwner);
        setAgencyName(p?.tenantName || '');
      })
      .catch(() => setIsOwner(false));
  }, []);

  useEffect(() => {
    if (!resetOpen) return;
    setCounts(null);
    fetch('/api/account/reset')
      .then((r) => (r.ok ? r.json() : null))
      .then(setCounts)
      .catch(() => setCounts(null));
  }, [resetOpen]);

  // Solo el propietario ve esta seccion (el servidor tambien lo valida)
  if (!isOwner) return null;

  const effective = withDependencies(selected);

  const resetDialogs = () => {
    setPassword('');
    setConfirm('');
  };

  const toggle = (scope: Scope, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return next;
    });
  };

  const handleReset = async () => {
    setWorking(true);
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: [...effective], password, confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Datos restablecidos');
      setResetOpen(false);
      resetDialogs();
      // Recarga para que ninguna pantalla muestre datos ya borrados
      setTimeout(() => window.location.assign('/dashboard'), 800);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo restablecer');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteAgency = async () => {
    setWorking(true);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmName: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Agencia eliminada');
      await signOut({ callbackUrl: '/login' });
    } catch (err: any) {
      toast.error(err.message || 'No se pudo eliminar la agencia');
      setWorking(false);
    }
  };

  return (
    <>
      <Card data-tour="settings-danger" className="p-6 border-red-200 dark:border-red-900/60">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Zona de peligro</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Solo tú, como propietario de la agencia, ves esta sección. Estas acciones no se pueden deshacer.
        </p>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Restablecer datos</p>
              <p className="text-sm text-muted-foreground">
                Borra ventas, bancos, pagos y lo que elijas. Conserva proveedores, hoteles y demás catálogos.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
              onClick={() => { resetDialogs(); setResetOpen(true); }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restablecer
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/10 p-4">
            <div>
              <p className="font-medium">Eliminar la agencia</p>
              <p className="text-sm text-muted-foreground">
                Borra la agencia completa: usuarios, catálogos, ventas, bancos e historial.
              </p>
            </div>
            <Button
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { resetDialogs(); setDeleteOpen(true); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar agencia
            </Button>
          </div>
        </div>
      </Card>

      {/* Restablecer */}
      <Dialog open={resetOpen} onOpenChange={(o) => { if (!working) setResetOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <RotateCcw className="w-5 h-5" />
              Restablecer datos
            </DialogTitle>
            <DialogDescription>Elige qué borrar. Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((opt) => {
                const forced = effective.has(opt.value) && !selected.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      effective.has(opt.value)
                        ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <Checkbox
                      checked={effective.has(opt.value)}
                      disabled={forced}
                      onCheckedChange={(c) => toggle(opt.value, c === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {opt.label}
                        {forced && <span className="ml-2 text-xs font-normal text-muted-foreground">(se incluye por dependencia)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {counts ? opt.detail(counts) : 'Calculando...'}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 p-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Se conservan siempre
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">{KEPT.join(' · ')}</p>
            </div>

            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <PasswordField value={password} onChange={setPassword} />
            </div>
            <div className="space-y-2">
              <Label>
                Escribe <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> para confirmar *
              </Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={CONFIRM_PHRASE} autoComplete="off" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={working}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={working || !password || confirm !== CONFIRM_PHRASE || effective.size === 0}
              onClick={handleReset}
            >
              {working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Borrar seleccionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar agencia */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!working) setDeleteOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
              Eliminar la agencia
            </DialogTitle>
            <DialogDescription>
              Se borrará <strong>{agencyName}</strong> con todos sus usuarios, catálogos, ventas, bancos e historial.
              Nadie podrá volver a entrar. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <PasswordField value={password} onChange={setPassword} />
            </div>
            <div className="space-y-2">
              <Label>
                Escribe el nombre de la agencia <span className="font-semibold">{agencyName}</span> *
              </Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={agencyName} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={working}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={working || !password || confirm.trim() !== agencyName.trim()}
              onClick={handleDeleteAgency}
            >
              {working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar para siempre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
