/**
 * Rim light for painted sprites (ADR 0146): the thin band along a shape's sun-facing edge, the
 * way a painter leaves the lit side of a leaf or a stone a little lighter and warmer when the sun
 * is low. Built once per sprite bitmap, side and colour — the sprite's own alpha minus a copy of
 * itself shifted away from the sun keeps only the edge pixels that face the light — and drawn
 * over the sprite with `screen` at the phase's strength, so it costs one extra blit per sprite.
 */
import { makeCanvas, type AnyCanvas, type Ctx2D } from './canvas';

export interface RimSpec {
  /** lit side: −1 left, +1 right */
  side: -1 | 1;
  /** 0..1 */
  strength: number;
  rgb: readonly [number, number, number];
}

type Source = CanvasImageSource & { width: number; height: number };

export interface RimCache {
  /** `k`: the bitmap's resolution relative to the one rim widths were tuned at (default 1) */
  get(image: CanvasImageSource, side: -1 | 1, rgb: readonly [number, number, number], k?: number): AnyCanvas | null;
  /** masks built so far (perf / tests) */
  readonly built: number;
}

/**
 * Rim width in sprite pixels for a sprite of this size (≈ 4 % of its smaller side, 1.5–9 px at the
 * reference resolution). `k` is the bitmap's resolution relative to that reference: a sharper
 * bitmap of the same thing gets a proportionally wider rim, so the rim keeps its place on the
 * plant at every zoom (ADR 0187).
 */
export function rimWidth(w: number, h: number, k = 1): number {
  const s = k > 0 ? k : 1;
  return Math.max(1.5, Math.min(9, (Math.min(w, h) * 0.04) / s)) * s;
}

/** Colours are quantised so a slow blend reuses a few masks instead of building new ones. */
const quant = (rgb: readonly number[]) => rgb.map((c) => Math.min(255, Math.round(c / 16) * 16));

/** A sprite's lit edge as a coloured mask (null when canvases are unavailable). */
export function rimMask(image: CanvasImageSource, side: -1 | 1, rgb: readonly [number, number, number], k = 1): AnyCanvas | null {
  const src = image as Source;
  const w = Math.max(1, Math.round(src.width));
  const h = Math.max(1, Math.round(src.height));
  let canvas: AnyCanvas;
  try {
    canvas = makeCanvas(w, h);
  } catch {
    return null;
  }
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!ctx) return null;
  const d = rimWidth(w, h, k);
  ctx.drawImage(image, 0, 0, w, h);
  // remove every pixel whose neighbour toward the sun (to the side and a little above) is covered
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(image, -side * d, d * 0.45, w, h);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(image, -side * d * 0.5, d * 0.25, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-in';
  const [r, g, b] = quant(rgb);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

export function createRimCache(): RimCache {
  const masks = new WeakMap<object, Map<string, AnyCanvas | null>>();
  let built = 0;
  return {
    get(image, side, rgb, k = 1) {
      let byKey = masks.get(image as object);
      if (!byKey) masks.set(image as object, (byKey = new Map()));
      const kq = Math.round(k * 8) / 8 || 1;
      const key = `${side}:${quant(rgb).join(',')}:${kq}`;
      let m = byKey.get(key);
      if (m === undefined) {
        m = rimMask(image, side, rgb, kq);
        byKey.set(key, m);
        built++;
      }
      return m;
    },
    get built() {
      return built;
    },
  };
}

/** Draw a sprite's rim light into `box` (current user space; any transform already applied). */
export function drawRim(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cache: RimCache,
  image: CanvasImageSource,
  box: { x: number; y: number; w: number; h: number },
  rim: RimSpec,
  alpha = 1,
  k = 1,
): void {
  const a = rim.strength * alpha;
  if (a <= 0.01) return;
  const mask = cache.get(image, rim.side, rim.rgb, k);
  if (!mask) return;
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = prevAlpha * Math.min(1, a);
  ctx.drawImage(mask as CanvasImageSource, box.x, box.y, box.w, box.h);
  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}
