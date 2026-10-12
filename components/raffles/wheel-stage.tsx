'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from './draw-sounds';
import { casinoDelay, ticketHue, type StageProps } from './draw-types';

/** Hasta cuantos boletos se dibuja un segmento por boleto; arriba de eso, uno por persona (proporcional) */
const PER_TICKET_MAX = 120;

interface Segment {
  key: string;
  label: string;
  /** Numero de boleto (solo cuando hay un segmento por boleto) */
  number?: number;
  start: number; // grados, sentido horario desde arriba
  end: number;
  hue: number;
}

/** Con mas segmentos que esto ya no caben nombres: se muestran numeros */
const NAME_LABELS_MAX = 40;
/** Con mas segmentos que esto no se rotula nada (el letrero de arriba dice quien va) */
const ANY_LABELS_MAX = 90;

/** "Luis Eduardo Rodriguez Lopez" -> "Luis Eduardo R." (corto pero reconocible) */
export function shortName(full: string, max = 14) {
  const parts = full.trim().split(/\s+/);
  let out = parts[0] ?? '';
  for (let i = 1; i < parts.length; i++) {
    const next = `${out} ${parts[i]}`;
    if (next.length <= max) out = next;
    else {
      out = `${out} ${parts[i][0]}.`;
      break;
    }
  }
  return out.length > max + 3 ? `${out.slice(0, max)}…` : out;
}

/** Focos alrededor del aro de la ruleta */
const RIM_BULBS = 36;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

function point(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return [50 + r * Math.sin(a), 50 - r * Math.cos(a)];
}

/**
 * Ruleta: cada boleto es un segmento (si Juan tiene 3 boletos, aparece 3
 * veces). Con muchos boletos se agrupa por persona con tamano proporcional.
 */
export function WheelStage({ pool, target, spinId, durationMs, onDone }: StageProps) {
  const perTicket = pool.length <= PER_TICKET_MAX;
  const segments = useMemo<Segment[]>(() => {
    if (!pool.length) return [];
    if (perTicket) {
      // Intercalar personas para que los boletos de alguien no queden juntos
      const byPerson = new Map<string, typeof pool>();
      for (const t of pool) byPerson.set(t.participantId, [...(byPerson.get(t.participantId) ?? []), t]);
      const queues = [...byPerson.values()];
      const ordered: typeof pool = [];
      while (ordered.length < pool.length) for (const q of queues) if (q.length) ordered.push(q.shift()!);
      const size = 360 / ordered.length;
      return ordered.map((t, i) => ({ key: t.id, label: t.participantName, number: t.number, start: i * size, end: (i + 1) * size, hue: ticketHue(i + 7) }));
    }
    const counts = new Map<string, { name: string; count: number }>();
    for (const t of pool) {
      const c = counts.get(t.participantId) ?? { name: t.participantName, count: 0 };
      c.count++;
      counts.set(t.participantId, c);
    }
    let acc = 0;
    return [...counts.entries()].map(([id, c], i) => {
      const size = (c.count / pool.length) * 360;
      const seg = { key: id, label: c.name, start: acc, end: acc + size, hue: ticketHue(i + 7) };
      acc += size;
      return seg;
    });
  }, [pool, perTicket]);

  const [rotation, setRotation] = useState(0);
  const [wobble, setWobble] = useState(0);
  const rotationRef = useRef(0);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!target || !spinId) return;
    const segs = segmentsRef.current;
    const seg = segs.find((s) => s.key === (perTicket ? target.id : target.participantId));
    if (!seg) {
      onDoneRef.current();
      return;
    }
    const width = seg.end - seg.start;
    const center = seg.start + width / 2 + (Math.random() - 0.5) * width * 0.6;
    const from = rotationRef.current;
    const spins = Math.max(4, Math.round(durationMs / 650));
    const wanted = (((360 - center) % 360) + 360) % 360;
    const delta = spins * 360 + ((wanted - (from % 360) + 360) % 360);
    const t0 = performance.now();
    const spinMs = Math.max(1200, durationMs - 400);
    let raf = 0;
    let lastIdx = -1;
    let lastTick = 0;

    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / spinMs);
      const rot = from + delta * easeOutQuart(p);
      rotationRef.current = rot;
      setRotation(rot);
      // Tic cada vez que un borde pasa por la aguja
      const under = (((360 - (rot % 360)) % 360) + 360) % 360;
      const idx = segs.findIndex((s) => under >= s.start && under < s.end);
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (now - lastTick > 35) {
          lastTick = now;
          sfx.tick(0.8);
          setWobble((w) => w + 1);
        }
      }
      if (p < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        sfx.reveal();
        window.setTimeout(() => onDoneRef.current(), 400);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spinId, target, durationMs, perTicket]);

  const labelMode = segments.length <= NAME_LABELS_MAX ? 'name' : segments.length <= ANY_LABELS_MAX && perTicket ? 'number' : 'none';
  const under = (((360 - (rotation % 360)) % 360) + 360) % 360;
  const current = segments.find((s) => under >= s.start && under < s.end) ?? segments[0];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
      {/* Letrero en vivo: quien esta bajo la aguja */}
      <div className="h-11 flex items-center justify-center max-w-full">
        {current && (
          <div className="px-5 py-1.5 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur flex items-center gap-2 max-w-full">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: `hsl(${current.hue} 75% 52%)` }} />
            <span className="text-white font-bold text-lg sm:text-xl truncate">{current.label}</span>
            {current.number !== undefined && <span className="text-white/50 font-mono text-sm">#{String(current.number).padStart(3, '0')}</span>}
          </div>
        )}
      </div>
      <div className="flex-1 w-full min-h-0 flex items-center justify-center [container-type:size]">
        <div className="relative aspect-square w-[min(100cqw,100cqh)]">
          {/* Aguja */}
          <div
            key={wobble}
            className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 origin-top animate-[needle_160ms_ease-out]"
            style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '34px solid #f43f5e', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
          />
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_40px_rgba(99,102,241,0.35)]">
            <circle cx="50" cy="50" r="49.5" fill="#f59e0b" />
            <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '50px 50px' }}>
              {segments.length === 1 ? (
                <circle cx="50" cy="50" r="47" fill={`hsl(${segments[0].hue} 75% 52%)`} />
              ) : (
                segments.map((s) => {
                  const [x0, y0] = point(s.start, 47);
                  const [x1, y1] = point(s.end, 47);
                  const large = s.end - s.start > 180 ? 1 : 0;
                  return (
                    <path
                      key={s.key}
                      d={`M50 50 L${x0} ${y0} A47 47 0 ${large} 1 ${x1} ${y1} Z`}
                      fill={`hsl(${s.hue} 75% 52%)`}
                      stroke="rgba(255,255,255,0.5)"
                      strokeWidth={segments.length > 80 ? 0.05 : 0.25}
                    />
                  );
                })
              )}
              {labelMode !== 'none' &&
                segments.map((s) => {
                  const mid = (s.start + s.end) / 2;
                  const angle = s.end - s.start;
                  const text = labelMode === 'name' ? shortName(s.label) : String(s.number ?? '');
                  // Alto de letra limitado por el ancho del segmento cerca del borde y por el largo del texto
                  const byAngle = 2 * Math.PI * 30 * (angle / 360) * 0.8;
                  const byLength = 34 / Math.max(4, text.length) * 1.7;
                  const fontSize = Math.max(1.4, Math.min(4.2, byAngle, byLength));
                  // Mitad izquierda: se voltea para que no quede de cabeza
                  const flip = mid > 180;
                  return (
                    <text
                      key={`t-${s.key}`}
                      x="50"
                      y="50"
                      fill="white"
                      fontSize={fontSize}
                      fontWeight={700}
                      textAnchor={flip ? 'start' : 'end'}
                      dominantBaseline="middle"
                      transform={flip ? `rotate(${mid + 90} 50 50) translate(-44 0)` : `rotate(${mid - 90} 50 50) translate(44 0)`}
                      style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 0.35 }}
                    >
                      {text}
                    </text>
                  );
                })}
            </g>
            {/* Focos del aro (fijos, no giran con la rueda) */}
            <g style={{ ['--casino-speed' as string]: target ? '0.45s' : '1.6s' }}>
              {Array.from({ length: RIM_BULBS }).map((_, i) => {
                const [bx, by] = point((i / RIM_BULBS) * 360, 48.3);
                return (
                  <circle
                    key={i}
                    className="casino-bulb"
                    cx={bx}
                    cy={by}
                    r={0.75}
                    fill="#fef9c3"
                    style={{ animationDelay: casinoDelay(i), filter: 'drop-shadow(0 0 1.2px #fde047)' }}
                  />
                );
              })}
            </g>
            <circle cx="50" cy="50" r="7" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="2.5" fill="#f59e0b" />
          </svg>
        </div>
      </div>
    </div>
  );
}
