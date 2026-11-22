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

const BLOOM_SILVER = '#e2ebe9';

function centroid(poly: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const q of poly) {
    x += q.x / poly.length;
    y += q.y / poly.length;
  }
  return { x, y };
}

const shrink = (poly: readonly Pt[], c: Pt, k: number): Pt[] => poly.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));

/** One round of corner cutting: the spines stay pointed but their straight chords soften. */
function soften(poly: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    out.push({ x: a.x * 0.8 + b.x * 0.2, y: a.y * 0.8 + b.y * 0.2 }, { x: a.x * 0.2 + b.x * 0.8, y: a.y * 0.2 + b.y * 0.8 });
  }
  return out;
}

/** One blade into an open layer: a graded wash, a pooled base, a pale margin, a frosted bloom, soft veins. */
function paintBlade(L: ReturnType<Painter['layer']>, m: BladeMark, depth: number): void {
  const rng = createRng(m.seed);
  const a = m.alpha;
  const outline = soften(m.geom.outline);
  const c = centroid(outline);
  const base = m.geom.mid[0]!;
  L.fill(deformPolygon(outline, rng, { depth: 1, variance: 0.04 }), jitter(m.pigment, rng, 0.02), 0.4 * a);
  L.fill(deformPolygon(outline, rng, { depth: 1, variance: 0.05 }), jitter(m.pigment, rng, 0.025), 0.22 * a);
  L.fill(deformPolygon(soften(m.geom.shade), rng, { depth: 1, variance: 0.05 }), m.deep, 0.28 * a * depth);
  for (const k of [0.6, 0.38]) L.fill(deformPolygon(shrink(outline, base, k), rng, { depth: 1, variance: 0.08 }), m.deep, 0.09 * a);
  if (a < 0.3) return;
  L.lift(outline, 0.14 * a);
  L.fill(deformPolygon(shrink(outline, c, 0.92), rng, { depth: 1, variance: 0.06 }), m.pigment, 0.2 * a);
  const w = 0.3 + 0.55 * Math.min(1, a);
  for (let i = 0; i < 4; i++) {
    const u = rng.range(0.3, 0.9);
    const at = m.geom.mid[Math.min(3, Math.floor(u * 4))]!;
    const r = rng.range(0.1, 0.2) * Math.hypot(m.geom.mid[3]!.x - base.x, m.geom.mid[3]!.y - base.y);
    const blot = Array.from({ length: 7 }, (_, k) => ({ x: at.x + Math.cos((k / 7) * TAU) * r * rng.range(0.7, 1.3) + rng.range(-r, r) * 0.6, y: at.y + Math.sin((k / 7) * TAU) * r * 0.6 * rng.range(0.7, 1.3) + rng.range(-r, r) * 0.5 }));
    L.lift(blot, 0.3 * m.vein * a);
    L.fill(blot, BLOOM_SILVER, 0.1 * a);
  }
  m.geom.veins.forEach((v, i) => L.lift(ribbon(smoothPath(v, 1.2), (t) => (i === 0 ? 0.62 : 0.34) * w * (1 - 0.6 * t)), m.vein * (i === 0 ? 0.55 : 0.34) * a));
}

/** Leaves: each in its own layer, so one leaf's veins never cut through the leaf behind it. */
export function paintLeaves(p: Painter, marks: readonly BladeMark[], opacity = 0.8): void {
  for (const m of marks) {
    if (m.alpha <= 0.02) continue;
    const L = p.layer(padRect(bounds(m.geom.outline), 3));
    paintBlade(L, m, 1);
    L.dry({ opacity, edge: 0.4, edgeWidth: 0.8, sharpness: 0.5, centreLift: 0.08, granulation: 0.34, flow: 0.5, flowScale: 5, dry: 0.04, darken: 0.16 });
  }
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
    const ph = rng.range(0, TAU);
    const weight = (t: number) => 0.9 + 0.2 * Math.sin(t * 7 + ph);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.04, 0.2], endWidth: 0.7, fills: 2, coverage: 0.85, pressure: weight });
    ribbonInto(L, s.pts, s.width * 0.45, s.deep, rng, { taper: [0.1, 0.3], endWidth: 0.6, fills: 1, offset: s.width * 0.18, coverage: 0.6, pressure: weight });
  }
  L.dry({ opacity, edge: 0.3, edgeWidth: 0.6, sharpness: 0.45, centreLift: 0.05, granulation: 0.2, flow: 0.4, flowScale: 5, dry: 0.06 });
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
  for (const h of heads) {
    const marks = h.bracts.filter((b) => (b.z >= 0) === front).map((b) => ({ ...b, alpha: b.alpha * h.alpha }));
    if (!marks.length) continue;
    const L = p.layer(padRect(bounds(marks.flatMap((m) => m.geom.outline)), 3));
    for (const m of marks) paintBlade(L, m, 1.1);
    L.dry({ opacity: 0.85, edge: 0.4, edgeWidth: 0.7, sharpness: 0.5, centreLift: 0.05, granulation: 0.3, flow: 0.5, flowScale: 4, dry: 0.03, darken: 0.14, ...dry });
  }
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
    L.fill(deformPolygon(ellipse(h), rng, { depth: 2, variance: 0.07 }), jitter(h.dome, rng, 0.02), 0.36 * a);
    L.fill(deformPolygon(ellipse(h, 0.9), rng, { depth: 2, variance: 0.09 }), jitter(h.dome, rng, 0.02), 0.12 * a);
    const shade = shadowSide(h.rot - Math.PI / 2);
    const lower = ellipse(h, 0.98).filter((q) => (q.y - h.at.y) * 0.7 + (q.x - h.at.x) * shade * 0.7 > -h.ry * 0.2);
    if (lower.length > 3) L.fill(lower, h.domeDeep, 0.16 * a);
  }
  for (const h of live) {
    if (h.florets < 0.05) continue;
    const rng = createRng(h.seed + 5);
    const r = 0.95 * Math.min(1, h.florets * 1.5);
    for (const d of h.dots) {
      const blob = Array.from({ length: 7 }, (_, k) => ({ x: d.x + Math.cos((k / 7) * TAU) * r * rng.range(0.7, 1.15), y: d.y + Math.sin((k / 7) * TAU) * r * 0.85 * rng.range(0.7, 1.15) }));
      L.fill(blob, h.domeDeep, rng.range(0.1, 0.22) * h.florets * h.alpha);
      L.lift([{ x: d.x - r * 0.5, y: d.y - r * 0.35 }, { x: d.x, y: d.y - r * 0.75 }, { x: d.x + r * 0.1, y: d.y - r * 0.15 }], 0.5 * h.florets * h.alpha);
    }
    const hl = ellipse({ ...h, at: { x: h.at.x - h.rx * 0.28, y: h.at.y - h.ry * 0.3 }, rx: h.rx * 0.28, ry: h.ry * 0.24 }, 1, 10);
    L.lift(hl, 0.25 * h.alpha);
  }
  L.dry({ opacity: 0.94, edge: 0.45, edgeWidth: 1, sharpness: 0.55, centreLift: 0.05, granulation: 0.42, flow: 0.4, flowScale: 4, darken: 0.1 });
  bractLayer(p, live, true, {});
}
