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
export function deepCopy(s: Sprite, res: number, tint: Pigment = PIGMENTS.celadonDeep, tintAlpha = 0.3, blur = 3): Sprite {
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
 * Painted parts cached per key at one resolution. Changing the resolution (resize, studio zoom)
 * drops the cache; parts are repainted lazily on next use.
 */
export class ArtCache {
  private map = new Map<string, unknown>();
  private _res = 2;
  /** number of parts painted since creation (perf / tests) */
  painted = 0;

  get res(): number {
    return this._res;
  }

  /** Device px per world unit to paint at (bucketed so small resizes keep the cache). */
  setRes(pxPerUnit: number): void {
    const r = Math.max(1.5, Math.min(6, Math.round(pxPerUnit * 4) / 4));
    if (r !== this._res) {
      this._res = r;
      this.map.clear();
    }
  }

  get<T>(key: string, make: (res: number) => T): T {
    let v = this.map.get(key) as T | undefined;
    if (v === undefined) {
      v = make(this._res);
      this.map.set(key, v);
      this.painted++;
    }
    return v;
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
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}
