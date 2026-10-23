/**
 * Painted creature parts: each part is painted once with the watercolour engine into a small
 * transparent canvas (a `Sprite`) and composed per frame with plain `drawImage` transforms.
 */
import { createRng, type Rng } from '../core/rng';
import { createPainter, makeCanvas, PIGMENTS, type AnyCanvas, type Painter, type Pigment } from '../paint';

export interface Sprite {
  img: AnyCanvas;
  /** box size in world units */
  w: number;
  h: number;
  /** anchor (origin of the painting coordinates) inside the box, world units from the top-left */
  ox: number;
  oy: number;
}

export interface SpriteBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** Paint `paint(p, rng)` in sprite-local world units (origin = anchor) at `res` px per unit. */
export function paintSprite(res: number, box: SpriteBox, seed: number, paint: (p: Painter, rng: Rng) => void): Sprite {
  const img = makeCanvas(box.w * res, box.h * res);
  const p = createPainter(img, { seed, quality: 'normal' });
  p.ctx.setTransform(res, 0, 0, res, box.ox * res, box.oy * res);
  paint(p, createRng(seed));
  return { img, ...box };
}

/**
 * A softened, cooler copy (seen through deeper water): the sprite drawn small and back up
 * (a cheap blur that works on every canvas), then tinted with a cool glaze over its own pixels.
 */
export function deepCopy(s: Sprite, res: number, tint: Pigment = PIGMENTS.celadonDeep, tintAlpha = 0.2, blur = 3): Sprite {
  const W = Math.max(1, Math.ceil(s.w * res));
  const H = Math.max(1, Math.ceil(s.h * res));
  const small = makeCanvas(Math.max(1, W / blur), Math.max(1, H / blur));
  const sctx = small.getContext('2d') as CanvasRenderingContext2D;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(s.img as CanvasImageSource, 0, 0, small.width, small.height);
  const out = makeCanvas(W, H);
  const o = out.getContext('2d') as CanvasRenderingContext2D;
  o.imageSmoothingQuality = 'high';
  o.globalAlpha = 0.55;
  o.drawImage(s.img as CanvasImageSource, 0, 0, W, H);
  o.globalAlpha = 1;
  o.drawImage(small as CanvasImageSource, 0, 0, W, H);
  o.globalCompositeOperation = 'source-atop';
  o.globalAlpha = tintAlpha;
  o.fillStyle = tint;
  o.fillRect(0, 0, W, H);
  return { ...s, img: out };
}

/** Draw a sprite with its anchor at (x, y), rotated, scaled and faded. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, rot = 0, sx = 1, sy = sx, alpha = 1): void {
  if (alpha <= 0.004) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

/**
 * Painted parts cached per key and resolution. The resolution follows the view: the overview's
 * pixel scale, or a resting close view's (ADR 0188). A part missing at the current resolution is
 * painted at once only when no other resolution has it; otherwise the copy at the other
 * resolution keeps drawing and the sharp one is queued for idle time (`paintPending`), so a
 * camera coming to rest never stalls a frame. Two resolutions are kept at most (the current one
 * and the one before it), so memory stays bounded and a return to the overview repaints nothing.
 */
export class ArtCache {
  private maps = new Map<number, Map<string, unknown>>();
  private _res = 2;
  private queue = new Map<string, (res: number) => unknown>();
  /** number of parts painted since creation (perf / tests) */
  painted = 0;

  get res(): number {
    return this._res;
  }

  /** The bucket a pixel scale paints at (small resizes keep the cache). */
  static bucket(pxPerUnit: number): number {
    return Math.max(1.5, Math.min(6, Math.round(pxPerUnit * 4) / 4));
  }

  /** Device px per world unit to paint at. */
  setRes(pxPerUnit: number): void {
    const r = ArtCache.bucket(pxPerUnit);
    if (r === this._res) return;
    const prev = this._res;
    this._res = r;
    this.queue.clear();
    for (const k of [...this.maps.keys()]) if (k !== r && k !== prev) this.maps.delete(k);
  }

  get<T>(key: string, make: (res: number) => T): T {
    const map = this.mapFor(this._res);
    let v = map.get(key) as T | undefined;
    if (v !== undefined) return v;
    for (const [res, other] of this.maps) {
      if (res === this._res) continue;
      const old = other.get(key) as T | undefined;
      if (old !== undefined) {
        this.queue.set(key, make);
        return old;
      }
    }
    v = make(this._res);
    map.set(key, v);
    this.painted++;
    return v;
  }

  /** parts waiting to be painted at the current resolution */
  get pending(): number {
    return this.queue.size;
  }

  /** Paint queued parts until `budgetMs` has passed; returns how many are left. */
  paintPending(budgetMs: number, now: () => number = () => performance.now()): number {
    const t0 = now();
    const map = this.mapFor(this._res);
    for (const [key, make] of this.queue) {
      this.queue.delete(key);
      if (!map.has(key)) {
        map.set(key, make(this._res));
        this.painted++;
      }
      if (now() - t0 >= budgetMs) break;
    }
    return this.queue.size;
  }

  private mapFor(res: number): Map<string, unknown> {
    let m = this.maps.get(res);
    if (!m) this.maps.set(res, (m = new Map()));
    return m;
  }

  private scratchCanvas: AnyCanvas | null = null;

  /**
   * A shared square work canvas of at least `px` × `px`, cleared, for composing a multi-part
   * creature at full opacity before blitting it faded (no double alpha where parts overlap).
   */
  scratch(px: number): { canvas: AnyCanvas; ctx: CanvasRenderingContext2D; size: number } {
    const size = Math.max(16, Math.ceil(px));
    let c = this.scratchCanvas;
    if (!c || c.width < size) {
      c = makeCanvas(size, size);
      this.scratchCanvas = c;
    }
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, size + 1, size + 1);
    return { canvas: c, ctx, size };
  }

  has(key: string): boolean {
    return this.maps.get(this._res)?.has(key) ?? false;
  }

  clear(): void {
    this.maps.clear();
    this.queue.clear();
  }
}
