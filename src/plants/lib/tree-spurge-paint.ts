/**
 * Painting helpers for the tree spurge (docs/systems/plants-species-b.md): a broken haze over the
 * dome, forked red-brown stems, tufts of narrow blue-green leaves, and flat lime bract heads.
 * Each mark carries its own seed; only size, place and opacity change with growth.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, padRect, shade, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

export interface HazeMark {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

export interface StemMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
}

export interface SpurgeLeaf {
  at: Pt;
  angle: number;
  len: number;
  wid: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

export interface BractHead {
  at: Pt;
  /** the head's radius now */
  R: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  /** each bract: angle and distance (fractions of R) and its size */
  bracts: [number, number, number][];
  seed: number;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 12): Pt[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return { x: cx + x * c - y * s, y: cy + x * s + y * c };
  });
}

/** A narrow leaf: tapered at both ends, widest just below the middle. */
export function spurgeLeaf(l: Pick<SpurgeLeaf, 'at' | 'angle' | 'len' | 'wid'>): Pt[] {
  const ux = Math.cos(l.angle);
  const uy = Math.sin(l.angle);
  const N = 6;
  const side = (s: number) =>
    Array.from({ length: N }, (_, i) => {
      const t = (i + 1) / (N + 1);
      const hw = (l.wid / 2) * Math.sin(Math.PI * t ** 0.85) ** 0.8;
      return { x: l.at.x + ux * l.len * t - uy * hw * s, y: l.at.y + uy * l.len * t + ux * hw * s };
    });
  const tip = { x: l.at.x + ux * l.len, y: l.at.y + uy * l.len };
  return [l.at, ...side(1), tip, ...side(-1).reverse()];
}

export function bractShapes(h: BractHead): Pt[][] {
  return h.bracts.map(([a, d, s]) => {
    const cx = h.at.x + Math.cos(a + h.rot) * d * h.R;
    const cy = h.at.y + Math.sin(a + h.rot) * d * h.R * 0.5;
    return ellipse(cx, cy, h.R * s, h.R * s * 0.62, a * 0.3, 9);
  });
}

export function paintHaze(p: Painter, marks: readonly HazeMark[]): void {
  const live = marks.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => ellipse(m.cx, m.cy, m.rx, m.ry))), 4));
  for (const m of live) {
    const rng = createRng(m.seed);
    L.fill(deformPolygon(ellipse(m.cx, m.cy, m.rx, m.ry, 0, 16), rng, { depth: 2, variance: 0.12 }), jitter(m.pigment, rng, 0.02), 0.32 * m.alpha);
  }
  L.dry({ opacity: 0.7, edge: 0.1, edgeWidth: 2, sharpness: 0.25, centreLift: 0.12, granulation: 0.4, flow: 0.5, flowScale: 12, dry: 0.15, darken: 0.05 });
}

export function paintStems(p: Painter, stems: readonly StemMark[]): void {
  const live = stems.filter((s) => s.pts.length >= 2 && s.width > 0.12);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 4));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.02, 0.2], endWidth: 0.7, fills: 2, coverage: 0.62 });
    if (s.width > 1) ribbonInto(L, s.pts, s.width * 0.35, shade(s.pigment, 0.3), rng, { taper: [0.1, 0.3], endWidth: 0.5, fills: 1, coverage: 0.25, offset: s.width * 0.25 });
  }
  L.dry({ opacity: 0.78, edge: 0.3, edgeWidth: 0.6, sharpness: 0.6, centreLift: 0.06, granulation: 0.3, flow: 0.25, flowScale: 8, dry: 0.1 });
}

export function paintTufts(p: Painter, leaves: readonly SpurgeLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.len > 0.5 && l.alpha > 0.02);
  if (!live.length) return;
  const shapes = live.map((l) => ({ l, poly: spurgeLeaf(l) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 3));
  for (const { l, poly } of shapes) {
    const rng = createRng(l.seed);
    L.fill(poly, jitter(l.pigment, rng, 0.03), 0.8 * l.alpha);
    // the lower half a little deeper
    const half = poly.slice(0, 8);
    L.fill(half, shade(l.pigment, 0.25), 0.25 * l.alpha);
  }
  L.dry({ opacity: 0.88, edge: 0.18, edgeWidth: 0.4, sharpness: 0.7, centreLift: 0.08, granulation: 0.1, flow: 0.1, flowScale: 6, ...dry });
}

export function paintHeads(p: Painter, heads: readonly BractHead[]): void {
  const live = heads.filter((h) => h.alpha > 0.02 && h.R > 0.4);
  if (!live.length) return;
  const shapes = live.map((h) => ({ h, polys: bractShapes(h) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.polys.flat())), 3));
  for (const { h, polys } of shapes) {
    const rng = createRng(h.seed);
    for (const poly of polys) L.fill(deformPolygon(poly, rng, { depth: 1, variance: 0.06 }), jitter(h.pigment, rng, 0.03), 0.78 * h.alpha);
    // the small dark-gold glands at the heart of each head
    L.fill(ellipse(h.at.x, h.at.y, h.R * 0.16, h.R * 0.1), shade(h.pigment, 0.3), 0.45 * h.alpha);
  }
  L.dry({ opacity: 0.92, blend: 'source-over', edge: 0.45, edgeWidth: 0.4, darken: 0.2, sharpness: 0.7, centreLift: 0.15, granulation: 0.08, flow: 0.1, flowScale: 6 });
}
