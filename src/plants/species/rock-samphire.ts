import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import {
  fingerGeometry,
  paintFingers,
  paintStalks,
  paintUmbels,
  type FingerMark,
  type StalkMark,
  type UmbelMark,
} from '../lib/rock-samphire-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { groundShadow, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, makeStem, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Rock samphire (Crithmum maritimum): a low, sprawling cushion of fat, smooth, forked leaf
 * fingers, glaucous sea-green with yellow or red-purple tips, growing from a crack; flat
 * umbels of tiny lime-cream flowers stand on stout stalks above it and ripen olive and purple.
 */

const LEAF = '#8cb08c';
const LEAF_LIGHT = '#a7c6a4';
const LEAF_DEEP = '#5d8776';
const YELLOW = '#dbd47a';
const PURPLE = '#a86f8c';
const STALK = '#b4c996';
const STALK_DEEP = '#8aa872';
const BUD = '#a7bf7e';
const LIME = '#dde19b';
const LIME_DEEP = '#a4b560';
const RAY = '#98ad68';
const RIPE = '#aaa56a';
const RIPE_PURPLE = '#9a7e92';

const ANCHOR = { x: 0.5, y: 0.8 };

interface FingerPlan {
  id: string;
  parent: string | null;
  gen: number;
  bx: number;
  angle: number;
  len: number;
  wid: number;
  bend: number;
  tone: number;
  yellow: number;
  red: number;
  window: [number, number];
  seed: number;
}

interface UmbelPlan {
  stalk: StemPlan;
  window: [number, number];
  width: number;
  rx: number;
  ry: number;
  tilt: number;
  age: number;
  clusters: [number, number][];
  seed: number;
}

export interface RockSamphire {
  foot: number;
  fingers: FingerPlan[];
  umbels: UmbelPlan[];
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

export function buildRockSamphire(rng: Rng): RockSamphire {
  const foot = rng.range(-2, 2);
  const fingers: FingerPlan[] = [];
  const stems = rng.int(12, 14);
  const GEN_LEN = [1, 0.86, 0.74];
  const GEN_WID = [1, 0.88, 0.78];
  for (let i = 0; i < stems; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.25, 0.75)) / stems);
    const au = Math.abs(u);
    const start = 0.05 + au * 0.22 + rng.range(0, 0.03);
    const base = UP + u * rng.range(1.3, 1.45) + rng.gaussian(0, 0.09);
    const len0 = lerp(8, 7, au) * rng.range(0.85, 1.12);
    const wid0 = rng.range(2.9, 3.5);
    const droop = Math.sign(u || 1) * rng.range(0.05, 0.14) * au;
    const bx = u * rng.range(5, 8);
    const grow = (parent: string | null, gen: number, angle: number, id: string, len: number, wid: number, bx = 0): void => {
      const bend = droop + rng.gaussian(0, 0.04);
      const w0 = start + gen * 0.07;
      fingers.push({
        id,
        parent,
        gen,
        bx,
        angle,
        len: len * GEN_LEN[gen]! * rng.range(0.92, 1.08),
        wid: wid * GEN_WID[gen]!,
        bend,
        tone: rng.next(),
        yellow: gen === 2 && rng.chance(0.28) ? rng.range(0.6, 1) : 0,
        red: gen < 2 && au > 0.35 && rng.chance(0.4) ? rng.range(0.4, 0.8) : 0,
        window: [w0, w0 + 0.3],
        seed: seedOf(rng),
      });
      if (gen >= 2) return;
      const out = angle + Math.atan(2 * bend);
      const fork = rng.chance(0.3) ? 3 : 2;
      for (let c = 0; c < fork; c++) {
        const t = fork === 2 ? (c === 0 ? -1 : 1) : c - 1;
        const off = t * rng.range(0.4, 0.62) + rng.gaussian(0, 0.07);
        grow(id, gen + 1, out + off, `${id}-${c}`, len, wid);
      }
    };
    grow(null, 0, base, `s${i}`, len0, wid0, bx);
  }

  const n = rng.int(6, 7);
  const umbels: UmbelPlan[] = [];
  for (let i = 0; i < n; i++) {
    const x = lerp(-18, 18, (i + rng.range(0.2, 0.8)) / n);
    const lean = (x / 16) * 0.42 + rng.gaussian(0, 0.08);
    const length = lerp(26, 15, Math.abs(x) / 19) * (i % 2 ? rng.range(0.7, 0.85) : rng.range(0.95, 1.12));
    const stalk = makeStem(rng, { base: { x, y: -rng.range(7, 11) }, length, angle: UP + lean, bend: -lean * 0.4, segments: 3, tipBias: 0.2, wobble: 0.02 });
    const w0 = 0.58 + rng.range(0, 0.1);
    const cl: [number, number][] = [];
    const m = rng.int(13, 16);
    for (let j = 0; j < m; j++) cl.push([j < 4 ? rng.range(0.1, 0.45) : rng.range(0.55, 1), j * 2.399963 + rng.range(-0.25, 0.25)]);
    umbels.push({
      stalk,
      window: [w0, w0 + 0.3],
      width: rng.range(0.8, 1),
      rx: rng.range(4.6, 5.6),
      ry: rng.range(2.1, 2.6),
      tilt: rng.gaussian(0, 0.1) + lean * 0.4,
      age: i === 0 || rng.chance(0.12) ? rng.range(0.6, 1) : rng.range(0, 0.25),
      clusters: cl,
      seed: seedOf(rng),
    });
  }
  return { foot, fingers, umbels, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface RockSamphirePose {
  fingers: (FingerMark & { id: string })[];
  stalks: (StalkMark & { id: string })[];
  umbels: (UmbelMark & { id: string })[];
}

export function poseRockSamphire(plant: RockSamphire, g: number): RockSamphirePose {
  const pose: RockSamphirePose = { fingers: [], stalks: [], umbels: [] };
  const tips = new Map<string, Pt>();
  const foot: Pt = { x: plant.foot, y: -1 };
  for (const f of plant.fingers) {
    const base = f.parent ? tips.get(f.parent) : { x: foot.x + f.bx, y: foot.y };
    if (!base) continue;
    const k = ramp(g, f.window[0], f.window[1]);
    if (k < 0.012) continue;
    const spec = { base, angle: f.angle, len: f.len * lerp(0.12, 1, smooth(k)), wid: f.wid * lerp(0.3, 1, smooth(k)), bend: f.bend };
    const geom = fingerGeometry(spec);
    tips.set(f.id, geom.tip);
    const yellow = f.yellow * ramp(g, 0.5, 0.92);
    const red = f.red * ramp(g, 0.62, 1);
    pose.fingers.push({
      id: f.id,
      geom,
      pigment: mix(LEAF, LEAF_LIGHT, f.tone * 0.8),
      deep: LEAF_DEEP,
      tint: yellow >= red ? YELLOW : PURPLE,
      tintK: Math.max(yellow, red),
      seed: f.seed,
      alpha: smooth(k * 3),
    });
  }

  for (const [i, u] of plant.umbels.entries()) {
    const k = ramp(g, u.window[0], u.window[0] + 0.18);
    if (k < 0.012) continue;
    const pts = stemPoints(u.stalk, lerp(0.05, 1, smooth(k)), lerp(0.4, 1, smooth(k)));
    const end = pts[pts.length - 1]!;
    const size = smooth(ramp(g, u.window[0] + 0.1, u.window[0] + 0.3));
    pose.stalks.push({ id: `stalk-${i}`, pts, width: u.width * (0.45 + 0.55 * smooth(k * 1.5)), pigment: STALK, deep: STALK_DEEP, seed: u.seed + 1 });
    if (size < 0.02) continue;
    const open = ramp(g, u.window[0] + 0.14, u.window[1] + 0.05);
    const R = lerp(0.3, 1, size);
    const ageK = u.age * ramp(g, 0.82, 1);
    const body = mix(mix(BUD, LIME, smooth(open * 1.3)), mix(RIPE, RIPE_PURPLE, clamp01((ageK - 0.55) * 2.2)), ageK);
    pose.umbels.push({
      id: `umbel-${i}`,
      at: { x: end.x, y: end.y - u.ry * R * 0.4 },
      rx: u.rx * R,
      ry: u.ry * R,
      rot: u.tilt,
      alpha: smooth(size * 2.5),
      open: lerp(0.35, 1, open),
      pigment: body,
      deep: mix(LIME_DEEP, RIPE_PURPLE, clamp01((ageK - 0.4) * 1.5)),
      ray: RAY,
      age: ageK,
      clusters: u.clusters,
      seed: u.seed,
    });
  }
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function rockSamphireReach(plant: RockSamphire): Pt[] {
  const pose = poseRockSamphire(plant, 1);
  return [
    ...pose.fingers.flatMap((f) => f.geom.outline),
    ...pose.stalks.flatMap((s) => s.pts),
    ...pose.umbels.flatMap((u) => [{ x: u.at.x - u.rx * 1.05, y: u.at.y - u.ry * 1.3 }, { x: u.at.x + u.rx * 1.05, y: u.at.y + u.ry * 1.3 }]),
  ];
}

const rockSamphire: SpeciesDef = {
  id: 'rock-samphire',
  name: 'Rock samphire',
  nativeName: 'Kritamo',
  nativeLang: 'el-Latn',
  // wild on Mediterranean (and Atlantic European) rocky shores
  range: { realms: ['mediterranean', 'europe'], biomes: ['coast'], climates: ['mediterranean'] },
  tier: 1,
  habitats: ['rock', 'shore'],
  sizeClass: 'small',
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: ANCHOR.x, y: ANCHOR.y },
  description: 'Rock samphire: a fleshy green cushion in a crack, crowned with lime plates.',
  bloomColor: '#cfd28a',
  pollinators: true,
  draw(p: Painter, rng: Rng, opts) {
    const plant = buildRockSamphire(rng);
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = createRng(plant.seeds.ground);
      crack(p, r, g, plant.foot);
      groundShadow(p, r, { rx: 26, ry: 4.5, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.14, pigment: SHADOW });
      seedMound(p, r, g, { rx: 8, x: plant.foot });
      const pose = poseRockSamphire(plant, g);
      paintStalks(p, pose.stalks);
      paintFingers(p, pose.fingers);
      paintUmbels(p, pose.umbels);
    } finally {
      end();
    }
  },
};

const SHADOW: Pigment = '#7e948c';
const CRACK: Pigment = mix(PIGMENTS.shadow, PIGMENTS.stoneWarm, 0.3);

/** The dark rift the cushion grows out of. */
function crack(p: Painter, rng: Rng, g: number, x: number): void {
  const k = ramp(g, 0.02, 0.3);
  if (k < 0.02) return;
  p.wash({ cx: x, cy: 0.6, rx: 13 * k, ry: 1.7 }, CRACK, { rng: rng.fork('crack'), opacity: 0.3 * k, edge: 0.4, sharpness: 0.5, centreLift: 0.05, granulation: 0.3 });
}

export default rockSamphire;
