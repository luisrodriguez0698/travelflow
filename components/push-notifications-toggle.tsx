'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useToast } from '@/hooks/use-toast';

// Notificaciones push en ESTE dispositivo: cuotas por vencer/vencidas y avisos de
// actividad del equipo (ventas, abonos, ingresos) aunque la app este cerrada.
export function PushNotificationsToggle() {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleChange = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        await subscribe();
        toast({ title: 'Notificaciones activadas', description: 'Te avisaremos en este dispositivo aunque la app esté cerrada.' });
      } else {
        await unsubscribe();
        toast({ title: 'Notificaciones desactivadas' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo cambiar la configuración', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Notificaciones</p>
        {/* Mientras revisa (loading) se asume compatible para no parpadear el aviso */}
        {isSupported || loading ? (
          <p className="text-sm text-muted-foreground">
            Cuotas por vencer y la actividad de tu equipo (ventas, abonos, ingresos) en este dispositivo, aunque la app esté cerrada.
          </p>
        ) : (
          // iPhone/iPad en Safari: Apple solo permite notificaciones con la app instalada
          <p className="text-sm text-muted-foreground">
            Este navegador no las permite. En iPhone, instala la app (Compartir → Agregar a pantalla de inicio) y
            actívalas desde ahí.
          </p>
        )}
      </div>
      {(isSupported || loading) && (
        <Switch checked={isSubscribed} disabled={loading || busy} onCheckedChange={handleChange} className="shrink-0" />
      )}
    </div>
  );
}
