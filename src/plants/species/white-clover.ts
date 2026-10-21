import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment } from '../../paint';
import { ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintPetal, paintStem, petalFlower, plantFrame, seedMound } from '../lib/small-paint';
import { UP, arc, makeStem, pointAt, stemPoints, type PetalPlan, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * White clover (shirotsumekusa): a low spread of three-part leaves with pale chevrons, held
 * flat and seen from the side, and a few round heads of tiny white florets on bare stalks —
 * the oldest florets at the bottom of each head turning down and blush brown.
 */

interface CloverLeaf {
  stem: StemPlan;
  leaflets: PetalPlan[];
  size: number;
  tilt: number;
  roll: number;
  window: [number, number];
  tone: Pigment;
  front: boolean;
}

interface Floret {
  a: number;
  /** −1 (bottom) … 1 (top) of the head */
  h: number;
  len: number;
  tone: number;
}

interface CloverHead {
  stem: StemPlan;
  florets: Floret[];
  radius: number;
  bud: [number, number];
  open: [number, number];
}

export interface CloverPlan {
  leaves: CloverLeaf[];
  heads: CloverHead[];
  spread: number;
}

const FLORET = '#fbf8f0';
const OLD = mix(PIGMENTS.sakuraLight, PIGMENTS.woodLight, 0.55);

export function planWhiteClover(rng: Rng): CloverPlan {
  const lean = rng.range(-0.15, 0.15);
  const n = rng.int(5, 9);
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.sap, 0.45), rng, 0.03);
  const leaves: CloverLeaf[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const a = UP + lean * 0.5 + u * 2.4 + rng.gaussian(0, 0.25);
    leaves.push({
      stem: makeStem(rng, { base: { x: u * rng.range(10, 20), y: rng.range(-1, 0.5) }, length: rng.range(9, 19) * (1 - Math.abs(u) * 0.35), angle: a, bend: -Math.sign(u || 1) * rng.range(0.25, 0.8), segments: 6, tipBias: 0.6 }),
      leaflets: [UP, UP + 2.15, UP - 2.15].map((b, j) => ({
        a: b + rng.gaussian(0, 0.12),
        len: 1 + rng.gaussian(0, 0.08) - (j === 0 ? 0 : 0.05),
        wid: 1 + rng.gaussian(0, 0.07),
        curve: rng.gaussian(0, 0.06),
        tone: rng.next(),
      })),
      size: rng.range(5.5, 7.5),
      tilt: rng.range(0.38, 0.75),
      roll: UP + rng.gaussian(0, 0.25) + u * 0.3,
      window: [0, 0],
      tone: jitter(green, rng, 0.035),
      front: rng.chance(0.35),
    });
  }
  rng.shuffle(leaves.map((_, i) => i)).forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, n, [0.06, 0.5], 0.4)] as [number, number];
  });

  const nh = rng.int(1, 3);
  const heads: CloverHead[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nh; i++) {
    const side = (i % 2 === 0 ? 1 : -1) * flip;
    const florets: Floret[] = [];
    const nf = rng.int(22, 30);
    for (let j = 0; j < nf; j++) {
      const h = 1 - (2 * (j + 0.5)) / nf;
      florets.push({ a: rng.range(0, Math.PI * 2), h: h + rng.gaussian(0, 0.05), len: rng.range(0.85, 1.15), tone: rng.next() });
    }
    heads.push({
      stem: makeStem(rng, { base: { x: side * rng.range(0, 8) * (i === 0 ? 0.3 : 1), y: 0 }, length: rng.range(24, 34) * (i === 0 ? 1 : rng.range(0.62, 0.82)), angle: UP + lean + side * rng.range(0.12, 0.3) * (i === 0 ? 0.6 : 1.5), bend: -side * rng.range(0.05, 0.3), segments: 8, tipBias: 0.5 }),
      florets,
      radius: rng.range(4.2, 5.2),
      bud: [...stagger(i, nh, [0.44, 0.78], 0.6)] as [number, number],
      open: [...stagger(i, nh, [0.74, 1], 0.7)] as [number, number],
    });
  }
  return { leaves, heads, spread: 18 + n * 1.2 };
}

function drawLeaf(p: Painter, rng: Rng, l: CloverLeaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  // a creeping runner along the ground to leaves that root away from the crown
  if (Math.abs(l.stem.base.x) > 3) {
    const run = smooth(k * 2.5);
    paintStem(p, rng.fork('runner'), arc({ x: 0, y: 0 }, { x: l.stem.base.x * run, y: l.stem.base.y * run }, 0.06 * Math.sign(l.stem.base.x), 5), {
      width: 0.45,
      opacity: 0.45,
      pigment: mix(PIGMENTS.sap, PIGMENTS.woodLight, 0.3),
    });
  }
  const pts = stemPoints(l.stem, lerp(0.12, 1, k) * smooth(k * 3), lerp(0.4, 1, k));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.5, opacity: 0.6, pigment: mix(PIGMENTS.sap, PIGMENTS.sage, 0.5) });
  const tip = pointAt(pts, 1);
  const unfold = ease(g, lerp(l.window[0], l.window[1], 0.35), l.window[1] + 0.05);
  // leaflets open like a small flower (clover folds them at night, too)
  petalFlower(p, rng.fork('leaflets'), tip, {
    petals: l.leaflets,
    view: { tilt: l.tilt, roll: l.roll },
    open: unfold,
    size: l.size * lerp(0.35, 1, smooth(k)),
    width: 0.78,
    closedLen: 0.7,
    tone: 0.03,
    style: { pigment: l.tone, inner: lighten(l.tone, 0.38), innerReach: 0.55, opacity: 0.78, edge: 0.5 },
  });
}

function drawHead(p: Painter, rng: Rng, h: CloverHead, g: number) {
  const grow = ease(g, h.bud[0] - 0.16, h.open[0]);
  if (!visible(grow)) return;
  const budK = ease(g, h.bud[0], h.bud[1]);
  const openK = ease(g, h.open[0], h.open[1]);
  const pts = stemPoints(h.stem, grow, lerp(0.3, 1, budK));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.6, opacity: 0.7, ink: 0.3 * budK, inkReach: 0.6 });
  if (!visible(budK)) return;
  const tip = pointAt(pts, 1);
  const r = h.radius * lerp(0.35, 0.72, budK) * lerp(1, 1.38, openK);
  const c = { x: tip.x, y: tip.y - r * 0.7 };
  // the ball's core: a pale cream-green wash, cool on its shaded side
  p.wash({ cx: c.x, cy: c.y, rx: r * 0.72, ry: r * 0.68 }, mix(PIGMENTS.sageLight, FLORET, 0.45 + 0.5 * openK), {
    rng: rng.fork('core'),
    opacity: 0.55,
    edge: 0.1,
    darken: 0.1,
    blend: 'source-over',
  });
  if (visible(openK)) {
    p.glaze({ cx: c.x + r * 0.22, cy: c.y + r * 0.28, rx: r * 0.62, ry: r * 0.55 }, PIGMENTS.petalShade, { rng: rng.fork('shade'), opacity: 0.2 * openK });
  }
  // florets sit on the ball and point outward; back ones first; they open from the bottom up
  const order = h.florets.map((f, i) => ({ f, i, z: Math.sin(f.a) })).sort((a, b) => a.z - b.z);
  for (const { f, i } of order) {
    const o = smooth(ease(openK, (1 - f.h) * 0.3, (1 - f.h) * 0.3 + 0.7));
    const colour = smooth(ease(g, h.bud[0] + 0.1, h.bud[1]) * 0.6 + o * 0.4);
    const ring = Math.sqrt(Math.max(0, 1 - f.h * f.h));
    const sx = Math.cos(f.a) * ring;
    // older (lower) florets fold down against the stalk
    const droop = f.h < -0.15 ? (-f.h - 0.15) * 1.3 * o : 0;
    const dx = sx;
    const dy = -f.h + droop;
    const ang = Math.atan2(dy, dx * 1.05);
    // foreshortened when pointing at or away from the viewer
    const reach = lerp(0.72, 1, Math.min(1, Math.hypot(dx, -f.h)));
    const len = r * f.len * lerp(0.45, 0.62, o) * reach;
    const base = { x: c.x + sx * r * 0.45, y: c.y - f.h * r * 0.42 };
    const old = f.h < -0.4 ? smooth((-f.h - 0.4) * 2.2) * o : 0;
    const pigment = mix(mix(PIGMENTS.sageLight, FLORET, colour), OLD, old * 0.85);
    paintPetal(
      p,
      rng.fork(`fl-${i}`),
      base,
      { angle: ang, length: len, width: len * 0.42, curve: (f.tone - 0.5) * 0.25 },
      { pigment: jitter(pigment, rng.fork(`ft-${i}`), 0.02), inner: mix(pigment, PIGMENTS.sage, 0.3 * (1 - o * 0.6)), innerReach: 0.4, white: true, opacity: 0.9, edge: 0.45 },
    );
  }
}

const whiteClover: SpeciesDef = {
  id: 'white-clover',
  name: 'White Clover',
  nativeName: 'Shirotsumekusa',
  tier: 1,
  habitats: ['meadow', 'path'],
  sizeClass: 'small',
  size: { w: 70, h: 70 },
  anchor: { x: 0.5, y: 0.88 },
  description: 'White clover — three leaves for patience, a fourth for luck.',
  bloomColor: '#f4f0e4',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planWhiteClover(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: plan.spread * 0.8, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 6 });
      plan.leaves.forEach((l, i) => !l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.heads.forEach((h, i) => drawHead(p, r.fork(`head-${i}`), h, g));
      plan.leaves.forEach((l, i) => l.front && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
    } finally {
      end();
    }
  },
};

export default whiteClover;
