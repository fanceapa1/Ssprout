import { createRng, type Rng } from '../../core/rng';
import { mix, type Painter, type Pt } from '../../paint';
import {
  coilPath,
  flowerGeometry,
  leafGeometry,
  paintCapsules,
  paintFlowers,
  paintLeaves,
  paintStalks,
  type CapsuleMark,
  type FlowerMark,
  type LeafMark,
  type StalkMark,
} from '../lib/cyclamen-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { groundShadow, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Ivy-leaved cyclamen (Cyclamen hederifolium): a flat tuber under a low rosette of heart-shaped
 * leaves marbled dark green and silver, with a scatter of small pink flowers on thin, reddish,
 * hooked stalks, each hanging with its five petals swept back and up around a dark V mouth.
 */

const LEAF = '#4f7a58';
const LEAF_BLUE = '#436f60';
const LEAF_DEEP = '#2b4f3d';
const SILVER = '#c3cfc4';
const UNDER = '#9a5068';
const PETAL = '#e9a3bb';
const PETAL_TIP = '#f4c9d6';
const PETAL_BASE = '#cf6a96';
const THROAT = '#8e3a64';
const STALK = '#cf7d89';
const STALK_DEEP = '#a8606f';
const PETIOLE = '#9a8f6c';
const CAPSULE = '#b8ab7a';
const CAPSULE_DEEP = '#8a7a56';
const TUBER = '#8d7658';
const TUBER_DEEP = '#5c4a38';
const EARTH = '#a39078';
const SHADOW = '#6f8a78';

const ANCHOR = { x: 0.5, y: 0.8 };

interface LeafPlan {
  id: string;
  phi: number;
  dist: number;
  h: number;
  yaw: number;
  len: number;
  tilt: number;
  roll: number;
  zone: number;
  flecks: [number, number, number][];
  tone: number;
  window: [number, number];
  seed: number;
}

interface FlowerPlan {
  stalk: StemPlan;
  hook: number;
  window: number;
  size: number;
  spread: number;
  petals: { twist: number; len: number }[];
  tones: number[];
  seed: number;
}

interface CoilPlan {
  x: number;
  dir: number;
  height: number;
  turns: number;
  radius: number;
  window: [number, number];
  seed: number;
}

export interface Cyclamen {
  foot: number;
  tuber: { rx: number; seed: number };
  leaves: LeafPlan[];
  flowers: FlowerPlan[];
  coils: CoilPlan[];
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

export function buildCyclamen(rng: Rng): Cyclamen {
  const foot = rng.range(-2, 2);
  const tuber = { rx: rng.range(5, 6.4), seed: seedOf(rng) };

  // no leaves in the middle: the stalks show coming out of the tuber
  const nOut = rng.int(9, 10);
  const n = nOut;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const leaves: LeafPlan[] = [];
  for (let i = 0; i < n; i++) {
    const inner = i >= nOut;
    const phi = inner ? rng.range(0, Math.PI * 2) : ((i + rng.range(-0.25, 0.25)) / nOut) * Math.PI * 2 + 0.3;
    const side = Math.abs(Math.cos(phi));
    const front = Math.max(0, Math.sin(phi));
    const len = inner ? rng.range(11, 13) : rng.range(16.5, 20) * (1 - 0.2 * front) * (1 + 0.12 * side);
    const nf = rng.int(3, 5);
    const flecks: [number, number, number][] = [];
    for (let k = 0; k < nf; k++) flecks.push([(k % 2 ? -1 : 1) * rng.range(30, 130), rng.range(0.7, 0.86), rng.range(0.06, 0.12)]);
    const w0 = 0.04 + (order[i]! / n) * 0.34;
    leaves.push({
      id: `l${i}`,
      phi,
      dist: inner ? rng.range(2.5, 4) : rng.range(6.5, 9),
      h: inner ? rng.range(4.5, 5.5) : 2.6,
      yaw: phi + rng.gaussian(0, inner ? 0.5 : 0.28),
      len,
      tilt: inner ? rng.range(0.15, 0.4) : rng.range(0.08, 0.3) + 0.1 * Math.max(0, -Math.sin(phi)),
      // the far margin lifts a little, which opens the blade to the eye (the near one would turn it edge-on)
      roll: -rng.range(0.1, 0.24),
      zone: rng.range(0.66, 0.76),
      flecks,
      tone: rng.next(),
      window: [w0, w0 + 0.26],
      seed: seedOf(rng),
    });
    // a leaf pointing toward the eye arches down to the ground, so it opens instead of turning edge-on
    const l = leaves[leaves.length - 1]!;
    l.tilt -= (inner ? 0.5 : 0.36) * Math.max(0, Math.sin(l.yaw));
  }
  const depth = (l: LeafPlan) => l.dist * Math.sin(l.phi) + 0.5 * l.len * Math.sin(l.yaw) + l.h * 0.8;
  leaves.sort((a, b) => depth(a) - depth(b));

  const m = rng.int(12, 13);
  const rank = Array.from({ length: m }, (_, i) => i);
  for (let i = m - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [rank[i], rank[j]] = [rank[j]!, rank[i]!];
  }
  const flowers: FlowerPlan[] = [];
  for (let i = 0; i < m; i++) {
    const u = (rank[i]! + rng.range(0.1, 0.9)) / m;
    const x = lerp(-6, 6, (i + rng.range(0.15, 0.85)) / m);
    const lean = (x / 6) * 0.26 + rng.gaussian(0, 0.1);
    const length = lerp(10, 35, u);
    const hook = (lean === 0 ? 1 : Math.sign(lean)) * rng.range(2.1, 2.7) * (rng.chance(0.2) ? -1 : 1);
    const gentle = (lean === 0 ? 1 : Math.sign(lean)) * rng.range(0.05, 0.3);
    const bends = Array.from({ length: 12 }, (_, k) => (k < 9 ? gentle / 9 : [0.25, 0.4, 0.35][k - 9]! * hook) + rng.gaussian(0, 0.02));
    const stalk: StemPlan = { base: { x: x + foot, y: -4 }, length: length + 3, angle: UP + lean, bends };
    const petals = Array.from({ length: 5 }, (_, k) => ({ twist: rng.range(-0.8, 0.8), len: (k === 2 ? 0.74 : [1, 0.94, 0, 0.94, 1][k]!) * rng.range(0.9, 1.08) }));
    flowers.push({
      stalk,
      hook,
      window: 0.32 + (1 - u) * 0.16 + rng.range(0, 0.1),
      size: rng.range(0.66, 0.82),
      spread: rng.range(0.7, 1.15),
      petals,
      tones: petals.map(() => rng.next()),
      seed: seedOf(rng),
    });
  }

  const coils: CoilPlan[] = [-1, 1].map((dir, i) => ({
    x: dir * rng.range(13, 19) + foot,
    dir: -dir,
    height: rng.range(8, 11),
    turns: rng.range(2.2, 2.8),
    radius: rng.range(1.3, 1.8),
    window: [0.76 + i * 0.04, 0.98],
    seed: seedOf(rng),
  }));
  return { foot, tuber, leaves, flowers, coils, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface CyclamenPose {
  leaves: (LeafMark & { id: string })[];
  /** each leaf's own stalk from the tuber, in the leaves' order */
  petioles: (StalkMark & { id: string })[];
  stalks: (StalkMark & { id: string })[];
  flowers: (FlowerMark & { id: string })[];
  coils: (StalkMark & { id: string })[];
  capsules: (CapsuleMark & { id: string })[];
  tuber: { k: number; rx: number };
}

export function poseCyclamen(plant: Cyclamen, g: number): CyclamenPose {
  const pose: CyclamenPose = { leaves: [], petioles: [], stalks: [], flowers: [], coils: [], capsules: [], tuber: { k: 0.55 + 0.45 * ramp(g, 0, 0.2), rx: plant.tuber.rx } };
  for (const l of plant.leaves) {
    const k = ramp(g, l.window[0], l.window[1]);
    if (k < 0.012) continue;
    const s = smooth(k);
    const base = { x: plant.foot + Math.cos(l.phi) * l.dist * lerp(0.4, 1, s), z: Math.sin(l.phi) * l.dist * lerp(0.4, 1, s), h: l.h };
    const from = { x: plant.foot + Math.cos(l.phi) * 1.2, z: Math.sin(l.phi) * 1.2, h: 1.2 };
    const at = (u: number): Pt => {
      const x = lerp(from.x, base.x, u);
      const z = lerp(from.z, base.z, u);
      const h = lerp(from.h, base.h, u) + Math.sin(Math.PI * u) * 1.6;
      return { x, y: z * 0.6 - h * 0.84 };
    };
    pose.petioles.push({ id: `petiole-${l.id}`, pts: [0, 0.25, 0.5, 0.75, 1].map(at), width: 0.42 * lerp(0.4, 1, s), pigment: PETIOLE, deep: STALK_DEEP, seed: l.seed + 7 });
    const geom = leafGeometry({
      base,
      yaw: l.yaw,
      len: l.len * lerp(0.14, 1, s),
      tilt: lerp(0.85, l.tilt, s),
      roll: l.roll * s,
      zone: l.zone,
      flecks: l.flecks,
    });
    pose.leaves.push({
      id: l.id,
      geom,
      pigment: mix(LEAF, LEAF_BLUE, l.tone),
      deep: LEAF_DEEP,
      silver: SILVER,
      underside: UNDER,
      seed: l.seed,
      alpha: smooth(k * 3),
    });
  }

  for (const [i, f] of plant.flowers.entries()) {
    const k = ramp(g, f.window, f.window + 0.22);
    if (k < 0.012) continue;
    const pts = stemPoints(f.stalk, lerp(0.05, 1, smooth(k)), lerp(0.45, 1, smooth(k)));
    const a = pts[pts.length - 2]!;
    const b = pts[pts.length - 1]!;
    pose.stalks.push({ id: `stalk-${i}`, pts, width: 0.48 * (0.5 + 0.5 * smooth(k * 1.5)), pigment: STALK, deep: STALK_DEEP, seed: f.seed + 1 });
    const size = smooth(ramp(g, f.window + 0.06, f.window + 0.2));
    if (size < 0.02) continue;
    const open = ramp(g, f.window + 0.16, f.window + 0.34);
    const geom = flowerGeometry({
      c: b,
      axis: Math.atan2(b.y - a.y, b.x - a.x),
      open,
      size: f.size * lerp(0.2, 1, size),
      spread: f.spread,
      petals: f.petals,
    });
    pose.flowers.push({
      id: `flower-${i}`,
      geom,
      alpha: smooth(size * 2.5),
      open,
      petal: PETAL,
      tip: PETAL_TIP,
      base: PETAL_BASE,
      throat: THROAT,
      seed: f.seed,
      tones: f.tones,
    });
  }

  for (const [i, c] of plant.coils.entries()) {
    const k = ramp(g, c.window[0], c.window[1]);
    if (k < 0.012) continue;
    const pts = coilPath(c.x, c.dir, c.height, c.turns, c.radius, lerp(0.05, 1, k));
    pose.coils.push({ id: `coil-${i}`, pts, width: 0.6, pigment: STALK, deep: STALK_DEEP, seed: c.seed });
    pose.capsules.push({ id: `capsule-${i}`, at: pts[pts.length - 1]!, r: 1.3 * lerp(0.3, 1, k), pigment: CAPSULE, deep: CAPSULE_DEEP, seed: c.seed + 1, alpha: smooth(k * 2) });
  }
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function cyclamenReach(plant: Cyclamen): Pt[] {
  const pose = poseCyclamen(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.geom.outline),
    ...pose.stalks.flatMap((s) => s.pts),
    ...pose.coils.flatMap((s) => s.pts),
    ...pose.flowers.flatMap((f) => f.geom.petals.flatMap((q) => q.poly)),
  ];
}

const cyclamen: SpeciesDef = {
  id: 'cyclamen',
  name: 'Ivy-leaved Cyclamen',
  nativeName: 'Kyklamino',
  nativeLang: 'el-Latn',
  // wild in Mediterranean scrub, woodland edges and old walls
  range: { realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] },
  tier: 1,
  habitats: ['rock', 'meadow', 'back'], sites: ['wall'],
  sizeClass: 'small',
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: ANCHOR.x, y: ANCHOR.y },
  description: 'Ivy-leaved cyclamen — silver-marbled leaves under swept-back pink flames.',
  bloomColor: '#d98aa6',
  pollinators: true,
  draw(p: Painter, rng: Rng, opts) {
    const plant = buildCyclamen(rng);
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = createRng(plant.seeds.ground);
      ground(p, r, g, plant);
      const pose = poseCyclamen(plant, g);
      const cut = Math.floor(pose.leaves.length * 0.6);
      paintStalks(p, pose.petioles.slice(0, cut), 0.55);
      paintLeaves(p, pose.leaves.slice(0, cut));
      paintStalks(p, [...pose.stalks, ...pose.coils, ...pose.petioles.slice(cut)], 0.68);
      paintLeaves(p, pose.leaves.slice(cut));
      paintCapsules(p, pose.capsules);
      paintFlowers(p, pose.flowers);
    } finally {
      end();
    }
  },
};

/** Turned earth, a cool shadow and the flat round tuber that the first leaves come out of. */
function ground(p: Painter, rng: Rng, g: number, plant: Cyclamen): void {
  const x = plant.foot;
  groundShadow(p, rng, { rx: 28, ry: 4.5, x, k: ramp(g, 0.04, 0.5), opacity: 0.14, pigment: SHADOW });
  const settle = ramp(g, 0.1, 0.5);
  p.wash({ cx: x, cy: -1.2, rx: 9, ry: 2.6 }, EARTH, { rng: rng.fork('mound'), opacity: 0.4 * (1 - 0.6 * settle), edge: 0.35, centreLift: 0.35, granulation: 0.35 });
  const t = 0.55 + 0.45 * ramp(g, 0, 0.2);
  const hide = 1 - 0.75 * ramp(g, 0.25, 0.55);
  const rx = plant.tuber.rx * t;
  p.wash({ cx: x, cy: -2.2, rx, ry: rx * 0.5 }, TUBER, { rng: rng.fork('tuber'), opacity: 0.85 * hide, edge: 0.5, sharpness: 0.55, centreLift: 0.1, granulation: 0.45 });
  p.wash({ cx: x + rx * 0.2, cy: -1.4, rx: rx * 0.75, ry: rx * 0.3 }, TUBER_DEEP, { rng: rng.fork('tuberdeep'), opacity: 0.4 * hide, edge: 0.3, sharpness: 0.4 });
}

export default cyclamen;
