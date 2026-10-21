import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment } from '../../paint';
import { ease, lerp, phase, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, plantFrame, seedMound } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Maidenhair fern (kujakushida): fine, glossy near-black stalks that arch out and fork into
 * airy sprays of small fan-shaped leaflets in fresh green. It grows by uncurling: tight
 * fiddleheads unroll as each frond lengthens and the leaflets open along it; the youngest frond
 * keeps a blush of bronze.
 */

interface Pinnule {
  t: number;
  side: number;
  size: number;
  turn: number;
}

interface Pinna {
  t: number;
  side: number;
  stem: StemPlan;
  pinnules: Pinnule[];
}

interface Frond {
  stem: StemPlan;
  window: [number, number];
  pinnae: Pinna[];
  tone: Pigment;
  young: boolean;
}

export interface FernPlan {
  fronds: Frond[];
}

const STIPE = mix(PIGMENTS.sumi, '#5b3e4a', 0.4);
const BRONZE = mix(PIGMENTS.sakura, PIGMENTS.woodLight, 0.5);

export function planMaidenhairFern(rng: Rng): FernPlan {
  const n = rng.int(3, 5);
  const green = jitter(mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.35), rng, 0.03);
  const lean = rng.range(-0.15, 0.15);
  const fronds: Frond[] = [];
  const youngest = rng.int(0, n - 1);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const side = Math.sign(u || (rng.chance(0.5) ? 1 : -1));
    const stem = makeStem(rng, {
      base: { x: u * 4, y: 0 },
      length: rng.range(28, 40) * (1 - Math.abs(u) * 0.25),
      angle: UP + lean + u * 1.1 + rng.gaussian(0, 0.08),
      bend: side * rng.range(0.6, 1.1),
      segments: 10,
      tipBias: 0.65,
      wobble: 0.02,
    });
    const np = rng.int(4, 6);
    const pinnae: Pinna[] = [];
    for (let j = 0; j < np; j++) {
      const t = 0.36 + (0.6 * j) / np + rng.gaussian(0, 0.02);
      const ps = j % 2 === 0 ? 1 : -1;
      const len = rng.range(7, 11) * (1 - (j / np) * 0.45);
      const pinnules: Pinnule[] = [];
      const nq = rng.int(4, 6);
      for (let q = 0; q < nq; q++) {
        pinnules.push({ t: 0.12 + (0.88 * q) / nq, side: q % 2 === 0 ? 1 : -1, size: rng.range(1.9, 2.7) * (1 - (q / nq) * 0.35), turn: rng.gaussian(0, 0.2) });
      }
      pinnae.push({
        t,
        side: ps,
        stem: makeStem(rng, { length: len, angle: 0, bend: ps * rng.range(0.2, 0.5), segments: 5 }),
        pinnules,
      });
    }
    fronds.push({
      stem,
      window: [...stagger(i, n, [0.06, 0.62], 0.55)] as [number, number],
      pinnae,
      tone: jitter(green, rng, 0.03),
      young: i === youngest,
    });
  }
  return { fronds };
}

function drawFrond(p: Painter, rng: Rng, f: Frond, g: number) {
  const e = ease(g, f.window[0], f.window[1]);
  if (!visible(e)) return;
  // a fiddlehead: the tip is curled tight while short and unrolls as the frond lengthens
  const curl = lerp(6, 1, smooth(e));
  const tipPts = stemPoints({ ...f.stem, bends: f.stem.bends.map((b, i) => b * (i > f.stem.bends.length * 0.65 ? curl : 1)) }, e, 1);
  p.inkLine(tipPts, { rng: rng.fork('stipe'), width: 0.42, pigment: STIPE, opacity: 0.8, breaks: 0.05, wobble: 0.15, pressureVar: 0.25, taper: [0.02, 0.5], pressure: [1.1, 0.8, 0.5] });
  const colour = f.young ? mix(f.tone, BRONZE, 0.35 * (1 - 0.4 * ease(g, 0.8, 1))) : f.tone;
  f.pinnae.forEach((pn, j) => {
    // pinnae appear once the unrolling stalk has passed them, and open over the next stretch
    const k = smooth(phase(e, pn.t * 0.8, pn.t * 0.8 + 0.35)) * lerp(0.75, 1, ease(g, 0.45, 0.75));
    if (!visible(k)) return;
    const at = pointAt(tipPts, pn.t);
    // pinnae spread to near-horizontal tiers
    const out = at.angle + pn.side * 1.1;
    const level = Math.cos(out) >= 0 ? -0.15 : Math.PI + 0.15;
    const ang = lerpAng(at.angle, lerpAng(out, level, 0.45), lerp(0.25, 1, k));
    const ppts = stemPoints({ ...pn.stem, base: { x: at.x, y: at.y }, angle: ang }, k, lerp(2.5, 1, k));
    p.inkLine(ppts, { rng: rng.fork(`rachis-${j}`), width: 0.24, pigment: STIPE, opacity: 0.7, breaks: 0, wobble: 0.1, taper: [0.05, 0.6] });
    // alternate leaflets dry in two separate layers so neighbours keep their own edges
    const R = 14;
    const layers = [0, 1].map(() => p.layer({ x: at.x - R, y: at.y - R, w: R * 2, h: R * 2 }));
    pn.pinnules.forEach((q, qi) => {
      const qk = smooth(phase(k, q.t * 0.6, q.t * 0.6 + 0.4));
      if (!visible(qk)) return;
      const qa = pointAt(ppts, q.t);
      // fan-shaped leaflets hang on short stalks below the rachis, splayed alternately
      const hang = Math.PI / 2 + q.side * 0.6 + q.turn;
      const stalk = 0.7 * qk;
      const base = { x: qa.x + Math.cos(hang) * stalk, y: qa.y + Math.sin(hang) * stalk };
      const tone = jitter(qi % 3 === 0 ? lighten(colour, 0.12) : colour, rng.fork(`pt-${j}-${qi}`), 0.04);
      p.dabInto(layers[qi % 2]!, base, tone, {
        rng: rng.fork(`pinnule-${j}-${qi}`),
        variant: 'petal',
        angle: hang,
        length: q.size * qk,
        width: q.size * 1.25 * qk * lerp(0.4, 1, qk),
        curve: q.side * 0.1,
        pool: 0.45,
        basePool: 0.35,
        layers: 3,
      });
    });
    for (const L of layers) L.dry({ opacity: 0.8, edge: 0.6, edgeWidth: 0.3, sharpness: 0.75, centreLift: 0.3, granulation: 0.08, flow: 0.35, flowScale: 4, darken: 0.32 });
  });
}

function lerpAng(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const maidenhairFern: SpeciesDef = {
  id: 'maidenhair-fern',
  name: 'Maidenhair Fern',
  nativeName: 'Kujakushida',
  tier: 1,
  habitats: ['rock', 'shore'],
  sizeClass: 'small',
  size: { w: 70, h: 70 },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Maidenhair fern — green lace in the cool of the stones.',
  bloomColor: '#a8b47e',
  pollinators: false,
  draw(p, rng, opts) {
    const plan = planMaidenhairFern(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 15, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 6 });
      plan.fronds.forEach((f, i) => drawFrond(p, r.fork(`frond-${i}`), f, g));
    } finally {
      end();
    }
  },
};

export default maidenhairFern;
