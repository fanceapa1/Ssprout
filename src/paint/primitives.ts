/**
 * Watercolour primitives. Each one: pure geometry (geometry.ts) → raw low-alpha marks in a
 * `WetLayer` → `dry()` (edge pooling, flow, granulation) → composite onto the target.
 *
 * All primitives draw in the target context's current user space (any transform), take an
 * optional `rng` (default: the painter's stream) and have documented defaults. Use them via a
 * `Painter` (`p.wash(...)`) — these free functions take a `PaintTarget` first.
 */
import type { Rng } from '../core/rng';
import type { Ctx2D } from './canvas';
import {
  blob,
  bounds,
  centroid,
  densify,
  deformPolygon,
  dabOutline,
  extentAlong,
  halfPlane,
  innerClip,
  padRect,
  organicOutline,
  outlineLayer,
  pathLength,
  randomPointIn,
  ribbon,
  smoothPath,
  smoothPolygon,
  toPolygon,
  unionRect,
  type DabVariant,
  type Outline,
  type Polygon,
  type Pt,
  type Rect,
  type Shape,
} from './geometry';
import { PIGMENTS, darken, jitter, rgba, type Pigment } from './pigments';
import { DRY_DEFAULTS, WetLayer, drain, resolveDry, tracePath, type DryOptions, type PaintEnv, type PaintParts, type ResolvedDry } from './wet';

/** What every primitive paints into. */
export interface PaintTarget {
  readonly ctx: Ctx2D;
  readonly env: PaintEnv;
}

const QUALITY_LAYERS = { draft: 0.5, normal: 1, high: 1.4 } as const;

/** Scale a layer count by the painter's quality knob. */
export function layersFor(env: PaintEnv, n: number): number {
  return Math.max(1, Math.round(n * QUALITY_LAYERS[env.quality]));
}

/** Per-layer alpha so `layers` overlapping fills reach `coverage` in the interior. */
export function layerAlpha(layers: number, coverage = 0.9): number {
  return 1 - (1 - coverage) ** (1 / Math.max(1, layers));
}

/** Size (diameter-ish) of a rect: mean of its sides. */
const sizeOf = (r: Rect) => (r.w + r.h) / 2;

/**
 * Normalise any shape into a watercolour outline family (see `organicOutline`): evenly
 * resampled so deformation is proportional to the shape's size, not to how densely it was
 * authored, and capped so long thin shapes never spike.
 */
export function prepareOutline(shape: Shape, rng: Rng, deform: number, detail = 24): Outline {
  return organicOutline(toPolygon(shape, rng), rng, { deform, detail });
}

/**
 * A soft-fronted half plane covering the side `side` points to, whose boundary crosses the
 * `axis` direction at projection `d` (measured from the origin, like `extentAlong`), centred
 * laterally on `near` (for fades and bleeds).
 */
export function organicHalfPlane(d: number, axis: number, side: number, near: Pt, size: number, ext: number, rng: Rng, variance: number): Polygon {
  const ux = Math.cos(axis);
  const uy = Math.sin(axis);
  const k = d - (near.x * ux + near.y * uy);
  const p = { x: near.x + ux * k, y: near.y + uy * k };
  const hp = densify(halfPlane(p, side, size), Math.max(2, ext * 0.1));
  return smoothPolygon(deformPolygon(hp, rng, { depth: 3, variance, decay: 0.55, cap: ext * 0.06 }), 1);
}

// ---------------------------------------------------------------------------------------------
// wash & glaze

export interface FadeOptions {
  /** direction toward the side that fades out (radians; 0 = right, π/2 = down) */
  angle: number;
  /** where the fade starts along that direction, 0..1 of the shape's extent (default 0.45) */
  start?: number;
  /** how much is lifted at the far side, 0..1 (default 1 = lost edge) */
  amount?: number;
  /** raggedness of the fade front, 0..1 (default 0.6) */
  ragged?: number;
}

export interface WashOptions extends DryOptions {
  rng?: Rng;
  /** number of layered fills (default 16; scaled by quality) */
  layers?: number;
  /** base outline deformation (Hobbs variance, default 0.3) */
  deform?: number;
  /** per-layer deformation — how far layers wander at the edge (default 0.15) */
  spread?: number;
  /** interior coverage reached by all layers before drying (default 0.9) */
  coverage?: number;
  /** per-layer pigment variation (default 0.025) */
  jitter?: number;
  /** soften / lose one side: an angle (lost edge toward that direction) or full options */
  fade?: number | FadeOptions;
  /** number of backrun blooms (cauliflowers) inside the wash (default 0) */
  blooms?: number;
  /** bloom radius as a fraction of the wash size (default 0.16) */
  bloomSize?: number;
  /** extra pigments dropped wet-in-wet into the wash: soft blotches that bleed (default none) */
  drops?: { pigment: Pigment; at?: Pt; size?: number; alpha?: number }[];
}

export const WASH_DEFAULTS = {
  layers: 16,
  deform: 0.3,
  spread: 0.15,
  coverage: 0.9,
  jitter: 0.025,
  blooms: 0,
  bloomSize: 0.16,
  dry: { ...DRY_DEFAULTS, edge: 0.5, sharpness: 0.6, centreLift: 0.25, granulation: 0.2, flow: 0.35 } as ResolvedDry,
};

/** Lay `n` fresh deformations of an outline into a wet layer, pausing after each (ADR 0238). */
function* layered(L: WetLayer, o: Outline, pigment: Pigment, rng: Rng, n: number, spread: number, coverage: number, jit: number): PaintParts {
  const a = layerAlpha(n, coverage);
  for (let k = 0; k < n; k++) {
    L.fill(outlineLayer(o, rng, spread), jit > 0 ? jitter(pigment, rng, jit) : pigment, a);
    yield;
  }
}

/** Fade the layer toward a direction (lost edge): a gradient lift plus a few soft ragged fronts. */
function* applyFade(L: WetLayer, base: Polygon, fade: number | FadeOptions, rng: Rng): PaintParts {
  const f: FadeOptions = typeof fade === 'number' ? { angle: fade } : fade;
  const start = f.start ?? 0.45;
  const amount = f.amount ?? 1;
  const ragged = f.ragged ?? 0.6;
  const [lo, hi] = extentAlong(base, f.angle);
  const ext = Math.max(1, hi - lo);
  const ux = Math.cos(f.angle);
  const uy = Math.sin(f.angle);
  const d0 = lo + ext * start;
  const b = padRect(bounds(base), ext * 0.1);
  const c = L.ctx;
  const g = c.createLinearGradient(ux * d0, uy * d0, ux * hi, uy * hi);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, `rgba(0,0,0,${amount * (1 - ragged * 0.5) * 0.55})`);
  g.addColorStop(1, `rgba(0,0,0,${amount * (1 - ragged * 0.5)})`);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = g;
  c.fillRect(b.x, b.y, b.w, b.h);
  c.restore();
  yield;
  if (ragged > 0) {
    const steps = 4;
    const size = ext * 2 + sizeOf(b);
    for (let s = 0; s < steps; s++) {
      const d = d0 + ((hi - d0) * (s + 0.3 + rng.next() * 0.7)) / steps;
      L.lift(organicHalfPlane(d, f.angle, f.angle, centroid(base), size, ext, rng, 0.45), ((amount * ragged * 0.5) / steps) * 1.7);
      yield;
    }
  }
}

/**
 * Backrun blooms: water pushed back into a drying wash leaves a pale patch with a crinkled,
 * darker fringe. Lifted here; the drying pass turns the lift boundary into the fringe.
 */
function* applyBlooms(L: WetLayer, base: Polygon, count: number, sizeFrac: number, rng: Rng): PaintParts {
  const s = sizeOf(bounds(base));
  for (let i = 0; i < count; i++) {
    const c = randomPointIn(base, rng);
    const r = s * sizeFrac * rng.range(0.6, 1.2);
    const shape = blob(c.x, c.y, r, r * rng.range(0.75, 1), rng, { points: 30, irregularity: 0.22, scallop: 1, scallops: rng.int(6, 10) });
    const outline = deformPolygon(shape, rng, { depth: 2, variance: 0.18, cap: r * 0.08 });
    L.lift(outline, rng.range(0.45, 0.6));
    const inner = deformPolygon(blob(c.x, c.y, r * 0.6, r * 0.55, rng, { points: 20, irregularity: 0.25 }), rng, { depth: 2, variance: 0.2, cap: r * 0.08 });
    L.lift(inner, rng.range(0.12, 0.25));
    yield;
  }
}

/**
 * Wet-edge wash: the workhorse. Many deformed low-alpha layers of `shape` dry into a body with
 * irregular, pooled edges and a lighter centre. Options add a lost edge (`fade`), backrun
 * `blooms` and wet-in-wet `drops`.
 *
 * @example p.wash({ cx: 200, cy: 120, rx: 90, ry: 40 }, PIGMENTS.sap, { blooms: 1, fade: -Math.PI / 2 })
 */
export function wash(t: PaintTarget, shape: Shape, pigment: Pigment, opts: WashOptions = {}): void {
  drain(washParts(t, shape, pigment, opts));
}

/** `wash` in parts: it pauses after each layered fill, drop, bloom and fade front, and inside the drying pass (ADR 0238). */
export function* washParts(t: PaintTarget, shape: Shape, pigment: Pigment, opts: WashOptions = {}): PaintParts {
  const rng = opts.rng ?? t.env.rng;
  const o = prepareOutline(shape, rng, opts.deform ?? WASH_DEFAULTS.deform);
  const b = o.bounds;
  const L = new WetLayer(t.ctx, padRect(b, sizeOf(b) * 0.035 + (opts.edgeWidth ?? 2.5) * 2), t.env);
  try {
    yield* layered(
      L,
      o,
      pigment,
      rng,
      layersFor(t.env, opts.layers ?? WASH_DEFAULTS.layers),
      opts.spread ?? WASH_DEFAULTS.spread,
      opts.coverage ?? WASH_DEFAULTS.coverage,
      opts.jitter ?? WASH_DEFAULTS.jitter,
    );
    if (opts.drops?.length) {
      const s = sizeOf(b);
      for (const d of opts.drops) {
        const at = d.at ?? randomPointIn(o.base, rng);
        const r = (d.size ?? 0.3) * s * 0.5;
        L.ctx.save();
        L.clip(innerClip(o));
        const drop = organicOutline(blob(at.x, at.y, r, r * rng.range(0.6, 1), rng, { irregularity: 0.3, rotation: rng.range(0, 6.3) }), rng, { deform: 0.4 });
        yield* layered(L, drop, d.pigment, rng, 5, 0.9, d.alpha ?? 0.6, 0.02);
        L.ctx.restore();
      }
    }
    if (opts.blooms) yield* applyBlooms(L, o.base, opts.blooms, opts.bloomSize ?? WASH_DEFAULTS.bloomSize, rng);
    if (opts.fade !== undefined) yield* applyFade(L, o.base, opts.fade, rng);
  } catch (e) {
    L.discard();
    throw e;
  }
  yield* L.dryParts(opts, WASH_DEFAULTS.dry);
}

export const GLAZE_DEFAULTS: ResolvedDry = {
  ...DRY_DEFAULTS,
  opacity: 0.35,
  edge: 0.18,
  sharpness: 0.4,
  centreLift: 0,
  granulation: 0.08,
  flow: 0.25,
  flowScale: 80,
};

/**
 * Glaze: a thin transparent tint over a region (shadows, warm light, unifying a passage).
 * Soft edges, almost no pooling, multiplied over what is below. Use `fade` for a glaze that
 * dies away (e.g. a shadow fading upward).
 *
 * @example p.glaze(stoneOutline, shade(PIGMENTS.stone), { fade: -Math.PI / 2, opacity: 0.4 })
 */
export function glaze(t: PaintTarget, shape: Shape, pigment: Pigment, opts: WashOptions = {}): void {
  drain(glazeParts(t, shape, pigment, opts));
}

/** `glaze` in parts (ADR 0238). */
export function* glazeParts(t: PaintTarget, shape: Shape, pigment: Pigment, opts: WashOptions = {}): PaintParts {
  const rng = opts.rng ?? t.env.rng;
  const o = prepareOutline(shape, rng, opts.deform ?? 0.22);
  const L = new WetLayer(t.ctx, padRect(o.bounds, sizeOf(o.bounds) * 0.035 + 4), t.env);
  yield* layered(L, o, pigment, rng, layersFor(t.env, opts.layers ?? 7), opts.spread ?? 0.3, opts.coverage ?? 0.85, opts.jitter ?? 0.015);
  if (opts.fade !== undefined) yield* applyFade(L, o.base, opts.fade, rng);
  yield* L.dryParts(opts, GLAZE_DEFAULTS);
}

// ---------------------------------------------------------------------------------------------
// wet-in-wet

export interface WetInWetOptions extends WashOptions {
  /** direction from pigment `a` toward pigment `b` (radians; default π/2 = b at the bottom) */
  angle?: number;
  /** where the colours meet, 0..1 along that direction (default 0.5) */
  split?: number;
  /** width of the blended band as a fraction of the shape (default 0.3) */
  softness?: number;
  /** how far feathery fingers of each colour reach into the other, 0..1 (default 0.5) */
  fingers?: number;
}

/**
 * Two pigments bleeding into each other inside one wet shape (e.g. stone grey into moss green,
 * sky blue into warm haze): each layer of `a` and `b` is clipped to a ragged, shifting
 * boundary so the colours feather and mix in a soft band.
 *
 * @example p.wetInWet(stone, PIGMENTS.stone, PIGMENTS.sage, { angle: -Math.PI / 2, split: 0.7 })
 */
export function wetInWet(t: PaintTarget, shape: Shape, a: Pigment, b: Pigment, opts: WetInWetOptions = {}): void {
  drain(wetInWetParts(t, shape, a, b, opts));
}

/** `wetInWet` in parts: it pauses after each pair of clipped fills, bloom and fade front, and inside the drying pass (ADR 0238). */
export function* wetInWetParts(t: PaintTarget, shape: Shape, a: Pigment, b: Pigment, opts: WetInWetOptions = {}): PaintParts {
  const rng = opts.rng ?? t.env.rng;
  const angle = opts.angle ?? Math.PI / 2;
  const split = opts.split ?? 0.5;
  const soft = opts.softness ?? 0.3;
  const fingers = opts.fingers ?? 0.5;
  const o = prepareOutline(shape, rng, opts.deform ?? WASH_DEFAULTS.deform);
  const bb = o.bounds;
  const [lo, hi] = extentAlong(o.base, angle);
  const ext = Math.max(1, hi - lo);
  const big = ext * 2 + sizeOf(bb);
  const L = new WetLayer(t.ctx, padRect(bb, sizeOf(bb) * 0.035 + 5), t.env);
  const n = layersFor(t.env, opts.layers ?? 14);
  const alpha = layerAlpha(n, opts.coverage ?? 0.9);
  const spread = opts.spread ?? WASH_DEFAULTS.spread;
  const jit = opts.jitter ?? 0.025;
  const v = 0.2 + fingers * 0.6;
  const mid = centroid(o.base);
  for (let k = 0; k < n; k++) {
    const d = lo + ext * (split + rng.gaussian(0, soft * 0.35));
    const lp = outlineLayer(o, rng, spread);
    const c = L.ctx;
    c.save();
    L.clip(organicHalfPlane(d + ext * soft * 0.25, angle, angle + Math.PI, mid, big, ext, rng, v));
    L.fill(lp, jitter(a, rng, jit), alpha);
    c.restore();
    c.save();
    L.clip(organicHalfPlane(d - ext * soft * 0.25, angle, angle, mid, big, ext, rng, v));
    L.fill(lp, jitter(b, rng, jit), alpha);
    c.restore();
    yield;
  }
  if (opts.blooms) yield* applyBlooms(L, o.base, opts.blooms, opts.bloomSize ?? WASH_DEFAULTS.bloomSize, rng);
  if (opts.fade !== undefined) yield* applyFade(L, o.base, opts.fade, rng);
  yield* L.dryParts(opts, WASH_DEFAULTS.dry);
}

// ---------------------------------------------------------------------------------------------
// granulation

export interface GranulateOptions extends WashOptions {
  /** 0..1 — how much pigment settles into the grain (default 0.6) */
  strength?: number;
}

/**
 * Granulation: pigment particles settled in the paper's valleys — a noise-clustered speckle
 * that agrees with the paper grain. Lay it over a wash of the same family (stones, water,
 * earth). Soft-edged so it never outlines the shape.
 *
 * @example p.granulate(stoneOutline, PIGMENTS.stoneDark, { strength: 0.7 })
 */
export function granulate(t: PaintTarget, shape: Shape, pigment: Pigment, opts: GranulateOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const s = opts.strength ?? 0.6;
  const o = prepareOutline(shape, rng, opts.deform ?? 0.25);
  const L = new WetLayer(t.ctx, padRect(o.bounds, sizeOf(o.bounds) * 0.035 + 4), t.env);
  drain(layered(L, o, pigment, rng, layersFor(t.env, opts.layers ?? 3), opts.spread ?? 0.35, 0.85, 0.02));
  if (opts.fade !== undefined) drain(applyFade(L, o.base, opts.fade, rng));
  L.dry(opts, {
    ...DRY_DEFAULTS,
    opacity: 0.2 + 0.4 * s,
    edge: 0.05,
    sharpness: 0.2,
    centreLift: 0,
    granulation: 0.4 + 0.4 * s,
    speckle: s,
    flow: 0.6,
    flowScale: 22,
  });
}

// ---------------------------------------------------------------------------------------------
// dabs

export interface DabOptions extends DryOptions {
  rng?: Rng;
  /** base→tip direction in radians (default -π/2, pointing up) */
  angle?: number;
  /** base-to-tip length (default 22) */
  length?: number;
  /** maximum width (default length × 0.42) */
  width?: number;
  /** axis bend as a fraction of length, signed (default 0) */
  curve?: number;
  /** -1..1 fuller on one flank (default random ±0.25) */
  asym?: number;
  /** leaf (pointed), petal (broad rounded tip), blade (grass), needle (pine), round (foliage blot) */
  variant?: DabVariant;
  /** strength of pigment pooled along one flank (default 0.5) */
  pool?: number;
  /** flank that pools: 1 or -1 (default random) */
  poolSide?: number;
  /** extra pigment toward the base (brush first touches there; default 0.3) */
  basePool?: number;
  /** layered fills per dab (default 4) */
  layers?: number;
  /** pigment variation (default 0.03) */
  jitter?: number;
}

export const DAB_DEFAULTS = {
  angle: -Math.PI / 2,
  length: 22,
  widthRatio: 0.42,
  curve: 0,
  variant: 'leaf' as DabVariant,
  pool: 0.5,
  basePool: 0.3,
  layers: 4,
  jitter: 0.03,
};

const DAB_DRY: ResolvedDry = { ...DRY_DEFAULTS, opacity: 0.85, edge: 0.55, sharpness: 0.72, centreLift: 0.3, granulation: 0.1, flow: 0.3 };

/** Dry settings that suit a dab of the given size (rim and mottling scale with the dab). */
export function dabDry(length: number, width: number, extra: DryOptions = {}): ResolvedDry {
  return resolveDry(extra, {
    ...DAB_DRY,
    edgeWidth: Math.max(0.7, Math.min(3, width * 0.13)),
    flowScale: Math.max(6, length * 0.7),
  });
}

/** Geometry of a dab with its random variation applied (pure; exposed for tests). */
export function dabShape(at: Pt, o: DabOptions, rng: Rng): { outline: Polygon; angle: number; length: number; width: number } {
  const length = (o.length ?? DAB_DEFAULTS.length) * rng.range(0.92, 1.08);
  const width = (o.width ?? (o.length ?? DAB_DEFAULTS.length) * DAB_DEFAULTS.widthRatio) * rng.range(0.9, 1.1);
  const angle = (o.angle ?? DAB_DEFAULTS.angle) + rng.gaussian(0, 0.04);
  const outline = dabOutline(at.x, at.y, {
    angle,
    length,
    width,
    curve: (o.curve ?? DAB_DEFAULTS.curve) + rng.gaussian(0, 0.04),
    asym: o.asym ?? rng.range(-0.25, 0.25),
    variant: o.variant ?? DAB_DEFAULTS.variant,
  });
  return { outline, angle, length, width };
}

/** Paint a dab's raw marks into an open wet layer (for batching many dabs into one dry pass). */
export function paintDab(
  L: WetLayer,
  at: Pt,
  pigment: Pigment,
  o: DabOptions,
  rng: Rng,
  env?: PaintEnv,
  shape: ReturnType<typeof dabShape> = dabShape(at, o, rng),
): Polygon {
  const { outline, angle, length, width } = shape;
  const n = env ? layersFor(env, o.layers ?? DAB_DEFAULTS.layers) : (o.layers ?? DAB_DEFAULTS.layers);
  const a = layerAlpha(n, 0.88);
  const thin = (o.variant ?? 'leaf') === 'needle' || (o.variant ?? 'leaf') === 'blade';
  for (let k = 0; k < n; k++) {
    const poly = deformPolygon(outline, rng, { depth: 1, variance: thin ? 0.04 : 0.09 });
    L.fill(poly, jitter(pigment, rng, o.jitter ?? DAB_DEFAULTS.jitter), a);
  }
  const c = L.ctx;
  const deep = darken(pigment, 0.22);
  const pool = o.pool ?? DAB_DEFAULTS.pool;
  if (pool > 0) {
    // pigment pooled along one flank: gradient across the axis
    const side = o.poolSide ?? (rng.chance(0.5) ? 1 : -1);
    const nx = -Math.sin(angle) * side;
    const ny = Math.cos(angle) * side;
    const mx = at.x + Math.cos(angle) * length * 0.5;
    const my = at.y + Math.sin(angle) * length * 0.5;
    const g = c.createLinearGradient(mx, my, mx + nx * width * 0.55, my + ny * width * 0.55);
    g.addColorStop(0, rgba(deep, 0));
    g.addColorStop(1, rgba(deep, 0.55 * pool));
    c.fillStyle = g;
    tracePath(c, outline);
    c.fill();
  }
  const bp = o.basePool ?? DAB_DEFAULTS.basePool;
  if (bp > 0) {
    const g = c.createLinearGradient(at.x, at.y, at.x + Math.cos(angle) * length * 0.6, at.y + Math.sin(angle) * length * 0.6);
    g.addColorStop(0, rgba(deep, 0.5 * bp));
    g.addColorStop(1, rgba(deep, 0));
    c.fillStyle = g;
    tracePath(c, outline);
    c.fill();
  }
  return outline;
}

/**
 * A single brush dab — the unit of leaves, petals, grass blades and pine needles: tapered,
 * asymmetric, with pigment pooled along one flank and at the base.
 *
 * @example p.dab({ x: 50, y: 90 }, PIGMENTS.sage, { angle: -1.2, length: 28, curve: 0.2 })
 * @example p.dab(c, PIGMENTS.sakura, { variant: 'petal', angle: a, length: 18, blend: 'source-over' })
 */
export function dab(t: PaintTarget, at: Pt, pigment: Pigment, opts: DabOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const shape = dabShape(at, opts, rng);
  // the wet layer only needs to cover the dab itself (plus room for its rim)
  const L = new WetLayer(t.ctx, padRect(bounds(shape.outline), shape.width * 0.25 + 2), t.env);
  paintDab(L, at, pigment, opts, rng, t.env, shape);
  L.dry(opts, dabDry(shape.length, shape.width));
}

// ---------------------------------------------------------------------------------------------
// strokes

export interface StrokeOptions extends DryOptions {
  rng?: Rng;
  /** pigment (default sage) */
  pigment?: Pigment;
  /** full width at pressure 1 (default 6) */
  width?: number;
  /** taper lengths as fractions of the stroke: [start, end] (default [0.12, 0.4]) */
  taper?: [number, number];
  /** pressure along the stroke: function of t (0..1) or samples spread evenly (default 1) */
  pressure?: ((t: number) => number) | readonly number[];
  /** sideways wander, 0..1 (default 0.5) */
  wobble?: number;
  /** 0 = dry, crisp-edged; 1 = wet, soft and pooled (default 0.5) */
  wetness?: number;
  /** 0..1 dry-brush breakup into bristle marks (default 0) */
  dryness?: number;
  /** bristle count for dry strokes (default from width) */
  bristles?: number;
  /** layered fills (default 3) */
  layers?: number;
}

export const STROKE_DEFAULTS = { width: 6, taper: [0.12, 0.4] as [number, number], wobble: 0.5, wetness: 0.5, dryness: 0, layers: 3 };

function pressureAt(p: StrokeOptions['pressure'], t: number): number {
  if (!p) return 1;
  if (typeof p === 'function') return p(t);
  if (p.length === 0) return 1;
  if (p.length === 1) return p[0]!;
  const x = Math.min(1, Math.max(0, t)) * (p.length - 1);
  const i = Math.min(p.length - 2, Math.floor(x));
  return p[i]! + (p[i + 1]! - p[i]!) * (x - i);
}

const taperAt = (t: number, ts: number, te: number) => {
  let k = 1;
  if (ts > 0 && t < ts) k *= (t / ts) ** 0.6;
  if (te > 0 && t > 1 - te) k *= ((1 - t) / te) ** 0.75;
  return Math.max(0, k);
};

/** Centreline + half-width function of a stroke (pure apart from the noise function). */
export function strokeGeometry(
  points: readonly Pt[],
  o: StrokeOptions,
  noise: (x: number, y: number) => number,
  rng: Rng,
): { path: Pt[]; len: number; hw: (t: number) => number; off: (t: number) => number } {
  const width = o.width ?? STROKE_DEFAULTS.width;
  const [ts, te] = o.taper ?? STROKE_DEFAULTS.taper;
  const wobble = o.wobble ?? STROKE_DEFAULTS.wobble;
  const path = smoothPath(points, Math.max(0.6, width * 0.3));
  const len = pathLength(path);
  const s1 = rng.range(0, 1000);
  const s2 = rng.range(0, 1000);
  const hw = (t: number) =>
    (width / 2) * pressureAt(o.pressure, t) * taperAt(t, ts, te) * (1 + 0.16 * noise((t * len) / (width * 3), s1));
  const off = (t: number) => wobble * width * 0.4 * noise((t * len) / (width * 7 + 10), s2);
  return { path, len, hw, off };
}

/**
 * A brush stroke along `points` with pressure, taper, wobble and wetness; with `dryness` it
 * breaks into bristle marks that skip over the paper (dry brush).
 *
 * @example p.stroke([{x:10,y:80},{x:60,y:60},{x:120,y:70}], { pigment: PIGMENTS.olive, width: 5 })
 */
export function stroke(t: PaintTarget, points: readonly Pt[], opts: StrokeOptions = {}): void {
  if (points.length < 2) return;
  const rng = opts.rng ?? t.env.rng;
  const pigment = opts.pigment ?? PIGMENTS.sage;
  const width = opts.width ?? STROKE_DEFAULTS.width;
  const wet = opts.wetness ?? STROKE_DEFAULTS.wetness;
  const dryness = opts.dryness ?? STROKE_DEFAULTS.dryness;
  const g = strokeGeometry(points, opts, t.env.flowNoise, rng);
  const L = new WetLayer(t.ctx, padRect(bounds(g.path), width * 2 + 4), t.env);
  const c = L.ctx;
  if (dryness < 0.05) {
    const n = layersFor(t.env, opts.layers ?? STROKE_DEFAULTS.layers);
    const a = layerAlpha(n, 0.88);
    for (let k = 0; k < n; k++) {
      const wk = 1 + rng.gaussian(0, 0.05);
      const poly = ribbon(g.path, (s) => g.hw(s) * wk, g.off);
      L.fill(deformPolygon(poly, rng, { depth: 1, variance: 0.05 }), jitter(pigment, rng, 0.02), a);
    }
  } else {
    // body under the bristles: the drying pass breaks it up along the paper grain
    L.fill(ribbon(g.path, g.hw, g.off), pigment, 0.5 * (1 - dryness * 0.6));
    const nb = opts.bristles ?? Math.max(5, Math.min(18, Math.round(width / 1.2)));
    const lw = Math.max(0.5, (width / nb) * 1.2);
    const normals = g.path.map((_, i) => {
      const a = g.path[Math.max(0, i - 1)]!;
      const b = g.path[Math.min(g.path.length - 1, i + 1)]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    });
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let j = 0; j < nb; j++) {
      const u = -1 + (2 * (j + 0.5)) / nb + rng.gaussian(0, 0.08);
      const seed = rng.range(0, 1000);
      c.strokeStyle = rgba(jitter(pigment, rng, 0.04), rng.range(0.5, 0.85));
      c.lineWidth = lw * rng.range(0.7, 1.3);
      let down = false;
      // each bristle starts a little late and may run dry before the end of the stroke
      const t0 = rng.range(0, 0.12);
      const t1 = 1 - rng.next() * dryness * 0.6 * (0.4 + Math.abs(u));
      c.beginPath();
      for (let i = 0; i < g.path.length; i++) {
        const s = i / (g.path.length - 1);
        const p = g.path[i]!;
        const nm = normals[i]!;
        const hw = g.hw(s);
        // rare long skips (low-frequency), outer bristles skip more than the core
        const gate = t.env.flowNoise((s * g.len) / (width * 6 + 20), seed) + (1 - Math.abs(u)) * 0.6 - dryness * 0.7;
        const ink = s >= t0 && s <= t1 && gate > -0.45 && hw > 0.15;
        const o = g.off(s) + u * hw * 0.92;
        if (ink) {
          if (!down) c.moveTo(p.x + nm.x * o, p.y + nm.y * o);
          else c.lineTo(p.x + nm.x * o, p.y + nm.y * o);
          down = true;
        } else down = false;
      }
      c.stroke();
    }
  }
  L.dry(opts, {
    ...DRY_DEFAULTS,
    opacity: 0.85,
    edge: 0.25 + 0.35 * (1 - wet),
    edgeWidth: Math.max(0.7, width * 0.16),
    sharpness: 0.45 + 0.4 * (1 - wet),
    centreLift: 0.15,
    granulation: 0.15,
    flow: 0.3,
    flowScale: width * 4 + 8,
    dry: dryness >= 0.05 ? 0.3 + dryness * 0.45 : 0,
  });
}

export interface InkOptions extends DryOptions {
  rng?: Rng;
  /** line width at full pressure (default 1.6) */
  width?: number;
  /** ink colour (default sumi `#4a443c` — never pure black) */
  pigment?: Pigment;
  /** chance per ~30 widths of a short break in the line (default 0.15) */
  breaks?: number;
  /** sideways wobble, 0..1 (default 0.35) */
  wobble?: number;
  /** pressure variation along the line, 0..1 (default 0.35) */
  pressureVar?: number;
  /** taper fractions [start, end] (default [0.15, 0.3]) */
  taper?: [number, number];
  /** explicit pressure profile (multiplied with the noise variation) */
  pressure?: StrokeOptions['pressure'];
}

export const INK_DEFAULTS = { width: 1.6, breaks: 0.15, wobble: 0.35, pressureVar: 0.35, taper: [0.15, 0.3] as [number, number] };

/** Split a resampled path into pieces with short gaps (pure; exposed for tests). */
export function breakPath(path: readonly Pt[], width: number, breaks: number, rng: Rng): Pt[][] {
  const pieces: Pt[][] = [];
  let cur: Pt[] = [];
  const spacing = path.length > 1 ? Math.max(0.1, pathLength(path) / (path.length - 1)) : 1;
  const every = Math.max(4, Math.round((width * 30) / spacing));
  let skip = 0;
  for (let i = 0; i < path.length; i++) {
    if (skip > 0) {
      skip--;
      continue;
    }
    cur.push(path[i]!);
    const nearEnd = i < every / 2 || i > path.length - every / 2;
    if (!nearEnd && i % every === 0 && rng.chance(breaks)) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
      skip = Math.max(1, Math.round((width * rng.range(1.5, 4.5)) / spacing));
    }
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

/**
 * Thin sumi ink line: tapered, pressure-varied, slightly wobbly and occasionally broken. For
 * stems, trunks, eaves and ripple lines — use sparingly.
 *
 * @example p.inkLine([{x:40,y:200},{x:46,y:120},{x:38,y:40}], { width: 2.2 })
 */
export function inkLine(t: PaintTarget, points: readonly Pt[], opts: InkOptions = {}): void {
  if (points.length < 2) return;
  const rng = opts.rng ?? t.env.rng;
  const width = opts.width ?? INK_DEFAULTS.width;
  const pigment = opts.pigment ?? PIGMENTS.sumi;
  const pv = opts.pressureVar ?? INK_DEFAULTS.pressureVar;
  const wobble = opts.wobble ?? INK_DEFAULTS.wobble;
  const [ts, te] = opts.taper ?? INK_DEFAULTS.taper;
  const full = smoothPath(points, Math.max(0.5, width * 0.5));
  const totalLen = pathLength(full);
  const pieces = breakPath(full, width, opts.breaks ?? INK_DEFAULTS.breaks, rng);
  const L = new WetLayer(t.ctx, padRect(bounds(full), width * 3 + 3), t.env);
  const s1 = rng.range(0, 1000);
  const s2 = rng.range(0, 1000);
  let startIdx = 0;
  for (const piece of pieces) {
    const n = piece.length;
    const pieceLen = pathLength(piece);
    const i0 = full.indexOf(piece[0]!, startIdx);
    startIdx = Math.max(0, i0);
    const first = pieces[0] === piece;
    const last = pieces[pieces.length - 1] === piece;
    const pts0 = Math.max(1, i0);
    const hw = (s: number, i: number) => {
      const gi = (pts0 + i) / Math.max(1, full.length - 1); // global t
      const local = s;
      let k = taperAt(gi, ts, te);
      // internal break ends taper quickly, like a lifted brush
      const lt = Math.min(0.5, (width * 3) / Math.max(1, pieceLen));
      if (!first && local < lt) k *= (local / lt) ** 0.7;
      if (!last && local > 1 - lt) k *= ((1 - local) / lt) ** 0.7;
      const pr = pressureAt(opts.pressure, gi) * (1 + pv * t.env.flowNoise((gi * totalLen) / (width * 14 + 6), s1));
      return (width / 2) * Math.max(0.15, pr) * k;
    };
    const off = (_s: number, i: number) => {
      const gi = (pts0 + i) / Math.max(1, full.length - 1);
      return wobble * (width * 0.8 + totalLen * 0.012) * t.env.flowNoise((gi * totalLen) / (width * 12 + totalLen * 0.25), s2);
    };
    if (n < 2) continue;
    for (let k = 0; k < 2; k++) L.fill(ribbon(piece, hw, off), jitter(pigment, rng, 0.015), 0.7);
  }
  L.dry(opts, {
    ...DRY_DEFAULTS,
    opacity: 0.9,
    edge: 0.3,
    edgeWidth: Math.max(0.5, width * 0.3),
    sharpness: 0.85,
    centreLift: 0.12,
    granulation: 0.12,
    flow: 0.25,
    flowScale: width * 20 + 10,
    darken: 0.12,
  });
}

/**
 * Dry brush scumble: a dragged, half-empty brush — broken bristle marks that catch only the
 * paper's peaks. For grass texture, bark, path edges, worn wood.
 *
 * @example p.dryBrush([{x:0,y:300},{x:120,y:296}], { pigment: PIGMENTS.sage, width: 16 })
 */
export function dryBrush(t: PaintTarget, points: readonly Pt[], opts: StrokeOptions = {}): void {
  stroke(t, points, { wetness: 0.15, dryness: 0.6, width: 14, wobble: 0.3, taper: [0.03, 0.14], ...opts });
}

// ---------------------------------------------------------------------------------------------
// splatter, ripple, lift

export interface SplatterOptions extends DryOptions {
  rng?: Rng;
  pigment?: Pigment;
  /** spread radius (default 30) */
  radius?: number;
  /** approximate number of drops (default 6) */
  count?: number;
  /** typical drop radius (default 2.4) */
  size?: number;
}

/**
 * A few flicked drops — rare and subtle; a hint of spontaneity near a flower bed or rock, never
 * confetti. Drops dry with strong rims.
 *
 * @example p.splatter({ x: 120, y: 80 }, { pigment: PIGMENTS.sage, count: 5 })
 */
export function splatter(t: PaintTarget, center: Pt, opts: SplatterOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const radius = opts.radius ?? 30;
  const size = opts.size ?? 2.4;
  const count = rng.int(Math.max(1, Math.round((opts.count ?? 6) * 0.6)), Math.round((opts.count ?? 6) * 1.3));
  const pigment = opts.pigment ?? PIGMENTS.sage;
  const L = new WetLayer(t.ctx, padRect({ x: center.x - radius * 1.6, y: center.y - radius * 1.6, w: radius * 3.2, h: radius * 3.2 }, size * 4), t.env);
  for (let i = 0; i < count; i++) {
    const r = radius * Math.min(1.5, Math.abs(rng.gaussian(0, 0.6)));
    const a = rng.range(0, Math.PI * 2);
    const s = size * (0.35 + rng.next() ** 3 * 1.9);
    const x = center.x + Math.cos(a) * r;
    const y = center.y + Math.sin(a) * r;
    const drop = deformPolygon(blob(x, y, s, s * rng.range(0.75, 1), rng, { points: 10, irregularity: 0.2 }), rng, { depth: 1, variance: 0.15 });
    L.fill(drop, jitter(pigment, rng, 0.04), 0.85);
    if (rng.chance(0.12)) {
      const tail = dabOutline(x, y, { angle: a, length: s * rng.range(1.8, 3), width: s * 0.8, variant: 'blade' });
      L.fill(tail, pigment, 0.6);
    }
  }
  L.dry(opts, { ...DRY_DEFAULTS, opacity: 0.6, edge: 0.7, edgeWidth: size * 0.5, sharpness: 0.85, centreLift: 0.45, granulation: 0.15, flow: 0.2 });
}

export interface RippleOptions {
  rng?: Rng;
  /** overall width of the outer ripple (default 70) */
  width?: number;
  /** number of nested ripple lines (default 3) */
  count?: number;
  /** vertical squash: ripple height / width (default 0.12) */
  squash?: number;
  /** dark line pigment (default deep celadon) */
  pigment?: Pigment;
  /** opacity of the dark lines (default 0.5) */
  opacity?: number;
  /** opacity of the pale lifted lines just below (default 0.65; 0 = none) */
  light?: number;
  /** dark line width (default 1.1) */
  lineWidth?: number;
}

/**
 * Ripple lines for water: a few nested, flattened, broken arcs in deep celadon with pale
 * lifted lines beside them — like the quick strokes on a still pond.
 *
 * @example p.ripple({ x: 400, y: 260 }, { width: 90, count: 3 })
 */
export function ripple(t: PaintTarget, center: Pt, opts: RippleOptions = {}): void {
  drain(rippleParts(t, center, opts));
}

/** `ripple` in parts: it pauses after each line (ADR 0238). */
export function* rippleParts(t: PaintTarget, center: Pt, opts: RippleOptions = {}): PaintParts {
  const rng = opts.rng ?? t.env.rng;
  const width = opts.width ?? 70;
  const count = Math.max(1, opts.count ?? 3);
  const squash = opts.squash ?? 0.12;
  const pigment = opts.pigment ?? PIGMENTS.celadonDeep;
  const lw = opts.lineWidth ?? 1.1;
  const light = opts.light ?? 0.65;
  const arcs: Pt[][] = [];
  for (let k = 0; k < count; k++) {
    const f = count === 1 ? 1 : 0.45 + (0.55 * k) / (count - 1);
    const rx = (width / 2) * f * rng.range(0.9, 1.08);
    const ry = rx * squash * rng.range(0.8, 1.2);
    const cx = center.x + rng.gaussian(0, width * 0.02);
    const cy = center.y + rng.gaussian(0, ry * 0.15);
    // a lower arc (front of the ring), sometimes split in two
    const a0 = rng.range(0.05, 0.3) * Math.PI;
    const a1 = rng.range(0.7, 0.95) * Math.PI;
    const splits = rng.chance(0.4) ? [[a0, (a0 + a1) / 2 - 0.12], [(a0 + a1) / 2 + 0.1, a1]] : [[a0, a1]];
    for (const [s0, s1] of splits) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = s0! + ((s1! - s0!) * i) / 12;
        pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      arcs.push(pts);
    }
    // the faint back half, shorter
    if (rng.chance(0.55)) {
      const b0 = Math.PI * rng.range(1.25, 1.4);
      const b1 = Math.PI * rng.range(1.6, 1.8);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = b0 + ((b1 - b0) * i) / 8;
        pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      arcs.push(pts);
    }
  }
  for (const a of arcs) {
    inkLine(t, a, { rng, width: lw * rng.range(0.8, 1.2), pigment, opacity: (opts.opacity ?? 0.5) * rng.range(0.7, 1), breaks: 0.25, wobble: 0.15, taper: [0.3, 0.35] });
    yield;
  }
  if (light > 0) {
    for (const a of arcs) {
      if (!rng.chance(0.75)) continue;
      const shifted = a.map((p) => ({ x: p.x, y: p.y + lw * 1.8 }));
      inkLine(t, shifted, {
        rng,
        width: lw * 1.4,
        pigment: PAPER_WHITE,
        opacity: light * rng.range(0.6, 1),
        breaks: 0.3,
        wobble: 0.15,
        taper: [0.3, 0.35],
        blend: 'source-over',
        edge: 0.05,
        granulation: 0,
      });
      yield;
    }
  }
}

/**
 * Colour of bare paper *before* the paper texture is multiplied over the frame. The pipeline
 * paints on white and multiplies `paperTexture` last (renderer `paper` layer), so lifted or
 * reserved areas use this near-white and end up the colour of the washi.
 */
export const PAPER_WHITE = '#fffdf8';

export interface LiftOptions extends WashOptions {
  /** how much paper is recovered, 0..1 (default 0.5) */
  amount?: number;
  /** colour of the lifted paper (default `PAPER_WHITE`) */
  paper?: Pigment;
}

/**
 * Lift: blot pigment back off with a damp brush — highlights on water, light on a stone's top.
 * Paints pale paper colour over what is there (source-over), so use it on opaque backgrounds,
 * not on transparent sprites.
 *
 * @example p.lift({ cx: 300, cy: 200, rx: 120, ry: 6 }, { amount: 0.4 })
 */
export function lift(t: PaintTarget, shape: Shape, opts: LiftOptions = {}): void {
  drain(liftParts(t, shape, opts));
}

/** `lift` in parts (a `washParts` of paper, ADR 0238). */
export function liftParts(t: PaintTarget, shape: Shape, opts: LiftOptions = {}): PaintParts {
  return washParts(t, shape, opts.paper ?? PAPER_WHITE, {
    edge: 0.05,
    sharpness: 0.35,
    centreLift: 0,
    granulation: 0,
    flow: 0.3,
    layers: 8,
    jitter: 0,
    ...opts,
    opacity: opts.amount ?? opts.opacity ?? 0.5,
    blend: 'source-over',
  });
}

/** Union of rects helper re-exported for recipes. */
export { unionRect };
