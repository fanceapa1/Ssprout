/**
 * Painting helpers for the pink rock rose (docs/systems/plants-species-a.md): a broken grey-green
 * wash, wavy felted leaves, thin twigs, flat crumpled-petal flowers round a yellow boss, fat buds
 * and fallen petals. Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// leaves

export interface LeafGeom {
  outline: Pt[];
  shade: Pt[];
  mid: Pt[];
}

/** A small wrinkled, wavy-edged oval leaf in screen space. */
export function leafGeometry(base: Pt, angle: number, len: number, wid: number, wave: number, phase: number, shadeSide: 1 | -1): LeafGeom {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const to = (u: number, v: number): Pt => ({ x: base.x + u * len * ca - v * sa, y: base.y + u * len * sa + v * ca });
  const hw = (u: number) => (wid / 2) * Math.sin(Math.PI * u ** 0.78) ** 0.6 * (1 + wave * Math.sin(u * 19 + phase));
  const steps = [0.06, 0.2, 0.36, 0.52, 0.68, 0.84, 0.96];
  const a = steps.map((u) => to(u, hw(u)));
  const b = steps.map((u) => to(u, -hw(u)));
  const mid = [to(0.02, 0), to(0.4, 0), to(0.8, 0), to(1.04, 0)];
  const tip = to(1.04, 0);
  return { outline: [to(0, 0), ...a, tip, ...[...b].reverse()], shade: [...(shadeSide === 1 ? a : b), tip, ...[...mid].reverse()], mid };
}

export interface LeafMark {
  geom: LeafGeom;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
  alpha: number;
}

export interface Reserve {
  at: Pt;
  rx: number;
  ry: number;
  amount: number;
}

function disc(r: Reserve, k = 1, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => ({ x: r.at.x + Math.cos((i / n) * TAU) * r.rx * k, y: r.at.y + Math.sin((i / n) * TAU) * r.ry * k }));
}

/** Felted leaves: a grey-green wash, a cooler shaded half, a lifted midrib; paper kept under flowers. */
export function paintLeaves(p: Painter, marks: readonly LeafMark[], reserves: readonly Reserve[]): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    L.fill(deformPolygon(m.geom.outline, rng, { depth: 1, variance: 0.05 }), jitter(m.pigment, rng, 0.025), 0.5 * m.alpha);
    L.fill(deformPolygon(m.geom.shade, rng, { depth: 1, variance: 0.05 }), m.deep, 0.3 * m.alpha);
  }
  for (const m of live) if (m.alpha > 0.8) L.lift(ribbon(smoothPath(m.geom.mid, 1.2), (t) => 0.3 * (1 - 0.6 * t)), 0.16);
  for (const r of reserves) L.lift(disc(r, 1), r.amount);
  L.dry({ opacity: 0.92, edge: 0.5, edgeWidth: 0.8, sharpness: 0.62, centreLift: 0.06, granulation: 0.4, flow: 0.3, flowScale: 7, dry: 0.07, darken: 0.16 });
}

// ---------------------------------------------------------------------------------------------
// the broken wash behind the leaves

export interface MassMark {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
  alpha: number;
  pigment: Pigment;
}

function lump(m: MassMark, n = 16): Pt[] {
  const rng = createRng(m.seed);
  const ph = rng.range(0, TAU);
  const a = rng.range(0.05, 0.12);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const r = 1 + a * Math.sin(3 * t + ph) + 0.05 * Math.sin(5 * t + ph * 2);
    return { x: m.cx + Math.cos(t) * m.rx * r, y: m.cy + Math.sin(t) * m.ry * r };
  });
}

export function paintMass(p: Painter, marks: readonly MassMark[], reserves: readonly Reserve[]): void {
  const live = marks.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => lump(m, 8))), 4));
  for (const m of live) {
    const rng = createRng(m.seed + 7);
    L.fill(deformPolygon(lump(m), rng, { depth: 2, variance: 0.1 }), jitter(m.pigment, rng, 0.02), 0.36 * m.alpha);
  }
  for (const r of reserves) L.lift(disc(r, 1.05), r.amount * 0.9);
  L.dry({ opacity: 0.7, edge: 0.12, edgeWidth: 1.6, sharpness: 0.3, centreLift: 0.1, granulation: 0.45, flow: 0.5, flowScale: 9, dry: 0.2, darken: 0.05 });
}

// ---------------------------------------------------------------------------------------------
// twigs

export interface TwigMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintTwigs(p: Painter, twigs: readonly TwigMark[], reserves: readonly Reserve[]): void {
  const live = twigs.filter((s) => s.pts.length >= 2 && s.width > 0.15);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.04, 0.25], endWidth: 0.4, fills: 2, coverage: 0.5 });
    ribbonInto(L, s.pts, s.width * 0.4, s.deep, rng, { taper: [0.1, 0.3], endWidth: 0.4, fills: 1, coverage: 0.18, offset: s.width * 0.2 });
  }
  for (const r of reserves) L.lift(disc(r, 1.1), r.amount);
  L.dry({ opacity: 0.9, edge: 0.4, edgeWidth: 0.7, sharpness: 0.6, centreLift: 0.05, granulation: 0.3, flow: 0.25, flowScale: 8, dry: 0.08 });
}

// ---------------------------------------------------------------------------------------------
// flowers

export interface PetalPlan {
  ang: number;
  len: number;
  wid: number;
  phase: number;
  seed: number;
  tone: number;
}

export interface FlowerMark {
  at: Pt;
  /** the flower's radius now */
  R: number;
  /** foreshortening of the flower plane, 0.4 edge-on … 1 face-on */
  ty: number;
  rot: number;
  /** 0 a fat bud … 1 fully open */
  open: number;
  /** the bud shows (1) or has given way to petals (0) */
  bud: number;
  alpha: number;
  petals: PetalPlan[];
  /** stamens: radii (fractions of R) and angles */
  stamens: [number, number][];
  seed: number;
}

const PINK = '#e6a4c6';
const PINK_DEEP = '#c9609a';
const MAUVE = '#b86aa8';
const BUD = '#bb5a82';
const SEPAL = '#86a06c';
const GOLD = '#e6c050';
const ORANGE = '#e08a2c';

/** Flower-plane point to screen: foreshorten, rotate, move. */
function place(m: FlowerMark, x: number, y: number): Pt {
  const yy = y * m.ty;
  const c = Math.cos(m.rot);
  const s = Math.sin(m.rot);
  return { x: m.at.x + x * c - yy * s, y: m.at.y + x * s + yy * c };
}

/** One crinkled petal as a fan from the boss with a rippled, faintly notched rim. */
function petalShape(m: FlowerMark, pl: PetalPlan, R: number): { poly: Pt[]; inner: Pt[]; creases: Pt[][] } {
  const w = (Math.PI / 5) * pl.wid;
  const at = (r: number, a: number) => place(m, Math.cos(a) * r, Math.sin(a) * r);
  const rim: Pt[] = [];
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * 2 - 1;
    const r = R * pl.len * (0.9 - 0.2 * s * s - 0.1 * Math.exp(-s * s * 26) + 0.05 * Math.sin(s * 8 + pl.phase));
    rim.push(at(r, pl.ang + s * w));
  }
  const poly = [at(0.08 * R, pl.ang), at(0.5 * R, pl.ang - w * 0.78), ...rim, at(0.5 * R, pl.ang + w * 0.78)];
  const inner = [at(0.06 * R, pl.ang), at(0.4 * R, pl.ang - w * 0.7), at(0.56 * R * pl.len, pl.ang - w * 0.2), at(0.58 * R * pl.len, pl.ang + w * 0.2), at(0.4 * R, pl.ang + w * 0.7)];
  const creases = [0.04].map((f, k) => {
    const a = pl.ang + f * w;
    return [0.2, 0.42, 0.62, 0.8].map((r, j) => at(r * R * pl.len, a + 0.05 * Math.sin(j * 2.1 + pl.phase + k)));
  });
  return { poly, inner, creases };
}

function ellipsePts(c: Pt, rx: number, ry: number, rot: number, n = 12): Pt[] {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
  });
}

export function flowerReach(m: FlowerMark, R = m.R): Pt[] {
  return [place(m, -R, 0), place(m, R, 0), place(m, 0, -R), place(m, 0, R)];
}

/** Buds, then the petal washes with their creases lifted, then the warm yellow boss. */
export function paintFlowers(p: Painter, flowers: readonly FlowerMark[]): void {
  const live = flowers.filter((f) => f.alpha > 0.02 && f.R > 0.4);
  if (!live.length) return;
  const area = padRect(bounds(live.flatMap((f) => flowerReach(f, f.R * 1.4))), 3);

  const buds = live.filter((f) => f.bud > 0.02);
  if (buds.length) {
    const B = p.layer(area);
    for (const f of buds) {
      const rng = createRng(f.seed);
      const a = f.alpha * f.bud;
      const up = f.rot - Math.PI / 2;
      const c = { x: f.at.x, y: f.at.y - f.R * 0.2 };
      B.fill(deformPolygon(ellipsePts(c, f.R * 0.5, f.R * 0.66, up + Math.PI / 2), rng, { depth: 1, variance: 0.05 }), jitter(BUD, rng, 0.02), 0.62 * a);
      B.fill(ellipsePts({ x: c.x, y: c.y + f.R * 0.28 }, f.R * 0.46, f.R * 0.34, 0), SEPAL, 0.5 * a);
      B.lift(ellipsePts({ x: c.x - f.R * 0.14, y: c.y - f.R * 0.22 }, f.R * 0.12, f.R * 0.2, 0.4, 8), 0.4 * a);
    }
    B.dry({ opacity: 0.92, edge: 0.5, edgeWidth: 0.7, sharpness: 0.6, centreLift: 0.06, granulation: 0.3, flow: 0.25, flowScale: 6 });
  }

  const open = live.filter((f) => f.bud < 0.98);
  if (!open.length) return;
  const L = p.layer(area);
  for (const f of open) {
    const a = f.alpha * (1 - f.bud);
    for (const pl of f.petals) {
      const rng = createRng(pl.seed);
      const { poly, inner, creases } = petalShape(f, pl, f.R);
      const body = jitter(mix(PINK, MAUVE, pl.tone), rng, 0.02);
      L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.07 }), body, 0.52 * a);
      L.fill(deformPolygon(poly, rng, { depth: 1, variance: 0.1 }), body, 0.26 * a);
      L.fill(deformPolygon(inner, rng, { depth: 1, variance: 0.1 }), PINK_DEEP, 0.3 * a);
      for (const c of creases) L.lift(ribbon(smoothPath(c, 0.8), (t) => 0.55 * (1 - 0.5 * t)), 0.42 * a);
    }
    L.lift(ellipsePts(f.at, f.R * 0.3, f.R * 0.3 * f.ty, 0, 10), 0.9 * a);
  }
  L.dry({ opacity: 0.9, edge: 0.5, edgeWidth: 0.7, sharpness: 0.55, centreLift: 0.05, granulation: 0.3, flow: 0.4, flowScale: 6, dry: 0.04, darken: 0.1 });

  const C = p.layer(area);
  for (const f of open) {
    const a = f.alpha * (1 - f.bud) * Math.min(1, f.open * 1.6);
    const rng = createRng(f.seed + 3);
    C.fill(ellipsePts(f.at, f.R * 0.26, f.R * 0.26 * f.ty, 0, 10), GOLD, 0.7 * a);
    C.fill(ellipsePts({ x: f.at.x, y: f.at.y }, f.R * 0.13, f.R * 0.13 * f.ty, 0, 8), ORANGE, 0.45 * a);
    for (const [r, ang] of f.stamens) {
      const d = place(f, Math.cos(ang) * r * f.R, Math.sin(ang) * r * f.R);
      C.fill(ellipsePts(d, 0.55, 0.55, 0, 6), jitter(mix(GOLD, ORANGE, 0.5), rng, 0.03), 0.75 * a);
    }
  }
  C.dry({ opacity: 0.95, edge: 0.3, edgeWidth: 0.5, sharpness: 0.5, centreLift: 0.02, granulation: 0.1, flow: 0.1, flowScale: 6 });
}

// ---------------------------------------------------------------------------------------------
// fallen petals

export interface LitterMark {
  at: Pt;
  len: number;
  rot: number;
  seed: number;
  alpha: number;
  tone: number;
}

export function paintLitter(p: Painter, marks: readonly LitterMark[]): void {
  const live = marks.filter((m) => m.alpha > 0.02 && m.len > 0.3);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => ellipsePts(m.at, m.len, m.len, 0, 4))), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    const shape = ellipsePts(m.at, m.len, m.len * 0.55, m.rot, 10);
    L.fill(deformPolygon(shape, rng, { depth: 1, variance: 0.18 }), jitter(mix(PINK, MAUVE, m.tone), rng, 0.02), 0.62 * m.alpha);
    L.lift(ellipsePts({ x: m.at.x, y: m.at.y }, m.len * 0.4, m.len * 0.08, m.rot + 0.3, 6), 0.45 * m.alpha);
  }
  L.dry({ opacity: 0.88, edge: 0.45, edgeWidth: 0.6, sharpness: 0.5, centreLift: 0.04, granulation: 0.2, flow: 0.2, flowScale: 5 });
}
