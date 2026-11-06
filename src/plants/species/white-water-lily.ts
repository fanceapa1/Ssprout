import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pt } from '../../paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import { UP, type FlowerView } from '../lib/small-structure';
import { paintPointedBud, paintStarFlower, paintToothedPad, type StarPetal, type ToothedPad } from '../lib/white-water-lily-paint';
import type { SpeciesDef } from '../types';

/**
 * White water lily (Nymphaea lotus): dark round pads with sharply toothed rims and a narrow
 * sinus, flushed bronze-purple, and white many-petalled stars held a hand above the water
 * round a gold crown. It unrolls its pads first, then raises pointed green buds that open.
 */

const PAD = '#55764c';
const PAD_DEEP = '#3f5d41';
const BRONZE = '#7d5a3c';
const PURPLE = '#634457';
const PETAL = '#f8f4ea';
const BLUSH = '#efd6cb';
const PETAL_SHADE = '#d6dccb';
const SEPAL = '#7d8f5a';
const GOLD = '#d8ab4c';
const GOLD_DEEP = '#b9832e';
const STALK = mix('#6e7148', BRONZE, 0.3);
const WATER = mix(PIGMENTS.celadon, PIGMENTS.celadonMid, 0.4);
/** Vertical squash of anything lying on the water, seen from the low bank. */
const FLAT = 0.32;

interface Pad extends ToothedPad {
  window: [number, number];
}

interface Flower {
  base: Pt;
  height: number;
  lean: number;
  size: number;
  view: FlowerView;
  sepals: StarPetal[];
  outer: StarPetal[];
  inner: StarPetal[];
  rise: [number, number];
  open: [number, number];
  /** a bud that only loosens: it opens another night */
  bud: boolean;
}

export interface WhiteWaterLilyPlan {
  pads: Pad[];
  flowers: Flower[];
}

const ring = (rng: Rng, n: number, rot: number, len: [number, number], wid: [number, number]): StarPetal[] =>
  Array.from({ length: n }, (_, j) => ({ a: rot + (j / n) * Math.PI * 2 + rng.gaussian(0, 0.05), len: rng.range(...len), wid: rng.range(...wid) }));

export function planWhiteWaterLily(rng: Rng): WhiteWaterLilyPlan {
  const green = jitter(mix(PAD, PAD_DEEP, rng.range(0, 0.5)), rng, 0.03);
  const n = rng.int(4, 6);
  const pads: Pad[] = [];
  const turn = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2 + rng.gaussian(0, 0.35);
    const d = i === 0 ? rng.range(0, 5) : rng.range(24, 34);
    const r = rng.range(12, 16) * (i === 0 ? 1.1 : 1);
    const veins: number[] = [];
    for (let v = 0; v < 9; v++) veins.push((v / 9) * Math.PI * 2 + rng.gaussian(0, 0.12));
    const reach = 62 - r * 1.15;
    pads.push({
      x: Math.max(-reach, Math.min(reach, Math.cos(a) * d * 1.6)),
      y: Math.sin(a) * d * FLAT,
      r,
      flat: FLAT,
      notch: rng.range(0, Math.PI * 2),
      notchWidth: rng.range(0.14, 0.26),
      teeth: Math.round(r * rng.range(1.7, 2)),
      depth: rng.range(0.11, 0.15),
      tone: jitter(green, rng, 0.03),
      flush: jitter(rng.chance(0.5) ? BRONZE : PURPLE, rng, 0.04),
      spots: rng.chance(0.45) ? Array.from({ length: rng.int(2, 5) }, () => ({ a: rng.range(0, Math.PI * 2), d: rng.range(0.25, 0.75), s: rng.range(1, 2.2) })) : [],
      veins,
      window: [0, 0],
    });
  }
  rng.shuffle(pads.map((_, i) => i)).forEach((pi, k) => {
    pads[pi]!.window = [...stagger(k, n, [0.02, 0.55], 0.5)] as [number, number];
  });
  const nOpen = rng.int(1, 2);
  const nf = nOpen + (rng.chance(0.6) ? 1 : 0);
  const flowers: Flower[] = [];
  const side = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nf; i++) {
    const bud = i >= nOpen;
    const host = pads[i % n]!;
    const x = i === 0 ? rng.range(-8, 8) : side * (i === 1 ? 1 : -1) * rng.range(20, 34);
    const rot = rng.range(0, Math.PI * 2);
    flowers.push({
      base: { x: Math.max(-44, Math.min(44, x)), y: (i === 0 ? rng.range(-2, 3) : host.y * 0.4 + rng.range(-2, 4)) },
      height: bud ? rng.range(6, 9) : rng.range(9, 14),
      lean: rng.gaussian(0, 0.1),
      size: rng.range(12, 14) * (i === 0 ? 1 : 0.88),
      view: { tilt: rng.range(0.4, 0.5), roll: UP },
      sepals: ring(rng, 4, rot + 0.4, [0.9, 1.05], [0.9, 1.1]),
      outer: ring(rng, rng.int(9, 11), rot, [0.9, 1.08], [0.85, 1.1]),
      inner: ring(rng, rng.int(7, 9), rot + 0.25, [0.8, 1], [0.85, 1.05]),
      rise: [...stagger(i, nf, [0.42, 0.74], 0.6)] as [number, number],
      open: bud ? [0.82, 1] : ([...stagger(i, nOpen, [0.7, 1], 0.75)] as [number, number]),
      bud,
    });
  }
  return { pads, flowers };
}

const COLOURS = { petal: PETAL, blush: BLUSH, shade: PETAL_SHADE, sepal: SEPAL, gold: GOLD, goldDeep: GOLD_DEEP };

function drawFlower(p: Parameters<SpeciesDef['draw']>[0], rng: Rng, f: Flower, g: number) {
  const rk = ease(g, f.rise[0], f.rise[1]);
  if (!visible(rk)) return;
  const ok = smooth(ease(g, f.open[0], f.open[1]));
  const lift = f.height * easeOut(rk);
  const head = { x: f.base.x + Math.sin(f.lean) * lift, y: f.base.y - Math.cos(f.lean) * lift };
  // where the stalk leaves the water: a dark collar and a ring that settles
  p.glaze({ cx: f.base.x, cy: f.base.y + 0.6, rx: lerp(1, 4.5, rk), ry: lerp(0.4, 1.3, rk) }, PIGMENTS.celadonDeep, { rng: rng.fork('collar'), opacity: 0.3 * rk });
  // the open flower hides the top of its stalk, so it stops under the front petals
  const top = { x: head.x, y: head.y + f.size * 0.3 * f.view.tilt * (f.bud ? 0 : ok) };
  p.stroke([f.base, { x: (f.base.x + top.x) / 2 + f.lean, y: (f.base.y + top.y) / 2 }, top], { rng: rng.fork('stalk'), pigment: STALK, width: 1.1, taper: [0.1, 0.3], wobble: 0.15, wetness: 0.4, opacity: 0.85 * smooth(rk * 2), edge: 0.4 });
  const open = f.bud ? ok * 0.12 : ok;
  const fade = f.bud ? 1 : 1 - smooth(ok / 0.45);
  if (visible(fade)) {
    const len = f.size * 0.72 * easeOut(rk);
    paintPointedBud(p, rng.fork('bud'), head, { angle: UP + f.lean * 0.6, length: len, width: len * 0.42, green: SEPAL, white: PETAL, opacity: 0.88 * fade * smooth(rk * 2), open: f.bud ? ok : smooth(ok / 0.3) });
  }
  if (f.bud || !visible(ok)) return;
  paintStarFlower(p, rng.fork('flower'), { c: head, size: f.size, view: f.view, sepals: f.sepals, outer: f.outer, inner: f.inner }, open, 0.94 * smooth(ok / 0.35), COLOURS);
}

const whiteWaterLily: SpeciesDef = {
  id: 'white-water-lily',
  name: 'White Water Lily',
  nativeName: 'Nilufar',
  nativeLang: 'ar-Latn',
  // the white Egyptian lotus: wild in the Nile's and the Sahel's pools and wetlands
  range: { realms: ['n-africa-arabia'], biomes: ['wetland'], climates: ['arid'] },
  tier: 2,
  habitats: ['water'],
  sizeClass: 'medium',
  size: { w: 130, h: 96 },
  anchor: { x: 0.5, y: 0.68 },
  description: 'White water lily — night stars on saw-edged pads, shut by noon.',
  bloomColor: PETAL,
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planWhiteWaterLily(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      p.ripple({ x: 0, y: 2 }, { rng: r.fork('ring'), width: lerp(18, 64, ease(g, 0, 0.5)), count: 2, squash: FLAT * 0.5, opacity: 0.26 * (0.4 + 0.6 * ease(g, 0, 0.06)), light: 0.3 });
      p.glaze({ cx: 0, cy: 3, rx: lerp(10, 50, ease(g, 0, 0.5)), ry: lerp(2, 9, ease(g, 0, 0.5)) }, WATER, { rng: r.fork('water'), opacity: 0.16 * (0.3 + 0.7 * ease(g, 0, 0.1)) });
      const order = plan.pads.map((pd, i) => ({ pd, i })).sort((a, b) => a.pd.y - b.pd.y);
      for (const { pd, i } of order) {
        const k = ease(g, pd.window[0], pd.window[1]);
        if (!visible(k)) continue;
        const s = easeOut(k);
        if (pd.r * s < 0.6) continue;
        paintToothedPad(p, r.fork(`pad-${i}`), pd, k, s);
      }
      const flowers = plan.flowers.map((f, i) => ({ f, i })).sort((a, b) => a.f.base.y - b.f.base.y);
      for (const { f, i } of flowers) drawFlower(p, r.fork(`flower-${i}`), f, g);
    } finally {
      end();
    }
  },
};

export default whiteWaterLily;
