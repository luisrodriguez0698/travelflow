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
  /** Ya paso por la compuerta (cae por el tubo, sin chocar con el tambor) */
  exiting?: boolean;
}

/**
 * Fases de la salida:
 *  spin  -> el tambor gira (dura durationMs)
 *  gate  -> el tambor frena, se abre la compuerta y la esfera rueda hacia ella
 *  chute -> la esfera cae por el tubo y rebota en la bandeja
 *  rest  -> brilla y se acerca a la camara; luego se revela
 */
type Phase = 'idle' | 'spin' | 'gate' | 'chute' | 'rest';

/** Cuantas esferas se dibujan como maximo (con miles de boletos se muestra una muestra; todos participan) */
const MAX_BALLS = 70;
const STIR_MS = 2200;
/** Radio del tambor respecto al lienzo (deja espacio a la derecha para la manivela) */
const DRUM_R = 0.35;

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

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/**
 * Tombola: tambor de cristal con esferas numeradas y fisica simple. Se puede
 * revolver arrastrando el tambor (o con el boton "Revolver"). Al sacar, el
 * tambor frena, se abre la compuerta y la esfera ganadora rueda, cae por el
 * tubo y rebota en la bandeja antes de revelarse.
 */
export function TombolaStage({ pool, target, spinId, durationMs, onDone, stirId = 0 }: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const balls = useRef<Ball[]>([]);
  const sizeRef = useRef(0);
  const run = useRef<{ phase: Phase; start: number; duration: number; target: string | null; phaseStart: number }>({
    phase: 'idle',
    start: 0,
    duration: 0,
    target: null,
    phaseStart: 0,
  });
  const stirUntil = useRef(0);
  const drag = useRef<{ active: boolean; angle: number; time: number; id: number }>({ active: false, angle: 0, time: 0, id: -1 });
  const omegaRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Mantener las esferas sincronizadas con los boletos en juego
  useEffect(() => {
    const visible = pickVisible(pool, target);
    const R = sizeRef.current * DRUM_R || 150;
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
    const now = performance.now();
    run.current = { phase: 'spin', start: now, duration: durationMs, target: target.id, phaseStart: now };
    // Al sacar se suelta el arrastre y se cancela cualquier "revolver" pendiente
    drag.current.active = false;
    stirUntil.current = 0;
    return sfx.drumroll(durationMs);
  }, [spinId, target, durationMs]);

  // Revolver sin sacar
  useEffect(() => {
    if (!stirId) return;
    stirUntil.current = performance.now() + STIR_MS;
    sfx.unlock();
  }, [stirId]);

  // Bucle de animacion + fisica
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let angle = 0;
    let last = performance.now();
    let lastRattle = 0;
    let gate = 0; // 0 cerrada .. 1 abierta

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

    const setPhase = (phase: Phase, now: number) => {
      run.current.phase = phase;
      run.current.phaseStart = now;
    };

    const drawBall = (b: Ball, x: number, y: number, r: number, glow = 0) => {
      if (glow > 0) {
        ctx.save();
        ctx.shadowColor = `hsl(${b.hue} 100% 70%)`;
        ctx.shadowBlur = 25 * glow;
        ctx.fillStyle = `hsla(${b.hue} 100% 70% / ${0.35 * glow})`;
        ctx.beginPath();
        ctx.arc(x, y, r * (1.35 + 0.15 * glow), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
    };

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const size = sizeRef.current;
      const R = size * DRUM_R;
      const cx = size / 2;
      const cy = size * 0.42;
      const run_ = run.current;
      const phase = run_.phase;
      const inPhase = now - run_.phaseStart;
      const n = balls.current.filter((b) => !b.exiting).length;
      const r = Math.max(9, Math.min(R * 0.15, (R * 0.62) / Math.sqrt(Math.max(1, n))));
      const holeY = R - r; // centro de la esfera justo en la compuerta (coordenadas del tambor)
      const trayY = size * 0.955 - cy - r; // fondo de la bandeja

      // ── Velocidad del tambor ──
      const stirring = now < stirUntil.current;
      if (phase === 'spin' && now - run_.start >= run_.duration) setPhase('gate', now);
      if (!drag.current.active) {
        const targetOmega = phase === 'spin' ? 5.5 : stirring ? 4.2 : 0;
        const rate = phase === 'spin' || stirring ? 2.5 : phase === 'gate' ? 2.2 : 0.7; // inercia al soltar
        omegaRef.current += (targetOmega - omegaRef.current) * Math.min(1, dt * rate);
      }
      const omega = omegaRef.current;
      angle += omega * dt;
      const agitate =
        phase === 'spin' ? Math.min(1, (now - run_.start) / 600) : Math.min(0.75, Math.abs(omega) / 6) * (phase === 'gate' ? 0.3 : 1);

      // ── Compuerta ──
      gate += ((phase === 'gate' && inPhase > 500) || phase === 'chute' ? 1 - gate : -gate) * Math.min(1, dt * 6);

      const target = run_.target ? balls.current.find((b) => b.id === run_.target) : undefined;

      // ── Fisica (2 subpasos) ──
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
          // La esfera elegida rueda hacia la compuerta abierta
          if (phase === 'gate' && b === target && gate > 0.3) {
            const dx = 0 - b.x;
            const dy = holeY - b.y;
            const d = Math.hypot(dx, dy) || 1;
            const pull = R * (5 + inPhase / 120);
            b.vx += (dx / d) * pull * h;
            b.vy += (dy / d) * pull * h;
            b.vx *= 0.97;
            b.vy *= 0.97;
            if (inPhase > 2600) {
              // Por si queda atorada entre otras esferas
              b.x += dx * 0.12;
              b.y += dy * 0.12;
            }
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
              if (agitate > 0.15 && vn > R * 1.2 && now - lastRattle > 70) {
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

      // ── Salida de la esfera ──
      if (target) {
        if (phase === 'gate' && !target.exiting && gate > 0.8 && Math.hypot(target.x, target.y - holeY) < r * 0.6) {
          target.exiting = true;
          target.x = 0;
          target.y = holeY;
          target.vx = 0;
          target.vy = R * 0.4;
          sfx.tick(0.6);
          setPhase('chute', now);
        } else if (phase === 'chute') {
          target.vy += R * 3.2 * dt;
          target.y += target.vy * dt;
          if (target.y >= trayY) {
            target.y = trayY;
            if (target.vy > R * 0.35) {
              target.vy = -target.vy * 0.38;
              sfx.tick(0.5);
              sfx.rattle();
            } else {
              target.vy = 0;
              sfx.reveal();
              setPhase('rest', now);
            }
          }
        } else if (phase === 'rest' && inPhase > 900) {
          setPhase('idle', now);
          run_.target = null;
          onDoneRef.current();
        }
      }

      const cursor = run_.phase !== 'idle' ? 'default' : drag.current.active ? 'grabbing' : 'grab';
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;

      // ── Dibujo ──
      ctx.clearRect(0, 0, size, size);

      // Patas
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.85)';
      ctx.lineWidth = Math.max(4, size * 0.016);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.55, cy + R * 0.8);
      ctx.lineTo(cx - R * 0.95, size * 0.97);
      ctx.moveTo(cx + R * 0.55, cy + R * 0.8);
      ctx.lineTo(cx + R * 0.95, size * 0.97);
      ctx.stroke();
      ctx.restore();

      // Tubo de cristal y bandeja
      const chuteW = r * 2.5;
      const chuteTop = cy + R - 2;
      const trayBottom = cy + trayY + r;
      const chute = ctx.createLinearGradient(cx - chuteW / 2, 0, cx + chuteW / 2, 0);
      chute.addColorStop(0, 'rgba(255,255,255,0.10)');
      chute.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      chute.addColorStop(1, 'rgba(255,255,255,0.10)');
      ctx.fillStyle = chute;
      ctx.fillRect(cx - chuteW / 2, chuteTop, chuteW, trayBottom - chuteTop);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - chuteW / 2, chuteTop);
      ctx.lineTo(cx - chuteW / 2, trayBottom - r * 0.6);
      ctx.moveTo(cx + chuteW / 2, chuteTop);
      ctx.lineTo(cx + chuteW / 2, trayBottom - r * 0.6);
      ctx.stroke();
      // Bandeja dorada
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(3, size * 0.01);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - chuteW * 0.95, trayBottom - r * 0.9);
      ctx.quadraticCurveTo(cx - chuteW * 0.9, trayBottom + 3, cx, trayBottom + 3);
      ctx.quadraticCurveTo(cx + chuteW * 0.9, trayBottom + 3, cx + chuteW * 0.95, trayBottom - r * 0.9);
      ctx.stroke();

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

      // Esferas dentro del tambor
      for (const b of balls.current) {
        if (b.exiting) continue;
        const glow = b === target && phase === 'gate' && gate > 0.3 ? 0.6 + 0.4 * Math.sin(now / 90) : 0;
        drawBall(b, cx + b.x, cy + b.y, r, glow);
      }

      // Aro dorado (con hueco cuando la compuerta se abre)
      const rimW = Math.max(5, size * 0.022);
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, '#fde68a');
      rim.addColorStop(0.5, '#f59e0b');
      rim.addColorStop(1, '#b45309');
      ctx.strokeStyle = rim;
      ctx.lineWidth = rimW;
      const gapHalf = gate * Math.asin(Math.min(1, (chuteW / 2) / R));
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI / 2 + gapHalf, Math.PI / 2 - gapHalf + Math.PI * 2);
      ctx.stroke();
      // Puertita abatible
      if (gate > 0.02) {
        const hingeA = Math.PI / 2 - gapHalf;
        const hx = cx + Math.cos(hingeA) * R;
        const hy = cy + Math.sin(hingeA) * R;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(Math.PI + gate * 1.3);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = rimW * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(chuteW * 0.9, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Focos
      const spinningLights = phase === 'spin' || Math.abs(omega) > 1.5;
      const lights = 24;
      for (let i = 0; i < lights; i++) {
        const a = (i / lights) * Math.PI * 2 + angle * 0.25;
        const on = spinningLights ? (Math.floor(now / 90) + i) % 3 === 0 : phase === 'rest' ? Math.floor(now / 150) % 2 === i % 2 : i % 2 === 0;
        ctx.fillStyle = on ? '#fef9c3' : 'rgba(254,249,195,0.25)';
        ctx.shadowColor = on ? '#fde047' : 'transparent';
        ctx.shadowBlur = on ? 12 : 0;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.max(2.5, size * 0.008), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Manivela (gira con el tambor)
      const axleX = cx + R + size * 0.035;
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = Math.max(3, size * 0.012);
      ctx.beginPath();
      ctx.moveTo(cx + R, cy);
      ctx.lineTo(axleX, cy);
      ctx.stroke();
      const armLen = R * 0.2;
      const kx = axleX + Math.cos(angle) * armLen;
      const ky = cy + Math.sin(angle) * armLen;
      ctx.lineWidth = Math.max(4, size * 0.014);
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(axleX, cy);
      ctx.lineTo(kx, ky);
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(axleX, cy, Math.max(4, size * 0.014), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(kx, ky, Math.max(5, size * 0.018), 0, Math.PI * 2);
      ctx.fill();

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

      // Esfera que sale (encima del tubo); en reposo brilla y se acerca
      if (target?.exiting) {
        let scale = 1;
        let glow = 0.5;
        let y = cy + target.y;
        if (phase === 'rest') {
          const p = Math.min(1, inPhase / 650);
          scale = 1 + 0.9 * easeOutBack(p);
          glow = 1;
          y = cy + trayY - (scale - 1) * r * 1.1;
        }
        drawBall(target, cx + target.x, y, r * scale, glow);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── Revolver arrastrando el tambor (o la manivela) ──
    const pointerAngle = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const size = sizeRef.current;
      return Math.atan2(e.clientY - rect.top - size * 0.42, e.clientX - rect.left - size / 2);
    };
    const onDown = (e: PointerEvent) => {
      if (run.current.phase !== 'idle') return;
      const rect = canvas.getBoundingClientRect();
      const size = sizeRef.current;
      const dist = Math.hypot(e.clientX - rect.left - size / 2, e.clientY - rect.top - size * 0.42);
      if (dist > size * DRUM_R * 1.4) return;
      sfx.unlock();
      drag.current = { active: true, angle: pointerAngle(e), time: performance.now(), id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.active || e.pointerId !== d.id) return;
      const a = pointerAngle(e);
      const t = performance.now();
      const dtS = Math.max(0.008, (t - d.time) / 1000);
      const w = wrapAngle(a - d.angle) / dtS;
      omegaRef.current = Math.max(-14, Math.min(14, omegaRef.current * 0.5 + w * 0.5));
      d.angle = a;
      d.time = t;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.current.id) return;
      drag.current.active = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className="w-full h-full flex items-center justify-center">
      <canvas ref={canvasRef} aria-label="Tómbola: arrástrala para revolver" role="img" className="touch-none select-none" />
    </div>
  );
}
