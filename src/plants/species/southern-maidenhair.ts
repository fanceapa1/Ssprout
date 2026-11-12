import type { Rng } from '../../core/rng';
import { jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { dampSeep, fanLeaflets, wireStalks, type FanLeaflet, type FanShape } from '../lib/southern-maidenhair-paint';
import { clamp01, ease, lerp, phase, smooth, stagger, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Southern maidenhair (Venus-hair fern): a clump of hair-fine black-purple stalks spilling from a
 * damp seep, arching over and hanging, with many small lobed fan-shaped leaflets on hair stalks in
 * a fresh, translucent pale green; the oldest fronds roll their margins over pale-brown sori.
 */

const LEAF = '#a4cc68';
const LEAF_PALE = '#c4d99a';
const LEAF_DEEP = '#5f8a4c';
const COOL = '#8fb39a';
const STIPE = '#3b2a35';
const SORUS = '#bc9b6c';
// the design box round the base (anchor 0.5, 0.6): x ±35, y −42 … 28
const BOX = { x: 33, top: -40, bottom: 26 };

interface Leaflet {
  t: number;
  side: 1 | -1;
  size: number;
  stalk: number;
  /** how far the leaflet swings from its stalk's line toward hanging straight down */
  hang: number;
  shape: FanShape;
  tone: Pigment;
  light: boolean;
  fertile: boolean;
  wob: number;
}

interface Pinna {
  t: number;
  side: 1 | -1;
  length: number;
  droop: number;
  leaflets: Leaflet[];
  tip: Leaflet;
}

interface Frond {
  stem: StemPlan;
  window: [number, number];
  pinnae: Pinna[];
  tip: Leaflet;
  depth: number;
}

export interface SouthernMaidenhairPlan {
  fronds: Frond[];
  moss: Pt[];
}

function makeLeaflet(rng: Rng, t: number, side: 1 | -1, size: number, tone: Pigment, fertile: boolean): Leaflet {
  const fert = fertile && rng.chance(0.5);
  return {
    t,
    side,
    size,
    stalk: rng.range(0.5, 1.1),
    hang: rng.range(0.3, 0.6),
    shape: { spread: rng.range(0.72, 1.02), lobes: rng.int(2, 4), notch: fert ? rng.range(0.06, 0.12) : rng.range(0.16, 0.3), teeth: fert ? 0.01 : rng.range(0.02, 0.045), skew: side * rng.range(0, 0.25) },
    tone: jitter(mix(tone, LEAF_PALE, rng.range(0, 0.3)), rng, 0.03),
    light: rng.chance(0.4),
    fertile: fert,
    wob: rng.next(),
  };
}

/** A pinna's wiry branch: it leaves the rachis and drapes toward the ground (turning by cos, so a
 * branch pointing straight up never flips side). */
function drapePath(at: Pt, angle: number, length: number, droop: number, n = 4): { pts: Pt[]; angle: number } {
  const pts: Pt[] = [{ x: at.x, y: at.y }];
  let a = angle;
  let x = at.x;
  let y = at.y;
  for (let i = 0; i < n; i++) {
    x += (Math.cos(a) * length) / n;
    y += (Math.sin(a) * length) / n;
    pts.push({ x, y });
    a += (droop / n) * Math.cos(a);
  }
  return { pts, angle: a };
}

export interface FrondPose {
  stipe: Pt[];
  wires: { pts: Pt[]; width: number }[];
  leaflets: FanLeaflet[];
}

function leafletPose(key: string, q: Leaflet, base: Pt, dir: number, k: number, sori: number): { leaf: FanLeaflet; stalk: Pt[] } {
  const angle = dir + q.hang * lerp(0.4, 1, k) * Math.cos(dir) * 1.3;
  const end = { x: base.x + Math.cos(angle) * q.stalk * k, y: base.y + Math.sin(angle) * q.stalk * k };
  return {
    leaf: { key, at: end, angle, size: q.size * k, open: k, shape: q.shape, tone: q.tone, light: q.light, sori: q.fertile ? sori * k : 0, wob: q.wob },
    stalk: [base, end],
  };
}

/**
 * The frond at extent `e` (0 … 1 of its own growth): a fiddlehead that unrolls as the stalk
 * lengthens and droops, the pinnae opening behind the uncurling tip. Pure, for the tests.
 */
export function frondPose(f: Frond, e: number, sori = 0): FrondPose | null {
  if (!visible(e)) return null;
  // the crozier stands up quickly, tightly rolled, then unrolls as the frond lengthens and droops
  const roll = 1 - smooth(phase(e, 0.22, 0.9));
  const droop = lerp(0.25, 1, smooth(phase(e, 0.1, 1)));
  const n = f.stem.bends.length;
  const sign = Math.sign(f.stem.bends.reduce((a, b) => a + b, 0)) || 1;
  const bends = f.stem.bends.map((b, i) => b * droop + (i >= n * 0.55 ? sign * roll * lerp(0.7, 1.7, (i - n * 0.55) / (n * 0.45)) : 0));
  const extent = 0.32 * smooth(e / 0.25) + 0.68 * smooth(phase(e, 0.2, 1));
  const stipe = stemPoints({ ...f.stem, bends }, Math.max(0.01, extent), 1);
  const wires: FrondPose['wires'] = [];
  const leaflets: FanLeaflet[] = [];
  f.pinnae.forEach((pn, j) => {
    const k = smooth(phase(e, 0.12 + pn.t * 0.55, 0.5 + pn.t * 0.55));
    if (!visible(k)) return;
    const at = pointAt(stipe, pn.t);
    const out = at.angle + pn.side * lerp(0.25, 1.05, k);
    const path = drapePath(at, out, pn.length * k, pn.droop * k);
    wires.push({ pts: path.pts, width: 0.18 });
    pn.leaflets.forEach((q, qi) => {
      const qk = smooth(phase(k, q.t * 0.5, q.t * 0.5 + 0.5));
      if (!visible(qk)) return;
      const qa = pointAt(path.pts, q.t);
      const lp = leafletPose(`${j}-${qi}`, q, qa, qa.angle + q.side * 1.05, qk, sori);
      leaflets.push(lp.leaf);
      wires.push({ pts: lp.stalk, width: 0.11 });
    });
    const tk = smooth(phase(k, 0.45, 1));
    if (visible(tk)) {
      const end = path.pts[path.pts.length - 1]!;
      const lp = leafletPose(`${j}-tip`, pn.tip, end, path.angle, tk, sori);
      leaflets.push(lp.leaf);
    }
  });
  const tk = smooth(phase(e, 0.62, 1));
  if (visible(tk)) {
    const end = pointAt(stipe, 1);
    leaflets.push(leafletPose('tip', f.tip, end, end.angle, tk, sori).leaf);
  }
  return { stipe, wires, leaflets };
}

function extremes(f: Frond): number {
  let s = 1;
  for (const e of [0.55, 0.8, 1]) {
    const pose = frondPose(f, e)!;
    const pts = [...pose.stipe.map((q) => ({ q, pad: 1 })), ...pose.leaflets.map((l) => ({ q: l.at, pad: l.size + 0.6 }))];
    for (const { q, pad } of pts) {
      if (Math.abs(q.x) > 1e-6) s = Math.min(s, (BOX.x - pad) / Math.abs(q.x));
      if (q.y < -1e-6) s = Math.min(s, (-BOX.top - pad) / -q.y);
      if (q.y > 1e-6) s = Math.min(s, (BOX.bottom - pad) / q.y);
    }
  }
  return s;
}

export function planSouthernMaidenhair(rng: Rng): SouthernMaidenhairPlan {
  const n = rng.int(7, 9);
  const green = jitter(LEAF, rng, 0.03);
  const lean = rng.range(-0.25, 0.25);
  const order = rng.shuffle([...Array(n).keys()]);
  const fronds: Frond[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    const side: 1 | -1 = u + lean * 0.5 >= 0 ? 1 : -1;
    const rank = order.indexOf(i) / (n - 1);
    const depth = rng.next();
    // the first fronds are small and stand; later ones are longer and hang over the edge
    const length = lerp(20, 40, rank) * rng.range(0.88, 1.08);
    // some of the late fronds leave the crevice almost level and spill straight over the edge
    const spill = rank > 0.45 && Math.abs(u) > 0.3 && rng.chance(0.6) ? Math.sign(u) * rng.range(0.3, 0.6) : 0;
    const angle = UP + lean + u * rng.range(0.9, 1.4) + spill + rng.gaussian(0, 0.12);
    const bend = side * lerp(1.6, 3.5, Math.abs(u) * 0.6 + rank * 0.4) * rng.range(0.85, 1.1);
    const stem = makeStem(rng, { base: { x: u * 2.5 + rng.gaussian(0, 0.6), y: rng.range(-0.8, 0.4) }, length, angle, bend, segments: 10, tipBias: 0.35, wobble: 0.03 });
    const fertile = rank > 0.4 && rng.chance(0.55);
    const tone = mix(green, COOL, (1 - depth) * 0.25);
    const np = rng.int(4, 7);
    const pinnae: Pinna[] = [];
    for (let j = 0; j < np; j++) {
      const t = lerp(0.3, 0.9, j / (np - 1)) + rng.gaussian(0, 0.012);
      const v = (t - 0.3) / 0.6;
      const pside: 1 | -1 = j % 2 ? 1 : -1;
      const nq = Math.max(0, Math.round(lerp(3.8, 0.4, v) + rng.range(-0.5, 0.5)));
      const leaflets: Leaflet[] = [];
      for (let q = 0; q < nq; q++) leaflets.push(makeLeaflet(rng, (q + 0.7) / (nq + 0.7), q % 2 ? 1 : -1, lerp(3.9, 2.7, q / Math.max(1, nq)) * rng.range(0.78, 1.18), tone, fertile));
      pinnae.push({
        t,
        side: pside,
        length: lerp(9, 1.5, v) * rng.range(0.85, 1.12),
        droop: rng.range(1, 1.7),
        leaflets,
        tip: makeLeaflet(rng, 1, pside, rng.range(3.2, 4), tone, fertile),
      });
    }
    fronds.push({
      stem,
      window: [...stagger(order.indexOf(i), n, [0.03, 0.9], 0.58)] as [number, number],
      pinnae,
      tip: makeLeaflet(rng, 1, side, rng.range(3.1, 3.8), tone, fertile),
      depth,
    });
  }
  // fit each frond, with its leaflets, into the box at its young and its full droop
  for (const f of fronds) {
    for (let pass = 0; pass < 2; pass++) {
      const s = extremes(f);
      if (s >= 1) break;
      f.stem.length *= Math.max(0.35, s * 0.98);
      for (const pn of f.pinnae) pn.length *= Math.max(0.6, s);
    }
  }
  const moss: Pt[] = [];
  const nm = rng.int(7, 10);
  for (let i = 0; i < nm; i++) moss.push({ x: rng.range(-8, 8), y: rng.range(-0.2, 2.4) });
  return { fronds, moss };
}

function drawFrond(p: Painter, rng: Rng, f: Frond, g: number): void {
  const e = ease(g, f.window[0], f.window[1]);
  const pose = frondPose(f, e, ease(g, 0.84, 1));
  if (!pose) return;
  const back = 1 - f.depth;
  p.inkLine(pose.stipe, { rng: rng.fork('stipe'), width: 0.26, pigment: STIPE, opacity: lerp(0.8, 0.6, back), breaks: 0.04, wobble: 0.12, pressureVar: 0.2, taper: [0.02, 0.45], pressure: [0.95, 0.8, 0.55] });
  wireStalks(p, pose.wires, { pigment: STIPE, opacity: lerp(0.78, 0.6, back) });
  fanLeaflets(p, pose.leaflets, { opacity: lerp(0.84, 0.7, back), deep: LEAF_DEEP, sorus: SORUS });
}

const southernMaidenhair: SpeciesDef = {
  id: 'southern-maidenhair',
  name: 'Southern Maidenhair',
  nativeName: 'Qesbour l-bir',
  nativeLang: 'ary-Latn',
  // wild on wet walls, wells and springs round the Mediterranean and in the Saharan oases
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['wetland', 'wet-cliff', 'coast'], climates: ['arid', 'warm-temperate', 'mediterranean'] },
  tier: 1,
  habitats: ['rock', 'shore'],
  sizeClass: 'small',
  // drawn in the 70-unit design box; the root sits a little high so the fronds can hang over
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.6 },
  description: 'Southern maidenhair — green hair spilling where the wall weeps.',
  bloomColor: '#a2c46e',
  pollinators: false,
  draw(p, rng, opts) {
    const plan = planSouthernMaidenhair(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      dampSeep(p, r.fork('seep'), { stain: ease(g, 0, 0.5), moss: ease(g, 0.1, 0.6), heart: 1 - ease(g, 0.1, 0.3), mossAt: plan.moss });
      const order = plan.fronds.map((f, i) => [f, i] as const).sort((a, b) => a[0].depth - b[0].depth);
      for (const [f, i] of order) drawFrond(p, r.fork(`frond-${i}`), f, g);
    } finally {
      end();
    }
  },
};

export default southernMaidenhair;
