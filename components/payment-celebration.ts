import gsap from 'gsap';
import confetti from 'canvas-confetti';

// Celebracion al registrar un cobro: confeti pequeño en cada abono y, si la
// venta queda liquidada, un sello grande de "¡PAGADO!" que cae en la pantalla.

const COLORS = ['#0ea5e9', '#22d3ee', '#10b981', '#fbbf24', '#a78bfa'];

export function celebratePayment(liquidated: boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!liquidated) {
    if (!reduce) confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: 0.7 }, colors: COLORS });
    return;
  }

  confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: COLORS });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: COLORS }), 250);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: COLORS }), 400);
  if (reduce) return;

  // Sello en pantalla (se crea y se quita solo; texto fijo, sin HTML externo)
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:80';
  const stamp = document.createElement('div');
  stamp.textContent = '¡PAGADO!';
  stamp.style.cssText =
    'font: 900 clamp(40px, 9vw, 96px)/1 system-ui, sans-serif; letter-spacing: .12em; color: #16a34a; ' +
    'border: 10px double #16a34a; border-radius: 24px; padding: 12px 32px; background: rgba(255,255,255,.85); ' +
    'box-shadow: 0 20px 60px -20px rgba(2,6,23,.5)';
  layer.appendChild(stamp);
  document.body.appendChild(layer);

  gsap
    .timeline({ onComplete: () => layer.remove() })
    .fromTo(stamp, { scale: 3, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: -12, duration: 0.35, ease: 'power4.in' })
    .to(stamp, { x: 6, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' })
    .to(stamp, { opacity: 0, scale: 0.9, duration: 0.5, delay: 1.2, ease: 'power2.in' });
}
