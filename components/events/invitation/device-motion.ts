// Sensores del celular: inclinacion (giroscopio) y agitar.
// iPhone pide permiso y SOLO se puede pedir dentro de un toque del usuario:
// requestMotionPermission() se llama en el primer toque (persiana, botones…).
// En computadora no hay sensores: nada de esto se activa y queda el mouse.

type TiltListener = (x: number, y: number) => void; // -1 … 1
type ShakeListener = () => void;

const tiltListeners = new Set<TiltListener>();
const shakeListeners = new Set<ShakeListener>();
let listening = false;
let permissionAsked = false;
let base: { beta: number; gamma: number } | null = null;
let lastShake = 0;

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta === null || e.gamma === null) return;
  // La primera lectura es la posicion "neutra" (como lo sostiene la persona)
  base ??= { beta: e.beta, gamma: e.gamma };
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const x = clamp((e.gamma - base.gamma) / 25);
  const y = clamp((e.beta - base.beta) / 25);
  tiltListeners.forEach((l) => l(x, y));
}

function onMotion(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity ?? e.acceleration;
  if (!a || a.x === null || a.y === null || a.z === null) return;
  const force = Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z);
  // ~10 es la gravedad en reposo; una sacudida pasa de 35
  if (force > 35 && Date.now() - lastShake > 2500) {
    lastShake = Date.now();
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

/** Pide permiso (iPhone) y empieza a escuchar. Llamar dentro de un toque. */
export function requestMotionPermission() {
  if (permissionAsked || typeof window === 'undefined') return;
  permissionAsked = true;
  const orientation = (window.DeviceOrientationEvent as unknown as PermissionApi) ?? {};
  const motion = (window.DeviceMotionEvent as unknown as PermissionApi) ?? {};
  if (typeof orientation.requestPermission === 'function') {
    Promise.all([orientation.requestPermission(), motion.requestPermission?.() ?? Promise.resolve('granted')])
      .then(([o]) => {
        if (o === 'granted') startListening();
      })
      .catch(() => {});
  } else {
    startListening();
  }
}

/** iPhone/iPad: hay que pedir permiso con un toque antes de leer los sensores. */
export function motionNeedsPermission() {
  if (typeof window === 'undefined') return false;
  const orientation = window.DeviceOrientationEvent as unknown as PermissionApi | undefined;
  return !permissionAsked && typeof orientation?.requestPermission === 'function';
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
