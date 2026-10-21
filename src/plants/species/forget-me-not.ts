import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment } from '../../paint';
import { ease, lerp, phase, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintLeaf, paintStem, plantFrame, seedMound, smallBlossom } from '../lib/small-paint';
import { UP, makeStem, petalRing, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Forget-me-not (wasurenagusa): a loose tuft of soft, narrow leaves and slender stems, each
 * ending in a curled spray of tiny sky-blue flowers with yellow eyes — opening from the bottom
 * of the spray while the tightly curled tip still holds pink buds.
 */

interface Leaf {
  t: number;
  side: number;
  length: number;
  width: number;
  curve: number;
  tone: Pigment;
}

interface Blossom {
  t: number;
  side: number;
  petals: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  /** index from the bottom of the spray; the top ones stay buds */
  bud: boolean;
  pink: number;
}

interface Spray {
  stem: StemPlan;
  window: [number, number];
  leaves: Leaf[];
  /** curled flower spray (relative turtle; positioned at the stem tip when drawn) */
  cyme: StemPlan;
  cymeTurn: number;
  blossoms: Blossom[];
}

interface Basal {
  angle: number;
  length: number;
  width: number;
  curve: number;
  window: [number, number];
  tone: Pigment;
}

export interface ForgetMeNotPlan {
  basal: Basal[];
  sprays: Spray[];
  blue: Pigment;
  spread: number;
}

export function planForgetMeNot(rng: Rng): ForgetMeNotPlan {
  const lean = rng.range(-0.2, 0.2);
  const green = jitter(mix(PIGMENTS.sap, PIGMENTS.sage, 0.6), rng, 0.03);
  const blue = jitter(lighten(PIGMENTS.bellflower, rng.range(0.12, 0.28)), rng, 0.025);
  const nb = rng.int(3, 5);
  const basal: Basal[] = [];
  for (let i = 0; i < nb; i++) {
    const u = i / (nb - 1) - 0.5;
    basal.push({
      angle: UP + lean * 0.5 + u * 2.4 + rng.gaussian(0, 0.15),
      length: rng.range(6, 9),
      width: rng.range(2.1, 2.7),
      curve: -Math.sign(u || 1) * rng.range(0.1, 0.3),
      window: [...stagger(i, nb, [0.06, 0.38], 0.5)] as [number, number],
      tone: jitter(green, rng, 0.03),
    });
  }
  const ns = rng.int(3, 5);
  const sprays: Spray[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let s = 0; s < ns; s++) {
    const side = (s % 2 === 0 ? 1 : -1) * flip;
    const length = rng.range(22, 34) * (s === 0 ? 1 : rng.range(0.6, 0.9));
    const stem = makeStem(rng, {
      base: { x: side * rng.range(0, 3), y: 0 },
      length,
      angle: UP + lean + side * rng.range(0.08, 0.28) * (1 + Math.floor(s / 2) * 0.9),
      bend: -side * rng.range(0, 0.25),
      segments: 8,
    });
    const nl = rng.int(2, 3);
    const leaves: Leaf[] = [];
    for (let i = 0; i < nl; i++) {
      leaves.push({
        t: 0.22 + (0.5 * i) / Math.max(1, nl - 1) + rng.gaussian(0, 0.04),
        side: i % 2 === 0 ? 1 : -1,
        length: rng.range(5, 7.5) * (1 - i * 0.15),
        width: rng.range(1.9, 2.5),
        curve: rng.gaussian(0, 0.12),
        tone: jitter(green, rng, 0.03),
      });
    }
    const curl = rng.chance(0.5) ? 1 : -1;
    const cyme = makeStem(rng, { length: rng.range(7, 11), angle: 0, bend: curl * rng.range(1.8, 2.6), segments: 8, tipBias: 1, wobble: 0.02 });
    const n = rng.int(6, 10);
    const nBud = rng.int(2, 3);
    const blossoms: Blossom[] = [];
    for (let j = 0; j < n; j++) {
      blossoms.push({
        t: 0.05 + (0.92 * j) / (n - 1),
        side: j % 2 === 0 ? 1 : -1,
        petals: petalRing(rng, 5, { angJit: 0.1, lenJit: 0.08 }),
        size: rng.range(1.9, 2.4) * (1 - (j / n) * 0.3),
        tilt: rng.range(0.55, 0.95),
        roll: UP + rng.gaussian(0, 0.4),
        bud: j >= n - nBud,
        pink: rng.next(),
      });
    }
    sprays.push({
      stem,
      window: [...stagger(s, ns, [0.1, 0.5], 0.7)] as [number, number],
      leaves,
      cyme,
      cymeTurn: rng.gaussian(0, 0.25),
      blossoms,
    });
  }
  return { basal, sprays, blue, spread: 12 + ns * 2 };
}

function drawSpray(p: Painter, rng: Rng, s: Spray, plan: ForgetMeNotPlan, g: number) {
  const ext = ease(g, s.window[0], s.window[1]);
  if (!visible(ext)) return;
  const pts = stemPoints(s.stem, ext, lerp(0.5, 1, ext));
  paintStem(p, rng.fork('stem'), pts, { width: 0.55, opacity: 0.7, ink: 0.18 * ext, inkReach: 0.6, pigment: mix(PIGMENTS.sage, PIGMENTS.sap, 0.3) });
  s.leaves.forEach((l, i) => {
    const k = smooth(phase(ext, l.t + 0.05, l.t + 0.5));
    const at = pointAt(pts, l.t);
    paintLeaf(
      p,
      rng.fork(`leaf-${i}`),
      at,
      { angle: at.angle + l.side * 0.8, length: l.length, width: l.width, curve: l.curve - l.side * 0.15, k, fold: at.angle },
      { pigment: l.tone, vein: 0.15 },
    );
  });
  // the flower spray unrolls from a tight curl as it lengthens
  const cy = ease(g, 0.38 + s.window[0] * 0.2, 0.74);
  if (!visible(cy)) return;
  const tip = pointAt(pts, 1);
  const cyme: StemPlan = { ...s.cyme, base: { x: tip.x, y: tip.y }, angle: tip.angle + s.cymeTurn };
  const cpts = stemPoints(cyme, cy, lerp(1.6, 1, cy));
  paintStem(p, rng.fork('cyme'), cpts, { width: 0.38, opacity: 0.5, pigment: mix(PIGMENTS.sap, PIGMENTS.sage, 0.5) });
  const n = s.blossoms.length;
  s.blossoms.forEach((b, j) => {
    const budK = ease(g, 0.42 + (j / n) * 0.12, 0.72);
    if (!visible(budK)) return;
    const at = pointAt(cpts, b.t);
    const off = (b.bud ? 0.5 : lerp(0.4, 1.4, budK)) * b.side;
    const c = { x: at.x - Math.sin(at.angle) * off, y: at.y + Math.cos(at.angle) * off };
    const nOpen = n - s.blossoms.filter((x) => x.bud).length;
    const open = b.bud ? 0 : smooth(ease(g, 0.74 + (0.2 * j) / Math.max(1, nOpen), 0.86 + (0.14 * j) / Math.max(1, nOpen)));
    // young flowers open pink and turn blue
    const pink = mix(PIGMENTS.sakuraLight, PIGMENTS.irisLight, 0.35 + b.pink * 0.3);
    const colour = mix(mix(PIGMENTS.sage, pink, smooth(budK * 1.2)), plan.blue, open * lerp(0.75, 1, b.pink));
    const size = b.size * lerp(0.4, 0.6, budK) * lerp(1, 1 / 0.6, open);
    smallBlossom(p, rng.fork(`fl-${j}`), c, {
      petals: b.petals,
      view: { tilt: lerp(0.5, b.tilt, open), roll: lerpRoll(at.angle, b.roll, open) },
      open,
      size,
      width: 0.72,
      closedLen: 0.75,
      pigment: colour,
      inner: lighten(colour, 0.6 * open),
      opacity: 0.9,
    });
    if (open > 0.25) {
      p.dab(c, mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.25), { rng: rng.fork(`eye-${j}`), variant: 'round', angle: 0.3, length: size * 0.3, width: size * 0.26, opacity: 0.9 * smooth((open - 0.25) / 0.5), edge: 0.35 });
    }
  });
}

function lerpRoll(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const forgetMeNot: SpeciesDef = {
  id: 'forget-me-not',
  name: 'Forget-me-not',
  nativeName: 'Wasurenagusa',
  tier: 1,
  habitats: ['shore', 'meadow'],
  sizeClass: 'small',
  size: { w: 70, h: 70 },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Forget-me-not — a little sky kept close to the water.',
  bloomColor: '#93a9d6',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planForgetMeNot(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: plan.spread * 0.8, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 6 });
      plan.basal.forEach((b, i) => {
        const k = ease(g, b.window[0], b.window[1]);
        paintLeaf(p, r.fork(`basal-${i}`), { x: 0, y: 0 }, { angle: b.angle, length: b.length, width: b.width, curve: b.curve, k, fold: UP }, { pigment: b.tone, vein: 0.2 });
      });
      plan.sprays.forEach((s, i) => drawSpray(p, r.fork(`spray-${i}`), s, plan, g));
    } finally {
      end();
    }
  },
};

export default forgetMeNot;
