import { createRng, type Rng } from '../core/rng';
import { ICON_STROKES, MARK_BOX, MARK_LEAF } from '../ui/icons';
import type { WidgetPhase, WidgetTimeline } from './contract';
import { brushStroke, clamp01, cubic, inkLine, PIGMENT, wash, wobble, type Ctx, type P } from './brush';

/**
 * Painted favicon (SPEC §6 fallback): a brush ring that fills clockwise with session progress in
 * muted green (pond celadon during breaks, warm grey while paused). Once a session has bloomed while
 * the user was away the ring closes around the house sprout mark (ADR 0194): the sprout glyph's own
 * strokes in sumi ink with sap-green leaves. Never a round red dot.
 * The model is pure and quantised so the icon is redrawn only when it visibly changes.
 */

export const FAVICON_SIZE = 32;
/**
 * Pixels of the PNG a tab gets: the 32 px grid at 2×, so a 32 px icon at 2× DPR stays sharp and the
 * browser scales it down for 16 px tabs.
 */
export const FAVICON_RENDER_PX = 64;
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

  if (m.kind === 'complete') paintSproutMark(ctx, c, s, rng.fork('sprout'));
  ctx.restore();
}

/** Width of the sprout mark inside the ring, on the 32 px grid (the ring's inside is ~16 px). */
export const SPROUT_MARK_W = 14;

/**
 * The sprout mark (ADR 0194) centred at `c`: the `ICON_STROKES.sprout` glyph, cropped to `MARK_BOX`,
 * painted with the widget brush so it sits in the same watercolour as the ring. Leaves are washed in
 * sap green and outlined in ink, the stem is a firm sumi stroke and the ground a faint one. Strokes
 * are heavier than the UI mark's so they still read at 16 px.
 */
function paintSproutMark(ctx: Ctx, c: P, s: number, rng: Rng): void {
  const [bx, by, bw, bh] = MARK_BOX;
  const k = (SPROUT_MARK_W / bw) * s;
  const ox = c.x - (bx + bw / 2) * k;
  const oy = c.y - (by + bh / 2) * k + 0.2 * s; // optical centre: the glyph is heavy at the top
  const [stem, right, left, ground] = ICON_STROKES.sprout.map((st) => glyphPath(st.d).map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })));
  for (const [leaf, alpha, key] of [
    [right!, 0.8, 'right'],
    [left!, 0.7, 'left'],
  ] as const) {
    wash(ctx, leaf, rng.fork(`${key}-wash`), { color: MARK_LEAF, alpha, layers: 2, jitter: 0.12 * s, rim: 0.5, rimColor: PIGMENT.olive });
    inkLine(ctx, [...leaf, leaf[0]!], rng.fork(`${key}-ink`), { width: () => 0.8 * s, alpha: 0.78 });
  }
  inkLine(ctx, stem!, rng.fork('stem'), { width: (t) => (1.9 - 0.5 * t) * s, alpha: 0.9 });
  inkLine(ctx, ground!, rng.fork('ground'), { width: (t) => (1.05 - 0.5 * Math.abs(t - 0.5)) * s, alpha: 0.38 });
}

/**
 * Points along an icon path (`M`/`L`/`C`/`Z`, absolute or relative, implicit repeats), the subset
 * the ink icons use. Curves are sampled at 8 points each; one open or closed outline.
 */
export function glyphPath(d: string): P[] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const pts: P[] = [];
  let cur: P = { x: 0, y: 0 };
  let cmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const pt = (): P => {
      const x = num();
      const y = num();
      return rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
    };
    switch (cmd.toUpperCase()) {
      case 'M':
      case 'L':
        cur = pt();
        pts.push(cur);
        if (cmd === 'M') cmd = 'L';
        if (cmd === 'm') cmd = 'l';
        break;
      case 'C': {
        const p1 = pt();
        const p2 = pt();
        const p3 = pt();
        const p0 = cur;
        for (let t = 1; t <= 8; t++) pts.push(cubic(p0, p1, p2, p3, t / 8));
        cur = p3;
        break;
      }
      case 'Z':
        i = tokens.length;
        break;
      default:
        throw new Error(`glyphPath: unsupported command ${cmd}`);
    }
  }
  return pts;
}

/** Render a model to a PNG data URL (needs a DOM canvas). */
export function faviconDataUrl(doc: Document, m: FaviconModel, size = FAVICON_RENDER_PX): string {
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawFavicon(ctx, m, size);
  return canvas.toDataURL('image/png');
}

