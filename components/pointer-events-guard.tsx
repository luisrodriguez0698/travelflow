'use client';

import { useEffect } from 'react';

/**
 * Radix (dialogs, alert dialogs, drawers) pone `pointer-events: none` en el
 * <body> mientras un modal esta abierto. Si se encadenan dos modales, al cerrar
 * puede quedarse puesto y la pagina "se congela" hasta recargar. Este guardia
 * lo quita cuando ya no queda ningun modal abierto.
 */
export function PointerEventsGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      clearTimeout(timer);
      // Espera a que terminen las animaciones de cierre
      timer = setTimeout(() => {
        const stuck = document.body.style.pointerEvents === 'none';
        const modalOpen = document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
        );
        if (stuck && !modalOpen) document.body.style.pointerEvents = '';
      }, 400);
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return null;
}
