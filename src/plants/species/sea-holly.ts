import { createRng, type Rng } from '../../core/rng';
import { mix, type Pt } from '../../paint';
import { bladeGeometry, paintHeads, paintLeaves, paintStems, type BladeMark, type BladeSpec, type HeadMark, type StemMark } from '../lib/sea-holly-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound, shadowSide } from '../lib/small-paint';
import { UP, makeStem, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Sea holly (Eryngium maritimum): a stiff, low, branching clump of leathery silver-blue leaves
 * with spiny teeth and chalky veins; the upper stems flush blue and end in thistle-like knobs
 * of amethyst florets, each in a collar of broad spiny bracts.
 */

const SILVER = '#a4b9b4';
const LEAF = '#8aa6a8';
const LEAF_DEEP = '#6b8a98';
const STEM_LOW = '#a6bdb6';
const STEM_BLUE = '#8aa0c6';
const STEM_DEEP = '#7088b4';
const BRACT_BUD = '#a3b8b4';
const BRACT = '#84a0c4';
const DOME = '#9298cc';
const DOME_DEEP = '#6a74b0';
const BLOOM = '#8fa6c4';
const SHADOW = '#8aa0b4';

const BOX = { w: 86, h: 86, ax: 0.5, ay: 0.92 };

interface LeafPlan {
  id: string;
  spec: BladeSpec;
  window: [number, number];
  tone: number;
  seed: number;
  /** cauline leaves hang on a stem's tip and follow it */
  on?: string;
}

interface BranchPlan {
  id: string;
  parent: string | null;
  attach: number;
  stem: StemPlan;
  window: [number, number];
  width: number;
  seed: number;
}

interface HeadPlan {
  on: string;
  rx: number;
  ry: number;
  bracts: number;
  rot: number;
  len: number;
  wid: number;
  jit: number[];
  window: [number, number];
  dots: [number, number][];
  seed: number;
}

export interface SeaHolly {
  foot: number;
  leaves: LeafPlan[];
  branches: BranchPlan[];
  heads: HeadPlan[];
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);
const teethJit = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.range(0.75, 1.3));

function blade(rng: Rng, base: Pt, angle: number, len: number, wid: number, bend: number, teeth: number): BladeSpec {
  return { base, angle, len, wid, bend, teeth, jit: teethJit(rng, teeth * 2), wave: rng.range(0.03, 0.09), phase: rng.range(0, 6.28) };
}

export function buildSeaHolly(rng: Rng): SeaHolly {
  const foot = rng.range(-2, 2);
  const leaves: LeafPlan[] = [];
  const n = rng.int(6, 7);
  for (let i = 0; i < n; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.25, 0.75)) / n);
    const au = Math.abs(u);
    const angle = UP + u * rng.range(1.1, 1.3) + rng.gaussian(0, 0.06);
    const len = lerp(31, 25, au ** 1.2) * rng.range(0.88, 1.08);
    const w0 = 0.05 + 0.2 * (i / n) + rng.range(0, 0.04);
    leaves.push({
      id: `leaf-${i}`,
      spec: blade(rng, { x: foot + rng.range(-3, 3), y: rng.range(-2.5, -0.5) }, angle, len, len * rng.range(0.56, 0.66), Math.sign(u || 1) * rng.range(0.04, 0.14), rng.int(4, 5)),
      window: [w0, w0 + rng.range(0.2, 0.26)],
      tone: rng.next(),
      seed: seedOf(rng),
    });
  }
  const lean = rng.range(-0.06, 0.06);
  const branches: BranchPlan[] = [];
  const add = (id: string, parent: string | null, attach: number, angle: number, length: number, bend: number, window: [number, number], width: number) =>
    branches.push({ id, parent, attach, stem: makeStem(rng, { length, angle, bend, segments: 4, tipBias: 0.2, wobble: 0.025 }), window, width, seed: seedOf(rng) });
  add('t', null, 0, UP + lean, rng.range(22, 25), -lean * 1.5, [0.26, 0.46], 2.6);
  const side = (id: string, s: 1 | -1) => {
    add(`c${id}`, 't', 1, UP + s * rng.range(0.85, 1.0), rng.range(16, 18), -s * 0.35, [0.46, 0.62], 1.9);
    add(`c${id}a`, `c${id}`, 1, UP + s * rng.range(0.25, 0.45), rng.range(11, 13), -s * 0.1, [0.6, 0.72], 1.4);
    add(`c${id}b`, `c${id}`, 1, UP + s * rng.range(1.2, 1.4), rng.range(9, 11), -s * 0.3, [0.6, 0.72], 1.4);
    add(`l${id}`, 't', rng.range(0.42, 0.5), UP + s * rng.range(1.3, 1.4), rng.range(21, 24), -s * 0.7, [0.44, 0.62], 1.7);
  };
  side('L', -1);
  side('R', 1);
  add('c', 't', 1, UP + rng.gaussian(0, 0.06), rng.range(22, 25), lean, [0.46, 0.64], 2);

  const headOn = ['c', 'cLa', 'cRa', 'cLb', 'cRb', 'lL', 'lR'];
  const heads: HeadPlan[] = headOn.map((on, i) => {
    const w0 = (branches.find((b) => b.id === on)?.window[1] ?? 0.7) - 0.03 + 0.012 * i;
    const big = i === 0 ? 1.1 : i < 5 ? 1 : 0.9;
    return {
      on,
      rx: rng.range(3.9, 4.5) * big,
      ry: rng.range(4.4, 5) * big,
      bracts: rng.int(7, 8),
      rot: rng.range(0, 1),
      len: rng.range(10, 12) * big,
      wid: rng.range(5, 6) * big,
      jit: teethJit(rng, 4),
      window: [w0, Math.min(w0 + 0.26, 0.97)],
      dots: Array.from({ length: 22 }, (_, k) => [Math.sqrt((k + 0.5) / 22) * 0.82, k * 2.399963 + rng.range(-0.2, 0.2)] as [number, number]),
      seed: seedOf(rng),
    };
  });
  return { foot, leaves, branches, heads, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface SeaHollyPose {
  leaves: (BladeMark & { id: string })[];
  stems: (StemMark & { id: string })[];
  heads: (HeadMark & { id: string })[];
}

const tip = (pts: readonly Pt[]): Pt => pts[pts.length - 1]!;
const lastAngle = (pts: readonly Pt[]): number => {
  const a = pts[pts.length - 2]!;
  const b = tip(pts);
  return Math.atan2(b.y - a.y, b.x - a.x);
};

export function poseSeaHolly(plant: SeaHolly, g: number): SeaHollyPose {
  const pose: SeaHollyPose = { leaves: [], stems: [], heads: [] };
  const ends = new Map<string, { pts: Pt[]; k: number }>();

  const leafMark = (l: LeafPlan, k: number, base: Pt | null, blue: number): BladeMark & { id: string } => {
    const size = lerp(0.1, 1, smooth(k));
    const spec = { ...l.spec, base: base ?? l.spec.base, len: l.spec.len * size, wid: l.spec.wid * lerp(0.2, 1, smooth(k)) };
    const shade = shadowSide(spec.angle);
    const body = mix(mix(SILVER, LEAF, l.tone * 0.7), STEM_BLUE, blue * 0.5);
    return { id: l.id, geom: bladeGeometry(spec, shade), pigment: body, deep: mix(LEAF_DEEP, STEM_DEEP, blue * 0.5), seed: l.seed, alpha: smooth(k * 3), angle: spec.angle, vein: 0.8 };
  };

  for (const l of plant.leaves) {
    if (l.on) continue;
    const k = ramp(g, l.window[0], l.window[1]);
    if (k < 0.012) continue;
    pose.leaves.push(leafMark(l, k, null, 0));
  }

  const bluing = ramp(g, 0.5, 0.95);
  for (const b of plant.branches) {
    const par = b.parent ? ends.get(b.parent) : null;
    if (b.parent && !par) continue;
    const k = ramp(g, b.window[0], b.window[1]);
    if (k < 0.012) continue;
    let base = b.stem.base;
    if (par) {
      const at = clamp01(b.attach) * (par.pts.length - 1);
      const i = Math.min(par.pts.length - 2, Math.floor(at));
      const f = at - i;
      base = { x: lerp(par.pts[i]!.x, par.pts[i + 1]!.x, f), y: lerp(par.pts[i]!.y, par.pts[i + 1]!.y, f) };
    }
    const pts = stemPoints({ ...b.stem, base }, lerp(0.05, 1, smooth(k)), lerp(0.4, 1, smooth(k)));
    ends.set(b.id, { pts, k });
    const top = clamp01(-tip(pts).y / 70);
    const blue = clamp01(top * 1.25 - 0.15) * bluing;
    pose.stems.push({
      id: b.id,
      pts,
      width: b.width * (0.45 + 0.55 * smooth(k * 1.5)),
      pigment: mix(STEM_LOW, STEM_BLUE, blue),
      deep: mix(LEAF_DEEP, STEM_DEEP, blue),
      seed: b.seed,
    });
  }

  const nodes: [string, string, number][] = [['t', 'node-t', 0.4], ['cL', 'node-cL', 0.55], ['cR', 'node-cR', 0.55]];
  for (const [on, id, win] of nodes) {
    const st = ends.get(on);
    if (!st) continue;
    const kk = ramp(g, 0.44 + (win - 0.4) * 0.3, 0.6 + (win - 0.4) * 0.3);
    if (kk < 0.012) continue;
    const base = tip(st.pts);
    const seed = plant.seeds.ground + id.length * 131 + on.length;
    const r = createRng(seed);
    const top = clamp01(-base.y / 70);
    const small = on === 't' ? 1 : 0.7;
    for (const s of [-1, 1] as const) {
      const spec = blade(r, base, lastAngle(st.pts) + s * r.range(1.05, 1.3), 17 * small * r.range(0.9, 1.1), 10.5 * small, s * 0.2, 3);
      pose.leaves.push(leafMark({ id: `${id}${s}`, spec, window: [0, 1], tone: r.next(), seed: seedOf(r) }, kk, base, top * ramp(g, 0.5, 0.95)));
    }
  }

  for (const [i, h] of plant.heads.entries()) {
    const st = ends.get(h.on);
    if (!st) continue;
    const size = smooth(ramp(g, h.window[0], h.window[0] + 0.12));
    if (size < 0.02) continue;
    const open = ramp(g, h.window[0] + 0.08, h.window[1]);
    const at0 = tip(st.pts);
    const th = lerp(lastAngle(st.pts), UP, 0.55);
    const ax: [number, number] = [Math.cos(th), Math.sin(th)];
    const R = lerp(0.35, 1, size);
    const at = { x: at0.x + ax[0] * h.ry * R * 0.85, y: at0.y + ax[1] * h.ry * R * 0.85 };
    const bracts: (BladeMark & { z: number })[] = [];
    const fan = lerp(0.6, 1.75, smooth(open));
    for (let j = 0; j < h.bracts; j++) {
      const t = ((j + 0.5) / h.bracts) * 2 - 1;
      const angle = th + t * fan;
      const L = h.len * size * lerp(0.8, 1, smooth(open)) * (1 - 0.22 * Math.abs(t));
      const base = { x: at.x - ax[0] * h.ry * 0.5 * R, y: at.y - ax[1] * h.ry * 0.5 * R };
      const spec: BladeSpec = { base, angle, len: L, wid: h.wid * size * lerp(0.7, 1, open), bend: t * 0.12, teeth: 2, jit: h.jit, wave: 0.03, phase: j };
      bracts.push({
        geom: bladeGeometry(spec, shadowSide(angle)),
        pigment: mix(BRACT_BUD, BRACT, smooth(open * 1.4)),
        deep: mix(LEAF_DEEP, STEM_DEEP, 0.5),
        seed: h.seed + j * 17,
        alpha: smooth(size * 2.5),
        angle,
        vein: 0.5,
        z: Math.abs(t) > 0.55 ? 1 : -1,
      });
    }
    const rot = th + Math.PI / 2;
    const dots = h.dots.map(([r, a]) => {
      const x = Math.cos(a) * r * h.rx * R;
      const y = Math.sin(a) * r * h.ry * R;
      return { x: at.x + x * Math.cos(rot) - y * Math.sin(rot), y: at.y + x * Math.sin(rot) + y * Math.cos(rot) };
    });
    pose.heads.push({
      id: `head-${i}`,
      at,
      rx: h.rx * R,
      ry: h.ry * R,
      rot,
      open,
      alpha: smooth(size * 2.5),
      florets: ramp(g, h.window[0] + 0.14, h.window[1] + 0.02),
      dome: mix(mix(BRACT_BUD, DOME, 0.5), DOME, smooth(open * 1.5)),
      domeDeep: DOME_DEEP,
      bracts,
      dots,
      seed: h.seed,
    });
  }
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function seaHollyReach(plant: SeaHolly): Pt[] {
  const pose = poseSeaHolly(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.geom.outline),
    ...pose.stems.flatMap((s) => s.pts),
    ...pose.heads.flatMap((h) => [{ x: h.at.x - h.rx, y: h.at.y - h.ry }, { x: h.at.x + h.rx, y: h.at.y + h.ry }, ...h.bracts.flatMap((b) => b.geom.outline)]),
  ];
}

const seaHolly: SeaHollyDef = {
  id: 'sea-holly',
  name: 'Sea holly',
  nativeName: 'Eryngio',
  nativeLang: 'el-Latn',
  // wild on Mediterranean (and European) sandy coasts
  range: { realms: ['mediterranean', 'europe'], biomes: ['coast'], climates: ['mediterranean'] },
  tier: 2,
  habitats: ['shore'],
  sizeClass: 'small',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Sea holly: a frosted, spiny clump crowned with blue thistle heads.',
  bloomColor: BLOOM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildSeaHolly(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, seaHolly, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 38, ry: 6, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.3, pigment: SHADOW });
      seedMound(p, r, g, { rx: 9, x: plant.foot });
      const pose = poseSeaHolly(plant, g);
      paintLeaves(p, pose.leaves.filter((l) => l.id.startsWith('leaf')));
      paintStems(p, pose.stems);
      paintLeaves(p, pose.leaves.filter((l) => !l.id.startsWith('leaf')));
      paintHeads(p, pose.heads);
    });
  },
};

type SeaHollyDef = SpeciesDef;

export default seaHolly;
