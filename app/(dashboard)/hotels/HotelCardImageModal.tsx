'use client';

import { useRef, useState, useEffect, type CSSProperties } from 'react';
import { toPng } from 'html-to-image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Download, Loader2, ImageOff,
  CornerUpLeft, CornerUpRight, CornerDownLeft, CornerDownRight,
} from 'lucide-react';

const DEFAULT_IMG = 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8ssMAwLqQ2veqATUR7yWXE8xwNVbjnK14Jk39s';

type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const LOGO_POSITIONS: { value: LogoPosition; label: string; icon: typeof CornerUpLeft }[] = [
  { value: 'top-left', label: 'Arriba izquierda', icon: CornerUpLeft },
  { value: 'top-right', label: 'Arriba derecha', icon: CornerUpRight },
  { value: 'bottom-left', label: 'Abajo izquierda', icon: CornerDownLeft },
  { value: 'bottom-right', label: 'Abajo derecha', icon: CornerDownRight },
];

function logoPositionStyle(position: LogoPosition): CSSProperties {
  const offset = 8;
  const base: CSSProperties = { position: 'absolute' };
  if (position === 'top-left') return { ...base, top: offset, left: offset };
  if (position === 'top-right') return { ...base, top: offset, right: offset };
  if (position === 'bottom-left') return { ...base, bottom: offset, left: offset };
  return { ...base, bottom: offset, right: offset };
}

interface Hotel {
  id: string;
  name: string;
  images: string[];
  webDescription: string | null;
  packagePrice: number | null;
  packageCurrency: string | null;
}

interface Props {
  hotel: Hotel | null;
  open: boolean;
  onClose: () => void;
}

async function fetchAsBlobUrl(src: string): Promise<string> {
  try {
    // Fetched through our own origin so the browser never needs the R2 bucket's CORS headers
    const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return src;
  }
}

export function HotelCardImageModal({ hotel, open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('top-left');

  const images = hotel?.images?.length ? hotel.images : [DEFAULT_IMG];
  const currency = hotel?.packageCurrency ?? 'MXN';

  // Cada vez que cambia imagen seleccionada, cargarla como blob
  useEffect(() => {
    if (!open || !hotel) return;
    setImgLoading(true);
    setBlobUrl(null);
    setSelectedIdx(0);
  }, [hotel, open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setImgLoading(true);
    fetchAsBlobUrl(images[selectedIdx]).then((url) => {
      if (!alive) return;
      setBlobUrl(url);
      setImgLoading(false);
    });
    return () => { alive = false; };
  }, [selectedIdx, images, open]);

  // Logo del tenant, cargado una vez por apertura del modal
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLogoBlobUrl(null);
    fetch('/api/tenant/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.logoUrl) return;
        return fetchAsBlobUrl(data.logoUrl).then((url) => {
          if (alive) setLogoBlobUrl(url);
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  const handleDownload = async () => {
    if (!cardRef.current || !hotel) return;
    setDownloading(true);
    try {
      // cacheBust appends a "?timestamp" to every image URL, which breaks blob: URLs
      // (they don't support query strings) — the card image is already loaded fresh via blob.
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${hotel.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      /* silent */
    } finally {
      setDownloading(false);
    }
  };

  if (!hotel) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Vista previa del card</DialogTitle>
        </DialogHeader>

        {/* Selector de imágenes */}
        {images.length > 1 && (
          <div className="flex gap-2 flex-wrap justify-center pb-1">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`imagen ${i + 1}`}
                onClick={() => setSelectedIdx(i)}
                className={`w-14 h-14 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                  i === selectedIdx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              />
            ))}
          </div>
        )}

        {/* Posición del logo */}
        {logoBlobUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Posición del logo</Label>
            <div className="grid grid-cols-4 gap-2">
              {LOGO_POSITIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLogoPosition(value)}
                  title={label}
                  className={`flex items-center justify-center h-9 rounded-lg border transition-colors ${
                    logoPosition === value
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card a capturar */}
        <div className="flex justify-center py-2">
          <div
            ref={cardRef}
            style={{
              width: 300,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Imagen */}
            <div style={{ position: 'relative', width: '100%', height: 168, background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {imgLoading ? (
                <Loader2 style={{ width: 24, height: 24, color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
              ) : blobUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={blobUrl}
                  alt={hotel.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <ImageOff style={{ width: 32, height: 32, color: '#d1d5db' }} />
              )}

              {/* Logo pequeño, opacidad normal */}
              {logoBlobUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoBlobUrl}
                  alt="Logo"
                  style={{
                    ...logoPositionStyle(logoPosition),
                    height: 60,
                    width: 'auto',
                    maxWidth: 130,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              )}
            </div>

            {/* Contenido */}
            <div style={{ position: 'relative', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
              {/* Logo grande como marca de agua */}
              {logoBlobUrl && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoBlobUrl}
                    alt=""
                    style={{ width: '140%', height: 'auto', maxHeight: '140%', objectFit: 'contain', opacity: 0.1 }}
                  />
                </div>
              )}

              <p style={{ position: 'relative', color: '#0f2d5e', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, lineHeight: 1.3 }}>
                {hotel.name}
              </p>

              {hotel.webDescription && (
                <p style={{ position: 'relative', color: '#6b7280', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>
                  {hotel.webDescription}
                </p>
              )}

              {hotel.packagePrice != null && (
                <p style={{ position: 'relative', color: '#0f2d5e', fontWeight: 900, fontSize: 22, margin: '4px 0 0', lineHeight: 1 }}>
                  ${hotel.packagePrice.toLocaleString('es-MX')}{' '}
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>{currency}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <Button onClick={handleDownload} disabled={downloading || imgLoading} className="w-full mt-1">
          {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {downloading ? 'Generando...' : 'Descargar PNG'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
