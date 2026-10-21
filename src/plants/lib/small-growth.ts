/**
 * Growth staging for live-grown plants (see docs/systems/plants-species-a.md).
 *
 * A session renders the same seed at many growth values and cross-fades between them, so every
 * visible quantity must be a *smooth* function of `growth` — nothing may pop in. These helpers
 * turn the single 0..1 growth value into eased per-element progress values.
 *
 * The shared timeline:
 * | growth      | what happens                                               |
 * |-------------|------------------------------------------------------------|
 * | 0 – 0.12    | soil mound + seed, the first tiny shoot breaks the ground  |
 * | 0.12 – 0.45 | stems extend, leaves unfurl one after another              |
 * | 0.45 – 0.75 | buds form and swell                                        |
 * | 0.75 – 1    | petals open (staggered per flower), full colour at 1       |
 */

export type Span = readonly [number, number];

export const STAGES = {
  seed: [0, 0.12],
  stem: [0.12, 0.45],
  bud: [0.45, 0.75],
  open: [0.75, 1],
} as const satisfies Record<string, Span>;

export const clamp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Linear progress of `g` through `[a, b]`, clamped to 0..1. */
export function phase(g: number, a: number, b: number): number {
  if (b <= a) return g >= b ? 1 : 0;
  return clamp01((g - a) / (b - a));
}

/** Smoothstep (C¹): starts and ends at rest. */
export function smooth(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Smootherstep (C²): even softer arrivals, for opening petals. */
export function smoother(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Ease-out (fast start, gentle arrival), like an unfurling leaf. */
export function easeOut(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

/** Smoothstep progress of `g` through `[a, b]`. */
export function ease(g: number, a: number, b: number): number {
  return smooth(phase(g, a, b));
}

/** Smoothstep progress through a span. */
export function within(g: number, span: Span): number {
  return smooth(phase(g, span[0], span[1]));
}

/**
 * The sub-window of `span` for element `i` of `n` when they happen one after another with
 * overlap: each element takes `share` of the span (0..1), starts spread evenly.
 */
export function stagger(i: number, n: number, span: Span, share = 0.55): Span {
  const [a, b] = span;
  const len = (b - a) * clamp01(share);
  if (n <= 1) return [a, a + len];
  const start = a + ((b - a - len) * i) / (n - 1);
  return [start, start + len];
}

/** Rises over `inSpan`, then holds until `outSpan` where it falls back to `rest`. */
export function swell(g: number, inSpan: Span, outSpan: Span, rest = 0): number {
  const up = within(g, inSpan);
  const down = within(g, outSpan);
  return up * (1 - down * (1 - rest));
}

/** Below this an element is not drawn at all (it is already sub-pixel at that point). */
export const VISIBLE = 0.015;

export const visible = (k: number): boolean => k > VISIBLE;
