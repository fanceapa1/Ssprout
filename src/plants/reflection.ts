import { createRng } from '../core/rng';
import type { Pt } from '../render/viewport';
import { drawSliced, type Box } from './draw';

/**
 * Plant reflections in the pond (docs/systems/plants.md › Reflections, ADR 0116): a plant on a
 * `shore` or `water` slot (or a species with `reflect: true`) is mirrored about the local
 * shoreline under it — the pond edge straight below its base, or its own base when it stands in
 * the water. The reflection image is cached per sprite: flipped, softened, tinted toward the
 * water, fading with depth and broken by horizontal lift strokes; each frame it is drawn in a few
 * gently wavering slices, clipped to the pond.
 */

/** y values where the vertical line at `x` crosses the polygon's edges, ascending. */
export function verticalHits(poly: readonly Pt[], x: number): number[] {
  const ys: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
      const t = (x - a.x) / (b.x - a.x);
      ys.push(a.y + t * (b.y - a.y));
    }
  }
  return ys.sort((p, q) => p - q);
}

/** Even-odd point-in-polygon. */
export function insidePolygon(poly: readonly Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** How far above the water a bank plant may stand and still be reflected (world units). */
export const MAX_SHORE_GAP = 70;

/**
 * The mirror line for a plant whose base is at (x, y) and whose foliage spans ±halfWidth:
 * its own base when it stands in the pond, else the nearest pond edge below it (looking along
 * its width, centre first) within `maxGap`; null when no water lies below it.
 */
export function shoreAxis(pond: readonly Pt[], x: number, y: number, halfWidth = 0, maxGap = MAX_SHORE_GAP): number | null {
  if (pond.length < 3) return null;
  if (insidePolygon(pond, { x, y })) return y;
  const xs = halfWidth > 0 ? [x, x - halfWidth * 0.5, x + halfWidth * 0.5, x - halfWidth, x + halfWidth] : [x];
  for (const sx of xs) {
    const below = verticalHits(pond, sx).find((hy) => hy >= y - 1e-6);
    if (below !== undefined && below - y <= maxGap) return below;
  }
  return null;
}

export const mirrorY = (y: number, axis: number): number => 2 * axis - y;

/** The world box of the reflection of `box` about `axis` (top and bottom swap). */
export function mirrorBox(box: Box, axis: number): Box {
  return { x: box.x, y: mirrorY(box.y + box.h, axis), w: box.w, h: box.h };
}

/** Horizontal waver of the reflection at world `y`, growing with distance below the axis. */
export function waverAt(t: number, y: number, axis: number, phase: number, amplitude = 1.3): number {
  const depth = Math.max(0, y - axis);
  const k = Math.min(1, 0.25 + depth / 60);
  return amplitude * k * (Math.sin(t * 1.25 + y * 0.11 + phase) * 0.7 + Math.sin(t * 0.53 - y * 0.047 + phase * 1.7) * 0.3);
}

/** Reflection opacity at full presence. */
export const REFLECTION_ALPHA = 0.5;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const cache = new Map<string, AnyCanvas | null>();
const CACHE_MAX = 48;

function canvasOf(w: number, h: number): AnyCanvas | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  } catch {
    return null;
  }
}

const filterSupported = (ctx: Ctx): boolean => {
  try {
    ctx.filter = 'blur(1px)';
    const ok = ctx.filter === 'blur(1px)';
    ctx.filter = 'none';
    return ok;
  } catch {
    return false;
  }
};

/**
 * The reflection image of a sprite (half resolution): flipped so the base is at the top,
 * softened, tinted toward the pond's celadon, fading away from the shoreline and broken by
 * horizontal lift strokes. Cached by `key` (the sprite key).
 */
export function reflectionImage(key: string, img: CanvasImageSource, w: number, h: number, seed: number): AnyCanvas | null {
  if (cache.has(key)) {
    const hit = cache.get(key)!;
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const rw = Math.max(1, Math.round(w / 2));
  const rh = Math.max(1, Math.round(h / 2));
  const out = canvasOf(rw, rh);
  const ctx = out?.getContext('2d') as Ctx | null | undefined;
  let result: AnyCanvas | null = null;
  if (out && ctx) {
    const blur = Math.max(0.6, rw / 90);
    ctx.save();
    ctx.translate(0, rh);
    ctx.scale(1, -1);
    if (filterSupported(ctx)) {
      ctx.filter = `blur(${blur.toFixed(2)}px)`;
      ctx.drawImage(img, 0, 0, rw, rh);
      ctx.filter = 'none';
    } else {
      // soften by drawing small and stretching back
      const small = canvasOf(Math.max(1, Math.round(rw / 3)), Math.max(1, Math.round(rh / 3)));
      const sctx = small?.getContext('2d') as Ctx | null | undefined;
      if (small && sctx) {
        sctx.drawImage(img, 0, 0, small.width, small.height);
        ctx.drawImage(small, 0, 0, rw, rh);
      } else ctx.drawImage(img, 0, 0, rw, rh);
    }
    ctx.restore();
    // the water's colour over it, and depth: the reflection fades away from the shore
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(111,150,144,0.32)';
    ctx.fillRect(0, 0, rw, rh);
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createLinearGradient(0, 0, 0, rh);
    g.addColorStop(0, 'rgba(0,0,0,0.05)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rw, rh);
    // horizontal lift strokes: ragged bands where the surface catches the sky
    const rng = createRng(seed).fork('reflection-lifts');
    const bands = 4 + rng.int(0, 3);
    for (let i = 0; i < bands; i++) {
      const y = rh * (0.08 + (i + rng.range(0.1, 0.9)) / bands * 0.9);
      const th = Math.max(0.8, rh * rng.range(0.012, 0.03));
      const x0 = rw * rng.range(-0.15, 0.35);
      const x1 = rw * rng.range(0.6, 1.15);
      ctx.beginPath();
      const n = 10;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const yy = y - th * (0.5 + 0.5 * Math.sin((k / n) * Math.PI)) + rng.range(-0.3, 0.3) * th;
        if (k === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      for (let k = n; k >= 0; k--) {
        const x = x0 + ((x1 - x0) * k) / n;
        ctx.lineTo(x, y + th * 0.5 * Math.sin((k / n) * Math.PI) + rng.range(-0.3, 0.3) * th);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${rng.range(0.45, 0.85).toFixed(2)})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    result = out;
  }
  cache.set(key, result);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return result;
}

export interface ReflectionDraw {
  image: CanvasImageSource;
  /** the plant's world box */
  box: Box;
  axis: number;
  /** horizontal displacement at the plant's top from its sway, world units */
  sway: number;
  alpha: number;
  phase: number;
}

/** Draw one reflection (ctx already clipped to the pond, in world units). */
export function drawReflection(ctx: Ctx, r: ReflectionDraw, t: number, still: boolean): void {
  if (r.alpha <= 0.003) return;
  const box = mirrorBox(r.box, r.axis);
  const baseY = mirrorY(r.box.y + r.box.h, r.axis); // the mirrored bottom edge is the top of `box`
  const H = Math.max(1, r.box.h);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, r.alpha) * REFLECTION_ALPHA;
  drawSliced(
    ctx,
    r.image,
    box,
    (y) => (still ? 0 : waverAt(t, y, r.axis, r.phase)) + r.sway * Math.max(0, Math.min(1, (y - baseY) / H)),
    still ? 1 : 7,
  );
  ctx.restore();
}

export function clearReflectionCache(): void {
  cache.clear();
}
