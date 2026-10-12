'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  CircleDot,
  Dices,
  Disc3,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  RotateCcw,
  Trophy,
  Ticket,
  Loader2,
  Repeat,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCan } from '@/hooks/use-can';
import { useRealtimeEvent } from '@/components/realtime-provider';
import { cn } from '@/lib/utils';
import { sfx } from '@/components/raffles/draw-sounds';
import { ticketHue, type DrawTicket } from '@/components/raffles/draw-types';
import { TombolaStage } from '@/components/raffles/tombola-stage';
import { SlotStage } from '@/components/raffles/slot-stage';
import { WheelStage } from '@/components/raffles/wheel-stage';
import { STYLE_INFO, ticketLabel } from '@/components/raffles/raffle-ui';

interface DrawState {
  raffle: {
    id: string;
    name: string;
    description: string | null;
    prizes: string[];
    drawMode: string;
    drawPosition: number | null;
    style: string;
    status: string;
    terms: string | null;
    drawDate: string | null;
    ticketsNeeded: number;
    tenant: { name: string; logo: string | null };
  };
  tickets: DrawTicket[];
}

interface DrawResult {
  ticket: DrawTicket & { drawnOrder: number };
  finalWinner?: DrawTicket & { drawnOrder: number; prizeIndex: number };
  remaining: number;
  finished: boolean;
}

const SPEEDS = {
  fast: { label: 'Rápido', ms: 1900 },
  normal: { label: 'Normal', ms: 3800 },
  suspense: { label: 'Suspenso', ms: 6800 },
} as const;
type Speed = keyof typeof SPEEDS;

const STYLE_ICONS: Record<string, typeof CircleDot> = { TOMBOLA: CircleDot, SLOT: Dices, WHEEL: Disc3 };
const MEDALS = ['🥇', '🥈', '🥉'];

function celebrate() {
  const colors = ['#fbbf24', '#f43f5e', '#6366f1', '#22d3ee', '#ffffff'];
  confetti({ particleCount: 180, spread: 110, startVelocity: 48, origin: { y: 0.45 }, colors });
  const end = Date.now() + 2600;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export default function SorteoPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const canDraw = can('rifas', 'edit');

  const [state, setState] = useState<DrawState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [muted, setMuted] = useState(false);
  const [auto, setAuto] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'spinning'>('idle');
  const [current, setCurrent] = useState<DrawResult | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [winner, setWinner] = useState<DrawTicket | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const winnerRef = useRef(winner);
  winnerRef.current = winner;
  const ownDraws = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/raffles/${id}/draw`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
      setStyle((s) => s ?? data.raffle.style);
    } catch (err: any) {
      setLoadError(err.message || 'No se pudo cargar el sorteo');
    }
  }, [id]);

  useEffect(() => {
    load();
    setMuted(sfx.isMuted());
  }, [load]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const tickets = state?.tickets ?? [];
  const pool = useMemo(() => tickets.filter((t) => t.drawnOrder === null), [tickets]);
  const history = useMemo(
    () => tickets.filter((t) => t.drawnOrder !== null).sort((a, b) => b.drawnOrder! - a.drawnOrder!),
    [tickets]
  );
  const prizeWinners = useMemo(() => {
    const map = new Map<number, DrawTicket>();
    for (const t of tickets) if (t.prizeIndex !== null) map.set(t.prizeIndex, t);
    return map;
  }, [tickets]);

  const raffle = state?.raffle;
  const finished = !!raffle && (raffle.status === 'DRAWN' || prizeWinners.size >= raffle.prizes.length);
  const notEnough = !!raffle && tickets.length < raffle.ticketsNeeded;

  // ── Tirada ──
  const startAnimation = useCallback((result: DrawResult) => {
    setCurrent(result);
    setSpinId((n) => n + 1);
    setPhase('spinning');
  }, []);

  const draw = useCallback(async () => {
    if (phaseRef.current !== 'idle' || winnerRef.current || !canDraw) return;
    sfx.unlock();
    phaseRef.current = 'requesting';
    setPhase('requesting');
    try {
      const res = await fetch(`/api/raffles/${id}/draw`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      ownDraws.current.add(data.ticket.id);
      startAnimation(data);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo sacar el boleto');
      setPhase('idle');
      setAuto(false);
      load();
    }
  }, [canDraw, id, load, startAnimation]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Termino la animacion: se revela el boleto
  const onStageDone = useCallback(() => {
    const result = current;
    if (!result) return;
    setState((s) =>
      s && {
        ...s,
        raffle: { ...s.raffle, status: result.finished ? 'DRAWN' : s.raffle.status },
        tickets: s.tickets.map((t) => {
          if (t.id === result.ticket.id) return { ...t, drawnOrder: result.ticket.drawnOrder, prizeIndex: result.ticket.prizeIndex };
          if (result.finalWinner && t.id === result.finalWinner.id) {
            return { ...t, drawnOrder: result.finalWinner.drawnOrder, prizeIndex: result.finalWinner.prizeIndex };
          }
          return t;
        }),
      }
    );
    setPhase('idle');

    if (result.ticket.prizeIndex !== null) {
      setWinner(result.ticket);
      sfx.fanfare();
      celebrate();
    } else {
      sfx.discard();
      if (result.finalWinner) {
        // Modo "el ultimo en quedar": se corona solo
        const fw = result.finalWinner;
        window.setTimeout(() => {
          setWinner(fw);
          sfx.fanfare();
          celebrate();
        }, 1400);
      } else if (auto && !result.finished) {
        window.setTimeout(() => drawRef.current(), 1100);
      }
    }
  }, [current, auto]);

  // Otra pantalla (p. ej. la computadora del proyector) saco un boleto: se reproduce aqui
  useRealtimeEvent<{ raffleId: string; reset?: boolean } & Partial<DrawResult>>('raffle-draw', (d) => {
    if (d.raffleId !== id) return;
    if (d.reset) {
      setCurrent(null);
      setWinner(null);
      load();
      return;
    }
    // Si esta pantalla espera su propia tirada, el aviso puede llegar antes que la respuesta
    if (!d.ticket || ownDraws.current.has(d.ticket.id) || phaseRef.current === 'requesting') return;
    if (phaseRef.current === 'idle' && !winnerRef.current) startAnimation(d as DrawResult);
    else load();
  });

  // Teclado: espacio / Enter = sacar; Esc = cerrar ganador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') setWinner(null);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (winnerRef.current) setWinner(null);
        else drawRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const toggleMute = () => {
    sfx.setMuted(!muted);
    setMuted(!muted);
  };

  const reset = async () => {
    try {
      const res = await fetch(`/api/raffles/${id}/draw`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetOpen(false);
      setCurrent(null);
      setWinner(null);
      setAuto(false);
      await load();
      toast.success('Sorteo reiniciado: todos los boletos regresaron');
    } catch (err: any) {
      toast.error(err.message || 'No se pudo reiniciar');
    }
  };

  // ── Texto "que sigue" segun el modo ──
  const nextInfo = useMemo(() => {
    if (!raffle || finished) return null;
    const nextOrder = history.length + 1;
    if (raffle.drawMode === 'FIRST') {
      const idx = nextOrder - 1;
      return { text: `Este boleto gana el ${idx + 1}° lugar: ${raffle.prizes[idx]}`, dots: null as null | { n: number; at: number } };
    }
    if (raffle.drawMode === 'NTH') {
      const n = raffle.drawPosition ?? 1;
      const at = ((nextOrder - 1) % n) + 1;
      const prizeIdx = Math.floor((nextOrder - 1) / n);
      const text = at === n ? `¡Este boleto gana ${raffle.prizes[prizeIdx]}!` : `Boleto ${at} de ${n} · el ${n}° en salir gana ${raffle.prizes[prizeIdx]}`;
      return { text, dots: n <= 20 ? { n, at } : null };
    }
    const prizes = raffle.prizes.length;
    if (pool.length <= prizes + 1) return { text: `Quedan ${pool.length}: los últimos en quedar ganan`, dots: null };
    return { text: `Quedan ${pool.length} boletos · el último en quedar gana ${raffle.prizes[0]}`, dots: null };
  }, [raffle, finished, history.length, pool.length]);

  if (loadError) {
    return (
      <Stage>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white">
          <p className="text-lg">{loadError}</p>
          <Link href="/raffles" className="underline text-white/70">Volver a rifas</Link>
        </div>
      </Stage>
    );
  }
  if (!state || !raffle) {
    return (
      <Stage>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
        </div>
      </Stage>
    );
  }

  const activeStyle = style ?? raffle.style;
  const target = phase === 'spinning' && current ? current.ticket : null;
  const stageProps = { pool, target, spinId, durationMs: SPEEDS[speed].ms, onDone: onStageDone };
  const busy = phase !== 'idle';
  const lastTicket = phase === 'idle' && current ? current.ticket : null;

  return (
    <Stage>
      {/* Encabezado */}
      <header className="flex items-center gap-3 px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <Link href={`/raffles/${raffle.id}`} className="p-2 rounded-full hover:bg-white/10 text-white/80" title="Salir del sorteo">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {raffle.tenant.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={raffle.tenant.logo} alt="" className="h-9 w-9 rounded-lg object-contain bg-white/90 p-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300/90 truncate">{raffle.tenant.name}</p>
          <h1 className="text-lg sm:text-2xl font-black text-white truncate">{raffle.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex rounded-full bg-white/10 p-1">
            {Object.entries(STYLE_INFO).map(([key, info]) => {
              const Icon = STYLE_ICONS[key];
              return (
                <button
                  key={key}
                  disabled={busy}
                  onClick={() => setStyle(key)}
                  title={info.label}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors', activeStyle === key ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white')}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{info.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={toggleMute} className="p-2 rounded-full hover:bg-white/10 text-white/80" title={muted ? 'Activar sonido' : 'Silenciar'}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-white/10 text-white/80 hidden sm:block" title="Pantalla completa">
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Estilo en movil */}
      <div className="sm:hidden flex justify-center px-3 pb-2">
        <div className="flex rounded-full bg-white/10 p-1">
          {Object.entries(STYLE_INFO).map(([key, info]) => {
            const Icon = STYLE_ICONS[key];
            return (
              <button
                key={key}
                disabled={busy}
                onClick={() => setStyle(key)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5', activeStyle === key ? 'bg-white text-slate-900' : 'text-white/70')}
              >
                <Icon className="w-3.5 h-3.5" />
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_340px] gap-4 px-3 sm:px-6 pb-4 min-h-0">
        {/* Escenario */}
        <section className="flex flex-col min-h-0">
          <div className="relative h-[52vh] lg:h-auto lg:flex-1 min-h-[280px]">
            {tickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/70 gap-3">
                <Ticket className="w-12 h-12 opacity-50" />
                <p>Aún no hay boletos. Agrega participantes para hacer el sorteo.</p>
                <Link href={`/raffles/${raffle.id}`} className="underline">Ir a participantes</Link>
              </div>
            ) : activeStyle === 'SLOT' ? (
              <SlotStage {...stageProps} />
            ) : activeStyle === 'WHEEL' ? (
              <WheelStage {...stageProps} />
            ) : (
              <TombolaStage {...stageProps} />
            )}
          </div>

          {/* Ultimo boleto revelado */}
          <div className="min-h-[92px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {lastTicket && (
                <motion.div
                  key={lastTicket.id}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl px-5 py-3 backdrop-blur',
                    lastTicket.prizeIndex !== null ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-white/10'
                  )}
                >
                  <Ball number={lastTicket.number} size={56} />
                  <div className="min-w-0">
                    <p className="text-white text-xl sm:text-2xl font-bold truncate max-w-[60vw] lg:max-w-md">{lastTicket.participantName}</p>
                    <p className={cn('text-sm', lastTicket.prizeIndex !== null ? 'text-amber-200' : 'text-white/60')}>
                      {lastTicket.prizeIndex !== null
                        ? `🏆 Gana ${raffle.prizes[lastTicket.prizeIndex]}`
                        : raffle.drawMode === 'LAST'
                          ? 'Eliminado · sigue el sorteo'
                          : 'Descartado · sigue el sorteo'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controles */}
          <div className="flex flex-col items-center gap-3">
            {nextInfo && (
              <div className="text-center">
                <p className="text-white/80 text-sm sm:text-base">{nextInfo.text}</p>
                {nextInfo.dots && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {Array.from({ length: nextInfo.dots.n }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-2.5 rounded-full transition-all',
                          i + 1 < nextInfo.dots!.at ? 'w-2.5 bg-white/40' : i + 1 === nextInfo.dots!.at ? 'w-6 bg-amber-300' : 'w-2.5 bg-white/15',
                          i + 1 === nextInfo.dots!.n && 'ring-2 ring-amber-300/60'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {finished ? (
              <p className="text-amber-200 font-semibold text-lg">🎉 ¡Sorteo terminado!</p>
            ) : notEnough ? (
              <p className="text-rose-200 text-sm text-center">
                Faltan boletos: se necesitan al menos {raffle.ticketsNeeded} para sortear todos los premios.
              </p>
            ) : canDraw ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <motion.button
                  whileHover={{ scale: busy ? 1 : 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => draw()}
                  disabled={busy || !pool.length}
                  className="relative px-8 sm:px-12 py-4 rounded-full font-black text-lg sm:text-xl text-slate-900 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.45)] disabled:opacity-60"
                >
                  {phase === 'requesting' ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-6" />
                  ) : phase === 'spinning' ? (
                    'Sorteando…'
                  ) : (
                    'Sacar boleto'
                  )}
                </motion.button>
                <button
                  onClick={() => setAuto((a) => !a)}
                  className={cn('px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-colors', auto ? 'bg-amber-300 text-slate-900' : 'bg-white/10 text-white/80 hover:bg-white/20')}
                  title="Saca los descartados seguidos y se detiene en cada ganador"
                >
                  <Repeat className="w-4 h-4" />
                  Automático
                </button>
              </div>
            ) : (
              <p className="text-white/60 text-sm">Estás viendo el sorteo en vivo</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {(Object.keys(SPEEDS) as Speed[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSpeed(key)}
                  disabled={busy}
                  className={cn('px-3 py-1 rounded-full transition-colors', speed === key ? 'bg-white/90 text-slate-900' : 'bg-white/5 text-white/60 hover:text-white')}
                >
                  {SPEEDS[key].label}
                </button>
              ))}
              {canDraw && history.length > 0 && (
                <button onClick={() => setResetOpen(true)} disabled={busy} className="px-3 py-1 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  Reiniciar
                </button>
              )}
              {canDraw && <span className="hidden sm:inline text-white/40">Tecla espacio = sacar</span>}
            </div>
          </div>
        </section>

        {/* Panel lateral */}
        <aside className="flex flex-col gap-4 min-h-0">
          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-300" />
              Premios
            </h2>
            <ul className="space-y-2">
              {raffle.prizes.map((prize, i) => {
                const w = prizeWinners.get(i);
                return (
                  <li key={i} className={cn('rounded-xl px-3 py-2 flex items-center gap-3', w ? 'bg-amber-400/15 ring-1 ring-amber-300/40' : 'bg-white/5')}>
                    <span className="text-xl w-7 text-center">{MEDALS[i] ?? `${i + 1}°`}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{prize}</p>
                      <AnimatePresence>
                        {w ? (
                          <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-amber-200 truncate">
                            {ticketLabel(w.number)} · {w.participantName}
                          </motion.p>
                        ) : (
                          <p className="text-xs text-white/40">Por sortear</p>
                        )}
                      </AnimatePresence>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 flex-1 min-h-[160px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Han salido</h2>
              <span className="text-xs text-white/50">
                {history.length} de {tickets.length}
              </span>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-white/40">Todavía no sale ningún boleto.</p>
            ) : (
              <ul className="space-y-1.5 overflow-y-auto max-h-[40vh] lg:max-h-none lg:flex-1 pr-1">
                <AnimatePresence initial={false}>
                  {history.slice(0, 80).map((t) => (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-7 text-right text-[11px] text-white/40 tabular-nums">{t.drawnOrder}.</span>
                      <span className={cn('font-mono text-xs px-1.5 py-0.5 rounded', t.prizeIndex !== null ? 'bg-amber-300 text-slate-900 font-bold' : 'bg-white/10 text-white/60')}>
                        {ticketLabel(t.number)}
                      </span>
                      <span className={cn('truncate', t.prizeIndex !== null ? 'text-amber-100 font-semibold' : 'text-white/50 line-through decoration-white/30')}>
                        {t.participantName}
                      </span>
                      {t.prizeIndex !== null && <span className="ml-auto">{MEDALS[t.prizeIndex] ?? '🏆'}</span>}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Terminos y condiciones de la agencia */}
      <footer className="px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <details className="group rounded-xl bg-white/5 text-white/60 text-xs">
          <summary className="cursor-pointer list-none px-4 py-2 flex items-center gap-2 select-none">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            Términos y condiciones · Sorteo con generador aleatorio seguro; cada extracción queda registrada
          </summary>
          <p className="px-4 pb-3 whitespace-pre-line leading-relaxed">{raffle.terms || 'La agencia organizadora es responsable de esta rifa.'}</p>
        </details>
      </footer>

      {/* Ganador */}
      <AnimatePresence>
        {winner && winner.prizeIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWinner(null)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 p-1 shadow-[0_0_120px_rgba(251,191,36,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-[1.4rem] bg-slate-950 px-6 py-8 text-center">
                <motion.div
                  animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
                  className="text-6xl mb-2"
                >
                  {MEDALS[winner.prizeIndex] ?? '🏆'}
                </motion.div>
                <p className="text-amber-300 uppercase tracking-[0.25em] text-xs font-semibold">
                  {winner.prizeIndex + 1}° lugar
                </p>
                <p className="text-white/80 mt-1">{raffle.prizes[winner.prizeIndex]}</p>
                <div className="my-5 flex justify-center">
                  <Ball number={winner.number} size={96} />
                </div>
                <p className="text-3xl sm:text-4xl font-black text-white break-words">{winner.participantName}</p>
                <p className="text-white/50 text-sm mt-1">¡Felicidades!</p>
                <button
                  onClick={() => setWinner(null)}
                  className="mt-6 px-8 py-2.5 rounded-full bg-amber-300 text-slate-900 font-bold hover:bg-amber-200"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar sorteo</AlertDialogTitle>
            <AlertDialogDescription>
              Todos los boletos regresan a la tómbola y se borran los ganadores. Úsalo solo si fue un ensayo. Quedará registrado en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reset} className="bg-red-600 hover:bg-red-700">Reiniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Stage>
  );
}

/** Fondo de escenario (siempre oscuro, como en un show) */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-600/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-blue-600/20 blur-3xl animate-pulse [animation-delay:1.5s]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>
      <div className="relative flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function Ball({ number, size }: { number: number; size: number }) {
  const hue = ticketHue(number);
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 shadow-lg"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, hsl(${hue} 95% 85%), hsl(${hue} 85% 55%) 50%, hsl(${hue} 80% 30%))`,
      }}
    >
      <div
        className="rounded-full bg-white/95 flex items-center justify-center font-black text-slate-900 tabular-nums"
        style={{ width: size * 0.62, height: size * 0.62, fontSize: size * (number >= 1000 ? 0.2 : 0.26) }}
      >
        {number}
      </div>
    </div>
  );
}
