import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { daiFlower, lobedLeaf, type DaiPetal, type Lobe } from '../lib/daimonjiso-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Daimonjisō (Saxifraga fortunei var. incisolobata): a low rosette of round, lobed leaves on
 * red stalks, flat on wet rock, and in autumn loose sprays of small white flowers shaped like
 * the character 大 — three short petals above, two long ones splayed below like legs.
 */

const LEAF = '#8b9c5a';
const STALK = '#9a5a4a';
const BLUSH = '#e7a3ae';

interface RosetteLeaf {
  /** where the blade lies, around the base on the rock (ground-plane azimuth, 0 = right) */
  azimuth: number;
  stalk: number;
  r: number;
  lobes: Lobe[];
  tilt: number;
  window: [number, number];
  tone: Pigment;
  rust: number;
}

interface Flower {
  petals: DaiPetal[];
  size: number;
  tilt: number;
  /** turn of the flower's up from its pedicel's direction */
  turn: number;
  bud: [number, number];
  open: [number, number];
}

interface Twig {
  /** position along the parent, 0..1 */
  t: number;
  stem: StemPlan;
  window: [number, number];
  flower: Flower;
}

interface Branch extends Twig {
  twigs: Twig[];
}

interface Scape {
  stem: StemPlan;
  window: [number, number];
  branches: Branch[];
  /** the terminal flower, first to open */
  top: Twig;
}

export interface DaimonjisoPlan {
  leaves: RosetteLeaf[];
  scapes: Scape[];
  /** flush on the long petals' tips (0 = pure white) */
  blush: number;
  spread: number;
}

function planFlower(rng: Rng, bud: [number, number], open: [number, number]): Flower {
  const longL = rng.range(2.6, 3.3);
  const skew = rng.range(0.82, 1);
  const flip = rng.chance(0.5);
  const petals: DaiPetal[] = [
    { a: UP - rng.range(1.05, 1.3), len: rng.range(0.9, 1.05), wid: 0.62, curve: rng.gaussian(0, 0.08), long: false },
    { a: UP + rng.gaussian(0, 0.1), len: rng.range(0.95, 1.1), wid: 0.6, curve: rng.gaussian(0, 0.08), long: false },
    { a: UP + rng.range(1.05, 1.3), len: rng.range(0.9, 1.05), wid: 0.62, curve: rng.gaussian(0, 0.08), long: false },
    // the legs: one a little longer, splayed a little unevenly
    { a: Math.PI / 2 + rng.range(0.38, 0.6), len: longL * (flip ? 1 : skew), wid: 0.42, curve: rng.range(0.04, 0.14), long: true },
    { a: Math.PI / 2 - rng.range(0.38, 0.6), len: longL * (flip ? skew : 1), wid: 0.42, curve: -rng.range(0.04, 0.14), long: true },
  ];
  return { petals, size: rng.range(2.3, 2.7), tilt: rng.range(0.78, 1), turn: rng.gaussian(0, 0.25), bud, open };
}

export function planDaimonjiso(rng: Rng): DaimonjisoPlan {
  const green = jitter(mix(LEAF, PIGMENTS.olive, rng.range(0.45, 0.7)), rng, 0.03);
  const nLeaves = rng.int(5, 7);
  const turn = rng.range(0, Math.PI * 2);
  const leaves: RosetteLeaf[] = [];
  for (let i = 0; i < nLeaves; i++) {
    const azimuth = turn + (i / nLeaves) * Math.PI * 2 + rng.gaussian(0, 0.25);
    const nl = rng.int(7, 9);
    const lobes: Lobe[] = [];
    // the lobes fan round the blade, leaving a narrow sinus where the stalk joins
    const sinus = rng.range(0.55, 0.8);
    for (let j = 0; j < nl; j++) {
      lobes.push({ a: sinus + ((Math.PI * 2 - sinus * 2) * j) / (nl - 1) + rng.gaussian(0, 0.06), len: rng.range(0.88, 1.06), wid: rng.range(0.66, 0.8), tone: rng.next() });
    }
    leaves.push({
      azimuth,
      stalk: rng.range(8, 12),
      r: rng.range(5.8, 7.4),
      lobes,
      tilt: rng.range(0.62, 0.82),
      window: [0, 0],
      tone: jitter(green, rng, 0.04),
      rust: rng.chance(0.45) ? rng.range(0.2, 0.55) : rng.range(0, 0.12),
    });
  }
  const order = rng.shuffle(leaves.map((_, i) => i));
  order.forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, nLeaves, [0.05, 0.48], 0.45)] as [number, number];
  });

  const nScapes = rng.chance(0.3) ? 1 : rng.chance(0.75) ? 2 : 3;
  const lean = rng.range(-0.18, 0.18);
  const scapes: Scape[] = [];
  let flowerIndex = 0;
  const nFlowersGuess = nScapes * 7;
  const nextOpen = (): [number, number] => {
    const i = Math.min(flowerIndex++, nFlowersGuess - 1);
    return [...stagger(i, nFlowersGuess, [0.74, 1], 0.5)] as [number, number];
  };
  for (let s = 0; s < nScapes; s++) {
    const side = nScapes === 1 ? 0 : (s / (nScapes - 1) - 0.5) * 2;
    const height = rng.range(30, 38) * (s === 0 ? 1 : rng.range(0.78, 0.94));
    const stem = makeStem(rng, { base: { x: side * 1.5, y: -0.5 }, length: height, angle: UP + lean + side * rng.range(0.14, 0.26), bend: -side * rng.range(0, 0.2) + rng.gaussian(0, 0.12), segments: 9, tipBias: 0.6, wobble: 0.03 });
    const window: [number, number] = [0.34 + s * 0.04, 0.72];
    const top: Twig = { t: 1, stem: makeStem(rng, { length: rng.range(2.5, 4), angle: rng.gaussian(0, 0.2), bend: rng.gaussian(0, 0.2), segments: 3 }), window: [0.5, 0.74], flower: planFlower(rng, [0.48, 0.74], nextOpen()) };
    const nb = rng.int(3, 5);
    const branches: Branch[] = [];
    const flipB = rng.chance(0.5) ? 1 : -1;
    for (let b = 0; b < nb; b++) {
      const bs = (b % 2 === 0 ? 1 : -1) * flipB;
      const t = 0.92 - (b / nb) * rng.range(0.42, 0.5);
      const length = rng.range(7, 11) * lerp(0.7, 1.15, b / Math.max(1, nb - 1));
      const bw: [number, number] = [0.5 + b * 0.025, 0.76];
      const nt = b === 0 ? 0 : rng.chance(0.6) ? 1 : 0;
      const twigs: Twig[] = [];
      for (let k = 0; k < nt; k++) {
        twigs.push({
          t: rng.range(0.35, 0.7),
          stem: makeStem(rng, { length: rng.range(3, 5.5), angle: -bs * rng.range(0.5, 0.9), bend: rng.gaussian(0, 0.3), segments: 3 }),
          window: [bw[0] + 0.05, 0.78],
          flower: planFlower(rng, [0.54 + b * 0.02, 0.8], nextOpen()),
        });
      }
      branches.push({
        t,
        // a relative turtle: angle measured from the scape's direction at the node
        stem: makeStem(rng, { length, angle: bs * rng.range(0.75, 1.15), bend: -bs * rng.range(0.1, 0.4), segments: 4 }),
        window: bw,
        flower: planFlower(rng, [0.52 + b * 0.02, 0.78], nextOpen()),
        twigs,
      });
    }
    scapes.push({ stem, window, branches, top });
  }
  const blush = rng.next();
  return { leaves, scapes, blush: blush < 0.3 ? rng.range(0.35, 0.6) : blush < 0.4 ? rng.range(0.7, 0.85) : 0, spread: 16 };
}

/** The ground plane is seen from above and in front: depth is squashed. */
const GROUND_SQUASH = 0.38;

/** Where the stalk meets the blade (the sinus), on the rock; front leaves lie closer in. */
function sinusAt(l: RosetteLeaf, k: number): Pt {
  const d = l.stalk * easeOut(k) * lerp(1, 0.35, Math.max(0, Math.sin(l.azimuth)));
  return { x: Math.cos(l.azimuth) * d, y: Math.sin(l.azimuth) * d * GROUND_SQUASH - 1 };
}

function drawLeaf(p: Painter, rng: Rng, l: RosetteLeaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const s = sinusAt(l, k);
  paintStem(p, rng.fork('stalk'), [{ x: 0, y: -0.5 }, { x: s.x * 0.5, y: s.y * 0.5 - 1 }, s], { width: 0.5, opacity: 0.72 * smooth(k * 4), pigment: mix(STALK, PIGMENTS.sage, 0.2) });
  // the blade lies on the rock beyond its sinus; back leaves are a little smaller
  const back = Math.max(0, -Math.sin(l.azimuth));
  const r = l.r * lerp(1, 0.86, back);
  const reach = r * easeOut(k) * 0.82 * lerp(1, 0.5, Math.max(0, Math.sin(l.azimuth)));
  // the nearest blades stop short of the sprite's foot
  const c = { x: s.x + Math.cos(l.azimuth) * reach, y: Math.min(s.y + Math.sin(l.azimuth) * reach * l.tilt, 5.6 - r * easeOut(k) * l.tilt) };
  const toBase = l.azimuth + Math.PI;
  lobedLeaf(p, rng.fork('blade'), c, {
    lobes: l.lobes.map((lb) => ({ ...lb, a: lb.a + toBase })),
    view: { tilt: l.tilt, roll: UP },
    r,
    k,
    fold: Math.atan2(Math.sin(l.azimuth) * l.tilt, Math.cos(l.azimuth)),
    pigment: l.tone,
    rust: l.rust * smooth(k),
    rustPigment: STALK,
    vein: 0.12,
  });
}

function flowerAt(p: Painter, rng: Rng, c: Pt, dir: number, f: Flower, plan: DaimonjisoPlan, g: number) {
  const budK = ease(g, f.bud[0], f.bud[1]);
  if (!visible(budK)) return;
  const open = ease(g, f.open[0], f.open[1]);
  const fade = 1 - smooth(open / 0.5);
  if (visible(fade)) {
    const bud = mix(PIGMENTS.sap, PIGMENTS.petalWhite, smooth(budK) * 0.7);
    p.dab(c, bud, { rng: rng.fork('bud'), variant: 'round', angle: dir, length: lerp(0.4, 1.7, budK) * f.size * 0.7, width: lerp(0.35, 1.2, budK) * f.size * 0.6, opacity: 0.85 * fade * smooth(budK * 3), edge: 0.4 });
  }
  if (!visible(open)) return;
  // the flower faces out along its pedicel, its 大 upright-ish
  const roll = UP + Math.atan2(Math.sin(dir - UP), Math.cos(dir - UP)) * 0.25 + f.turn;
  daiFlower(p, rng.fork('flower'), c, { petals: f.petals, view: { tilt: f.tilt, roll }, open, size: f.size, tip: BLUSH, tipK: plan.blush });
}

/** A stem drawn relative to a node on its parent (`at`, the parent's direction there). */
function attach(stem: StemPlan, at: { x: number; y: number; angle: number }): StemPlan {
  return { ...stem, base: { x: at.x, y: at.y }, angle: at.angle + stem.angle };
}

function drawTwig(p: Painter, rng: Rng, tw: Twig, parent: Pt[], plan: DaimonjisoPlan, g: number, width: number) {
  const k = ease(g, tw.window[0], tw.window[1]);
  if (!visible(k)) return;
  const node = pointAt(parent, tw.t);
  const pts = stemPoints(attach(tw.stem, node), k, lerp(0.4, 1, k));
  paintStem(p, rng.fork('stem'), pts, { width, opacity: 0.7, pigment: mix(STALK, PIGMENTS.sage, 0.35) });
  const tip = pointAt(pts, 1);
  flowerAt(p, rng.fork('fl'), { x: tip.x, y: tip.y }, tip.angle, tw.flower, plan, g);
}

function drawScape(p: Painter, rng: Rng, s: Scape, plan: DaimonjisoPlan, g: number) {
  const ext = ease(g, s.window[0], s.window[1]);
  if (!visible(ext)) return;
  const pts = stemPoints(s.stem, ext, lerp(0.5, 1, ext));
  paintStem(p, rng.fork('stem'), pts, { width: 0.5, opacity: 0.75, ink: 0.12 * ext, inkReach: 0.5, inkPigment: mix(STALK, PIGMENTS.sumi, 0.5), pigment: mix(STALK, PIGMENTS.sage, 0.25) });
  s.branches.forEach((b, i) => {
    const r = rng.fork(`branch-${i}`);
    const k = ease(g, b.window[0], b.window[1]);
    if (!visible(k)) return;
    const pts2 = stemPoints(attach(b.stem, pointAt(pts, b.t)), k, lerp(0.4, 1, k));
    paintStem(p, r.fork('stem'), pts2, { width: 0.34, opacity: 0.7, pigment: mix(STALK, PIGMENTS.sage, 0.3) });
    b.twigs.forEach((tw, j) => drawTwig(p, r.fork(`twig-${j}`), tw, pts2, plan, g, 0.28));
    const tip = pointAt(pts2, 1);
    flowerAt(p, r.fork('fl'), { x: tip.x, y: tip.y }, tip.angle, b.flower, plan, g);
  });
  drawTwig(p, rng.fork('top'), s.top, pts, plan, g, 0.32);
}

const daimonjiso: SpeciesDef = {
  id: 'daimonjiso',
  name: 'Daimonji Saxifrage',
  nativeName: 'Daimonjisō',
  // wet rocks along mountain streams, from low hills to the alpine zone
  range: { realms: ['japan'], biomes: ['wet-cliff', 'montane-stream'], climates: ['cool-temperate'] },
  tier: 1,
  habitats: ['rock', 'shore'],
  sizeClass: 'small',
  // drawn in a 70-unit design box, shown larger so it reads at garden scale
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Daimonjisō — the gorge writes ‘great’ in small white hands.',
  bloomColor: '#f6f1ea',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planDaimonjiso(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: plan.spread, k: ease(g, 0.08, 0.6), opacity: 0.26 });
      seedMound(p, r, g, { rx: 6 });
      const byDepth = plan.leaves.map((l, i) => ({ l, i })).sort((a, b) => Math.sin(a.l.azimuth) - Math.sin(b.l.azimuth));
      byDepth.forEach(({ l, i }) => Math.sin(l.azimuth) <= 0.35 && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.scapes.forEach((s, i) => drawScape(p, r.fork(`scape-${i}`), s, plan, g));
      byDepth.forEach(({ l, i }) => Math.sin(l.azimuth) > 0.35 && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
    } finally {
      end();
    }
  },
};

export default daimonjiso;
