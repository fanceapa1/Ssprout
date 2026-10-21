import { createRng } from '../core/rng';
import { createPainter, lighten, makeCanvas, mix, PIGMENTS } from '../paint';

/**
 * In-canvas placement highlight (docs/systems/plants.md › Placement highlight, ADR 0117): while
 * the gardener chooses a spot, every compatible slot gets a soft, slowly breathing wash dab on
 * the ground, stronger under the pointer / keyboard focus and at the chosen spot. The DOM
 * markers (src/ui/placement.ts) stay the source of truth for input; this is only paint.
 */

/** What the UI's `placement.subscribe` delivers (structural copy of `PlacementHighlight`). */
export interface PlacementSnapshot {
  active: boolean;
  speciesId: string | null;
  slots: ReadonlyArray<{ id: string; x: number; y: number; occupied: boolean }>;
  focused: string | null;
  selected: string | null;
}

export interface PlacementSource {
  current(): PlacementSnapshot;
  subscribe(fn: (h: PlacementSnapshot) => void): () => void;
}

export const NO_PLACEMENT: PlacementSnapshot = { active: false, speciesId: null, slots: [], focused: null, selected: null };

/** Breathing period of the dabs, seconds. */
export const BREATH_SECONDS = 4.2;

/** Dab opacity for a slot at time t (pure). */
export function dabAlpha(t: number, phase: number, state: 'idle' | 'focused' | 'selected', reducedMotion: boolean): number {
  const breath = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin((t / BREATH_SECONDS) * Math.PI * 2 + phase);
  if (state === 'selected') return 0.62 + 0.12 * breath;
  if (state === 'focused') return 0.5 + 0.1 * breath;
  return 0.2 + 0.14 * breath;
}

/** Ghost preview opacity. */
export const GHOST_ALPHA = 0.34;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
const dabCache = new Map<number, AnyCanvas | null>();
export const DAB_BOX = { w: 120, h: 48 };

/** A pale, soft-edged wash of warm sage-gold (120 × 48 units), cached per pixel width. */
export function highlightDab(px: number): AnyCanvas | null {
  const b = Math.max(16, Math.min(320, 2 ** (Math.round(Math.log2(Math.max(1, px)) * 3) / 3)));
  if (dabCache.has(b)) return dabCache.get(b)!;
  let out: AnyCanvas | null = null;
  try {
    const scale = b / DAB_BOX.w;
    const c = makeCanvas(Math.ceil(DAB_BOX.w * scale), Math.ceil(DAB_BOX.h * scale));
    const p = createPainter(c, { seed: 'placement-dab' });
    const rng = createRng('placement-dab');
    p.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const tone = mix(lighten(PIGMENTS.sageLight, 0.05), PIGMENTS.gold, 0.32);
    p.wash({ cx: 60, cy: 26, rx: 50, ry: 15 }, tone, { rng, opacity: 0.6, edge: 0.3, sharpness: 0.25, centreLift: 0.35, deform: 0.4, granulation: 0.15 });
    p.wash({ cx: 58, cy: 27, rx: 24, ry: 7 }, mix(tone, PIGMENTS.sap, 0.4), { rng, opacity: 0.35, edge: 0.25, sharpness: 0.2, deform: 0.5 });
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    out = c;
  } catch {
    out = null;
  }
  dabCache.set(b, out);
  return out;
}
