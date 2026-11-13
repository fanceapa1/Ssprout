import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { PIGMENTS, mix } from '../../paint/pigments';
import { paintPineBark, paintPineCones, paintPineNeedles, paintPineWash, toneOf, type PineColours, type PineCone, type PineTuft } from '../lib/aleppo-pine-paint';
import { inUnits, paintGroundShadow, paintSeed, paintSkeleton, visibleBranches } from '../lib/tree-paint';
import { addBranch, clamp01, fitTree, growChildren, growLimb, headingAt, normalise, pointAt, ramp, stagger, startTree, steer, treeView, viewPt, widthAt, type Branch, type LevelSpec, type Tree, type TreeView } from '../lib/tree-structure';
import type { Painter } from '../../paint';
import type { SpeciesDef } from '../types';

/**
 * Aleppo pine (Pinus halepensis): the pine of Greek sea cliffs. A slender leaning trunk, red-brown
 * and fissured low down and silver above, forks high into sinuous limbs under a light, broken
 * crown of soft yellow-green needle clouds with sky between them.
 */

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;
/** the skeleton takes longer than most trees, so the sapling and the young tree get their own stages */
export const ALEPPO_TIMING = { structureEnd: 0.6, minScale: 0.3 };

export interface AleppoPinePlan {
  tree: Tree;
  /** +1 the crown leans right (downwind), −1 left */
  lean: number;
  /** the needle tufts of the grown crown */
  tufts: PineTuft[];
  cones: PineCone[];
}

export interface AleppoPineOptions {
  /** force the lean (a scenery pine leaning out of the frame's edge); the seed picks otherwise */
  lean?: 1 | -1;
}

const WHORLS: LevelSpec = { count: [6, 8], span: [0.12, 0.62], angle: [1.0, 1.3], length: [0.13, 0.2], shrink: 0.7, up: 0.12, limb: { segments: 3, wander: 0.12, gravity: 0.04 }, width: 0.42, tipWidth: 0.4, dur: 0.45, lag: 0.01, tag: 'whorl' };
const CROWN: LevelSpec[] = [
  { count: [2, 4], span: [0.3, 1], angle: [0.55, 1.1], length: [0.45, 0.7], shrink: 0.3, level: 0.45, limb: { segments: 4, wander: 0.22, kink: 0.1, gravity: 0.03 }, width: 0.6, tipWidth: 0.4, dur: 0.7 },
  { count: [1, 3], span: [0.45, 1], angle: [0.4, 0.9], length: [0.4, 0.6], level: 0.25, limb: { segments: 3, wander: 0.2, gravity: 0.02 }, width: 0.65, tipWidth: 0.45, dur: 0.6 },
];

const SIDES: LevelSpec = { count: [2, 4], span: [0.4, 0.6], angle: [0.95, 1.3], length: [0.2, 0.3], shrink: 0.2, level: 0.4, limb: { segments: 4, wander: 0.2, kink: 0.1, gravity: 0.03 }, width: 0.42, tipWidth: 0.35, dur: 0.5, tag: 'side' };

/** The whole tree for a seed, independent of growth. */
export function planAleppoPine(rng: Rng, opts: AleppoPineOptions = {}): AleppoPinePlan {
  const r = rng.fork('structure');
  const coin = r.chance(0.5);
  const side = opts.lean ?? (coin ? 1 : -1);
  const base = { x: SIZE.w / 2 - side * r.range(44, 64), y: BASE_Y };
  const width = r.range(13, 16);
  const tree = startTree(r, base, {
    angle: UP + side * r.range(0.2, 0.34),
    length: r.range(300, 340),
    width,
    tipWidth: 2.5,
    limb: { segments: 10, wander: 0.09, kink: 0.07, gravity: -0.015, lengthJitter: 0.3 },
    dur: 1,
  });
  const trunk = tree.branches[0]!;
  // the sapling's whorls of side branches, shed as the tree grows up
  growChildren(tree, trunk, [WHORLS], r);
  // a few sinuous limbs part high up: long and low downwind, short and steep upwind
  const n = r.int(3, 4);
  const fork = r.range(0.58, 0.7);
  const limbs: Branch[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    const down = u * side > 0;
    const attach = fork + (i / n) * r.range(0.08, 0.2);
    const at = pointAt(trunk, attach);
    const a = UP + u * r.range(0.5, 0.85) + side * 0.22 + r.gaussian(0, 0.06);
    const len = r.range(85, 115) * (down ? 1.25 : 0.7);
    const pts = growLimb(r, at, a, len, { segments: 6, wander: 0.2, kink: 0.14, gravity: down ? 0.0 : -0.04 });
    const w0 = widthAt(trunk, attach) * r.range(0.55, 0.7);
    const t0 = attach + 0.02;
    limbs.push(addBranch(tree, trunk.id, 1, { pts, w0, w1: w0 * 0.3, attach, t0, t1: t0 + 0.6 + 0.1 * Math.abs(u), tag: 'limb' }, r));
  }
  for (const l of limbs) growChildren(tree, l, CROWN, r);
  // the grown tree keeps a few side branches below the fork, so the crown reaches down the stem
  growChildren(tree, trunk, [SIDES, CROWN[1]!], r);
  growChildren(tree, trunk, [{ ...CROWN[0]!, count: [1, 2], span: [0.88, 1] }, CROWN[1]!], r);
  normalise(tree);
  fitTree(tree, SIZE, 30, 34);

  // needle clouds round the twig tips, flattened, with sky between them
  const cr = rng.fork('crown');
  const crown = tree.branches.filter((b) => b.tag !== 'whorl' && (b.order >= 2 || b.tag === 'limb' || b.tag === 'side' || b.order === 0));
  const seeds = cr.shuffle(crown.map((b) => ({ q: pointAt(b, 1), b })));
  const along = crown.filter((b) => b.order >= 1 && b.order <= 2).map((b) => ({ q: pointAt(b, 0.6), b }));
  const clouds: { x: number; y: number; rx: number; ry: number; delay: number }[] = [];
  for (const { q, b } of [...seeds, ...along]) {
    if (clouds.some((c) => Math.hypot((c.x - q.x) * 0.8, (c.y - q.y) * 1.3) < 38)) continue;
    const rx = cr.range(32, 46);
    const ry = rx * cr.range(0.38, 0.5);
    const x = Math.max(rx + 8, Math.min(SIZE.w - rx - 8, q.x));
    const y = Math.max(ry + 10, q.y - ry * 0.25);
    clouds.push({ x, y, rx, ry, delay: clamp01(b.t1 * 0.6 + cr.range(0, 0.3)) });
  }
  const xs = clouds.map((c) => c.x);
  const ys = clouds.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const top = Math.min(...ys);
  const low = Math.max(...ys);

  const tr = rng.fork('tufts');
  const tufts: PineTuft[] = [];
  for (const c of clouds) {
    const count = Math.round((c.rx * c.ry) / 24);
    for (let k = 0; k < count; k++) {
      const th = tr.range(-Math.PI, Math.PI);
      const d = Math.sqrt(tr.next()) ** 0.6;
      const x = c.x + Math.cos(th) * c.rx * d * 0.85;
      const y = c.y + Math.sin(th) * c.ry * d * 0.8;
      // rim tufts point outward and up; the twigs' needles brush upward
      const angle = steer(Math.atan2(Math.sin(th) * 0.8, Math.cos(th)) + tr.gaussian(0, 0.3), UP, d > 0.5 ? 0.35 : 0.6);
      const local = (-(y - c.y) / c.ry) * 0.7 - ((x - c.x) / c.rx) * 0.3;
      const whole = -((y - top) / Math.max(1, low - top) - 0.5) * 0.5 - ((x - cx) / 180) * 0.2;
      const rad = tr.range(7, 10);
      tufts.push({
        x: Math.max(rad + 2, Math.min(SIZE.w - rad - 2, x)),
        y: Math.max(rad + 2, y),
        r: rad,
        angle,
        lit: Math.max(-1, Math.min(1, local + whole + tr.gaussian(0, 0.15))),
        delay: clamp01(c.delay + tr.range(0, 0.2)),
        id: tufts.length,
      });
    }
  }

  // cones in ones and twos on the outer branches, pointing back along them
  const kr = rng.fork('cones');
  const cones: PineCone[] = [];
  for (const b of crown) {
    if (b.order < 2 || !kr.chance(0.4)) continue;
    const f = kr.range(0.4, 0.8);
    const q = pointAt(b, f);
    const back = steer(headingAt(b, f) + Math.PI, DOWN, 0.5);
    const pair = kr.chance(0.45) ? 2 : 1;
    const old = kr.chance(0.3);
    for (let j = 0; j < pair; j++) {
      cones.push({ x: q.x, y: q.y + 1, angle: back + (j - (pair - 1) / 2) * 0.7 + kr.gaussian(0, 0.1), length: kr.range(6.5, 8.5), old, delay: kr.next(), id: cones.length });
    }
  }
  return { tree, lean: side, tufts, cones };
}

/** How far each mark has arrived at growth g (0 = not yet, 1 = full); the draw uses these. */
export function aleppoArrivals(g: number) {
  return {
    /** the bark's age: 0 a smooth young stem … 1 red-brown and fissured low down */
    age: ramp(g, 0.3, 0.92),
    /** the seedling's and the sapling's needle brushes, handing over to the crown */
    young: ramp(g, 0.008, 0.1) * (1 - ramp(g, 0.62, 0.8)),
    /** a sapling whorl, shed from the bottom up as the tree grows */
    whorl: (b: Pick<Branch, 'attach'>) => 1 - ramp(g, 0.5 + 0.22 * b.attach, 0.6 + 0.22 * b.attach),
    tuft: (t: Pick<PineTuft, 'delay'>) => stagger(g, 0.4, 0.86, t.delay, 0.14),
    cone: (c: Pick<PineCone, 'delay'>) => ramp(g, 0.8 + c.delay * 0.1, 0.88 + c.delay * 0.1),
  };
}

export const ALEPPO_COLOURS: PineColours = {
  silver: '#a39e95',
  red: '#a0694a',
  fissure: '#4f3b31',
  plate: '#b98a64',
  wash: ['#bcc77f', '#93ab5c', '#667f5c'],
  needle: ['#86a24c', '#5f7f42', '#475f40'],
  cone: '#a86a40',
  oldCone: '#8d8780',
};
const YOUNG = '#7f9c84';
const YOUNG_STEM = '#8a7d62';

/** The sapling's needle brushes: at the leader's tip, down its top, and at every whorl's tip. */
function youngTufts(vis: readonly { b: Branch; path: Pt[] }[], amount: number, whorl: (b: Branch) => number): { t: PineTuft; at: Pt; k: number }[] {
  const out: { t: PineTuft; at: Pt; k: number }[] = [];
  for (const v of vis) {
    const n = v.path.length;
    if (n < 2) continue;
    const tip = v.path[n - 1]!;
    const prev = v.path[Math.max(0, n - 4)]!;
    const heading = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    if (v.b.order === 0) {
      out.push({ t: { x: tip.x, y: tip.y, r: 11, angle: steer(heading, UP, 0.5), lit: 0, delay: 0, id: 9000 }, at: tip, k: amount });
      // a bottle brush down the top of the leader
      for (let i = n - 5, j = 0; i > n * 0.45 && j < 5; i -= 4, j++) {
        const q = v.path[i]!;
        out.push({ t: { x: q.x, y: q.y, r: 8, angle: steer(heading + (j % 2 ? 1.1 : -1.1), UP, 0.3), lit: 0, delay: 0, id: 9001 + j }, at: q, k: amount * 0.85 });
      }
    } else if (v.b.tag === 'whorl') {
      const k = amount * whorl(v.b);
      if (k > 0.03) out.push({ t: { x: tip.x, y: tip.y, r: 9, angle: steer(heading, UP, 0.25), lit: 0, delay: 0, id: 9100 + v.b.id }, at: tip, k });
    }
  }
  return out;
}

/**
 * Paint a planned Aleppo pine at growth g, in its box's units (the caller sets the transform):
 * the species draws it inside `inUnits`, and a scenery can draw it at its own scale.
 */
export function paintAleppoPine(p: Painter, plan: AleppoPinePlan, g: number, pr: Rng): void {
  const view: TreeView = treeView(g, plan.tree.base, ALEPPO_TIMING);
  const arrive = aleppoArrivals(g);
  const base = plan.tree.base;
  const s = view.scale;
  paintGroundShadow(p, base, 90, view, pr, mix(PIGMENTS.stoneWarm, PIGMENTS.shadow, 0.5));
  paintSeed(p, base, g, pr, '#6a5040');
  const bark = mix(YOUNG_STEM, ALEPPO_COLOURS.silver, ramp(g, 0.1, 0.5));
  for (const w of plan.tree.branches) {
    if (w.tag !== 'whorl') continue;
    const k = arrive.whorl(w);
    if (k > 0.02) paintSkeleton(p, { base, branches: [w] }, view, pr.fork(`whorl-${w.id}`), { pigment: bark, texture: 0, modelling: 0, opacity: 0.9 * k, flare: 0 });
  }
  const vis = paintSkeleton(p, plan.tree, view, pr.fork('limbs'), { pigment: bark, texture: 0.45, modelling: 0.5, textureMin: 4, flare: 0.3, wobble: 0.3, skipTags: ['whorl'] });
  const trunk = vis.find((v) => v.b.order === 0);
  if (trunk) paintPineBark(p, trunk.path, trunk.hw, arrive.age, ALEPPO_COLOURS, pr.fork('bark'), 0.62);
  if (arrive.young > 0.01) {
    const all = visibleBranches(plan.tree, view);
    const young = youngTufts(all, arrive.young, arrive.whorl);
    paintPineNeedles(p, young, Math.max(0.55, s), () => YOUNG, pr.fork('young'), { opacity: 0.85, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.2, granulation: 0.1, flow: 0.3, flowScale: 8 });
  }
  const tufts = plan.tufts.map((t) => ({ t, k: arrive.tuft(t), at: viewPt(view, t) }));
  paintPineWash(p, tufts, s, ALEPPO_COLOURS, pr.fork('wash'));
  const cones = plan.cones.map((c) => ({ c, k: arrive.cone(c), at: viewPt(view, c) }));
  paintPineCones(p, cones, s, ALEPPO_COLOURS, pr.fork('cones'));
  paintPineNeedles(p, tufts, s, (t) => ALEPPO_COLOURS.needle[toneOf(t.lit)], pr.fork('needles'), { opacity: 0.82, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.2, granulation: 0.12, flow: 0.35, flowScale: 10, darken: 0.2 });
}

const aleppoPine: SpeciesDef = {
  id: 'aleppo-pine',
  name: 'Aleppo Pine',
  nativeName: 'Péfko',
  nativeLang: 'el-Latn',
  // wild round the Mediterranean on coasts and dry limestone hills, the Maghreb's hills included
  range: { realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] },
  tier: 4,
  habitats: ['back'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Aleppo pine — a leaning trunk, soft needle clouds over the sea.',
  bloomColor: '#b9b060',
  pollinators: false,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planAleppoPine(rng);
    inUnits(p, SIZE, opts, () => paintAleppoPine(p, plan, g, rng.fork('paint')));
  },
};

export default aleppoPine;
