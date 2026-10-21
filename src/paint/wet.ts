/**
 * Wet layers: the heart of the engine.
 *
 * Every mark is first laid down, as many low-alpha fills, into a private CPU work canvas (the
 * "wet" layer, in the target's own coordinate space). `dry()` then runs a per-pixel pass that
 * turns that soft coverage into watercolour — crisp-but-irregular wet edges, pigment pooled at
 * the rims, lighter centres, mottled flow, granulation in the paper grain, optional dry-brush
 * breakup — and composites the result onto the target (multiply by default: subtractive).
 *
 * The pixel maths lives in pure functions (`shapeAlpha`, `boxBlur`, `dryPixels`) so it can be
 * unit-tested on plain typed arrays.
 */
import type { Rng } from '../core/rng';
import { acquireWork, releaseWork, type Ctx2D } from './canvas';
import type { Pt, Rect } from './geometry';
import { noiseGrid, type Noise2D, type NoiseGrid } from './noise';
import { GRAIN_SIZE, type PaperGrain } from './paper';
import { rgba, type Pigment } from './pigments';

export type Quality = 'draft' | 'normal' | 'high';

/** Shared painting environment (one per Painter). */
export interface PaintEnv {
  readonly rng: Rng;
  readonly grain: PaperGrain;
  /** grain texel size in device pixels */
  readonly grainScale: number;
  readonly quality: Quality;
  /** noise used for pigment flow; each layer samples it at a random offset */
  readonly flowNoise: Noise2D;
}

/** How a wet layer dries. All amounts are 0..1 unless noted; sizes are in user units. */
export interface DryOptions {
  /** overall opacity of the dried layer (default 0.85) */
  opacity?: number;
  /** pigment pooled at the wet edge — darker rim (default 0.5) */
  edge?: number;
  /** width of the pooled rim, user units (default 2.5) */
  edgeWidth?: number;
  /** how crisp the wet edge is: 0 = soft layered fringe, 1 = hard edge (default 0.6) */
  sharpness?: number;
  /** lighter interior, as pigment migrates to the edge (default 0.25) */
  centreLift?: number;
  /** pigment settling into paper valleys (default 0.2) */
  granulation?: number;
  /** keep only granules — speckle without a body wash (used by `granulate`, default 0) */
  speckle?: number;
  /** extra pigment settled as clustered dark granules on top of the body, in the same pass
   * (cheaper than a separate `granulate`; default 0) */
  granules?: number;
  /** mottled, uneven pigment flow (default 0.35) */
  flow?: number;
  /** size of flow mottling, user units (default 40) */
  flowScale?: number;
  /** dry-brush breakup: pigment only catches paper peaks (default 0) */
  dry?: number;
  /** how much the rim colour darkens (default 0.3) */
  darken?: number;
  /** composite operation onto the target (default `multiply`) */
  blend?: GlobalCompositeOperation;
}

export const DRY_DEFAULTS = {
  opacity: 0.85,
  edge: 0.5,
  edgeWidth: 2.5,
  sharpness: 0.6,
  centreLift: 0.25,
  granulation: 0.2,
  speckle: 0,
  granules: 0,
  flow: 0.35,
  flowScale: 40,
  dry: 0,
  darken: 0.3,
  blend: 'multiply' as GlobalCompositeOperation,
} satisfies Required<DryOptions>;

export type ResolvedDry = Required<DryOptions>;

export function resolveDry(opts: DryOptions = {}, base: ResolvedDry = DRY_DEFAULTS): ResolvedDry {
  const out = { ...base };
  for (const k of Object.keys(opts) as (keyof DryOptions)[]) {
    const v = opts[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// pure pixel maths

const smoothstep = (a: number, b: number, x: number) => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/**
 * Sharpen soft layered coverage into a wet edge: low coverage (stray single layers) fades out,
 * mid coverage snaps up to a body, interior variation is kept.
 */
export function shapeAlpha(a: number, sharpness: number): number {
  if (a <= 0) return 0;
  const hard = smoothstep(0.1, 0.48, a) * (0.62 + 0.38 * a);
  return a + sharpness * (hard - a);
}

/** Separable box blur of a scalar field, run `passes` times (≈ Gaussian); outside = 0. */
export function boxBlur(src: Float32Array, w: number, h: number, radius: number, passes = 2): Float32Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return src.slice();
  const a = src.slice();
  const b = new Float32Array(src.length);
  const col = new Float64Array(w);
  const inv = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    // horizontal a → b
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = 0; x < Math.min(r, w); x++) acc += a[row + x]!;
      for (let x = 0; x < w; x++) {
        const add = x + r;
        if (add < w) acc += a[row + add]!;
        const sub = x - r - 1;
        if (sub >= 0) acc -= a[row + sub]!;
        b[row + x] = acc * inv;
      }
    }
    // vertical b → a, row by row with a running column sum (cache friendly)
    col.fill(0);
    for (let y = 0; y < Math.min(r, h); y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) col[x] = col[x]! + b[row + x]!;
    }
    for (let y = 0; y < h; y++) {
      const add = y + r;
      const sub = y - r - 1;
      const ra = add * w;
      const rs = sub * w;
      const row = y * w;
      if (add < h) for (let x = 0; x < w; x++) col[x] = col[x]! + b[ra + x]!;
      if (sub >= 0) for (let x = 0; x < w; x++) col[x] = col[x]! - b[rs + x]!;
      for (let x = 0; x < w; x++) a[row + x] = col[x]! * inv;
    }
  }
  return a;
}

/**
 * Blur used for edge detection. Wide radii are computed on a half-resolution copy and
 * upsampled bilinearly — 4× less work, visually identical for a soft rim profile.
 */
export function edgeBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 2 || w < 8 || h < 8) return boxBlur(src, w, h, radius, 2);
  const bw = Math.ceil(w / 2);
  const bh = Math.ceil(h / 2);
  const half = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const y0 = y * 2;
    const y1 = Math.min(h - 1, y0 + 1);
    for (let x = 0; x < bw; x++) {
      const x0 = x * 2;
      const x1 = Math.min(w - 1, x0 + 1);
      half[y * bw + x] = (src[y0 * w + x0]! + src[y0 * w + x1]! + src[y1 * w + x0]! + src[y1 * w + x1]!) * 0.25;
    }
  }
  const hb = boxBlur(half, bw, bh, radius / 2, 2);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(bh - 1.001, (y - 0.5) / 2));
    const yi = fy | 0;
    const v = fy - yi;
    const r0 = yi * bw;
    const r1 = Math.min(bh - 1, yi + 1) * bw;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(bw - 1.001, (x - 0.5) / 2));
      const xi = fx | 0;
      const u = fx - xi;
      const a = hb[r0 + xi]!;
      const b = hb[r0 + xi + 1]!;
      const c = hb[r1 + xi]!;
      const d = hb[r1 + xi + 1]!;
      out[y * w + x] = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
  }
  return out;
}

/** Per-pixel lookups into the paper grain for a layer: `grain[rows[y] + cols[x]]`. */
export interface GrainLookup {
  data: Float32Array;
  cols: Int32Array;
  rows: Int32Array;
}

/** A flat grain (all 0.5) — for tests. */
export function flatGrain(w: number, h: number): GrainLookup {
  return { data: new Float32Array([0.5]), cols: new Int32Array(w), rows: new Int32Array(h) };
}

/**
 * The drying pass. `data` is unpremultiplied RGBA (as from `getImageData`) and is rewritten in
 * place. `edgePx`/flow are in pixels of this buffer.
 */
export function dryPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  o: ResolvedDry,
  edgePx: number,
  grain: GrainLookup,
  flow: NoiseGrid | null,
): void {
  const n = w * h;
  const s = new Float32Array(n);
  let any = false;
  const gd0 = grain.data;
  for (let y = 0; y < h; y++) {
    const gRow = grain.rows[y]!;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let a = data[i * 4 + 3]! / 255;
      if (a > 0) {
        // the wet front creeps along paper fibres: perturb coverage by the grain where it is
        // partial, so dried edges get a fine, paper-driven irregularity
        a += (gd0[gRow + grain.cols[x]!]! - 0.5) * 0.25 * a * (1 - a);
        s[i] = shapeAlpha(a, o.sharpness);
        any = true;
      }
    }
  }
  if (!any) return;
  const blur = edgeBlur(s, w, h, edgePx / 1.7);
  const edge = o.edge * 0.95;
  const lift = o.centreLift;
  const flowAmt = o.flow * 1.7;
  const gran = o.granulation;
  const speckle = o.speckle;
  const granules = o.granules;
  const dry = o.dry;
  const darken = o.darken;
  const opacity = o.opacity;
  const gd = grain.data;
  const gCols = grain.cols;
  const fCols = flow?.cols ?? 0;
  const fData = flow?.data;
  const fInv = flow ? 1 / flow.cell : 0;
  // flow is bilinear in the coarse grid: per row, interpolate the grid columns vertically once,
  // then each pixel only lerps between two neighbouring column values
  const fxi = new Int32Array(w);
  const fxu = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const fx = Math.min(fCols - 1.001, x * fInv);
    fxi[x] = Math.max(0, fx | 0);
    fxu[x] = fx - (fx | 0);
  }
  const colVal = new Float32Array(Math.max(2, fCols));
  for (let y = 0; y < h; y++) {
    const gRow = grain.rows[y]!;
    if (fData) {
      const fy = Math.min(flow!.rows - 1.001, y * fInv);
      const fyi = fy | 0;
      const fv = fy - fyi;
      const r0 = fyi * fCols;
      const r1 = r0 + fCols;
      for (let q = 0; q < fCols; q++) colVal[q] = fData[r0 + q]! + (fData[r1 + q]! - fData[r0 + q]!) * fv;
    }
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sv = s[i]!;
      const j = i * 4;
      if (sv < 0.003) {
        data[j + 3] = 0;
        continue;
      }
      const bv = blur[i]!;
      let e = (sv - bv) * 2.2;
      e = e < 0 ? 0 : e > 1 ? 1 : e;
      let f = 0.5;
      if (fData) {
        const q = fxi[x]!;
        const c0 = colVal[q]!;
        f = c0 + (colVal[q + 1]! - c0) * fxu[x]!;
      }
      const g = gd[gRow + gCols[x]!]!;
      let dens = sv * (1 - lift * bv) + edge * e;
      dens *= 1 + flowAmt * (f - 0.5);
      dens *= 1 + gran * (0.5 - g) * 2.6;
      // granules cluster: paper valleys (low g) gated by a coarser noise so speckle comes in drifts
      if (speckle > 0) dens *= smoothstep(0.7 - speckle * 0.15, 0.9, (1 - g) * 0.85 + (f - 0.5) * 0.9 + 0.12);
      let gk = 0;
      if (granules > 0) {
        gk = granules * smoothstep(0.7 - granules * 0.15, 0.9, (1 - g) * 0.85 + (f - 0.5) * 0.9 + 0.12);
        dens += gk * sv * 0.6;
      }
      // dry brush: pigment only catches paper peaks, and breaks up most at the stroke's edges
      if (dry > 0) dens *= smoothstep(dry - 0.1, dry + 0.1, g * 0.75 + f * 0.35 + (sv - 0.7) * 0.2 - e * 0.3);
      let alpha = dens * opacity;
      alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
      const dk = 1 - darken * e * 0.9 - gran * 0.16 * (0.5 - g) - gk * 0.3;
      data[j] = data[j]! * dk;
      data[j + 1] = data[j + 1]! * dk;
      data[j + 2] = data[j + 2]! * dk;
      data[j + 3] = alpha * 255;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// the layer

/** Work resolution (work pixels per device pixel) for a layer of `devArea` device pixels. */
export function layerResolution(quality: Quality, devArea: number): number {
  if (quality === 'draft') return 0.5;
  if (quality === 'high') return 1;
  return devArea > 1_500_000 ? 0.7 : devArea > 250_000 ? 0.8 : 1;
}

export function tracePath(ctx: Ctx2D, poly: readonly Pt[]): void {
  ctx.beginPath();
  const first = poly[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
  ctx.closePath();
}

/**
 * A wet layer over `area` (user units of `target`, or the whole target when `null`). Draw raw
 * pigment into `ctx` (same coordinates as the target) with `fill` / `lift` / `clip` or plain
 * canvas calls, then call `dry()` exactly once.
 */
export class WetLayer {
  /** work context — draws in the target's user space */
  readonly ctx: Ctx2D;
  /** work pixels per user unit (for converting sizes) */
  readonly scale: number;
  readonly empty: boolean;
  private readonly target: Ctx2D;
  private readonly env: PaintEnv;
  private readonly work: ReturnType<typeof acquireWork>;
  private readonly dx: number;
  private readonly dy: number;
  private readonly res: number;
  private readonly W: number;
  private readonly H: number;
  private done = false;

  constructor(target: Ctx2D, area: Rect | null, env: PaintEnv, res?: number) {
    this.target = target;
    this.env = env;
    const m = target.getTransform();
    const cw = target.canvas.width;
    const ch = target.canvas.height;
    let x0 = 0;
    let y0 = 0;
    let x1 = cw;
    let y1 = ch;
    if (area) {
      const cs: [number, number][] = [
        [area.x, area.y],
        [area.x + area.w, area.y],
        [area.x, area.y + area.h],
        [area.x + area.w, area.y + area.h],
      ];
      x0 = Infinity;
      y0 = Infinity;
      x1 = -Infinity;
      y1 = -Infinity;
      for (const [x, y] of cs) {
        const X = m.a * x + m.c * y + m.e;
        const Y = m.b * x + m.d * y + m.f;
        x0 = Math.min(x0, X);
        y0 = Math.min(y0, Y);
        x1 = Math.max(x1, X);
        y1 = Math.max(y1, Y);
      }
      x0 = Math.max(0, Math.floor(x0));
      y0 = Math.max(0, Math.floor(y0));
      x1 = Math.min(cw, Math.ceil(x1));
      y1 = Math.min(ch, Math.ceil(y1));
    }
    this.empty = !(x1 > x0 && y1 > y0);
    const dw = Math.max(1, x1 - x0);
    const dh = Math.max(1, y1 - y0);
    this.res = res ?? layerResolution(env.quality, dw * dh);
    this.dx = x0;
    this.dy = y0;
    this.W = Math.max(1, Math.ceil(dw * this.res));
    this.H = Math.max(1, Math.ceil(dh * this.res));
    this.work = acquireWork(this.empty ? 1 : this.W, this.empty ? 1 : this.H);
    this.ctx = this.work.ctx;
    const r = this.res;
    this.ctx.setTransform(r * m.a, r * m.b, r * m.c, r * m.d, r * (m.e - x0), r * (m.f - y0));
    this.scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) * r;
  }

  /** Fill `poly` with `pigment` at `alpha` (source-over inside the layer). */
  fill(poly: readonly Pt[], pigment: Pigment, alpha: number): void {
    tracePath(this.ctx, poly);
    this.ctx.fillStyle = rgba(pigment, alpha);
    this.ctx.fill();
  }

  /** Lift (remove) pigment inside `poly` by `amount` (0..1) — blooms, highlights, lost edges. */
  lift(poly: readonly Pt[], amount: number): void {
    const c = this.ctx;
    const prev = c.globalCompositeOperation;
    c.globalCompositeOperation = 'destination-out';
    tracePath(c, poly);
    c.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, amount))})`;
    c.fill();
    c.globalCompositeOperation = prev;
  }

  /** Restrict subsequent marks to `poly` (wrap in `ctx.save()/restore()` to undo). */
  clip(poly: readonly Pt[]): void {
    tracePath(this.ctx, poly);
    this.ctx.clip();
  }

  /** Run the drying pass and composite onto the target. Releases the layer. */
  dry(opts: DryOptions = {}, base?: ResolvedDry): void {
    if (this.done) return;
    this.done = true;
    try {
      if (this.empty) return;
      const o = resolveDry(opts, base);
      const { W, H } = this;
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const img = ctx.getImageData(0, 0, W, H);
      const grain = this.grainLookup();
      const flowPx = Math.max(4, o.flowScale * this.scale);
      const flow =
        o.flow > 0
          ? noiseGrid(this.env.flowNoise, W, H, Math.max(3, Math.min(24, flowPx / 5)), flowPx, {
              octaves: 3,
              ox: this.env.rng.range(-5000, 5000),
              oy: this.env.rng.range(-5000, 5000),
            })
          : null;
      const edgePx = Math.max(1, Math.min(48, o.edgeWidth * this.scale));
      dryPixels(img.data, W, H, o, edgePx, grain, flow);
      ctx.putImageData(img, 0, 0);
      const t = this.target;
      t.save();
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalAlpha = 1;
      t.globalCompositeOperation = o.blend;
      t.imageSmoothingEnabled = true;
      t.drawImage(this.work.canvas, 0, 0, W, H, this.dx, this.dy, W / this.res, H / this.res);
      t.restore();
    } finally {
      releaseWork(this.work);
    }
  }

  /** Abandon the layer without painting. */
  discard(): void {
    if (this.done) return;
    this.done = true;
    releaseWork(this.work);
  }

  private grainLookup(): GrainLookup {
    const gs = this.env.grainScale;
    const cols = new Int32Array(this.W);
    const rows = new Int32Array(this.H);
    const mask = GRAIN_SIZE - 1;
    const k = 1 / (this.res * gs);
    for (let x = 0; x < this.W; x++) cols[x] = Math.floor(this.dx / gs + x * k) & mask;
    for (let y = 0; y < this.H; y++) rows[y] = (Math.floor(this.dy / gs + y * k) & mask) * GRAIN_SIZE;
    return { data: this.env.grain.data, cols, rows };
  }
}
