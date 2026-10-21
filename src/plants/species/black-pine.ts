import type { Rng } from '../../core/rng';
import { PIGMENTS, lighten, mix } from '../../paint/pigments';
import type { FoliagePigments } from '../../paint/recipes';
import { inUnits, paintGroundShadow, paintLeaves, paintPadMass, paintSeed, paintSkeleton, paintTipLeaves, type Leaf, type Pad } from '../lib/tree-paint';
import { addBranch, fitTree, growChildren, growLimb, normalise, pointAt, ramp, stagger, startTree, treeView, widthAt, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;

export interface BlackPinePlan {
  tree: Tree;
  pads: Pad[];
  /** needle fans along the pads' upper rims */
  needles: Leaf[];
  /** pale new shoots ("candles") standing on the pads */
  candles: Leaf[];
}

/** The whole tree for a seed — independent of growth. */
export function planBlackPine(rng: Rng): BlackPinePlan {
  const r = rng.fork('structure');
  const side = r.chance(0.5) ? 1 : -1;
  const base = { x: SIZE.w / 2 - side * r.range(0, 14), y: BASE_Y };
  // the trunk leans out, then twists back upward (a pruned garden pine)
  const lean = side * r.range(0.3, 0.6);
  const tree = startTree(r, base, {
    angle: UP + lean,
    length: r.range(230, 280),
    width: r.range(14, 18),
    tipWidth: 4,
    limb: { segments: 9, wander: 0.2, kink: 0.16, gravity: -0.14, lengthJitter: 0.35 },
    dur: 1,
  });
  growChildren(
    tree,
    tree.branches[0]!,
    [
      { count: [4, 6], span: [0.3, 0.92], angle: [0.9, 1.45], length: [0.22, 0.38], shrink: 0.3, level: 0.55, side: 'alternate', limb: { segments: 5, wander: 0.14, kink: 0.14, gravity: 0.04 }, width: 0.55, tipWidth: 0.35, dur: 0.8 },
      { count: [1, 3], span: [0.45, 1], angle: [0.3, 0.8], length: [0.35, 0.55], level: 0.5, limb: { segments: 3, wander: 0.15, kink: 0.15 }, width: 0.7, tipWidth: 0.45, dur: 0.7 },
    ],
    r,
  );
  if (r.chance(0.6)) {
    // a long low limb reaching out over the water on the leaning side
    const trunk = tree.branches[0]!;
    const attach = r.range(0.25, 0.42);
    const at = pointAt(trunk, attach);
    const pts = growLimb(r, at, side > 0 ? r.range(-0.25, 0.05) : Math.PI + r.range(-0.05, 0.25), trunk.len * r.range(0.45, 0.6), { segments: 6, wander: 0.14, kink: 0.14, gravity: 0.05 });
    const w0 = widthAt(trunk, attach) * 0.6;
    const t0 = trunk.t0 + (trunk.t1 - trunk.t0) * attach + 0.02;
    const limb = addBranch(tree, trunk.id, 1, { pts, w0, w1: w0 * 0.35, attach, t0, t1: t0 + 0.75, tag: 'reach' }, r);
    growChildren(tree, limb, [{ count: [1, 3], span: [0.4, 0.95], angle: [0.4, 0.9], length: [0.25, 0.4], level: 0.5, limb: { segments: 3, wander: 0.15, kink: 0.15 }, width: 0.7, tipWidth: 0.45, dur: 0.6 }], r);
  }
  normalise(tree);
  fitTree(tree, SIZE, 30, 36);

  const pr = rng.fork('pads');
  const pads: Pad[] = [];
  const trunk = tree.branches[0]!;
  const apex = pointAt(trunk, 1);
  pads.push({ x: apex.x + pr.range(-4, 4), y: apex.y - 4, r: pr.range(38, 50), delay: pr.range(0.3, 0.6), id: 0, depth: 1, branch: trunk.id });
  for (const b of tree.branches) {
    if (b.order !== 1) continue;
    const tip = pointAt(b, 1);
    const rad = pr.range(36, 50) * (0.75 + 0.25 * (1 - b.attach));
    pads.push({ x: tip.x + pr.range(-5, 5), y: tip.y - rad * 0.12, r: rad, delay: Math.min(1, b.t1 * 0.5 + pr.range(0, 0.4)), id: pads.length, depth: pr.range(-1, 1), branch: b.id });
  }
  for (const b of tree.branches) {
    if (b.order !== 2) continue;
    const tip = pointAt(b, 1);
    const rad = pr.range(20, 30);
    const clash = pads.some((q) => Math.hypot(q.x - tip.x, (q.y - tip.y) * 2) < (q.r + rad) * 0.45);
    if (clash) continue;
    pads.push({ x: tip.x, y: tip.y - rad * 0.15, r: rad, delay: Math.min(1, b.t1 * 0.5 + pr.range(0, 0.4)), id: pads.length, depth: pr.range(-1, 1), branch: b.id });
  }

  const nr = rng.fork('needles');
  const needles: Leaf[] = [];
  const candles: Leaf[] = [];
  for (const pad of pads) {
    const fans = Math.round(pad.r / 5);
    for (let i = 0; i < fans; i++) {
      // mostly along the top and the two ends of the pad
      const th = -Math.PI / 2 + nr.gaussian(0, 1.0);
      const cx = pad.x + Math.cos(th) * pad.r * nr.range(0.55, 0.85);
      const cy = pad.y + Math.sin(th) * pad.r * 0.26 * nr.range(0.8, 1.0) + 2.5;
      const n = nr.int(5, 8);
      const tone = nr.range(0, 1);
      const spread = nr.range(0.7, 1.0);
      const tilt = Math.cos(th) * 0.5;
      for (let k = 0; k < n; k++) {
        needles.push({
          x: cx + nr.gaussian(0, 0.8),
          y: cy,
          angle: UP + tilt + (k / (n - 1) - 0.5) * 2 * spread + nr.gaussian(0, 0.06),
          length: nr.range(7, 11),
          width: 0.16,
          tone,
          delay: pad.delay,
          id: needles.length,
          variant: 'needle',
          curve: 0,
        });
      }
    }
    const nc = nr.int(1, 3);
    for (let i = 0; i < nc; i++) {
      candles.push({
        x: pad.x + nr.range(-0.6, 0.6) * pad.r,
        y: pad.y - pad.r * 0.3 + nr.range(-2, 2),
        angle: UP + nr.gaussian(0, 0.15),
        length: nr.range(6, 9),
        width: 0.3,
        tone: nr.range(0, 0.5),
        delay: nr.range(0, 1),
        id: candles.length,
        variant: 'blade',
        curve: 0,
      });
    }
  }
  return { tree, pads, needles, candles };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.stoneDark, 0.3);
const PINE: FoliagePigments = { light: mix(PIGMENTS.sage, PIGMENTS.olive, 0.35), mid: mix(PIGMENTS.olive, PIGMENTS.celadonDeep, 0.2), shadow: mix(PIGMENTS.olive, PIGMENTS.celadonDeep, 0.25), dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.5) };

const blackPine: SpeciesDef = {
  id: 'black-pine',
  name: 'Black Pine',
  nativeName: 'Kuromatsu',
  tier: 4,
  habitats: ['shore', 'rock', 'back'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Clouds of dark needles, leaning to hear the water.',
  bloomColor: PIGMENTS.olive,
  pollinators: false,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planBlackPine(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 90, view, pr);
      paintSeed(p, plan.tree.base, g, pr);
      const vis = paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 0.95, modelling: 0.6, flare: 0.5, wobble: 0.35 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.45, 0.62), pr, { pigment: PIGMENTS.sage, size: 7 });
      paintPadMass(p, plan.pads, view, pr, (pad) => stagger(g, 0.48, 0.76, pad.delay, 0.14), () => PINE, {
        flatness: 0.34,
        light: -2.0,
        opacity: 0.92,
        gaps: 0.22,
        dabSize: 0.2,
        shadow: 0.85,
        scallop: 9,
      });
      paintLeaves(p, plan.needles, view, pr.fork('needles'), (l) => stagger(g, 0.6, 0.95, l.delay, 0.14), mix(PIGMENTS.sage, PIGMENTS.olive, 0.5), mix(PIGMENTS.olive, PIGMENTS.sumi, 0.4), { opacity: 0.8, edge: 0.3 });
      paintLeaves(p, plan.candles, view, pr.fork('candles'), (l) => stagger(g, 0.8, 1, l.delay, 0.12), lighten(PIGMENTS.sageLight, 0.08), PIGMENTS.sap, { opacity: 0.8 });
    });
  },
};

export default blackPine;
