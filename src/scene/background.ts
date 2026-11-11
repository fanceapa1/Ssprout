/**
 * The painted background as an ordered list of steps (back to front, the order a painter would
 * work in), plus a cooperative runner that paints a view of the world into a bitmap while
 * yielding to the browser between steps.
 */
import { createPainter, makeCanvas, type AnyCanvas, type Painter, type Quality } from '../paint';
import type { Rect } from '../render/viewport';
import type { SceneryId } from '../scenery/ids';
import { GARDEN_PAINTERS } from '../scenery/japanese-garden/art';
import { loaded, type Painters } from '../scenery/painters';
import { gardenScene, type Rock, type SceneGeometry } from './geometry';
import { FOREGROUND_TUFTS, SHRUBS, TREES, TUFTS, type ShrubSpec, type TreeSpec, type TuftSpec } from './layout';
import type { Strokes } from './paint-land';
import { rockBox, tuftBox } from './sprite-boxes';
import type { Sprite } from './sprites';

/** Everything the scene paints: the shared geometry plus painting-only layout. */
export interface SceneArt {
  /** whose painting it is: the first part of every paint-cache key (ADR 0242) */
  scenery: SceneryId;
  scene: SceneGeometry;
  trees: readonly TreeSpec[];
  shrubs: readonly ShrubSpec[];
  tufts: readonly TuftSpec[];
  foregroundTufts: readonly TuftSpec[];
  /** seed for every mark (same seed → same painting) */
  seed: number;
  /** what paints it, loaded from the scenery's own chunk on the first paint (ADR 0341) */
  painters: Painters<ArtPainters>;
}

/** How a scenery paints its landscape (in its painter chunk, ADR 0341). */
export interface ArtPainters {
  /** the background's paint steps, back to front (`only`: just these elements, for the studio) */
  steps(art: SceneArt, only?: readonly string[]): PaintStep[];
  /** its boulder sprite for one of `scene.rocks`, in parts (each covers `rockBox(r)`) */
  rock?(r: Rock, seed: number, scale: number, quality: Quality): Generator<void, Sprite, undefined>;
  /** its foreground grass tuft sprite (covers `tuftBox(t)`) */
  tuft?(t: TuftSpec, index: number, seed: number, scale: number, quality: Quality): Sprite;
}

export interface PaintStep {
  name: string;
  /** big, soft washes are painted at draft resolution: invisible difference, half the cost */
  soft?: boolean;
  /**
   * Paint the step: at once (void), or as marks the job paints one after another, pausing between
   * them (ADR 0226), so no step holds the main thread for much longer than its biggest mark.
   */
  run(p: Painter): Strokes | void;
}

/** The Japanese garden's elements, a filter for studio views (paint only some parts). */
export type ElementId = 'sky' | 'hills' | 'banks' | 'path' | 'pond' | 'reflections' | 'trees' | 'shrubs' | 'pavilion' | 'tufts' | 'margins';

/** The painting's steps, back to front: the scenery's own (`art.steps`). */
export function backgroundSteps(art: SceneArt, only?: readonly string[]): PaintStep[] {
  return loaded(art.painters, art.scenery).steps(art, only);
}

/** The Japanese garden's painting. */
export const GARDEN_ART: SceneArt = {
  scenery: 'japanese-garden',
  scene: gardenScene,
  trees: TREES,
  shrubs: SHRUBS,
  tufts: TUFTS,
  foregroundTufts: FOREGROUND_TUFTS,
  seed: 7,
  painters: GARDEN_PAINTERS,
};

/** What part of the world a bitmap shows, and at how many bitmap pixels per world unit. */
export interface PaintView {
  rect: Rect;
  scale: number;
}

/** Time one step took: all its parts together, and its longest uninterrupted part. */
export interface StepTiming {
  name: string;
  /** milliseconds of painting, all parts */
  ms: number;
  /** the longest part painted without a pause (ADR 0226) */
  longestMs: number;
  /** how many parts the step was painted in (pauses + 1) */
  parts: number;
}

export interface PaintResult {
  view: PaintView;
  canvas: AnyCanvas;
  sprites: Sprite[];
  /** milliseconds per step, for perf review */
  timings: StepTiming[];
  /** the longest uninterrupted part of any step: what one slice of the cooperative painter can't split */
  longest: { name: string; ms: number };
  /** wall time from start to finish (includes time yielded to the browser) */
  totalMs: number;
  /** time spent painting (sum of the steps) */
  cpuMs: number;
}


export interface PaintRunOptions {
  quality?: Quality;
  /** paint only these elements (studio); default all */
  only?: readonly string[];
  /** also paint foreground sprites (default true) */
  sprites?: boolean;
  /** monotonic ms clock for timings (default performance.now) */
  now?: () => number;
}

/** Set a painter's transform so world units land on `view`. */
export function applyView(p: Painter, view: PaintView): void {
  p.ctx.setTransform(view.scale, 0, 0, view.scale, -view.rect.x * view.scale, -view.rect.y * view.scale);
}

/**
 * The paint job as a generator: it paints one part of a step per `next()` (a whole step, or one
 * mark or batch of marks of a step that pauses, ADR 0226) and yields the step's name; finally it
 * returns the result. Drive it synchronously (`paintSceneSync`) or cooperatively (`paintScene`).
 * Deterministic for a given art + view + quality, however it is driven.
 */
export function* paintJob(art: SceneArt, view: PaintView, opts: PaintRunOptions = {}): Generator<string, PaintResult, void> {
  const now = opts.now ?? (() => performance.now());
  const quality = opts.quality ?? 'normal';
  const t0 = now();
  const timings: StepTiming[] = [];
  const longest = { name: '', ms: 0 };
  const part = (t: StepTiming, ms: number) => {
    t.ms += ms;
    t.parts++;
    if (ms > t.longestMs) t.longestMs = ms;
    if (ms > longest.ms) {
      longest.name = t.name;
      longest.ms = ms;
    }
  };
  const painters = loaded(art.painters, art.scenery);
  const canvas = makeCanvas(view.rect.w * view.scale, view.rect.h * view.scale);
  const p = createPainter(canvas, { seed: art.seed, quality });
  const soft = quality === 'high' ? p : createPainter(canvas, { seed: art.seed, quality: 'draft' });
  for (const step of backgroundSteps(art, opts.only)) {
    const t: StepTiming = { name: step.name, ms: 0, longestMs: 0, parts: 0 };
    let s = now();
    const painter = step.soft ? soft : p;
    applyView(painter, view);
    const marks = step.run(painter);
    // nothing else paints on this canvas between the parts, so its transform stays put
    while (marks && !marks.next().done) {
      part(t, now() - s);
      yield step.name;
      s = now();
    }
    part(t, now() - s);
    timings.push(t);
    yield step.name;
  }
  const sprites: Sprite[] = [];
  if (opts.sprites ?? true) {
    const t: StepTiming = { name: 'sprites', ms: 0, longestMs: 0, parts: 0 };
    for (const rock of art.scene.rocks) {
      let s = now();
      if (!painters.rock) throw new Error(`${art.scenery}: rocks without a rock painter`);
      const marks = painters.rock(rock, art.seed, view.scale, quality);
      for (let r = marks.next(); ; r = marks.next()) {
        part(t, now() - s);
        if (r.done) {
          sprites.push(r.value);
          break;
        }
        yield rock.id;
        s = now();
      }
      yield rock.id;
    }
    for (const [i, tuft] of art.foregroundTufts.entries()) {
      const s = now();
      if (!painters.tuft) throw new Error(`${art.scenery}: tufts without a tuft painter`);
      sprites.push(painters.tuft(tuft, i, art.seed, view.scale, quality));
      part(t, now() - s);
      yield `tuft-${i}`;
    }
    timings.push(t);
  }
  return { view, canvas, sprites, timings, longest, totalMs: now() - t0, cpuMs: timings.reduce((a, t) => a + t.ms, 0) };
}

export function paintSceneSync(art: SceneArt, view: PaintView, opts: PaintRunOptions = {}): PaintResult {
  const job = paintJob(art, view, opts);
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
}

export class PaintCancelled extends Error {
  constructor() {
    super('paint job cancelled');
  }
}

export interface CooperativeOptions extends PaintRunOptions {
  /** awaited between slices so the browser can render frames and handle input */
  yieldTo: () => Promise<void>;
  /** keep painting without yielding until this many ms have passed (default 20) */
  sliceMs?: number;
  /** abort (rejects with PaintCancelled), e.g. when a newer job supersedes this one */
  cancelled?: () => boolean;
}

/** Paint cooperatively on the main thread, yielding between steps. */
export async function paintScene(art: SceneArt, view: PaintView, opts: CooperativeOptions): Promise<PaintResult> {
  const now = opts.now ?? (() => performance.now());
  const slice = opts.sliceMs ?? 20;
  // the scenery's painter chunk, the first time it paints (ADR 0341)
  if (!art.painters.get()) await art.painters.load();
  const job = paintJob(art, view, opts);
  let sliceStart = now();
  for (;;) {
    if (opts.cancelled?.()) throw new PaintCancelled();
    const r = job.next();
    if (r.done) return r.value;
    if (now() - sliceStart > slice) {
      await opts.yieldTo();
      sliceStart = now();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The persistent paint cache (ADR 0228): keys and the sprite atlas

/** Kinds the scene stores in the paint cache (`paintCache()`, ADR 0227). */
export const SCENE_CACHE = {
  /** the overview painting (the cut sides of a strip already faded to paper) */
  overview: 'scene',
  /** the camera's detail painting of its resting view (ADR 0163), never faded */
  detail: 'scene-detail',
  /** the foreground boulders and tufts of one paint scale, packed into one atlas */
  sprites: 'scene-sprites',
} as const;

/** A number exactly as JavaScript prints it: `String` round-trips every double. */
const exact = (n: number): string => String(n);

/**
 * The cache key of a painting: everything its pixels depend on besides the code and the browser
 * (both are in the cache's version, ADR 0227): the scenery (ADR 0242), the seed, the quality, the world rect, the scale
 * (which already holds the device pixel ratio and the zoom) and the bitmap's size. The art's
 * layout (trees, shrubs, tufts) is code, so only its seed is in the key. The daylight is not: the
 * sky plate, the light plate and the paper are laid over the painting each time it is drawn.
 */
export function paintingKey(art: SceneArt, view: PaintView, quality: Quality): string {
  const { rect, scale } = view;
  const w = Math.max(1, Math.ceil(rect.w * scale));
  const h = Math.max(1, Math.ceil(rect.h * scale));
  return `${art.scenery}|s${art.seed}|${quality}|${exact(rect.x)},${exact(rect.y)},${exact(rect.w)},${exact(rect.h)}@${exact(scale)}|${w}x${h}`;
}

/** The cache key of the sprites of one paint scale: they do not depend on the painted rect. */
export function spritesKey(art: SceneArt, scale: number, quality: Quality): string {
  return `${art.scenery}|s${art.seed}|${quality}@${exact(scale)}`;
}

/** Where a sprite sits in the atlas: stacked top to bottom in paint order, left-aligned. */
export interface AtlasSlot {
  id: string;
  box: Rect;
  depth: number;
  /** the sprite's pixel rect in the atlas: (0, y, w, h) */
  y: number;
  w: number;
  h: number;
}

export interface AtlasLayout {
  width: number;
  height: number;
  slots: AtlasSlot[];
}

/**
 * The atlas the sprites of one paint scale are stored in. It follows from the geometry alone
 * (the art's rock boxes, `tuftBox` and the canvas size `makeCanvas` gives), so a stored atlas is cut up
 * again without painting anything.
 */
export function spriteAtlasLayout(art: SceneArt, scale: number): AtlasLayout {
  const specs = [
    ...art.scene.rocks.map((r) => ({ id: r.id, box: rockBox(r), depth: r.y })),
    ...art.foregroundTufts.map((t, i) => ({ id: `tuft-${i}`, box: tuftBox(t), depth: t.y })),
  ];
  let y = 0;
  let width = 1;
  const slots = specs.map((s) => {
    const w = Math.max(1, Math.ceil(s.box.w * scale));
    const h = Math.max(1, Math.ceil(s.box.h * scale));
    const slot: AtlasSlot = { ...s, y, w, h };
    y += h;
    width = Math.max(width, w);
    return slot;
  });
  return { width, height: Math.max(1, y), slots };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The sprites packed into one canvas, or null when they do not match the layout. */
export function packSprites(sprites: readonly Sprite[], layout: AtlasLayout): AnyCanvas | null {
  const { slots } = layout;
  if (sprites.length !== slots.length) return null;
  if (sprites.some((s, i) => s.id !== slots[i]!.id || s.canvas.width !== slots[i]!.w || s.canvas.height !== slots[i]!.h)) return null;
  const atlas = makeCanvas(layout.width, layout.height);
  const ctx = atlas.getContext('2d') as Ctx | null;
  if (!ctx) return null;
  // source-over onto transparent pixels copies them exactly (`copy` would clear the others)
  for (const [i, s] of sprites.entries()) ctx.drawImage(s.canvas as CanvasImageSource, 0, slots[i]!.y);
  return atlas;
}

type Image = CanvasImageSource & { width: number; height: number };

/** A pixel-for-pixel canvas copy of part of an image (`copy`, no smoothing). Throws without a 2D context. */
function cut(image: Image, y: number, w: number, h: number): AnyCanvas {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.globalCompositeOperation = 'copy';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, y, w, h, 0, 0, w, h);
  return canvas;
}

/**
 * A stored painting as a canvas, pixel for pixel. Drawn scaled, the decoded bitmap itself
 * (not premultiplied, ADR 0227) filters differently from the canvas it was painted on; its canvas
 * copy draws exactly like the fresh painting (ADR 0228).
 */
export function canvasOf(image: Image): AnyCanvas {
  return cut(image, 0, image.width, image.height);
}

/** The sprites cut out of a stored atlas, pixel for pixel, or null when its size is not the layout's. */
export function unpackSprites(atlas: Image, layout: AtlasLayout): Sprite[] | null {
  if (atlas.width !== layout.width || atlas.height !== layout.height) return null;
  return layout.slots.map((s) => ({ id: s.id, box: s.box, depth: s.depth, canvas: cut(atlas, s.y, s.w, s.h) }));
}
