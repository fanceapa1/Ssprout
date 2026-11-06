import type { Rng } from '../core/rng';
import { biquad, chain, flutter, normaliseRms, plungeRate, render, swell } from './falls';

/**
 * The Ksar oasis's beds as pure, seeded PCM (ADR 0303), built like the falls (ADR 0283).
 * **Seguia**: a stereo trickle (the water slipping over the terrace walls: a dense patter of
 * small rising bubbles over a thin sheet of water noise) and a mono murmur (the oued's slow
 * flow). **Palms**: a stereo rustle of dry fronds, a papery crackle that thickens in slow gusts
 * over a soft airy whoosh. docs/systems/audio.md › Oasis.
 */

export const TRICKLE_S = 11;
export const MURMUR_S = 14;
export const PALMS_S = 17;
/** Each loop is scaled to this RMS; the backend's gains set the level in the mix. */
export const OASIS_RMS = 0.16;
/** How the backend blends the seguia's two loops (linear gain on each). */
export const SEGUIA_BLEND = { trickle: 1, murmur: 0.55 } as const;
/** The backend's gains at 100 % (tuned by offline render, docs/systems/audio.md › Oasis). */
export const SEGUIA_GAIN = 0.05;
export const PALMS_GAIN = 0.05;

export interface OasisLoops {
  /** left and right: one loop, the right half a loop on */
  trickle: [Float32Array, Float32Array];
  murmur: Float32Array;
  /** the murmur's own sample rate (a third of the context's, at least 8 kHz) */
  murmurRate: number;
  palms: [Float32Array, Float32Array];
}

/** A wide stereo pair from one loop: the right channel is the left half a loop on. */
function widen(left: Float32Array): [Float32Array, Float32Array] {
  const right = new Float32Array(left.length);
  const half = left.length >> 1;
  right.set(left.subarray(half));
  right.set(left.subarray(0, half), left.length - half);
  return [left, right];
}

/**
 * Water bubbles: each a sine ringing at 0.45–2.2 kHz whose pitch rises as it decays (a bubble
 * shrinking), starting at zero phase so it never clicks. `density(u)` is bubbles a second.
 */
function bubbles(rng: Rng, sr: number, density: (u: number) => number) {
  const live: { phase: number; f: number; rise: number; amp: number; decay: number }[] = [];
  return (u: number) => {
    if (rng.next() < density(u) / sr) {
      const f = 450 * Math.exp(rng.next() * Math.log(2200 / 450));
      // smaller bubbles ring higher, shorter and softer
      const tau = rng.range(0.6, 1.2) * (0.012 + 9 / f);
      live.push({ phase: 0, f, rise: rng.range(1.5, 3.5) / tau, amp: rng.range(0.35, 1) * Math.sqrt(700 / f), decay: Math.exp(-1 / (tau * sr)) });
    }
    let out = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]!;
      out += b.amp * Math.sin(b.phase);
      b.phase += (2 * Math.PI * b.f) / sr;
      b.f *= 1 + (b.rise * 0.06) / sr;
      b.amp *= b.decay;
      if (b.amp < 1e-3) live.splice(i, 1);
    }
    return out;
  };
}

function trickleLoop(rng: Rng, sr: number): Float32Array {
  const sheet = chain(biquad('bandpass', 1100, 0.6, sr), biquad('lowpass', 3500, 0.7, sr));
  const air = chain(biquad('highpass', 2600, 0.7, sr), biquad('lowpass', 6000, 0.7, sr));
  // the flow over the lip varies slowly; the sheet of water flickers quickly
  const flow = swell(rng.fork('flow'), [[1, 0.2], [3, 0.12], [8, 0.06]]);
  const flick = flutter(rng.fork('flick'), 11, 0.3, sr);
  const drops = bubbles(rng.fork('bubbles'), sr, (u) => 55 * flow(u));
  const n = rng.fork('sheet'), a = rng.fork('air');
  const pop = render(sr, TRICKLE_S, (u) => drops(u));
  const body = render(sr, TRICKLE_S, (u) => sheet(n.next() * 2 - 1) * flick() * flow(u));
  const top = render(sr, TRICKLE_S, (u) => air(a.next() * 2 - 1) * flow(u));
  normaliseRms(pop, 1);
  normaliseRms(body, 0.5);
  normaliseRms(top, 0.12);
  for (let i = 0; i < pop.length; i++) pop[i] = pop[i]! + body[i]! + top[i]!;
  return normaliseRms(pop, OASIS_RMS);
}

function murmurLoop(rng: Rng, sr: number): Float32Array {
  const low = chain(biquad('highpass', 90, 0.7, sr), biquad('lowpass', 380, 0.6, sr), biquad('lowpass', 380, 0.6, sr));
  const gurgle = chain(biquad('bandpass', 520, 1.2, sr), biquad('lowpass', 1200, 0.7, sr));
  const drift = swell(rng.fork('drift'), [[1, 0.12], [3, 0.08]]);
  const turn = swell(rng.fork('turn'), [[2, 0.35], [5, 0.15]]);
  const a = rng.fork('low'), b = rng.fork('gurgle');
  const flow = render(sr, MURMUR_S, (u) => low(a.next() * 2 - 1) * drift(u));
  const eddy = render(sr, MURMUR_S, (u) => gurgle(b.next() * 2 - 1) * turn(u));
  normaliseRms(flow, 1);
  normaliseRms(eddy, 0.4);
  for (let i = 0; i < flow.length; i++) flow[i] = flow[i]! + eddy[i]!;
  return normaliseRms(flow, OASIS_RMS);
}

/** The palms' gust envelope over a loop, 0.2 (a lull) to 1 (a gust); gusts shorter than lulls. */
export function frondGust(rng: Rng): (u: number) => number {
  const parts = [[1, 0.6], [2, 0.3], [5, 0.12]] as const;
  const depth = parts.reduce((s, [, d]) => s + d, 0);
  const raw = swell(rng, parts);
  return (u) => 0.2 + 0.8 * ((raw(u) - (1 - depth)) / (2 * depth)) ** 1.6;
}

function palmsLoop(rng: Rng, sr: number): Float32Array {
  const gust = frondGust(rng.fork('gust'));
  const papery = chain(biquad('highpass', 1500, 0.7, sr), biquad('bandpass', 3800, 0.5, sr), biquad('lowpass', 7500, 0.7, sr));
  const whoosh = chain(biquad('highpass', 900, 0.7, sr), biquad('lowpass', 4500, 0.7, sr));
  const g = rng.fork('grains'), n = rng.fork('crackle'), w = rng.fork('whoosh');
  // grains: tiny decaying ticks of noise, two lengths; more of them, and louder, as a gust builds
  const short = Math.exp(-1 / (0.0008 * sr)), long = Math.exp(-1 / (0.003 * sr));
  let es = 0, el = 0;
  const crackle = render(sr, PALMS_S, (u) => {
    const level = gust(u);
    if (g.next() < (250 + 2400 * level * level) / sr) {
      if (g.chance(0.6)) es += g.range(0.3, 1) * level; else el += g.range(0.2, 0.7) * level;
    }
    es *= short; el *= long;
    return papery((n.next() * 2 - 1) * (es + el));
  });
  const air = render(sr, PALMS_S, (u) => whoosh(w.next() * 2 - 1) * gust(u) ** 1.2);
  normaliseRms(crackle, 1);
  normaliseRms(air, 0.55);
  for (let i = 0; i < crackle.length; i++) crackle[i] = crackle[i]! + air[i]!;
  return normaliseRms(crackle, OASIS_RMS);
}

/** The seguia's loops for a context rate; deterministic for a given Rng. */
export function seguiaLoops(rng: Rng, sampleRate: number): Pick<OasisLoops, 'trickle' | 'murmur' | 'murmurRate'> {
  const rate = plungeRate(sampleRate);
  return { trickle: widen(trickleLoop(rng.fork('trickle'), sampleRate)), murmur: murmurLoop(rng.fork('murmur'), rate), murmurRate: rate };
}

/** The palms' loop for a context rate, stereo. */
export function palmsLoops(rng: Rng, sampleRate: number): [Float32Array, Float32Array] {
  return widen(palmsLoop(rng.fork('palms'), sampleRate));
}
