import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth, stagger } from '../lib/shrub-growth';
import { bloomState, groundShadow, inPlantSpace, paintBlooms, seedAndShoot, type Bloom, type BloomState } from '../lib/shrub-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import { paintCanes, paintSerratedLeaves, type CaneMark, type SerratedLeaf } from '../lib/yamabuki-paint';
import type { SpeciesDef } from '../types';

/**
 * Yamabuki (Kerria japonica): a fountain of thin green canes arching over, set with bright,
 * double-toothed pointed leaves, and single five-petalled golden flowers spaced along the arches.
 */

const CANE = '#8fa456';
const LEAF = '#9bb25a';
const GOLD = '#e5b02f';
const GOLD_SHADE = '#c78f24';
const BUD = mix('#b9c46a', GOLD, 0.15);
const PETAL = mix(GOLD, '#f3d35a', 0.3);
const PETAL_TIP = mix(GOLD, '#f6dc78', 0.5);

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };
/** canes stay this far inside the box, so their leaves and flowers clear the edges */
const REACH = { side: 77, up: 180, tipLow: -12 };

interface LeafPlan {
  t: number;
  side: 1 | -1;
  turn: number;
  length: number;
  width: number;
  teeth: number;
  tone: Pigment;
  seed: number;
}

interface Shoot {
  t: number;
  /** turn from the cane at the node */
  turn: number;
  length: number;
  leaves: LeafPlan[];
  flower: number;
}

interface Flower {
  id: number;
  cane: number;
  bloom: Bloom;
  bud: [number, number];
  open: [number, number];
}

interface Cane {
  plan: StemPlan;
  window: [number, number];
  width: number;
  band: 0 | 1 | 2;
  tone: Pigment;
  leaves: LeafPlan[];
  shoots: Shoot[];
  seed: number;
}

export interface Yamabuki {
  canes: Cane[];
  flowers: Flower[];
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
  const length = rng.range(15, 20) * size;
  return {
    t,
    side,
    turn: rng.range(0.35, 0.85),
    length,
    width: length * rng.range(0.46, 0.56),
    teeth: rng.int(8, 11),
    tone: jitter(mix(green, rng.chance(0.5) ? lighten(green, 0.12) : PIGMENTS.olive, rng.range(0, 0.25)), rng, 0.03),
    seed: seedOf(rng),
  };
}

function flowerBloom(rng: Rng): Bloom {
  const size = rng.range(5.4, 6.6);
  return {
    x: 0,
    y: 0,
    view: rng.range(0.8, 1.45),
    roll: rng.range(-0.7, 0.7),
    rot: rng.range(0, Math.PI * 2),
    rings: [{ count: 5, length: size, width: 0.82, open: 1.45, pigment: PETAL, tip: PETAL_TIP, curve: 0.08, lengthVar: 0.1, angleVar: 0.14, basePool: 0.45, variant: 'petal' }],
    centre: { kind: 'stamens', pigment: mix(GOLD_SHADE, GOLD, 0.55), size: size * 0.38, count: 9 },
    throat: { pigment: GOLD_SHADE, size: size * 0.34, alpha: 0.4 },
    opaque: true,
    bud: BUD,
    sepals: 3,
    seed: seedOf(rng),
  };
}

export function buildYamabuki(rng: Rng): Yamabuki {
  const lean: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const n = rng.int(8, 11);
  // the crown sits a little back from the side the fountain leans over
  const foot = -lean * rng.range(6, 14);
  const green = jitter(LEAF, rng, 0.025);
  const canes: Cane[] = [];
  const flowers: Flower[] = [];
  const placed: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const side: 1 | -1 = i === 0 || rng.chance(0.68) ? lean : (-lean as 1 | -1);
    const upright = i > 1 && rng.chance(0.22);
    // inner canes rise tall and arch at the top; outer ones lean out low and wide
    const outer = i === 0 ? rng.range(0, 0.3) : rng.next();
    const length = upright ? rng.range(60, 95) : lerp(290, 150, outer) * rng.range(0.92, 1.05);
    const angle = UP + side * (upright ? rng.range(0.04, 0.2) : lerp(0.06, 0.75, outer) + rng.range(-0.04, 0.04));
    const bend = side * (upright ? rng.range(0.6, 1.0) : lerp(2.45, 1.8, outer) * rng.range(0.92, 1.08));
    let plan = makeStem(rng, { base: { x: foot + rng.range(-4, 4), y: 0 }, length, angle, bend, segments: 16, tipBias: upright ? 0.4 : lerp(0.8, 0.3, outer), wobble: 0.018 });
    for (let k = 0; k < 24 && !fits(plan); k++) plan = { ...plan, length: plan.length * 0.95 };
    const start = 0.08 + 0.2 * (i / Math.max(1, n - 1)) + rng.range(-0.02, 0.02);
    const z = rng.next();
    const band = (z < 0.34 ? 0 : z < 0.67 ? 1 : 2) as 0 | 1 | 2;
    const tone = band === 0 ? mix(green, PIGMENTS.shadow, 0.2) : band === 2 ? lighten(green, 0.06) : green;
    // alternate leaves, largest along the middle of the cane, small toward the tip
    const nLeaves = Math.round(plan.length / rng.range(11, 13.5));
    const leaves: LeafPlan[] = [];
    let alt: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    for (let j = 0; j < nLeaves; j++) {
      const t = lerp(0.2, 0.97, (j + rng.range(-0.25, 0.25)) / Math.max(1, nLeaves - 1));
      const size = (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, t * 1.35))) * lerp(1, 0.55, smooth((t - 0.72) / 0.28));
      leaves.push(leafPlan(rng, t, alt, size, tone));
      alt = -alt as 1 | -1;
    }
    // short flowering side shoots along the arch, spaced a few nodes apart
    const full = stemPoints(plan, 1, 1);
    const shoots: Shoot[] = [];
    let last = -3;
    for (let j = 0; j < leaves.length; j++) {
      const l = leaves[j]!;
      // this year's upright shoots do not flower: kerria blooms on last year's arching canes
      if (upright || l.t < 0.28 || l.t > 0.94 || j - last < 3 || shoots.length >= 3 || !rng.chance(0.45)) continue;
      const node = pointAt(full, l.t);
      // the side of the cane that faces up, mostly: flowers sit on top of the arch
      const upSide: 1 | -1 = Math.cos(node.angle) >= 0 ? -1 : 1;
      const s: 1 | -1 = rng.chance(0.78) ? upSide : (-upSide as 1 | -1);
      const turn = s * rng.range(0.55, 1.05);
      const len = rng.range(4, 7.5);
      const dir = lerpAngle(node.angle + turn, UP, 0.3);
      const at = { x: node.x + Math.cos(dir) * (len + 1.2), y: node.y + Math.sin(dir) * (len + 1.2) };
      const bloom = flowerBloom(rng);
      const leafA = leafPlan(rng, 0.45, s, 0.5, tone);
      const leafB = leafPlan(rng, 0.85, (-s) as 1 | -1, 0.42, tone);
      // single flowers, spaced: none within a flower's width of another
      if (placed.some((q) => Math.hypot(q.x - at.x, q.y - at.y) < 15)) continue;
      placed.push(at);
      last = j;
      const id = flowers.length;
      flowers.push({ id, cane: i, bloom, bud: [0, 0], open: [0, 0] });
      shoots.push({ t: l.t, turn, length: len, leaves: [leafA, leafB], flower: id });
    }
    canes.push({ plan, window: [start, start + rng.range(0.28, 0.34)], width: upright ? 1.3 : rng.range(1.45, 1.8), band, tone, leaves, shoots, seed: seedOf(rng) });
  }
  // buds form and open spread along the arches, base first
  const order = flowers.map((f, i) => ({ i, key: canes[f.cane]!.window[0] + rng.range(0, 0.25) })).sort((a, b) => a.key - b.key);
  order.forEach(({ i }, k) => {
    flowers[i]!.bud = stagger(k, order.length, 0.5, 0.82, 0.4);
    flowers[i]!.open = stagger(k, order.length, 0.72, 1, 0.45);
  });
  return { canes, flowers, foot, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface YamabukiPose {
  canes: (CaneMark & { id: string; band: number })[];
  leaves: (SerratedLeaf & { id: string; band: number; group: number })[];
  flowers: { id: string; band: number; bloom: Bloom; state: BloomState }[];
}

interface Grown {
  pts: Pt[];
  ext: number;
  k: number;
}

function growCane(c: Cane, g: number): Grown | null {
  const k = ramp(g, c.window[0], c.window[1]);
  if (k < 0.015) return null;
  // a young cane comes up nearly straight and arches over as it lengthens
  const ext = lerp(0.03, 1, k) * smooth(k * 5);
  return { pts: stemPoints(c.plan, ext, lerp(0.15, 1, smooth(k))), ext, k };
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

function leafMark(l: LeafPlan, at: Pt, dir: number, k: number, band: number, group: number, id: string): YamabukiPose['leaves'][number] {
  const e = 1 - (1 - k) ** 3;
  const angle = lerpAngle(dir, dir + l.side * l.turn, smooth(k));
  // leaves droop a little at the tip
  const curve = (Math.cos(angle) >= 0 ? 1 : -1) * 0.08 * k;
  const length = l.length * e;
  const lit = Math.sin(angle) * l.side;
  return { id, band, group, at, angle, length, width: l.width * e * lerp(0.35, 1, smooth(k)), curve, teeth: l.teeth, pigment: l.tone, alpha: smooth(k * 4), shade: lit > 0 ? 1 : -1, seed: l.seed };
}

export function poseYamabuki(plant: Yamabuki, g: number): YamabukiPose {
  const pose: YamabukiPose = { canes: [], leaves: [], flowers: [] };
  plant.canes.forEach((c, i) => {
    const gs = growCane(c, g);
    if (!gs) return;
    const thick = 0.45 + 0.55 * ramp(g, c.window[0], Math.min(1, c.window[1] + 0.2));
    pose.canes.push({ id: `cane-${i}`, band: c.band, pts: gs.pts, width: c.width * thick * smooth(gs.ext * 4), pigment: mix(CANE, c.tone, 0.25), seed: c.seed });
    c.leaves.forEach((l, j) => {
      const k = smooth(clamp01((gs.ext - l.t * 0.68) / 0.32));
      if (k < 0.015) return;
      const node = nodeAt(gs, l.t);
      const at = { x: node.x + Math.cos(node.angle + l.side * 1.2) * 0.9 * k, y: node.y + Math.sin(node.angle + l.side * 1.2) * 0.9 * k };
      pose.leaves.push(leafMark(l, at, node.angle, k, c.band, j % 2, `leaf-${i}-${j}`));
    });
    c.shoots.forEach((s, j) => {
      const f = plant.flowers[s.flower]!;
      const nodeK = smooth(clamp01((gs.ext - s.t * 0.8) / 0.15));
      const k = nodeK * ramp(g, f.bud[0] - 0.14, f.bud[0] + 0.04);
      if (k < 0.015) return;
      const node = nodeAt(gs, s.t);
      const dir = lerpAngle(node.angle + s.turn, UP, 0.3);
      const tip = { x: node.x + Math.cos(dir) * s.length * k, y: node.y + Math.sin(dir) * s.length * k };
      const mid = { x: (node.x + tip.x) / 2, y: (node.y + tip.y) / 2 };
      pose.canes.push({ id: `shoot-${i}-${j}`, band: c.band, pts: [node, mid, tip], width: 0.75 * k, pigment: CANE, seed: c.seed + 11 + j, taper: 0.4 });
      s.leaves.forEach((l, m) => {
        const at = { x: lerp(node.x, tip.x, l.t), y: lerp(node.y, tip.y, l.t) };
        pose.leaves.push(leafMark(l, at, dir, k, c.band, (j + m) % 2, `sleaf-${i}-${j}-${m}`));
      });
      const st = bloomState(g, f.bud, f.open);
      if (st.size * k < 0.02) return;
      const centre = { x: tip.x + Math.cos(dir) * 1.2 * k, y: tip.y + Math.sin(dir) * 1.2 * k };
      pose.flowers.push({ id: `flower-${f.id}`, band: c.band, bloom: { ...f.bloom, x: centre.x, y: centre.y }, state: { ...st, size: st.size * k } });
    });
  });
  return pose;
}

const yamabuki: SpeciesDef = {
  id: 'yamabuki',
  name: 'Japanese Kerria',
  nativeName: 'Yamabuki',
  // mountain thickets along streams and gorges; wild only here, so not in the garden
  range: { realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate', 'warm-temperate'] },
  tier: 3,
  habitats: ['shore', 'meadow', 'back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Yamabuki — gold leaning over the stream, keeping no seed.',
  bloomColor: GOLD,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildYamabuki(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, yamabuki, () => {
      groundShadow(p, plant.seeds.ground, g, plant.foot, 26, 5, 0.18);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 12, green: lighten(CANE, 0.1), handover: 0.24 });
      const pose = poseYamabuki(plant, g);
      for (const band of [0, 1, 2]) {
        paintCanes(
          p,
          pose.canes.filter((c) => c.band === band),
          { opacity: band === 0 ? 0.7 : 0.82, accent: mix(CANE, PIGMENTS.olive, 0.5), accentOpacity: 0.3 },
        );
        for (const group of [0, 1]) paintSerratedLeaves(p, pose.leaves.filter((l) => l.band === band && l.group === group), { opacity: band === 0 ? 0.72 : 0.88 });
        if (band === 0) paintBlooms(p, pose.flowers.filter((f) => f.band === 0), { alpha: 0.92 });
      }
      paintBlooms(p, pose.flowers.filter((f) => f.band > 0));
    });
  },
};

export default yamabuki;
