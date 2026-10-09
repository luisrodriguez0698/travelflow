'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { isSoundEnabled, setSoundEnabled, playChime, unlockAudio, SOUND_CHANGE_EVENT } from '@/lib/notify-sound';

// Sonido de los avisos dentro de la app. Se guarda por dispositivo y se
// sincroniza con el boton 🔊 de la campana.
export function NotificationSoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const sync = () => setEnabled(isSoundEnabled());
    window.addEventListener(SOUND_CHANGE_EVENT, sync);
    return () => window.removeEventListener(SOUND_CHANGE_EVENT, sync);
  }, []);

  const handleChange = (checked: boolean) => {
    setEnabled(checked);
    setSoundEnabled(checked);
    if (checked) {
      unlockAudio();
      playChime(); // asi escucha como suena
    }
  };

  const Icon = enabled ? Volume2 : VolumeX;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Sonido de avisos</p>
        <p className="text-sm text-muted-foreground">Un tono corto cuando llega un aviso con la app abierta. Solo en este dispositivo.</p>
      </div>
      <Switch checked={enabled} onCheckedChange={handleChange} className="shrink-0" aria-label="Sonido de avisos" />
    </div>
  );
}
