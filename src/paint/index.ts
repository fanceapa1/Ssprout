/**
 * Watercolour paint engine — see docs/systems/paint.md.
 *
 * `createPainter(canvas)` returns a `Painter` bound to that canvas. Its methods paint in the
 * context's current user space (any transform), are seeded (pass `rng` in options, or the
 * painter's own stream is used) and composite subtractively (multiply) by default.
 */
import { createRng, type Rng } from '../core/rng';
import type { AnyCanvas, Ctx2D } from './canvas';
import type { Pt, Rect, Shape } from './geometry';
import { createSimplex2D } from './noise';
import { paperGrain, type PaperGrain } from './paper';
import type { Pigment } from './pigments';
import * as prim from './primitives';
import * as rec from './recipes';
import { WetLayer, type PaintEnv, type PaintParts, type Quality } from './wet';

export interface Painter {
  /** 2D context of the target canvas, in pixels (origin top-left). */
  readonly ctx: CanvasRenderingContext2D;
  /** Target width in pixels. */
  readonly w: number;
  /** Target height in pixels. */
  readonly h: number;
  /** Fallback random stream used when a call passes no `rng`. */
  readonly rng: Rng;
  /** Detail/speed trade-off: layer counts and wet-layer resolution. */
  readonly quality: Quality;
  /** The paper grain this painter's granulation and dry brush agree with. */
  readonly paper: PaperGrain;
  /** Shared environment (for the free functions in `primitives.ts` / `recipes.ts`). */
  readonly env: PaintEnv;

  wash(shape: Shape, pigment: Pigment, opts?: prim.WashOptions): void;
  glaze(shape: Shape, pigment: Pigment, opts?: prim.WashOptions): void;
  wetInWet(shape: Shape, a: Pigment, b: Pigment, opts?: prim.WetInWetOptions): void;
  granulate(shape: Shape, pigment: Pigment, opts?: prim.GranulateOptions): void;
  dab(at: Pt, pigment: Pigment, opts?: prim.DabOptions): void;
  stroke(points: readonly Pt[], opts?: prim.StrokeOptions): void;
  inkLine(points: readonly Pt[], opts?: prim.InkOptions): void;
  dryBrush(points: readonly Pt[], opts?: prim.StrokeOptions): void;
  splatter(center: Pt, opts?: prim.SplatterOptions): void;
  ripple(center: Pt, opts?: prim.RippleOptions): void;
  lift(shape: Shape, opts?: prim.LiftOptions): void;
  foliageClump(center: Pt, radius: number, pigments?: rec.FoliagePigments, opts?: rec.FoliageOptions): void;
  grassTuft(base: Pt, opts?: rec.GrassOptions): void;
  stone(shape: Shape | rec.StoneBox, opts?: rec.StoneOptions): void;
  waterBody(shape: Shape, opts?: rec.WaterOptions): void;
  /**
   * Open a wet layer over `area` (user units; whole canvas when omitted) to batch many marks
   * into one drying pass: draw with `layer.fill / lift / clip`, `paintDab(layer, …)` or raw
   * `layer.ctx` calls, then `layer.dry(opts)`.
   */
  layer(area?: Rect | null): WetLayer;
  /** Dab marks into an open layer (no drying) — for petals/leaves that should merge wet-in-wet. */
  dabInto(layer: WetLayer, at: Pt, pigment: Pigment, opts?: prim.DabOptions): void;
  /**
   * The long calls in parts (ADR 0238): generators that paint one part per `next()` (a few
   * fills, a band of a drying pass) so a cooperative caller can pause between them
   * (`yield* p.parts.wash(…)`). Drained, each paints exactly what the one-call method paints.
   */
  readonly parts: PainterParts;
}

/** `Painter`'s long calls as `PaintParts` (ADR 0238); a wet layer's is `layer.dryParts(…)`. */
export interface PainterParts {
  wash(shape: Shape, pigment: Pigment, opts?: prim.WashOptions): PaintParts;
  glaze(shape: Shape, pigment: Pigment, opts?: prim.WashOptions): PaintParts;
  wetInWet(shape: Shape, a: Pigment, b: Pigment, opts?: prim.WetInWetOptions): PaintParts;
  lift(shape: Shape, opts?: prim.LiftOptions): PaintParts;
  stone(shape: Shape | rec.StoneBox, opts?: rec.StoneOptions): PaintParts;
  waterBody(shape: Shape, opts?: rec.WaterOptions): PaintParts;
}

export interface PainterOptions {
  /** seed for the painter's fallback stream and flow noise (default 1) */
  seed?: number | string;
  /** paper grain seed (default 1 — keep it shared so all sprites sit on the same paper) */
  paperSeed?: number;
  /** grain texel size in device pixels (default 1) */
  grainScale?: number;
  /** 'draft' | 'normal' | 'high' (default 'normal') */
  quality?: Quality;
}

/** Bind a painting environment to a context (lower level than `createPainter`). */
export function createEnv(opts: PainterOptions = {}): PaintEnv {
  const rng = createRng(opts.seed ?? 1);
  return {
    rng,
    grain: paperGrain(opts.paperSeed ?? 1),
    grainScale: opts.grainScale ?? 1,
    quality: opts.quality ?? 'normal',
    flowNoise: createSimplex2D(rng.fork('flow')),
  };
}

/**
 * Create a painter for `canvas` (DOM or Offscreen). `ctx` is typed as
 * `CanvasRenderingContext2D` for species code; for an OffscreenCanvas it is the offscreen
 * context, which supports the same drawing API.
 */
export function createPainter(canvas: AnyCanvas, opts: PainterOptions = {}): Painter {
  const raw = canvas.getContext('2d') as Ctx2D | null;
  if (!raw) throw new Error('2D canvas context unavailable');
  return painterFor(raw, opts);
}

/** A painter over an existing context (e.g. the renderer's background layer context). */
export function painterFor(ctx: Ctx2D, opts: PainterOptions = {}): Painter {
  const env = createEnv(opts);
  const t: prim.PaintTarget = { ctx, env };
  return {
    ctx: ctx as CanvasRenderingContext2D,
    w: ctx.canvas.width,
    h: ctx.canvas.height,
    rng: env.rng,
    quality: env.quality,
    paper: env.grain,
    env,
    wash: (s, p, o) => prim.wash(t, s, p, o),
    glaze: (s, p, o) => prim.glaze(t, s, p, o),
    wetInWet: (s, a, b, o) => prim.wetInWet(t, s, a, b, o),
    granulate: (s, p, o) => prim.granulate(t, s, p, o),
    dab: (at, p, o) => prim.dab(t, at, p, o),
    stroke: (pts, o) => prim.stroke(t, pts, o),
    inkLine: (pts, o) => prim.inkLine(t, pts, o),
    dryBrush: (pts, o) => prim.dryBrush(t, pts, o),
    splatter: (c, o) => prim.splatter(t, c, o),
    ripple: (c, o) => prim.ripple(t, c, o),
    lift: (s, o) => prim.lift(t, s, o),
    foliageClump: (c, r, p, o) => rec.foliageClump(t, c, r, p, o),
    grassTuft: (b, o) => rec.grassTuft(t, b, o),
    stone: (s, o) => rec.stone(t, s, o),
    waterBody: (s, o) => rec.waterBody(t, s, o),
    layer: (area) => new WetLayer(ctx, area ?? null, env),
    dabInto: (layer, at, p, o = {}) => {
      prim.paintDab(layer, at, p, o, o.rng ?? env.rng, env);
    },
    parts: {
      wash: (s, p, o) => prim.washParts(t, s, p, o),
      glaze: (s, p, o) => prim.glazeParts(t, s, p, o),
      wetInWet: (s, a, b, o) => prim.wetInWetParts(t, s, a, b, o),
      lift: (s, o) => prim.liftParts(t, s, o),
      stone: (s, o) => rec.stoneParts(t, s, o),
      waterBody: (s, o) => rec.waterBodyParts(t, s, o),
    },
  };
}

export type { AnyCanvas, Ctx2D } from './canvas';
export { makeCanvas, context2d } from './canvas';
export * from './geometry';
export * from './noise';
export * from './pigments';
export { paperGrain, paperTexture, GRAIN_SIZE, type PaperGrain, type PaperOptions } from './paper';
export { WetLayer, DRY_DEFAULTS, DRY_BAND, drain, type DryOptions, type PaintEnv, type PaintParts, type Quality } from './wet';
export {
  WASH_DEFAULTS,
  GLAZE_DEFAULTS,
  DAB_DEFAULTS,
  STROKE_DEFAULTS,
  INK_DEFAULTS,
  PAPER_WHITE,
  dabDry,
  layerAlpha,
  layersFor,
  paintDab,
  prepareOutline,
  type DabOptions,
  type FadeOptions,
  type GranulateOptions,
  type InkOptions,
  type LiftOptions,
  type PaintTarget,
  type RippleOptions,
  type SplatterOptions,
  type StrokeOptions,
  type WashOptions,
  type WetInWetOptions,
} from './primitives';
export {
  FOLIAGE_GREEN,
  foliageLayout,
  type FoliageOptions,
  type FoliagePigments,
  type GrassOptions,
  type StoneBox,
  type StoneOptions,
  type WaterOptions,
} from './recipes';
