/**
 * "Annonce envoyée" sound: a soft whoosh while the envelope flies away, then
 * an original two-note chime (a rising fifth, C6 → G6) when the stamp lands.
 * Synthesised with the Web Audio API: no file to download, nothing borrowed
 * from another brand's sound.
 *
 * Browsers only allow sound after a user gesture, and the publish request is
 * asynchronous: `primeSuccessSound()` runs inside the "Publier" click to open
 * the audio context, `playSentSound()` runs once the listing is saved.
 * On iPhone, the "ambient" audio session keeps the silent switch in charge.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

const audioContextClass = (): (new () => Ctx) | null => {
  if (typeof window === 'undefined') return null;
  return (window.AudioContext || (window as any).webkitAudioContext || null) as any;
};

/** Call from the click that publishes (user gesture). Safe to call often. */
export function primeSuccessSound(): void {
  try {
    const nav = navigator as any;
    if (nav.audioSession && nav.audioSession.type !== 'ambient') nav.audioSession.type = 'ambient';
  } catch { /* not supported */ }
  try {
    const Ctor = audioContextClass();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Pitches of the chime, in Hz (C6, G6). Exported for tests. */
export const CHIME_NOTES = [1046.5, 1568] as const;

function tone(c: Ctx, freq: number, at: number, peak: number, length: number) {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);
  out.connect(c.destination);
  // Fundamental + a quiet octave gives a bell-like, rounded timbre.
  for (const [mult, level, type] of [[1, 1, 'sine'], [2, 0.18, 'sine'], [3, 0.05, 'triangle']] as const) {
    const g = c.createGain();
    g.gain.value = level;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * mult, at);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + length + 0.05);
  }
}

function whoosh(c: Ctx, at: number, length: number, peak: number) {
  const frames = Math.floor(c.sampleRate * length);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(500, at);
  band.frequency.exponentialRampToValueAtTime(3200, at + length);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + length * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(band).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + length);
}

/**
 * Plays the sequence, timed on the envelope animation (seconds from now).
 * Does nothing if the page is hidden or sound could not be unlocked.
 */
export function playSentSound(whooshAt = 1.1, chimeAt = 1.45): void {
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!ctx) primeSuccessSound();
  const c = ctx;
  if (!c || c.state !== 'running') return;
  try {
    const t = c.currentTime;
    whoosh(c, t + whooshAt, 0.42, 0.05);
    tone(c, CHIME_NOTES[0], t + chimeAt, 0.11, 0.55);
    tone(c, CHIME_NOTES[1], t + chimeAt + 0.12, 0.1, 0.8);
  } catch { /* audio is a bonus: never break the page */ }
}
