// Synthesized sound effects (WebAudio, no asset files).
export type Sfx =
  | 'click' | 'roll' | 'land' | 'step' | 'gun' | 'slap' | 'whistle' | 'bark'
  | 'door' | 'fall' | 'home' | 'win' | 'turn';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('ludo-muted') === '1';
} catch { /* ignore */ }

const listeners = new Set<() => void>();

function ensure(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, slideTo?: number) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, delay = 0, filterFreq = 2000, type: BiquadFilterType = 'lowpass') {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

export function play(name: Sfx) {
  switch (name) {
    case 'click': tone(660, 0.06, 'triangle', 0.15); break;
    case 'roll':
      for (let i = 0; i < 9; i++) noise(0.05, 0.25, i * 0.11, 900 + Math.random() * 1500, 'bandpass');
      break;
    case 'land': tone(180, 0.12, 'sine', 0.35, 0, 90); noise(0.08, 0.2, 0, 1200); break;
    case 'step': tone(260 + Math.random() * 60, 0.05, 'square', 0.07); break;
    case 'gun': noise(0.25, 0.7, 0, 3000); tone(140, 0.2, 'sawtooth', 0.4, 0, 40); break;
    case 'slap': noise(0.09, 0.8, 0, 3500, 'highpass'); tone(320, 0.12, 'square', 0.25, 0, 120); break;
    case 'whistle': tone(1400, 0.35, 'sine', 0.2, 0, 2200); break;
    case 'bark':
      tone(300, 0.12, 'sawtooth', 0.3, 0, 180);
      tone(320, 0.12, 'sawtooth', 0.3, 0.2, 190);
      break;
    case 'door': noise(0.18, 0.6, 0, 400); tone(90, 0.2, 'sine', 0.5); tone(1200, 0.05, 'square', 0.15, 0.25); break;
    case 'fall': tone(500, 0.5, 'triangle', 0.25, 0, 80); break;
    case 'home': [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, i * 0.1)); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.14)); break;
    case 'turn': tone(880, 0.1, 'sine', 0.2); tone(1175, 0.14, 'sine', 0.2, 0.1); break;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem('ludo-muted', v ? '1' : '0');
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeMute(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
