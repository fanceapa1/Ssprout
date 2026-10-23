/**
 * Drawing a cached plant image with motion (docs/systems/plants.md › Sway): a horizontal skew
 * about the base for small plants, a bend for trees (the trunk stays, the crown moves), a
 * vertical scale for lift/droop. Bends and reflection waver are drawn as horizontal slices whose
 * clip bands are snapped to device rows, with a piecewise-linear skew per slice, so the image
 * stays continuous and no seams appear between slices.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlantPose {
  /** horizontal displacement at the top of the box, as a fraction of its height */
  lean: number;
  /** 1 = straight skew; > 1 bends (displacement ∝ heightᵇ, so the base barely moves) */
  bend: number;
  /** vertical scale about the base (leaves lifting > 1, drooping < 1) */
  scaleY: number;
  alpha: number;
}

export const STILL: PlantPose = { lean: 0, bend: 1, scaleY: 1, alpha: 1 };

/** Horizontal displacement at height fraction `t` (0 = base, 1 = top) for a box of height `h`. */
export function bendOffset(lean: number, h: number, t: number, bend: number): number {
  const tt = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return lean * h * (bend === 1 ? tt : tt ** bend);
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The painted part of an image laid in `box`: `src` (image px) and where it lands (`dst`, the
 * same mapping as the whole image into `box`). Drawing only it gives the same pixels when the
 * rest of the image is bare (ADR 0207); null when there is nothing to save.
 */
export interface Crop {
  src: Box;
  dst: Box;
}

export function inkCrop(box: Box, ink: Box | null | undefined, iw: number, ih: number): Crop | null {
  if (!ink || iw <= 0 || ih <= 0 || ink.w <= 0 || ink.h <= 0) return null;
  if (ink.x <= 0 && ink.y <= 0 && ink.w >= iw && ink.h >= ih) return null;
  const kx = box.w / iw;
  const ky = box.h / ih;
  return { src: { ...ink }, dst: { x: box.x + ink.x * kx, y: box.y + ink.y * ky, w: ink.w * kx, h: ink.h * ky } };
}

/**
 * Draw `img` into `box` (current user space) in `slices` horizontal bands, displacing each row by
 * `offsetAt(y)` (linear within a band, continuous across bands). With `crop`, only `crop.src` is
 * drawn (into `crop.dst`); the bands still follow `box`, so the pose is the same, and bands that
 * miss the crop are skipped.
 */
export function drawSliced(
  ctx: Ctx,
  img: CanvasImageSource,
  box: Box,
  offsetAt: (y: number) => number,
  slices: number,
  src?: Box,
  crop?: Crop | null,
): void {
  const n = Math.max(1, Math.floor(slices));
  const m = ctx.getTransform();
  const axisAligned = Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.d) > 1e-9;
  const snap = (y: number) => (axisAligned ? (Math.round(m.d * y + m.f) - m.f) / m.d : y);
  const pad = box.w; // clip bands are generous horizontally
  for (let i = 0; i < n; i++) {
    const ya = box.y + (box.h * i) / n;
    const yb = box.y + (box.h * (i + 1)) / n;
    const y0 = i === 0 ? box.y - box.h : snap(ya);
    const y1 = i === n - 1 ? box.y + box.h * 2 : snap(yb);
    if (y1 <= y0) continue;
    if (crop && (y1 <= crop.dst.y || y0 >= crop.dst.y + crop.dst.h)) continue;
    const oa = offsetAt(ya);
    const ob = offsetAt(yb);
    const c = (ob - oa) / (yb - ya);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x - pad, Math.min(y0, y1), box.w + pad * 2, Math.abs(y1 - y0));
    ctx.clip();
    ctx.transform(1, 0, c, 1, oa - c * ya, 0);
    if (crop) drawCrop(ctx, img, crop);
    else if (src) ctx.drawImage(img, src.x, src.y, src.w, src.h, box.x, box.y, box.w, box.h);
    else ctx.drawImage(img, box.x, box.y, box.w, box.h);
    ctx.restore();
  }
}

const drawCrop = (ctx: Ctx, img: CanvasImageSource, c: Crop) => ctx.drawImage(img, c.src.x, c.src.y, c.src.w, c.src.h, c.dst.x, c.dst.y, c.dst.w, c.dst.h);

/** Slices used for a bend: enough for a smooth curve, few enough to stay cheap. */
export const BEND_SLICES = 6;

/**
 * Draw a plant image with its base at (baseX, baseY) in `box`, posed. `crop` (`inkCrop`) blits
 * only the painted part: same pixels, a fraction of the fill (ADR 0207).
 */
export function drawPlant(ctx: Ctx, img: CanvasImageSource, box: Box, baseX: number, baseY: number, pose: PlantPose, crop?: Crop | null): void {
  if (pose.alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pose.alpha);
  if (pose.scaleY !== 1) {
    ctx.translate(baseX, baseY);
    ctx.scale(1, pose.scaleY);
    ctx.translate(-baseX, -baseY);
  }
  const H = Math.max(1e-6, baseY - box.y);
  if (pose.lean === 0) {
    if (crop) drawCrop(ctx, img, crop);
    else ctx.drawImage(img, box.x, box.y, box.w, box.h);
  } else if (pose.bend === 1) {
    // x' = x + lean·(baseY − y)
    ctx.transform(1, 0, -pose.lean, 1, pose.lean * baseY, 0);
    if (crop) drawCrop(ctx, img, crop);
    else ctx.drawImage(img, box.x, box.y, box.w, box.h);
  } else {
    drawSliced(ctx, img, box, (y) => bendOffset(pose.lean, H, (baseY - y) / H, pose.bend), BEND_SLICES, undefined, crop);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Scratch buffers and exact cross-fades

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface Scratch {
  canvas: AnyCanvas;
  ctx: Ctx;
}

const scratches = new Map<string, Scratch | null>();

/** A reusable offscreen buffer of w×h (exact size, cleared). Null without canvas support. */
export function scratch(id: string, w: number, h: number): Scratch | null {
  let s = scratches.get(id);
  if (s === undefined) {
    let canvas: AnyCanvas | null = null;
    try {
      canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(1, 1)
          : typeof document !== 'undefined'
            ? document.createElement('canvas')
            : null;
    } catch {
      canvas = null;
    }
    const ctx = canvas ? (canvas.getContext('2d') as Ctx | null) : null;
    s = canvas && ctx ? { canvas, ctx } : null;
    scratches.set(id, s);
  }
  if (!s) return null;
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  if (s.canvas.width !== cw || s.canvas.height !== ch) {
    s.canvas.width = cw;
    s.canvas.height = ch;
  } else {
    s.ctx.setTransform(1, 0, 0, 1, 0, 0);
    s.ctx.globalAlpha = 1;
    s.ctx.globalCompositeOperation = 'source-over';
    s.ctx.clearRect(0, 0, cw, ch);
  }
  return s;
}

/**
 * Size ratio from one growth step to the next (hi ÷ lo, measured from the painted content),
 * about the plant's anchor (fractions of the box). During a cross-fade the lower step is
 * stretched toward the upper one and the upper one starts shrunk to the lower's size, so tips
 * and heads travel instead of dissolving in place; both scales are 1 at their own step.
 */
export interface Morph {
  sx: number;
  sy: number;
  ax: number;
  ay: number;
}

type Frac = { left: number; top: number; right: number; bottom: number };
const clampRatio = (v: number) => (Number.isFinite(v) ? Math.max(0.8, Math.min(1.25, v)) : 1);

export function morphBetween(lo: Frac | null | undefined, hi: Frac | null | undefined, anchor: { x: number; y: number }): Morph | null {
  if (!lo || !hi) return null;
  const hLo = anchor.y - lo.top;
  const hHi = anchor.y - hi.top;
  const wLo = lo.right - lo.left;
  const wHi = hi.right - hi.left;
  if (hLo <= 0.01 || hHi <= 0.01 || wLo <= 0.01 || wHi <= 0.01) return null;
  return { sx: clampRatio(wHi / wLo), sy: clampRatio(hHi / hLo), ax: anchor.x, ay: anchor.y };
}

/**
 * `(1 − weight)·a + weight·b` per pixel into `out` (premultiplied colours add under `lighter`),
 * each image stretched to the buffer. With only one image (or weight 0/1) it is copied.
 */
export function crossFade(out: Scratch, a: CanvasImageSource | null, b: CanvasImageSource | null, weight: number, morph?: Morph | null): void {
  const { ctx, canvas } = out;
  const w = canvas.width;
  const h = canvas.height;
  const wb = b ? Math.max(0, Math.min(1, weight)) : 0;
  const wa = a ? 1 - wb : 0;
  const put = (img: CanvasImageSource, sx: number, sy: number) => {
    if (sx === 1 && sy === 1) return ctx.drawImage(img, 0, 0, w, h);
    const ax = (morph?.ax ?? 0.5) * w;
    const ay = (morph?.ay ?? 1) * h;
    ctx.drawImage(img, ax - ax * sx, ay - ay * sy, w * sx, h * sy);
  };
  ctx.globalCompositeOperation = 'source-over';
  if (a && wa > 0) {
    ctx.globalAlpha = wa;
    put(a, morph ? morph.sx ** wb : 1, morph ? morph.sy ** wb : 1);
  }
  if (b && wb > 0) {
    ctx.globalCompositeOperation = wa > 0 ? 'lighter' : 'source-over';
    ctx.globalAlpha = wb;
    put(b, morph ? morph.sx ** (wb - 1) : 1, morph ? morph.sy ** (wb - 1) : 1);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
