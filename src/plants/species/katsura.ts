import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { PIGMENTS, darken, lighten, mix, type Pigment } from '../../paint/pigments';
import type { FoliagePigments } from '../../paint/recipes';
import { paintBlots, paintHearts, paintShaggyBark, paintTipHearts, type Blot, type Heart } from '../lib/katsura-paint';
import { inUnits, paintGroundShadow, paintSeed, paintSkeleton, softRes, type Pad } from '../lib/tree-paint';
import { addTrunk, clamp01, fitTree, growChildren, normalise, pointAt, ramp, stagger, treeView, viewPt, type Branch, type LevelSpec, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
/** pads deeper than this are in front: their leaves cover the twigs */
const FRONT = -0.15;

export interface KatsuraPad extends Pad {
  /** 0 gold … 1 pink in autumn */
  pink: number;
  /** when it turns, 0..1 within the autumn window */
  turn: number;
  /** -1 the shaded underside of its clump … 1 its lit top */
  lit: number;
}

export interface KatsuraPlan {
  tree: Tree;
  pads: KatsuraPad[];
  /** heart leaves in pairs on short spurs, around and over the pads */
  hearts: Heart[];
  /** young wine-red hearts on the suckers at the foot */
  sucker: Heart[];
  /** hearts fallen around the foot */
  fallen: Heart[];
  /** sky holes through the crown, lifted out of its wash */
  holes: { x: number; y: number; r: number }[];
}

const LEVELS: LevelSpec[] = [
  { count: [3, 5], span: [0.3, 0.97], angle: [0.4, 0.9], length: [0.3, 0.46], shrink: 0.35, up: 0.12, side: 'alternate', limb: { segments: 4, wander: 0.1, gravity: -0.01 }, width: 0.55, tipWidth: 0.3, dur: 0.7 },
  { count: [1, 2], span: [0.35, 1], angle: [0.35, 0.75], length: [0.4, 0.6], limb: { segments: 3, wander: 0.14 }, width: 0.6, tipWidth: 0.4, dur: 0.6 },
];

/** The whole tree for a seed — independent of growth. */
export function planKatsura(rng: Rng): KatsuraPlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2 + r.range(-8, 8), y: BASE_Y };
  const tree: Tree = { base: { ...base }, branches: [] };
  // a ring of stems from one base: centre ones tall and upright, outer ones leaning out
  const n = r.int(4, 6);
  const trunkLen = r.range(255, 295);
  const spread = r.range(0.32, 0.46);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  const stems: Branch[] = [];
  order.forEach((i, rank) => {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const au = Math.abs(u);
    const stem = addTrunk(tree, r, { x: base.x + u * r.range(5, 8), y: base.y }, {
      angle: UP + u * spread + r.gaussian(0, 0.04),
      length: trunkLen * (1 - 0.2 * au) * r.range(0.9, 1.04),
      width: (10 - 3 * au) * r.range(0.88, 1.08),
      tipWidth: 0.9,
      limb: { segments: 7, wander: 0.05, gravity: -0.02, curl: 0 },
      dur: 0.9,
      tag: rank % 2 === 1 ? 'back' : 'trunk',
    }, rank === 0 ? 0 : 0.03 + rank * 0.05 + r.range(0, 0.04));
    stems.push(stem);
  });
  for (const stem of stems) {
    const first = tree.branches.length;
    growChildren(tree, stem, LEVELS, r);
    if (stem.tag === 'back') for (let k = first; k < tree.branches.length; k++) tree.branches[k]!.tag = 'back';
  }
  // suckers at the foot: short whips that come late
  const ns = r.int(1, 3);
  for (let s = 0; s < ns; s++) {
    const side = s % 2 === 0 ? 1 : -1;
    addTrunk(tree, r, { x: base.x + side * r.range(9, 14), y: base.y + 1 }, {
      angle: UP + side * r.range(0.25, 0.6),
      length: r.range(24, 40),
      width: 1.5,
      tipWidth: 0.6,
      limb: { segments: 3, wander: 0.12, gravity: -0.05 },
      tag: 'sucker',
    });
  }
  normalise(tree);
  for (const b of tree.branches)
    if (b.tag === 'sucker') {
      b.t0 = 0.6 + (b.id % 3) * 0.06;
      b.t1 = b.t0 + 0.25;
    }
  fitTree(tree, SIZE, 30, 36);

  const pr = rng.fork('pads');
  const pads: KatsuraPad[] = [];
  const phase = pr.range(0, 6.3);
  const phase2 = pr.range(0, 6.3);
  const add = (x: number, y: number, rad: number, delay: number, branch: number) => {
    for (const q of pads) if (Math.hypot(q.x - x, (q.y - y) * 1.2) < (q.r + rad) * 0.42) return;
    // patches of pink among the gold, not an even salmon
    const noise = Math.sin(x / 37 + phase) * Math.cos(y / 29 + phase2) + 0.5 * Math.sin((x + y) / 23 + phase2) + pr.range(-0.35, 0.35);
    if (holes.some((h) => Math.hypot(h.x - x, h.y - y) < h.r)) return;
    pads.push({ x, y, r: rad, delay, id: pads.length, depth: pr.range(-1, 1), branch, pink: ramp(noise, 0.05, 0.75), turn: 0, lit: 0 });
  };
  const crown = tree.branches.filter((b) => b.tag !== 'sucker' && (b.order >= 1 || b.parent < 0));
  const tips = crown.map((b) => pointAt(b, 1));
  const at = (k: number, key: (q: Pt) => number) => tips.map(key).sort((a, b) => a - b)[Math.min(tips.length - 1, Math.floor(tips.length * k))]!;
  const x0 = at(0.06, (q) => q.x);
  const x1 = at(0.94, (q) => q.x);
  // the dome mounds above the highest tip, so its top is rounded, not flat
  const top = (at(0.08, (q) => q.y) + Math.min(...tips.map((q) => q.y))) / 2 - 16;
  const low = at(0.9, (q) => q.y);
  // a broad, lobed dome around most tips, its underside flatter
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2 + 16;
  const ry = Math.min((low - top) * 0.52, rx * 0.75);
  const cy = top + ry;
  const lobe = (a: number) => 1 + 0.06 * Math.sin(3 * a + phase) + 0.05 * Math.sin(5 * a + phase2) + 0.03 * Math.sin(8 * a + phase * 2);
  // a lower exponent above the centre cuts the shoulders, so the top mounds instead of flattening
  const dome = (x: number, y: number) => {
    const p = y < cy ? 1.65 : 2;
    return (Math.abs((x - cx) / rx) ** p + Math.abs((y - cy) / (y > cy ? ry * 0.9 : ry)) ** p) ** (1 / p);
  };
  const nearest = (x: number, y: number) => {
    let near = crown[0]!;
    let best = Infinity;
    for (const b of crown) {
      const q = pointAt(b, 1);
      const dd = Math.hypot(q.x - x, q.y - y);
      if (dd < best) {
        best = dd;
        near = b;
      }
    }
    return near;
  };
  // foliage masses at the limb ends: each clump is lit on top and shaded beneath
  const clumps: { x: number; y: number; r: number }[] = [];
  const gap = rx * 0.4;
  for (const q of pr.shuffle(tips.slice())) {
    if (dome(q.x, q.y) > 1.05 || clumps.some((c) => Math.hypot(c.x - q.x, c.y - q.y) < gap)) continue;
    clumps.push({ x: q.x, y: q.y, r: gap * 0.85 });
  }
  // a few deliberate sky holes, where the clumps leave room
  const holes: { x: number; y: number; r: number }[] = [];
  const nh = pr.int(1, 2);
  for (let tries = 0; tries < 60 && holes.length < nh; tries++) {
    const a = pr.range(-Math.PI, Math.PI);
    const d = pr.range(0.4, 0.72);
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d * 0.8;
    const room = Math.min(...clumps.map((c) => Math.hypot(c.x - x, c.y - y)));
    if (room < gap * 0.45 || holes.some((h) => Math.hypot(h.x - x, h.y - y) < 60)) continue;
    holes.push({ x, y, r: pr.range(7, 12) });
  }
  let row = 0;
  for (let y = top + 10; y < cy + ry * 0.95; y += 20, row++)
    for (let x = cx - rx + (row % 2) * 15; x <= cx + rx; x += 30) {
      const jx = x + pr.range(-6, 6);
      const jy = y + pr.range(-5, 5);
      const d = dome(jx, jy);
      const rim = pr.range(0.86, 0.96);
      const rad = pr.range(23, 30) * (1.1 - 0.25 * d);
      if (d > rim * lobe(Math.atan2(jy - cy, jx - cx))) continue;
      const near = nearest(jx, jy);
      add(jx, jy, rad, Math.min(1, near.t1 * 0.55 + 0.05 + 0.3 * d + pr.range(0, 0.15)), near.id);
    }
  // limbs that reach past the dome carry leaves out along them: a lobe, not a lone tuft
  for (const b of crown) {
    if (dome(pointAt(b, 1).x, pointAt(b, 1).y) < 0.95) continue;
    for (let f = 1; f > (b.order === 0 ? 0.85 : 0.45); f -= 14 / Math.max(14, b.len)) {
      const q = pointAt(b, f);
      if (dome(q.x, q.y) < 0.85) break;
      add(q.x, q.y - 2, pr.range(17, 23) * (0.8 + 0.2 * f), Math.min(1, b.t1 * 0.55 + 0.25 + pr.range(0, 0.15)), b.id);
    }
  }
  // autumn comes to the top and the outside first
  for (const pad of pads) {
    const d = dome(pad.x, pad.y);
    pad.turn = clamp01(0.45 * (1 - d) + 0.25 * ((pad.y - top) / (2 * ry)) + pr.range(0, 0.35));
    let c = clumps[0] ?? { x: cx, y: cy, r: rx };
    for (const q of clumps) if (Math.hypot(q.x - pad.x, q.y - pad.y) / q.r < Math.hypot(c.x - pad.x, c.y - pad.y) / c.r) c = q;
    const local = (-(pad.y - c.y) * 0.9 - (pad.x - c.x) * 0.35) / c.r;
    const whole = (-(pad.y - cy) / ry) * 0.7 - ((pad.x - cx) / rx) * 0.3;
    pad.lit = Math.max(-1, Math.min(1, 0.65 * local + 0.45 * whole + pr.range(-0.15, 0.15)));
  }

  // pairs of round hearts on short spurs: thick on the rim and the lit top
  const hr = rng.fork('hearts');
  const hearts: Heart[] = [];
  for (const pad of pads) {
    const d = dome(pad.x, pad.y);
    const spurs = Math.round((pad.r / 3.2) * (d > 0.72 ? 1 : (pad.depth ?? 0) > FRONT ? 0.85 : 0.6));
    for (let i = 0; i < spurs; i++) {
      // rim spurs face outward from the dome's centre
      const th = d > 0.72 ? Math.atan2(pad.y - cy, pad.x - cx) + hr.gaussian(0, 0.9) : hr.range(-Math.PI, Math.PI);
      const k = hr.chance(0.7) ? hr.range(0.75, 1.05) : hr.range(0.2, 0.7);
      const sx = pad.x + Math.cos(th) * pad.r * k;
      const sy = pad.y + Math.sin(th) * pad.r * 0.62 * k;
      const out = Math.atan2(Math.sin(th) * 0.7 + 0.25, Math.cos(th));
      const len = hr.range(6.4, 8.6);
      const tone = hr.range(0, 1);
      const delay = clamp01(pad.delay + hr.range(-0.05, 0.12));
      for (let s = -1; s <= 1; s += 2)
        if (!holes.some((h) => Math.hypot(h.x - sx, h.y - sy) < h.r + 4)) hearts.push({ x: sx, y: sy, angle: out + s * hr.range(0.45, 0.8) + hr.gaussian(0, 0.12), length: len * hr.range(0.88, 1.08), tone: clamp01(tone + hr.range(-0.2, 0.2)), delay, id: hearts.length, group: pad.id });
    }
  }
  const sr = rng.fork('sucker');
  const sucker: Heart[] = [];
  for (const b of tree.branches) {
    if (b.tag !== 'sucker') continue;
    for (const f of [0.6, 1]) {
      const at = pointAt(b, f);
      const a = UP + (at.x > base.x ? 0.4 : -0.4);
      for (let s = -1; s <= 1; s += 2) sucker.push({ x: at.x, y: at.y, angle: a + s * sr.range(0.5, 0.9), length: sr.range(5.5, 7) * (f === 1 ? 0.85 : 1), tone: sr.range(0, 1), delay: f, id: sucker.length, group: b.id });
    }
  }
  const fr = rng.fork('fallen');
  const fallen: Heart[] = Array.from({ length: fr.int(12, 20) }, (_, i) => ({
    x: base.x + fr.gaussian(0, 48),
    y: BASE_Y + fr.range(-3, 7),
    angle: fr.range(0, Math.PI * 2),
    length: fr.range(4, 5.4),
    tone: fr.range(0, 1),
    delay: fr.range(0, 1),
    id: i,
    group: fr.chance(0.4) ? 1 : 0,
  }));
  return { tree, pads, hearts, sucker, fallen, holes };
}

const BARK = PIGMENTS.stoneDark;
const BARK_BACK = mix(PIGMENTS.stoneDark, PIGMENTS.stone, 0.45);
const LIMB = mix(PIGMENTS.stoneDark, PIGMENTS.stoneWarm, 0.35);
const WINE = '#b5525c';
const WINE_LIGHT = lighten(mix(WINE, '#d98a8e', 0.4), 0.04);
/** the flush of new leaves: a clear rosy wash, so it does not mud as it greens */
const YOUNG: FoliagePigments = { light: mix(WINE, '#f2c4bc', 0.55), mid: mix(WINE, '#e3a0a0', 0.25), shadow: WINE, dark: darken(WINE, 0.12) };
/** katsura's summer leaf is a cool blue-green, glaucous beneath */
const SUMMER: FoliagePigments = { light: '#aec29a', mid: '#8ea870', shadow: '#5f8a7c', dark: '#4b6a60' };
const GOLD: FoliagePigments = { light: '#f0c681', mid: '#e3a24c', shadow: '#c88444', dark: '#9b6040' };
const PINK: FoliagePigments = { light: '#f1b6a4', mid: '#e38f7e', shadow: '#c56e6a', dark: '#93515a' };

function blend(a: FoliagePigments, b: FoliagePigments, t: number): FoliagePigments {
  return { light: mix(a.light, b.light, t), mid: mix(a.mid, b.mid, t), shadow: mix(a.shadow, b.shadow, t), dark: mix(a.dark ?? a.shadow, b.dark ?? b.shadow, t) };
}

/** growth window of the foliage pads (as `stagger`) */
const FOLIAGE: [number, number, number] = [0.46, 0.76, 0.14];
const arrival = (d: number) => FOLIAGE[0] + clamp01(d) * (FOLIAGE[1] - FOLIAGE[0] - FOLIAGE[2]);

/** A pad's colour at growth g: wine-red as it unfurls, blue-green, then gold and pink. */
export function katsuraPadColour(pad: KatsuraPad, g: number): FoliagePigments {
  const a = arrival(pad.delay);
  const green = ramp(g, a + 0.04, a + 0.16);
  const autumn = blend(GOLD, PINK, pad.pink * 0.8);
  return blend(blend(YOUNG, SUMMER, green), autumn, stagger(g, 0.74, 1, pad.turn, 0.16));
}

/** How far each mark has arrived at growth g (0 = not yet, 1 = full size); the draw uses these. */
export function katsuraArrivals(g: number) {
  const carpet = ramp(g, 0.8, 1);
  return {
    pad: (pad: Pad) => stagger(g, FOLIAGE[0], FOLIAGE[1], pad.delay, FOLIAGE[2]),
    heart: (h: Heart) => stagger(g, FOLIAGE[0] + 0.04, FOLIAGE[1] + 0.06, h.delay, 0.16),
    sucker: (h: Heart) => ramp(g, 0.62 + h.delay * 0.1, 0.8 + h.delay * 0.1),
    fallen: (h: Heart) => ramp(carpet, h.delay * 0.4, h.delay * 0.4 + 0.6),
    /** opacity of the young tip leaves, which hand over to the crown */
    tips: 1 - ramp(g, 0.56, 0.74),
  };
}

const katsura: SpeciesDef = {
  id: 'katsura',
  name: 'Katsura',
  nativeName: 'Katsura',
  // riparian forests of valley bottoms and mountain streams
  range: { realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate'] },
  tier: 4,
  habitats: ['back', 'meadow'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Katsura — round hearts that turn gold and smell of caramel.',
  bloomColor: '#e3a24c',
  pollinators: false,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planKatsura(rng);
    const view = treeView(g, plan.tree.base);
    const pr = rng.fork('paint');
    const arrive = katsuraArrivals(g);
    const colours = new Map(plan.pads.map((pad) => [pad.id, katsuraPadColour(pad, g)]));
    const depth = new Map(plan.pads.map((pad) => [pad.id, pad.depth ?? 0]));
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 100, view, pr);
      paintSeed(p, plan.tree.base, g, pr, mix(PIGMENTS.wood, WINE, 0.25));
      const part = (keep: (b: Branch) => boolean) => ({ base: plan.tree.base, branches: plan.tree.branches.filter(keep) });
      const back = paintSkeleton(p, part((b) => b.order === 0 && b.tag === 'back'), view, pr.fork('back'), { pigment: BARK_BACK, texture: 0.6, modelling: 0.4, flare: 0.3, opacity: 0.85 });
      paintShaggyBark(p, back, pr.fork('back-shag'), BARK_BACK, 0.7);
      const front = paintSkeleton(p, part((b) => b.order === 0 && b.tag === 'trunk'), view, pr, { pigment: BARK, texture: 0.85, modelling: 0.55, flare: 0.35 });
      paintShaggyBark(p, front, pr.fork('shag'), BARK);
      // limbs and twigs paler, so the crown is not crossed by ink
      const limbs = paintSkeleton(p, part((b) => b.order > 0), view, pr.fork('limbs'), { pigment: LIMB, texture: 0.3, modelling: 0.3, opacity: 0.5 });
      const suckerTree = { base: plan.tree.base, branches: plan.tree.branches.filter((b) => b.tag === 'sucker') };
      const whips = paintSkeleton(p, suckerTree, view, pr.fork('sucker'), { pigment: mix(BARK, WINE, 0.35), texture: 0, modelling: 0, flare: 0 });
      paintTipHearts(p, [...back, ...front, ...limbs], view, arrive.tips, pr.fork('tips'), WINE);
      // the crown's body: one soft wash over the twigs, then the clumps' shaded undersides
      const live = plan.pads.map((pad) => ({ pad, k: arrive.pad(pad), at: viewPt(view, pad), c: colours.get(pad.id)! }));
      const body: Blot[] = live.map(({ pad, k, at, c }) => ({ x: at.x, y: at.y, r: pad.r * view.scale * k * 0.95, alpha: Math.min(1, k * 2.5) * 0.85, pigment: mix(c.light, c.mid, 0.2 + 0.35 * (1 - pad.lit) / 2), id: pad.id }));
      const holes = plan.holes.map((h) => ({ ...viewPt(view, h), r: h.r * view.scale * ramp(g, FOLIAGE[0], FOLIAGE[1]) }));
      paintBlots(p, body, pr.fork('body'), holes, { opacity: 0.85, edge: 0.2, edgeWidth: 1.4, sharpness: 0.5, centreLift: 0.2, granulation: 0.16, flow: 0.45, flowScale: 14, blend: 'source-over' }, softRes(p));
      const shade: Blot[] = live
        .filter(({ pad }) => pad.lit < 0.3)
        .map(({ pad, k, at, c }) => ({ x: at.x + pad.r * view.scale * k * 0.08, y: at.y + pad.r * view.scale * k * 0.28, r: pad.r * view.scale * k * 0.72, alpha: Math.min(1, k * 2.5) * ramp(0.3 - pad.lit, 0, 0.9), pigment: c.shadow, id: pad.id + 500 }));
      paintBlots(p, shade, pr.fork('shade'), holes, { opacity: 0.5, edge: 0.3, edgeWidth: 1.2, sharpness: 0.45, centreLift: 0.15, granulation: 0.2, flow: 0.5, flowScale: 18 }, softRes(p), 0.62);
      const tone = (c: FoliagePigments, t: number): Pigment => mix(c.light, c.mid, t * 0.7);
      const heartSize = arrive.heart;
      const inFront = (h: Heart) => (depth.get(h.group) ?? 0) > FRONT;
      const lit = new Map(plan.pads.map((pad) => [pad.id, pad.lit]));
      // leaves in a clump's shade go deeper, so each clump keeps its lit top
      const leaf = (h: Heart, t: number) => {
        const c = colours.get(h.group)!;
        const l = lit.get(h.group) ?? 0;
        return l > -0.1 ? tone(c, t) : mix(c.mid, c.shadow, Math.min(0.5, (-0.1 - l) * 0.8 + t * 0.2));
      };
      paintHearts(p, plan.hearts.filter((h) => !inFront(h)), view, pr.fork('hearts'), heartSize, (h) => leaf(h, h.tone), { opacity: 0.5, darken: 0.1, edge: 0.4 });
      // front leaves cover the twigs behind them
      paintHearts(p, plan.hearts.filter(inFront), view, pr.fork('hearts-front'), heartSize, (h) => leaf(h, h.tone * 0.6), { opacity: 0.85, blend: 'source-over' });
      if (whips.length) paintHearts(p, plan.sucker, view, pr.fork('sucker-hearts'), arrive.sucker, (h) => mix(WINE_LIGHT, WINE, h.tone));
      if (g > 0.8) paintHearts(p, plan.fallen, view, pr.fork('fallen'), arrive.fallen,(h) => tone(h.group ? PINK : GOLD, h.tone), { opacity: 0.75 });
    });
  },
};

export default katsura;
