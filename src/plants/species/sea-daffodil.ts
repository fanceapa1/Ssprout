import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, mix, type Pigment, type Pt } from '../../paint';
import { reserveFlowers, paintBackdrop, paintFlower, paintHazes, paintStalks, paintStraps, type FlowerMark, type Haze, type Strap, type Tepal } from '../lib/sea-daffodil-paint';
import { lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound } from '../lib/small-paint';
import { UP, makeStem, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Sea daffodil (Pancratium maritimum): a loose tuft of long blue-grey strap leaves out of the
 * sand, and on a stout bare stalk an umbel of large white trumpets, each a toothed cup in a
 * ring of six narrow recurved tepals.
 */

const LEAF = '#8fa598';
const LEAF_DEEP = '#6f8d89';
const LEAF_PALE = '#b0c2b9';
const STALK = '#b3bf9c';
const BLOOM = '#f6f2e8';
const HALO = '#b2bec4';

const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.92 };
const REACH = { x: 55, top: -140 };

interface LeafPlan {
  stem: StemPlan;
  sx: number;
  width: number;
  tone: number;
  twist: number;
  phase: number;
  band: 0 | 1;
  window: [number, number];
  seed: number;
}

interface FlowerPlan {
  /** where the flower sits round the umbel's centre: three-dimensional unit vector, y down, z towards the viewer */
  axis: [number, number, number];
  dir: [number, number];
  reach: number;
  tube: number;
  tepal: number;
  width: number;
  spread: number;
  rot: number;
  cup: number;
  window: [number, number];
  tepalJit: { len: number; spread: number }[];
  seed: number;
}

export interface SeaDaffodil {
  foot: number;
  leaves: LeafPlan[];
  stalk: StemPlan;
  flowers: FlowerPlan[];
  hazes: { dx: number; dy: number; rx: number; ry: number; rot: number; seed: number }[];
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

function fitLeaf(plan: StemPlan, foot: number): { plan: StemPlan; sx: number } {
  const b = plan.base;
  let k = 1;
  for (const q of stemPoints(plan, 1, 1)) {
    const dy = q.y - b.y;
    if (dy < -1e-6 && q.y < -68) k = Math.min(k, (-68 - b.y) / dy);
  }
  const fitted = { ...plan, length: plan.length * Math.max(0.35, k) };
  let sx = 1;
  for (const q of stemPoints(fitted, 1, 1)) {
    const dx = q.x - foot;
    if (dx > 1e-6 && q.x > REACH.x) sx = Math.min(sx, (REACH.x - foot) / dx);
    if (dx < -1e-6 && q.x < -REACH.x) sx = Math.min(sx, (-REACH.x - foot) / dx);
  }
  return { plan: fitted, sx: Math.max(0.35, sx) };
}

export function buildSeaDaffodil(rng: Rng): SeaDaffodil {
  const foot = rng.range(-2, 2);
  const nLeaves = rng.int(10, 13);
  const leaves: LeafPlan[] = [];
  for (let i = 0; i < nLeaves; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.2, 0.8)) / nLeaves);
    const au = Math.abs(u);
    const angle = UP + u * rng.range(0.7, 1.05) + rng.gaussian(0, 0.08);
    const total = lerp(78, 54, au ** 1.1) * rng.range(0.85, 1.12);
    const base = { x: foot + rng.range(-5, 5), y: rng.range(-1.5, 0.5) };
    const { plan, sx } = fitLeaf(makeStem(rng, { base, length: total, angle, bend: Math.sign(u || 1) * rng.range(0.7, 1.5), segments: 9, tipBias: 0.55, wobble: 0.05 }), foot);
    const w0 = 0.06 + 0.3 * rng.next() * (0.4 + au);
    leaves.push({
      stem: plan,
      sx,
      width: rng.range(3.6, 5),
      tone: rng.next(),
      twist: rng.range(2.5, 6) * (rng.chance(0.5) ? 1 : -1),
      phase: rng.range(0, 6.28),
      band: au < 0.55 && rng.chance(0.7) ? 0 : 1,
      window: [w0, w0 + rng.range(0.22, 0.3)],
      seed: seedOf(rng),
    });
  }
  const lean = rng.range(-0.07, 0.07);
  const stalk = makeStem(rng, { base: { x: foot, y: 0 }, length: rng.range(78, 86), angle: UP + lean, bend: -lean * 1.2, segments: 6, tipBias: 0.1, wobble: 0.015 });
  const n = rng.int(4, 6);
  const flowers: FlowerPlan[] = [];
  const face = rng.int(1, n - 2);
  for (let i = 0; i < n; i++) {
    const t = (i + rng.range(0.4, 0.6)) / n;
    const a = lerp(-1.05, 1.05, t);
    const dir: [number, number] = [Math.sin(a), -Math.cos(a)];
    const zf = i === face ? rng.range(0.75, 0.9) : rng.range(0.05, 0.4);
    const ax = Math.sin(a) * 0.9;
    const ay = -Math.cos(a) * 0.7 + 0.1;
    const len = Math.hypot(ax, ay, zf);
    const w0 = 0.47 + 0.05 * rng.next() + 0.01 * i;
    flowers.push({
      axis: [ax / len, ay / len, zf / len],
      dir,
      reach: lerp(12, 25, Math.abs(a) / 1.05) + rng.range(-1.5, 1.5),
      tube: rng.range(8, 10),
      tepal: rng.range(18, 21),
      width: rng.range(3.4, 4.2),
      spread: rng.range(0.9, 1.05),
      rot: rng.range(0, 1),
      cup: rng.range(6.5, 7.5),
      window: [w0, w0 + 0.4],
      tepalJit: Array.from({ length: 6 }, () => ({ len: rng.range(0.9, 1.08), spread: rng.gaussian(0, 0.08) })),
      seed: seedOf(rng),
    });
  }
  const hazes = Array.from({ length: 4 }, (_, i) => ({ dx: lerp(-22, 22, (i + rng.range(0.2, 0.8)) / 4), dy: rng.range(-30, -16), rx: rng.range(20, 26), ry: rng.range(14, 19), rot: rng.range(-0.4, 0.4), seed: seedOf(rng) }));
  return { foot, leaves, stalk, flowers, hazes, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface SeaDaffodilPose {
  leaves: (Strap & { id: string; band: number })[];
  stalks: { id: string; pts: Pt[]; width: number; pigment: Pigment; seed: number }[];
  flowers: (FlowerMark & { id: string; z: number })[];
  hazes: (Haze & { id: string })[];
}

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const along = (p: V3, d: V3, s: number): V3 => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];
const xy = (p: V3): Pt => ({ x: p[0], y: p[1] });

function flowerMark(f: FlowerPlan, c: Pt, size: number, open: number, id: string): FlowerMark & { id: string; z: number } {
  const a3 = f.axis;
  const ref: V3 = Math.abs(a3[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u3 = unit(cross(a3, ref));
  const v3 = cross(a3, u3);
  const O: V3 = [c.x + f.dir[0] * f.reach * size, c.y + f.dir[1] * f.reach * size, 0];
  const T = along(O, a3, f.tube * size);
  const mouth = along(T, a3, 12.5 * smooth(open));
  const tepals: Tepal[] = [];
  const S = lerp(0.1, 1.2, smooth(open)) * f.spread;
  const rec = lerp(0, 0.4, smooth(open));
  const L = f.tepal * size * lerp(0.62, 1, smooth(open));
  for (let j = 0; j < 6; j++) {
    const phi = (f.rot + j / 6) * Math.PI * 2;
    const radial: V3 = [Math.cos(phi) * u3[0] + Math.sin(phi) * v3[0], Math.cos(phi) * u3[1] + Math.sin(phi) * v3[1], Math.cos(phi) * u3[2] + Math.sin(phi) * v3[2]];
    const jit = f.tepalJit[j]!;
    const dir = (s: number): V3 => unit([Math.cos(s) * a3[0] + Math.sin(s) * radial[0], Math.cos(s) * a3[1] + Math.sin(s) * radial[1], Math.cos(s) * a3[2] + Math.sin(s) * radial[2]]);
    const s0 = S + jit.spread * open;
    const p1 = along(T, dir(s0), L * jit.len * 0.4);
    const p2 = along(p1, dir(s0 + rec * 0.55), L * jit.len * 0.35);
    const p3 = along(p2, dir(s0 + rec), L * jit.len * 0.3);
    tepals.push({ pts: [xy(T), xy(p1), xy(p2), xy(p3)], z: p3[2] - T[2], width: f.width * lerp(0.7, 1, open) });
  }
  return {
    id,
    z: a3[2],
    at: xy(O),
    throat: xy(T),
    u: { x: u3[0], y: u3[1] },
    v: { x: v3[0], y: v3[1] },
    mouth: xy(mouth),
    cupR: f.cup * size,
    tepals,
    open,
    alpha: smooth(size * 2.5),
    seed: f.seed,
  };
}

export function poseSeaDaffodil(plant: SeaDaffodil, g: number): SeaDaffodilPose {
  const pose: SeaDaffodilPose = { leaves: [], stalks: [], flowers: [], hazes: [] };
  plant.leaves.forEach((l, i) => {
    const k = ramp(g, l.window[0], l.window[1]);
    if (k < 0.012) return;
    const ext = lerp(0.04, 1, smooth(k));
    const pts = stemPoints(l.stem, ext, lerp(0.35, 1, smooth(k))).map((q) => ({ x: l.stem.base.x + (q.x - l.stem.base.x) * l.sx, y: q.y }));
    const tone = mix(mix(LEAF, LEAF_DEEP, l.tone * 0.55 + (l.band === 0 ? 0.25 : 0)), PIGMENTS.shadow, l.band === 0 ? 0.08 : 0);
    pose.leaves.push({ id: `leaf-${i}`, band: l.band, pts, width: l.width * (0.35 + 0.65 * smooth(k * 2)), pigment: tone, pale: LEAF_PALE, twist: l.twist, phase: l.phase, seed: l.seed });
  });

  const ks = ramp(g, 0.26, 0.48);
  const sp = stemPoints(plant.stalk, lerp(0.02, 1, smooth(ks)), lerp(0.4, 1, smooth(ks)));
  if (ks > 0.012) pose.stalks.push({ id: 'stalk', pts: sp, width: 3.3 * (0.4 + 0.6 * smooth(ks * 1.5)), pigment: mix(STALK, LEAF, 0.15), seed: plant.seeds.ground + 1 });
  const tip = sp[sp.length - 1]!;

  plant.flowers.forEach((f, i) => {
    const size = smooth(ramp(g, f.window[0], f.window[0] + 0.14));
    if (size < 0.02 || ks < 0.9) return;
    const open = ramp(g, f.window[0] + 0.12, f.window[1]);
    const m = flowerMark(f, tip, size, open, `fl-${i}`);
    pose.flowers.push(m);
    pose.stalks.push({ id: `ped-${i}`, pts: [{ x: tip.x, y: tip.y + 1 }, m.at], width: 1.1 * size, pigment: STALK, seed: f.seed + 7 });
  });
  pose.flowers.sort((a, b) => a.z - b.z);

  const kh = ramp(g, 0.7, 1);
  if (kh > 0.02) plant.hazes.forEach((h, i) => pose.hazes.push({ id: `haze-${i}`, at: { x: tip.x + h.dx, y: tip.y + h.dy }, rx: h.rx * lerp(0.6, 1, kh), ry: h.ry * lerp(0.6, 1, kh), rot: h.rot, pigment: HALO, alpha: kh * 0.25, seed: h.seed }));
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function seaDaffodilReach(plant: SeaDaffodil): Pt[] {
  const pose = poseSeaDaffodil(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.pts),
    ...pose.stalks.flatMap((s) => s.pts),
    ...pose.flowers.flatMap((f) => [
      ...f.tepals.flatMap((t) => t.pts),
      { x: f.mouth.x - f.cupR, y: f.mouth.y - f.cupR },
      { x: f.mouth.x + f.cupR, y: f.mouth.y + f.cupR },
    ]),
  ];
}

const seaDaffodil: SpeciesDef = {
  id: 'sea-daffodil',
  name: 'Sea daffodil',
  nativeName: 'Krinos tis thalassas',
  nativeLang: 'el-Latn',
  // wild on Mediterranean dunes and sandy beaches
  range: { realms: ['mediterranean'], biomes: ['coast'], climates: ['mediterranean'] },
  tier: 2,
  habitats: ['shore'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Sea daffodil — white trumpets rising straight out of the sand.',
  bloomColor: BLOOM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildSeaDaffodil(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, seaDaffodil, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 40, ry: 5, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.16 });
      seedMound(p, r, g, { rx: 10, x: plant.foot });
      const pose = poseSeaDaffodil(plant, g);
      paintStraps(p, pose.leaves.filter((l) => l.band === 0), 0.9);
      paintHazes(p, pose.hazes);
      paintStalks(p, pose.stalks.filter((s) => s.id === 'stalk'));
      paintStraps(p, pose.leaves.filter((l) => l.band === 1), 0.92);
      paintStalks(p, pose.stalks.filter((s) => s.id !== 'stalk'), 0.8);
      reserveFlowers(p, pose.flowers);
      paintBackdrop(p, pose.flowers, mix(HALO, LEAF_DEEP, 0.3));
      for (const f of pose.flowers) paintFlower(p, f);
    });
  },
};

export default seaDaffodil;
