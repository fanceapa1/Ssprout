import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { bloom, groundShadow, paintLeaf, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Violet (sumire): a low rosette of broad heart-shaped leaves on slender stalks, and a few
 * deep violet flowers held on hooked stems just above them — two upper petals, two side
 * petals and a broad lower lip with a pale throat and fine dark veins.
 */

interface VioletLeaf {
  stem: StemPlan;
  length: number;
  width: number;
  turn: number;
  curve: number;
  window: [number, number];
  front: boolean;
  tone: Pigment;
}

interface VioletFlower {
  stem: StemPlan;
  petals: PetalPlan[];
  tilt: number;
  roll: number;
  size: number;
  bud: [number, number];
  open: [number, number];
  colour: Pigment;
}

export interface VioletPlan {
  leaves: VioletLeaf[];
  flowers: VioletFlower[];
  spread: number;
}

const DEEP = mix(PIGMENTS.iris, '#513796', 0.35);

export function planViolet(rng: Rng): VioletPlan {
  const lean = rng.range(-0.2, 0.2);
  const nLeaves = rng.int(6, 9);
  const greenBase = jitter(mix(PIGMENTS.sap, PIGMENTS.sage, 0.55), rng, 0.03);
  const leaves: VioletLeaf[] = [];
  for (let i = 0; i < nLeaves; i++) {
    const u = nLeaves === 1 ? 0 : i / (nLeaves - 1) - 0.5;
    const a = UP + lean * 0.5 + u * 2.3 + rng.gaussian(0, 0.12);
    const length = rng.range(7, 15) * (1 - Math.abs(u) * 0.4);
    leaves.push({
      stem: makeStem(rng, { length, angle: a, bend: -Math.sign(u || 1) * rng.range(0.1, 0.45), segments: 5, tipBias: 0.2 }),
      length: rng.range(10, 14),
      width: rng.range(0.72, 0.9),
      turn: rng.gaussian(0, 0.18),
      curve: rng.gaussian(0, 0.1),
      window: [0, 0],
      front: rng.chance(0.3),
      tone: jitter(greenBase, rng, 0.035),
    });
  }
  // leaves unfurl one after another, the innermost first
  const order = rng.shuffle(leaves.map((_, i) => i));
  order.forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, nLeaves, [0.06, 0.5], 0.42)];
  });

  const nFlowers = rng.int(3, 5);
  const hue = rng.next();
  const flowers: VioletFlower[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nFlowers; i++) {
    const side = i % 2 === 0 ? flip : -flip;
    const height = rng.range(34, 44) * (i < 2 ? rng.range(0.85, 1) : rng.range(0.55, 0.72));
    const a = UP + lean + side * (i < 2 ? rng.range(0.1, 0.28) : rng.range(0.45, 0.65));
    const stem = makeStem(rng, { length: height, angle: a, bend: side * rng.range(0.7, 1.25), segments: 9, tipBias: 1, wobble: 0.03 });
    const colour = jitter(mix(PIGMENTS.iris, hue < 0.25 ? PIGMENTS.irisLight : DEEP, hue < 0.25 ? 0.5 : hue * 0.8), rng, 0.03);
    // two upper, two side and the broad lower lip (plane angles: −π/2 = flower's up)
    const petals: PetalPlan[] = [
      { a: UP - 0.62, len: 0.95, wid: 0.88, curve: 0.08, tone: rng.next() },
      { a: UP + 0.62, len: 0.95, wid: 0.88, curve: -0.08, tone: rng.next() },
      { a: Math.PI - 0.22, len: 0.86, wid: 0.8, curve: -0.06, tone: rng.next() },
      { a: 0.22, len: 0.86, wid: 0.8, curve: 0.06, tone: rng.next() },
      { a: Math.PI / 2, len: 1.08, wid: 1.25, curve: 0, tone: rng.next() },
    ].map((pl) => ({ ...pl, a: pl.a + rng.gaussian(0, 0.08), len: pl.len * rng.range(0.93, 1.07) }));
    flowers.push({
      stem,
      petals,
      tilt: rng.range(0.6, 0.95),
      roll: UP + side * rng.range(0.15, 0.45),
      size: rng.range(7.5, 9),
      bud: [...stagger(i, nFlowers, [0.42, 0.78], 0.55)] as [number, number],
      open: [...stagger(i, nFlowers, [0.74, 1], 0.62)] as [number, number],
      colour,
    });
  }
  return { leaves, flowers, spread: 20 + nLeaves };
}

function drawLeaf(p: Painter, rng: Rng, l: VioletLeaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(l.stem, lerp(0.15, 1, k) * smooth(k * 3), lerp(0.3, 1, k));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.55, opacity: 0.6, pigment: mix(PIGMENTS.sap, PIGMENTS.sage, 0.5) });
  const end = pointAt(pts, 1);
  // the blade's lobes reach back past the stalk (heart-shaped base)
  const tip = { x: end.x - Math.cos(end.angle) * l.length * 0.14 * k, y: end.y - Math.sin(end.angle) * l.length * 0.14 * k, angle: end.angle };
  paintLeaf(
    p,
    rng.fork('blade'),
    tip,
    { angle: tip.angle + l.turn, length: l.length, width: l.length * l.width, curve: l.curve, k: ease(g, lerp(l.window[0], l.window[1], 0.25), l.window[1] + 0.06), fold: tip.angle },
    { pigment: l.tone, vein: 0.22 },
  );
}

function drawFlower(p: Painter, rng: Rng, f: VioletFlower, g: number) {
  const grow = ease(g, f.bud[0] - 0.14, f.open[0]);
  if (!visible(grow)) return;
  const budK = ease(g, f.bud[0], f.bud[1]);
  const openK = smooth(ease(g, f.open[0], f.open[1]));
  const pts = stemPoints(f.stem, grow, lerp(0.15, 1, budK));
  paintStem(p, rng.fork('stem'), pts, { width: 0.6, ink: 0.4 * budK, inkReach: 0.7, pigment: mix(PIGMENTS.sage, PIGMENTS.iris, 0.12) });
  const tip = pointAt(pts, 1);
  if (!visible(budK)) return;
  const size = f.size;
  // the bud hangs along the hook; opening, the face turns to the viewer
  const roll = lerpAngle(tip.angle, f.roll, openK);
  const c: Pt = { x: tip.x, y: tip.y };
  const throat = lighten(f.colour, 0.72);
  bloom(p, rng.fork('flower'), c, {
    petals: f.petals,
    view: { tilt: lerp(0.35, f.tilt, openK), roll },
    budK,
    openK,
    budAngle: tip.angle,
    budLen: size * 0.62,
    budWidth: size * 0.36,
    colourK: ease(g, f.bud[0] + 0.1, f.bud[1] + 0.04),
    size,
    width: 0.62,
    closedLen: 0.6,
    style: { pigment: shade(f.colour, 0.08), inner: shade(f.colour, 0.36), innerReach: 0.38, opacity: 0.92 },
    // the broad lower lip has a pale throat
    styleFor: (i) => (i === 4 ? { inner: throat, innerReach: 0.5 } : undefined),
  });
  if (!visible(openK)) return;
  // fine dark veins on the lip, and the little gold eye
  const along = roll + Math.PI;
  for (let i = 0; i < 3; i++) {
    const a = along + (i - 1) * 0.3 * f.tilt;
    const r0 = size * 0.14;
    const r1 = size * (0.5 + (i === 1 ? 0.12 : 0)) * openK;
    p.inkLine(
      [
        { x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0 },
        { x: c.x + Math.cos(a) * r1, y: c.y + Math.sin(a) * r1 },
      ],
      { rng: rng.fork(`vein-${i}`), width: 0.26, pigment: mix(DEEP, PIGMENTS.sumi, 0.4), opacity: 0.5 * openK, breaks: 0, taper: [0.1, 0.7], wobble: 0.1 },
    );
  }
  p.dab(c, PIGMENTS.gold, { rng: rng.fork('eye'), variant: 'round', angle: along, length: size * 0.2, width: size * 0.16, opacity: 0.9 * openK, blend: 'source-over', edge: 0.3 });
}

const violet: SpeciesDef = {
  id: 'violet',
  name: 'Violet',
  nativeName: 'Sumire',
  // roadsides, mountain woods and rocks
  range: { realms: ['japan', 'east-asia'], biomes: ['grassland', 'temperate-forest'], climates: ['warm-temperate', 'cool-temperate'], cultivatedIn: ['japan'] },
  tier: 1,
  habitats: ['meadow', 'path', 'rock'],
  sizeClass: 'small',
  // drawn in a 70-unit design box, shown larger so it reads at garden scale
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.9 },
  description: 'Violet — small courage at the foot of stones.',
  bloomColor: '#715aae',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planViolet(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: plan.spread * 0.75, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 7 });
      plan.leaves.forEach((l, i) => !l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.flowers.forEach((f, i) => drawFlower(p, r.fork(`flower-${i}`), f, g));
      plan.leaves.forEach((l, i) => l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
    } finally {
      end();
    }
  },
};

export default violet;
