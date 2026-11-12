/**
 * Canvas helpers shared by the paint engine. Nothing here touches the DOM at import time, so
 * modules that import the engine stay safe in unit tests (node / jsdom without a canvas).
 */

/** Any 2D context the engine can paint into. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A canvas the engine can create and draw: OffscreenCanvas when available, else a DOM canvas. */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * Create an offscreen canvas of `w × h` pixels (rounded up, at least 1×1).
 * Prefers `OffscreenCanvas`; falls back to `document.createElement('canvas')`.
 * Throws only when neither is available (e.g. plain node) — importing is always safe.
 */
export function makeCanvas(w: number, h: number): AnyCanvas {
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(cw, ch);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  }
  throw new Error('makeCanvas: no OffscreenCanvas or document available');
}

/** 2D context of a canvas made by `makeCanvas` (or any canvas). Throws if unavailable. */
export function context2d(canvas: AnyCanvas, opts?: CanvasRenderingContext2DSettings): Ctx2D {
  const ctx = canvas.getContext('2d', opts) as Ctx2D | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

/**
 * Small pool of CPU-backed (`willReadFrequently`) work canvases used by wet layers, so the
 * per-primitive pixel pass never forces a GPU readback and never allocates a new canvas.
 */
interface PooledCanvas {
  canvas: AnyCanvas;
  ctx: Ctx2D;
}

const pool: PooledCanvas[] = [];

/** Borrow a cleared work canvas of at least `w × h` (exact size set). Return it with `releaseWork`. */
export function acquireWork(w: number, h: number): PooledCanvas {
  const item = pool.pop() ?? createWork();
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  // Assigning width/height (even to the same value) clears the bitmap and resets all context
  // state, including any clip left behind.
  item.canvas.width = cw;
  item.canvas.height = ch;
  return item;
}

export function releaseWork(item: PooledCanvas): void {
  if (pool.length < 4) pool.push(item);
  releases++;
  trimSoon();
}

/** ms without a wet layer after which the pooled work canvases shrink to 1×1 (devlog 158) */
export const WORK_QUIET_MS = 4000;
let releases = 0;
let trimTimer: ReturnType<typeof setTimeout> | null = null;

/** One timer per quiet period: the pool is trimmed once a whole period passes without a release. */
function trimSoon(): void {
  if (trimTimer !== null || typeof setTimeout === 'undefined') return;
  const seen = releases;
  trimTimer = setTimeout(() => {
    trimTimer = null;
    if (releases === seen) trimWork();
    else trimSoon();
  }, WORK_QUIET_MS);
}

/** Shrink the idle pooled work canvases to 1×1 (`acquireWork` sizes them again). Returns the pixels freed. */
export function trimWork(): number {
  let freed = 0;
  for (const { canvas } of pool) {
    freed += canvas.width * canvas.height - 1;
    canvas.width = 1;
    canvas.height = 1;
  }
  return freed;
}

/** Backing pixels of the idle pooled work canvases. */
export function workPixels(): number {
  return pool.reduce((n, { canvas }) => n + canvas.width * canvas.height, 0);
}

function createWork(): PooledCanvas {
  const canvas = makeCanvas(1, 1);
  return { canvas, ctx: context2d(canvas, { willReadFrequently: true }) };
}
