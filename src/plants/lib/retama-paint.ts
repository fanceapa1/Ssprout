/**
 * Painting helpers for the white broom (docs/systems/plants-species-c.md): fine arching rods in
 * dry brush, a soft grey-green body under them, and small white pea flowers with a violet calyx.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// rods

export interface Rod {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
}

/** Rods in one wet layer: thin tapered ribbons, broken by a dry brush on the paper's tooth. */
export function paintRods(p: Painter, rods: readonly Rod[], dry: DryOptions = {}): void {
  const live = rods.filter((r) => r.pts.length >= 2 && r.width > 0.05);
  if (!live.length) return;
  const maxW = Math.max(...live.map((r) => r.width));
  const L = p.layer(padRect(bounds(live.flatMap((r) => r.pts)), maxW * 2 + 3));
  for (const r of live) ribbonInto(L, r.pts, r.width, r.pigment, createRng(r.seed), { taper: [0.02, 0.55], pressure: (u) => 1.1 - u * 0.45, fills: r.width > 1.2 ? 2 : 1 });
  L.dry({ opacity: 0.85, edge: 0.35, edgeWidth: Math.max(0.25, maxW * 0.3), sharpness: 0.7, centreLift: 0.1, granulation: 0.15, flow: 0.25, flowScale: 8, dry: 0.25, ...dry });
}

// ---------------------------------------------------------------------------------------------
// body

export interface Haze {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

/** An irregular soft ellipse (pure). */
export function hazeShape(m: Haze): Pt[] {
  const rng = createRng(m.seed);
  const n = 14;
  const c = Math.cos(m.rot);
  const s = Math.sin(m.rot);
  return Array.from({ length: n }, (_, i) => {
    const k = rng.range(0.78, 1.12);
    const a = (i / n) * TAU;
    const x = Math.cos(a) * m.rx * k;
    const y = Math.sin(a) * m.ry * k;
    return { x: m.at.x + x * c - y * s, y: m.at.y + x * s + y * c };
  });
}

/** Soft wet-in-wet patches: the grey-green body of the mound, or the white haze of the bloom. */
export function paintHaze(p: Painter, hazes: readonly Haze[], dry: DryOptions = {}): void {
  const live = hazes.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const shapes = live.map((m) => ({ m, poly: hazeShape(m), rng: createRng(m.seed + 1) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 4));
  for (const { m, poly, rng } of shapes) {
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.14 }), jitter(m.pigment, rng, 0.03), 0.22 * m.alpha);
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.12 }), jitter(m.pigment, rng, 0.03), 0.16 * m.alpha);
  }
  L.dry({ opacity: 0.55, edge: 0, edgeWidth: 4, sharpness: 0.05, centreLift: 0, granulation: 0.3, flow: 0.5, flowScale: 14, darken: 0, ...dry });
}

// ---------------------------------------------------------------------------------------------
// pea flowers

export interface PeaFlower {
  /** where its stalk leaves the rod */
  at: Pt;
  /** the way it hangs, radians */
  angle: number;
  size: number;
  /** 0 a closed bud … 1 open */
  open: number;
  petal: Pigment;
  calyx: Pigment;
  keel: Pigment;
  alpha: number;
  seed: number;
}

function blob(c: Pt, rx: number, ry: number, rot: number, rng: { range(a: number, b: number): number }, n = 9): Pt[] {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const k = rng.range(0.88, 1.08);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
  });
}

/** A pea flower's calyx cup, its round standard and the small keel below it (pure). */
export function peaShape(f: PeaFlower): { calyx: Pt[]; standard: Pt[]; keel: Pt[]; shade: Pt[] } {
  const rng = createRng(f.seed);
  const ux = Math.cos(f.angle);
  const uy = Math.sin(f.angle);
  const s = f.size;
  const o = f.open;
  const along = (d: number, side = 0): Pt => ({ x: f.at.x + ux * d - uy * side, y: f.at.y + uy * d + ux * side });
  const calyx = blob(along(s * 0.28), s * 0.24, s * 0.17, f.angle, rng, 7);
  // a bud is a cream tip out of the calyx; open, the standard swings up and spreads round
  const r = s * (0.28 + 0.34 * o);
  const standard = blob(along(s * (0.62 + 0.25 * o), s * 0.12 * o), r * (1 - 0.2 * o), r * (0.62 + 0.3 * o), f.angle, rng, 10);
  const keel = o > 0.05 ? blob(along(s * (0.7 + 0.45 * o), -s * 0.2 * o), s * 0.36 * o, s * 0.2 * o, f.angle - 0.4, rng, 7) : [];
  const shade = blob(along(s * (0.7 + 0.3 * o), -r * 0.35), r * 0.6, r * 0.35, f.angle, rng, 7);
  return { calyx, standard, keel, shade };
}

export interface PeaStyle {
  /** the cool violet-grey that shades a white petal */
  shadow: Pigment;
}

/** Flowers over the rods (source-over, so white stays white over the green). */
export function paintPeas(p: Painter, flowers: readonly PeaFlower[], o: PeaStyle): void {
  const live = flowers.filter((f) => f.alpha > 0.02 && f.size > 0.15);
  if (!live.length) return;
  const shapes = live.map((f) => ({ f, s: peaShape(f), rng: createRng(f.seed + 5) }));
  const area = padRect(bounds(shapes.flatMap(({ s }) => [...s.calyx, ...s.standard, ...s.keel])), 3);
  const L = p.layer(area);
  for (const { f, s, rng } of shapes) {
    L.fill(s.standard, jitter(f.petal, rng, 0.015), 0.95 * f.alpha);
    if (s.keel.length) L.fill(s.keel, jitter(f.keel, rng, 0.02), 0.9 * f.alpha);
    // the shaded side of the standard, wet into the white
    if (f.open > 0.3) L.fill(s.shade, mix(f.petal, o.shadow, 0.7), 0.3 * f.alpha * f.open);
    L.fill(s.calyx, jitter(mix(f.calyx, f.petal, 0.4 * f.open), rng, 0.03), 0.8 * f.alpha);
  }
  L.dry({ opacity: 0.97, blend: 'source-over', edge: 0.35, edgeWidth: 0.2, darken: 0.08, sharpness: 0.8, centreLift: 0.04, granulation: 0.02, flow: 0.15, flowScale: 3 });
}
