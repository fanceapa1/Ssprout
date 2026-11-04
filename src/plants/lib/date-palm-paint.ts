/**
 * Date palm painting helpers (docs/devlog/106-date-palm.md): the arching rachis of a pinnate
 * frond, its stiff V-set leaflets, the trunk's diamond lattice of old leaf bases and the hanging
 * date clusters. Pure geometry plus one wet layer per pass.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { bounds, padRect, ribbon, type Pt } from '../../paint/geometry';
import type { Pigment } from '../../paint/pigments';
import type { DryOptions } from '../../paint/wet';
import { stableLayer } from './tree-paint';
import { clamp01 } from './tree-structure';

/** A frond's rachis at one moment: where it leaves the crown, its first heading and how it arches. */
export interface RachisShape {
  from: Pt;
  /** screen angle of the first heading (−π/2 is straight up) */
  heading: number;
  length: number;
  /** total turn toward the ground along the rachis, radians */
  bend: number;
  /** +1 arches over to the right, −1 to the left */
  side: number;
}

/** Points along an arching rachis (n + 1 of them), turning toward the ground as it goes. */
export function rachisPath(s: RachisShape, n = 12): Pt[] {
  const pts: Pt[] = [s.from];
  // the furthest it may turn: almost straight down, never back under itself
  const limit = s.side > 0 ? Math.PI / 2 - 0.12 : -Math.PI * 1.5 + 0.12;
  const angle = (t: number) => {
    const a = s.heading + s.side * s.bend * t ** 1.4;
    return s.side > 0 ? Math.min(a, Math.max(limit, s.heading)) : Math.max(a, Math.min(limit, s.heading));
  };
  const step = s.length / n;
  let x = s.from.x;
  let y = s.from.y;
  for (let i = 0; i < n; i++) {
    const a = angle((i + 0.5) / n);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push({ x, y });
  }
  return pts;
}

/** Heading of a polyline at index i (central difference). */
export function headingOf(pts: readonly Pt[], i: number): number {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** A point at fraction t of a polyline whose points are evenly spaced, with its heading. */
export function along(pts: readonly Pt[], t: number): { at: Pt; heading: number } {
  const x = clamp01(t) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(x));
  const f = x - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  return { at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, heading: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** A stiff, narrow leaflet: base at `at`, pointing along `angle`, a sharp tip, a slight sag. */
export function pinnaOutline(at: Pt, angle: number, length: number, width: number, sag = 0): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const prof = [
    [0, 0.35],
    [0.2, 0.5],
    [0.55, 0.42],
    [0.82, 0.24],
  ] as const;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const pt = (u: number, v: number) => {
    const dy = sag * u * u * length;
    return { x: at.x + c * u * length - s * v, y: at.y + s * u * length + c * v + dy };
  };
  for (const [u, w] of prof) {
    left.push(pt(u, (w * width) / 2));
    right.push(pt(u, (-w * width) / 2));
  }
  return [...left, pt(1, 0), ...right.reverse()];
}

export interface PinnaMark {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  sag: number;
  pigment: Pigment;
  alpha: number;
}

export interface RachisMark {
  path: Pt[];
  width: number;
  pigment: Pigment;
  alpha: number;
}

/** Leaflets and their ribs in one wet layer: one pass of a crown (back or front). */
export function paintFrondPass(p: Painter, pinnae: readonly PinnaMark[], ribs: readonly RachisMark[], rng: Rng, dry: DryOptions): void {
  const live = pinnae.filter((m) => m.length > 0.5 && m.alpha > 0.02);
  const liveRibs = ribs.filter((r) => r.width > 0.1 && r.alpha > 0.02 && r.path.length > 1);
  if (!live.length && !liveRibs.length) return;
  const pts: Pt[] = [...live.map((m) => m.at), ...liveRibs.flatMap((r) => [r.path[0]!, r.path.at(-1)!])];
  const reach = live.reduce((m, q) => Math.max(m, q.length), 4);
  const L = stableLayer(p, padRect(bounds(pts), reach + 4), rng.fork('pass-dry'));
  for (const m of live) L.fill(pinnaOutline(m.at, m.angle, m.length, m.width, m.sag), m.pigment, m.alpha);
  for (const r of liveRibs) L.fill(ribbon(r.path, (t) => r.width * (1 - 0.75 * t) + 0.15), r.pigment, r.alpha);
  L.dry(dry);
}

export interface SoftRibbon {
  path: Pt[];
  /** half width at t (0..1 along the path) */
  hw: (t: number) => number;
  pigment: Pigment;
  alpha: number;
}

/** Soft feathery masses under the fronds, wet in wet, at reduced resolution. */
export function paintCrownWash(p: Painter, masses: readonly SoftRibbon[], rng: Rng, dry: DryOptions, res?: number): void {
  const live = masses.filter((m) => m.alpha > 0.02 && m.path.length > 1);
  if (!live.length) return;
  const pts = live.flatMap((m) => m.path);
  const L = stableLayer(p, padRect(bounds(pts), 30), rng.fork('wash-dry'), res);
  for (const m of live) L.fill(ribbon(m.path, m.hw), m.pigment, m.alpha);
  L.dry(dry);
}

/** The trunk as a tapering column along `path` (base first), its far side in shade. */
export function paintTrunkBody(p: Painter, path: readonly Pt[], hw: (t: number) => number, rng: Rng, pig: { body: Pigment; shade: Pigment }, amount: number): void {
  if (path.length < 2 || amount <= 0.01) return;
  const L = stableLayer(p, padRect(bounds(path), 20), rng.fork('trunk-dry'));
  L.fill(ribbon(path, hw), pig.body, 0.55 * amount);
  // the shaded right flank (light from the upper left), wet into the body
  L.fill(ribbon(path, (t) => hw(t) * 0.5, (t) => hw(t) * 0.5), pig.shade, 0.5 * amount);
  L.fill(ribbon(path, (t) => hw(t) * 0.2, (t) => hw(t) * 0.78), pig.shade, 0.35 * amount);
  L.dry({ opacity: 0.88, edge: 0.35, edgeWidth: 1.2, sharpness: 0.65, centreLift: 0.12, granulation: 0.45, flow: 0.5, flowScale: 9, darken: 0.2 });
}

export interface LeafBase {
  at: Pt;
  /** trunk heading at this row */
  heading: number;
  /** half width (across the trunk) and half height of the diamond */
  hw: number;
  hh: number;
  /** −1 lit flank … 1 shaded flank */
  flank: number;
  /** 0..1 how far it has arrived */
  k: number;
  id: number;
}

/**
 * The diamond lattice of old leaf bases: each stub casts a dark crescent beneath it and catches
 * a pale facet on top, so the rows read as a woven, knobbly column.
 */
export function paintLeafBases(p: Painter, bases: readonly LeafBase[], rng: Rng, pig: { dark: Pigment; pale: Pigment }): void {
  const live = bases.filter((b) => b.k > 0.03 && b.hw > 0.4);
  if (!live.length) return;
  const area = padRect(bounds(live.map((b) => b.at)), 12);
  const D = stableLayer(p, area, rng.fork('bases-dark-dry'));
  const P = stableLayer(p, area, rng.fork('bases-pale-dry'));
  for (const b of live) {
    const r = createRng(b.id * 977 + 13);
    // along = up the trunk, across = to the right of it
    const ux = Math.cos(b.heading);
    const uy = Math.sin(b.heading);
    const ax = -uy;
    const ay = ux;
    const pt = (u: number, v: number) => ({ x: b.at.x + ux * u + ax * v, y: b.at.y + uy * u + ay * v });
    const w = b.hw * b.k * r.range(0.75, 1.15);
    const h = b.hh * b.k * r.range(0.75, 1.15);
    const shade = 0.5 + 0.5 * b.flank;
    // the crescent of shadow under the stub's lip
    const lip = r.range(0.05, 0.3);
    D.fill([pt(lip * h, -w), pt(-h * 0.25, -w * 0.55), pt(-h, r.range(-0.15, 0.15) * w), pt(-h * 0.25, w * 0.55), pt(lip * h, w), pt(-h * 0.35, w * 0.2), pt(-h * 0.55, 0), pt(-h * 0.35, -w * 0.2)], pig.dark, (0.24 + 0.36 * shade) * r.range(0.75, 1.1) * Math.min(1, b.k * 1.5));
    // the lit upper facet of the stub
    if (b.flank < 0.55) P.fill([pt(lip * h + 0.4, -w * 0.8), pt(h * 0.75, r.range(-0.2, 0.2) * w), pt(lip * h + 0.4, w * 0.8), pt(lip * h + h * 0.18, 0)], pig.pale, (0.55 - 0.45 * Math.max(0, b.flank)) * Math.min(1, b.k * 1.5));
  }
  D.dry({ opacity: 0.72, edge: 0.4, edgeWidth: 0.6, sharpness: 0.65, centreLift: 0.12, granulation: 0.35, flow: 0.3, flowScale: 7, darken: 0.25 });
  P.dry({ opacity: 0.7, edge: 0.25, edgeWidth: 0.5, sharpness: 0.7, centreLift: 0.15, granulation: 0.45, flowScale: 7, blend: 'source-over' });
}

export interface DateMark {
  at: Pt;
  angle: number;
  /** length of the fruit (its width is about 0.68 of it) */
  size: number;
  pigment: Pigment;
  alpha: number;
}

/** Dates as small glossy ovals in one layer, and their stalks and strands in another. */
export function paintDates(p: Painter, stalks: readonly RachisMark[], dates: readonly DateMark[], rng: Rng): void {
  const liveStalks = stalks.filter((s) => s.alpha > 0.02 && s.width > 0.1 && s.path.length > 1);
  const live = dates.filter((d) => d.size > 0.3 && d.alpha > 0.02);
  if (liveStalks.length) {
    const S = stableLayer(p, padRect(bounds(liveStalks.flatMap((s) => s.path)), 6), rng.fork('stalk-dry'));
    for (const s of liveStalks) S.fill(ribbon(s.path, (t) => s.width * (1 - 0.6 * t) + 0.1), s.pigment, s.alpha);
    S.dry({ opacity: 0.85, edge: 0.4, edgeWidth: 0.5, sharpness: 0.75, centreLift: 0.1, granulation: 0.2, flowScale: 8 });
  }
  if (!live.length) return;
  // alternate dates in two layers, so neighbours keep their own edges instead of merging
  const area = padRect(bounds(live.map((d) => d.at)), 6);
  const layers = [stableLayer(p, area, rng.fork('dates-dry')), stableLayer(p, area, rng.fork('dates-dry-2'))];
  live.forEach((d, i) => {
    const c = Math.cos(d.angle);
    const s = Math.sin(d.angle);
    const poly: Pt[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const u = Math.cos(a) * d.size * 0.5;
      const v = Math.sin(a) * d.size * 0.46;
      poly.push({ x: d.at.x + c * u - s * v, y: d.at.y + s * u + c * v });
    }
    layers[i % 2]!.fill(poly, d.pigment, d.alpha);
  });
  for (const L of layers) L.dry({ opacity: 0.92, edge: 0.55, edgeWidth: 0.5, sharpness: 0.85, centreLift: 0.12, granulation: 0.15, flow: 0.25, flowScale: 6, darken: 0.35 });
}
