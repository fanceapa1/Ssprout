import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { bloom, groundShadow, paintLeaf, paintStem, plantFrame, seedMound, toothedLeaf } from '../lib/small-paint';
import { UP, arc, makeStem, petalPose, petalRing, pointAt, stemPoints, subPath, type FlowerView, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Wild strawberry (hebi-ichigo / no-ichigo): a low clump of toothed three-part leaves, a red
 * runner reaching out to root a tiny new plantlet, a few round white flowers with gold hearts
 * — and, already, a berry or two hanging under the leaves.
 */

interface Leaf {
  stem: StemPlan;
  leaflets: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  window: [number, number];
  tone: Pigment;
  front: boolean;
}

interface Flower {
  stem: StemPlan;
  petals: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  bud: [number, number];
  open: [number, number];
}

interface Berry {
  stem: StemPlan;
  size: number;
  window: [number, number];
  seeds: { u: number; v: number }[];
}

export interface StrawberryPlan {
  leaves: Leaf[];
  flowers: Flower[];
  berries: Berry[];
  runner: { to: Pt; bow: number; leaflets: PetalPlan[] } | null;
  green: Pigment;
}

const BERRY = mix(PIGMENTS.vermilion, PIGMENTS.sakura, 0.35);
const RUNNER = mix(PIGMENTS.sakura, PIGMENTS.wood, 0.55);

function trifoliate(rng: Rng): PetalPlan[] {
  return [UP, UP + 1.45, UP - 1.45].map((b, j) => ({
    a: b + rng.gaussian(0, 0.1),
    len: (j === 0 ? 1.05 : 0.92) + rng.gaussian(0, 0.06),
    wid: 1 + rng.gaussian(0, 0.07),
    curve: rng.gaussian(0, 0.08),
    tone: rng.next(),
  }));
}

export function planWildStrawberry(rng: Rng): StrawberryPlan {
  const lean = rng.range(-0.15, 0.15);
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.olive, 0.3), rng, 0.03);
  const n = rng.int(3, 5);
  const leaves: Leaf[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    leaves.push({
      stem: makeStem(rng, { length: rng.range(11, 19) * (1 - Math.abs(u) * 0.3), angle: UP + lean + u * 1.7 + rng.gaussian(0, 0.12), bend: -Math.sign(u || 1) * rng.range(0.1, 0.5), segments: 6 }),
      leaflets: trifoliate(rng),
      size: rng.range(8, 10.5),
      tilt: rng.range(0.5, 0.85),
      roll: UP + u * 0.7 + rng.gaussian(0, 0.15),
      window: [0, 0],
      tone: jitter(green, rng, 0.035),
      front: rng.chance(0.3),
    });
  }
  rng.shuffle(leaves.map((_, i) => i)).forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, n, [0.06, 0.48], 0.45)] as [number, number];
  });
  const nf = rng.int(1, 3);
  const flowers: Flower[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nf; i++) {
    const side = (i % 2 === 0 ? 1 : -1) * flip;
    flowers.push({
      stem: makeStem(rng, { length: rng.range(20, 27) * (i === 0 ? 1 : rng.range(0.75, 0.9)), angle: UP + lean + side * rng.range(0.15, 0.45), bend: side * rng.range(0.2, 0.6), segments: 8, tipBias: 0.8 }),
      petals: petalRing(rng, 5, { angJit: 0.1, lenJit: 0.07 }),
      size: rng.range(4.2, 5),
      tilt: rng.range(0.55, 0.9),
      roll: UP + side * rng.range(0.2, 0.6),
      bud: [...stagger(i, nf, [0.45, 0.76], 0.6)] as [number, number],
      open: [...stagger(i, nf, [0.75, 1], 0.65)] as [number, number],
    });
  }
  const nb = rng.int(1, 2);
  const berries: Berry[] = [];
  for (let i = 0; i < nb; i++) {
    const side = (i % 2 === 0 ? -1 : 1) * flip;
    const seeds: { u: number; v: number }[] = [];
    for (let s = 0; s < 7; s++) seeds.push({ u: rng.range(-0.6, 0.6), v: rng.range(0.15, 0.85) });
    berries.push({
      stem: makeStem(rng, { length: rng.range(12, 17), angle: UP + side * rng.range(0.5, 0.9), bend: side * rng.range(1.2, 1.8), segments: 8, tipBias: 0.9 }),
      size: rng.range(3.6, 4.6),
      window: [...stagger(i, nb, [0.4, 0.98], 0.75)] as [number, number],
      seeds,
    });
  }
  const runner = rng.chance(0.6)
    ? { to: { x: -flip * rng.range(22, 29), y: rng.range(-1, 1) }, bow: -flip * rng.range(0.12, 0.25), leaflets: trifoliate(rng) }
    : null;
  return { leaves, flowers, berries, runner, green };
}

function drawLeaf(p: Painter, rng: Rng, l: Leaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(l.stem, lerp(0.12, 1, k) * smooth(k * 3), lerp(0.4, 1, k));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.6, opacity: 0.65, pigment: mix(PIGMENTS.sage, RUNNER, 0.15), ink: 0.25 * k, inkReach: 0.7 });
  const tip = pointAt(pts, 1);
  leaflets(p, rng.fork('leaflets'), tip, l.leaflets, { tilt: l.tilt, roll: l.roll }, ease(g, lerp(l.window[0], l.window[1], 0.3), l.window[1] + 0.06), l.size * easeOut(k), l.tone, 0.25);
}

/** Three toothed leaflets unfolding from a folded bunch (`open` 0..1). */
function leaflets(p: Painter, rng: Rng, at: Pt, plan: PetalPlan[], view: FlowerView, open: number, size: number, tone: Pigment, vein: number) {
  const poses = plan.map((pl, i) => ({ pl, i, pose: petalPose(pl.a, view, open, 0.75) })).sort((a, b) => a.pose.depth - b.pose.depth);
  for (const { pl, i, pose } of poses) {
    toothedLeaf(
      p,
      rng.fork(`lf-${i}`),
      at,
      { angle: pose.angle, length: size * pl.len * pose.len, width: size * 0.62 * pl.wid * lerp(0.45, 1, open), curve: pl.curve },
      { pigment: mix(tone, pl.tone > 0.5 ? lighten(tone, 0.25) : shade(tone, 0.2), Math.abs(pl.tone - 0.5)), teeth: 6, vein: vein * open, opacity: 0.8 },
    );
  }
}

function drawFlower(p: Painter, rng: Rng, f: Flower, g: number) {
  const grow = ease(g, f.bud[0] - 0.15, f.open[0]);
  if (!visible(grow)) return;
  const budK = ease(g, f.bud[0], f.bud[1]);
  const openK = smooth(ease(g, f.open[0], f.open[1]));
  const pts = stemPoints(f.stem, grow, lerp(0.3, 1, budK));
  paintStem(p, rng.fork('stem'), pts, { width: 0.5, opacity: 0.65, ink: 0.3 * budK, inkReach: 0.6 });
  if (!visible(budK)) return;
  const tip = pointAt(pts, 1);
  const c = { x: tip.x, y: tip.y };
  bloom(p, rng.fork('flower'), c, {
    petals: f.petals,
    view: { tilt: lerp(0.4, f.tilt, openK), roll: f.roll },
    budK,
    openK,
    budAngle: tip.angle,
    budLen: f.size * 0.7,
    budWidth: f.size * 0.6,
    colourK: ease(g, f.bud[1] - 0.1, f.open[0] + 0.05),
    size: f.size,
    width: 0.95,
    closedLen: 0.6,
    sepals: 3,
    style: { pigment: PIGMENTS.petalWhite, inner: PIGMENTS.petalShade, innerReach: 0.4, white: true, opacity: 0.92, variant: 'round', edge: 0.45 },
  });
  if (visible(openK)) {
    // a green-gold dome ringed with stamens
    p.dab(c, mix(PIGMENTS.gold, PIGMENTS.sageLight, 0.3), { rng: rng.fork('dome'), variant: 'round', angle: f.roll, length: f.size * 0.5 * openK, width: f.size * 0.46 * openK, opacity: 0.85, edge: 0.25, darken: 0.12 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = f.size * 0.36 * openK;
      p.dab({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * f.tilt }, mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.15), { rng: rng.fork(`an-${i}`), variant: 'round', angle: a, length: 0.7, width: 0.6, opacity: 0.85 * openK, edge: 0.3 });
    }
  }
}

function drawBerry(p: Painter, rng: Rng, b: Berry, g: number) {
  const k = ease(g, b.window[0], b.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(b.stem, easeOut(k), lerp(0.2, 1, k));
  paintStem(p, rng.fork('stem'), pts, { width: 0.45, opacity: 0.6 });
  const tip = pointAt(pts, 1);
  const ripe = ease(g, b.window[0] + 0.25, 1);
  const s = b.size * easeOut(k);
  const colour = mix(PIGMENTS.sageLight, BERRY, ripe);
  const angle = tip.angle;
  // the berry: a rounded cone hanging from the stalk end, darker on its shaded flank
  p.dab(tip, colour, { rng: rng.fork('berry'), variant: 'petal', angle, length: s * 1.2, width: s, pool: 0.6, basePool: 0.2, opacity: 0.88, edge: 0.5, blend: 'source-over' });
  if (ripe > 0.3) {
    for (const [i, sd] of b.seeds.entries()) {
      const u = { x: Math.cos(angle), y: Math.sin(angle) };
      const at = { x: tip.x + u.x * s * 1.2 * sd.v - u.y * s * 0.4 * sd.u, y: tip.y + u.y * s * 1.2 * sd.v + u.x * s * 0.4 * sd.u };
      p.dab(at, mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.3), { rng: rng.fork(`seed-${i}`), variant: 'round', angle: 0, length: 0.45, width: 0.35, opacity: (ripe - 0.3) * 1.2, blend: 'source-over', edge: 0.2 });
    }
  }
  // green calyx star at the top
  for (let i = 0; i < 4; i++) {
    const a = angle + Math.PI + (i - 1.5) * 0.75;
    paintLeaf(p, rng.fork(`cal-${i}`), tip, { angle: a, length: s * 0.65, width: s * 0.28, k }, { pigment: PIGMENTS.sage, shadow: null, opacity: 0.8 });
  }
}

function drawRunner(p: Painter, rng: Rng, plan: StrawberryPlan, g: number) {
  const r = plan.runner;
  if (!r) return;
  const k = ease(g, 0.32, 0.8);
  if (!visible(k)) return;
  const full = arc({ x: 0, y: -1 }, r.to, r.bow, 10);
  const pts = subPath(full, k);
  paintStem(p, rng.fork('runner'), pts, { width: 0.45, opacity: 0.6, pigment: RUNNER });
  const leaf = ease(g, 0.62, 0.95);
  if (visible(leaf)) {
    const at = full[10]!;
    paintStem(p, rng.fork('plantlet-stalk'), [at, { x: at.x, y: at.y - 4 * leaf }], { width: 0.4, opacity: 0.6 });
    leaflets(p, rng.fork('plantlet'), { x: at.x, y: at.y - 4 * leaf }, r.leaflets, { tilt: 0.7, roll: UP }, leaf, 4.5 * leaf, lighten(plan.green, 0.15), 0);
  }
}

const wildStrawberry: SpeciesDef = {
  id: 'wild-strawberry',
  name: 'Wild Strawberry',
  nativeName: 'No-ichigo',
  tier: 1,
  habitats: ['meadow', 'path', 'rock'],
  sizeClass: 'small',
  size: { w: 70, h: 70 },
  anchor: { x: 0.5, y: 0.86 },
  description: 'Wild strawberry — sweetness found by looking down.',
  bloomColor: '#f6f1e6',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planWildStrawberry(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 20, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 6 });
      drawRunner(p, r.fork('runner'), plan, g);
      plan.leaves.forEach((l, i) => !l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.berries.forEach((b, i) => drawBerry(p, r.fork(`berry-${i}`), b, g));
      plan.flowers.forEach((f, i) => drawFlower(p, r.fork(`flower-${i}`), f, g));
      plan.leaves.forEach((l, i) => l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
    } finally {
      end();
    }
  },
};

export default wildStrawberry;
