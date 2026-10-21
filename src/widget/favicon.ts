import { createRng } from '../core/rng';
import type { WidgetPhase, WidgetTimeline } from './contract';
import { brushStroke, clamp01, PIGMENT, wash, wobble, type Ctx, type P } from './brush';

/**
 * Painted favicon (SPEC §6 fallback): a brush ring that fills clockwise with session progress in
 * muted green (pond celadon during breaks, warm grey while paused), closed with a vermilion dot
 * once a session has bloomed while the user was away.
 * The model is pure and quantised so the icon is redrawn only when it visibly changes.
 */

export const FAVICON_SIZE = 32;
/** Progress resolution of the ring (one redraw per step at most). */
export const FAVICON_STEPS = 48;

export type RingTone = 'focus' | 'break' | 'paused';

export type FaviconModel = { kind: 'none' } | { kind: 'progress'; step: number; tone: RingTone } | { kind: 'complete' };

export interface FaviconInput {
  phase: WidgetPhase;
  timeline: Pick<WidgetTimeline, 'progress'> | null;
  /** an unseen completion */
  bloomed?: boolean;
}

/** Ring = whole-session progress; tone = focus (olive), break (pond celadon) or paused (stone). */
export function faviconModel(input: FaviconInput): FaviconModel {
  if (input.phase === 'idle') return input.bloomed ? { kind: 'complete' } : { kind: 'none' };
  const raw = input.timeline?.progress ?? 0;
  const p = Number.isFinite(raw) ? clamp01(raw) : 0;
  return { kind: 'progress', step: Math.floor(p * FAVICON_STEPS), tone: input.phase };
}

/** Stable identity of a model (redraw only when it changes). */
export function faviconKey(m: FaviconModel): string {
  if (m.kind === 'progress') return `p${m.step}${m.tone[0]}`;
  return m.kind;
}

/** Fraction of the ring painted for a model. */
export function ringFraction(m: FaviconModel): number {
  if (m.kind === 'complete') return 1;
  if (m.kind === 'progress') return clamp01(m.step / FAVICON_STEPS);
  return 0;
}

export const RING_PIGMENT: Record<RingTone, string> = { focus: PIGMENT.olive, break: '#6f9690', paused: PIGMENT.stone };

const RING_SEED = 'favicon-ring';

/** Paint the icon into a `size`×`size` area at the context origin. */
export function drawFavicon(ctx: Ctx, m: FaviconModel, size = FAVICON_SIZE): void {
  const s = size / 32; // designed on a 32 px grid
  const rng = createRng(RING_SEED);
  const c: P = { x: 16 * s, y: 16 * s };
  ctx.save();
  ctx.lineJoin = 'round';

  // washi disc: keeps the ring legible on light and dark tab strips
  const discNoise = wobble(rng.fork('disc'));
  const disc: P[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = (15.2 + discNoise(a * 1.3) * 0.7) * s;
    disc.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  wash(ctx, disc, rng.fork('disc-wash'), { color: PIGMENT.paper, alpha: 0.62, layers: 3, jitter: 0.35 * s, rim: 0.28, rimColor: PIGMENT.stoneWarm });

  // faint track: the whole circle, barely tinted
  const R = 10.2 * s;
  const ringNoise = wobble(rng.fork('ring'));
  const arc = (from: number, to: number, steps: number): P[] => {
    const pts: P[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = from + ((to - from) * i) / steps;
      const a = -Math.PI / 2 + u * Math.PI * 2;
      const r = R + ringNoise(u * 6) * 0.45 * s;
      pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    return pts;
  };
  brushStroke(ctx, arc(0, 1, 48), rng.fork('track'), { width: () => 3.2 * s, color: PIGMENT.sage, alpha: 0.28, edge: 0.08 });

  const frac = ringFraction(m);
  if (frac > 0) {
    const color = m.kind === 'progress' ? RING_PIGMENT[m.tone] : PIGMENT.olive;
    const steps = Math.max(3, Math.round(48 * frac));
    const pts = arc(0, frac, steps);
    // the brush loads at the start, presses in the middle, lifts at the end
    const width = (t: number) => {
      const lift = frac < 0.999 ? Math.min(1, (1 - t) * frac * 9 + 0.35) : 1;
      const press = Math.min(1, t * frac * 14 + 0.55);
      return (3.6 + Math.sin(t * Math.PI * 3 * frac) * 0.5) * s * Math.min(lift, press);
    };
    brushStroke(ctx, pts, rng.fork('wash'), { width: (t) => width(t) * 1.25, color, alpha: 0.38, edge: 0.18 });
    brushStroke(ctx, pts, rng.fork('core'), { width: (t) => width(t) * 0.72, color, alpha: 0.72, edge: 0.14 });
  }

  if (m.kind === 'complete') {
    const dot: P[] = [];
    const dn = wobble(rng.fork('dot'));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = (4.1 + dn(a * 2) * 0.45) * s;
      dot.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    wash(ctx, dot, rng.fork('dot-wash'), { color: PIGMENT.vermilion, alpha: 0.55, layers: 3, jitter: 0.3 * s, rim: 0.55 });
  }
  ctx.restore();
}

/** Render a model to a PNG data URL (needs a DOM canvas). */
export function faviconDataUrl(doc: Document, m: FaviconModel, size = FAVICON_SIZE): string {
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawFavicon(ctx, m, size);
  return canvas.toDataURL('image/png');
}

