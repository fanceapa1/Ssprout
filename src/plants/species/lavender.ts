import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pigment, type Pt } from '../../paint';
import { paintFlorets, paintPatches, paintRibbons, type Floret, type Patch, type Ribbon } from '../lib/lavender-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Lavender (Lavandula angustifolia): a low dome of fine grey-green leaves with many thin upright
 * stems above it, each ending in a slim spike of whorled violet-blue flowers.
 */

const LEAF = '#9bb299';
const SILVER = '#c3cdbd';
const LEAF_DEEP = '#7b937e';
const STEM = '#b4bfa8';
const YOUNG = '#a3b782';
const AXIS = '#9a97b0';
const OPEN = '#9784c4';
const PALE = '#bfb2dc';
const TIP = '#6f5eaa';
const BUD = mix('#7b7a98', '#8b9a86', 0.4);
const HAZE = '#b7b2de';
const BLOOM = '#8a78b8';

const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.92 };
const DOME = { rx: 46, ry: 38 };
const REACH = { x: 52, top: -128 };

interface LeafPlan {
  /** where in the dome (fractions of its radii) */
  fx: number;
  fy: number;
  angle: number;
  curve: number;
  length: number;
  width: number;
  tone: Pigment;
  rim: boolean;
  window: [number, number];
  seed: number;
}

interface PatchPlan {
  fx: number;
  fy: number;
  r: number;
  rot: number;
  tone: Pigment;
  window: [number, number];
  seed: number;
}

interface FloretPlan {
  side: 1 | -1 | 0;
  along: number;
  off: number;
  rx: number;
  ry: number;
  rot: number;
  mixIn: number;
  seed: number;
}

interface WhorlPlan {
  t: number;
  s: number;
  florets: FloretPlan[];
}

interface SpikePlan {
  plan: StemPlan;
  sx: number;
  /** the dome-space point the stem leaves (fractions of the dome's radii) */
  base: { fx: number; fy: number };
  window: [number, number];
  /** where along the stem the flower spike begins */
  t0: number;
  width: number;
  band: 0 | 1;
  tone: Pigment;
  whorls: WhorlPlan[];
  seed: number;
}

interface HazePlan {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  seed: number;
}

export interface Lavender {
  leaves: LeafPlan[];
  patches: PatchPlan[];
  spikes: SpikePlan[];
  hazes: HazePlan[];
  foot: number;
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

const surface = (fx: number) => -Math.sqrt(Math.max(0, 1 - fx * fx));

/** Shrink a stem about its base to stay under the top, then squash it sideways to stay inside REACH. */
function fit(plan: StemPlan): { plan: StemPlan; sx: number } {
  const b = plan.base;
  let k = 1;
  for (const q of stemPoints(plan, 1, 1)) {
    const dy = q.y - b.y;
    if (dy < -1e-6 && q.y < REACH.top) k = Math.min(k, (REACH.top - b.y) / dy);
  }
  const fitted = { ...plan, length: plan.length * Math.max(0.3, k) };
  let sx = 1;
  for (const q of stemPoints(fitted, 1, 1)) {
    const dx = q.x - b.x;
    if (dx > 1e-6 && q.x > REACH.x) sx = Math.min(sx, (REACH.x - b.x) / dx);
    if (dx < -1e-6 && q.x < -REACH.x) sx = Math.min(sx, (-REACH.x - b.x) / dx);
  }
  return { plan: fitted, sx: Math.max(0.3, sx) };
}

const squash = (pts: Pt[], sx: number): Pt[] => (sx === 1 ? pts : pts.map((q) => ({ x: pts[0]!.x + (q.x - pts[0]!.x) * sx, y: q.y })));

export function buildLavender(rng: Rng): Lavender {
  const foot = rng.range(-2, 2);
  const leaves: LeafPlan[] = [];
  const nLeaves = rng.int(440, 480);
  for (let i = 0; i < nLeaves; i++) {
    const f = 0.15 + 0.85 * rng.next() ** 0.5;
    const phi = rng.range(0.04, Math.PI - 0.04);
    const fx = Math.cos(phi) * f;
    const fy = -Math.sin(phi) * f;
    const px = fx * DOME.rx;
    const py = fy * DOME.ry;
    const out = Math.atan2(py - 6, px);
    const rim = f > 0.74;
    const dark = clamp01((1 - f) * 0.7 + (px / DOME.rx) * 0.15 + (py + DOME.ry) / (DOME.ry * 6));
    const base = mix(mix(LEAF, SILVER, rng.range(0.25, 0.7)), LEAF_DEEP, dark * 0.5);
    const a0 = 0.02 + 0.3 * f ** 1.2 + rng.range(0, 0.06);
    leaves.push({
      fx,
      fy,
      angle: out + rng.gaussian(0, 0.25),
      curve: rng.range(-0.4, 0.4),
      length: lerp(4.5, 6.5, f) * rng.range(0.8, 1.2),
      width: rng.range(0.6, 0.95),
      tone: jitter(base, rng, 0.02),
      rim,
      window: [a0, a0 + rng.range(0.18, 0.26)],
      seed: seedOf(rng),
    });
  }
  const patches: PatchPlan[] = [];
  const nPatch = rng.int(18, 22);
  for (let i = 0; i < nPatch; i++) {
    const f = rng.next() ** 0.6 * 0.95;
    const phi = rng.range(0.1, Math.PI - 0.1);
    const fx = Math.cos(phi) * f;
    const fy = Math.min(-0.2, -Math.sin(phi) * f * 0.9 + 0.1);
    const dark = clamp01(0.15 + fx * 0.3 + (fy + 0.8) * 0.35);
    const a0 = 0.03 + 0.3 * f + rng.range(0, 0.05);
    patches.push({
      fx,
      fy,
      r: rng.range(11, 17),
      rot: rng.range(-0.5, 0.5),
      tone: mix(mix(LEAF, SILVER, 0.25 - fx * 0.2), mix(LEAF, PIGMENTS.shadow, 0.55), dark),
      window: [a0, a0 + 0.2],
      seed: seedOf(rng),
    });
  }
  const spikes: SpikePlan[] = [];
  const n = rng.int(46, 56);
  for (let i = 0; i < n; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.2, 0.8)) / n);
    const au = Math.abs(u);
    const bx = u * rng.range(0.7, 0.95) * (1 - 0.12 * rng.next());
    const base = { x: foot + bx * DOME.rx * 0.8, y: surface(bx * 0.8) * DOME.ry * 0.8 };
    const spike = rng.range(13, 19);
    const total = lerp(60, 44, au ** 1.2) * rng.range(0.82, 1.1);
    const { plan, sx } = fit(
      makeStem(rng, { base, length: total, angle: UP + u * 0.42 + rng.gaussian(0, 0.06), bend: u * 0.2 + rng.gaussian(0, 0.1), segments: 8, tipBias: 0.15, wobble: 0.03 }),
    );
    const t0 = 1 - Math.min(0.5, spike / plan.length);
    const spikeLen = (1 - t0) * plan.length;
    const whorls: WhorlPlan[] = [];
    for (let k = 0; ; k++) {
      const d = 1.2 + k * rng.range(2.0, 2.5);
      if (d > spikeLen - 0.4) break;
      const s = d / spikeLen;
      whorls.push({
        t: t0 + d / plan.length,
        s,
        florets: ([1, -1, 0] as const).map((side) => ({
          side,
          along: rng.range(-0.5, 0.5),
          off: (side === 0 ? 0.2 : rng.range(0.8, 1.3)) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, s * 1.1))),
          rx: rng.range(0.8, 1.15),
          ry: rng.range(0.8, 1.05),
          rot: rng.range(-0.5, 0.5),
          mixIn: rng.next(),
          seed: seedOf(rng),
        })),
      });
    }
    const w0 = 0.38 + 0.18 * rng.next();
    spikes.push({
      plan,
      sx,
      base: { fx: (base.x - foot) / DOME.rx, fy: base.y / DOME.ry },
      window: [w0, w0 + 0.24],
      t0,
      width: rng.range(0.55, 0.75),
      band: rng.chance(0.55) ? 1 : 0,
      tone: jitter(mix(STEM, SILVER, rng.range(0, 0.4)), rng, 0.02),
      whorls,
      seed: seedOf(rng),
    });
  }
  const nHaze = rng.int(7, 9);
  const hazes: HazePlan[] = Array.from({ length: nHaze }, (_, i) => ({
    at: { x: lerp(-36, 36, (i + rng.range(0.2, 0.8)) / nHaze), y: -rng.range(64, 80) + Math.abs(i - nHaze / 2) * 3 },
    rx: rng.range(12, 18),
    ry: rng.range(9, 14),
    rot: rng.range(-0.4, 0.4),
    seed: seedOf(rng),
  }));
  return { leaves, patches, spikes, hazes, foot, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

type Tagged<T> = T & { id: string; band: number };

export interface LavenderPose {
  leaves: (Ribbon & { id: string; rim: boolean })[];
  patches: (Patch & { id: string })[];
  stems: Tagged<Ribbon>[];
  axes: Tagged<Ribbon>[];
  florets: Tagged<Floret & { open: number }>[];
  hazes: (Patch & { id: string })[];
}

/** The part of a path between two fractions of its length. */
function slice(pts: readonly Pt[], a: number, b: number): Pt[] {
  const n = Math.max(2, Math.ceil((b - a) * 10));
  return Array.from({ length: n + 1 }, (_, i) => {
    const q = pointAt(pts, lerp(a, b, i / n));
    return { x: q.x, y: q.y };
  });
}

export function poseLavender(plant: Lavender, g: number): LavenderPose {
  const pose: LavenderPose = { leaves: [], patches: [], stems: [], axes: [], florets: [], hazes: [] };
  const kd = lerp(0.3, 1, ramp(g, 0.05, 0.55));
  const dome = (fx: number, fy: number): Pt => ({ x: plant.foot + fx * DOME.rx * kd, y: fy * DOME.ry * kd });

  plant.patches.forEach((m, i) => {
    const k = ramp(g, m.window[0], m.window[1]);
    if (k < 0.02) return;
    const c = dome(m.fx, m.fy);
    pose.patches.push({ id: `patch-${i}`, at: c, rx: m.r * lerp(0.5, 1, kd) * lerp(0.6, 1, k), ry: m.r * 0.72 * lerp(0.5, 1, kd) * lerp(0.6, 1, k), rot: m.rot, pigment: m.tone, alpha: k, seed: m.seed });
  });

  plant.leaves.forEach((l, i) => {
    const k = ramp(g, l.window[0], l.window[1]);
    const grow = smooth(k * 3);
    if (grow < 0.02) return;
    const len = l.length * lerp(0.5, 1, kd) * (0.1 + 0.9 * smooth(k * 2));
    const p0 = dome(l.fx, l.fy);
    const p1 = { x: p0.x + Math.cos(l.angle) * len * 0.5, y: p0.y + Math.sin(l.angle) * len * 0.5 };
    const a2 = l.angle + l.curve;
    const p2 = { x: p1.x + Math.cos(a2) * len * 0.5, y: p1.y + Math.sin(a2) * len * 0.5 };
    pose.leaves.push({ id: `leaf-${i}`, rim: l.rim, pts: [p0, p1, p2], width: l.width * grow, pigment: l.tone, seed: l.seed });
  });

  plant.spikes.forEach((s, i) => {
    const k = ramp(g, s.window[0], s.window[1]);
    if (k < 0.012) return;
    const ext = lerp(0.02, 1, k) * smooth(k * 5);
    const b = dome(s.base.fx, s.base.fy);
    const plan = { ...s.plan, base: { x: b.x, y: b.y } };
    const pts = squash(stemPoints(plan, ext, lerp(0.4, 1, smooth(k))), s.sx);
    const ripe = ramp(g, s.window[1] - 0.1, s.window[1] + 0.25);
    const stemTone = mix(YOUNG, s.tone, ripe);
    const wk = s.width * (0.4 + 0.6 * k) * smooth(ext * 5);
    const cut = Math.min(1, s.t0 / ext);
    pose.stems.push({ id: `stem-${i}`, band: s.band, pts: slice(pts, 0, Math.max(0.05, cut)), width: wk, pigment: stemTone, seed: s.seed });
    const axisK = smooth((ext - s.t0) / ((1 - s.t0) * 0.5));
    if (axisK > 0.02) pose.axes.push({ id: `axis-${i}`, band: s.band, pts: slice(pts, cut, cut + (1 - cut) * axisK), width: s.width * 0.9 * axisK, pigment: mix(stemTone, AXIS, 0.55), seed: s.seed + 1 });
    s.whorls.forEach((w, j) => {
      const kf = ramp(g, s.window[1] - 0.12 + 0.06 * w.s, s.window[1] + 0.02 + 0.06 * w.s) * smooth((ext - w.t) / 0.08);
      if (kf < 0.012) return;
      const q = pointAt(pts, Math.min(1, w.t / ext));
      const nx = -Math.sin(q.angle);
      const ny = Math.cos(q.angle);
      const open = ramp(g, s.window[1] + 0.01 + 0.07 * (1 - w.s), s.window[1] + 0.13 + 0.07 * (1 - w.s)) * lerp(1, 0.6, smooth((w.s - 0.78) / 0.22));
      const deep = smooth((w.s - 0.7) / 0.3) * 0.75;
      w.florets.forEach((f, m) => {
        const ux = Math.cos(q.angle);
        const uy = Math.sin(q.angle);
        const off = f.off * f.side * lerp(0.4, 1, open);
        const at = { x: q.x + nx * off + ux * f.along, y: q.y + ny * off + uy * f.along };
        const flower = mix(mix(OPEN, PALE, f.mixIn * 0.55), TIP, deep);
        const tone = mix(BUD, flower, open);
        const grey = s.band === 0 ? 0.22 : 0;
        pose.florets.push({
          id: `fl-${i}-${j}-${m}`,
          band: s.band,
          open,
          at,
          rx: f.rx * lerp(0.55, 1, open) * lerp(0.5, 1, kf),
          ry: f.ry * lerp(0.6, 1, open) * lerp(0.5, 1, kf),
          rot: q.angle + Math.PI / 2 + f.rot * 0.7,
          pigment: mix(tone, PIGMENTS.shadow, grey),
          alpha: smooth(kf * 2.5),
          seed: f.seed,
        });
      });
    });
  });

  const kh = ramp(g, 0.62, 0.95);
  plant.hazes.forEach((h, i) => {
    if (kh < 0.02) return;
    pose.hazes.push({ id: `haze-${i}`, at: { x: h.at.x + plant.foot, y: h.at.y }, rx: h.rx * lerp(0.6, 1, kh), ry: h.ry * lerp(0.6, 1, kh), rot: h.rot, pigment: HAZE, alpha: kh * 0.55, seed: h.seed });
  });
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function lavenderReach(plant: Lavender): Pt[] {
  const pose = poseLavender(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.pts),
    ...pose.stems.flatMap((s) => s.pts),
    ...pose.axes.flatMap((s) => s.pts),
    ...pose.florets.flatMap((f) => [
      { x: f.at.x - f.rx * 1.2, y: f.at.y - f.rx * 1.2 },
      { x: f.at.x + f.rx * 1.2, y: f.at.y + f.rx * 1.2 },
    ]),
  ];
}

const lavender: SpeciesDef = {
  id: 'lavender',
  name: 'Lavender',
  nativeName: 'Levanta',
  nativeLang: 'el-Latn',
  // native to the western and central Mediterranean hills, and the garden lavender of its coasts
  range: { realms: ['mediterranean'], biomes: ['heath', 'grassland'], climates: ['warm-temperate'], cultivatedIn: ['mediterranean'] },
  tier: 2,
  habitats: ['meadow', 'path'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Lavender — a silver-green cushion hazed with violet spikes.',
  bloomColor: BLOOM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildLavender(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, lavender, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 42, ry: 4.5, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.14 });
      seedMound(p, r, g, { rx: 10, x: plant.foot });
      const pose = poseLavender(plant, g);
      paintPatches(p, pose.patches);
      paintRibbons(p, pose.leaves.filter((l) => !l.rim), { opacity: 0.8 });
      for (const band of [0, 1]) {
        paintRibbons(p, [...pose.stems, ...pose.axes].filter((x) => x.band === band), { opacity: band ? 0.85 : 0.62 });
        if (band === 0) paintPatches(p, pose.hazes);
        paintFlorets(p, pose.florets.filter((f) => f.band === band));
      }
      paintRibbons(p, pose.leaves.filter((l) => l.rim), { opacity: 0.88 });
    });
  },
};

export default lavender;
