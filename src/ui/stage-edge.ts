import { createRng } from '../core/rng';
import { createValueNoise2D } from '../paint/noise'; // values in -1..1

/**
 * The garden's edge as an alpha mask (ADR 0132), applied to the canvas with CSS `mask-image`
 * so the painting dissolves into the page's paper the way a wash thins out at the end of a
 * stroke: the bottom fades over a broad, ragged band (where the dock's paper begins); the top
 * and sides thin out over a narrower ragged band, so no machine edge shows against the margin.
 * Pure: it fills an alpha array; `stageEdgeCanvas` turns that into an image. Generated per stage
 * size (on resize only), never per frame, so scrolling does not repaint the painting.
 */
export interface EdgeOptions {
  /** width/height of the mask in its own pixels */
  w: number;
  h: number;
  /** CSS px per mask pixel (the mask is made at a lower resolution and stretched) */
  cssPerPx: number;
  /** height of the bottom dissolve (CSS px) */
  fade: number;
  /** how far in the top and sides thin out (CSS px, on average: the line is ragged) */
  feather?: number;
  seed?: number | string;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** How far in the top and sides thin out for a stage of this size (CSS px). */
export function featherWidth(cssW: number, cssH: number): number {
  return Math.round(Math.min(44, Math.max(14, Math.min(cssW, cssH) * 0.04)));
}

/** How tall the bottom dissolve is for a stage `cssH` px high (CSS px). */
export function fadeHeight(cssH: number): number {
  return Math.round(Math.min(190, Math.max(64, cssH * 0.15)));
}

/** Alpha (0..1) per mask pixel, row-major. */
export function stageEdgeAlpha(o: EdgeOptions): Float32Array {
  const W = Math.max(1, Math.round(o.w));
  const H = Math.max(1, Math.round(o.h));
  const k = o.cssPerPx > 0 ? o.cssPerPx : 1;
  const feather = Math.max(1, (o.feather ?? 24) / k);
  const fade = Math.max(2, o.fade / k);
  const rng = createRng(o.seed ?? 'stage-edge');
  const broad = createValueNoise2D(rng.fork('broad'), 64);
  const fine = createValueNoise2D(rng.fork('fine'), 128);
  const dry = createValueNoise2D(rng.fork('dry'), 256);
  const out = new Float32Array(W * H);
  // the line where the wash starts to thin: ragged, with long swells and small tears
  const start = new Float32Array(W);
  const topEdge = new Float32Array(W);
  const sideEdge = new Float32Array(H);
  for (let x = 0; x < W; x++) {
    const cx = x * k;
    const swell = broad(cx / 140, 0.5) * 0.5;
    const tear = fine(cx / 26, 3.5) * 0.5;
    start[x] = H - fade + fade * (0.32 * swell + 0.12 * tear);
    // the top and sides thin out irregularly too, like a wash stopping short of the margin
    topEdge[x] = feather * (1 + 0.45 * broad(cx / 90, 7.5) + 0.2 * fine(cx / 18, 11.5));
  }
  for (let y = 0; y < H; y++) {
    const cy = y * k;
    sideEdge[y] = feather * (1 + 0.45 * broad(13.5, cy / 90) + 0.2 * fine(17.5, cy / 18));
  }
  for (let y = 0; y < H; y++) {
    const fromSide = sideEdge[y]!;
    for (let x = 0; x < W; x++) {
      const top = smooth(y / topEdge[x]!);
      const side = smooth(Math.min(x, W - 1 - x) / fromSide);
      const s = start[x]!;
      let bottom = 1;
      if (y > s) {
        const t = (y - s) / Math.max(1, H - s);
        // thinning wash: uneven pools where it lingered, a faint slanting grain where the brush ran dry
        const cx = x * k;
        const cy = y * k;
        const streak = (0.2 * broad(cx / 70, cy / 36 + 20) + 0.07 * dry((cx + cy * 0.6) / 15, (cy - cx * 0.3) / 24)) * t;
        bottom = 1 - smooth(Math.min(1, t * 1.2 + streak));
      }
      out[y * W + x] = Math.max(0, Math.min(1, top * side * bottom));
    }
  }
  return out;
}

/** Mask image for a stage of `cssW × cssH` CSS px (half resolution), or null without a canvas. */
export function stageEdgeCanvas(cssW: number, cssH: number, doc: Document = document): HTMLCanvasElement | null {
  const cssPerPx = 2;
  const w = Math.max(1, Math.round(cssW / cssPerPx));
  const h = Math.max(1, Math.round(cssH / cssPerPx));
  const canvas = doc.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const alpha = stageEdgeAlpha({ w, h, cssPerPx, fade: fadeHeight(cssH), feather: featherWidth(cssW, cssH) });
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < alpha.length; i++) {
    img.data[i * 4 + 3] = Math.round(alpha[i]! * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
