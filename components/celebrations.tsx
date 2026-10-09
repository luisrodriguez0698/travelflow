'use client';

import { toast } from 'sonner';
import { useRealtimeEvent } from './realtime-provider';
import { playChime } from '@/lib/notify-sound';

// Celebraciones en vivo (p. ej. "¡Meta alcanzada!"): confeti + felicitacion.
async function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = (await import('canvas-confetti')).default;
  const colors = ['#2563eb', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899'];
  const end = Date.now() + 1600;
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, zIndex: 9999 });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors, zIndex: 9999 });
  frame();
}

export function Celebrations() {
  useRealtimeEvent<{ title: string; body: string }>('celebrate', (e) => {
    fireConfetti();
    playChime();
    toast.success(e.title, { description: e.body, duration: 8000 });
  });
  return null;
}
