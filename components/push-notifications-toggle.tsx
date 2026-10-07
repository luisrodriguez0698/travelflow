'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationsToggle() {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (!isSupported) return null;

  const handleChange = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        await subscribe();
        toast({ title: 'Notificaciones activadas', description: 'Te avisaremos de pagos próximos a vencer o vencidos.' });
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
        <p className="font-medium">Notificaciones de pagos</p>
        <p className="text-sm text-muted-foreground">Recibe un aviso cuando una cuota esté por vencer o ya haya vencido.</p>
      </div>
      <Switch checked={isSubscribed} disabled={loading || busy} onCheckedChange={handleChange} className="shrink-0" />
    </div>
  );
}
