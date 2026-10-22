import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, shade, type Pigment } from '../../paint';
import { PHASES, lerp, ramp, stagger } from '../lib/shrub-growth';
import { HEAD_BUD, headFlorets, paintHeads, type Floret, type HeadPaint } from '../lib/shrub-heads';
import { groundShadow, inPlantSpace, paintBranches, paintClumps, paintLeaves, seedAndShoot } from '../lib/shrub-paint';
import { domeLeaves, domeScatter, growOutward, growSkeleton, type Branch, type Clump, type Leaf } from '../lib/shrub-structure';
import type { SpeciesDef } from '../types';

/** Mophead colours from acid (blue) through violet to alkaline (pink) soil. */
const BLUE = '#87a2df';
const VIOLET = '#a591d9';
const PINK = '#e39dbf';
const ROSE = '#d482ac';

function headColours(soil: number, rng: Rng): [Pigment, Pigment] {
  const s = Math.max(0, Math.min(1, soil + rng.gaussian(0, 0.12)));
  // two neighbouring hues per head so every mophead shades within itself
  if (s < 0.5) return [mix(BLUE, VIOLET, s * 2 * 0.7), mix(BLUE, VIOLET, Math.min(1, s * 2 + 0.45))];
  return [mix(VIOLET, PINK, (s - 0.5) * 2 * 0.8), mix(PINK, ROSE, Math.min(1, (s - 0.5) * 2 + 0.2))];
}

const LEAF = {
  light: mix(PIGMENTS.sageLight, '#b8c469', 0.5),
  mid: mix(PIGMENTS.sap, '#91a548', 0.35),
  shadow: mix(PIGMENTS.sage, PIGMENTS.olive, 0.35),
};

export interface Hydrangea {
  stems: Branch[];
  clumps: Clump[];
  leaves: Leaf[];
  heads: { x: number; y: number; r: number; a: Pigment; b: Pigment; florets: Floret[]; bud: [number, number]; open: [number, number]; seed: number; z: number }[];
  dome: { rx: number; ry: number; cx: number };
  seeds: { ground: number; sprout: number; shadow: number };
}

export function buildHydrangea(rng: Rng): Hydrangea {
  const lean = rng.range(-0.08, 0.08);
  const dome = { rx: rng.range(72, 82), ry: rng.range(78, 92), cx: lean * 30 };
  const soil = rng.fork('soil').range(0, 1);
  const stems = growSkeleton(rng, {
    stems: [5, 7],
    height: dome.ry * 0.9,
    spread: 1.5,
    lean,
    baseSpread: 8,
    levels: 1,
    branches: [1, 2],
    bend: 0.3,
    rise: 0.3,
    width: 2.4,
    window: [0.05, 0.4],
  });
  const clumps: Clump[] = [];
  const nC = rng.int(4, 5);
  for (let i = 0; i < nC; i++) {
    const u = i / (nC - 1) - 0.5;
    const [t0, t1] = stagger(i, nC, 0.14, 0.5, 0.55);
    const high = 1 - Math.abs(u) * 1.3;
    clumps.push({ x: dome.cx + u * dome.rx * 1.25 + rng.gaussian(0, 4), y: -dome.ry * (0.28 + 0.3 * high) + rng.gaussian(0, 3), r: dome.rx * rng.range(0.42, 0.52), t0, t1, seed: rng.int(1, 0x7fffffff) });
  }
  growOutward(clumps, { cx: dome.cx, rx: dome.rx * 1.1, ry: dome.ry, window: [0.18, 0.54], len: 0.2 });
  clumps.sort((a, b) => a.y - b.y);
  // broad oval leaves in opposite pairs
  const leaves = domeLeaves(rng, {
    rx: dome.rx * 0.92,
    ry: dome.ry * 0.78,
    cx: dome.cx,
    floor: 0.06,
    sprays: rng.int(14, 17),
    size: [17, 23],
    leaflets: [2, 3],
    fan: 1.2,
    petiole: 0.15,
    width: 0.55,
    curve: 0.15,
    window: [0.18, 0.54],
    pigments: LEAF,
    vary: (pg, r) => jitter(pg, r, 0.035),
  });
  leaves.forEach((l, i) => (l.group = i % 3));
  // mopheads over the upper dome, larger toward the top
  const pts = domeScatter(rng, rng.int(5, 8), { rx: dome.rx * 0.85, ry: dome.ry * 1.0, cx: dome.cx, floor: 0.3, spacing: 30 });
  const n = pts.length;
  const heads = pts.map((q, i) => {
    const [a, b] = headColours(soil, rng);
    const order = rng.range(0, 1);
    const [b0, b1] = stagger(Math.floor(order * n), n, PHASES.buds[0], PHASES.buds[1], 0.7);
    const [o0, o1] = stagger(Math.floor(order * n), n, PHASES.bloom[0] - 0.03, 1, 0.7);
    return {
      x: q.x,
      y: q.y,
      r: rng.range(15, 20) * (0.85 + 0.25 * Math.min(1, -q.y / dome.ry)),
      a,
      b,
      florets: headFlorets(rng, rng.int(44, 54), 0.19),
      bud: [b0, b1] as [number, number],
      open: [o0, o1] as [number, number],
      seed: rng.int(1, 0x7fffffff),
      z: q.z + i * 1e-3,
    };
  });
  return { stems, clumps, leaves, heads, dome, seeds: { ground: rng.int(1, 0x7fffffff), sprout: rng.int(1, 0x7fffffff), shadow: rng.int(1, 0x7fffffff) } };
}

const hydrangea: SpeciesDef = {
  id: 'hydrangea',
  name: 'Hydrangea',
  nativeName: 'Ajisai',
  tier: 3,
  habitats: ['meadow', 'shore', 'back'],
  sizeClass: 'large',
  size: { w: 200, h: 210 },
  anchor: { x: 0.5, y: 0.93 },
  description: 'Rain-season clouds that change colour with the soil.',
  bloomColor: '#989ddd',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildHydrangea(rng);
    const g = opts.growth;
    const { dome } = plant;
    inPlantSpace(p, opts, hydrangea, () => {
      groundShadow(p, plant.seeds.ground, g, dome.cx * 0.5, dome.rx * 0.85, 7, 0.2);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 16, green: LEAF.light });
      paintBranches(p, plant.stems, g, { pigment: mix(PIGMENTS.wood, PIGMENTS.sage, 0.3), inkFrom: 1, accent: 0.3, opacity: 0.8, hide: { keep: 0.4, at: [0.3, 0.55] } });
      paintClumps(p, plant.clumps, g, { light: LEAF.light, mid: LEAF.mid, shadow: LEAF.shadow, dark: PIGMENTS.olive }, { flatness: 0.72, opacity: 0.75, gaps: 0.35, shadow: 0.8 });
      paintLeaves(p, plant.leaves, g, { groups: 3, opacity: 0.78, edge: 0.4, darken: 0.25 });
      const sh = ramp(g, 0.25, 0.6);
      if (sh > 0.02) {
        p.glaze({ cx: dome.cx, cy: -dome.ry * 0.22, rx: dome.rx * 0.9 * (0.5 + 0.5 * sh), ry: dome.ry * 0.24 }, shade(LEAF.shadow, 0.45), {
          rng: createRng(plant.seeds.shadow),
          opacity: 0.3 * sh,
          fade: { angle: -Math.PI / 2, start: 0.35 },
        });
      }
      const heads: HeadPaint[] = [];
      for (const h of plant.heads) {
        const swell = ramp(g, h.bud[0], h.bud[1]);
        const open = ramp(g, h.open[0], h.open[1]);
        if (swell < 0.02) continue;
        // heads start as tight lime-green clusters and colour as they open
        const colour = open;
        heads.push({
          x: h.x,
          y: h.y,
          radius: h.r * (0.3 + 0.35 * swell + 0.35 * open),
          florets: h.florets,
          a: mix(HEAD_BUD, h.a, colour),
          b: mix(HEAD_BUD, h.b, colour),
          lobes: 4,
          alpha: lerp(0.5, 1, swell),
          seed: h.seed,
          eyes: 0.35 * open,
        });
      }
      paintHeads(p, heads, 2);
    });
  },
};

export default hydrangea;
