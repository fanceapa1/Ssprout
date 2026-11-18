/**
 * Painting helpers for the sea lavender (docs/systems/plants-species-a.md): leathery paddle
 * leaves in a flat rosette, wiry bare stems, a pale lilac haze and the tiny papery flowers.
 * Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;
const LIGHT_DIR = -2.3;

// ---------------------------------------------------------------------------------------------
// the paddle leaf

export interface PaddleGeom {
  outline: Pt[];
  shade: Pt[];
  rib: Pt[];
}

/** An obovate leaf, narrow at the stalk and widest past the middle, its tip curled up by `lift`. */
export function paddleGeometry(base: Pt, angle: number, len: number, wid: number, lift: number): PaddleGeom {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const to = (u: number, v: number): Pt => ({ x: base.x + u * len * ca - v * sa, y: base.y + u * len * sa + v * ca - lift * u * u });
  const hw = (u: number) => (wid / 2) * Math.sin(Math.PI * u ** 1.6) ** 0.75;
  const us = [0.08, 0.2, 0.34, 0.48, 0.62, 0.76, 0.88, 0.97];
  const left = us.map((u) => to(u, -hw(u)));
  const right = us.map((u) => to(u, hw(u)));
  const mid = [0.04, 0.3, 0.6, 0.9].map((u) => to(u, 0));
  const nx = -sa;
  const ny = ca;
  const shadeSide = nx * Math.cos(LIGHT_DIR) + ny * Math.sin(LIGHT_DIR) > 0 ? right : left;
  const tip = to(1, 0);
  return {
    outline: [to(0, 0), ...left, tip, ...[...right].reverse()],
    shade: [...shadeSide, tip, ...[...mid].reverse()],
    rib: mid,
  };
}

export interface PaddleMark {
  geom: PaddleGeom;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
  alpha: number;
}

/** The rosette: two washes a leaf, a cooler shaded half and a lifted midrib. */
export function paintPaddles(p: Painter, marks: readonly PaddleMark[]): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.6 * m.alpha);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.3 * m.alpha);
    L.fill(deformPolygon(m.geom.shade, rng, { depth: 1, variance: 0.04 }), m.deep, 0.4 * m.alpha);
  }
  for (const m of live) if (m.alpha > 0.5) L.lift(ribbon(smoothPath(m.geom.rib, 1), (t) => 0.32 * (1 - 0.7 * t)), 0.4 * Math.min(1, m.alpha));
  L.dry({ opacity: 0.93, edge: 0.5, edgeWidth: 0.8, sharpness: 0.64, centreLift: 0.06, granulation: 0.28, flow: 0.3, flowScale: 8, dry: 0.03, darken: 0.2 });
}

// ---------------------------------------------------------------------------------------------
// wiry stems

export interface WireMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintWires(p: Painter, wires: readonly WireMark[], opacity = 0.9): void {
  const live = wires.filter((s) => s.pts.length >= 2 && s.width > 0.12);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.03, 0.2], endWidth: 0.5, fills: 1, coverage: 0.7 });
    if (s.width > 0.6) ribbonInto(L, s.pts, s.width * 0.4, s.deep, rng, { taper: [0.1, 0.3], endWidth: 0.5, fills: 1, coverage: 0.4, offset: s.width * 0.18 });
  }
  L.dry({ opacity, edge: 0.12, edgeWidth: 0.5, sharpness: 0.5, centreLift: 0.04, granulation: 0.2, flow: 0.25, flowScale: 8, dry: 0.03 });
}

// ---------------------------------------------------------------------------------------------
// the froth

export interface HazeMark {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  alpha: number;
  pigment: Pigment;
  seed: number;
}

const ellipse = (h: HazeMark, k = 1, n = 18): Pt[] => {
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * h.rx * k;
    const y = Math.sin(a) * h.ry * k;
    return { x: h.at.x + x * c - y * s, y: h.at.y + x * s + y * c };
  });
};

/** A thin lilac wash under each panicle, so the tiny flowers read as one cloud. */
export function paintHaze(p: Painter, hazes: readonly HazeMark[]): void {
  const live = hazes.filter((h) => h.alpha > 0.02 && h.rx > 0.5);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((h) => ellipse(h, 1.1, 8))), 4));
  for (const h of live) {
    const rng = createRng(h.seed);
    L.fill(deformPolygon(ellipse(h), rng, { depth: 3, variance: 0.22 }), jitter(h.pigment, rng, 0.02), 0.2 * h.alpha);
    L.fill(deformPolygon(ellipse(h, 0.62), rng, { depth: 3, variance: 0.25 }), jitter(h.pigment, rng, 0.02), 0.14 * h.alpha);
  }
  L.dry({ opacity: 0.8, edge: 0.1, edgeWidth: 1.4, sharpness: 0.3, centreLift: 0.1, granulation: 0.4, flow: 0.5, flowScale: 8, dry: 0.15, darken: 0.05 });
}

export interface DotMark {
  at: Pt;
  r: number;
  alpha: number;
  pigment: Pigment;
  deep: Pigment;
  /** how deep the second wash lies, 0..1 */
  depth: number;
  /** a papery highlight lifted to paper */
  glint: boolean;
  seed: number;
}

const blob = (c: Pt, r: number, n = 7): Pt[] => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos((i / n) * TAU) * r, y: c.y + Math.sin((i / n) * TAU) * r * 0.85 }));

/** The flowers: a soft blob each, a deeper wash in some, a lifted papery glint. */
export function paintDots(p: Painter, dots: readonly DotMark[]): void {
  const live = dots.filter((d) => d.alpha > 0.02 && d.r > 0.15);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((d) => blob(d.at, d.r * 1.3, 4))), 3));
  for (const d of live) {
    const rng = createRng(d.seed);
    L.fill(deformPolygon(blob(d.at, d.r * 1.15), rng, { depth: 1, variance: 0.1 }), jitter(d.pigment, rng, 0.025), 0.85 * d.alpha);
    L.fill(deformPolygon(blob(d.at, d.r * 1.05), rng, { depth: 1, variance: 0.1 }), jitter(d.pigment, rng, 0.02), 0.5 * d.alpha);
    if (d.depth > 0.05) L.fill(deformPolygon(blob({ x: d.at.x + d.r * 0.2, y: d.at.y + d.r * 0.3 }, d.r * 0.7), rng, { depth: 1, variance: 0.1 }), d.deep, 0.4 * d.depth * d.alpha);
  }
  for (const d of live) if (d.glint && d.alpha > 0.6) L.lift(blob({ x: d.at.x - d.r * 0.25, y: d.at.y - d.r * 0.3 }, d.r * 0.4, 5), 0.5 * d.alpha);
  L.dry({ opacity: 0.94, edge: 0.4, edgeWidth: 0.6, sharpness: 0.55, centreLift: 0.04, granulation: 0.4, flow: 0.3, flowScale: 6, darken: 0.2 });
}
