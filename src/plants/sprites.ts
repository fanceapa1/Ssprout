import { createRng } from '../core/rng';
import { createPainter, makeCanvas } from '../paint';
import type { SpeciesDef } from './types';

/**
 * Plant sprite cache (docs/systems/plants.md › Sprites, ADRs 0110–0112).
 *
 * A sprite is one plant instance (species + seed) painted by `species.draw` at one quantised
 * growth step, at a pixel size of `species.size × slot.scale × resolution`. Growth is quantised
 * to `GROWTH_STEPS` (24) steps and the garden cross-fades between the two nearest steps, so a
 * growing plant looks perfectly continuous while only ever painting 25 images. Finished plants
 * only ever need the last step.
 *
 * Painting is slow (10–100 ms per sprite), so it never happens inside a frame: requests go into a
 * priority queue that a small pool of module workers (OffscreenCanvas) drains; without workers
 * the queue is drained on the main thread one sprite per idle callback. Results live in a
 * byte-budgeted LRU. The plant view has its own cache on the same mechanism (one lazily spawned
 * worker, synchronous renders only where a caller needs pixels now; ADR 0220).
 */

export const GROWTH_STEPS = 24;
/** the step finished plants are drawn at (growth 1) */
export const FINAL_STEP = GROWTH_STEPS;

const clamp01 = (v: number) => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);

/** Nearest growth step, 0..GROWTH_STEPS. */
export function growthStep(growth: number): number {
  return Math.round(clamp01(growth) * GROWTH_STEPS);
}

/** Growth value of a step. */
export const stepGrowth = (step: number): number => Math.max(0, Math.min(GROWTH_STEPS, step)) / GROWTH_STEPS;

/** Growth snapped to the nearest cacheable step (kept for the widget's API). */
export function quantiseGrowth(growth: number): number {
  return stepGrowth(growthStep(growth));
}

export interface StagePair {
  /** lower step */
  lo: number;
  /** upper step (= lo at the end) */
  hi: number;
  /** 0..1: how much of `hi` is shown (0 = only lo) */
  weight: number;
}

/** The two steps around `growth` and the cross-fade weight between them. */
export function stagePair(growth: number): StagePair {
  const v = clamp01(growth) * GROWTH_STEPS;
  const lo = Math.min(GROWTH_STEPS, Math.floor(v + 1e-9));
  if (lo >= GROWTH_STEPS) return { lo: GROWTH_STEPS, hi: GROWTH_STEPS, weight: 0 };
  const weight = Math.max(0, Math.min(1, v - lo));
  return { lo, hi: lo + 1, weight };
}

/**
 * Alphas for an exact cross-fade composited with `lighter` into an empty buffer: premultiplied
 * colours add, so the result is `(1 − w)·lo + w·hi` per pixel (no double-darkening where two
 * translucent washes overlap, as plain source-over would give).
 */
export function crossFadeAlphas(weight: number): { lo: number; hi: number } {
  const w = clamp01(weight);
  return { lo: 1 - w, hi: w };
}

/**
 * Upper bound for sprite resolution (device px per world unit); beyond this sprites upscale.
 * High enough for the camera's closest view (3× at DPR 2 ≈ 5.4 px/unit, ADR 0165): the bucket
 * follows the zoomed scale for the plants in view, the rest stay at the overview's.
 */
export const MAX_SPRITE_RES = 6;
/** No sprite side grows past this many pixels (a tree at full zoom would be ~3500 px tall). */
export const MAX_SPRITE_SIDE = 2048;
export const MIN_SPRITE_RES = 0.25;
/** resolution buckets per octave: re-render only when the scale moves by ≥ ~19 % */
export const RES_BUCKETS_PER_OCTAVE = 4;

/** Sprite resolution bucket for a viewport pixel scale (device px per world unit). */
export function resolutionBucket(pixelScale: number): number {
  const ps = Number.isFinite(pixelScale) && pixelScale > 0 ? pixelScale : 1;
  const r = 2 ** (Math.round(Math.log2(ps) * RES_BUCKETS_PER_OCTAVE) / RES_BUCKETS_PER_OCTAVE);
  return Math.max(MIN_SPRITE_RES, Math.min(MAX_SPRITE_RES, r));
}

/** True when sprites rendered for `from` should be re-rendered for `to`. */
export const significantScaleChange = (from: number, to: number): boolean => resolutionBucket(from) !== resolutionBucket(to);

/**
 * Pixel size of a sprite: species box (world units at slot scale 1) × slot scale × resolution,
 * shrunk to fit `MAX_SPRITE_SIDE` on its long side (memory: a 2048² sprite is 16 MB).
 */
export function spritePixelSize(size: { w: number; h: number }, slotScale: number, res: number): { w: number; h: number } {
  const w = size.w * slotScale * res;
  const h = size.h * slotScale * res;
  const k = Math.min(1, MAX_SPRITE_SIDE / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export interface SpriteSpec {
  speciesId: string;
  seed: number;
  /** growth step 0..GROWTH_STEPS */
  step: number;
  /** pixel size */
  w: number;
  h: number;
}

export const instanceKey = (speciesId: string, seed: number, step: number): string => `${speciesId}|${seed >>> 0}|${step}`;
export const spriteKey = (s: SpriteSpec): string => `${instanceKey(s.speciesId, s.seed, s.step)}|${s.w}x${s.h}`;

/** Painted content inside a sprite, as fractions of its box (resolution independent). */
export interface SpriteBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /**
   * Every pixel with any paint (alpha > 0), padded by `INK_PAD` and clamped, in sprite pixels:
   * what a draw needs to cover. The rest of the box is bare and is not blitted (ADR 0207).
   */
  ink?: PixelRect;
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bare pixels kept round the ink: bilinear sampling at the crop's edge reads only bare pixels. */
export const INK_PAD = 2;

/**
 * The pixel rect holding every pixel with alpha > 0, padded by `pad` and clamped to the image;
 * null when the image is bare. Scans in from each side and stops at the first paint, so a full
 * sprite costs little more than its margins.
 */
export function inkRect(data: ArrayLike<number>, w: number, h: number, pad = INK_PAD): PixelRect | null {
  const a = (x: number, y: number) => data[(y * w + x) * 4 + 3] ?? 0;
  const rowHas = (y: number) => {
    for (let x = 0; x < w; x++) if (a(x, y) > 0) return true;
    return false;
  };
  let top = 0;
  while (top < h && !rowHas(top)) top++;
  if (top >= h) return null;
  let bottom = h - 1;
  while (bottom > top && !rowHas(bottom)) bottom--;
  const colHas = (x: number) => {
    for (let y = top; y <= bottom; y++) if (a(x, y) > 0) return true;
    return false;
  };
  let left = 0;
  while (left < w - 1 && !colHas(left)) left++;
  let right = w - 1;
  while (right > left && !colHas(right)) right--;
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const x1 = Math.min(w, right + 1 + pad);
  const y1 = Math.min(h, bottom + 1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface Sprite {
  key: string;
  spec: SpriteSpec;
  image: CanvasImageSource;
  bytes: number;
  bounds: SpriteBounds | null;
}

/** Bounding box of pixels with alpha > threshold, as fractions; null when empty. */
export function contentBounds(data: ArrayLike<number>, w: number, h: number, threshold = 10): SpriteBounds | null {
  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if ((data[row + x * 4 + 3] ?? 0) > threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        bottom = y;
      }
    }
  }
  if (right < 0) return null;
  return { left: left / w, top: top / h, right: (right + 1) / w, bottom: (bottom + 1) / h };
}

export interface RenderResult {
  image: CanvasImageSource;
  bounds: SpriteBounds | null;
}

type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Paint one sprite now (main thread or worker). Null when no canvas is available. */
export function paintSprite(def: SpeciesDef, spec: SpriteSpec): { canvas: HTMLCanvasElement | OffscreenCanvas; bounds: SpriteBounds | null } | null {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  try {
    canvas = makeCanvas(spec.w, spec.h);
  } catch {
    return null;
  }
  const p = createPainter(canvas, { seed: spec.seed });
  def.draw(p, createRng(spec.seed).fork(def.id), { w: spec.w, h: spec.h, growth: stepGrowth(spec.step) });
  layBodyTwice(canvas);
  let bounds: SpriteBounds | null = null;
  try {
    const ctx = canvas.getContext('2d') as AnyCtx | null;
    if (ctx) {
      const data = ctx.getImageData(0, 0, spec.w, spec.h).data;
      bounds = contentBounds(data, spec.w, spec.h);
      const ink = bounds && inkRect(data, spec.w, spec.h);
      if (bounds && ink) bounds.ink = ink;
    }
  } catch {
    bounds = null;
  }
  return { canvas, bounds };
}

/**
 * A plant sprite's body laid twice (ADR 0187): the sprite is transparent watercolour painted on
 * white, and laid once over the landscape it let a third of it through — the hill line and the
 * banks crossed leaves and petals seen close. Doubled, it reads as solid paint (the landscape keeps
 * a ninth) while its washes, pooled edges and overlaps stay the painting's. Done once when the
 * sprite is painted, so it costs nothing per frame.
 */
export const SPRITE_BODY = 1;

function layBodyTwice(canvas: HTMLCanvasElement | OffscreenCanvas): void {
  if (SPRITE_BODY <= 0) return;
  let copy: HTMLCanvasElement | OffscreenCanvas;
  try {
    copy = makeCanvas(canvas.width, canvas.height);
  } catch {
    return;
  }
  const cctx = copy.getContext('2d') as AnyCtx | null;
  const ctx = canvas.getContext('2d') as AnyCtx | null;
  if (!cctx || !ctx) return;
  cctx.drawImage(canvas as CanvasImageSource, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = SPRITE_BODY;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(copy as CanvasImageSource, 0, 0);
  ctx.restore();
}

export const renderSpriteSync = (def: SpeciesDef, spec: SpriteSpec): RenderResult | null => {
  const r = paintSprite(def, spec);
  return r ? { image: r.canvas, bounds: r.bounds } : null;
};

// ---------------------------------------------------------------------------------------------
// LRU with a byte budget

/** Byte-budgeted LRU of sprites. Entries used in the current epoch are never evicted. */
export class SpriteLru {
  private readonly map = new Map<string, Sprite & { epoch: number }>();
  private readonly byInstance = new Map<string, Set<string>>();
  private total = 0;
  epoch = 0;
  evicted = 0;

  constructor(
    public budget: number,
    private readonly onEvict?: (s: Sprite) => void,
  ) {}

  get bytes(): number {
    return this.total;
  }
  get size(): number {
    return this.map.size;
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Look up and mark as used now (moves to the most-recent end). */
  get(key: string): Sprite | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    e.epoch = this.epoch;
    this.map.set(key, e);
    return e;
  }

  peek(key: string): Sprite | undefined {
    return this.map.get(key);
  }

  set(s: Sprite): void {
    const old = this.map.get(s.key);
    if (old) this.remove(old.key);
    this.map.set(s.key, { ...s, epoch: this.epoch });
    this.total += s.bytes;
    const ik = instanceKey(s.spec.speciesId, s.spec.seed, s.spec.step);
    let set = this.byInstance.get(ik);
    if (!set) this.byInstance.set(ik, (set = new Set()));
    set.add(s.key);
    this.trim();
  }

  /** The cached sprite of this instance+step whose width is closest to `w` (any resolution). */
  best(speciesId: string, seed: number, step: number, w: number): Sprite | undefined {
    const set = this.byInstance.get(instanceKey(speciesId, seed, step));
    if (!set) return undefined;
    let best: string | undefined;
    let bestD = Infinity;
    for (const k of set) {
      const s = this.map.get(k);
      if (!s) continue;
      const d = Math.abs(Math.log(s.spec.w / Math.max(1, w)));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best ? this.get(best) : undefined;
  }

  remove(key: string): boolean {
    const e = this.map.get(key);
    if (!e) return false;
    this.map.delete(key);
    this.total -= e.bytes;
    const ik = instanceKey(e.spec.speciesId, e.spec.seed, e.spec.step);
    const set = this.byInstance.get(ik);
    set?.delete(key);
    if (set && set.size === 0) this.byInstance.delete(ik);
    this.onEvict?.(e);
    return true;
  }

  /** Evict least-recently-used entries (never ones used in the current epoch) until within budget. */
  trim(): void {
    if (this.total <= this.budget) return;
    for (const [k, e] of this.map) {
      if (this.total <= this.budget) break;
      if (e.epoch === this.epoch) continue;
      this.remove(k);
      this.evicted++;
    }
  }

  clear(): void {
    for (const k of [...this.map.keys()]) this.remove(k);
  }

  /** Drop every entry the predicate picks (except ones used this epoch); returns how many. */
  evictWhere(pick: (spec: SpriteSpec) => boolean): number {
    let n = 0;
    for (const [k, e] of [...this.map]) {
      if (e.epoch === this.epoch || !pick(e.spec)) continue;
      this.remove(k);
      this.evicted++;
      n++;
    }
    return n;
  }
}

// ---------------------------------------------------------------------------------------------
// Scheduling: a priority queue drained by workers (or idle callbacks)

/** Lower runs sooner. */
export const PRIORITY = {
  /** the growing plant's current stages */
  now: 0,
  /** the growing plant's next stage */
  next: 1,
  /** visible finished plants, ghost preview */
  visible: 2,
  /** re-render at a new resolution (an older one is still shown) */
  rescale: 3,
  /** pre-render further ahead */
  ahead: 4,
  /**
   * prewarm (the planting sheet's previews, ADR 0221): dispatched only while no other sprite
   * cache has work below this priority, so it never competes with garden sprites on screen
   */
  idle: 5,
} as const;

export interface WorkerLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message' | 'error', fn: (e: MessageEvent | Event) => void): void;
  terminate(): void;
}

export interface IdleDeadlineLike {
  timeRemaining(): number;
  didTimeout?: boolean;
}

export interface SpriteCacheOptions {
  getSpecies(id: string): SpeciesDef | undefined;
  /** default 64 MB */
  budgetBytes?: number;
  /** worker factory; return null for none. Default: module workers when OffscreenCanvas exists. */
  createWorker?: (() => WorkerLike | null) | null;
  /** number of workers (default min(2, cores − 1), at least 1) */
  workers?: number;
  /** main-thread fallback scheduling (default requestIdleCallback / setTimeout) */
  scheduleIdle?: (cb: (d: IdleDeadlineLike) => void) => void;
  /** main-thread renderer (default `renderSpriteSync`) */
  renderSync?: (def: SpeciesDef, spec: SpriteSpec) => RenderResult | null;
  /** spawn the workers on the first `request` instead of at creation (the plant view's cache) */
  lazyWorkers?: boolean;
}

export interface SpriteCacheStats {
  entries: number;
  bytes: number;
  budget: number;
  queued: number;
  inFlight: number;
  rendered: number;
  evicted: number;
  workers: number;
  failed: number;
}

export interface SpriteCache {
  /** exact sprite (marks it used this epoch) */
  get(spec: SpriteSpec): Sprite | undefined;
  /** this instance+step at any resolution, closest to `w` */
  best(speciesId: string, seed: number, step: number, w: number): Sprite | undefined;
  has(spec: SpriteSpec): boolean;
  /** queue a render if missing (raises the priority of an already queued one) */
  request(spec: SpriteSpec, priority: number): void;
  /** true while the sprite is queued or being painted */
  pending(spec: SpriteSpec): boolean;
  /**
   * Resolves true once the sprite is cached (at once when it already is), false when it cannot
   * be: unknown species, a failed render, or dropped from the queue (`dropQueued`, `clear`,
   * `dispose`) or never requested.
   */
  whenReady(spec: SpriteSpec): Promise<boolean>;
  /** render now on this thread if missing (the plant view's first frame) */
  ensureSync(spec: SpriteSpec): Sprite | undefined;
  /** start a new frame epoch (entries used in it are protected from eviction) */
  beginFrame(): void;
  /** resolves once nothing is queued or in flight */
  whenIdle(): Promise<void>;
  stats(): SpriteCacheStats;
  setBudget(bytes: number): void;
  /** drop cached sprites the predicate picks (not ones drawn this frame), e.g. far-off high-res ones */
  evictWhere(pick: (spec: SpriteSpec) => boolean): number;
  /** forget queued (not yet started) renders the predicate picks */
  dropQueued(pick: (spec: SpriteSpec) => boolean): void;
  clear(): void;
  dispose(): void;
}

interface Job {
  spec: SpriteSpec;
  key: string;
  priority: number;
  seq: number;
  /** the worker could not paint it: main thread only */
  mainOnly?: boolean;
}

interface WorkerSlot {
  worker: WorkerLike;
  busy: Job | null;
  dead: boolean;
}

/** Byte budget (the camera's close views need sharper sprites for the plants in view). */
export const DEFAULT_BUDGET = 96 * 1024 * 1024;

/** Message protocol of `sprite-worker.ts`. */
export type WorkerRequest = { type: 'render'; id: number } & SpriteSpec;
export type WorkerReply =
  | { type: 'done'; id: number; bitmap: ImageBitmap; bounds: SpriteBounds | null }
  | { type: 'error'; id: number; reason: 'unknown' | 'failed'; message?: string };

function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    return new Worker(new URL('./sprite-worker.ts', import.meta.url), { type: 'module', name: 'plant-sprites' }) as unknown as WorkerLike;
  } catch {
    return null;
  }
}

function defaultIdle(cb: (d: IdleDeadlineLike) => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: (d: IdleDeadlineLike) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 250 });
  else setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: true }), 16);
}

/**
 * Every live sprite cache (the garden's, the plant view's): a cache holds its `idle`-priority
 * jobs while another one has more urgent work, and wakes the others when it goes quiet (ADR 0221).
 */
interface PeerCache {
  busy(): boolean;
  wake(): void;
}
const peers = new Set<PeerCache>();

const closeImage = (s: Sprite) => {
  const img = s.image as { close?: () => void };
  if (typeof img.close === 'function' && typeof ImageBitmap !== 'undefined' && s.image instanceof ImageBitmap) img.close();
};

export function createSpriteCache(opts: SpriteCacheOptions): SpriteCache {
  const lru = new SpriteLru(opts.budgetBytes ?? DEFAULT_BUDGET, closeImage);
  const renderSync = opts.renderSync ?? renderSpriteSync;
  const scheduleIdle = opts.scheduleIdle ?? defaultIdle;
  const queue = new Map<string, Job>();
  const inFlight = new Map<number, { job: Job; slot: WorkerSlot }>();
  const failedKeys = new Set<string>();
  const idleWaiters: Array<() => void> = [];
  let seq = 0;
  let nextId = 1;
  let rendered = 0;
  let idleScheduled = false;
  let disposed = false;

  const factory = opts.createWorker === undefined ? defaultWorkerFactory : opts.createWorker;
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
  const wanted = factory ? Math.max(1, opts.workers ?? Math.min(2, cores - 1)) : 0;
  const slots: WorkerSlot[] = [];
  let spawned = false;
  function spawnWorkers(): void {
    if (spawned) return;
    spawned = true;
    for (let i = 0; i < wanted; i++) {
      const worker = factory?.();
      if (!worker) break;
      const slot: WorkerSlot = { worker, busy: null, dead: false };
      worker.addEventListener('message', (e) => onReply(slot, (e as MessageEvent<WorkerReply>).data));
      worker.addEventListener('error', () => onWorkerDead(slot));
      slots.push(slot);
    }
  }
  if (!opts.lazyWorkers) spawnWorkers();

  const liveWorkers = () => slots.filter((s) => !s.dead);

  /** waiters per sprite key (`whenReady`) */
  const readyWaiters = new Map<string, Array<(ok: boolean) => void>>();
  function settleReady(key: string, ok: boolean): void {
    const list = readyWaiters.get(key);
    if (!list) return;
    readyWaiters.delete(key);
    for (const fn of list) fn(ok);
  }
  /** fail the waiters whose sprite is neither cached nor pending any more */
  function settleOrphans(): void {
    for (const key of [...readyWaiters.keys()]) if (!lru.has(key) && !isPending(key)) settleReady(key, false);
  }

  function settleIdle(): void {
    if (queue.size > 0 || inFlight.size > 0) return;
    for (const fn of idleWaiters.splice(0)) fn();
  }

  function store(job: Job, image: CanvasImageSource, bounds: SpriteBounds | null): void {
    lru.set({ key: job.key, spec: job.spec, image, bytes: job.spec.w * job.spec.h * 4, bounds });
    rendered++;
    settleReady(job.key, lru.has(job.key));
  }

  function fail(key: string): void {
    failedKeys.add(key);
    settleReady(key, false);
  }

  /** work below `PRIORITY.idle` queued or in flight: other caches hold their prewarms meanwhile */
  const busy = () => [...queue.values()].some((j) => j.priority < PRIORITY.idle) || [...inFlight.values()].some((e) => e.job.priority < PRIORITY.idle);
  const peer: PeerCache = { busy, wake: () => pump() };
  peers.add(peer);
  let wasBusy = false;
  /** on going quiet, let the other caches dispatch the prewarms they held */
  function noteBusy(): void {
    const b = busy();
    if (wasBusy && !b) for (const p of [...peers]) if (p !== peer) p.wake();
    wasBusy = b;
  }
  const othersBusy = () => [...peers].some((p) => p !== peer && p.busy());

  function takeNext(filter: (j: Job) => boolean): Job | undefined {
    let best: Job | undefined;
    const hold = othersBusy();
    for (const j of queue.values()) {
      if (!filter(j)) continue;
      if (hold && j.priority >= PRIORITY.idle) continue;
      if (!best || j.priority < best.priority || (j.priority === best.priority && j.seq < best.seq)) best = j;
    }
    if (best) queue.delete(best.key);
    return best;
  }

  function pump(): void {
    if (disposed) return;
    if (queue.size > 0) spawnWorkers();
    for (const slot of liveWorkers()) {
      if (slot.busy) continue;
      const job = takeNext((j) => !j.mainOnly);
      if (!job) break;
      const id = nextId++;
      slot.busy = job;
      inFlight.set(id, { job, slot });
      const msg: WorkerRequest = { type: 'render', id, ...job.spec };
      slot.worker.postMessage(msg);
    }
    const hold = othersBusy();
    const needMain = [...queue.values()].some((j) => (j.mainOnly || liveWorkers().length === 0) && !(hold && j.priority >= PRIORITY.idle));
    if (needMain && !idleScheduled) {
      idleScheduled = true;
      scheduleIdle(runIdle);
    }
    noteBusy();
    settleIdle();
  }

  function runIdle(deadline: IdleDeadlineLike): void {
    idleScheduled = false;
    if (disposed) return;
    const noWorkers = liveWorkers().length === 0;
    // one sprite per idle period (a sprite can take tens of ms); more if there is clearly time
    let budget = 1;
    while (budget-- > 0 || deadline.timeRemaining() > 12) {
      const job = takeNext((j) => noWorkers || !!j.mainOnly);
      if (!job) break;
      const def = opts.getSpecies(job.spec.speciesId);
      let r: RenderResult | null = null;
      try {
        r = def ? renderSync(def, job.spec) : null;
      } catch (err) {
        console.warn('[plants] sprite render failed', job.key, err);
      }
      if (r) store(job, r.image, r.bounds);
      else fail(job.key);
      if (deadline.timeRemaining() <= 0) break;
    }
    pump();
  }

  function onReply(slot: WorkerSlot, msg: WorkerReply): void {
    const entry = inFlight.get(msg.id);
    if (!entry) return;
    inFlight.delete(msg.id);
    slot.busy = null;
    if (msg.type === 'done') {
      if (!disposed) store(entry.job, msg.bitmap, msg.bounds);
      else msg.bitmap.close?.();
    } else {
      // the worker does not know this species (e.g. injected at runtime) or failed: try here
      queue.set(entry.job.key, { ...entry.job, mainOnly: true });
    }
    pump();
  }

  function onWorkerDead(slot: WorkerSlot): void {
    if (slot.dead) return;
    slot.dead = true;
    try {
      slot.worker.terminate();
    } catch {
      /* already gone */
    }
    for (const [id, e] of inFlight) {
      if (e.slot !== slot) continue;
      inFlight.delete(id);
      queue.set(e.job.key, e.job);
    }
    slot.busy = null;
    pump();
  }

  function isPending(key: string): boolean {
    return queue.has(key) || [...inFlight.values()].some((e) => e.job.key === key);
  }

  return {
    get: (spec) => lru.get(spriteKey(spec)),
    best: (speciesId, seed, step, w) => lru.best(speciesId, seed, step, w),
    has: (spec) => lru.has(spriteKey(spec)),
    request(spec, priority) {
      if (disposed) return;
      const key = spriteKey(spec);
      if (lru.has(key) || failedKeys.has(key)) return;
      const q = queue.get(key);
      if (q) {
        if (priority < q.priority) {
          q.priority = priority;
          pump(); // a held prewarm may run now
        }
        return;
      }
      if (isPending(key)) {
        // in flight: a raise only matters to the cross-cache hold
        for (const e of inFlight.values()) if (e.job.key === key && priority < e.job.priority) e.job.priority = priority;
        noteBusy();
        return;
      }
      if (!opts.getSpecies(spec.speciesId)) return;
      queue.set(key, { spec: { ...spec }, key, priority, seq: seq++ });
      pump();
    },
    pending: (spec) => isPending(spriteKey(spec)),
    whenReady(spec) {
      const key = spriteKey(spec);
      if (lru.has(key)) return Promise.resolve(true);
      if (disposed || failedKeys.has(key) || !isPending(key)) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const list = readyWaiters.get(key);
        if (list) list.push(resolve);
        else readyWaiters.set(key, [resolve]);
      });
    },
    ensureSync(spec) {
      const key = spriteKey(spec);
      const hit = lru.get(key);
      if (hit) return hit;
      const def = opts.getSpecies(spec.speciesId);
      if (!def) return undefined;
      const r = renderSync(def, spec);
      if (!r) return undefined;
      queue.delete(key);
      store({ spec: { ...spec }, key, priority: 0, seq: seq++ }, r.image, r.bounds);
      noteBusy();
      settleIdle();
      return lru.get(key);
    },
    beginFrame() {
      lru.epoch++;
    },
    whenIdle() {
      if (queue.size === 0 && inFlight.size === 0) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
    stats: () => ({
      entries: lru.size,
      bytes: lru.bytes,
      budget: lru.budget,
      queued: queue.size,
      inFlight: inFlight.size,
      rendered,
      evicted: lru.evicted,
      workers: liveWorkers().length,
      failed: failedKeys.size,
    }),
    setBudget(bytes) {
      lru.budget = bytes;
      lru.trim();
    },
    evictWhere: (pick) => lru.evictWhere(pick),
    dropQueued(pick) {
      for (const [k, j] of [...queue]) if (pick(j.spec)) queue.delete(k);
      settleOrphans();
      noteBusy();
      settleIdle();
    },
    clear() {
      queue.clear();
      lru.clear();
      settleOrphans();
      noteBusy();
      settleIdle();
    },
    dispose() {
      disposed = true;
      peers.delete(peer);
      if (wasBusy) for (const p of [...peers]) p.wake();
      queue.clear();
      for (const s of slots) {
        s.dead = true;
        s.worker.terminate();
      }
      inFlight.clear();
      lru.clear();
      for (const key of [...readyWaiters.keys()]) settleReady(key, false);
      for (const fn of idleWaiters.splice(0)) fn();
    },
  };
}
