'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { AlertCircle, Building2, Check, ClipboardList, FileText, MessageCircle, PlaneTakeoff, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TodayKind, TodayTask } from '@/lib/dashboard-today';

// "Que hago hoy": lista de acciones del dia. Se pueden palomear (se recuerda en
// este navegador solo por hoy) y cada una trae su boton de WhatsApp.

const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const STORAGE_KEY = 'tf-today-done';

const KIND: Record<TodayKind, { icon: typeof AlertCircle; color: string; bg: string }> = {
  overdue: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  due: { icon: Wallet, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  supplier: { icon: Building2, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  quote: { icon: FileText, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
  departure: { icon: PlaneTakeoff, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
};

function readDone(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>, valid: string[]) {
  try {
    // Solo se guardan las de hoy (los ids llevan la fecha), asi no crece sin limite
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...done].filter((id) => valid.includes(id))));
  } catch {
    /* modo privado: no pasa nada, solo no se recuerda */
  }
}

export function TodayTasks({ tasks, more }: { tasks: TodayTask[]; more: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDone(readDone());
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-task]', { x: -24, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out', delay: 0.15 });
      gsap.from('[data-progress]', { scaleX: 0, transformOrigin: '0% 50%', duration: 0.9, ease: 'power3.out', delay: 0.3 });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => t.id).join('|')]);

  const toggle = (id: string, target: HTMLElement) => {
    const next = new Set(done);
    const nowDone = !next.has(id);
    if (nowDone) next.add(id);
    else next.delete(id);
    setDone(next);
    saveDone(next, tasks.map((t) => t.id));
    if (nowDone && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(target, { scale: 0.6, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
    }
  };

  const doneCount = tasks.filter((t) => done.has(t.id)).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  if (tasks.length === 0) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-lg">🎉</span>
        <div>
          <p className="text-sm font-semibold">Todo al día</p>
          <p className="text-xs text-muted-foreground">Sin cobros atrasados, pagos a proveedores ni cotizaciones por vencer.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div ref={root}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-4 w-4 text-primary" />
            Qué hago hoy
          </h3>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {allDone ? '¡Listo por hoy! 🙌' : `${doneCount} de ${tasks.length} hechas`}
          </span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            data-progress
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-[width] duration-500"
            style={{ width: `${(doneCount / tasks.length) * 100}%` }}
          />
        </div>

        <ul className="grid gap-2 lg:grid-cols-2">
          {tasks.map((t) => {
            const k = KIND[t.kind];
            const isDone = done.has(t.id);
            return (
              <li
                key={t.id}
                data-task
                className={cn('flex items-center gap-3 rounded-xl border p-2.5 transition-opacity', isDone && 'opacity-50')}
              >
                <button
                  type="button"
                  onClick={(e) => toggle(t.id, e.currentTarget)}
                  aria-pressed={isDone}
                  aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-primary'
                  )}
                >
                  {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', k.bg)}>
                  <k.icon className={cn('h-4 w-4', k.color)} />
                </span>
                <Link href={t.href} className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-medium', isDone && 'line-through')}>{t.title}</span>
                  <span className={cn('block truncate text-[11px]', k.color)}>{t.detail}</span>
                </Link>
                {t.amount !== null && <span className="hidden shrink-0 text-sm font-bold tabular-nums sm:block">{money(t.amount)}</span>}
                {t.whatsapp && (
                  <a
                    href={t.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Enviar WhatsApp"
                    aria-label="Enviar WhatsApp"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-110"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        {more > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            y {more} pendiente{more === 1 ? '' : 's'} más ·{' '}
            <Link href="/sales/tower" className="font-medium text-primary hover:underline">
              Ver en Torre de control →
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}
