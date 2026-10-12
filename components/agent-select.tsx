'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/user-avatar';

interface Agent {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

/**
 * Agente al que pertenece la venta/cotizacion. Por defecto, quien la crea;
 * solo con el permiso "Asignar" del apartado se puede elegir a otro usuario.
 * (El servidor vuelve a validar el permiso.)
 */
export function AgentSelect({
  module,
  value,
  onChange,
  autoSelectMe = true,
}: {
  module: 'ventas' | 'cotizaciones';
  /** Agente actual; null en una venta nueva (se toma el usuario actual) */
  value: string | null;
  onChange: (agentId: string) => void;
  /** En una venta nueva, preseleccionar al usuario actual (en edicion se respeta el valor guardado) */
  autoSelectMe?: boolean;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [canAssign, setCanAssign] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ module });
    if (value) params.set('current', value);
    fetch(`/api/agents?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAgents(d.agents);
        setCanAssign(d.canAssign);
        if (!value && autoSelectMe) onChange(d.me);
      })
      .catch(() => {});
    // Solo al montar / cambiar de registro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const label = (a: Agent) => a.name || a.email;
  const selected = agents.find((a) => a.id === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        Agente
        {!canAssign && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Sin permiso para cambiarlo" />}
      </Label>
      <Select value={value ?? undefined} onValueChange={onChange} disabled={!canAssign}>
        <SelectTrigger>
          <SelectValue placeholder={autoSelectMe ? 'Cargando…' : 'Sin agente asignado'}>
            {selected && (
              <span className="flex items-center gap-2 min-w-0">
                <UserAvatar name={label(selected)} src={selected.avatar} className="w-5 h-5 text-[9px]" />
                <span className="truncate">{label(selected)}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <UserAvatar name={label(a)} src={a.avatar} className="w-5 h-5 text-[9px]" />
                {label(a)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!canAssign && (
        <p className="text-[11px] text-muted-foreground">Queda a nombre de quien la registra. Para cambiarlo se necesita el permiso &quot;Asignar&quot;.</p>
      )}
    </div>
  );
}
