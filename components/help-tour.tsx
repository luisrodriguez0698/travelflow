'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { HelpCircle, PlayCircle, Compass, BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ALL_TOURS, GENERAL_TOUR, SECTION_TOURS, tourForPath, type TourDef } from '@/lib/tours';

const seenKey = (userId: string) => `tf-tour-general-seen:${userId}`;

function storageGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* modo privado */ }
}

/** Primer elemento visible con ese data-tour (sidebar movil y escritorio comparten marcas). */
function findVisible(name: string): Element | null {
  const nodes = document.querySelectorAll(`[data-tour="${CSS.escape(name)}"]`);
  for (const node of Array.from(nodes)) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth) return node;
  }
  return null;
}

function buildSteps(tour: TourDef): DriveStep[] {
  return tour.steps.flatMap((step) => {
    const popover = { title: step.title, description: step.description };
    if (!step.element) return [{ popover }];
    const element = findVisible(step.element);
    return element ? [{ element, popover }] : [];
  });
}

function runTour(tour: TourDef, onFinish?: () => void) {
  const steps = buildSteps(tour);
  if (steps.length === 0) return;
  const d = driver({
    steps,
    showProgress: steps.length > 1,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Listo',
    allowClose: true,
    smoothScroll: true,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'travelflow-tour',
    onDestroyed: () => onFinish?.(),
  });
  d.drive();
}

/**
 * Espera a que la pagina pinte sus elementos (las listas cargan datos por
 * fetch) antes de arrancar; si tarda demasiado arranca con lo que haya.
 */
function runWhenReady(tour: TourDef, onFinish?: () => void) {
  const targets = tour.steps.map((s) => s.element).filter(Boolean) as string[];
  const started = Date.now();
  const tick = () => {
    const found = targets.filter((t) => findVisible(t)).length;
    if (found === targets.length || Date.now() - started > 4000) runTour(tour, onFinish);
    else setTimeout(tick, 250);
  };
  setTimeout(tick, 300);
}

export function HelpMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissions: string[] | undefined = user?.permissions;
  const autoStarted = useRef(false);

  const canSee = useCallback(
    (tour: TourDef) => !tour.module || !permissions || permissions.includes(tour.module),
    [permissions]
  );

  const markGeneralSeen = useCallback(() => {
    if (user?.id) storageSet(seenKey(user.id), '1');
  }, [user?.id]);

  // Tours que llegan por URL (?tour=<id>) desde el menu de ayuda
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('tour');
    if (!id) return;
    const tour = ALL_TOURS.find((t) => t.id === id && t.path === pathname);
    router.replace(pathname);
    if (tour) runWhenReady(tour, tour.id === 'general' ? markGeneralSeen : undefined);
  }, [pathname, router, markGeneralSeen]);

  // Recorrido general automatico la primera vez que el usuario entra
  useEffect(() => {
    if (!user?.id || autoStarted.current || pathname !== GENERAL_TOUR.path) return;
    if (new URLSearchParams(window.location.search).get('tour')) return;
    if (storageGet(seenKey(user.id))) return;
    autoStarted.current = true;
    runWhenReady(GENERAL_TOUR, markGeneralSeen);
  }, [user?.id, pathname, markGeneralSeen]);

  const startTour = (tour: TourDef) => {
    const onFinish = tour.id === 'general' ? markGeneralSeen : undefined;
    // Pequena espera para que el menu termine de cerrarse antes de resaltar
    if (tour.path === pathname) setTimeout(() => runTour(tour, onFinish), 150);
    else router.push(`${tour.path}?tour=${tour.id}`);
  };

  const current = tourForPath(pathname);
  const sections = SECTION_TOURS.filter(canSee);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-tour="navbar-help" variant="ghost" size="icon" aria-label="Ayuda">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>Ayuda</DropdownMenuLabel>
        {current && canSee(current) && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => startTour(current)}>
            <PlayCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Guía de esta sección</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer" onClick={() => startTour(GENERAL_TOUR)}>
          <Compass className="mr-2 h-4 w-4 text-cyan-500" />
          <span>Recorrido general</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> Guías por apartado
        </DropdownMenuLabel>
        {sections.map((tour) => (
          <DropdownMenuItem key={tour.id} className="cursor-pointer pl-8" onClick={() => startTour(tour)}>
            {tour.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
