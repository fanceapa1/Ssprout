/**
 * Which plant is under a point (ADR 0166): the front-most plant whose painted pixels — not just
 * its sprite box — are there. Each sprite bitmap gets a coarse alpha mask once (≤ 96 cells on its
 * long side, built by drawing it small and reading it back), so a hover or a click is a handful
 * of array lookups, at any zoom. Transparent air between the leaves misses; a few CSS pixels of
 * tolerance (passed in world units by the caller, so it follows the zoom) keep thin stems
 * clickable. Pure apart from `alphaMask`, which needs a canvas.
 */
import type { Pt } from '../render/viewport';
import type { WorldRect } from './bounds';

export interface AlphaMask {
  w: number;
  h: number;
  /** alpha 0..255 per cell, row-major */
  data: Uint8Array;
}

/** Long side of a mask in cells. */
export const MASK_CELLS = 96;
/** Cells with at least this alpha count as painted. */
export const HIT_ALPHA = 28;

export interface HitCandidate {
  id: string;
  /** the world rect the sprite is drawn into */
  box: WorldRect;
  /** draw order: higher is in front (the slot's y) */
  depth: number;
  /** null: no painted sprite yet (falls back to the inner part of the box) */
  mask: AlphaMask | null;
}

/** Whether a mask has paint within `r` cells of the fractional point (fx, fy) ∈ [0, 1]². */
export function maskHit(mask: AlphaMask, fx: number, fy: number, r = 0): boolean {
  const cx = fx * mask.w;
  const cy = fy * mask.h;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(mask.w - 1, Math.floor(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(mask.h - 1, Math.floor(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > (r + 0.75) ** 2) continue;
      if (mask.data[y * mask.w + x]! >= HIT_ALPHA) return true;
    }
  }
  return false;
}

/**
 * The front-most candidate painted at `p` (world units), with `tolerance` world units of slack.
 * Candidates without a mask hit on the inner part of their box (the old label rule).
 */
export function pickPlant<T extends HitCandidate>(candidates: readonly T[], p: Pt, tolerance = 0): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    const b = c.box;
    if (p.x < b.x - tolerance || p.x > b.x + b.w + tolerance || p.y < b.y - tolerance || p.y > b.y + b.h + tolerance) continue;
    if (best && c.depth < best.depth) continue;
    let hit: boolean;
    if (c.mask) {
      const r = (tolerance / Math.max(1, b.w)) * c.mask.w;
      hit = maskHit(c.mask, (p.x - b.x) / b.w, (p.y - b.y) / b.h, r);
    } else {
      const inset = b.w * 0.12;
      hit = p.x >= b.x + inset && p.x <= b.x + b.w - inset && p.y >= b.y && p.y <= b.y + b.h;
    }
    if (hit && (!best || c.depth >= best.depth)) best = c;
  }
  return best;
}

type Src = CanvasImageSource & { width: number; height: number };

const masks = new WeakMap<object, AlphaMask | null>();

/** The coarse alpha mask of a sprite bitmap (cached per bitmap); null without canvas support. */
export function alphaMask(image: CanvasImageSource): AlphaMask | null {
  const key = image as object;
  if (masks.has(key)) return masks.get(key) ?? null;
  const src = image as Src;
  const iw = Math.max(1, src.width);
  const ih = Math.max(1, src.height);
  const k = Math.min(1, MASK_CELLS / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * k));
  const h = Math.max(1, Math.round(ih * k));
  let mask: AlphaMask | null = null;
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const data = new Uint8Array(w * h);
      for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3]!;
      mask = { w, h, data };
    }
  } catch {
    mask = null;
  }
  masks.set(key, mask);
  return mask;
}
