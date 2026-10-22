import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, phase, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintPetal, paintStem, plantFrame, seedMound, toothedLeaf } from '../lib/small-paint';
import { UP, add, makeStem, petalPose, petalRing, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Balloon flower (kikyō): upright stems set with toothed, oval leaves, and buds that swell
 * into round, five-seamed balloons before splitting open into wide blue-violet stars with fine
 * dark veins and a pale centre. The topmost balloons are still closed when the rest bloom.
 */

interface Leaf {
  t: number;
  side: number;
  length: number;
  width: number;
  curve: number;
}

interface Head {
  /** position along the stem (1 = the tip); side branches hang from the axils */
  t: number;
  side: number;
  pedicel: number;
  petals: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  bud: [number, number];
  /** null = still a balloon at full growth */
  open: [number, number] | null;
}

interface Stem {
  stem: StemPlan;
  window: [number, number];
  leaves: Leaf[];
  heads: Head[];
}

export interface BalloonPlan {
  stems: Stem[];
  colour: Pigment;
  green: Pigment;
}

export function planBalloonFlower(rng: Rng): BalloonPlan {
  const lean = rng.range(-0.12, 0.12);
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.olive, 0.25), rng, 0.03);
  const colour = jitter(mix(PIGMENTS.bellflower, PIGMENTS.irisLight, rng.range(0.2, 0.55)), rng, 0.025);
  const ns = rng.int(2, 3);
  const stems: Stem[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  const totalHeads: Head[] = [];
  for (let s = 0; s < ns; s++) {
    const side = (s % 2 === 0 ? 1 : -1) * flip;
    const stem = makeStem(rng, {
      base: { x: side * rng.range(2, 8), y: 0 },
      length: rng.range(85, 115) * (s === 0 ? 1 : rng.range(0.72, 0.9)),
      angle: UP + lean + side * rng.range(0.1, 0.22) * (1 + s * 0.6),
      bend: -side * rng.range(0, 0.18),
      segments: 10,
    });
    const nl = rng.int(6, 9);
    const leaves: Leaf[] = [];
    for (let i = 0; i < nl; i++) {
      const t = 0.1 + (0.68 * i) / (nl - 1) + rng.gaussian(0, 0.015);
      leaves.push({ t, side: i % 2 === 0 ? 1 : -1, length: rng.range(11, 15) * (1 - t * 0.45), width: rng.range(5, 6.5) * (1 - t * 0.4), curve: rng.gaussian(0, 0.1) });
    }
    const nh = rng.int(2, 4);
    const heads: Head[] = [];
    for (let i = 0; i < nh; i++) {
      const top = i === 0;
      const h: Head = {
        t: top ? 1 : 0.9 - i * 0.11,
        side: i % 2 === 0 ? 1 : -1,
        pedicel: top ? 0 : rng.range(9, 15),
        petals: petalRing(rng, 5, { angJit: 0.07, lenJit: 0.06, widJit: 0.06, curve: 0.06 }),
        size: rng.range(10, 12.5) * (top ? 1 : 0.92),
        tilt: rng.range(0.55, 0.9),
        roll: UP + rng.range(-0.6, 0.6),
        bud: [0, 0],
        open: null,
      };
      heads.push(h);
      totalHeads.push(h);
    }
    stems.push({ stem, window: [...stagger(s, ns, [0.08, 0.5], 0.75)] as [number, number], leaves, heads });
  }
  // buds swell one after another; all but one or two of them open (lowest first)
  const n = totalHeads.length;
  const keep = Math.min(n - 1, rng.int(1, 2));
  // lower buds open first; the topmost stay balloons the longest
  const opening = totalHeads.map((_, i) => i).sort((a, b) => totalHeads[a]!.t - totalHeads[b]!.t || a - b);
  opening.forEach((hi, k) => {
    const h = totalHeads[hi]!;
    h.bud = [...stagger(k, n, [0.42, 0.78], 0.55)] as [number, number];
    h.open = k < n - keep ? ([...stagger(k, n - keep, [0.75, 1], 0.6)] as [number, number]) : null;
  });
  return { stems, colour, green };
}

/** A balloon bud: round, slightly pointed, with five faint seams drawn from the tip. */
function balloon(p: Painter, rng: Rng, at: Pt, angle: number, size: number, colour: Pigment, opacity: number) {
  if (size < 0.4) return;
  const tip = add(at, angle, size * 1.05);
  p.dab(at, colour, { rng: rng.fork('body'), variant: 'round', angle, length: size * 1.1, width: size * 0.95, pool: 0.55, basePool: 0.45, opacity, edge: 0.55 });
  p.dab(add(at, angle, size * 0.15), lighten(colour, 0.45), { rng: rng.fork('light'), variant: 'round', angle, length: size * 0.6, width: size * 0.38, pool: 0, basePool: 0, opacity: opacity * 0.5, edge: 0.1, blend: 'source-over' });
  if (size > 2.5) {
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * size * 0.28;
      const mid = add(add(at, angle, size * 0.55), angle + Math.PI / 2, off * 1.2);
      p.inkLine([add(at, angle + Math.PI / 2, off * 0.5), mid, tip], {
        rng: rng.fork(`seam-${i}`),
        width: 0.28,
        pigment: shade(colour, 0.5),
        opacity: 0.35 * opacity * smooth((size - 2.5) / 2),
        breaks: 0,
        wobble: 0.1,
        taper: [0.2, 0.4],
      });
    }
  }
}

function drawHead(p: Painter, rng: Rng, h: Head, at: Pt, stemAngle: number, plan: BalloonPlan, g: number) {
  const budK = ease(g, h.bud[0], h.bud[1]);
  if (!visible(budK)) return;
  let c = at;
  let budAngle = stemAngle;
  if (h.pedicel > 0) {
    const a = stemAngle + h.side * 0.8;
    const end = add(at, a, h.pedicel * easeOut(budK));
    paintStem(p, rng.fork('pedicel'), [at, add(at, a + h.side * -0.2, h.pedicel * 0.5 * easeOut(budK)), end], { width: 0.7, opacity: 0.7 });
    c = end;
    budAngle = a - h.side * 0.5;
  }
  const openK = h.open ? smooth(ease(g, h.open[0], h.open[1])) : 0;
  const colourK = ease(g, h.bud[0] + 0.08, h.bud[1] + 0.02);
  const fade = 1 - smooth(openK / 0.5);
  const bsize = h.size * 0.66 * easeOut(budK) * lerp(1, 1.15, openK);
  if (visible(fade)) balloon(p, rng.fork('balloon'), c, budAngle, bsize, mix(PIGMENTS.sageLight, plan.colour, colourK * 0.95), 0.88 * fade);
  if (!visible(openK)) return;
  // the star opens from the balloon: five broad pointed petals, veined, around a pale heart
  const view = { tilt: h.tilt, roll: h.roll };
  const order = h.petals.map((pl, i) => ({ pl, i, pose: petalPose(pl.a, view, openK, 0.55) })).sort((a, b) => a.pose.depth - b.pose.depth);
  const op = 0.88 * smooth(openK / 0.35);
  for (const { pl, i, pose } of order) {
    const length = h.size * pl.len * pose.len;
    const width = h.size * 0.72 * pl.wid * lerp(0.6, 1, openK);
    paintPetal(p, rng.fork(`petal-${i}`), c, { angle: pose.angle, length, width, curve: pl.curve }, { pigment: plan.colour, inner: lighten(plan.colour, 0.55), innerReach: 0.4, variant: 'leaf', opacity: op * 0.9 });
    if (openK > 0.3) {
      p.inkLine([add(c, pose.angle, length * 0.2), add(add(c, pose.angle, length * 0.6), pose.angle + Math.PI / 2, length * pl.curve * 0.3), add(c, pose.angle, length * 0.85)], {
        rng: rng.fork(`vein-${i}`),
        width: 0.3,
        pigment: shade(plan.colour, 0.55),
        opacity: 0.45 * smooth((openK - 0.3) / 0.5),
        breaks: 0,
        wobble: 0.1,
        taper: [0.1, 0.6],
      });
    }
  }
  // pale style with a five-part stigma
  p.dab(c, mix(PIGMENTS.petalWhite, PIGMENTS.sageLight, 0.3), { rng: rng.fork('style'), variant: 'round', angle: h.roll, length: h.size * 0.22 * openK, width: h.size * 0.2 * openK, opacity: 0.9 * openK, blend: 'source-over', edge: 0.3 });
}

function drawStem(p: Painter, rng: Rng, s: Stem, plan: BalloonPlan, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  const pts = stemPoints(s.stem, e, 1);
  paintStem(p, rng.fork('stem'), pts, { width: 1.1, opacity: 0.8, ink: 0.3, inkReach: 0.6 });
  s.leaves.forEach((l, i) => {
    const k = smooth(phase(e, l.t + 0.04, l.t + 0.35));
    if (!visible(k)) return;
    const at = pointAt(pts, l.t);
    const angle = at.angle + l.side * lerp(0.2, 0.95, k);
    toothedLeaf(p, rng.fork(`leaf-${i}`), at, { angle, length: l.length * easeOut(k), width: l.width * lerp(0.4, 1, k), curve: l.curve - l.side * 0.15 }, { pigment: jitter(plan.green, rng.fork(`lt-${i}`), 0.03), teeth: 0, vein: 0.25 * k, opacity: 0.8 });
  });
  for (const [i, h] of s.heads.entries()) {
    const at = pointAt(pts, h.t);
    drawHead(p, rng.fork(`head-${i}`), h, at, at.angle, plan, g);
  }
}

const balloonFlower: SpeciesDef = {
  id: 'balloon-flower',
  name: 'Balloon Flower',
  nativeName: 'Kikyō',
  tier: 2,
  habitats: ['meadow', 'path'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Balloon flower — a held breath, then a blue star.',
  bloomColor: '#7a82cc',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planBalloonFlower(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 22, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 9 });
      plan.stems.forEach((s, i) => drawStem(p, r.fork(`stem-${i}`), s, plan, g));
    } finally {
      end();
    }
  },
};

export default balloonFlower;
