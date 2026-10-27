/**
 * World ↔ screen mapping. The world is a fixed 1600×1000 logical canvas; the screen shows it
 * with "cover" scaling (fills the canvas, crops overflow) centred on a focus point, clamped so
 * we never show outside the world's width. Exception (ADR 0123): a tall portrait screen shows at
 * least `MIN_VISIBLE_W` of the world's width, so phones see the pond's banks and the plants on
 * them; the painting then sits in the middle of the screen with bare paper above and below
 * (the world's own margins already dissolve into paper). Screen coordinates are CSS pixels.
 */
import { GARDEN_VIEW } from '../scenery/japanese-garden/view';

export const WORLD_W = 1600;
export const WORLD_H = 1000;
export const MAX_DPR = 2;
/** What stays in view when portrait screens crop the sides: the default scenery's focus (the pond centre). */
export const DEFAULT_FOCUS: Pt = GARDEN_VIEW.focus;
/** Narrowest slice of the world a portrait screen shows (world units). */
export const MIN_VISIBLE_W = 600;

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  /** canvas size in CSS pixels */
  readonly cssW: number;
  readonly cssH: number;
  /** device pixel ratio, capped at MAX_DPR */
  readonly dpr: number;
  /** canvas backing-store size in device pixels */
  readonly pixelW: number;
  readonly pixelH: number;
  /** CSS pixels per world unit */
  readonly scale: number;
  /** device pixels per world unit (scale × dpr) — use for cache resolution */
  readonly pixelScale: number;
  /** CSS-pixel position of the world origin */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly focus: Pt;
  /** the part of the world that is visible, in world units */
  readonly visible: Rect;
  worldToScreen(p: Pt): Pt;
  screenToWorld(p: Pt): Pt;
  /** Set ctx's transform so drawing happens in world units on a canvas of pixelW×pixelH. */
  applyTo(ctx: CanvasRenderingContext2D): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Offset (CSS px) that puts `focus` at the screen centre without leaving the world. */
function axisOffset(screen: number, scaled: number, focus: number, scale: number): number {
  if (scaled <= screen) return (screen - scaled) / 2;
  return clamp(screen / 2 - focus * scale, screen - scaled, 0);
}

export function createViewport(
  cssW: number,
  cssH: number,
  devicePixelRatio = 1,
  focus: Pt = DEFAULT_FOCUS,
): Viewport {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  const dpr = clamp(Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1, 1, MAX_DPR);
  // cover, but never narrower than MIN_VISIBLE_W (tall phones: paper above and below instead)
  const scale = Math.min(Math.max(w / WORLD_W, h / WORLD_H), Math.max(w / MIN_VISIBLE_W, w / WORLD_W));
  const offsetX = axisOffset(w, WORLD_W * scale, focus.x, scale);
  const offsetY = axisOffset(h, WORLD_H * scale, focus.y, scale);
  return viewportFrom({ cssW: w, cssH: h, dpr, scale, offsetX, offsetY, focus });
}

/**
 * A viewport from its raw numbers (CSS size, DPR, CSS px per world unit, the world origin's CSS
 * position). `createViewport` derives them by cover scaling; the camera composes zoomed views
 * with the same shape (src/render/camera.ts).
 */
export function viewportFrom(v: { cssW: number; cssH: number; dpr: number; scale: number; offsetX: number; offsetY: number; focus: Pt }): Viewport {
  const { cssW: w, cssH: h, dpr, scale, offsetX, offsetY, focus } = v;
  const pixelScale = scale * dpr;
  return {
    cssW: w,
    cssH: h,
    dpr,
    pixelW: Math.round(w * dpr),
    pixelH: Math.round(h * dpr),
    scale,
    pixelScale,
    offsetX,
    offsetY,
    focus: { ...focus },
    visible: { x: -offsetX / scale, y: -offsetY / scale, w: w / scale, h: h / scale },
    worldToScreen: (p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }),
    screenToWorld: (p) => ({ x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale }),
    applyTo(ctx) {
      ctx.setTransform(pixelScale, 0, 0, pixelScale, offsetX * dpr, offsetY * dpr);
    },
  };
}
