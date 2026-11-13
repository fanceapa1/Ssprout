/**
 * Painting helpers for the sea holly (docs/systems/plants-species-a.md): leathery spiny leaves
 * with pale veins, blue-flushed stems, and the thistle-like heads in their collars of spiny bracts.
 * Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, padRect, ribbon, smoothPath, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { shadowSide } from './small-paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// the spiny blade (leaves and bracts)

export interface BladeSpec {
  base: Pt;
  angle: number;
  len: number;
  wid: number;
  bend: number;
  /** spiny teeth per side */
  teeth: number;
  /** tooth length factor per tooth and side (2 × teeth numbers around 1) */
  jit: number[];
  wave: number;
  phase: number;
}

export interface BladeGeom {
  /** the outline, one closed polygon: spines and valleys */
  outline: Pt[];
  /** the side that falls in shade, with the midline back to the base */
  shade: Pt[];
  mid: Pt[];
  veins: Pt[][];
}

const halfWidth = (u: number, wid: number, wave: number, phase: number): number => (wid / 2) * Math.max(0, Math.sin(Math.PI * u ** 0.8)) ** 0.7 * (1 + wave * Math.sin(u * 14 + phase));

/** A rounded, leathery blade with spine-tipped teeth, in screen space. */
export function bladeGeometry(s: BladeSpec, shadeSide: 1 | -1): BladeGeom {
  const ca = Math.cos(s.angle);
  const sa = Math.sin(s.angle);
  const to = (u: number, v: number): Pt => {
    const x = u * s.len;
    const y = v + s.bend * s.len * u * u;
    return { x: s.base.x + x * ca - y * sa, y: s.base.y + x * sa + y * ca };
  };
  const hw = (u: number) => halfWidth(u, s.wid, s.wave, s.phase);
  const u0 = 0.14;
  const span = 0.8;
  const sides: Pt[][] = [];
  const veins: Pt[][] = [[to(0.04, 0), to(0.4, 0), to(0.9, 0)]];
  for (const [si, sgn] of ([1, -1] as const).entries()) {
    const pts: Pt[] = [to(0.02, 0)];
    for (let k = 0; k < s.teeth; k++) {
      const uv = u0 + (span * k) / s.teeth;
      const ut = uv + (span / s.teeth) * 0.62;
      const j = s.jit[si * s.teeth + k] ?? 1;
      pts.push(to(uv, sgn * hw(uv) * 0.78));
      const tip = to(ut + 0.03, sgn * (hw(ut) + s.len * 0.085 * j));
      pts.push(tip);
      const from = to(Math.max(0.04, uv - 0.1), 0);
      veins.push([from, to(uv + 0.02, sgn * hw(uv) * 0.45), { x: tip.x * 0.8 + from.x * 0.2, y: tip.y * 0.8 + from.y * 0.2 }]);
    }
    pts.push(to(0.97, sgn * hw(0.97) * 0.5));
    sides.push(pts);
  }
  const tipPt = to(1.06, 0);
  const [a, b] = sides as [Pt[], Pt[]];
  const mid = [to(0.02, 0), to(0.35, 0), to(0.7, 0), to(1, 0)];
  return {
    outline: [...a, tipPt, ...[...b].reverse()],
    shade: [...(shadeSide === 1 ? a : b), tipPt, ...[...mid].reverse()],
    mid,
    veins,
  };
}

export interface BladeMark {
  geom: BladeGeom;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
  alpha: number;
  angle: number;
  /** how strongly the veins and the margin are lifted to white */
  vein: number;
}

function paintBlades(L: ReturnType<Painter['layer']>, marks: readonly BladeMark[], depth: number): void {
  for (const m of marks) {
    const rng = createRng(m.seed);
    const a = m.alpha;
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.62 * a);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.34 * a);
    L.fill(deformPolygon(m.geom.shade, rng, { depth: 1, variance: 0.04 }), m.deep, 0.42 * a * depth);
  }
  for (const m of marks) {
    if (m.alpha < 0.3) continue;
    const w = 0.3 + 0.55 * Math.min(1, m.alpha);
    m.geom.veins.forEach((v, i) => L.lift(ribbon(smoothPath(v, 1.2), (t) => (i === 0 ? 0.75 : 0.5) * w * (1 - 0.5 * t)), m.vein * (i === 0 ? 1 : 0.85)));
  }
}

/** Leaves: silver-blue washes, a cooler shaded half, the veins lifted back to paper, crisp spines. */
export function paintLeaves(p: Painter, marks: readonly BladeMark[], opacity = 0.92): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  paintBlades(L, live, 1);
  L.dry({ opacity, edge: 0.55, edgeWidth: 0.9, sharpness: 0.72, centreLift: 0.08, granulation: 0.34, flow: 0.3, flowScale: 8, dry: 0.04, darken: 0.18 });
}

// ---------------------------------------------------------------------------------------------
// stems

export interface StemMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintStems(p: Painter, stems: readonly StemMark[], opacity = 0.9): void {
  const live = stems.filter((s) => s.pts.length >= 2 && s.width > 0.15);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.04, 0.2], endWidth: 0.7, fills: 2, coverage: 0.92 });
    ribbonInto(L, s.pts, s.width * 0.45, s.deep, rng, { taper: [0.1, 0.3], endWidth: 0.6, fills: 1, offset: s.width * 0.18 });
  }
  L.dry({ opacity, edge: 0.4, edgeWidth: 0.7, sharpness: 0.6, centreLift: 0.05, granulation: 0.2, flow: 0.25, flowScale: 8, dry: 0.03 });
}

// ---------------------------------------------------------------------------------------------
// heads

export interface HeadMark {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  /** 0 a green bud … 1 open */
  open: number;
  alpha: number;
  /** the florets on the knob, 0..1 */
  florets: number;
  dome: Pigment;
  domeDeep: Pigment;
  bracts: (BladeMark & { z: number })[];
  dots: Pt[];
  seed: number;
}

function ellipse(h: HeadMark, k = 1, n = 18): Pt[] {
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * h.rx * k;
    const y = Math.sin(a) * h.ry * k;
    return { x: h.at.x + x * c - y * s, y: h.at.y + x * s + y * c };
  });
}

function bractLayer(p: Painter, heads: readonly HeadMark[], front: boolean, dry: DryOptions): void {
  const marks = heads.flatMap((h) => h.bracts.filter((b) => (b.z >= 0) === front && h.alpha > 0.02).map((b) => ({ ...b, alpha: b.alpha * h.alpha })));
  if (!marks.length) return;
  const L = p.layer(padRect(bounds(marks.flatMap((m) => m.geom.outline)), 3));
  paintBlades(L, marks, 1.1);
  L.dry({ opacity: 0.94, edge: 0.6, edgeWidth: 0.8, sharpness: 0.75, centreLift: 0.05, granulation: 0.3, flow: 0.25, flowScale: 7, dry: 0.03, darken: 0.22, ...dry });
}

/** Heads: the back bracts, the amethyst knobs with their lifted florets, then the front bracts. */
export function paintHeads(p: Painter, heads: readonly HeadMark[]): void {
  const live = heads.filter((h) => h.alpha > 0.02);
  if (!live.length) return;
  bractLayer(p, live, false, {});
  const L = p.layer(padRect(bounds(live.flatMap((h) => ellipse(h, 1.25))), 3));
  for (const h of live) {
    const rng = createRng(h.seed);
    const a = h.alpha;
    L.fill(deformPolygon(ellipse(h), rng, { depth: 1, variance: 0.04 }), jitter(h.dome, rng, 0.02), 0.5 * a);
    L.fill(deformPolygon(ellipse(h, 0.92), rng, { depth: 1, variance: 0.05 }), jitter(h.dome, rng, 0.02), 0.16 * a);
    const shade = shadowSide(h.rot - Math.PI / 2);
    const lower = ellipse(h, 0.98).filter((q) => (q.y - h.at.y) * 0.7 + (q.x - h.at.x) * shade * 0.7 > -h.ry * 0.2);
    if (lower.length > 3) L.fill(lower, h.domeDeep, 0.26 * a);
  }
  for (const h of live) {
    if (h.florets < 0.05) continue;
    for (const d of h.dots) {
      const r = 0.85 * Math.min(1, h.florets * 1.5);
      L.lift([{ x: d.x - r, y: d.y }, { x: d.x, y: d.y - r }, { x: d.x + r, y: d.y }, { x: d.x, y: d.y + r }], 0.85 * h.florets * h.alpha);
    }
    const hl = ellipse({ ...h, at: { x: h.at.x - h.rx * 0.28, y: h.at.y - h.ry * 0.3 }, rx: h.rx * 0.28, ry: h.ry * 0.24 }, 1, 10);
    L.lift(hl, 0.25 * h.alpha);
  }
  L.dry({ opacity: 0.94, edge: 0.45, edgeWidth: 1, sharpness: 0.55, centreLift: 0.05, granulation: 0.42, flow: 0.3, flowScale: 6, darken: 0.2 });
  bractLayer(p, live, true, {});
}
