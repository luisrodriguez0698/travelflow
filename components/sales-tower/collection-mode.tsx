'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { CalendarClock, CheckCircle2, MessageCircle, Phone, Plane, Receipt, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { whatsappTo } from '@/components/client-link-dialog';
import { cn } from '@/lib/utils';
import { STATUS_META, longDate, money, prefersReducedMotion, whenLabel, type TowerSale } from './types';

// Modo cobranza: los clientes atrasados o con pago cercano, uno por uno, como
// tarjetas. Recordar (WhatsApp), Ya pago (abre la venta para registrar el abono)
// o Despues. Se puede deslizar: derecha = recordar, izquierda = despues.

type Action = 'remind' | 'paid' | 'skip';
/** Pixeles que hay que deslizar para que cuente */
const SWIPE = 110;

function reminderText(s: TowerSale) {
  const first = s.client.split(/\s+/)[0];
  if (!s.next) return `¡Hola ${first}! ✈️`;
  return s.status === 'OVERDUE'
    ? `¡Hola ${first}! ✈️ Te escribimos por tu viaje (folio ${s.folio}). Tienes un pago pendiente de ${money(s.overdueAmount || s.next.pending)} que vencía el ${longDate(s.next.dueDate)}. Cualquier duda estamos para ayudarte 💙`
    : `¡Hola ${first}! ✈️ Te recordamos que tu próximo pago de ${money(s.next.pending)} vence el ${longDate(s.next.dueDate)}. ¡Gracias! 💙`;
}

export function CollectionMode({ open, onOpenChange, sales }: { open: boolean; onOpenChange: (open: boolean) => void; sales: TowerSale[] }) {
  const [queue, setQueue] = useState<TowerSale[]>([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<{ remind: TowerSale[]; paid: TowerSale[]; skip: TowerSale[] }>({ remind: [], paid: [], skip: [] });
  const card = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  // Sellos que aparecen al deslizar: derecha = WhatsApp (verde), izquierda = despues
  const remindStamp = useRef<HTMLDivElement>(null);
  const skipStamp = useRef<HTMLDivElement>(null);
  const [leaning, setLeaning] = useState<'remind' | 'skip' | null>(null);

  // Al abrir: atrasados primero, luego los de pago cercano (el mas proximo primero).
  // Solo al abrir: si la lista se actualiza en vivo no se reinicia la ronda.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const list = sales
      .filter((s) => s.status === 'OVERDUE' || s.status === 'DUE_SOON')
      .sort((a, b) => STATUS_META[a.status].order - STATUS_META[b.status].order || (a.next?.dueDate ?? '').localeCompare(b.next?.dueDate ?? ''));
    setQueue(list);
    setIndex(0);
    setDone({ remind: [], paid: [], skip: [] });
  }, [open, sales]);

  const current = queue[index];
  const finished = open && queue.length > 0 && index >= queue.length;

  // Entrada de cada tarjeta
  useEffect(() => {
    if (!card.current || prefersReducedMotion()) return;
    gsap.fromTo(card.current, { y: 20, scale: 0.95, opacity: 0.6, rotation: 0, x: 0, transformOrigin: '50% 100%' }, { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.6)' });
    gsap.set([remindStamp.current, skipStamp.current], { opacity: 0 });
  }, [index, current?.id]);

  // Resumen final con confeti
  useEffect(() => {
    if (!finished) return;
    if (!prefersReducedMotion()) {
      confetti({ particleCount: 110, spread: 90, origin: { y: 0.55 }, colors: ['#0ea5e9', '#22d3ee', '#10b981', '#fbbf24'] });
      if (summaryRef.current) gsap.from(summaryRef.current.querySelectorAll('[data-sum]'), { y: 20, opacity: 0, stagger: 0.1, duration: 0.5, ease: 'power3.out' });
    }
  }, [finished]);

  const act = useCallback(
    (action: Action) => {
      if (!current || busy.current) return;
      busy.current = true;
      if (action === 'remind' && current.phone) window.open(whatsappTo(current.phone, reminderText(current)), '_blank', 'noopener,noreferrer');
      if (action === 'paid') window.open(`/sales/${current.id}`, '_blank', 'noopener,noreferrer');
      setDone((d) => ({ ...d, [action]: [...d[action], current] }));

      const advance = () => {
        busy.current = false;
        setIndex((i) => i + 1);
      };
      if (!card.current || prefersReducedMotion()) return advance();
      const dir = action === 'skip' ? -1 : 1;
      setLeaning(null);
      if (action !== 'paid') gsap.to(action === 'remind' ? remindStamp.current : skipStamp.current, { opacity: 1, duration: 0.12 });
      gsap.to(card.current, {
        x: action === 'paid' ? 0 : dir * 520,
        y: action === 'paid' ? -420 : 40,
        rotation: action === 'paid' ? 0 : dir * 22,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: advance,
      });
    },
    [current]
  );

  // Teclado: → recordar, ← despues, ↑ ya pago
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') act('remind');
      if (e.key === 'ArrowLeft') act('skip');
      if (e.key === 'ArrowUp') act('paid');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, act]);

  // Deslizar con el dedo o el mouse
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    drag.current = { x: e.clientX, dx: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !card.current) return;
    const dx = (drag.current.dx = e.clientX - drag.current.x);
    gsap.set(card.current, { x: dx, rotation: dx / 18 });
    // El sello se va llenando; al pasar el umbral crece ("suelta para...")
    const p = Math.min(1, Math.abs(dx) / SWIPE);
    const over = Math.abs(dx) >= SWIPE;
    gsap.set(remindStamp.current, { opacity: dx > 0 ? p : 0 });
    gsap.set(skipStamp.current, { opacity: dx < 0 ? p : 0 });
    gsap.to(dx > 0 ? '[data-stamp-icon="remind"]' : '[data-stamp-icon="skip"]', { scale: over ? 1.15 : 0.85 + p * 0.15, duration: 0.15, overwrite: true });
    setLeaning(dx > 20 ? 'remind' : dx < -20 ? 'skip' : null);
  };
  const onPointerUp = () => {
    if (!drag.current || !card.current) return;
    const { dx } = drag.current;
    drag.current = null;
    setLeaning(null);
    if (dx > SWIPE && current?.phone) act('remind');
    else if (dx < -SWIPE) act('skip');
    else {
      gsap.to(card.current, { x: 0, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
      gsap.to([remindStamp.current, skipStamp.current], { opacity: 0, duration: 0.2 });
    }
  };

  const amountOf = (x: TowerSale) => x.overdueAmount || x.next?.pending || 0;
  const remaining = queue.slice(index);
  const remainingAmount = remaining.reduce((t, x) => t + amountOf(x), 0);
  const contactedAmount = [...done.remind, ...done.paid].reduce((s, x) => s + (x.overdueAmount || x.next?.pending || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Modo cobranza
          </DialogTitle>
          <DialogDescription>
            {queue.length === 0
              ? 'No hay clientes atrasados ni con pago en los próximos 7 días. 🎉'
              : finished
                ? '¡Terminaste la ronda!'
                : `Cliente ${Math.min(index + 1, queue.length)} de ${queue.length} · desliza → recordar, ← después`}
          </DialogDescription>
        </DialogHeader>

        {/* Avance */}
        {queue.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-500" style={{ width: `${(Math.min(index, queue.length) / queue.length) * 100}%` }} />
          </div>
        )}
        {queue.length > 0 && !finished && (
          <p className="-mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              Faltan <b className="text-foreground">{remaining.length}</b> cliente{remaining.length === 1 ? '' : 's'}
            </span>
            <span>
              <b className="tabular-nums text-foreground">{money(remainingAmount)}</b> por cobrar
            </span>
          </p>
        )}

        {current && !finished && (
          <div className="py-2">
            {/* Mazo: la tarjeta actual y asoman las siguientes (con su monto) */}
            <div className="relative pb-11">
              {[2, 1].map((offset) => {
                const next = queue[index + offset];
                if (!next) return null;
                return (
                  <div
                    key={next.id}
                    aria-hidden
                    className="absolute inset-x-0 bottom-11 top-0 flex items-end justify-between rounded-3xl border bg-card px-5 pb-1 text-[11px] text-muted-foreground shadow-md"
                    style={{ transform: `translateY(${offset * 20}px) scale(${1 - offset * 0.05})`, transformOrigin: 'bottom center', opacity: offset === 1 ? 0.9 : 0.5, zIndex: 3 - offset }}
                  >
                    {offset === 1 && (
                      <>
                        <span className="truncate pr-2">Sigue: {next.client}</span>
                        <b className={cn('shrink-0 tabular-nums', next.status === 'OVERDUE' ? 'text-red-500' : 'text-amber-500')}>{money(amountOf(next))}</b>
                      </>
                    )}
                  </div>
                );
              })}

              <div
                ref={card}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative z-10 cursor-grab touch-pan-y select-none overflow-hidden rounded-3xl border bg-card p-5 shadow-xl active:cursor-grabbing"
              >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold">{current.client}</p>
                  <p className="font-mono text-xs text-muted-foreground">Folio {current.folio}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_META[current.status].badge)}>
                  {STATUS_META[current.status].label}
                </span>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{current.status === 'OVERDUE' ? 'Debe' : 'Próximo pago'}</p>
                <p className={cn('text-4xl font-black tabular-nums', current.status === 'OVERDUE' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                  {money(current.overdueAmount || current.next?.pending || 0)}
                </p>
                {current.next && (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    Pago #{current.next.number} · {longDate(current.next.dueDate)} ({whenLabel(current.next.dueDate)})
                  </p>
                )}
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Pagado {money(current.paid)}</span>
                  <span>de {money(current.total)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${current.pct}%`, background: STATUS_META[current.status].color }} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {current.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {current.phone}
                  </span>
                )}
                {current.departureDate && (
                  <span className="flex items-center gap-1">
                    <Plane className="h-3.5 w-3.5" />
                    Viaja {whenLabel(current.departureDate)}
                  </span>
                )}
                {current.agent && <span>Agente: {current.agent}</span>}
              </div>

                {/* Sello derecha: WhatsApp */}
                <div ref={remindStamp} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-500/90 text-white opacity-0">
                  <span data-stamp-icon="remind" className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/60">
                    <MessageCircle className="h-11 w-11" />
                  </span>
                  <span className="text-lg font-black tracking-wide">{current.phone ? 'RECORDAR POR WHATSAPP' : 'SIN TELÉFONO'}</span>
                  <span className="text-xs opacity-90">{current.phone ? 'Suelta para enviar' : 'No se puede enviar'}</span>
                </div>
                {/* Sello izquierda: despues */}
                <div ref={skipStamp} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-600/90 text-white opacity-0">
                  <span data-stamp-icon="skip" className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/50">
                    <SkipForward className="h-11 w-11" />
                  </span>
                  <span className="text-lg font-black tracking-wide">SALTAR · DESPUÉS</span>
                  <span className="text-xs opacity-90">Suelta para dejarlo al final</span>
                </div>
              </div>
            </div>

            <div className="relative z-20 mt-2 grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => act('skip')} className={cn('transition-all', leaning === 'skip' && 'scale-105 bg-slate-600 text-white ring-2 ring-slate-400')}>
                <SkipForward className="mr-1.5 h-4 w-4" />
                Después
              </Button>
              <Button variant="outline" onClick={() => act('paid')} className="text-sky-700 dark:text-sky-300">
                <Receipt className="mr-1.5 h-4 w-4" />
                Ya pagó
              </Button>
              <Button
                onClick={() => act('remind')}
                disabled={!current.phone}
                className={cn('bg-emerald-600 text-white transition-all hover:bg-emerald-700', leaning === 'remind' && 'scale-105 ring-2 ring-emerald-300')}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Recordar
              </Button>
            </div>
            {!current.phone && <p className="mt-2 text-center text-xs text-muted-foreground">Este cliente no tiene teléfono registrado.</p>}
          </div>
        )}

        {finished && (
          <div ref={summaryRef} className="space-y-4 py-4 text-center">
            <CheckCircle2 data-sum className="mx-auto h-14 w-14 text-emerald-500" />
            <p data-sum className="text-lg font-bold">
              ¡Listo! Contactaste a {done.remind.length + done.paid.length} cliente{done.remind.length + done.paid.length === 1 ? '' : 's'}
            </p>
            <div data-sum className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{done.remind.length}</p>
                <p className="text-xs text-muted-foreground">Recordados</p>
              </div>
              <div className="rounded-xl bg-sky-500/10 p-3">
                <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{done.paid.length}</p>
                <p className="text-xs text-muted-foreground">Ya pagaron</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-2xl font-black">{done.skip.length}</p>
                <p className="text-xs text-muted-foreground">Para después</p>
              </div>
            </div>
            {contactedAmount > 0 && (
              <p data-sum className="text-sm text-muted-foreground">
                <b className="text-foreground">{money(contactedAmount)}</b> por cobrar de los clientes que contactaste.
              </p>
            )}
            <div data-sum className="flex justify-center gap-2">
              {done.skip.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQueue(done.skip);
                    setIndex(0);
                    setDone((d) => ({ ...d, skip: [] }));
                  }}
                >
                  Repasar los de "después"
                </Button>
              )}
              <Button variant="gradient" onClick={() => onOpenChange(false)}>
                Terminar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
