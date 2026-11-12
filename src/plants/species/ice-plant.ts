import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter } from '../../paint';
import {
  lobeBody,
  lobeFlowers,
  spill,
  type Bloom,
  type Bloomlet,
  type Colourway,
  type Finger,
  type Greens,
  type Lobe,
  type RimFinger,
} from '../lib/ice-plant-paint';
import { clamp01, ease, lerp } from '../lib/small-growth';
import { groundShadow, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import type { SpeciesDef } from '../types';

/**
 * Ice plant (Lampranthus): a low, spreading cushion of fleshy grey-green finger leaves, buried
 * under hundreds of small satin-rayed daisies. Magenta or hot pink, or red-crimson by seed.
 */

const GREENS: Greens = { leaf: '#8aa88a', deep: '#5f8068', pale: '#b5c7a6' };
const EYE = '#f2dc7c';
const BUD = '#a9a888';

export type ColourwayName = 'magenta' | 'hot-pink' | 'crimson';

const COLOURWAYS: Record<ColourwayName, Colourway> = {
  magenta: { shade: '#58124e', mid: '#c42b93', pale: '#ef7fc2', eye: EYE, bud: BUD },
  'hot-pink': { shade: '#68124f', mid: '#dc3199', pale: '#fb8dce', eye: EYE, bud: BUD },
  crimson: { shade: '#4f0b24', mid: '#c71f40', pale: '#ef6a72', eye: EYE, bud: BUD },
};

export interface IcePlantPlan {
  colourway: ColourwayName;
  lobes: { lobe: Lobe; window: [number, number]; fingers: Finger[]; flowers: Bloomlet[] }[];
  rim: RimFinger[];
}

function pickColourway(rng: Rng): ColourwayName {
  const t = rng.next();
  return t < 0.5 ? 'magenta' : t < 0.72 ? 'hot-pink' : 'crimson';
}

function makeLobe(rng: Rng, cx: number, cy: number, rx: number, rd: number, h: number): Lobe {
  const blooms: Bloom[] = [];
  const n = rng.int(5, 8);
  for (let i = 0; i < n; i++) {
    const t = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 0.85;
    blooms.push({ a: Math.cos(t) * d, b: Math.sin(t) * d, r: rng.range(0.3, 0.55), shift: rng.chance(0.42) ? rng.range(0.5, 1) : -rng.range(0.5, 1) });
  }
  return { cx, cy, rx, rd, h, q: rng.range(0.5, 0.65), blooms, wobble: Array.from({ length: 12 }, () => rng.gaussian(0, 0.03)) };
}

const FLOWER_R = [1.25, 2.05] as const;

function makeFlowers(rng: Rng, l: Lobe, window: readonly [number, number], cap: number): Bloomlet[] {
  const out: Bloomlet[] = [];
  const spacing = 2.2;
  for (let tries = 0; tries < 1800 && out.length < cap; tries++) {
    const t = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 0.97;
    const a = Math.cos(t) * d;
    const b = Math.sin(t) * d;
    if (out.some((f) => Math.hypot((f.a - a) * l.rx, (f.b - b) * l.rd) < spacing * (0.8 + 0.4 * rng.next()))) continue;
    const first = Math.max(0.4, window[1] - 0.14);
    const start = lerp(first, 0.88, rng.next() ** 0.9);
    out.push({
      a,
      b,
      r: rng.range(FLOWER_R[0], FLOWER_R[1]),
      rot: rng.range(0, Math.PI * 2),
      rays: rng.int(15, 21),
      tips: Array.from({ length: 8 }, () => rng.next()),
      jit: rng.gaussian(0, 0.07),
      open: [start, start + 0.12],
      key: `f-${out.length}`,
    });
  }
  return out;
}

export function planIcePlant(rng: Rng): IcePlantPlan {
  const colourway = pickColourway(rng.fork('colour'));
  const mainRx = rng.range(17, 19.5);
  const specs: { cx: number; cy: number; rx: number; rd: number; h: number; window: [number, number] }[] = [
    { cx: rng.gaussian(0, 1.5), cy: rng.range(-2.5, -0.5), rx: mainRx, rd: mainRx * rng.range(0.8, 0.9), h: rng.range(11, 13.5), window: [0, 0.5] },
  ];
  const side = rng.chance(0.5) ? 1 : -1;
  const sat = (cx: number, cy: number, rx: number, h: number, w: [number, number]) => specs.push({ cx, cy, rx, rd: rx * rng.range(0.7, 0.85), h, window: w });
  sat(side * rng.range(14, 16), rng.range(0, 3), rng.range(11, 13), rng.range(5, 6.5), [0.12, 0.56]);
  sat(-side * rng.range(14, 16), rng.range(-1, 3), rng.range(10, 12.5), rng.range(4.5, 6), [0.16, 0.6]);
  sat(rng.gaussian(0, 4), rng.range(8, 10), rng.range(11, 13), rng.range(4, 5.5), [0.2, 0.64]);
  if (rng.chance(0.6)) sat(rng.range(-11, 11), rng.range(-9, -7), rng.range(8, 10), rng.range(6, 8), [0.1, 0.5]);

  const lobes = specs.map((s, i) => {
    const r = rng.fork(`lobe-${i}`);
    const lobe = makeLobe(r.fork('shape'), s.cx, s.cy, s.rx, s.rd, s.h);
    const fingers: Finger[] = [];
    const nf = Math.round(s.rx * 1.7);
    for (let j = 0; j < nf; j++) {
      const t = r.range(0, Math.PI * 2);
      const d = Math.sqrt(r.next()) * 0.95;
      fingers.push({ a: Math.cos(t) * d, b: Math.sin(t) * d, turn: r.gaussian(0, 0.5), len: r.range(3, 4.4), wid: r.range(0.9, 1.2), tone: r.next(), start: clamp01(d * 0.15 + r.next() * 0.25), key: `fg-${j}` });
    }
    const flowers = makeFlowers(r.fork('flowers'), lobe, s.window, Math.round(s.rx * 14));
    return { lobe, window: s.window, fingers, flowers };
  });
  const order = lobes.map((l, i) => i).sort((x, y) => lobes[x]!.lobe.cy - lobes[y]!.lobe.cy);
  const sorted = order.map((i) => lobes[i]!);

  const rim: RimFinger[] = [];
  sorted.forEach((l, li) => {
    const r = rng.fork(`rim-${li}`);
    const n = Math.round(l.lobe.rx * 0.45);
    for (let j = 0; j < n; j++) {
      const t = lerp(0.02, 0.98, (j + r.range(0.1, 0.9)) / n) * Math.PI;
      rim.push({ lobe: li, a: Math.cos(t) * 0.97, b: Math.sin(t) * 0.97, turn: r.gaussian(0, 0.3), len: r.range(2, 2.9), wid: r.range(0.75, 1), tone: r.next(), start: r.range(0.3, 0.62), key: `rim-${li}-${j}` });
    }
  });
  return { colourway, lobes: sorted, rim };
}

const icePlant: SpeciesDef = {
  id: 'ice-plant',
  name: 'Ice Plant',
  nativeName: 'Mesimvrianthemo',
  nativeLang: 'el-Latn',
  // a South African garden plant, planted in Mediterranean coastal gardens and wild nowhere in the vocabulary
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['mediterranean'] },
  tier: 1,
  habitats: ['meadow', 'rock', 'path'],
  sizeClass: 'small',
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.7 },
  description: 'Ice plant — a wall spilling over with satin daisies that close at dusk.',
  bloomColor: '#c42b93',
  pollinators: true,
  draw(p: Painter, rng: Rng, opts) {
    const plan = planIcePlant(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      const colour = COLOURWAYS[plan.colourway];
      seedMound(p, r.fork('seed'), g, { rx: 9 });
      groundShadow(p, r, { rx: 30, ry: 6, k: ease(g, 0.08, 0.5), opacity: 0.1, pigment: mix(PIGMENTS.shadow, PIGMENTS.stoneWarm, 0.4) });
      const grown = plan.lobes.map((o) => ({ l: o.lobe, k: ease(g, o.window[0], o.window[1]) ** 0.5 }));
      const wash = ease(g, 0.55, 0.9);
      plan.lobes.forEach((o, i) => {
        const { l, k } = grown[i]!;
        if (k < 0.02) return;
        const outline = lobeBody(p, r.fork(`body-${i}`), l, k, o.fingers, GREENS, { opacity: 0.95 * clamp01(k * 10), cover: wash });
        lobeFlowers(p, r.fork(`flowers-${i}`), l, k, outline, o.flowers, g, colour, { wash, opacity: 0.95 });
      });
      spill(p, r.fork('spill'), grown, plan.rim, g, GREENS);
    } finally {
      end();
    }
  },
};

export default icePlant;
