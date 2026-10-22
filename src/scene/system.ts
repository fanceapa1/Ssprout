/**
 * The scene system: paints the garden into a cached bitmap (background layer), serves the
 * foreground boulders/tufts as depth-sorted entities, animates the water surface and draws the
 * `?dev&slots` overlay. See docs/systems/scene.md.
 *
 * Painting is expensive (≈1 s), so it is cached per paint view and redone only when the
 * viewport's scale changes by more than 10 % or the view leaves the painted area; otherwise the
 * cached bitmap is simply rescaled. The first paint blocks `init` (so `ready()` means
 * "painted"); later repaints run in the background while the old painting stays on screen,
 * then cross-fade in. Paint runs cooperatively, yielding to the browser between steps.
 */
import { paperTexture, type AnyCanvas, type Quality } from '../paint';
import type { Drawable, LayerId, System, SystemContext } from '../render/types';
import { WORLD_H, WORLD_W, type Rect, type Viewport } from '../render/viewport';
import { GARDEN_ART, PaintCancelled, paintScene, type PaintResult, type PaintView, type SceneArt } from './background';
import { drawSlotOverlay } from './overlay';
import { createWaterSurface, type WaterSurface } from './water';
import { pinnedSource, type DaylightSource } from '../ambience/daylight-source';
import type { DaylightState } from '../ambience/daylight';
import { createSkyLight, type SkyLight } from './sky-light';
import { createRimCache, drawRim, type RimCache } from '../paint/rim';
import { rimLight } from '../ambience/sky-layout';

export interface SceneSystemOptions {
  art?: SceneArt;
  quality?: Quality;
  /** called when a cached layer must be rebuilt (pass `renderer.invalidate`) */
  invalidate?: (layer: LayerId) => void;
  /** draw the slot overlay (`?dev&slots`) */
  showSlots?: boolean;
  /** fade-in duration of a new painting, seconds (default 1.2) */
  fadeSeconds?: number;
  /** cap on bitmap pixels per world unit (default 2.2); above it the painting is upscaled */
  maxPaintScale?: number;
  /** repaint when the scale changes by more than this fraction (default 0.1) */
  rescaleTolerance?: number;
  /** extra world units painted around the visible area so small resizes need no repaint */
  margin?: number;
  /** yield to the browser between paint slices (default: a macrotask) */
  yieldTo?: () => Promise<void>;
  /** monotonic ms clock used only for perf timings and slicing (default performance.now) */
  now?: () => number;
  /** the garden's daylight (sky phases, rim light on the boulders); default: pinned midday */
  daylight?: DaylightSource;
}

/** Seconds between checks whether the sky composite needs rebuilding (it changes over minutes). */
const SKY_CHECK_S = 2;

export interface SceneStats {
  paints: number;
  rescales: number;
  /** wall time of the last paint (includes yields to the browser) */
  lastPaintMs: number;
  /** painting time of the last paint (sum of steps) */
  lastCpuMs: number;
  lastView: PaintView | null;
  timings: { name: string; ms: number }[];
  painting: boolean;
}

export interface SceneSystem extends System {
  /** resolves when no paint job is pending (the current painting matches the viewport) */
  whenPainted(): Promise<void>;
  stats(): SceneStats;
  /** sky plates painted, composites built, ms spent painting skies */
  skyStats(): ReturnType<SkyLight['stats']> | null;
}

const macrotask = () => new Promise<void>((r) => setTimeout(r, 0));

/** The view to paint for a viewport: the visible world (+ margin) at a capped scale. */
export function paintViewFor(vp: Viewport, maxScale: number, margin: number): PaintView {
  const scale = Math.min(vp.pixelScale, maxScale);
  const v = vp.visible;
  const x0 = Math.max(0, Math.floor(v.x - margin));
  const y0 = Math.max(0, Math.floor(v.y - margin));
  const x1 = Math.min(WORLD_W, Math.ceil(v.x + v.w + margin));
  const y1 = Math.min(WORLD_H, Math.ceil(v.y + v.h + margin));
  return { rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, scale };
}

const contains = (a: Rect, b: Rect) => b.x >= a.x - 0.5 && b.y >= a.y - 0.5 && b.x + b.w <= a.x + a.w + 0.5 && b.y + b.h <= a.y + a.h + 0.5;

/**
 * Whether a painting of `current` can be reused (rescaled) for `wanted` instead of repainting:
 * the scale is within `tolerance` and the wanted area is already painted.
 */
export function canReuse(current: PaintView, wanted: PaintView, tolerance: number): boolean {
  return Math.abs(wanted.scale / current.scale - 1) <= tolerance && contains(current.rect, wanted.rect);
}

export function createSceneSystem(opts: SceneSystemOptions = {}): SceneSystem {
  const art = opts.art ?? GARDEN_ART;
  const quality = opts.quality ?? 'normal';
  const fadeSeconds = opts.fadeSeconds ?? 1.2;
  const maxScale = opts.maxPaintScale ?? 1.5;
  const tolerance = opts.rescaleTolerance ?? 0.1;
  const margin = opts.margin ?? 60;
  const yieldTo = opts.yieldTo ?? macrotask;
  const now = opts.now ?? (() => performance.now());
  const invalidate = opts.invalidate ?? (() => {});

  let current: PaintResult | null = null;
  let previous: PaintResult | null = null;
  let fade = 1; // 0..1 progress of `current` fading in over `previous` (or paper)
  let job: Promise<void> | null = null;
  let jobId = 0;
  let water: WaterSurface | null = null;
  let reducedMotion = false;
  const daylight = opts.daylight ?? pinnedSource('midday');
  let sky: SkyLight | null = null;
  let light: DaylightState | null = null;
  let skyVersion = -1;
  let sinceSky = Infinity;
  const rims: RimCache = createRimCache();
  const stats: SceneStats = { paints: 0, rescales: 0, lastPaintMs: 0, lastCpuMs: 0, lastView: null, timings: [], painting: false };

  const startPaint = (view: PaintView): Promise<void> => {
    const id = ++jobId;
    stats.painting = true;
    const run = paintScene(art, view, { quality, yieldTo, now, cancelled: () => id !== jobId })
      .then((res) => {
        if (id !== jobId) return;
        previous = current;
        current = res;
        fade = 0;
        stats.paints++;
        stats.lastPaintMs = res.totalMs;
        stats.lastCpuMs = res.cpuMs;
        stats.lastView = res.view;
        stats.timings = res.timings;
        invalidate('background');
      })
      .catch((err: unknown) => {
        if (!(err instanceof PaintCancelled)) throw err;
      })
      .finally(() => {
        if (id === jobId) {
          stats.painting = false;
          job = null;
        }
      });
    job = run;
    return run;
  };

  const drawPainting = (ctx: CanvasRenderingContext2D, res: PaintResult, alpha: number) => {
    if (alpha <= 0) return;
    const { rect } = res.view;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(res.canvas as CanvasImageSource, rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
  };

  return {
    id: 'scene',
    async init(ctx: SystemContext) {
      reducedMotion = ctx.reducedMotion;
      water ??= createWaterSurface(ctx.scene, { seed: art.seed, still: ctx.reducedMotion });
      if (!sky) {
        sky = createSkyLight({ pond: art.scene.pond, seed: art.seed });
        light = daylight.at(ctx.clock.now());
        sky.update(light, true);
        skyVersion = daylight.version;
        sinceSky = 0;
      }
      if (current && canReuse(current.view, paintViewFor(ctx.viewport, maxScale, 0), tolerance)) {
        // close enough: keep the bitmap and let drawImage rescale it; drop any repaint that was
        // started for an intermediate size
        jobId++;
        job = null;
        stats.painting = false;
        stats.rescales++;
        return;
      }
      const p = startPaint(paintViewFor(ctx.viewport, maxScale, margin));
      // first paint: block init so ready() means painted; afterwards repaint in the background
      if (!current) await p;
    },
    update(f) {
      // the sky follows the daylight: checked every couple of seconds (at once after setTime)
      sinceSky += f.dt;
      if (sky && (daylight.version !== skyVersion || sinceSky >= SKY_CHECK_S || f.dt === 0)) {
        sinceSky = 0;
        light = daylight.at(f.now);
        const forced = daylight.version !== skyVersion;
        skyVersion = daylight.version;
        if (sky.update(light, forced)) invalidate('background');
      }
      if (fade >= 1) return;
      // a still frame (freeze / renderOnce) or reduced motion settles the fade at once
      fade = f.dt === 0 || reducedMotion ? 1 : Math.min(1, fade + f.dt / fadeSeconds);
      if (fade >= 1) previous = null;
      invalidate('background');
    },
    draw(layer: LayerId, ctx: CanvasRenderingContext2D, f) {
      if (layer === 'background') {
        if (previous) drawPainting(ctx, previous, 1);
        if (current) drawPainting(ctx, current, easeInOut(fade));
        if (current && sky) sky.drawSky(ctx);
      } else if (layer === 'waterSurface') {
        if (current && water) {
          ctx.globalAlpha = easeInOut(fade);
          sky?.drawWater(ctx);
          water.draw(ctx, f.t, light);
          ctx.globalAlpha = 1;
        }
      } else if (layer === 'lighting' && opts.showSlots) {
        drawSlotOverlay(ctx, art.scene);
      }
    },
    entities(): Drawable[] {
      const res = current;
      if (!res) return [];
      const alpha = previous ? 1 : easeInOut(fade);
      const rim = light ? rimLight(light) : null;
      return res.sprites.map((s) => ({
        depth: s.depth,
        draw(ctx) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
          // boulders catch the low sun on their lit side (tufts are too small to bother)
          if (rim && rim.strength > 0.02 && s.id.startsWith('rock')) drawRim(ctx, rims, s.canvas, s.box, rim, RIM_ROCK);
        },
      }));
    },
    dispose() {
      jobId++;
      current = null;
      previous = null;
    },
    whenPainted: () => job ?? Promise.resolve(),
    stats: () => ({ ...stats, timings: [...stats.timings] }),
    skyStats: () => sky?.stats() ?? null,
  };
}

/** How strongly the boulders take the rim light (they are matte stone). */
const RIM_ROCK = 0.7;

const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The renderer's `paper` layer: the washi texture (fibres, grain, faint deckle vignette)
 * multiplied over the whole frame (ADR 0021). Cached per backing-store size.
 */
export function createPaperSystem(seed = 1): System {
  let texture: AnyCanvas | null = null;
  let size = '';
  let dpr = 1;
  return {
    id: 'paper',
    init(ctx) {
      const vp = ctx.viewport;
      dpr = vp.dpr;
      const key = `${vp.pixelW}x${vp.pixelH}`;
      if (key !== size) {
        texture = paperTexture(vp.pixelW, vp.pixelH, seed, { grainScale: dpr });
        size = key;
      }
    },
    draw(layer, ctx) {
      if (layer !== 'paper' || !texture) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(texture as CanvasImageSource, 0, 0);
    },
  };
}
