import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbon } from '../lib/baikamo-paint';
import { clamp01, ease, lerp, smooth, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import type { SpeciesDef } from '../types';

/**
 * Cystoseira: the small bushy brown alga of clear rocky shallows and rock pools, seen through the
 * water from the cliff. A holdfast on a stone, a short stalk, forking branches and branchlets
 * tipped with fine spines, small air bladders, swollen golden fertile tips at full growth.
 */

const BROWN = '#6b5232';
const OLIVE = '#8f7236';
const GOLD = '#c9a24e';
const AMBER = '#c98a3a';
const TIP = '#dcc57a';
const SHEEN = '#6fa0a8';
const BEAD = '#d3bb6c';
const EPI = '#efe6cc';
const SEA = '#19a5ad';
const AQUA = '#8fd8cc';

/** Vertical squash of the bed and the share of a branch's rise that shows, as in the Posidonia. */
const FLAT = 0.42;
const RISE = 0.78;
const BOX = { w: 120, h: 92, ax: 0.5, ay: 0.74 };

interface P3 {
  x: number;
  z: number;
  h: number;
}

interface Branch {
  id: string;
  level: 0 | 1 | 2 | 3;
  /** the whole branch, base to tip, in bed units */
  pts: P3[];
  width: number;
  /** growth window */
  window: [number, number];
  /** 0 olive-brown … 1 golden */
  tone: number;
  back: boolean;
  /** swollen fertile tip, and the bladders (where along the branch) */
  fertile: boolean;
  bladders: { s: number; r: number }[];
  /** pale epiphyte fleck (where along) */
  fleck: number | null;
}

interface Stone {
  x: number;
  z: number;
  rx: number;
  rz: number;
  seed: number;
  at: number;
}

export interface CystoseiraPlan {
  branches: Branch[];
  stones: Stone[];
  /** the current's direction on the bed (radians, 0 = +x) */
  drift: number;
  glints: { x0: number; x1: number; y: number }[];
}

const project = (q: P3): Pt => ({ x: q.x, y: q.z * FLAT - q.h * RISE });

/** The unit step of a heading: azimuth a (0 = +x, toward the viewer positive) and elevation e. */
const step = (a: number, e: number) => ({ x: Math.cos(e) * Math.cos(a), z: Math.cos(e) * Math.sin(a), h: Math.sin(e) });

interface Spec {
  id: string;
  level: Branch['level'];
  origin: P3;
  az: number;
  el: number;
  len: number;
  curl: number;
  n: number;
  width: number;
  window: [number, number];
  tone: number;
}

function makeBranch(rng: Rng, sp: Spec, drift: number): Branch {
  const pts: P3[] = [sp.origin];
  let a = sp.az;
  let e = sp.el;
  let q = sp.origin;
  const ds = sp.len / sp.n;
  const ph = rng.range(0, Math.PI * 2);
  for (let i = 1; i <= sp.n; i++) {
    e -= sp.curl * 0.16 + Math.sin(i * 1.4 + ph) * 0.05;
    a += Math.sin(drift - a) * 0.09 + Math.sin(i * 1.1 + ph) * 0.07;
    const d = step(a, e);
    q = { x: q.x + d.x * ds, z: q.z + d.z * ds, h: Math.max(0, q.h + d.h * ds) };
    pts.push(q);
  }
  return { id: sp.id, level: sp.level, pts, width: sp.width, window: sp.window, tone: sp.tone, back: false, fertile: false, bladders: [], fleck: null };
}

/** A point along a whole branch by fraction of its length. */
function pointAt(pts: readonly P3[], t: number): P3 {
  const f = clamp01(t) * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  return { x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), h: lerp(a.h, b.h, u) };
}

/** The heading (azimuth, elevation) of a branch at fraction t. */
function headingAt(pts: readonly P3[], t: number): { az: number; el: number } {
  const a = pointAt(pts, Math.max(0, t - 0.08));
  const b = pointAt(pts, Math.min(1, t + 0.08));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return { az: Math.atan2(dz, dx), el: Math.atan2(b.h - a.h, Math.hypot(dx, dz)) };
}

/** The growth value at which a branch's eased length has reached fraction t of the whole. */
function reaches(w: readonly [number, number], t: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    if (smooth(m) < t) lo = m;
    else hi = m;
  }
  return lerp(w[0], w[1], (lo + hi) / 2);
}

function plantBush(rng: Rng, out: Branch[], tag: string, at: { x: number; z: number }, scale: number, win: [number, number], drift: number): void {
  const [g0, g1] = win;
  const S = g1 - g0;
  const base: P3 = { x: at.x, z: at.z, h: 0.4 };
  const stalk = makeBranch(rng, { id: `${tag}.0`, level: 0, origin: base, az: rng.range(0, 6.28), el: rng.range(1.35, 1.5), len: 4.6 * scale * rng.range(0.9, 1.15), curl: 0.05, n: 3, width: 2.5 * Math.max(0.6, scale), window: [g0, g0 + S * 0.12], tone: 0.1 }, drift);
  out.push(stalk);
  const nPri = Math.max(3, Math.round(rng.int(8, 10) * (0.45 + 0.55 * scale)));
  const top = stalk.pts[stalk.pts.length - 1]!;
  const offset = rng.range(0, 6.28);
  let id = 1;
  for (let i = 0; i < nPri; i++) {
    const az = offset + (i / nPri) * Math.PI * 2 + rng.gaussian(0, 0.28);
    const len = rng.range(24, 32) * scale;
    const t0 = 0.55 + rng.range(0, 0.45);
    const o = pointAt(stalk.pts, t0);
    const start = Math.max(g0, reaches(stalk.window, t0)) + S * rng.range(0.0, 0.06) + (i / nPri) * S * 0.1;
    const pri = makeBranch(
      rng,
      { id: `${tag}.${id++}`, level: 1, origin: { x: o.x, z: o.z, h: Math.max(o.h, top.h * 0.9) }, az, el: rng.range(0.8, 1.2), len, curl: rng.range(0.25, 0.6), n: 7, width: 2.3 * Math.max(0.65, scale), window: [start, Math.min(g1, start + S * 0.36)], tone: rng.range(0.15, 0.5) },
      drift,
    );
    out.push(pri);
    const nSec = Math.max(2, Math.round(rng.int(5, 7) * (0.5 + 0.5 * scale)));
    for (let j = 0; j < nSec; j++) {
      const t = 0.22 + (j / nSec) * 0.74 + rng.range(-0.04, 0.04);
      const h = headingAt(pri.pts, t);
      const side = j % 2 ? 1 : -1;
      const sl = len * rng.range(0.34, 0.5) * (1 - 0.3 * t);
      const s0 = Math.max(pri.window[0], reaches(pri.window, t)) + S * 0.02;
      const sec = makeBranch(
        rng,
        { id: `${tag}.${id++}`, level: 2, origin: pointAt(pri.pts, t), az: h.az + side * rng.range(0.6, 1.1), el: Math.max(0.1, h.el * 0.7 + rng.range(0, 0.3)), len: sl, curl: rng.range(0.4, 0.9), n: 5, width: 1.35 * Math.max(0.7, scale), window: [Math.min(s0, g1 - 0.06), Math.min(g1, s0 + S * 0.3)], tone: rng.range(0.35, 0.75) },
        drift,
      );
      if (rng.chance(0.38)) sec.bladders.push({ s: rng.range(0.3, 0.75), r: rng.range(0.7, 1.0) * Math.max(0.75, scale) });
      out.push(sec);
      const nLet = rng.int(3, 5);
      for (let m = 0; m < nLet; m++) {
        const u = 0.3 + (m / nLet) * 0.62 + rng.range(-0.04, 0.04);
        const hh = headingAt(sec.pts, u);
        const l0 = Math.max(sec.window[0], reaches(sec.window, u)) + S * 0.02;
        const let3 = makeBranch(
          rng,
          { id: `${tag}.${id++}`, level: 3, origin: pointAt(sec.pts, u), az: hh.az + (m % 2 ? 1 : -1) * rng.range(0.5, 0.95), el: Math.max(0.1, hh.el * 0.8 + rng.range(0, 0.35)), len: sl * rng.range(0.4, 0.62), curl: rng.range(0.2, 0.7), n: 3, width: 0.8 * Math.max(0.75, scale), window: [Math.min(l0, g1 - 0.05), Math.min(g1, l0 + S * 0.22)], tone: rng.range(0.6, 1) },
          drift,
        );
        let3.fertile = rng.chance(0.3);
        if (rng.chance(0.2)) let3.bladders.push({ s: rng.range(0.5, 0.85), r: rng.range(0.55, 0.8) * Math.max(0.75, scale) });
        out.push(let3);
      }
      // the secondary's own tip carries spines too: one more fine branchlet straight on
      const tipHead = headingAt(sec.pts, 0.96);
      const tl = makeBranch(
        rng,
        { id: `${tag}.${id++}`, level: 3, origin: pointAt(sec.pts, 1), az: tipHead.az + rng.gaussian(0, 0.3), el: tipHead.el, len: sl * rng.range(0.3, 0.45), curl: 0.3, n: 3, width: 0.75 * Math.max(0.75, scale), window: [Math.min(sec.window[1] - S * 0.04, g1 - 0.05), Math.min(g1, sec.window[1] + S * 0.2)], tone: rng.range(0.7, 1) },
        drift,
      );
      tl.fertile = rng.chance(0.55);
      out.push(tl);
    }
  }
}

export function planCystoseira(rng: Rng): CystoseiraPlan {
  const drift = rng.range(-0.15, 0.3);
  const branches: Branch[] = [];
  const bushes: { at: { x: number; z: number }; scale: number; win: [number, number] }[] = [
    { at: { x: rng.range(-3, 3), z: rng.range(-1, 2) }, scale: 1, win: [0, 0.9] },
    { at: { x: -rng.range(20, 26), z: rng.range(5, 10) }, scale: rng.range(0.5, 0.62), win: [0.3, 0.92] },
    { at: { x: rng.range(20, 26), z: rng.range(4, 12) }, scale: rng.range(0.36, 0.46), win: [0.46, 0.96] },
  ];
  const stones: Stone[] = [];
  bushes.forEach((b, i) => {
    plantBush(rng.fork(`bush${i}`), branches, `b${i}`, b.at, b.scale, b.win, drift);
    stones.push({ x: b.at.x, z: b.at.z + 1, rx: (i ? 9 : 14) * (0.7 + 0.3 * b.scale) * rng.range(0.9, 1.15), rz: (i ? 7 : 9) * (0.7 + 0.3 * b.scale), seed: rng.int(1, 1e9), at: i ? b.win[0] - 0.1 : 0 });
  });
  for (const b of branches) {
    const mid = pointAt(b.pts, 0.5);
    b.back = mid.z < 1;
    if (b.level === 2 && rng.chance(0.3)) b.fleck = rng.range(0.4, 0.9);
  }
  const glints = Array.from({ length: rng.int(2, 4) }, () => {
    const x0 = rng.range(-46, 20);
    return { x0, x1: x0 + rng.range(14, 30), y: rng.range(-34, -10) };
  });
  return { branches, stones, drift, glints };
}

export interface BranchPose {
  id: string;
  level: Branch['level'];
  pts: Pt[];
  widths: number[];
  tone: number;
  back: boolean;
  /** how high the branch stands, 0 low … 1 high, for the water's tint */
  lift: number;
  k: number;
  fertile: { at: Pt; dir: number; k: number } | null;
  bladders: { at: Pt; r: number }[];
  fleck: Pt | null;
  seed: number;
}

export interface CystoseiraPose {
  branches: BranchPose[];
  stones: { x: number; y: number; rx: number; ry: number; k: number; seed: number }[];
  glint: number;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Every mark of the plant at growth g: a pure function, so a session's frames match. */
export function poseCystoseira(plan: CystoseiraPlan, g: number): CystoseiraPose {
  const branches: BranchPose[] = [];
  for (const b of plan.branches) {
    const k = ease(g, b.window[0], b.window[1]);
    if (!visible(k)) continue;
    const n = b.pts.length - 1;
    const upto = k * n;
    const pts: P3[] = [];
    for (let i = 0; i <= Math.floor(upto); i++) pts.push(b.pts[i]!);
    if (upto > Math.floor(upto)) pts.push(pointAt(b.pts, k));
    if (pts.length < 2) continue;
    const m = pts.length - 1;
    const grow = smooth(k * 2.2);
    const widths = pts.map((_, i) => {
      const u = i / m;
      const taper = b.level === 3 ? lerp(1, 0.08, u ** 0.9) : b.level === 2 ? lerp(1, 0.2, u) : lerp(1, 0.32, u);
      return b.width * 0.5 * taper * grow;
    });
    const tip = pts[m]!;
    const fk = ease(g, 0.82, 0.98) * smooth(k * 3);
    const fertile = b.fertile && visible(fk) ? { at: project(tip), dir: Math.atan2(project(tip).y - project(pts[Math.max(0, m - 1)]!).y, project(tip).x - project(pts[Math.max(0, m - 1)]!).x), k: fk } : null;
    const bladders = b.bladders.map((bl) => ({ at: project(pointAt(b.pts, bl.s)), r: bl.r * ease(g, 0.5, 0.8) * smooth((k - bl.s) / 0.12) })).filter((bl) => bl.r > 0.02);
    const fleck = b.fleck !== null && b.fleck < k ? project(pointAt(b.pts, b.fleck)) : null;
    const lift = clamp01(pointAt(b.pts, 0.6).h / 34);
    branches.push({ id: b.id, level: b.level, pts: pts.map(project), widths, tone: b.tone, back: b.back, lift, k, fertile, bladders, fleck: fleck && ease(g, 0.6, 0.9) > 0 ? fleck : null, seed: hash(b.id) });
  }
  const stones = plan.stones.map((s) => ({ x: s.x, y: s.z * FLAT, rx: s.rx, ry: s.rz * FLAT, k: ease(g, s.at, s.at + 0.14), seed: s.seed })).filter((s) => visible(s.k));
  return { branches, stones, glint: ease(g, 0.3, 0.8) };
}

/** Every painted point of the full-grown plant (for the box test). */
export function cystoseiraReach(plan: CystoseiraPlan): Pt[] {
  const pose = poseCystoseira(plan, 1);
  const pts: Pt[] = [];
  for (const b of pose.branches) {
    b.pts.forEach((q, i) => pts.push({ x: q.x, y: q.y - b.widths[i]! }, { x: q.x, y: q.y + b.widths[i]! }));
    if (b.fertile) pts.push({ x: b.fertile.at.x - 2, y: b.fertile.at.y - 2 }, { x: b.fertile.at.x + 2, y: b.fertile.at.y + 2 });
  }
  for (const s of pose.stones) pts.push({ x: s.x - s.rx, y: s.y - s.ry }, { x: s.x + s.rx, y: s.y + s.ry * 1.4 });
  return pts;
}

type Area = { x: number; y: number; w: number; h: number };

/** How far a mark sinks into the sea's colour: low branches are deepest, a high tip barely tinted. */
const underWater = (pigment: Pigment, lift: number) => mix(mix(pigment, SEA, lerp(0.27, 0.14, lift)), PIGMENTS.stone, 0.05);

const toneColour = (tone: number, level: number): Pigment => {
  const base = level === 0 ? BROWN : level === 1 ? mix(BROWN, OLIVE, 0.6) : mix(OLIVE, GOLD, tone);
  return mix(base, AMBER, 0.26 * tone);
};

function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.12): Pt[] {
  const pts: Pt[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 1 + Math.sin(a * 2 + seed) * wob + Math.sin(a * 3 + seed * 1.7) * wob * 0.5;
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return pts;
}

/** A fine spine or a cylindrical branch: a ribbon that ends in a hair. */
const band = (pts: Pt[], widths: number[], f = 1, dy = 0): Pt[] | null => {
  const n = pts.length - 1;
  if (n < 1) return null;
  const moved = dy ? pts.map((q) => ({ x: q.x, y: q.y + dy })) : pts;
  return ribbon(moved, (t) => widths[Math.min(n, Math.round(t * n))]! * f);
};

function drawStones(p: Painter, pose: CystoseiraPose, area: Area) {
  if (!pose.stones.length) return;
  const L = p.layer(area);
  for (const s of pose.stones) {
    const sr = s.seed % 100;
    L.fill(blob(s.x + 1.5, s.y + s.ry * 0.5, s.rx * 1.05 * s.k, s.ry * 0.7 * s.k, sr), mix(PIGMENTS.shadow, SEA, 0.55), 0.18 * s.k);
    L.fill(blob(s.x, s.y, s.rx * s.k, s.ry * 1.1 * s.k, sr + 1), underWater(mix(PIGMENTS.stone, '#8f7a5e', 0.5), 0.1), 0.62 * s.k);
    L.fill(blob(s.x - s.rx * 0.2, s.y - s.ry * 0.3, s.rx * 0.6 * s.k, s.ry * 0.55 * s.k, sr + 2), underWater(mix(PIGMENTS.stone, '#c4b494', 0.5), 0.3), 0.4 * s.k);
    L.fill(blob(s.x + s.rx * 0.25, s.y + s.ry * 0.35, s.rx * 0.45 * s.k, s.ry * 0.4 * s.k, sr + 3), underWater(BROWN, 0.1), 0.35 * s.k);
    L.lift(blob(s.x - s.rx * 0.35, s.y - s.ry * 0.6, s.rx * 0.25 * s.k, s.ry * 0.2 * s.k, sr), 0.3);
  }
  L.dry({ opacity: 0.8, edge: 0.15, edgeWidth: 0.6, sharpness: 0.2, centreLift: 0.08, granulation: 0.55, flow: 0.4, flowScale: 8 });
}

/** The wet bloom of amber that the whole bush is first laid in. */
function drawBloom(p: Painter, pose: CystoseiraPose, area: Area) {
  const prim = pose.branches.filter((b) => b.level === 1 || b.level === 2);
  if (!prim.length) return;
  const L = p.layer(area);
  for (const b of prim) {
    const q = b.pts[b.pts.length - 1]!;
    const o = b.pts[0]!;
    const c = { x: lerp(o.x, q.x, 0.72), y: lerp(o.y, q.y, 0.72) };
    const r = (b.level === 1 ? 8.5 : 4.8) * smooth(b.k * 2);
    const sd = b.seed % 50;
    L.fill(blob(c.x, c.y, r * 1.1, r * 0.85, sd, 0.2), underWater(mix(AMBER, GOLD, 0.3 + 0.4 * b.tone), b.lift), b.level === 1 ? 0.14 : 0.11);
    L.fill(blob(c.x + 1, c.y - 1, r * 0.7, r * 0.55, sd + 1, 0.2), underWater(mix(OLIVE, AMBER, 0.45), b.lift), 0.09);
  }
  L.dry({ opacity: 0.85, edge: 0.3, edgeWidth: 1.6, sharpness: 0.1, centreLift: 0.1, granulation: 0.4, flow: 0.6, flowScale: 12, darken: 0.15 });
}

function drawBranches(p: Painter, pose: CystoseiraPose, area: Area) {
  for (const back of [true, false]) {
    const L = p.layer(area);
    let any = false;
    const cool = back ? 0.1 : 0;
    const order = pose.branches.filter((b) => b.back === back).sort((a, b) => a.level - b.level);
    for (const b of order) {
      const body = band(b.pts, b.widths);
      if (!body) continue;
      any = true;
      const col = mix(underWater(toneColour(b.tone, b.level), b.lift), SEA, cool);
      L.fill(body, col, b.level === 3 ? 0.62 : 0.78);
      if (b.level === 0) {
        const sh = band(b.pts, b.widths, 0.45, -0.5);
        if (sh) L.lift(sh, 0.22);
      }
      // the finest tip, paler and golden
      if (b.level >= 2) {
        const m = b.pts.length - 1;
        const from = Math.max(0, m - 1);
        const t = band(b.pts.slice(from), b.widths.slice(from), 1.1);
        if (t) L.fill(t, underWater(mix(TIP, AMBER, 0.2), b.lift), 0.4);
      }
      // the blue-green sheen on the upper edge where the light catches it
      if (b.level === 1 || b.level === 2) {
        const sh = band(b.pts, b.widths, 0.38, -0.5);
        if (sh) L.fill(sh, mix(SHEEN, AQUA, 0.2), 0.2 + 0.12 * b.lift);
      }
    }
    if (!any) {
      L.discard();
      continue;
    }
    L.dry({ opacity: back ? 0.56 : 0.7, edge: 0.14, edgeWidth: 0.35, sharpness: back ? 0.2 : 0.34, centreLift: 0.05, granulation: 0.2, flow: 0.3, flowScale: 6, darken: 0.18 });
  }
}

/** Bladders like small beads, swollen golden fertile tips and a few pale epiphytes. */
function drawDetail(p: Painter, plan: CystoseiraPlan, pose: CystoseiraPose, area: Area, near: number) {
  const D = p.layer(area);
  let any = false;
  for (const b of pose.branches) {
    for (const bl of b.bladders) {
      any = true;
      D.fill(blob(bl.at.x, bl.at.y, bl.r, bl.r * 0.9, b.seed % 30, 0.05), underWater(BEAD, b.lift), 0.78);
      D.fill(blob(bl.at.x + bl.r * 0.15, bl.at.y + bl.r * 0.3, bl.r * 0.7, bl.r * 0.5, 1, 0.05), underWater(OLIVE, b.lift), 0.3);
      D.lift(blob(bl.at.x - bl.r * 0.3, bl.at.y - bl.r * 0.35, bl.r * 0.35, bl.r * 0.28, 2, 0.05), 0.55);
    }
    const f = b.fertile;
    if (f) {
      any = true;
      const L = 2.5 * f.k;
      const W = 0.62 * f.k;
      const c = Math.cos(f.dir);
      const s = Math.sin(f.dir);
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const w = W * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8;
        pts.push({ x: f.at.x + c * (u * L - 0.4) - s * w, y: f.at.y + s * (u * L - 0.4) + c * w });
      }
      for (let i = 8; i >= 0; i--) {
        const u = i / 8;
        const w = W * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8;
        pts.push({ x: f.at.x + c * (u * L - 0.4) + s * w, y: f.at.y + s * (u * L - 0.4) - c * w });
      }
      D.fill(pts, underWater(mix(TIP, AMBER, 0.3), b.lift * 0.8), 0.5 * f.k);
      D.lift(blob(f.at.x + c * L * 0.4, f.at.y + s * L * 0.4 - 0.3, L * 0.22, W * 0.3, 3, 0.05), 0.4 * f.k);
    }
    if (near > 0.05 && b.fleck) D.fill(blob(b.fleck.x, b.fleck.y, 0.9, 0.55, b.seed % 20, 0.1), underWater(EPI, b.lift), 0.55 * near);
  }
  if (!any) {
    D.discard();
    return;
  }
  for (const gl of plan.glints) D.lift(lens(gl), 0.3 * pose.glint);
  D.dry({ opacity: 0.8, edge: 0.3, edgeWidth: 0.35, sharpness: 0.4, centreLift: 0.05, granulation: 0.1, flow: 0.3, flowScale: 5 });
}

function lens(gl: CystoseiraPlan['glints'][number]): Pt[] {
  const pts: Pt[] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y - Math.sin((i / N) * Math.PI) * 0.4 });
  for (let i = N; i >= 0; i--) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y + Math.sin((i / N) * Math.PI) * 0.25 });
  return pts;
}

const cystoseira: SpeciesDef = {
  id: 'cystoseira',
  name: 'Cystoseira',
  nativeName: 'Cystoseira',
  nativeLang: 'la',
  // a canopy alga of rocky Mediterranean shores: clear shallows and rock pools, wild only
  range: { realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] },
  tier: 2,
  habitats: ['water'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Cystoseira — a golden sea bush on a stone in clear water.',
  bloomColor: '#b9a35a',
  pollinators: false,
  // under the water: the low sun leaves no warm rim on it
  rimLight: false,
  draw(p, rng, opts) {
    const plan = planCystoseira(rng.fork('plan'));
    const pose = poseCystoseira(plan, opts.growth);
    const near = smooth((opts.w / BOX.w - 1.5) / 3);
    const end = plantFrame(p, this, opts);
    try {
      const area = { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h };
      drawStones(p, pose, area);
      drawBloom(p, pose, area);
      drawBranches(p, pose, area);
      drawDetail(p, plan, pose, area, near);
    } finally {
      end();
    }
  },
};

export default cystoseira;
