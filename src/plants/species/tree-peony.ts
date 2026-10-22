import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, shade, type Pigment } from '../../paint';
import { PHASES, ramp, stagger } from '../lib/shrub-growth';
import { bloomState, groundShadow, inPlantSpace, paintBlooms, paintBranches, paintClumps, paintLeaves, seedAndShoot, type Bloom } from '../lib/shrub-paint';
import { angleAt, domeLeaves, growOutward, growSkeleton, leafSpray, terminalBranches, type Branch, type Clump, type Leaf } from '../lib/shrub-structure';
import type { SpeciesDef } from '../types';

/** Flower colourways: outer petals, inner petals, the flare deep in the cup. */
const COLOURWAYS: { outer: Pigment; inner: Pigment; flare: Pigment }[] = [
  { outer: '#fbcfcd', inner: '#f5aab3', flare: '#ce5e85' }, // shell pink
  { outer: '#f9afba', inner: '#ee8a9b', flare: '#b34075' }, // rose
  { outer: '#fdf5ec', inner: '#f9e3e0', flare: '#c0487d' }, // white with a magenta flare
  { outer: '#f39bb1', inner: '#e47c9a', flare: '#9b3064' }, // deep peony
];

/** Matte blue-green peony foliage; new leaves blush bronze. */
const LEAF = {
  light: mix(PIGMENTS.sageLight, PIGMENTS.celadon, 0.25),
  mid: mix(PIGMENTS.sap, PIGMENTS.celadonMid, 0.3),
  shadow: mix(PIGMENTS.sage, PIGMENTS.celadonDeep, 0.25),
  bronze: mix(PIGMENTS.sap, PIGMENTS.wood, 0.45),
};

export interface Peony {
  stems: Branch[];
  clumps: Clump[];
  leaves: Leaf[];
  blooms: { bloom: Bloom; bud: [number, number]; open: [number, number]; closed: boolean }[];
  seeds: { ground: number; sprout: number; shadow: number };
  lean: number;
  dome: { rx: number; ry: number; cx: number };
}

/** Build the whole plant from the rng (independent of growth). */
export function buildPeony(rng: Rng): Peony {
  const lean = rng.range(-0.1, 0.1);
  const dome = { rx: rng.range(62, 74), ry: rng.range(74, 88), cx: lean * 40 };
  const stems = growSkeleton(rng, {
    stems: [3, 5],
    height: dome.ry * 1.0,
    heightVar: 0.15,
    spread: 1.25,
    lean,
    baseSpread: 6,
    levels: 1,
    branches: [1, 2],
    childAngle: [0.3, 0.6],
    childLength: [0.35, 0.55],
    bend: 0.3,
    rise: 0.45,
    width: 2.6,
    window: [0.05, 0.42],
  });
  const tips = terminalBranches(stems)
    .map((b) => ({ b, tip: b.pts[b.pts.length - 1]! }))
    .sort((a, b) => a.tip.y - b.tip.y);
  const colour = COLOURWAYS[rng.fork('colour').int(0, COLOURWAYS.length - 1)]!;
  const nBlooms = Math.min(tips.length, rng.int(2, 4));
  // most seeds keep one fat bud for later — peonies never open all at once
  const extraBud = tips.length > nBlooms && rng.chance(0.65);
  // tallest tips first, but keep flowers apart so they read as separate blooms
  const chosen: typeof tips = [];
  for (const t of tips) {
    if (chosen.length >= nBlooms + (extraBud ? 1 : 0)) break;
    if (chosen.every((c) => Math.hypot(c.tip.x - t.tip.x, (c.tip.y - t.tip.y) * 1.4) > 34)) chosen.push(t);
  }
  const blooms = chosen.map(({ b, tip }, i) => {
    const closed = extraBud && i === chosen.length - 1;
    const big = rng.range(0.88, 1.12) * (i === 0 ? 1.08 : 1);
    const dir = angleAt(b.pts, 1);
    const bloom: Bloom = {
      x: tip.x,
      y: tip.y,
      view: rng.range(0.85, 1.2),
      roll: (dir + Math.PI / 2) * 0.45 + rng.range(-0.15, 0.15),
      rot: rng.range(0, Math.PI * 2),
      cupped: true,
      opaque: true,
      bud: mix('#b4c27f', colour.inner, 0.25),
      sepals: 3,
      throat: { pigment: colour.flare, size: 8 * big, alpha: 0.35 },
      seed: rng.int(1, 0x7fffffff),
      rings: [
        { count: 8, length: 19 * big, width: 0.95, open: 1.2, pigment: colour.outer, offset: 0.1, curve: 0.18, lengthVar: 0.18, angleVar: 0.2, basePool: 0.3, ruffle: 2 },
        { count: 7, length: 14.5 * big, width: 0.95, open: 0.85, pigment: mix(colour.outer, colour.inner, 0.5), offset: 0.08, curve: 0.2, lengthVar: 0.2, angleVar: 0.25, basePool: 0.4, ruffle: 2 },
        { count: 6, length: 10 * big, width: 0.9, open: 0.5, pigment: colour.inner, offset: 0.05, curve: 0.25, lengthVar: 0.2, angleVar: 0.3, basePool: 0.5, ruffle: 1 },
      ],
      centre: { kind: 'stamens', pigment: PIGMENTS.gold, size: 7 * big, count: 14 },
    };
    const [o0, o1] = stagger(Math.min(i, nBlooms - 1), nBlooms, PHASES.bloom[0], 1, 0.75);
    const [b0, b1] = stagger(i, chosen.length, PHASES.buds[0], PHASES.buds[1] + 0.02, 0.85);
    return { bloom, bud: [b0, b1] as [number, number], open: [o0, o1] as [number, number], closed };
  });

  // compound leaves (three leaflets, each two- or three-lobed) covering a loose dome
  const vary = (p: Pigment, r: Rng) => (r.chance(0.18) ? mix(p, LEAF.bronze, 0.4) : jitter(p, r, 0.03));
  const leaves = domeLeaves(rng, {
    rx: dome.rx * 0.8,
    ry: dome.ry * 0.86,
    cx: dome.cx,
    floor: 0.1,
    sprays: rng.int(14, 17),
    size: [16, 21],
    leaflets: [3, 3],
    lobes: [1, 3],
    fan: 1.0,
    petiole: 0.3,
    curve: 0.25,
    width: 0.4,
    window: [0.18, 0.54],
    pigments: LEAF,
    vary,
  });
  // a collar of leaves just under each flower
  for (const { bloom } of blooms) {
    for (const side of [-1, 1]) {
      leaves.push(...leafSpray(rng, { x: bloom.x + side * 4, y: bloom.y + 8 }, -Math.PI / 2 + side * rng.range(1.15, 1.6), rng.range(17, 21), LEAF.mid, rng.range(0.3, 0.4), { lobes: [2, 2], width: 0.45 }));
    }
  }
  leaves.forEach((l, i) => (l.group = i % 2));

  // a soft underpainting so the leaf mass has body
  const clumps: Clump[] = [];
  const nC = rng.int(3, 4);
  for (let i = 0; i < nC; i++) {
    const u = nC === 1 ? 0 : i / (nC - 1) - 0.5;
    const [t0, t1] = stagger(i, nC, 0.26, 0.56, 0.6);
    const high = 1 - Math.abs(u) * 1.2;
    clumps.push({ x: dome.cx + u * dome.rx * 1.05 + rng.gaussian(0, 4), y: -dome.ry * (0.3 + 0.28 * high) + rng.gaussian(0, 3), r: dome.rx * rng.range(0.45, 0.55), t0, t1, seed: rng.int(1, 0x7fffffff) });
  }
  growOutward(clumps, { cx: dome.cx, rx: dome.rx * 1.1, ry: dome.ry, window: [0.2, 0.56], len: 0.2 });
  clumps.sort((a, b) => a.y - b.y);
  return { stems, clumps, leaves, blooms, lean, dome, seeds: { ground: rng.int(1, 0x7fffffff), sprout: rng.int(1, 0x7fffffff), shadow: rng.int(1, 0x7fffffff) } };
}

const treePeony: SpeciesDef = {
  id: 'tree-peony',
  name: 'Tree Peony',
  nativeName: 'Botan',
  tier: 3,
  habitats: ['meadow', 'back'],
  sizeClass: 'large',
  size: { w: 200, h: 220 },
  anchor: { x: 0.5, y: 0.93 },
  description: 'The king of flowers, opening one silk layer at a time.',
  bloomColor: '#f29aae',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildPeony(rng);
    const g = opts.growth;
    const { dome } = plant;
    inPlantSpace(p, opts, treePeony, () => {
      groundShadow(p, plant.seeds.ground, g, dome.cx * 0.5, dome.rx * 0.8, 7, 0.18);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 16, green: LEAF.light });
      paintBranches(p, plant.stems, g, { pigment: mix(PIGMENTS.wood, PIGMENTS.stoneDark, 0.35), inkFrom: 1, accent: 0.35, opacity: 0.8, hide: { keep: 0.55, at: [0.3, 0.6] } });
      paintClumps(p, plant.clumps, g, { light: LEAF.light, mid: LEAF.mid, shadow: LEAF.shadow, dark: PIGMENTS.olive }, { flatness: 0.72, opacity: 0.72, gaps: 0.4, shadow: 0.8 });
      paintLeaves(p, plant.leaves, g, { groups: 2, opacity: 0.78, edge: 0.4, darken: 0.25 });
      // cool shadow glazed under the leaf mass
      const sh = ramp(g, 0.25, 0.6);
      if (sh > 0.02) {
        p.glaze({ cx: dome.cx, cy: -dome.ry * 0.25, rx: dome.rx * 0.85 * (0.5 + 0.5 * sh), ry: dome.ry * 0.25 }, shade(LEAF.shadow, 0.45), {
          rng: createRng(plant.seeds.shadow),
          opacity: 0.3 * sh,
          fade: { angle: -Math.PI / 2, start: 0.35 },
        });
      }
      paintBlooms(
        p,
        plant.blooms.map((f) => {
          const state = bloomState(g, f.bud, f.open);
          if (f.closed) state.open = Math.min(state.open, 0.12);
          return { bloom: f.bloom, state };
        }),
      );
    });
  },
};

export default treePeony;
