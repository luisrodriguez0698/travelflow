'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { PlaneTakeoff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tablero de salidas (como el del aeropuerto): los viajes de los proximos 30 dias
// con cuenta regresiva. Las letras entran girando como letreros de paletas.

interface Trip {
  id: string;
  clientName: string;
  destinationName: string;
  hotelName: string | null;
  departureDate: string;
  hasPendingPayments: boolean;
}

const TZ = 'America/Mexico_City';
const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', timeZone: TZ }).replace(/\./g, '').toUpperCase();

function daysUntil(iso: string) {
  const a = new Date(ymd(new Date(iso)));
  const b = new Date(ymd(new Date()));
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function countdown(iso: string) {
  const d = daysUntil(iso);
  if (d <= 0) return { text: 'HOY', tone: 'text-emerald-300' };
  if (d === 1) return { text: 'MAÑANA', tone: 'text-amber-300' };
  return { text: `${d} DÍAS`, tone: d <= 7 ? 'text-amber-300' : 'text-sky-300' };
}

export function TripDeparturesBoard() {
  const root = useRef<HTMLDivElement>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    const start = new Date();
    const end = new Date(Date.now() + 30 * 86_400_000);
    const params = new URLSearchParams({ startDate: ymd(start), endDate: ymd(end) });
    fetch(`/api/sales/calendar?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Trip[]) => {
        const today = ymd(new Date());
        // Solo los que salen de hoy en adelante (no los que ya van de viaje)
        setTrips(
          (Array.isArray(list) ? list : [])
            .filter((t) => t.departureDate && ymd(new Date(t.departureDate)) >= today)
            .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
            .slice(0, 8)
        );
      })
      .catch(() => setTrips([]));
  }, []);

  const key = trips?.map((t) => t.id).join('|') ?? '';
  useEffect(() => {
    if (!root.current || !trips?.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-flap]',
        { rotationX: -90, opacity: 0, transformPerspective: 400 },
        { rotationX: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.035 }
      );
      gsap.to('[data-soon]', { opacity: 0.35, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1 });
    }, root);
    return () => ctx.revert();
  }, [key, trips?.length]);

  if (!trips) return null;

  return (
    <div ref={root} className="overflow-hidden rounded-2xl bg-slate-950 text-slate-100 shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
          <PlaneTakeoff className="h-4 w-4" />
          Salidas · próximos 30 días
        </p>
        <span className="font-mono text-[11px] text-slate-400">{trips.length} vuelo{trips.length === 1 ? '' : 's'}</span>
      </div>
      {trips.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">No hay salidas en los próximos 30 días.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-2 py-2 font-semibold">Pasajero</th>
                <th className="px-2 py-2 font-semibold">Destino</th>
                <th className="px-2 py-2 font-semibold">Sale en</th>
                <th className="px-4 py-2 text-right font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trips.map((t) => {
                const cd = countdown(t.departureDate);
                const soon = daysUntil(t.departureDate) <= 1;
                return (
                  <tr key={t.id} className="hover:bg-white/5">
                    <td className="px-4 py-2">
                      <span data-flap className="inline-block rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300">
                        {shortDate(t.departureDate)}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-2 py-2">
                      <Link href={`/sales/${t.id}`} data-flap className="block truncate font-mono text-sm uppercase tracking-wide hover:text-sky-300">
                        {t.clientName}
                      </Link>
                    </td>
                    <td className="max-w-[180px] px-2 py-2">
                      <span data-flap className="block truncate font-mono text-xs uppercase text-slate-300">
                        {t.destinationName || t.hotelName || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span data-flap {...(soon ? { 'data-soon': '' } : {})} className={cn('font-mono text-xs font-bold', cd.tone)}>
                        {cd.text}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest',
                          t.hasPendingPayments ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                        )}
                      >
                        {t.hasPendingPayments ? 'CON SALDO' : 'PAGADO'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
