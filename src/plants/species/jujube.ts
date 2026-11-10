import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, seedAndShoot } from '../lib/shrub-paint';
import { UP } from '../lib/small-structure';
import { driftShape, paintDrift, paintHaze, paintFlorets, paintFruits, paintLeaves, paintStems, type Floret, type Fruit, type JujubeLeaf, type StemMark, type Thorn } from '../lib/jujube-paint';
import type { SpeciesDef } from '../types';

/**
 * Wild jujube (Ziziphus lotus): a low tangled mound of pale zigzag stems with paired thorns,
 * small glossy leaves, tiny green-gold flowers and many small round fruit ripening to red.
 */

const STEM = '#ada798';
const STEM_ACCENT = '#7d7568';
const THORN = '#8a6a50';
const LEAF = '#679a3a';
const LEAF_DEEP = '#3f6a2c';
const FLOWER = '#dccf5e';
const FLOWER_EYE = '#b39a34';
const SAND = '#e2c48e';
const HAZE = '#a7a196';
const FRUIT = { green: '#b3b14e', gold: '#dca23f', orange: '#dc7430', red: '#c9432b', rust: '#9a3527', stalk: '#7d6a4c' };

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };

interface NodePlan {
  /** index of the vertex on its branch (≥ 1) */
  idx: number;
  /** growth at which the branch tip passes this node */
  time: number;
  thorns: { angle: number; length: number; hooked: boolean; seed: number }[];
  leaves: { angle: number; length: number; width: number; tone: Pigment; seed: number }[];
  flower: { dx: number; dy: number; radius: number; rot: number; open: number; seed: number } | null;
  fruit: { dx: number; dy: number; radius: number; set: number; ripenAt: number; ripe: number; seed: number } | null;
}

interface Branch {
  order: 0 | 1 | 2;
  pts: Pt[];
  /** cumulative length at each vertex */
  dist: number[];
  window: [number, number];
  width: number;
  band: 0 | 1 | 2;
  nodes: NodePlan[];
  seed: number;
}

export interface Jujube {
  branches: Branch[];
  foot: number;
  dome: Dome;
  drift: { half: number; height: number; skew: number };
  seeds: { ground: number; sprout: number; drift: number; haze: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

type Dome = { w: number; h: number; lobes: number[] };

/** Inside the mound: a dome whose edge swells and dips in a few lobes, so the outline is ragged. */
function inDome(q: Pt, dome: Dome, foot: number, slack = 1): boolean {
  if (q.y > -3) return false;
  const nx = (q.x - foot * 0.5) / dome.w;
  const ny = q.y / dome.h;
  const th = Math.atan2(-ny, nx);
  const [a, b, c, p1, p2, p3] = dome.lobes as [number, number, number, number, number, number];
  const r = 1 + a * Math.sin(2 * th + p1) + b * Math.sin(3 * th + p2) + c * Math.sin(5 * th + p3);
  return Math.hypot(nx, ny) <= r * slack && Math.abs(nx) < 1.14;
}

/** A zigzag walk: each internode swings to the other side of the heading, which drifts. */
function zigzag(rng: Rng, start: Pt, angle: number, n: number, seg: number, drift: number, amp: number, dome: Dome, foot: number, slack = 1): Pt[] {
  const pts = [start];
  let a = angle;
  let s = rng.chance(0.5) ? 1 : -1;
  let at = start;
  for (let i = 0; i < n; i++) {
    const heading = a + s * amp * rng.range(0.75, 1.2);
    const len = seg * rng.range(0.8, 1.15);
    let next = { x: at.x + Math.cos(heading) * len, y: at.y + Math.sin(heading) * len };
    if (!inDome(next, dome, foot, slack)) {
      // steer back inside once, bending down and out like a branch that meets the mound's edge
      const back = heading + (Math.cos(heading) >= 0 ? 0.7 : -0.7);
      next = { x: at.x + Math.cos(back) * len * 0.8, y: at.y + Math.sin(back) * len * 0.8 };
      if (!inDome(next, dome, foot, slack)) break;
      a = back;
    }
    pts.push(next);
    at = next;
    s = -s;
    a += drift + rng.gaussian(0, 0.07);
  }
  return pts;
}

function cumulative(pts: Pt[]): number[] {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return d;
}

export function buildJujube(rng: Rng): Jujube {
  const dome: Dome = { w: rng.range(72, 78), h: rng.range(92, 112), lobes: [rng.range(0.06, 0.12), rng.range(0.04, 0.09), rng.range(0.03, 0.06), rng.range(0, 6.3), rng.range(0, 6.3), rng.range(0, 6.3)] };
  const foot = rng.range(-5, 5);
  const green = jitter(LEAF, rng, 0.02);
  const branches: Branch[] = [];

  const addBranch = (order: 0 | 1 | 2, pts: Pt[], window: [number, number], width: number, band: 0 | 1 | 2): Branch => {
    const b: Branch = { order, pts, dist: cumulative(pts), window, width, band, nodes: [], seed: seedOf(rng) };
    branches.push(b);
    return b;
  };
  const timeAt = (b: Branch, i: number) => lerp(b.window[0], b.window[1], b.dist[i]! / Math.max(1e-6, b.dist[b.dist.length - 1]!));

  const nMain = rng.int(11, 14);
  const mains: Branch[] = [];
  for (let i = 0; i < nMain; i++) {
    // fanned from one crown: the middle ones climb, the outer ones lean out and arch low
    const u = (i + rng.range(-0.3, 0.3)) / (nMain - 1) - 0.5;
    const angle = UP + u * 2.3 + rng.range(-0.08, 0.08);
    const drift = Math.sign(u || 0.01) * rng.range(0.06, 0.12) * Math.min(1, Math.abs(u) * 3);
    const base = { x: foot + u * rng.range(14, 26), y: 0 };
    const pts = zigzag(rng, base, angle, rng.int(12, 16), rng.range(7.5, 9.5), drift, rng.range(0.3, 0.4), dome, foot);
    const start = 0.07 + 0.12 * Math.abs(u) * 2 + rng.range(0, 0.04);
    const z = rng.next();
    mains.push(addBranch(0, pts, [start, start + rng.range(0.34, 0.42)], rng.range(2.1, 2.6), (z < 0.3 ? 0 : z < 0.65 ? 1 : 2) as 0 | 1 | 2));
  }
  // side branches from the nodes, on the outer side of each zig, and short spurs off them
  const sides: Branch[] = [];
  for (const m of mains) {
    for (let j = 2; j < m.pts.length - 1; j++) {
      if (!rng.chance(0.8)) continue;
      const a0 = Math.atan2(m.pts[j]!.y - m.pts[j - 1]!.y, m.pts[j]!.x - m.pts[j - 1]!.x);
      const a1 = Math.atan2(m.pts[j + 1]!.y - m.pts[j]!.y, m.pts[j + 1]!.x - m.pts[j]!.x);
      const outer = a1 - a0 > 0 ? -1 : 1;
      const angle = a0 + outer * rng.range(0.55, 1.05);
      const pts = zigzag(rng, m.pts[j]!, angle, rng.int(3, 7), rng.range(5.5, 7.5), rng.gaussian(0, 0.1), rng.range(0.32, 0.42), dome, foot, rng.chance(0.25) ? 1.12 : 1);
      if (pts.length < 3) continue;
      const t0 = timeAt(m, j) + 0.02;
      sides.push(addBranch(1, pts, [t0, t0 + rng.range(0.16, 0.24)], rng.range(1.3, 1.6), m.band));
    }
  }
  for (const s of sides) {
    for (let j = 1; j < s.pts.length - 1; j++) {
      if (!rng.chance(0.4)) continue;
      const a0 = Math.atan2(s.pts[j]!.y - s.pts[j - 1]!.y, s.pts[j]!.x - s.pts[j - 1]!.x);
      const pts = zigzag(rng, s.pts[j]!, a0 + (rng.chance(0.5) ? 1 : -1) * rng.range(0.6, 1.1), rng.int(1, 3), rng.range(4.5, 6), 0, 0.35, dome, foot);
      if (pts.length < 2) continue;
      const t0 = timeAt(s, j) + 0.02;
      addBranch(2, pts, [t0, t0 + rng.range(0.06, 0.1)], 0.9, s.band);
    }
  }
  // the nodes: thorns, leaf clusters, and on the outer twigs flowers that set fruit
  const top = Math.min(...branches.flatMap((b) => b.pts.map((q) => q.y)));
  for (const b of branches) {
    for (let i = 1; i < b.pts.length; i++) {
      const q = b.pts[i]!;
      const ain = Math.atan2(q.y - b.pts[i - 1]!.y, q.x - b.pts[i - 1]!.x);
      const side = i % 2 ? 1 : -1;
      const node: NodePlan = { idx: i, time: timeAt(b, i), thorns: [], leaves: [], flower: null, fruit: null };
      if (rng.chance(b.order === 2 ? 0.4 : 0.75)) {
        const tl = b.order === 0 ? rng.range(3.4, 4.8) : rng.range(2.4, 3.4);
        node.thorns.push({ angle: ain + side * rng.range(0.7, 1.0), length: tl, hooked: false, seed: seedOf(rng) });
        node.thorns.push({ angle: ain - side * rng.range(1.5, 1.9), length: tl * rng.range(0.45, 0.6), hooked: true, seed: seedOf(rng) });
      }
      const nl = b.order === 0 && i < 4 ? 0 : rng.chance(b.order === 0 ? 0.35 : 0.6) ? rng.int(1, 2) : 0;
      for (let k = 0; k < nl; k++) {
        const L = rng.range(4, 5.4) * (b.order === 2 ? 0.9 : 1);
        const tone = jitter(mix(green, rng.chance(0.4) ? LEAF_DEEP : lighten(green, 0.06), rng.range(0.1, 0.6)), rng, 0.025);
        node.leaves.push({ angle: ain + (k % 2 ? -1 : 1) * side * rng.range(0.5, 1.2), length: L, width: L * rng.range(0.56, 0.68), tone, seed: seedOf(rng) });
      }
      // fruit gathers on the outer, upper twigs where it shows
      const outerness = clamp01((Math.hypot((q.x - foot) / dome.w, q.y / dome.h) - 0.45) / 0.5);
      const chance = b.order === 0 ? 0.02 : (0.05 + 0.2 * outerness) * (q.y < top * 0.12 ? 1 : 0.35);
      const fruiting = rng.chance(chance) && !(b.order === 0 && i < 4);
      if (fruiting) {
        const hang = rng.range(-0.5, 0.5);
        const R = rng.range(2.2, 2.8);
        const d = R + rng.range(1, 2);
        const fruit = { dx: Math.sin(hang) * d, dy: Math.cos(hang) * d, radius: R, set: rng.range(0.74, 0.86), ripenAt: rng.range(0.82, 0.9), ripe: rng.chance(0.8) ? rng.range(0.6, 0.92) : rng.range(0.3, 0.55), seed: seedOf(rng) };
        node.fruit = fruit;
        node.flower = { dx: fruit.dx * 0.6, dy: fruit.dy * 0.6 - 1, radius: rng.range(2.2, 2.7), rot: rng.range(0, 1.3), open: rng.range(0.58, 0.7), seed: seedOf(rng) };
      } else if (b.order > 0 && rng.chance(0.3)) {
        node.flower = { dx: rng.range(-1.5, 1.5), dy: rng.range(1, 2.5), radius: rng.range(2, 2.5), rot: rng.range(0, 1.3), open: rng.range(0.58, 0.72), seed: seedOf(rng) };
      }
      b.nodes.push(node);
    }
  }
  return {
    branches,
    foot,
    dome,
    drift: { half: dome.w * rng.range(0.75, 0.9), height: rng.range(9, 13), skew: rng.range(-0.15, 0.15) },
    seeds: { ground: seedOf(rng), sprout: seedOf(rng), drift: seedOf(rng), haze: seedOf(rng) },
  };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface JujubePose {
  stems: (StemMark & { id: string; band: number })[];
  thorns: (Thorn & { id: string; band: number })[];
  leaves: (JujubeLeaf & { id: string; band: number })[];
  flowers: (Floret & { id: string })[];
  fruits: (Fruit & { id: string })[];
  drift: number;
}

/** The first `len` units of a polyline. */
function cut(pts: Pt[], dist: number[], len: number): Pt[] {
  const out = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    if (dist[i]! <= len) {
      out.push(pts[i]!);
      continue;
    }
    const k = (len - dist[i - 1]!) / (dist[i]! - dist[i - 1]!);
    if (k > 0) out.push({ x: lerp(pts[i - 1]!.x, pts[i]!.x, k), y: lerp(pts[i - 1]!.y, pts[i]!.y, k) });
    break;
  }
  return out;
}

export function poseJujube(plant: Jujube, g: number): JujubePose {
  const pose: JujubePose = { stems: [], thorns: [], leaves: [], flowers: [], fruits: [], drift: ramp(g, 0.18, 0.8) };
  plant.branches.forEach((b, bi) => {
    const total = b.dist[b.dist.length - 1]!;
    const k = clamp01((g - b.window[0]) / (b.window[1] - b.window[0]));
    const len = total * k;
    if (len < 0.4) return;
    const thick = 0.35 + 0.65 * ramp(g, b.window[0], Math.min(1, b.window[1] + 0.25));
    pose.stems.push({ id: `stem-${bi}`, band: b.band, pts: cut(b.pts, b.dist, len), width: b.width * thick * smooth(len / 6), pigment: STEM, seed: b.seed });
    for (const n of b.nodes) {
      const age = g - n.time;
      if (age <= 0) continue;
      const at = b.pts[n.idx]!;
      const kt = smooth(age / 0.06);
      n.thorns.forEach((t, j) => pose.thorns.push({ id: `thorn-${bi}-${n.idx}-${j}`, band: b.band, at, angle: t.angle, length: t.length * kt, hooked: t.hooked, seed: t.seed }));
      const kl = smooth(age / 0.1);
      n.leaves.forEach((l, j) => pose.leaves.push({ id: `leaf-${bi}-${n.idx}-${j}`, band: b.band, at, angle: l.angle, length: l.length * kl, width: l.width * kl, pigment: l.tone, alpha: smooth(kl * 3), seed: l.seed }));
      if (n.flower) {
        const f = n.flower;
        const open = ramp(g, Math.max(f.open, n.time + 0.04), Math.max(f.open, n.time + 0.04) + 0.07);
        const gone = n.fruit ? ramp(g, n.fruit.set + 0.02, n.fruit.set + 0.08) : ramp(g, 0.86, 0.94);
        const s = open * (1 - gone);
        if (s > 0.01) pose.flowers.push({ id: `flower-${bi}-${n.idx}`, at: { x: at.x + f.dx, y: at.y + f.dy }, radius: f.radius * s, rot: f.rot, alpha: smooth(s * 2), seed: f.seed });
      }
      if (n.fruit) {
        const f = n.fruit;
        const sw = ramp(g, f.set, f.set + 0.1);
        if (sw > 0.01) {
          const ripe = f.ripe * ramp(g, f.ripenAt, f.ripenAt + 0.12) + 0.05 * sw;
          pose.fruits.push({ id: `fruit-${bi}-${n.idx}`, at: { x: at.x + f.dx * sw, y: at.y + f.dy * sw }, from: at, radius: f.radius * sw, ripe: Math.min(1, ripe), alpha: smooth(sw * 3), seed: f.seed });
        }
      }
    }
  });
  return pose;
}

/** The mound's ragged outline, drawn in a little from its edge. */
function hazeOutline(plant: Jujube): Pt[] {
  const { dome, foot } = plant;
  const [a, b, c, p1, p2, p3] = dome.lobes as [number, number, number, number, number, number];
  const out: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const th = (i / 24) * Math.PI;
    const r = 0.82 * (1 + a * Math.sin(2 * th + p1) + b * Math.sin(3 * th + p2) + c * Math.sin(5 * th + p3));
    out.push({ x: foot * 0.5 + Math.cos(th) * r * dome.w, y: Math.min(-2, -Math.sin(th) * r * dome.h) });
  }
  return out;
}

const jujube: SpeciesDef = {
  id: 'jujube',
  name: 'Wild Jujube',
  nativeName: 'Sedra',
  nativeLang: 'ary-Latn',
  // wild on dry ground from the Sahara's edge round the Mediterranean's south and east
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'] },
  tier: 3,
  habitats: ['shore', 'back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Wild jujube — sweet red lotus fruit in a tangle of thorns.',
  bloomColor: FRUIT.red,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildJujube(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, jujube, () => {
      groundShadow(p, plant.seeds.ground, g, plant.foot + 6, plant.dome.w * 0.85, 7, 0.22);
      const pose = poseJujube(plant, g);
      const { half, height, skew } = plant.drift;
      paintDrift(p, plant.seeds.drift, driftShape(plant.foot, half, height * pose.drift, skew), plant.foot, half, pose.drift, SAND);
      p.ctx.save();
      p.ctx.translate(plant.foot, 0);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 10, green: lighten(LEAF, 0.08), handover: 0.22 });
      p.ctx.restore();
      paintHaze(p, plant.seeds.haze, hazeOutline(plant), ramp(g, 0.35, 0.8), HAZE);
      for (const band of [0, 1, 2]) {
        const op = band === 0 ? 0.75 : 0.9;
        paintStems(p, pose.stems.filter((s) => s.band === band), pose.thorns.filter((t) => t.band === band), { opacity: op, accent: STEM_ACCENT, thorn: THORN });
        paintLeaves(p, pose.leaves.filter((l) => l.band === band), { opacity: op });
      }
      paintFlorets(p, pose.flowers, FLOWER, FLOWER_EYE);
      paintFruits(p, pose.fruits, { ...FRUIT, green: mix(FRUIT.green, PIGMENTS.sap, 0.1) });
    });
  },
};

export default jujube;
