import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pigment, type Pt } from '../../paint';
import { paintHaze, paintPeas, paintRods, peaShape, type Haze, type PeaFlower, type Rod } from '../lib/retama-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound } from '../lib/small-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * White broom (Retama raetam): a leafless desert broom. A loose fountain of fine grey-green rods
 * that arch over and weep at the tips, foaming in spring with small white pea flowers, each held
 * in a violet calyx.
 */

const ROD = '#9aa58e';
const SILVER = '#c3c8b6';
const YOUNG = '#8fac68';
const WOOD = mix('#8a7d6a', '#a29c90', 0.4);
const PETAL = '#fcf9f2';
const KEEL = mix(PETAL, '#b9a3c9', 0.16);
const CALYX = mix('#8d6a86', '#a2967f', 0.35);
const SHADOW = '#cdc6d8';
const BLOOM = '#f6f2ea';

const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.92 };
/** where rods may reach (plant units, base at 0): flowers hang a little past them */
const REACH = { x: 51, top: -134, bottom: 1 };
const DOWN = Math.PI / 2;

type Kind = 'wood' | 'rod' | 'twig';

interface FlowerPlan {
  /** offset along the rod from its node, plant units */
  dt: number;
  /** turn from straight down toward the rod's underside */
  hang: number;
  stalk: number;
  size: number;
  /** some buds stay closed */
  bud: boolean;
  appear: [number, number];
  open: [number, number];
  petal: Pigment;
  seed: number;
}

interface ClusterPlan {
  t: number;
  flowers: FlowerPlan[];
}

interface RodPlan {
  kind: Kind;
  plan: StemPlan;
  /** sideways squash about its base, so the arch stays inside the box */
  sx: number;
  /** the rod it grows from, and where (0..1 along it) */
  parent: { i: number; t: number } | null;
  window: [number, number];
  width: number;
  band: 0 | 1;
  tone: Pigment;
  /** a soft patch of body behind it */
  body: { t: number; rx: number; ry: number; rot: number; seed: number } | null;
  clusters: ClusterPlan[];
  seed: number;
}

export interface Retama {
  rods: RodPlan[];
  foot: number;
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

/** Shrink a stem about its base to stay under the top, then squash it sideways to stay inside REACH. */
function fit(plan: StemPlan): { plan: StemPlan; sx: number } {
  const b = plan.base;
  let k = 1;
  for (const q of stemPoints(plan, 1, 1)) {
    const dy = q.y - b.y;
    if (dy < -1e-6 && q.y < REACH.top) k = Math.min(k, (REACH.top - b.y) / dy);
    if (dy > 1e-6 && q.y > REACH.bottom) k = Math.min(k, (REACH.bottom - b.y) / dy);
  }
  const fitted = { ...plan, length: plan.length * Math.max(0.2, k) };
  let sx = 1;
  for (const q of stemPoints(fitted, 1, 1)) {
    const dx = q.x - b.x;
    if (dx > 1e-6 && q.x > REACH.x) sx = Math.min(sx, (REACH.x - b.x) / dx);
    if (dx < -1e-6 && q.x < -REACH.x) sx = Math.min(sx, (-REACH.x - b.x) / dx);
  }
  return { plan: fitted, sx: Math.max(0.2, sx) };
}

/** A rod's points squashed sideways about its base. */
const squash = (pts: Pt[], sx: number): Pt[] => (sx === 1 ? pts : pts.map((q) => ({ x: pts[0]!.x + (q.x - pts[0]!.x) * sx, y: q.y })));

function clustersAlong(rng: Rng, from: number, length: number): ClusterPlan[] {
  const out: ClusterPlan[] = [];
  let t = from + rng.range(0, 0.05);
  while (t < 0.97) {
    if (rng.chance(0.82)) {
      const n = rng.int(2, 4);
      const flowers = Array.from({ length: n }, (): FlowerPlan => {
        const o0 = rng.range(0.74, 0.88);
        const a0 = rng.range(0.5, 0.66);
        return {
          dt: rng.range(-1.4, 1.4),
          hang: rng.range(0.2, 0.75),
          stalk: rng.range(0.6, 1.5),
          size: rng.range(1.9, 2.5),
          bud: rng.chance(0.1),
          appear: [a0, a0 + 0.12],
          open: [o0, o0 + rng.range(0.09, 0.12)],
          petal: jitter(mix(PETAL, rng.chance(0.25) ? KEEL : '#fffdf8', rng.range(0, 0.35)), rng, 0.01),
          seed: seedOf(rng),
        };
      });
      out.push({ t, flowers });
    }
    t += rng.range(5.5, 8) / Math.max(10, length);
  }
  return out;
}

export function buildRetama(rng: Rng): Retama {
  const foot = rng.range(-2.5, 2.5);
  const rods: RodPlan[] = [];
  const grey = jitter(ROD, rng, 0.02);
  // a few short woody stems fan from the crown
  const nWood = rng.int(4, 6);
  for (let w = 0; w < nWood; w++) {
    const u = lerp(-1, 1, (w + rng.range(0.3, 0.7)) / nWood);
    const plan = makeStem(rng, { base: { x: foot + u * 3, y: 0 }, length: rng.range(8, 15) * (1 - 0.3 * Math.abs(u)), angle: UP + u * 0.3 + rng.gaussian(0, 0.05), bend: u * 0.08, segments: 5, wobble: 0.03 });
    const start = 0.08 + 0.05 * rng.next();
    rods.push({ kind: 'wood', plan, sx: 1, parent: null, window: [start, start + 0.42], width: rng.range(1.5, 1.9), band: 0, tone: WOOD, body: null, clusters: [], seed: seedOf(rng) });
  }
  // the rods: inner ones stand up and arch over the top, outer ones arch out and weep
  const n = rng.int(30, 38);
  const rodIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.2, 0.8)) / n);
    const au = Math.abs(u);
    const wi = Math.round(((u + 1) / 2) * (nWood - 1));
    const wood = rods[wi]!;
    const wt = rng.range(0.45, 1);
    const node = pointAt(stemPoints(wood.plan, 1, 1), wt);
    const side = au < 0.15 ? (rng.chance(0.5) ? 1 : -1) : Math.sign(u);
    const { plan, sx } = fit(
      makeStem(rng, {
        base: { x: node.x, y: node.y },
        length: lerp(102, 58, au ** 1.3) * rng.range(0.88, 1.08),
        angle: UP + u * 0.35 + rng.gaussian(0, 0.06),
        bend: side * (0.3 + 2.6 * au ** 0.75 + rng.range(-0.15, 0.2)),
        segments: 12,
        tipBias: 0,
        wobble: 0.03,
      }),
    );
    const start = 0.08 + 0.4 * clamp01(au * 0.75 + rng.range(0, 0.35));
    rodIds.push(rods.length);
    rods.push({
      kind: 'rod',
      plan,
      sx,
      parent: { i: wi, t: wt },
      window: [start, Math.min(0.85, start + rng.range(0.28, 0.34))],
      width: rng.range(0.7, 0.92),
      band: rng.chance(0.55) ? 1 : 0,
      tone: jitter(mix(grey, SILVER, rng.range(0.15, 0.5)), rng, 0.025),
      body: { t: rng.range(0.35, 0.65), rx: rng.range(11, 15), ry: rng.range(8, 11), rot: rng.range(-0.5, 0.5), seed: seedOf(rng) },
      clusters: clustersAlong(rng, 0.3, plan.length),
      seed: seedOf(rng),
    });
  }
  // fine weeping twigs leave the rods' outer halves
  for (const ri of rodIds) {
    const rod = rods[ri]!;
    const full = squash(stemPoints(rod.plan, 1, 1), rod.sx);
    const sideOut = Math.sign(rod.plan.bends.reduce((a, b) => a + b, 0)) || 1;
    const m = rng.int(1, 3);
    for (let j = 0; j < m; j++) {
      const t = rng.range(0.3, 0.72);
      const q = pointAt(full, t);
      const side = rng.chance(0.7) ? sideOut : -sideOut;
      const { plan, sx } = fit(makeStem(rng, { base: { x: q.x, y: q.y }, length: rod.plan.length * (1 - t) * rng.range(0.5, 0.85), angle: q.angle + side * rng.range(0.3, 0.6), bend: side * rng.range(0.8, 1.6), segments: 6, tipBias: 0.45, wobble: 0.04 }));
      const w0 = rod.window[0] + t * (rod.window[1] - rod.window[0]) + 0.04;
      rods.push({
        kind: 'twig',
        plan,
        sx,
        parent: { i: ri, t },
        window: [w0, Math.min(0.9, w0 + rng.range(0.2, 0.25))],
        width: rng.range(0.48, 0.6),
        band: rod.band,
        tone: jitter(mix(rod.tone, SILVER, 0.2), rng, 0.02),
        body: null,
        clusters: clustersAlong(rng, 0.15, plan.length),
        seed: seedOf(rng),
      });
    }
  }
  return { rods, foot, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface RetamaPose {
  rods: (Rod & { id: string; band: number; kind: Kind })[];
  body: (Haze & { id: string })[];
  flowers: (PeaFlower & { id: string; band: number })[];
}

interface Grown {
  pts: Pt[];
  ext: number;
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

export function poseRetama(plant: Retama, g: number): RetamaPose {
  const pose: RetamaPose = { rods: [], body: [], flowers: [] };
  const grown: (Grown | null)[] = [];
  plant.rods.forEach((r, i) => {
    const k = ramp(g, r.window[0], r.window[1]);
    if (k < 0.012) {
      grown[i] = null;
      return;
    }
    let plan = r.plan;
    if (r.parent) {
      const pg = grown[r.parent.i];
      if (!pg) {
        grown[i] = null;
        return;
      }
      const node = nodeAt(pg, r.parent.t);
      plan = { ...plan, base: { x: node.x, y: node.y } };
    }
    // young rods stand straight; they arch over as they lengthen and their tips grow heavy
    const ext = lerp(0.02, 1, k) * smooth(k * 6);
    const gs = { pts: squash(stemPoints(plan, ext, lerp(0.25, 1, smooth(k))), r.sx), ext };
    grown[i] = gs;
    const ripe = ramp(g, r.window[1] - 0.08, r.window[1] + 0.3);
    const tone = r.kind === 'wood' ? WOOD : mix(YOUNG, r.band ? r.tone : mix(r.tone, SHADOW, 0.25), ripe);
    pose.rods.push({ id: `rod-${i}`, kind: r.kind, band: r.band, pts: gs.pts, width: r.width * (0.4 + 0.6 * k) * smooth(ext * 5), pigment: tone, seed: r.seed });
    if (r.body) {
      const kb = smooth(clamp01((ext - r.body.t) / 0.3)) * ramp(g, 0.3, 0.75);
      if (kb > 0.012) {
        const q = nodeAt(gs, r.body.t);
        const at = { x: lerp(q.x, plant.foot, 0.35), y: Math.min(q.y + 4, -16) };
        // light from the upper left: the lower right of the mound is in shade
        const dark = clamp01(0.2 + (at.x - plant.foot) / 90 + (at.y + 55) / 110);
        pose.body.push({ id: `body-${i}`, at, rx: r.body.rx * lerp(0.4, 1, kb), ry: r.body.ry * lerp(0.4, 1, kb), rot: r.body.rot, pigment: mix(mix(ROD, SILVER, 0.3), mix(ROD, PIGMENTS.shadow, 0.5), dark), alpha: kb, seed: r.body.seed });
      }
    }
    r.clusters.forEach((c, j) => {
      const reach = smooth(clamp01((ext - c.t) / 0.12));
      if (reach < 0.012) return;
      const q = nodeAt(gs, c.t);
      // the flowers hang from the rod's underside
      const under = Math.sin(q.angle + DOWN) >= Math.sin(q.angle - DOWN) ? q.angle + DOWN : q.angle - DOWN;
      c.flowers.forEach((f, m) => {
        const kf = ramp(g, f.appear[0], f.appear[1]) * reach;
        if (kf < 0.012) return;
        const open = f.bud ? 0 : ramp(g, f.open[0], f.open[1]);
        const hang = lerpAngle(DOWN, under, f.hang);
        const ux = Math.cos(q.angle);
        const uy = Math.sin(q.angle);
        const d = f.stalk * kf;
        const at = { x: q.x + ux * f.dt * kf + Math.cos(hang) * d, y: q.y + uy * f.dt * kf + Math.sin(hang) * d };
        const deep = r.band === 0 ? 0.3 : 0;
        pose.flowers.push({ id: `fl-${i}-${j}-${m}`, band: r.band, at, angle: hang - 0.5 * open * Math.sign(Math.cos(hang) || 1), size: f.size * lerp(0.45, 1, kf) * lerp(0.75, 1, open), open, petal: mix(f.petal, SHADOW, deep), calyx: CALYX, keel: KEEL, alpha: smooth(kf * 3), seed: f.seed });
      });
    });
  });
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function retamaReach(plant: Retama): Pt[] {
  const pose = poseRetama(plant, 1);
  return [
    ...pose.rods.flatMap((r) => r.pts),
    ...pose.flowers.flatMap((f) => {
      const s = peaShape(f);
      return [...s.calyx, ...s.standard, ...s.keel];
    }),
  ];
}

const retama: SpeciesDef = {
  id: 'retama',
  name: 'White Broom',
  nativeName: 'Rtem',
  nativeLang: 'ary-Latn',
  // wild on the sands, dunes and wadi banks of North Africa, Sicily, Sinai and the Levant to Arabia
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] },
  tier: 2,
  habitats: ['path', 'shore', 'back'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'White broom — a fountain of silver rods that foams white in spring.',
  bloomColor: BLOOM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildRetama(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, retama, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 34, ry: 4, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.13 });
      seedMound(p, r, g, { rx: 10, x: plant.foot });
      const pose = poseRetama(plant, g);
      paintHaze(p, pose.body);
      paintRods(p, pose.rods.filter((x) => x.kind !== 'wood' && x.band === 0), { opacity: 0.62 });
      paintRods(p, pose.rods.filter((x) => x.kind === 'wood'), { opacity: 0.8, dry: 0.1, granulation: 0.3 });
      paintPeas(p, pose.flowers.filter((f) => f.band === 0), { shadow: SHADOW });
      paintRods(p, pose.rods.filter((x) => x.kind !== 'wood' && x.band === 1), { opacity: 0.88 });
      paintPeas(p, pose.flowers.filter((f) => f.band === 1), { shadow: SHADOW });
    });
  },
};

export default retama;
