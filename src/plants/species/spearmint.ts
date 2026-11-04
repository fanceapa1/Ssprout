import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment } from '../../paint';
import { dampSoil, mintLeaves, mintSpike, type MintLeaf, type Whorl } from '../lib/spearmint-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, add, lerpAngle, makeStem, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Spearmint (naʿnaʿ): a patch of upright square stems risen from runners in the damp soil by the
 * channel, with opposite pairs of crinkled, toothed, bright green lance leaves, each stem ending
 * in a slender tapering spike of tiny lilac whorls.
 */

const LEAF = '#86a75a';
const LEAF_DEEP = '#5f7d45';
const BLOOM = '#b9a0c8';
const PALE = '#d6c6dc';
const STEM = mix('#7d9650', '#8a6878', 0.22);
const CALYX = mix('#8fa065', '#9a86a8', 0.35);
// the design box round the base (anchor 0.5, 0.88): x ±35, y −61.6 … 8.4
const BOX = { x: 33, top: -58 };

interface Pair {
  t: number;
  /** pairs alternate: spread to the sides, then one toward us and one away */
  facing: boolean;
  length: number;
  width: number;
  spread: number;
  curve: number;
  tone: Pigment;
  teeth: number;
  veins: number;
}

interface Shoot {
  stem: StemPlan;
  pairs: Pair[];
  depth: number;
  window: [number, number];
  spike?: { length: number; width: number; whorls: Whorl[]; grow: [number, number]; open: [number, number] };
}

interface Runner {
  stem: StemPlan;
  window: [number, number];
  tip: { length: number; tone: Pigment };
}

export interface SpearmintPlan {
  shoots: Shoot[];
  runners: Runner[];
}

function makeWhorls(rng: Rng): Whorl[] {
  const n = rng.int(6, 9);
  const whorls: Whorl[] = [];
  for (let i = 0; i < n; i++) {
    // the lower whorls stand apart, the upper ones crowd into the tip
    const t = 0.04 + 0.92 * (1 - (1 - i / (n - 1)) ** 1.6);
    const m = rng.int(4, 6);
    const florets = [];
    for (let j = 0; j < m; j++) florets.push({ u: lerp(-1, 1, (j + rng.range(0.2, 0.8)) / m), v: rng.range(-1, 1), size: rng.range(0.5, 0.8) });
    whorls.push({ t, florets });
  }
  return whorls;
}

export function planSpearmint(rng: Rng): SpearmintPlan {
  const n = rng.int(6, 9);
  const green = jitter(LEAF, rng, 0.03);
  const shoots: Shoot[] = [];
  const order = rng.shuffle([...Array(n).keys()]);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : lerp(-1, 1, i / (n - 1));
    const x = u * rng.range(14, 18) + rng.gaussian(0, 1.5);
    const depth = i % 2 ? rng.range(0, 0.5) : rng.range(0.5, 1);
    const centre = 1 - Math.abs(u) * 0.45;
    const length = rng.range(30, 42) * centre;
    const angle = UP + u * rng.range(0.12, 0.3) + rng.gaussian(0, 0.06);
    const stem = makeStem(rng, { base: { x, y: lerp(-1.6, 0.8, depth) }, length, angle, bend: u * rng.range(0.05, 0.2) + rng.gaussian(0, 0.06), segments: 8, tipBias: 0.2 });
    const np = rng.int(4, 6);
    const pairs: Pair[] = [];
    const scale = rng.range(0.9, 1.08);
    for (let j = 0; j < np; j++) {
      const t = lerp(0.14, 0.8, j / (np - 1)) + rng.gaussian(0, 0.02);
      const facing = j % 2 === 1;
      // mid-stem leaves are the largest
      const size = (lerp(7.2, 8.6, Math.sin(Math.PI * Math.min(1, t * 1.6))) - t * 4.5) * scale * rng.range(0.9, 1.08);
      pairs.push({
        t,
        facing,
        length: size,
        width: size * rng.range(0.4, 0.48),
        spread: rng.range(0.85, 1.15),
        curve: rng.range(0.06, 0.16),
        tone: jitter(mix(green, LEAF_DEEP, rng.range(0, 0.18) + (1 - depth) * 0.12), rng, 0.025),
        teeth: size > 5 ? 5 : 3,
        veins: size > 5 ? 3 : 2,
      });
    }
    shoots.push({ stem, pairs, depth, window: [...stagger(order.indexOf(i), n, [0.06, 0.6], 0.5)] as [number, number] });
  }
  // most stems end in a spike; the tallest always do
  const bySize = [...shoots].sort((a, b) => b.stem.length - a.stem.length);
  bySize.forEach((sh, k) => {
    if (k > 2 && !rng.chance(0.55)) return;
    const end = sh.window[1];
    sh.spike = {
      length: rng.range(9, 14),
      width: rng.range(1.8, 2.3),
      whorls: makeWhorls(rng),
      grow: [Math.max(0.5, end - 0.04), Math.min(0.86, end + 0.24)] as [number, number],
      open: [...stagger(k, bySize.length, [0.72, 1], 0.55)] as [number, number],
    };
  });
  // fit the stem, its spike and its outer leaves into the box
  for (const sh of shoots) {
    const pts = stemPoints(sh.stem, 1, 1);
    const tip = pts[pts.length - 1]!;
    const extra = sh.spike?.length ?? 2;
    const rise = sh.stem.base.y - tip.y + extra;
    let s = Math.min(1, (-BOX.top + sh.stem.base.y) / rise);
    const leaf = Math.max(...sh.pairs.map((p) => p.length));
    for (const q of pts) s = Math.min(s, Math.abs(q.x) > 1e-6 ? (BOX.x - leaf * 0.8) / Math.abs(q.x) : 1);
    if (s < 1) {
      sh.stem.length *= Math.max(0.5, s);
      if (sh.spike) sh.spike.length *= Math.max(0.6, s);
    }
  }
  // the runners creep out over the soil first, each with a small new pair at its tip
  const runners: Runner[] = [];
  const nr = rng.int(2, 3);
  for (let i = 0; i < nr; i++) {
    const side: 1 | -1 = i % 2 ? 1 : -1;
    const x = side * rng.range(4, 12);
    runners.push({
      stem: makeStem(rng, { base: { x, y: rng.range(0.4, 1.4) }, length: rng.range(9, 15), angle: side > 0 ? rng.range(-0.15, 0.1) : Math.PI + rng.range(-0.1, 0.15), bend: side * rng.range(-0.1, 0.1), segments: 5 }),
      window: [...stagger(i, nr, [0.02, 0.32], 0.7)] as [number, number],
      tip: { length: rng.range(2.6, 3.6), tone: jitter(mix(green, PIGMENTS.sageLight, 0.15), rng, 0.02) },
    });
  }
  return { shoots, runners };
}

function drawRunner(p: Painter, rng: Rng, rn: Runner, i: number, g: number): void {
  const k = ease(g, rn.window[0], rn.window[1]);
  if (!visible(k)) return;
  const full = stemPoints(rn.stem, 1, 1);
  const pts = subPath(full, lerp(0.05, 1, k));
  paintStem(p, rng.fork('stem'), pts, { width: 0.75, pigment: STEM, opacity: 0.7 });
  const tip = pointAt(full, lerp(0.05, 1, k));
  const lk = smooth((k - 0.4) / 0.6);
  const leaves: MintLeaf[] = [];
  for (const s of [-1, 1]) {
    const angle = lerpAngle(UP, UP + s * 0.75, lk);
    leaves.push({ key: `r-${i}-${s}`, at: add(tip, UP, 0.3), angle, length: rn.tip.length * lk, width: rn.tip.length * 0.45 * lk, curve: 0.1 * s, tone: rn.tip.tone, teeth: 2, veins: 1 });
  }
  mintLeaves(p, rng.fork('leaves'), leaves, { deep: LEAF_DEEP, opacity: 0.85 });
}

function drawShoot(p: Painter, rng: Rng, sh: Shoot, g: number): void {
  const ext = ease(g, sh.window[0], sh.window[1]);
  if (!visible(ext)) return;
  const full = stemPoints(sh.stem, 1, lerp(0.4, 1, ext));
  const pts = subPath(full, lerp(0.03, 1, ext));
  const back = 1 - sh.depth;
  paintStem(p, rng.fork('stem'), pts, { width: 1.05, pigment: mix(STEM, PIGMENTS.sageLight, back * 0.2), opacity: 0.85, ink: 0.16 * ext, inkReach: 0.7, inkPigment: mix(LEAF_DEEP, PIGMENTS.sumi, 0.3) });
  const leaves: MintLeaf[] = [];
  const head = lerp(0.03, 1, ext);
  sh.pairs.forEach((pr, j) => {
    const lk = smooth((head * 1.15 - pr.t) / 0.32);
    if (!visible(lk)) return;
    const q = pointAt(full, pr.t * head);
    for (const s of [-1, 1] as const) {
      // a facing pair: one leaf toward us (short, foreshortened), one away (shorter, behind)
      const spread = pr.facing ? pr.spread * (s > 0 ? 0.45 : 0.32) : pr.spread;
      const len = pr.length * (pr.facing ? (s > 0 ? 0.7 : 0.55) : 1);
      const angle = lerpAngle(q.angle, q.angle + s * spread, smooth(lk));
      leaves.push({
        key: `${j}-${s}`,
        at: add(q, angle, 0.4 * lk),
        angle,
        length: len * lk,
        width: pr.width * lk * lerp(0.55, 1, lk) * (pr.facing ? 1.05 : 1),
        curve: pr.curve * s,
        tone: pr.facing && s < 0 ? mix(pr.tone, LEAF_DEEP, 0.25) : pr.tone,
        teeth: pr.teeth,
        veins: pr.veins,
      });
    }
  });
  mintLeaves(p, rng.fork('leaves'), leaves, { deep: LEAF_DEEP, opacity: lerp(0.78, 0.9, sh.depth) });
  if (!sh.spike) return;
  const sk = ease(g, sh.spike.grow[0], sh.spike.grow[1]);
  if (!visible(sk)) return;
  const tip = pointAt(full, head);
  const sp = sh.spike;
  const open = sp.open;
  mintSpike(p, rng.fork('spike'), {
    base: tip,
    angle: tip.angle,
    length: sp.length * sk,
    width: sp.width * lerp(0.5, 1, sk),
    whorls: sp.whorls,
    // the flowers open from the base of the spike up
    open: (t) => ease(g, lerp(open[0], open[1] - 0.12, t), lerp(open[0] + 0.12, open[1], t)),
  }, { calyx: CALYX, bloom: BLOOM, pale: PALE, opacity: lerp(0.8, 0.92, sh.depth) * smooth(sk * 3) });
}

const spearmint: SpeciesDef = {
  id: 'spearmint',
  name: 'Spearmint',
  nativeName: 'Naʿnaʿ',
  nativeLang: 'ary-Latn',
  // a cultigen of uncertain wild origin, kept in every oasis garden for tea
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 1,
  habitats: ['shore', 'path'],
  sizeClass: 'small',
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.88 },
  description: "Spearmint — a fistful for the teapot, picked at the channel's lip.",
  bloomColor: '#b9a0c8',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planSpearmint(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      dampSoil(p, r.fork('soil'), { rx: 20, k: ease(g, 0.05, 0.5) });
      groundShadow(p, r, { rx: 19, ry: 4, k: ease(g, 0.2, 0.7), opacity: 0.12, pigment: PIGMENTS.shadow });
      plan.runners.forEach((rn, i) => drawRunner(p, r.fork(`runner-${i}`), rn, i, g));
      const order = plan.shoots.map((sh, i) => [sh, i] as const).sort((a, b) => a[0].depth - b[0].depth);
      for (const [sh, i] of order) drawShoot(p, r.fork(`shoot-${i}`), sh, g);
    } finally {
      end();
    }
  },
};

export default spearmint;
