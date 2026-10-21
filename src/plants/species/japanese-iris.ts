import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { INK_GREEN, dabAxis, groundShadow, paintBud, paintLeaf, paintPetal, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, lerpAngle, makeStem, petalPose, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Japanese iris (hanashōbu): a fan of tall sword leaves at the water's edge and, above them,
 * a few broad flat flowers — three wide falls spreading and drooping, each with a gold signal
 * and fine dark veins, and three small upright standards between them.
 */

interface Blade {
  x: number;
  angle: number;
  length: number;
  width: number;
  curve: number;
  window: [number, number];
  tone: Pigment;
  front: boolean;
}

interface IrisFlower {
  stem: StemPlan;
  rot: number;
  tilt: number;
  size: number;
  colour: Pigment;
  veins: Pigment;
  falls: { a: number; len: number; wid: number; curve: number }[];
  standards: { a: number; len: number }[];
  bud: [number, number];
  open: [number, number];
  bract: number;
}

export interface IrisPlan {
  blades: Blade[];
  flowers: IrisFlower[];
}

const VARIETIES: { colour: Pigment; veins: Pigment }[] = [
  { colour: PIGMENTS.iris, veins: mix(PIGMENTS.iris, PIGMENTS.sumi, 0.45) },
  { colour: mix(PIGMENTS.iris, '#4f3f86', 0.4), veins: mix('#4f3f86', PIGMENTS.sumi, 0.4) },
  { colour: PIGMENTS.irisLight, veins: mix(PIGMENTS.iris, PIGMENTS.sumi, 0.3) },
  { colour: mix(PIGMENTS.petalWhite, PIGMENTS.irisLight, 0.18), veins: mix(PIGMENTS.iris, PIGMENTS.irisLight, 0.4) },
];

export function planJapaneseIris(rng: Rng): IrisPlan {
  const lean = rng.range(-0.1, 0.1);
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.olive, 0.35), rng, 0.03);
  const n = rng.int(7, 11);
  const blades: Blade[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    blades.push({
      x: u * rng.range(7, 12),
      angle: UP + lean + u * 0.5 + rng.gaussian(0, 0.06),
      length: rng.range(55, 100) * (1 - Math.abs(u) * 0.45),
      width: rng.range(4.2, 5.8),
      curve: Math.sign(u || 1) * (rng.chance(0.25) ? rng.range(0.18, 0.3) : rng.range(0.02, 0.1)) + rng.gaussian(0, 0.03),
      window: [0, 0],
      tone: jitter(green, rng, 0.04),
      front: rng.chance(0.4),
    });
  }
  rng.shuffle(blades.map((_, i) => i)).forEach((bi, k) => {
    blades[bi]!.window = [...stagger(k, n, [0.05, 0.52], 0.5)] as [number, number];
  });
  const variety = VARIETIES[rng.int(0, VARIETIES.length - 1)]!;
  const nf = rng.int(1, 3);
  const flowers: IrisFlower[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nf; i++) {
    const side = (i % 2 === 0 ? 1 : -1) * flip;
    const rot = rng.range(-0.35, 0.35);
    flowers.push({
      stem: makeStem(rng, {
        base: { x: side * rng.range(0, 5), y: 0 },
        length: rng.range(96, 122) * (i === 0 ? 1 : rng.range(0.78, 0.92)),
        angle: UP + lean + side * rng.range(0.02, 0.12) * (i + 1),
        bend: -side * rng.range(0, 0.1),
        segments: 10,
      }),
      rot,
      tilt: rng.range(0.42, 0.7),
      size: rng.range(15, 18),
      colour: jitter(variety.colour, rng, 0.03),
      veins: variety.veins,
      falls: [0, 1, 2].map((j) => ({
        a: Math.PI / 2 + rot + (j - 1) * ((Math.PI * 2) / 3) + rng.gaussian(0, 0.1),
        len: rng.range(0.92, 1.08),
        wid: rng.range(0.9, 1.1),
        curve: rng.gaussian(0, 0.12),
      })),
      standards: [0, 1, 2].map((j) => ({ a: -Math.PI / 2 + rot + (j - 1) * ((Math.PI * 2) / 3) + rng.gaussian(0, 0.1), len: rng.range(0.85, 1.1) })),
      bud: [...stagger(i, nf, [0.44, 0.76], 0.6)] as [number, number],
      open: [...stagger(i, nf, [0.75, 1], 0.7)] as [number, number],
      bract: rng.range(0.45, 0.65),
    });
  }
  return { blades, flowers };
}

function drawBlade(p: Painter, rng: Rng, b: Blade, g: number) {
  const k = ease(g, b.window[0], b.window[1]);
  if (!visible(k)) return;
  const at = { x: b.x, y: 0 };
  // a sword leaf lengthens from its base; the tip bends over a little as it grows tall
  paintLeaf(p, rng.fork('blade'), at, { angle: b.angle, length: b.length, width: b.width, curve: b.curve, k }, { pigment: b.tone, variant: 'blade', vein: 0 });
  if (k > 0.4) {
    const L = b.length * k;
    p.inkLine(dabAxis(at, b.angle, L, b.curve * lerp(0.3, 1, k), 8, 0.75), {
      rng: rng.fork('rib'),
      width: 0.4,
      pigment: INK_GREEN,
      opacity: 0.3 * smooth((k - 0.4) / 0.4),
      breaks: 0.4,
      wobble: 0.2,
      taper: [0.05, 0.6],
    });
  }
}

function drawFlower(p: Painter, rng: Rng, f: IrisFlower, g: number) {
  const grow = ease(g, f.bud[0] - 0.18, f.open[0]);
  if (!visible(grow)) return;
  const budK = ease(g, f.bud[0], f.bud[1]);
  const openK = smooth(ease(g, f.open[0], f.open[1]));
  const pts = stemPoints(f.stem, grow, 1);
  paintStem(p, rng.fork('stem'), pts, { width: 1.3, opacity: 0.8, ink: 0.3, inkReach: 0.55, pigment: mix(PIGMENTS.sage, PIGMENTS.olive, 0.3) });
  // a sheathing bract part-way up
  const bp = pointAt(pts, f.bract);
  paintLeaf(p, rng.fork('bract'), bp, { angle: bp.angle + 0.18, length: 16, width: 2.6, curve: 0.08, k: ease(g, f.bud[0] - 0.1, f.bud[0] + 0.15), fold: bp.angle }, { pigment: PIGMENTS.sage, variant: 'blade' });
  if (!visible(budK)) return;
  const tip = pointAt(pts, 1);
  const c: Pt = { x: tip.x, y: tip.y };
  const colourK = ease(g, f.bud[0] + 0.12, f.bud[1] + 0.03);
  const fade = 1 - smooth(openK / 0.5);
  if (visible(fade)) {
    paintBud(p, rng.fork('bud'), c, {
      angle: tip.angle,
      length: 15 * lerp(1, 1.1, openK),
      width: 4.2 * lerp(1, 1.4, openK),
      k: budK,
      colour: colourK,
      pigment: f.colour,
      sepals: 2,
      sepalLen: 0.55,
      opacity: 0.88 * fade,
      white: lightnessOf(f.colour) > 0.8,
    });
  }
  if (!visible(openK)) return;
  const view = { tilt: f.tilt, roll: UP };
  const petalOpacity = 0.86 * smooth(openK / 0.4);
  const white = lightnessOf(f.colour) > 0.8;
  // standards: small, upright, half-open, behind the falls
  f.standards.forEach((s, i) => {
    const pose = petalPose(s.a, view, openK * 0.4, 0.8);
    paintPetal(
      p,
      rng.fork(`std-${i}`),
      c,
      { angle: pose.angle, length: f.size * 0.55 * s.len * pose.len, width: f.size * 0.24, curve: 0.1 },
      { pigment: shade(f.colour, 0.12), inner: shade(f.colour, 0.3), innerReach: 0.4, opacity: petalOpacity, white },
    );
  });
  // falls: broad, spreading and drooping, nearest last
  const order = f.falls.map((fl, i) => ({ fl, i, pose: petalPose(fl.a, view, openK, 0.6) })).sort((a, b) => a.pose.depth - b.pose.depth);
  for (const { fl, i, pose } of order) {
    const angle = lerpAngle(pose.angle, Math.PI / 2, 0.18 * openK * (1 - Math.abs(Math.cos(pose.angle)) * 0.3));
    const length = f.size * fl.len * lerp(0.6, 1, pose.len);
    const width = f.size * 0.62 * fl.wid * lerp(0.5, 1, openK);
    paintPetal(
      p,
      rng.fork(`fall-${i}`),
      c,
      { angle, length, width, curve: fl.curve + 0.12 * Math.sign(Math.cos(angle)) },
      { pigment: f.colour, inner: mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.15), innerReach: 0.42, innerWidth: 0.2, tip: lighten(f.colour, 0.15), opacity: petalOpacity, white },
    );
    // a few fine veins fanning from the gold signal
    if (openK > 0.3) {
      for (let v = 0; v < 4; v++) {
        const va = angle + (v - 1.5) * 0.12;
        const r0 = length * 0.3;
        const r1 = length * rngLen(rng, `vl-${i}-${v}`);
        p.inkLine(
          [
            { x: c.x + Math.cos(va) * r0, y: c.y + Math.sin(va) * r0 },
            { x: c.x + Math.cos(va) * r1, y: c.y + Math.sin(va) * r1 },
          ],
          { rng: rng.fork(`vein-${i}-${v}`), width: 0.3, pigment: f.veins, opacity: 0.45 * smooth((openK - 0.3) / 0.5), breaks: 0, taper: [0.1, 0.7], wobble: 0.15 },
        );
      }
    }
  }
}

const rngLen = (rng: Rng, label: string) => 0.62 + rng.fork(label).next() * 0.2;
const lightnessOf = (p: Pigment) => {
  const n = parseInt(p.slice(1), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
};

const japaneseIris: SpeciesDef = {
  id: 'japanese-iris',
  name: 'Japanese Iris',
  nativeName: 'Hanashōbu',
  tier: 2,
  habitats: ['shore'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Japanese iris — standing straight, speaking softly, by still water.',
  bloomColor: '#7b6ba8',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planJapaneseIris(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 26, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 9 });
      plan.blades.forEach((b, i) => !b.front && drawBlade(p, r.fork(`blade-${i}`), b, g));
      plan.flowers.forEach((f, i) => drawFlower(p, r.fork(`flower-${i}`), f, g));
      plan.blades.forEach((b, i) => b.front && drawBlade(p, r.fork(`blade-${i}`), b, g));
    } finally {
      end();
    }
  },
};

export default japaneseIris;
