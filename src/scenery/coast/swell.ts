/**
 * The coast's swell (GS1): one schedule of crests born at the horizon that run in to the beach and
 * break there, a pure function of the motion's time. The swell bands, the shore break, the rocks'
 * foam, the cliff's laps and the caique's heave all read it, so they keep one period and direction.
 * docs/systems/scenery.md › Coast › Motion.
 */
import { createRng } from '../../core/rng';
import type { Pt } from '../../render/viewport';
import { FOAM_LINE, SEA_STRETCH, shoreDistance } from './sea';
import { COAST_SLOTS } from './slots';

export const SWELL = {
  /** mean seconds between crests, and how far a crest's arrival strays either side (< period / 2) */
  period: 10.6,
  jitter: 3.2,
  /** speed toward the shore (world units of depth a second): `speed + growth · g`, g up from the horizon */
  speed: 2,
  growth: 0.011,
  /** depth (world units from the near shore) where crests are born, and where they break */
  born: 372,
  breaks: 4,
  /** seconds the break takes to peel along the beach, left to right */
  peel: 2.6,
} as const;

/** How far from the near shore a point lies, in world units of depth (shore distance unstretched). */
export const depthOf = (q: Pt): number => shoreDistance(q) / SEA_STRETCH;

const TABLE = 97;
const table = (() => {
  const rng = createRng('coast-swell');
  return Float32Array.from({ length: TABLE * 3 }, () => rng.next());
})();
const draw = (n: number, j: number) => table[((((n % TABLE) + TABLE) % TABLE) * 3 + j)]!;

const AB = SWELL.speed / SWELL.growth;
const G_BREAK = SWELL.born - SWELL.breaks;

/** When crest `n` breaks (seconds of motion time, at the beach's left end). */
export const arrival = (n: number): number => n * SWELL.period + SWELL.jitter * (draw(n, 0) - 0.5);

/** How strong crest `n` is, 0.35–1: the swell comes in sets of about seven. */
export const strength = (n: number): number => 0.35 + 0.65 * (0.55 * (0.5 + 0.5 * Math.sin((n * Math.PI * 2) / 6.7 + 1)) + 0.45 * draw(n, 1));

/** Where a crest is `tau` seconds after it breaks (tau ≤ 0), as depth from the shore. */
export function crestDepth(tau: number): number {
  const g = (G_BREAK + AB) * Math.exp(SWELL.growth * tau) - AB;
  return SWELL.born - g;
}

/** The seconds before its break when a crest is at depth `d` (≤ 0; -Infinity past the horizon). */
export function travel(d: number): number {
  const g = SWELL.born - Math.max(SWELL.breaks, d);
  return g <= -AB ? -Infinity : Math.log((g + AB) / (G_BREAK + AB)) / SWELL.growth;
}

/** How long a crest lives on the sea, horizon to break. */
export const CREST_LIFE = -travel(SWELL.born);

/** The break's delay at x: the swell comes in a little from the left, so the left reaches it first. */
export const delayAt = (x: number): number => (Math.max(-60, Math.min(700, x)) + 60) / 760 * SWELL.peel;

/** The latest crest that broke by time `m` (arrival ≤ m). */
export function latest(m: number): number {
  let n = Math.floor(m / SWELL.period) + 1;
  while (arrival(n) > m) n--;
  return n;
}

export interface SwellPhase {
  /** the crest that last passed */
  n: number;
  /** seconds since it passed, and until the next one */
  since: number;
  gap: number;
  /** the swell's height here: 1 under a strong crest, -1 in a strong trough; continuous in t */
  lift: number;
  /** the strength of the passing water, between the two crests' */
  strength: number;
}

/** The swell at depth `d` and x at time `t` (writes into `out`). */
export function swellAt(d: number, x: number, t: number, out: SwellPhase = { n: 0, since: 0, gap: 1, lift: 0, strength: 0 }): SwellPhase {
  const m = t - delayAt(x) - travel(d);
  const n = latest(m);
  const t0 = arrival(n);
  const gap = arrival(n + 1) - t0;
  const since = m - t0;
  const u = since / gap;
  const s = strength(n) + (strength(n + 1) - strength(n)) * u;
  // sharp crests, long flat troughs
  const c = (1 + Math.cos(Math.PI * 2 * u)) / 2;
  out.n = n;
  out.since = since;
  out.gap = gap;
  out.strength = s;
  out.lift = s * (2 * c ** 1.6 - 1);
  return out;
}

/** The waterline's height at x (`FOAM_LINE`, linear between its points). */
export function foamY(x: number): number {
  const f = FOAM_LINE;
  if (x <= f[0]!.x) return f[0]!.y;
  for (let i = 1; i < f.length; i++) if (f[i]!.x >= x) return f[i - 1]!.y + ((f[i]!.y - f[i - 1]!.y) * (x - f[i - 1]!.x)) / (f[i]!.x - f[i - 1]!.x || 1);
  return f[f.length - 1]!.y;
}

/** How far up the shingle (world units below the waterline) a wave may run at x: short of the beach's plants. */
export function swashLimit(x: number): number {
  let lim = SWASH_MAX;
  for (const s of BEACH_SLOTS) if (Math.abs(s.x - x) < 44) lim = Math.min(lim, s.y - foamY(s.x) - 12);
  return Math.max(4, lim);
}
/** The farthest any wave runs up the shingle. */
export const SWASH_MAX = 20;
const BEACH_SLOTS = COAST_SLOTS.filter((s) => s.id.startsWith('beach-'));

/** Lines of equal depth across the sea, from the break out to the horizon: where a crest lies. */
export interface SwellGrid {
  /** the columns' x, every `step` units */
  xs: Float32Array;
  /** each line's depth, increasing */
  depths: Float32Array;
  /** y of line k at column j: ys[k * xs.length + j] */
  ys: Float32Array;
  /** 1 where line k's point at column j is open water (in the sea, off rock) */
  open: Uint8Array;
}

/** The depths of the grid's lines: closer together near the shore, where crests are wide apart. */
export function gridDepths(): number[] {
  const out: number[] = [];
  for (let d = SWELL.breaks - 2; d < SWELL.born + 4; d += 2.4 + 0.035 * d) out.push(d);
  return out;
}
