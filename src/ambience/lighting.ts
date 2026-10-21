/**
 * Time-of-day lighting as a painted multiply wash. The wash is computed per pixel into a small
 * world-sized cache (LIGHT.cacheScale px per world unit) — noise-mottled, with soft backruns,
 * a sky that deepens first, a lighter foreground so plants stay readable, a warm low-sun glow
 * and, at dusk and night, paper *reserved* around the pavilion lantern and its reflection on
 * the pond (watercolour lights are left unpainted, not added). The cache is blitted with
 * `multiply` each frame and only repainted every few seconds. ADR 0082.
 */
import { createRng } from '../core/rng';
import { makeCanvas, type AnyCanvas } from '../paint/canvas';
import { noiseGrid, createSimplex2D, type NoiseGrid } from '../paint/noise';
import { pointInPolygon } from '../paint/geometry';
import { WORLD_H, WORLD_W, type Pt } from '../render/viewport';
import type { SceneGeometry } from '../scene/geometry';
import type { Grade, Rgb } from './timeofday';

export const LIGHT = {
  /** cache resolution, px per world unit (the wash is low-frequency; the paper adds grain) */
  cacheScale: 0.3,
  /** repaint interval (s) when following the clock */
  redrawS: 3,
  /** …and only when the grade moved perceptibly (squared grade distance; a repaint costs ~5 ms) */
  redrawEps: 2e-5,
  /** lantern reserve radius (world units) and how much of the wash it lifts */
  lanternR: 62,
  lanternLift: 0.62,
  /** warm paper colour inside the reserve */
  lanternWarm: [238, 218, 178] as Rgb,
  /** reflection streak half-size on the pond (world units) */
  reflectW: 13,
  reflectH: 46,
  reflectLift: 0.45,
  /** backruns: noise threshold and how much they lift / pool */
  bloomAt: 0.66,
  bloomLift: 0.05,
  bloomRim: 0.02,
} as const;

export interface WashField {
  /** cache size in pixels */
  w: number;
  h: number;
  /** px per world unit */
  scale: number;
  /** mottling noise (0..1) at pixel coords */
  mottle: (x: number, y: number) => number;
  /** backrun noise (0..1) at pixel coords */
  bloom: (x: number, y: number) => number;
  /** fine noise (0..1) that rags the edges of reserved lights */
  edge: (x: number, y: number) => number;
  /** 1 where the pixel is pond water (w*h), or null */
  pond: Uint8Array | null;
  lantern: Pt;
  /** where the lantern's light lies on the water, or null */
  reflection: Pt | null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/**
 * Paint the grade into `out` (RGBA, w*h*4): rgb = wash colour, alpha = wash strength. Composite
 * the result with `multiply`. Pure — unit-tested without a canvas.
 */
export function paintGradeWash(out: Uint8ClampedArray, g: Grade, f: WashField): void {
  const { w, h, scale } = f;
  const inv = 1 / scale;
  const [lx, ly] = [f.lantern.x, f.lantern.y];
  const refl = f.reflection;
  const [wr, wg, wb] = LIGHT.lanternWarm;
  for (let py = 0; py < h; py++) {
    const wy = (py + 0.5) * inv;
    const fy = wy / WORLD_H;
    const skyF = (1 - clamp01(fy)) ** 2;
    const groundF = smoothstep(0.45, 1, fy);
    const base = Math.max(0, g.amount + g.sky * skyF) * (1 + (g.ground - 1) * groundF);
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      if (base <= 0.002 && g.lantern <= 0.002) {
        out[i + 3] = 0;
        continue;
      }
      const wx = (px + 0.5) * inv;
      const fx = wx / WORLD_W;
      const n = f.mottle(px, py);
      let a = base * (1 + g.mottle * (n - 0.5) * 2);
      // backruns: a lighter interior with pigment pooled on its edge
      const b = f.bloom(px, py);
      if (b > LIGHT.bloomAt - 0.03) {
        const inside = smoothstep(LIGHT.bloomAt, LIGHT.bloomAt + 0.12, b);
        const rim = Math.max(0, 1 - Math.abs(b - LIGHT.bloomAt) / 0.03);
        a = a * (1 - LIGHT.bloomLift * inside) + base * LIGHT.bloomRim * rim;
      }
      let r = g.tint[0];
      let gg = g.tint[1];
      let bb = g.tint[2];
      // low warm light: thinner, warmer wash toward the light
      if (g.glow > 0.001) {
        const dx = fx - g.glowX;
        const dy = (fy - g.glowY) * 1.5;
        const k = g.glow * Math.exp(-(dx * dx + dy * dy) / 0.12) * (0.8 + 0.4 * n);
        a *= 1 - 0.7 * k;
        const m = clamp01(k * 1.5);
        r += (g.warm[0] - r) * m;
        gg += (g.warm[1] - gg) * m;
        bb += (g.warm[2] - bb) * m;
      }
      // the lantern: reserved, warm paper with a ragged edge where pigment pooled
      if (g.lantern > 0.001) {
        const dx = wx - lx;
        const dy = (wy - ly) * 1.15;
        const d = Math.sqrt(dx * dx + dy * dy) / (LIGHT.lanternR * (0.8 + 0.4 * f.edge(px, py)));
        if (d < 1.3) {
          const l = g.lantern * (1 - smoothstep(0, 1, d)) ** 1.4;
          a = a * (1 - LIGHT.lanternLift * l) + base * 0.05 * g.lantern * Math.max(0, 1 - Math.abs(d - 1) / 0.2);
          const m = clamp01(l * 1.3);
          r += (wr - r) * m;
          gg += (wg - gg) * m;
          bb += (wb - bb) * m;
        }
        if (refl && f.pond && f.pond[py * w + px]) {
          const rx = (wx - refl.x) / (LIGHT.reflectW * (0.75 + 0.5 * n));
          const ry = (wy - refl.y) / LIGHT.reflectH;
          const q = rx * rx + ry * ry;
          if (q < 4) {
            // broken horizontally like light on moving water
            const bands = 0.75 + 0.25 * Math.sin(wy * 0.32 + b * 6);
            const l = g.lantern * Math.exp(-q) * bands;
            a *= 1 - LIGHT.reflectLift * l;
            const m = clamp01(l * 1.2);
            r += (wr - r) * m;
            gg += (wg - gg) * m;
            bb += (wb - bb) * m;
          }
        }
      }
      out[i] = r;
      out[i + 1] = gg;
      out[i + 2] = bb;
      out[i + 3] = clamp01(a) * 255;
    }
  }
}

/** Pond mask at cache resolution (1 = water). */
export function pondMask(pond: readonly Pt[], w: number, h: number, scale: number): Uint8Array {
  const m = new Uint8Array(w * h);
  if (pond.length < 3) return m;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pond) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const y0 = Math.max(0, Math.floor(minY * scale));
  const y1 = Math.min(h - 1, Math.ceil(maxY * scale));
  for (let py = y0; py <= y1; py++) {
    for (let px = 0; px < w; px++) {
      if (pointInPolygon({ x: (px + 0.5) / scale, y: (py + 0.5) / scale }, pond)) m[py * w + px] = 1;
    }
  }
  return m;
}

/**
 * Where the lantern's light falls on the water: mirrored about the waterline when that lands on
 * the pond, else the nearest stretch of water to the lantern (a warm spill near the shore).
 */
export function lanternReflection(scene: Pick<SceneGeometry, 'pond' | 'waterline' | 'pavilion'>): Pt | null {
  const { pond, pavilion } = scene;
  if (pond.length < 3) return null;
  const L = pavilion.lantern;
  const mirrored = { x: L.x, y: 2 * scene.waterline - L.y };
  if (pointInPolygon(mirrored, pond)) return awayFromShore(mirrored, pond, LIGHT.reflectW * 2.5, pavilion);
  // nearest point on the outline, nudged inward toward the pond centre
  let best: Pt = pond[0]!;
  let bestD = Infinity;
  for (let i = 0; i < pond.length; i++) {
    const a = pond[i]!;
    const b = pond[(i + 1) % pond.length]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = clamp01(((L.x - a.x) * abx + (L.y - a.y) * aby) / (abx * abx + aby * aby || 1));
    const p = { x: a.x + abx * t, y: a.y + aby * t };
    const d = (p.x - L.x) ** 2 + (p.y - L.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  let cx = 0;
  let cy = 0;
  for (const p of pond) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pond.length;
  cy /= pond.length;
  const dx = cx - best.x;
  const dy = cy - best.y;
  const len = Math.hypot(dx, dy) || 1;
  const inset = Math.min(40, len * 0.5);
  const p = { x: best.x + (dx / len) * inset, y: best.y + (dy / len) * inset };
  return pointInPolygon(p, pond) ? p : null;
}

/** Distance from `p` to the closest point of a closed outline. */
function distanceToOutline(p: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = clamp01(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1));
    best = Math.min(best, Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y));
  }
  return best;
}

/** Keep the light's streak on open water: step a mirrored point toward the pond's middle if it hugs the shore. */
export function awayFromShore(p: Pt, pond: readonly Pt[], clearance = LIGHT.reflectW * 2.5, avoid?: { x: number; y: number; w: number; h: number }): Pt {
  let cx = 0;
  let cy = 0;
  for (const q of pond) {
    cx += q.x;
    cy += q.y;
  }
  cx /= pond.length;
  cy /= pond.length;
  const len = Math.hypot(cx - p.x, cy - p.y) || 1;
  let out = p;
  // water hidden under the building (its box, plus the reflection's half-width) does not count
  const hidden = (q: Pt) => !!avoid && q.x > avoid.x - LIGHT.reflectW * 1.5 && q.y < avoid.y + avoid.h + LIGHT.reflectH * 0.5;
  for (let step = 0; step < 40 && (distanceToOutline(out, pond) < clearance || hidden(out)); step++) {
    const next = { x: out.x + ((cx - p.x) / len) * 6, y: out.y + ((cy - p.y) / len) * 6 };
    if (!pointInPolygon(next, pond)) break;
    out = next;
  }
  return out;
}

export interface LightingCache {
  readonly canvas: AnyCanvas;
  readonly w: number;
  readonly h: number;
  /** repaint the cache for a grade */
  paint(g: Grade): void;
}

const fields = new WeakMap<SceneGeometry, Map<string, WashField>>();

/** Noise grids and pond mask for a scene + seed (built once, shared by every cache). */
function washField(scene: SceneGeometry, seed: string): WashField {
  let bySeed = fields.get(scene);
  if (!bySeed) fields.set(scene, (bySeed = new Map()));
  const known = bySeed.get(seed);
  if (known) return known;
  const scale = LIGHT.cacheScale;
  const w = Math.ceil(WORLD_W * scale);
  const h = Math.ceil(WORLD_H * scale);
  const rng = createRng(seed);
  const mottle: NoiseGrid = noiseGrid(createSimplex2D(rng.fork('mottle')), w, h, 3, 160 * scale, { octaves: 4 });
  const bloom: NoiseGrid = noiseGrid(createSimplex2D(rng.fork('bloom')), w, h, 2, 240 * scale, { octaves: 3, gain: 0.55 });
  const edge: NoiseGrid = noiseGrid(createSimplex2D(rng.fork('edge')), w, h, 1, 40 * scale, { octaves: 2 });
  const field: WashField = {
    w,
    h,
    scale,
    mottle: (x, y) => mottle.sample(x, y),
    bloom: (x, y) => bloom.sample(x, y),
    edge: (x, y) => edge.sample(x, y),
    pond: pondMask(scene.pond, w, h, scale),
    lantern: scene.pavilion.lantern,
    reflection: lanternReflection(scene),
  };
  bySeed.set(seed, field);
  return field;
}

/** A lighting cache canvas for a scene (the noise field is shared per scene + seed). Browser only. */
export function createLightingCache(scene: SceneGeometry, seed = 'lighting'): LightingCache {
  const field = washField(scene, seed);
  const { w, h } = field;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  return {
    canvas,
    w,
    h,
    paint(g) {
      paintGradeWash(img.data, g, field);
      ctx.putImageData(img, 0, 0);
    },
  };
}
