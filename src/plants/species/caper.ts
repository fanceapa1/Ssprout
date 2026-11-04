import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { caperBuds, caperFlower, fleshyLeaves, stipuleSpines, wallCrack, type CaperBud, type CaperPetal, type FleshyLeaf, type Stamen } from '../lib/caper-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, add, lerpAngle, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Caper (kebbar): a trailing mound of zigzag stems spilling from a crack in an old wall, round
 * glaucous leaves with a pair of hooked spines at each base, green capers in the axils and one
 * to three big white flowers that burst into a fountain of violet stamens.
 */

const LEAF = '#8ea47a';
const LEAF_DEEP = '#5f7458';
const BLOOM = '#d8e3e6';
const STEM = '#9a8a5c';
const BUD = '#8a9a52';
const FLUSH = '#e8c4cc';
const VIOLET = '#a35a8c';
const ANTHER = '#d9a94a';
const SPINE = '#c9ad74';
const DOWN = Math.PI / 2;
// the design box round the base (anchor 0.5, 0.42): x ±35, y −29.4 … 40.6
const BOX = { x: 33.5, top: -28, bottom: 39 };

interface Node {
  /** fraction of the shoot's length */
  t: number;
  side: 1 | -1;
  leaf: { length: number; width: number; spread: number; curve: number; tone: Pigment };
  bud?: { stalk: number; r: number; window: [number, number] };
}

interface Shoot {
  stem: StemPlan;
  nodes: Node[];
  window: [number, number];
  width: number;
  short: boolean;
}

interface Flower {
  shoot: number;
  node: number;
  stalk: number;
  turn: number;
  size: number;
  tilt: number;
  petals: CaperPetal[];
  stamens: Stamen[];
  bud: [number, number];
  open: [number, number];
}

export interface CaperPlan {
  shoots: Shoot[];
  flowers: Flower[];
  seam: Pt[];
}

/** Young shoots are stiff; they droop under their own weight as they lengthen. */
const bendAt = (g: number): number => lerp(0.55, 1, ease(g, 0.1, 0.62));

function zigzagStem(rng: Rng, angle: number, length: number, droop: number, n: number): StemPlan {
  const zig = rng.range(0.16, 0.26);
  const bends: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    bends.push((droop * (0.6 + t * 0.8)) / n + (i % 2 ? zig : -zig) + rng.gaussian(0, 0.03));
  }
  return { base: { x: rng.gaussian(0, 1.4), y: rng.range(-1.4, 0) }, length, angle, bends };
}

/** Largest scale (≤ 1) of a shoot that keeps its points, padded, inside the box at both bends. */
function fitScale(stem: StemPlan, pads: (t: number) => number, at: readonly number[]): number {
  let s = 1;
  for (const k of [0.55, 1]) {
    const pts = stemPoints(stem, 1, k);
    for (const t of at) {
      const q = pointAt(pts, t);
      const pad = pads(t);
      if (Math.abs(q.x) > 1e-6) s = Math.min(s, (BOX.x - pad) / Math.abs(q.x));
      if (q.y < -1e-6) s = Math.min(s, (-BOX.top - pad) / -q.y);
      if (q.y > 1e-6) s = Math.min(s, (BOX.bottom - pad) / q.y);
    }
  }
  return Math.max(0.3, s);
}

export function planCaper(rng: Rng): CaperPlan {
  const lean: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const ns = rng.int(5, 7);
  const green = jitter(LEAF, rng, 0.03);
  const shoots: Shoot[] = [];
  const hangs = new Set(rng.shuffle([...Array(ns).keys()]).slice(0, rng.int(2, 3)));
  for (let i = 0; i < ns; i++) {
    // a fan from up-and-out to hanging straight down the wall, leaning to one side
    const u = ns === 1 ? 0.5 : i / (ns - 1);
    const side = (i % 2 ? -1 : 1) * (u < 0.5 ? lean : -lean) as 1 | -1;
    const hang = hangs.has(i);
    const angle = hang ? DOWN - side * rng.range(0.15, 0.9) : UP + side * rng.range(0.45, 1.3);
    const droop = hang ? side * rng.range(-0.3, 0.3) : side * rng.range(1.6, 2.6);
    const length = hang ? rng.range(18, 36) : rng.range(26, 44);
    const n = rng.int(9, 13);
    const stem = zigzagStem(rng, angle, length, droop, n);
    const nodes: Node[] = [];
    for (let j = 0; j < n; j++) {
      const t = (j + 1) / (n + 0.6);
      const size = lerp(6.8, 3, t) * rng.range(0.85, 1.12);
      nodes.push({
        t,
        side: j % 2 ? 1 : -1,
        leaf: { length: size, width: size * rng.range(0.82, 0.95), spread: rng.range(0.85, 1.25), curve: rng.gaussian(0, 0.08), tone: jitter(mix(green, LEAF_DEEP, rng.range(0, 0.3)), rng, 0.025) },
        bud: t > 0.35 && rng.chance(0.5) ? { stalk: rng.range(1.8, 3.4), r: rng.range(1.2, 1.7), window: [0, 0] } : undefined,
      });
    }
    shoots.push({ stem, nodes, window: [...stagger(i, ns, [0.05, 0.56], 0.62)] as [number, number], width: rng.range(0.85, 1.1), short: false });
  }
  // short shoots over the root fill the mound, so it reads as a cushion and not a spray
  const nc = rng.int(3, 4);
  for (let i = 0; i < nc; i++) {
    const side: 1 | -1 = i % 2 ? 1 : -1;
    const angle = UP + side * rng.range(0.2, 1.7);
    const n = rng.int(4, 6);
    const stem = zigzagStem(rng, angle, rng.range(10, 16), side * rng.range(0.6, 1.2), n);
    const nodes: Node[] = [];
    for (let j = 0; j < n; j++) {
      const t = (j + 1) / (n + 0.6);
      const size = lerp(6.4, 4, t) * rng.range(0.85, 1.1);
      nodes.push({ t, side: j % 2 ? 1 : -1, leaf: { length: size, width: size * rng.range(0.82, 0.95), spread: rng.range(0.85, 1.3), curve: rng.gaussian(0, 0.08), tone: jitter(mix(green, BLOOM, rng.range(0.1, 0.3)), rng, 0.025) } });
    }
    shoots.unshift({ stem, nodes, window: [...stagger(i, nc, [0.12, 0.5], 0.6)] as [number, number], width: 0.9, short: true });
  }

  const pick = rng.next();
  const nf = pick < 0.3 ? 1 : pick < 0.82 ? 2 : 3;
  // flowers on different shoots, at a node in the outer half
  const order = rng.shuffle(shoots.flatMap((sh, i) => (sh.short ? [] : [i])));
  const flowers: Flower[] = [];
  for (let k = 0; k < nf; k++) {
    const si = order[k % order.length]!;
    const sh = shoots[si]!;
    const ni = Math.min(sh.nodes.length - 2, Math.floor(sh.nodes.length * rng.range(0.45, 0.75)));
    const node = sh.nodes[ni]!;
    node.bud = undefined;
    const rot = rng.range(0, Math.PI * 2);
    const petals: CaperPetal[] = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + (i / 4) * Math.PI * 2 + rng.gaussian(0, 0.1);
      petals.push({ a, len: 1 + rng.gaussian(0, 0.07), wid: rng.range(0.95, 1.15), curve: rng.gaussian(0, 0.12), flush: 0 });
    }
    // the two upper petals (the flower's own up) carry the flush
    const flushK = rng.chance(0.6) ? rng.range(0.35, 0.75) : rng.range(0, 0.2);
    for (const pl of petals) if (Math.sin(pl.a) < 0.1) pl.flush = flushK;
    const stamens: Stamen[] = [];
    const nst = rng.int(22, 32);
    for (let i = 0; i < nst; i++) {
      stamens.push({ spread: rng.gaussian(0, 0.8), len: rng.range(0.9, 1.4), bow: rng.range(0.1, 0.24) });
    }
    flowers.push({
      shoot: si,
      node: ni,
      stalk: rng.range(4, 6.5),
      turn: rng.range(0.5, 0.9),
      size: rng.range(7.6, 8.8),
      tilt: rng.range(0.6, 0.85),
      petals,
      stamens,
      bud: [...stagger(k, nf, [0.42, 0.78], 0.6)] as [number, number],
      open: [...stagger(k, nf, [0.74, 1], 0.6)] as [number, number],
    });
  }

  // fit each shoot (leaves, buds and flowers padded) into the box
  for (const [si, sh] of shoots.entries()) {
    const fl = flowers.filter((f) => f.shoot === si);
    const pad = (t: number) => {
      const node = sh.nodes.find((n) => Math.abs(n.t - t) < 1e-9);
      const f = fl.find((f) => Math.abs(sh.nodes[f.node]!.t - t) < 1e-9);
      if (f) return f.stalk + f.size * 1.95;
      return (node?.leaf.length ?? 2) + (node?.bud ? node.bud.stalk + node.bud.r * 2 : 0) + 1;
    };
    const s = fitScale(sh.stem, pad, [1, ...sh.nodes.map((n) => n.t)]);
    sh.stem.length *= s;
  }

  const buds = shoots.flatMap((sh) => sh.nodes.filter((n) => n.bud).map((n) => n.bud!));
  rng.shuffle(buds).forEach((b, k) => (b.window = [...stagger(k, buds.length, [0.44, 0.76], 0.4)] as [number, number]));

  const seam: Pt[] = [{ x: rng.range(-5, -3), y: rng.range(-0.5, 0.5) }];
  seam.push({ x: rng.range(-1, 1), y: rng.range(0.6, 1.6) }, { x: rng.range(2, 4), y: rng.range(2.5, 4.5) }, { x: rng.range(3, 6), y: rng.range(6, 9) });
  return { shoots, flowers, seam };
}

function drawShoot(p: Painter, rng: Rng, sh: Shoot, si: number, plan: CaperPlan, g: number, buds: CaperBud[]): void {
  const k = ease(g, sh.window[0], sh.window[1]);
  if (!visible(k)) return;
  const ext = k;
  const full = stemPoints(sh.stem, 1, bendAt(g));
  const pts = subPath(full, lerp(0.03, 1, ext));
  paintStem(p, rng.fork('stem'), pts, { width: 0.95 * sh.width, pigment: STEM, opacity: 0.8, ink: 0.18 * k, inkReach: 0.5, inkPigment: mix(STEM, PIGMENTS.sumi, 0.45) });
  const leaves: FleshyLeaf[] = [];
  const spines: { key: string; at: Pt; angle: number; length: number }[] = [];
  sh.nodes.forEach((n, j) => {
    const lk = smooth((ext * 1.25 - n.t) / 0.4);
    if (!visible(lk)) return;
    const q = pointAt(full, n.t);
    // the leaf sits on the outside of the zigzag's kink and swings out from along the stem
    const angle = lerpAngle(q.angle, q.angle + n.side * n.leaf.spread, smooth(lk));
    const at = add(q, angle, 0.8 * lk);
    leaves.push({ key: `${si}-${j}`, at, angle, length: n.leaf.length * lk, width: n.leaf.width * lk * lerp(0.6, 1, lk), curve: n.leaf.curve, tone: n.leaf.tone });
    for (const s of [-1, 1]) {
      spines.push({ key: `${si}-${j}-${s}`, at: add(q, q.angle + s * DOWN, 0.4), angle: q.angle + Math.PI + s * 1.1, length: 1.25 * smooth(lk) });
    }
    if (n.bud) {
      const bk = ease(g, n.bud.window[0], n.bud.window[1]) * lk;
      if (visible(bk)) {
        const ba = lerpAngle(q.angle, q.angle - n.side * 0.7, bk);
        buds.push({ key: `${si}-${j}`, node: q, end: add(q, ba, n.bud.stalk * bk), angle: ba, r: n.bud.r * bk, white: 0 });
      }
    }
  });
  fleshyLeaves(p, rng.fork('leaves'), leaves, { deep: LEAF_DEEP, bloom: BLOOM, bloomK: ease(g, 0.25, 0.6), opacity: sh.short ? 0.72 : 0.86 });
  stipuleSpines(p, rng.fork('spines'), spines, SPINE);
  for (const f of plan.flowers) {
    if (plan.shoots[f.shoot] !== sh) continue;
    const node = sh.nodes[f.node]!;
    const lk = smooth((ext * 1.25 - node.t) / 0.4);
    const bud = ease(g, f.bud[0], f.bud[1]) * lk;
    if (!visible(bud)) continue;
    const q = pointAt(full, node.t);
    const open = ease(g, f.open[0], f.open[1]);
    // the long flower stalk arches out of the axil and lifts the flower clear of the leaves
    const sa = lerpAngle(q.angle, lerpAngle(q.angle - node.side * f.turn, UP, 0.35), bud);
    const end = add(q, sa, f.stalk * bud);
    const r = 2.1 * bud * (1 - 0.8 * smooth(open * 1.6));
    buds.push({ key: `f-${si}-${f.node}`, node: q, end, angle: sa, r, white: ease(g, f.bud[1] - 0.06, f.open[0] + 0.04) });
  }
}

function drawFlowers(p: Painter, rng: Rng, plan: CaperPlan, g: number): void {
  plan.flowers.forEach((f, i) => {
    const open = ease(g, f.open[0], f.open[1]);
    if (!visible(open)) return;
    const sh = plan.shoots[f.shoot]!;
    const node = sh.nodes[f.node]!;
    const full = stemPoints(sh.stem, 1, bendAt(g));
    const q = pointAt(full, node.t);
    const sa = lerpAngle(q.angle - node.side * f.turn, UP, 0.35);
    const c = add(q, sa, f.stalk);
    // the flower faces out along its stalk, a little up
    const roll = lerpAngle(sa, UP, 0.3);
    caperFlower(p, rng.fork(`fl-${i}`), c, { petals: f.petals, stamens: f.stamens, view: { tilt: lerp(0.35, f.tilt, smooth(open)), roll }, open, size: f.size, flush: FLUSH, violet: VIOLET, anther: ANTHER });
  });
}

const caper: SpeciesDef = {
  id: 'caper',
  name: 'Caper',
  nativeName: 'Kebbar',
  nativeLang: 'ary-Latn',
  // wild round the Mediterranean and in the Saharan oases; grown as a crop on Mediterranean terraces
  range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'], cultivatedIn: ['mediterranean'] },
  tier: 1,
  habitats: ['rock', 'path'],
  sizeClass: 'small',
  // drawn in the 70-unit design box; the root sits high so the shoots can spill down the wall
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.42 },
  description: 'Caper — a flower for a single day, on the crumbling wall.',
  bloomColor: '#f4ece6',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planCaper(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 14, ry: 7, x: 1, k: ease(g, 0.15, 0.7), opacity: 0.05, pigment: PIGMENTS.shadow });
      wallCrack(p, r.fork('crack'), plan.seam, { seed: 1 - ease(g, 0.04, 0.14), crown: ease(g, 0.08, 0.5) });
      const buds: CaperBud[] = [];
      plan.shoots.forEach((sh, i) => drawShoot(p, r.fork(`shoot-${i}`), sh, i, plan, g, buds));
      caperBuds(p, r.fork('buds'), buds, { green: BUD, stalk: mix(BUD, STEM, 0.4) });
      drawFlowers(p, r.fork('flowers'), plan, g);
    } finally {
      end();
    }
  },
};

export default caper;
