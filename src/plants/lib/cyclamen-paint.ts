/**
 * Painting helpers for the ivy-leaved cyclamen (docs/systems/plants-species-a.md): marbled
 * heart-shaped leaves, nodding flowers with swept-back petals, thin stalks and coiled seed
 * stalks. Used by that species only.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, smoothPath, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const ELEV_Y = 0.6;
const ELEV_H = 0.84;
const STALK_LIGHT = '#d9a0a0';

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
  /** seeds the irregular marbling, the veins and which flank loses its edge */
  marble?: number;
}

export interface LeafGeom {
  outline: Pt[];
  zone: Pt[];
  midrib: Pt[];
  flecks: Pt[][];
  /** the curled margin showing its underside (empty when the blade lies flat) */
  under: Pt[];
  tip: Pt;
  /** where the blade joins its stalk */
  base: Pt;
  /** silver blotches between the veins */
  patches: Pt[][];
  /** fine silver veins from the base to the margin */
  veins: Pt[][];
  /** a band along one flank where the margin is left to melt into the paper */
  lost: Pt[];
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
  const mr = createRng(s.marble ?? 1);
  const ph = [mr.range(0, TAU), mr.range(0, TAU), mr.range(0, TAU)] as const;
  const zone: Pt[] = [];
  for (let d = 0; d < 360; d += 10) {
    const n = 0.5 + 0.5 * (0.5 * Math.sin(d * RAD * 3 + ph[0]) + 0.3 * Math.sin(d * RAD * 5 + ph[1]) + 0.2 * Math.sin(d * RAD * 8 + ph[2]));
    zone.push(polar(d, Math.min(0.9, s.zone * (0.55 + 0.55 * n)), 0.02 * L));
  }
  const baseP = to(notch + 0.02 * L, 0);
  const patches: Pt[][] = [];
  for (let i = 0; i < 11; i++) {
    const deg = (i % 2 ? -1 : 1) * mr.range(22, 150);
    const c = leafRadius(deg) * R * mr.range(0.3, 0.8);
    const cx = 0.45 * L + Math.cos(deg * RAD) * c;
    const cyy = Math.sin(deg * RAD) * c * 0.96;
    const rr = mr.range(0.06, 0.17) * R;
    const stretch = mr.range(1.1, 1.9);
    const rot = deg * RAD + mr.range(-0.4, 0.4);
    patches.push(
      Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * TAU;
        const rw = 1 + 0.35 * Math.sin(a * 3 + i);
        const ex = Math.cos(a) * rr * stretch * rw;
        const ey = Math.sin(a) * rr * 0.7 * rw;
        return to(cx + ex * Math.cos(rot) - ey * Math.sin(rot), cyy + ex * Math.sin(rot) + ey * Math.cos(rot));
      }),
    );
  }
  const veins: Pt[][] = [];
  for (const deg of [-104, -64, -30, 30, 64, 104]) {
    const end = polar(deg + mr.range(-8, 8), mr.range(0.55, 0.88));
    const bow = mr.range(-0.12, 0.12);
    const dx = end.x - baseP.x;
    const dy = end.y - baseP.y;
    veins.push(Array.from({ length: 6 }, (_, k) => {
      const t = k / 5;
      const w = Math.sin(Math.PI * t) * bow;
      return { x: baseP.x + dx * t - dy * w, y: baseP.y + dy * t + dx * w };
    }));
  }
  const lostSide = mr.chance(0.5) ? 1 : -1;
  const lostArc: number[] = [];
  for (let d = 28; d <= 120; d += 8) lostArc.push(lostSide * d);
  const lost = [...lostArc.map((d) => polar(d, 1.04)), ...[...lostArc].reverse().map((d) => polar(d, 0.86))];
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
  return { outline, zone, midrib, flecks, under, tip: polar(0, 1), base: baseP, patches, veins, lost };
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

const SHADE = '#7c7a9c';
const LIT = '#86a566';
const MID_DARK = '#244636';

/**
 * Leaves back to front, each in its own wet layer: a green wash that pools dark at the base and
 * along the flank away from the light, a sunlit flank, silver marbling lifted in blotches and
 * veins, and a margin that melts away on one side. A soft shade falls on what lies below.
 */
export function paintLeaves(p: Painter, marks: readonly LeafMark[], opacity = 0.94): void {
  for (const m of marks) {
    if (m.alpha <= 0.02) continue;
    const rng = createRng(m.seed);
    const a = m.alpha;
    const g = m.geom;
    paintShade(p, g.outline, rng, a);
    const L = p.layer(padRect(bounds(g.outline), 3));
    const c = centroid(g.outline);
    const pigment = jitter(m.pigment, rng, 0.02);
    L.fill(deformPolygon(g.outline, rng, { depth: 1, variance: 0.03 }), pigment, 0.5 * a);
    L.fill(deformPolygon(g.outline, rng, { depth: 1, variance: 0.05 }), jitter(m.pigment, rng, 0.03), 0.3 * a);
    // sunlit flank: a warmer green on the lit half
    const lit = onSide(g.outline, c, -1, 0.1);
    L.fill(deformPolygon(shrink(lit, c, 0.85), rng, { depth: 1, variance: 0.08 }), LIT, 0.2 * a);
    // pooled dark: the base, then the flank away from the light
    for (const k of [0.62, 0.42, 0.24]) L.fill(deformPolygon(shrink(g.outline, g.base, k), rng, { depth: 1, variance: 0.08 }), m.deep, 0.16 * a);
    const dark = onSide(g.outline, c, 1, -0.1);
    L.fill(deformPolygon(dark, rng, { depth: 1, variance: 0.06 }), m.deep, 0.16 * a);
    L.fill(deformPolygon(shrink(dark, c, 0.78), rng, { depth: 1, variance: 0.08 }), m.deep, 0.12 * a);
    if (a > 0.3) {
      const zone = deformPolygon(g.zone, rng, { depth: 2, variance: 0.1 });
      L.lift(zone, 0.36 * a);
      L.fill(zone, m.silver, 0.14 * a);
      for (const q of g.patches) {
        const blot = deformPolygon(q, rng, { depth: 1, variance: 0.12 });
        L.lift(blot, 0.58 * a);
        L.fill(blot, m.silver, 0.26 * a);
      }
      for (const f of g.flecks) L.lift(deformPolygon(f, rng, { depth: 1, variance: 0.1 }), 0.3 * a);
      for (const v of g.veins) {
        const w = 0.26 + 0.14 * rng.next();
        L.lift(ribbon(smoothPath(v, 1), (t) => w * (1 - 0.7 * t)), 0.36 * a);
      }
      L.fill(ribbon(smoothPath(g.midrib, 1.2), (t) => 0.5 * (1 - 0.6 * t)), mix(m.deep, MID_DARK, 0.5), 0.35 * a);
      L.lift(ribbon(smoothPath(g.midrib, 1.2), (t) => 0.16 * (1 - 0.5 * t)), 0.3 * a);
    }
    if (g.under.length) {
      L.lift(g.under, 0.6 * a);
      L.fill(deformPolygon(g.under, rng, { depth: 1, variance: 0.04 }), m.underside, 0.45 * a);
    }
    L.lift(g.lost, 0.45 * a);
    L.dry({ opacity, edge: 0.18, edgeWidth: 0.5, sharpness: 0.22, centreLift: 0.05, granulation: 0.26, flow: 0.55, flowScale: 5, dry: 0.02, darken: 0.12 });
  }
}

/** A soft cool shade of the blade, cast down and right, with the blade's own footprint taken out. */
function paintShade(p: Painter, outline: readonly Pt[], rng: Rng, a: number): void {
  const c = centroid(outline);
  const cast = (k: number, dx: number, dy: number) => shrink(outline, c, k).map((q) => ({ x: q.x + dx, y: q.y + dy }));
  const big = cast(1.1, 0.9, 1.9);
  const S = p.layer(padRect(bounds(big), 2));
  S.fill(deformPolygon(big, rng, { depth: 1, variance: 0.05 }), SHADE, 0.16 * a);
  S.fill(deformPolygon(cast(0.98, 0.7, 1.5), rng, { depth: 1, variance: 0.05 }), SHADE, 0.22 * a);
  S.lift(outline, 1);
  S.dry({ opacity: 0.4, edge: 0.04, edgeWidth: 1.5, sharpness: 0.05, centreLift: 0.1, granulation: 0.1, flow: 0.2, flowScale: 8, darken: 0 });
}

function centroid(poly: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const q of poly) {
    x += q.x / poly.length;
    y += q.y / poly.length;
  }
  return { x, y };
}

function shrink(poly: readonly Pt[], c: Pt, k: number): Pt[] {
  return poly.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));
}

/** The outline's points on the lit side (`side` -1, upper left) or the shaded side (1) of `c`. */
function onSide(poly: readonly Pt[], c: Pt, side: number, bias: number): Pt[] {
  const out = poly.filter((q) => side * ((q.x - c.x) * 0.6 + (q.y - c.y) * 0.8) > bias);
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
    const ph = rng.range(0, TAU);
    const ph2 = rng.range(0, TAU);
    const weight = (t: number) => 0.62 + 0.4 * Math.sin(t * 6 + ph) + 0.25 * Math.sin(t * 13 + ph2) + 0.5 * Math.max(0, t - 0.88) * 8;
    const body = mix(s.pigment, s.deep, rng.range(0, 0.5));
    ribbonInto(L, s.pts, s.width, jitter(body, rng, 0.03), rng, { taper: [0.18, 0.04], endWidth: 0.9, fills: 2, coverage: 0.85, pressure: weight });
    ribbonInto(L, s.pts, s.width * 0.4, s.deep, rng, { taper: [0.2, 0.3], endWidth: 0.7, fills: 1, offset: s.width * 0.2, coverage: 0.5, pressure: weight });
    // the lit edge is left a shade paler than the body
    ribbonInto(L, s.pts, s.width * 0.22, STALK_LIGHT, rng, { taper: [0.3, 0.3], endWidth: 0.4, fills: 1, offset: -s.width * 0.22, coverage: 0.4 });
  }
  L.dry({ opacity, edge: 0.22, edgeWidth: 0.5, sharpness: 0.35, centreLift: 0.05, granulation: 0.2, flow: 0.5, flowScale: 4, dry: 0.12, darken: 0.1 });
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
  /** seen from the front (0), the side (0.5) or behind (1) */
  view?: number;
}

export interface PetalGeom {
  poly: Pt[];
  /** the deeper pink at the base */
  base: Pt[];
  /** a lifted stripe along the twist */
  stripe: Pt[];
  /** the flank away from the light */
  flank: Pt[];
  /** nested shapes from the base outward, for the pale-to-deep grading */
  grade: Pt[][];
  /** the fold down the middle of the petal */
  fold: Pt[];
}

export interface FlowerGeom {
  petals: PetalGeom[];
  mouth: Pt;
  /** the V-shaped blotch at the mouth */
  blotch: Pt[][];
  tube: Pt[];
  /** the seen-from-behind flower shows its calyx where the stalk joins (empty otherwise) */
  calyx: Pt[];
  view: number;
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
    grade: [3, 5, 7].map((k) => [...cut(left, 0, k), ...cut(right, 0, k).reverse()]),
    fold: cut(mid, 1, 8),
  };
}

export function flowerGeometry(f: FlowerSpec): FlowerGeom {
  const e = smoothstep(f.open);
  const view = f.view ?? 0;
  const back = view > 0.75;
  const side = view > 0.25 && !back;
  const ca = Math.cos(f.axis);
  const sa = Math.sin(f.axis);
  const tube = TUBE * f.size;
  const mouth = { x: f.c.x + ca * tube, y: f.c.y + sa * tube };
  const petals = f.petals.map((pl, i) => {
    const o = (i - 2) * 0.28 * f.spread * (back ? 0.7 : side ? 0.82 : 1);
    const ao = Math.abs(o);
    const s = o < 0 ? 1 : -1;
    const dir = f.axis + s * (ao * 0.2 + (Math.PI - ao * 2 - ao * 0.2 - 0.12) * e);
    const far = side && i > 2 ? 0.8 : 1;
    const len = PETAL_LEN * f.size * pl.len * (0.62 + 0.38 * e) * far;
    const hw = len * (0.14 + 0.06 * e) * (back ? 1.12 : side && i > 2 ? 0.8 : 1);
    return petalGeometry(mouth, dir, len, hw, pl.twist);
  });
  const behind = f.axis + Math.PI;
  const arm = (sgn: number): Pt[] => {
    const d = behind + sgn * (0.42 + 0.16 * e);
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
  const calyx = back
    ? Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * TAU;
        return { x: f.c.x + ca * 0.5 * f.size + Math.cos(a) * 1.15 * f.size, y: f.c.y + sa * 0.5 * f.size + Math.sin(a) * 0.9 * f.size };
      })
    : [];
  return { petals, mouth, blotch: back ? [] : [arm(-1), arm(1)], tube: tubeShape, calyx, view };
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
  /** the deepest magenta, at the petals' base */
  deepest?: Pigment;
}

/**
 * Flowers, each in its own wet layer: every petal a pale wash graded to magenta at the mouth, a
 * soft fold and a lifted lit edge, then the dark V at the mouth (or the calyx, seen from behind).
 */
export function paintFlowers(p: Painter, flowers: readonly FlowerMark[], opacity = 0.92): void {
  const order = [2, 0, 4, 1, 3];
  for (const f of flowers) {
    if (f.alpha <= 0.02) continue;
    const rng = createRng(f.seed);
    const a = f.alpha;
    const L = p.layer(padRect(bounds(f.geom.petals.flatMap((q) => q.poly)), 3));
    const deepest = f.deepest ?? f.base;
    const back = f.geom.view > 0.75;
    for (const i of order) {
      const pg = f.geom.petals[i]!;
      const tone = f.tones[i]!;
      const body = jitter(mix(f.petal, f.tip, tone * 0.8), rng, 0.02);
      L.fill(deformPolygon(pg.poly, rng, { depth: 1, variance: 0.03 }), mix(body, f.tip, 0.45), 0.5 * a);
      L.fill(deformPolygon(pg.flank, rng, { depth: 1, variance: 0.05 }), body, 0.26 * a);
      const k = 0.5 + 0.5 * f.open;
      for (const [j, g] of pg.grade.entries()) L.fill(deformPolygon(g, rng, { depth: 1, variance: 0.04 }), j < 2 ? f.base : deepest, (j === 0 ? 0.2 : 0.15) * a * k * (back ? 0.7 : 1));
      L.fill(deformPolygon(pg.base, rng, { depth: 1, variance: 0.04 }), deepest, 0.3 * a * k * (back ? 0.6 : 1));
      L.fill(ribbon(smoothPath(pg.fold, 0.6), (t) => 0.2 * (1 - 0.6 * t)), f.base, 0.28 * a);
      if (f.open > 0.35) L.lift(pg.stripe, 0.34 * a * f.open);
    }
    if (back) {
      L.fill(f.geom.calyx, mix(f.throat, '#6f5a3a', 0.5), 0.7 * a);
    } else {
      L.fill(f.geom.tube, deepest, 0.5 * a);
      for (const arm of f.geom.blotch) L.fill(deformPolygon(arm, rng, { depth: 1, variance: 0.05 }), f.throat, 0.8 * a);
      L.fill(
        Array.from({ length: 7 }, (_, i) => ({ x: f.geom.mouth.x + Math.cos((i / 7) * TAU) * 0.9, y: f.geom.mouth.y + Math.sin((i / 7) * TAU) * 0.8 })),
        f.throat,
        0.9 * a,
      );
    }
    L.dry({ opacity, edge: 0.4, edgeWidth: 0.5, sharpness: 0.4, centreLift: 0.08, granulation: 0.18, flow: 0.45, flowScale: 3, darken: 0.2 });
  }
}
