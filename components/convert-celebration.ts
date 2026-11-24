import gsap from 'gsap';
import confetti from 'canvas-confetti';

// Cotizacion -> Venta: la hoja de la cotizacion gira en 3D y del otro lado es un
// pase de abordar ("Venta confirmada"). Termina sola y despues se navega a la venta.
// Los textos se ponen con textContent (nunca HTML con datos del cliente).

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string) {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function playConvertAnimation(params: { clientName?: string | null; folio: string; total?: number | null }): Promise<void> {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    confetti?.({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const overlay = el('div', 'position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.55);backdrop-filter:blur(4px);opacity:0');
    overlay.setAttribute('aria-hidden', 'true');
    const scene = el('div', 'perspective:1200px');
    const card = el('div', 'position:relative;width:min(84vw,340px);height:210px;transform-style:preserve-3d');

    const face = 'position:absolute;inset:0;border-radius:22px;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 30px 60px -20px rgba(2,6,23,.6);overflow:hidden;font-family:system-ui,sans-serif';

    // Frente: la cotizacion (hoja de papel)
    const front = el('div', `${face};background:#fff;color:#0f172a;padding:22px`);
    front.appendChild(el('div', 'font:800 12px/1 system-ui;letter-spacing:.25em;color:#64748b', 'COTIZACIÓN'));
    front.appendChild(el('div', 'margin-top:10px;font:800 22px/1.15 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', params.clientName || 'Cliente'));
    for (let i = 0; i < 4; i++) front.appendChild(el('div', `margin-top:${i ? 9 : 16}px;height:8px;border-radius:4px;background:#e2e8f0;width:${[92, 78, 85, 60][i]}%`));
    front.appendChild(el('div', 'position:absolute;right:20px;bottom:18px;font:800 12px system-ui;color:#94a3b8', `Folio ${params.folio}`));

    // Reverso: el pase de abordar
    const back = el('div', `${face};transform:rotateY(180deg);background:linear-gradient(135deg,#1e3a8a,#1d4ed8 45%,#0ea5e9);color:#fff;padding:22px`);
    back.appendChild(el('div', 'font:700 11px/1 system-ui;letter-spacing:.25em;opacity:.8', 'PASE DE ABORDAR'));
    back.appendChild(el('div', 'margin-top:6px;font:900 24px/1 system-ui', '¡VENTA CONFIRMADA!'));
    back.appendChild(el('div', 'margin-top:14px;font:600 11px/1 system-ui;letter-spacing:.2em;opacity:.7', 'PASAJERO'));
    back.appendChild(el('div', 'margin-top:4px;font:800 20px/1.1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', params.clientName || 'Cliente'));
    const row = el('div', 'position:absolute;left:22px;right:22px;bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px dashed rgba(255,255,255,.35);padding-top:10px');
    row.appendChild(el('div', 'font:800 13px system-ui', `Folio ${params.folio}`));
    if (params.total) row.appendChild(el('div', 'font:900 18px system-ui', `$${Math.round(params.total).toLocaleString('es-MX')}`));
    row.appendChild(el('div', 'font:400 26px/1 system-ui', '✈️'));
    back.appendChild(row);

    card.append(front, back);
    scene.appendChild(card);
    overlay.appendChild(scene);
    document.body.appendChild(overlay);

    const colors = ['#1d4ed8', '#0ea5e9', '#22d3ee', '#fbbf24', '#ffffff'];
    gsap
      .timeline({
        onComplete: () => {
          overlay.remove();
          resolve();
        },
      })
      .to(overlay, { opacity: 1, duration: 0.25 })
      .fromTo(card, { scale: 0.6, y: 60, rotationX: 20 }, { scale: 1, y: 0, rotationX: 0, duration: 0.55, ease: 'back.out(1.6)' }, '<')
      .to(card, { rotationY: 180, scale: 1.08, duration: 0.85, ease: 'power3.inOut' }, '+=0.35')
      .add(() => {
        confetti({ particleCount: 120, spread: 100, origin: { y: 0.55 }, colors, zIndex: 100 });
      }, '-=0.3')
      .to(card, { scale: 1, duration: 0.3, ease: 'power2.out' })
      .to(card, { y: -16, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' })
      .to(overlay, { opacity: 0, duration: 0.35 }, '+=0.1');
  });
}
