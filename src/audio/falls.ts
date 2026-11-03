import type { Rng } from '../core/rng';
import { makeLoopable } from './noise';

/**
 * The waterfall's bed as pure, seeded PCM (ADR 0283): a mono **plunge** (the low rumble of
 * water landing in the pool and the broad roar above it) and a stereo **spray** (a soft bright
 * hiss with a little fizz). Both are built once per context and loop; their lengths differ, so
 * the pair only repeats after minutes. docs/systems/audio.md › Waterfall.
 */

export const PLUNGE_S = 13;
export const SPRAY_S = 9;
/** Each loop is scaled to this RMS; the backend's gains set the level in the mix. */
export const FALLS_RMS = 0.16;
/** How the backend blends the two loops (linear gain on each). */
export const FALLS_BLEND = { plunge: 1, spray: 0.28 } as const;

export interface FallsLoops {
  plunge: Float32Array;
  spray: [Float32Array, Float32Array];
}

type Filter = (x: number) => number;

/** An RBJ biquad (transposed direct form II); the band-pass has a 0 dB peak. */
export function biquad(type: 'lowpass' | 'highpass' | 'bandpass', hz: number, q: number, sr: number): Filter {
  const w = (2 * Math.PI * Math.min(hz, sr * 0.45)) / sr;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  b0 /= a0; b1 /= a0; b2 /= a0;
  const k1 = a1 / a0, k2 = a2 / a0;
  let z1 = 0, z2 = 0;
  return (x) => {
    const y = b0 * x + z1;
    z1 = b1 * x - k1 * y + z2;
    z2 = b2 * x - k2 * y;
    return y;
  };
}

const chain = (...fs: Filter[]): Filter => (x) => fs.reduce((v, f) => f(v), x);

/** Scale so the RMS equals `target`. */
export function normaliseRms(data: Float32Array, target: number): Float32Array {
  let s = 0;
  for (const v of data) s += v * v;
  const r = Math.sqrt(s / Math.max(1, data.length));
  if (r > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i]! * target) / r;
  return data;
}

/** A slow swell with whole cycles over the loop, so it is seamless: 1 + Σ depth·sin. */
function swell(rng: Rng, parts: readonly (readonly [cycles: number, depth: number])[]) {
  const phases = parts.map(() => rng.range(0, Math.PI * 2));
  return (u: number) => parts.reduce((m, [c, d], i) => m + d * Math.sin(2 * Math.PI * c * u + phases[i]!), 1);
}

/** Random flutter around 1 (±depth), new targets `hz` times a second with cosine easing. */
function flutter(rng: Rng, hz: number, depth: number, sr: number): () => number {
  const step = hz / sr;
  let phase = 0, from = 0, to = rng.range(-1, 1);
  return () => {
    phase += step;
    if (phase >= 1) { phase -= 1; from = to; to = rng.range(-1, 1); }
    return 1 + depth * (from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * phase)));
  };
}

/**
 * Render `n` loop samples from a per-sample source, after a settling pre-roll for the filters,
 * then cross-fade the extra tail into the head (`makeLoopable`).
 */
function render(sr: number, seconds: number, sample: (u: number) => number): Float32Array {
  const n = Math.round(seconds * sr), fade = Math.round(sr * 0.4), pre = Math.round(sr * 0.5);
  for (let i = 0; i < pre; i++) sample(0);
  const out = new Float32Array(n + fade);
  for (let i = 0; i < out.length; i++) out[i] = sample((i % n) / n);
  return makeLoopable(out, fade);
}

function plungeLoop(rng: Rng, sr: number): Float32Array {
  const rumble = chain(biquad('highpass', 28, 0.7, sr), biquad('lowpass', 170, 0.6, sr), biquad('lowpass', 170, 0.6, sr));
  const roar = chain(biquad('bandpass', 420, 0.4, sr), biquad('lowpass', 1600, 0.7, sr));
  // the plunge surges slowly; the roar breathes on its own, slower cycle
  const surge = swell(rng.fork('surge'), [[1, 0.18], [3, 0.1], [7, 0.05]]);
  const breathe = swell(rng.fork('breathe'), [[2, 0.14], [5, 0.07]]);
  const a = rng.fork('rumble'), b = rng.fork('roar');
  // the two bands are normalised apart so the blend below is a level, not a filter accident
  const low = render(sr, PLUNGE_S, (u) => rumble(a.next() * 2 - 1) * surge(u));
  const mid = render(sr, PLUNGE_S, (u) => roar(b.next() * 2 - 1) * breathe(u));
  normaliseRms(low, 1);
  normaliseRms(mid, 0.6);
  for (let i = 0; i < low.length; i++) low[i] = low[i]! + mid[i]!;
  return normaliseRms(low, FALLS_RMS);
}

function sprayChannel(rng: Rng, sr: number): Float32Array {
  const hiss = chain(biquad('highpass', 2400, 0.7, sr), biquad('highpass', 2400, 0.7, sr), biquad('lowpass', 7000, 0.7, sr));
  const mist = chain(biquad('bandpass', 1300, 0.7, sr), biquad('lowpass', 3000, 0.7, sr));
  const fizz = flutter(rng.fork('fizz'), 7, 0.22, sr);
  const shimmer = swell(rng.fork('shimmer'), [[1, 0.15], [4, 0.08]]);
  const h = rng.fork('hiss'), m = rng.fork('mist');
  const top = render(sr, SPRAY_S, (u) => hiss(h.next() * 2 - 1) * fizz() * shimmer(u));
  const body = render(sr, SPRAY_S, (u) => mist(m.next() * 2 - 1) * (2 - shimmer(u)));
  normaliseRms(top, 1);
  normaliseRms(body, 0.35);
  for (let i = 0; i < top.length; i++) top[i] = top[i]! + body[i]!;
  return normaliseRms(top, FALLS_RMS);
}

/** Both loops for a sample rate; deterministic for a given Rng. */
export function fallsLoops(rng: Rng, sampleRate: number): FallsLoops {
  return {
    plunge: plungeLoop(rng.fork('plunge'), sampleRate),
    spray: [sprayChannel(rng.fork('spray-l'), sampleRate), sprayChannel(rng.fork('spray-r'), sampleRate)],
  };
}
