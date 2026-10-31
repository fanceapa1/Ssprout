import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { antherCones, puckeredLeaf, rockSeed, starFloret } from '../lib/iwatabako-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, add, bendProfile, lerpAngle, makeStem, petalRing, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Iwatabako (rock tobacco): one to three big puckered, toothed, glossy leaves pressed to wet rock
 * and hanging down it like tongues, and a thin red-brown scape arching out with a loose umbel
 * of small violet-pink stars on threads, each with a yellow anther cone.
 */

const DOWN = Math.PI / 2;
const LEAF = '#7f9a4e';
const LEAF_SHADE = '#5e7140';
const SCAPE = '#7a4a52';
const BLOOM = '#9468b0';
const PALE = '#b897c8';

interface RockLeaf {
  angle: number;
  length: number;
  width: number;
  curve: number;
  petiole: number;
  fold: number;
  window: [number, number];
  tone: Pigment;
}

interface Floret {
  /** pedicel direction relative to the scape's tip */
  offset: number;
  length: number;
  bends: number[];
  petals: PetalPlan[];
  tilt: number;
  size: number;
  bud: [number, number];
  open: [number, number];
}

interface Scape {
  stem: StemPlan;
  window: [number, number];
  florets: Floret[];
}

export interface IwatabakoPlan {
  leaves: RockLeaf[];
  scapes: Scape[];
  colour: Pigment;
  pale: Pigment;
  inner: Pigment;
  side: 1 | -1;
}

/** The leaf's lowest and outermost reach, so a tongue never leaves the sprite box. */
function fitLeaf(angle: number, petiole: number, width: number, length: number): number {
  const down = Math.max(0.05, Math.sin(angle));
  const across = Math.max(0.05, Math.abs(Math.cos(angle)));
  // the dab's length jitters up to 8 % and its round tip reaches a little past the axis
  const room = Math.min((30 - width * 0.12) / down, (31 - width * 0.5 * down) / across);
  return Math.min(length, (room - petiole) / 1.08);
}

export function planIwatabako(rng: Rng): IwatabakoPlan {
  const side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const pick = rng.next();
  const n = pick < 0.15 ? 1 : pick < 0.6 ? 2 : 3;
  const green = jitter(mix(mix(LEAF, LEAF_SHADE, rng.range(0.6, 0.9)), '#3d5a3e', 0.15), rng, 0.03);
  const leaves: RockLeaf[] = [];
  // the big tongue hangs almost straight down; the others splay out to the sides
  const spreads = [rng.range(0.08, 0.35) * side, -side * rng.range(0.7, 1.05), side * rng.range(1.0, 1.35)];
  const lengths = [rng.range(28, 33), rng.range(16, 21), rng.range(11, 14)];
  for (let i = 0; i < n; i++) {
    const angle = DOWN + spreads[i]! + rng.gaussian(0, 0.05);
    const ratio = rng.range(0.64, 0.74);
    const petiole = rng.range(1.5, 3);
    const length = fitLeaf(angle, petiole, lengths[i]! * ratio, lengths[i]!);
    leaves.push({
      angle,
      length,
      width: length * ratio,
      curve: rng.gaussian(0, 0.08) - Math.sign(spreads[i]!) * 0.08,
      petiole,
      fold: angle + Math.sign(spreads[i]!) * rng.range(0.7, 0.95),
      window: [...stagger(i, 3, [0.07, 0.56], 0.62)] as [number, number],
      tone: jitter(green, rng, 0.03),
    });
  }

  const hue = rng.next();
  const colour = jitter(hue < 0.3 ? mix(BLOOM, PIGMENTS.rose, 0.18) : hue > 0.8 ? mix(BLOOM, PALE, 0.35) : BLOOM, rng, 0.025);
  const pale = mix(PALE, colour, 0.25);
  const inner = mix(colour, '#6b3f86', 0.3);

  const ns = n >= 2 && rng.chance(0.45) ? 2 : 1;
  const scapes: Scape[] = [];
  for (let s = 0; s < ns; s++) {
    // the scape arches away over the leaves, then nods
    const sd = s === 0 ? -side : side;
    const length = s === 0 ? rng.range(19, 24) : rng.range(14, 18);
    const stem = makeStem(rng, { base: { x: sd * 0.8, y: -1.2 }, length, angle: UP + sd * rng.range(0.22, 0.45), bend: sd * rng.range(1.0, 1.4), segments: 9, tipBias: 0.55, wobble: 0.025 });
    const window = s === 0 ? ([0.32, 0.66] as [number, number]) : ([0.42, 0.72] as [number, number]);
    const nf = s === 0 ? rng.int(6, 10) : rng.int(4, 6);
    const florets: Floret[] = [];
    for (let i = 0; i < nf; i++) {
      const u = nf === 1 ? 0 : i / (nf - 1) - 0.5;
      florets.push({
        offset: u * 3.3 + rng.gaussian(0, 0.14),
        length: rng.range(6, 11) * (1 - Math.abs(u) * 0.3),
        bends: bendProfile(rng, 4, rng.range(0.25, 0.6), 0.6, 0.03),
        petals: petalRing(rng, 5, { angJit: 0.1, lenJit: 0.08, widJit: 0.08, curve: 0.06 }),
        tilt: rng.range(0.55, 0.95),
        size: rng.range(3.1, 3.8),
        bud: [0, 0],
        open: [0, 0],
      });
    }
    // buds and stars come out in no fixed order round the umbel
    const order = rng.shuffle(florets.map((_, i) => i));
    order.forEach((fi, k) => {
      florets[fi]!.bud = [...stagger(k, nf, [window[0] + 0.16, 0.84], 0.5)] as [number, number];
      florets[fi]!.open = [...stagger(k, nf, [0.75, 1], 0.55)] as [number, number];
    });
    scapes.push({ stem, window, florets });
  }
  return { leaves, scapes, colour, pale, inner, side };
}

function drawLeaf(p: Painter, rng: Rng, l: RockLeaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const e = easeOut(k);
  const angle = lerpAngle(l.fold, l.angle, smooth(k));
  const at = add({ x: 0, y: -1 }, angle, l.petiole * e);
  puckeredLeaf(
    p,
    rng,
    at,
    { angle, length: l.length * e, width: l.width * e * lerp(0.4, 1, smooth(k)), curve: l.curve * lerp(0.3, 1, k) },
    {
      pigment: l.tone,
      deep: mix(LEAF_SHADE, PIGMENTS.sumi, 0.5),
      gloss: mix(PIGMENTS.petalWhite, '#dfe9d2', 0.5),
      teeth: 11,
      veins: 6,
      opacity: 0.9 * smooth(k * 6),
      detail: ease(g, lerp(l.window[0], l.window[1], 0.4), l.window[1] + 0.08),
    },
  );
}

function drawScape(p: Painter, rng: Rng, s: Scape, plan: IwatabakoPlan, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  const pts = stemPoints(s.stem, lerp(0.08, 1, e) * smooth(e * 4), lerp(0.2, 1, e));
  paintStem(p, rng.fork('scape'), pts, { width: 0.7, pigment: SCAPE, opacity: 0.85, ink: 0.35 * e, inkReach: 0.9, inkPigment: mix(SCAPE, PIGMENTS.sumi, 0.4) });
  const tip = pointAt(pts, 1);
  const cones: { id: number; c: Pt; size: number; open: number; roll: number; tilt: number }[] = [];
  const heads: { f: Floret; i: number; end: Pt; dir: number; bud: number; open: number }[] = [];
  s.florets.forEach((f, i) => {
    const bud = ease(g, f.bud[0], f.bud[1]);
    if (!visible(bud)) return;
    const open = smooth(ease(g, f.open[0], f.open[1]));
    const angle = tip.angle + f.offset * lerp(0.3, 1, bud);
    // pedicels droop under the flowers' weight
    const droop = Math.cos(angle) >= 0 ? 1 : -1;
    const ped: StemPlan = { base: { x: tip.x, y: tip.y }, length: f.length, angle, bends: f.bends.map((b) => b * droop) };
    const pp = stemPoints(ped, lerp(0.15, 1, bud), lerp(0.3, 1, open));
    const end = pointAt(pp, 1);
    p.inkLine(pp, { rng: rng.fork(`ped-${i}`), width: 0.32, pigment: mix(SCAPE, PIGMENTS.sage, 0.15), opacity: 0.75 * smooth(bud * 3), breaks: 0, wobble: 0.08, taper: [0.05, 0.2] });
    heads.push({ f, i, end, dir: end.angle, bud, open });
  });
  // nearer-facing stars last, so they glaze over the ones behind
  heads.sort((a, b) => a.f.tilt - b.f.tilt);
  for (const h of heads) {
    const roll = h.dir + h.f.offset * 0.2;
    starFloret(p, rng.fork(`fl-${h.i}`), h.end, {
      petals: h.f.petals,
      view: { tilt: lerp(0.3, h.f.tilt, h.open), roll },
      open: h.open,
      bud: h.bud,
      size: h.f.size,
      budAngle: h.dir,
      colour: ease(g, h.f.bud[0] + 0.08, h.f.open[0] + 0.04),
      pigment: plan.colour,
      pale: plan.pale,
      inner: plan.inner,
      green: mix(PIGMENTS.sage, SCAPE, 0.3),
    });
    cones.push({ id: h.i, c: h.end, size: h.f.size, open: h.open, roll, tilt: h.f.tilt });
  }
  antherCones(p, rng.fork('cones'), cones);
}

const iwatabako: SpeciesDef = {
  id: 'iwatabako',
  name: 'Rock Tobacco',
  nativeName: 'Iwatabako',
  // wild only: no `cultivatedIn`, so the Japanese garden does not offer it
  range: { realms: ['japan'], biomes: ['wet-cliff', 'montane-stream'], climates: ['cool-temperate', 'warm-temperate'] },
  tier: 1,
  habitats: ['rock', 'path'],
  sizeClass: 'small',
  // drawn in the 70-unit design box; the base sits high so the leaves can hang below it
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.5 },
  description: 'Rock tobacco — small violet stars where the spray never dries.',
  bloomColor: '#9468b0',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planIwatabako(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 9, k: ease(g, 0.08, 0.6), opacity: 0.08 });
      rockSeed(p, r, g, 6);
      plan.leaves.forEach((l, i) => drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.scapes.forEach((s, i) => drawScape(p, r.fork(`scape-${i}`), s, plan, g));
    } finally {
      end();
    }
  },
};

export default iwatabako;
