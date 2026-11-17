import { createRng, type Rng } from '../../core/rng';
import { mix, type Pt } from '../../paint';
import {
  flowerReach,
  leafGeometry,
  paintFlowers,
  paintLeaves,
  paintLitter,
  paintMass,
  paintTwigs,
  type FlowerMark,
  type LeafMark,
  type LitterMark,
  type MassMark,
  type PetalPlan,
  type Reserve,
  type TwigMark,
} from '../lib/rock-rose-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound, shadowSide } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Pink rock rose (Cistus creticus): a low, rounded, twiggy shrub of grey-green felted leaves in
 * opposite pairs, scattered with flat crumpled-petal pink flowers round a yellow boss. Buds, open
 * flowers and fallen petals show together, as each flower lasts a day.
 */

const LEAF = '#aab6a2';
const LEAF_WARM = '#a7aa88';
const LEAF_DEEP = '#647a66';
const MASS = '#a8b499';
const TWIG = '#b0a699';
const TWIG_DEEP = '#5f5448';
const BLOOM = '#c9609a';
const SHADOW = '#8a9a98';

const BOX = { w: 86, h: 86, ax: 0.5, ay: 0.92 };
const DOME = { cx: 0, cy: -23, rx: 33, ry: 24 };

interface TwigPlan {
  id: string;
  parent: string | null;
  attach: number;
  stem: StemPlan;
  window: [number, number];
  width: number;
  seed: number;
  pairs: number;
  /** leaf size factor, felt tone */
  size: number;
}

interface PairPlan {
  twig: string;
  t: number;
  len: number;
  wid: number;
  spread: number;
  tone: number;
  wave: number;
  phase: number;
  seed: number;
}

interface FlowerPlan {
  at: Pt;
  R: number;
  ty: number;
  rot: number;
  /** growth at which the bud shows and at which it opens */
  bud: number;
  opens: number;
  /** the most it opens by growth 1: a bud stays a bud, one is half open */
  cap: number;
  petals: PetalPlan[];
  stamens: [number, number][];
  seed: number;
}

export interface RockRose {
  foot: number;
  twigs: TwigPlan[];
  pairs: PairPlan[];
  mass: { cx: number; cy: number; rx: number; ry: number; seed: number; tone: number }[];
  flowers: FlowerPlan[];
  litter: { x: number; y: number; len: number; rot: number; seed: number; tone: number; at: number }[];
  seeds: { ground: number };
}

const TAU_ = Math.PI * 2;
const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

export function buildRockRose(rng: Rng): RockRose {
  const foot = rng.range(-2, 2);
  const twigs: TwigPlan[] = [];
  const add = (id: string, parent: string | null, attach: number, base: Pt, angle: number, length: number, bend: number, window: [number, number], width: number, pairs: number, size: number) =>
    twigs.push({ id, parent, attach, stem: makeStem(rng, { base, length, angle, bend, segments: 4, tipBias: 0.3, wobble: 0.09 }), window, width, seed: seedOf(rng), pairs, size });

  const nMain = 7;
  for (let i = 0; i < nMain; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.25, 0.75)) / nMain);
    const phi = u * 1.45;
    const rho = rng.range(0.78, 0.9);
    const tip = { x: DOME.cx + Math.sin(phi) * DOME.rx * rho, y: DOME.cy - Math.cos(phi) * DOME.ry * rho };
    const base = { x: foot + rng.range(-2.5, 2.5), y: 0 };
    const dx = tip.x - base.x;
    const dy = tip.y - base.y;
    const central = 1 - Math.abs(u);
    const w0 = 0.07 + 0.06 * (1 - central) + rng.range(0, 0.03);
    add(`m${i}`, null, 0, base, Math.atan2(dy, dx), Math.hypot(dx, dy), -u * 0.35, [w0, w0 + 0.27], 0.85, 10, 1);
  }
  const forks: { parent: number; side: 1 | -1 }[] = [];
  for (let i = 0; i < nMain; i++) {
    forks.push({ parent: i, side: i % 2 ? 1 : -1 });
    forks.push({ parent: i, side: i % 2 ? -1 : 1 });
  }
  forks.forEach((f, k) => {
    const main = twigs[f.parent]!;
    const w0 = main.window[0] + 0.2 + rng.range(0, 0.06);
    add(`f${k}`, main.id, rng.range(0.5, 0.78), { x: 0, y: 0 }, UP + f.side * rng.range(0.35, 0.8), rng.range(10, 15), f.side * rng.range(0.1, 0.35), [w0, w0 + 0.22], 0.6, 5, 0.9);
  });

  const pairs: PairPlan[] = [];
  for (const tw of twigs) {
    for (let j = 0; j < tw.pairs; j++) {
      const t = tw.pairs === 1 ? 1 : lerp(0.06, 1, j / (tw.pairs - 1));
      pairs.push({
        twig: tw.id,
        t,
        len: rng.range(5.6, 7.2) * tw.size,
        wid: rng.range(3.7, 4.6) * tw.size,
        spread: rng.range(0.9, 1.25),
        tone: rng.next(),
        wave: rng.range(0.1, 0.2),
        phase: rng.range(0, 6.28),
        seed: seedOf(rng),
      });
    }
  }

  const mass: RockRose['mass'] = [];
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, 6.28);
    const d = i === 0 ? 0 : rng.range(0.15, 0.35);
    mass.push({
      cx: DOME.cx + Math.cos(a) * DOME.rx * d,
      cy: DOME.cy + Math.sin(a) * DOME.ry * d * 0.8,
      rx: DOME.rx * rng.range(0.45, 0.7),
      ry: DOME.ry * rng.range(0.45, 0.7),
      seed: seedOf(rng),
      tone: rng.next(),
    });
  }

  const nFlower = 13;
  const flowers: FlowerPlan[] = [];
  const order = rng.shuffle(Array.from({ length: nFlower }, (_, i) => i));
  for (let i = 0; i < nFlower; i++) {
    const theta = -Math.PI + 0.06 + ((i + rng.range(0.15, 0.85)) / nFlower) * (Math.PI - 0.12);
    const rho = i % 3 === 0 ? rng.range(0.86, 0.96) : rng.range(0.45, 0.8);
    const at = { x: DOME.cx + Math.cos(theta) * DOME.rx * rho, y: DOME.cy + Math.sin(theta) * DOME.ry * rho + 1 };
    const rank = order[i]!;
    const opens = 0.56 + (rank / nFlower) * 0.34 + rng.range(-0.02, 0.02);
    const cap = rank >= nFlower - 2 ? 0.16 : rank === nFlower - 3 ? 0.58 : 1;
    const face = clamp01((-Math.sin(theta) - 0.2) / 0.8);
    const rot0 = rng.range(0, TAU_);
    flowers.push({
      at,
      R: rng.range(5.2, 6.6),
      ty: lerp(0.42, 0.95, face) * rng.range(0.9, 1.05),
      rot: Math.cos(theta) * 0.35 + rng.gaussian(0, 0.12),
      bud: opens - 0.14,
      opens,
      cap,
      petals: Array.from({ length: 5 }, (_, k) => ({
        ang: rot0 + (k / 5) * TAU_ + rng.range(-0.12, 0.12),
        len: rng.range(0.9, 1.08),
        wid: rng.range(1.15, 1.35),
        phase: rng.range(0, 6.28),
        seed: seedOf(rng),
        tone: rng.range(0, 0.4),
      })),
      stamens: Array.from({ length: 12 }, (_, k) => [rng.range(0.08, 0.27), (k / 12) * TAU_ + rng.range(-0.3, 0.3)] as [number, number]),
      seed: seedOf(rng),
    });
  }

  const litter = Array.from({ length: 7 }, (_, i) => ({
    x: foot + lerp(-34, 34, (i + rng.range(0.2, 0.8)) / 7),
    y: rng.range(0.4, 3.8),
    len: rng.range(2.3, 3.4),
    rot: rng.range(-0.5, 0.5),
    seed: seedOf(rng),
    tone: rng.range(0, 0.6),
    at: 0.62 + (i / 7) * 0.3,
  }));
  return { foot, twigs, pairs, mass, flowers, litter, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface RockRosePose {
  mass: MassMark[];
  twigs: (TwigMark & { id: string })[];
  leaves: (LeafMark & { id: string; angle: number; len: number })[];
  flowers: (FlowerMark & { id: string })[];
  litter: LitterMark[];
  reserves: Reserve[];
}

export function poseRockRose(plant: RockRose, g: number): RockRosePose {
  const pose: RockRosePose = { mass: [], twigs: [], leaves: [], flowers: [], litter: [], reserves: [] };
  const ends = new Map<string, { pts: Pt[]; k: number }>();

  const massK = smooth(ramp(g, 0.16, 0.62));
  plant.mass.forEach((m, i) => {
    const k = massK * lerp(0.6, 1, i / 6);
    pose.mass.push({
      cx: m.cx,
      cy: lerp(-6, m.cy, massK),
      rx: m.rx * lerp(0.15, 1, massK),
      ry: m.ry * lerp(0.15, 1, massK),
      seed: m.seed,
      alpha: smooth(ramp(g, 0.14, 0.34)) * (0.7 + 0.3 * k),
      pigment: mix(MASS, LEAF_WARM, m.tone * 0.5),
    });
  });

  for (const tw of plant.twigs) {
    const par = tw.parent ? ends.get(tw.parent) : null;
    if (tw.parent && !par) continue;
    const k = ramp(g, tw.window[0], tw.window[1]);
    if (k < 0.012) continue;
    let base = tw.stem.base;
    if (par) {
      const at = pointAt(par.pts, tw.attach);
      base = { x: at.x, y: at.y };
    }
    const dir = par ? pointAt(par.pts, tw.attach).angle + (tw.stem.angle - UP) : tw.stem.angle;
    const pts = stemPoints({ ...tw.stem, base, angle: dir }, lerp(0.06, 1, smooth(k)), lerp(0.5, 1, smooth(k)));
    ends.set(tw.id, { pts, k });
    pose.twigs.push({
      id: tw.id,
      pts,
      width: tw.width * (0.5 + 0.5 * smooth(k * 1.4)),
      pigment: mix(TWIG, LEAF_DEEP, 0.12),
      deep: TWIG_DEEP,
      seed: tw.seed,
    });
  }

  plant.pairs.forEach((pr, idx) => {
    const tw = plant.twigs.find((t) => t.id === pr.twig)!;
    const st = ends.get(pr.twig);
    if (!st) return;
    const w0 = tw.window[0] + pr.t * (tw.window[1] - tw.window[0]) * 0.55;
    const k = ramp(g, w0, w0 + 0.14);
    if (k < 0.015) return;
    const at = pointAt(st.pts, pr.t);
    const size = lerp(0.3, 1, smooth(k));
    for (const s of [-1, 1] as const) {
      const angle = at.angle + s * pr.spread;
      const geom = leafGeometry(at, angle, pr.len * size, pr.wid * lerp(0.3, 1, smooth(k)), pr.wave, pr.phase + s, shadowSide(angle));
      pose.leaves.push({
        id: `leaf-${idx}${s > 0 ? 'r' : 'l'}`,
        geom,
        pigment: mix(LEAF, LEAF_WARM, pr.tone * 0.6),
        deep: LEAF_DEEP,
        seed: pr.seed + s,
        alpha: smooth(k * 3),
        angle,
        len: pr.len * size,
      });
    }
  });

  plant.flowers.forEach((f, i) => {
    const size = smooth(ramp(g, f.bud, f.bud + 0.1));
    if (size < 0.02) return;
    const open = Math.min(f.cap, ramp(g, f.opens, f.opens + 0.14));
    const unfurl = smooth(open);
    const R = f.R * lerp(0.42, 1, unfurl) * lerp(0.3, 1, size);
    const bud = 1 - smooth(ramp(open, 0.12, 0.42));
    const mark: FlowerMark & { id: string } = {
      id: `flower-${i}`,
      at: f.at,
      R,
      ty: f.ty,
      rot: f.rot,
      open,
      bud,
      alpha: smooth(size * 2.5),
      petals: f.petals,
      stamens: f.stamens,
      seed: f.seed,
    };
    pose.flowers.push(mark);
    const hole = (1 - bud) * mark.alpha;
    if (hole > 0.02) pose.reserves.push({ at: f.at, rx: R * 0.85, ry: R * 0.85 * f.ty + 0.3, amount: 0.55 * hole });
  });

  for (const l of plant.litter) {
    const k = smooth(ramp(g, l.at, l.at + 0.1));
    pose.litter.push({ at: { x: l.x, y: l.y }, len: l.len * lerp(0.3, 1, k), rot: l.rot, seed: l.seed, alpha: k, tone: l.tone });
  }
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function rockRoseReach(plant: RockRose): Pt[] {
  const pose = poseRockRose(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.geom.outline),
    ...pose.twigs.flatMap((s) => s.pts),
    ...pose.flowers.flatMap((f) => flowerReach(f, f.R * 1.05)),
    ...pose.litter.flatMap((m) => [{ x: m.at.x - m.len, y: m.at.y - m.len * 0.55 }, { x: m.at.x + m.len, y: m.at.y + m.len * 0.55 }]),
    ...pose.mass.flatMap((m) => [{ x: m.cx - m.rx, y: m.cy - m.ry }, { x: m.cx + m.rx, y: m.cy + m.ry }]),
  ];
}

const rockRose: SpeciesDef = {
  id: 'rock-rose',
  name: 'Pink rock rose',
  nativeName: 'Kistos',
  nativeLang: 'el-Latn',
  // wild in the eastern and central Mediterranean scrub and on its rocky coasts
  range: { realms: ['mediterranean'], biomes: ['scrub', 'coast'], climates: ['mediterranean'] },
  tier: 2,
  habitats: ['back', 'path'],
  sizeClass: 'small',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Pink rock rose: crumpled silk blooms on a grey-green mound.',
  bloomColor: BLOOM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildRockRose(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, rockRose, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 34, ry: 5, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.24, pigment: SHADOW });
      seedMound(p, r, g, { rx: 9, x: plant.foot });
      const pose = poseRockRose(plant, g);
      paintLitter(p, pose.litter);
      paintMass(p, pose.mass, pose.reserves);
      paintTwigs(p, pose.twigs, pose.reserves);
      paintLeaves(p, pose.leaves, pose.reserves);
      paintFlowers(p, pose.flowers);
    });
  },
};

export default rockRose;
