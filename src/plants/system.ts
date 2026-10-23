import { inProgressSessions, type Action, type ActiveSession, type GardenState, type PlantInstance } from '../core/state';
import { sessionPhase, sessionTimeline } from '../core/session';
import type { Drawable, FrameInfo, LayerId, System, SystemContext } from '../render/types';
import type { Pt, Rect, Viewport } from '../render/viewport';
import { alphaMask, pickPlant, type HitCandidate } from './hit-test';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { plantWorldBounds, type WorldRect } from './bounds';
import { crossFade, drawPlant, inkCrop, morphBetween, scratch, type PlantPose } from './draw';
import { DAB_BOX, dabAlpha, GHOST_ALPHA, highlightDab, NO_PLACEMENT, type PlacementSnapshot, type PlacementSource } from './highlight';
import { drawReflection, reflectionImage, shoreAxis } from './reflection';
import {
  createSpriteCache,
  FINAL_STEP,
  PRIORITY,
  resolutionBucket,
  spritePixelSize,
  stagePair,
  type PixelRect,
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
import { plantScale } from '../scene/slots';
import { pinnedSource, type DaylightSource } from '../ambience/daylight-source';
import type { DaylightState } from '../ambience/daylight';
import { castShadow, rimLight, type CastShadow, type RimLight } from '../ambience/sky-layout';
import { createRimCache } from '../paint/rim';
import { drawPlantShadow } from './shadow';
import { drawWithering, WITHER_SECONDS } from './wither';

/**
 * PlantSystem (docs/systems/plants.md, ADRs 0110–0119, 0155): every finished plant and the growing
 * plant of each session in progress (the active one and the waiting ones, which stand calm) as
 * depth-sorted `entities` drawables (depth = slot y), their reflections on the `waterSurface`
 * layer, the watering can on the `air` layer and the placement highlight under the plants. Sprites
 * come from the sprite cache (sprites.ts); nothing is painted in a frame.
 */

export interface PlantSystemOptions {
  getSpecies(id: string): SpeciesDef | undefined;
  /** injectable for tests; default: a worker-backed cache over `getSpecies` */
  cache?: SpriteCache;
  /** default: the garden wind (ambience, or the local fallback) */
  wind?: WindFn;
  budgetBytes?: number;
  /** the garden's daylight: cast shadows and rim light follow its sun (default: pinned midday) */
  daylight?: DaylightSource;
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
/** How dark a plant's cast shadow is relative to the phase's shadow (they are small, soft things). */
export const SHADOW_PLANT = 0.6;
/** How strongly plants take the rim light. */
export const RIM_PLANT = 0.85;
/** Sprite px per world unit at which rim widths were tuned (the desktop overview at DPR 2). */
export const RIM_REF_RES = 1.7;
/** sway of a waiting (paused) session's seedling, relative to a plant at rest (ADR 0155) */
export const CALM_SWAY = 0.6;
/** A growth cross-fade is composited again once its weight moved this much (a 1/128 step is invisible). */
export const FADE_STEP = 1 / 128;

/** plant systems made so far: keeps each system's scratch buffers its own */
let systemCount = 0;

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
  /** its session is waiting (paused, not the active one): no wind boost, a calmer sway */
  calm: boolean;
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
  /** `shown`: how far its appearance fade has come (0 = waiting for its sprite, 1 = fully shown) */
  finished: Array<{ id: string; slotId: string; speciesId: string; alpha: number; shown: number; drawn: boolean; blooming: boolean }>;
  /** the active session's seedling */
  growing: { id: string; slotId: string; speciesId: string; growth: number; shown: number; lo: number; hi: number; weight: number; drawn: boolean } | null;
  /** every seedling of a session in progress (the active one included) */
  seedlings: Array<{ id: string; slotId: string; speciesId: string; growth: number; shown: number; active: boolean; calm: boolean; drawn: boolean }>;
  withering: Array<{ slotId: string; progress: number }>;
  watering: { progress: number; wet: number; active: boolean; sessionId: string } | null;
  /** the active session's displaced plant */
  displaced: { id: string; alpha: number } | null;
  reflections: string[];
  highlight: { active: boolean; slots: number; ghost: string | null };
  cache: ReturnType<SpriteCache['stats']>;
}

export interface PlantHit {
  /** the plant id, or the session id of a seedling */
  id: string;
  kind: 'finished' | 'growing';
  speciesId: string;
  slotId: string;
  /** the world rect its sprite is drawn into */
  box: Rect;
}

export interface PlantPerf {
  frames: number;
  avgMs: number;
  maxMs: number;
  /** growth cross-fades composited since the last reset (they are reused while nothing changes) */
  fadeComposites: number;
}

export interface PlantSystem extends System {
  readonly cache: SpriteCache;
  /** draw the in-canvas placement highlight from the UI's observable */
  connectPlacement(source: PlacementSource): () => void;
  /** world rect of a finished (or the growing) plant's sprite box */
  plantBounds(plantId: string): Rect | null;
  /** world rect a species would occupy in a slot */
  boundsFor(speciesId: string, slotId: string): Rect | null;
  /** a world rect in canvas device pixels (the current camera view) */
  toDevice(rect: Rect): Rect | null;
  /**
   * The front-most plant painted at a world point — a finished plant or a session's seedling —
   * with `tolerance` world units of slack (ADR 0166). Transparent parts of a sprite miss.
   */
  hitTest(p: Pt, tolerance?: number): PlantHit | null;
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
  /** sprite resolution at the overview, and (zoomed in) for the plants in the camera's detail view (ADR 0165) */
  let res = 1;
  let detail: { res: number; rect: Rect } | null = null;
  let seenDetail = -1;
  let evictPending = false;
  let reduced = false;
  let ready = false;
  let booted = false;
  const unsubs: Array<() => void> = [];

  const finished = new Map<string, FinishedRec>();
  /** seedlings of the sessions in progress, by session id */
  const growing = new Map<string, GrowRec>();
  let activeId: string | null = null;
  const withering: WitherRec[] = [];
  let watering: { id: string; start: number | null } | null = null;
  /** session id to water on the next frame */
  let waterPending: string | null = null;
  let completing: { id: string; from: number } | null = null;
  let lastPlants: readonly PlantInstance[] | null = null;
  let lastSession: ActiveSession | null | undefined;
  let lastWaiting: readonly ActiveSession[] | undefined;
  const activeGrow = (): GrowRec | null => (activeId ? growing.get(activeId) ?? null : null);
  let lastT = 0;
  let boost = 0;
  let highlight: PlacementSnapshot = NO_PLACEMENT;
  let unsubPlacement: (() => void) | null = null;
  const drawnThisFrame = new Set<string>();
  const daylight = opts.daylight ?? pinnedSource('midday');
  let light: DaylightState = daylight.at(0);
  let shadow: CastShadow = castShadow(light);
  let rim: RimLight = rimLight(light);
  const rims = createRimCache();
  /** the last cross-fade composited per scratch id (ids are unique to this system: `uid`) */
  const uid = ++systemCount;
  const fades = new Map<string, { a: CanvasImageSource; b: CanvasImageSource; weight: number; w: number; h: number; image: CanvasImageSource }>();
  let fadeComposites = 0;

  // readiness (plantsReady): the first init, then "every plant that should show is fully shown"
  let markInit: () => void = () => {};
  const initDone = new Promise<void>((r) => (markInit = r));
  const shownWaiters: Array<() => void> = [];
  /** no visible finished plant is still waiting for its sprite or fading in */
  const allShown = (): boolean => {
    for (const rec of finished.values()) {
      if (rec.appear === null || !visible(rec.inst.box) || rec.presence.to === 0) continue;
      if (rec.appear === 'waiting' && !cache.has(specFor(rec.inst, FINAL_STEP))) continue; // unpaintable
      return false;
    }
    return true;
  };
  const checkShown = (): void => {
    if (shownWaiters.length && allShown()) for (const fn of shownWaiters.splice(0)) fn();
  };
  const whenShown = (maxMs: number): Promise<void> =>
    allShown()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(() => {
            const i = shownWaiters.indexOf(done);
            if (i >= 0) shownWaiters.splice(i, 1);
            resolve();
          }, maxMs);
          shownWaiters.push(done);
        });

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

  /** the camera's view this frame (the overview before a camera exists) */
  const view = (): Viewport | null => sys?.camera?.view() ?? sys?.viewport ?? null;

  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /** a plant in the camera's detail view is painted at the zoomed resolution, the rest at the overview's */
  const resFor = (inst: Inst): number => (detail && overlaps(inst.box, detail.rect) ? detail.res : res);

  const specFor = (inst: Inst, step: number): SpriteSpec => {
    const px = spritePixelSize(inst.def.size, plantScale(inst.slot), resFor(inst));
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

  /** an image's pixel size and painted part (ink), when it is a sprite */
  interface Painted {
    w: number;
    h: number;
    ink?: PixelRect;
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
  function growthImage(inst: Inst, imgs: GrowthImages, id: string): { image: CanvasImageSource; w: number; h: number; ink?: PixelRect } | null {
    const one = imgs.weight >= 1 ? imgs.b : imgs.a ?? imgs.b;
    if (!one) return null;
    if (!imgs.a || !imgs.b || imgs.weight <= 0 || imgs.weight >= 1) return { image: one.image, w: one.spec.w, h: one.spec.h, ink: one.bounds?.ink };
    const spec = specFor(inst, imgs.lo);
    // a cross-fade is composited again only when its images or its weight moved: a waiting seedling
    // never changes, a growing one moves a step in about two minutes, so about once a second (devlog 24)
    const last = fades.get(id);
    if (last && last.a === imgs.a.image && last.b === imgs.b.image && last.w === spec.w && last.h === spec.h && Math.abs(last.weight - imgs.weight) < FADE_STEP) {
      return { image: last.image, w: spec.w, h: spec.h };
    }
    const buf = scratch(`grow:${uid}:${id}`, spec.w, spec.h);
    if (!buf) return { image: one.image, w: one.spec.w, h: one.spec.h, ink: one.bounds?.ink };
    crossFade(buf, imgs.a.image, imgs.b.image, imgs.weight, morphBetween(imgs.a.bounds, imgs.b.bounds, inst.def.anchor));
    fades.set(id, { a: imgs.a.image, b: imgs.b.image, weight: imgs.weight, w: spec.w, h: spec.h, image: buf.canvas });
    fadeComposites++;
    return { image: buf.canvas, w: spec.w, h: spec.h };
  }

  function swayPose(inst: Inst, t: number, calm = false): PlantPose {
    if (reduced) return { lean: 0, bend: 1, scaleY: 1, alpha: 1 };
    const m = SWAY[inst.def.sizeClass] ?? SWAY.medium;
    const w = wind(t, inst.slot.x, inst.slot.y - inst.box.h * 0.6, calm ? 0 : boost);
    const flutter = 0.18 * w.gust * Math.sin(t * 2.2 + inst.phase);
    return { lean: m.amp * (w.sway + flutter) * (calm ? CALM_SWAY : 1), bend: m.bend, scaleY: 1, alpha: 1 };
  }

  const visible = (box: WorldRect): boolean => {
    const v = view()?.visible;
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
    activeId = s?.id ?? null;
    // the growing plants: one per session in progress; a new one starts from seed, a known one
    // (after a reload: every one) at its own growth
    const sessions = inProgressSessions(state);
    for (const x of sessions) {
      let g = growing.get(x.id);
      if (!g) {
        const def = getSpecies(x.speciesId);
        const slot = slotById.get(x.slotId);
        if (!def || !slot) continue;
        const fresh = !initial && x === s && x.pausedAt === null;
        g = { id: x.id, inst: makeInst(def, slot, x.seed, `session:${x.id}`), shown: fresh ? 0 : growthTarget(x, at), calm: false };
        growing.set(x.id, g);
      }
      g.calm = x !== s;
    }
    for (const id of [...growing.keys()]) if (!sessions.some((x) => x.id === id)) growing.delete(id);
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
    // a plant a session is replacing steps aside (and returns on cancel)
    const displaced = new Set(sessions.map((x) => x.displacedPlantId).filter((id): id is string => id !== null));
    for (const rec of finished.values()) {
      const to = displaced.has(rec.plant.id) ? 0 : 1;
      if (rec.presence.to === to) continue;
      const from = initial ? to : fadeValue(rec.presence, lastT);
      rec.presence = { from, to, start: lastT, dur: to === 0 ? DISPLACE_OUT_SECONDS : DISPLACE_IN_SECONDS };
    }
    lastPlants = state.plants;
    lastSession = s;
    lastWaiting = state.waiting;
  }

  function onStoreChange(state: GardenState, prev: GardenState, action: Action): void {
    if (!booted) return;
    if (action.type === 'session/cancel' || action.type === 'session/complete') {
      const still = new Set(inProgressSessions(state).map((x) => x.id));
      for (const x of inProgressSessions(prev)) {
        const g = growing.get(x.id);
        if (!g || still.has(x.id)) continue;
        if (action.type === 'session/cancel') startWither(g);
        else completing = { id: x.id, from: g.shown };
        if (watering?.id === x.id) watering = null;
      }
    }
    if (watering && !inProgressSessions(state).some((x) => x.id === watering!.id)) watering = null;
    sync(state, sys?.clock.now() ?? 0, false);
  }

  // --- requests ----------------------------------------------------------------------------

  function requestAll(): void {
    for (const rec of finished.values()) {
      cache.request(specFor(rec.inst, FINAL_STEP), visible(rec.inst.box) ? PRIORITY.visible : PRIORITY.ahead);
    }
    for (const g of growing.values()) {
      const { lo, hi } = stagePair(g.shown);
      cache.request(specFor(g.inst, lo), PRIORITY.now);
      cache.request(specFor(g.inst, hi), PRIORITY.now);
    }
  }

  function requestAhead(): void {
    for (const g of growing.values()) {
      const { lo, hi } = stagePair(g.shown);
      for (const step of [lo, hi]) cache.request(specFor(g.inst, step), PRIORITY.now);
      if (g.calm) continue; // a waiting seedling does not grow
      if (hi + 1 <= FINAL_STEP) cache.request(specFor(g.inst, hi + 1), PRIORITY.next);
      if (hi + 2 <= FINAL_STEP) cache.request(specFor(g.inst, hi + 2), PRIORITY.ahead);
    }
  }

  // --- the camera's detail (ADR 0165) -----------------------------------------------------

  /** every plant instance the garden draws */
  const instances = (): Inst[] => [...[...finished.values()].map((r) => r.inst), ...[...growing.values()].map((g) => g.inst)];

  /** the sprite width each instance wants now, by instance (species|seed) */
  const wantedWidths = (): Map<string, number> => {
    const m = new Map<string, number>();
    for (const inst of instances()) m.set(`${inst.speciesId}|${inst.seed}`, specFor(inst, FINAL_STEP).w);
    return m;
  };

  /** the camera's detail view moved: plants in it get sprites at its resolution (painted during the glide) */
  function applyDetail(v: Viewport): void {
    const r = resolutionBucket(v.pixelScale);
    const margin = v.visible.w * 0.12;
    const next = r > res * 1.01 ? { res: r, rect: { x: v.visible.x - margin, y: v.visible.y - margin, w: v.visible.w + margin * 2, h: v.visible.h + margin * 2 } } : null;
    if (!next && !detail) return;
    detail = next;
    const want = wantedWidths();
    // renders queued for a view we have left are no longer wanted
    cache.dropQueued((spec) => {
      const w = want.get(`${spec.speciesId}|${spec.seed}`);
      return w !== undefined && spec.w !== w;
    });
    requestAll();
    requestAhead();
    evictPending = true;
  }

  /** once the camera rests: drop high-resolution sprites of plants now far out of view */
  function evictStale(): void {
    const want = wantedWidths();
    cache.evictWhere((spec) => {
      const w = want.get(`${spec.speciesId}|${spec.seed}`);
      return w !== undefined && spec.w > w * 1.05;
    });
  }

  // --- watering ----------------------------------------------------------------------------

  function wateringRig(g: GrowRec, sprite: Sprite | undefined): WateringRig {
    const { box, slot } = g.inst;
    const b = sprite?.bounds;
    const top = b ? box.y + b.top * box.h : slot.y - box.h * Math.max(0.25, g.shown) * 0.8;
    const half = b ? ((b.right - b.left) / 2) * box.w : box.w * 0.25;
    const visibleH = Math.max(8, slot.y - top);
    const k = plantScale(slot);
    const size = Math.max(30 * k, Math.min(54 * k, visibleH * 0.5));
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
          const final = imageFor(inst, FINAL_STEP, PRIORITY.visible);
          let drawn: Painted | undefined;
          if (!image && final) {
            image = final.image;
            drawn = { w: final.spec.w, h: final.spec.h, ink: final.bounds?.ink };
          }
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
          drawLit(ctx, inst, image, rec.bloom ? undefined : final, pose, drawn);
        }),
    };
  }

  function growingDrawable(g: GrowRec, t: number): Drawable {
    return {
      depth: g.inst.slot.y,
      draw: (ctx) =>
        timed(() => {
          const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
          const u = watering?.id === g.id ? wateringProgress(t) : null;
          const pose = swayPose(g.inst, t, g.calm);
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
          // light and shadow follow the nearer growth step (the cross-fade buffer changes every frame)
          drawLit(ctx, g.inst, img.image, imgs.weight >= 0.5 ? imgs.b ?? imgs.a : imgs.a ?? imgs.b, pose, img);
        }),
    };
  }

  /**
   * A plant in the garden's light: its cast shadow on the ground first (not on open water), the
   * plant, then the rim of its sun-facing edges (screen) with the same pose. `lit` is a stable
   * sprite for the shadow's extent and the rim mask (null: no shadow or rim this frame). `painted`
   * gives `image`'s size and ink when it is a sprite: only the painted part is blitted (ADR 0207).
   */
  function drawLit(ctx: CanvasRenderingContext2D, inst: Inst, image: CanvasImageSource, lit: Sprite | undefined, pose: PlantPose, painted?: Painted): void {
    const b = lit?.bounds;
    if (b && shadow.alpha > 0.01 && inst.slot.habitat !== 'water') {
      const w = (b.right - b.left) * inst.box.w;
      const h = (inst.def.anchor.y - b.top) * inst.box.h;
      drawPlantShadow(ctx, { x: inst.slot.x, y: inst.slot.y, w, h }, shadow, pose.alpha * SHADOW_PLANT);
    }
    drawPlant(ctx, image, inst.box, inst.slot.x, inst.slot.y, pose, painted && inkCrop(inst.box, painted.ink, painted.w, painted.h));
    if (lit && rim.strength > 0.02) {
      const mask = rims.get(lit.image, rim.side, rim.rgb, spriteRes(lit, inst.box.w) / RIM_REF_RES);
      if (!mask) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // the rim is cut from the sprite's own pixels: it lies inside the sprite's ink
      const crop = inkCrop(inst.box, lit.bounds?.ink, lit.spec.w, lit.spec.h);
      drawPlant(ctx, mask as CanvasImageSource, inst.box, inst.slot.x, inst.slot.y, { ...pose, alpha: pose.alpha * rim.strength * RIM_PLANT }, crop);
      ctx.restore();
    }
  }

  /** lift what is under the plant back to paper (the canvas's transparent pixels take the paper layer) */
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
    for (const g of growing.values()) {
      if (g.inst.axis == null) continue;
      const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
      const sprite = imgs.weight >= 0.5 ? imgs.b ?? imgs.a : imgs.a ?? imgs.b;
      if (sprite) list.push({ inst: g.inst, sprite, alpha: 1, lean: swayPose(g.inst, t, g.calm).lean });
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
        // the active session's plant, or the session the event names
        unsubs.push(c.bus.on('session:water', (e) => (waterPending = e?.sessionId ?? activeId)));
        sync(c.store.get(), c.clock.now(), true);
      } else if (resChanged) {
        // instances keep their boxes; only the sprite resolution changes
        for (const rec of finished.values()) rec.inst = makeInst(rec.inst.def, rec.inst.slot, rec.inst.seed, rec.inst.key);
      }
      requestAll();
      if (growing.size > 0) prewarmWatering(c.viewport.pixelScale, 40);
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([cache.whenIdle(), new Promise<void>((r) => (timer = setTimeout(r, initWait)))]);
      if (timer !== undefined) clearTimeout(timer);
      ready = true;
      markInit();
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
        light = daylight.at(f.now);
        shadow = castShadow(light);
        rim = rimLight(light);
        if (!sys) return;
        const cam = sys.camera;
        if (cam && cam.detailVersion !== seenDetail) {
          seenDetail = cam.detailVersion;
          applyDetail(cam.detailView());
        }
        if (evictPending && cam && !cam.moving()) {
          evictPending = false;
          evictStale();
        }
        const state = sys.store.get();
        if (state.plants !== lastPlants || state.session !== lastSession || state.waiting !== lastWaiting) sync(state, f.now, false);
        const s = state.session;
        boost = s ? windBoost(sessionPhase(state, f.now)) : 0;
        if (growing.size > 0) {
          for (const x of inProgressSessions(state)) {
            const g = growing.get(x.id);
            if (!g) continue;
            const target = growthTarget(x, f.now);
            if (f.dt <= 0 || Math.abs(target - g.shown) < 1e-4) g.shown = target;
            else g.shown += (target - g.shown) * (1 - Math.exp(-f.dt / GROWTH_EASE_SECONDS));
          }
          requestAhead();
        }
        if (waterPending !== null) {
          const g = growing.get(waterPending);
          waterPending = null;
          if (g) {
            watering = { id: g.id, start: f.t };
            prewarmWatering((sys.camera?.detailView() ?? sys.viewport).pixelScale, wateringRig(g, undefined).size);
          }
        }
        if (watering?.start != null && f.t - watering.start > WATERING_SECONDS * 0.9 + WET_LINGER_SECONDS) watering = null;
        for (let i = withering.length - 1; i >= 0; i--) {
          if ((f.t - withering[i]!.start) / WITHER_SECONDS >= 1) withering.splice(i, 1);
        }
        checkShown();
      });
    },
    draw(layer: LayerId, ctx: CanvasRenderingContext2D, f: FrameInfo) {
      if (layer === 'waterSurface') timed(() => drawReflections(ctx, f.t));
      else if (layer === 'entities') timed(() => drawHighlight(ctx, f.t));
      else if (layer === 'air' && watering && !reduced) {
        const g = growing.get(watering.id);
        const u = wateringProgress(f.t);
        if (!g || u === null || u >= 1) return;
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
        for (const g of growing.values()) out.push(growingDrawable(g, f.t));
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
      const g = growing.get(plantId);
      if (g) return { ...g.inst.box };
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
    hitTest(p, tolerance = 0) {
      const list: Array<HitCandidate & { hit: PlantHit }> = [];
      const t = lastT;
      for (const rec of finished.values()) {
        if (fadeValue(rec.presence, t) < 0.5 || rec.appear === 'waiting') continue;
        const inst = rec.inst;
        const sprite = cache.best(inst.speciesId, inst.seed, FINAL_STEP, specFor(inst, FINAL_STEP).w);
        list.push({
          id: rec.plant.id,
          box: inst.box,
          depth: inst.slot.y,
          mask: sprite ? alphaMask(sprite.image) : null,
          hit: { id: rec.plant.id, kind: 'finished', speciesId: inst.speciesId, slotId: inst.slot.id, box: { ...inst.box } },
        });
      }
      for (const g of growing.values()) {
        const imgs = growthImages(g.inst, g.shown, PRIORITY.now);
        const sprite = imgs.weight >= 0.5 ? imgs.b ?? imgs.a : imgs.a ?? imgs.b;
        list.push({
          id: g.id,
          box: g.inst.box,
          depth: g.inst.slot.y,
          mask: sprite ? alphaMask(sprite.image) : null,
          hit: { id: g.id, kind: 'growing', speciesId: g.inst.speciesId, slotId: g.inst.slot.id, box: { ...g.inst.box } },
        });
      }
      return pickPlant(list, p, tolerance)?.hit ?? null;
    },
    toDevice(rect) {
      const vp = view();
      if (!vp) return null;
      const p = vp.worldToScreen(rect);
      return { x: p.x * vp.dpr, y: p.y * vp.dpr, w: rect.w * vp.pixelScale, h: rect.h * vp.pixelScale };
    },
    whenIdle: () => cache.whenIdle(),
    settle() {
      const state = sys?.store.get();
      if (state && sys) {
        sync(state, sys.clock.now(), false);
        for (const x of inProgressSessions(state)) {
          const g = growing.get(x.id);
          if (g) g.shown = growthTarget(x, sys.clock.now());
        }
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
    async ready() {
      // before the first init there is nothing to sync with yet: wait for it
      await initDone;
      const state = sys?.store.get();
      if (state && sys) {
        // pick up a store change the frame loop has not seen yet (e.g. a non-awaited addPlants)
        sync(state, sys.clock.now(), false);
        requestAll();
        requestAhead();
      }
      await cache.whenIdle();
      // and let the plants that just got their sprites finish fading in, so a screenshot taken
      // now shows them (bounded: a frozen frame loop never advances the fade)
      await whenShown(APPEAR_SECONDS * 1000 + 1500);
    },
    debugState() {
      const t = lastT;
      const s = sys?.store.get().session ?? null;
      const displacedRec = s?.displacedPlantId ? finished.get(s.displacedPlantId) : undefined;
      const reflections: string[] = [];
      for (const rec of finished.values()) if (rec.inst.axis !== null) reflections.push(rec.plant.id);
      for (const g of growing.values()) if (g.inst.axis != null) reflections.push(`session:${g.id}`);
      const u = wateringProgress(t);
      let grow: PlantDebugState['growing'] = null;
      const active = activeGrow();
      if (active && s) {
        const pair = stagePair(active.shown);
        grow = {
          id: active.id,
          slotId: active.inst.slot.id,
          speciesId: active.inst.speciesId,
          growth: growthTarget(s, sys!.clock.now()),
          shown: active.shown,
          ...pair,
          drawn: drawnThisFrame.has(`session:${active.id}`),
        };
      }
      const state = sys?.store.get();
      const seedlings: PlantDebugState['seedlings'] = state
        ? inProgressSessions(state).flatMap((x) => {
            const g = growing.get(x.id);
            return g
              ? [{ id: g.id, slotId: g.inst.slot.id, speciesId: g.inst.speciesId, growth: growthTarget(x, sys!.clock.now()), shown: g.shown, active: x === s, calm: g.calm, drawn: drawnThisFrame.has(`session:${g.id}`) }]
              : [];
          })
        : [];
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
          shown: r.appear === null ? 1 : r.appear === 'waiting' ? 0 : fadeValue(r.appear, t),
        })),
        growing: grow,
        seedlings,
        withering: withering.map((w) => ({ slotId: w.inst.slot.id, progress: Math.min(1, (t - w.start) / WITHER_SECONDS) })),
        watering:
          watering && watering.start !== null && u !== null
            ? { progress: Math.min(1, u), wet: gardenWetness(t - watering.start), active: u < 1, sessionId: watering.id }
            : watering
              ? { progress: 0, wet: 0, active: true, sessionId: watering.id }
              : null,
        displaced: displacedRec ? { id: displacedRec.plant.id, alpha: fadeValue(displacedRec.presence, t) } : null,
        reflections,
        highlight: { active: highlight.active, slots: highlight.slots.length, ghost: highlight.active ? highlight.speciesId : null },
        cache: cache.stats(),
      };
    },
    perf: () => ({ frames: perfFrames, avgMs: perfFrames ? perfAcc / perfFrames : 0, maxMs: perfMax, fadeComposites }),
    resetPerf() {
      fadeComposites = 0;
      perfAcc = 0;
      perfFrames = 0;
      perfMax = 0;
      perfFrame = 0;
    },
  };
  return system;
}

/** A sprite's pixels per world unit, from its bitmap and the world box it is drawn into. */
function spriteRes(sprite: Sprite, boxW: number): number {
  const w = (sprite.image as { width?: number }).width ?? sprite.spec.w;
  return boxW > 0 ? w / boxW : RIM_REF_RES;
}
