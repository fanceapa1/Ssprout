import type { Action, ActiveSession, GardenState, PlantInstance } from '../core/state';
import { sessionPhase, sessionTimeline } from '../core/session';
import type { Drawable, FrameInfo, LayerId, System, SystemContext } from '../render/types';
import type { Rect } from '../render/viewport';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { plantWorldBounds, type WorldRect } from './bounds';
import { crossFade, drawPlant, morphBetween, scratch, type PlantPose } from './draw';
import { DAB_BOX, dabAlpha, GHOST_ALPHA, highlightDab, NO_PLACEMENT, type PlacementSnapshot, type PlacementSource } from './highlight';
import { drawReflection, reflectionImage, shoreAxis } from './reflection';
import {
  createSpriteCache,
  FINAL_STEP,
  PRIORITY,
  resolutionBucket,
  spritePixelSize,
  stagePair,
  type Sprite,
  type SpriteCache,
  type SpriteSpec,
} from './sprites';
import type { SizeClass, SpeciesDef } from './types';
import {
  drawWateringFront,
  drawWetSoil,
  ease,
  gardenWetness,
  LIFT_SCALE,
  prewarmWatering,
  WATERING_SECONDS,
  WET_LINGER_SECONDS,
  wateringTimeline,
  type WateringRig,
} from './watering';
import { gardenWind, windBoost, type WindFn } from './wind-adapter';
import { drawWithering, WITHER_SECONDS } from './wither';

/**
 * PlantSystem (docs/systems/plants.md, ADRs 0110–0119): every finished plant and the session's
 * growing plant as depth-sorted `entities` drawables (depth = slot y), their reflections on the
 * `waterSurface` layer, the watering can on the `air` layer and the placement highlight under
 * the plants. Sprites come from the sprite cache (sprites.ts); nothing is painted in a frame.
 */

export interface PlantSystemOptions {
  getSpecies(id: string): SpeciesDef | undefined;
  /** injectable for tests; default: a worker-backed cache over `getSpecies` */
  cache?: SpriteCache;
  /** default: the garden wind (ambience, or the local fallback) */
  wind?: WindFn;
  budgetBytes?: number;
  /** upper bound for init waiting on the first sprites (ms, default 8000) */
  initWaitMs?: number;
}

/** Sway amplitude (lean at the top, fraction of height) and bend by size class. */
export const SWAY: Readonly<Record<SizeClass, { amp: number; bend: number }>> = {
  small: { amp: 0.06, bend: 1 },
  medium: { amp: 0.045, bend: 1.25 },
  large: { amp: 0.03, bend: 1.6 },
  tree: { amp: 0.016, bend: 2.4 },
};

export const DISPLACE_OUT_SECONDS = 1.6;
export const DISPLACE_IN_SECONDS = 2.4;
export const APPEAR_SECONDS = 0.9;
export const BLOOM_SECONDS = 2.6;
/** time constant of the displayed growth catching up with the session's growth */
export const GROWTH_EASE_SECONDS = 0.6;

interface Fade {
  from: number;
  to: number;
  start: number;
  dur: number;
}
const fadeValue = (f: Fade, t: number) => f.from + (f.to - f.from) * ease(0, 1, (t - f.start) / f.dur);
const fadeDone = (f: Fade, t: number) => t >= f.start + f.dur;

interface Inst {
  key: string;
  speciesId: string;
  seed: number;
  def: SpeciesDef;
  slot: Slot;
  box: WorldRect;
  /** mirror line in the pond, or null */
  axis: number | null;
  phase: number;
  side: 1 | -1;
}

interface FinishedRec {
  plant: PlantInstance;
  inst: Inst;
  presence: Fade;
  /** fade-in once its sprite exists (plants added while running); null = already shown */
  appear: Fade | null | 'waiting';
  bloom: { from: number; start: number } | null;
}

interface GrowRec {
  id: string;
  inst: Inst;
  shown: number;
}

interface WitherRec {
  inst: Inst;
  image: CanvasImageSource;
  w: number;
  h: number;
  start: number;
}

export interface PlantDebugState {
  ready: boolean;
  resolution: number;
  finished: Array<{ id: string; slotId: string; speciesId: string; alpha: number; drawn: boolean; blooming: boolean }>;
  growing: { id: string; slotId: string; speciesId: string; growth: number; shown: number; lo: number; hi: number; weight: number; drawn: boolean } | null;
  withering: Array<{ slotId: string; progress: number }>;
  watering: { progress: number; wet: number; active: boolean } | null;
  displaced: { id: string; alpha: number } | null;
  reflections: string[];
  highlight: { active: boolean; slots: number; ghost: string | null };
  cache: ReturnType<SpriteCache['stats']>;
}

export interface PlantPerf {
  frames: number;
  avgMs: number;
  maxMs: number;
}

export interface PlantSystem extends System {
  readonly cache: SpriteCache;
  /** draw the in-canvas placement highlight from the UI's observable */
  connectPlacement(source: PlacementSource): () => void;
  /** world rect of a finished (or the growing) plant's sprite box */
  plantBounds(plantId: string): Rect | null;
  /** world rect a species would occupy in a slot */
  boundsFor(speciesId: string, slotId: string): Rect | null;
  /** a world rect in canvas device pixels (current viewport) */
  toDevice(rect: Rect): Rect | null;
  /** resolves when no sprite is queued or being painted */
  whenIdle(): Promise<void>;
  /** tests/screenshots: snap growth and fades to their targets, paint what is needed, resolve when done */
  settle(): Promise<void>;
  /** request every sprite the current garden needs (without snapping animations); resolve once painted */
  ready(): Promise<void>;
  debugState(): PlantDebugState;
  perf(): PlantPerf;
  resetPerf(): void;
}

const isWet = (h: string) => h === 'shore' || h === 'water';

export function createPlantSystem(opts: PlantSystemOptions): PlantSystem {
  const getSpecies = opts.getSpecies;
  const cache = opts.cache ?? createSpriteCache({ getSpecies, budgetBytes: opts.budgetBytes });
  const wind = opts.wind ?? gardenWind;
  const initWait = opts.initWaitMs ?? 8000;

  let sys: SystemContext | null = null;
  let scene: SceneGeometry | null = null;
  let slotById = new Map<string, Slot>();
  let res = 1;
  let reduced = false;
  let ready = false;
  let booted = false;
  const unsubs: Array<() => void> = [];

  const finished = new Map<string, FinishedRec>();
  let growing: GrowRec | null = null;
  const withering: WitherRec[] = [];
  let watering: { start: number | null } | null = null;
  let waterPending = false;
  let completing: { id: string; from: number } | null = null;
  let lastPlants: readonly PlantInstance[] | null = null;
  let lastSession: ActiveSession | null | undefined;
  let lastT = 0;
  let boost = 0;
  let highlight: PlacementSnapshot = NO_PLACEMENT;
  let unsubPlacement: (() => void) | null = null;
  const drawnThisFrame = new Set<string>();

  // perf
  let perfAcc = 0;
  let perfFrames = 0;
  let perfMax = 0;
  let perfFrame = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const timed = <T>(fn: () => T): T => {
    const t0 = now();
    try {
      return fn();
    } finally {
      perfFrame += now() - t0;
    }
  };

  function makeInst(def: SpeciesDef, slot: Slot, seed: number, key: string): Inst {
    const box = plantWorldBounds(def, slot);
    const reflect = isWet(slot.habitat) || def.reflect === true;
    const axis = reflect && scene ? shoreAxis(scene.pond, slot.x, slot.y, box.w * 0.3) : null;
    const h = (seed >>> 0) % 997;
    return { key, speciesId: def.id, seed: seed >>> 0, def, slot, box, axis, phase: (h / 997) * Math.PI * 2, side: h % 2 === 0 ? 1 : -1 };
  }

  const specFor = (inst: Inst, step: number): SpriteSpec => {
    const px = spritePixelSize(inst.def.size, inst.slot.scale, res);
    return { speciesId: inst.speciesId, seed: inst.seed, step, w: px.w, h: px.h };
  };

  /** The sprite for this step at the current resolution, else the nearest resolution (and ask). */
  function imageFor(inst: Inst, step: number, priority: number): Sprite | undefined {
    const spec = specFor(inst, step);
    const exact = cache.get(spec);
    if (exact) return exact;
    const any = cache.best(inst.speciesId, inst.seed, step, spec.w);
    cache.request(spec, any ? Math.max(priority, PRIORITY.rescale) : priority);
    return any;
  }

  interface GrowthImages {
    a?: Sprite;
    b?: Sprite;
    weight: number;
    lo: number;
    hi: number;
  }

  function growthImages(inst: Inst, g: number, priority: number): GrowthImages {
    const { lo, hi, weight } = stagePair(g);
    let a = imageFor(inst, lo, priority);
    const b = weight > 0 ? imageFor(inst, hi, priority) : undefined;
    if (!a) {
      const w = specFor(inst, lo).w;
      for (let s = lo - 1; s >= 0 && !a; s--) a = cache.best(inst.speciesId, inst.seed, s, w);
    }
    return { a, b, weight: a && b ? weight : b ? 1 : 0, lo, hi };
  }

  /** Composite (cross-faded) image for growth images, or the single one. */
  function growthImage(inst: Inst, imgs: GrowthImages, id: string): { image: CanvasImageSource; w: number; h: number } | null {
    const one = imgs.weight >= 1 ? imgs.b : imgs.a ?? imgs.b;
    if (!one) return null;
    if (!imgs.a || !imgs.b || imgs.weight <= 0 || imgs.weight >= 1) return { image: one.image, w: one.spec.w, h: one.spec.h };
    const spec = specFor(inst, imgs.lo);
    const buf = scratch(`grow:${id}`, spec.w, spec.h);
    if (!buf) return { image: one.image, w: one.spec.w, h: one.spec.h };
    crossFade(buf, imgs.a.image, imgs.b.image, imgs.weight, morphBetween(imgs.a.bounds, imgs.b.bounds, inst.def.anchor));
    return { image: buf.canvas, w: spec.w, h: spec.h };
  }

  function swayPose(inst: Inst, t: number): PlantPose {
    if (reduced) return { lean: 0, bend: 1, scaleY: 1, alpha: 1 };
    const m = SWAY[inst.def.sizeClass] ?? SWAY.medium;
    const w = wind(t, inst.slot.x, inst.slot.y - inst.box.h * 0.6, boost);
    const flutter = 0.18 * w.gust * Math.sin(t * 2.2 + inst.phase);
    return { lean: m.amp * (w.sway + flutter), bend: m.bend, scaleY: 1, alpha: 1 };
  }

  const visible = (box: WorldRect): boolean => {
    const v = sys?.viewport.visible;
    if (!v) return true;
    return box.x + box.w * 1.2 >= v.x && box.x - box.w * 0.2 <= v.x + v.w && box.y + box.h * 1.1 >= v.y && box.y <= v.y + v.h + 40;
  };

  // --- state sync --------------------------------------------------------------------------

  function growthTarget(s: ActiveSession, at: number): number {
    return sessionTimeline(s, at).growth;
  }

  function startWither(g: GrowRec): void {
    const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
    const src = growthImage(g.inst, imgs, 'wither-capture');
    if (!src) return;
    let image: CanvasImageSource | null = null;
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(src.w, src.h) : document.createElement('canvas');
      c.width = src.w;
      c.height = src.h;
      const cx = c.getContext('2d') as CanvasRenderingContext2D | null;
      cx?.drawImage(src.image, 0, 0, src.w, src.h);
      image = c;
    } catch {
      image = null;
    }
    if (image) withering.push({ inst: g.inst, image, w: src.w, h: src.h, start: lastT });
  }

  function sync(state: GardenState, at: number, initial: boolean): void {
    const s = state.session;
    // the growing plant
    if (s) {
      if (!growing || growing.id !== s.id) {
        const def = getSpecies(s.speciesId);
        const slot = slotById.get(s.slotId);
        growing = def && slot ? { id: s.id, inst: makeInst(def, slot, s.seed, `session:${s.id}`), shown: initial ? growthTarget(s, at) : 0 } : null;
      }
    } else if (growing) {
      growing = null;
    }
    // finished plants
    const seen = new Set<string>();
    for (const plant of state.plants) {
      seen.add(plant.id);
      const rec = finished.get(plant.id);
      if (rec && rec.plant === plant) continue;
      const def = getSpecies(plant.speciesId);
      const slot = slotById.get(plant.slotId);
      if (!def || !slot) {
        finished.delete(plant.id);
        continue;
      }
      if (rec && rec.plant.slotId === plant.slotId && rec.plant.speciesId === plant.speciesId && rec.plant.seed === plant.seed) {
        rec.plant = plant;
        continue;
      }
      const bloom = completing && completing.id === plant.id ? { from: completing.from, start: lastT } : null;
      finished.set(plant.id, {
        plant,
        inst: makeInst(def, slot, plant.seed, `plant:${plant.id}`),
        presence: { from: 1, to: 1, start: 0, dur: 1 },
        appear: initial || bloom ? null : 'waiting',
        bloom,
      });
    }
    for (const id of [...finished.keys()]) if (!seen.has(id)) finished.delete(id);
    completing = null;
    // a plant the session is replacing steps aside (and returns on cancel)
    const displaced = s?.displacedPlantId ?? null;
    for (const rec of finished.values()) {
      const to = rec.plant.id === displaced ? 0 : 1;
      if (rec.presence.to === to) continue;
      const from = initial ? to : fadeValue(rec.presence, lastT);
      rec.presence = { from, to, start: lastT, dur: to === 0 ? DISPLACE_OUT_SECONDS : DISPLACE_IN_SECONDS };
    }
    lastPlants = state.plants;
    lastSession = s;
  }

  function onStoreChange(state: GardenState, prev: GardenState, action: Action): void {
    if (!booted) return;
    if (action.type === 'session/cancel' && prev.session && growing?.id === prev.session.id && !state.session) {
      startWither(growing);
      watering = null;
    }
    if (action.type === 'session/complete' && prev.session && growing?.id === prev.session.id) {
      completing = { id: prev.session.id, from: growing.shown };
      watering = null;
    }
    if (!state.session) watering = null;
    sync(state, sys?.clock.now() ?? 0, false);
  }

  // --- requests ----------------------------------------------------------------------------

  function requestAll(): void {
    for (const rec of finished.values()) {
      cache.request(specFor(rec.inst, FINAL_STEP), visible(rec.inst.box) ? PRIORITY.visible : PRIORITY.ahead);
    }
    if (growing) {
      const { lo, hi } = stagePair(growing.shown);
      cache.request(specFor(growing.inst, lo), PRIORITY.now);
      cache.request(specFor(growing.inst, hi), PRIORITY.now);
    }
  }

  function requestAhead(): void {
    if (!growing) return;
    const { lo, hi } = stagePair(growing.shown);
    for (const step of [lo, hi]) cache.request(specFor(growing.inst, step), PRIORITY.now);
    if (hi + 1 <= FINAL_STEP) cache.request(specFor(growing.inst, hi + 1), PRIORITY.next);
    if (hi + 2 <= FINAL_STEP) cache.request(specFor(growing.inst, hi + 2), PRIORITY.ahead);
  }

  // --- watering ----------------------------------------------------------------------------

  function wateringRig(g: GrowRec, sprite: Sprite | undefined): WateringRig {
    const { box, slot } = g.inst;
    const b = sprite?.bounds;
    const top = b ? box.y + b.top * box.h : slot.y - box.h * Math.max(0.25, g.shown) * 0.8;
    const half = b ? ((b.right - b.left) / 2) * box.w : box.w * 0.25;
    const visibleH = Math.max(8, slot.y - top);
    const size = Math.max(30 * slot.scale, Math.min(54 * slot.scale, visibleH * 0.5));
    // the can comes from the open side: from the left when its path would cross the pavilion
    // (or run off the right edge of the world)
    const reach = slot.x + half * 0.6 + size * 3.2;
    const side: 1 | -1 = reach > Math.min(scene?.pavilion.x ?? 1600, 1600) ? -1 : 1;
    return { baseX: slot.x, baseY: slot.y, top, halfWidth: Math.max(half, 6), size, side };
  }

  const wateringProgress = (t: number): number | null => (watering && watering.start !== null ? (t - watering.start) / WATERING_SECONDS : null);

  // --- drawables ---------------------------------------------------------------------------

  function finishedDrawable(rec: FinishedRec, t: number): Drawable | null {
    if (!visible(rec.inst.box)) return null;
    const presence = fadeValue(rec.presence, t);
    if (presence <= 0.003 && fadeDone(rec.presence, t)) return null;
    return {
      depth: rec.inst.slot.y,
      draw: (ctx) =>
        timed(() => {
          const inst = rec.inst;
          let image: CanvasImageSource | null = null;
          if (rec.bloom) {
            const u = (t - rec.bloom.start) / BLOOM_SECONDS;
            if (u >= 1) rec.bloom = null;
            else {
              const g = rec.bloom.from + (1 - rec.bloom.from) * ease(0, 1, u);
              const imgs = growthImages(inst, g, PRIORITY.now);
              image = growthImage(inst, imgs, inst.key)?.image ?? null;
            }
          }
          if (!image) image = imageFor(inst, FINAL_STEP, PRIORITY.visible)?.image ?? null;
          if (!image) return;
          if (rec.appear === 'waiting') rec.appear = { from: 0, to: 1, start: t, dur: APPEAR_SECONDS };
          let alpha = presence;
          const ap = rec.appear;
          if (ap) {
            alpha *= fadeValue(ap, t);
            if (fadeDone(ap, t)) rec.appear = null;
          }
          drawnThisFrame.add(rec.plant.id);
          const pose = swayPose(inst, t);
          pose.alpha = alpha;
          drawPlant(ctx, image, inst.box, inst.slot.x, inst.slot.y, pose);
        }),
    };
  }

  function growingDrawable(g: GrowRec, t: number): Drawable {
    return {
      depth: g.inst.slot.y,
      draw: (ctx) =>
        timed(() => {
          const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
          const u = wateringProgress(t);
          const pose = swayPose(g.inst, t);
          if (u !== null && watering?.start != null) {
            const rig = wateringRig(g, imgs.a ?? imgs.b);
            // on the pond the drops ring the water instead of darkening soil
            if (g.inst.slot.habitat !== 'water') drawWetSoil(ctx, rig, gardenWetness(t - watering.start) * 0.85);
            if (u < 1) {
              const lift = wateringTimeline(u).lift;
              pose.scaleY = 1 + LIFT_SCALE * lift;
              pose.lean += (reduced ? 0 : 0.012) * lift * Math.sin(t * 1.7 + g.inst.phase);
            }
          }
          const img = growthImage(g.inst, imgs, g.inst.key);
          if (!img) return;
          drawnThisFrame.add(`session:${g.id}`);
          drawPlant(ctx, img.image, g.inst.box, g.inst.slot.x, g.inst.slot.y, pose);
        }),
    };
  }

  function witherDrawable(w: WitherRec, t: number): Drawable {
    return {
      depth: w.inst.slot.y,
      draw: (ctx) =>
        timed(() => drawWithering(ctx, w.image, w.w, w.h, w.inst.box, w.inst.slot.x, w.inst.slot.y, (t - w.start) / WITHER_SECONDS, w.inst.side)),
    };
  }

  function ghostDrawable(t: number): Drawable | null {
    if (!highlight.active || !highlight.speciesId) return null;
    const id = highlight.focused ?? highlight.selected;
    const slot = id ? slotById.get(id) : undefined;
    const def = getSpecies(highlight.speciesId);
    if (!slot || !def) return null;
    const inst = makeInst(def, slot, 1, `ghost:${def.id}`);
    return {
      depth: slot.y + 0.01,
      draw: (ctx) =>
        timed(() => {
          const img = imageFor(inst, FINAL_STEP, PRIORITY.visible);
          if (!img) return;
          const pose = swayPose(inst, t);
          pose.alpha = GHOST_ALPHA * (reduced ? 1 : 0.85 + 0.15 * Math.sin((t / 4.2) * Math.PI * 2));
          drawPlant(ctx, img.image, inst.box, slot.x, slot.y, pose);
        }),
    };
  }

  function drawHighlight(ctx: CanvasRenderingContext2D, t: number): void {
    if (!highlight.active || highlight.slots.length === 0) return;
    const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
    for (const s of highlight.slots) {
      const slot = slotById.get(s.id);
      const scale = slot?.scale ?? 1;
      const state = s.id === highlight.selected ? 'selected' : s.id === highlight.focused ? 'focused' : 'idle';
      const w = 66 * scale * (state === 'idle' ? 1 : 1.15);
      const dab = highlightDab(w * k);
      if (!dab) continue;
      const h = (w * DAB_BOX.h) / DAB_BOX.w;
      ctx.save();
      ctx.globalAlpha = dabAlpha(t, (s.x * 0.013 + s.y * 0.007) % (Math.PI * 2), state, reduced);
      ctx.drawImage(dab, s.x - w / 2, s.y - h * 0.55, w, h);
      ctx.restore();
    }
  }

  function drawReflections(ctx: CanvasRenderingContext2D, t: number): void {
    if (!scene || scene.pond.length < 3) return;
    const list: Array<{ inst: Inst; sprite: Sprite; alpha: number; lean: number }> = [];
    for (const rec of finished.values()) {
      if (rec.inst.axis === null) continue;
      const a = fadeValue(rec.presence, t) * (rec.appear && rec.appear !== 'waiting' ? fadeValue(rec.appear, t) : rec.appear === 'waiting' ? 0 : 1);
      if (a <= 0.003) continue;
      const sprite = imageFor(rec.inst, FINAL_STEP, PRIORITY.visible);
      if (sprite) list.push({ inst: rec.inst, sprite, alpha: a, lean: swayPose(rec.inst, t).lean });
    }
    if (growing?.inst.axis != null) {
      const imgs = growthImages(growing.inst, growing.shown, PRIORITY.now);
      const sprite = imgs.weight >= 0.5 ? imgs.b ?? imgs.a : imgs.a ?? imgs.b;
      if (sprite) list.push({ inst: growing.inst, sprite, alpha: 1, lean: swayPose(growing.inst, t).lean });
    }
    if (list.length === 0) return;
    ctx.save();
    ctx.beginPath();
    scene.pond.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    for (const r of list) {
      const img = reflectionImage(r.sprite.key, r.sprite.image, r.sprite.spec.w, r.sprite.spec.h, r.inst.seed);
      if (!img) continue;
      drawReflection(ctx, { image: img, box: r.inst.box, axis: r.inst.axis!, sway: r.lean * r.inst.box.h, alpha: r.alpha, phase: r.inst.phase }, t, reduced);
    }
    ctx.restore();
  }

  // --- the system --------------------------------------------------------------------------

  const system: PlantSystem = {
    id: 'plants',
    cache,
    async init(c) {
      sys = c;
      scene = c.scene;
      slotById = new Map(c.scene.slots.map((s) => [s.id, s]));
      reduced = c.reducedMotion;
      const nextRes = resolutionBucket(c.viewport.pixelScale);
      const resChanged = nextRes !== res;
      res = nextRes;
      if (!booted) {
        booted = true;
        unsubs.push(c.store.subscribe(onStoreChange));
        unsubs.push(c.bus.on('session:water', () => (waterPending = true)));
        sync(c.store.get(), c.clock.now(), true);
      } else if (resChanged) {
        // instances keep their boxes; only the sprite resolution changes
        for (const rec of finished.values()) rec.inst = makeInst(rec.inst.def, rec.inst.slot, rec.inst.seed, rec.inst.key);
      }
      requestAll();
      if (c.store.get().session) prewarmWatering(c.viewport.pixelScale, 40);
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([cache.whenIdle(), new Promise<void>((r) => (timer = setTimeout(r, initWait)))]);
      if (timer !== undefined) clearTimeout(timer);
      ready = true;
    },
    update(f: FrameInfo) {
      if (perfFrame > 0 || perfFrames > 0) {
        perfAcc += perfFrame;
        perfMax = Math.max(perfMax, perfFrame);
        perfFrames++;
      }
      perfFrame = 0;
      timed(() => {
        cache.beginFrame();
        drawnThisFrame.clear();
        lastT = f.t;
        if (!sys) return;
        const state = sys.store.get();
        if (state.plants !== lastPlants || state.session !== lastSession) sync(state, f.now, false);
        const s = state.session;
        boost = s ? windBoost(sessionPhase(state, f.now)) : 0;
        if (growing && s) {
          const target = growthTarget(s, f.now);
          if (f.dt <= 0 || Math.abs(target - growing.shown) < 1e-4) growing.shown = target;
          else growing.shown += (target - growing.shown) * (1 - Math.exp(-f.dt / GROWTH_EASE_SECONDS));
          requestAhead();
        }
        if (waterPending) {
          waterPending = false;
          if (growing) {
            watering = { start: f.t };
            prewarmWatering(sys.viewport.pixelScale, wateringRig(growing, undefined).size);
          }
        }
        if (watering?.start != null && f.t - watering.start > WATERING_SECONDS * 0.9 + WET_LINGER_SECONDS) watering = null;
        for (let i = withering.length - 1; i >= 0; i--) {
          if ((f.t - withering[i]!.start) / WITHER_SECONDS >= 1) withering.splice(i, 1);
        }
      });
    },
    draw(layer: LayerId, ctx: CanvasRenderingContext2D, f: FrameInfo) {
      if (layer === 'waterSurface') timed(() => drawReflections(ctx, f.t));
      else if (layer === 'entities') timed(() => drawHighlight(ctx, f.t));
      else if (layer === 'air' && growing && !reduced) {
        const u = wateringProgress(f.t);
        if (u === null || u >= 1) return;
        const g = growing;
        timed(() => {
          const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
          drawWateringFront(ctx, wateringRig(g, imgs.a ?? imgs.b), u, g.inst.seed);
        });
      }
    },
    entities(f: FrameInfo): Drawable[] {
      return timed(() => {
        const out: Drawable[] = [];
        for (const rec of finished.values()) {
          const d = finishedDrawable(rec, f.t);
          if (d) out.push(d);
        }
        if (growing) out.push(growingDrawable(growing, f.t));
        for (const w of withering) out.push(witherDrawable(w, f.t));
        const ghost = ghostDrawable(f.t);
        if (ghost) out.push(ghost);
        return out;
      });
    },
    dispose() {
      for (const u of unsubs.splice(0)) u();
      unsubPlacement?.();
      cache.dispose();
    },
    connectPlacement(source) {
      unsubPlacement?.();
      highlight = source.current();
      const off = source.subscribe((h) => {
        highlight = h;
        if (h.active && h.speciesId) {
          const def = getSpecies(h.speciesId);
          if (def) for (const s of h.slots.slice(0, 3)) {
            const slot = slotById.get(s.id);
            if (slot) cache.request(specFor(makeInst(def, slot, 1, 'ghost'), FINAL_STEP), PRIORITY.ahead);
          }
        }
      });
      unsubPlacement = () => {
        off();
        highlight = NO_PLACEMENT;
      };
      return unsubPlacement;
    },
    plantBounds(plantId) {
      const rec = finished.get(plantId);
      if (rec) return { ...rec.inst.box };
      if (growing && growing.id === plantId) return { ...growing.inst.box };
      const state = sys?.store.get();
      const plant = state?.plants.find((p) => p.id === plantId);
      const def = plant ? getSpecies(plant.speciesId) : undefined;
      const slot = plant ? slotById.get(plant.slotId) : undefined;
      return def && slot ? plantWorldBounds(def, slot) : null;
    },
    boundsFor(speciesId, slotId) {
      const def = getSpecies(speciesId);
      const slot = slotById.get(slotId);
      return def && slot ? plantWorldBounds(def, slot) : null;
    },
    toDevice(rect) {
      const vp = sys?.viewport;
      if (!vp) return null;
      const p = vp.worldToScreen(rect);
      return { x: p.x * vp.dpr, y: p.y * vp.dpr, w: rect.w * vp.pixelScale, h: rect.h * vp.pixelScale };
    },
    whenIdle: () => cache.whenIdle(),
    settle() {
      const state = sys?.store.get();
      if (state && sys) {
        sync(state, sys.clock.now(), false);
        if (growing && state.session) growing.shown = growthTarget(state.session, sys.clock.now());
        for (const rec of finished.values()) {
          rec.bloom = null;
          if (rec.appear !== null) rec.appear = null;
          rec.presence = { from: rec.presence.to, to: rec.presence.to, start: 0, dur: 1 };
        }
        requestAll();
        requestAhead();
      }
      return cache.whenIdle();
    },
    ready() {
      const state = sys?.store.get();
      if (state && sys) {
        sync(state, sys.clock.now(), false);
        requestAll();
        requestAhead();
      }
      return cache.whenIdle();
    },
    debugState() {
      const t = lastT;
      const s = sys?.store.get().session ?? null;
      const displacedRec = s?.displacedPlantId ? finished.get(s.displacedPlantId) : undefined;
      const reflections: string[] = [];
      for (const rec of finished.values()) if (rec.inst.axis !== null) reflections.push(rec.plant.id);
      if (growing?.inst.axis != null) reflections.push(`session:${growing.id}`);
      const u = wateringProgress(t);
      let grow: PlantDebugState['growing'] = null;
      if (growing && s) {
        const pair = stagePair(growing.shown);
        grow = {
          id: growing.id,
          slotId: growing.inst.slot.id,
          speciesId: growing.inst.speciesId,
          growth: growthTarget(s, sys!.clock.now()),
          shown: growing.shown,
          ...pair,
          drawn: drawnThisFrame.has(`session:${growing.id}`),
        };
      }
      return {
        ready,
        resolution: res,
        finished: [...finished.values()].map((r) => ({
          id: r.plant.id,
          slotId: r.plant.slotId,
          speciesId: r.plant.speciesId,
          alpha: fadeValue(r.presence, t),
          drawn: drawnThisFrame.has(r.plant.id),
          blooming: r.bloom !== null,
        })),
        growing: grow,
        withering: withering.map((w) => ({ slotId: w.inst.slot.id, progress: Math.min(1, (t - w.start) / WITHER_SECONDS) })),
        watering: watering && watering.start !== null && u !== null ? { progress: Math.min(1, u), wet: gardenWetness(t - watering.start), active: u < 1 } : watering ? { progress: 0, wet: 0, active: true } : null,
        displaced: displacedRec ? { id: displacedRec.plant.id, alpha: fadeValue(displacedRec.presence, t) } : null,
        reflections,
        highlight: { active: highlight.active, slots: highlight.slots.length, ghost: highlight.active ? highlight.speciesId : null },
        cache: cache.stats(),
      };
    },
    perf: () => ({ frames: perfFrames, avgMs: perfFrames ? perfAcc / perfFrames : 0, maxMs: perfMax }),
    resetPerf() {
      perfAcc = 0;
      perfFrames = 0;
      perfMax = 0;
      perfFrame = 0;
    },
  };
  return system;
}
