import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, blob, bounds, darken, deformPolygon, jitter, lighten, mix, padRect, type Painter, type Pt } from '../../paint';
import { PHASES, lerp, ramp, stagger } from '../lib/shrub-growth';
import { areaOf, bloomState, inPlantSpace, paintBlooms, ribbonInto, type Bloom } from '../lib/shrub-paint';
import type { SpeciesDef } from '../types';

/** Lotus leaves: waxy blue-green, paler at the rim. */
const PAD = { light: mix(PIGMENTS.sageLight, PIGMENTS.celadon, 0.45), mid: mix(PIGMENTS.sap, PIGMENTS.celadonMid, 0.5), deep: mix(PIGMENTS.sage, PIGMENTS.celadonDeep, 0.5) };
const STALK = mix(PIGMENTS.sage, PIGMENTS.olive, 0.5);
const PINK = { tip: '#f39bb5', base: '#fee9e4', bud: '#e680a1' };

export interface Pad {
  x: number;
  y: number;
  r: number;
  /** vertical squash of the leaf disc as seen (floating pads are flat on the water) */
  squash: number;
  /** height of the stalk above the water (0 = floating) */
  stalk: number;
  /** tilt of a raised leaf */
  roll: number;
  /** raised leaves cup upward (0 flat … 1 deep bowl) */
  cup: number;
  t0: number;
  t1: number;
  seed: number;
}

export interface Lotus {
  pads: Pad[];
  flowers: { base: Pt; bend: number; height: number; bloom: Bloom; bud: [number, number]; open: [number, number]; closed: boolean; seed: number }[];
  pod: { base: Pt; height: number; bend: number; r: number; window: [number, number]; seed: number } | null;
  first: { seed: number };
}

export function buildLotus(rng: Rng): Lotus {
  const pads: Pad[] = [];
  // floating pads spread over the water around the clump
  const nF = rng.int(3, 5);
  for (let i = 0; i < nF; i++) {
    const u = nF === 1 ? 0 : i / (nF - 1) - 0.5;
    const [t0, t1] = stagger(i, nF, 0.06, 0.4, 0.45);
    pads.push({ x: u * 120 + rng.gaussian(0, 8), y: rng.range(-4, 16), r: rng.range(19, 27), squash: rng.range(0.26, 0.34), stalk: 0, roll: rng.range(-0.06, 0.06), cup: 0, t0, t1, seed: rng.int(1, 0x7fffffff) });
  }
  // raised leaves standing on stalks
  const nR = rng.int(2, 4);
  for (let i = 0; i < nR; i++) {
    const u = nR === 1 ? 0 : i / (nR - 1) - 0.5;
    const [t0, t1] = stagger(i, nR, 0.14, 0.48, 0.5);
    pads.push({
      x: u * 110 + rng.gaussian(0, 8),
      y: rng.range(-4, 4),
      r: rng.range(20, 27),
      squash: rng.range(0.32, 0.46),
      stalk: rng.range(38, 78),
      roll: u * 0.5 + rng.range(-0.2, 0.2),
      cup: rng.range(0.3, 0.8),
      t0,
      t1,
      seed: rng.int(1, 0x7fffffff),
    });
  }
  // the blooms on tall stalks, above the leaves
  const nB = rng.int(1, 2);
  const extraBud = rng.chance(0.6);
  const flowers = Array.from({ length: nB + (extraBud ? 1 : 0) }, (_, i) => {
    const closed = extraBud && i === nB;
    const big = rng.range(0.92, 1.1);
    const slot = i - (nB + (extraBud ? 1 : 0) - 1) / 2;
    const base = { x: slot * 34 + rng.range(-8, 8), y: rng.range(-2, 4) };
    const height = closed ? rng.range(70, 95) : rng.range(100, 128);
    const bend = slot * rng.range(6, 16) + rng.range(-6, 6);
    const top = { x: base.x + bend, y: base.y - height };
    const [b0, b1] = stagger(i, nB + 1, PHASES.buds[0] - 0.04, PHASES.buds[1], 0.75);
    const [o0, o1] = stagger(Math.min(i, nB - 1), nB, PHASES.bloom[0], 1, 0.8);
    const bloom: Bloom = {
      x: top.x,
      y: top.y,
      view: rng.range(0.38, 0.6),
      roll: rng.range(-0.15, 0.15),
      rot: rng.range(0, Math.PI * 2),
      cupped: true,
      opaque: true,
      bud: mix(PAD.mid, PINK.bud, 0.35),
      sepals: 0,
      seed: rng.int(1, 0x7fffffff),
      rings: [
        { count: 6, length: 24 * big, width: 0.52, open: 1.2, pigment: PINK.base, tip: PINK.tip, offset: 0.08, curve: 0.12, lengthVar: 0.1, angleVar: 0.18, basePool: 0.1, variant: 'petal' },
        { count: 6, length: 22 * big, width: 0.5, open: 0.62, pigment: PINK.base, tip: PINK.tip, offset: 0.05, curve: 0.1, lengthVar: 0.1, angleVar: 0.2, basePool: 0.1, variant: 'petal' },
        { count: 4, length: 16 * big, width: 0.5, open: 0.3, pigment: PINK.base, tip: lighten(PINK.tip, 0.15), offset: 0.03, curve: 0.08, lengthVar: 0.1, angleVar: 0.25, basePool: 0.1, variant: 'petal' },
      ],
      centre: { kind: 'stamens', pigment: mix(PIGMENTS.gold, '#ccc743', 0.5), size: 7 * big, count: 12 },
    };
    return { base, bend, height, bloom, bud: [b0, b1] as [number, number], open: [o0, o1] as [number, number], closed, seed: rng.int(1, 0x7fffffff) };
  });
  // a seed pod from an earlier flower
  const pod = rng.chance(0.85)
    ? { base: { x: rng.range(-50, 50), y: rng.range(-2, 4) }, height: rng.range(92, 120), bend: rng.range(-18, 18), r: rng.range(8, 10), window: [0.5, 0.82] as [number, number], seed: rng.int(1, 0x7fffffff) }
    : null;
  return { pads, flowers, pod, first: { seed: rng.int(1, 0x7fffffff) } };
}

function stalkPath(base: Pt, height: number, bend: number): Pt[] {
  return [base, { x: base.x + bend * 0.15, y: base.y - height * 0.35 }, { x: base.x + bend * 0.55, y: base.y - height * 0.72 }, { x: base.x + bend, y: base.y - height }];
}

/** All stalks rising out of the water, in one wet layer. */
function paintStalks(p: Painter, stalks: { path: Pt[]; width: number; seed: number }[]): void {
  if (!stalks.length) return;
  const L = p.layer(areaOf(stalks.map((s) => s.path), 5));
  for (const s of stalks) ribbonInto(L, s.path, s.width, STALK, createRng(s.seed), { taper: [0, 0.12], endWidth: 0.6, pressure: (t) => 1 - t * 0.2 });
  L.dry({ opacity: 0.85, edge: 0.4, edgeWidth: 0.6, sharpness: 0.7, centreLift: 0.15, granulation: 0.15, flowScale: 14 });
}

/** Where a pad sits and how big it is at growth fraction `k` (a young leaf unrolls). */
function padGeom(pad: Pad, k: number) {
  const rx = pad.r * (0.25 + 0.75 * k);
  const ry = rx * pad.squash * lerp(1.6, 1, k);
  return { rx, ry, c: { x: pad.x, y: pad.y - pad.stalk * ramp(k, 0, 0.6) } };
}

/**
 * Lotus leaves: waxy discs with a pale rim and a darker heart flooded in wet-in-wet, raised
 * ones cupped like shallow bowls showing their cooler underside, faint radial veins on top.
 * Alternate leaves share wet layers so overlapping neighbours keep their edges.
 */
function paintPads(p: Painter, pads: { pad: Pad; k: number }[]): void {
  if (!pads.length) return;
  const geo = pads.map(({ pad, k }) => ({ pad, k, ...padGeom(pad, k) }));
  const area = (set: typeof geo) => padRect(bounds(set.flatMap((q) => [{ x: q.c.x - q.rx, y: q.c.y - q.ry }, { x: q.c.x + q.rx, y: q.c.y + q.ry + q.rx * 0.35 }])), 4);
  // undersides of the cupped leaves
  const cups = geo.filter((q) => q.pad.cup * ramp(q.k, 0.3, 1) > 0.02);
  if (cups.length) {
    const U = p.layer(area(cups));
    for (const q of cups) {
      const rng = createRng(q.pad.seed + 1);
      const depth = q.rx * 0.32 * q.pad.cup * ramp(q.k, 0.3, 1);
      const under: Pt[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI;
        under.push({ x: q.c.x + Math.cos(a) * q.rx * 0.98, y: q.c.y + Math.sin(a) * (q.ry + depth * Math.sin(a)) });
      }
      for (let i = 16; i >= 0; i--) {
        const a = (i / 16) * Math.PI;
        under.push({ x: q.c.x + Math.cos(a) * q.rx * 0.98, y: q.c.y + Math.sin(a) * q.ry * 0.2 });
      }
      for (let j = 0; j < 3; j++) U.fill(deformPolygon(under, rng, { depth: 2, variance: 0.06 }), mix(PAD.deep, PIGMENTS.celadonDeep, 0.3), 0.45);
    }
    U.dry({ opacity: 0.75, edge: 0.5, edgeWidth: 1, flowScale: 14 });
  }
  // the leaf faces, in two alternating sets
  for (let gi = 0; gi < 2; gi++) {
    const set = geo.filter((_, i) => i % 2 === gi);
    if (!set.length) continue;
    const L = p.layer(area(set));
    for (const q of set) {
      const rng = createRng(q.pad.seed);
      const shape = blob(q.c.x, q.c.y, q.rx, q.ry, rng, { points: 30, irregularity: 0.08, rotation: q.pad.roll * 0.4 });
      const a = 0.85 * lerp(0.6, 1, q.k);
      for (let j = 0; j < 3; j++) L.fill(deformPolygon(shape, rng, { depth: 2, variance: 0.05 }), jitter(PAD.light, rng, 0.02), a * 0.5);
      // deeper green flooded into the heart and the near side, wet-in-wet
      const heart = blob(q.c.x + q.rx * 0.05, q.c.y + q.ry * 0.25, q.rx * 0.78, q.ry * 0.62, rng, { points: 22, irregularity: 0.2 });
      for (let j = 0; j < 3; j++) L.fill(deformPolygon(heart, rng, { depth: 2, variance: 0.12 }), jitter(PAD.deep, rng, 0.03), a * 0.28);
      if (rng.chance(0.4)) {
        // a backrun bloom
        const r = q.rx * rng.range(0.15, 0.25);
        L.lift(blob(q.c.x + rng.range(-0.5, 0.5) * q.rx, q.c.y + rng.range(-0.3, 0.3) * q.ry, r, r * q.pad.squash * 1.6, rng, { points: 20, scallop: 1, scallops: 7 }), 0.4);
      }
    }
    L.dry({ opacity: 0.9, edge: 0.55, edgeWidth: 1.1, sharpness: 0.65, centreLift: 0.2, granulation: 0.2, flowScale: 16 });
  }
  // radial veins and the dimple where the stalk meets the leaf
  const veined = geo.filter((q) => q.k > 0.4);
  if (veined.length) {
    const V = p.layer(area(veined));
    for (const q of veined) {
      const rng = createRng(q.pad.seed + 2);
      const n = rng.int(7, 10);
      const vk = ramp(q.k, 0.4, 1);
      for (let i = 0; i < n; i++) {
        if (rng.chance(0.25)) continue; // some veins are lost
        const a = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
        const r0 = rng.range(0.08, 0.2);
        const r1 = rng.range(0.6, 0.82);
        const from = { x: q.c.x + Math.cos(a) * q.rx * r0, y: q.c.y + Math.sin(a) * q.ry * r0 };
        const to = { x: q.c.x + Math.cos(a) * q.rx * r1, y: q.c.y + Math.sin(a) * q.ry * r1 };
        ribbonInto(V, [from, to], 0.55 * vk, darken(PAD.deep, 0.15), rng, { taper: [0.3, 0.5], fills: 1, coverage: 0.5 });
      }
      V.fill(blob(q.c.x, q.c.y, 1.3 * vk, 0.9 * vk, rng, { points: 9 }), darken(PAD.deep, 0.25), 0.6);
    }
    V.dry({ opacity: 0.7, edge: 0.3, edgeWidth: 0.4, sharpness: 0.7, flowScale: 6 });
  }
}

function paintPod(p: Painter, pod: NonNullable<Lotus['pod']>, g: number): void {
  const k = ramp(g, pod.window[0], pod.window[1]);
  if (k < 0.02) return;
  const rng = createRng(pod.seed);
  const h = pod.height * (0.3 + 0.7 * k);
  const top = stalkPath(pod.base, h, pod.bend * k)[3]!;
  const r = pod.r * (0.4 + 0.6 * k);
  // inverted cone, flat top; green turning to olive-ochre as it ripens
  const body = mix('#b8b669', '#af934a', ramp(g, 0.8, 1));
  const cone: Pt[] = [
    { x: top.x - r, y: top.y - r * 0.55 },
    { x: top.x + r, y: top.y - r * 0.6 },
    { x: top.x + r * 0.45, y: top.y + r * 0.25 },
    { x: top.x, y: top.y + r * 0.45 },
    { x: top.x - r * 0.5, y: top.y + r * 0.22 },
  ];
  p.wash(cone, body, { rng, opacity: 0.88, edge: 0.6, blend: 'source-over' });
  p.wash({ cx: top.x, cy: top.y - r * 0.58, rx: r * 0.98, ry: r * 0.3 }, lighten(body, 0.25), { rng, opacity: 0.9, edge: 0.5, blend: 'source-over' });
  // seed holes in the flat top
  const holes = rng.int(6, 9);
  const L = p.layer({ x: top.x - r, y: top.y - r, w: r * 2, h: r * 0.9 });
  for (let i = 0; i < holes; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 0.7;
    L.fill(blob(top.x + Math.cos(a) * r * d, top.y - r * 0.58 + Math.sin(a) * r * 0.25 * d, r * 0.1, r * 0.07, rng, { points: 8 }), darken(body, 0.45), 0.9);
  }
  L.dry({ opacity: 0.75 * ramp(k, 0.5, 1), edge: 0.3, sharpness: 0.6 });
}

const lotus: SpeciesDef = {
  id: 'lotus',
  name: 'Lotus',
  nativeName: 'Hasu',
  // still ponds and marshes
  range: { realms: ['japan', 'east-asia'], biomes: ['wetland'], climates: ['warm-temperate'], cultivatedIn: ['japan'] },
  tier: 3,
  habitats: ['water'],
  sizeClass: 'large',
  size: { w: 200, h: 220 },
  anchor: { x: 0.5, y: 0.84 },
  description: 'It rises clean from the mud and opens at dawn.',
  bloomColor: '#f5a0b7',
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildLotus(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, lotus, () => {
      // first a rolled leaf breaking the surface, with a ring of ripples
      const first = createRng(plant.first.seed);
      const rip = 1 - ramp(g, 0.25, 0.5);
      if (rip > 0.02) p.ripple({ x: 0, y: 2 }, { rng: first, width: 26 + 40 * ramp(g, 0, 0.3), count: 2, opacity: 0.4 * rip });
      // floating leaves (far ones first), stalks, raised leaves, the pod, then the flowers
      const floating = plant.pads.filter((pd) => pd.stalk === 0).sort((a, b) => a.y - b.y);
      const raised = plant.pads.filter((pd) => pd.stalk > 0);
      const grown = (list: Pad[]) => list.map((pad) => ({ pad, k: ramp(g, pad.t0, pad.t1) })).filter((x) => x.k > 0.02);
      paintPads(p, grown(floating));
      const stalks: { path: Pt[]; width: number; seed: number }[] = [];
      for (const { pad, k } of grown(raised)) {
        const h = pad.stalk * ramp(k, 0, 0.6);
        stalks.push({ path: [{ x: pad.x, y: pad.y }, { x: pad.x + pad.roll * 6, y: pad.y - h * 0.5 }, { x: pad.x, y: pad.y - h }], width: 1.8, seed: pad.seed + 3 });
      }
      const pod = plant.pod;
      const podK = pod ? ramp(g, pod.window[0], pod.window[1]) : 0;
      if (pod && podK > 0.02) stalks.push({ path: stalkPath(pod.base, pod.height * (0.3 + 0.7 * podK), pod.bend * podK), width: 2, seed: pod.seed + 1 });
      const opened: { bloom: Bloom; state: ReturnType<typeof bloomState> }[] = [];
      for (const f of plant.flowers) {
        const state = bloomState(g, f.bud, f.open);
        if (f.closed) state.open = Math.min(state.open, 0.1);
        if (state.size < 0.02) continue;
        // the stalk rises with the bud
        const rise = ramp(g, f.bud[0] - 0.05, f.bud[1]);
        const path = stalkPath(f.base, f.height * (0.25 + 0.75 * rise), f.bend * rise);
        stalks.push({ path, width: 2.2, seed: f.seed });
        const top = path[path.length - 1]!;
        opened.push({ bloom: { ...f.bloom, x: top.x, y: top.y }, state });
      }
      paintStalks(p, stalks);
      paintPads(p, grown(raised));
      if (pod) paintPod(p, pod, g);
      paintBlooms(p, opened);
      // a few water lines where the stalks enter the pond
      const wl = ramp(g, 0.2, 0.5);
      if (wl > 0.02) {
        for (const f of [...plant.flowers.map((x) => x.base), ...raised.map((pd) => ({ x: pd.x, y: pd.y }))].slice(0, 3)) {
          p.ripple({ x: f.x, y: f.y + 1 }, { rng: createRng(Math.round(f.x * 13 + 7)), width: 16, count: 1, opacity: 0.35 * wl, squash: 0.15 });
        }
      }
    });
  },
};

export default lotus;
