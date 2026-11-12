import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth, stagger } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, seedAndShoot } from '../lib/shrub-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import { paintCanes, paintFallen, paintLeaflets, paintRoses, type CaneMark, type FallenPetal, type Leaflet, type Prickle, type Rose } from '../lib/damask-rose-paint';
import type { SpeciesDef } from '../types';

/**
 * Damask rose (Rosa × damascena): a loose mound of arching prickly canes, matte grey-green leaves
 * of five to seven toothed leaflets, and loose clusters of ruffled rose-pink cups and feathery buds.
 */

const LEAF = '#8ea064';
const UNDER = '#a3ab8f';
const CANE = '#7b6a4a';
const YOUNG = '#9c4f3e';
const PINK = '#e2899b';
const PALE = '#f2c0c8';
const DEEP = mix('#b8536d', PINK, 0.3);
const GOLD = '#d9a83a';
const SEPAL = mix('#7f9150', CANE, 0.2);

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };
/** canes stay this far inside the box, so their leaves and flowers clear the edges */
const REACH = { side: 74, up: 168, tipLow: -26 };

interface LeafPlan {
  t: number;
  side: 1 | -1;
  turn: number;
  /** rachis length */
  length: number;
  pairs: 2 | 3;
  leaflet: number;
  tone: Pigment;
  seed: number;
}

interface FlowerPlan {
  id: number;
  /** offset from the cluster's foot */
  dx: number;
  dy: number;
  radius: number;
  facing: number;
  squash: number;
  rot: number;
  eye: boolean;
  budAngle: number;
  petal: Pigment;
  bud: boolean;
  grow: [number, number];
  open: [number, number];
  seed: number;
}

interface Lateral {
  t: number;
  turn: number;
  length: number;
  leaves: LeafPlan[];
  flowers: FlowerPlan[];
}

interface Cane {
  plan: StemPlan;
  window: [number, number];
  width: number;
  band: 0 | 1 | 2;
  tone: Pigment;
  leaves: LeafPlan[];
  laterals: Lateral[];
  prickles: { t: number; side: 1 | -1; length: number; seed: number }[];
  seed: number;
}

export interface DamaskRose {
  canes: Cane[];
  flowers: FlowerPlan[];
  fallen: FallenPetal[];
  foot: number;
  seeds: { ground: number; sprout: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

function fits(plan: StemPlan): boolean {
  const pts = stemPoints(plan, 1, 1);
  const tip = pts[pts.length - 1]!;
  return pts.every((q) => Math.abs(q.x) <= REACH.side && q.y >= -REACH.up) && tip.y <= REACH.tipLow;
}

function leafPlan(rng: Rng, t: number, side: 1 | -1, size: number, green: Pigment): LeafPlan {
  return {
    t,
    side,
    turn: rng.range(0.55, 1.1),
    length: rng.range(13, 16) * size,
    pairs: rng.chance(0.55) ? 3 : 2,
    leaflet: rng.range(7, 8.4) * size,
    tone: jitter(mix(green, rng.chance(0.5) ? '#9aa38a' : lighten(green, 0.08), rng.range(0.15, 0.45)), rng, 0.025),
    seed: seedOf(rng),
  };
}

/** A loose cluster of three to five: a central flower opening first, others and buds around it. */
function clusterOf(rng: Rng, flowers: FlowerPlan[], dir: number): FlowerPlan[] {
  const out: FlowerPlan[] = [];
  const n = rng.int(3, 4);
  for (let i = 0; i < n; i++) {
    const centre = i === 0;
    const bud = !centre && (i === n - 1 || rng.chance(0.45));
    const a = centre ? dir : lerpAngle(dir, UP, 0.3) + (i % 2 ? 1 : -1) * rng.range(0.7, 1.2);
    const d = centre ? rng.range(3, 5) : bud ? rng.range(9, 12) : rng.range(13, 16);
    const f: FlowerPlan = {
      id: flowers.length,
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      radius: rng.range(8.4, 10) * (bud ? 0.72 : 1),
      facing: rng.range(-0.35, 0.35),
      squash: rng.range(0.55, 0.85),
      rot: rng.range(0, Math.PI * 2),
      eye: rng.chance(0.3),
      budAngle: lerpAngle(a, UP, 0.5) + rng.range(-0.25, 0.25),
      petal: jitter(mix(PINK, rng.chance(0.5) ? PALE : DEEP, rng.range(0, 0.3)), rng, 0.02),
      bud,
      grow: [0, 0],
      open: [0, 0],
      seed: seedOf(rng),
    };
    flowers.push(f);
    out.push(f);
  }
  return out;
}

export function buildDamaskRose(rng: Rng): DamaskRose {
  const n = rng.int(8, 10);
  const lean = rng.range(-0.08, 0.08);
  const foot = rng.range(-6, 6);
  const green = jitter(LEAF, rng, 0.02);
  const canes: Cane[] = [];
  const flowers: FlowerPlan[] = [];
  const placed: Pt[] = [];
  for (let i = 0; i < n; i++) {
    // inner canes rise tallest and arch over the crown, either way; outer ones bow out low
    const outer = clamp01((i / (n - 1)) * 0.95 + rng.range(-0.08, 0.1));
    const flip = outer < 0.35 && rng.chance(0.3);
    const side: 1 | -1 = (i % 2 ? 1 : -1) * (flip ? -1 : 1) as 1 | -1;
    const lift = outer < 0.35 ? -side * rng.range(0.15, 0.35) : 0;
    const length = lerp(205, 135, outer) * rng.range(0.92, 1.05);
    const tilt = side * lerp(0.05, 0.62, outer) + lift;
    const angle = UP + lean + tilt + rng.range(-0.05, 0.05);
    // every cane ends near level, its tip nodding a little below
    const bend = side * lerp(1.8, 1.95, outer) * rng.range(0.92, 1.06) - tilt;
    let plan = makeStem(rng, { base: { x: foot + (outer < 0.35 ? -side : side) * rng.range(1, 6), y: 0 }, length, angle, bend, segments: 16, tipBias: lerp(0.25, 0.1, outer), wobble: 0.02 });
    for (let k = 0; k < 24 && !fits(plan); k++) plan = { ...plan, length: plan.length * 0.95 };
    const start = 0.08 + 0.16 * (i / Math.max(1, n - 1)) + rng.range(-0.02, 0.02);
    const z = rng.next();
    const band = (z < 0.34 ? 0 : z < 0.67 ? 1 : 2) as 0 | 1 | 2;
    const tone = band === 0 ? mix(green, PIGMENTS.shadow, 0.12) : band === 2 ? lighten(green, 0.05) : green;
    // alternate compound leaves, smaller toward the tip
    const nLeaves = Math.round(plan.length / rng.range(9, 10.5));
    const leaves: LeafPlan[] = [];
    let alt: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    for (let j = 0; j < nLeaves; j++) {
      const t = lerp(0.18, 0.96, (j + rng.range(-0.25, 0.25)) / Math.max(1, nLeaves - 1));
      const size = (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * lerp(1, 0.6, smooth((t - 0.75) / 0.25));
      leaves.push(leafPlan(rng, t, alt, size, tone));
      alt = -alt as 1 | -1;
    }
    // flowering laterals along the upper arch, and one at the tip of most canes
    const full = stemPoints(plan, 1, 1);
    const laterals: Lateral[] = [];
    for (const [t, chance] of [
      [rng.range(0.82, 0.92), 0.9],
      [rng.range(0.48, 0.68), 0.55],
    ] as const) {
      const node = pointAt(full, t);
      const upSide: 1 | -1 = Math.cos(node.angle) >= 0 ? -1 : 1;
      const turn = upSide * rng.range(0.4, 0.9);
      const dir = lerpAngle(node.angle + turn, UP, 0.45);
      const len = rng.range(8, 14);
      const tip = { x: node.x + Math.cos(dir) * len, y: node.y + Math.sin(dir) * len };
      const leaf = leafPlan(rng, 0.5, upSide, 0.62, tone);
      const cluster = clusterOf(rng, [], dir);
      // clusters keep apart, so the mound reads as green dotted with cups
      if (!rng.chance(chance) || placed.some((q) => Math.hypot(q.x - tip.x, q.y - tip.y) < 27)) continue;
      placed.push(tip);
      for (const f of cluster) f.id = flowers.push(f) - 1;
      laterals.push({ t, turn, length: len, leaves: [leaf], flowers: cluster });
    }
    const prickles: Cane['prickles'] = [];
    const np = Math.round(plan.length / rng.range(8, 11));
    for (let j = 0; j < np; j++) prickles.push({ t: rng.range(0.05, 0.85), side: rng.chance(0.5) ? 1 : -1, length: rng.range(1.6, 2.4), seed: seedOf(rng) });
    canes.push({ plan, window: [start, start + rng.range(0.32, 0.38)], width: rng.range(1.45, 1.85), band, tone, leaves, laterals, prickles, seed: seedOf(rng) });
  }
  // buds form once the leaves are out; the central flower of each cluster opens first
  const order = flowers.map((f, i) => ({ i, key: rng.range(0, 0.3) + (f.dx * f.dx + f.dy * f.dy < 30 ? 0 : 0.25) })).sort((a, b) => a.key - b.key);
  order.forEach(({ i }, k) => {
    const f = flowers[i]!;
    f.grow = stagger(k, order.length, 0.5, 0.82, 0.4);
    f.open = f.bud ? [2, 3] : stagger(k, order.length, 0.7, 1, 0.42);
  });
  const fallen: FallenPetal[] = Array.from({ length: rng.int(4, 7) }, () => ({
    at: { x: foot + rng.range(-62, 62), y: rng.range(-1, 4) },
    rot: rng.range(-0.6, 0.6),
    size: rng.range(2.3, 3.2),
    seed: seedOf(rng),
  }));
  return { canes, flowers, fallen, foot, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface DamaskRosePose {
  canes: (CaneMark & { id: string; band: number })[];
  prickles: (Prickle & { id: string; band: number })[];
  leaves: (Leaflet & { id: string; band: number; group: number })[];
  flowers: (Rose & { id: string; band: number })[];
  fallen: number;
}

interface Grown {
  pts: Pt[];
  ext: number;
}

function growCane(c: Cane, g: number): Grown | null {
  const k = ramp(g, c.window[0], c.window[1]);
  if (k < 0.015) return null;
  // a young cane comes up nearly straight and arches over as it lengthens
  const ext = lerp(0.03, 1, k) * smooth(k * 5);
  return { pts: stemPoints(c.plan, ext, lerp(0.15, 1, smooth(k))), ext };
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

/** A compound leaf: the rachis as a fine stem, then leaflets in pairs and one at the tip. */
function compoundLeaf(pose: DamaskRosePose, l: LeafPlan, at: Pt, dir: number, k: number, band: number, id: string, seed: number): void {
  const e = 1 - (1 - k) ** 3;
  const angle = lerpAngle(dir, dir + l.side * l.turn, smooth(k));
  // the leaf droops a little at the tip, toward the ground
  const droop = Math.max(-1, Math.min(1, Math.cos(angle) * 3)) * 0.25 * k;
  const len = l.length * e;
  const rachis: Pt[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const a = angle + droop * t;
    const prev = rachis[i - 1] ?? at;
    rachis.push(i === 0 ? at : { x: prev.x + Math.cos(a) * (len / 4), y: prev.y + Math.sin(a) * (len / 4) });
  }
  pose.canes.push({ id: `${id}-r`, band, pts: rachis, width: 0.55 * e, pigment: mix(l.tone, CANE, 0.4), seed: seed + 3, taper: 0.4 });
  const ts = l.pairs === 3 ? [0.28, 0.58, 0.88] : [0.42, 0.82];
  const lit = (a: number) => (Math.sin(a) > 0 ? 1 : -1) as 1 | -1;
  ts.forEach((t, j) => {
    const q = pointAt(rachis, t);
    const size = lerp(0.78, 1, j / ts.length) * l.leaflet * e;
    for (const s of [1, -1] as const) {
      const a = q.angle + s * lerp(0.4, 1.05, smooth(k)) - s * 0.12;
      pose.leaves.push({ id: `${id}/p${j}${s > 0 ? "a" : "b"}`, band, group: j % 2, at: { x: q.x, y: q.y }, angle: a, length: size, width: size * 0.62, curve: s * 0.06, pigment: l.tone, under: UNDER, alpha: smooth(k * 4), shade: lit(a), seed: seed + 11 + j * 2 + (s > 0 ? 0 : 1) });
    }
  });
  const tip = rachis[4]!;
  const ta = pointAt(rachis, 1).angle;
  pose.leaves.push({ id: `${id}/t`, band, group: 1, at: tip, angle: ta, length: l.leaflet * 1.08 * e, width: l.leaflet * 0.66 * e, curve: 0, pigment: l.tone, under: UNDER, alpha: smooth(k * 4), shade: lit(ta), seed: seed + 29 });
}

export function poseDamaskRose(plant: DamaskRose, g: number): DamaskRosePose {
  const pose: DamaskRosePose = { canes: [], prickles: [], leaves: [], flowers: [], fallen: ramp(g, 0.93, 1) };
  plant.canes.forEach((c, i) => {
    const gs = growCane(c, g);
    if (!gs) return;
    const kc = ramp(g, c.window[0], Math.min(1, c.window[1] + 0.2));
    const thick = 0.45 + 0.55 * kc;
    pose.canes.push({ id: `cane-${i}`, band: c.band, pts: gs.pts, width: c.width * thick * smooth(gs.ext * 4), pigment: mix(CANE, c.tone, 0.35), seed: c.seed, flush: 1 - 0.6 * kc });
    c.prickles.forEach((pr, j) => {
      const k = smooth(clamp01((gs.ext - pr.t) / 0.2)) * kc;
      if (k < 0.02) return;
      const node = nodeAt(gs, pr.t);
      const w = c.width * thick * 0.5;
      const out = node.angle + pr.side * Math.PI * 0.5;
      // hooked back toward the foot of the cane
      pose.prickles.push({ id: `prickle-${i}-${j}`, band: c.band, at: { x: node.x + Math.cos(out) * w * 0.6, y: node.y + Math.sin(out) * w * 0.6 }, angle: out + pr.side * 0.55, length: pr.length * k, seed: pr.seed });
    });
    c.leaves.forEach((l, j) => {
      const k = smooth(clamp01((gs.ext - l.t * 0.7) / 0.45));
      if (k < 0.015) return;
      const node = nodeAt(gs, l.t);
      compoundLeaf(pose, l, { x: node.x, y: node.y }, node.angle, k, c.band, `leaf-${i}-${j}`, l.seed);
    });
    c.laterals.forEach((s, j) => {
      const first = Math.min(...s.flowers.map((f) => f.grow[0]));
      const k = smooth(clamp01((gs.ext - s.t) / 0.12)) * ramp(g, first - 0.16, first + 0.04);
      if (k < 0.015) return;
      const node = nodeAt(gs, s.t);
      const dir = lerpAngle(node.angle + s.turn, UP, 0.45);
      const tip = { x: node.x + Math.cos(dir) * s.length * k, y: node.y + Math.sin(dir) * s.length * k };
      pose.canes.push({ id: `lat-${i}-${j}`, band: c.band, pts: [node, { x: (node.x + tip.x) / 2, y: (node.y + tip.y) / 2 }, tip], width: 0.95 * k, pigment: mix(CANE, YOUNG, 0.4), seed: c.seed + 7 + j, taper: 0.3 });
      s.leaves.forEach((l, m) => compoundLeaf(pose, l, { x: lerp(node.x, tip.x, l.t), y: lerp(node.y, tip.y, l.t) }, dir, k, c.band, `lleaf-${i}-${j}-${m}`, l.seed));
      for (const f of s.flowers) {
        const kk = k * ramp(g, f.grow[0], f.grow[1]);
        if (kk < 0.012) continue;
        const open = ramp(g, f.open[0], f.open[1]);
        const at = { x: tip.x + f.dx * kk, y: tip.y + f.dy * kk };
        pose.canes.push({ id: `ped-${f.id}`, band: c.band, pts: [tip, { x: lerp(tip.x, at.x, 0.5), y: lerp(tip.y, at.y, 0.5) - 1.5 * kk }, at], width: 0.7 * kk, pigment: mix(SEPAL, YOUNG, 0.3), seed: f.seed + 5, taper: 0.3 });
        pose.flowers.push({ id: `flower-${f.id}`, band: c.band, at, radius: f.radius * kk, facing: f.facing, squash: f.squash, rot: f.rot + open * 0.3, open, eye: f.eye, budAngle: f.budAngle, petal: f.petal, alpha: smooth(kk * 4), seed: f.seed });
      }
    });
  });
  return pose;
}

const damaskRose: SpeciesDef = {
  id: 'damask-rose',
  name: 'Damask Rose',
  nativeName: 'Lward lbeldi',
  nativeLang: 'ary-Latn',
  // an old hybrid with no wild range, grown as hedges along the oasis plots
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 3,
  habitats: ['meadow', 'back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: "Damask rose — picked before the heat, a valley's scent in a sack.",
  bloomColor: PINK,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildDamaskRose(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, damaskRose, () => {
      groundShadow(p, plant.seeds.ground, g, plant.foot, 34, 5, 0.2);
      p.ctx.save();
      p.ctx.translate(plant.foot, 0);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 10, green: lighten(LEAF, 0.08), handover: 0.24 });
      p.ctx.restore();
      const pose = poseDamaskRose(plant, g);
      paintFallen(p, plant.fallen, pose.fallen, PINK, PALE);
      const roses = { petal: PINK, pale: PALE, deep: DEEP, gold: GOLD, sepal: SEPAL };
      for (const band of [0, 1, 2]) {
        const op = band === 0 ? 0.72 : 0.88;
        const canes = pose.canes.filter((c) => c.band === band);
        for (const group of [0, 1]) paintLeaflets(p, pose.leaves.filter((l) => l.band === band && l.group === group), { opacity: op * 0.95 }, group === 0 ? canes : []);
      }
      paintCanes(p, pose.canes, pose.prickles, { accent: mix(CANE, PIGMENTS.sumi, 0.2), young: YOUNG, prickle: mix(YOUNG, CANE, 0.4) });
      // the cups sit over the foliage: a leaf glazed over pink turns it brown
      paintRoses(p, pose.flowers, roses);
    });
  },
};

export default damaskRose;
