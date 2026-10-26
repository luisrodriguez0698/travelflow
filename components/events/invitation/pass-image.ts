import { ASSETS, TZ } from './assets';
import type { InvitationEvent, InvitationGuest } from '@/lib/special-events';

// Imagen del pase (PNG 1080x1600) para guardar en la galeria del celular.

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Corta el texto en lineas que quepan en el ancho. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function passImage(event: InvitationEvent, guest: InvitationGuest, qr: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const [bg, logo, cloud, qrImg] = await Promise.all([loadImage(ASSETS.background), loadImage(ASSETS.logo), loadImage(ASSETS.cloud), loadImage(qr)]);

  // Fondo
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1e3a8a');
    g.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (cloud) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(cloud, -200, H - 380, 1300, 524);
    ctx.globalAlpha = 1;
  }
  if (logo) ctx.drawImage(logo, (W - 420) / 2, 70, 420, 224);

  // Tarjeta
  const cx = 90;
  const cy = 340;
  const cw = W - 180;
  const ch = 1190;
  ctx.save();
  ctx.shadowColor = 'rgba(2,6,23,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  roundRect(ctx, cx, cy, cw, ch, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Banda superior
  ctx.save();
  roundRect(ctx, cx, cy, cw, 150, 48);
  ctx.clip();
  const band = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  band.addColorStop(0, '#1e3a8a');
  band.addColorStop(0.5, '#1d4ed8');
  band.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = band;
  ctx.fillRect(cx, cy, cw, 150);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('PASE DE ABORDAR', cx + 50, cy + 65);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px system-ui, sans-serif';
  ctx.fillText('PRIMERA CLASE', cx + 50, cy + 115);

  // Evento
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '900 54px system-ui, sans-serif';
  let y = cy + 240;
  for (const line of wrap(ctx, event.name, cw - 100).slice(0, 2)) {
    ctx.fillText(line, cx + 50, y);
    y += 62;
  }

  const d = new Date(event.startsAt);
  const day = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  /**
   * Etiqueta + valor. Si el valor no cabe, primero achica la letra (hasta 30px)
   * y despues lo parte en dos lineas. Devuelve cuanto alto ocupo.
   */
  const field = (label: string, value: string, x: number, fy: number) => {
    const maxWidth = cw / 2 - 60;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x, fy);
    ctx.fillStyle = '#0f172a';
    let size = 38;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (size > 30 && ctx.measureText(value).width > maxWidth) {
      size -= 2;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    const lines = wrap(ctx, value, maxWidth).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, x, fy + 48 + i * (size + 8)));
    return 48 + (lines.length - 1) * (size + 8);
  };
  /** Fila de dos campos: avanza lo que ocupe el mas alto. */
  const row = (left: [string, string], right: [string, string] | null) => {
    const h = Math.max(field(left[0], left[1], cx + 50, y), right ? field(right[0], right[1], cx + cw / 2 + 30, y) : 0);
    y += h + 72;
  };
  y += 20;
  row(['Pasajero', guest.name], ['Asiento', 'VIP']);
  row(['Fecha', day.charAt(0).toUpperCase() + day.slice(1)], ['Abordaje', time]);
  row(['Aerolínea', guest.supplier?.name ?? event.agency.name], event.venueName ? ['Lugar', event.venueName] : null);

  // Perforacion
  y -= 10;
  ctx.setLineDash([16, 14]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 40, y);
  ctx.lineTo(cx + cw - 40, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR
  if (qrImg) {
    const size = 330;
    ctx.drawImage(qrImg, (W - size) / 2, y + 40, size, size);
  }
  ctx.fillStyle = '#475569';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Muestra este código en la entrada', W / 2, y + 420);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
