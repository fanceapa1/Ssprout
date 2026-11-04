import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth, stagger } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, seedAndShoot } from '../lib/shrub-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import { paintKnifeLeaves, paintPinwheels, paintStems, type KnifeLeaf, type Pinwheel, type StemMark } from '../lib/oleander-paint';
import type { SpeciesDef } from '../types';

/**
 * Oleander (Nerium oleander): a dense, upright fountain of stems with long dark knife leaves in
 * whorls of three, and clusters of rose-pink pinwheels at the tips, paler on the reverse.
 */

const LEAF = '#66774c';
const UNDER = '#93a088';
const BARK = '#857c62';
const PINK = '#d9708f';
const PALE = '#efb2c2';
const DEEP = mix('#a8405f', PINK, 0.35);

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };
/** stems stay this far inside the box, so their leaves and flowers clear the edges */
const REACH = { side: 74, up: 186 };

interface LeafPlan {
  side: 1 | -1 | 0;
  turn: number;
  length: number;
  width: number;
  droop: number;
  tone: Pigment;
  seed: number;
}

interface NodePlan {
  t: number;
  leaves: LeafPlan[];
}

interface FlowerPlan {
  id: number;
  /** offset from the stem tip, in the cluster's dome */
  dx: number;
  dy: number;
  radius: number;
  facing: number;
  squash: number;
  roll: number;
  budAngle: number;
  /** stays a bud at full growth */
  bud: boolean;
  grow: [number, number];
  open: [number, number];
  seed: number;
}

interface Stem {
  plan: StemPlan;
  /** index of the stem it branches from (-1 for a stem from the crown) */
  parent: number;
  at: number;
  offset: number;
  window: [number, number];
  width: number;
  band: 0 | 1 | 2;
  tone: Pigment;
  nodes: NodePlan[];
  flowers: FlowerPlan[];
  seed: number;
}

export interface Oleander {
  stems: Stem[];
  flowers: FlowerPlan[];
  seeds: { ground: number; sprout: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

function fits(pts: readonly Pt[]): boolean {
  return pts.every((q) => Math.abs(q.x) <= REACH.side && q.y >= -REACH.up);
}

function leafPlan(rng: Rng, side: 1 | -1 | 0, size: number, turn: number, green: Pigment): LeafPlan {
  const length = rng.range(24, 34) * size * (side === 0 ? rng.range(0.5, 0.75) : 1);
  return {
    side,
    turn,
    length,
    width: rng.range(3.4, 4.4) * size ** 0.8,
    droop: rng.range(0.02, 0.12),
    tone: jitter(mix(green, rng.chance(0.4) ? lighten(green, 0.08) : PIGMENTS.olive, rng.range(0, 0.2)), rng, 0.025),
    seed: seedOf(rng),
  };
}

/** Whorls of three along a stem: one leaf to each side, one toward us, more upright near the tip. */
function nodesOf(rng: Rng, length: number, tone: Pigment, from: number): NodePlan[] {
  const count = Math.max(2, Math.round((length * (0.96 - from)) / rng.range(12, 15)));
  const nodes: NodePlan[] = [];
  for (let j = 0; j < count; j++) {
    const t = lerp(from, 0.96, j / (count - 1)) + rng.range(-0.015, 0.015);
    const size = lerp(0.85, 1, Math.sin(Math.PI * Math.min(1, t * 1.1))) * lerp(1, 0.62, smooth((t - 0.8) / 0.2));
    const spread = lerp(0.8, 0.3, t) * rng.range(0.75, 1.25);
    const lean = rng.range(-0.22, 0.22);
    nodes.push({
      t,
      leaves: [
        leafPlan(rng, 1, size, spread + lean + rng.range(-0.1, 0.1), tone),
        leafPlan(rng, -1, size * rng.range(0.9, 1.05), spread - lean + rng.range(-0.1, 0.1), tone),
        leafPlan(rng, 0, size, rng.range(-0.18, 0.18), tone),
      ],
    });
  }
  return nodes;
}

/** A terminal cyme: open pinwheels in a loose dome over the tip, buds tucked among them. */
function clusterOf(rng: Rng, flowers: FlowerPlan[], scale: number, lean: number): FlowerPlan[] {
  const out: FlowerPlan[] = [];
  const n = rng.int(4, 7);
  const buds = rng.int(2, 4);
  for (let i = 0; i < n + buds; i++) {
    const bud = i >= n;
    const a = UP + lean * 0.5 + lerp(-1.25, 1.25, (i % n) / Math.max(1, n - 1)) * rng.range(0.7, 1) + rng.range(-0.15, 0.15);
    const d = (bud ? rng.range(2, 7) : rng.range(4, 10)) * scale;
    const f: FlowerPlan = {
      id: flowers.length,
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d * 0.8 - (bud ? 2 : 0),
      radius: rng.range(5.6, 7) * scale * (bud ? 0.85 : 1),
      facing: rng.range(-0.5, 0.5),
      squash: rng.chance(0.3) ? rng.range(0.85, 1) : rng.range(0.55, 0.85),
      roll: rng.range(0, Math.PI * 2),
      budAngle: a + rng.range(-0.3, 0.3),
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

export function buildOleander(rng: Rng): Oleander {
  const n = rng.int(11, 14);
  const green = jitter(LEAF, rng, 0.02);
  const lean = rng.range(-0.06, 0.06);
  const stems: Stem[] = [];
  const flowers: FlowerPlan[] = [];
  const toneOf = (band: number) => (band === 0 ? mix(green, PIGMENTS.shadow, 0.22) : band === 2 ? lighten(green, 0.04) : green);
  const bandOf = () => {
    const z = rng.next();
    return (z < 0.34 ? 0 : z < 0.67 ? 1 : 2) as 0 | 1 | 2;
  };
  for (let i = 0; i < n; i++) {
    // a fountain: inner stems straight up and tallest, outer ones leaning out with a slight arch
    const s = clamp01(Math.abs(lerp(-1, 1, i / (n - 1)) + rng.range(-0.12, 0.12))) * Math.sign(i - (n - 1) / 2 || rng.range(-1, 1));
    const outer = Math.abs(s);
    const length = lerp(196, 128, outer ** 1.4) * rng.range(0.84, 1.03);
    const angle = UP + lean + s * 0.5 + rng.range(-0.05, 0.05);
    const bend = Math.sign(s || 1) * lerp(0.05, 0.42, outer ** 1.2) * rng.range(0.8, 1.2);
    let plan = makeStem(rng, { base: { x: s * 7 + rng.range(-2.5, 2.5), y: 0 }, length, angle, bend, segments: 14, tipBias: 0.7, wobble: 0.02 });
    for (let k = 0; k < 24 && !fits(stemPoints(plan, 1, 1)); k++) plan = { ...plan, length: plan.length * 0.95 };
    const start = 0.08 + 0.12 * outer + 0.06 * rng.next();
    const band = bandOf();
    const tone = toneOf(band);
    const tipAngle = pointAt(stemPoints(plan, 1, 1), 1).angle;
    const main: Stem = {
      plan,
      parent: -1,
      at: 0,
      offset: 0,
      window: [start, start + rng.range(0.34, 0.4)],
      width: rng.range(2.4, 3),
      band,
      tone,
      nodes: nodesOf(rng, plan.length, tone, rng.range(0.24, 0.34)),
      flowers: clusterOf(rng, flowers, 1, tipAngle - UP),
      seed: seedOf(rng),
    };
    stems.push(main);
    // a side shoot under the top whorls of a tall stem, with its own cluster
    if (plan.length > 120 && rng.chance(0.5)) {
      const pts = stemPoints(plan, 1, 1);
      const at = rng.range(0.55, 0.75);
      const node = pointAt(pts, at);
      const out = s === 0 ? (rng.chance(0.5) ? 1 : -1) : Math.sign(s);
      const offset = out * rng.range(0.3, 0.5);
      let side = makeStem(rng, { base: { x: node.x, y: node.y }, length: rng.range(36, 58), angle: node.angle + offset, bend: out * rng.range(0.05, 0.25), segments: 8, tipBias: 0.6, wobble: 0.02 });
      for (let k = 0; k < 24 && !fits(stemPoints(side, 1, 1)); k++) side = { ...side, length: side.length * 0.93 };
      const s0 = main.window[0] + (main.window[1] - main.window[0]) * at * 0.85;
      const sb = rng.chance(0.6) ? band : bandOf();
      const sideTip = pointAt(stemPoints(side, 1, 1), 1).angle;
      stems.push({
        plan: side,
        parent: stems.length - 1,
        at,
        offset,
        window: [s0, s0 + rng.range(0.26, 0.32)],
        width: rng.range(1.3, 1.6),
        band: sb,
        tone: toneOf(sb),
        nodes: nodesOf(rng, side.length, toneOf(sb), 0.2),
        flowers: clusterOf(rng, flowers, 0.92, sideTip - UP),
        seed: seedOf(rng),
      });
    }
  }
  // buds form once the leaves are out, and the pinwheels open from the earliest stems on
  const keyed = flowers.map((f) => ({ f, key: rng.next() }));
  const stemOf = new Map<number, Stem>();
  for (const st of stems) for (const f of st.flowers) stemOf.set(f.id, st);
  for (const k of keyed) k.key = stemOf.get(k.f.id)!.window[1] + k.key * 0.2;
  keyed.sort((a, b) => a.key - b.key);
  keyed.forEach(({ f }, k) => {
    f.grow = stagger(k, keyed.length, 0.5, 0.8, 0.4);
    f.open = f.bud ? [2, 3] : stagger(k, keyed.length, 0.72, 1, 0.4);
  });
  return { stems, flowers, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface OleanderPose {
  stems: (StemMark & { id: string; band: number })[];
  leaves: (KnifeLeaf & { id: string; band: number; group: number })[];
  flowers: (Pinwheel & { id: string; band: number })[];
}

interface Grown {
  pts: Pt[];
  ext: number;
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

function growStem(st: Stem, g: number, grown: (Grown | null)[]): Grown | null {
  const k = ramp(g, st.window[0], st.window[1]);
  if (k < 0.015) return null;
  let plan = st.plan;
  let gate = 1;
  if (st.parent >= 0) {
    const p = grown[st.parent];
    if (!p) return null;
    gate = smooth(clamp01((p.ext - st.at) / 0.12));
    const node = nodeAt(p, st.at);
    plan = { ...plan, base: { x: node.x, y: node.y }, angle: node.angle + st.offset };
  }
  const ext = lerp(0.03, 1, k) * smooth(k * 5) * gate;
  if (ext < 0.004) return null;
  return { pts: stemPoints(plan, ext, lerp(0.4, 1, smooth(k))), ext };
}

export function poseOleander(plant: Oleander, g: number): OleanderPose {
  const pose: OleanderPose = { stems: [], leaves: [], flowers: [] };
  const grown: (Grown | null)[] = [];
  plant.stems.forEach((st, i) => {
    const gs = growStem(st, g, grown);
    grown.push(gs);
    if (!gs) return;
    const thick = 0.4 + 0.6 * ramp(g, st.window[0], Math.min(1, st.window[1] + 0.25));
    const bark = mix(BARK, st.tone, st.parent < 0 ? 0.2 : 0.5);
    pose.stems.push({ id: `stem-${i}`, band: st.band, pts: gs.pts, width: st.width * thick * smooth(gs.ext * 5), pigment: bark, seed: st.seed });
    st.nodes.forEach((nd, j) => {
      const k = smooth(clamp01((gs.ext - nd.t * 0.85) / 0.3));
      if (k < 0.015) return;
      const node = nodeAt(gs, nd.t);
      nd.leaves.forEach((l, m) => {
        const e = 1 - (1 - k) ** 2;
        const angle = lerpAngle(node.angle, node.angle + (l.side === 0 ? l.turn : l.side * l.turn), smooth(k));
        const curve = (Math.cos(angle) >= 0 ? 1 : -1) * l.droop * k;
        pose.leaves.push({
          id: `leaf-${i}-${j}-${m}`,
          band: st.band,
          group: (j + m) % 2,
          at: { x: node.x, y: node.y },
          angle,
          length: l.length * e,
          width: l.width * e * lerp(0.4, 1, smooth(k)),
          curve,
          pigment: l.side === 0 ? lighten(l.tone, 0.04) : l.tone,
          under: UNDER,
          alpha: smooth(k * 4),
          shade: (Math.cos(angle) >= 0 ? 1 : -1) as 1 | -1,
          seed: l.seed,
        });
      });
    });
    const tip = nodeAt(gs, 1);
    const tipK = smooth(clamp01((gs.ext - 0.9) / 0.1));
    st.flowers.forEach((f) => {
      const kk = tipK * ramp(g, f.grow[0], f.grow[1]);
      if (kk < 0.012) return;
      const open = ramp(g, f.open[0], f.open[1]);
      const at = { x: tip.x + f.dx * kk, y: tip.y + f.dy * kk };
      pose.stems.push({ id: `ped-${f.id}`, band: st.band, pts: [{ x: tip.x, y: tip.y }, at], width: 0.6 * kk, pigment: mix(BARK, st.tone, 0.7), seed: f.seed + 5, taper: 0.3 });
      pose.flowers.push({
        id: `flower-${f.id}`,
        band: st.band,
        at,
        radius: f.radius * kk,
        facing: f.facing,
        squash: f.squash,
        roll: f.roll + open * 0.5,
        open,
        budAngle: f.budAngle,
        alpha: smooth(kk * 4),
        seed: f.seed,
      });
    });
  });
  return pose;
}

const oleander: SpeciesDef = {
  id: 'oleander',
  name: 'Oleander',
  nativeName: 'Defla',
  nativeLang: 'ary-Latn',
  // the riparian scrub of wadis and seasonal riverbeds, from the Sahara's edge round the Mediterranean
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'wetland'], climates: ['arid', 'warm-temperate'] },
  tier: 3,
  habitats: ['shore', 'back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Oleander — pink pinwheels in the dry bed of the oued.',
  bloomColor: PINK,
  pollinators: false,
  draw(p, rng, opts) {
    const plant = buildOleander(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, oleander, () => {
      groundShadow(p, plant.seeds.ground, g, 0, 30, 5, 0.2);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 10, green: lighten(LEAF, 0.1), handover: 0.24 });
      const pose = poseOleander(plant, g);
      const style = { petal: PINK, reverse: PALE, deep: DEEP };
      for (const band of [0, 1, 2]) {
        const op = band === 0 ? 0.74 : 0.88;
        paintStems(p, pose.stems.filter((c) => c.band === band), { opacity: op, accent: mix(BARK, PIGMENTS.sumi, 0.35), accentOpacity: 0.3 });
        for (const group of [0, 1]) paintKnifeLeaves(p, pose.leaves.filter((l) => l.band === band && l.group === group), { opacity: op });
        paintPinwheels(p, pose.flowers.filter((f) => f.band === band), { ...style, alpha: band === 0 ? 0.9 : 1 });
      }
    });
  },
};

export default oleander;
