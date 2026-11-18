import { createRng, type Rng } from '../../core/rng';
import { mix, type Pt } from '../../paint';
import {
  leafGeometry,
  paintLeaves,
  paintMass,
  paintStems,
  paintWhorls,
  whorlReach,
  type LeafMark,
  type MassMark,
  type Reserve,
  type StemMark,
  type WhorlFlower,
  type WhorlMark,
} from '../lib/jerusalem-sage-paint';
import { lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound, shadowSide } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Jerusalem sage (Phlomis fruticosa): a rounded mound of felted, wrinkled grey-green leaves with
 * pale woolly undersides, and over it upright stems carrying two or three stacked whorls of hooded
 * golden-yellow flowers, one tier above another.
 */

const LEAF = '#9fae94';
const LEAF_WARM = '#a9ab8a';
const UNDER = '#d4d8c2';
const LEAF_DEEP = '#62755f';
const MASS = '#a2ae96';
const MASS_SHADE = '#7a8a74';
const STEM = '#aeb092';
const STEM_DEEP = '#7c8468';
const SHADOW = '#8a9a98';

const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.94 };
const DOME = { cx: 0, cy: -28, rx: 46, ry: 28 };

interface ClusterPlan {
  x: number;
  y: number;
  /** the shoot's outward direction */
  dir: number;
  window: [number, number];
  leaves: { spread: number; len: number; wid: number; under: boolean; tone: number; wave: number; phase: number; seed: number }[];
}

interface WhorlPlan {
  t: number;
  R: number;
  opens: number;
  flowers: WhorlFlower[];
  seed: number;
}

interface StemPlanJ {
  stem: StemPlan;
  window: [number, number];
  width: number;
  whorls: WhorlPlan[];
  bracts: { len: number; wid: number; tone: number; seed: number }[];
  seed: number;
}

export interface JerusalemSage {
  foot: number;
  clusters: ClusterPlan[];
  mass: { cx: number; cy: number; rx: number; ry: number; seed: number; tone: number; shade: boolean }[];
  stems: StemPlanJ[];
  seeds: { ground: number };
}

const TAU_ = Math.PI * 2;
const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);
const surface = (x: number) => DOME.cy - DOME.ry * Math.sqrt(Math.max(0, 1 - (x / DOME.rx) ** 2));

export function buildJerusalemSage(rng: Rng): JerusalemSage {
  const foot = rng.range(-2, 2);

  const n = 30;
  const raw: Omit<ClusterPlan, 'window'>[] = [];
  for (let i = 0; i < n; i++) {
    let u = 0;
    let v = 0;
    do {
      u = rng.range(-1, 1);
      v = rng.range(-1, 1);
    } while (u * u + v * v > 1 || DOME.cy + v * DOME.ry > -7);
    const x = DOME.cx + u * DOME.rx * 0.8;
    const y = DOME.cy + v * DOME.ry * 0.88;
    const dir = Math.atan2(v * 0.9 - 0.45, u);
    const leaves = [];
    for (const [spread, size] of [
      [0.25, 0.5],
      [0.7, 0.8],
      [1.15, 0.95],
    ] as const) {
      const sp = spread * rng.range(0.85, 1.15);
      for (const s of [-1, 1]) {
        leaves.push({
          spread: s * sp,
          len: rng.range(9.5, 12) * size,
          wid: rng.range(5.6, 6.8) * (0.75 + 0.25 * size),
          under: rng.chance(0.28),
          tone: rng.next(),
          wave: rng.range(0.05, 0.12),
          phase: rng.range(0, 6.28),
          seed: seedOf(rng),
        });
      }
    }
    raw.push({ x, y, dir, leaves });
  }
  const order = raw.map((c, i) => ({ i, d: Math.hypot(c.x / DOME.rx, (c.y + 6) / (DOME.ry * 2)) })).sort((a, b) => a.d - b.d);
  const clusters: ClusterPlan[] = new Array(n);
  order.forEach(({ i }, rank) => {
    const w0 = 0.05 + (rank / n) * 0.42;
    clusters[i] = { ...raw[i]!, window: [w0, w0 + 0.16] };
  });
  clusters.sort((a, b) => a.y - b.y);

  const mass: JerusalemSage['mass'] = [];
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, 6.28);
    const d = i === 0 ? 0 : rng.range(0.15, 0.35);
    mass.push({
      cx: DOME.cx + Math.cos(a) * DOME.rx * d,
      cy: DOME.cy + Math.sin(a) * DOME.ry * d * 0.8,
      rx: DOME.rx * rng.range(0.5, 0.72),
      ry: DOME.ry * rng.range(0.5, 0.72),
      seed: seedOf(rng),
      tone: rng.next(),
      shade: false,
    });
  }
  mass.push({ cx: DOME.cx + 4, cy: -10, rx: DOME.rx * 0.7, ry: 9, seed: seedOf(rng), tone: 0, shade: true });

  const nStem = rng.int(4, 6);
  const stems: StemPlanJ[] = [];
  const stemOrder = rng.shuffle(Array.from({ length: nStem }, (_, i) => i));
  for (let i = 0; i < nStem; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.1, 0.9)) / nStem);
    const central = 1 - Math.abs(u);
    const bx = foot + DOME.cx + u * DOME.rx * 0.55;
    const by = surface(u * DOME.rx * 0.55) + 12;
    const lean = u * 0.16 + rng.gaussian(0, 0.07);
    const top = -(rng.range(80, 112) + central * 4);
    const length = (by - top) / Math.cos(lean);
    const gap = rng.range(15, 18);
    const nWhorl = top + 2 * gap < -64 && !rng.chance(0.2) ? 3 : 2;
    const w0 = 0.46 + (stemOrder[i]! / nStem) * 0.1;
    const whorls: WhorlPlan[] = [];
    for (let k = 0; k < nWhorl; k++) {
      const fromTop = k;
      const t = 1 - (fromTop * gap) / length;
      const R = fromTop === 0 ? rng.range(5.6, 6.4) : rng.range(7.2, 8.4);
      const fromBottom = nWhorl - 1 - k;
      const opens = 0.64 + fromBottom * 0.075 + (stemOrder[i]! / nStem) * 0.04 + rng.range(0, 0.015);
      const nf = fromTop === 0 ? rng.int(10, 12) : rng.int(14, 17);
      const rot = rng.range(0, TAU_);
      whorls.push({
        t,
        R,
        opens,
        flowers: Array.from({ length: nf }, (_, j) => ({
          phi: rot + (j / nf) * TAU_ + rng.range(-0.15, 0.15),
          len: rng.range(0.85, 1),
          arch: rng.range(0.6, 1),
          tone: rng.next(),
          lag: rng.range(0, 0.3),
          seed: seedOf(rng),
        })),
        seed: seedOf(rng),
      });
    }
    stems.push({
      stem: makeStem(rng, { base: { x: bx, y: by }, length, angle: UP + lean, bend: -lean * 0.25, segments: 5, tipBias: 0.3, wobble: 0.03 }),
      window: [w0, w0 + 0.22],
      width: rng.range(1.3, 1.6),
      whorls,
      bracts: whorls.map(() => ({ len: rng.range(6.5, 8.5), wid: rng.range(3.6, 4.4), tone: rng.next(), seed: seedOf(rng) })),
      seed: seedOf(rng),
    });
  }
  return { foot, clusters, mass, stems, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface JerusalemSagePose {
  mass: MassMark[];
  leaves: (LeafMark & { id: string; len: number })[];
  stems: (StemMark & { id: string })[];
  bracts: (LeafMark & { id: string; len: number })[];
  whorls: (WhorlMark & { id: string })[];
  reserves: Reserve[];
}

export function poseJerusalemSage(plant: JerusalemSage, g: number): JerusalemSagePose {
  const pose: JerusalemSagePose = { mass: [], leaves: [], stems: [], bracts: [], whorls: [], reserves: [] };

  const spread = lerp(0.28, 1, smooth(ramp(g, 0.06, 0.5)));
  const massK = smooth(ramp(g, 0.18, 0.55));
  plant.mass.forEach((m) => {
    pose.mass.push({
      cx: plant.foot + m.cx * spread,
      cy: m.cy * spread,
      rx: m.rx * lerp(0.2, 1, massK),
      ry: m.ry * lerp(0.2, 1, massK),
      seed: m.seed,
      alpha: massK * (m.shade ? 0.8 : 1),
      pigment: m.shade ? MASS_SHADE : mix(MASS, LEAF_WARM, m.tone * 0.5),
    });
  });

  plant.clusters.forEach((c, ci) => {
    const k = ramp(g, c.window[0], c.window[1]);
    if (k < 0.012) return;
    const at = { x: plant.foot + c.x * spread, y: c.y * spread };
    const size = lerp(0.25, 1, smooth(k));
    c.leaves.forEach((l, li) => {
      const angle = c.dir + l.spread * lerp(0.6, 1, smooth(k));
      const len = l.len * size;
      const geom = leafGeometry(at, angle, len, l.wid * size, l.wave, l.phase, shadowSide(angle));
      pose.leaves.push({
        id: `leaf-${ci}-${li}`,
        geom,
        pigment: l.under ? mix(UNDER, LEAF, 0.15) : mix(LEAF, LEAF_WARM, l.tone * 0.6),
        deep: LEAF_DEEP,
        shade: l.under ? 0.35 : 1,
        seed: l.seed,
        alpha: smooth(k * 3),
        len,
      });
    });
  });

  plant.stems.forEach((s, si) => {
    const k = ramp(g, s.window[0], s.window[1]);
    if (k < 0.012) return;
    const pts = stemPoints(s.stem, lerp(0.05, 1, smooth(k)), lerp(0.5, 1, smooth(k)));
    pose.stems.push({ id: `stem-${si}`, pts, width: s.width * (0.5 + 0.5 * smooth(k)), pigment: STEM, deep: STEM_DEEP, seed: s.seed });
    s.whorls.forEach((w, wi) => {
      const appear = smooth(ramp(g, s.window[0] + 0.04 + (1 - w.t) * 0.05, s.window[1] + 0.02));
      if (appear < 0.02) return;
      const at = pointAt(pts, w.t);
      const open = ramp(g, w.opens, w.opens + 0.14);
      const R = w.R * lerp(0.3, 1, appear);
      pose.whorls.push({ id: `whorl-${si}-${wi}`, at: { x: at.x, y: at.y }, R, open, alpha: smooth(appear * 2), flowers: w.flowers, seed: w.seed });
      pose.reserves.push({ at: { x: at.x, y: at.y }, rx: R * 1.05, ry: R * 0.7, amount: 0.5 * smooth(open) });
      const b = s.bracts[wi]!;
      const bAt = pointAt(pts, Math.max(0, w.t - 0.035));
      for (const side of [-1, 1] as const) {
        const angle = bAt.angle + side * 1.9;
        const len = b.len * appear * (wi === 0 ? 0.75 : 1);
        pose.bracts.push({
          id: `bract-${si}-${wi}${side > 0 ? 'r' : 'l'}`,
          geom: leafGeometry({ x: bAt.x, y: bAt.y }, angle, len, b.wid * appear, 0.06, b.seed, shadowSide(angle)),
          pigment: mix(LEAF, LEAF_WARM, b.tone * 0.6),
          deep: LEAF_DEEP,
          shade: 1,
          seed: b.seed + side,
          alpha: appear,
          len,
        });
      }
    });
  });
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function jerusalemSageReach(plant: JerusalemSage): Pt[] {
  const pose = poseJerusalemSage(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.geom.outline),
    ...pose.bracts.flatMap((l) => l.geom.outline),
    ...pose.stems.flatMap((s) => s.pts),
    ...pose.whorls.flatMap((w) => whorlReach(w)),
    ...pose.mass.flatMap((m) => [{ x: m.cx - m.rx * 1.15, y: m.cy - m.ry * 1.15 }, { x: m.cx + m.rx * 1.15, y: m.cy + m.ry * 1.15 }]),
  ];
}

const jerusalemSage: SpeciesDef = {
  id: 'jerusalem-sage',
  name: 'Jerusalem sage',
  nativeName: 'Phlomis fruticosa',
  nativeLang: 'la',
  // wild in the Greek and central Mediterranean phrygana, on stony slopes and coastal rocks
  range: { realms: ['mediterranean'], biomes: ['scrub', 'coast'], climates: ['mediterranean'] },
  tier: 3,
  habitats: ['back', 'meadow'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Jerusalem sage: tiers of hooded gold on a grey felt mound.',
  bloomColor: '#e6c040',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildJerusalemSage(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, jerusalemSage, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 46, ry: 6, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.24, pigment: SHADOW });
      seedMound(p, r, g, { rx: 10, x: plant.foot });
      const pose = poseJerusalemSage(plant, g);
      paintMass(p, pose.mass, pose.reserves);
      paintLeaves(p, pose.leaves, pose.reserves);
      paintStems(p, pose.stems);
      paintLeaves(p, pose.bracts, []);
      paintWhorls(p, pose.whorls);
    });
  },
};

export default jerusalemSage;
