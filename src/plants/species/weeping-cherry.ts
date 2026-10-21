import type { Rng } from '../../core/rng';
import { PIGMENTS, lighten, mix } from '../../paint/pigments';
import { glaze } from '../../paint/primitives';
import {
  inUnits,
  paintBlossoms,
  paintFallingPetals,
  paintGroundShadow,
  paintSeed,
  paintSkeleton,
  paintTipLeaves,
  stableTarget,
  paintLeaves,
  type Blossom,
  type Leaf,
} from '../lib/tree-paint';
import { fitTree, growChildren, normalise, pointAt, ramp, stagger, startTree, treeView, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;

export interface WeepingCherryPlan {
  tree: Tree;
  blossoms: Blossom[];
  buds: Blossom[];
  falling: { x: number; y: number; r: number; rot: number; id: number }[];
  fallen: { x: number; y: number; r: number; rot: number; id: number }[];
  /** soft pink haze behind each curtain of blossom */
  haze: { cx: number; cy: number; rx: number; ry: number; id: number }[];
  /** fresh leaves along the curtains */
  leaves: Leaf[];
}

/** The whole tree for a seed — independent of growth. */
export function planWeepingCherry(rng: Rng): WeepingCherryPlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-10, 10), y: BASE_Y };
  const trunkLen = r.range(150, 195);
  const floor = BASE_Y - r.range(30, 80);
  const tree = startTree(r, base, {
    angle: UP + r.range(-0.1, 0.1),
    length: trunkLen,
    width: r.range(10, 13),
    tipWidth: 6.5,
    limb: { segments: 6, wander: 0.07, curl: r.range(-0.03, 0.03) },
    dur: 0.8,
  });
  const curtain = {
    count: [3, 6] as [number, number],
    span: [0.25, 1] as [number, number],
    angle: [0.25, 0.8] as [number, number],
    length: [0.9, 1.5] as [number, number],
    shrink: 0.35,
    side: 'outward' as const,
    level: 0.2,
    limb: { segments: 14, wander: 0.05, gravity: 0.17, floor },
    width: 0.55,
    tipWidth: 0.12,
    minTip: 0.35,
    tag: 'whip',
    dur: 1.1,
  };
  const whiplet = { count: [0, 2] as [number, number], span: [0.15, 0.55] as [number, number], angle: [0.2, 0.5] as [number, number], length: [0.3, 0.55] as [number, number], side: 'random' as const, limb: { segments: 6, wander: 0.05, gravity: 0.35, floor }, width: 0.6, tipWidth: 0.3, minTip: 0.35, tag: 'whip', dur: 0.8 };
  growChildren(
    tree,
    tree.branches[0]!,
    [
      // main limbs: rise steeply from the fork, then arc over at the top
      { count: [2, 4], span: [0.55, 1], angle: [0.15, 0.7], length: [0.85, 1.2], shrink: 0.2, up: 0.45, limb: { segments: 7, wander: 0.08, gravity: 0.045 }, width: 0.78, tipWidth: 0.28, dur: 0.85 },
      curtain,
      whiplet,
    ],
    r,
  );
  // a lower scaffold or two whose curtains hang closer to the ground
  growChildren(
    tree,
    tree.branches[0]!,
    [
      { count: [1, 2], span: [0.3, 0.6], angle: [0.7, 1.1], length: [0.35, 0.55], shrink: 0, limb: { segments: 5, wander: 0.1, gravity: 0.05 }, width: 0.55, tipWidth: 0.3, dur: 0.7 },
      { ...curtain, count: [2, 4], length: [1.0, 1.6] },
      whiplet,
    ],
    r,
  );
  normalise(tree);
  fitTree(tree, SIZE, 14, 8);

  // blossoms strung along the curtains and the outer scaffolds
  const blossoms: Blossom[] = [];
  const buds: Blossom[] = [];
  const br = rng.fork('blossoms');
  let id = 0;
  const groups = new Map<number, { x: number; y: number }[]>();
  const scaffoldOf = (bid: number): number => {
    let cur = tree.branches[bid]!;
    while (cur.order > 1) cur = tree.branches[cur.parent]!;
    return cur.id;
  };
  for (const b of tree.branches) {
    if (b.order === 0) continue;
    const grp = groups.get(scaffoldOf(b.id)) ?? [];
    groups.set(scaffoldOf(b.id), grp);
    const isWhip = b.tag === 'whip';
    const from = isWhip ? 0.12 : 0.55;
    const step = isWhip ? 2.1 : 4;
    const n = Math.floor((b.len * (1 - from)) / step);
    for (let i = 0; i < n; i++) {
      const f = from + ((i + br.range(0, 1)) * step) / b.len;
      if (f > 1) break;
      const at = pointAt(b, f);
      const cluster = br.int(1, 3);
      for (let k = 0; k < cluster; k++) {
        const roll = br.next();
        const kind: Blossom['kind'] = roll < 0.12 ? 'flower' : roll < 0.17 ? 'bud' : 'dot';
        const x = at.x + br.gaussian(0, 3.2);
        const y = at.y + br.gaussian(0, 2.4) + 1.5;
        const delay = Math.min(1, b.t0 * 0.55 + f * 0.3 + br.range(0, 0.25));
        const bl: Blossom = {
          x,
          y,
          r: kind === 'flower' ? br.range(3.0, 4.2) : kind === 'bud' ? br.range(1.6, 2.2) : br.range(2.6, 3.8),
          rot: br.range(0, Math.PI * 2),
          tone: Math.min(1, br.range(0.1, 0.65) + f * 0.2),
          delay,
          kind,
          id: id++,
        };
        blossoms.push(bl);
        grp.push({ x, y });
        if (br.chance(0.6)) buds.push({ ...bl, kind: 'bud', r: br.range(2.2, 3), tone: 1, id: 100000 + bl.id });
      }
    }
  }

  // a few petals drifting down and a few already on the ground
  const fr = rng.fork('petals');
  const xs = blossoms.map((b) => b.x);
  const minX = Math.min(...xs, base.x - 60);
  const maxX = Math.max(...xs, base.x + 60);
  const falling = Array.from({ length: fr.int(5, 8) }, (_, i) => ({
    x: fr.range(minX + 10, maxX - 10),
    y: fr.range(BASE_Y - 150, BASE_Y - 20),
    r: fr.range(2.6, 3.6),
    rot: fr.range(0, Math.PI * 2),
    id: i,
  }));
  const fallen = Array.from({ length: fr.int(7, 12) }, (_, i) => ({
    x: base.x + fr.gaussian(0, (maxX - minX) * 0.22),
    y: BASE_Y + fr.range(-3, 6),
    r: fr.range(2.4, 3.2),
    rot: fr.range(-0.4, 0.4) + (fr.chance(0.5) ? 0 : Math.PI),
    id: 100 + i,
  }));
  const haze = [...groups.entries()]
    .filter(([, pts]) => pts.length > 8)
    .map(([gid, pts]) => {
      const xs2 = pts.map((q) => q.x).sort((a, b) => a - b);
      const ys2 = pts.map((q) => q.y).sort((a, b) => a - b);
      const q = (arr: number[], f: number) => arr[Math.floor((arr.length - 1) * f)]!;
      const x0 = q(xs2, 0.08);
      const x1 = q(xs2, 0.92);
      const y0 = q(ys2, 0.05);
      const y1 = q(ys2, 0.9);
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 + 4, ry: (y1 - y0) / 2 + 4, id: gid };
    });
  // sparse fresh leaves hanging along the curtains
  const lr = rng.fork('leaves');
  const leaves: Leaf[] = [];
  for (const b of tree.branches) {
    if (b.tag !== 'whip') continue;
    const n = Math.floor(b.len / 7);
    for (let i = 0; i < n; i++) {
      const f = (i + lr.range(0.2, 0.8)) / n;
      const at = pointAt(b, f);
      const side = i % 2 === 0 ? 1 : -1;
      leaves.push({
        x: at.x,
        y: at.y,
        angle: Math.PI / 2 + side * lr.range(0.4, 1.0),
        length: lr.range(7, 10.5),
        tone: lr.range(0, 1),
        delay: Math.min(1, b.t0 * 0.6 + f * 0.3 + lr.range(0, 0.15)),
        id: leaves.length,
        curve: side * 0.15,
      });
    }
  }
  return { tree, blossoms, buds, falling, fallen, haze, leaves };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.wood, 0.35);
const PINK = { pale: mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.45), deep: mix(PIGMENTS.sakura, PIGMENTS.sakuraLight, 0.25), centre: mix(PIGMENTS.sakura, PIGMENTS.vermilion, 0.35) };

const weepingCherry: SpeciesDef = {
  id: 'weeping-cherry',
  name: 'Weeping Cherry',
  nativeName: 'Shidarezakura',
  tier: 4,
  habitats: ['back', 'meadow', 'shore'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Long curtains of blossom, bowing to the water.',
  bloomColor: PIGMENTS.sakura,
  pollinators: true,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planWeepingCherry(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 85, view, pr);
      paintSeed(p, plan.tree.base, g, pr);
      const vis = paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 0.7, modelling: 0.5 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.42, 0.62), pr);
      paintLeaves(p, plan.leaves, view, pr.fork('leaves'), (l) => stagger(g, 0.48, 0.76, l.delay, 0.12) * (1 - 0.45 * ramp(g, 0.8, 1)), lighten(PIGMENTS.sageLight, 0.05), PIGMENTS.sap, { opacity: 0.75 });
      // buds swell along the curtains (0.5–0.8), then open (0.74–1)
      const open = (b: Blossom) => stagger(g, 0.74, 1, b.delay, 0.12);
      paintBlossoms(p, plan.buds, view, pr.fork('buds'), (b) => stagger(g, 0.5, 0.8, b.delay, 0.1) * (1 - open(b)), PINK, { opacity: 0.85, centres: 0 });
      const hz = ramp(g, 0.8, 1);
      if (hz > 0.01)
        for (const h of plan.haze) {
          const hr = pr.fork(`haze-${h.id}`);
          glaze(stableTarget(p, hr.fork('dry')), { cx: h.cx, cy: h.cy, rx: h.rx, ry: h.ry }, PIGMENTS.sakuraLight, {
            rng: hr,
            opacity: 0.1 * hz,
            edge: 0,
            sharpness: 0.12,
            fade: { angle: Math.PI / 2, start: 0.3, amount: 0.85 },
          });
        }
      paintBlossoms(p, plan.blossoms, view, pr.fork('bloom'), open, PINK);
      const fall = ramp(g, 0.96, 1);
      paintFallingPetals(p, plan.fallen.map((q) => ({ ...q })), lighten(PIGMENTS.sakuraLight, 0.04), pr.fork('fallen'), fall);
      paintFallingPetals(p, plan.falling, PINK.pale, pr.fork('falling'), fall);
    });
  },
};

export default weepingCherry;
