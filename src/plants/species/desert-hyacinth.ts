import type { Rng } from '../../core/rng';
import { mix, type Pt } from '../../paint';
import { crackedMound, flowerSpike, scaledStem, type FlowerNow, type HyacinthColours } from '../lib/desert-hyacinth-paint';
import { ease, easeOut, lerp, smooth, stagger } from '../lib/small-growth';
import { groundShadow, plantFrame } from '../lib/small-paint';
import { UP, makeStem, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Desert hyacinth (Cistanche phelypaea): a leafless root parasite of tamarisk and saltbush. One to
 * three fleshy cream stems clad in scales break a little cracked mound of sand, each carrying a
 * dense cylindrical spike of golden two-lipped flowers that open from the bottom up.
 */

const C: HyacinthColours = {
  cream: '#e8d9b0',
  creamShade: mix('#e8d9b0', '#b39a6a', 0.55),
  scale: '#b39a6a',
  violet: mix('#7a5668', '#b39a6a', 0.2),
  bud: mix('#e8d9b0', '#dcbc62', 0.5),
  gold: '#e5b63c',
  goldDeep: mix('#e5b63c', '#b8862a', 0.55),
  lobe: '#efd27a',
  throat: mix('#b8862a', '#8a4e22', 0.5),
  sand: '#ebcb8b',
  sandShade: '#c99a72',
  crack: mix('#9a7350', '#4a443c', 0.25),
};
// the box round the base (anchor 0.5, 0.92): x ±60, y −147 … 13
const TOP = -136;

export interface Spike {
  stem: StemPlan;
  /** when it pushes up, and when its flowers open (bottom to top) */
  rise: [number, number];
  open: [number, number];
  /** fraction of the full height that is bare stem below the spike */
  split: number;
  stemR: number;
  spikeR: number;
  violet: number;
  scales: { t: number; side: number; len: number; wid: number }[];
  flowers: { u: number; az: number; size: number }[];
  cracks: { a: number; len: number; bend: number }[];
}

export interface HyacinthPlan {
  spikes: Spike[];
}

export function planDesertHyacinth(rng: Rng): HyacinthPlan {
  const n = rng.pick([1, 2, 2, 2, 3, 3]);
  const flip = rng.chance(0.5) ? 1 : -1;
  const lean = rng.gaussian(0, 0.04);
  const spikes: Spike[] = [];
  for (let i = 0; i < n; i++) {
    // the first is the tallest; the others stand to either side, shorter and later
    const side = i === 0 ? (n === 1 ? 0 : rng.range(-0.3, 0.3)) : (i === 1 ? 1 : -1) * flip;
    const height = i === 0 ? rng.range(112, 130) : rng.range(70, 100);
    const x = side * (i === 0 ? 4 : rng.range(13, 18));
    const angle = UP + lean + side * rng.range(0.03, 0.09);
    const length = Math.min(height, TOP / Math.sin(angle));
    const spikeR = (i === 0 ? rng.range(8.2, 9.4) : rng.range(6.8, 8)) * (height / 120) ** 0.3;
    const split = rng.range(0.3, 0.4);
    const rise: [number, number] = i === 0 ? [0.08, 0.6] : [...stagger(i - 1, Math.max(1, n - 1), [0.18, 0.74], 0.75)] as [number, number];
    const open: [number, number] = [rise[1] - 0.12, Math.min(0.99, rise[1] + 0.34)];
    const spikeLen = length * (1 - split);
    const nf = Math.round(spikeLen * 0.62);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const az0 = rng.range(0, Math.PI * 2);
    const flowers = Array.from({ length: nf }, (_, j) => ({
      u: Math.min(0.97, (j + 0.5) / nf + rng.gaussian(0, 0.008)),
      az: az0 + j * golden + rng.gaussian(0, 0.15),
      size: spikeR * rng.range(0.24, 0.3) * lerp(1, 0.7, ((j + 0.5) / nf) ** 2),
    }));
    const ns = Math.round(length * split * 0.16) + 3;
    const scales = Array.from({ length: ns }, (_, j) => ({
      t: (j + 0.6) / ns + rng.gaussian(0, 0.02),
      side: j % 2 === 0 ? -1 : 1,
      len: spikeR * rng.range(0.9, 1.2),
      wid: spikeR * rng.range(0.5, 0.7),
    }));
    const nc = rng.int(4, 6);
    const cracks = Array.from({ length: nc }, (_, j) => ({
      a: (j / nc) * Math.PI * 2 + rng.gaussian(0, 0.3),
      len: rng.range(5, 11) * (i === 0 ? 1 : 0.75),
      bend: rng.gaussian(0, 0.35),
    }));
    spikes.push({
      stem: makeStem(rng, { base: { x, y: 0 }, length, angle, bend: rng.gaussian(0, 0.03), segments: 8, wobble: 0.006 }),
      rise,
      open,
      split,
      stemR: spikeR * rng.range(0.52, 0.6),
      spikeR,
      violet: rng.chance(0.7) ? rng.range(0.35, 0.85) : rng.range(0, 0.2),
      scales,
      flowers,
      cracks,
    });
  }
  return { spikes };
}

/** One spike at growth `g`: its axis, where the stem ends, and every flower's state. */
export function poseSpike(s: Spike, g: number) {
  const e = ease(g, s.rise[0], s.rise[1]);
  const axis: Pt[] = stemPoints(s.stem, easeOut(e), 1);
  // the tip that breaks the sand is all bud cone; the bare stem lengthens below it
  const split = lerp(0.04, s.split, smooth(e));
  const rk = lerp(0.42, 1, smooth(e));
  const front = ease(g, s.open[0], s.open[1]) * 1.25 - 0.06;
  const flowers: FlowerNow[] = s.flowers.map((f) => ({
    u: f.u,
    az: f.az,
    size: f.size * rk,
    open: smooth((front - f.u) / 0.16),
    k: smooth((e - f.u * 0.25) / 0.12),
  }));
  const scales = s.scales.map((sc) => ({ ...sc, len: sc.len * rk, wid: sc.wid * rk, k: smooth((e - 0.1 - sc.t * 0.2) / 0.15) }));
  return { e, axis, split, rk, front, flowers, scales };
}

const desertHyacinth: SpeciesDef = {
  id: 'desert-hyacinth',
  name: 'Desert Hyacinth',
  nativeName: 'Danun',
  nativeLang: 'ary-Latn',
  // wild on salty sands from Macaronesia across the Mediterranean to the Sahara, on tamarisk and saltbush roots
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] },
  tier: 2,
  habitats: ['path', 'back'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.92 },
  description: 'Desert hyacinth — a golden candle lit from under the sand.',
  bloomColor: '#e5b63c',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planDesertHyacinth(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      const poses = plan.spikes.map((s) => poseSpike(s, g));
      groundShadow(p, r.fork('shadow'), { rx: 30, ry: 4.5, x: 3, k: lerp(0.3, 1, ease(g, 0, 0.5)), pigment: C.sandShade, opacity: 0.22 });
      const feet = plan.spikes.map((s, i) => ({
        x: s.stem.base.x,
        r: s.stemR * poses[i]!.rk,
        k: ease(g, Math.max(0, s.rise[0] - 0.08), s.rise[0] + 0.1),
        cracks: s.cracks,
      }));
      crackedMound(p, r.fork('mound'), feet, C, { rx: 26, k: ease(g, 0, 0.3) });
      // back to front: the shorter side spikes stand behind the first
      const order = plan.spikes.map((_, i) => i).reverse();
      for (const i of order) {
        const s = plan.spikes[i]!;
        const ps = poses[i]!;
        if (ps.e < 0.012) continue;
        const sr = r.fork(`spike-${i}`);
        scaledStem(p, sr.fork('stem'), { axis: ps.axis, split: ps.split, radius: s.stemR * ps.rk, violet: s.violet * smooth(ps.e * 1.5), scales: ps.scales }, C);
        flowerSpike(p, sr.fork('flowers'), { axis: ps.axis, t0: ps.split, radius: s.spikeR * ps.rk, front: ps.front, flowers: ps.flowers }, C);
        // the sand lies over its foot
        p.dab({ x: s.stem.base.x, y: 1.2 }, C.sand, { rng: sr.fork('foot'), variant: 'round', angle: 0, length: s.stemR * 2.9 * ps.rk, width: s.stemR * 0.75 * ps.rk, opacity: 0.75 * smooth(ps.e * 4), pool: 0.3, poolSide: 1 });
      }
    } finally {
      end();
    }
  },
};

export default desertHyacinth;
