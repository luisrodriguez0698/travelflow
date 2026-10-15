// Imagenes de la invitacion (public/invitacion). Se usan las copias WebP
// optimizadas de public/invitacion/web (los PNG originales pesan mucho para celular).

const BASE = '/invitacion/web';

export const ASSETS = {
  background: `${BASE}/fondo.webp`,
  plane: `${BASE}/avion-azul.webp`, // apunta a la derecha (girado de avion-azul.png)
  cloud: `${BASE}/nube.webp`,
  cloudOne: `${BASE}/nube_1.webp`,
  balloonBlue: `${BASE}/globo-azul.webp`,
  balloonSilver: `${BASE}/globo-plata.webp`,
  balloonGold: `${BASE}/globo-dorado.webp`, // ya viene desenfocado (bokeh)
  logo: `${BASE}/logo-blanco.webp`,
  icon: `${BASE}/icono_logo.webp`,
  saveThe: `${BASE}/save-the.webp`,
  date: `${BASE}/date.webp`,
} as const;

export const TZ = 'America/Mexico_City';

/** Texto de la invitacion cuando el evento no tiene uno propio. */
export const DEFAULT_MESSAGE =
  'Hay viajes que se recuerdan para siempre, y este año tú fuiste parte del nuestro. ' +
  'Cada reservación, cada llamada y cada destino compartido nos trajo hasta aquí. ' +
  'Queremos celebrarlo con quienes hicieron posible cada vuelo: tu lugar ya está reservado.';
