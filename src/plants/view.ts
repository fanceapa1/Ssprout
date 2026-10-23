import { createRng } from '../core/rng';
import { createPainter, makeCanvas, mix, PIGMENTS } from '../paint';
import { crossFade, drawPlant, morphBetween, scratch } from './draw';
import { getSpecies } from './registry';
import { createSpriteCache, PRIORITY, stagePair, type Sprite, type SpriteCache, type SpriteSpec } from './sprites';
import type { SpeciesDef } from './types';
import { drawWateringFront, drawWetSoil, fitRigToCanvas, LIFT_SCALE, wateringTimeline, type WateringRig } from './watering';
import { drawWithering } from './wither';

/**
 * PlantView (ADRs 0003, 0094, 0118): one species at an arbitrary growth, optionally mid-watering
 * or wilting — shared by the floating widget, the planting sheet's previews and the studio. It
 * uses the plant system's pieces: the sprite cache (24 growth steps, cross-faded so growth is
 * continuous), the painted watering animation and the wither. The signature is stable.
 */

export interface PlantViewOptions {
  speciesId: string;
  seed: number;
  /** 0 = seed … 1 = full bloom */
  growth: number;
  /** watering animation progress 0..1, null = none */
  watering: number | null;
  /** 0..1, the seedling withering away (cancel) */
  wilt?: number;
  /**
   * How the plant is framed: `species` (default) fits the full-grown species, so a seedling is
   * small at the bottom (it grows into the frame); `growth` frames what has grown so far — a
   * seedling fills a small thumbnail, up to `MAX_GROWTH_ZOOM`× the species framing.
   */
  framing?: 'species' | 'growth';
}

/**
 * The most a `growth`-framed view enlarges a seedling over the species framing: enough for a
 * just-planted seed to read in a 64 px thumbnail (it was 4, which left a speck).
 */
export const MAX_GROWTH_ZOOM = 8;

/** Below this growth a `growth`-framed view lays the seed on a mound of soil, fading out by `SEED_BED_END`. */
export const SEED_BED_START = 0.06;
export const SEED_BED_END = 0.2;

/** How much of the seed bed shows at a growth (1 for a seed, 0 once it has its first leaves). Pure. */
export function seedBedAlpha(growth: number): number {
  const g = clamp01(growth);
  if (g <= SEED_BED_START) return 1;
  if (g >= SEED_BED_END) return 0;
  const t = (g - SEED_BED_START) / (SEED_BED_END - SEED_BED_START);
  return 1 - t * t * (3 - 2 * t);
}

export { GROWTH_STEPS, quantiseGrowth } from './sprites';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D;

let extraSpecies: ((id: string) => SpeciesDef | undefined) | null = null;

/**
 * Let the view resolve species the registry does not hold (the dev `?fixtures` set). main.ts
 * passes its `getSpecies`; the registry is always consulted first.
 */
export function setPlantViewSpecies(fn: ((id: string) => SpeciesDef | undefined) | null): void {
  extraSpecies = fn;
}

const resolve = (id: string): SpeciesDef | undefined => getSpecies(id) ?? extraSpecies?.(id);

/** Main-thread cache: the view must draw synchronously (a widget frame, a preview card). */
const VIEW_BUDGET = 24 * 1024 * 1024;
let viewCache: SpriteCache | null = null;
const cacheFor = (): SpriteCache => (viewCache ??= createSpriteCache({ getSpecies: resolve, createWorker: null, budgetBytes: VIEW_BUDGET }));

/**
 * Where the species sits in a W×H target: contained, base (anchor) at the bottom centre; `zoom`
 * enlarges it about its base (growth framing).
 */
export function plantLayout(def: Pick<SpeciesDef, 'size' | 'anchor'>, W: number, H: number, zoom = 1) {
  const scale = Math.min((W * 0.9) / def.size.w, (H * 0.94) / def.size.h) * zoom;
  const w = Math.max(1, Math.round(def.size.w * scale));
  const h = Math.max(1, Math.round(def.size.h * scale));
  const baseX = W / 2;
  const baseY = H * 0.97;
  return { w, h, x: baseX - def.anchor.x * w, y: baseY - def.anchor.y * h, baseX, baseY, scale };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * The sprites for a growth: the lower step is painted now if nothing nearer is cached (first
 * frame); the upper step is queued for idle time and faded in once it exists.
 */
function viewImages(cache: SpriteCache, base: Omit<SpriteSpec, 'step'>, growth: number): { a?: Sprite; b?: Sprite; weight: number } {
  const { lo, hi, weight } = stagePair(growth);
  let a = cache.get({ ...base, step: lo });
  if (!a) {
    for (let s = lo - 1; s >= Math.max(0, lo - 3) && !a; s--) a = cache.get({ ...base, step: s });
    if (a) cache.request({ ...base, step: lo }, PRIORITY.now);
    else a = cache.ensureSync({ ...base, step: lo });
  }
  let b: Sprite | undefined;
  if (weight > 0) {
    b = cache.get({ ...base, step: hi });
    if (!b) cache.request({ ...base, step: hi }, PRIORITY.now);
  }
  if (hi + 1 <= 24) cache.request({ ...base, step: Math.min(24, hi + 1) }, PRIORITY.next);
  return { a, b, weight: a && b ? weight : 0 };
}

const groundCache = new Map<number, AnyCanvas | null>();

/** A soft wash of earth and grass under the plant (200 × 48 units), cached per pixel width. */
function groundWash(px: number): AnyCanvas | null {
  const b = Math.max(24, Math.min(720, 2 ** (Math.round(Math.log2(Math.max(1, px)) * 3) / 3)));
  if (groundCache.has(b)) return groundCache.get(b)!;
  let out: AnyCanvas | null = null;
  try {
    const scale = b / 200;
    const c = makeCanvas(Math.ceil(200 * scale), Math.ceil(48 * scale));
    const p = createPainter(c, { seed: 'view-ground' });
    const rng = createRng('view-ground');
    p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    p.wash({ cx: 100, cy: 26, rx: 88, ry: 13 }, mix(PIGMENTS.sageLight, PIGMENTS.stoneWarm, 0.35), {
      rng,
      opacity: 0.42,
      edge: 0.3,
      sharpness: 0.3,
      centreLift: 0.3,
      deform: 0.45,
      granulation: 0.3,
      fade: { angle: -Math.PI / 2, start: 0.2, amount: 0.8, ragged: 0.6 },
    });
    p.wash({ cx: 96, cy: 28, rx: 42, ry: 6 }, mix(PIGMENTS.sap, PIGMENTS.stoneWarm, 0.4), { rng, opacity: 0.3, edge: 0.3, sharpness: 0.3, deform: 0.5 });
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    out = c;
  } catch {
    out = null;
  }
  groundCache.set(b, out);
  return out;
}

const bedCache = new Map<number, AnyCanvas | null>();
/** the seed bed's box (units) and the height of its crest, where the seed sits */
const BED_BOX = { w: 200, h: 84, crest: 30 };
/** how far (share of the frame) a seed is raised onto its bed */
const BED_RAISE = 0.2;

/**
 * A just-planted bed (200 × 84 units), cached per pixel width: a mound of turned soil with a
 * furrow on its crest, where the seed sits, so a seed reads as something planted, not an empty
 * frame. Drawn only where the species' own seed is too flat to read.
 */
function seedBed(px: number): AnyCanvas | null {
  const b = Math.max(24, Math.min(720, 2 ** (Math.round(Math.log2(Math.max(1, px)) * 3) / 3)));
  if (bedCache.has(b)) return bedCache.get(b)!;
  let out: AnyCanvas | null = null;
  try {
    const scale = b / BED_BOX.w;
    const c = makeCanvas(Math.ceil(BED_BOX.w * scale), Math.ceil(BED_BOX.h * scale));
    const p = createPainter(c, { seed: 'view-seed-bed' });
    const rng = createRng('view-seed-bed');
    const earth = mix(PIGMENTS.wood, PIGMENTS.stoneWarm, 0.4);
    p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // the mound, lit from above: a broad wash, a darker foot, a lighter crest, the furrow
    p.wash({ cx: 100, cy: 52, rx: 80, ry: 26 }, earth, { rng, opacity: 0.42, edge: 0.5, sharpness: 0.35, centreLift: 0.1, deform: 0.35, granulation: 0.6, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.7, ragged: 0.5 } });
    p.wash({ cx: 100, cy: 60, rx: 66, ry: 13 }, mix(earth, PIGMENTS.sumi, 0.3), { rng, opacity: 0.24, edge: 0.4, sharpness: 0.3, deform: 0.5, granulation: 0.5 });
    p.wash({ cx: 98, cy: 38, rx: 38, ry: 8 }, mix(earth, PIGMENTS.washi, 0.45), { rng, opacity: 0.3, edge: 0.2, sharpness: 0.25, deform: 0.5 });
    p.wash({ cx: 100, cy: BED_BOX.crest + 1, rx: 22, ry: 3.6 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.45), { rng, opacity: 0.42, edge: 0.5, sharpness: 0.45, deform: 0.35 });
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    out = c;
  } catch {
    out = null;
  }
  bedCache.set(b, out);
  return out;
}

/**
 * How much to enlarge a plant whose painted content (`bounds`, fractions of its box laid out at
 * zoom 1 in `L`) is small in the frame: so its height reaches ~70 % of the frame and its width
 * ~84 %, never past `MAX_GROWTH_ZOOM`, never below 1. Pure.
 */
export function growthZoom(bounds: { left: number; top: number; right: number } | null | undefined, anchorY: number, L: { w: number; h: number }, W: number, H: number): number {
  if (!bounds) return 1;
  const ch = Math.max(1e-6, (anchorY - bounds.top) * L.h);
  const cw = Math.max(1e-6, (bounds.right - bounds.left) * L.w);
  return Math.max(1, Math.min(MAX_GROWTH_ZOOM, (H * 0.7) / ch, (W * 0.84) / cw));
}

/**
 * Draw the plant into `canvas` (clears it first). Returns false when the species is unknown or
 * no 2D context is available (callers may draw a fallback).
 */
export function renderPlantView(canvas: AnyCanvas, opts: PlantViewOptions): boolean {
  const def = resolve(opts.speciesId);
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!def || !ctx) return false;
  const W = canvas.width;
  const H = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  let L: ReturnType<typeof plantLayout> = plantLayout(def, W, H);
  const seed = opts.seed >>> 0;
  const water = opts.watering === null || opts.watering === undefined ? null : clamp01(opts.watering);
  const wilt = clamp01(opts.wilt ?? 0);
  const cache = cacheFor();
  cache.beginFrame();
  let imgs = viewImages(cache, { speciesId: def.id, seed, w: L.w, h: L.h }, clamp01(opts.growth));
  if (opts.framing === 'growth') {
    // frame what has grown: the content bounds are fractions of the box, the same at any size
    const z = growthZoom((imgs.a ?? imgs.b)?.bounds, def.anchor.y, L, W, H);
    if (z > 1.05) {
      L = plantLayout(def, W, H, Math.round(z * 8) / 8);
      imgs = viewImages(cache, { speciesId: def.id, seed, w: L.w, h: L.h }, clamp01(opts.growth));
    }
  }
  const shown = imgs.a ?? imgs.b;
  const bounds = shown?.bounds;
  // a seed too flat to read in a growth-framed view (a dark dab) is raised onto a mound of soil
  // sized to the frame; seeds painted with their own mound, and water plants, keep theirs
  const bed = opts.framing === 'growth' && !(def.habitats ?? []).every((x) => x === 'water') && bounds && (def.anchor.y - bounds.top) * L.h < H * 0.1 ? seedBedAlpha(opts.growth) : 0;
  const groundY = L.baseY;
  if (bed > 0) {
    const raise = bed * H * BED_RAISE;
    L = { ...L, y: L.y - raise, baseY: L.baseY - raise };
  }
  const box = { x: L.x, y: L.y, w: L.w, h: L.h };
  const top = bounds ? L.y + bounds.top * L.h : L.baseY - L.h * Math.max(0.2, opts.growth) * 0.8;
  const half = bounds ? ((bounds.right - bounds.left) / 2) * L.w : L.w * 0.25;

  // a soft ground wash under the plant
  const gw = Math.min(W * 0.92, Math.max(half * 2.6, L.w * 0.55, W * 0.3));
  const ground = groundWash(gw);
  if (ground) ctx.drawImage(ground, L.baseX - gw / 2, groundY - (gw * 48) / 200 * 0.6, gw, (gw * 48) / 200);
  if (bed > 0) {
    const bw = Math.min(W * 0.66, H);
    const bh = (bw * BED_BOX.h) / BED_BOX.w;
    const img = seedBed(bw);
    if (img) {
      // its crest under the raised seed
      ctx.globalAlpha = bed;
      ctx.drawImage(img, L.baseX - bw / 2, L.baseY - bh * (BED_BOX.crest / BED_BOX.h), bw, bh);
      ctx.globalAlpha = 1;
    }
  }

  let rig: WateringRig | null = null;
  let lift = 0;
  if (water !== null) {
    const unit = Math.min(W, H);
    const visibleH = Math.max(unit * 0.1, L.baseY - top);
    const size = Math.max(unit * 0.15, Math.min(unit * 0.23, visibleH * 0.42));
    rig = fitRigToCanvas({ baseX: L.baseX, baseY: L.baseY, top, halfWidth: Math.max(half, unit * 0.04), size, side: 1 }, W, H);
    const ph = wateringTimeline(water);
    lift = ph.lift;
    drawWetSoil(ctx, rig, ph.wet * 0.6);
  }

  if (shown) {
    let image: CanvasImageSource = shown.image;
    if (imgs.a && imgs.b && imgs.weight > 0) {
      const buf = scratch('plant-view', L.w, L.h);
      if (buf) {
        crossFade(buf, imgs.a.image, imgs.b.image, imgs.weight, morphBetween(imgs.a.bounds, imgs.b.bounds, def.anchor));
        image = buf.canvas;
      }
    }
    if (wilt > 0) drawWithering(ctx, image, L.w, L.h, box, L.baseX, L.baseY, wilt, seed % 2 === 0 ? 1 : -1, image === shown.image);
    else drawPlant(ctx, image, box, L.baseX, L.baseY, { lean: 0, bend: 1, scaleY: 1 + LIFT_SCALE * lift, alpha: 1 });
  }

  if (rig && water !== null) drawWateringFront(ctx, rig, water, seed, { w: W, h: H });
  ctx.restore();
  return true;
}
