/**
 * Seeded 2D noise for the paint engine: simplex noise, tileable value noise, fBm and a coarse
 * pre-sampled grid for fast per-pixel lookups. Pure functions, no DOM.
 */
import type { Rng } from '../core/rng';

/** A 2D noise function returning values in roughly [-1, 1]. */
export type Noise2D = (x: number, y: number) => number;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

/** Shuffled 0..255 permutation doubled to 512 entries (for index wrap-free lookups). */
function permutation(rng: Rng): Uint8Array {
  const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  return perm;
}

/**
 * Seeded 2D simplex noise (Gustavson's formulation). Output is in about [-1, 1], continuous,
 * with features roughly 1 unit apart — scale your coordinates (e.g. `n(x / 40, y / 40)`).
 */
export function createSimplex2D(rng: Rng): Noise2D {
  const perm = permutation(rng);
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD[perm[ii + perm[jj]!]! & 7]!;
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]!]! & 7]!;
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]!]! & 7]!;
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n;
  };
}

/**
 * Seeded value noise with smooth (quintic) interpolation, in [-1, 1]. When `period` is given the
 * noise tiles with that period (in lattice units) on both axes — used for the paper grain tile.
 */
export function createValueNoise2D(rng: Rng, period = 256): Noise2D {
  const size = Math.max(1, Math.floor(period));
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next() * 2 - 1;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const at = (x: number, y: number) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)]!;
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export interface FbmOptions {
  /** number of octaves (default 4) */
  octaves?: number;
  /** frequency multiplier per octave (default 2) */
  lacunarity?: number;
  /** amplitude multiplier per octave (default 0.5) */
  gain?: number;
}

/**
 * Fractal Brownian motion over `noise`, normalised back to about [-1, 1].
 * `fbm(n, x, y)` — scale coordinates yourself to choose the base feature size.
 */
export function fbm(noise: Noise2D, x: number, y: number, opts: FbmOptions = {}): number {
  const octaves = opts.octaves ?? 4;
  const lac = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    // offset each octave so lattice artefacts do not line up
    sum += amp * noise(x * freq + o * 17.31, y * freq - o * 9.77);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/**
 * A coarse grid of pre-computed noise values in [0, 1], sampled bilinearly. Evaluating fBm per
 * pixel is too slow for large washes; the grid evaluates it once per `cell` pixels instead.
 */
export interface NoiseGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly data: Float32Array;
  /** bilinear sample at pixel coordinates (clamped to the grid) */
  sample(x: number, y: number): number;
}

/**
 * Build a `NoiseGrid` covering `w × h` pixels with one sample every `cell` pixels.
 * `scale` is the base feature size in pixels; values are fBm remapped to [0, 1].
 */
export function noiseGrid(
  noise: Noise2D,
  w: number,
  h: number,
  cell: number,
  scale: number,
  opts: FbmOptions & { ox?: number; oy?: number } = {},
): NoiseGrid {
  const c = Math.max(1, cell);
  const cols = Math.max(2, Math.ceil(w / c) + 2);
  const rows = Math.max(2, Math.ceil(h / c) + 2);
  const data = new Float32Array(cols * rows);
  const ox = opts.ox ?? 0;
  const oy = opts.oy ?? 0;
  const inv = 1 / Math.max(1e-6, scale);
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const v = fbm(noise, (q * c + ox) * inv, (r * c + oy) * inv, opts);
      data[r * cols + q] = Math.min(1, Math.max(0, v * 0.5 + 0.5));
    }
  }
  return {
    cols,
    rows,
    cell: c,
    data,
    sample(x, y) {
      const gx = Math.min(cols - 1.001, Math.max(0, x / c));
      const gy = Math.min(rows - 1.001, Math.max(0, y / c));
      const xi = gx | 0;
      const yi = gy | 0;
      const u = gx - xi;
      const v = gy - yi;
      const i = yi * cols + xi;
      const a = data[i]!;
      const b = data[i + 1]!;
      const d = data[i + cols]!;
      const e = data[i + cols + 1]!;
      return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
    },
  };
}
