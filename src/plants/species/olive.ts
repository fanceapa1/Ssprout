import { createRng, type Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { PIGMENTS, mix, type Pigment } from '../../paint/pigments';
import { blob, bounds, padRect } from '../../paint/geometry';
import { paintOliveLeaves, paintOliveTrunk, type OliveLeaf, type OliveTrunk } from '../lib/olive-paint';
import { inUnits, paintGroundShadow, paintSeed, paintSkeleton, softRes, stableLayer, visibleBranches } from '../lib/tree-paint';
import { addBranch, addTrunk, branchProgress, clamp01, fitTree, growChildren, growLimb, normalise, pointAt, ramp, stagger, steer, treeView, viewPt, type LevelSpec, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

/**
 * Olive (Olea europaea): an old terrace tree with a short, fat, fluted and twisted trunk and a
 * broad, broken crown of small narrow grey-green leaves whose silver undersides flash.
 */

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

export interface OliveClump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  delay: number;
  id: number;
}

export interface OliveTuft {
  x: number;
  y: number;
  r: number;
  /** -1 shaded … 1 lit */
  lit: number;
  delay: number;
  id: number;
}

export interface OliveBloom {
  x: number;
  y: number;
  /** the tiny flowers of the spray, as offsets */
  dots: Pt[];
  delay: number;
  id: number;
}

export interface OliveFruit {
  x: number;
  y: number;
  r: number;
  rot: number;
  /** how far it ripens toward purple-black, 0..1 */
  ripe: number;
  delay: number;
  id: number;
}

export interface OlivePlan {
  tree: Tree;
  trunk: OliveTrunk;
  clumps: OliveClump[];
  leaves: OliveLeaf[];
  /** a soft wash under each tuft of leaves, so the crown's body breaks up with them */
  tufts: OliveTuft[];
  blooms: OliveBloom[];
  fruits: OliveFruit[];
}

const LEVELS: LevelSpec[] = [
  { count: [3, 4], span: [0.3, 1], angle: [0.4, 0.85], length: [0.42, 0.62], shrink: 0.3, limb: { segments: 4, wander: 0.2, kink: 0.12, gravity: 0.02 }, width: 0.6, tipWidth: 0.35, dur: 0.7 },
  { count: [2, 3], span: [0.4, 1], angle: [0.45, 0.9], length: [0.45, 0.7], limb: { segments: 3, wander: 0.2, gravity: 0.06 }, width: 0.6, tipWidth: 0.45, dur: 0.6 },
];

/** The whole tree for a seed, independent of growth. */
export function planOlive(rng: Rng): OlivePlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-10, 10), y: BASE_Y };
  const tree: Tree = { base: { ...base }, branches: [] };
  const width = r.range(54, 64);
  const trunk = addTrunk(tree, r, base, {
    angle: UP + r.range(-0.16, 0.16),
    length: r.range(108, 132),
    width,
    tipWidth: width * 0.85,
    limb: { segments: 6, wander: 0.09, gravity: -0.03 },
    dur: 0.42,
    tag: 'trunk',
  });
  // three or four scaffold limbs part at the crotch, the outer ones leaning far out
  const n = r.int(3, 4);
  const limbs = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1 + r.range(-0.15, 0.15);
    const at = pointAt(trunk, 0.84);
    const start = { x: at.x + u * width * 0.28, y: at.y };
    const a = UP + u * r.range(0.48, 0.7) + r.gaussian(0, 0.06);
    const pts = growLimb(r, start, a, r.range(165, 205) * (1 - 0.2 * Math.abs(u)), { segments: 7, wander: 0.2, kink: 0.2, gravity: -0.015 });
    const t0 = 0.3 + 0.04 * Math.abs(u) + r.range(0, 0.04);
    limbs.push(addBranch(tree, trunk.id, 1, { pts, w0: width * r.range(0.3, 0.36), w1: 4, attach: 0.84, t0, t1: t0 + 0.55, tag: 'limb' }, r));
  }
  for (const l of limbs) growChildren(tree, l, LEVELS, r);
  normalise(tree);
  fitTree(tree, SIZE, 24, 44);

  const tr = rng.fork('trunk');
  const nr = tr.int(14, 18);
  const ph = tr.range(0, 6.3);
  const oliveTrunk: OliveTrunk = {
    width,
    flare: tr.range(0.45, 0.7),
    twist: tr.range(1.6, 2.4) * (tr.chance(0.5) ? 1 : -1),
    ridges: Array.from({ length: nr }, (_, i) => ph + (i / nr) * Math.PI * 2 + tr.range(-0.2, 0.2)),
    swell: [tr.range(0, 6.3), tr.range(0, 6.3), tr.range(0, 6.3), tr.range(0, 6.3)],
    hollows: Array.from({ length: tr.int(1, 2) }, (_, i) => ({ t: tr.range(0.22, 0.6), theta: (i % 2 ? 0.5 : -0.4) + tr.range(-0.25, 0.25), w: tr.range(0.15, 0.22), h: tr.range(6, 9) })),
    knots: Array.from({ length: tr.int(3, 5) }, () => ({ t: tr.range(0.08, 0.85), theta: tr.range(-1.1, 1.1), r: tr.range(1.5, 2.4) })),
    roots: [
      { side: -1, reach: tr.range(0.5, 0.9), h: tr.range(14, 22) },
      { side: 1, reach: tr.range(0.6, 1), h: tr.range(14, 24) },
      ...(tr.chance(0.6) ? [{ side: tr.chance(0.5) ? -1 : 1, reach: tr.range(0.2, 0.4), h: tr.range(24, 32) }] : []),
    ],
  };

  // clumps of foliage round the twig tips, with sky between them
  const cr = rng.fork('crown');
  const crown = tree.branches.filter((b) => b.order >= 1);
  const tips = crown.filter((b) => b.order >= 2).map((b) => ({ q: pointAt(b, 1), b }));
  const clumps: OliveClump[] = [];
  const gap = 44;
  // the twig tips first, then points along the limbs fill the crown's middle
  const along = crown.filter((b) => b.order === 1).flatMap((b) => [0.55, 0.75].map((f) => ({ q: pointAt(b, f), b })));
  for (const { q, b } of [...cr.shuffle(tips.slice()), ...along]) {
    if (clumps.some((c) => Math.hypot((c.x - q.x) * 0.9, c.y - q.y) < gap)) continue;
    const rx = cr.range(40, 54);
    const ry = rx * cr.range(0.55, 0.68);
    const x = Math.max(rx + 4, Math.min(SIZE.w - rx - 4, q.x));
    const y = Math.max(ry + 4, q.y + ry * 0.2);
    clumps.push({ x, y, rx, ry, delay: clamp01(b.t1 * 0.55 + cr.range(0, 0.3)), id: clumps.length });
  }
  // the crown's broad extent and lit side, for the leaves' tones
  const xs = clumps.map((c) => c.x);
  const ys = clumps.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const top = Math.min(...ys);
  const low = Math.max(...ys);

  const lr = rng.fork('leaves');
  const leaves: OliveLeaf[] = [];
  const tufts: OliveTuft[] = [];
  const blooms: OliveBloom[] = [];
  const fruits: OliveFruit[] = [];
  for (const c of clumps) {
    const sprays = Math.round((c.rx * c.ry) / 26);
    for (let s = 0; s < sprays; s++) {
      const th = lr.range(-Math.PI, Math.PI);
      // more sprays on the rim, which makes the crown's feathery edge
      const d = Math.sqrt(lr.next()) ** 0.7;
      const sx = c.x + Math.cos(th) * c.rx * d * 0.85;
      const sy = c.y + Math.sin(th) * c.ry * d * 0.85;
      // rim sprays reach out and droop; inner ones go any way
      let a = d > 0.55 ? Math.atan2(Math.sin(th) * 0.8, Math.cos(th)) + lr.gaussian(0, 0.35) : lr.range(-Math.PI, Math.PI);
      a = steer(a, DOWN, 0.18);
      const len = lr.range(8, 13);
      const local = (-(sy - c.y) / c.ry) * 0.75 - ((sx - c.x) / c.rx) * 0.35;
      const whole = -((sy - top) / Math.max(1, low - top) - 0.5) * 0.6 - ((sx - cx) / 160) * 0.2;
      const lit = local + whole;
      // the wind turns a whole twig over and shows its silver undersides
      const turned = lr.chance(0.06 + 0.22 * clamp01(lit) + (d > 0.6 ? 0.06 : 0));
      const delay = clamp01(c.delay + lr.range(0, 0.25));
      const curl = lr.range(-0.012, 0.012);
      const leafAt = (f: number) => {
        const ang = a + curl * len * f;
        return { x: sx + Math.cos(a) * len * f, y: sy + Math.sin(a) * len * f + curl * len * len * f * f * 0.5, ang };
      };
      const mid = leafAt(0.55);
      tufts.push({ x: mid.x, y: mid.y, r: len * lr.range(0.85, 1.1), lit: Math.max(-1, Math.min(1, lit)), delay, id: tufts.length });
      // loose tufts, not pinnate fronds: leaves fan from the twig at uneven angles and spacing
      const nl = lr.int(6, 9);
      for (let k = 0; k < nl; k++) {
        const f = 0.1 + 0.9 * lr.next() ** 0.8;
        const q = leafAt(f);
        const side = lr.chance(0.5) ? 1 : -1;
        const silver = turned ? lr.chance(0.75) : lr.chance(0.06 + 0.3 * clamp01(lit - 0.1));
        const tone: 0 | 1 | 2 = silver ? 2 : lit < -0.25 && lr.chance(0.7) ? 0 : lr.chance(0.12) ? 0 : 1;
        leaves.push({
          // kept a leaf's length inside the box
          x: Math.max(7, Math.min(SIZE.w - 7, q.x + lr.gaussian(0, 0.8))),
          y: Math.max(7, q.y + lr.gaussian(0, 0.8)),
          angle: steer(q.ang + side * lr.range(0.25, 1.1), DOWN, 0.15),
          length: lr.range(4.6, 6.2),
          tone,
          asym: lr.range(-0.25, 0.25),
          curve: lr.range(-0.15, 0.15),
          delay: clamp01(delay + f * 0.08),
        });
      }
      // a spray of tiny cream flowers on the outer, upper twigs; olives hang lower
      if (lr.chance(lit > -0.1 ? 0.06 : 0.015)) {
        const q = leafAt(lr.range(0.3, 0.6));
        const dots = Array.from({ length: lr.int(5, 8) }, () => ({ x: lr.gaussian(0, 2.2), y: lr.gaussian(0, 1.6) + 1.5 }));
        blooms.push({ x: q.x, y: q.y, dots, delay: lr.next(), id: blooms.length });
      }
      if (lr.chance(lit < 0.3 ? 0.035 : 0.01)) {
        const q = leafAt(lr.range(0.35, 0.8));
        const nf = lr.int(1, 3);
        for (let j = 0; j < nf; j++)
          fruits.push({ x: q.x + (j - (nf - 1) / 2) * 3.4 + lr.range(-0.6, 0.6), y: q.y + lr.range(2, 4), r: lr.range(1.5, 1.9), rot: lr.range(0.9, 2.2), ripe: lr.chance(0.7) ? lr.range(0.8, 1) : lr.range(0.2, 0.55), delay: lr.next(), id: fruits.length });
      }
    }
  }
  return { tree, trunk: oliveTrunk, clumps, leaves, tufts, blooms, fruits };
}

/** How far each mark has arrived at growth g (0 = not yet, 1 = full); the draw uses these. */
export function oliveArrivals(g: number) {
  return {
    /** the trunk's age: 0 a smooth young stem … 1 fat, fluted and twisted */
    age: ramp(g, 0.38, 0.95),
    clump: (c: OliveClump) => stagger(g, 0.38, 0.76, c.delay, 0.16),
    leaf: (l: { delay: number }) => stagger(g, 0.4, 0.8, l.delay, 0.12),
    /** the whip's and the young tree's few leaves at the tips, handing over to the crown */
    tips: ramp(g, 0.02, 0.07) * (1 - ramp(g, 0.52, 0.7)),
    bloom: (b: OliveBloom) => ramp(g, 0.6 + b.delay * 0.06, 0.66 + b.delay * 0.06) * (1 - ramp(g, 0.79, 0.85)),
    fruit: (f: OliveFruit) => ramp(g, 0.8 + f.delay * 0.05, 0.88 + f.delay * 0.05),
    ripe: (f: OliveFruit) => f.ripe * ramp(g, 0.88 + f.delay * 0.04, 0.99),
  };
}

const BARK = '#9a8b78';
const COLOURS = { bark: BARK, young: '#a19e95', shade: '#6a5d52', groove: '#4a4038', lit: '#ddd6c8' };
const WASH = '#a4b29c';
const SHADE = '#6d8070';
const LEAF: Record<0 | 1 | 2, Pigment> = { 0: '#4f6354', 1: '#7a8f76', 2: '#e1e6d8' };
const FLOWER = '#efe9d2';
const FRUIT_GREEN = '#8a9a4e';
const FRUIT_PURPLE = '#6a4560';
const FRUIT_BLACK = '#3f3240';

const YOUNG: Record<0 | 1 | 2, Pigment> = { 0: '#6f8a6c', 1: '#8fa38a', 2: '#b9c4b0' };

/** The whip's and the young tree's leaves: pairs along the outer part of every shoot, from the paths as painted. */
function youngLeaves(vis: readonly { b: { id: number; order: number }; path: Pt[] }[], amount: number): { at: Pt; l: OliveLeaf; k: number }[] {
  const out: { at: Pt; l: OliveLeaf; k: number }[] = [];
  // the whip carries its own leaves until it branches
  const whip = vis.length === 1;
  for (const v of vis) {
    if (v.b.order === 0 && !whip) continue;
    let run = 0;
    let n = 0;
    for (let i = 1; i < v.path.length; i++) {
      const a = v.path[i - 1]!;
      const q = v.path[i]!;
      run += Math.hypot(q.x - a.x, q.y - a.y);
      if (run < (whip ? 4 : 6.5)) continue;
      run = 0;
      n++;
      const heading = Math.atan2(q.y - a.y, q.x - a.x);
      const fromTip = (v.path.length - 1 - i) / v.path.length;
      if (fromTip > (whip ? 0.85 : 0.7)) continue;
      for (const side of [-1, 1]) {
        const tone = ((n + v.b.id + (side > 0 ? 1 : 0)) % 3) as 0 | 1 | 2;
        const l: OliveLeaf = { x: q.x, y: q.y, angle: steer(heading + side * 0.65, DOWN, 0.12), length: whip ? 8 : 6.4, tone, asym: 0, curve: side * 0.1, delay: 0 };
        out.push({ at: q, l, k: amount * (1 - ramp(fromTip, 0.45, 0.7)) });
      }
    }
  }
  return out;
}

function fruitColour(ripe: number): Pigment {
  return ripe < 0.5 ? mix(FRUIT_GREEN, FRUIT_PURPLE, ripe * 2) : mix(FRUIT_PURPLE, FRUIT_BLACK, ripe * 2 - 1);
}

const olive: SpeciesDef = {
  id: 'olive',
  name: 'Olive',
  nativeName: 'Eliá',
  nativeLang: 'el-Latn',
  // wild in Mediterranean maquis; planted round the whole basin and in the Maghreb's oases
  range: { realms: ['mediterranean'], biomes: ['coast'], climates: ['warm-temperate'], cultivatedIn: ['mediterranean', 'n-africa-arabia'] },
  tier: 4,
  habitats: ['meadow', 'back'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Olive — a wrung old trunk under a crown that flashes silver.',
  bloomColor: '#e8e0c4',
  pollinators: false,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planOlive(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const arrive = oliveArrivals(g);
    const base = plan.tree.base;
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, base, 105, view, pr, mix(PIGMENTS.stoneWarm, PIGMENTS.shadow, 0.5));
      paintSeed(p, base, g, pr, '#5d4a40');
      const trunk = plan.tree.branches[0]!;
      const limbs = { base, branches: plan.tree.branches.filter((b) => b.order > 1) };
      paintSkeleton(p, limbs, view, pr.fork('limbs'), { pigment: mix(COLOURS.young, BARK, arrive.age), texture: 0.4 * arrive.age, modelling: 0.45, textureMin: 6, flare: 0, opacity: 0.88 });
      paintOliveTrunk(p, trunk, plan.trunk, view, branchProgress(trunk, view.tau), arrive.age, pr.fork('trunk'), COLOURS, plan.tree.branches.filter((b) => b.parent === trunk.id));
      if (arrive.tips > 0.01) paintOliveLeaves(p, youngLeaves(visibleBranches(plan.tree, view), arrive.tips), view, (l) => YOUNG[l.tone], pr.fork('young'), { opacity: 0.85, edge: 0.45, edgeWidth: 0.6, sharpness: 0.75, centreLift: 0.25, granulation: 0.1, flow: 0.3, flowScale: 8 });

      const s = view.scale;
      // the crown's body: a soft wash under each tuft (pale on the lit side, cool beneath), then the leaves
      const tufts = plan.tufts.map((t) => ({ t, k: arrive.leaf(t), at: viewPt(view, t) })).filter((x) => x.k > 0.03);
      if (tufts.length) {
        const W = stableLayer(p, padRect(bounds(tufts.map((x) => x.at)), 20 * s), pr.fork('wash'), softRes(p));
        for (const { t, k, at } of tufts) {
          const r = createRng(t.id * 97 + 5);
          const rad = t.r * s * (0.5 + 0.5 * k);
          W.fill(blob(at.x, at.y, rad, rad * 0.7, r, { points: 10, irregularity: 0.3, rotation: r.range(-0.6, 0.6) }), t.lit > -0.2 ? WASH : SHADE, 0.4 * Math.min(1, k * 2));
        }
        W.dry({ opacity: 0.7, edge: 0.12, edgeWidth: 2, sharpness: 0.35, centreLift: 0.15, granulation: 0.15, flow: 0.5, flowScale: 14 });
      }
      const leaves = plan.leaves.map((l) => ({ l, k: arrive.leaf(l), at: viewPt(view, l) }));
      const leafDry = { opacity: 0.85, edge: 0.45, edgeWidth: 0.6, sharpness: 0.75, centreLift: 0.25, granulation: 0.12, flow: 0.35, flowScale: 10, darken: 0.2 };
      paintOliveLeaves(p, leaves.filter((x) => x.l.tone < 2), view, (l) => LEAF[l.tone], pr.fork('leaves'), leafDry);
      // the olives hang among the leaves, and the silver ones turned up in the wind cover some
      const olives = plan.fruits.flatMap((f) => {
        const k = arrive.fruit(f);
        if (k < 0.03) return [];
        return [{ id: f.id, at: viewPt(view, f), rx: f.r * s * k, ry: f.r * 0.74 * s * k, rot: f.rot, pigment: fruitColour(arrive.ripe(f)), alpha: 0.95 * Math.min(1, k * 2) }];
      });
      const flowers = plan.blooms.flatMap((b) => {
        const k = arrive.bloom(b);
        if (k < 0.03) return [];
        const at = viewPt(view, b);
        return b.dots.map((d, j) => ({ id: b.id * 16 + j, at: { x: at.x + d.x * s, y: at.y + d.y * s }, rx: 0.95 * s * k, ry: 0.85 * s * k, rot: 0, pigment: FLOWER, alpha: 0.9 * Math.min(1, k * 2) }));
      });
      paintOliveLeaves(p, leaves.filter((x) => x.l.tone === 2), view, () => LEAF[2], pr.fork('leaves-silver'), { ...leafDry, opacity: 0.92, edge: 0.3, blend: 'source-over' }, olives, flowers);
    });
  },
};

export default olive;
