import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { mix } from '../../paint/pigments';
import { paintBlots, type Blot } from '../lib/katsura-paint';
import { paintFlowers, paintFruits, paintTwist, type FlowerMark, type FruitMark } from '../lib/pomegranate-paint';
import { inUnits, paintFallingPetals, paintGroundShadow, paintLeaves, paintSeed, paintSkeleton, paintTipLeaves, softRes, type Leaf, type Pad } from '../lib/tree-paint';
import { addBranch, addTrunk, clamp01, fitTree, growChildren, headingAt, normalise, pointAt, ramp, stagger, steer, treeView, viewPt, type Branch, type LevelSpec, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

/**
 * Pomegranate (Punica granatum): a small multi-stemmed tree of grey twisting stems and slender
 * twigs under a rounded, untidy crown of small glossy leaves, with waxy scarlet flowers and
 * round red fruits each wearing the calyx's little crown.
 */

const SIZE = { w: 300, h: 340 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
/** pads deeper than this are in front: their leaves cover the twigs and the back fruit */
const FRONT = -0.15;

export interface PomegranatePad extends Pad {
  /** -1 the shaded underside of its clump … 1 its lit top */
  lit: number;
}

export interface PomegranateFlower {
  at: Pt;
  angle: number;
  length: number;
  delay: number;
  id: number;
}

export interface PomegranateFruit {
  at: Pt;
  angle: number;
  r: number;
  blush: number;
  /** in front of the leaves, or half hidden among them */
  front: boolean;
  delay: number;
  id: number;
}

export interface PomegranatePlan {
  tree: Tree;
  pads: PomegranatePad[];
  /** narrow leaves in small fascicles, grouped by pad (or −1 for twigs past the crown) */
  leaves: (Leaf & { group: number; front: boolean; bronze: boolean })[];
  flowers: PomegranateFlower[];
  fruits: PomegranateFruit[];
  /** scarlet petals fallen at the foot */
  fallen: { x: number; y: number; r: number; rot: number; id: number }[];
  holes: { x: number; y: number; r: number }[];
}

const LEVELS: LevelSpec[] = [
  { count: [3, 4], span: [0.4, 0.95], angle: [0.35, 0.85], length: [0.4, 0.6], shrink: 0.3, up: 0.15, side: 'alternate', limb: { segments: 5, wander: 0.16, kink: 0.12, gravity: 0.03 }, width: 0.6, tipWidth: 0.3, dur: 0.7 },
  { count: [2, 3], span: [0.3, 1], angle: [0.4, 0.95], length: [0.38, 0.62], limb: { segments: 4, wander: 0.2, gravity: 0.1 }, width: 0.65, tipWidth: 0.45, minTip: 0.5, dur: 0.6, tag: 'twig' },
];

/** The whole tree for a seed — independent of growth. */
export function planPomegranate(rng: Rng): PomegranatePlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-8, 8), y: BASE_Y };
  const tree: Tree = { base: { ...base }, branches: [] };
  // three to five stems from one foot, the outer ones leaning out
  const n = r.int(3, 5);
  const trunkLen = r.range(140, 170);
  const spread = r.range(0.38, 0.56);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  const stems: Branch[] = [];
  order.forEach((i, rank) => {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const au = Math.abs(u);
    stems.push(
      addTrunk(tree, r, { x: base.x + u * r.range(3, 6), y: base.y }, {
        angle: UP + u * spread + r.gaussian(0, 0.05),
        length: trunkLen * (1 - 0.22 * au) * r.range(0.88, 1.04),
        width: (7 - 2 * au) * r.range(0.88, 1.08),
        tipWidth: 0.8,
        limb: { segments: 7, wander: 0.11, kink: 0.1, gravity: 0.01 },
        dur: 0.9,
        tag: rank % 2 === 1 ? 'back' : 'trunk',
      }, rank === 0 ? 0 : 0.03 + rank * 0.05 + r.range(0, 0.04)),
    );
  });
  for (const stem of stems) {
    const first = tree.branches.length;
    growChildren(tree, stem, LEVELS, r);
    if (stem.tag === 'back') for (let k = first; k < tree.branches.length; k++) if (tree.branches[k]!.tag !== 'twig') tree.branches[k]!.tag = 'back';
  }
  // one or two whips arching over from the outer stems: the untidy edge of the crown
  const outer = [stems.at(-1)!, stems.at(-2) ?? stems[0]!];
  for (const s of outer.slice(0, r.int(1, 2))) {
    const f = r.range(0.55, 0.8);
    const at = pointAt(s, f);
    const out = at.x >= base.x ? 1 : -1;
    const a = steer(headingAt(s, f) + out * r.range(0.25, 0.45), out > 0 ? 0 : Math.PI, 0.1);
    const len = r.range(48, 66);
    const pts = [at];
    let h = a;
    for (let i = 0; i < 6; i++) {
      h = steer(h, Math.PI / 2, 0.11) + r.gaussian(0, 0.06);
      const q = pts.at(-1)!;
      pts.push({ x: q.x + (Math.cos(h) * len) / 6, y: q.y + (Math.sin(h) * len) / 6 });
    }
    const pd = s.t1 - s.t0;
    const t0 = s.t0 + pd * f + 0.05;
    addBranch(tree, s.id, 1, { pts, w0: 2, w1: 0.5, attach: f, t0, t1: t0 + pd * 0.6, tag: 'whip' }, r);
  }
  // a sucker or two at the foot
  for (let s = 0, ns = r.int(1, 2); s < ns; s++) {
    const side = s % 2 === 0 ? 1 : -1;
    addTrunk(tree, r, { x: base.x + side * r.range(8, 13), y: base.y + 1 }, { angle: UP + side * r.range(0.2, 0.5), length: r.range(22, 34), width: 1.4, tipWidth: 0.55, limb: { segments: 3, wander: 0.14 }, tag: 'sucker' });
  }
  normalise(tree);
  for (const b of tree.branches)
    if (b.tag === 'sucker') {
      b.t0 = 0.55 + (b.id % 3) * 0.06;
      b.t1 = b.t0 + 0.25;
    }
  fitTree(tree, SIZE, 18, 36);

  // the crown: a rounded, lobed dome over the twig tips, ragged where whips and twigs poke out
  const pr = rng.fork('pads');
  const crown = tree.branches.filter((b) => b.tag !== 'sucker' && b.tag !== 'whip' && b.order >= 1);
  const tips = crown.map((b) => pointAt(b, 1));
  const at = (k: number, key: (q: Pt) => number) => tips.map(key).sort((a, b) => a - b)[Math.min(tips.length - 1, Math.floor(tips.length * k))]!;
  const x0 = at(0.05, (q) => q.x);
  const x1 = at(0.95, (q) => q.x);
  const top = (at(0.08, (q) => q.y) + Math.min(...tips.map((q) => q.y))) / 2 - 12;
  const low = at(0.92, (q) => q.y);
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2 + 12;
  const ry = Math.min((low - top) * 0.55, rx * 0.82);
  const cy = top + ry;
  const ph = [pr.range(0, 6.3), pr.range(0, 6.3), pr.range(0, 6.3)];
  const lobe = (a: number) => 1 + 0.08 * Math.sin(3 * a + ph[0]!) + 0.07 * Math.sin(5 * a + ph[1]!) + 0.05 * Math.sin(9 * a + ph[2]!);
  const dome = (x: number, y: number) => {
    const p = y < cy ? 1.75 : 2;
    return (Math.abs((x - cx) / rx) ** p + Math.abs((y - cy) / (y > cy ? ry * 0.92 : ry)) ** p) ** (1 / p);
  };
  const nearest = (x: number, y: number) => {
    let near = crown[0]!;
    let best = Infinity;
    for (const b of crown) {
      const q = pointAt(b, 1);
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < best) {
        best = d;
        near = b;
      }
    }
    return near;
  };
  const holes: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; tries < 60 && holes.length < pr.int(2, 3); tries++) {
    const a = pr.range(-Math.PI * 0.95, Math.PI * 0.1);
    const d = pr.range(0.35, 0.72);
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d * 0.85;
    if (holes.some((h) => Math.hypot(h.x - x, h.y - y) < 50)) continue;
    holes.push({ x, y, r: pr.range(6, 10) });
  }
  const pads: PomegranatePad[] = [];
  const add = (x: number, y: number, rad: number, delay: number, branch: number) => {
    for (const q of pads) if (Math.hypot(q.x - x, (q.y - y) * 1.2) < (q.r + rad) * 0.42) return;
    if (holes.some((h) => Math.hypot(h.x - x, h.y - y) < h.r + 2)) return;
    pads.push({ x, y, r: rad, delay, id: pads.length, depth: pr.range(-1, 1), branch, lit: 0 });
  };
  let row = 0;
  for (let y = top + 8; y < cy + ry * 0.95; y += 18, row++)
    for (let x = cx - rx + (row % 2) * 13; x <= cx + rx; x += 26) {
      const jx = x + pr.range(-6, 6);
      const jy = y + pr.range(-5, 5);
      const d = dome(jx, jy);
      if (d > pr.range(0.84, 0.96) * lobe(Math.atan2(jy - cy, jx - cx))) continue;
      const near = nearest(jx, jy);
      add(jx, jy, pr.range(18, 24) * (1.1 - 0.25 * d), Math.min(1, near.t1 * 0.55 + 0.05 + 0.3 * d + pr.range(0, 0.15)), near.id);
    }
  // limbs, twigs and whips that reach past the dome carry small clumps out along them
  for (const b of tree.branches) {
    if (b.tag === 'sucker' || b.order === 0) continue;
    const tip = pointAt(b, 1);
    if (dome(tip.x, tip.y) < 0.92) continue;
    for (let f = 1; f > 0.35; f -= 12 / Math.max(12, b.len)) {
      const q = pointAt(b, f);
      if (dome(q.x, q.y) < 0.82) break;
      add(q.x, q.y - 1, pr.range(12, 16) * (0.75 + 0.25 * f), Math.min(1, b.t1 * 0.55 + 0.25 + pr.range(0, 0.15)), b.id);
    }
  }
  const clumps: { x: number; y: number; r: number }[] = [];
  const gap = rx * 0.38;
  for (const q of pr.shuffle(tips.slice())) {
    if (dome(q.x, q.y) > 1.05 || clumps.some((c) => Math.hypot(c.x - q.x, c.y - q.y) < gap)) continue;
    clumps.push({ x: q.x, y: q.y, r: gap * 0.85 });
  }
  for (const pad of pads) {
    let c = clumps[0] ?? { x: cx, y: cy, r: rx };
    for (const q of clumps) if (Math.hypot(q.x - pad.x, q.y - pad.y) / q.r < Math.hypot(c.x - pad.x, c.y - pad.y) / c.r) c = q;
    const loc = (-(pad.y - c.y) * 0.9 - (pad.x - c.x) * 0.35) / c.r;
    const whole = (-(pad.y - cy) / ry) * 0.7 - ((pad.x - cx) / rx) * 0.3;
    pad.lit = Math.max(-1, Math.min(1, 0.6 * loc + 0.5 * whole + pr.range(-0.15, 0.15)));
  }

  // narrow leaves in fascicles of two to four on short spurs, thick on the rim and the lit top
  const lr = rng.fork('leaves');
  const leaves: PomegranatePlan['leaves'] = [];
  for (const pad of pads) {
    const d = dome(pad.x, pad.y);
    const front = (pad.depth ?? 0) > FRONT;
    const spurs = Math.round((pad.r / 1.9) * (d > 0.72 ? 1 : front ? 0.8 : 0.55));
    for (let i = 0; i < spurs; i++) {
      const th = d > 0.72 ? Math.atan2(pad.y - cy, pad.x - cx) + lr.gaussian(0, 0.9) : lr.range(-Math.PI, Math.PI);
      const k = lr.chance(0.7) ? lr.range(0.6, 1.02) : lr.range(0.15, 0.6);
      const sx = pad.x + Math.cos(th) * pad.r * k;
      const sy = pad.y + Math.sin(th) * pad.r * 0.65 * k;
      if (holes.some((h) => Math.hypot(h.x - sx, h.y - sy) < h.r * 0.8)) continue;
      const out = Math.atan2(Math.sin(th) * 0.6 - 0.3, Math.cos(th));
      const bronze = d > 0.8 && pad.lit > 0.2 && lr.chance(0.12);
      const tone = lr.range(0, 1);
      for (let j = 0, m = lr.int(1, 3); j < m; j++)
        leaves.push({ x: sx, y: sy, angle: out + (j - (m - 1) / 2) * lr.range(0.16, 0.3) + lr.gaussian(0, 0.2), length: lr.range(6.5, 9), width: lr.range(0.26, 0.34), tone: clamp01(tone + lr.range(-0.2, 0.2)), delay: clamp01(pad.delay + lr.range(-0.05, 0.12)), id: leaves.length, variant: 'leaf', curve: lr.range(-0.2, 0.2), group: pad.id, front, bronze });
    }
  }

  const flowers: PomegranateFlower[] = [];
  const fruits: PomegranateFruit[] = [];
  const taken: Pt[] = [];
  const free = (q: Pt, d: number) => taken.every((t) => Math.hypot(t.x - q.x, t.y - q.y) > d);
  // a few fruits, heavy round globes on the crown's flanks and lower rim, crowns outward
  const xr = rng.fork('fruits');
  const nf = xr.int(4, 6);
  const cands = xr.shuffle(pads.filter((pad) => {
    const d = dome(pad.x, pad.y);
    return d > 0.35 && d < 1 && pad.y > top + ry * 0.4;
  }));
  for (const pad of cands) {
    if (fruits.length >= nf) break;
    const outA = Math.atan2(pad.y - cy, pad.x - cx);
    const q = { x: pad.x + Math.cos(outA) * pad.r * 0.4, y: pad.y + Math.sin(outA) * pad.r * 0.3 + 3 };
    if (!free(q, 20)) continue;
    // the crown points out and a little up, never straight down
    let a = steer(outA, UP, 0.25) + xr.gaussian(0, 0.3);
    if (Math.sin(a) > 0.2) a = Math.cos(a) >= 0 ? 0.2 : Math.PI - 0.2;
    taken.push(q);
    fruits.push({ at: q, angle: a, r: xr.range(7.5, 9.5), blush: xr.range(0.55, 1), front: fruits.length % 3 !== 2, delay: xr.range(0, 1), id: fruits.length });
  }

  // flowers at the twig tips round the crown's rim, facing out and up
  const fr = rng.fork('flowers');
  const rim = fr.shuffle(tree.branches.filter((b) => b.order >= 1 && b.tag !== 'sucker'));
  const want = fr.int(9, 13);
  for (const b of rim) {
    if (flowers.length >= want) break;
    const q = pointAt(b, fr.range(0.88, 1));
    const d = dome(q.x, q.y);
    if (d < 0.6 || d > 1.25 || !free(q, 15) || q.y > cy + ry * 0.75) continue;
    const outA = Math.atan2(q.y - cy, q.x - cx);
    const a = steer(steer(headingAt(b, 1), outA, 0.5), UP, 0.3) + fr.gaussian(0, 0.25);
    taken.push(q);
    flowers.push({ at: q, angle: a, length: fr.range(10, 12.5), delay: clamp01(0.3 * (1 - d) + fr.range(0, 0.7)), id: flowers.length });
  }
  // a crown with few twigs on its rim carries flowers on the rim's leaf clumps instead
  for (const pad of fr.shuffle(pads.slice())) {
    if (flowers.length >= 7) break;
    const outA = Math.atan2(pad.y - cy, pad.x - cx);
    const q = { x: pad.x + Math.cos(outA) * pad.r * 0.6, y: pad.y + Math.sin(outA) * pad.r * 0.4 };
    if (dome(q.x, q.y) < 0.7 || !free(q, 15) || q.y > cy + ry * 0.75) continue;
    taken.push(q);
    flowers.push({ at: q, angle: steer(outA, UP, 0.3) + fr.gaussian(0, 0.25), length: fr.range(10, 12.5), delay: fr.range(0.2, 1), id: flowers.length });
  }

  const pf = rng.fork('fallen');
  const fallen = Array.from({ length: pf.int(3, 6) }, (_, i) => ({ x: base.x + pf.gaussian(0, 40), y: BASE_Y + pf.range(-3, 6), r: pf.range(2.6, 3.4), rot: pf.range(0, Math.PI * 2), id: i }));
  return { tree, pads, leaves, flowers, fruits, fallen, holes };
}

const BARK = mix('#8a877e', '#9d9787', 0.3);
const BARK_BACK = mix(BARK, '#b4ae9e', 0.4);
const LIMB = mix(BARK, '#8e7960', 0.25);
/** the narrow glossy leaf: a clear spring green, deeper in the clumps' shade */
const LEAF = { light: '#a9c062', mid: '#7f9c48', shadow: '#4f7036', dark: '#3a552c' };
const BRONZE = '#b2664a';
const FLOWER = { calyx: '#a8302a', calyxShade: '#6e2024', petal: '#ea5a36', petalDeep: '#b8322a' };
const FRUIT = { unripe: '#a9ad5c', gold: '#d9925a', rose: '#bf4438', deep: '#76302e', crown: '#8a3a30' };

/** growth window of the foliage pads (as `stagger`) */
const FOLIAGE: [number, number, number] = [0.42, 0.72, 0.14];

/** How far each mark has arrived at growth g (0 = not yet, 1 = full size). */
export function pomegranateArrivals(g: number) {
  return {
    pad: (pad: Pick<Pad, 'delay'>) => stagger(g, FOLIAGE[0], FOLIAGE[1], pad.delay, FOLIAGE[2]),
    leaf: (l: Pick<Leaf, 'delay'>) => stagger(g, FOLIAGE[0] + 0.03, FOLIAGE[1] + 0.05, l.delay, 0.15),
    /** the calyx buds, flowers' and fruits' alike */
    bud: (m: { delay: number }) => stagger(g, 0.6, 0.82, m.delay, 0.12),
    petals: (m: { delay: number }) => stagger(g, 0.76, 0.96, m.delay, 0.12),
    swell: (m: { delay: number }) => stagger(g, 0.78, 1, m.delay * 0.5, 0.17),
    ripe: (m: { delay: number }) => stagger(g, 0.86, 1, m.delay * 0.5, 0.12),
    fallen: ramp(g, 0.93, 1),
    tips: 1 - ramp(g, 0.5, 0.7),
  };
}

const pomegranate: SpeciesDef = {
  id: 'pomegranate',
  name: 'Pomegranate',
  nativeName: 'Rremman',
  nativeLang: 'ary-Latn',
  // grown in every palmeraie; wild only from Iran to the Himalaya
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 4,
  habitats: ['meadow', 'back'],
  sizeClass: 'large',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Pomegranate — little crowns ripening in the palms’ shade.',
  bloomColor: '#d0503a',
  pollinators: true,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planPomegranate(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const arrive = pomegranateArrivals(g);
    const lit = new Map(plan.pads.map((pad) => [pad.id, pad.lit]));
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 75, view, pr);
      paintSeed(p, plan.tree.base, g, pr, mix('#8e7960', FLOWER.calyx, 0.2));
      const part = (keep: (b: Branch) => boolean): Tree => ({ base: plan.tree.base, branches: plan.tree.branches.filter(keep) });
      const back = paintSkeleton(p, part((b) => b.order === 0 && b.tag === 'back'), view, pr.fork('back'), { pigment: BARK_BACK, texture: 0.5, modelling: 0.45, flare: 0.35, wobble: 0.35, opacity: 0.85 });
      const front = paintSkeleton(p, part((b) => b.order === 0 && b.tag === 'trunk'), view, pr, { pigment: BARK, texture: 0.7, modelling: 0.6, flare: 0.4, wobble: 0.4 });
      paintTwist(p, [...back, ...front], pr.fork('twist'), BARK);
      const limbs = paintSkeleton(p, part((b) => b.order > 0 || b.tag === 'sucker'), view, pr.fork('limbs'), { pigment: LIMB, texture: 0.25, modelling: 0.3, opacity: 0.7, wobble: 0.3 });
      paintTipLeaves(p, [...back, ...front, ...limbs], view, arrive.tips, pr.fork('tips'), { pigment: mix(BRONZE, LEAF.mid, 0.55), size: 5 });

      // the crown's body: a soft wash over the twigs, then the clumps' shaded undersides
      const live = plan.pads.map((pad) => ({ pad, k: arrive.pad(pad), at: viewPt(view, pad) }));
      const holes = plan.holes.map((h) => ({ ...viewPt(view, h), r: h.r * view.scale * ramp(g, FOLIAGE[0], FOLIAGE[1]) }));
      const body: Blot[] = live.map(({ pad, k, at }) => ({ x: at.x, y: at.y, r: pad.r * view.scale * k * 0.92, alpha: Math.min(1, k * 2.5) * 0.6, pigment: mix(LEAF.light, LEAF.mid, 0.45 + 0.5 * (1 - pad.lit) / 2), id: pad.id }));
      paintBlots(p, body, pr.fork('body'), holes, { opacity: 0.9, edge: 0.22, edgeWidth: 1.2, sharpness: 0.55, centreLift: 0.2, granulation: 0.15, flow: 0.45, flowScale: 12, blend: 'source-over' }, softRes(p), 0.8, 0.95);
      const shadeBlots: Blot[] = live
        .filter(({ pad }) => pad.lit < 0.3)
        .map(({ pad, k, at }) => ({ x: at.x + pad.r * k * 0.06, y: at.y + pad.r * k * 0.3, r: pad.r * view.scale * k * 0.7, alpha: Math.min(1, k * 2.5) * ramp(0.3 - pad.lit, 0, 0.9), pigment: LEAF.shadow, id: pad.id + 500 }));
      paintBlots(p, shadeBlots, pr.fork('shade'), holes, { opacity: 0.55, edge: 0.15, edgeWidth: 2, sharpness: 0.3, centreLift: 0.1, granulation: 0.22, flow: 0.55, flowScale: 16 }, softRes(p), 0.62, 0.9, 3);

      // leaves, the shaded ones deeper; a few bronze shoots on the lit rim
      const leafTone = (l: PomegranatePlan['leaves'][number]): number => {
        const s = lit.get(l.group) ?? 0;
        return s > -0.1 ? l.tone * 0.55 : 0.45 + Math.min(0.55, (-0.1 - s) * 0.6 + l.tone * 0.25);
      };
      const paintSet = (set: PomegranatePlan['leaves'], key: string, dry: object) => {
        const green = set.filter((l) => !l.bronze).map((l) => ({ ...l, tone: leafTone(l) }));
        paintLeaves(p, green, view, pr.fork(`${key}-g`), arrive.leaf, LEAF.light, LEAF.dark, dry);
        paintLeaves(p, set.filter((l) => l.bronze), view, pr.fork(`${key}-r`), arrive.leaf, mix(BRONZE, '#e0a07a', 0.35), mix(BRONZE, LEAF.mid, 0.3), dry);
      };
      const fruitMarks = (front: boolean): FruitMark[] =>
        plan.fruits.filter((f) => f.front === front).map((f) => ({ at: viewPt(view, f.at), angle: f.angle, r: f.r, calyx: arrive.bud(f), swell: arrive.swell(f), ripe: arrive.ripe(f), blush: f.blush, id: f.id }));
      paintSet(plan.leaves.filter((l) => !l.front), 'back', { opacity: 0.75, darken: 0.15, edge: 0.4 });
      paintFruits(p, fruitMarks(false), pr.fork('fruit-back'), FRUIT);
      paintSet(plan.leaves.filter((l) => l.front), 'front', { opacity: 0.88, blend: 'source-over', sharpness: 0.85, edge: 0.6 });
      paintFruits(p, fruitMarks(true), pr.fork('fruit-front'), FRUIT);
      const flowers: FlowerMark[] = plan.flowers.map((f) => ({ at: viewPt(view, f.at), angle: f.angle, length: f.length, calyx: arrive.bud(f), petals: arrive.petals(f), id: f.id }));
      paintFlowers(p, flowers, pr.fork('flowers'), FLOWER);
      paintFallingPetals(p, plan.fallen, FLOWER.petal, pr.fork('fallen'), arrive.fallen);
    });
  },
};

export default pomegranate;
