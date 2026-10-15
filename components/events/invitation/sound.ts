// "Ding-dong" de cabina generado con Web Audio (sin archivos de sonido).
// El navegador solo deja sonar despues de un toque del usuario: unlockAudio()
// se llama en el primer toque (al deslizar la persiana o al tocar un boton).

let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
}

/** Dos tonos suaves, como el aviso de "abrochen sus cinturones". */
export function chime() {
  if (!ctx || muted) return;
  try {
    [659.25, 523.25].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.42;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 1.6);
    });
  } catch {
    // sin sonido no pasa nada
  }
}
