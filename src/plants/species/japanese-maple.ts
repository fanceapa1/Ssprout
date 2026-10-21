import type { Rng } from '../../core/rng';
import { PIGMENTS, darken, mix, saturate } from '../../paint/pigments';
import type { FoliagePigments } from '../../paint/recipes';
import { inUnits, paintGroundShadow, paintLeaves, paintPadMass, paintSeed, paintSkeleton, paintTipLeaves, type Leaf, type Pad } from '../lib/tree-paint';
import { addTrunk, fitTree, growChildren, normalise, pointAt, ramp, stagger, startTree, treeView, type LevelSpec, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;

export interface JapaneseMaplePlan {
  tree: Tree;
  pads: Pad[];
  /** small palmate leaves fringing the pads */
  leaves: Leaf[];
  /** a few leaves already fallen on the ground */
  fallen: Leaf[];
}

const LEVELS: LevelSpec[] = [
  { count: [4, 6], span: [0.3, 1], angle: [0.55, 1.15], length: [0.36, 0.56], shrink: 0.4, level: 0.45, limb: { segments: 5, wander: 0.1, gravity: 0.02 }, width: 0.68, tipWidth: 0.3, dur: 0.85 },
  { count: [2, 4], span: [0.25, 1], angle: [0.3, 0.8], length: [0.45, 0.7], level: 0.5, limb: { segments: 4, wander: 0.12 }, width: 0.65, tipWidth: 0.3, dur: 0.8 },
  { count: [1, 3], span: [0.4, 1], angle: [0.3, 0.9], length: [0.3, 0.5], level: 0.3, limb: { segments: 3, wander: 0.15 }, width: 0.7, tipWidth: 0.4, dur: 0.7 },
];

/** The whole tree for a seed — independent of growth. */
export function planJapaneseMaple(rng: Rng): JapaneseMaplePlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-12, 12), y: BASE_Y };
  const lean = r.range(-0.16, 0.16);
  const trunkLen = r.range(230, 280);
  const tree = startTree(r, base, {
    angle: UP + lean,
    length: trunkLen,
    width: r.range(8, 10.5),
    tipWidth: 3,
    limb: { segments: 6, wander: 0.09, curl: r.range(-0.04, 0.04) },
    dur: 0.9,
  });
  growChildren(tree, tree.branches[0]!, LEVELS, r);
  if (r.chance(0.45)) {
    // a second, slimmer stem from the foot (garden maples are often multi-stemmed)
    const side = lean >= 0 ? -1 : 1;
    const stem = addTrunk(tree, r, { x: base.x + side * 3, y: base.y }, {
      angle: UP + side * r.range(0.25, 0.45),
      length: trunkLen * r.range(0.6, 0.8),
      width: r.range(5.5, 7),
      tipWidth: 2.2,
      limb: { segments: 5, wander: 0.1, curl: -side * 0.04 },
      dur: 0.8,
    }, 0.06);
    growChildren(tree, stem, [{ ...LEVELS[0]!, count: [2, 3] }, LEVELS[1]!, LEVELS[2]!], r);
  }
  normalise(tree);
  fitTree(tree, SIZE, 30, 30);

  // flat pads layered along the horizontal limbs, like tiers
  const pr = rng.fork('pads');
  const pads: Pad[] = [];
  const tryPad = (x: number, y: number, rad: number, delay: number, branch: number) => {
    for (const q of pads) if (Math.hypot((q.x - x) * 0.8, (q.y - y) * 1.6) < (q.r + rad) * 0.42) return;
    pads.push({ x, y, r: rad, delay, id: pads.length, depth: pr.range(-1, 1), branch });
  };
  for (const t of tree.branches.filter((b) => b.order === 0)) {
    const tip = pointAt(t, 1);
    tryPad(tip.x, tip.y - 6, pr.range(26, 34), pr.range(0.3, 0.7), t.id);
  }
  const sorted = tree.branches.slice().sort((a, b) => b.order - a.order || a.id - b.id);
  for (const b of sorted) {
    if (b.order < 1) continue;
    const tip = pointAt(b, 1);
    const rad = b.order >= 3 ? pr.range(22, 30) : b.order === 2 ? pr.range(28, 38) : pr.range(32, 42);
    tryPad(tip.x + pr.range(-4, 4), tip.y - rad * 0.12, rad, Math.min(1, b.t1 * 0.6 + pr.range(0, 0.4)), b.id);
    if (b.order <= 3 && b.len > 30) {
      const mid = pointAt(b, pr.range(0.5, 0.7));
      const r2 = rad * pr.range(0.7, 0.9);
      tryPad(mid.x, mid.y - r2 * 0.2, r2, Math.min(1, b.t1 * 0.6 + pr.range(0, 0.4)), b.id);
    }
  }
  // palmate leaves: little five-lobed stars along each pad's rim, more on top and at the ends
  const lr = rng.fork('leaves');
  const leaves: Leaf[] = [];
  for (const pad of pads) {
    const n = Math.round(pad.r / 7);
    for (let i = 0; i < n; i++) {
      const th = lr.range(-Math.PI, Math.PI);
      const rimY = Math.sin(th) > 0 ? 0.32 : 0.5;
      const cx = pad.x + Math.cos(th) * pad.r * lr.range(0.75, 1.0);
      const cy = pad.y + Math.sin(th) * pad.r * rimY * lr.range(0.8, 1.05);
      const size = lr.range(4.2, 6.2);
      const lobes = 5;
      const rot = lr.range(-0.4, 0.4);
      const tone = lr.range(0, 0.75);
      for (let k = 0; k < lobes; k++) {
        const a = UP + rot + (k - (lobes - 1) / 2) * 0.72 + lr.gaussian(0, 0.08);
        leaves.push({
          x: cx,
          y: cy,
          angle: a,
          length: size * (k === 2 ? 1 : k === 1 || k === 3 ? 0.88 : 0.62),
          width: 0.36,
          tone,
          delay: pad.delay,
          id: leaves.length,
          curve: 0,
        });
      }
    }
  }
  const fr = rng.fork('fallen');
  const fallen: Leaf[] = Array.from({ length: fr.int(4, 8) }, (_, i) => ({
    x: base.x + fr.gaussian(0, 50),
    y: BASE_Y + fr.range(-2, 6),
    angle: fr.range(0, Math.PI * 2),
    length: fr.range(3.5, 5),
    width: 0.6,
    tone: fr.range(0, 1),
    delay: fr.range(0, 1),
    id: i,
    variant: 'leaf' as const,
  }));
  return { tree, pads, leaves, fallen };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.45);
const SPRING: FoliagePigments = { light: mix(PIGMENTS.sageLight, PIGMENTS.gold, 0.25), mid: mix(PIGMENTS.sap, PIGMENTS.gold, 0.2), shadow: PIGMENTS.sage, dark: PIGMENTS.olive };
const CRIMSON = '#b4474a';
const AUTUMN_TOP: FoliagePigments = { light: saturate(mix(PIGMENTS.vermilion, PIGMENTS.gold, 0.42), 1.15), mid: mix(PIGMENTS.vermilion, CRIMSON, 0.3), shadow: CRIMSON, dark: darken(CRIMSON, 0.22) };
const AUTUMN_LOW: FoliagePigments = { light: mix(PIGMENTS.vermilion, CRIMSON, 0.25), mid: mix(PIGMENTS.vermilion, CRIMSON, 0.7), shadow: darken(CRIMSON, 0.08), dark: mix(darken(CRIMSON, 0.28), PIGMENTS.sumi, 0.2) };

function blend(a: FoliagePigments, b: FoliagePigments, t: number): FoliagePigments {
  return { light: mix(a.light, b.light, t), mid: mix(a.mid, b.mid, t), shadow: mix(a.shadow, b.shadow, t), dark: mix(a.dark ?? a.shadow, b.dark ?? b.shadow, t) };
}

const japaneseMaple: SpeciesDef = {
  id: 'japanese-maple',
  name: 'Japanese Maple',
  nativeName: 'Momiji',
  tier: 4,
  habitats: ['back', 'meadow', 'shore'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Tier upon tier of small red hands, catching the low sun.',
  bloomColor: PIGMENTS.vermilion,
  pollinators: false,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planJapaneseMaple(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const ys = plan.pads.map((q) => q.y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const height = (pad: { y: number }) => (bottom - pad.y) / Math.max(1, bottom - top);
    const colour = (d: number) => stagger(g, 0.72, 1, d, 0.16);
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 95, view, pr);
      paintSeed(p, plan.tree.base, g, pr);
      const vis = paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 0.5, modelling: 0.55, flare: 0.35 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.45, 0.66), pr, { pigment: mix(PIGMENTS.sageLight, PIGMENTS.vermilion, 0.3) });
      paintPadMass(
        p,
        plan.pads,
        view,
        pr,
        (pad) => stagger(g, 0.48, 0.76, pad.delay, 0.14),
        (pad) => blend(SPRING, blend(AUTUMN_LOW, AUTUMN_TOP, height(pad)), colour(pad.delay)),
        { flatness: 0.42, light: -2.2, opacity: 0.84, gaps: 0.45, dabSize: 0.22, shadow: 0.85 },
      );
      const c = colour(0.5);
      const light = mix(mix(PIGMENTS.sageLight, PIGMENTS.gold, 0.3), mix(PIGMENTS.vermilion, PIGMENTS.gold, 0.35), c);
      const deep = mix(PIGMENTS.sap, CRIMSON, c);
      paintLeaves(p, plan.leaves, view, pr.fork('palms'), (l) => stagger(g, 0.55, 0.8, l.delay, 0.14), light, deep, { opacity: 0.8 });
      paintLeaves(p, plan.fallen, view, pr.fork('fallen'), () => ramp(g, 0.95, 1), mix(PIGMENTS.vermilion, PIGMENTS.gold, 0.3), CRIMSON, { opacity: 0.7 });
    });
  },
};

export default japaneseMaple;
