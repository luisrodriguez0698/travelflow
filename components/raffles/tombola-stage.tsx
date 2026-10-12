'use client';

import { useEffect, useRef } from 'react';
import { sfx } from './draw-sounds';
import { ticketHue, type DrawTicket, type StageProps } from './draw-types';

interface Ball {
  id: string;
  number: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  exiting?: boolean;
}

/** Cuantas esferas se dibujan como maximo (con miles de boletos se muestra una muestra) */
const MAX_BALLS = 70;
const EXIT_MS = 1100;

/** Orden pseudoaleatorio pero estable por boleto, para elegir la muestra visible */
function stableHash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickVisible(pool: DrawTicket[], target: DrawTicket | null) {
  const sorted = [...pool].sort((a, b) => stableHash(a.id) - stableHash(b.id)).slice(0, MAX_BALLS);
  if (target && !sorted.some((t) => t.id === target.id)) sorted[sorted.length - 1] = target;
  return sorted;
}

/**
 * Tombola: un tambor de cristal con esferas numeradas que rebotan con fisica
 * simple. Al girar, el tambor arrastra las esferas y un soplador las agita; al
 * final la esfera ganadora sale por la boquilla.
 */
export function TombolaStage({ pool, target, spinId, durationMs, onDone }: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>([]);
  const sizeRef = useRef(0);
  const spin = useRef<{ start: number; duration: number; target: string | null; done: boolean }>({ start: 0, duration: 0, target: null, done: true });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Mantener las esferas sincronizadas con los boletos en juego
  useEffect(() => {
    const visible = pickVisible(pool, target);
    const R = sizeRef.current * 0.4 || 150;
    const current = new Map(balls.current.map((b) => [b.id, b]));
    balls.current = visible.map(
      (t, i) =>
        current.get(t.id) ?? {
          id: t.id,
          number: t.number,
          x: (Math.random() - 0.5) * R * 0.8,
          y: -R * 0.5 + (i % 5) * 4,
          vx: (Math.random() - 0.5) * 40,
          vy: 0,
          hue: ticketHue(t.number),
        }
    );
  }, [pool, target]);

  // Nueva tirada
  useEffect(() => {
    if (!target || !spinId) return;
    spin.current = { start: performance.now(), duration: durationMs, target: target.id, done: false };
    const stopDrum = sfx.drumroll(Math.max(0, durationMs - EXIT_MS));
    return stopDrum;
  }, [spinId, target, durationMs]);

  // Bucle de animacion + fisica
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let angle = 0;
    let omega = 0;
    let last = performance.now();
    let lastRattle = 0;

    const resize = () => {
      const size = Math.max(200, Math.min(wrap.clientWidth, wrap.clientHeight));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = size;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const size = sizeRef.current;
      const R = size * 0.4;
      const cx = size / 2;
      const cy = size * 0.45;
      const s = spin.current;
      const elapsed = now - s.start;
      const spinning = !s.done && elapsed < s.duration - EXIT_MS;
      const exiting = !s.done && !spinning;
      const n = balls.current.length;
      const r = Math.max(9, Math.min(R * 0.15, (R * 0.62) / Math.sqrt(Math.max(1, n))));

      // Velocidad del tambor: acelera, sostiene y frena
      const targetOmega = spinning ? 5.5 : 0;
      omega += (targetOmega - omega) * Math.min(1, dt * (spinning ? 2.5 : 1.2));
      angle += omega * dt;
      const agitate = spinning ? Math.min(1, elapsed / 600) : 0;

      // Fisica (2 subpasos)
      for (let step = 0; step < 2; step++) {
        const h = dt / 2;
        for (const b of balls.current) {
          if (b.exiting) continue;
          b.vy += R * 2.4 * h;
          if (agitate) {
            // Soplador: empuja hacia arriba con mas fuerza abajo
            const low = Math.max(0, b.y / R + 0.3);
            b.vy -= Math.random() * R * 9 * low * agitate * h;
            b.vx += (Math.random() - 0.5) * R * 7 * agitate * h;
          }
          b.x += b.vx * h;
          b.y += b.vy * h;
          const d = Math.hypot(b.x, b.y) || 0.001;
          if (d > R - r) {
            const nx = b.x / d;
            const ny = b.y / d;
            b.x = nx * (R - r);
            b.y = ny * (R - r);
            const vn = b.vx * nx + b.vy * ny;
            if (vn > 0) {
              b.vx -= 1.65 * vn * nx;
              b.vy -= 1.65 * vn * ny;
              if (spinning && vn > R * 1.2 && now - lastRattle > 70) {
                lastRattle = now;
                sfx.rattle();
              }
            }
            // La pared arrastra a la esfera (friccion con el tambor)
            const tx = -ny;
            const ty = nx;
            let vt = b.vx * tx + b.vy * ty;
            const vnNow = b.vx * nx + b.vy * ny;
            vt += (omega * R - vt) * 0.12;
            b.vx = vnNow * nx + vt * tx;
            b.vy = vnNow * ny + vt * ty;
          }
          b.vx *= 0.998;
          b.vy *= 0.998;
        }
        // Choques entre esferas
        const list = balls.current;
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          if (a.exiting) continue;
          for (let j = i + 1; j < list.length; j++) {
            const c = list[j];
            if (c.exiting) continue;
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < r * 2) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (r * 2 - dist) / 2;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              c.x += nx * overlap;
              c.y += ny * overlap;
              const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
              if (rel < 0) {
                const imp = rel * 0.92;
                a.vx += imp * nx;
                a.vy += imp * ny;
                c.vx -= imp * nx;
                c.vy -= imp * ny;
              }
            }
          }
        }
      }

      // Salida de la esfera ganadora por la boquilla
      if (exiting && s.target) {
        const b = balls.current.find((x) => x.id === s.target);
        const p = Math.min(1, (elapsed - (s.duration - EXIT_MS)) / EXIT_MS);
        if (b) {
          if (!b.exiting) {
            b.exiting = true;
            sfx.reveal();
          }
          const holeY = R - r;
          if (p < 0.45) {
            const q = p / 0.45;
            b.x += (0 - b.x) * Math.min(1, q * 0.5 + 0.1);
            b.y += (holeY - b.y) * Math.min(1, q * 0.5 + 0.1);
          } else {
            const q = (p - 0.45) / 0.55;
            b.x = 0;
            b.y = holeY + q * q * size * 0.42;
          }
        }
        if (p >= 1) {
          s.done = true;
          onDoneRef.current();
        }
      }

      // ── Dibujo ──
      ctx.clearRect(0, 0, size, size);

      // Patas y boquilla
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.85)';
      ctx.lineWidth = Math.max(4, size * 0.018);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.55, cy + R * 0.8);
      ctx.lineTo(cx - R * 0.85, size * 0.97);
      ctx.moveTo(cx + R * 0.55, cy + R * 0.8);
      ctx.lineTo(cx + R * 0.85, size * 0.97);
      ctx.stroke();
      const chuteW = r * 2.6;
      const chute = ctx.createLinearGradient(cx - chuteW / 2, 0, cx + chuteW / 2, 0);
      chute.addColorStop(0, 'rgba(255,255,255,0.05)');
      chute.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      chute.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = chute;
      ctx.fillRect(cx - chuteW / 2, cy + R - 4, chuteW, size * 0.5);
      ctx.restore();

      // Tambor
      const glass = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
      glass.addColorStop(0, 'rgba(255,255,255,0.14)');
      glass.addColorStop(1, 'rgba(59,130,246,0.18)');
      ctx.fillStyle = glass;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Rayos que giran
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(R, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Esferas
      for (const b of balls.current) {
        const x = cx + b.x;
        const y = cy + b.y;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, `hsl(${b.hue} 95% 82%)`);
        g.addColorStop(0.5, `hsl(${b.hue} 85% 55%)`);
        g.addColorStop(1, `hsl(${b.hue} 80% 32%)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (r >= 11) {
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = `700 ${Math.round(r * (b.number >= 1000 ? 0.42 : 0.55))}px ui-sans-serif, system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(b.number), x, y + 1);
        }
      }

      // Aro dorado con focos
      ctx.lineWidth = Math.max(5, size * 0.022);
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, '#fde68a');
      rim.addColorStop(0.5, '#f59e0b');
      rim.addColorStop(1, '#b45309');
      ctx.strokeStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      const lights = 24;
      for (let i = 0; i < lights; i++) {
        const a = (i / lights) * Math.PI * 2 + angle * 0.25;
        const on = spinning ? (Math.floor(now / 90) + i) % 3 === 0 : i % 2 === 0;
        ctx.fillStyle = on ? '#fef9c3' : 'rgba(254,249,195,0.25)';
        ctx.shadowColor = on ? '#fde047' : 'transparent';
        ctx.shadowBlur = on ? 12 : 0;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.max(2.5, size * 0.008), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Brillo del cristal y eje
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(3, size * 0.012);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(5, size * 0.02), 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center">
      <canvas ref={canvasRef} aria-label="Tómbola" role="img" />
    </div>
  );
}
