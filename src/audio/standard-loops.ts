import type { Rng } from '../core/rng';
import { makeLoopable, normalise } from './noise';

export type CraftedLoop = 'fire' | 'cafe' | 'lofi';
export const LOFI_BEAT_S = 0.8;

/** Original, seeded loops. Generated once when first selected; no network or recordings. */
export function standardLoop(kind: CraftedLoop, rng: Rng, sampleRate: number): Float32Array {
  if (kind === 'lofi') return lofiLoop(rng, sampleRate);
  const seconds = 16, fade = Math.round(sampleRate * 0.3);
  const out = new Float32Array(seconds * sampleRate + fade);
  let low = 0, crackle = 0;
  const phases = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const clinks = Array.from({ length: 6 }, () => rng.range(0, seconds));
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const noise = rng.range(-1, 1);
    low += (noise - low) * (1 - Math.exp(-2 * Math.PI * 320 / sampleRate));
    if (kind === 'fire') {
      if (rng.next() < 4 / sampleRate) crackle = rng.range(0.15, 0.5);
      crackle *= Math.exp(-1 / (sampleRate * 0.018));
      out[i] = low * 0.65 + noise * crackle;
    } else {
      // Indistinct room murmur under occasional porcelain clinks; no intelligible speech.
      let room = low * 0.45;
      for (let v = 0; v < 3; v++) {
        const syllable = Math.max(0, Math.sin(t * (2.7 + v * 0.8) + phases[v]!));
        room += 0.018 * syllable * Math.sin(2 * Math.PI * (125 + 47 * v) * t + 2 * Math.sin(t * 3.1 + phases[v]!));
      }
      for (const at of clinks) {
        const dt = t - at;
        if (dt >= 0 && dt < 0.6) room += Math.min(1, dt / 0.004) * Math.exp(-dt * 12) *
          (Math.sin(dt * 2 * Math.PI * 2150) + 0.25 * Math.sin(dt * 2 * Math.PI * 3270)) * 0.035;
      }
      out[i] = room;
    }
  }
  return normalise(makeLoopable(out, fade), 0.7);
}

function lofiLoop(rng: Rng, sr: number): Float32Array {
  const beat = LOFI_BEAT_S, length = Math.round(16 * beat * sr);
  const out = new Float32Array(length);
  // Am7 / Fmaj7 / Cmaj7 / G6. Swing, soft keys, bass and brushed percussion.
  const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64]];
  const add = (at: number, duration: number, sample: (t: number) => number) => {
    const offset = Math.round(at * sr);
    for (let j = 0; j < duration * sr; j++) {
      const k = (offset + j) % length;
      out[k] = out[k]! + sample(j / sr);
    }
  };
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  for (let bar = 0; bar < 4; bar++) {
    const chord = chords[bar]!;
    for (const [n, midi] of chord.entries()) {
      const f = hz(midi);
      add(bar * 4 * beat + n * 0.012, 4.5, (t) => Math.min(1, t / 0.018) * Math.exp(-t * 1.6) *
        (Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(2 * Math.PI * f * 2.002 * t)) * 0.12);
    }
    for (let b = 0; b < 4; b++) {
      const at = (bar * 4 + b) * beat;
      if (b % 2 === 0) {
        const f = hz(chord[0]! - 12);
        add(at, beat * 1.6, (t) => Math.min(1, t / 0.012) * Math.exp(-t * 3) * Math.sin(2 * Math.PI * f * t) * 0.16);
        add(at, 0.25, (t) => Math.min(1, t / 0.008) * Math.exp(-t * 25) * Math.sin(2 * Math.PI * (48 * t + 2 * (1 - Math.exp(-t * 22)))) * 0.2);
      } else {
        add(at + 0.015, 0.12, (t) => Math.min(1, t / 0.006) * Math.exp(-t * 38) * rng.range(-0.065, 0.065));
      }
      for (let h = 0; h < 2; h++) add(at + h * beat * 0.56, 0.07,
        (t) => Math.min(1, t / 0.003) * Math.exp(-t * 85) * rng.range(-0.025, 0.025));
    }
  }
  // Rounded bandwidth, with a wrap-aware initial state so the bar boundary stays seamless.
  let low = 0;
  const alpha = 1 - Math.exp(-2 * Math.PI * 2400 / sr);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < length; i++) {
    low += (out[i]! - low) * alpha;
    if (pass === 1) out[i] = low;
  }
  return normalise(out, 0.7);
}
