/** Island goats (Capra hircus, herded village goats): a small band picking its way along the far cliff's ledges. Side view, facing right.
 * docs/devlog/195-cliff-goats.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, easeInOut, lerp } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** The scale its sprites are painted at (the promontory's far measure); drawn at `scale / S0`. */
const S0 = 0.13;
/** World units per decimetre at `S0` (125 units a metre at scale 1). */
const DM = 12.5 * S0;

export const GOAT_TUNING = {
  /** decimetres a second: an unhurried picking walk */
  walk: 5.5,
  /** seconds walking before a pause, and the pause */
  steps: [1.4, 4] as const,
  pause: [0.4, 1.8] as const,
  /** seconds of a hop between ledges */
  hop: 0.62,
  /** decimetres between goats in single file (a kid keeps closer) */
  gap: 14,
  /** seconds at rest before moving on; the first spell, a lookout, a rest lying down */
  spell: [22, 55] as const,
  firstSpell: [12, 26] as const,
  lookout: [45, 90] as const,
  lie: [55, 110] as const,
  /** a spell's odds: the lookout on the cliff top's seaward end, lying down */
  lookoutOdds: 0.3,
  lieOdds: 0.22,
  /** a kid's skip, per second of walking */
  skip: 0.18,
  /** a pine is in reach from the cliff top when its crown is this far up (dm) */
  reach: 28,
};

// ---------------------------------------------------------------------------------------------
// the ground: ledge perches joined into ways by name, and hops between them

/** One way along the cliff: the cliff top or a ledge's lip, west to east. */
export interface GoatWay {
  id: string;
  rim: boolean;
  pts: Pt[];
  x0: number;
  x1: number;
  scale: number;
}
/** A hop between two ways at x (≤ 30 units apart). */
export interface GoatLink {
  a: number;
  b: number;
  x: number;
}
/** Ways joined by hops; the band comes in over the cliff top, or off the east end of its way. */
export interface GoatRange {
  ways: number[];
  rim: number | null;
  edge: number;
}
export interface GoatMap {
  ways: GoatWay[];
  links: GoatLink[];
  ranges: GoatRange[];
  /** far pines whose lower crown a goat can reach, reared on the cliff top: x and the crown's y */
  pines: Pt[];
}

/** The y of a way at x (held flat beyond its ends). */
export function wayY(w: GoatWay, x: number): number {
  const p = w.pts;
  if (x <= p[0]!.x) return p[0]!.y;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    if (b.x >= x) return b.x - a.x < 1e-6 ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return p[p.length - 1]!.y;
}

const HOP_MAX = 30;
const maps = new WeakMap<readonly Perch[], GoatMap>();

/**
 * The goats' map, from the scenery's `ledge` perches: `<way>-<k>` stretches joined in order into
 * ways, hops where two ways come within 30 units, ranges of ways joined by hops. Cached per garden.
 */
export function goatMap(perches: readonly Perch[]): GoatMap {
  const hit = maps.get(perches);
  if (hit) return hit;
  const groups = new Map<string, { k: number; p: Perch }[]>();
  for (const p of perches) {
    const m = p.kind === 'ledge' ? /^(.*)-(\d+)$/.exec(p.id) : null;
    if (!m) continue;
    const list = groups.get(m[1]!) ?? [];
    list.push({ k: Number(m[2]), p });
    groups.set(m[1]!, list);
  }
  const ways: GoatWay[] = [];
  for (const [id, list] of groups) {
    list.sort((a, b) => a.k - b.k);
    const pts: Pt[] = [];
    for (const { p } of list) for (const x of [p.x - p.spread, p.x + p.spread]) pts.push({ x, y: perchY(p, x) });
    pts.sort((a, b) => a.x - b.x);
    ways.push({ id, rim: id.startsWith('cliff-top'), pts, x0: pts[0]!.x, x1: pts[pts.length - 1]!.x, scale: list[0]!.p.scale ?? S0 });
  }
  const links: GoatLink[] = [];
  for (let a = 0; a < ways.length; a++) {
    for (let b = a + 1; b < ways.length; b++) {
      const [A, B] = [ways[a]!, ways[b]!];
      const lo = Math.max(A.x0, B.x0) + 3;
      const hi = Math.min(A.x1, B.x1) - 3;
      let best: { x: number; d: number } | null = null;
      for (let x = lo; x <= hi; x += 2) {
        const d = Math.abs(wayY(A, x) - wayY(B, x));
        if (!best || d < best.d) best = { x, d };
      }
      if (best && best.d >= 6 && best.d <= HOP_MAX) links.push({ a, b, x: best.x });
    }
  }
  const ranges: GoatRange[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < ways.length; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    seen.add(i);
    for (let j = 0; j < group.length; j++) {
      for (const l of links) {
        const o = l.a === group[j] ? l.b : l.b === group[j] ? l.a : -1;
        if (o >= 0 && !seen.has(o)) {
          seen.add(o);
          group.push(o);
        }
      }
    }
    const rim = group.find((k) => ways[k]!.rim) ?? null;
    const edge = group.reduce((m, k) => (ways[k]!.x1 > ways[m]!.x1 ? k : m), group[0]!);
    ranges.push({ ways: group, rim, edge });
  }
  const rims = ways.filter((w) => w.rim);
  const pines = perches
    .filter((p) => p.kind === 'crown')
    .flatMap((p) => {
      const r = rims.find((w) => p.x > w.x0 + 4 && p.x < w.x1 - 4);
      return r && wayY(r, p.x) - p.y < GOAT_TUNING.reach * 12.5 * r.scale ? [{ x: p.x, y: p.y }] : [];
    });
  const map = { ways, links, ranges, pines };
  maps.set(perches, map);
  return map;
}

/** A point on the way to somewhere: walked to, hopped to, or below the cliff top's edge (out of sight). */
export interface Way {
  x: number;
  y: number;
  way: number;
  hop?: boolean;
  behind?: boolean;
}

/** The ways from (a, xa) to (b, xb) through the fewest hops, as points to walk; null when not joined. */
export function route(map: GoatMap, a: number, xa: number, b: number, xb: number): Way[] | null {
  const prev = new Map<number, GoatLink | null>([[a, null]]);
  const queue = [a];
  while (queue.length && !prev.has(b)) {
    const k = queue.shift()!;
    for (const l of map.links) {
      const o = l.a === k ? l.b : l.b === k ? l.a : -1;
      if (o < 0 || prev.has(o)) continue;
      prev.set(o, l);
      queue.push(o);
    }
  }
  if (!prev.has(b)) return null;
  const hops: { from: number; to: number; x: number }[] = [];
  for (let k = b; k !== a; ) {
    const l = prev.get(k)!;
    const from = l.a === k ? l.b : l.a;
    hops.unshift({ from, to: k, x: l.x });
    k = from;
  }
  const out: Way[] = [];
  const along = (w: number, x0: number, x1: number) => {
    const way = map.ways[w]!;
    const dir = Math.sign(x1 - x0);
    for (const q of dir > 0 ? way.pts : [...way.pts].reverse()) if ((q.x - x0) * dir > 0.5 && (x1 - q.x) * dir > 0.5) out.push({ x: q.x, y: q.y, way: w });
    out.push({ x: x1, y: wayY(way, x1), way: w });
  };
  let x = xa;
  let w = a;
  for (const h of hops) {
    along(w, x, h.x);
    const land = clamp(h.x + Math.sign((hops.length ? xb : h.x) - h.x) * 3, map.ways[h.to]!.x0 + 1, map.ways[h.to]!.x1 - 1);
    out.push({ x: land, y: wayY(map.ways[h.to]!, land), way: h.to, hop: true });
    x = land;
    w = h.to;
  }
  along(w, x, xb);
  return out;
}

// ---------------------------------------------------------------------------------------------
// art

export type Coat = 'black' | 'pied' | 'tan' | 'kid';
export const GOAT_POSES = ['stand', 'look', 'graze', 'browse', 'rear', 'lie', 'hop', 'walk0', 'walk1', 'walk2', 'walk3'] as const;
export type GoatPose = (typeof GOAT_POSES)[number];

interface Colours {
  body: Pigment;
  shade: Pigment;
  light: Pigment;
  patch: Pigment | null;
  head: Pigment;
  leg: Pigment;
  hoof: Pigment;
  horn: Pigment;
  stripe: Pigment | null;
}

function colours(coat: Coat): Colours {
  const ink = PIGMENTS.sumi;
  switch (coat) {
    case 'black':
      return { body: '#2e2826', shade: mix('#2e2826', ink, 0.5), light: '#6a5a4e', patch: null, head: '#221d1c', leg: '#2a2422', hoof: '#151212', horn: '#8a7a68', stripe: null };
    case 'pied':
      return { body: '#f1ebdf', shade: mix(PIGMENTS.shadow, '#a7a2ae', 0.5), light: '#f6eedb', patch: '#a86a3c', head: '#8e5530', leg: '#e2d8c6', hoof: '#3a302a', horn: '#8a7a68', stripe: null };
    case 'tan':
      return { body: '#b98d5c', shade: mix('#b98d5c', '#5a4434', 0.55), light: '#d8b384', patch: null, head: '#6a4a32', leg: '#4c3a2c', hoof: '#221c18', horn: '#8a7a68', stripe: '#4e3828' };
    case 'kid':
      return { body: '#d7bf98', shade: mix('#d7bf98', '#7a6450', 0.5), light: '#eadab8', patch: null, head: '#7a5236', leg: '#9a7a5a', hoof: '#3a2e26', horn: '#8a7a68', stripe: null };
  }
}

interface Rig {
  /** body raised (a hop) or lowered (lying) in dm */
  lift: number;
  /** body turned about the hip, nose up < 0 */
  pitch: number;
  head: Pt;
  /** the face's angle down from level */
  headA: number;
  /** hooves: near fore, far fore, near hind, far hind */
  legs: [Pt, Pt, Pt, Pt];
  fold?: boolean;
  prick?: boolean;
}

const HIP: Pt = { x: -3.2, y: -5.0 };
const SHOULDER: Pt = { x: 3.2, y: -4.8 };
/** The barrel (chest, belly, flank, rump, back, withers), feet at the origin, in dm. */
const BARREL: Pt[] = [
  { x: 4.7, y: -5.7 }, { x: 4.0, y: -4.1 }, { x: 1.2, y: -4.0 }, { x: -1.8, y: -4.3 }, { x: -3.7, y: -4.8 }, { x: -4.8, y: -5.8 },
  { x: -4.8, y: -6.9 }, { x: -3.6, y: -7.4 }, { x: -0.6, y: -7.0 }, { x: 2.4, y: -7.5 }, { x: 3.9, y: -7.4 },
];
const STAND_LEGS: [Pt, Pt, Pt, Pt] = [{ x: 3.4, y: 0 }, { x: 2.7, y: 0 }, { x: -3.5, y: 0 }, { x: -2.8, y: 0 }];

/** Each pose's rig (dm). The walk is four frames of a diagonal gait. */
export function rigFor(pose: GoatPose): Rig {
  switch (pose) {
    case 'stand':
      return { lift: 0, pitch: 0, head: { x: 5.8, y: -8.9 }, headA: 0.95, legs: STAND_LEGS };
    case 'look':
      return { lift: 0, pitch: -0.02, head: { x: 5.5, y: -10.1 }, headA: 0.5, legs: STAND_LEGS, prick: true };
    case 'graze':
      return { lift: 0, pitch: 0.07, head: { x: 6.2, y: -2.5 }, headA: 1.7, legs: [{ x: 3.9, y: 0 }, { x: 2.6, y: 0 }, { x: -3.4, y: 0 }, { x: -2.9, y: 0 }] };
    case 'browse':
      return { lift: 0, pitch: -0.08, head: { x: 6.8, y: -10.8 }, headA: 0.05, legs: [{ x: 3.6, y: 0 }, { x: 2.9, y: 0 }, { x: -3.2, y: 0 }, { x: -2.7, y: 0 }], prick: true };
    case 'rear':
      return { lift: 0, pitch: -0.95, head: { x: 3.2, y: -14.6 }, headA: -0.45, legs: [{ x: 2.6, y: -9.6 }, { x: 2.9, y: -10.8 }, { x: -2.4, y: 0 }, { x: -3.2, y: 0 }] };
    case 'lie':
      return { lift: -3.0, pitch: 0, head: { x: 5.0, y: -6.2 }, headA: 0.9, legs: STAND_LEGS, fold: true };
    case 'hop':
      return { lift: 1.6, pitch: -0.16, head: { x: 6.1, y: -10.6 }, headA: 0.6, legs: [{ x: 4.9, y: -1.9 }, { x: 4.2, y: -1.2 }, { x: -5.0, y: -0.9 }, { x: -4.3, y: -0.5 }] };
    default: {
      const k = Number(pose.slice(4));
      const f = (k / 4) * Math.PI * 2;
      const hoof = (base: number, off: number): Pt => ({ x: base + 0.95 * Math.cos(f + off), y: -0.75 * Math.max(0, Math.sin(f + off)) });
      return { lift: 0.08 * Math.cos(f * 2), pitch: 0, head: { x: 5.9, y: -8.9 + 0.18 * Math.sin(f * 2) }, headA: 0.85, legs: [hoof(3.1, 0), hoof(3.0, Math.PI), hoof(-3.2, Math.PI), hoof(-3.1, 0)] };
    }
  }
}

/** Two bones from a joint to a hoof, the middle joint pushed toward `side` (fore +1: the knee forward, hind −1: the hock back). */
function bones(j: Pt, h: Pt, a: number, b: number, side: number): Pt[] {
  const dx = h.x - j.x;
  const dy = h.y - j.y;
  const d = Math.min(a + b - 0.01, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  const cos = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const bend = Math.acos(cos) * -side;
  return [j, { x: j.x + Math.cos(ang + bend) * a, y: j.y + Math.sin(ang + bend) * a }, h];
}

/**
 * One goat in one pose, feet at the origin, in world units at `S0` (`k` the kid's size): a few wet
 * strokes. The body one wash with its shade, the legs broken lines, the head and horns a dark accent.
 */
function paintGoat(p: Painter, coat: Coat, pose: GoatPose, bell: boolean): void {
  const rng = p.rng;
  const kid = coat === 'kid';
  const u = DM * (kid ? 0.62 : 1);
  const c = colours(coat);
  const r = rigFor(pose);
  const pivot = HIP;
  const T = (q: Pt): Pt => {
    const dx = q.x - pivot.x;
    const dy = q.y - pivot.y;
    const cs = Math.cos(r.pitch);
    const sn = Math.sin(r.pitch);
    return { x: pivot.x + dx * cs - dy * sn, y: pivot.y + dx * sn + dy * cs - r.lift };
  };
  const W = (q: Pt): Pt => ({ x: q.x * u, y: q.y * u });
  const hs = kid ? 1.3 : 1;
  const head = (lx: number, ly: number): Pt => {
    const a = r.headA;
    return W({ x: r.head.x + (lx * Math.cos(a) - ly * Math.sin(a)) * hs, y: r.head.y + (lx * Math.sin(a) + ly * Math.cos(a)) * hs });
  };
  const line = (pts: Pt[], width: number, pigment: Pigment, opacity = 0.9, taper: [number, number] = [0.15, 0.4], breaks = 0.15) =>
    p.inkLine(pts, { rng, width: width * u, opacity, breaks, wobble: 0.2, pigment, taper });

  // contact shadow on the ledge
  const lying = !!r.fold;
  p.glaze(smoothPolygon([W({ x: -4.6, y: -0.2 }), W({ x: 4.6, y: -0.25 }), W({ x: 4.2, y: 0.35 }), W({ x: -4.2, y: 0.4 })], 2), mix(PIGMENTS.shadow, '#5f5a6c', 0.5), { rng, opacity: lying ? 0.4 : 0.28, edge: 0, darken: 0, deform: 0.2 });

  const legJoint = (i: number) => (i < 2 ? T(SHOULDER) : T(HIP));
  const legPts = (i: number): Pt[] => {
    if (lying) {
      // folded under: the forelegs tucked forward, the hinds alongside
      const j = legJoint(i);
      return i < 2 ? [j, { x: j.x + 0.5, y: -0.6 }, { x: j.x + 1.1 - i * 0.5, y: -0.3 }] : [j, { x: j.x + 1.2, y: -0.5 }, { x: j.x + 0.2 + (i - 2) * 0.4, y: -0.25 }];
    }
    return i < 2 ? bones(legJoint(i), r.legs[i]!, 2.4, 2.6, 1) : bones(legJoint(i), r.legs[i]!, 2.8, 2.7, -1);
  };
  // far legs behind the body, a shade darker
  for (const i of [1, 3]) {
    const pts = legPts(i).map((q) => W({ x: q.x - 0.25, y: q.y }));
    line(pts, 0.42, mix(c.leg, c.shade, 0.45), 0.92);
    if (!lying) p.dab(pts[2]!, c.hoof, { rng, variant: 'round', angle: 0, length: 0.42 * u, width: 0.26 * u, opacity: 0.7, layers: 2 });
  }
  // the short tail, flicked up
  line([T({ x: -4.5, y: -6.9 }), T({ x: -5.0, y: -7.9 }), T({ x: -4.7, y: -8.5 })].map(W), 0.5, mix(c.body, c.shade, 0.3), 0.9, [0.1, 0.7]);

  // the body: one wash, the belly in shade, a warm light along the back (lit from the left)
  const barrel = smoothPolygon(BARREL.map((q) => W(T(q))), 2);
  p.wash(barrel, c.body, { rng, opacity: 0.97, edge: coat === 'pied' ? 0.08 : 0.3, edgeWidth: 0.4, sharpness: 0.4, granulation: 0.25, deform: 0.05, spread: 0.03, layers: 5, blend: 'source-over' });
  p.glaze(barrel, c.shade, { rng, opacity: coat === 'black' ? 0.35 : 0.4, edge: 0, darken: 0, deform: 0.1, fade: { angle: -Math.PI / 2 + r.pitch, start: 0.4, amount: 1, ragged: 0.7 } });
  p.glaze(barrel, c.light, { rng, opacity: 0.22, edge: 0, darken: 0, deform: 0.12, fade: { angle: Math.PI / 2 + r.pitch + 0.4, start: 0.55, amount: 1, ragged: 0.8 } });
  if (c.patch) {
    // pied: a tan saddle over the forequarters and a patch on the rump
    for (const patch of [[{ x: 4.0, y: -7.5 }, { x: 2.2, y: -7.6 }, { x: 0.4, y: -7.2 }, { x: -0.6, y: -6.4 }, { x: 0.8, y: -5.9 }, { x: 1.6, y: -4.9 }, { x: 3.0, y: -5.2 }, { x: 3.6, y: -4.2 }, { x: 4.7, y: -5.4 }], [{ x: -2.2, y: -7.2 }, { x: -3.8, y: -7.5 }, { x: -4.9, y: -6.6 }, { x: -4.6, y: -5.5 }, { x: -3.6, y: -5.9 }, { x: -2.9, y: -5.2 }, { x: -2.0, y: -6.1 }]]) {
      p.wash(smoothPolygon(patch.map((q) => W(T(q))), 2), c.patch, { rng, opacity: 0.85, edge: 0.15, deform: 0.18, spread: 0.08, granulation: 0.3, layers: 4, blend: 'source-over' });
    }
  }
  if (c.stripe) line([T({ x: 3.6, y: -7.3 }), T({ x: 0, y: -7.05 }), T({ x: -3.8, y: -7.2 })].map(W), 0.45, c.stripe, 0.75, [0.3, 0.5], 0.3);
  // the shaggy coat hanging ragged under the belly
  const fringe = [{ x: 3.4, y: -4.6 }, { x: 3.0, y: -3.5 }, { x: 2.2, y: -3.9 }, { x: 1.4, y: -3.3 }, { x: 0.5, y: -3.8 }, { x: -0.4, y: -3.4 }, { x: -1.3, y: -3.9 }, { x: -2.2, y: -3.6 }, { x: -2.9, y: -4.3 }, { x: -3.6, y: -4.4 }, { x: -3.3, y: -5.0 }, { x: 0, y: -4.6 }];
  p.wash(smoothPolygon(fringe.map((q) => W(T(q))), 1), mix(c.body, c.shade, 0.35), { rng, opacity: 0.8, edge: 0.1, deform: 0.12, spread: 0.06, granulation: 0.3, layers: 3, blend: 'source-over' });

  // the neck to the head, then the head: the dark accent
  const root = [T({ x: 3.3, y: -7.5 }), T({ x: 4.6, y: -5.5 })];
  const neck = smoothPolygon([W(root[0]!), head(-0.9, -0.55), head(-0.5, 0.45), head(0.1, 0.75), W(root[1]!)], 1);
  p.wash(neck, c.patch ?? c.body, { rng, opacity: 0.95, edge: 0.2, deform: 0.05, layers: 4, blend: 'source-over' });
  p.glaze(neck, c.shade, { rng, opacity: 0.25, edge: 0, darken: 0, fade: { angle: -Math.PI / 2, start: 0.5, amount: 1 } });
  const face = smoothPolygon([head(-0.9, -0.75), head(0.4, -0.9), head(1.6, -0.6), head(2.5, -0.2), head(2.65, 0.35), head(2.2, 0.65), head(1.0, 0.85), head(-0.3, 1.0), head(-1.0, 0.35)], 1);
  p.wash(face, c.head, { rng, opacity: 0.97, edge: 0.3, edgeWidth: 0.4, sharpness: 0.5, deform: 0.04, layers: 4, blend: 'source-over' });
  if (coat === 'pied' || coat === 'tan') line([head(0.2, -0.3), head(2.3, 0.1)], 0.32, mix(c.head, PIGMENTS.sumi, 0.5), 0.6, [0.2, 0.4], 0.3);
  p.dab(head(2.5, 0.15), mix(c.head, PIGMENTS.sumi, 0.6), { rng, variant: 'round', angle: r.headA, length: 0.45 * u * hs, width: 0.4 * u * hs, opacity: 0.8, layers: 2 });
  p.dab(head(0.35, -0.2), '#c79a3e', { rng, variant: 'round', angle: 0, length: 0.22 * u * hs, width: 0.2 * u * hs, opacity: 0.9, layers: 2 });
  // ears: drooping, or pricked when it looks
  line(r.prick ? [head(-0.5, -0.1), head(-1.3, -0.5)] : [head(-0.5, 0), head(-0.9, 0.7), head(-0.8, 1.2)], 0.45, mix(c.head, c.shade, 0.3), 0.9, [0.1, 0.6]);
  if (kid) {
    line([head(-0.3, -0.6), head(-0.5, -0.9)], 0.22, c.horn, 0.8, [0.1, 0.5]);
  } else {
    // backswept horns: a dark accent sweeping over the neck
    const base = head(-0.4, -0.75);
    const turn = (r.headA - 0.95) * 0.6;
    const horn = (dx: number, dy: number): Pt => ({ x: base.x + (dx * Math.cos(turn) - dy * Math.sin(turn)) * u, y: base.y + (dx * Math.sin(turn) + dy * Math.cos(turn)) * u });
    line([horn(0, 0), horn(-0.5, -1.1), horn(-1.4, -1.9), horn(-2.5, -2.1)], 0.4, c.horn, 0.95, [0.05, 0.85], 0);
    line([horn(0, -0.1), horn(-0.6, -1.2), horn(-1.5, -2.0)], 0.16, PIGMENTS.sumi, 0.5, [0.2, 0.6], 0.3);
  }
  if (bell) {
    // the billy's beard and the bell under the throat: a single ochre dot
    line([head(1.9, 0.6), head(1.6, 1.2), head(1.35, 1.75)], 0.32, mix(c.head, PIGMENTS.sumi, 0.4), 0.85, [0.1, 0.7]);
    const throat = { x: lerp(root[1]!.x * u, head(-0.4, 0.7).x, 0.5), y: lerp(root[1]!.y * u, head(-0.4, 0.7).y, 0.5) + 0.55 * u };
    p.dab(throat, '#c8932c', { rng, variant: 'round', angle: 0, length: 0.62 * u, width: 0.55 * u, opacity: 0.95, layers: 3, blend: 'source-over' });
  }
  // near legs over the body
  for (const i of [0, 2]) {
    const pts = legPts(i).map(W);
    line(pts, 0.5, c.leg, 0.95);
    if (coat === 'pied') line([pts[1]!, pts[2]!], 0.3, c.patch!, 0.35, [0.2, 0.3], 0.5);
    if (!lying) p.dab(pts[2]!, c.hoof, { rng, variant: 'round', angle: 0, length: 0.46 * u, width: 0.28 * u, opacity: 0.75, layers: 2 });
  }
}

/** The sprite box (world units at `S0`), the same for every pose: feet at the origin. */
const box = (kid: boolean) => {
  const u = DM * (kid ? 0.62 : 1);
  return { w: 18 * u, h: 18.5 * u, ox: 7.5 * u, oy: 17 * u };
};

/** One painted pose of one coat. */
export function paintGoatSprite(res: number, coat: Coat, pose: GoatPose, bell: boolean, seed: number): Sprite {
  return paintSprite(res, box(coat === 'kid'), seed + GOAT_POSES.indexOf(pose) * 7, (p) => paintGoat(p, coat, pose, bell));
}

/** A goat sprite at its feet: one draw. */
export function drawGoatSprite(ctx: Ctx, s: Sprite, x: number, y: number, k: number, facing: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * facing, k);
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// behaviour

type Act = 'stand' | 'look' | 'graze' | 'browse' | 'rear' | 'lie' | 'lookout' | 'turn';

export interface GoatMember {
  coat: Coat;
  bell: boolean;
  x: number;
  y: number;
  way: number;
  facing: number;
  /** in the garden (it has come over the cliff top or in from the edge, and not yet gone) */
  shown: boolean;
  path: Way[];
  hop: { from: Pt; to: Pt; t: number } | null;
  /** seconds before it sets off */
  wait: number;
  walkFor: number;
  act: Act;
  actT: number;
  actFor: number;
  /** walk cycle, 0..1 */
  phase: number;
  skip: number;
  blocked: number;
  gone: boolean;
  /** the pine it rears against, when the spot is by one */
  pine?: Pt;
}

const IN = 'in';

/**
 * The band: two or three goats as one visitor (a black nanny leads, the pied billy with the bell,
 * a kid or a tan nanny). They come over the cliff top or in from the east end of their ledge,
 * walk in file with pauses, rest a spell grazing, looking, browsing a pine reared up, lying, or
 * one on the point looking out to sea, move on, and leave the way they came.
 */
export class Goats extends BaseCreature {
  readonly kind = 'goat' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  readonly members: GoatMember[] = [];
  readonly range: GoatRange;
  /** counts of what they did (tests and the studio) */
  readonly did = { graze: 0, look: 0, browse: 0, rear: 0, lie: 0, lookout: 0, hop: 0, skip: 0, move: 0 };
  private readonly map: GoatMap;
  private readonly entry: Way[];
  private spellFor: number;
  private age = 0;
  private rest = false;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    readonly stay: number,
    range: GoatRange,
    coats: readonly Coat[],
  ) {
    super();
    this.map = goatMap(w.perches);
    this.range = range;
    this.entry = this.entryWays();
    const first = this.entry[this.entry.length - 1]!;
    const lead = this.spotFor(w, true);
    coats.forEach((coat, i) => {
      const m: GoatMember = {
        coat,
        bell: coat === 'pied',
        x: this.entry[0]!.x,
        y: this.entry[0]!.y,
        way: first.way,
        facing: this.entry[1] ? Math.sign(this.entry[1].x - this.entry[0]!.x) || -1 : -1,
        shown: false,
        path: [],
        hop: null,
        wait: i * rng.range(2.2, 4.5),
        walkFor: rng.range(...GOAT_TUNING.steps),
        act: 'stand',
        actT: 0,
        actFor: 1,
        phase: rng.next(),
        skip: 0,
        blocked: 0,
        gone: false,
      };
      this.members.push(m);
    });
    this.sendAll(w, lead, true);
    this.spellFor = rng.range(...GOAT_TUNING.firstSpell);
    this.go(IN);
    this.sync();
  }

  /** In over the cliff top (up from behind its edge) or along the ledge from off its east end. */
  private entryWays(): Way[] {
    const { ways } = this.map;
    if (this.range.rim !== null) {
      const r = ways[this.range.rim]!;
      const x = lerp(r.x0 + 14, r.x1 - 14, this.rng.range(0.15, 0.85));
      const y = wayY(r, x);
      return [
        { x: x + this.rng.range(-4, 4), y: y + 18 * DM * 0.62, way: this.range.rim, behind: true },
        { x, y, way: this.range.rim },
      ];
    }
    const e = ways[this.range.edge]!;
    const end = e.pts[e.pts.length - 1]!;
    const prev = e.pts[Math.max(0, e.pts.length - 3)]!;
    const slope = (end.y - prev.y) / Math.max(1, end.x - prev.x);
    return [
      { x: end.x + 60, y: end.y + slope * 60, way: this.range.edge },
      { x: end.x, y: end.y, way: this.range.edge },
    ];
  }

  /** A place to go in its range: a way and an x, in view first; the leader may take the point or a pine. */
  private spotFor(w: FaunaWorld, entering = false): { way: number; x: number; lookout?: boolean; pine?: Pt } {
    const { ways } = this.map;
    const rng = this.rng;
    const rim = this.range.rim;
    if (!entering && rim !== null && rng.chance(GOAT_TUNING.lookoutOdds)) {
      // the range's seaward end: the point under the temple
      const k = this.range.ways.reduce((m, j) => (ways[j]!.x0 < ways[m]!.x0 ? j : m), this.range.ways[0]!);
      return { way: k, x: ways[k]!.x0 + 3, lookout: true };
    }
    if (rim !== null && this.map.pines.length && rng.chance(0.3)) {
      const pine = rng.pick(this.map.pines);
      const r = ways[rim]!;
      const side = rng.chance(0.5) ? -1 : 1;
      const x = clamp(pine.x - side * 7, r.x0 + 2, r.x1 - 2);
      return { way: rim, x, pine };
    }
    const visible = this.range.ways.filter((k) => ways[k]!.x1 > w.view.x + 10 && ways[k]!.x0 < w.view.x + w.view.w - 10);
    const k = rng.pick(visible.length ? visible : this.range.ways);
    const way = ways[k]!;
    const lo = Math.max(way.x0 + 6, w.view.x + 10);
    const hi = Math.min(way.x1 - 6, w.view.x + w.view.w - 10);
    return { way: k, x: lo < hi ? rng.range(lo, hi) : rng.range(way.x0 + 6, way.x1 - 6) };
  }

  /** Send the band to a spot: the leader there, the others in file behind it along the same way. */
  private sendAll(w: FaunaWorld, to: { way: number; x: number; lookout?: boolean; pine?: Pt }, entering = false): void {
    const way = this.map.ways[to.way]!;
    // whoever is nearest the spot (along the ways) heads the file there, so no one passes another
    const far = (m: GoatMember) => {
      const r = route(this.map, m.way, m.x, to.way, to.x);
      if (!r) return Infinity;
      let d = 0;
      let at: Pt = m;
      for (const q of r) {
        d += Math.hypot(q.x - at.x, q.y - at.y);
        at = q;
      }
      return d;
    };
    const order = entering ? this.members.slice() : this.members.filter((m) => !m.gone).sort((a, b) => far(a) - far(b));
    const from = entering ? this.entry[this.entry.length - 1]!.x : order[0]!.x;
    const back = Math.sign(from - to.x) || 1;
    let x = to.x;
    let side = back;
    order.forEach((m, i) => {
      if (i > 0) {
        const gap = (m.coat === 'kid' ? 0.7 : 1) * GOAT_TUNING.gap * DM * (way.scale / S0) * this.rng.range(0.85, 1.25);
        let nx = x + side * gap;
        if (nx < way.x0 + 2 || nx > way.x1 - 2) {
          side = -side;
          nx = to.x + side * gap * i;
        }
        x = clamp(nx, way.x0 + 2, way.x1 - 2);
      }
      const start = entering ? this.entry : [];
      const at = entering ? this.entry[this.entry.length - 1]! : { x: m.x, way: m.way };
      const r = route(this.map, at.way, at.x, to.way, x) ?? [];
      m.path = [...start, ...r];
      m.act = i === 0 && to.lookout ? 'lookout' : i === 0 && to.pine ? 'rear' : 'stand';
      if (!entering) m.wait = i * this.rng.range(0.6, 2.2);
      m.walkFor = this.rng.range(...GOAT_TUNING.steps);
      m.pine = i === 0 ? to.pine : undefined;
    });
  }

  /** Back the way they came: over the cliff top's edge, or off the east end. */
  private sendOut(): void {
    const out = this.entry[this.entry.length - 1]!;
    const sorted = this.members.slice().sort((a, b) => Math.abs(a.x - out.x) - Math.abs(b.x - out.x));
    sorted.forEach((m, i) => {
      if (m.gone) return;
      if (!m.shown) {
        m.gone = true;
        return;
      }
      const r = route(this.map, m.way, m.x, out.way, out.x) ?? [];
      m.path = [...r, { ...this.entry[0]!, x: this.entry[0]!.x + this.rng.range(-3, 3) }];
      m.wait = i * this.rng.range(1, 3);
      m.act = 'stand';
    });
  }

  /** Where the band stands (the leader): small birds keep off it. */
  spot(): Pt | null {
    const m = this.members.find((g) => g.shown && !g.path.length && !g.hop);
    return m ? { x: m.x, y: m.y } : null;
  }

  override depth(): number | null {
    let d = -Infinity;
    for (const m of this.members) if (m.shown) d = Math.max(d, m.y);
    return Number.isFinite(d) ? d + 0.5 : this.y + 0.5;
  }

  override leave(w: FaunaWorld): void {
    if (this.leaving) return;
    super.leave(w);
    this.sendOut();
    this.go('leave');
  }

  private sync(): void {
    const m = this.members.find((g) => g.shown && !g.gone) ?? this.members[0]!;
    this.x = m.x;
    this.y = m.y;
  }

  update(dt: number, w: FaunaWorld): void {
    this.age += dt;
    if (!this.leaving && (w.mode.night || this.age > this.stay)) this.leave(w);
    const v = GOAT_TUNING.walk * 12.5 * w.speed;
    let moving = false;
    for (const m of this.members) {
      if (m.gone) continue;
      if (this.stepMember(m, dt, w, v)) moving = true;
    }
    if (this.leaving) {
      if (this.members.every((m) => m.gone)) this.done = true;
    } else if (!moving) {
      if (this.state !== 'spell') this.go('spell');
      this.spellFor -= dt;
      if (this.spellFor <= 0) this.moveOn(w);
    }
    this.sync();
  }

  private moveOn(w: FaunaWorld): void {
    const to = this.spotFor(w);
    const rest = !to.lookout && !to.pine && this.rng.chance(GOAT_TUNING.lieOdds);
    this.sendAll(w, to);
    this.did.move++;
    this.spellFor = to.lookout ? this.rng.range(...GOAT_TUNING.lookout) : rest ? this.rng.range(...GOAT_TUNING.lie) : this.rng.range(...GOAT_TUNING.spell);
    this.rest = rest;
    this.go('move');
  }

  /** One goat's step; true while it is still on its way. */
  private stepMember(m: GoatMember, dt: number, w: FaunaWorld, v: number): boolean {
    if (m.hop) {
      m.hop.t += (dt * w.speed) / GOAT_TUNING.hop;
      const k = Math.min(1, m.hop.t);
      const e = easeInOut(k);
      const rise = Math.max(4, Math.abs(m.hop.to.y - m.hop.from.y) * 0.35) * Math.sin(k * Math.PI);
      m.x = lerp(m.hop.from.x, m.hop.to.x, e);
      m.y = lerp(m.hop.from.y, m.hop.to.y, e) - rise;
      if (k >= 1) {
        m.x = m.hop.to.x;
        m.y = m.hop.to.y;
        m.hop = null;
      }
      return true;
    }
    if (m.path.length) {
      if (m.wait > 0) {
        m.wait -= dt;
        return true;
      }
      const next = m.path[0]!;
      m.shown = true;
      if (next.hop) {
        m.hop = { from: { x: m.x, y: m.y }, to: { x: next.x, y: next.y }, t: 0 };
        m.facing = Math.sign(next.x - m.x) || m.facing;
        m.way = next.way;
        m.path.shift();
        this.did.hop++;
        return true;
      }
      // a goat ahead on the same way, close and not making room: wait a little
      const dir = Math.sign(next.x - m.x);
      const near = this.members.some((o) => o !== m && o.shown && !o.gone && o.way === m.way && (o.x - m.x) * dir > 0 && Math.abs(o.x - m.x) < GOAT_TUNING.gap * DM * 0.55 && Math.abs(o.y - m.y) < 6);
      if (near && m.shown && m.blocked >= 0) {
        m.blocked += dt;
        // held up too long: it squeezes past
        if (m.blocked > 3) m.blocked = -1;
        return true;
      }
      if (m.blocked > 0) m.blocked = 0;
      m.walkFor -= dt;
      if (m.walkFor < 0) {
        m.wait = this.rng.range(...GOAT_TUNING.pause);
        m.walkFor = this.rng.range(...GOAT_TUNING.steps);
        return true;
      }
      const dx = next.x - m.x;
      const dy = next.y - m.y;
      const d = Math.hypot(dx, dy);
      const k = this.scaleAt(m.way);
      const step = v * dt * (next.behind ? 0.7 : 1) * k;
      if (Math.abs(dx) > 0.3) m.facing = Math.sign(dx);
      m.phase = (m.phase + step / (3.8 * DM * (k / S0) * (m.coat === 'kid' ? 0.62 : 1))) % 1;
      if (m.coat === 'kid' && m.skip <= 0 && this.rng.chance(GOAT_TUNING.skip * dt)) {
        m.skip = 0.36;
        this.did.skip++;
      }
      m.skip = Math.max(0, m.skip - dt);
      if (d <= step) {
        m.x = next.x;
        m.y = next.y;
        m.way = next.way;
        m.path.shift();
        if (!m.path.length) {
          m.blocked = 0;
          if (this.leaving) m.gone = true;
          else this.startAct(m, true);
        }
      } else {
        m.x += (dx / d) * step;
        m.y += (dy / d) * step;
      }
      return true;
    }
    this.stepAct(m, dt);
    return false;
  }

  private scaleAt(way: number): number {
    return this.map.ways[way]?.scale ?? S0;
  }

  private startAct(m: GoatMember, fresh = false): void {
    const rest = this.rest;
    if (fresh && (m.act === 'lookout' || m.act === 'rear')) {
      const pine = m.pine;
      if (pine) m.facing = Math.sign(pine.x - m.x) || m.facing;
      if (m.act === 'lookout') {
        m.facing = -1;
        this.did.lookout++;
      }
      m.actFor = m.act === 'lookout' ? 9999 : this.rng.range(3, 7);
      m.actT = 0;
      if (m.act === 'rear') this.did.rear++;
      return;
    }
    if (rest && (fresh || m.act !== 'lie') && this.rng.chance(m.coat === 'pied' ? 0.45 : 0.75)) {
      m.act = 'lie';
      m.actFor = 9999;
      m.actT = 0;
      this.did.lie++;
      return;
    }
    const pine = m.pine;
    const r = this.rng.next();
    const act: Act = pine && r < 0.45 ? 'rear' : r < 0.5 ? 'graze' : r < 0.68 ? 'look' : r < 0.8 ? 'browse' : r < 0.9 ? 'stand' : 'turn';
    m.act = act;
    m.actT = 0;
    m.actFor = act === 'graze' ? this.rng.range(5, 16) : act === 'turn' ? 0.6 : this.rng.range(3, 9);
    if (act === 'turn') m.facing = -m.facing;
    if (act in this.did) this.did[act as keyof typeof this.did]++;
  }

  private stepAct(m: GoatMember, dt: number): void {
    m.actT += dt;
    if (m.act === 'lie' || m.act === 'lookout') return;
    if (m.actT >= m.actFor) this.startAct(m);
  }

  /** The pose a goat shows now. */
  poseOf(m: GoatMember): GoatPose {
    if (m.hop) return 'hop';
    if (m.path.length && m.wait <= 0 && m.blocked <= 0) {
      if (m.skip > 0.06) return 'hop';
      return `walk${Math.floor(m.phase * 4) % 4}` as GoatPose;
    }
    if (m.path.length) return 'stand';
    switch (m.act) {
      case 'lookout':
        return 'look';
      case 'turn':
        return 'stand';
      default:
        return m.act;
    }
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities') return;
    const rim = this.range.rim !== null ? this.map.ways[this.range.rim]! : null;
    for (const m of this.members) {
      if (!m.shown || m.gone) continue;
      const pose = this.poseOf(m);
      const s = w.art.get(`goat:${m.coat}:${pose}`, (res) => paintGoatSprite(res, m.coat, pose, m.bell, 6200 + COATS.indexOf(m.coat) * 101));
      const k = this.scaleAt(m.way) / S0;
      const lift = m.skip > 0 && !m.hop ? Math.sin((m.skip / 0.36) * Math.PI) * 1.6 * DM * 0.62 : 0;
      // below the cliff top's edge it is still behind the crest: only what shows above the edge
      const behind = rim && m.x > rim.x0 - 20 && m.x < rim.x1 + 20 && m.y > wayY(rim, m.x) + 0.6 && !m.hop && m.way === this.range.rim;
      if (behind) {
        ctx.save();
        ctx.beginPath();
        const x0 = m.x - 20;
        const x1 = m.x + 20;
        ctx.moveTo(x0, wayY(rim, x0) - 1);
        for (let x = x0 + 8; x <= x1; x += 8) ctx.lineTo(x, wayY(rim, x) - 1);
        ctx.lineTo(x1, m.y - 60);
        ctx.lineTo(x0, m.y - 60);
        ctx.closePath();
        ctx.clip();
      }
      drawGoatSprite(ctx, s, m.x, m.y - lift, k, m.facing);
      if (behind) ctx.restore();
    }
  }
}

export const COATS: readonly Coat[] = ['black', 'pied', 'tan', 'kid'];

/** A band's coats: the black nanny leads, a kid follows its mother, the pied billy with the bell. */
export function bandCoats(rng: Rng, count = 0): Coat[] {
  const n = count >= 2 ? Math.min(3, count) : rng.chance(0.55) ? 3 : 2;
  if (n === 2) return rng.chance(0.3) ? ['black', 'kid'] : ['black', 'pied'];
  return ['black', rng.chance(0.7) ? 'kid' : 'tan', 'pied'];
}

const homes = new WeakMap<readonly Perch[], boolean>();

const goat: CreatureDef = {
  kind: 'goat',
  title: 'island goats',
  role: 'drifter',
  // a small event: a band now and then, staying a few minutes; by day only
  visit: { gap: [700, 1300], first: [40, 180], stay: [200, 380], group: [1, 1], max: 1, diurnal: true, visitor: false },
  needs: (w) => {
    let v = homes.get(w.perches);
    if (v === undefined) {
      v = goatMap(w.perches).ranges.length > 0;
      homes.set(w.perches, v);
    }
    return v;
  },
  spawn(w, s) {
    if (!goat.needs!(w)) return [];
    const rng = w.rng.fork(`goat:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const map = goatMap(w.perches);
    // the cliff top's range more often than the east ledges (each its own way in)
    const seen = (r: GoatRange) => r.ways.some((k) => map.ways[k]!.x1 > w.view.x + 10 && map.ways[k]!.x0 < w.view.x + w.view.w - 10);
    const inView = map.ranges.some(seen);
    const weights = map.ranges.map((r): number => (inView && !seen(r) ? 0 : r.rim !== null ? 1.6 : 0.5));
    let pick = rng.next() * weights.reduce((a, b) => a + b, 0);
    const range = map.ranges.find((_, i) => (pick -= weights[i]!) < 0) ?? map.ranges[0]!;
    return [new Goats(w, rng.fork('band'), (s.stay || 300) * rng.range(0.9, 1.1), range, bandCoats(rng, s.count))];
  },
  sheet: {
    w: 900,
    h: 160,
    make(res, seed) {
      return COATS.flatMap((c) => (['stand', 'graze'] as const).map((p) => paintGoatSprite(res * 4, c, p, c === 'pied', seed)));
    },
  },
  show: { stage: 'coast', spec: { x: 720, y: 290, w: 360, h: 180 }, w: 900, h: 450, order: 42 },
};
export default goat;
