/**
 * The coast's rock painters' shared kit (G2): the Ionian limestone palette and the small helpers
 * the promontory, the temple, the village hill and the shore rocks share. Lazy chunk only.
 * docs/systems/scenery.md › Coast › Rock.
 */
import type { Rng } from '../../core/rng';
import { bounds, closedResample, createSimplex2D, rgba, type DryOptions, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';

/** White-grey to warm cream limestone, lit from the left; cool violet-grey in shade. */
export const LIME = {
  under: '#efe9de',
  cream: '#eadcc0',
  body: '#d6d1c7',
  grey: '#b7b2ab',
  shade: '#9f9bae',
  recess: '#7d778d',
  deep: '#5f5a6c',
  ochre: '#cfa368',
  rust: '#b07650',
  wet: '#5e6662',
  algae: '#6b7656',
  lit: '#fbf6ea',
} satisfies Record<string, Pigment>;

/** Marble of the temple: warm ivory in the light, cool in shade. */
export const MARBLE = {
  ivory: '#f1e6cf',
  warm: '#e4cfa6',
  shade: '#a7a2b6',
  deep: '#77728a',
  stain: '#c49a62',
} satisfies Record<string, Pigment>;

export interface Mark {
  poly: readonly Pt[];
  alpha: number;
}

export function trace(p: Painter, shape: readonly Pt[]): void {
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
}

/** An opaque underlayer: hides what is behind, so no paper shows where a wash stops short of the edge. */
export function fillUnder(p: Painter, shape: readonly Pt[], pigment: Pigment): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.fillStyle = rgba(pigment);
  p.ctx.fill();
  p.ctx.restore();
}

/** Clip to `shape` (with `holes` cut out); the caller restores. */
export function clipTo(p: Painter, shape: readonly Pt[], holes: readonly (readonly Pt[])[] = []): void {
  p.ctx.save();
  p.ctx.beginPath();
  for (const s of [shape, ...holes]) {
    s.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
  }
  p.ctx.clip('evenodd');
}

/** A hand-cut outline: resampled and nudged by noise, so no edge is ruled. */
export function rough(poly: readonly Pt[], rng: Rng, amp = 1.2, spacing = 4): Pt[] {
  const noise = createSimplex2D(rng.fork('rough'));
  return closedResample(poly, spacing).map((q) => ({ x: q.x + noise(q.x / 12, q.y / 12) * amp, y: q.y + noise(q.y / 12 + 40, q.x / 12) * amp }));
}

export function box(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 32): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * rx, y: cy + Math.sin((i / n) * Math.PI * 2) * ry }));
}

/** y on a polyline sorted by x, held flat past its ends. */
export function lineAt(line: readonly Pt[], x: number): number {
  if (x <= line[0]!.x) return line[0]!.y;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (b.x >= x) return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return line[line.length - 1]!.y;
}

/** A band between two edges over x0..x1, its ends cut on a slant. */
export function band(x0: number, x1: number, top: (x: number) => number, low: (x: number) => number, step = 8): Pt[] {
  const xs: number[] = [];
  for (let x = x0; x < x1; x += step) xs.push(x);
  xs.push(x1);
  return [...xs.map((x) => ({ x, y: top(x) })), ...xs.reverse().map((x) => ({ x, y: low(x) }))];
}

/** A tapering streak from `a` down to `b`, `w` wide at its head. */
export function streak(a: Pt, b: Pt, w: number, rng: Rng): Pt[] {
  const n = 6;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const hw = (w / 2) * (1 - t * 0.85) * (0.8 + rng.next() * 0.4);
    const x = a.x + (b.x - a.x) * t + Math.sin(t * 5 + a.x) * w * 0.15;
    const y = a.y + (b.y - a.y) * t;
    left.push({ x: x - hw, y });
    right.push({ x: x + hw, y });
  }
  return [...left, ...right.reverse()];
}

/** Marks wet together and dried in one pass (a glaze each would pay a drying pass each). */
export function* wetBatch(p: Painter, marks: readonly Mark[], pigment: Pigment, dry: DryOptions): Strokes {
  if (!marks.length) return;
  const r = bounds(marks.flatMap((m) => m.poly));
  const L = p.layer({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 });
  for (const m of marks) L.fill(m.poly, pigment, m.alpha);
  L.flush();
  yield;
  yield* L.dryParts(dry);
  yield;
}

/** Marks kept inside their own shape (each group clipped to its `clip`), all wet in one layer and dried once. */
export function* clipBatch(p: Painter, groups: readonly { clip: readonly Pt[]; marks: readonly Mark[] }[], pigment: Pigment, dry: DryOptions, lift = false): Strokes {
  const live = groups.filter((g) => g.marks.length);
  if (!live.length) return;
  const r = bounds(live.flatMap((g) => g.clip));
  const L = p.layer({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 });
  for (const g of live) {
    L.ctx.save();
    L.clip(g.clip);
    for (const m of g.marks) L.fill(m.poly, pigment, m.alpha);
    L.ctx.restore();
  }
  L.flush();
  yield;
  yield* L.dryParts(lift ? { edge: 0.1, granulation: 0.1, flow: 0.2, darken: 0, ...dry, blend: 'source-over' } : dry);
  yield;
}

/** Lifts (paper put back) wet together and dried once, painted over what is there. */
export function* liftBatch(p: Painter, marks: readonly Mark[], pigment: Pigment, dry: DryOptions = {}): Strokes {
  yield* wetBatch(p, marks, pigment, { edge: 0.1, granulation: 0.1, flow: 0.2, darken: 0, ...dry, blend: 'source-over' });
}
