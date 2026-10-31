import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, phase, smooth, stagger, visible } from '../lib/small-growth';
import { bloom, dabAxis, groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, add, makeStem, petalRing, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Cosmos (kosumosu, "autumn cherry"): tall, airy stems with leaves split into fine threads,
 * swaying flowers of eight broad, softly notched petals in pink, blush or white around a gold
 * button — some facing up, some turned to the side, a bud or two still closed.
 */

interface Thread {
  t: number;
  side: number;
  length: number;
  fan: number[];
}

interface Head {
  /** stem index this head sits on: −1 = main stem, else branch index */
  branch: number;
  petals: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  bud: [number, number];
  open: [number, number];
}

interface Branch {
  t: number;
  stem: StemPlan;
}

interface Stem {
  stem: StemPlan;
  window: [number, number];
  threads: Thread[];
  branches: Branch[];
  heads: Head[];
}

export interface CosmosPlan {
  stems: Stem[];
  colour: Pigment;
  ring: Pigment;
  green: Pigment;
}

const VARIETIES = [
  { colour: PIGMENTS.sakura, ring: mix(PIGMENTS.sakura, '#bf3f6c', 0.45) },
  { colour: mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.35), ring: PIGMENTS.sakura },
  { colour: PIGMENTS.petalWhite, ring: mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.4) },
  { colour: mix(PIGMENTS.sakura, '#bf3f6c', 0.22), ring: mix('#bf3f6c', PIGMENTS.sakura, 0.3) },
];

export function planCosmos(rng: Rng): CosmosPlan {
  const lean = rng.range(-0.15, 0.15);
  const green = jitter(mix(PIGMENTS.sap, PIGMENTS.sage, 0.5), rng, 0.03);
  const v = VARIETIES[rng.int(0, VARIETIES.length - 1)]!;
  const ns = rng.int(2, 3);
  const flip = rng.chance(0.5) ? 1 : -1;
  const stems: Stem[] = [];
  const all: Head[] = [];
  for (let s = 0; s < ns; s++) {
    const side = (s % 2 === 0 ? 1 : -1) * flip;
    const stem = makeStem(rng, {
      base: { x: side * rng.range(0, 6), y: 0 },
      length: rng.range(100, 135) * (s === 0 ? 1 : rng.range(0.72, 0.9)),
      angle: UP + lean + side * rng.range(0.04, 0.16) * (1 + s * 0.7),
      bend: -side * rng.range(0.05, 0.3),
      segments: 12,
      tipBias: 0.5,
    });
    const threads: Thread[] = [];
    const nt = rng.int(5, 7);
    for (let i = 0; i < nt; i++) {
      const fan: number[] = [];
      const nf = rng.int(4, 6);
      for (let j = 0; j < nf; j++) fan.push((j / (nf - 1) - 0.5) * rng.range(1.4, 2) + rng.gaussian(0, 0.08));
      threads.push({ t: 0.12 + (0.6 * i) / (nt - 1) + rng.gaussian(0, 0.02), side: i % 2 === 0 ? 1 : -1, length: rng.range(13, 19) * (1 - (i / nt) * 0.4), fan });
    }
    const nb = rng.int(0, 2);
    const branches: Branch[] = [];
    for (let b = 0; b < nb; b++) {
      const bs = b % 2 === 0 ? -side : side;
      branches.push({ t: rng.range(0.5, 0.75), stem: makeStem(rng, { length: rng.range(30, 46), angle: bs * rng.range(0.5, 0.85), bend: -bs * rng.range(0.25, 0.5), segments: 7 }) });
    }
    const heads: Head[] = [-1, ...branches.map((_, i) => i)].map((branch) => {
      const h: Head = {
        branch,
        petals: petalRing(rng, 8, { angJit: 0.07, lenJit: 0.07, widJit: 0.08, curve: 0.08 }),
        size: rng.range(10, 13) * (branch < 0 ? 1 : 0.88),
        tilt: rng.range(0.4, 0.95),
        roll: UP + rng.range(-0.7, 0.7),
        bud: [0, 0],
        open: [0, 0],
      };
      all.push(h);
      return h;
    });
    stems.push({ stem, window: [...stagger(s, ns, [0.08, 0.55], 0.7)] as [number, number], threads, branches, heads });
  }
  const n = all.length;
  rng.shuffle(all.map((_, i) => i)).forEach((hi, k) => {
    all[hi]!.bud = [...stagger(k, n, [0.44, 0.78], 0.55)] as [number, number];
    all[hi]!.open = [...stagger(k, n, [0.75, 1], 0.62)] as [number, number];
  });
  return { stems, colour: jitter(v.colour, rng, 0.025), ring: v.ring, green };
}

/** A thread-leaf: a fan of very fine segments merged in one wet layer. */
function threadLeaf(p: Painter, rng: Rng, at: Pt, angle: number, t: Thread, k: number, green: Pigment) {
  const L0 = t.length * easeOut(k);
  if (L0 < 0.8) return;
  const L = p.layer({ x: at.x - L0 * 1.3, y: at.y - L0 * 1.3, w: L0 * 2.6, h: L0 * 2.6 });
  // a feathery leaf: an arching rib with pairs of fine threads along it
  const curve = t.side * 0.25;
  p.dabInto(L, at, green, { rng: rng.fork('rib'), variant: 'needle', angle, length: L0, width: 0.7, curve, pool: 0.2, basePool: 0.2, layers: 2 });
  const axis = dabAxis(at, angle, L0, curve, 12);
  t.fan.forEach((f, j) => {
    const q = axis[Math.min(11, 2 + Math.round((j / t.fan.length) * 9))]!;
    const q2 = axis[Math.min(12, 3 + Math.round((j / t.fan.length) * 9))]!;
    const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
    const len = L0 * 0.46 * (1 - (j / t.fan.length) * 0.5) * (0.85 + Math.abs(f) * 0.1);
    for (const sgn of [-1, 1]) {
      p.dabInto(L, q, green, { rng: rng.fork(`thr-${j}-${sgn}`), variant: 'needle', angle: ta + sgn * lerp(0.2, 0.75, k), length: len, width: 0.55, curve: sgn * 0.2, pool: 0.1, basePool: 0.1, layers: 2 });
    }
  });
  L.dry({ opacity: 0.7 * smooth(L0 / 4), edge: 0.3, edgeWidth: 0.22, sharpness: 0.65, centreLift: 0.1, granulation: 0.05, flow: 0.3, flowScale: 4 });
}

function drawHead(p: Painter, rng: Rng, h: Head, tip: { x: number; y: number; angle: number }, plan: CosmosPlan, g: number) {
  const budK = ease(g, h.bud[0], h.bud[1]);
  if (!visible(budK)) return;
  const openK = smooth(ease(g, h.open[0], h.open[1]));
  const c: Pt = { x: tip.x, y: tip.y };
  const white = lightOf(plan.colour) > 0.85;
  bloom(p, rng.fork('flower'), c, {
    petals: h.petals,
    view: { tilt: lerp(0.35, h.tilt, openK), roll: h.roll },
    budK,
    openK,
    budAngle: tip.angle,
    budLen: 5.5,
    budWidth: 4.6,
    colourK: 0.3 * ease(g, h.bud[1] - 0.1, h.open[0] + 0.05),
    size: h.size,
    width: 0.5,
    closedLen: 0.5,
    sepals: 3,
    green: PIGMENTS.sage,
    style: { pigment: plan.colour, inner: plan.ring, innerReach: 0.22, innerWidth: 0.45, tip: lighten(plan.colour, 0.35), opacity: 0.88, white },
  });
  if (!visible(openK)) return;
  // the gold button with a darker ring of florets
  const r = h.size * 0.17 * openK;
  p.dab(c, mix(PIGMENTS.gold, PIGMENTS.vermilion, 0.1), { rng: rng.fork('ring'), variant: 'round', angle: h.roll, length: r * 2.3, width: r * 2.1, opacity: 0.85 * openK, edge: 0.6, blend: 'source-over' });
  p.dab(add(c, h.roll, r * 0.15), lighten(PIGMENTS.gold, 0.25), { rng: rng.fork('button'), variant: 'round', angle: h.roll, length: r * 1.4, width: r * 1.3, opacity: 0.9 * openK, edge: 0.3, blend: 'source-over', granulation: 0.4 });
}

const lightOf = (p: Pigment) => {
  const n = parseInt(p.slice(1), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
};

function drawStem(p: Painter, rng: Rng, s: Stem, plan: CosmosPlan, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  // tall stems straighten as they grow; heads sway a little once heavy
  const pts = stemPoints(s.stem, e, lerp(0.4, 1, ease(g, 0.5, 0.9)));
  paintStem(p, rng.fork('stem'), pts, { width: 0.95, opacity: 0.78, ink: 0.25, inkReach: 0.7, pigment: mix(PIGMENTS.sage, PIGMENTS.sakura, 0.08) });
  s.threads.forEach((t, i) => {
    const k = smooth(phase(e, t.t + 0.03, t.t + 0.3));
    if (!visible(k)) return;
    const at = pointAt(pts, t.t);
    threadLeaf(p, rng.fork(`thread-${i}`), at, at.angle + t.side * 0.9, t, k, jitter(plan.green, rng.fork(`tt-${i}`), 0.03));
  });
  const tips: { x: number; y: number; angle: number }[] = [pointAt(pts, 1)];
  s.branches.forEach((b, i) => {
    const k = smooth(phase(e, b.t + 0.05, b.t + 0.45));
    if (!visible(k)) {
      tips.push({ ...pointAt(pts, b.t) });
      return;
    }
    const at = pointAt(pts, b.t);
    const bpts = stemPoints({ ...b.stem, base: { x: at.x, y: at.y }, angle: at.angle + b.stem.angle }, k, 1);
    paintStem(p, rng.fork(`branch-${i}`), bpts, { width: 0.7, opacity: 0.75, pigment: mix(PIGMENTS.sage, PIGMENTS.sakura, 0.08) });
    tips.push(pointAt(bpts, 1));
  });
  s.heads.forEach((h, i) => drawHead(p, rng.fork(`head-${i}`), h, tips[h.branch + 1]!, plan, g));
}

const cosmos: SpeciesDef = {
  id: 'cosmos',
  name: 'Cosmos',
  nativeName: 'Kosumosu',
  // Mexican highland grassland
  range: { realms: ['neotropics'], biomes: ['grassland'], climates: ['tropical-montane'], cultivatedIn: ['japan'] },
  tier: 2,
  habitats: ['meadow', 'back'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Cosmos — autumn’s cherry blossom, nodding in every wind.',
  bloomColor: '#f4a0a4',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planCosmos(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 20, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 9 });
      plan.stems.forEach((s, i) => drawStem(p, r.fork(`stem-${i}`), s, plan, g));

    } finally {
      end();
    }
  },
};

export default cosmos;
