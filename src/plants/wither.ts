import { ease } from './watering';
import { crossFade, drawPlant, scratch, type Box } from './draw';

/**
 * Withering (SPEC §2 Cancel, docs/systems/plants.md › Wither, ADR 0115): when a session is
 * ended the seedling gently gives up over ~3 s — its colour drains toward dry ochre, it droops
 * sideways and sinks, and it dissolves from the top into the soil — then it is gone.
 */

export const WITHER_SECONDS = 3;

export interface WitherState {
  /** 0..1 toward the dried, desaturated ochre image */
  tint: number;
  /** sideways droop at the top, as a fraction of the height (sign from the plant's seed) */
  droop: number;
  /** vertical scale about the base */
  squash: number;
  /** 0..1 dissolved from the top down */
  sink: number;
  alpha: number;
  done: boolean;
}

export function witherState(u: number): WitherState {
  const v = Number.isFinite(u) ? Math.max(0, Math.min(1, u)) : 0;
  return {
    tint: ease(0, 0.5, v),
    droop: 0.24 * ease(0.08, 0.8, v),
    squash: 1 - 0.34 * ease(0.15, 0.9, v),
    sink: ease(0.3, 1, v),
    alpha: 1 - ease(0.55, 1, v),
    done: v >= 1,
  };
}

/** Dry ochre the colour drains toward. */
export const OCHRE = { r: 176, g: 146, b: 96 } as const;

/**
 * Desaturate RGBA pixels toward ochre by `amount` (0..1), in place. Keeps luminance roughly,
 * so the brush marks stay readable while the colour goes.
 */
export function witherPixels(data: Uint8ClampedArray | number[], amount: number): void {
  const k = Math.max(0, Math.min(1, amount));
  if (k === 0) return;
  const o = OCHRE;
  const oLum = 0.299 * o.r + 0.587 * o.g + 0.114 * o.b;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    // a touch lighter, as dried leaves are
    const f = Math.min(1.6, (l * 1.06 + 8) / oLum);
    data[i] = r + (Math.min(255, o.r * f) - r) * k;
    data[i + 1] = g + (Math.min(255, o.g * f) - g) * k;
    data[i + 2] = b + (Math.min(255, o.b * f) - b) * k;
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const witheredCache = new WeakMap<object, AnyCanvas | null>();

/** The fully withered twin of a sprite image (computed once per image). */
export function witheredImage(img: CanvasImageSource, w: number, h: number, cacheable = true): AnyCanvas | null {
  const hit = cacheable ? witheredCache.get(img as object) : undefined;
  if (hit !== undefined) return hit;
  let out: AnyCanvas | null = null;
  try {
    out = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true }) as Ctx | null;
    if (!ctx) throw new Error('no 2d');
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    witherPixels(px.data, 1);
    ctx.putImageData(px, 0, 0);
  } catch {
    out = null;
  }
  if (cacheable) witheredCache.set(img as object, out);
  return out;
}

/**
 * Draw a withering plant: `img` is the sprite at the growth it reached, `box` its world box,
 * (baseX, baseY) its base, `u` 0..1 through the wither, `side` the droop direction.
 */
export function drawWithering(
  ctx: Ctx,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  box: Box,
  baseX: number,
  baseY: number,
  u: number,
  side: 1 | -1,
  /** false when `img` is a reused buffer whose pixels change (no caching of its dried twin) */
  stableImage = true,
  /** opacity of a second pass of the plant under the first (the garden's plants are laid twice, ADR 0187) */
  body = 0,
): void {
  const st = witherState(u);
  if (st.alpha <= 0.003) return;
  const dried = st.tint > 0 ? witheredImage(img, imgW, imgH, stableImage) : null;
  const buf = scratch('wither', imgW, imgH);
  let source: CanvasImageSource = img;
  if (buf) {
    crossFade(buf, img, dried, st.tint);
    if (st.sink > 0) {
      // dissolve from the top: an erasing wash whose lower edge descends toward the soil
      const g = buf.ctx.createLinearGradient(0, 0, 0, imgH);
      const edge = Math.min(0.999, st.sink);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, st.sink * 1.4)})`);
      g.addColorStop(edge, `rgba(0,0,0,${st.sink * 0.6})`);
      g.addColorStop(Math.min(1, edge + 0.001 + (1 - edge) * 0.6), 'rgba(0,0,0,0)');
      buf.ctx.globalCompositeOperation = 'destination-out';
      buf.ctx.fillStyle = g;
      buf.ctx.fillRect(0, 0, imgW, imgH);
      buf.ctx.globalCompositeOperation = 'source-over';
    }
    source = buf.canvas;
  }
  const pose = { lean: st.droop * side, bend: 2, scaleY: st.squash, alpha: st.alpha };
  if (body > 0) drawPlant(ctx, source, box, baseX, baseY, { ...pose, alpha: st.alpha * body });
  drawPlant(ctx, source, box, baseX, baseY, pose);
}
