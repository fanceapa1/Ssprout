import type { Rng } from '../core/rng';
import { biquad, chain, normaliseRms, render, swell } from './falls';
import { makeLoopable } from './noise';
import { loopRate, type StereoLoop } from './oasis-bed';

/**
 * The Greek coast's beds as pure, seeded PCM (ADR 0376), built like the oasis's (ADR 0303).
 * **Sea**: waves breathing on a pebble beach over a far surf, with small laps at the rocks.
 * **Cicadas**: a far, dry, pulsing chorus. docs/systems/audio.md › Coast.
 */

export const SEA_S = 56;
export const WAVES_PER_LOOP = 7;
export const CICADAS_S = 23;
export const CICADA_SINGERS = 9;
/** Each loop is scaled to this RMS; the backend's gains set the level in the mix. */
export const COAST_RMS = 0.16;
/** The backend's gains at 100 % (tuned by offline render, docs/systems/audio.md › Coast). */
export const SEA_GAIN = 0.055;
export const CICADAS_GAIN = 0.02;
/** The backend's slow swell on the sea (period and depth), so the loop's waves never repeat alike. */
export const SEA_SWELL = { hz: 1 / 71, depth: 0.15 } as const;

export interface Wave {
  /** seconds into the loop */
  at: number;
  /** 0.55–1 */
  weight: number;
  /** seconds the wash takes to run up */
  rise: number;
  /** seconds the backwash and its rattle last */
  back: number;
}

/** The loop's waves: 6–10 s apart, their weights rising and falling in sets. */
export function seaWaves(rng: Rng): Wave[] {
  let gaps: number[] = [];
  for (let tries = 0; tries < 200; tries++) {
    const raw = Array.from({ length: WAVES_PER_LOOP }, () => rng.range(6, 10));
    const k = SEA_S / raw.reduce((s, g) => s + g, 0);
    gaps = raw.map((g) => g * k);
    if (gaps.every((g) => g >= 6 && g <= 10)) break;
  }
  const phase = rng.range(0, Math.PI * 2);
  let at = rng.range(0, 2);
  return gaps.map((gap, i) => {
    const set = 0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * i) / WAVES_PER_LOOP + phase);
    const wave = { at, weight: 0.55 + 0.45 * (0.6 * set + 0.4 * rng.next()), rise: rng.range(1.7, 2.3), back: rng.range(2.5, 3.5) };
    at += gap;
    return wave;
  });
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

/** The wash running up the shingle `d` seconds after a wave starts: a slow rise, a long fall. */
export function washShape(w: Wave, d: number): number {
  if (d < 0 || d > 10) return 0;
  return d < w.rise ? ease(d / w.rise) : Math.exp(-(d - w.rise) / 2);
}

/** The backwash drawing the pebbles down, from just after the wash's peak. */
export function backShape(w: Wave, d: number): number {
  const from = w.rise + 0.9, up = 1.3;
  if (d < from || d > from + up + w.back) return 0;
  return d < from + up ? ease((d - from) / up) : ease(1 - (d - from - up) / w.back);
}

interface Grain { c: number; s: number; cw: number; sw: number; amp: number; decay: number; l: number; r: number }

/** Stereo render with a filter pre-roll and seamless seams (as `falls.render`). */
function renderPair(sr: number, seconds: number, sample: (u: number, out: [number, number]) => void): [Float32Array, Float32Array] {
  const n = Math.round(seconds * sr), fade = Math.round(sr * 0.4), pre = Math.round(sr * 0.5);
  const out: [number, number] = [0, 0];
  for (let i = 0; i < pre; i++) sample(0, out);
  const l = new Float32Array(n + fade), r = new Float32Array(n + fade);
  for (let i = 0; i < l.length; i++) {
    sample((i % n) / n, out);
    l[i] = out[0];
    r[i] = out[1];
  }
  return [makeLoopable(l, fade), makeLoopable(r, fade)];
}

/** A soft knee at `crest` times the pair's RMS (tanh, its cubic below a third of the knee), then the pair at `target` RMS. */
function softenPair(pair: [Float32Array, Float32Array], crest: number, target: number): [Float32Array, Float32Array] {
  const [l, r] = pair, n = l.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += l[i]! * l[i]! + r[i]! * r[i]!;
  const scale = 1 / (crest * (Math.sqrt(s / (2 * n)) || 1));
  const knee = (v: number) => { const y = v * scale; return crest * (Math.abs(y) < 0.3 ? y - (y * y * y) / 3 : Math.tanh(y)); };
  s = 0;
  for (let i = 0; i < n; i++) {
    const a = knee(l[i]!), b = knee(r[i]!);
    l[i] = a; r[i] = b; s += a * a + b * b;
  }
  const k = target / (Math.sqrt(s / (2 * n)) || 1);
  for (let i = 0; i < n; i++) { l[i] = l[i]! * k; r[i] = r[i]! * k; }
  return pair;
}

/** A short loop of filtered noise at unit RMS: the stationary carrier a long envelope shapes. */
function carrier(rng: Rng, sr: number, seconds: number, filter: (x: number) => number): Float32Array {
  return normaliseRms(render(sr, seconds, () => filter(rng.next() * 2 - 1)), 1);
}

/** The sea's parts and their levels (each carrier at unit RMS, each envelope peaking near 1). */
export const SEA_MIX = { wash: 1, foam: 0.3, body: 0.4, hiss: 0.35, rattle: 0.3, surf: 0.4, laps: 0.5 } as const;

function seaLoop(rng: Rng, sr: number): [Float32Array, Float32Array] {
  const waves = seaWaves(rng.fork('waves'));
  // carrier lengths differ (and are not whole seconds) so they never line up with each other or the waves
  const wash = carrier(rng.fork('wash'), sr, 4.3, chain(biquad('bandpass', 650, 0.5, sr), biquad('lowpass', 2200, 0.7, sr)));
  const foam = carrier(rng.fork('foam'), sr, 3.7, chain(biquad('highpass', 1800, 0.7, sr), biquad('lowpass', 5000, 0.7, sr)));
  const hiss = carrier(rng.fork('hiss'), sr, 5.1, chain(biquad('highpass', 2200, 0.7, sr), biquad('lowpass', 6500, 0.7, sr)));
  const surf = carrier(rng.fork('surf'), sr, 5.9, chain(biquad('lowpass', 380, 0.6, sr), biquad('lowpass', 380, 0.6, sr)));
  const body = carrier(rng.fork('body'), sr, 3.1, chain(biquad('lowpass', 160, 0.6, sr), biquad('lowpass', 160, 0.6, sr)));
  const lapC = carrier(rng.fork('lap'), sr, 2.3, biquad('bandpass', 600, 0.8, sr));
  const far = [swell(rng.fork('far-l'), [[1, 0.2], [3, 0.12], [7, 0.06]]), swell(rng.fork('far-r'), [[1, 0.2], [3, 0.12], [7, 0.06]])];
  const g = rng.fork('grains'), lp = rng.fork('laps');
  const grains: Grain[] = [];
  const GRAIN_CAP = 4000;
  let lapEnv = 0, lapL = 0, lapR = 0, lapDecay = 1, nextGrain = 0, nextLap = 0;
  const K = 16, n = Math.round(SEA_S * sr);
  let step = -1, washV = 0, backV = 0, foamV = 0, farL = 0, farR = 0, grainOdds = 0, i = 0;
  // the envelopes move slowly: every 16 samples is plenty
  const envelopes = (u: number) => {
    const q = Math.floor((u * n) / K);
    if (q === step) return;
    step = q;
    const t = (q * K) / sr;
    washV = 0; backV = 0;
    for (const w of waves) {
      const d = (((t - w.at) % SEA_S) + SEA_S) % SEA_S;
      washV += w.weight * washShape(w, d);
      backV += w.weight ** 1.3 * backShape(w, d);
    }
    foamV = washV ** 1.5 * SEA_MIX.foam;
    farL = far[0]!(u) * SEA_MIX.surf; farR = far[1]!(u) * SEA_MIX.surf;
    grainOdds = (2600 * backV + 60 * washV) / GRAIN_CAP;
  };
  // grains and laps arrive as Poisson processes: draw the wait to the next candidate, not a die per sample
  const wait = (r: Rng, perSecond: number) => Math.ceil((-Math.log(1 - r.next()) * sr) / perSecond);
  const R = 7919;
  return renderPair(sr, SEA_S, (u, out) => {
    envelopes(u);
    i++;
    if (--nextGrain <= 0) {
      nextGrain = wait(g, GRAIN_CAP);
      if (g.next() < grainOdds) {
        const f = Math.min(1600 * Math.exp(g.next() * Math.log(5.5 / 1.6)), sr * 0.42);
        const pan = g.next();
        grains.push({ c: 1, s: 0, cw: Math.cos((2 * Math.PI * f) / sr), sw: Math.sin((2 * Math.PI * f) / sr), amp: 0.15 + 0.85 * g.next() ** 2,
          decay: Math.exp(-1 / (g.range(0.0004, 0.0014) * sr)), l: Math.cos((pan * Math.PI) / 2), r: Math.sin((pan * Math.PI) / 2) });
      }
    }
    let rl = 0, rr = 0;
    for (let k = grains.length - 1; k >= 0; k--) {
      const gr = grains[k]!;
      const v = gr.amp * gr.s;
      rl += v * gr.l; rr += v * gr.r;
      const c = gr.c * gr.cw - gr.s * gr.sw;
      gr.s = gr.s * gr.cw + gr.c * gr.sw;
      gr.c = c;
      gr.amp *= gr.decay;
      if (gr.amp < 0.005) grains.splice(k, 1);
    }
    if (--nextLap <= 0) {
      nextLap = wait(lp, 0.9);
      lapEnv = lp.range(0.4, 1);
      lapDecay = Math.exp(-1 / (lp.range(0.04, 0.09) * sr));
      const pan = lp.range(0.2, 0.8);
      lapL = Math.cos((pan * Math.PI) / 2); lapR = Math.sin((pan * Math.PI) / 2);
    }
    lapEnv *= lapDecay;
    const common = body[i % body.length]! * washV * SEA_MIX.body;
    const lap = lapC[i % lapC.length]! * lapEnv * SEA_MIX.laps;
    const wW = washV * SEA_MIX.wash, hW = backV * SEA_MIX.hiss, rW = 4 * SEA_MIX.rattle;
    out[0] = wash[i % wash.length]! * wW + foam[i % foam.length]! * foamV + hiss[i % hiss.length]! * hW
      + rl * rW + surf[i % surf.length]! * farL + lap * lapL + common;
    const j = i + R;
    out[1] = wash[j % wash.length]! * wW + foam[j % foam.length]! * foamV + hiss[j % hiss.length]! * hW
      + rr * rW + surf[j % surf.length]! * farR + lap * lapR + common;
  });
}

/** sin^1.5 over half a cycle, the shape of a cicada's pulse (a table: it is read millions of times). */
const PULSE = Float32Array.from({ length: 1025 }, (_, k) => Math.sin((Math.PI * k) / 1024) ** 1.5);

interface Singer {
  band: Float32Array;
  offset: number;
  amp: number;
  /** buzz phasor (the tymbals, ~90–170 Hz) */
  c: number; s: number; cw: number; sw: number;
  pulse: number; pulseStep: number; duty: number;
  bout: (u: number) => number;
}

function cicadaLoop(rng: Rng, sr: number): Float32Array {
  // three bands of noise shared by the singers, each read from its own place
  const bands = [3600, 4100, 4600].map((fc, k) => carrier(rng.fork(`band-${k}`), sr, 2.3 + 0.4 * k, biquad('bandpass', fc, 3, sr)));
  const singers: Singer[] = Array.from({ length: CICADA_SINGERS }, (_, k) => {
    const r = rng.fork(`singer-${k}`);
    const band = bands[k % 3]!, fb = r.range(90, 170);
    return {
      band, offset: r.int(0, band.length - 1), amp: r.range(0.4, 1),
      c: 1, s: 0, cw: Math.cos((2 * Math.PI * fb) / sr), sw: Math.sin((2 * Math.PI * fb) / sr),
      pulse: r.next(), pulseStep: r.range(3.5, 7) / sr, duty: r.range(0.55, 0.75),
      bout: swell(r.fork('bout'), [[r.int(1, 3), 0.5], [5, 0.2]]),
    };
  });
  const shape = chain(biquad('highpass', 2500, 0.7, sr), biquad('lowpass', 5800, 0.7, sr));
  let i = 0;
  const loop = render(sr, CICADAS_S, (u) => {
    let sum = 0;
    i++;
    for (const v of singers) {
      const c = v.c * v.cw - v.s * v.sw;
      v.s = v.s * v.cw + v.c * v.sw;
      v.c = c;
      v.pulse += v.pulseStep;
      if (v.pulse >= 1) v.pulse -= 1;
      const p = v.pulse < v.duty ? PULSE[Math.floor((1024 * v.pulse) / v.duty)]! : 0;
      const bout = Math.max(0, v.bout(u) - 0.35) / 1.35;
      const buzz = 0.5 + 0.5 * v.s;
      sum += v.band[(i + v.offset) % v.band.length]! * (0.3 + 0.7 * buzz * buzz) * (0.2 + 0.8 * p) * bout * v.amp;
    }
    return shape(sum);
  });
  normaliseRms(loop, 1);
  for (let k = 0; k < loop.length; k++) loop[k] = 4 * Math.tanh(loop[k]! / 4);
  return normaliseRms(loop, COAST_RMS);
}

/** A wide stereo pair from one loop: the right channel is the left half a loop on. */
function widen(left: Float32Array): [Float32Array, Float32Array] {
  const right = new Float32Array(left.length);
  const half = left.length >> 1;
  right.set(left.subarray(half));
  right.set(left.subarray(0, half), left.length - half);
  return [left, right];
}

/** The sea's stereo loop for a context rate, at a third of that rate; deterministic for a given Rng. */
export function seaLoops(rng: Rng, sampleRate: number): StereoLoop {
  const rate = loopRate(sampleRate);
  return { data: softenPair(seaLoop(rng.fork('sea'), rate), 4, COAST_RMS), rate };
}

/** The cicadas' stereo loop for a context rate, at a third of that rate. */
export function cicadaLoops(rng: Rng, sampleRate: number): StereoLoop {
  const rate = loopRate(sampleRate);
  return { data: widen(cicadaLoop(rng.fork('cicadas'), rate)), rate };
}
