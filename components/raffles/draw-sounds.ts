// Efectos de sonido del sorteo, sintetizados con WebAudio (sin archivos de audio)

let ctx: AudioContext | null = null;
let muted = false;

const STORAGE_KEY = 'tf-raffle-muted';

try {
  if (typeof window !== 'undefined') muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch {
  /* almacenamiento bloqueado */
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, endFreq?: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(start: number, duration: number, volume: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  },
  /** Llamar en un clic para desbloquear el audio en iOS/Chrome */
  unlock() {
    audio();
  },
  tick(pitch = 1) {
    tone(1400 * pitch, 0, 0.035, 'square', 0.04);
  },
  rattle() {
    noise(0, 0.06, 0.12);
  },
  /** Redoble creciente; devuelve una funcion para detenerlo */
  drumroll(ms: number) {
    if (muted) return () => {};
    let elapsed = 0;
    const id = window.setInterval(() => {
      elapsed += 55;
      noise(0, 0.05, 0.05 + 0.2 * Math.min(1, elapsed / ms));
    }, 55);
    const stop = () => window.clearInterval(id);
    window.setTimeout(stop, ms);
    return stop;
  },
  discard() {
    tone(220, 0, 0.25, 'sine', 0.18, 90);
    tone(160, 0.08, 0.25, 'triangle', 0.08, 70);
  },
  reveal() {
    tone(660, 0, 0.12, 'triangle', 0.15);
    tone(990, 0.08, 0.2, 'triangle', 0.12);
  },
  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.18));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.55, 1.1, 'sawtooth', 0.05));
    tone(1046.5, 0.55, 1.1, 'triangle', 0.15);
  },
};
