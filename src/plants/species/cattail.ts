import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { cattailSpikes, slicePath, spikeLayout, strapEdge, strapLeaves, type StrapLeaf } from '../lib/cattail-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { INK_GREEN, groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { UP, bendProfile, makeStem, pathLen, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Southern cattail (Typha domingensis): a clump of tall, flat, twisting grey-green straps rising
 * from still water, and stiff stalks each carrying a velvet brown cigar, a bare gap, then a thin
 * straw-gold male spike that frays and sheds. A few old leaves are dry and broken over.
 */

const LEAF = '#9aa86a';
const LEAF_DEEP = mix('#6f7f4c', PIGMENTS.celadonDeep, 0.2);
const STRAW = '#d8c38a';
const DRY = mix(STRAW, '#b59a68', 0.4);
const BROWN = '#8a5a3a';
const BROWN_SHADE = '#6a4430';
const MALE = '#c9b07a';
const MALE_GREEN = mix('#a9ad6a', MALE, 0.35);
const SPIKE_GREEN = mix('#7f9358', LEAF, 0.3);
const STALK = mix(LEAF, PIGMENTS.olive, 0.3);
const FLUFF = mix('#e6dcc4', STRAW, 0.3);
const WATER = mix(PIGMENTS.celadon, PIGMENTS.celadonMid, 0.4);
// the box round the base (anchor 0.5, 0.92): x ±60, y −147 … 13
const BOX = { x: 54, top: -140 };
const SEG = 14;

interface Leaf {
  stem: StemPlan;
  width: number;
  twist: number;
  turns: number;
  window: [number, number];
  tone: Pigment;
  front: boolean;
  /** an old leaf: dries to straw and breaks over at `at` (segment index) by `turn` */
  broken: { at: number; turn: number } | null;
  straw: number;
}

interface Stalk {
  stem: StemPlan;
  window: [number, number];
  spike: [number, number];
  brown: [number, number];
  female: { length: number; radius: number };
  gap: number;
  male: { length: number; radius: number };
  tip: number;
  fluff: boolean;
  frays: { t: number; side: number; len: number; a: number }[];
  flecks: { t: number; dx: number; dy: number; size: number }[];
}

export interface CattailPlan {
  leaves: Leaf[];
  stalks: Stalk[];
}

/** The midline of a leaf at `extent` of its length, its arch scaled by `bendK` and its break by `kink`. */
export function leafPath(l: Leaf, extent: number, bendK: number, kink: number): Pt[] {
  if (!l.broken) return stemPoints(l.stem, extent, bendK);
  const bends = l.stem.bends.map((b, i) => b * bendK + (i === l.broken!.at ? l.broken!.turn * kink : 0));
  return stemPoints({ ...l.stem, bends }, extent, 1);
}

function fits(pts: readonly Pt[], pad: number): number {
  let s = 1;
  for (const q of pts) {
    if (Math.abs(q.x) > BOX.x - pad) s = Math.min(s, (BOX.x - pad) / Math.abs(q.x));
    if (q.y < BOX.top + pad) s = Math.min(s, (BOX.top + pad) / q.y);
  }
  return s;
}

export function planCattail(rng: Rng): CattailPlan {
  const lean = rng.gaussian(0, 0.05);
  const green = jitter(LEAF, rng, 0.03);
  const n = rng.int(10, 13);
  const leaves: Leaf[] = [];
  const nBroken = rng.int(1, 2);
  const brokenAt = new Set<number>();
  while (brokenAt.size < nBroken) brokenAt.add(rng.int(0, n - 1));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const out = Math.abs(u) * 2;
    const side = Math.sign(u) || (rng.chance(0.5) ? 1 : -1);
    // some stand straight, the outer ones arch over; the arch sits in the top half
    const arch = rng.chance(0.25 + out * 0.45) ? rng.range(0.7, 1.5) : rng.range(0.05, 0.3);
    const broken = brokenAt.has(i) ? { at: rng.int(6, 9), turn: side * rng.range(1.9, 2.5) } : null;
    const stem: StemPlan = {
      base: { x: u * rng.range(12, 18) + rng.gaussian(0, 1.2), y: 0 },
      length: rng.range(85, 136) * (1 - out * 0.3),
      angle: UP + lean + u * rng.range(0.35, 0.6) + rng.gaussian(0, 0.05),
      bends: bendProfile(rng, SEG, side * arch, 0.75, 0.015),
    };
    let s = fits(leafPath({ stem, broken } as Leaf, 1, 1, 1), 5);
    if (s < 1) stem.length *= s * 0.98;
    s = fits(leafPath({ stem, broken } as Leaf, 1, 1, 1), 5);
    if (s < 1) stem.length *= s * 0.98;
    leaves.push({
      stem,
      width: rng.range(2.9, 3.8),
      twist: rng.range(0, Math.PI),
      turns: rng.range(0.35, 1.1),
      window: [0, 0],
      tone: jitter(mix(green, LEAF_DEEP, rng.range(0, 0.22)), rng, 0.02),
      front: rng.chance(0.4),
      broken,
      straw: rng.range(0.12, 0.3),
    });
  }
  // the middle blades come first, the outer ones after
  const order = leaves.map((_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) + rng.gaussian(0, 0.8));
  order.forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, n, [0.02, 0.6], 0.42)] as [number, number];
  });
  const ns = rng.int(2, 4);
  const stalks: Stalk[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < ns; i++) {
    const u = ns === 1 ? 0 : (i / (ns - 1) - 0.5) * flip;
    const length = rng.range(118, 138) * (1 - Math.abs(u) * 0.12);
    const angle = UP + lean + u * rng.range(0.12, 0.26);
    const reach = Math.min(1, (BOX.x - 8) / Math.abs(Math.cos(angle) * length + 1e-6), (-BOX.top - 4) / length);
    stalks.push({
      stem: makeStem(rng, { base: { x: u * rng.range(6, 12), y: 0 }, length: length * reach, angle, bend: rng.gaussian(0, 0.04), segments: 8, wobble: 0.008 }),
      window: [...stagger(i, ns, [0.3, 0.7], 0.6)] as [number, number],
      spike: [...stagger(i, ns, [0.42, 0.82], 0.6)] as [number, number],
      brown: [...stagger(i, ns, [0.72, 0.98], 0.7)] as [number, number],
      female: { length: rng.range(26, 33), radius: rng.range(2.8, 3.2) },
      gap: rng.chance(0.15) ? rng.range(0.6, 1.2) : rng.range(2.4, 5),
      male: { length: rng.range(15, 21), radius: rng.range(1.15, 1.45) },
      tip: rng.range(2, 4.5),
      fluff: rng.chance(0.35),
      frays: Array.from({ length: 14 }, () => ({ t: rng.range(0.05, 0.95), side: rng.chance(0.5) ? 1 : -1, len: rng.range(0.8, 2), a: rng.range(0.3, 0.9) })),
      flecks: Array.from({ length: rng.int(2, 4) }, () => ({ t: rng.range(0.2, 0.9), dx: rng.range(-5, 5), dy: rng.range(3, 14), size: rng.range(0.5, 0.9) })),
    });
  }
  return { leaves, stalks };
}

function leafNow(l: Leaf, g: number, key: string): StrapLeaf | null {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return null;
  const kink = l.broken ? ease(g, 0.55, 0.95) : 0;
  const pts = leafPath(l, easeOut(k), lerp(0.2, 1, smooth(k)), kink);
  const dry = l.broken ? ease(g, 0.5, 0.92) : 0;
  return {
    key,
    pts,
    width: l.width,
    twist: l.twist,
    turns: l.turns * lerp(0.4, 1, k),
    tone: mix(l.tone, DRY, dry * 0.85),
    deep: mix(LEAF_DEEP, mix(DRY, BROWN, 0.25), dry * 0.8),
    straw: lerp(l.straw, 0.75, dry),
    strawK: Math.max(ease(g, 0.45, 0.9), dry),
  };
}

function drawLeaves(p: Painter, rng: Rng, plan: CattailPlan, g: number, front: boolean, opacity: number) {
  const now = plan.leaves.map((l, i) => (l.front === front ? leafNow(l, g, `leaf-${i}`) : null));
  const live = now.filter((l): l is StrapLeaf => l !== null);
  strapLeaves(p, live, { opacity, straw: STRAW });
  now.forEach((l, i) => l && strapEdge(p, rng.fork(`leaf-${i}`), l, mix(INK_GREEN, LEAF_DEEP, 0.3), front ? 0.4 : 0.25));
}

function drawStalk(p: Painter, rng: Rng, s: Stalk, g: number) {
  const e = ease(g, s.window[0], s.window[1]);
  if (!visible(e)) return;
  const pts = stemPoints(s.stem, easeOut(e), 1);
  const spike = { stalk: pts, k: ease(g, s.spike[0], s.spike[1]), female: s.female, gap: s.gap, male: s.male, tip: s.tip };
  // the stalk below the cigar and through the gap; the cigar hides the rest
  const at = spikeLayout(spike);
  const hidden = at.f1 - at.f0 > 1.5;
  paintStem(p, rng.fork('stalk'), hidden ? slicePath(pts, 0, at.f0 + 0.6) : pts, { width: 1.5, pigment: STALK, opacity: 0.85 * smooth(e / 0.2), ink: 0.22, inkReach: 0.7 });
  if (hidden) paintStem(p, rng.fork('neck'), slicePath(pts, at.f1 - 0.6, pathLen(pts)), { width: 1.1, pigment: STALK, opacity: 0.8 });
  cattailSpikes(
    p,
    rng.fork('spikes'),
    {
      ...spike,
      brown: ease(g, s.brown[0], s.brown[1]),
      fray: ease(g, 0.84, 1),
      fluff: s.fluff ? ease(g, 0.9, 1) : 0,
      frays: s.frays,
      flecks: s.flecks,
    },
    { green: SPIKE_GREEN, brown: BROWN, shade: BROWN_SHADE, male: MALE, maleGreen: MALE_GREEN, fluff: FLUFF, light: -1 },
  );
}

const cattail: SpeciesDef = {
  id: 'cattail',
  name: 'Southern Cattail',
  nativeName: 'Berdi',
  nativeLang: 'ary-Latn',
  // wild in marshes, channels and oases of warm, dry lands; not Japanese, so the garden never offers it
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['wetland'], climates: ['arid', 'warm-temperate'] },
  tier: 2,
  habitats: ['water', 'shore'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.92 },
  description: 'Cattail — brown velvet candles where the basin spills over.',
  bloomColor: BROWN,
  pollinators: false,
  draw(p, rng, opts) {
    const plan = planCattail(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      // it stands in still, shallow water, there before the first blade
      groundShadow(p, r.fork('water'), { rx: 34, ry: 5, k: lerp(0.35, 1, ease(g, 0, 0.5)), pigment: WATER, opacity: 0.3 });
      p.ripple({ x: 0, y: 1 }, { rng: r.fork('ring'), width: lerp(12, 40, ease(g, 0, 0.5)), count: 2, squash: 0.22, opacity: 0.24 * (1 - 0.4 * ease(g, 0.4, 0.8)), light: 0.3 });
      drawLeaves(p, r.fork('back'), plan, g, false, 0.86);
      plan.stalks.forEach((s, i) => drawStalk(p, r.fork(`stalk-${i}`), s, g));
      drawLeaves(p, r.fork('front'), plan, g, true, 0.9);
      // the feet are lost in the water, and it parts round them
      groundShadow(p, r.fork('foot'), { rx: 22, ry: 3, k: ease(g, 0.1, 0.5), pigment: WATER, opacity: 0.4 });
      const wk = ease(g, 0.2, 0.6);
      if (visible(wk)) {
        for (const [i, sg] of [[0, -1], [1, 1]] as const) {
          const x0 = sg * 15;
          const x1 = sg * lerp(16, 34, wk);
          p.stroke([{ x: x0, y: 2 }, { x: (x0 + x1) / 2, y: 1.5 }, { x: x1, y: 2.4 }], { rng: r.fork(`ripple-${i}`), pigment: PIGMENTS.celadonDeep, width: 0.6, taper: [0.2, 0.5], wobble: 0.2, wetness: 0.4, opacity: 0.4 * wk, edge: 0.3 });
        }
      }
    } finally {
      end();
    }
  },
};

export default cattail;
