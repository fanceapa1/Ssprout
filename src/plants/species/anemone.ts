import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { bloom, groundShadow, leafletFan, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, makeStem, petalRing, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Anemone (shūmeigiku / windflower): a low mound of deeply cut, toothed leaves and tall wiry
 * stems that sway above it, each carrying one open saucer of broad white or palest pink petals
 * around a dark, softly bristling centre; round green buds nod on the younger stems.
 */

interface Leaf {
  stem: StemPlan;
  leaflets: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  window: [number, number];
  tone: Pigment;
}

interface Flower {
  stem: StemPlan;
  petals: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  ruff: number;
  ruffLeaves: PetalPlan[];
  bud: [number, number];
  open: [number, number];
}

export interface AnemonePlan {
  leaves: Leaf[];
  flowers: Flower[];
  petal: Pigment;
  blush: Pigment;
  eye: Pigment;
  ring: Pigment;
}

function cutLeaf(rng: Rng): PetalPlan[] {
  return [UP, UP + 1.15, UP - 1.15].map((b, j) => ({
    a: b + rng.gaussian(0, 0.1),
    len: (j === 0 ? 1.05 : 0.88) + rng.gaussian(0, 0.06),
    wid: 1 + rng.gaussian(0, 0.08),
    curve: rng.gaussian(0, 0.1),
    tone: rng.next(),
  }));
}

export function planAnemone(rng: Rng): AnemonePlan {
  const lean = rng.range(-0.12, 0.12);
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.sap, 0.35), rng, 0.03);
  const kind = rng.next();
  // white with a dark eye (most), blush pink with a dark eye, or pink with a gold eye
  const petal = kind < 0.6 ? PIGMENTS.petalWhite : mix(PIGMENTS.petalWhite, PIGMENTS.sakuraLight, kind < 0.85 ? 0.45 : 0.75);
  const darkEye = kind < 0.85;
  const n = rng.int(3, 5);
  const leaves: Leaf[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    leaves.push({
      stem: makeStem(rng, { length: rng.range(14, 24) * (1 - Math.abs(u) * 0.35), angle: UP + lean + u * 1.9 + rng.gaussian(0, 0.12), bend: -Math.sign(u || 1) * rng.range(0.15, 0.5), segments: 6 }),
      leaflets: cutLeaf(rng),
      size: rng.range(14, 19),
      tilt: rng.range(0.45, 0.8),
      roll: UP + u * 0.8 + rng.gaussian(0, 0.15),
      window: [...stagger(i, n, [0.06, 0.45], 0.45)] as [number, number],
      tone: jitter(green, rng, 0.035),
    });
  }
  const nf = rng.int(2, 4);
  const flowers: Flower[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nf; i++) {
    const side = (i % 2 === 0 ? 1 : -1) * flip;
    flowers.push({
      stem: makeStem(rng, {
        base: { x: side * rng.range(0, 6), y: 0 },
        length: rng.range(85, 118) * (i === 0 ? 1 : rng.range(0.7, 0.9)),
        angle: UP + lean + side * rng.range(0.06, 0.18) * (1 + i * 0.6),
        bend: -side * rng.range(0.05, 0.3),
        segments: 10,
        tipBias: 0.6,
      }),
      petals: petalRing(rng, rng.int(6, 8), { angJit: 0.12, lenJit: 0.08, widJit: 0.1, curve: 0.1 }),
      size: rng.range(10.5, 13),
      tilt: rng.range(0.55, 0.92),
      roll: UP + side * rng.range(0.1, 0.5),
      ruff: rng.range(0.55, 0.68),
      ruffLeaves: cutLeaf(rng),
      bud: [...stagger(i, nf, [0.44, 0.76], 0.6)] as [number, number],
      open: [...stagger(i, nf, [0.75, 1], 0.7)] as [number, number],
    });
  }
  return {
    leaves,
    flowers,
    petal,
    blush: mix(PIGMENTS.sakura, PIGMENTS.irisLight, 0.35),
    eye: darkEye ? mix(PIGMENTS.sumi, '#3f3a63', 0.45) : mix(PIGMENTS.sageLight, PIGMENTS.gold, 0.35),
    ring: darkEye ? mix(PIGMENTS.sumi, PIGMENTS.iris, 0.3) : PIGMENTS.gold,
  };
}

function drawLeaf(p: Painter, rng: Rng, l: Leaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(l.stem, easeOut(k), lerp(0.4, 1, k));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.8, opacity: 0.7 });
  const tip = pointAt(pts, 1);
  leafletFan(p, rng.fork('leaf'), tip, l.leaflets, { tilt: l.tilt, roll: l.roll }, ease(g, lerp(l.window[0], l.window[1], 0.3), l.window[1] + 0.06), l.size * easeOut(k), l.tone, {
    width: 0.5,
    teeth: 5,
    toothSize: 1.6,
    opacity: 0.7,
    vein: 0.25,
  });
}

function drawFlower(p: Painter, rng: Rng, f: Flower, plan: AnemonePlan, g: number) {
  const grow = ease(g, f.bud[0] - 0.2, f.open[0]);
  if (!visible(grow)) return;
  const budK = ease(g, f.bud[0], f.bud[1]);
  const openK = smooth(ease(g, f.open[0], f.open[1]));
  // young stems nod under the bud and straighten as it opens
  const pts = stemPoints(f.stem, grow, lerp(1.6, 1, openK));
  paintStem(p, rng.fork('stem'), pts, { width: 0.9, opacity: 0.75, ink: 0.35, inkReach: 0.85 });
  // the ruff of small cut leaves part-way up the stem
  const rp = pointAt(pts, f.ruff);
  leafletFan(p, rng.fork('ruff'), rp, f.ruffLeaves, { tilt: 0.6, roll: rp.angle }, ease(g, f.bud[0] - 0.1, f.bud[0] + 0.2), 6.5 * ease(g, f.bud[0] - 0.15, f.bud[0] + 0.1), plan.leaves[0]!.tone, {
    width: 0.42,
    teeth: 3,
    toothSize: 1.5,
  });
  if (!visible(budK)) return;
  const tip = pointAt(pts, 1);
  const c: Pt = { x: tip.x, y: tip.y };
  bloom(p, rng.fork('flower'), c, {
    petals: f.petals,
    view: { tilt: lerp(0.4, f.tilt, openK), roll: f.roll },
    budK,
    openK,
    budAngle: tip.angle,
    budLen: 6.5,
    budWidth: 5.6,
    colourK: 0.2 * ease(g, f.bud[1] - 0.1, f.open[0] + 0.05),
    size: f.size,
    width: 0.78,
    closedLen: 0.55,
    sepals: 0,
    green: PIGMENTS.sap,
    style: { pigment: plan.petal, inner: lighten(plan.blush, 0.55), innerReach: 0.4, tip: lighten(plan.petal, 0.4), white: true, opacity: 0.93, edge: 0.4 },
  });
  if (!visible(openK)) return;
  // the centre: a dark (or gold) boss with a soft ring of stamens
  const r = f.size * 0.26 * openK;
  const nst = 16;
  for (let i = 0; i < nst; i++) {
    const a = (i / nst) * Math.PI * 2 + rng.fork(`sa-${i}`).range(-0.15, 0.15);
    const rr = r * (1.05 + rng.fork(`sr-${i}`).next() * 0.35);
    p.dab({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * f.tilt }, plan.ring, {
      rng: rng.fork(`st-${i}`),
      variant: 'round',
      angle: a,
      length: 0.9 * openK,
      width: 0.7 * openK,
      opacity: 0.75 * openK,
      blend: 'source-over',
      edge: 0.3,
    });
  }
  p.dab(c, plan.eye, { rng: rng.fork('eye'), variant: 'round', angle: f.roll, length: r * 1.6, width: r * 1.5, opacity: 0.9 * openK, edge: 0.45, granulation: 0.3, blend: 'source-over' });
}

const anemone: SpeciesDef = {
  id: 'anemone',
  name: 'Anemone',
  nativeName: 'Shūmeigiku',
  tier: 2,
  habitats: ['meadow', 'path'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Anemone — a windflower, turning its face to every passing breeze.',
  bloomColor: '#f6f0ea',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planAnemone(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 30, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 9 });
      plan.leaves.forEach((l, i) => drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.flowers.forEach((f, i) => drawFlower(p, r.fork(`flower-${i}`), f, plan, g));
    } finally {
      end();
    }
  },
};

export default anemone;
