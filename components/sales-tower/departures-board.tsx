'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { MessageCircle, PlaneTakeoff } from 'lucide-react';
import { whatsappTo } from '@/components/client-link-dialog';
import { STATUS_META, longDate, money, prefersReducedMotion, shortDate, whenLabel, type TowerUpcoming } from './types';

// Tablero de salidas (como en el aeropuerto): los proximos cobros, atrasados
// primero. Las letras entran girando como los letreros de paletas.

function reminder(u: TowerUpcoming) {
  const first = u.client.split(/\s+/)[0];
  return u.status === 'OVERDUE'
    ? `¡Hola ${first}! ✈️ Te recordamos tu pago #${u.number} de ${money(u.pending)} que vencía el ${longDate(u.dueDate)}. Cualquier duda estamos para ayudarte 💙`
    : `¡Hola ${first}! ✈️ Te recordamos tu pago #${u.number} de ${money(u.pending)}, vence el ${longDate(u.dueDate)}. ¡Gracias! 💙`;
}

export function DeparturesBoard({ items }: { items: TowerUpcoming[] }) {
  const root = useRef<HTMLDivElement>(null);
  const key = items.map((i) => `${i.saleId}${i.number}`).join('|');

  useEffect(() => {
    if (!root.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-flap]',
        { rotationX: -90, opacity: 0, transformPerspective: 400, transformOrigin: '50% 50%' },
        { rotationX: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.045 }
      );
    }, root);
    return () => ctx.revert();
  }, [key]);

  return (
    <div ref={root} className="overflow-hidden rounded-2xl bg-slate-950 text-slate-100 shadow-inner">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <PlaneTakeoff className="h-4 w-4 text-amber-300" />
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">Próximos cobros</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">Sin cobros pendientes 🎉</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((u) => {
            const meta = STATUS_META[u.status];
            return (
              <li key={`${u.saleId}-${u.number}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                <span data-flap className="w-14 shrink-0 rounded bg-black/60 px-1.5 py-1 text-center font-mono text-xs font-bold uppercase text-amber-300">
                  {shortDate(u.dueDate)}
                </span>
                <Link href={`/sales/${u.saleId}`} className="min-w-0 flex-1">
                  <span data-flap className="block truncate font-mono text-sm uppercase tracking-wide">
                    {u.client}
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    Pago #{u.number} · {whenLabel(u.dueDate)}
                  </span>
                </Link>
                <span className="text-right">
                  <span data-flap className="block font-mono text-sm font-bold tabular-nums">
                    {money(u.pending)}
                  </span>
                  <span className="block text-[10px] font-bold tracking-widest" style={{ color: meta.color }}>
                    {meta.short}
                  </span>
                </span>
                {u.phone && (
                  <a
                    href={whatsappTo(u.phone, reminder(u))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Recordar por WhatsApp"
                    className="rounded-md p-1.5 text-emerald-400 opacity-70 hover:bg-white/10 hover:opacity-100"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
