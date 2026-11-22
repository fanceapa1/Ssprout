/**
 * The coast's paper margins (GA1): the shared margin field (ADR 0185) with the left side narrowed,
 * so the bay, the far hill and the leaning pine are not lost in a white wedge, and the same lift
 * laid on the coast's sky and sea plates, so the left edge dissolves alike in every light.
 * docs/systems/scenery.md › Coast › Daylight.
 */
import type { Rng } from '../../core/rng';
import { createSimplex2D, type Painter } from '../../paint';
import { MARGIN, marginField, type Strokes } from '../../scene/paint-land';
import { WORLD_H, WORLD_W } from '../../render/viewport';
import { createRng } from '../../core/rng';

/** How wide the left side's lift is here (the shared field's sides are `MARGIN.side`). */
export const COAST_LEFT_SIDE = 140;
const K = MARGIN.side / COAST_LEFT_SIDE;
const B = 200;
const BACK = 560;

/** x as the shared field reads it: the left ramp squeezed, back to the world's own x from `BACK` on. */
export function marginX(x: number): number {
  if (x <= B) return x * K;
  if (x >= BACK) return x;
  return B * K + ((x - B) * (BACK - B * K)) / (BACK - B);
}

/** The coast's margin lift (0..1) at a world point; the noise is world-anchored, so every painting agrees. */
export function coastMarginField(rng: Rng): (x: number, y: number) => number {
  const field = marginField(createSimplex2D(rng.fork('margin')));
  return (x, y) => field(marginX(x), y);
}

/** The lift the landscape's margins step lays, for the plates: the same seed and noise. */
let plateField: ((x: number, y: number) => number) | null = null;
export function coastPlateLift(seed: number | string): (x: number, y: number) => number {
  return (plateField ??= coastMarginField(createRng(seed).fork('margins')));
}

/**
 * The paper margins over the whole painting, as the shared step (`paintMargins`) lays them, with
 * the coast's field: one continuous lift toward bare paper, dried as one soft layer.
 */
export function* paintCoastMargins(p: Painter, rng: Rng): Strokes {
  const L = p.layer({ x: -10, y: -10, w: WORLD_W + 20, h: WORLD_H + 20 });
  if (!L.empty) {
    const field = coastMarginField(rng);
    const c = L.ctx;
    const W = c.canvas.width;
    const H = c.canvas.height;
    const inv = c.getTransform().inverse();
    const STEP = 4;
    const gw = Math.ceil(W / STEP) + 1;
    const gh = Math.ceil(H / STEP) + 1;
    const grid = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const px = gx * STEP + 0.5;
        const py = gy * STEP + 0.5;
        grid[gy * gw + gx] = field(inv.a * px + inv.c * py + inv.e, inv.b * px + inv.d * py + inv.f);
      }
    }
    yield;
    const img = c.createImageData(W, H);
    const d = img.data;
    for (let gy = 0; gy < gh - 1; gy++) {
      for (let gx = 0; gx < gw - 1; gx++) {
        const a00 = grid[gy * gw + gx]!;
        const a10 = grid[gy * gw + gx + 1]!;
        const a01 = grid[(gy + 1) * gw + gx]!;
        const a11 = grid[(gy + 1) * gw + gx + 1]!;
        if (a00 <= 0.002 && a10 <= 0.002 && a01 <= 0.002 && a11 <= 0.002) continue;
        for (let y = gy * STEP, ye = Math.min(H, y + STEP); y < ye; y++) {
          const v = (y - gy * STEP) / STEP;
          const l = a00 + (a01 - a00) * v;
          const r = a10 + (a11 - a10) * v;
          for (let x = gx * STEP, xe = Math.min(W, x + STEP); x < xe; x++) {
            const a = l + (r - l) * ((x - gx * STEP) / STEP);
            if (a <= 0.002) continue;
            const i = (y * W + x) * 4;
            d[i] = 255;
            d[i + 1] = 253;
            d[i + 2] = 248;
            d[i + 3] = a * 255;
          }
        }
      }
    }
    c.putImageData(img, 0, 0);
    yield;
  }
  yield* L.dryParts(MARGIN_DRY);
}

const MARGIN_DRY = { opacity: 1, edge: 0.04, edgeWidth: 6, sharpness: 0.15, centreLift: 0, granulation: 0.05, flow: 0.6, flowScale: 120, blend: 'source-over' as const };

/**
 * Lift what the painter holds toward paper by `lift(x, y)` (0..1, max `MARGIN.maxLift`), sampled
 * every 4 px and interpolated. `cols` limits the work to the world x where the lift can be nonzero.
 */
export function liftToPaper(p: Painter, lift: (x: number, y: number) => number, cols: readonly [number, number][], to: readonly [number, number, number] = [255, 255, 255]): void {
  const c = p.ctx;
  const W = c.canvas.width;
  const H = c.canvas.height;
  const m = c.getTransform();
  const inv = m.inverse();
  const STEP = 4;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x0, x1] of cols) {
    const px0 = Math.max(0, Math.floor(m.a * x0 + m.e));
    const px1 = Math.min(W, Math.ceil(m.a * x1 + m.e));
    if (px1 <= px0) continue;
    const w = px1 - px0;
    const gw = Math.ceil(w / STEP) + 1;
    const gh = Math.ceil(H / STEP) + 1;
    const grid = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const px = px0 + gx * STEP + 0.5;
        const py = gy * STEP + 0.5;
        grid[gy * gw + gx] = lift(inv.a * px + inv.c * py + inv.e, inv.b * px + inv.d * py + inv.f);
      }
    }
    const img = c.getImageData(px0, 0, w, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const gy = Math.min(gh - 2, Math.floor(y / STEP));
      const v = (y - gy * STEP) / STEP;
      for (let x = 0; x < w; x++) {
        const gx = Math.min(gw - 2, Math.floor(x / STEP));
        const u = (x - gx * STEP) / STEP;
        const a00 = grid[gy * gw + gx]!;
        const a10 = grid[gy * gw + gx + 1]!;
        const a01 = grid[(gy + 1) * gw + gx]!;
        const a11 = grid[(gy + 1) * gw + gx + 1]!;
        const a = (a00 + (a10 - a00) * u) * (1 - v) + (a01 + (a11 - a01) * u) * v;
        if (a <= 0.002) continue;
        const i = (y * w + x) * 4;
        d[i] = d[i]! + (to[0] - d[i]!) * a;
        d[i + 1] = d[i + 1]! + (to[1] - d[i + 1]!) * a;
        d[i + 2] = d[i + 2]! + (to[2] - d[i + 2]!) * a;
      }
    }
    c.putImageData(img, px0, 0);
  }
  c.restore();
}

/** The world x bands where a side's lift can reach (the bottom corners reach furthest). */
export const SIDE_COLUMNS: readonly [number, number][] = [
  [-40, COAST_LEFT_SIDE * MARGIN.sideBottom + 60],
  [WORLD_W - MARGIN.side * MARGIN.sideBottom - 60, WORLD_W + 40],
];
