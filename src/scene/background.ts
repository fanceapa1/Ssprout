/**
 * The painted background as an ordered list of steps (back to front, the order a painter would
 * work in), plus a cooperative runner that paints a view of the world into a bitmap while
 * yielding to the browser between steps.
 */
import { createRng } from '../core/rng';
import { createPainter, makeCanvas, type AnyCanvas, type Painter, type Quality } from '../paint';
import type { Rect } from '../render/viewport';
import { gardenScene, type SceneGeometry } from './geometry';
import { FOREGROUND_TUFTS, SHRUBS, TREES, TUFTS, type ShrubSpec, type TreeSpec, type TuftSpec } from './layout';
import { paintBanks, paintHills, paintMargins, paintPath, paintSky, paintStones, paintTufts, reservePond } from './paint-land';
import { paintPavilion } from './paint-pavilion';
import { paintReflections, paintWater, paintWaterDetail } from './paint-pond';
import { paintShrub, paintTree } from './paint-trees';
import { paintRockSprite, paintTuftSprite, type Sprite } from './sprites';

/** Everything the scene paints: the shared geometry plus painting-only layout. */
export interface SceneArt {
  scene: SceneGeometry;
  trees: readonly TreeSpec[];
  shrubs: readonly ShrubSpec[];
  tufts: readonly TuftSpec[];
  foregroundTufts: readonly TuftSpec[];
  /** seed for every mark (same seed → same painting) */
  seed: number;
}

export const GARDEN_ART: SceneArt = {
  scene: gardenScene,
  trees: TREES,
  shrubs: SHRUBS,
  tufts: TUFTS,
  foregroundTufts: FOREGROUND_TUFTS,
  seed: 7,
};

export interface PaintStep {
  name: string;
  /** big, soft washes are painted at draft resolution: invisible difference, half the cost */
  soft?: boolean;
  run(p: Painter): void;
}

/** Element filter for studio views (paint only some parts). */
export type ElementId = 'sky' | 'hills' | 'banks' | 'path' | 'pond' | 'reflections' | 'trees' | 'shrubs' | 'pavilion' | 'tufts' | 'margins';

export function backgroundSteps(art: SceneArt, only?: readonly ElementId[]): PaintStep[] {
  const root = createRng(art.seed);
  const r = (label: string) => root.fork(label);
  const { scene } = art;
  const steps: (PaintStep & { el: ElementId })[] = [
    { el: 'sky', name: 'sky', soft: true, run: (p) => paintSky(p, r('sky')) },
    { el: 'hills', name: 'hills', soft: true, run: (p) => paintHills(p, r('hills')) },
    { el: 'banks', name: 'banks', soft: true, run: (p) => paintBanks(p, r('banks')) },
    ...art.trees
      .filter((t) => t.distance >= 0.4)
      .map((t) => ({ el: 'trees' as const, name: t.id, run: (p: Painter) => paintTree(p, r(t.id), t) })),
    { el: 'pond', name: 'pond-reserve', run: (p) => reservePond(p, r('reserve'), scene.pond) },
    { el: 'pond', name: 'water', run: (p) => paintWater(p, r('water'), scene.pond) },
    {
      el: 'reflections',
      name: 'reflections',
      run: (p) => paintReflections(p, r('reflections'), { scene, trees: art.trees, shrubs: art.shrubs.filter((s) => s.y < 500 && s.x > 900), seed: art.seed }),
    },
    { el: 'pond', name: 'water-detail', run: (p) => paintWaterDetail(p, r('water-detail'), scene.pond) },
    { el: 'path', name: 'path', run: (p) => paintPath(p, r('path'), scene.path) },
    ...art.shrubs.map((s, i) => ({ el: 'shrubs' as const, name: `shrub-${i}`, run: (p: Painter) => paintShrub(p, r(`shrub-${i}`), s) })),
    ...art.trees
      .filter((t) => t.distance < 0.4)
      .map((t) => ({ el: 'trees' as const, name: t.id, run: (p: Painter) => paintTree(p, r(t.id), t) })),
    { el: 'tufts', name: 'tufts', run: (p) => paintTufts(p, r('tufts'), art.tufts) },
    { el: 'margins', name: 'margins', soft: true, run: (p) => paintMargins(p, r('margins')) },
    { el: 'path', name: 'stones', run: (p) => paintStones(p, r('stones'), scene.path) },
    // after the margins: the engawa runs off the right edge of the sheet, crisp
    { el: 'pavilion', name: 'pavilion', run: (p) => paintPavilion(p, r('pavilion'), scene.pavilion) },
  ];
  return only ? steps.filter((s) => only.includes(s.el)) : steps;
}

/** What part of the world a bitmap shows, and at how many bitmap pixels per world unit. */
export interface PaintView {
  rect: Rect;
  scale: number;
}

export interface PaintResult {
  view: PaintView;
  canvas: AnyCanvas;
  sprites: Sprite[];
  /** milliseconds per step, for perf review */
  timings: { name: string; ms: number }[];
  /** wall time from start to finish (includes time yielded to the browser) */
  totalMs: number;
  /** time spent painting (sum of the steps) */
  cpuMs: number;
}


export interface PaintRunOptions {
  quality?: Quality;
  /** paint only these elements (studio); default all */
  only?: readonly ElementId[];
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
 * The paint job as a generator: it paints one step per `next()` and finally returns the
 * result. Drive it synchronously (`paintSceneSync`) or cooperatively (`paintScene`).
 * Deterministic for a given art + view + quality, however it is driven.
 */
export function* paintJob(art: SceneArt, view: PaintView, opts: PaintRunOptions = {}): Generator<string, PaintResult, void> {
  const now = opts.now ?? (() => performance.now());
  const quality = opts.quality ?? 'normal';
  const t0 = now();
  const timings: { name: string; ms: number }[] = [];
  const canvas = makeCanvas(view.rect.w * view.scale, view.rect.h * view.scale);
  const p = createPainter(canvas, { seed: art.seed, quality });
  const soft = quality === 'high' ? p : createPainter(canvas, { seed: art.seed, quality: 'draft' });
  for (const step of backgroundSteps(art, opts.only)) {
    const s = now();
    const painter = step.soft ? soft : p;
    applyView(painter, view);
    step.run(painter);
    timings.push({ name: step.name, ms: now() - s });
    yield step.name;
  }
  const sprites: Sprite[] = [];
  if (opts.sprites ?? true) {
    const s = now();
    for (const rock of art.scene.rocks) {
      sprites.push(paintRockSprite(rock, art.seed, view.scale, quality));
      yield rock.id;
    }
    for (const [i, t] of art.foregroundTufts.entries()) {
      sprites.push(paintTuftSprite(t, i, art.seed, view.scale, quality));
      yield `tuft-${i}`;
    }
    timings.push({ name: 'sprites', ms: now() - s });
  }
  return { view, canvas, sprites, timings, totalMs: now() - t0, cpuMs: timings.reduce((a, t) => a + t.ms, 0) };
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
