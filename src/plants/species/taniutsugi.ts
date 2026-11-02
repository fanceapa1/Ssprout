import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth, stagger } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, seedAndShoot } from '../lib/shrub-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import { paintOvalLeaves, paintTrumpets, paintWands, type OvalLeaf, type Trumpet, type WandMark } from '../lib/taniutsugi-paint';
import type { SpeciesDef } from '../types';

/**
 * Taniutsugi (Weigela hortensis): an open vase of upright, arching wands with opposite oval
 * leaves, and pink funnel trumpets in twos and threes at the leaf pairs, pale inside, rose outside.
 */

const LEAF = '#9cb46a';
const UNDER = '#a9b49a';
const BARK = '#87735f';
const PINK = '#e992ab';
const OUTER = '#d9708f';
const INNER = '#f4bccb';
const DEEP = mix('#b8456d', OUTER, 0.3);

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };
/** wands stay this far inside the box, so their leaves and trumpets clear the edges */
const REACH = { side: 80, up: 190 };

interface LeafPlan {
  side: 1 | -1;
  turn: number;
  length: number;
  width: number;
  teeth: number;
  droop: number;
  tone: Pigment;
  seed: number;
}

interface FlowerPlan {
  id: number;
  side: 1 | -1;
  turn: number;
  lift: number;
  length: number;
  mouth: number;
  tilt: number;
  roll: number;
  pedicel: number;
  bud: [number, number];
  open: [number, number];
  seed: number;
}

interface NodePlan {
  t: number;
  leaves: LeafPlan[];
  flowers: FlowerPlan[];
}

interface Wand {
  plan: StemPlan;
  /** index of the wand it branches from (-1 for a wand from the crown) */
  parent: number;
  /** where on the parent it branches, and its turn from the parent there */
  at: number;
  offset: number;
  window: [number, number];
  width: number;
  band: 0 | 1 | 2;
  tone: Pigment;
  nodes: NodePlan[];
  seed: number;
}

export interface Taniutsugi {
  wands: Wand[];
  flowers: FlowerPlan[];
  seeds: { ground: number; sprout: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

function fits(pts: readonly Pt[]): boolean {
  return pts.every((q) => Math.abs(q.x) <= REACH.side && q.y >= -REACH.up);
}

function leafPlan(rng: Rng, side: 1 | -1, size: number, turn: number, green: Pigment): LeafPlan {
  const length = rng.range(17, 23) * size;
  return {
    side,
    turn,
    length,
    width: length * rng.range(0.5, 0.6),
    teeth: rng.int(9, 13),
    droop: rng.range(0.04, 0.2),
    tone: jitter(mix(green, rng.chance(0.5) ? lighten(green, 0.1) : PIGMENTS.olive, rng.range(0, 0.22)), rng, 0.03),
    seed: seedOf(rng),
  };
}

function flowerPlan(rng: Rng, side: 1 | -1, flowers: FlowerPlan[]): FlowerPlan {
  // most trumpets turn a little toward us; one in three looks straight into its mouth
  const tilt = rng.chance(0.35) ? rng.range(0.85, 1.15) : rng.range(0.2, 0.6);
  const f: FlowerPlan = {
    id: flowers.length,
    side,
    turn: rng.range(0.6, 1.15),
    lift: rng.range(0.1, 0.3),
    length: rng.range(10, 12.5),
    mouth: rng.range(3.6, 4.4),
    tilt,
    roll: rng.range(0, Math.PI),
    pedicel: rng.range(1.5, 3),
    bud: [0, 0],
    open: [0, 0],
    seed: seedOf(rng),
  };
  flowers.push(f);
  return f;
}

/** Opposite leaf pairs along a wand, in decussate pairs, with trumpets at the upper ones. */
function nodesOf(rng: Rng, length: number, tone: Pigment, flowers: FlowerPlan[], o: { from: number; bloom: [number, number]; chance: number }): NodePlan[] {
  const count = Math.max(2, Math.round((length * (1 - o.from)) / rng.range(13, 16)));
  const nodes: NodePlan[] = [];
  for (let j = 0; j < count; j++) {
    const t = lerp(o.from, 0.97, j / (count - 1)) + rng.range(-0.015, 0.015);
    const size = (0.68 + 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * lerp(1, 0.5, smooth((t - 0.76) / 0.24));
    // every other pair faces us and is foreshortened
    const facing = j % 2 === 1;
    const turn = facing ? rng.range(0.35, 0.55) : rng.range(0.8, 1.15);
    const k = facing ? 0.78 : 1;
    const leaves = [leafPlan(rng, 1, size * k, turn + rng.range(-0.2, 0.2), tone), leafPlan(rng, -1, size * k * rng.range(0.85, 1.05), turn + rng.range(-0.25, 0.25), tone)];
    const fl: FlowerPlan[] = [];
    if (t >= o.bloom[0] && t <= o.bloom[1] && rng.chance(o.chance)) {
      const first: 1 | -1 = rng.chance(0.5) ? 1 : -1;
      fl.push(flowerPlan(rng, first, flowers), flowerPlan(rng, -first as 1 | -1, flowers));
      if (rng.chance(0.3)) fl.push(flowerPlan(rng, rng.chance(0.5) ? 1 : -1, flowers));
    }
    nodes.push({ t, leaves, flowers: fl });
  }
  return nodes;
}

export function buildTaniutsugi(rng: Rng): Taniutsugi {
  const n = rng.int(6, 8);
  const green = jitter(LEAF, rng, 0.025);
  const lean = rng.range(-0.08, 0.08);
  const wands: Wand[] = [];
  const flowers: FlowerPlan[] = [];
  const toneOf = (band: number) => (band === 0 ? mix(green, PIGMENTS.shadow, 0.2) : band === 2 ? lighten(green, 0.05) : green);
  const bandOf = () => {
    const z = rng.next();
    return (z < 0.34 ? 0 : z < 0.67 ? 1 : 2) as 0 | 1 | 2;
  };
  for (let i = 0; i < n; i++) {
    // a vase: the inner wands rise straight and tall, the outer ones lean out and arch at the top
    const s = clamp01(Math.abs(lerp(-1, 1, i / (n - 1)) + rng.range(-0.16, 0.16))) * Math.sign(i - (n - 1) / 2 || rng.range(-1, 1));
    const outer = Math.abs(s);
    const length = lerp(205, 150, outer ** 1.3) * rng.range(0.8, 1.04);
    // the vase's belly: wands leave the crown splayed and curve back up before arching out
    const belly = Math.sign(s) * outer * rng.range(0.2, 0.32);
    const angle = UP + lean + s * 0.36 + belly + rng.range(-0.05, 0.05);
    // every wand arches outward at the top, the outer ones most
    const bend = Math.sign(s || 1) * lerp(0.3, 1.15, outer ** 1.1) * rng.range(0.85, 1.15) + rng.range(-0.1, 0.1);
    let plan = makeStem(rng, { base: { x: s * 9 + rng.range(-3, 3), y: 0 }, length, angle, bend, segments: 16, tipBias: 0.8, wobble: 0.025 });
    plan = { ...plan, bends: plan.bends.map((b, j) => (j >= 1 && j <= 6 ? b - belly / 6 : b)) };
    for (let k = 0; k < 24 && !fits(stemPoints(plan, 1, 1)); k++) plan = { ...plan, length: plan.length * 0.95 };
    const start = 0.1 + 0.14 * rng.next();
    const band = bandOf();
    const tone = toneOf(band);
    const nodes = nodesOf(rng, plan.length, tone, flowers, { from: 0.22, bloom: [0.42, 0.9], chance: 0.5 });
    const main: Wand = { plan, parent: -1, at: 0, offset: 0, window: [start, start + rng.range(0.36, 0.42)], width: rng.range(2.7, 3.3), band, tone, nodes, seed: seedOf(rng) };
    wands.push(main);
    // a side wand from the middle of a tall one, leaning outward
    if (plan.length > 140 && rng.chance(0.6)) {
      const pts = stemPoints(plan, 1, 1);
      const at = rng.range(0.4, 0.6);
      const node = pointAt(pts, at);
      const out = s === 0 ? (rng.chance(0.5) ? 1 : -1) : Math.sign(s);
      const offset = out * rng.range(0.35, 0.6);
      let side = makeStem(rng, { base: { x: node.x, y: node.y }, length: rng.range(55, 85), angle: node.angle + offset, bend: out * rng.range(0.15, 0.45), segments: 8, tipBias: 0.6, wobble: 0.02 });
      for (let k = 0; k < 24 && !fits(stemPoints(side, 1, 1)); k++) side = { ...side, length: side.length * 0.93 };
      const s0 = main.window[0] + (main.window[1] - main.window[0]) * at * 0.8;
      const sb = rng.chance(0.5) ? band : bandOf();
      wands.push({
        plan: side,
        parent: wands.length - 1,
        at,
        offset,
        window: [s0, s0 + rng.range(0.3, 0.35)],
        width: rng.range(1.5, 1.8),
        band: sb,
        tone: toneOf(sb),
        nodes: nodesOf(rng, side.length, toneOf(sb), flowers, { from: 0.15, bloom: [0.3, 0.9], chance: 0.55 }),
        seed: seedOf(rng),
      });
    }
  }
  // buds form and open from the lower nodes up
  const keyed: { f: FlowerPlan; key: number }[] = [];
  for (const w of wands) for (const nd of w.nodes) for (const f of nd.flowers) keyed.push({ f, key: w.window[0] + nd.t * 0.25 + rng.range(0, 0.15) });
  keyed.sort((a, b) => a.key - b.key);
  keyed.forEach(({ f }, k) => {
    f.bud = stagger(k, keyed.length, 0.46, 0.8, 0.42);
    f.open = stagger(k, keyed.length, 0.72, 1, 0.42);
  });
  return { wands, flowers, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface TaniutsugiPose {
  wands: (WandMark & { id: string; band: number })[];
  leaves: (OvalLeaf & { id: string; band: number; group: number })[];
  trumpets: (Trumpet & { id: string; band: number })[];
}

interface Grown {
  pts: Pt[];
  ext: number;
}

function growWand(w: Wand, g: number, grown: (Grown | null)[]): Grown | null {
  const k = ramp(g, w.window[0], w.window[1]);
  if (k < 0.015) return null;
  let plan = w.plan;
  let gate = 1;
  if (w.parent >= 0) {
    const p = grown[w.parent];
    if (!p) return null;
    // a side wand starts from its node only once the parent has grown past it
    gate = smooth(clamp01((p.ext - w.at) / 0.12));
    const node = nodeAt(p, w.at);
    plan = { ...plan, base: { x: node.x, y: node.y }, angle: node.angle + w.offset };
  }
  // a young wand comes up nearly straight and arches as it lengthens
  const ext = lerp(0.03, 1, k) * smooth(k * 5) * gate;
  if (ext < 0.004) return null;
  return { pts: stemPoints(plan, ext, lerp(0.3, 1, smooth(k))), ext };
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

export function poseTaniutsugi(plant: Taniutsugi, g: number): TaniutsugiPose {
  const pose: TaniutsugiPose = { wands: [], leaves: [], trumpets: [] };
  const grown: (Grown | null)[] = [];
  plant.wands.forEach((w, i) => {
    const gs = growWand(w, g, grown);
    grown.push(gs);
    if (!gs) return;
    const thick = 0.4 + 0.6 * ramp(g, w.window[0], Math.min(1, w.window[1] + 0.25));
    const bark = mix(BARK, w.tone, w.parent < 0 ? 0.12 : 0.4);
    pose.wands.push({ id: `wand-${i}`, band: w.band, pts: gs.pts, width: w.width * thick * smooth(gs.ext * 5), pigment: bark, seed: w.seed });
    w.nodes.forEach((nd, j) => {
      const k = smooth(clamp01((gs.ext - nd.t * 0.8) / 0.35));
      if (k < 0.015) return;
      const node = nodeAt(gs, nd.t);
      nd.leaves.forEach((l, m) => {
        const e = 1 - (1 - k) ** 2;
        const angle = lerpAngle(node.angle, node.angle + l.side * l.turn, smooth(k));
        const curve = (Math.cos(angle) >= 0 ? 1 : -1) * l.droop * k;
        const lit = Math.sin(angle) * l.side;
        pose.leaves.push({
          id: `leaf-${i}-${j}-${m}`,
          band: w.band,
          group: (j + m) % 2,
          at: { x: node.x, y: node.y },
          angle,
          length: l.length * e,
          width: l.width * e * lerp(0.35, 1, smooth(k)),
          curve,
          teeth: l.teeth,
          pigment: l.tone,
          under: UNDER,
          alpha: smooth(k * 4),
          shade: lit > 0 ? 1 : -1,
          seed: l.seed,
        });
      });
      const nodeK = smooth(clamp01((gs.ext - nd.t * 0.85) / 0.12));
      nd.flowers.forEach((f) => {
        const grow = ramp(g, f.bud[0] - 0.1, f.bud[1]);
        const open = ramp(g, f.open[0], f.open[1]);
        const kk = nodeK * grow;
        if (kk < 0.012) return;
        const dir = lerpAngle(node.angle + f.side * f.turn * lerp(0.5, 1, open), UP, f.lift);
        const ped = f.pedicel * kk;
        const at = { x: node.x + Math.cos(dir) * ped, y: node.y + Math.sin(dir) * ped };
        pose.wands.push({ id: `ped-${f.id}`, band: w.band, pts: [{ x: node.x, y: node.y }, at], width: 0.7 * kk, pigment: mix(BARK, w.tone, 0.6), seed: f.seed + 5, taper: 0.3 });
        pose.trumpets.push({
          id: `trumpet-${f.id}`,
          band: w.band,
          at,
          angle: dir,
          length: f.length * kk * (0.62 + 0.38 * open),
          mouth: f.mouth * kk,
          tilt: lerp(0.15, f.tilt, open),
          roll: f.roll,
          open,
          alpha: smooth(kk * 4),
          shade: Math.cos(dir) >= 0 ? 1 : -1,
          seed: f.seed,
        });
      });
    });
  });
  return pose;
}

const taniutsugi: SpeciesDef = {
  id: 'taniutsugi',
  name: 'Valley Weigela',
  nativeName: 'Taniutsugi',
  // sunny slopes above mountain rivers on the snowy Sea of Japan side; endemic, wild only
  range: { realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate'] },
  tier: 3,
  habitats: ['meadow', 'back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Taniutsugi — pink trumpets for the valley, when the snow is gone.',
  bloomColor: PINK,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildTaniutsugi(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, taniutsugi, () => {
      groundShadow(p, plant.seeds.ground, g, 0, 28, 5, 0.18);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 10, green: lighten(LEAF, 0.05), handover: 0.24 });
      const pose = poseTaniutsugi(plant, g);
      const style = { outer: OUTER, deep: DEEP, inner: INNER, calyx: mix(LEAF, PIGMENTS.olive, 0.45) };
      for (const band of [0, 1, 2]) {
        paintWands(p, pose.wands.filter((c) => c.band === band), { opacity: band === 0 ? 0.72 : 0.86, accent: mix(BARK, PIGMENTS.sumi, 0.35), accentOpacity: 0.32 });
        for (const group of [0, 1]) paintOvalLeaves(p, pose.leaves.filter((l) => l.band === band && l.group === group), { opacity: band === 0 ? 0.72 : 0.86 });
        paintTrumpets(p, pose.trumpets.filter((f) => f.band === band), { ...style, alpha: band === 0 ? 0.88 : 1 });
      }
    });
  },
};

export default taniutsugi;
