/**
 * Washi paper: a tileable grain field shared by the paper texture and by granulation / dry
 * brush (so pigment settles exactly where the paper's valleys are), plus a full paper texture
 * canvas for the renderer's `paper` layer.
 */
import { createRng } from '../core/rng';
import { makeCanvas, context2d, type AnyCanvas } from './canvas';
import { createSimplex2D, createValueNoise2D, noiseGrid } from './noise';
import { PIGMENTS, hexToRgb, type Pigment } from './pigments';

/** Side of the square grain tile, in texels (power of two so lookups can use a bit mask). */
export const GRAIN_SIZE = 512;
const MASK = GRAIN_SIZE - 1;

/**
 * Tileable paper height field. `data[y * GRAIN_SIZE + x]` is in [0, 1] with mean ≈ 0.5:
 * high = paper tooth peaks (dry brush catches here), low = valleys (granulating pigment
 * settles here). Washi fibres appear as long thin ridges.
 */
export interface PaperGrain {
  readonly seed: number;
  readonly size: number;
  readonly data: Float32Array;
  /** grain height at integer-ish pixel coordinates (wraps) */
  sample(x: number, y: number): number;
}

const grainCache = new Map<number, PaperGrain>();

/** The paper grain for `seed` (cached: built once, ~15 ms). Pure data — no canvas needed. */
export function paperGrain(seed = 1): PaperGrain {
  const cached = grainCache.get(seed);
  if (cached) return cached;
  const rng = createRng(seed).fork('paper-grain');
  const N = GRAIN_SIZE;
  const data = new Float32Array(N * N);
  const tooth = createValueNoise2D(rng.fork('tooth'), 128); // ~4 px features
  const fine = createValueNoise2D(rng.fork('fine'), 256); // ~2 px features
  const broad = createValueNoise2D(rng.fork('broad'), 32); // ~16 px soft cockling
  const white = rng.fork('white');
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v =
        0.2 * tooth(x / 4, y / 4) +
        0.12 * fine(x / 2, y / 2) +
        0.08 * broad(x / 16, y / 16) +
        0.07 * (white.next() * 2 - 1);
      data[y * N + x] = 0.5 + v;
    }
  }
  // Fibres: long, slightly curving random walks, mostly lighter (translucent kozo fibres),
  // a few darker. Rasterised with wrap-around so the tile stays seamless.
  const fr = rng.fork('fibres');
  const fibres = 1100;
  for (let f = 0; f < fibres; f++) {
    let x = fr.next() * N;
    let y = fr.next() * N;
    let a = fr.next() * Math.PI * 2;
    const len = 12 + fr.next() ** 2 * 140;
    const curl = fr.range(-0.06, 0.06);
    const amp = (fr.chance(0.78) ? 1 : -0.8) * fr.range(0.05, 0.16);
    for (let s = 0; s < len; s++) {
      const fade = Math.sin((Math.PI * s) / len);
      const xi = Math.floor(x) & MASK;
      const yi = Math.floor(y) & MASK;
      data[yi * N + xi] = data[yi * N + xi]! + amp * fade;
      // soft 1px shoulder for anti-aliasing
      const xj = (xi + 1) & MASK;
      data[yi * N + xj] = data[yi * N + xj]! + amp * fade * 0.35;
      a += curl + fr.range(-0.05, 0.05);
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, data[i]!));
  const grain: PaperGrain = {
    seed,
    size: N,
    data,
    sample: (x, y) => data[(Math.floor(y) & MASK) * N + (Math.floor(x) & MASK)]!,
  };
  grainCache.set(seed, grain);
  return grain;
}

export interface PaperOptions {
  /** include the washi colour (default true). `false` → a near-white texture of grain only, to multiply over a frame that already has a paper ground. */
  tint?: boolean;
  /** paper colour (default washi `#f3ecd9`) */
  base?: Pigment;
  /** grain contrast 0..2 (default 1) */
  grain?: number;
  /** uneven tint (cockling, sizing) 0..2 (default 1) */
  mottle?: number;
  /** faint deckle-ish darkening toward the edges 0..1 (default 0.5) */
  vignette?: number;
  /** grain texel size in pixels (default 1; use the device pixel ratio for CSS-px grain) */
  grainScale?: number;
}

/**
 * Warm washi paper texture, `w × h` pixels: fibres, tooth, slightly uneven tint and a faint
 * irregular vignette. Composite it with `multiply` over the finished frame (renderer `paper`
 * layer) or draw it first as the ground. ~60 ms for 3200×2000.
 */
export function paperTexture(w: number, h: number, seed = 1, opts: PaperOptions = {}): AnyCanvas {
  const W = Math.max(1, Math.ceil(w));
  const H = Math.max(1, Math.ceil(h));
  const canvas = makeCanvas(W, H);
  const ctx = context2d(canvas);
  const img = ctx.createImageData(W, H);
  const out = img.data;
  const grain = paperGrain(seed);
  const tint = opts.tint ?? true;
  const base = hexToRgb(opts.base ?? PIGMENTS.washi);
  const deep = hexToRgb(PIGMENTS.washiDeep);
  const gAmt = opts.grain ?? 1;
  const mAmt = opts.mottle ?? 1;
  const vig = opts.vignette ?? 0.5;
  const gs = 1 / Math.max(0.25, opts.grainScale ?? 1);
  const rng = createRng(seed).fork('paper-texture');
  const simplex = createSimplex2D(rng);
  const tone = noiseGrid(simplex, W, H, 24, Math.max(W, H) * 0.35, { octaves: 4 });
  const edge = noiseGrid(createSimplex2D(rng.fork('edge')), W, H, 16, Math.min(W, H) * 0.12, { octaves: 3 });
  const vMin = Math.min(W, H);
  const gd = grain.data;
  const br = tint ? base.r : 255;
  const bg = tint ? base.g : 252;
  const bb = tint ? base.b : 248;
  const dr = tint ? deep.r - base.r : -6;
  const dg = tint ? deep.g - base.g : -8;
  const db = tint ? deep.b - base.b : -12;
  for (let y = 0; y < H; y++) {
    const gy = (Math.floor(y * gs) & MASK) * GRAIN_SIZE;
    const ey = Math.min(y, H - 1 - y);
    for (let x = 0; x < W; x++) {
      const g = gd[gy + (Math.floor(x * gs) & MASK)]! - 0.5;
      const t = (tone.sample(x, y) - 0.5) * 2 * mAmt; // -1..1
      // distance to the nearest edge, roughened, as a fraction of the short side
      const ex = Math.min(x, W - 1 - x);
      const d = Math.min(ex, ey) / vMin + (edge.sample(x, y) - 0.5) * 0.06;
      const v = vig * Math.max(0, 1 - d / 0.16) ** 2;
      const mixDeep = Math.min(1, Math.max(0, 0.35 + t * 0.45 + v * 1.2));
      const k = 1 + g * 0.085 * gAmt - v * 0.025;
      const i = (y * W + x) * 4;
      out[i] = (br + dr * mixDeep) * k;
      out[i + 1] = (bg + dg * mixDeep) * k;
      out[i + 2] = (bb + db * mixDeep) * (k - v * 0.01);
      out[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
