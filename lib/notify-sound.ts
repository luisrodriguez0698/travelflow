// Tono de aviso generado con Web Audio (sin archivos). La preferencia se guarda
// por dispositivo: se puede tener activo en la PC y apagado en el celular.

const STORAGE_KEY = 'tf-notify-sound';

let audioCtx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Avisa a la campana y a Mi perfil para que muestren el mismo estado. */
export const SOUND_CHANGE_EVENT = 'tf-sound-change';

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* modo privado: solo dura la sesion */
  }
  window.dispatchEvent(new Event(SOUND_CHANGE_EVENT));
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/**
 * Los navegadores solo permiten sonido despues de una interaccion del usuario.
 * Llamar en el primer clic/tecla para dejar el audio "desbloqueado".
 */
export function unlockAudio() {
  const ctx = getContext();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

/** Dos notas cortas ascendentes (tipo "ding-ding"), volumen moderado. */
export function playChime() {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const notes = [
    { freq: 880, start: 0 },
    { freq: 1318.5, start: 0.13 },
  ];
  for (const { freq, start } of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
