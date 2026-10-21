import { createRng, type Rng } from '../core/rng';
import type { Painter } from '../paint';
import { getSpecies } from './registry';
import type { SpeciesDef } from './types';

/**
 * PlantView: one species drawn at an arbitrary growth value, optionally mid-watering or wilting.
 * Shared by the floating widget, start-sheet previews and (later) the garden (ADR 0003).
 *
 * PLACEHOLDER internals (widget task): growth is quantised to `GROWTH_STEPS` and each step is
 * rendered once with `species.draw` and cached; the watering animation is a simple painted can,
 * droplets and darkening soil. The plants task will replace the internals with cached
 * growth-stage sprites and a painted watering animation — keep this signature stable.
 */

export interface PlantViewOptions {
  speciesId: string;
  seed: number;
  /** 0 = seed … 1 = full bloom */
  growth: number;
  /** watering animation progress 0..1, null = none */
  watering: number | null;
  /** 0..1, the seedling withering away (cancel) */
  wilt?: number;
}

export const GROWTH_STEPS = 24;

export const quantiseGrowth = (g: number): number => {
  const v = Number.isFinite(g) ? Math.max(0, Math.min(1, g)) : 0;
  return Math.round(v * GROWTH_STEPS) / GROWTH_STEPS;
};

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D;

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeCanvas(w: number, h: number): AnyCanvas | null {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

const SPRITE_CACHE_MAX = 96;
const sprites = new Map<string, AnyCanvas>();

/** The species at one quantised growth, w×h px, cached (LRU-ish). */
function sprite(def: SpeciesDef, seed: number, growth: number, w: number, h: number): AnyCanvas | null {
  const key = `${def.id}|${seed}|${growth}|${w}x${h}`;
  const hit = sprites.get(key);
  if (hit) {
    sprites.delete(key);
    sprites.set(key, hit);
    return hit;
  }
  const c = makeCanvas(w, h);
  const ctx = c?.getContext('2d') as Ctx2D | null | undefined;
  if (!c || !ctx) return null;
  const painter: Painter = { ctx, w, h };
  def.draw(painter, createRng(seed).fork(def.id), { w, h, growth });
  sprites.set(key, c);
  if (sprites.size > SPRITE_CACHE_MAX) sprites.delete(sprites.keys().next().value!);
  return c;
}

/** Where the species sits in a W×H target: contained, base (anchor) at the bottom centre. */
export function plantLayout(def: Pick<SpeciesDef, 'size' | 'anchor'>, W: number, H: number) {
  const scale = Math.min((W * 0.9) / def.size.w, (H * 0.94) / def.size.h);
  const w = Math.max(1, Math.round(def.size.w * scale));
  const h = Math.max(1, Math.round(def.size.h * scale));
  const baseX = W / 2;
  const baseY = H * 0.97;
  return { w, h, x: baseX - def.anchor.x * w, y: baseY - def.anchor.y * h, baseX, baseY, scale };
}

/**
 * Draw the plant into `canvas` (clears it first). Returns false when the species is unknown or
 * no 2D context is available (callers may draw a fallback).
 */
export function renderPlantView(canvas: AnyCanvas, opts: PlantViewOptions): boolean {
  const def = getSpecies(opts.speciesId);
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  if (!def || !ctx) return false;
  const W = canvas.width;
  const H = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const L = plantLayout(def, W, H);
  const growth = quantiseGrowth(opts.growth);
  const img = sprite(def, opts.seed >>> 0, growth, L.w, L.h);
  const water = opts.watering === null ? null : Math.max(0, Math.min(1, opts.watering));
  const wilt = Math.max(0, Math.min(1, opts.wilt ?? 0));
  const rng = createRng(`water:${opts.seed}`);

  if (water !== null) paintWetSoil(ctx, L.baseX, L.baseY, L.w, water);

  if (img) {
    // leaves lift a touch while (and just after) the water arrives; a wilting plant droops
    const lift = water === null ? 0 : smooth(0.35, 0.7, water) * (1 - smooth(0.85, 1, water) * 0.6);
    const sy = 1 + 0.045 * lift - 0.28 * wilt;
    const skew = 0.18 * wilt;
    ctx.save();
    ctx.globalAlpha = 1 - 0.75 * wilt;
    ctx.translate(L.baseX, L.baseY);
    ctx.transform(1, 0, -skew, sy, 0, 0);
    ctx.translate(-L.baseX, -L.baseY);
    ctx.drawImage(img as CanvasImageSource, L.x, L.y, L.w, L.h);
    ctx.restore();
  }

  if (water !== null) paintWateringCan(ctx, L, water, rng);
  ctx.restore();
  return true;
}

/** Darkening soil where the water lands (stays dark through the end of the animation). */
function paintWetSoil(ctx: Ctx2D, x: number, y: number, w: number, t: number): void {
  const wet = smooth(0.3, 0.7, t) * (1 - smooth(0.92, 1, t) * 0.4);
  if (wet <= 0) return;
  const rx = Math.max(10, w * 0.32);
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(92,84,70,${0.34 * wet})`);
  g.addColorStop(0.7, `rgba(110,100,84,${0.18 * wet})`);
  g.addColorStop(1, 'rgba(110,100,84,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.22);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * A small painted watering can: slides in from the right (0–0.2), tilts (0.2–0.35), pours
 * droplets in an arc (0.3–0.8), straightens and leaves (0.8–1).
 */
function paintWateringCan(ctx: Ctx2D, L: ReturnType<typeof plantLayout>, t: number, rng: Rng): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const size = Math.min(W, H) * 0.2;
  const enter = smooth(0, 0.2, t) * (1 - smooth(0.82, 1, t));
  const tilt = -0.62 * smooth(0.18, 0.34, t) * (1 - smooth(0.76, 0.88, t));
  const cx = W + size * 1.2 - enter * (size * 1.2 + W * 0.2);
  const cy = Math.max(size * 0.9, L.baseY - L.h * 0.78);
  const alpha = Math.min(1, enter * 1.4);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.globalAlpha = alpha;
  // body: layered translucent washes in a cool grey-blue, a darker pooled rim
  const body = (j: number) => {
    ctx.beginPath();
    ctx.moveTo(-size * 0.42 + j * rng.range(-1, 1), -size * 0.32);
    ctx.lineTo(size * 0.42 + j * rng.range(-1, 1), -size * 0.32);
    ctx.lineTo(size * 0.48, size * 0.38);
    ctx.quadraticCurveTo(0, size * 0.46, -size * 0.48, size * 0.38);
    ctx.closePath();
  };
  for (let k = 0; k < 3; k++) {
    body(size * 0.03);
    ctx.fillStyle = 'rgba(143,176,171,0.22)';
    ctx.fill();
  }
  body(0);
  ctx.strokeStyle = 'rgba(74,68,60,0.55)';
  ctx.lineWidth = Math.max(0.8, size * 0.03);
  ctx.stroke();
  // spout (to the left) and handle
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, size * 0.18);
  ctx.quadraticCurveTo(-size * 0.75, size * 0.05, -size * 0.98, -size * 0.32);
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.strokeStyle = 'rgba(111,150,144,0.7)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.08, -size * 0.36, size * 0.26, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineWidth = Math.max(0.8, size * 0.035);
  ctx.strokeStyle = 'rgba(74,68,60,0.6)';
  ctx.stroke();
  ctx.restore();

  // droplets: from the rose, arcing down to the soil at the base
  const pour = smooth(0.3, 0.42, t) * (1 - smooth(0.72, 0.8, t));
  if (pour <= 0) return;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const rose = { x: cx + (-size * 0.98) * c - (-size * 0.32) * s, y: cy + (-size * 0.98) * s + (-size * 0.32) * c };
  const target = { x: L.baseX + L.w * 0.08, y: L.baseY - 2 };
  const drops = 14;
  for (let i = 0; i < drops; i++) {
    const phase = (t * 6 + i / drops + rng.range(0, 0.08)) % 1;
    const spread = rng.range(-0.5, 0.5) * size * 0.35;
    const x = rose.x + (target.x + spread - rose.x) * phase;
    const y = rose.y + (target.y - rose.y) * phase * phase - Math.sin(phase * Math.PI) * size * 0.25;
    const r = Math.max(0.8, size * 0.035) * (0.7 + 0.5 * (1 - phase));
    ctx.save();
    ctx.globalAlpha = pour * 0.75;
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(target.y - rose.y, target.x - rose.x) * 0.5 + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.7, r * 1.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(111,150,144,0.85)';
    ctx.fill();
    ctx.restore();
  }
}
