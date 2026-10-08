'use client';

import { Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useToast } from '@/hooks/use-toast';

export function InstallAppCard() {
  const { canInstall, isInstalled, isIos, promptInstall } = useInstallPrompt();
  const { toast } = useToast();

  if (isInstalled) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">App instalada</p>
          <p className="text-sm text-muted-foreground">Ya estás usando TravelFlow como app.</p>
        </div>
      </div>
    );
  }

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      toast({ title: 'App instalada', description: 'TravelFlow ya está en tu pantalla de inicio.' });
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border">
      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Instalar la app</p>
        {isIos ? (
          <p className="text-sm text-muted-foreground">
            Toca <span className="font-medium">Compartir</span> en Safari y luego{' '}
            <span className="font-medium">Agregar a pantalla de inicio</span>.
          </p>
        ) : canInstall ? (
          <p className="text-sm text-muted-foreground">Acceso directo desde tu pantalla de inicio, como app nativa.</p>
        ) : (
          // Sin beforeinstallprompt: navegador sin soporte (Firefox/Safari escritorio)
          // o el usuario ya descarto el aviso; Chrome/Edge siguen ofreciendo el icono
          <p className="text-sm text-muted-foreground">
            En Chrome o Edge usa el icono de <span className="font-medium">instalar</span> en la barra
            de direcciones, o el menú <span className="font-medium">⋮ → Instalar TravelFlow</span>.
          </p>
        )}
      </div>
      {!isIos && (
        <Button onClick={handleInstall} disabled={!canInstall} variant="outline" className="shrink-0">
          Instalar
        </Button>
      )}
    </div>
  );
}
