import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, mix, shade, type Pigment, type Pt } from '../../paint';
import { PHASES, lerp, ramp, stagger } from '../lib/shrub-growth';
import { headFlorets, paintHeads, type Floret, type HeadPaint } from '../lib/shrub-heads';
import { groundShadow, inPlantSpace, paintBranches, paintClumps, seedAndShoot } from '../lib/shrub-paint';
import { domeScatter, growOutward, growSkeleton, type Branch, type Clump } from '../lib/shrub-structure';
import type { SpeciesDef } from '../types';

/** Blossom colourways: [lit, deep] — the classic magenta, soft pink, coral and a white form. */
const COLOURWAYS: [Pigment, Pigment][] = [
  ['#f39abe', '#d96fa2'], // magenta-pink
  ['#f39abe', '#d96fa2'],
  ['#f9b7c2', '#eb8fa6'], // soft pink
  ['#faac9a', '#e78375'], // coral
  ['#faf1ea', '#eec2d0'], // white, flushed pink
];

/** Small, dark, glossy evergreen leaves. */
const LEAF = { light: mix(PIGMENTS.sap, '#9db056', 0.4), mid: mix(PIGMENTS.sage, PIGMENTS.olive, 0.25), shadow: PIGMENTS.olive, dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.35) };

export interface Azalea {
  twigs: Branch[];
  clumps: Clump[];
  patches: { x: number; y: number; r: number; florets: Floret[]; bud: [number, number]; open: [number, number]; seed: number }[];
  stamens: { at: Pt; dir: number; len: number; seed: number; open: [number, number] }[];
  colour: [Pigment, Pigment];
  mound: { rx: number; ry: number; cx: number };
  seeds: { ground: number; sprout: number; shadow: number };
}

export function buildAzalea(rng: Rng): Azalea {
  const mound = { rx: rng.range(54, 62), ry: rng.range(46, 56), cx: rng.range(-3, 3) };
  const colour = COLOURWAYS[rng.fork('colour').int(0, COLOURWAYS.length - 1)]!;
  // a few short dark twigs that the clipped mound grows over
  const twigs = growSkeleton(rng, { stems: [4, 6], height: mound.ry * 0.7, spread: 1.7, baseSpread: 6, levels: 1, branches: [1, 2], bend: 0.3, rise: 0.2, width: 2, window: [0.05, 0.3] });
  // the clipped mound: overlapping cloud-pads, the lowest first
  const clumps: Clump[] = [];
  const pads = domeScatter(rng, rng.int(6, 8), { rx: mound.rx * 0.72, ry: mound.ry * 0.72, cx: mound.cx, floor: 0.15, spacing: 18 });
  pads.sort((a, b) => b.y - a.y);
  pads.forEach((q, i) => {
    const [t0, t1] = stagger(i, pads.length, 0.12, 0.5, 0.45);
    clumps.push({ x: q.x, y: q.y, r: mound.rx * rng.range(0.36, 0.46), t0, t1, seed: rng.int(1, 0x7fffffff) });
  });
  clumps.push({ x: mound.cx, y: -mound.ry * 0.42, r: mound.rx * 0.62, t0: 0.18, t1: 0.48, seed: rng.int(1, 0x7fffffff) });
  growOutward(clumps, { cx: mound.cx, rx: mound.rx, ry: mound.ry, window: [0.14, 0.52], len: 0.2 });
  clumps.sort((a, b) => a.y - b.y);
  // blossom patches covering the mound, most on the top and the lit side
  const centres = domeScatter(rng, rng.int(17, 21), { rx: mound.rx * 0.84, ry: mound.ry * 0.88, cx: mound.cx, floor: 0.16, spacing: 11.5 });
  const n = centres.length;
  const patches = centres.map((q) => {
    const order = Math.floor(rng.range(0, 1) * n);
    const [b0, b1] = stagger(order, n, PHASES.buds[0], PHASES.buds[1], 0.6);
    const [o0, o1] = stagger(order, n, PHASES.bloom[0] - 0.02, 1, 0.55);
    return { x: q.x, y: q.y, r: rng.range(11, 14) * (0.85 + 0.2 * (-q.y / mound.ry)), florets: headFlorets(rng, rng.int(6, 8), 0.33), bud: [b0, b1] as [number, number], open: [o0, o1] as [number, number], seed: rng.int(1, 0x7fffffff) };
  });
  // a few long curving stamens catching the light
  const stamens = patches
    .filter(() => rng.chance(0.45))
    .map((pt) => ({ at: { x: pt.x + rng.range(-0.4, 0.4) * pt.r, y: pt.y + rng.range(-0.3, 0.3) * pt.r }, dir: -Math.PI / 2 + rng.range(-1, 1), len: rng.range(5, 8), seed: rng.int(1, 0x7fffffff), open: pt.open }));
  return { twigs, clumps, patches, stamens, colour, mound, seeds: { ground: rng.int(1, 0x7fffffff), sprout: rng.int(1, 0x7fffffff), shadow: rng.int(1, 0x7fffffff) } };
}

const azalea: SpeciesDef = {
  id: 'azalea',
  name: 'Azalea',
  nativeName: 'Tsutsuji',
  // wild satsuki: river rocks of warm south-western Japan
  range: { realms: ['japan'], biomes: ['montane-stream'], climates: ['warm-temperate'], cultivatedIn: ['japan'] },
  tier: 3,
  habitats: ['meadow', 'rock', 'path'],
  sizeClass: 'medium',
  size: { w: 140, h: 120 },
  anchor: { x: 0.5, y: 0.9 },
  description: 'A clipped green cloud that turns to blossom overnight.',
  bloomColor: '#e77ca9',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildAzalea(rng);
    const g = opts.growth;
    const { mound, colour } = plant;
    inPlantSpace(p, opts, azalea, () => {
      groundShadow(p, plant.seeds.ground, g, mound.cx, mound.rx * 0.95, 6, 0.24);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 13, green: LEAF.light });
      paintBranches(p, plant.twigs, g, { pigment: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.3), inkFrom: 1, accent: 0, opacity: 0.85, hide: { keep: 0.12, at: [0.22, 0.45] } });
      paintClumps(p, plant.clumps, g, LEAF, { flatness: 0.7, opacity: 0.85, dabSize: 0.19, gaps: 0.25, shadow: 0.85 });
      const sh = ramp(g, 0.25, 0.55);
      if (sh > 0.02) {
        p.glaze({ cx: mound.cx + 4, cy: -mound.ry * 0.2, rx: mound.rx * 0.95 * (0.5 + 0.5 * sh), ry: mound.ry * 0.3 }, shade(LEAF.shadow, 0.5), {
          rng: createRng(plant.seeds.shadow),
          opacity: 0.32 * sh,
          fade: { angle: -Math.PI / 2, start: 0.3 },
        });
      }
      const heads: HeadPaint[] = [];
      for (const pt of plant.patches) {
        const swell = ramp(g, pt.bud[0], pt.bud[1]);
        const open = ramp(g, pt.open[0], pt.open[1]);
        if (swell < 0.02) continue;
        const bud = mix(LEAF.light, colour[1], 0.45);
        heads.push({
          x: pt.x,
          y: pt.y,
          radius: pt.r * lerp(0.35, 1, 0.3 * swell + 0.7 * open),
          squash: 0.8,
          florets: pt.florets,
          a: mix(bud, colour[0], open),
          b: mix(bud, colour[1], open),
          lobes: 5,
          scallop: 2.4,
          alpha: lerp(0.55, 1, swell),
          seed: pt.seed,
          body: false,
          eyes: 0.4 * open,
        });
      }
      paintHeads(p, heads, 1);
      for (const s of plant.stamens) {
        const k = ramp(g, s.open[0] + 0.05, s.open[1]);
        if (k < 0.05) continue;
        const r = createRng(s.seed);
        const tip = { x: s.at.x + Math.cos(s.dir) * s.len * k, y: s.at.y + Math.sin(s.dir) * s.len * k };
        const mid = { x: (s.at.x + tip.x) / 2 + r.range(-1, 1), y: (s.at.y + tip.y) / 2 - 1 };
        p.inkLine([s.at, mid, tip], { rng: r, width: 0.55, opacity: 0.55 * k, pigment: shade(colour[1], 0.4), breaks: 0, taper: [0.1, 0.1] });
      }
    });
  },
};

export default azalea;
