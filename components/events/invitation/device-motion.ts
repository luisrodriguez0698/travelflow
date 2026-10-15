// Sensores del celular: inclinacion (giroscopio) y agitar.
// iPhone pide permiso y SOLO lo acepta dentro de un toque completo (al soltar
// el dedo o en un click; al apoyar el dedo no cuenta). requestMotionPermission()
// se llama en esos momentos y se puede reintentar si fallo.
// En computadora no hay sensores: nada de esto se activa y queda el mouse.

type TiltListener = (x: number, y: number) => void; // -1 … 1
type ShakeListener = () => void;

const tiltListeners = new Set<TiltListener>();
const shakeListeners = new Set<ShakeListener>();
let listening = false;
let granted = false;
let base: { beta: number; gamma: number } | null = null;
let lastShake = 0;

/** Grados de inclinacion para llegar al maximo (menos = mas sensible). */
const TILT_RANGE = 12;

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta === null || e.gamma === null) return;
  // La posicion "neutra" es como la persona sostiene el celular; se va
  // acomodando despacio para que siempre responda aunque cambie de postura
  if (!base) base = { beta: e.beta, gamma: e.gamma };
  else {
    base.beta += (e.beta - base.beta) * 0.01;
    base.gamma += (e.gamma - base.gamma) * 0.01;
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const x = clamp((e.gamma - base.gamma) / TILT_RANGE);
  const y = clamp((e.beta - base.beta) / TILT_RANGE);
  tiltListeners.forEach((l) => l(x, y));
}

function onMotion(e: DeviceMotionEvent) {
  const now = Date.now();
  if (now - lastShake < 2000) return;
  // Sin gravedad (si el celular lo da): una sacudida pasa de ~14 m/s²
  const a = e.acceleration;
  let shaken = false;
  if (a && a.x !== null && a.y !== null && a.z !== null) {
    shaken = Math.hypot(a.x, a.y, a.z) > 14;
  } else {
    const g = e.accelerationIncludingGravity;
    if (g && g.x !== null && g.y !== null && g.z !== null) shaken = Math.hypot(g.x, g.y, g.z) > 24; // reposo ≈ 9.8
  }
  if (shaken) {
    lastShake = now;
    shakeListeners.forEach((l) => l());
  }
}

function startListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('deviceorientation', onOrientation);
  window.addEventListener('devicemotion', onMotion);
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Pide permiso (iPhone) y empieza a escuchar. Llamar en un click o al soltar el
 * dedo. Devuelve si quedo activo; si fallo se puede volver a intentar.
 */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (granted) return true;
  const orientation = window.DeviceOrientationEvent as unknown as PermissionApi | undefined;
  const motion = window.DeviceMotionEvent as unknown as PermissionApi | undefined;
  if (typeof orientation?.requestPermission !== 'function') {
    granted = true;
    startListening();
    return true;
  }
  try {
    // Las dos peticiones se lanzan en el mismo toque (no una despues de otra)
    const [o] = await Promise.all([orientation.requestPermission(), motion?.requestPermission?.() ?? Promise.resolve('granted')]);
    if (o === 'granted') {
      granted = true;
      startListening();
    }
  } catch {
    // fuera de un toque o el navegador no lo permite: se reintenta en el siguiente
  }
  return granted;
}

/** iPhone/iPad: hay que pedir permiso con un toque antes de leer los sensores. */
export function motionNeedsPermission() {
  if (typeof window === 'undefined' || granted) return false;
  const orientation = window.DeviceOrientationEvent as unknown as PermissionApi | undefined;
  return typeof orientation?.requestPermission === 'function';
}

export function motionActive() {
  return granted;
}

/** Solo celulares/tabletas (pantalla tactil sin mouse). */
export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function onTilt(listener: TiltListener) {
  tiltListeners.add(listener);
  return () => {
    tiltListeners.delete(listener);
  };
}

export function onShake(listener: ShakeListener) {
  shakeListeners.add(listener);
  return () => {
    shakeListeners.delete(listener);
  };
}

/** Vuelve a tomar la posicion actual como neutra. */
export function recalibrate() {
  base = null;
}
