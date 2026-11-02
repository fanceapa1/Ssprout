import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, shade, type Pigment, type Pt } from '../../paint';
import { paintCandles, paintCrownShade, paintHands, paintPetioles, type CandleMark, type HandMark } from '../lib/tochinoki-paint';
import { inUnits, paintGroundShadow, paintSeed, paintSkeleton, visibleBranches, type Pad } from '../lib/tree-paint';
import { fitTree, growChildren, normalise, pointAt, ramp, stagger, startTree, steer, treeView, viewPt, type Tree, type TreeView } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

/**
 * Tochinoki (Aesculus turbinata): one massive straight trunk under a broad dome of huge palmate
 * leaves, each a hand of 5–7 long leaflets, with cream candle panicles standing on the top hands.
 */

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

export interface HandPlan {
  id: number;
  /** where the leaflets meet, full grown */
  x: number;
  y: number;
  /** the twig the petiole leaves from */
  twig: Pt;
  facing: number;
  spread: number;
  squash: number;
  length: number;
  lens: number[];
  width: number;
  droop: number;
  /** 0 back, 1 middle, 2 front */
  band: 0 | 1 | 2;
  /** a rosette on top of a shoot, which may carry a candle */
  top: boolean;
  delay: number;
  seed: number;
}

export interface CandlePlan {
  id: number;
  hand: number;
  lean: number;
  length: number;
  width: number;
  delay: number;
  seed: number;
}

export interface TochinokiPlan {
  tree: Tree;
  pads: Pad[];
  hands: HandPlan[];
  candles: CandlePlan[];
}

const LENS: Record<number, number[]> = {
  5: [0.6, 0.86, 1, 0.86, 0.6],
  6: [0.55, 0.78, 0.97, 0.97, 0.78, 0.55],
  7: [0.5, 0.72, 0.9, 1, 0.9, 0.72, 0.5],
};

/** The whole tree for a seed — independent of growth. */
export function planTochinoki(rng: Rng): TochinokiPlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-8, 8), y: BASE_Y };
  const spread = r.range(0.9, 1.15);
  const tree = startTree(r, base, {
    angle: UP + r.range(-0.04, 0.04),
    length: r.range(285, 315),
    width: r.range(20, 24),
    tipWidth: 2.4,
    limb: { segments: 8, wander: 0.025, curl: r.range(-0.01, 0.01) },
    dur: 1,
  });
  growChildren(
    tree,
    tree.branches[0]!,
    [
      // stout limbs climbing out of the trunk into a broad dome
      { count: [7, 9], span: [0.4, 0.92], angle: [0.6, 1.15], length: [0.48 * spread, 0.62 * spread], shrink: 0.6, side: 'alternate', limb: { segments: 6, wander: 0.11, gravity: -0.06 }, width: 0.58, tipWidth: 0.32, dur: 0.8 },
      { count: [2, 4], span: [0.35, 1], angle: [0.35, 0.8], length: [0.32, 0.5], limb: { segments: 3, wander: 0.1 }, width: 0.6, tipWidth: 0.45, dur: 0.65 },
      { count: [1, 2], span: [0.5, 1], angle: [0.3, 0.7], length: [0.35, 0.5], limb: { segments: 2, wander: 0.12 }, width: 0.7, tipWidth: 0.5, dur: 0.5 },
    ],
    r,
  );
  normalise(tree);
  fitTree(tree, SIZE, 8, 52);

  const trunk = tree.branches[0]!;
  const tips = tree.branches.filter((b) => b.order >= 1 || b.id === trunk.id).map((b) => ({ b, at: pointAt(b, 1) }));
  const cx = base.x;

  // interior shade: big soft pads along the limbs, so the dome reads full under the hands
  const pr = rng.fork('pads');
  const pads: Pad[] = [];
  for (const b of tree.branches) {
    if (b.order > 1) continue;
    for (const f of b.order === 0 ? [1] : [0.55, 1]) {
      const q = pointAt(b, f);
      pads.push({ x: q.x + (cx - q.x) * 0.3 + 4, y: q.y + 2, r: pr.range(18, 27), delay: Math.min(1, b.t1 * 0.5 + pr.range(0, 0.4)), id: pads.length, depth: pr.range(-1, 1), branch: b.id });
    }
  }

  // the dome: an envelope around the shoot tips, filled with hands, each on its nearest twig
  const hr = rng.fork('hands');
  const wood: { at: Pt; t1: number }[] = [];
  for (const b of tree.branches) for (const f of b.order === 0 ? [0.7, 0.85, 1] : [0.35, 0.55, 0.75, 1]) wood.push({ at: pointAt(b, f), t1: b.t1 });
  const xs = tips.map((t) => t.at.x);
  const ys = tips.map((t) => t.at.y);
  const env = { x0: Math.min(...xs) - 28, x1: Math.max(...xs) + 28, y0: Math.min(...ys) - 12, y1: Math.max(...ys) + 44 };
  const ex = (env.x0 + env.x1) / 2;
  const ey = (env.y0 + env.y1) / 2;
  const rx = (env.x1 - env.x0) / 2;
  const ry = (env.y1 - env.y0) / 2;
  const hands: HandPlan[] = [];
  const STEP = 17;
  for (let gy = env.y0; gy <= env.y1; gy += STEP * 0.8) {
    for (let gx = env.x0; gx <= env.x1; gx += STEP) {
      const x = gx + hr.range(-0.45, 0.45) * STEP;
      const y = gy + hr.range(-0.4, 0.4) * STEP;
      const n = hr.chance(0.6) ? 7 : hr.chance(0.6) ? 6 : 5;
      const length = hr.range(21, 28);
      const seed = hr.int(1, 2 ** 30);
      const ragged = 0.88 + hr.range(0, 0.18);
      const topChance = hr.next();
      const bandRoll = hr.next();
      const jit = [hr.gaussian(0, 0.45), hr.range(2.2, 3.0), hr.range(0.78, 1), hr.range(0.18, 0.34), hr.gaussian(0, 0.1), hr.range(4.3, 4.9), hr.range(0.38, 0.52), hr.range(0.05, 0.14), hr.range(0, 0.35)];
      const lens = LENS[n]!.map((v) => v * hr.range(0.92, 1.08));
      const width = hr.range(0.3, 0.37);
      const d = Math.hypot((x - ex) / rx, (y - ey) / ry);
      if (d > ragged) continue;
      let near = wood[0]!;
      let best = Infinity;
      for (const w of wood) {
        const dd = Math.hypot(w.at.x - x, w.at.y - y);
        if (dd < best) {
          best = dd;
          near = w;
        }
      }
      const out = Math.atan2(y - ey, x - ex);
      // rosettes on the upper dome carry the candles; the rest hang outward from their twigs
      const top = y < ey + ry * 0.35 && (y < ey - ry * 0.2 ? topChance < 0.2 + 0.45 * d : d > 0.6 && topChance < 0.55);
      const back = Math.hypot(near.at.x - x, near.at.y - y);
      const stalk = Math.min(back, 13);
      const twig = back > 0.1 ? { x: x + ((near.at.x - x) / back) * stalk, y: y + ((near.at.y - y) / back) * stalk } : { x, y: y + 1 };
      hands.push({
        id: hands.length,
        x,
        y,
        twig,
        facing: top ? UP + jit[4]! : steer(d < 0.35 ? DOWN + jit[0]! : out + jit[0]!, DOWN, 0.25),
        spread: top ? jit[5]! : jit[1]!,
        squash: top ? jit[6]! : jit[2]!,
        length,
        lens,
        width,
        droop: top ? jit[7]! : jit[3]!,
        band: (d < 0.5 ? (bandRoll < 0.7 ? 0 : 1) : top ? (bandRoll < 0.75 ? 2 : 1) : bandRoll < 0.25 ? 0 : bandRoll < 0.6 ? 1 : 2) as 0 | 1 | 2,
        top,
        delay: Math.min(1, near.t1 * 0.3 + d * 0.3 + jit[8]! * 1.2),
        seed,
      });
    }
  }

  const cr = rng.fork('candles');
  const candles: CandlePlan[] = [];
  for (const h of hands) {
    if (!h.top || !cr.chance(0.7)) continue;
    const lean = (h.x - cx) / 180 + cr.gaussian(0, 0.1);
    candles.push({ id: candles.length, hand: h.id, lean: Math.max(-0.4, Math.min(0.4, lean)), length: cr.range(22, 29), width: cr.range(8, 10), delay: cr.range(0, 1), seed: cr.int(1, 2 ** 30) });
  }
  return { tree, pads, hands, candles };
}

const LEAF = '#7e9550';
const LEAF_SHADE = '#6d7c44';
const BAND: Record<0 | 1 | 2, { pigment: Pigment; shade: Pigment }> = {
  0: { pigment: shade(mix(LEAF_SHADE, PIGMENTS.celadonDeep, 0.2), 0.12), shade: shade(mix(LEAF_SHADE, PIGMENTS.shadow, 0.2), 0.3) },
  1: { pigment: mix(LEAF, LEAF_SHADE, 0.4), shade: shade(LEAF_SHADE, 0.15) },
  2: { pigment: mix(LEAF, PIGMENTS.sap, 0.12), shade: LEAF_SHADE },
};
const YOUNG = mix(PIGMENTS.sageLight, PIGMENTS.gold, 0.3);
const BARK = mix(PIGMENTS.wood, PIGMENTS.sumi, 0.42);
const INTERIOR = shade(mix(LEAF_SHADE, PIGMENTS.celadonDeep, 0.15), 0.1);
const CANDLE = { cream: '#f4ecd8', bud: mix(PIGMENTS.sageLight, '#f4ecd8', 0.35), pink: '#d47a6a', yellow: mix(PIGMENTS.gold, '#f4ecd8', 0.35), shade: mix(PIGMENTS.petalShade, PIGMENTS.sage, 0.25) };

export interface TochinokiPose {
  view: TreeView;
  hands: (HandMark & { band: 0 | 1 | 2 })[];
  petioles: { id: string; from: Pt; to: Pt; width: number; alpha: number }[];
  candles: CandleMark[];
}

export const handOpen = (g: number, h: Pick<HandPlan, 'delay'>) => stagger(g, 0.44, 0.84, h.delay, 0.22);
export const candleArrive = (g: number, c: Pick<CandlePlan, 'delay'>) => stagger(g, 0.7, 1, c.delay, 0.2);

/** Every mark at a growth (pure): what the draw paints and the tests check. */
export function poseTochinoki(plan: TochinokiPlan, g: number): TochinokiPose {
  const view = treeView(g, plan.tree.base);
  const hands: TochinokiPose['hands'] = [];
  const petioles: TochinokiPose['petioles'] = [];
  const candles: CandleMark[] = [];

  // the sapling's own small hands at its growing tips, fading as the crown leafs out
  const amount = 1 - ramp(g, 0.5, 0.68);
  if (amount > 0.01) {
    for (const v of visibleBranches(plan.tree, view)) {
      if (v.b.order > 1) continue;
      const fade = amount * (v.b.order === 0 ? 1 - ramp(view.tau, 0.3, 0.5) : 1) * ramp(v.f, 0, 0.2);
      if (fade <= 0.01) continue;
      const n = v.path.length;
      const tip = v.path[n - 1]!;
      const prev = v.path[Math.max(0, n - 4)]!;
      const head = Math.atan2(tip.y - prev.y, tip.x - prev.x);
      for (const s of [-1, 1]) {
        hands.push({
          id: `tip-${v.b.id}-${s}`,
          at: tip,
          facing: head + s * 0.95,
          spread: 1.9,
          squash: 1,
          length: 10 * (0.55 + 0.45 * view.scale) * ramp(v.f, 0, 0.3),
          lens: LENS[5]!,
          width: 0.34,
          droop: 0.15,
          pigment: mix(YOUNG, LEAF, 0.4),
          shadePigment: LEAF_SHADE,
          alpha: 0.9 * fade,
          seed: v.b.id * 31 + (s > 0 ? 7 : 3),
          band: 2,
        });
      }
    }
  }

  for (const h of plan.hands) {
    const open = handOpen(g, h);
    if (open <= 0.01) continue;
    const e = ramp(open, 0, 0.85);
    const twig = viewPt(view, h.twig);
    const full = viewPt(view, h);
    const reach = 0.35 + 0.65 * e;
    const at = { x: twig.x + (full.x - twig.x) * reach, y: twig.y + (full.y - twig.y) * reach };
    // young hands hang limp and folded, then lift and spread
    const lift = ramp(open, 0.15, 0.9);
    const facing = h.top ? h.facing : steer(h.facing, DOWN, 0.55 * (1 - lift));
    const band = BAND[h.band];
    const colour = ramp(open, 0.3, 1);
    hands.push({
      id: `hand-${h.id}`,
      at,
      facing,
      spread: h.spread * (0.28 + 0.72 * lift),
      squash: h.top ? h.squash + (1 - h.squash) * (1 - lift) * 0.5 : h.squash,
      length: h.length * (0.1 + 0.9 * e) * view.scale,
      lens: h.lens,
      width: h.width * (0.6 + 0.4 * lift),
      droop: h.droop + 0.3 * (1 - lift),
      pigment: mix(YOUNG, band.pigment, colour),
      shadePigment: mix(mix(YOUNG, LEAF_SHADE, 0.6), band.shade, colour),
      alpha: Math.min(1, open * 3),
      seed: h.seed,
      band: h.band,
    });
    if (!h.top) petioles.push({ id: `petiole-${h.id}`, from: twig, to: at, width: 0.55 * view.scale, alpha: Math.min(1, open * 3) });
  }

  const byId = new Map(hands.map((h) => [h.id, h]));
  for (const c of plan.candles) {
    const k = candleArrive(g, c);
    if (k <= 0.01) continue;
    const hand = byId.get(`hand-${c.hand}`);
    if (!hand) continue;
    candles.push({
      id: `candle-${c.id}`,
      at: { x: hand.at.x, y: hand.at.y - 1 },
      angle: UP + c.lean,
      length: c.length * k ** 0.85 * view.scale,
      width: c.width * (0.45 + 0.55 * k) * view.scale,
      open: ramp(k, 0.35, 1),
      alpha: Math.min(1, k * 4),
      seed: c.seed,
    });
  }
  return { view, hands, petioles, candles };
}

const tochinoki: SpeciesDef = {
  id: 'tochinoki',
  name: 'Japanese Horse Chestnut',
  nativeName: 'Tochinoki',
  // terraces and slopes of cool mountain valleys
  range: { realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate'] },
  tier: 4,
  habitats: ['back', 'meadow'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Tochinoki — great green hands, and white candles over the water.',
  bloomColor: '#f1e6d2',
  pollinators: true,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planTochinoki(rng);
    const pose = poseTochinoki(plan, g);
    const view = pose.view;
    const pr = rng.fork('paint');
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 110, view, pr);
      paintSeed(p, plan.tree.base, g, pr, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.25));
      // limbs a little paler than the trunk, so the crown reads as leaves, not an X-ray of wood
      paintSkeleton(p, plan.tree, view, pr.fork('limbs'), { pigment: BARK, texture: 0.5, modelling: 0.5, wobble: 0.15, opacity: 0.62, skipTags: ['trunk'] });
      paintSkeleton(p, plan.tree, view, pr, { pigment: BARK, texture: 0.95, modelling: 0.75, flare: 0.55, wobble: 0.15, skipTags: [''] });
      paintCrownShade(
        p,
        plan.pads.map((pad) => {
          const at = viewPt(view, pad);
          return { x: at.x, y: at.y, r: pad.r * view.scale * (0.5 + 0.5 * stagger(g, 0.52, 0.86, pad.delay, 0.2)), alpha: stagger(g, 0.52, 0.86, pad.delay, 0.2), id: pad.id };
        }),
        INTERIOR,
        pr,
      );
      const band = (b: 0 | 1 | 2) => pose.hands.filter((h) => h.band === b);
      paintHands(p, band(0), pr.fork('hands-0'));
      paintPetioles(p, pose.petioles, mix(LEAF_SHADE, PIGMENTS.wood, 0.3), pr);
      paintHands(p, band(1), pr.fork('hands-1'));
      paintHands(p, band(2), pr.fork('hands-2'), { opacity: 0.92 });
      paintCandles(p, pose.candles, pr.fork('candles'), CANDLE);
    });
  },
};

export default tochinoki;
