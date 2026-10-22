import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, deformPolygon, jitter, layerAlpha, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { PHASES, lerp, ramp, stagger } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, paintClumps, paintLeaves, seedAndShoot } from '../lib/shrub-paint';
import { domeLeaves, domeScatter, growOutward, growSkeleton, type Branch, type Clump, type Leaf } from '../lib/shrub-structure';
import { paintBranches } from '../lib/shrub-paint';
import type { SpeciesDef } from '../types';

/** Colourways: [ray florets, deeper inner rays, disc]. */
const COLOURWAYS: { ray: Pigment; inner: Pigment; disc: Pigment; opaque: boolean }[] = [
  { ray: '#f1c255', inner: '#df9e13', disc: '#c48600', opaque: true }, // gold
  { ray: '#e69458', inner: '#cd6f36', disc: '#a55723', opaque: true }, // rust / bronze
  { ray: '#fbf5e9', inner: '#f1e6d1', disc: '#ccc577', opaque: true }, // white, green-gold eye
  { ray: '#eaa4bb', inner: '#d483a0', disc: '#bc8744', opaque: true }, // mauve pink
];

/** Grey-green, deeply lobed foliage. */
const LEAF = { light: mix(PIGMENTS.sap, '#a3b26d', 0.5), mid: mix(PIGMENTS.sage, '#7d914c', 0.4), shadow: mix(PIGMENTS.sage, PIGMENTS.olive, 0.7), dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.25) };

export interface MumBloom {
  x: number;
  y: number;
  r: number;
  rays: number;
  rot: number;
  squash: number;
  tilt: number;
  ray: Pigment;
  inner: Pigment;
  bud: [number, number];
  open: [number, number];
  seed: number;
  z: number;
}

export interface Chrysanthemum {
  stems: Branch[];
  clumps: Clump[];
  leaves: Leaf[];
  blooms: MumBloom[];
  colour: (typeof COLOURWAYS)[number];
  dome: { rx: number; ry: number; cx: number };
  seeds: { ground: number; sprout: number; shadow: number };
}

/** A ray-floret rosette: `rays` narrow petals as one star outline (pure). */
export function rayStar(c: Pt, r: number, rays: number, rot: number, squash: number, tilt: number, rng: Rng, inner = 0.3): Pt[] {
  const n = rays * 6;
  const jit = Array.from({ length: rays }, () => rng.range(0.72, 1.12));
  const out: Pt[] = [];
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const k = Math.floor((i / n) * rays);
    // narrow rounded rays with deep notches between them
    const w = Math.abs(Math.cos((th * rays) / 2));
    const rr = r * jit[k]! * (inner + (1 - inner) * w ** 0.6);
    const x = Math.cos(th + rot) * rr;
    const y = Math.sin(th + rot) * rr * squash;
    out.push({ x: c.x + x * ct - y * st, y: c.y + x * st + y * ct });
  }
  return out;
}

export function buildChrysanthemum(rng: Rng): Chrysanthemum {
  const dome = { rx: rng.range(48, 55), ry: rng.range(46, 54), cx: rng.range(-3, 3) };
  const colour = COLOURWAYS[rng.fork('colour').int(0, COLOURWAYS.length - 1)]!;
  const stems = growSkeleton(rng, { stems: [5, 7], height: dome.ry * 0.85, spread: 1.6, baseSpread: 5, levels: 1, branches: [1, 2], bend: 0.2, rise: 0.4, width: 1.6, window: [0.05, 0.38] });
  const clumps: Clump[] = [];
  const nC = rng.int(4, 5);
  for (let i = 0; i < nC; i++) {
    const u = i / (nC - 1) - 0.5;
    const [t0, t1] = stagger(i, nC, 0.14, 0.48, 0.55);
    clumps.push({ x: dome.cx + u * dome.rx * 1.2 + rng.gaussian(0, 3), y: -dome.ry * (0.24 + 0.32 * (1 - Math.abs(u) * 1.5)), r: dome.rx * rng.range(0.44, 0.54), t0, t1, seed: rng.int(1, 0x7fffffff) });
  }
  growOutward(clumps, { cx: dome.cx, rx: dome.rx * 1.1, ry: dome.ry, window: [0.16, 0.52], len: 0.2 });
  clumps.sort((a, b) => a.y - b.y);
  const leaves = domeLeaves(rng, {
    rx: dome.rx * 0.82,
    ry: dome.ry * 0.5,
    cx: dome.cx,
    floor: 0.04,
    sprays: rng.int(9, 12),
    size: [8, 11],
    leaflets: [1, 1],
    lobes: [2, 3],
    width: 0.45,
    window: [0.16, 0.48],
    pigments: LEAF,
    vary: (pg, r) => jitter(pg, r, 0.03),
  });
  leaves.forEach((l, i) => (l.group = i % 2));
  // the cushion of blooms: dense over the top, thinning down the sides
  const pts = domeScatter(rng, rng.int(34, 42), { rx: dome.rx * 0.88, ry: dome.ry * 0.92, cx: dome.cx, floor: 0.24, spacing: 8 });
  const n = pts.length;
  const blooms = pts.map((q) => {
    const order = Math.floor(rng.range(0, 1) * n);
    const [b0, b1] = stagger(order, n, PHASES.buds[0], PHASES.buds[1], 0.5);
    const [o0, o1] = stagger(order, n, PHASES.bloom[0] - 0.02, 1, 0.45);
    const h = -q.y / dome.ry;
    return {
      x: q.x,
      y: q.y,
      r: rng.range(5.2, 7),
      rays: rng.int(13, 17),
      rot: rng.range(0, Math.PI * 2),
      // blooms on top face the sky, those on the sides face out
      squash: lerp(0.95, 0.55, h) * rng.range(0.9, 1.05),
      tilt: (q.x - dome.cx) / dome.rx * 0.35,
      ray: jitter(colour.ray, rng, 0.03),
      inner: jitter(colour.inner, rng, 0.03),
      bud: [b0, b1] as [number, number],
      open: [o0, o1] as [number, number],
      seed: rng.int(1, 0x7fffffff),
      z: q.z,
    };
  });
  return { stems, clumps, leaves, blooms, colour, dome, seeds: { ground: rng.int(1, 0x7fffffff), sprout: rng.int(1, 0x7fffffff), shadow: rng.int(1, 0x7fffffff) } };
}

/** Paint all blooms in a few depth batches: rays, inner rays and discs each share a wet layer. */
function paintBlooms(p: Painter, plant: Chrysanthemum, g: number): void {
  const { colour } = plant;
  const live = plant.blooms
    .map((b) => ({ b, swell: ramp(g, b.bud[0], b.bud[1]), open: ramp(g, b.open[0], b.open[1]) }))
    .filter((x) => x.swell > 0.02);
  if (!live.length) return;
  const batches = 3;
  const blend: GlobalCompositeOperation = colour.opaque ? 'source-over' : 'multiply';
  const budGreen = mix(LEAF.mid, colour.inner, 0.25);
  for (let k = 0; k < batches; k++) {
    const set = live.filter((_, i) => Math.floor((i * batches) / live.length) === k);
    if (!set.length) continue;
    const area = (pad: number) => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const { b } of set) {
        x0 = Math.min(x0, b.x - b.r - pad);
        y0 = Math.min(y0, b.y - b.r - pad);
        x1 = Math.max(x1, b.x + b.r + pad);
        y1 = Math.max(y1, b.y + b.r + pad);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    // outer rays
    const L = p.layer(area(3));
    const aL = layerAlpha(2, 0.9);
    for (const { b, swell, open } of set) {
      const rng = createRng(b.seed);
      const r = b.r * (0.3 + 0.2 * swell + 0.5 * open);
      const star = rayStar(b, r, b.rays, b.rot, b.squash, b.tilt, rng, lerp(0.85, 0.3, open));
      const pig = mix(budGreen, lighten(b.ray, 0.04), open);
      for (let j = 0; j < 2; j++) L.fill(deformPolygon(star, rng, { depth: 1, variance: 0.08 }), pig, aL);
    }
    L.dry({ opacity: 0.92, edge: 0.4, edgeWidth: 0.6, sharpness: 0.65, centreLift: 0.25, flowScale: 6, darken: 0.3, blend });
    // inner rays: a smaller, deeper rosette turned half a petal, dried separately so it reads
    const I = p.layer(area(2));
    for (const { b, open } of set) {
      if (open < 0.15) continue;
      const rng = createRng(b.seed + 1);
      const star = rayStar(b, b.r * 0.62 * open, Math.max(8, b.rays - 4), b.rot + Math.PI / b.rays, b.squash, b.tilt, rng, 0.35);
      I.fill(star, mix(budGreen, b.inner, open), 0.85);
    }
    I.dry({ opacity: 0.85, edge: 0.5, edgeWidth: 0.6, sharpness: 0.7, centreLift: 0.15, flowScale: 5, darken: 0.35, blend });
    // discs
    const D = p.layer(area(2));
    for (const { b, open } of set) {
      const rng = createRng(b.seed + 2);
      const r = b.r * lerp(0.42, 0.22, open);
      const disc = rayStar(b, r, 9, rng.range(0, 6), b.squash, b.tilt, rng, 0.75);
      D.fill(disc, open > 0.3 ? mix(budGreen, colour.disc, open) : shade(budGreen, 0.15), 0.9);
    }
    D.dry({ opacity: 0.9, edge: 0.5, edgeWidth: 0.5, sharpness: 0.65, granulation: 0.4, flowScale: 4, blend: 'source-over' });
  }
}

const chrysanthemum: SpeciesDef = {
  id: 'chrysanthemum',
  name: 'Chrysanthemum',
  nativeName: 'Kiku',
  tier: 3,
  habitats: ['meadow', 'path'],
  sizeClass: 'medium',
  size: { w: 125, h: 110 },
  anchor: { x: 0.5, y: 0.92 },
  description: 'An autumn cushion of small suns, kept for the long year.',
  bloomColor: '#edb946',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildChrysanthemum(rng);
    const g = opts.growth;
    const { dome } = plant;
    inPlantSpace(p, opts, chrysanthemum, () => {
      groundShadow(p, plant.seeds.ground, g, dome.cx, dome.rx * 0.9, 5, 0.22);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 12, green: LEAF.light });
      paintBranches(p, plant.stems, g, { pigment: mix(PIGMENTS.sage, PIGMENTS.olive, 0.6), inkFrom: 1, accent: 0, opacity: 0.8, hide: { keep: 0.12, at: [0.25, 0.5] } });
      paintClumps(p, plant.clumps, g, LEAF, { flatness: 0.7, opacity: 0.78, dabSize: 0.17, gaps: 0.35, shadow: 0.8 });
      paintLeaves(p, plant.leaves, g, { groups: 2, opacity: 0.75, edge: 0.4 });
      const sh = ramp(g, 0.25, 0.55);
      if (sh > 0.02) {
        p.glaze({ cx: dome.cx + 3, cy: -dome.ry * 0.2, rx: dome.rx * 0.9 * (0.5 + 0.5 * sh), ry: dome.ry * 0.28 }, shade(LEAF.shadow, 0.5), {
          rng: createRng(plant.seeds.shadow),
          opacity: 0.3 * sh,
          fade: { angle: -Math.PI / 2, start: 0.3 },
        });
      }
      paintBlooms(p, plant, g);
    });
  },
};

export default chrysanthemum;
