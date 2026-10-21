import { type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pigment } from '../../paint';
import { PHASES, ramp, stagger } from '../lib/shrub-growth';
import { bloomState, groundShadow, inPlantSpace, paintBlooms, paintBranches, paintClumps, paintLeaves, seedAndShoot, type Bloom } from '../lib/shrub-paint';
import { growOutward, growSkeleton, type Branch, type Clump, type Leaf } from '../lib/shrub-structure';
import type { SpeciesDef } from '../types';

/** Flower colourways: petal, deeper petal base, and whether petals are opaque light paint. */
const COLOURWAYS: { petal: Pigment; deep: Pigment; opaque: boolean }[] = [
  { petal: '#cc6467', deep: '#a9444f', opaque: true }, // yabutsubaki red
  { petal: '#cc6467', deep: '#a9444f', opaque: true },
  { petal: '#e8a9b0', deep: '#cf7e8c', opaque: true }, // pink
  { petal: '#fbf6ef', deep: '#e9dfdc', opaque: true }, // white
];

/** Glossy, dark evergreen leaves. */
const LEAF = {
  light: mix(PIGMENTS.sage, '#8f9f68', 0.5),
  mid: mix(PIGMENTS.olive, '#5f7048', 0.4),
  shadow: mix(PIGMENTS.olive, '#46523a', 0.55),
  dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.45),
};

export interface Camellia {
  trunk: Branch[];
  clumps: Clump[];
  leaves: Leaf[];
  blooms: { bloom: Bloom; bud: [number, number]; open: [number, number] }[];
  fallen: { bloom: Bloom; at: [number, number] }[];
  crown: { cx: number; cy: number; rx: number; ry: number };
  seeds: { ground: number; sprout: number; shadow: number };
}

/** Points spread evenly-ish inside an ellipse (pure). */
function ovalScatter(rng: Rng, n: number, cx: number, cy: number, rx: number, ry: number, spacing: number): { x: number; y: number; u: number; v: number }[] {
  const out: { x: number; y: number; u: number; v: number }[] = [];
  let tries = 0;
  while (out.length < n && tries < n * 50) {
    tries++;
    const u = rng.range(-1, 1);
    const v = rng.range(-1, 1);
    if (u * u + v * v > 1) continue;
    const x = cx + u * rx;
    const y = cy + v * ry;
    if (out.some((q) => Math.hypot(q.x - x, q.y - y) < spacing)) continue;
    out.push({ x, y, u, v });
  }
  return out;
}

export function buildCamellia(rng: Rng): Camellia {
  const lean = rng.range(-0.08, 0.08);
  const crown = { cx: lean * 60, cy: -rng.range(96, 104), rx: rng.range(60, 68), ry: rng.range(78, 86) };
  const colour = COLOURWAYS[rng.fork('colour').int(0, COLOURWAYS.length - 1)]!;
  const trunk = growSkeleton(rng, {
    stems: [2, 3],
    height: -crown.cy * 1.1,
    heightVar: 0.12,
    spread: 0.6,
    lean,
    baseSpread: 3,
    levels: 2,
    branches: [2, 3],
    childAngle: [0.45, 0.85],
    childLength: [0.45, 0.65],
    childAt: [0.25, 0.8],
    bend: 0.25,
    rise: 0.35,
    width: 5,
    window: [0.05, 0.42],
  });
  // leaf masses fill the oval crown from the bottom up
  const clumps: Clump[] = [];
  const pads = ovalScatter(rng, rng.int(6, 7), crown.cx, crown.cy, crown.rx * 0.6, crown.ry * 0.68, 26);
  pads.push({ x: crown.cx, y: crown.cy + crown.ry * 0.1, u: 0, v: 0.1 });
  pads.sort((a, b) => b.y - a.y);
  pads.forEach((q, i) => {
    const [t0, t1] = stagger(i, pads.length, 0.15, 0.52, 0.4);
    clumps.push({ x: q.x, y: q.y, r: crown.rx * rng.range(0.5, 0.6), t0, t1, seed: rng.int(1, 0x7fffffff) });
  });
  growOutward(clumps, { cx: crown.cx, rx: crown.rx, ry: -crown.cy + crown.ry, window: [0.18, 0.56], len: 0.2 });
  clumps.sort((a, b) => a.y - b.y);
  // single glossy leaves around the silhouette, pointing outward
  const leaves: Leaf[] = [];
  const nRim = rng.int(20, 26);
  for (let i = 0; i < nRim; i++) {
    const a = (i / nRim) * Math.PI * 2 + rng.range(-0.12, 0.12);
    if (Math.sin(a) > 0.75) continue; // none hanging under the crown
    const x = crown.cx + Math.cos(a) * crown.rx * rng.range(0.68, 0.82);
    const y = crown.cy + Math.sin(a) * crown.ry * rng.range(0.58, 0.7);
    const h = Math.min(1, (-y - 20) / (crown.ry * 2));
    const t0 = 0.18 + 0.28 * h + rng.range(0, 0.04);
    const lit = -Math.cos(a) * 0.6 - Math.sin(a) * 0.6;
    leaves.push({
      x,
      y,
      angle: a + rng.gaussian(0, 0.35),
      length: rng.range(12, 16),
      width: 0.46,
      curve: rng.range(-0.15, 0.15),
      pigment: jitter(lit > 0.2 ? LEAF.light : lit < -0.2 ? LEAF.shadow : LEAF.mid, rng, 0.03),
      t0,
      t1: t0 + 0.12,
      seed: rng.int(1, 0x7fffffff),
      group: i % 2,
    });
  }
  // flowers dotted over the crown, facing out
  const spots = ovalScatter(rng, rng.int(8, 12), crown.cx, crown.cy, crown.rx * 0.74, crown.ry * 0.76, 21);
  const n = spots.length;
  const blooms = spots.map((q, i) => {
    const order = Math.floor(rng.range(0, 1) * n);
    const big = rng.range(0.85, 1.1);
    const bloom: Bloom = {
      x: q.x,
      y: q.y,
      view: rng.range(0.9, 1.3),
      roll: q.u * 0.6 + rng.range(-0.25, 0.25),
      rot: rng.range(0, Math.PI * 2),
      cupped: true,
      opaque: colour.opaque,
      bud: mix('#9fae76', colour.deep, 0.3),
      sepals: 2,
      seed: rng.int(1, 0x7fffffff),
      rings: [
        { count: rng.int(5, 6), length: 11.5 * big, width: 1.0, open: 1.1, pigment: jitter(colour.petal, rng, 0.03), offset: 0.12, curve: 0.08, lengthVar: 0.1, angleVar: 0.12, basePool: 0.45 },
        { count: 3, length: 8.5 * big, width: 0.95, open: 0.6, pigment: mix(colour.petal, colour.deep, 0.4), offset: 0.05, curve: 0.08, lengthVar: 0.1, angleVar: 0.2, basePool: 0.5 },
      ],
      centre: { kind: 'tuft', pigment: PIGMENTS.gold, size: 5.5 * big, count: 7 },
    };
    const [b0, b1] = stagger(order, n, PHASES.buds[0], PHASES.buds[1], 0.6);
    const [o0, o1] = stagger(order, n, PHASES.bloom[0], 1, 0.6);
    return { bloom, bud: [b0, b1] as [number, number], open: [o0, o1] as [number, number], i };
  });
  // camellias drop whole flowers: one or two lie on the ground once the shrub is in full bloom
  const fallen = Array.from({ length: rng.int(0, 2) }, (_, k) => {
    const src = blooms[k % Math.max(1, blooms.length)]!.bloom;
    const x = crown.cx + rng.range(-1, 1) * crown.rx * 0.9;
    return {
      bloom: { ...src, x, y: rng.range(1, 5), view: rng.range(0.45, 0.65), roll: rng.range(-0.3, 0.3), rot: rng.range(0, 6.28), seed: rng.int(1, 0x7fffffff), sepals: 0 },
      at: [0.9 + k * 0.04, 0.99] as [number, number],
    };
  });
  return { trunk, clumps, leaves, blooms, fallen, crown, seeds: { ground: rng.int(1, 0x7fffffff), sprout: rng.int(1, 0x7fffffff), shadow: rng.int(1, 0x7fffffff) } };
}

const camellia: SpeciesDef = {
  id: 'camellia',
  name: 'Camellia',
  nativeName: 'Tsubaki',
  tier: 3,
  habitats: ['back', 'meadow'],
  sizeClass: 'large',
  size: { w: 180, h: 220 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Winter red among glossy leaves; it lets go of whole flowers.',
  bloomColor: '#c95f63',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildCamellia(rng);
    const g = opts.growth;
    const { crown } = plant;
    inPlantSpace(p, opts, camellia, () => {
      groundShadow(p, plant.seeds.ground, g, crown.cx * 0.6, crown.rx * 0.85, 7, 0.24);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 14, green: LEAF.light });
      paintBranches(p, plant.trunk, g, { pigment: mix(PIGMENTS.stone, PIGMENTS.wood, 0.4), inkFrom: 2, accent: 0.45, opacity: 0.9, hide: { keep: 0.5, at: [0.3, 0.55] } });
      paintClumps(p, plant.clumps, g, { ...LEAF, light: mix(LEAF.light, LEAF.mid, 0.6), mid: mix(LEAF.mid, LEAF.shadow, 0.3) }, { flatness: 0.8, opacity: 0.88, dabSize: 0.21, gaps: 0.25, shadow: 0.9 });
      paintLeaves(p, plant.leaves, g, { groups: 2, opacity: 0.85, edge: 0.5, gloss: 0.55 });
      paintBlooms(p, plant.blooms.map((f) => ({ bloom: f.bloom, state: bloomState(g, f.bud, f.open) })));
      // fallen flowers fade in once the shrub is in full bloom
      const fall = Math.max(0, ...plant.fallen.map((f) => ramp(g, f.at[0], f.at[1])));
      if (fall > 0.03) paintBlooms(p, plant.fallen.map((f) => ({ bloom: f.bloom, state: { size: 0.85 * Math.max(0.6, ramp(g, f.at[0], f.at[1])), open: 0.85, colour: 1 } })), { alpha: fall * 0.8 });
    });
  },
};

export default camellia;
