'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { BadgeCheck, Coins, Landmark, Plane, ShoppingCart, Stamp, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Pasaporte de la venta: cada etapa es un sello que se "estampa" (Vendida,
// Anticipo, cada Abono, Liquidada y el Viaje). El viaje que aun no llega
// aparece como sello en espera.

interface Collection {
  id: string;
  kind: 'anticipo' | 'contado' | 'abono';
  amount: number;
  date: string;
  agent: string | null;
}

interface StampData {
  key: string;
  title: string;
  date: string | null;
  detail?: string;
  icon: LucideIcon;
  color: string;
  ghost?: boolean;
  big?: boolean;
}

const TZ = 'America/Mexico_City';
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).replace('.', '').toUpperCase();
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function daysUntil(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86_400_000);
}

export function SalePassport({
  saleId,
  saleDate,
  creatorName,
  destination,
  departureDate,
  settled,
  refreshKey,
}: {
  saleId: string;
  saleDate: string;
  creatorName?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  settled: boolean;
  refreshKey?: unknown;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Collection[] | null>(null);

  useEffect(() => {
    fetch(`/api/sales/${saleId}/collections`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
  }, [saleId, refreshKey]);

  const stamps = useMemo<StampData[]>(() => {
    if (!items) return [];
    const list: StampData[] = [
      { key: 'sold', title: 'Vendida', date: saleDate, detail: creatorName ? `por ${creatorName.split(' ')[0]}` : undefined, icon: ShoppingCart, color: '#2563eb' },
    ];
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    let abono = 0;
    for (const c of sorted) {
      if (c.kind === 'abono') abono += 1;
      list.push({
        key: c.id,
        title: c.kind === 'anticipo' ? 'Anticipo' : c.kind === 'contado' ? 'Contado' : `Abono ${abono}`,
        date: c.date,
        detail: money(c.amount),
        icon: c.kind === 'abono' ? Coins : Landmark,
        color: c.kind === 'anticipo' ? '#7c3aed' : c.kind === 'contado' ? '#059669' : '#0891b2',
      });
    }
    if (settled) {
      list.push({ key: 'paid', title: 'Pagado', date: sorted.at(-1)?.date ?? null, detail: 'Liquidada', icon: BadgeCheck, color: '#16a34a', big: true });
    }
    if (departureDate) {
      const d = daysUntil(departureDate);
      list.push(
        d <= 0
          ? { key: 'trip', title: '¡Buen viaje!', date: departureDate, detail: destination ?? undefined, icon: Plane, color: '#0284c7', big: true }
          : {
              key: 'trip',
              title: destination ? destination.split(',')[0] : 'Viaje',
              date: departureDate,
              detail: `sale en ${d} día${d === 1 ? '' : 's'}`,
              icon: Plane,
              color: '#0284c7',
              ghost: true,
            }
      );
    }
    return list;
  }, [items, saleDate, creatorName, destination, departureDate, settled]);

  // Cada sello cae "golpeando" el papel, uno tras otro
  const key = stamps.map((s) => s.key).join('|');
  useEffect(() => {
    const el = root.current;
    if (!el || !stamps.length || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-stamp]').forEach((stamp, i) => {
        const rot = Number(stamp.dataset.rot);
        const ghost = stamp.dataset.ghost === '1';
        const tl = gsap.timeline({ delay: 0.2 + i * 0.16 });
        if (ghost) {
          tl.fromTo(stamp, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
        } else {
          tl.fromTo(
            stamp,
            { scale: 2.4, opacity: 0, rotation: rot - 25 },
            { scale: 1, opacity: 1, rotation: rot, duration: 0.32, ease: 'power4.in' }
          ).to(stamp, { x: 2, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' });
        }
      });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!items) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Stamp className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Pasaporte de la venta</h2>
        <span className="text-xs text-muted-foreground">· cada etapa, un sello</span>
      </div>
      <div
        ref={root}
        className="relative flex gap-4 overflow-x-auto px-4 py-6 sm:flex-wrap sm:px-6"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 27px, hsl(var(--border) / 0.35) 27px 28px), radial-gradient(circle at 15% 20%, rgba(14,165,233,0.05), transparent 40%)',
        }}
      >
        {stamps.map((s, i) => {
          const rot = ((i * 37) % 15) - 7; // inclinacion "a mano", estable entre renders
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              data-stamp
              data-rot={rot}
              data-ghost={s.ghost ? '1' : '0'}
              className={cn(
                'flex shrink-0 flex-col items-center justify-center rounded-2xl border-[3px] px-3 py-2 text-center',
                s.big ? 'h-28 w-28 rounded-full' : 'h-24 w-28',
                s.ghost ? 'border-dashed opacity-60' : 'border-double'
              )}
              style={{
                borderColor: s.color,
                color: s.color,
                transform: `rotate(${rot}deg)`,
                background: s.ghost ? 'transparent' : `${s.color}14`,
              }}
              title={s.ghost ? 'Aún no llega' : undefined}
            >
              <Icon className="h-5 w-5" />
              <p className="mt-0.5 text-[11px] font-black uppercase leading-tight tracking-wider">{s.title}</p>
              {s.date && <p className="text-[10px] font-bold tabular-nums">{fmt(s.date)}</p>}
              {s.detail && <p className="max-w-full truncate text-[10px] font-semibold opacity-80">{s.detail}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
