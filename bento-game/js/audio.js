// All sounds are synthesised with the Web Audio API. The context is created on the first click.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('bento-muted') === '1'; } catch { /* storage unavailable */ }

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio, the game still works */ }
}

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('bento-muted', value ? '1' : '0'); } catch { /* ignore */ }
}

function tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slideTo = null } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.4) {
  if (!ctx || muted) return;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  gain.gain.value = vol;
  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

const PLATE_NOTES = { red: 330, orange: 392, green: 494, yellow: 587 };

export const sfx = {
  tick: () => tone(880, 0.05, { type: 'square', vol: 0.04 }),
  tickFast: () => tone(1175, 0.05, { type: 'square', vol: 0.06 }),
  click: () => tone(520, 0.04, { type: 'triangle', vol: 0.08 }),
  snap: () => tone(240, 0.09, { type: 'sawtooth', vol: 0.12, slideTo: 90 }),
  plate: (key) => tone(PLATE_NOTES[key] || 440, 0.3, { type: 'triangle', vol: 0.16 }),
  buzz: () => tone(110, 0.45, { type: 'sawtooth', vol: 0.2, slideTo: 70 }),
  chime: () => { tone(660, 0.18, { vol: 0.16 }); tone(990, 0.35, { vol: 0.16, delay: 0.12 }); },
  explosion: () => { noise(1.4, 0.6); tone(140, 1.0, { type: 'sawtooth', vol: 0.25, slideTo: 30 }); },
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.16, delay: i * 0.14 })),
};
