import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { paintBud, paintPetal, plantFrame } from '../lib/small-paint';
import { UP, petalPose, type FlowerView } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Water lily (suiren): round floating pads, each with its slit, seen in perspective from the
 * bank, resting in a faint ring of disturbed water; and one or two flowers sitting on the
 * surface — broad pointed petals in a loose cup, white blushing pink at the tips or soft pink,
 * opening around a gold heart. It grows by unrolling its pads, then raising a pointed bud.
 */

interface Pad {
  x: number;
  y: number;
  r: number;
  notch: number;
  notchWidth: number;
  tone: Pigment;
  rim: number;
  window: [number, number];
  veins: number[];
}

interface Lily {
  x: number;
  y: number;
  size: number;
  outer: { a: number; len: number; wid: number }[];
  inner: { a: number; len: number; wid: number }[];
  tilt: number;
  bud: [number, number];
  open: [number, number];
}

export interface WaterLilyPlan {
  pads: Pad[];
  lilies: Lily[];
  petal: Pigment;
  tip: Pigment;
}

/** Vertical squash of anything lying on the water, seen from the bank. */
const FLAT = 0.36;

export function planWaterLily(rng: Rng): WaterLilyPlan {
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.sap, 0.4), rng, 0.03);
  const n = rng.int(3, 6);
  const pads: Pad[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.gaussian(0, 0.4);
    const d = i === 0 ? rng.range(0, 6) : rng.range(18, 36);
    const veins: number[] = [];
    for (let v = 0; v < 7; v++) veins.push((v / 7) * Math.PI * 2 + rng.gaussian(0, 0.15));
    pads.push({
      x: Math.cos(a) * d * 1.45,
      y: Math.sin(a) * d * FLAT,
      r: rng.range(11, 17) * (i === 0 ? 1.1 : 1),
      notch: rng.range(0, Math.PI * 2),
      notchWidth: rng.range(0.25, 0.45),
      tone: jitter(rng.chance(0.3) ? mix(green, PIGMENTS.woodLight, 0.25) : green, rng, 0.035),
      rim: rng.chance(0.45) ? rng.range(0.3, 0.6) : 0,
      window: [0, 0],
      veins,
    });
  }
  rng.shuffle(pads.map((_, i) => i)).forEach((pi, k) => {
    pads[pi]!.window = [...stagger(k, n, [0.04, 0.5], 0.5)] as [number, number];
  });
  const pink = rng.chance(0.35);
  const nl = rng.int(1, 2);
  const lilies: Lily[] = [];
  for (let i = 0; i < nl; i++) {
    const host = pads[i % pads.length]!;
    const rot = rng.range(0, Math.PI * 2);
    const no = rng.int(7, 9);
    const ni = rng.int(5, 7);
    lilies.push({
      x: host.x + rng.range(-4, 4) + (i === 0 ? 0 : rng.range(14, 22) * (host.x >= 0 ? 1 : -1)),
      y: host.y + rng.range(-2, 1),
      size: rng.range(10, 12.5) * (i === 0 ? 1 : 0.85),
      outer: Array.from({ length: no }, (_, j) => ({ a: rot + (j / no) * Math.PI * 2 + rng.gaussian(0, 0.08), len: rng.range(0.9, 1.08), wid: rng.range(0.9, 1.1) })),
      inner: Array.from({ length: ni }, (_, j) => ({ a: rot + 0.3 + (j / ni) * Math.PI * 2 + rng.gaussian(0, 0.1), len: rng.range(0.75, 0.95), wid: rng.range(0.85, 1.05) })),
      tilt: rng.range(0.32, 0.45),
      bud: [...stagger(i, nl, [0.45, 0.76], 0.65)] as [number, number],
      open: [...stagger(i, nl, [0.76, 1], 0.75)] as [number, number],
    });
  }
  return {
    pads,
    lilies,
    petal: pink ? mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.35) : PIGMENTS.petalWhite,
    tip: pink ? PIGMENTS.sakura : mix(PIGMENTS.sakuraLight, PIGMENTS.petalWhite, 0.25),
  };
}

/** A pad outline: a flattened disc with its slit, unrolled by `k` (0 = a rolled spike). */
export function padOutline(p: Pad, k: number, s = 1): Pt[] {
  const pts: Pt[] = [];
  const rx = p.r * s;
  const ry = p.r * s * FLAT * lerp(0.25, 1, k);
  const half = (p.notchWidth / 2) * k;
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = p.notch + half + ((Math.PI * 2 - 2 * half) * i) / N;
    pts.push({ x: p.x + Math.cos(t) * rx, y: p.y + Math.sin(t) * ry });
  }
  // the slit runs to just short of the centre
  pts.push({ x: p.x + Math.cos(p.notch) * rx * 0.08, y: p.y + Math.sin(p.notch) * ry * 0.08 });
  return pts;
}

function drawPad(p: Painter, rng: Rng, pad: Pad, g: number) {
  const k = ease(g, pad.window[0], pad.window[1]);
  if (!visible(k)) return;
  const s = easeOut(k);
  if (pad.r * s < 0.6) return;
  const op = smooth(k * 3);
  // the pad's cool shadow on the water, just below it
  p.glaze({ cx: pad.x + 1, cy: pad.y + pad.r * FLAT * 0.35 * s, rx: pad.r * s * 1.02, ry: pad.r * s * FLAT * 0.9 }, PIGMENTS.celadonDeep, { rng: rng.fork('shadow'), opacity: 0.22 * op });
  const outline = padOutline(pad, k, s);
  // wet-in-wet: lighter where the sky catches the near side, deeper toward the back
  p.wetInWet(outline, lighten(pad.tone, 0.18), shade(pad.tone, 0.25), {
    rng: rng.fork('pad'),
    angle: UP,
    split: 0.55,
    deform: 0.1,
    spread: 0.08,
    softness: 0.45,
    opacity: 0.85 * op,
    edge: 0.55,
    centreLift: 0.3,
    granulation: 0.2,
  });
  if (pad.rim > 0 && k > 0.5) {
    p.glaze(outline, mix(PIGMENTS.sakura, PIGMENTS.wood, 0.5), { rng: rng.fork('rim'), opacity: 0.22 * pad.rim * smooth((k - 0.5) / 0.5), fade: { angle: -UP, start: 0.1, amount: 0.9 } });
  }
  // faint radiating veins
  if (k > 0.55) {
    const vk = smooth((k - 0.55) / 0.45);
    pad.veins.forEach((a, i) => {
      if (Math.abs(((a - pad.notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < pad.notchWidth) return;
      const rx = pad.r * s * 0.82;
      const ry = pad.r * s * FLAT * 0.82;
      p.inkLine(
        [
          { x: pad.x + Math.cos(a) * rx * 0.15, y: pad.y + Math.sin(a) * ry * 0.15 },
          { x: pad.x + Math.cos(a) * rx, y: pad.y + Math.sin(a) * ry },
        ],
        { rng: rng.fork(`vein-${i}`), width: 0.3, pigment: shade(pad.tone, 0.45), opacity: 0.22 * vk, breaks: 0.2, taper: [0.2, 0.5], wobble: 0.15 },
      );
    });
  }
}

function drawLily(p: Painter, rng: Rng, l: Lily, plan: WaterLilyPlan, g: number) {
  const budK = ease(g, l.bud[0], l.bud[1]);
  if (!visible(budK)) return;
  const openK = smooth(ease(g, l.open[0], l.open[1]));
  const c: Pt = { x: l.x, y: l.y };
  // the bud rises from the water and stands up; the flower then sits on the surface
  const rise = budK * (1 - openK) * 3;
  const fade = 1 - smooth(openK / 0.5);
  if (visible(fade)) {
    paintBud(p, rng.fork('bud'), { x: c.x, y: c.y - rise }, {
      angle: UP + 0.12,
      length: l.size * 0.85,
      width: l.size * 0.48,
      k: budK,
      colour: ease(g, l.bud[0] + 0.15, l.bud[1] + 0.05) * 0.7,
      pigment: plan.tip,
      green: mix(PIGMENTS.sage, PIGMENTS.wood, 0.25),
      sepals: 3,
      sepalLen: 0.75,
      opacity: 0.88 * fade,
    });
  }
  if (!visible(openK)) return;
  const view: FlowerView = { tilt: l.tilt, roll: UP };
  const op = 0.92 * smooth(openK / 0.35);
  // a soft reflection-shadow under the flower
  p.glaze({ cx: c.x, cy: c.y + 2, rx: l.size * 1.1 * openK, ry: l.size * 0.3 * openK }, PIGMENTS.celadonDeep, { rng: rng.fork('shadow'), opacity: 0.25 * openK });
  const petals = (rows: Lily['outer'], open: number, len: number, wid: number, label: string) => {
    rows
      .map((pl, i) => ({ pl, i, pose: petalPose(pl.a, view, open, 0.7) }))
      .sort((a, b) => a.pose.depth - b.pose.depth)
      .forEach(({ pl, i, pose }) => {
        paintPetal(
          p,
          rng.fork(`${label}-${i}`),
          c,
          { angle: pose.angle, length: l.size * len * pl.len * lerp(0.3, 1, pose.len), width: l.size * wid * pl.wid, curve: 0 },
          { pigment: plan.petal, inner: mix(PIGMENTS.petalShade, PIGMENTS.sageLight, 0.3), innerReach: 0.35, tip: mix(plan.petal, plan.tip, 0.65), variant: 'leaf', white: true, opacity: op, edge: 0.45 },
        );
      });
  };
  // outer petals spread almost flat; inner ones stay cupped and upright
  petals(l.outer, openK, 1, 0.42, 'outer');
  petals(l.inner, openK * 0.3, 0.8, 0.34, 'inner');
  p.dab({ x: c.x, y: c.y - l.size * 0.12 }, PIGMENTS.gold, { rng: rng.fork('heart'), variant: 'round', angle: 0, length: l.size * 0.22 * openK, width: l.size * 0.15 * openK, opacity: 0.8 * openK, blend: 'source-over', edge: 0.4 });
}

const waterLily: SpeciesDef = {
  id: 'water-lily',
  name: 'Water Lily',
  nativeName: 'Suiren',
  tier: 2,
  habitats: ['water'],
  sizeClass: 'medium',
  size: { w: 130, h: 80 },
  anchor: { x: 0.5, y: 0.62 },
  description: 'Water lily — opening slowly, as if the pond were thinking.',
  bloomColor: '#f7e5e2',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planWaterLily(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      // the first stir on the water: a ring that widens and settles
      p.ripple({ x: 0, y: 2 }, { rng: r.fork('ring'), width: lerp(18, 60, ease(g, 0, 0.5)), count: 2, squash: FLAT * 0.5, opacity: 0.28 * (0.4 + 0.6 * ease(g, 0, 0.06)), light: 0.3 });
      const order = plan.pads.map((pd, i) => ({ pd, i })).sort((a, b) => a.pd.y - b.pd.y);
      for (const { pd, i } of order) drawPad(p, r.fork(`pad-${i}`), pd, g);
      plan.lilies.forEach((l, i) => drawLily(p, r.fork(`lily-${i}`), l, plan, g));
    } finally {
      end();
    }
  },
};

export default waterLily;
