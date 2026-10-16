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

/** Persiana: deslizamiento corto (ruido filtrado que sube). */
export function shadeSlide() {
  if (!ctx || muted) return;
  try {
    const c = ctx;
    const t = c.currentTime;
    const noise = noiseSource(c, 0.6);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    noise.connect(filter).connect(gain).connect(c.destination);
    noise.start(t);
    noise.stop(t + 0.6);
  } catch {
    // sin sonido no pasa nada
  }
}

/**
 * Avion que pasa: viento + motor grave que van de izquierda a derecha (en
 * audifonos se nota el paso) y suben y bajan de volumen como un "fly-by".
 */
export function planeFlyby(duration = 2.4) {
  if (!ctx || muted) return;
  try {
    const c = ctx;
    const t = c.currentTime;
    const end = t + duration;
    const pan = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
    if (pan) {
      pan.pan.setValueAtTime(-0.9, t);
      pan.pan.linearRampToValueAtTime(0.9, end);
    }
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.32, t + duration * 0.5);
    master.gain.exponentialRampToValueAtTime(0.0001, end);
    (pan ? master.connect(pan).connect(c.destination) : master.connect(c.destination));

    // Viento
    const wind = noiseSource(c, duration + 0.2);
    const windFilter = c.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.8;
    windFilter.frequency.setValueAtTime(500, t);
    windFilter.frequency.exponentialRampToValueAtTime(1800, t + duration * 0.5);
    windFilter.frequency.exponentialRampToValueAtTime(400, end);
    wind.connect(windFilter).connect(master);
    wind.start(t);
    wind.stop(end + 0.1);

    // Motor (grave, con efecto doppler: baja el tono al pasar)
    const engine = c.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(120, t);
    engine.frequency.exponentialRampToValueAtTime(95, t + duration * 0.55);
    engine.frequency.exponentialRampToValueAtTime(70, end);
    const engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 380;
    const engineGain = c.createGain();
    engineGain.gain.value = 0.35;
    engine.connect(engineFilter).connect(engineGain).connect(master);
    engine.start(t);
    engine.stop(end + 0.1);
  } catch {
    // sin sonido no pasa nada
  }
}

/** Brillo corto (al aparecer el "1" de nube o en la bienvenida). */
export function sparkle() {
  if (!ctx || muted) return;
  try {
    const c = ctx;
    [1318.5, 1568, 2093].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  } catch {
    // sin sonido no pasa nada
  }
}

/** "Pop" corto (globos y bocadillos). */
export function pop() {
  if (!ctx || muted) return;
  try {
    const c = ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + Math.random() * 260, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  } catch {
    // sin sonido no pasa nada
  }
}

/** Clic de camara (cuando aparece una foto de la ruta). */
export function shutter() {
  if (!ctx || muted) return;
  try {
    const c = ctx;
    const t = c.currentTime;
    [0, 0.07].forEach((offset, i) => {
      const noise = noiseSource(c, 0.05);
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = i ? 2500 : 1500;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.045);
      noise.connect(filter).connect(gain).connect(c.destination);
      noise.start(t + offset);
      noise.stop(t + offset + 0.05);
    });
  } catch {
    // sin sonido no pasa nada
  }
}

function noiseSource(c: AudioContext, seconds: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
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
