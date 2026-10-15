'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CameraOff, CheckCircle2, Loader2, ScanLine, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { SupplierLogo } from '@/components/supplier-logo';
import { cn } from '@/lib/utils';
import type { EventGuestRow } from './event-types';

type ScanResult =
  | { result: 'ok' | 'already'; guest: { name: string; supplier: { name: string; logo: string | null } | null }; checkedInAt: string }
  | { result: 'invalid'; message: string };

const TZ = 'America/Mexico_City';
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  guests: EventGuestRow[];
  onCheckedIn: () => void;
}

/** Lector de QR con la camara (registro de llegada) + busqueda manual por nombre. */
export function CheckinScanner({ open, onOpenChange, eventId, guests, onCheckedIn }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>();
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState('');

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const submitCode = useCallback(
    async (code: string) => {
      busyRef.current = true;
      setChecking(true);
      try {
        const res = await fetch(`/api/events/${eventId}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResult({ result: 'invalid', message: data.error || 'No se pudo registrar' });
        } else {
          setResult(data as ScanResult);
          if (data.result === 'ok') {
            navigator.vibrate?.(120);
            onCheckedIn();
          } else {
            navigator.vibrate?.([60, 60, 60]);
          }
        }
      } catch {
        setResult({ result: 'invalid', message: 'Sin conexión. Intenta de nuevo.' });
      } finally {
        setChecking(false);
      }
    },
    [eventId, onCheckedIn]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (!busyRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        const now = Date.now();
        const last = lastCodeRef.current;
        // El mismo codigo seguido no se vuelve a enviar (3 s)
        if (found?.data && !(last && last.code === found.data && now - last.at < 3000)) {
          lastCodeRef.current = { code: found.data, at: now };
          submitCode(found.data);
        }
      }
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  }, [submitCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador no permite usar la cámara. Usa la búsqueda por nombre.');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      // Se cerro mientras pedia permiso: soltar la camara
      if (!openRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // El <video> puede montarse un instante despues que el dialogo
      for (let i = 0; i < 30 && !videoRef.current; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError('No se pudo abrir la cámara. Revisa que el navegador tenga permiso para usarla.');
    } finally {
      setStarting(false);
    }
  }, [scanFrame]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setResult(null);
      setQuery('');
      busyRef.current = false;
      return;
    }
    startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  const next = () => {
    setResult(null);
    busyRef.current = false;
  };

  const matches = query.trim().length >= 2
    ? guests
        .filter((g) => `${g.name} ${g.phone} ${g.supplier?.name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Registrar llegada
          </DialogTitle>
          <DialogDescription>Apunta la cámara al código QR de la invitación.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Marco de lectura */}
          {!cameraError && !result && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-3/5 w-3/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <motion.div
                  className="absolute inset-x-2 h-0.5 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.8)]"
                  animate={{ top: ['8%', '92%', '8%'] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
          )}

          {(starting || checking) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <CameraOff className="h-10 w-10 text-white/70" />
              <p className="text-sm">{cameraError}</p>
              <Button size="sm" variant="secondary" onClick={startCamera}>
                Reintentar
              </Button>
            </div>
          )}

          {/* Resultado */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white',
                  result.result === 'ok' ? 'bg-emerald-600/95' : result.result === 'already' ? 'bg-amber-500/95' : 'bg-red-600/95'
                )}
              >
                {result.result === 'ok' ? (
                  <CheckCircle2 className="h-14 w-14" />
                ) : result.result === 'already' ? (
                  <AlertTriangle className="h-14 w-14" />
                ) : (
                  <XCircle className="h-14 w-14" />
                )}
                {result.result === 'invalid' ? (
                  <p className="text-lg font-bold">{result.message}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium uppercase tracking-widest text-white/80">
                      {result.result === 'ok' ? '¡Bienvenido(a)!' : `Ya había entrado a las ${timeLabel(result.checkedInAt)}`}
                    </p>
                    <p className="text-2xl font-black leading-tight">{result.guest.name}</p>
                    {result.guest.supplier && (
                      <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5">
                        <SupplierLogo name={result.guest.supplier.name} logo={result.guest.supplier.logo} className="h-8 w-10" />
                        <span className="text-sm font-semibold">{result.guest.supplier.name}</span>
                      </div>
                    )}
                  </>
                )}
                <Button variant="secondary" className="mt-2" onClick={next}>
                  Escanear siguiente
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Busqueda manual (sin QR o sin camara) */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="¿No trae su QR? Búscalo por nombre o teléfono" className="pl-9" />
          </div>
          {matches.length > 0 && (
            <div className="divide-y rounded-lg border">
              {matches.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{g.supplier?.name ?? 'Sin proveedor'}</p>
                  </div>
                  {g.checkedInAt ? (
                    <span className="shrink-0 text-xs text-emerald-600">Llegó {timeLabel(g.checkedInAt)}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checking}
                      onClick={() => {
                        setQuery('');
                        submitCode(g.token);
                      }}
                    >
                      Registrar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
