import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { fringedBell, mirrorLeaf } from '../lib/iwakagami-paint';
import { rockSeed } from '../lib/iwatabako-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, bendProfile, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Iwakagami ("rock mirror"): a low tuft of round, leathery, glossy leaves with toothed bronze
 * rims, each holding a crisp lifted shine, and a reddish scape that nods at the top with a few
 * rose-pink bells whose mouths break into a fine fringe.
 */

const DOWN = Math.PI / 2;
const LEAF = '#6d7c44';
const LEAF_DEEP = '#3f4c2c';
const BRONZE = '#a8574f';
const SCAPE = '#8c4a54';
const BLOOM = '#e88ca8';
const BLOOM_DEEP = '#c9607f';

interface MirrorLeafPlan {
  /** screen direction of the petiole and the blade */
  angle: number;
  petiole: number;
  length: number;
  width: number;
  curve: number;
  /** direction it points while still folded */
  fold: number;
  window: [number, number];
  tone: Pigment;
  rim: Pigment;
  shine: number;
  teeth: number;
  /** screen depth: higher (further back) leaves are painted first */
  depth: number;
}

interface Bell {
  /** position along the scape (0 base … 1 tip) */
  at: number;
  pedicel: number;
  pedAngle: number;
  bends: number[];
  axis: number;
  length: number;
  width: number;
  lobes: { turn: number; len: number; wid: number; fringe: number[] }[];
  bud: [number, number];
  open: [number, number];
}

interface Scape {
  stem: StemPlan;
  window: [number, number];
  bells: Bell[];
}

export interface IwakagamiPlan {
  leaves: MirrorLeafPlan[];
  scapes: Scape[];
  colour: Pigment;
  pale: Pigment;
  deep: Pigment;
}

/** Room for the leaf in the 70-unit box with its base at the anchor (12.6 below, 32 aside). */
function fitLeaf(angle: number, petiole: number, length: number): number {
  const down = Math.max(0.05, Math.sin(angle));
  const across = Math.max(0.05, Math.abs(Math.cos(angle)));
  const room = Math.min((11 - petiole * down) / down, (31 - petiole * across) / across);
  return Math.min(length, room / 1.1);
}

export function planIwakagami(rng: Rng): IwakagamiPlan {
  const n = rng.int(4, 7);
  const rot = rng.range(0, Math.PI * 2);
  const green = jitter(mix(LEAF, '#3d5a3c', rng.range(0.2, 0.4)), rng, 0.03);
  const old = rng.int(0, n - 1);
  const leaves: MirrorLeafPlan[] = [];
  for (let i = 0; i < n; i++) {
    // round the tuft in the ground plane, foreshortened; leaves lift a little off the rock
    const phi = rot + (i / n) * Math.PI * 2 + rng.gaussian(0, 0.22);
    const lift = rng.range(0.12, 0.45);
    const ax = Math.cos(phi);
    const ay = 0.5 * Math.sin(phi) - lift;
    const angle = Math.atan2(ay, ax);
    const reach = Math.hypot(ax, ay);
    const petiole = rng.range(2.5, 5) * reach;
    const d = rng.range(11, 15) * (i === 0 ? 0.8 : 1);
    // a round blade seen at a slant: its ellipse is squashed vertically
    const fv = 0.5 + 0.55 * lift;
    let length = d * Math.hypot(Math.cos(angle), fv * Math.sin(angle));
    let width = d * Math.hypot(Math.sin(angle), fv * Math.cos(angle));
    const fit = fitLeaf(angle, petiole, length);
    width *= fit / length;
    length = fit;
    const flush = i === old && rng.chance(0.6) ? rng.range(0.4, 0.6) : rng.range(0, 0.14);
    leaves.push({
      angle,
      petiole,
      length,
      width,
      curve: rng.gaussian(0, 0.05),
      fold: lerpAngle(UP, angle, 0.3),
      window: [0, 0],
      tone: jitter(mix(green, BRONZE, flush), rng, 0.025),
      rim: jitter(mix(BRONZE, '#c07a62', rng.range(0, 0.35)), rng, 0.02),
      shine: clampShine(0.35 + (0.45 - lift) * 1.2 + rng.range(-0.15, 0.15)),
      teeth: rng.int(7, 10),
      depth: Math.sin(angle) * (petiole + length * 0.5),
    });
  }
  // the newest leaf (smallest) unfurls last
  leaves.forEach((l, i) => {
    const k = (i + n - 1) % n;
    l.window = [...stagger(k, n, [0.06, 0.56], 0.45)] as [number, number];
  });

  const hue = rng.next();
  const colour = jitter(hue < 0.12 ? mix(BLOOM, PIGMENTS.petalWhite, 0.45) : hue > 0.75 ? mix(BLOOM, BLOOM_DEEP, 0.35) : BLOOM, rng, 0.025);
  const deep = mix(BLOOM_DEEP, colour, 0.35);
  const pale = mix(colour, PIGMENTS.petalWhite, 0.4);

  const side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const ns = n >= 5 && rng.chance(0.35) ? 2 : 1;
  const scapes: Scape[] = [];
  for (let s = 0; s < ns; s++) {
    const sd = s === 0 ? side : -side;
    const length = s === 0 ? rng.range(31, 38) : rng.range(22, 27);
    const stem = makeStem(rng, { base: { x: sd * 0.6, y: -1.5 }, length, angle: UP + sd * rng.range(0.04, 0.16), bend: sd * rng.range(0.35, 0.6), segments: 9, tipBias: 0.8, wobble: 0.02 });
    const window = s === 0 ? ([0.34, 0.7] as [number, number]) : ([0.44, 0.76] as [number, number]);
    const nb = s === 0 ? rng.int(3, 6) : rng.int(2, 3);
    const bells: Bell[] = [];
    for (let j = 0; j < nb; j++) {
      // a one-sided nodding raceme: most bells hang from the arch's outer side
      const out = j % 3 === 1 ? -sd : sd;
      const fan = [-0.24, 0, 0.24];
      bells.push({
        at: 1 - j * rng.range(0.06, 0.09),
        pedicel: rng.range(2, 3.4) * (j === 0 ? 0.75 : 1),
        pedAngle: (out > 0 ? 0 : Math.PI) + out * rng.range(0.1, 0.55),
        bends: bendProfile(rng, 4, out * rng.range(0.9, 1.3), 0.6, 0.03),
        axis: DOWN - out * rng.range(0.1, 0.42),
        length: rng.range(6.2, 7.6),
        width: rng.range(5.4, 6.6),
        lobes: fan.map((t, k) => ({
          turn: t + rng.gaussian(0, 0.05),
          len: (k === 1 ? 1 : 0.86) * rng.range(0.95, 1.05),
          wid: (k === 1 ? 0.56 : 0.46) * rng.range(0.92, 1.08),
          fringe: Array.from({ length: rng.int(5, 7) }, () => rng.range(0.6, 1.3)),
        })),
        bud: [0, 0],
        open: [0, 0],
      });
    }
    // the lowest bell first, the tip last
    bells.forEach((b, j) => {
      const k = nb - 1 - j;
      b.bud = [...stagger(k, nb, [window[0] + 0.14, 0.84], 0.5)] as [number, number];
      b.open = [...stagger(k, nb, [0.74, 1], 0.6)] as [number, number];
    });
    scapes.push({ stem, window, bells });
  }
  return { leaves, scapes, colour, pale, deep };
}

function clampShine(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function drawLeaf(p: Painter, rng: Rng, l: MirrorLeafPlan, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const e = easeOut(k);
  const angle = lerpAngle(l.fold, l.angle, smooth(k));
  const base: Pt = { x: 0, y: -1 };
  const at = { x: base.x + Math.cos(angle) * l.petiole * e, y: base.y + Math.sin(angle) * l.petiole * e };
  if (l.petiole * e > 0.6) {
    p.inkLine([base, at], { rng: rng.fork('petiole'), width: 0.55, pigment: mix(SCAPE, LEAF, 0.4), opacity: 0.7 * smooth(k * 3), breaks: 0, wobble: 0.1, taper: [0.1, 0.2] });
  }
  mirrorLeaf(
    p,
    rng,
    at,
    // young leaves come up rolled and narrow
    { angle, length: l.length * e, width: l.width * e * lerp(0.45, 1, smooth(k)), curve: l.curve },
    {
      pigment: l.tone,
      rim: l.rim,
      deep: mix(LEAF_DEEP, l.tone, 0.45),
      gloss: mix(PIGMENTS.petalWhite, '#e3ecec', 0.45),
      teeth: l.teeth,
      opacity: 0.92 * smooth(k * 6),
      detail: ease(g, lerp(l.window[0], l.window[1], 0.5), l.window[1] + 0.1),
      shine: l.shine,
    },
  );
}

function drawScape(p: Painter, rng: Rng, s: Scape, plan: IwakagamiPlan, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  const pts = stemPoints(s.stem, lerp(0.08, 1, e) * smooth(e * 4), lerp(0.25, 1, e));
  paintStem(p, rng.fork('scape'), pts, { width: 0.7, pigment: SCAPE, opacity: 0.85, ink: 0.22 * e, inkReach: 0.6, inkPigment: mix(SCAPE, PIGMENTS.sumi, 0.3) });
  s.bells.forEach((b, i) => {
    const bud = ease(g, b.bud[0], b.bud[1]);
    if (!visible(bud)) return;
    const open = smooth(ease(g, b.open[0], b.open[1]));
    const from = pointAt(pts, b.at);
    const ped: StemPlan = { base: { x: from.x, y: from.y }, length: b.pedicel, angle: b.pedAngle, bends: b.bends };
    const pp = stemPoints(ped, lerp(0.2, 1, bud), lerp(0.3, 1, bud));
    const end = pointAt(pp, 1);
    p.inkLine(pp, { rng: rng.fork(`ped-${i}`), width: 0.4, pigment: SCAPE, opacity: 0.8 * smooth(bud * 3), breaks: 0, wobble: 0.08, taper: [0.05, 0.25] });
    fringedBell(p, rng.fork(`bell-${i}`), end, {
      axis: lerpAngle(end.angle, b.axis, lerp(0.5, 1, bud)),
      length: b.length,
      width: b.width,
      bud,
      open,
      colour: ease(g, b.bud[0] + 0.05, b.open[0] + 0.05),
      pigment: plan.colour,
      deep: plan.deep,
      pale: plan.pale,
      green: mix(PIGMENTS.sage, SCAPE, 0.45),
      calyx: mix(SCAPE, PIGMENTS.sage, 0.3),
      lobes: b.lobes,
    });
  });
}

const iwakagami: SpeciesDef = {
  id: 'iwakagami',
  name: 'Rock Mirror',
  nativeName: 'Iwakagami',
  // wild only: no `cultivatedIn`, so the Japanese garden does not offer it
  range: { realms: ['japan'], biomes: ['wet-cliff', 'temperate-forest', 'alpine'], climates: ['cool-temperate', 'alpine'] },
  tier: 1,
  habitats: ['rock', 'path'],
  sizeClass: 'small',
  // drawn in the 70-unit design box; the base sits a little high so front leaves lie toward us
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.82 },
  description: 'Iwakagami — a rock mirror, holding up its small pink bells.',
  bloomColor: '#e88ca8',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planIwakagami(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 15, k: ease(g, 0.08, 0.6), opacity: 0.12 });
      rockSeed(p, r, g, 6);
      const order = plan.leaves.map((l, i) => [l, i] as const).sort((a, b) => a[0].depth - b[0].depth);
      for (const [l, i] of order) if (l.depth < 0) drawLeaf(p, r.fork(`leaf-${i}`), l, g);
      plan.scapes.forEach((s, i) => drawScape(p, r.fork(`scape-${i}`), s, plan, g));
      for (const [l, i] of order) if (l.depth >= 0) drawLeaf(p, r.fork(`leaf-${i}`), l, g);
    } finally {
      end();
    }
  },
};

export default iwakagami;
