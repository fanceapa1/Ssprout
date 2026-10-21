import type { Rng } from '../../core/rng';
import { PIGMENTS, darken, lighten, mix, saturate } from '../../paint/pigments';
import { glaze } from '../../paint/primitives';
import type { FoliagePigments } from '../../paint/recipes';
import { inUnits, paintGroundShadow, paintLeaves, paintPadMass, paintSeed, paintSkeleton, paintTipLeaves, stableTarget, type Leaf, type Pad } from '../lib/tree-paint';
import { fitTree, growChildren, normalise, pointAt, ramp, stagger, startTree, treeView, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;

export interface GinkgoPlan {
  tree: Tree;
  pads: Pad[];
  /** fan leaves fringing the pads */
  fans: Leaf[];
  /** fan leaves fallen around the foot */
  fallen: Leaf[];
}

/** The whole tree for a seed — independent of growth. */
export function planGinkgo(rng: Rng): GinkgoPlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-8, 8), y: BASE_Y };
  const spread = r.range(0.8, 1.3);
  const tree = startTree(r, base, {
    angle: UP + r.range(-0.06, 0.06),
    length: r.range(320, 365),
    width: r.range(10, 12.5),
    tipWidth: 2.2,
    limb: { segments: 8, wander: 0.04, curl: r.range(-0.015, 0.015) },
    dur: 1,
  });
  growChildren(
    tree,
    tree.branches[0]!,
    [
      // short ascending limbs, longer low down: a loose upright cone
      { count: [7, 10], span: [0.22, 0.92], angle: [0.75, 1.15], length: [0.24 * spread, 0.36 * spread], shrink: 0.75, up: 0.22, side: 'alternate', limb: { segments: 4, wander: 0.08, gravity: -0.02 }, width: 0.5, tipWidth: 0.3, dur: 0.75 },
      { count: [1, 3], span: [0.3, 1], angle: [0.35, 0.8], length: [0.35, 0.55], up: 0.15, limb: { segments: 3, wander: 0.12 }, width: 0.65, tipWidth: 0.45, dur: 0.6 },
    ],
    r,
  );
  normalise(tree);
  fitTree(tree, SIZE, 30, 26);

  const pr = rng.fork('pads');
  const pads: Pad[] = [];
  const add = (x: number, y: number, rad: number, delay: number, branch: number) => {
    for (const q of pads) if (Math.hypot(q.x - x, (q.y - y) * 1.3) < (q.r + rad) * 0.4) return;
    pads.push({ x, y, r: rad, delay, id: pads.length, depth: pr.range(-1, 1), branch });
  };
  const trunk = tree.branches[0]!;
  const apex = pointAt(trunk, 1);
  add(apex.x, apex.y + 4, pr.range(22, 28), pr.range(0.4, 0.8), trunk.id);
  for (const b of tree.branches) {
    if (b.order < 1) continue;
    const tip = pointAt(b, 1);
    const heightK = (BASE_Y - tip.y) / 360;
    const rad = (b.order === 1 ? pr.range(22, 30) : pr.range(16, 23)) * (1.1 - heightK * 0.35);
    add(tip.x, tip.y - rad * 0.1, rad, Math.min(1, b.t1 * 0.5 + pr.range(0, 0.45)), b.id);
    if (b.order === 1 && b.len > 35) {
      const mid = pointAt(b, pr.range(0.45, 0.65));
      add(mid.x, mid.y - 3, rad * pr.range(0.7, 0.85), Math.min(1, b.t1 * 0.5 + pr.range(0, 0.45)), b.id);
    }
  }
  // fans hug the trunk's upper half too, so the crown reads as one column
  for (let i = 0; i < 4; i++) {
    const at = pointAt(trunk, pr.range(0.45, 0.9));
    add(at.x + pr.range(-8, 8), at.y, pr.range(18, 24), pr.range(0.2, 1), trunk.id);
  }

  const fr = rng.fork('fans');
  const fans: Leaf[] = [];
  for (const pad of pads) {
    const n = Math.round(pad.r / 3.2);
    for (let i = 0; i < n; i++) {
      const th = fr.range(-Math.PI, Math.PI);
      const k = fr.range(0.7, 1.02);
      const x = pad.x + Math.cos(th) * pad.r * k;
      const y = pad.y + Math.sin(th) * pad.r * 0.58 * k;
      // stems hang from the spur: fans splay outward and a little down
      const out = Math.atan2(Math.sin(th) * 0.6 + 0.35, Math.cos(th));
      fans.push({ x, y, angle: out + fr.gaussian(0, 0.25), length: fr.range(4.2, 6.2), width: 1.15, tone: fr.range(0, 1), delay: pad.delay, id: fans.length, variant: 'petal', curve: fr.range(-0.1, 0.1) });
    }
  }
  const lr = rng.fork('fallen');
  const fallen: Leaf[] = Array.from({ length: lr.int(14, 22) }, (_, i) => ({
    x: base.x + lr.gaussian(0, 42),
    y: BASE_Y + lr.range(-4, 7),
    angle: lr.range(0, Math.PI * 2),
    length: lr.range(4, 5.6),
    width: 1.1,
    tone: lr.range(0, 1),
    delay: lr.range(0, 1),
    id: i,
    variant: 'petal' as const,
  }));
  return { tree, pads, fans, fallen };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.stoneWarm, 0.38);
/** butter yellow: the gold accent pushed toward lemon, kept watery */
const BUTTER = saturate(lighten(mix(PIGMENTS.gold, '#e8cf52', 0.6), 0.06), 1.1);
const GOLD_LIGHT = lighten(BUTTER, 0.06);
const OCHRE = mix(PIGMENTS.gold, PIGMENTS.wood, 0.22);
const GOLD: FoliagePigments = { light: GOLD_LIGHT, mid: BUTTER, shadow: OCHRE, dark: darken(mix(OCHRE, PIGMENTS.olive, 0.25), 0.08) };
const SUMMER: FoliagePigments = { light: mix(PIGMENTS.sageLight, PIGMENTS.sap, 0.4), mid: PIGMENTS.sap, shadow: PIGMENTS.sage, dark: PIGMENTS.olive };

function blend(a: FoliagePigments, b: FoliagePigments, t: number): FoliagePigments {
  return { light: mix(a.light, b.light, t), mid: mix(a.mid, b.mid, t), shadow: mix(a.shadow, b.shadow, t), dark: mix(a.dark ?? a.shadow, b.dark ?? b.shadow, t) };
}

const ginkgo: SpeciesDef = {
  id: 'ginkgo',
  name: 'Ginkgo',
  nativeName: 'Ichō',
  tier: 4,
  habitats: ['back', 'meadow'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'A column of small gold fans, older than the hills.',
  bloomColor: PIGMENTS.gold,
  pollinators: false,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planGinkgo(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const turn = (d: number) => stagger(g, 0.72, 1, d, 0.18);
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 70, view, pr);
      // the golden carpet under a ginkgo in late autumn
      const carpet = ramp(g, 0.9, 1);
      if (carpet > 0.01) {
        const cr = pr.fork('carpet');
        glaze(stableTarget(p, cr.fork('dry')), { cx: plan.tree.base.x, cy: BASE_Y + 2, rx: 62, ry: 7 }, GOLD_LIGHT, { rng: cr, opacity: 0.32 * carpet, fade: { angle: 0, start: 0.5, amount: 0.6 } });
      }
      paintSeed(p, plan.tree.base, g, pr, mix(PIGMENTS.gold, PIGMENTS.wood, 0.3));
      const vis = paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 0.75, modelling: 0.55, flare: 0.4 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.45, 0.64), pr, { pigment: mix(PIGMENTS.sageLight, PIGMENTS.sap, 0.4), size: 5.5 });
      paintPadMass(p, plan.pads, view, pr, (pad) => stagger(g, 0.48, 0.76, pad.delay, 0.14), (pad) => blend(SUMMER, GOLD, turn(pad.delay)), {
        flatness: 0.62,
        light: -2.2,
        opacity: 0.82,
        gaps: 0.55,
        dabSize: 0.24,
        shadow: 0.6,
        scallop: 6,
      });
      const t = turn(0.5);
      paintLeaves(p, plan.fans, view, pr.fork('fans'), (l) => stagger(g, 0.55, 0.82, l.delay, 0.14), mix(SUMMER.light, GOLD_LIGHT, t), mix(SUMMER.mid, mix(BUTTER, OCHRE, 0.5), t), { opacity: 0.8, edge: 0.32, darken: 0.15 });
      paintLeaves(p, plan.fallen, view, pr.fork('fallen'), () => carpet, GOLD_LIGHT, BUTTER, { opacity: 0.8 });
    });
  },
};

export default ginkgo;
