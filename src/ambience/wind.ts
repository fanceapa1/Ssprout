/**
 * Garden wind field — a pure, seeded function of time and world position, shared by the plant
 * system (sway), fauna (drift) and ambience (rain slant, motes, mist). docs/systems/ambience.md.
 *
 *   const { sway, gust } = wind(t, x, y);          // idle garden
 *   const { sway } = wind(t, x, y, windBoost('focus'));   // a touch stronger during a session
 *
 * `sway` ∈ [-1, 1] (signed lean, positive = toward +x), `gust` ∈ [0, 1] (how much of a gust
 * front is passing). Gust fronts travel across the garden from left to right, so neighbouring
 * plants lean one after another rather than in lock-step.
 */
import { createRng } from '../core/rng';
import type { SessionPhase } from '../core/session';
import { createSimplex2D, type Noise2D } from '../paint/noise';

export interface WindSample {
  /** signed lean, -1..1 (positive = toward +x) */
  sway: number;
  /** strength of the passing gust front, 0..1 */
  gust: number;
}

export type WindFn = (t: number, x: number, y: number, boost?: number) => WindSample;

/** Tuning (documented in docs/systems/ambience.md › Wind). */
export const WIND = {
  /** slow base lean: time frequency (1/s) and spatial frequency (1/world unit) */
  baseFreq: 0.07,
  baseSpace: 0.0011,
  baseAmp: 0.42,
  /** quicker flutter on top */
  flutterFreq: 0.55,
  flutterSpace: 0.006,
  flutterAmp: 0.16,
  /** gust fronts: how often (1/s) and how fast they travel across x (world units / s) */
  gustFreq: 0.045,
  gustSpeed: 140,
  /** prevailing direction of the lean a gust adds (+1 = toward +x) */
  gustLean: 0.38,
  /** amplitude multiplier at boost = 1 (a running focus block) */
  sessionBoost: 0.35,
  /** sustained mean lean toward +x (the garden's prevailing breeze) */
  prevailing: 0.06,
} as const;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a: number, b: number, v: number) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** Build a wind field from a seed (the app uses the default `wind`). */
export function createWind(seed: number | string = 'garden-wind'): WindFn {
  const rng = createRng(seed);
  const base: Noise2D = createSimplex2D(rng.fork('base'));
  const flutter: Noise2D = createSimplex2D(rng.fork('flutter'));
  const gusts: Noise2D = createSimplex2D(rng.fork('gust'));
  return (t, x, y, boost = 0) => {
    const b = clamp(Number.isFinite(boost) ? boost : 0, 0, 1);
    const tt = Number.isFinite(t) ? t : 0;
    const xx = Number.isFinite(x) ? x : 0;
    const yy = Number.isFinite(y) ? y : 0;
    // a gust front: a broad noise ridge travelling toward +x
    const g = smoothstep(0.15, 0.75, gusts(WIND.gustFreq * (tt - xx / WIND.gustSpeed), yy * 0.0007 + 3.1));
    const amp = 1 + WIND.sessionBoost * b;
    const s =
      WIND.prevailing +
      WIND.baseAmp * base(tt * WIND.baseFreq + xx * WIND.baseSpace, yy * WIND.baseSpace) +
      WIND.flutterAmp * (0.5 + 0.5 * g) * flutter(tt * WIND.flutterFreq + xx * WIND.flutterSpace, yy * WIND.flutterSpace - 7.3) +
      WIND.gustLean * g;
    return { sway: clamp(s * amp, -1, 1), gust: clamp(g * (0.85 + 0.15 * b), 0, 1) };
  };
}

/** The garden's wind (fixed seed, so every system sees the same breeze). */
export const wind: WindFn = createWind();

/** Suggested `boost` for a session phase: focus 1, break 0.5, otherwise 0. */
export function windBoost(phase: SessionPhase): number {
  return phase === 'focus' ? 1 : phase === 'break' ? 0.5 : 0;
}
