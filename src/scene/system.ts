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
import { GARDEN_ART, PaintCancelled, paintScene, type PaintResult, type PaintView, type SceneArt, type StepTiming } from './background';
import { drawSlotOverlay } from './overlay';
import { createWaterSurface, type WaterSurface } from './water';
import { pinnedSource, type DaylightSource } from '../ambience/daylight-source';
import { nextPhase, whenIdle, type DaylightState } from '../ambience/daylight';
import { covers, createSkyLight, intersect, type SkyLight } from './sky-light';
import type { CameraView } from '../render/camera';
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
  /** cap on bitmap pixels per world unit (default 1.5); above it the painting is upscaled */
  maxPaintScale?: number;
  /**
   * cap for the detail painting of a zoomed-in view (default 2.8): once the camera rests closer
   * than the overview painting resolves, the visible part is painted again at the view's scale
   * and cross-fades in (ADR 0163)
   */
  maxDetailScale?: number;
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
  /**
   * ms after the first paint before a painting that covers only part of the world (a phone's
   * strip) is extended to the whole world in idle time (default 1500; negative: only on demand)
   */
  extendDelayMs?: number;
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
  timings: StepTiming[];
  /** the longest part of the last paint painted without a pause (ADR 0226) */
  longest: { name: string; ms: number };
  painting: boolean;
}

export interface SceneSystem extends System {
  /** resolves when no paint job is pending (the current painting matches the viewport) */
  whenPainted(): Promise<void>;
  stats(): SceneStats;
  /** sky plates painted, composites built, ms spent painting skies */
  skyStats(): ReturnType<SkyLight['stats']> | null;
  /** the detail painting for the camera's resting view: its view, whether it is painting, how far it has faded in */
  detailStats(): {
    view: PaintView | null;
    painting: boolean;
    fade: number;
    paints: number;
    lastPaintMs: number;
    /** the longest part of the last detail paint painted without a pause (ADR 0226) */
    longest: { name: string; ms: number };
    extending: boolean;
    world: boolean;
  };
}

const WORLD: Rect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

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
  const maxDetail = opts.maxDetailScale ?? 2.8;
  const tolerance = opts.rescaleTolerance ?? 0.1;
  const margin = opts.margin ?? 60;
  const yieldTo = opts.yieldTo ?? macrotask;
  const now = opts.now ?? (() => performance.now());
  const invalidate = opts.invalidate ?? (() => {});
  const extendDelayMs = opts.extendDelayMs ?? 1500;

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
  let preparing = false;
  let extending = false;
  const rims: RimCache = createRimCache();
  // the camera's detail painting (ADR 0163)
  let camera: CameraView | null = null;
  let seenDetail = -1;
  let detailWanted: PaintView | null = null;
  let detail: PaintResult | null = null;
  let detailFade = 1;
  let detailJobId = 0;
  let detailJob: Promise<void> | null = null;
  const detailCounts = { paints: 0, lastPaintMs: 0, longest: { name: '', ms: 0 } };
  const stats: SceneStats = { paints: 0, rescales: 0, lastPaintMs: 0, lastCpuMs: 0, lastView: null, timings: [], longest: { name: '', ms: 0 }, painting: false };

  /**
   * `extend`: the same painting over the whole world, behind the scenes — swapped in at once (a
   * cross-fade would pulse) and not counted as a repaint.
   */
  const startPaint = (view: PaintView, extend = false): Promise<void> => {
    const id = ++jobId;
    if (!extend) stats.painting = true;
    extending = extend;
    const swap = extend;
    const run = paintScene(art, view, { quality, yieldTo, now, cancelled: () => id !== jobId })
      .then((res) => {
        if (id !== jobId) return;
        softenCutEdges(res);
        previous = swap ? null : current;
        current = res;
        fade = swap ? 1 : 0;
        if (!extend) stats.paints++;
        stats.lastPaintMs = res.totalMs;
        stats.lastCpuMs = res.cpuMs;
        stats.lastView = res.view;
        stats.timings = res.timings;
        stats.longest = res.longest;
        invalidate('background');
      })
      .catch((err: unknown) => {
        if (!(err instanceof PaintCancelled)) throw err;
      })
      .finally(() => {
        if (id === jobId) {
          stats.painting = false;
          extending = false;
          job = null;
        }
      });
    job = run;
    return run;
  };

  /**
   * A painting of a strip of the world (a phone's overview) is extended to the whole world soon
   * after it lands, in idle time, so the first glide toward the sides the overview crops finds
   * them painted (ADR 0189). (A view that leaves the strip before that starts it at once.)
   */
  let extendTimer: ReturnType<typeof setTimeout> | null = null;
  const extendSoon = () => {
    if (!camera || extendDelayMs < 0 || extendTimer !== null) return;
    extendTimer = setTimeout(() => {
      extendTimer = null;
      whenIdle(() => {
        if (camera && current && !job && !contains(current.view.rect, WORLD)) startPaint({ rect: { ...WORLD }, scale: current.view.scale }, true);
      });
    }, extendDelayMs);
  };

  /** the detail view wanted for the camera's resting view, or null when the overview painting resolves it */
  const detailFor = (cam: CameraView): PaintView | null => {
    if (cam.isOverview() && cam.detailView() === cam.view()) return null;
    const v = cam.detailView();
    const want = paintViewFor(v, maxDetail, 40);
    if (!current || want.scale <= current.view.scale * 1.15) return null;
    return want;
  };

  const startDetail = (view: PaintView): void => {
    const id = ++detailJobId;
    const t0 = now();
    detailJob = paintScene(art, view, { quality, yieldTo, now, cancelled: () => id !== detailJobId })
      .then((res) => {
        if (id !== detailJobId) return;
        detail = res;
        detailFade = 0;
        detailCounts.paints++;
        detailCounts.lastPaintMs = now() - t0;
        detailCounts.longest = res.longest;
        invalidate('background');
      })
      .catch((err: unknown) => {
        if (!(err instanceof PaintCancelled)) throw err;
      })
      .finally(() => {
        if (id === detailJobId) detailJob = null;
      });
  };

  /** follow the camera's resting view: paint its detail once the camera stops moving */
  const followCamera = (): void => {
    const cam = camera;
    if (!cam || !current) return;
    if (cam.detailVersion === seenDetail || cam.moving()) return;
    seenDetail = cam.detailVersion;
    const want = detailFor(cam);
    detailWanted = want;
    if (!want) {
      // back at the overview: drop the detail (and its memory)
      detailJobId++;
      detailJob = null;
      if (detail) {
        detail = null;
        invalidate('background');
      }
      return;
    }
    if (detail && canReuse(detail.view, { ...want, rect: intersect(want.rect, WORLD) ?? want.rect }, tolerance)) return;
    startDetail(want);
  };

  /** whether this draw (its world → screen view) is for a zoomed view the detail painting covers */
  const detailCovers = (view: Viewport | undefined): boolean => {
    if (!detail || !view || !current) return false;
    if (view.pixelScale <= current.view.scale * 1.15) return false;
    const inWorld = intersect(view.visible, WORLD);
    return !!inWorld && covers(detail.view.rect, inWorld);
  };

  const drawPainting = (ctx: CanvasRenderingContext2D, res: PaintResult, alpha: number, op: GlobalCompositeOperation = 'source-over') => {
    if (alpha <= 0) return;
    const { rect } = res.view;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = op;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(res.canvas as CanvasImageSource, rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  /**
   * `(1 − e)·a + e·b` per pixel: the paintings are translucent (paper shows through them), so a
   * plain fade of one over the other would let the paper through mid-way (a pale pulse). The
   * background layer starts empty, so the second image is added with `lighter` (ADR 0185).
   */
  const crossFade = (ctx: CanvasRenderingContext2D, a: PaintResult | null, b: PaintResult, e: number) => {
    if (e >= 1 || !a) return drawPainting(ctx, b, a ? 1 : e);
    drawPainting(ctx, a, 1 - e);
    drawPainting(ctx, b, e, 'lighter');
  };

  return {
    id: 'scene',
    async init(ctx: SystemContext) {
      reducedMotion = ctx.reducedMotion;
      camera = ctx.camera ?? null;
      seenDetail = -1;
      water ??= createWaterSurface(ctx.scene, { seed: art.seed, still: ctx.reducedMotion });
      if (!sky) {
        sky = createSkyLight({ pond: art.scene.pond, seed: art.seed });
        light = daylight.at(ctx.clock.now());
        sky.update(light, true);
        skyVersion = daylight.version;
        sinceSky = 0;
      }
      if (current && canReuse(current.view, paintViewFor(ctx.viewport, maxScale, CUT_FADE), tolerance)) {
        // close enough: keep the bitmap and let drawImage rescale it (never showing the faded cut
        // of a strip painting); drop any repaint that was started for an intermediate size
        jobId++;
        job = null;
        stats.painting = false;
        stats.rescales++;
        return;
      }
      const first = !current;
      const view = paintViewFor(ctx.viewport, maxScale, margin);
      const p = startPaint(view);
      // first paint: block init so ready() means painted; afterwards repaint in the background
      if (first) {
        await p;
        extendSoon();
      }
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
        // paint the coming phase's sky while the browser is idle, before its blend begins
        const next = nextPhase(light.phase);
        if (!sky.has(next) && !preparing) {
          preparing = true;
          const s = sky;
          whenIdle(() => {
            s.prepare([next]);
            preparing = false;
          });
        }
      }
      followCamera();
      // a closer look may go beyond the overview's crop (a phone's sides): the first time a view
      // (or a glide's destination) leaves the painted area, paint the whole world at the same
      // scale behind the scenes
      if (camera && current && !job && !camera.isOverview() && !contains(current.view.rect, WORLD)) {
        const painted = current.view.rect;
        const beyond = (v: Viewport) => {
          const r = intersect(v.visible, WORLD);
          return !!r && !contains(painted, r);
        };
        if (beyond(camera.view()) || beyond(camera.detailView())) startPaint({ rect: { ...WORLD }, scale: current.view.scale }, true);
      }
      if (sky && camera) {
        const v = camera.detailView();
        sky.setDetail(camera.isOverview() && !camera.moving() ? null : v.visible, v.pixelScale);
      }
      if (detailFade < 1) {
        detailFade = f.dt === 0 || reducedMotion ? 1 : Math.min(1, detailFade + f.dt / fadeSeconds);
        invalidate('background');
      }
      if (fade >= 1) return;
      // a still frame (freeze / renderOnce) or reduced motion settles the fade at once
      fade = f.dt === 0 || reducedMotion ? 1 : Math.min(1, fade + f.dt / fadeSeconds);
      if (fade >= 1) previous = null;
      invalidate('background');
    },
    draw(layer: LayerId, ctx: CanvasRenderingContext2D, f) {
      if (layer === 'background') {
        if (detailCovers(f.view) && detail) {
          // the detail painting cross-fades in over the overview painting
          crossFade(ctx, current, detail, easeInOut(detailFade));
        } else if (current) {
          crossFade(ctx, previous, current, easeInOut(fade));
        }
        if (current && sky) sky.drawSky(ctx, f.view?.visible);
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
    entities(f): Drawable[] {
      // zoomed in with a detail painting: its sharper boulders and tufts
      const res = detail && f && f.view && current && f.view.pixelScale > current.view.scale * 1.15 ? detail : current;
      if (!res) return [];
      const alpha = res === detail ? 1 : previous ? 1 : easeInOut(fade);
      const rim = light ? rimLight(light) : null;
      // a detail painting's boulders are sharper bitmaps: their rim keeps its width on the stone
      const rimK = res.view.scale / RIM_REF_SCALE;
      return res.sprites.map((s) => ({
        depth: s.depth,
        draw(ctx) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(s.canvas as CanvasImageSource, s.box.x, s.box.y, s.box.w, s.box.h);
          // boulders catch the low sun on their lit side (tufts are too small to bother)
          if (rim && rim.strength > 0.02 && s.id.startsWith('rock')) drawRim(ctx, rims, s.canvas, s.box, rim, RIM_ROCK, rimK);
        },
      }));
    },
    dispose() {
      if (extendTimer !== null) clearTimeout(extendTimer);
      extendTimer = null;
      jobId++;
      detailJobId++;
      current = null;
      previous = null;
      detail = null;
    },
    whenPainted: async () => {
      // a camera that just came to rest starts its detail painting on the next frame: let it
      await (job ?? Promise.resolve());
      if (camera && camera.detailVersion !== seenDetail && !camera.moving()) followCamera();
      await (detailJob ?? Promise.resolve());
    },
    detailStats: () => ({
      view: detail?.view ?? detailWanted,
      painting: detailJob !== null,
      fade: detailFade,
      paints: detailCounts.paints,
      lastPaintMs: detailCounts.lastPaintMs,
      longest: { ...detailCounts.longest },
      extending,
      world: !!current && contains(current.view.rect, WORLD),
    }),
    stats: () => ({ ...stats, timings: stats.timings.map((t) => ({ ...t })), longest: { ...stats.longest } }),
    skyStats: () => sky?.stats() ?? null,
  };
}

/** World units over which a painting's cut side fades to paper (beyond what the overview shows). */
export const CUT_FADE = 36;

/**
 * A painting of only part of the world ends in a hard cut where the strip stops. The overview
 * never shows it (the strip has a margin), but a glide toward the sides before the whole world is
 * painted would: fade the cut sides into paper, like the edge of a painting, instead.
 */
function softenCutEdges(res: PaintResult): void {
  const { rect, scale } = res.view;
  const left = rect.x > 0.5;
  const right = rect.x + rect.w < WORLD_W - 0.5;
  if (!left && !right) return;
  const ctx = res.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return;
  const w = res.canvas.width;
  const h = res.canvas.height;
  const f = Math.min(w / 3, CUT_FADE * scale);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  for (const [on, x0, x1] of [[left, 0, f], [right, w, w - f]] as const) {
    if (!on) continue;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1), 0, f, h);
  }
  ctx.restore();
}

/** How strongly the boulders take the rim light (they are matte stone). */
const RIM_ROCK = 0.7;
/** Paint scale the boulders' rim width was tuned at (the overview's cap). */
const RIM_REF_SCALE = 1.5;

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
