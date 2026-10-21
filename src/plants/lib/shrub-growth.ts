/**
 * Growth timing shared by the tier-3 flowering shrubs (docs/systems/plants-species-b.md).
 *
 * A plant's whole structure is generated once from its rng; growth (0 → 1) only decides how
 * much of each element is painted. Every element owns a window `[t0, t1]` on the growth axis
 * and is drawn at `ramp(growth, t0, t1)` of its final size, so consecutive growth steps of the
 * same seed are frames of one continuous plant.
 */

/** The four growth phases every tier-3 species follows. */
export const PHASES = {
  /** soil, seed and the first shoot */
  seed: [0, 0.12],
  /** woody stems extend, leaf clusters fill in */
  stems: [0.12, 0.45],
  /** buds form and swell */
  buds: [0.45, 0.75],
  /** flowers open (staggered); full colour at 1 */
  bloom: [0.75, 1],
} as const satisfies Record<string, readonly [number, number]>;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smoothstep of a 0..1 parameter. */
export const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth 0 → 1 as `g` goes from `a` to `b` (a step when the window is empty). */
export function ramp(g: number, a: number, b: number): number {
  if (b <= a) return g >= b ? 1 : 0;
  return smooth((g - a) / (b - a));
}

/** Linear 0 → 1 as `g` goes from `a` to `b`. */
export function linear(g: number, a: number, b: number): number {
  if (b <= a) return g >= b ? 1 : 0;
  return clamp01((g - a) / (b - a));
}

/**
 * Window of item `i` of `n` staggered across `[a, b]`; each item takes `len` of the span
 * (items overlap when `len` > 1/n).
 */
export function stagger(i: number, n: number, a: number, b: number, len = 0.5): [number, number] {
  const span = b - a;
  const d = span * clamp01(len);
  const start = n <= 1 ? a : a + (span - d) * (i / (n - 1));
  return [start, start + d];
}
