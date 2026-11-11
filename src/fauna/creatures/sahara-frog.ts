/** Sahara frog (Pelophylax saharicus): the oasis's water frog, in the basin and on its coping. Side view, facing right.
 * docs/devlog/162-sahara-frog.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { clamp, closestOnPolygon, dist, distanceToPolygon, easeInOut, lerp, pointInPolygon, rangeOf, TAU } from '../math';
import { deepCopy, paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { sacAt } from './kajika';
import type { CreatureDef } from './lib/def';

/** Snout to rump, sitting, at perspective 1 (world units): about 8 cm, a little generous to read. */
export const FROG_SIZE = 15;
const L = FROG_SIZE;

export const FROG_TUNING = {
  /** seconds sitting on the coping or a step, by day and after dark */
  baskDay: [45, 120] as const,
  baskNight: [15, 45] as const,
  /** seconds floating at one spot, by day and after dark */
  floatDay: [20, 50] as const,
  floatNight: [30, 80] as const,
  /** seconds under water between a plop and coming up elsewhere */
  under: [3, 9] as const,
  /** after a spell: by day it mostly hauls out to bask, after dark it mostly floats and calls */
  baskChanceDay: 0.7,
  baskChanceNight: 0.3,
  /** seconds between call bouts: the evening chorus, then the night */
  boutDusk: [3, 9] as const,
  boutNight: [9, 26] as const,
  /** croaks in a bout and the gap between them (s) */
  notes: [4, 9] as const,
  gap: [0.2, 0.32] as const,
  /** another frog answers a bout this often */
  answer: 0.6,
  /** the evening chorus: this long after nightfall (s) */
  dusk: 40 * 60,
  /** paddling speed on the surface (world units / s) */
  paddle: 9,
  /** keeps this far from other frogs and held spots (world units) */
  clear: 22,
  /** a float spot keeps this far inside the basin's edge (world units) */
  margin: 7,
};

/** Who makes it plop in, and from how near (world units); a bird on the wing counts from farther. */
export const FROG_THREATS: Readonly<Record<string, number>> = {
  heron: 150,
  stork: 150,
  hoopoe: 40,
  dove: 36,
  'bee-eater': 32,
  bunting: 28,
  bird: 28,
};

// ---------------------------------------------------------------------------------------------
// art

interface Tone {
  back: Pigment;
  flank: Pigment;
  blotch: Pigment;
  ridge: Pigment;
  stripe: Pigment;
  belly: Pigment;
  leg: Pigment;
  bar: Pigment;
}

/** Green to olive-brown (docs/research/oasis-biome.md › Sahara frog). */
export const FROG_TONES: Readonly<Record<'green' | 'olive', Tone>> = {
  green: { back: '#7f9a52', flank: mix('#7f9a52', '#b0a868', 0.45), blotch: '#5a6a3a', ridge: mix('#c8c890', '#7f9a52', 0.25), stripe: '#a8c472', belly: mix(PIGMENTS.petalWhite, '#d8d4a8', 0.5), leg: mix('#7f9a52', '#8a7a52', 0.35), bar: '#4e5a34' },
  olive: { back: mix('#7f9a52', '#8a7650', 0.55), flank: mix('#9a8a5c', '#b0a070', 0.4), blotch: mix('#5a6a3a', '#4e4232', 0.5), ridge: mix('#cfc394', '#8a7a52', 0.25), stripe: mix('#a8c472', '#b8b47a', 0.4), belly: mix(PIGMENTS.petalWhite, '#d8cfae', 0.55), leg: mix('#8a7a52', '#6e6a44', 0.4), bar: mix('#4e5a34', '#45382a', 0.5) },
};
export type FrogTone = keyof typeof FROG_TONES;

const EYE = '#d6a43e';
const PUPIL = '#2f2a24';
const SHADE = PIGMENTS.shadow;
const P = (x: number, y: number): Pt => ({ x: x * L, y: y * L });

/** The mouth's corner (where a sac swells), sitting and floating, in body lengths. */
export const MOUTH = { sit: { x: 0.33, y: -0.21 }, float: { x: 0.36, y: -0.01 } } as const;

/** A brush mark from `a` to `b` (body lengths): a dab's base sits at its start. */
function mark(p: Painter, a: Pt, b: Pt, pigment: Pigment, width: number, opacity: number, variant: 'blade' | 'leaf' | 'petal' = 'blade', blend?: 'source-over'): void {
  const [qa, qb] = [P(a.x, a.y), P(b.x, b.y)];
  p.dab(qa, pigment, { rng: p.rng, variant, angle: Math.atan2(qb.y - qa.y, qb.x - qa.x), length: Math.hypot(qb.x - qa.x, qb.y - qa.y), width: width * L, opacity, layers: 2, edge: 0.25, ...(blend ? { blend } : {}) });
}
const pt = (x: number, y: number): Pt => ({ x, y });

/** Blotches: uneven, some merging, in one wet layer clipped to `shape`, scattered over `xs` × `ys` (body lengths). */
function blotches(p: Painter, shape: Pt[], pigment: Pigment, n: number, xs: [number, number], ys: [number, number], size: number): void {
  const rng = p.rng;
  const M = p.layer({ x: -L, y: -L * 0.6, w: L * 2, h: L * 0.7 });
  M.clip(shape);
  for (let i = 0; i < n; i++) {
    const r = size * rng.range(0.55, 1.3);
    M.fill(blob(rng.range(xs[0], xs[1]) * L, rng.range(ys[0], ys[1]) * L, L * r * rng.range(1, 1.6), L * r * rng.range(0.6, 0.9), rng, { irregularity: 0.35 }), pigment, rng.range(0.35, 0.7));
  }
  M.dry({ opacity: 0.8, edge: 0.55, edgeWidth: L * 0.014, sharpness: 0.45, granulation: 0.3 });
}

/** Sitting on stone: the head raised on straight arms, the back sloping to the rump, the hind leg folded beside it; feet at y 0. */
function paintSit(p: Painter, c: Tone): void {
  const rng = p.rng;
  // the far hind foot and the far arm, a shade behind the body
  p.wash(smoothPolygon([P(-0.22, -0.02), P(0.08, -0.025), P(0.22, -0.008), P(0.22, 0.004), P(-0.2, 0.006)], 1), mix(c.leg, c.blotch, 0.4), { rng, opacity: 0.5, edge: 0.3, deform: 0.08, layers: 5 });
  mark(p, pt(0.2, -0.14), pt(0.18, 0), mix(c.leg, c.blotch, 0.4), 0.026, 0.4);
  // the body, tilted up toward the head: olive back into a pale belly, blotches dropped in wet
  const body = smoothPolygon([P(0.5, -0.29), P(0.43, -0.36), P(0.31, -0.42), P(0.18, -0.41), P(0.0, -0.37), P(-0.18, -0.31), P(-0.3, -0.27), P(-0.37, -0.19), P(-0.33, -0.1), P(-0.12, -0.08), P(0.08, -0.1), P(0.24, -0.15), P(0.38, -0.21), P(0.47, -0.25)], 2);
  p.wetInWet(body, c.back, c.belly, { rng, angle: Math.PI / 2 - 0.35, split: 0.6, softness: 0.35, fingers: 0.35, opacity: 0.93, edge: 0.45, edgeWidth: L * 0.022, deform: 0.05, spread: 0.04, granulation: 0.25, flow: 0.45, flowScale: L * 0.2, blend: 'source-over', drops: [{ pigment: c.flank, at: P(0.0, -0.22), size: L * 0.12, alpha: 0.35 }] });
  blotches(p, body, c.blotch, 9, [-0.3, 0.2], [-0.36, -0.2], 0.03);
  // the pale ridge from the eye along the side, the pale green line down the back
  mark(p, pt(0.17, -0.37), pt(-0.26, -0.255), c.ridge, 0.026, 0.75);
  mark(p, pt(0.2, -0.405), pt(-0.22, -0.3), c.stripe, 0.022, 0.8);
  // the pale upper lip, the dark tympanum, the eye bump with its gold eye and level pupil
  mark(p, pt(0.48, -0.275), pt(0.27, -0.215), c.ridge, 0.022, 0.65);
  p.dab(P(0.19, -0.33), mix(c.blotch, '#6a4e36', 0.45), { rng, variant: 'round', angle: 0, length: L * 0.07, width: L * 0.065, opacity: 0.55, layers: 3 });
  p.dab(P(0.31, -0.39), mix(c.back, c.belly, 0.25), { rng, variant: 'round', angle: 0, length: L * 0.12, width: L * 0.1, opacity: 0.85, layers: 3, blend: 'source-over' });
  p.dab(P(0.315, -0.395), EYE, { rng, variant: 'round', angle: 0, length: L * 0.085, width: L * 0.08, opacity: 0.95, layers: 3, blend: 'source-over' });
  p.dab(P(0.32, -0.395), PUPIL, { rng, variant: 'round', angle: 0, length: L * 0.05, width: L * 0.02, opacity: 0.9, layers: 2 });
  // the near hind leg folded against the flank: the thigh, the shank back under it, the long foot forward
  const leg = p.layer({ x: -L * 0.5, y: -L * 0.3, w: L, h: L * 0.34 });
  const thigh = smoothPolygon([P(-0.36, -0.2), P(-0.2, -0.22), P(0.02, -0.17), P(0.1, -0.11), P(0.04, -0.07), P(-0.18, -0.08), P(-0.35, -0.12)], 2);
  const shank = smoothPolygon([P(0.1, -0.09), P(-0.1, -0.075), P(-0.3, -0.055), P(-0.35, -0.025), P(-0.28, -0.012), P(-0.06, -0.03), P(0.11, -0.05)], 2);
  const foot = smoothPolygon([P(-0.31, -0.022), P(-0.05, -0.022), P(0.14, -0.014), P(0.24, -0.002), P(0.24, 0.006), P(0.04, 0.006), P(-0.28, 0.004)], 1);
  leg.fill(foot, c.leg, 0.65);
  leg.fill(shank, c.leg, 0.8);
  leg.fill(thigh, c.leg, 0.85);
  leg.dry({ opacity: 0.93, edge: 0.45, edgeWidth: L * 0.018, sharpness: 0.45, granulation: 0.3, flow: 0.4 });
  p.glaze(thigh, c.belly, { rng, opacity: 0.25, edge: 0, darken: 0, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.45, amount: 1 } });
  // dark crossbars across the thigh and the shank
  for (const [x, y] of [[-0.27, -0.16], [-0.14, -0.155], [-0.01, -0.13]] as const) mark(p, pt(x + 0.01, y - 0.045), pt(x - 0.01, y + 0.04), c.bar, 0.024, 0.42, 'leaf');
  for (const x of [-0.2, -0.05]) mark(p, pt(x + 0.005, -0.07), pt(x - 0.005, -0.03), c.bar, 0.022, 0.4, 'leaf');
  // the near arm, straight down from the shoulder, the hand turned in
  const arm = smoothPolygon([P(0.25, -0.2), P(0.31, -0.19), P(0.31, -0.06), P(0.35, -0.005), P(0.25, 0.004), P(0.26, -0.06)], 1);
  p.wash(arm, c.leg, { rng, opacity: 0.85, edge: 0.4, edgeWidth: L * 0.015, sharpness: 0.4, deform: 0.05, layers: 6 });
  // reserved-paper glints on the wet skin
  for (const [x0, y0, x1, y1] of [[0.12, -0.39, 0.0, -0.365], [-0.12, -0.315, -0.2, -0.29], [0.42, -0.335, 0.37, -0.36], [-0.12, -0.2, -0.2, -0.19]] as const) mark(p, pt(x0, y0), pt(x1, y1), '#ffffff', 0.018, 0.8, 'petal', 'source-over');
}

/** Floating: only the top of the head and the back's ridge break the water (y 0, the waterline); the far eye a little behind. */
function paintFloat(p: Painter, c: Tone): void {
  const rng = p.rng;
  const head = smoothPolygon([P(0.52, 0.01), P(0.47, -0.04), P(0.38, -0.075), P(0.3, -0.115), P(0.22, -0.1), P(0.1, -0.075), P(-0.02, -0.045), P(-0.12, -0.015), P(-0.15, 0.012)], 2);
  p.wetInWet(head, mix(c.back, c.blotch, 0.4), c.back, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.5, opacity: 0.96, edge: 0.55, edgeWidth: L * 0.02, deform: 0.05, granulation: 0.25, blend: 'source-over', fade: { angle: Math.PI, start: 0.8, amount: 0.6 } });
  blotches(p, head, c.blotch, 3, [-0.1, 0.1], [-0.05, -0.02], 0.025);
  mark(p, pt(0.2, -0.1), pt(-0.1, -0.03), c.stripe, 0.018, 0.75);
  mark(p, pt(0.5, -0.02), pt(0.36, -0.005), c.ridge, 0.016, 0.5);
  // the far eye, then the near one: gold, the pupil level
  for (const [x, y, s, a] of [[0.24, -0.11, 0.85, 0.75], [0.3, -0.115, 1.15, 1]] as const) {
    p.dab(P(x, y), mix(c.back, c.belly, 0.2), { rng, variant: 'round', angle: 0, length: L * 0.11 * s, width: L * 0.09 * s, opacity: 0.85 * a, layers: 3, blend: 'source-over' });
    p.dab(P(x, y - 0.006), EYE, { rng, variant: 'round', angle: 0, length: L * 0.08 * s, width: L * 0.075 * s, opacity: a, layers: 3, blend: 'source-over' });
    p.dab(P(x + 0.004, y - 0.006), PUPIL, { rng, variant: 'round', angle: 0, length: L * 0.05 * s, width: L * 0.018 * s, opacity: 0.9 * a, layers: 2 });
  }
  mark(p, pt(0.12, -0.085), pt(0.02, -0.065), '#ffffff', 0.016, 0.75, 'petal', 'source-over');
  // the waterline: a pale lifted line where the skin meets the water
  mark(p, pt(0.5, 0.006), pt(-0.14, 0.006), '#ffffff', 0.016, 0.5, 'blade', 'source-over');
}

/** Under the surface: the body hanging back from the head, the hind legs trailing, bent (seen through the water). */
function paintHang(p: Painter, c: Tone): void {
  const rng = p.rng;
  const legs = p.layer({ x: -L, y: -L * 0.3, w: L * 1.1, h: L * 0.6 });
  legs.fill(smoothPolygon([P(-0.2, 0.06), P(-0.42, 0.04), P(-0.6, 0.1), P(-0.74, 0.08), P(-0.76, 0.12), P(-0.58, 0.16), P(-0.4, 0.12), P(-0.2, 0.12)], 2), c.leg, 0.6);
  legs.fill(smoothPolygon([P(-0.2, 0.1), P(-0.38, 0.18), P(-0.5, 0.26), P(-0.66, 0.27), P(-0.66, 0.3), P(-0.46, 0.31), P(-0.3, 0.24), P(-0.16, 0.14)], 2), c.leg, 0.75);
  legs.dry({ opacity: 0.8, edge: 0.3, edgeWidth: L * 0.02, sharpness: 0.4 });
  const body = smoothPolygon([P(0.46, 0), P(0.34, -0.05), P(0.1, -0.04), P(-0.14, 0.02), P(-0.26, 0.1), P(-0.16, 0.16), P(0.08, 0.1), P(0.36, 0.05)], 2);
  p.wetInWet(body, c.back, c.blotch, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.85, edge: 0.3, deform: 0.06, blend: 'source-over' });
}

/** The leap: stretched out, the arms tucked, the hind legs trailing to the webbed feet; anchored at the body's middle. */
function paintLeap(p: Painter, c: Tone): void {
  const rng = p.rng;
  const legs = p.layer({ x: -L * 1.1, y: -L * 0.2, w: L * 1.0, h: L * 0.36 });
  for (const [dy, op] of [[0.035, 0.55], [-0.02, 0.85]] as const) {
    legs.fill(smoothPolygon([P(-0.18, dy - 0.075), P(-0.42, dy - 0.05), P(-0.62, dy - 0.02), P(-0.82, dy - 0.012), P(-0.82, dy + 0.012), P(-0.62, dy + 0.025), P(-0.42, dy + 0.035), P(-0.2, dy + 0.06)], 2), c.leg, op);
    legs.fill(smoothPolygon([P(-0.8, dy - 0.012), P(-0.96, dy - 0.05), P(-1.0, dy + 0.005), P(-0.96, dy + 0.05), P(-0.8, dy + 0.014)], 1), c.leg, op * 0.7);
  }
  legs.dry({ opacity: 0.9, edge: 0.35, edgeWidth: L * 0.018, sharpness: 0.45, granulation: 0.3 });
  for (const x of [-0.34, -0.56]) mark(p, pt(x + 0.01, -0.06), pt(x - 0.01, 0.0), c.bar, 0.03, 0.5);
  const body = smoothPolygon([P(0.5, -0.02), P(0.42, -0.09), P(0.2, -0.12), P(-0.08, -0.1), P(-0.24, -0.05), P(-0.24, 0.03), P(0.02, 0.07), P(0.3, 0.05), P(0.48, 0.02)], 2);
  p.wetInWet(body, c.back, c.belly, { rng, angle: Math.PI / 2, split: 0.6, opacity: 0.93, edge: 0.4, edgeWidth: L * 0.022, deform: 0.05, granulation: 0.25, blend: 'source-over' });
  blotches(p, body, c.blotch, 4, [-0.18, 0.15], [-0.1, -0.02], 0.028);
  mark(p, pt(0.22, -0.11), pt(-0.2, -0.08), c.stripe, 0.02, 0.7);
  mark(p, pt(0.26, 0.04), pt(0.06, 0.06), c.leg, 0.04, 0.8);
  p.dab(P(0.3, -0.095), EYE, { rng, variant: 'round', angle: 0, length: L * 0.075, width: L * 0.07, opacity: 0.95, layers: 3, blend: 'source-over' });
  p.dab(P(0.305, -0.095), PUPIL, { rng, variant: 'round', angle: 0, length: L * 0.045, width: L * 0.016, opacity: 0.9, layers: 2 });
  mark(p, pt(0.1, -0.1), pt(-0.02, -0.09), '#ffffff', 0.016, 0.75, 'petal', 'source-over');
}

/** A vocal sac: a pale grey-white bubble at the mouth's corner, lost where it joins; anchored at its root. */
function paintSac(p: Painter): void {
  const rng = p.rng;
  const r = L * 0.09;
  const shape = blob(r * 0.55, 0, r, r * 0.82, rng, { irregularity: 0.05 });
  p.wetInWet(shape, '#fdfcf8', '#c4c2cc', { rng, angle: Math.PI / 2 + 0.4, split: 0.62, softness: 0.55, opacity: 0.88, edge: 0.06, sharpness: 0.25, centreLift: 0, granulation: 0.06, deform: 0.03, fade: { angle: Math.PI, start: 0.7, amount: 0.7 }, blend: 'source-over' });
  p.dab({ x: r * 0.7, y: -r * 0.35 }, '#ffffff', { rng, variant: 'round', angle: 0, length: r * 0.4, width: r * 0.3, opacity: 0.75, edge: 0, blend: 'source-over' });
}

function paintShadow(p: Painter): void {
  const rng = p.rng;
  p.glaze(blob(0, 0, L * 0.48, L * 0.07, rng, { irregularity: 0.12 }), SHADE, { rng, opacity: 0.4, edge: 0, darken: 0, deform: 0.2, fade: { angle: Math.PI, start: 0.4, amount: 0.8, ragged: 0.6 } });
}

export interface FrogParts {
  sit: Sprite;
  float: Sprite;
  hang: Sprite;
  leap: Sprite;
  sac: Sprite;
  shadow: Sprite;
}

export function paintSaharaFrog(res: number, seed: number, tone: FrogTone = 'green'): FrogParts {
  const c = FROG_TONES[tone];
  const hang = paintSprite(res, { w: L * 1.4, h: L * 0.56, ox: L * 0.9, oy: L * 0.28 }, seed + 2, (p) => paintHang(p, c));
  return {
    sit: paintSprite(res, { w: L * 1.08, h: L * 0.56, ox: L * 0.48, oy: L * 0.52 }, seed, (p) => paintSit(p, c)),
    float: paintSprite(res, { w: L * 0.78, h: L * 0.23, ox: L * 0.24, oy: L * 0.2 }, seed + 1, (p) => paintFloat(p, c)),
    hang: deepCopy(hang, res, '#5b9a91', 0.35, 3),
    leap: paintSprite(res, { w: L * 1.6, h: L * 0.36, ox: L * 1.05, oy: L * 0.18 }, seed + 3, (p) => paintLeap(p, c)),
    sac: paintSprite(res, { w: L * 0.21, h: L * 0.18, ox: L * 0.02, oy: L * 0.09 }, seed + 4, (p) => paintSac(p)),
    shadow: paintSprite(res, { w: L * 1.05, h: L * 0.2, ox: L * 0.52, oy: L * 0.1 }, seed + 5, (p) => paintShadow(p)),
  };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** Somewhere to sit: the basin's coping at the water's edge, or a stair tread just under the water. */
export interface Seat {
  id: string;
  kind: 'rim' | 'step';
  x: number;
  /** its feet's y (the same all along the spread) */
  y: number;
  spread: number;
  depth: number;
  /** how much of it is under the water (a step), 0..1 */
  sub: number;
  /** which way it faces on a step (toward the open water); 0: either */
  facing: number;
}

type SeatWorld = Pick<FaunaWorld, 'perches' | 'pond' | 'stands'>;
const seatCache = new WeakMap<object, { pond: object; stands: object; seats: Seat[] }>();

/**
 * Its seats, cached per world's perches, still water and stands: the near and far coping (the
 * level rim perches by the water) at the water's edge, and the heron's stands in the basin (the
 * stair's submerged treads), where it sits half out of the water.
 */
export function frogSeats(w: SeatWorld): Seat[] {
  const stands = w.stands();
  const hit = seatCache.get(w.perches);
  if (hit && hit.pond === w.pond.world && hit.stands === stands) return hit.seats;
  const pond = w.pond.world;
  const seats: Seat[] = [];
  if (pond.length >= 3) {
    for (const p of w.perches) {
      if (p.kind !== 'rim' || Math.abs(p.slope ?? 0) > 0.3) continue;
      const c = closestOnPolygon(p, pond);
      if (c.d > 12) continue;
      // the far coping's lip just above the water, or the near coping's inner edge
      const y = c.pt.y > p.y ? c.pt.y - 0.5 : c.pt.y + 1.5;
      seats.push({ id: p.id, kind: 'rim', x: p.x, y, spread: p.spread * 0.8, depth: p.depth + 0.5, sub: 0, facing: 0 });
    }
    const steps = stands.filter((s) => pointInPolygon(s, pond)).sort((a, b) => a.y - b.y);
    steps.forEach((s, i) => seats.push({ id: `step-${i + 1}`, kind: 'step', x: s.x, y: s.y, spread: 4, depth: s.y + 0.5, sub: Math.min(0.7, 0.35 + i * 0.25), facing: s.facing }));
  }
  seatCache.set(w.perches, { pond: w.pond.world, stands, seats });
  return seats;
}

const inView = (v: Rect, q: Pt, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;
const clear = (q: Pt, taken: readonly Pt[], gap: number) => taken.every((t) => dist(t, q) >= gap);

/** A free seat, in view first; never one within `clear` of what others hold. */
export function chooseSeat(w: Pick<FaunaWorld, 'perches' | 'pond' | 'stands' | 'view'>, rng: Rng, taken: readonly Pt[], not: Seat | null = null): Seat | null {
  const all = frogSeats(w).filter((s) => s !== not && clear(s, taken, FROG_TUNING.clear + s.spread));
  const seen = all.filter((s) => inView(w.view, s, 30));
  const pool = seen.length > 0 ? seen : all;
  return pool.length > 0 ? rng.pick(pool) : null;
}

/** Where on a seat it sits (x within the spread, clear of what others hold). */
export function seatPoint(s: Seat, rng: Rng, taken: readonly Pt[]): Pt {
  for (let i = 0; i < 8; i++) {
    const x = s.x + rng.range(-1, 1) * s.spread;
    if (clear({ x, y: s.y }, taken, FROG_TUNING.clear)) return { x, y: s.y };
  }
  return { x: s.x, y: s.y };
}

/** Is a float spot good: in the water, `margin` inside its edge, off the stair. */
export function floatable(w: Pick<FaunaWorld, 'perches' | 'pond' | 'stands'>, q: Pt, margin = FROG_TUNING.margin): boolean {
  const pond = w.pond.world;
  if (!pointInPolygon(q, pond) || distanceToPolygon(q, pond) < margin) return false;
  return frogSeats(w).every((s) => s.kind !== 'step' || dist(s, q) > 26);
}

/** Somewhere to float: among the water plants' pads when there are any, in view first, clear of others. */
export function floatSpot(w: Pick<FaunaWorld, 'perches' | 'pond' | 'stands' | 'view' | 'pads'>, rng: Rng, taken: readonly Pt[], near: Pt | null = null): Pt | null {
  const pond = w.pond;
  const b = pond.bounds;
  const pads = w.pads.filter((p) => pointInPolygon(p, pond.world));
  for (let i = 0; i < 60; i++) {
    let q: Pt;
    if (near && i < 20) {
      const a = rng.range(0, TAU);
      const r = rng.range(18, 60);
      q = { x: near.x + Math.cos(a) * r, y: near.y + Math.sin(a) * r * pond.squash };
    } else if (pads.length > 0 && rng.chance(0.6)) {
      const pad = rng.pick(pads);
      const a = rng.range(0, TAU);
      const r = pad.r * rng.range(0.9, 1.5);
      q = { x: pad.x + Math.cos(a) * r, y: pad.y + Math.sin(a) * r * pond.squash };
    } else q = { x: rng.range(b.x, b.x + b.w), y: rng.range(b.y, b.y + b.h) };
    if (!floatable(w, q) || !clear(q, taken, FROG_TUNING.clear)) continue;
    if (i < 45 && !inView(w.view, q, 24)) continue;
    return q;
  }
  return null;
}

/** The water just off a seat (where it plops in or climbs out), toward the basin's middle. */
export function waterBeside(w: Pick<FaunaWorld, 'pond'>, at: Pt): Pt {
  const c = w.pond.centre;
  for (let t = 0.02; t <= 1; t += 0.02) {
    const q = { x: lerp(at.x, c.x, t * 0.25), y: lerp(at.y, c.y, t) };
    if (pointInPolygon(q, w.pond.world) && distanceToPolygon(q, w.pond.world) >= 5) return q;
  }
  return { ...c };
}

/** Croak times in a bout: a run of evenly spaced, slightly quickening croaks. */
export function croaks(n: number, rng: Rng): number[] {
  const out: number[] = [];
  let t = 0;
  const g = rng.range(FROG_TUNING.gap[0], FROG_TUNING.gap[1]);
  for (let i = 0; i < n; i++) {
    out.push(t);
    t += g * (1 - 0.25 * (i / Math.max(1, n - 1)));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

interface Hop {
  from: Pt;
  to: Pt;
  dur: number;
  h: number;
  s0: number;
  s1: number;
}

type Time = 'day' | 'dusk' | 'night';

export class SaharaFrog extends BaseCreature {
  readonly kind = 'sahara-frog' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  readonly tone: FrogTone;
  seat: Seat | null = null;
  /** plops, bouts and surfacings so far (tests) */
  plops = 0;
  bouts = 0;
  surfacings = 0;
  private goal: Seat | null = null;
  private goalAt: Pt | null = null;
  private paddleTo: Pt | null = null;
  private hop: Hop | null = null;
  private facing = 1;
  private scale = 1;
  private spell = 30;
  private boutIn = 10;
  private notes: number[] = [];
  private boutT = -1;
  private underFrom: Pt = { x: 0, y: 0 };
  private underTo: Pt = { x: 0, y: 0 };
  private underFor = 4;
  private sink = 0;
  private ringIn = 3;
  private nightSince = -1;
  private ph: number;

  constructor(w: FaunaWorld, readonly rng: Rng, taken: readonly Pt[]) {
    super();
    this.tone = rng.chance(0.55) ? 'green' : 'olive';
    this.ph = rng.range(0, TAU);
    this.facing = rng.chance(0.5) ? 1 : -1;
    const time = this.time(w);
    const bask = !w.mode.night && rng.chance(FROG_TUNING.baskChanceDay);
    const seat = bask ? chooseSeat(w, rng, taken) : null;
    if (w.t < 2 && seat) {
      // there from the start: already on the coping
      this.settle(w, seat, seatPoint(seat, rng, taken));
      return;
    }
    const at = floatSpot(w, rng, taken);
    if (!at) {
      this.done = true;
      return;
    }
    if (w.t < 2) {
      this.floatAt(w, at, time);
      return;
    }
    // it comes up from the bottom: a ring, then the eyes
    this.underFrom = at;
    this.underTo = at;
    this.underFor = 0.6;
    this.alpha = 0;
    this.layer = 'underwater';
    this.go('under');
  }

  /** The seat it is on or making for (birds and other frogs keep off it). */
  spot(): Pt | null {
    if (this.goalAt) return this.goalAt;
    if (this.seat && (this.state === 'bask' || this.state === 'call')) return { x: this.x, y: this.y };
    return null;
  }

  /** Whether it is calling, and how full its sacs are (0..1). */
  song(): { calling: boolean; sac: number } {
    const calling = this.boutT >= -0.3 && this.notes.length > 0;
    return { calling, sac: calling ? sacAt(this.boutT, this.notes) : 0 };
  }

  /** Its frogs' positions and every held spot but its own (where it may not go). */
  private taken(w: FaunaWorld): Pt[] {
    const out: Pt[] = [];
    for (const c of w.creatures) {
      if (c === this || c.done) continue;
      if (c instanceof SaharaFrog) {
        out.push(c.spot() ?? c.paddleTo ?? { x: c.x, y: c.y });
        continue;
      }
      const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
      const s = o.perchPoint?.() ?? o.spot?.();
      if (s) out.push(s);
    }
    return out;
  }

  private time(w: FaunaWorld): Time {
    if (!w.mode.night) {
      this.nightSince = -1;
      return 'day';
    }
    if (this.nightSince < 0) this.nightSince = w.t;
    return w.t - this.nightSince < FROG_TUNING.dusk ? 'dusk' : 'night';
  }

  /** Is a bird near enough to send it under? Herons and storks from afar; a bird on the wing from farther. */
  threatened(w: Pick<FaunaWorld, 'creatures'>): boolean {
    for (const c of w.creatures) {
      const r = FROG_THREATS[c.kind];
      if (r === undefined || c.done) continue;
      if (dist(c, this) < (c.layer === 'air' ? r * 1.5 : r)) return true;
    }
    return false;
  }

  private settle(w: FaunaWorld, s: Seat, at: Pt): void {
    this.seat = s;
    this.goal = null;
    this.goalAt = null;
    this.x = at.x;
    this.y = at.y;
    this.scale = w.perspective(s.y, s.x);
    if (s.facing) this.facing = s.facing;
    this.layer = 'entities';
    this.spell = rangeOf(this.rng, w.mode.night ? FROG_TUNING.baskNight : FROG_TUNING.baskDay);
    this.go('bask');
  }

  private floatAt(w: FaunaWorld, at: Pt, time: Time): void {
    this.seat = null;
    this.x = at.x;
    this.y = at.y;
    this.scale = w.perspective(at.y, at.x);
    this.layer = 'waterSurface';
    this.spell = rangeOf(this.rng, time === 'day' ? FROG_TUNING.floatDay : FROG_TUNING.floatNight);
    this.sink = 0;
    this.go('float');
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sp = w.speed;
    this.timer += dt;
    this.ph += dt * sp;
    const time = this.time(w);
    switch (this.state) {
      case 'bask':
      case 'float':
      case 'paddle':
        this.idle(dt, w, time);
        break;
      case 'plop':
      case 'climb':
        this.stepHop(w);
        break;
      case 'surface':
        this.alpha = Math.min(1, this.alpha + dt * 2.5);
        this.sink = 1 - easeInOut(this.timer / 0.9);
        if (this.timer >= 0.9) this.floatAt(w, { x: this.x, y: this.y }, time);
        break;
      case 'dive':
        this.sink = easeInOut(this.timer / 0.5);
        if (this.timer >= 0.5) this.goUnder(w);
        break;
      case 'under': {
        const k = clamp(this.timer / this.underFor, 0, 1);
        this.x = lerp(this.underFrom.x, this.underTo.x, easeInOut(k));
        this.y = lerp(this.underFrom.y, this.underTo.y, easeInOut(k));
        if (k >= 1) {
          if (this.leaving) {
            this.done = true;
            return;
          }
          this.surface(w);
        }
        break;
      }
    }
  }

  /** Sitting or floating: calls after dark, startles, and moves on when its spell is over. */
  private idle(dt: number, w: FaunaWorld, time: Time): void {
    const sp = w.speed;
    if (this.threatened(w)) {
      this.stopCall();
      this.leaveSpot(w);
      return;
    }
    if (this.leaving && this.boutT < 0) {
      this.leaveSpot(w);
      return;
    }
    // a bout of croaks, the sacs swelling with each; it holds still meanwhile
    if (this.boutT >= -0.3) {
      this.boutT += dt * sp;
      if (this.boutT > this.notes[this.notes.length - 1]! + 0.8) this.stopCall();
      return;
    }
    if (time !== 'day' && this.state !== 'paddle') {
      this.boutIn -= dt * sp;
      if (this.boutIn <= 0) {
        this.startCall(w, time);
        return;
      }
    }
    if (this.state === 'paddle') {
      this.paddle(dt, w);
      return;
    }
    if (this.state === 'float') {
      // a faint ring now and then as it hangs at the surface
      this.ringIn -= dt * sp;
      if (this.ringIn <= 0) {
        w.ripple(this.x, this.y, 9 * this.scale, 0.3);
        this.ringIn = this.rng.range(5, 11);
      }
    } else if (this.rng.chance((dt * sp) / 80) && this.seat?.kind === 'rim') this.facing = -this.facing;
    this.spell -= dt * sp;
    if (this.spell <= 0) this.moveOn(w, time);
  }

  private startCall(w: FaunaWorld, time: Time): void {
    this.notes = croaks(this.rng.int(FROG_TUNING.notes[0], FROG_TUNING.notes[1]), this.rng);
    this.boutT = -0.3;
    this.bouts++;
    this.boutIn = rangeOf(this.rng, time === 'dusk' ? FROG_TUNING.boutDusk : FROG_TUNING.boutNight);
    // the chorus: the others in the basin answer
    for (const c of w.creatures) {
      if (c === this || !(c instanceof SaharaFrog) || c.done || c.boutT >= -0.3) continue;
      if (this.rng.chance(FROG_TUNING.answer)) c.boutIn = Math.min(c.boutIn, this.rng.range(0.4, 1.6));
    }
  }

  private stopCall(): void {
    this.boutT = -1;
    this.notes = [];
  }

  /** Its spell is over: by day mostly out onto the coping, after dark mostly afloat elsewhere. */
  private moveOn(w: FaunaWorld, time: Time): void {
    const rng = this.rng;
    const taken = this.taken(w);
    const bask = rng.chance(time === 'day' ? FROG_TUNING.baskChanceDay : FROG_TUNING.baskChanceNight);
    if (this.state === 'float') {
      const seat = bask ? chooseSeat(w, rng, taken) : null;
      if (seat) {
        // it paddles over and climbs out
        const at = seatPoint(seat, rng, taken);
        this.goal = seat;
        this.goalAt = at;
        this.paddleTo = waterBeside(w, at);
        this.go('paddle');
        return;
      }
      const near = floatSpot(w, rng, taken, this);
      if (near && rng.chance(0.5)) {
        this.paddleTo = near;
        this.go('paddle');
        return;
      }
      this.go('dive');
      return;
    }
    this.leaveSpot(w);
  }

  /** Off the seat into the water with a plop, or under from afloat. */
  private leaveSpot(w: FaunaWorld): void {
    this.goal = null;
    this.goalAt = null;
    this.paddleTo = null;
    if (this.state === 'bask' && this.seat) {
      const to = waterBeside(w, { x: this.x + this.facing * 4, y: this.y });
      const from = { x: this.x, y: this.y };
      if (Math.abs(to.x - from.x) > 1) this.facing = Math.sign(to.x - from.x);
      const s = this.scale;
      this.hop = { from, to, s0: s, s1: w.perspective(to.y, to.x), dur: 0.45 / w.speed, h: 6 * s };
      this.seat = null;
      this.plops++;
      this.go('plop');
      return;
    }
    this.go('dive');
  }

  private paddle(dt: number, w: FaunaWorld): void {
    const to = this.paddleTo!;
    const d = dist(to, this);
    // kicks: a surge with each stroke of the hind legs
    const step = FROG_TUNING.paddle * w.speed * dt * (0.5 + Math.max(0, Math.sin(this.ph * 5)));
    if (Math.abs(to.x - this.x) > 1) this.facing = Math.sign(to.x - this.x);
    this.ringIn -= dt * w.speed;
    if (this.ringIn <= 0) {
      w.ripple(this.x - this.facing * 3 * this.scale, this.y, 8 * this.scale, 0.35);
      this.ringIn = 1.1;
    }
    if (d <= step) {
      this.x = to.x;
      this.y = to.y;
      this.paddleTo = null;
      if (this.goal && this.goalAt) {
        if (!clear(this.goalAt, this.taken(w), FROG_TUNING.clear)) {
          this.goal = null;
          this.goalAt = null;
          this.floatAt(w, to, this.time(w));
          return;
        }
        const s = this.scale;
        const s1 = w.perspective(this.goal.y, this.goal.x);
        this.hop = { from: { x: this.x, y: this.y }, to: this.goalAt, s0: s, s1, dur: 0.5 / w.speed, h: 5 * s1 };
        this.facing = this.goalAt.x >= this.x ? 1 : -1;
        this.layer = 'air';
        this.go('climb');
        return;
      }
      this.floatAt(w, to, this.time(w));
      return;
    }
    this.x += ((to.x - this.x) / d) * step;
    this.y += ((to.y - this.y) / d) * step;
    this.scale = w.perspective(this.y, this.x);
  }

  private stepHop(w: FaunaWorld): void {
    const j = this.hop!;
    const k = clamp(this.timer / j.dur, 0, 1);
    const e = easeInOut(k);
    this.x = lerp(j.from.x, j.to.x, e);
    this.y = lerp(j.from.y, j.to.y, e) - Math.sin(Math.PI * k) * j.h;
    this.scale = lerp(j.s0, j.s1, e);
    this.layer = 'air';
    if (k < 1) return;
    this.hop = null;
    if (this.state === 'climb') {
      w.ripple(j.from.x, j.from.y, 10 * j.s0, 0.5);
      this.settle(w, this.goal!, j.to);
      this.boutIn = Math.max(this.boutIn, this.rng.range(3, 8));
      return;
    }
    // the plop: a splash ring and a smaller one after it
    w.ripple(j.to.x, j.to.y, 24 * j.s1, 1);
    w.ripple(j.to.x, j.to.y, 12 * j.s1, 0.6);
    this.goUnder(w);
  }

  /** Under: it swims along the bottom to come up somewhere else. */
  private goUnder(w: FaunaWorld): void {
    this.underFrom = { x: this.x, y: this.y };
    const next = this.leaving ? null : floatSpot(w, this.rng, this.taken(w), this.rng.chance(0.5) ? this : null);
    this.underTo = next ?? { x: this.x, y: this.y };
    this.underFor = rangeOf(this.rng, FROG_TUNING.under) / w.speed;
    if (this.state === 'dive') w.ripple(this.x, this.y, 12 * this.scale, 0.55);
    this.layer = 'underwater';
    this.sink = 1;
    this.go('under');
  }

  private surface(w: FaunaWorld): void {
    if (!floatable(w, this.underTo, 3)) {
      const q = floatSpot(w, this.rng, this.taken(w));
      if (q) this.underTo = q;
    }
    this.x = this.underTo.x;
    this.y = this.underTo.y;
    this.scale = w.perspective(this.y, this.x);
    w.ripple(this.x, this.y, 14 * this.scale, 0.6);
    this.surfacings++;
    this.layer = 'waterSurface';
    this.sink = 1;
    this.go('surface');
  }

  override depth(): number | null {
    return this.layer === 'entities' && this.seat ? this.seat.depth : null;
  }

  override leave(): void {
    this.leaving = true;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (this.done) return;
    const parts = w.art.get(`sahara-frog:${this.tone}`, (res) => paintSaharaFrog(res, this.tone === 'green' ? 3300 : 3340, this.tone));
    const s = this.scale;
    const st = this.state;
    if (st === 'under') {
      // a dim shape gliding along under the water, fading away from where it went in
      if (layer !== 'underwater') return;
      const k = clamp(this.timer / this.underFor, 0, 1);
      const a = 0.32 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (this.alpha > 0 ? 1 : 0.5);
      if (a > 0.02) blit(ctx, parts.hang, this.x, this.y + 3 * s, s * this.facing, s * 0.9, a);
      return;
    }
    if (st === 'float' || st === 'paddle' || st === 'surface' || st === 'dive') {
      if (layer === 'underwater') {
        const kick = st === 'paddle' ? 1 + 0.12 * Math.sin(this.ph * 5) : 1;
        blit(ctx, parts.hang, this.x, this.y + 1.5 * s, s * this.facing * kick, s, 0.45 * this.alpha);
      } else if (layer === 'waterSurface') {
        const dy = this.sink * L * 0.14 * s;
        const a = this.alpha * (1 - 0.8 * this.sink);
        blit(ctx, parts.float, this.x, this.y + dy, s * this.facing, s, a);
        this.drawSacs(ctx, parts, MOUTH.float, this.x, this.y + dy, s, a);
      }
      return;
    }
    if (layer !== this.layer) return;
    if (st === 'plop' || st === 'climb') {
      const j = this.hop;
      const k = j ? clamp(this.timer / j.dur, 0, 1) : 0;
      const down = j && j.to.y < j.from.y ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y - L * 0.08 * s);
      ctx.scale(s * this.facing, s);
      ctx.rotate(lerp(-0.4, 0.45, k) * down);
      ctx.drawImage(parts.leap.img as CanvasImageSource, -parts.leap.ox, -parts.leap.oy, parts.leap.w, parts.leap.h);
      ctx.restore();
      return;
    }
    // sitting: on the coping with a soft shadow, or on a step with its lower half under the water
    const seat = this.seat;
    const sub = seat?.sub ?? 0;
    const breath = 1 + 0.025 * Math.max(0, Math.sin(this.ph * 2.4)) ** 2;
    if (sub === 0) blit(ctx, parts.shadow, this.x - 0.04 * L * s * this.facing, this.y + 0.3 * s, s * this.facing, s, this.alpha * 0.9);
    ctx.save();
    if (sub > 0) {
      const line = this.y - sub * L * 0.3 * s;
      blit(ctx, parts.sit, this.x, this.y, s * this.facing, s * breath, this.alpha * 0.28);
      ctx.beginPath();
      ctx.rect(this.x - L * s, line - L * s, 2 * L * s, L * s);
      ctx.clip();
    }
    blit(ctx, parts.sit, this.x, this.y, s * this.facing, s * breath, this.alpha);
    ctx.restore();
    this.drawSacs(ctx, parts, MOUTH.sit, this.x, this.y, s, this.alpha);
  }

  /** The two sacs at the mouth's corners: the near one full, the far one peeping behind the head. */
  private drawSacs(ctx: Ctx, parts: FrogParts, at: Pt, x: number, y: number, s: number, alpha: number): void {
    const sac = this.boutT >= -0.3 ? sacAt(this.boutT, this.notes) : 0;
    if (sac < 0.03) return;
    const k = 0.25 + 0.75 * sac;
    const f = this.facing;
    blit(ctx, parts.sac, x + (at.x - 0.05) * L * s * f, y + (at.y - 0.04) * L * s, s * f * k * 0.75, s * k * 0.75, alpha * Math.min(0.75, 0.3 + sac));
    blit(ctx, parts.sac, x + at.x * L * s * f, y + at.y * L * s, s * f * k, s * k, alpha * Math.min(0.92, 0.35 + sac));
  }
}

function blit(ctx: Ctx, sp: Sprite, x: number, y: number, sx: number, sy: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
  ctx.restore();
}

const saharaFrog: CreatureDef = {
  kind: 'sahara-frog',
  title: 'Sahara frog',
  role: 'resident',
  rank: 6,
  // one by day, a little chorus after dark
  resident: (n, mode) => (n > 0 ? (mode.night ? (mode.reduced ? 2 : 3) : 1) : 0),
  // every frame in every garden: keep it cheap (devlog 142)
  needs: (w) => w.pond.world.length >= 3,
  spawn(w, s) {
    const rng = w.rng.fork(`sahara-frog:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const taken: Pt[] = [];
    for (const c of w.creatures) {
      if (c.done) continue;
      const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
      const p = o.perchPoint?.() ?? o.spot?.() ?? (c instanceof SaharaFrog ? { x: c.x, y: c.y } : null);
      if (p) taken.push(p);
    }
    const out: SaharaFrog[] = [];
    for (let i = 0; i < Math.max(1, s.count); i++) {
      const f = new SaharaFrog(w, rng.fork(`f${i}`), taken);
      if (f.done) break;
      taken.push(f.spot() ?? { x: f.x, y: f.y });
      out.push(f);
    }
    return out;
  },
  sheet: {
    w: 620,
    h: 120,
    make(res, seed) {
      const a = paintSaharaFrog(res, seed, 'green');
      const b = paintSaharaFrog(res, seed + 40, 'olive');
      return [a.sit, b.sit, a.float, a.hang, a.leap, a.sac];
    },
  },
  show: { stage: 'oasis', spec: { x: 520, y: 470, w: 600, h: 230 }, w: 720, h: 276, group: 3, order: 42 },
};
export default saharaFrog;
