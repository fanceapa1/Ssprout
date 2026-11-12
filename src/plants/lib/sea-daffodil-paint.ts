/**
 * Painting helpers for the sea daffodil (docs/systems/plants-species-c.md): strap leaves that twist,
 * a white umbel painted as reserved paper with cool and cream shadows, and the toothed cup.
 * Used by that species only.
 */
import { createRng } from '../../core/rng';
import { PAPER_WHITE, bounds, deformPolygon, jitter, mix, padRect, ribbon, smoothPath, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { shadowSide } from './small-paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

export const TINT = '#dfe8ee';
export const COOL = '#a6b5c0';
export const CREAM = '#ecdcae';
export const THROAT = '#cfdc9a';
export const TUBE = '#cfd9b4';
export const ANTHER = '#e9cc5e';

// ---------------------------------------------------------------------------------------------
// leaves and soft washes

export interface Strap {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  pale: Pigment;
  twist: number;
  phase: number;
  seed: number;
}

/** Long blue-grey leaves whose width narrows and widens as they twist, with a pale glaucous midline. */
export function paintStraps(p: Painter, straps: readonly Strap[], opacity = 0.88): void {
  const live = straps.filter((s) => s.pts.length >= 2 && s.width > 0.1);
  if (!live.length) return;
  const maxW = Math.max(...live.map((s) => s.width));
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), maxW * 1.5 + 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    const twist = (u: number) => 0.62 + 0.38 * Math.abs(Math.cos(s.twist * u + s.phase));
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.03, 0.55], pressure: (u) => twist(u) * (1.05 - u * 0.2), fills: 2, coverage: 0.9 });
    ribbonInto(L, s.pts, s.width * 0.42, s.pale, rng, { taper: [0.1, 0.6], pressure: (u) => twist(u) * (1 - u * 0.3), fills: 1, offset: Math.sin(s.twist * 0.7 + s.phase) * s.width * 0.14 });
  }
  L.dry({ opacity, edge: 0.4, edgeWidth: Math.max(0.3, maxW * 0.25), sharpness: 0.6, centreLift: 0.1, granulation: 0.12, flow: 0.25, flowScale: 9, dry: 0.08 });
}

export interface Haze {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

function blobPoly(m: Haze, n = 12): Pt[] {
  const rng = createRng(m.seed);
  const c = Math.cos(m.rot);
  const s = Math.sin(m.rot);
  return Array.from({ length: n }, (_, i) => {
    const k = rng.range(0.85, 1.12);
    const a = (i / n) * TAU;
    const x = Math.cos(a) * m.rx * k;
    const y = Math.sin(a) * m.ry * k;
    return { x: m.at.x + x * c - y * s, y: m.at.y + x * s + y * c };
  });
}

/** Soft wet-in-wet washes: the cool halo behind the umbel and the tuft's shade. */
export function paintHazes(p: Painter, hazes: readonly Haze[], dry: DryOptions = {}): void {
  const live = hazes.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const shapes = live.map((m) => ({ m, poly: blobPoly(m), rng: createRng(m.seed + 1) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 4));
  for (const { m, poly, rng } of shapes) {
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.14 }), jitter(m.pigment, rng, 0.02), 0.34 * m.alpha);
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.12 }), jitter(m.pigment, rng, 0.02), 0.22 * m.alpha);
  }
  L.dry({ opacity: 0.7, edge: 0, edgeWidth: 4, sharpness: 0.05, centreLift: 0, granulation: 0.25, flow: 0.5, flowScale: 14, darken: 0, ...dry });
}

// ---------------------------------------------------------------------------------------------
// the flower

export interface Tepal {
  /** base, middle and tip in screen units */
  pts: [Pt, Pt, Pt, Pt];
  /** depth of the tip relative to the throat: negative is behind the flower */
  z: number;
  width: number;
}

export interface FlowerMark {
  at: Pt;
  throat: Pt;
  /** unit vectors across the flower's axis, in screen units (the rim's two axes) */
  u: Pt;
  v: Pt;
  mouth: Pt;
  cupR: number;
  tepals: Tepal[];
  /** 0 a bud … 1 fully open */
  open: number;
  alpha: number;
  seed: number;
}

const THIN = (t: number) => (t < 0.32 ? 0.5 + 0.5 * (t / 0.32) : (1 - (t - 0.32) / 0.68) ** 0.7);

function rimPoint(m: FlowerMark, a: number, r: number): Pt {
  return { x: m.mouth.x + (Math.cos(a) * m.u.x + Math.sin(a) * m.v.x) * r, y: m.mouth.y + (Math.cos(a) * m.u.y + Math.sin(a) * m.v.y) * r };
}

function tepalPoly(t: Tepal, grow = 0): { path: Pt[]; poly: Pt[] } {
  const path = smoothPath(t.pts, 1.6);
  return { path, poly: ribbon(path, (u) => (t.width / 2) * THIN(u) + grow * (1 - 0.75 * u)) };
}

/** The flower's reserved-white shapes: tepals, tube and cup, as polygons. */
export function flowerShapes(m: FlowerMark, grow = 0): Pt[][] {
  const out: Pt[][] = [ribbon([m.at, m.throat], (u) => 0.9 + 0.7 * u + grow)];
  for (const t of [...m.tepals].sort((a, b) => a.z - b.z)) out.push(tepalPoly(t, grow).poly);
  const cupK = m.open * m.open;
  if (cupK > 0.01) {
    const r = m.cupR * cupK + grow;
    out.push(Array.from({ length: 28 }, (_, i) => rimPoint(m, (i / 28) * TAU, r)));
    out.push([
      { x: m.throat.x + m.u.x * (1.1 + grow), y: m.throat.y + m.u.y * (1.1 + grow) },
      { x: m.throat.x - m.u.x * (1.1 + grow), y: m.throat.y - m.u.y * (1.1 + grow) },
      rimPoint(m, Math.PI, r),
      rimPoint(m, 0, r),
    ]);
  }
  return out;
}

/** Bare paper under every flower, opaque, so the white stays white over sand and sea alike. */
export function reserveFlowers(p: Painter, flowers: readonly FlowerMark[]): void {
  const c = p.ctx;
  c.save();
  c.fillStyle = PAPER_WHITE;
  for (const m of flowers) {
    if (m.alpha < 0.02) continue;
    c.globalAlpha = Math.min(1, m.alpha * 1.5);
    for (const s of flowerShapes(m, 0)) {
      c.beginPath();
      s.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

/**
 * The cool wash round and behind the flowers. Each flower is laid back to front: a soft halo is
 * painted, then the flower's own shape is lifted out of it, so the white is the bare paper.
 */
export function paintBackdrop(p: Painter, flowers: readonly FlowerMark[], pigment: Pigment, dry: DryOptions = {}): void {
  const live = flowers.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const pts = live.flatMap((m) => [m.at, m.throat, m.mouth, ...m.tepals.flatMap((t) => t.pts)]);
  const L = p.layer(padRect(bounds(pts), 7));
  for (const m of live) {
    const rng = createRng(m.seed + 11);
    for (const s of flowerShapes(m, 1.8 * m.alpha)) L.fill(s, jitter(pigment, rng, 0.015), 0.15 * m.alpha);
    for (const s of flowerShapes(m, 0)) L.lift(s, 0.96);
  }
  L.dry({ opacity: 0.85, edge: 0.55, edgeWidth: 1.1, sharpness: 0.3, centreLift: 0, granulation: 0.2, flow: 0.4, flowScale: 9, darken: 0.1, ...dry });
}

function tepalPaint(L: ReturnType<Painter['layer']>, t: Tepal, open: number, alpha: number): void {
  const { path, poly } = tepalPoly(t);
  const half = (u: number) => (t.width / 2) * THIN(u);
  const bud = 1 - open;
  if (bud > 0.05) L.fill(poly, '#cfdcae', 0.45 * alpha * bud);
  const tip = t.pts[3];
  const side = shadowSide(Math.atan2(tip.y - t.pts[0].y, tip.x - t.pts[0].x));
  L.fill(ribbon(path, (u) => half(u) * 0.5, (u) => side * half(u) * 0.5), mix(COOL, '#b3a8c2', 0.2), 0.3 * alpha);
  const baseLen = Math.max(2, Math.ceil(path.length * 0.4));
  L.fill(ribbon(path.slice(0, baseLen), (u) => half(u * 0.4) * 0.95), CREAM, 0.3 * alpha * (0.4 + 0.6 * open));
  L.fill(ribbon(path, (u) => 0.18 + 0.12 * (1 - u)), mix(COOL, '#ffffff', 0.35), 0.2 * alpha);
}

/** One white flower's shading over the reserved paper: cool and cream shadows, the toothed cup, the anthers. */
export function paintFlower(p: Painter, m: FlowerMark, dry: DryOptions = {}): void {
  if (m.alpha < 0.02) return;
  const rng = createRng(m.seed);
  const cupK = m.open * m.open;
  const pts: Pt[] = [m.at, m.throat, m.mouth, ...m.tepals.flatMap((t) => t.pts)];
  const R = Math.max(m.cupR, 1);
  const body = p.layer(padRect(bounds(pts), R + 3));
  const A = m.alpha;
  body.fill(ribbon([m.at, m.throat], (u) => 0.9 + 0.7 * u), mix(TUBE, TINT, 0.2), 0.55 * A);
  const sorted = [...m.tepals].sort((a, b) => a.z - b.z);
  for (const t of sorted.filter((x) => x.z < 0)) tepalPaint(body, t, m.open, A);
  if (cupK > 0.01) {
    const side = shadowSide(Math.atan2(m.mouth.y - m.throat.y, m.mouth.x - m.throat.x));
    const r = m.cupR * cupK;
    body.fill(
      [
        { x: m.throat.x + m.u.x * side * 0.4, y: m.throat.y + m.u.y * side * 0.4 },
        rimPoint(m, side > 0 ? 0 : Math.PI, r),
        { x: m.mouth.x + m.v.x * r * 0.55, y: m.mouth.y + m.v.y * r * 0.55 },
        { x: m.mouth.x - m.v.x * r * 0.55, y: m.mouth.y - m.v.y * r * 0.55 },
      ],
      COOL,
      0.3 * A,
    );
    body.fill([m.throat, rimPoint(m, Math.PI, r), rimPoint(m, 0, r)], CREAM, 0.22 * A);
  }
  for (const t of sorted.filter((x) => x.z >= 0)) tepalPaint(body, t, m.open, A);
  body.dry({ opacity: 0.9, edge: 0.3, edgeWidth: 0.6, sharpness: 0.5, centreLift: 0.04, granulation: 0.1, flow: 0.18, flowScale: 5, dry: 0.04, darken: 0.1, ...dry });

  if (cupK < 0.25) return;
  const d = p.layer(padRect(bounds([m.mouth, m.throat]), R * 1.9 + 3));
  const r = m.cupR * cupK;
  const k = smoothStep(cupK);
  const teeth = Array.from({ length: 24 }, (_, i) => rimPoint(m, (i / 24) * TAU, r * (i % 2 ? 1.0 : 1.2)));
  d.fill(deformPolygon(teeth, rng.fork('teeth'), { depth: 1, variance: 0.02 }), mix(COOL, TINT, 0.2), 0.5 * A * k);
  d.fill(Array.from({ length: 24 }, (_, i) => rimPoint(m, (i / 24) * TAU, r * 0.76)), mix(THROAT, '#b3cc7c', 0.3), 0.7 * A * k);
  d.fill(Array.from({ length: 16 }, (_, i) => rimPoint(m, (i / 16) * TAU, r * 0.34)), '#a9c27a', 0.45 * A * k);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const base = rimPoint(m, a, r * 0.6);
    const tip = rimPoint(m, a, r * 0.9);
    const ax = { x: m.mouth.x - m.throat.x, y: m.mouth.y - m.throat.y };
    const len = Math.hypot(ax.x, ax.y) || 1;
    const lift = 3.4 * k;
    const end = { x: tip.x + (ax.x / len) * lift, y: tip.y + (ax.y / len) * lift };
    d.fill(ribbon([base, end], () => 0.3), mix(TINT, '#c9d3b0', 0.4), 0.55 * A);
    d.fill(ellipse(end, 1.0, 0.7, a), ANTHER, 0.95 * A);
  }
  d.dry({ opacity: 0.92, edge: 0.2, edgeWidth: 0.35, sharpness: 0.7, centreLift: 0, granulation: 0.08, flow: 0.1, flowScale: 4, dry: 0, darken: 0.05 });
}

const smoothStep = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function ellipse(c: Pt, rx: number, ry: number, rot: number, n = 8): Pt[] {
  const co = Math.cos(rot);
  const si = Math.sin(rot);
  return Array.from({ length: n }, (_, i) => {
    const x = Math.cos((i / n) * TAU) * rx;
    const y = Math.sin((i / n) * TAU) * ry;
    return { x: c.x + x * co - y * si, y: c.y + x * si + y * co };
  });
}

/** Thin straight stalks (the umbel's pedicels and the stout flower stalk). */
export function paintStalks(p: Painter, stalks: readonly { pts: Pt[]; width: number; pigment: Pigment; seed: number }[], opacity = 0.9): void {
  const live = stalks.filter((s) => s.pts.length >= 2 && s.width > 0.1);
  if (!live.length) return;
  const maxW = Math.max(...live.map((s) => s.width));
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), maxW * 2 + 3));
  for (const s of live) ribbonInto(L, s.pts, s.width, s.pigment, createRng(s.seed), { taper: [0.02, 0.1], endWidth: 0.7, fills: 2 });
  L.dry({ opacity, edge: 0.4, edgeWidth: Math.max(0.3, maxW * 0.25), sharpness: 0.6, centreLift: 0.12, granulation: 0.12, flow: 0.2, flowScale: 8, dry: 0.05 });
}
