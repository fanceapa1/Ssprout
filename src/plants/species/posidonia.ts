import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbon } from '../lib/baikamo-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import type { SpeciesDef } from '../types';

/**
 * Posidonia (Posidonia oceanica): a meadow of long flat ribbon leaves under clear shallow water,
 * all combed one way by the swell over a pale sand patch, olive-brown at the old tips, a few
 * tips lying at the surface. Seen from the cliff through turquoise water.
 */

const LEAF = '#5f9a78';
const DEEP = '#3f7a62';
const YOUNG = mix(LEAF, '#8fbf6a', 0.45);
const TIP = mix('#8d7a45', PIGMENTS.olive, 0.35);
const DEAD = '#8a6b47';
/** The coast's turquoise and aqua, mixed into whatever lies under the water. */
const SEA = '#19a5ad';
const AQUA = '#8fd8cc';
const SAND = '#e6d6b0';
const BALL = '#8c6a48';

/** Vertical squash of the sea bed, seen from the cliff. */
const FLAT = 0.42;
/** How much of a leaf's rise shows on screen. */
const RISE = 0.62;
/** The water's depth over the meadow, in plant units: a leaf that reaches it lies along the surface. */
const SURFACE = 34;
const BOX = { w: 200, h: 110, ax: 0.42, ay: 0.64 };
const STEPS = 14;

interface Leaf {
  id: string;
  /** azimuth off the swell (signed) */
  az: number;
  len: number;
  width: number;
  /** elevation where it leaves the shoot and at its tip */
  e0: number;
  e1: number;
  sway: number;
  phase: number;
  twist: number;
  tone: Pigment;
  /** the brown share of an old leaf's length (0: a young leaf) */
  brown: number;
  /** pale epiphyte flecks: where along the leaf, and which side */
  flecks: { s: number; side: number; r: number }[];
  /** when it unrolls, within the shoot's window */
  at: number;
}

interface Shoot {
  id: string;
  x: number;
  z: number;
  window: [number, number];
  leaves: Leaf[];
}

export interface PosidoniaPlan {
  /** the swell's direction on the bed (radians, 0 = +x) */
  drift: number;
  shoots: Shoot[];
  sand: { rx: number; rz: number; x: number; seed: number };
  balls: { id: string; x: number; z: number; r: number; seed: number; at: number }[];
  dead: { id: string; x: number; z: number; a: number; len: number; width: number; bend: number; at: number }[];
  bubbles: { id: string; x: number; y: number; r: number; at: number }[];
  bloom: { kind: 'flower' | 'fruit' | null; shoot: number; seed: number };
  glints: { y: number; x0: number; x1: number; h: number }[];
}

export function planPosidonia(rng: Rng): PosidoniaPlan {
  const drift = rng.range(-0.08, 0.16);
  const rx = rng.range(54, 64);
  const rz = rng.range(22, 30);
  const n = rng.int(26, 32);
  const shoots: Shoot[] = [];
  for (let i = 0; i < n; i++) {
    // denser at the heart, a ragged edge where the meadow meets the sand
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * rng.range(0.75, 1);
    const x = Math.cos(a) * rx * d - 8;
    const z = Math.sin(a) * rz * d;
    const edge = d;
    const leaves: Leaf[] = [];
    const nl = rng.int(5, 7);
    for (let j = 0; j < nl; j++) {
      const age = j / (nl - 1);
      const len = rng.range(26, 60) * lerp(1, 0.62, edge * edge) * lerp(0.72, 1, age);
      leaves.push({
        id: `s${i}l${j}`,
        az: rng.gaussian(0, 0.22),
        len,
        width: rng.range(1.3, 1.7),
        e0: rng.range(1.1, 1.5),
        e1: rng.range(0.05, 0.6),
        sway: rng.range(0.8, 2.2),
        phase: rng.range(0, Math.PI * 2),
        twist: rng.range(0.08, 0.16),
        tone: jitter(mix(LEAF, DEEP, rng.range(0, 0.55)), rng, 0.03),
        brown: age > 0.5 ? rng.range(0.12, 0.34) : rng.chance(0.3) ? rng.range(0.04, 0.12) : 0,
        flecks: age > 0.5 ? Array.from({ length: rng.int(2, 5) }, () => ({ s: rng.range(0.35, 0.85), side: rng.chance(0.5) ? 1 : -1, r: rng.range(0.35, 0.7) })) : [],
        at: rng.range(0, 0.35) + (1 - age) * 0.3,
      });
    }
    shoots.push({ id: `s${i}`, x, z, window: [0, 0], leaves });
  }
  // the heart first, then the meadow creeps out over the sand
  const order = shoots.map((s, i) => ({ i, d: Math.hypot((s.x + 8) / rx, s.z / rz) + rng.range(0, 0.25) })).sort((a, b) => a.d - b.d);
  order.forEach(({ i }, k) => {
    shoots[i]!.window = [...stagger(k, n, [0.02, 0.86], 0.45)] as [number, number];
  });
  const balls = Array.from({ length: rng.int(1, 2) }, (_, b) => {
    const side = rng.chance(0.65) ? 1 : -1;
    return { id: `ball${b}`, x: side * rng.range(rx * 0.7, rx * 1.02) + 4, z: rng.range(-rz * 0.2, rz * 1.1), r: rng.range(2.4, 3.6), seed: rng.int(1, 1e9), at: rng.range(0.62, 0.8) };
  });
  const dead = Array.from({ length: rng.int(2, 4) }, (_, k) => ({
    id: `dead${k}`,
    x: (k % 2 ? 1 : -1) * rng.range(rx * 0.3, rx * 1.05),
    z: rng.range(-rz * 0.4, rz * 1.2),
    a: drift + rng.gaussian(0, 0.5),
    len: rng.range(12, 22),
    width: rng.range(0.9, 1.2),
    bend: rng.range(-0.25, 0.25),
    at: rng.range(0.55, 0.8),
  }));
  const bubbles = Array.from({ length: rng.int(4, 7) }, (_, k) => ({ id: `bub${k}`, x: rng.range(-30, 50), y: rng.range(-40, -16), r: rng.range(0.6, 1.2), at: rng.range(0.4, 0.9) }));
  const roll = rng.next();
  const bloom = { kind: roll < 0.3 ? ('flower' as const) : roll < 0.55 ? ('fruit' as const) : null, shoot: rng.int(0, Math.min(5, n - 1)), seed: rng.int(1, 1e9) };
  const glints = Array.from({ length: rng.int(4, 6) }, () => {
    const x0 = rng.range(-70, 50);
    return { y: rng.range(-44, -14), x0, x1: x0 + rng.range(18, 44), h: rng.range(0.3, 0.6) };
  });
  return { drift, shoots, sand: { rx: rx + 10, rz: rz + 8, x: -2, seed: rng.int(1, 1e9) }, balls, dead, bubbles, bloom, glints };
}

/** A point on the bed (x along the shore, z toward the viewer) raised by h, to the sprite. */
const project = (x: number, z: number, h: number): Pt => ({ x, y: z * FLAT - h * RISE });

export interface LeafPose {
  id: string;
  pts: Pt[];
  /** half-width at each point */
  widths: number[];
  tone: Pigment;
  brown: number;
  /** 0 = on the bed … 1 = at the surface, for the leaf's upper half */
  lift: number;
  /** the index from which it lies along the surface (pts.length when it does not reach it) */
  surfaceFrom: number;
  /** behind the meadow's middle line */
  back: boolean;
  flecks: Leaf['flecks'];
  age: number;
}

export interface PosidoniaPose {
  leaves: LeafPose[];
  sand: number;
  balls: { id: string; at: Pt; r: number; k: number; seed: number }[];
  dead: { id: string; pts: Pt[]; width: number; k: number }[];
  bubbles: { id: string; at: Pt; r: number; k: number }[];
  bloom: { kind: 'flower' | 'fruit'; at: Pt; k: number; seed: number } | null;
  glint: number;
}

function leafPose(plan: PosidoniaPlan, sh: Shoot, lf: Leaf, g: number): LeafPose | null {
  const k = ease(g, lerp(sh.window[0], sh.window[1], lf.at * 0.6), sh.window[1]);
  if (!visible(k)) return null;
  const len = lf.len * k * (1.6 - 0.6 * k);
  // a young leaf stands up; grown, the swell lays it over
  const e1 = lerp(lf.e0, lf.e1, smooth(k * 1.2));
  const az = plan.drift + lf.az;
  let x = sh.x;
  let z = sh.z;
  let h = 0;
  const pts: Pt[] = [project(x, z, 0)];
  const widths: number[] = [];
  let surfaceFrom = STEPS + 1;
  const ds = len / STEPS;
  for (let i = 1; i <= STEPS; i++) {
    const u = i / STEPS;
    let e = lerp(lf.e0, e1, u ** 1.3);
    if (h >= SURFACE - 0.5) {
      e = 0;
      if (surfaceFrom > STEPS) surfaceFrom = i - 1;
    }
    const a = az + Math.sin(u * 3.2 + lf.phase) * 0.12 * u;
    const lat = Math.sin(u * 4 + lf.phase) * lf.sway * u * 0.12;
    x += Math.cos(e) * Math.cos(a) * ds - Math.sin(a) * lat;
    z += Math.cos(e) * Math.sin(a) * ds + Math.cos(a) * lat;
    h = Math.min(SURFACE, h + Math.sin(e) * ds);
    pts.push(project(x, z, h));
  }
  const grow = smooth(k * 2);
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS;
    // a flat ribbon turning in the water: wide, then edge-on, then wide again; a rounded tip
    const turn = 0.45 + 0.55 * Math.abs(Math.cos(u * lf.len * lf.twist + lf.phase));
    const tip = lerp(1, 0.7, smooth((u - 0.8) / 0.2));
    widths.push(lf.width * turn * tip * lerp(0.55, 1, smooth(u * 5)) * grow);
  }
  return {
    id: lf.id,
    pts,
    widths,
    tone: lf.tone,
    brown: lf.brown * ease(g, 0.45, 1),
    lift: clamp01(h / SURFACE),
    surfaceFrom: Math.min(surfaceFrom, pts.length),
    back: sh.z < 0,
    flecks: lf.flecks,
    age: ease(g, 0.55, 1),
  };
}

/** Every mark of the plant at growth g: a pure function, so a session's frames match. */
export function posePosidonia(plan: PosidoniaPlan, g: number): PosidoniaPose {
  const leaves: LeafPose[] = [];
  for (const sh of plan.shoots) for (const lf of sh.leaves) {
    const l = leafPose(plan, sh, lf, g);
    if (l) leaves.push(l);
  }
  const balls = plan.balls.map((b) => ({ id: b.id, at: project(b.x, b.z, 0), r: b.r, k: ease(g, b.at, b.at + 0.18), seed: b.seed })).filter((b) => visible(b.k));
  const dead = plan.dead
    .map((d) => {
      const k = ease(g, d.at, d.at + 0.2);
      const pts: Pt[] = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const a = d.a + d.bend * u * 2;
        pts.push(project(d.x + Math.cos(a) * d.len * u * k, d.z + Math.sin(a) * d.len * u * k, 0.2));
      }
      return { id: d.id, pts, width: d.width * k, k };
    })
    .filter((d) => visible(d.k));
  const bubbles = plan.bubbles.map((b) => ({ id: b.id, at: { x: b.x, y: b.y }, r: b.r, k: ease(g, b.at, b.at + 0.1) })).filter((b) => visible(b.k));
  let bloom: PosidoniaPose['bloom'] = null;
  if (plan.bloom.kind) {
    const k = ease(g, 0.88, 1);
    const sh = plan.shoots[plan.bloom.shoot]!;
    if (visible(k)) bloom = { kind: plan.bloom.kind, at: project(sh.x + 6, sh.z, plan.bloom.kind === 'fruit' ? SURFACE : 14), k, seed: plan.bloom.seed };
  }
  return { leaves, sand: ease(g, 0, 0.12), balls, dead, bubbles, bloom, glint: ease(g, 0.3, 0.8) };
}

/** Every painted point of the full-grown plant (for the box test). */
export function posidoniaReach(plan: PosidoniaPlan): Pt[] {
  const pose = posePosidonia(plan, 1);
  const pts: Pt[] = [];
  for (const l of pose.leaves) l.pts.forEach((q, i) => pts.push({ x: q.x, y: q.y - l.widths[i]! }, { x: q.x, y: q.y + l.widths[i]! }));
  for (const d of pose.dead) pts.push(...d.pts);
  for (const b of pose.balls) pts.push({ x: b.at.x - b.r, y: b.at.y - b.r }, { x: b.at.x + b.r, y: b.at.y + b.r });
  const s = plan.sand;
  pts.push({ x: s.x - s.rx, y: 0 }, { x: s.x + s.rx, y: 0 }, { x: 0, y: s.rz * FLAT }, { x: 0, y: -s.rz * FLAT });
  return pts;
}

const sub = (l: LeafPose, from: number, to: number) => ({ pts: l.pts.slice(from, to + 1), widths: l.widths.slice(from, to + 1) });

/** A ribbon round `pts` ending in a rounded cap, as a seagrass leaf does. */
function band(pts: Pt[], widths: number[], f = 1, dx = 0, dy = 0): Pt[] | null {
  if (pts.length < 2) return null;
  const n = pts.length - 1;
  const moved = pts.map((q) => ({ x: q.x + dx, y: q.y + dy }));
  const poly = ribbon(moved, (t) => widths[Math.min(n, Math.round(t * n))]! * f);
  if (!poly) return null;
  const tip = moved[n]!;
  const prev = moved[n - 1]!;
  const fwd = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const w = widths[n]! * f;
  const cap: Pt[] = [];
  for (let i = 1; i < 6; i++) {
    const a = fwd + Math.PI / 2 - (i / 6) * Math.PI;
    cap.push({ x: tip.x + Math.cos(a) * w, y: tip.y + Math.sin(a) * w });
  }
  poly.splice(n + 1, 0, ...cap);
  return poly;
}

/** How far a mark sinks into the sea's colour: the bed is deepest, the surface barely tinted. */
const underWater = (pigment: Pigment, lift: number) => mix(mix(pigment, SEA, lerp(0.46, 0.22, lift)), PIGMENTS.stone, 0.08);

function drawBed(p: Painter, rng: Rng, plan: PosidoniaPlan, pose: PosidoniaPose, area: { x: number; y: number; w: number; h: number }) {
  const s = plan.sand;
  const k = pose.sand;
  if (!visible(k)) return;
  const sr = createRng(s.seed);
  // a pale window of sand, its edge broken by ripples of the bed
  const B = p.layer(area);
  const N = 24;
  const wob = Array.from({ length: N }, () => sr.range(-0.08, 0.08));
  // nested rings, so the window's edge fades into the sea instead of ending
  for (const f of [1, 0.86, 0.7]) {
    const pts: Pt[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = (1 + wob[i]!) * f * lerp(0.4, 1, k);
      pts.push(project(s.x + Math.cos(a) * s.rx * r, Math.sin(a) * s.rz * r, 0));
    }
    B.fill(pts, mix(SAND, AQUA, 0.2), 0.2 * k);
  }
  for (let i = 0; i < 5; i++) {
    const y = sr.range(-0.8, 0.8) * s.rz * FLAT;
    const x0 = s.x + sr.range(-0.8, 0.2) * s.rx;
    const w = sr.range(20, 40);
    B.fill([{ x: x0, y }, { x: x0 + w * 0.5, y: y - 0.7 }, { x: x0 + w, y }, { x: x0 + w * 0.5, y: y + 0.5 }], mix(SAND, '#ffffff', 0.3), 0.3 * k);
  }
  // the meadow's shade on the sand under it, one soft pool per shoot
  const seen = new Set<string>();
  for (const l of pose.leaves) {
    const id = l.id.split('l')[0]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const b = l.pts[0]!;
    const r = l.widths[3]! / 1.5;
    B.fill(blobAt(b.x + 6, b.y + 1.2, 14 * r, 4 * r), mix(PIGMENTS.shadow, SEA, 0.5), 0.07);
  }
  B.dry({ opacity: 0.5, edge: 0.06, edgeWidth: 2, sharpness: 0.05, centreLift: 0.1, granulation: 0.45, flow: 0.5, flowScale: 14 });
  // dead leaves and sea balls cast up beside the meadow
  if (pose.dead.length || pose.balls.length) {
    const D = p.layer(area);
    for (const d of pose.dead) {
      const poly = band(d.pts, d.pts.map((_, i) => d.width * lerp(0.8, 1, Math.sin((i / 6) * Math.PI))));
      if (poly) D.fill(poly, underWater(DEAD, 0.4), 0.7 * d.k);
    }
    for (const b of pose.balls) {
      const br = createRng(b.seed);
      D.fill(blobAt(b.at.x + 0.6, b.at.y + 0.9, b.r * 1.2 * b.k, b.r * 0.45 * b.k), mix(PIGMENTS.shadow, SEA, 0.4), 0.3 * b.k);
      D.fill(blobAt(b.at.x, b.at.y - b.r * 0.4, b.r * b.k, b.r * 0.8 * b.k), underWater(BALL, 0.35), 0.8 * b.k);
      // its felt of fibres
      for (let i = 0; i < 8; i++) {
        const a = br.range(0, Math.PI * 2);
        const r0 = br.range(0.2, 0.9) * b.r * b.k;
        const c = { x: b.at.x + Math.cos(a) * r0, y: b.at.y - b.r * 0.4 + Math.sin(a) * r0 * 0.8 };
        const t = br.range(0, Math.PI);
        const L = br.range(0.6, 1.4) * b.k;
        D.fill([{ x: c.x - Math.cos(t) * L, y: c.y - Math.sin(t) * L }, { x: c.x + 0.15, y: c.y + 0.15 }, { x: c.x + Math.cos(t) * L, y: c.y + Math.sin(t) * L }], mix(BALL, '#5a4030', 0.4), 0.5 * b.k);
      }
      D.lift(blobAt(b.at.x - b.r * 0.3, b.at.y - b.r * 0.75, b.r * 0.4 * b.k, b.r * 0.25 * b.k), 0.4);
    }
    D.dry({ opacity: 0.7, edge: 0.2, edgeWidth: 0.5, sharpness: 0.25, centreLift: 0.05, granulation: 0.3, flow: 0.4, flowScale: 8 });
  }
}

function blobAt(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function drawLeaves(p: Painter, plan: PosidoniaPlan, pose: PosidoniaPose, area: { x: number; y: number; w: number; h: number }, near: number) {
  // the far half of the meadow first, cooler and softer; the near half over it
  for (const back of [true, false]) {
    const L = p.layer(area);
    let any = false;
    for (const l of pose.leaves) {
      if (l.back !== back) continue;
      any = true;
      const n = l.pts.length - 1;
      const mid = Math.max(1, Math.round(n * 0.45));
      const low = sub(l, 0, mid);
      const cool = back ? 0.1 : 0;
      // water blurs each ribbon: a faint doubled copy just below it
      const halo = band(l.pts, l.widths, 1.25, 0.35, 0.6);
      if (halo) L.fill(halo, mix(underWater(DEEP, 0), SEA, cool), 0.16);
      const body = band(l.pts, l.widths);
      if (body) L.fill(body, mix(underWater(l.tone, l.lift * 0.6), SEA, cool), 0.76);
      // the deep foot of the leaf, bluer and darker
      const foot = band(low.pts, low.widths);
      if (foot) L.fill(foot, mix(underWater(DEEP, 0), SEA, cool), 0.4);
      // young green toward the tip of a leaf in its first season
      if (l.brown < 0.05) {
        const up = sub(l, mid, n);
        const fresh = band(up.pts, up.widths);
        if (fresh) L.fill(fresh, mix(underWater(YOUNG, l.lift), SEA, cool), 0.32);
      }
      // the old tips go olive and brown
      if (l.brown > 0.01) {
        const from = Math.max(1, Math.floor(n * (1 - l.brown)));
        const t = sub(l, from, n);
        const tip = band(t.pts, t.widths);
        if (tip) L.fill(tip, underWater(TIP, l.lift), lerp(0.18, 0.48, l.age));
      }
      // light caught along one edge of the ribbon, lifted out wet
      const hi = sub(l, Math.round(n * 0.25), Math.round(n * 0.8));
      const sheen = band(hi.pts, hi.widths, 0.4, 0, -0.45);
      if (sheen) L.lift(sheen, 0.35 + 0.2 * l.lift);
      // pale flecks of epiphytes on the old leaves, seen close
      if (near > 0.05 && l.age > 0.05) {
        for (const f of l.flecks) {
          const i = Math.min(n, Math.round(f.s * n));
          const q = l.pts[i]!;
          const w = l.widths[i]!;
          L.lift(blobAt(q.x, q.y + f.side * w * 0.4, f.r * w * 0.8, f.r * w * 0.5), 0.5 * near * l.age);
        }
      }
    }
    if (!any) {
      L.discard();
      continue;
    }
    // light on the surface lifts out of the leaves below it
    for (const gl of plan.glints) L.lift(lens(gl), 0.4 * pose.glint);
    L.dry({ opacity: back ? 0.62 : 0.74, edge: 0.18, edgeWidth: 0.4, sharpness: back ? 0.1 : 0.2, centreLift: 0.08, granulation: 0.2, flow: 0.45, flowScale: 9, darken: 0.2 });
  }
}

/** Leaf tips lying along the surface: warmer, crisper, catching the light. */
function drawSurface(p: Painter, pose: PosidoniaPose, area: { x: number; y: number; w: number; h: number }) {
  const floating = pose.leaves.filter((l) => l.surfaceFrom < l.pts.length - 1);
  if (!floating.length) return;
  const S = p.layer(area);
  for (const l of floating) {
    const t = sub(l, Math.max(0, l.surfaceFrom - 1), l.pts.length - 1);
    const poly = band(t.pts, t.widths, 1.05);
    if (!poly) continue;
    S.fill(poly, mix(mix(l.brown > 0.05 ? mix(TIP, l.tone, 0.6) : l.tone, '#c9c88a', 0.22), SEA, 0.15), 0.42);
    const top = band(t.pts, t.widths, 0.35, 0, -0.5);
    if (top) S.lift(top, 0.55);
  }
  S.dry({ opacity: 0.6, edge: 0.3, edgeWidth: 0.35, sharpness: 0.45, centreLift: 0.1, granulation: 0.1, flow: 0.3, flowScale: 6, darken: 0.2 });
}

function lens(gl: PosidoniaPlan['glints'][number]): Pt[] {
  const pts: Pt[] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y - Math.sin((i / N) * Math.PI) * gl.h });
  for (let i = N; i >= 0; i--) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y + Math.sin((i / N) * Math.PI) * gl.h * 0.6 });
  return pts;
}

function drawExtras(p: Painter, rng: Rng, pose: PosidoniaPose, near: number) {
  // small bubbles rising off the leaves, seen close
  if (near > 0.05) {
    for (const b of pose.bubbles) {
      const r = b.r * b.k;
      p.dab({ x: b.at.x, y: b.at.y + r }, mix(AQUA, '#ffffff', 0.6), { rng: rng.fork(b.id), variant: 'round', length: r * 2, width: r * 2, opacity: 0.55 * near * b.k, edge: 0.7, edgeWidth: 0.25, pool: 0, basePool: 0, layers: 1, blend: 'source-over' });
    }
  }
  const bl = pose.bloom;
  if (!bl) return;
  const r = rng.fork('bloom');
  if (bl.kind === 'flower') {
    // a short green spike of a few small pale flowers among the leaves
    const top = { x: bl.at.x + 1.5, y: bl.at.y - 9 * bl.k };
    p.stroke([bl.at, { x: bl.at.x + 0.8, y: bl.at.y - 4.5 * bl.k }, top], { rng: r.fork('stalk'), pigment: underWater('#7f9a5a', 0.4), width: 0.5 * bl.k, taper: [0.2, 0.4], wobble: 0.1, wetness: 0.3, opacity: 0.6, edge: 0.3 });
    for (let i = 0; i < 4; i++) {
      const u = 0.45 + i * 0.18;
      const at = { x: lerp(bl.at.x, top.x, u) + (i % 2 ? 1.1 : -1.1), y: lerp(bl.at.y, top.y, u) };
      p.dab(at, underWater('#c9cf86', 0.5), { rng: r.fork(`fl${i}`), variant: 'round', length: 1.8 * bl.k, width: 1.3 * bl.k, opacity: 0.7, edge: 0.3, layers: 2 });
    }
  } else {
    // the olive-like fruit floating at the surface
    p.ripple({ x: bl.at.x, y: bl.at.y + 1.6 }, { rng: r.fork('ring'), width: 9 * bl.k, count: 1, squash: 0.3, opacity: 0.25 * bl.k, light: 0.4, lineWidth: 0.35 });
    p.dab(bl.at, mix('#7d8f45', PIGMENTS.olive, 0.4), { rng: r.fork('fruit'), variant: 'round', angle: 0.2, length: 3.4 * bl.k, width: 2.4 * bl.k, opacity: 0.85, edge: 0.45, layers: 3 });
    p.dab({ x: bl.at.x - 0.6, y: bl.at.y - 0.5 }, '#e8eccc', { rng: r.fork('shine'), variant: 'round', length: 0.9 * bl.k, width: 0.6 * bl.k, opacity: 0.7 * bl.k, edge: 0.1, layers: 1, blend: 'source-over' });
  }
}

const posidonia: SpeciesDef = {
  id: 'posidonia',
  name: 'Posidonia',
  nativeName: 'Poseidonia',
  nativeLang: 'el-Latn',
  // endemic to the Mediterranean sea: meadows on sand and rock in clear shallow water
  range: { realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] },
  tier: 3,
  habitats: ['water'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Posidonia — a sea meadow of green ribbons combed by the swell.',
  bloomColor: '#6fae8a',
  pollinators: false,
  // under the water: the low sun leaves no warm rim on the leaves
  rimLight: false,
  draw(p, rng, opts) {
    const plan = planPosidonia(rng.fork('plan'));
    const pose = posePosidonia(plan, opts.growth);
    // sprite px per unit: 1 at the overview, larger in a close view
    const near = smooth((opts.w / BOX.w - 1.5) / 3);
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      const area = { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h };
      drawBed(p, r.fork('bed'), plan, pose, area);
      drawLeaves(p, plan, pose, area, near);
      drawSurface(p, pose, area);
      drawExtras(p, r.fork('extras'), pose, near);
    } finally {
      end();
    }
  },
};

export default posidonia;
