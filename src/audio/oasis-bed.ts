import type { Rng } from '../core/rng';
import { biquad, chain, flutter, normaliseRms, plungeRate, render, swell } from './falls';

/**
 * The Ksar oasis's beds as pure, seeded PCM (ADR 0303), built like the falls (ADR 0283).
 * **Seguia**: a stereo trickle (the water slipping over the terrace walls: a dense patter of
 * small rising bubbles over a thin sheet of water noise) and a mono murmur (the oued's slow
 * flow). **Palms**: a stereo rustle of dry fronds, a papery crackle that thickens in slow gusts
 * over a soft airy whoosh. docs/systems/audio.md › Oasis.
 */

export const TRICKLE_S = 9;
export const MURMUR_S = 14;
export const PALMS_S = 17;
/** Each loop is scaled to this RMS; the backend's gains set the level in the mix. */
export const OASIS_RMS = 0.16;
/** How the backend blends the seguia's two loops (linear gain on each). */
export const SEGUIA_BLEND = { trickle: 1, murmur: 0.55 } as const;
/** The backend's gains at 100 % (tuned by offline render, docs/systems/audio.md › Oasis). */
export const SEGUIA_GAIN = 0.056;
export const PALMS_GAIN = 0.056;

/** A stereo loop at its own rate (the buffer source resamples it). */
export interface StereoLoop {
  data: [Float32Array, Float32Array];
  rate: number;
}

/** Nothing in the trickle or the fronds needs more than ~7 kHz: every loop renders at a third of the context rate. */
export const loopRate = plungeRate;

/** A wide stereo pair from one loop: the right channel is the left half a loop on. */
function widen(left: Float32Array): [Float32Array, Float32Array] {
  const right = new Float32Array(left.length);
  const half = left.length >> 1;
  right.set(left.subarray(half));
  right.set(left.subarray(0, half), left.length - half);
  return [left, right];
}

interface Bubble { c: number; s: number; cw: number; sw: number; f: number; grow: number; amp: number; decay: number; age: number }

/**
 * Water bubbles: each a sine ringing at 0.6–2.4 kHz whose pitch rises as it decays (a bubble
 * shrinking), from zero phase so it never clicks. A rotating phasor, re-tuned every 32 samples,
 * stands in for `Math.sin`. `density(u)` is bubbles a second.
 */
function bubbles(rng: Rng, sr: number, density: (u: number) => number) {
  const live: Bubble[] = [];
  const tune = (b: Bubble) => { b.cw = Math.cos((2 * Math.PI * b.f) / sr); b.sw = Math.sin((2 * Math.PI * b.f) / sr); };
  return (u: number) => {
    if (rng.next() < density(u) / sr) {
      const f = 600 * Math.exp(rng.next() * Math.log(4));
      // smaller bubbles ring higher, shorter and softer
      const tau = rng.range(0.7, 1.1) * (0.01 + 8 / f);
      const b = { c: 1, s: 0, cw: 1, sw: 0, f, grow: Math.exp((rng.range(0.1, 0.25) * 32) / (tau * sr)), amp: rng.range(0.6, 1) * Math.sqrt(900 / f), decay: Math.exp(-1 / (tau * sr)), age: 0 };
      tune(b);
      live.push(b);
    }
    let out = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]!;
      out += b.amp * b.s;
      const c = b.c * b.cw - b.s * b.sw;
      b.s = b.s * b.cw + b.c * b.sw;
      b.c = c;
      b.amp *= b.decay;
      if (++b.age % 32 === 0) { b.f *= b.grow; tune(b); }
      if (b.amp < 0.01) live.splice(i, 1);
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
  const drops = bubbles(rng.fork('bubbles'), sr, (u) => 160 * flow(u));
  const n = rng.fork('sheet'), a = rng.fork('air');
  const pop = render(sr, TRICKLE_S, (u) => drops(u));
  const body = render(sr, TRICKLE_S, (u) => sheet(n.next() * 2 - 1) * flick() * flow(u));
  const top = render(sr, TRICKLE_S, (u) => air(a.next() * 2 - 1) * flow(u));
  normaliseRms(pop, 1);
  normaliseRms(body, 0.65);
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
  const parts = [[1, 0.6], [2, 0.3], [5, 0.08]] as const;
  const depth = parts.reduce((s, [, d]) => s + d, 0);
  const raw = swell(rng, parts);
  let last = NaN, value = 0;
  return (u) => {
    const r = raw(u);
    if (r !== last) { last = r; value = 0.2 + 0.8 * ((r - (1 - depth)) / (2 * depth)) ** 1.4; }
    return value;
  };
}

function palmsLoop(rng: Rng, sr: number): Float32Array {
  const gust = frondGust(rng.fork('gust'));
  const papery = chain(biquad('highpass', 1500, 0.7, sr), biquad('bandpass', 3800, 0.5, sr), biquad('lowpass', 7500, 0.7, sr));
  const whoosh = chain(biquad('highpass', 900, 0.7, sr), biquad('lowpass', 4500, 0.7, sr));
  const g = rng.fork('grains'), n = rng.fork('crackle'), w = rng.fork('whoosh');
  // grains: tiny decaying ticks of noise, two lengths; a gust brings more of them, not louder ones
  const short = Math.exp(-1 / (0.0008 * sr)), long = Math.exp(-1 / (0.003 * sr));
  let es = 0, el = 0;
  const crackle = render(sr, PALMS_S, (u) => {
    const level = gust(u);
    if (g.next() < (500 + 2000 * level * level) / sr) {
      if (g.chance(0.6)) es += g.range(0.3, 1); else el += g.range(0.2, 0.7);
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

/** The seguia's loops for a context rate (each at its own lower rate); deterministic for a given Rng. */
export function seguiaLoops(rng: Rng, sampleRate: number): { trickle: StereoLoop; murmur: Float32Array; murmurRate: number } {
  const rate = loopRate(sampleRate);
  return { trickle: { data: widen(trickleLoop(rng.fork('trickle'), rate)), rate }, murmur: murmurLoop(rng.fork('murmur'), rate), murmurRate: rate };
}

/** The palms' stereo loop for a context rate, at a third of that rate. */
export function palmsLoops(rng: Rng, sampleRate: number): StereoLoop {
  const rate = loopRate(sampleRate);
  return { data: widen(palmsLoop(rng.fork('palms'), rate)), rate };
}
