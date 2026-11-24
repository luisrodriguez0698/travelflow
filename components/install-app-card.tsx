'use client';

import { useState } from 'react';
import { Smartphone, Check, Info, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** Pasos con numeros. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {i + 1}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

const b = (t: string) => <span className="font-medium text-foreground">{t}</span>;

export function InstallAppCard() {
  const { canInstall, isInstalled, platform, checked, promptInstall } = useInstallPrompt();
  const { toast } = useToast();
  const [helpOpen, setHelpOpen] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">App instalada</p>
          <p className="text-sm text-muted-foreground">Ya estás usando TravelFlow como app en este equipo.</p>
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

  // ── Lo que se explica segun el equipo ──
  let description: React.ReactNode;
  let help: React.ReactNode = null;

  if (platform === 'ios-safari') {
    description = 'En iPhone se instala desde Safari:';
    help = <Steps items={[<>Toca {b('Compartir')} (el cuadrito con flecha ↑)</>, <>Elige {b('Agregar a pantalla de inicio')}</>, <>Toca {b('Agregar')}</>]} />;
  } else if (platform === 'ios-other') {
    description = 'En iPhone solo se puede instalar desde Safari.';
    help = <Steps items={[<>Abre esta página en {b('Safari')}</>, <>Toca {b('Compartir')} → {b('Agregar a pantalla de inicio')}</>]} />;
  } else if (canInstall) {
    description = 'Acceso directo desde tu pantalla de inicio o escritorio, como una app.';
  } else if (!checked) {
    description = (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Revisando si se puede instalar en este equipo…
      </span>
    );
  } else if (platform === 'android') {
    // Chrome Android no ofrece instalar cuando ya esta instalada (o el aviso se cerro antes)
    description = 'Si ya la instalaste en este celular, ábrela desde tu pantalla de inicio. Si no:';
    help = (
      <Steps
        items={[
          <>Toca el menú {b('⋮')} de Chrome</>,
          <>Elige {b('Instalar app')} o {b('Agregar a pantalla principal')}</>,
          <>Si dice {b('Abrir app')}, ya está instalada en este celular</>,
        ]}
      />
    );
  } else if (platform === 'desktop-chromium') {
    // El caso que confunde: Chrome sincroniza las apps instaladas con tu cuenta de Google
    description = (
      <>
        Chrome indica que <b>ya está instalada</b> en este equipo. Suele pasar si la instalaste en otra computadora con la misma cuenta de
        Google en Chrome: Chrome la copia sola.
      </>
    );
    help = (
      <div className="mt-2 space-y-3 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Para abrirla</p>
          <Steps
            items={[
              <>Toca {b('Abrir en aplicación')} en la barra de direcciones (arriba a la derecha)</>,
              <>O búscala como {b('TravelFlow')} en el menú Inicio de Windows</>,
            ]}
          />
        </div>
        <div>
          <p className="font-medium text-foreground">Para reinstalarla desde cero</p>
          <Steps
            items={[
              <>Escribe {b('chrome://apps')} en la barra de direcciones</>,
              <>Clic derecho en TravelFlow → {b('Quitar de Chrome')}</>,
              <>Recarga esta página y toca {b('Instalar')}</>,
            ]}
          />
        </div>
        <p className="text-xs">
          ¿No quieres que se copie a tus otras computadoras? En Chrome → Configuración → Sincronización, desactiva {b('Apps')}.
        </p>
      </div>
    );
  } else {
    description = 'Este navegador no permite instalar apps. Ábrela en Chrome o Edge para instalarla.';
  }

  const showButton = platform !== 'ios-safari' && platform !== 'ios-other';

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Instalar la app</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {help && (platform.startsWith('ios') ? help : (
            <>
              <button
                type="button"
                onClick={() => setHelpOpen((o) => !o)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Info className="h-3.5 w-3.5" />
                {helpOpen ? 'Ocultar pasos' : 'Ver cómo hacerlo'}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', helpOpen && 'rotate-180')} />
              </button>
              {helpOpen && help}
            </>
          ))}
        </div>
        {showButton && (
          <Button onClick={handleInstall} disabled={!canInstall} variant="outline" className="shrink-0">
            Instalar
          </Button>
        )}
      </div>
    </div>
  );
}
