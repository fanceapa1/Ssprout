import type { Rng } from '../../core/rng';
import { PIGMENTS, darken, mix } from '../../paint/pigments';
import {
  inUnits,
  paintBlossoms,
  paintFallingPetals,
  paintGroundShadow,
  paintLeaves,
  paintSeed,
  paintSkeleton,
  paintTipLeaves,
  type Blossom,
  type Leaf,
} from '../lib/tree-paint';
import { fitTree, growChildren, normalise, pointAt, ramp, stagger, startTree, treeView, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 300, h: 340 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;

export interface PlumBlossomPlan {
  tree: Tree;
  /** white (true) or pink (false) flowered */
  white: boolean;
  blossoms: Blossom[];
  buds: Blossom[];
  /** lichen / moss touches on the old wood */
  moss: Leaf[];
  falling: { x: number; y: number; r: number; rot: number; id: number }[];
}

/** The whole tree for a seed — independent of growth. */
export function planPlumBlossom(rng: Rng): PlumBlossomPlan {
  const r = rng.fork('structure');
  const white = r.chance(0.55);
  const base = { x: SIZE.w / 2 + r.range(-10, 10), y: BASE_Y };
  const lean = r.range(-0.35, 0.35);
  const tree = startTree(r, base, {
    angle: UP + lean,
    length: r.range(85, 120),
    width: r.range(13, 16),
    tipWidth: 7,
    limb: { segments: 4, wander: 0.12, kink: 0.24, lengthJitter: 0.4 },
    dur: 0.8,
  });
  growChildren(
    tree,
    tree.branches[0]!,
    [
      // two or three gnarled, angular limbs
      { count: [2, 3], span: [0.6, 1], angle: [0.35, 0.95], length: [0.9, 1.4], shrink: 0.1, up: 0.2, limb: { segments: 6, wander: 0.14, kink: 0.4, lengthJitter: 0.5 }, width: 0.75, tipWidth: 0.35, dur: 0.8 },
      // angular side branches
      { count: [2, 4], span: [0.2, 1], angle: [0.5, 1.1], length: [0.4, 0.7], limb: { segments: 5, wander: 0.12, kink: 0.45, lengthJitter: 0.5 }, width: 0.6, tipWidth: 0.35, dur: 0.75 },
      // straight young shoots (water sprouts), nearly vertical
      { count: [1, 3], span: [0.3, 1], angle: [0.2, 0.6], length: [0.6, 1.1], up: 0.7, side: 'random', limb: { segments: 3, wander: 0.04 }, width: 0.5, tipWidth: 0.3, minTip: 0.35, tag: 'sprout', dur: 0.7 },
    ],
    r,
  );
  normalise(tree);
  fitTree(tree, SIZE, 16, 10);

  const br = rng.fork('blossoms');
  const blossoms: Blossom[] = [];
  const buds: Blossom[] = [];
  for (const b of tree.branches) {
    if (b.order < 1) continue;
    // flowers sit singly or in pairs right on the wood, sparse, more on young shoots
    const step = b.tag === 'sprout' ? br.range(7, 10) : br.range(10, 15);
    const from = b.order === 1 ? 0.45 : 0.15;
    const n = Math.floor((b.len * (1 - from)) / step);
    for (let i = 0; i < n; i++) {
      const f = from + ((i + br.range(0, 1)) * step) / b.len;
      if (f > 1) break;
      const at = pointAt(b, f);
      const side = br.chance(0.5) ? 1 : -1;
      const off = br.range(1, 3.5) * side;
      const roll = br.next();
      const bl: Blossom = {
        x: at.x + off,
        y: at.y + br.range(-2.5, 1.5),
        r: br.range(4.8, 6.4),
        rot: br.range(0, Math.PI * 2),
        tone: br.range(0, 0.6),
        delay: Math.min(1, b.t0 * 0.5 + f * 0.35 + br.range(0, 0.25)),
        kind: roll < 0.68 ? 'flower' : 'bud',
        id: blossoms.length,
      };
      if (bl.kind === 'bud') bl.r = br.range(2, 2.7);
      blossoms.push(bl);
      if (bl.kind === 'flower') buds.push({ ...bl, kind: 'bud', r: br.range(1.9, 2.5), id: 100000 + bl.id });
    }
    // the tip of every twig ends in a bud
    const tip = pointAt(b, 1);
    if (b.order >= 2) buds.push({ x: tip.x, y: tip.y, r: br.range(1.7, 2.3), rot: br.range(0, 6.3), tone: 1, delay: Math.min(1, b.t1 * 0.6 + br.range(0, 0.3)), kind: 'bud', id: 200000 + b.id });
  }

  const mr = rng.fork('moss');
  const moss: Leaf[] = [];
  for (const b of tree.branches) {
    if (b.order > 1) continue;
    const n = mr.int(1, 3);
    for (let i = 0; i < n; i++) {
      const at = pointAt(b, mr.range(0.1, 0.8));
      moss.push({ x: at.x + mr.range(-3, 3), y: at.y, angle: mr.range(-0.4, 0.4) + (mr.chance(0.5) ? 0 : Math.PI), length: mr.range(3.5, 6), width: 0.7, tone: mr.range(0, 1), delay: mr.range(0, 1), id: moss.length, variant: 'round' });
    }
  }

  const fr = rng.fork('petals');
  const falling = Array.from({ length: fr.int(3, 5) }, (_, i) => ({
    x: base.x + fr.range(-90, 90),
    y: fr.range(BASE_Y - 140, BASE_Y - 15),
    r: fr.range(2.8, 3.6),
    rot: fr.range(0, Math.PI * 2),
    id: i,
  }));
  return { tree, white, blossoms, buds, moss, falling };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.12);
const WHITE = { pale: PIGMENTS.petalWhite, deep: PIGMENTS.petalShade, centre: PIGMENTS.gold };
const PINK = { pale: mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.25), deep: mix(PIGMENTS.sakura, PIGMENTS.vermilion, 0.12), centre: PIGMENTS.gold };
const BUD = { pale: mix(PIGMENTS.sakura, PIGMENTS.vermilion, 0.35), deep: darken(mix(PIGMENTS.sakura, PIGMENTS.vermilion, 0.5), 0.15) };

const plumBlossom: SpeciesDef = {
  id: 'plum-blossom',
  name: 'Plum Blossom',
  nativeName: 'Ume',
  // Chinese, long planted in Japan
  range: { realms: ['east-asia'], biomes: ['temperate-forest'], climates: ['warm-temperate'], cultivatedIn: ['japan'] },
  tier: 4,
  habitats: ['back', 'meadow', 'rock'],
  sizeClass: 'large',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Old dark wood, and five white petals before the snow is gone.',
  bloomColor: PIGMENTS.petalWhite,
  pollinators: true,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planPlumBlossom(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const pig = plan.white ? WHITE : PINK;
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 70, view, pr);
      paintSeed(p, plan.tree.base, g, pr, mix(PIGMENTS.wood, PIGMENTS.stoneWarm, 0.3));
      const vis = paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 1, modelling: 0.7, flare: 0.5, wobble: 0.3, textureMin: 2.6 });
      paintLeaves(p, plan.moss, view, pr.fork('moss'), (l) => ramp(g, 0.35 + l.delay * 0.2, 0.55 + l.delay * 0.2), PIGMENTS.sageLight, PIGMENTS.sage, { opacity: 0.55 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.4, 0.58), pr, { pigment: PIGMENTS.sap, size: 5 });
      // red-brown buds swell first (0.5–0.8), then open from the old wood outward (0.74–1)
      const open = (b: Blossom) => (b.kind === 'flower' ? stagger(g, 0.74, 1, b.delay, 0.12) : stagger(g, 0.55, 0.85, b.delay, 0.12));
      paintBlossoms(p, plan.buds, view, pr.fork('buds'), (b) => stagger(g, 0.5, 0.8, b.delay, 0.12) * (b.id < 200000 ? 1 - open({ ...b, kind: 'flower' }) : 1), BUD, { opacity: 0.9, centres: 0 });
      paintBlossoms(p, plan.blossoms, view, pr.fork('bloom'), open, pig, {
        groups: 3,
        opacity: 0.95,
        centreChance: 0.95,
        centreSize: 0.2,
        stamens: 7,
        stamenPigment: mix(PIGMENTS.sumi, PIGMENTS.vermilion, 0.25),
        deepChance: 0.6,
        dry: { edge: 0.6, centreLift: 0.35 },
      });
      paintFallingPetals(p, plan.falling, pig.pale, pr.fork('falling'), ramp(g, 0.96, 1));
    });
  },
};

export default plumBlossom;
