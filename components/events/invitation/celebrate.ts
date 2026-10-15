import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { ASSETS } from './assets';

/** Globos azules y plateados que suben desde abajo + confeti de la marca. */
export function celebrate() {
  const colors = ['#1d4ed8', '#38bdf8', '#e2e8f0', '#ffffff', '#93c5fd'];
  confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.65 }, colors });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors }), 400);

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:60';
  document.body.appendChild(layer);

  const count = window.innerWidth < 640 ? 9 : 14;
  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = i % 2 ? ASSETS.balloonSilver : ASSETS.balloonBlue;
    img.alt = '';
    const size = gsap.utils.random(56, 110);
    img.style.cssText = `position:absolute;bottom:-160px;left:${gsap.utils.random(0, 92)}%;width:${size}px`;
    layer.appendChild(img);
    gsap.to(img, { y: -(window.innerHeight + 320), duration: gsap.utils.random(4.5, 7.5), delay: gsap.utils.random(0, 1.2), ease: 'power1.in' });
    gsap.to(img, { x: gsap.utils.random(-50, 50), rotation: gsap.utils.random(-12, 12), duration: gsap.utils.random(1.2, 2), yoyo: true, repeat: 5, ease: 'sine.inOut' });
  }
  setTimeout(() => layer.remove(), 9500);
}
