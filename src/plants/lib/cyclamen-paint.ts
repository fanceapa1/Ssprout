/**
 * Painting helpers for the ivy-leaved cyclamen (docs/systems/plants-species-a.md): marbled
 * heart-shaped leaves, nodding flowers with swept-back petals, thin stalks and coiled seed
 * stalks. Used by that species only.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const ELEV_Y = 0.6;
const ELEV_H = 0.84;

const smoothstep = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// ---------------------------------------------------------------------------------------------
// the leaf

/** radius factor of the outline by angle from the tip (degrees), mirrored left and right */
const LEAF_R: [number, number][] = [
  [0, 1],
  [26, 0.8],
  [50, 0.88],
  [82, 0.66],
  [116, 0.64],
  [144, 0.78],
  [164, 0.62],
  [180, 0.3],
];

function leafRadius(deg: number): number {
  const a = Math.abs(((deg + 180) % 360) - 180);
  for (let i = 1; i < LEAF_R.length; i++) {
    const [a1, r1] = LEAF_R[i]!;
    const [a0, r0] = LEAF_R[i - 1]!;
    if (a <= a1) return r0 + ((r1 - r0) * (a - a0)) / (a1 - a0);
  }
  return LEAF_R[LEAF_R.length - 1]![1];
}

export interface LeafSpec {
  /** where the blade joins its stalk, in plan (x right, z toward the viewer) and height */
  base: { x: number; z: number; h: number };
  yaw: number;
  len: number;
  /** blade tilt from flat (0) to upright (π/2) */
  tilt: number;
  /** sideways roll of the blade: the curled-up flank shows its red underside */
  roll: number;
  /** the silver zone's size against the blade */
  zone: number;
  /** marbling flecks: angle (deg), radius fraction, size fraction */
  flecks: [number, number, number][];
}

export interface LeafGeom {
  outline: Pt[];
  zone: Pt[];
  midrib: Pt[];
  flecks: Pt[][];
  /** the curled margin showing its underside (empty when the blade lies flat) */
  under: Pt[];
  tip: Pt;
}

/** A leaf in screen space: the blade is drawn flat on its plane, then tilted and viewed from above-front. */
export function leafGeometry(s: LeafSpec): LeafGeom {
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  const ct = Math.cos(s.tilt);
  const st = Math.sin(s.tilt);
  const cr = Math.cos(s.roll);
  const sr = Math.sin(s.roll);
  const L = s.len;
  const R = 0.55 * L;
  const notch = 0.45 * L - 0.3 * R;
  const to = (x: number, y: number): Pt => {
    const m = x - notch;
    const X = s.base.x + m * cy * ct - y * cr * sy;
    const Z = s.base.z + m * sy * ct + y * cr * cy;
    const H = s.base.h + m * st + y * sr;
    return { x: X, y: Z * ELEV_Y - H * ELEV_H };
  };
  const polar = (deg: number, k: number, ox = 0): Pt => {
    const r = leafRadius(deg) * R * k;
    return to(0.45 * L + ox + Math.cos(deg * RAD) * r, Math.sin(deg * RAD) * r * 0.96);
  };
  const ring = (k: number, ox = 0, step = 6): Pt[] => {
    const out: Pt[] = [];
    for (let d = 0; d < 360; d += step) out.push(polar(d, k, ox));
    return out;
  };
  const outline = ring(1);
  const zone = ring(s.zone, 0.02 * L, 10);
  const midrib = [to(notch + 0.02 * L, 0), to(0.45 * L, 0), to(0.45 * L + 0.4 * R, 0)];
  const flecks = s.flecks.map(([deg, rf, sz]) => {
    const c = leafRadius(deg) * R * rf;
    const cx = 0.45 * L + Math.cos(deg * RAD) * c;
    const cyy = Math.sin(deg * RAD) * c * 0.96;
    const rr = sz * R;
    return Array.from({ length: 6 }, (_, i) => to(cx + Math.cos((i / 6) * TAU) * rr, cyy + Math.sin((i / 6) * TAU) * rr * 0.7));
  });
  let under: Pt[] = [];
  const curl = Math.abs(s.roll);
  if (curl > 0.25) {
    const side = s.roll > 0 ? 1 : -1;
    const w = Math.min(0.2, 0.05 + curl * 0.14);
    const arc: number[] = [];
    for (let d = 40; d <= 135; d += 8) arc.push(side * d);
    under = [...arc.map((d) => polar(d, 1)), ...[...arc].reverse().map((d) => polar(d, 1 - w))];
  }
  return { outline, zone, midrib, flecks, under, tip: polar(0, 1) };
}

export interface LeafMark {
  geom: LeafGeom;
  pigment: Pigment;
  deep: Pigment;
  silver: Pigment;
  underside: Pigment;
  seed: number;
  alpha: number;
}

/** Leaves back to front: each one lifts what lies behind it, then a green wash, a shaded flank, the silver zone lifted, a green midrib. */
export function paintLeaves(p: Painter, marks: readonly LeafMark[], opacity = 0.94): void {
  const live = marks.filter((m) => m.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((m) => m.geom.outline)), 3));
  for (const m of live) {
    const rng = createRng(m.seed);
    const a = m.alpha;
    const g = m.geom;
    L.lift(g.outline, 0.95 * a);
    L.fill(deformPolygon(g.outline, rng, { depth: 1, variance: 0.03 }), jitter(m.pigment, rng, 0.02), 0.62 * a);
    L.fill(deformPolygon(g.outline, rng, { depth: 1, variance: 0.05 }), jitter(m.pigment, rng, 0.02), 0.26 * a);
    // the half away from the light (upper left) takes a second, deeper wash
    L.fill(deformPolygon(shadowHalf(g.outline), rng, { depth: 1, variance: 0.05 }), m.deep, 0.18 * a);
    if (a > 0.3) {
      // the marbling is lifted out of the green, then barely tinted: a pale band, not a pasted shape
      L.lift(deformPolygon(g.zone, rng, { depth: 1, variance: 0.06 }), 0.5 * a);
      L.fill(deformPolygon(g.zone, rng, { depth: 1, variance: 0.06 }), m.silver, 0.3 * a);
      const core = shrink(g.zone, g.midrib[1]!, 0.45);
      L.fill(deformPolygon(core, rng, { depth: 1, variance: 0.08 }), mix(m.pigment, m.deep, 0.3), 0.5 * a);
      for (const f of g.flecks) L.lift(deformPolygon(f, rng, { depth: 1, variance: 0.1 }), 0.4 * a);
      L.fill(ribbon(smoothPath(g.midrib, 1.2), (t) => 0.36 * (1 - 0.7 * t)), m.deep, 0.3 * a);
    }
    if (g.under.length) {
      L.lift(g.under, 0.6 * a);
      L.fill(deformPolygon(g.under, rng, { depth: 1, variance: 0.04 }), m.underside, 0.45 * a);
    }
  }
  L.dry({ opacity, edge: 0.14, edgeWidth: 0.5, sharpness: 0.3, centreLift: 0.08, granulation: 0.26, flow: 0.35, flowScale: 8, dry: 0.02, darken: 0.05 });
}

function shrink(poly: readonly Pt[], c: Pt, k: number): Pt[] {
  return poly.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));
}

/** The part of a blade on the far side of its centre from the light (upper left). */
function shadowHalf(poly: readonly Pt[]): Pt[] {
  let cx = 0;
  let cy = 0;
  for (const q of poly) {
    cx += q.x / poly.length;
    cy += q.y / poly.length;
  }
  const out = poly.filter((q) => (q.x - cx) * 0.6 + (q.y - cy) * 0.8 > -0.15);
  return out.length >= 3 ? out : [...poly];
}

// ---------------------------------------------------------------------------------------------
// stalks and coils

export interface StalkMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
}

export function paintStalks(p: Painter, stalks: readonly StalkMark[], opacity = 0.78): void {
  const live = stalks.filter((s) => s.pts.length >= 2 && s.width > 0.12);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.flatMap((s) => s.pts)), 3));
  for (const s of live) {
    const rng = createRng(s.seed);
    ribbonInto(L, s.pts, s.width, s.pigment, rng, { taper: [0.18, 0.04], endWidth: 0.9, fills: 1, coverage: 0.9 });
    ribbonInto(L, s.pts, s.width * 0.35, s.deep, rng, { taper: [0.2, 0.3], endWidth: 0.7, fills: 1, offset: s.width * 0.2 });
  }
  L.dry({ opacity, edge: 0.4, edgeWidth: 0.6, sharpness: 0.6, centreLift: 0.05, granulation: 0.2, flow: 0.25, flowScale: 8, dry: 0.03 });
}

/** The spring a seed stalk becomes: a short riser, then loops that pull the capsule down to the ground. */
export function coilPath(x0: number, dir: number, height: number, turns: number, radius: number, extent: number): Pt[] {
  const n = 28;
  const pts: Pt[] = [];
  const rise = 0.3;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * extent;
    if (t < rise) {
      pts.push({ x: x0 + dir * 1.5 * t / rise, y: -4 - height * (t / rise) });
    } else {
      const u = (t - rise) / (1 - rise);
      const ph = TAU * turns * u;
      pts.push({ x: x0 + dir * (1.5 + 3 * u) + Math.sin(ph) * radius * (1 - 0.2 * u), y: -4 - height * (1 - 0.82 * u) + Math.cos(ph) * radius * 0.4 - radius * 0.4 });
    }
  }
  return pts;
}

export interface CapsuleMark {
  at: Pt;
  r: number;
  pigment: Pigment;
  deep: Pigment;
  seed: number;
  alpha: number;
}

export function paintCapsules(p: Painter, caps: readonly CapsuleMark[]): void {
  for (const c of caps) {
    if (c.alpha < 0.05) continue;
    const rng = createRng(c.seed);
    p.wash({ cx: c.at.x, cy: c.at.y, rx: c.r, ry: c.r * 0.92 }, c.pigment, { rng: rng.fork('cap'), opacity: 0.8 * c.alpha, edge: 0.5, sharpness: 0.6, centreLift: 0.15, granulation: 0.3 });
    p.wash({ cx: c.at.x + c.r * 0.25, cy: c.at.y + c.r * 0.3, rx: c.r * 0.6, ry: c.r * 0.5 }, c.deep, { rng: rng.fork('capdeep'), opacity: 0.35 * c.alpha, edge: 0.3, sharpness: 0.4 });
  }
}

// ---------------------------------------------------------------------------------------------
// the nodding flower

export interface FlowerSpec {
  /** where the stalk ends (the back of the flower) */
  c: Pt;
  /** direction the flower hangs, from the stalk's end to its mouth (radians) */
  axis: number;
  /** 0 a tight hanging bud … 1 the petals swept right back */
  open: number;
  size: number;
  /** how wide the petals fan (a flower seen edge-on is narrow) */
  spread: number;
  /** per petal: twist (-1..1) and length factor */
  petals: { twist: number; len: number }[];
}

export interface PetalGeom {
  poly: Pt[];
  /** the deeper pink at the base */
  base: Pt[];
  /** a lifted stripe along the twist */
  stripe: Pt[];
  /** the flank away from the light */
  flank: Pt[];
}

export interface FlowerGeom {
  petals: PetalGeom[];
  mouth: Pt;
  /** the V-shaped blotch at the mouth */
  blotch: Pt[][];
  tube: Pt[];
}

const TUBE = 2.6;
const PETAL_LEN = 8.6;

function petalGeometry(m: Pt, dir: number, len: number, hw: number, twist: number): PetalGeom {
  const cd = Math.cos(dir);
  const sd = Math.sin(dir);
  const n = 9;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const mid: Pt[] = [];
  const at = (u: number, v: number): Pt => ({ x: m.x + cd * u * len - sd * v, y: m.y + sd * u * len + cd * v });
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const w = hw * Math.sin(Math.PI * u ** 0.75) ** 0.85 * (1 - 0.1 * u);
    const bend = twist * len * 0.13 * Math.sin(Math.PI * 1.15 * u);
    left.push(at(u, bend - w * (1 + 0.3 * twist)));
    right.push(at(u, bend + w * (1 - 0.3 * twist)));
    mid.push(at(u, bend));
  }
  const cut = (a: Pt[], from: number, to: number) => a.slice(from, to + 1);
  const side = twist >= 0 ? left : right;
  return {
    poly: [...left, ...[...right].reverse()],
    base: [...cut(left, 0, 4), ...cut(right, 0, 4).reverse()],
    stripe: [...cut(mid, 2, 7), ...cut(side.map((q, i) => ({ x: (q.x + mid[i]!.x) / 2, y: (q.y + mid[i]!.y) / 2 })), 2, 7).reverse()],
    flank: [...cut(side, 0, n), ...[...mid].reverse()],
  };
}

export function flowerGeometry(f: FlowerSpec): FlowerGeom {
  const e = smoothstep(f.open);
  const ca = Math.cos(f.axis);
  const sa = Math.sin(f.axis);
  const tube = TUBE * f.size;
  const mouth = { x: f.c.x + ca * tube, y: f.c.y + sa * tube };
  const petals = f.petals.map((pl, i) => {
    const o = (i - 2) * 0.28 * f.spread;
    const ao = Math.abs(o);
    const s = o < 0 ? 1 : -1;
    const dir = f.axis + s * (ao * 0.2 + (Math.PI - ao * 2 - ao * 0.2 - 0.12) * e);
    const len = PETAL_LEN * f.size * pl.len * (0.62 + 0.38 * e);
    const hw = len * (0.14 + 0.06 * e);
    return petalGeometry(mouth, dir, len, hw, pl.twist);
  });
  const back = f.axis + Math.PI;
  const arm = (side: number): Pt[] => {
    const d = back + side * (0.42 + 0.16 * e);
    const l = 2.7 * f.size * (0.5 + 0.5 * e);
    const w = 0.55 * f.size;
    const tip = { x: mouth.x + Math.cos(d) * l, y: mouth.y + Math.sin(d) * l };
    const nx = -Math.sin(d) * w;
    const ny = Math.cos(d) * w;
    return [mouth, { x: mouth.x + (tip.x - mouth.x) * 0.5 + nx, y: mouth.y + (tip.y - mouth.y) * 0.5 + ny }, tip, { x: mouth.x + (tip.x - mouth.x) * 0.5 - nx, y: mouth.y + (tip.y - mouth.y) * 0.5 - ny }];
  };
  const tubeShape = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU;
    return { x: f.c.x + ca * tube * 0.5 + Math.cos(a) * 1.1 * f.size, y: f.c.y + sa * tube * 0.5 + Math.sin(a) * (tube * 0.62) };
  });
  return { petals, mouth, blotch: [arm(-1), arm(1)], tube: tubeShape };
}

export interface FlowerMark {
  geom: FlowerGeom;
  alpha: number;
  open: number;
  petal: Pigment;
  tip: Pigment;
  base: Pigment;
  throat: Pigment;
  seed: number;
  tones: number[];
}

/** Flowers: each petal a quick wet touch, a deeper base, a lifted twist, then the dark V at the mouth. */
export function paintFlowers(p: Painter, flowers: readonly FlowerMark[], opacity = 0.92): void {
  const live = flowers.filter((f) => f.alpha > 0.02);
  if (!live.length) return;
  const pts = live.flatMap((f) => f.geom.petals.flatMap((q) => q.poly));
  const L = p.layer(padRect(bounds(pts), 3));
  const order = [2, 0, 4, 1, 3];
  for (const f of live) {
    const rng = createRng(f.seed);
    const a = f.alpha;
    for (const i of order) {
      const pg = f.geom.petals[i]!;
      const tone = f.tones[i]!;
      const body = jitter(mix(f.petal, f.tip, tone), rng, 0.015);
      L.fill(deformPolygon(pg.poly, rng, { depth: 1, variance: 0.03 }), body, 0.66 * a);
      L.fill(deformPolygon(pg.base, rng, { depth: 1, variance: 0.04 }), f.base, 0.42 * a * (0.5 + 0.5 * f.open));
      L.fill(deformPolygon(pg.flank, rng, { depth: 1, variance: 0.04 }), f.base, 0.18 * a);
      if (f.open > 0.35) L.lift(pg.stripe, 0.3 * a * f.open);
    }
    L.fill(f.geom.tube, f.base, 0.5 * a);
    for (const arm of f.geom.blotch) L.fill(deformPolygon(arm, rng, { depth: 1, variance: 0.05 }), f.throat, 0.82 * a);
    L.fill(
      Array.from({ length: 7 }, (_, i) => ({ x: f.geom.mouth.x + Math.cos((i / 7) * TAU) * 0.9, y: f.geom.mouth.y + Math.sin((i / 7) * TAU) * 0.8 })),
      f.throat,
      0.9 * a,
    );
  }
  L.dry({ opacity, edge: 0.5, edgeWidth: 0.6, sharpness: 0.6, centreLift: 0.08, granulation: 0.2, flow: 0.3, flowScale: 5, darken: 0.2 });
}
