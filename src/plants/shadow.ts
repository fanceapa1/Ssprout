/**
 * A plant's cast shadow on the ground (ADR 0146): one pre-painted watercolour blot — a soft,
 * cool violet-grey glaze with a pooled edge, darker at the foot — stretched from the plant's base
 * away from the sun (long and sideways at sunrise and sunset, a short pool at midday, a whisper
 * under the moon) and multiplied under the plant every frame. One sprite for every plant.
 */
import { createRng } from '../core/rng';
import { PIGMENTS, createPainter, makeCanvas, mix, type AnyCanvas } from '../paint';
import type { CastShadow } from '../ambience/sky-layout';

/** The blot is painted in a 160 × 48 box; its foot (where the plant stands) is at x 16. */
const BLOT = { w: 160, h: 48, footX: 16 };

let blot: AnyCanvas | null | undefined;

/** The shared blot (painted once, at 2 px per unit). Null without canvas support. */
export function shadowBlot(): AnyCanvas | null {
  if (blot !== undefined) return blot;
  try {
    const res = 2;
    const c = makeCanvas(BLOT.w * res, BLOT.h * res);
    const p = createPainter(c, { seed: 'plant-shadow' });
    p.ctx.setTransform(res, 0, 0, res, 0, 0);
    const rng = createRng('plant-shadow');
    const pig = mix(PIGMENTS.shadow, PIGMENTS.ultramarine, 0.22);
    p.glaze({ cx: 80, cy: 24, rx: 70, ry: 13 }, pig, { rng, opacity: 0.85, deform: 0.28, edge: 0.3, fade: { angle: 0, start: 0.25, amount: 0.95, ragged: 0.5 } });
    p.glaze({ cx: 28, cy: 24, rx: 16, ry: 8 }, pig, { rng, opacity: 0.5, deform: 0.2 });
    blot = c;
  } catch {
    blot = null;
  }
  return blot;
}

export interface ShadowGeometry {
  /** the plant's base (world) */
  x: number;
  y: number;
  /** visible width and height of the plant (world units) */
  w: number;
  h: number;
}

/** Where the blot goes for a plant: its foot at the base, stretched along the shadow. Pure. */
export function shadowBox(g: ShadowGeometry, s: CastShadow): { len: number; thick: number; angle: number; back: number } {
  const reach = Math.abs(s.dx) * g.h;
  const len = Math.max(g.w * 0.7, Math.min(g.h * 1.3, reach * 0.75 + g.w * 0.5));
  const thick = Math.max(6, Math.min(g.w * 0.5, 64));
  // the ground is foreshortened: a shadow lies almost flat, tilting a little toward the viewer
  const dir = s.dx < 0 ? -1 : 1;
  const tilt = Math.max(-0.22, Math.min(0.22, s.dy * 0.9));
  const angle = dir > 0 ? tilt : Math.PI - tilt;
  // a high sun leaves a pool centred under the plant; a low one starts the shadow at the foot
  const back = g.w * (0.12 + 0.3 * Math.max(0, 1 - Math.abs(s.dx) / 0.6));
  return { len, thick, angle, back };
}

/** Multiply the blot under a plant (call before drawing the plant). */
export function drawPlantShadow(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, g: ShadowGeometry, s: CastShadow, alpha: number): void {
  const a = s.alpha * alpha;
  if (a <= 0.01 || g.w <= 0 || g.h <= 0) return;
  const img = shadowBlot();
  if (!img) return;
  const { len, thick, angle, back } = shadowBox(g, s);
  const scaleX = len / (BLOT.w - BLOT.footX);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= Math.min(1, a);
  // the foot sits a little behind the base so the shadow starts under the plant
  ctx.drawImage(img as CanvasImageSource, -BLOT.footX * scaleX - back, -thick / 2, BLOT.w * scaleX, thick);
  ctx.restore();
}
