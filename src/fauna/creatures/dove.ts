/** Laughing dove (Spilopelia senegalensis): the oasis's calm visitor, alone or in a pair. Side view, facing right.
 * docs/devlog/129-laughing-dove.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { approach, clamp, closestOnPolygon, cubic, cubicLength, cubicTangent, dist, easeInOut, isOffscreen, lerp, pointInPolygon, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type GroundSpot, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import type { CreatureDef } from './lib/def';
import { entryPoint, exitPoint } from './lib/flight';

/** Bill tip to tail tip at perspective 1 (world units): about 25 cm, twice the bunting. */
export const DOVE_SIZE = 30;
const U = DOVE_SIZE / 30;

export const DOVE_TUNING = {
  /** world units / s at perspective 1 */
  flight: 125,
  /** seconds of the clattering climb after a take-off */
  clatter: 0.65,
  /** seconds at one place before moving on; the first spell is longer */
  spell: [10, 24] as const,
  firstSpell: [16, 32] as const,
  /** seconds with the bill in the water */
  drink: [3, 6.5] as const,
  /** walking: world units / s and per step at perspective 1 */
  walk: 7,
  stride: 3.4,
  /** a pair sits this far apart along a perch (world units at perspective 1) */
  pair: 10,
  /** seconds between bow-and-coo bouts on a perch */
  bowGap: [4, 12] as const,
  /** keeps this far from what others hold (`choosePerch`'s gap) */
  clear: 30,
  /** where it goes next: palm fronds, wall tops, the basin rim to drink, the plots */
  weights: { frond: 0.36, wall: 0.24, rim: 0.2, ground: 0.2 },
};

// ---------------------------------------------------------------------------------------------
// art

interface Colours {
  head: Pigment;
  crown: Pigment;
  breast: Pigment;
  belly: Pigment;
  back: Pigment;
  panel: Pigment;
  primary: Pigment;
  cinnamon: Pigment;
  spot: Pigment;
  tail: Pigment;
  tailDark: Pigment;
  white: Pigment;
  shade: Pigment;
  bill: Pigment;
  leg: Pigment;
  ink: Pigment;
}

function colours(): Colours {
  return {
    head: '#c99a8a',
    crown: mix('#c99a8a', '#8a92a8', 0.25),
    breast: mix('#c99a8a', '#d6a48c', 0.4),
    belly: mix(PIGMENTS.petalWhite, '#d8b8a8', 0.35),
    back: '#a8704e',
    panel: '#8a92a8',
    primary: mix(PIGMENTS.sumi, '#6e6a78', 0.4),
    cinnamon: '#b0744e',
    spot: mix(PIGMENTS.sumi, '#3a2a22', 0.5),
    tail: mix('#8a6e5c', '#8a92a8', 0.2),
    tailDark: mix(PIGMENTS.sumi, '#5a524c', 0.4),
    white: PIGMENTS.petalWhite,
    shade: mix(PIGMENTS.shadow, '#a8704e', 0.2),
    bill: mix(PIGMENTS.sumi, PIGMENTS.stone, 0.25),
    leg: '#b86e63',
    ink: PIGMENTS.sumi,
  };
}

const P = (x: number, y: number): Pt => ({ x: x * U, y: y * U });

/** Standing: the hip above the feet, the neck (head anchor) on the body, the tail's root (hip-relative). */
const HIP = 3.2 * U;
const NECK = P(4.0, -8.2);
const TAIL_ROOT = P(-6.6, -2.9);
const BODY = [P(6.8, -5.6), P(6.0, -7.8), P(4.4, -9.0), P(2.4, -9.0), P(-1.0, -7.8), P(-4.8, -6.0), P(-7.6, -3.8), P(-7.8, -2.2), P(-4.6, -0.6), P(-0.8, 0.4), P(3.2, 0.0), P(5.8, -2.4)];
const WING = [P(3.4, -7.8), P(0.4, -8.4), P(-3.6, -7.0), P(-7.2, -4.8), P(-10.2, -3.0), P(-7.2, -2.4), P(-3.0, -2.6), P(0.6, -3.6), P(3.0, -5.2)];
/** In flight (body centre, level): where the head, the wings and the tail join. */
const FLY_BODY = [P(7.6, -0.6), P(6.2, -2.6), P(2.6, -3.4), P(-2.8, -3.0), P(-7.0, -1.6), P(-7.4, 0.2), P(-4.0, 2.0), P(1.0, 2.8), P(5.2, 2.0)];
const FLY_NECK = P(6.0, -1.6);
const SHOULDER = P(2.2, -2.4);
const FLY_TAIL = P(-6.6, -0.4);

/** Small overlapping feather dabs inside `region`: rows that follow the body, lighter or darker than the wash under them. */
function feathers(p: Painter, rng: Rng, region: Pt[], o: { n: number; size: number; angle: number; pigments: Pigment[]; opacity: [number, number] }): void {
  const xs = region.map((q) => q.x);
  const ys = region.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0, tries = 0; i < o.n && tries < o.n * 6; tries++) {
    const q = { x: rng.range(x0, x1), y: rng.range(y0, y1) };
    if (!pointInPolygon(q, region)) continue;
    i++;
    const l = o.size * rng.range(0.7, 1.25);
    p.dab(q, rng.pick(o.pigments), { rng, variant: 'petal', angle: o.angle + rng.range(-0.25, 0.25), length: l, width: l * rng.range(0.6, 0.85), opacity: rng.range(o.opacity[0], o.opacity[1]), layers: 2, pool: 0.6, edge: 0.4 });
  }
}

/** The perched / walking body, hip at the origin: breast, belly, the folded wing and the chequered neck patch. */
function paintBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  const body = smoothPolygon(BODY, 2);
  // pink breast into the rufous back, and a pale belly underneath
  p.wetInWet(body, c.back, c.breast, { rng, angle: Math.PI * 0.2, split: 0.42, softness: 0.55, fingers: 0.4, opacity: 0.92, edge: 0.4, edgeWidth: 0.5, deform: 0.1, granulation: 0.15, flow: 0.4, flowScale: 4 * U, blend: 'source-over' });
  const belly = smoothPolygon([P(5.2, -2.6), P(2.8, -0.2), P(-0.8, 0.3), P(-4.4, -0.7), P(-7.4, -2.2), P(-4.0, -2.6), P(0.6, -2.8), P(3.6, -3.6)], 1);
  p.glaze(belly, c.belly, { rng, opacity: 0.85, edge: 0, darken: 0, deform: 0.2, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.3, ragged: 0.8 } });
  // the round form: a cool shade under the belly, lost toward the lit breast
  p.glaze(body, c.shade, { rng, opacity: 0.22, edge: 0, darken: 0, deform: 0.08, fade: { angle: -Math.PI / 2 - 0.4, start: 0.2, amount: 1, ragged: 0.7 } });
  feathers(p, rng, smoothPolygon([P(6.4, -6.0), P(4.4, -8.4), P(1.6, -6.6), P(2.4, -3.2), P(5.4, -3.0)], 1), { n: 9, size: 1.3 * U, angle: Math.PI / 2, pigments: [c.head, c.breast], opacity: [0.18, 0.32] });
  // the neck patch: cinnamon, chequered with black spots, across the upper breast
  const patch = smoothPolygon([P(6.4, -7.2), P(4.8, -8.8), P(2.8, -8.6), P(2.6, -6.6), P(4.2, -5.6), P(6.2, -5.6)], 1);
  p.wash(patch, c.cinnamon, { rng, opacity: 0.6, edge: 0.3, deform: 0.25, spread: 0.06, layers: 4, fade: { angle: Math.PI / 2 + 0.3, start: 0.5, ragged: 0.8 } });
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4; k++) {
      const q = P(3.3 + k * 0.85 + row * 0.35 + rng.range(-0.15, 0.15), -8.0 + row * 0.85 + rng.range(-0.12, 0.12));
      if (!pointInPolygon(q, patch)) continue;
      p.dab(q, c.spot, { rng, variant: 'round', angle: rng.range(-0.4, 0.4), length: rng.range(0.55, 0.8) * U, width: rng.range(0.4, 0.6) * U, opacity: rng.range(0.6, 0.85), layers: 2, edge: 0.3 });
    }
  }
  // the folded wing: rufous scapulars over a blue-grey panel, dark primaries at the tip
  const wing = smoothPolygon(WING, 2);
  p.wetInWet(wing, c.back, c.panel, { rng, angle: Math.PI / 2 + 0.35, split: 0.4, softness: 0.4, fingers: 0.5, opacity: 0.9, edge: 0.45, edgeWidth: 0.45, deform: 0.1, granulation: 0.25, flow: 0.4, flowScale: 4 * U, blend: 'source-over' });
  const panel = smoothPolygon([P(1.6, -6.4), P(-2.6, -6.4), P(-6.0, -4.6), P(-5.0, -3.2), P(-1.2, -3.2), P(1.8, -4.4)], 1);
  p.glaze(panel, c.panel, { rng, opacity: 0.55, edge: 0.3, deform: 0.18, fade: { angle: Math.PI, start: 0.6, ragged: 0.8 } });
  feathers(p, rng, panel, { n: 10, size: 1.4 * U, angle: Math.PI - 0.3, pigments: [c.panel, mix(c.panel, c.ink, 0.25)], opacity: [0.2, 0.4] });
  feathers(p, rng, smoothPolygon([P(3.0, -7.8), P(-2.6, -7.4), P(-5.6, -5.4), P(-2.0, -6.2), P(2.4, -6.4)], 1), { n: 7, size: 1.5 * U, angle: Math.PI - 0.35, pigments: [c.back, mix(c.back, c.ink, 0.2)], opacity: [0.25, 0.45] });
  const primaries = smoothPolygon([P(-5.4, -5.4), P(-7.6, -4.6), P(-10.2, -3.0), P(-7.2, -2.4), P(-5.0, -2.8)], 1);
  p.glaze(primaries, c.primary, { rng, opacity: 0.7, edge: 0.4, deform: 0.1, fade: { angle: 0, start: 0.55 } });
  for (let k = 0; k < 3; k++) {
    const y = -3.2 - k * 0.6;
    p.inkLine([P(-3.2 - k * 0.6, y), P(-8.6, y + 0.4 + k * 0.1)], { rng, width: 0.16 * U, opacity: 0.3, breaks: 0.4, pigment: c.ink });
  }
  // the brush lifts off the belly and back: a few broken touches, no outline
  p.inkLine([P(6.6, -4.6), P(5.2, -1.8), P(2.6, -0.1)], { rng, width: 0.2 * U, opacity: 0.2, breaks: 0.7, wobble: 0.3, pigment: c.ink, taper: [0.3, 0.5] });
  p.inkLine([P(1.8, -8.8), P(-2.4, -7.6), P(-6.6, -4.6)], { rng, width: 0.2 * U, opacity: 0.22, breaks: 0.6, wobble: 0.3, pigment: c.ink, taper: [0.3, 0.4] });
}

/** Small head and slender neck, anchored where the neck meets the body; the stub hides under the breast. */
function paintHead(p: Painter, c: Colours): void {
  const rng = p.rng;
  const head = smoothPolygon([P(3.9, -3.6), P(3.2, -4.9), P(1.6, -5.5), P(-0.2, -5.0), P(-1.2, -3.6), P(-1.6, -1.6), P(-1.6, 1.4), P(-0.6, 3.4), P(2.0, 3.4), P(2.4, 1.0), P(3.0, -0.8), P(3.9, -2.0)], 2);
  p.wetInWet(head, c.crown, c.head, { rng, angle: Math.PI / 2, split: 0.3, softness: 0.5, fingers: 0.3, opacity: 0.92, edge: 0.4, edgeWidth: 0.5, deform: 0.08, granulation: 0.1, blend: 'source-over' });
  p.glaze(head, c.shade, { rng, opacity: 0.18, edge: 0, darken: 0, deform: 0.1, fade: { angle: -Math.PI / 2 - 0.6, start: 0.3, ragged: 0.6 } });
  // the bill: small and slender, dark
  const bill = smoothPolygon([P(3.6, -3.2), P(5.9, -2.5), P(6.1, -2.2), P(3.6, -1.9)], 1);
  p.wash(bill, c.bill, { rng, opacity: 0.9, edge: 0.4, deform: 0.03, spread: 0.02, layers: 4, blend: 'source-over' });
  // the eye: dark, a faint pale ring, a glint
  p.dab(P(1.9, -3.3), mix(c.head, c.white, 0.5), { rng, variant: 'round', angle: 0, length: 1.25 * U, width: 1.15 * U, opacity: 0.6, layers: 2, blend: 'source-over', edge: 0 });
  p.dab(P(1.9, -3.3), c.ink, { rng, variant: 'round', angle: 0, length: 0.85 * U, width: 0.85 * U, opacity: 0.95, layers: 3 });
  p.dab(P(2.1, -3.5), c.white, { rng, variant: 'round', angle: 0, length: 0.25 * U, width: 0.25 * U, opacity: 0.6, blend: 'source-over', layers: 2, edge: 0 });
  p.inkLine([P(3.6, -3.9), P(2.4, -5.2), P(0.2, -5.4)], { rng, width: 0.16 * U, opacity: 0.22, breaks: 0.6, pigment: c.ink, taper: [0.3, 0.5] });
}

/** The folded tail from its root, back and a little down: long, grey-brown, the outer feathers' white tips at the end. */
function paintTail(p: Painter, c: Colours): void {
  const rng = p.rng;
  const a = Math.PI - 0.12;
  const len = 12.6 * U;
  const ax = Math.cos(a);
  const ay = Math.sin(a);
  const at = (t: number, off: number): Pt => ({ x: ax * len * t - ay * off * U, y: ay * len * t + ax * off * U });
  const shape = smoothPolygon([at(0, -1.4), at(0.5, -1.5), at(0.97, -1.3), at(1, 0), at(0.97, 1.3), at(0.5, 1.5), at(0, 1.5)], 1);
  p.wetInWet(shape, c.tail, c.tailDark, { rng, angle: a, split: 0.55, softness: 0.4, fingers: 0.3, opacity: 0.9, edge: 0.4, edgeWidth: 0.4, deform: 0.05, granulation: 0.2, blend: 'source-over' });
  // the outer feather's white tip, seen from the side under the dark band
  const tip = smoothPolygon([at(0.8, 0.2), at(0.98, -0.2), at(1.0, 1.2), at(0.82, 1.5)], 1);
  p.wash(tip, c.white, { rng, opacity: 0.95, edge: 0, darken: 0, deform: 0.12, layers: 4, blend: 'source-over' });
  p.inkLine([at(0.15, -1.2), at(0.95, -1.0)], { rng, width: 0.16 * U, opacity: 0.25, breaks: 0.5, pigment: c.ink });
  // white undertail coverts at the root
  p.dab(at(0.08, 1.0), c.belly, { rng, variant: 'leaf', angle: a, length: 3.6 * U, width: 1.6 * U, opacity: 0.85, layers: 3, blend: 'source-over', edge: 0.1 });
}

/** The tail spread (landing, flight): grey-brown middle, the outer feathers black at the base with broad white corners. */
function paintFan(p: Painter, c: Colours): void {
  const rng = p.rng;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5;
    const outer = Math.abs(k) > 0.3;
    const a = Math.PI + k * 0.72;
    const len = (11.6 - Math.abs(k) * 1.2) * U;
    const wd = 2.6 * U;
    p.dab({ x: 0, y: 0 }, outer ? c.tailDark : c.tail, { rng, variant: 'blade', angle: a, length: len, width: wd, opacity: 0.85, layers: 3, pool: 0.5, edge: 0.4, blend: 'source-over' });
    if (outer) {
      const q = { x: Math.cos(a) * len * 0.83, y: Math.sin(a) * len * 0.83 };
      p.dab(q, c.white, { rng, variant: 'petal', angle: a, length: len * 0.3, width: wd * 1.1, opacity: 1, layers: 3, edge: 0, blend: 'source-over' });
    }
  }
  p.dab({ x: -1.4 * U, y: 0 }, c.back, { rng, variant: 'leaf', angle: Math.PI, length: 4.4 * U, width: 3.4 * U, opacity: 0.7, layers: 3 });
}

/** One leg, anchored at the hip, the foot at the bottom: short and pinkish red. */
function paintLeg(p: Painter, c: Colours): void {
  const rng = p.rng;
  p.inkLine([P(0, 0), P(0.15, HIP * 0.55), P(0.1, HIP)], { rng, width: 0.5 * U, opacity: 0.9, breaks: 0, pigment: c.leg, taper: [0.1, 0.1] });
  p.inkLine([P(-0.9, HIP), P(1.7, HIP + 0.05)], { rng, width: 0.32 * U, opacity: 0.85, breaks: 0, pigment: mix(c.leg, c.ink, 0.25), taper: [0.2, 0.4] });
}

function paintFlyBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  const body = smoothPolygon(FLY_BODY, 2);
  p.wetInWet(body, c.back, c.breast, { rng, angle: Math.PI / 2 - 0.2, split: 0.45, softness: 0.5, fingers: 0.4, opacity: 0.92, edge: 0.4, edgeWidth: 0.5, deform: 0.1, granulation: 0.15, blend: 'source-over' });
  const belly = smoothPolygon([P(5.0, 1.6), P(1.0, 2.6), P(-4.0, 1.8), P(-6.8, 0.4), P(-3.0, 0.4), P(2.4, 0.4)], 1);
  p.glaze(belly, c.belly, { rng, opacity: 0.8, edge: 0, darken: 0, deform: 0.2, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.3, ragged: 0.8 } });
  const patch = smoothPolygon([P(7.4, -0.8), P(6.4, -2.4), P(5.0, -2.0), P(5.0, 0.2), P(6.6, 0.6)], 1);
  p.wash(patch, c.cinnamon, { rng, opacity: 0.55, edge: 0.3, deform: 0.25, layers: 3 });
  for (let i = 0; i < 6; i++) p.dab(P(5.2 + rng.range(0, 2), rng.range(-1.8, 0)), c.spot, { rng, variant: 'round', angle: 0, length: 0.6 * U, width: 0.45 * U, opacity: 0.7, layers: 2 });
  feathers(p, rng, smoothPolygon([P(5.4, -2.4), P(-5.6, -2.4), P(-4.0, -0.6), P(4.6, -0.8)], 1), { n: 10, size: 1.4 * U, angle: Math.PI, pigments: [c.back, mix(c.back, c.ink, 0.2)], opacity: [0.2, 0.4] });
  p.glaze(body, c.shade, { rng, opacity: 0.2, edge: 0, darken: 0, deform: 0.08, fade: { angle: -Math.PI / 2, start: 0.3 } });
}

/** One wing raised from the shoulder: rufous inner wing, the blue-grey panel, long dark primaries. */
function paintWing(p: Painter, c: Colours): void {
  const rng = p.rng;
  // the primaries and secondaries as a fan of long feathers, the outermost last so it lies on top
  for (let k = 7; k >= 0; k--) {
    const t = k / 7;
    const at = P(lerp(0.4, -6.8, t), lerp(-3.6, -1.0, t));
    const a = -Math.PI / 2 - lerp(0.12, 1.0, t) + rng.range(-0.04, 0.04);
    const len = lerp(13.6, 7.4, t) * U;
    const wd = lerp(2.3, 3.0, t) * U;
    const pig = t < 0.45 ? mix(c.primary, c.panel, t) : mix(c.panel, c.back, (t - 0.45) * 1.2);
    p.dab(at, pig, { rng, variant: 'petal', angle: a, length: len, width: wd, curve: -0.08, opacity: 0.86, layers: 3, pool: 0.55, edge: 0.45, granulation: 0.2, blend: 'source-over' });
  }
  // the coverts: the blue-grey panel, rufous toward the body
  const coverts = smoothPolygon([P(1.8, 0.8), P(2.0, -4.2), P(0.2, -7.6), P(-3.2, -7.4), P(-7.0, -4.4), P(-7.2, 0.8)], 1);
  p.wetInWet(coverts, c.panel, c.back, { rng, angle: Math.PI - 0.3, split: 0.55, softness: 0.5, fingers: 0.5, opacity: 0.9, edge: 0.4, edgeWidth: 0.45, deform: 0.12, granulation: 0.25, blend: 'source-over' });
  feathers(p, rng, coverts, { n: 12, size: 1.5 * U, angle: Math.PI / 2, pigments: [c.panel, mix(c.panel, c.ink, 0.2), c.back], opacity: [0.2, 0.42] });
  p.inkLine([P(1.8, -2), P(0.4, -9), P(-1.6, -15)], { rng, width: 0.18 * U, opacity: 0.25, breaks: 0.5, pigment: c.ink, taper: [0.2, 0.6] });
}

export interface DoveParts {
  body: Sprite; // standing body and folded wing, anchored at the hip
  head: Sprite; // anchored at the neck
  tail: Sprite; // folded, anchored at its root
  fan: Sprite; // spread, anchored at its root
  leg: Sprite; // anchored at the hip
  flyBody: Sprite; // level, anchored at the body centre
  wing: Sprite; // one raised wing, anchored at the shoulder
}

export function paintDove(res: number, seed: number): DoveParts {
  const c = colours();
  return {
    body: paintSprite(res, { w: 21 * U, h: 13 * U, ox: 11.4 * U, oy: 10.6 * U }, seed, (p) => paintBody(p, c)),
    head: paintSprite(res, { w: 9.6 * U, h: 10.6 * U, ox: 2.6 * U, oy: 6.4 * U }, seed + 1, (p) => paintHead(p, c)),
    tail: paintSprite(res, { w: 14.4 * U, h: 6.4 * U, ox: 13.4 * U, oy: 2.6 * U }, seed + 2, (p) => paintTail(p, c)),
    fan: paintSprite(res, { w: 13.6 * U, h: 12 * U, ox: 12.8 * U, oy: 6 * U }, seed + 3, (p) => paintFan(p, c)),
    leg: paintSprite(res, { w: 4 * U, h: 4.6 * U, ox: 1.6 * U, oy: 0.6 * U }, seed + 4, (p) => paintLeg(p, c)),
    flyBody: paintSprite(res, { w: 17.6 * U, h: 8.6 * U, ox: 8.8 * U, oy: 4.4 * U }, seed + 5, (p) => paintFlyBody(p, c)),
    wing: paintSprite(res, { w: 13.4 * U, h: 18.6 * U, ox: 10.6 * U, oy: 17.4 * U }, seed + 6, (p) => paintWing(p, c)),
  };
}

// ---------------------------------------------------------------------------------------------
// drawing (pure: the studio draws poses with it)

export interface DovePose {
  fly: boolean;
  /** body rotation, + leans forward (nose down) */
  pitch: number;
  /** hip lowered (units) */
  crouch: number;
  /** head offset from its neck anchor and its rotation (+ bill down) */
  headX: number;
  headY: number;
  headRot: number;
  /** tail rotation from its rest (− raised) and how far it is spread (0 folded … 1 fanned) */
  tail: number;
  fan: number;
  /** leg swing (rad) and foot lift (0..1), near and far */
  legNear: number;
  legFar: number;
  liftNear: number;
  liftFar: number;
  /** in flight: the wing's height through the beat (1 up … −1 down) and the legs let down to land (0..1) */
  wing: number;
  legsDown: number;
}

export const REST_POSE: DovePose = { fly: false, pitch: -0.12, crouch: 0, headX: 0, headY: 0, headRot: 0, tail: 0, fan: 0, legNear: 0.08, legFar: -0.1, liftNear: 0, liftFar: 0, wing: 0, legsDown: 0 };

const img = (ctx: Ctx, s: Sprite, alpha = 1) => {
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  if (alpha < 1) ctx.globalAlpha /= alpha;
};

function drawLeg(ctx: Ctx, parts: DoveParts, at: Pt, swing: number, lift: number, alpha = 1): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-swing);
  ctx.scale(1, 1 - 0.25 * lift);
  img(ctx, parts.leg, alpha);
  ctx.restore();
}

/** The dove at the origin (feet, or the body centre in flight), facing +x, in world units at perspective 1. */
export function drawDove(ctx: Ctx, parts: DoveParts, q: DovePose): void {
  if (q.fly) {
    drawFlying(ctx, parts, q);
    return;
  }
  const hipY = -(HIP - q.crouch * U);
  drawLeg(ctx, parts, { x: -0.6 * U, y: hipY }, q.legFar, q.liftFar, 0.8);
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(q.pitch);
  // head first: the body's breast hides the neck's root
  ctx.save();
  ctx.translate(NECK.x + q.headX * U, NECK.y + q.headY * U);
  ctx.rotate(q.headRot - q.pitch * 0.6);
  img(ctx, parts.head);
  ctx.restore();
  ctx.save();
  ctx.translate(TAIL_ROOT.x, TAIL_ROOT.y);
  ctx.rotate(q.tail - q.pitch * 0.5);
  if (q.fan > 0.05) {
    ctx.scale(1, lerp(0.35, 1, q.fan));
    img(ctx, parts.fan);
  } else img(ctx, parts.tail);
  ctx.restore();
  img(ctx, parts.body);
  ctx.restore();
  drawLeg(ctx, parts, { x: 0.6 * U, y: hipY }, q.legNear, q.liftNear);
}

function drawFlying(ctx: Ctx, parts: DoveParts, q: DovePose): void {
  ctx.save();
  ctx.rotate(q.pitch);
  const wing = (alpha: number, dx: number) => {
    ctx.save();
    ctx.translate(SHOULDER.x + dx, SHOULDER.y);
    // through the beat the wing foreshortens through edge-on; at the top of a clatter it claps over the back
    ctx.rotate(q.wing > 0.9 ? -(q.wing - 0.9) * 1.5 : 0);
    ctx.scale(1, clamp(q.wing, -1, 1) || 0.04);
    img(ctx, parts.wing, alpha);
    ctx.restore();
  };
  wing(0.62, 1.4 * U);
  if (q.legsDown > 0.05) {
    for (const dx of [-0.8, 0.4]) drawLeg(ctx, parts, P(dx, 1.6), -0.5 * q.legsDown - 0.8 * (1 - q.legsDown), 0.4, q.legsDown);
  }
  ctx.save();
  ctx.translate(FLY_TAIL.x, FLY_TAIL.y);
  ctx.rotate(q.tail);
  ctx.scale(1, lerp(0.3, 1, q.fan));
  img(ctx, parts.fan);
  ctx.restore();
  ctx.save();
  ctx.translate(FLY_NECK.x + q.headX * U, FLY_NECK.y + q.headY * U);
  ctx.rotate(1.05 + q.headRot);
  img(ctx, parts.head);
  ctx.restore();
  img(ctx, parts.flyBody);
  wing(1, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

export type PlaceKind = 'frond' | 'wall' | 'rim' | 'ground';

/** Where a dove (or a pair) settles: a stretch of perch or a point inside a plot. */
export interface Place {
  kind: PlaceKind;
  perch: Perch | null;
  ground: GroundSpot | null;
  x: number;
  y: number;
  /** drawn at (the perch's own scale on a palm crown, else the ground's) */
  scale: number;
  depth: number;
  drink: boolean;
}

const DOVE_PERCHES: readonly Perch['kind'][] = ['frond', 'wall', 'rim'];

/** The perches doves take: palm fronds, wall copings and the basin's coping. */
export function dovePerches(w: Pick<FaunaWorld, 'perches'>): Perch[] {
  return w.perches.filter((p) => DOVE_PERCHES.includes(p.kind));
}

/** Rim perches where it can drink: near level, the basin's water close in front. */
export function drinkPerches(w: Pick<FaunaWorld, 'perches' | 'pond'>): Perch[] {
  const pond = w.pond.world;
  if (pond.length < 3) return [];
  return w.perches.filter((p) => p.kind === 'rim' && Math.abs(p.slope ?? 0) < 0.3 && closestOnPolygon(p, pond).d < 12);
}

/** Along a perch, carried on past its spread along its slope (a pair on a narrow frond). */
export function alongPerch(p: Perch, x: number): number {
  const over = Math.abs(x - p.x) - p.spread;
  return perchY(p, x) + (over > 0 ? (p.slope ?? 0) * over * Math.sign(x - p.x) : 0);
}

export function perchScale(w: Pick<FaunaWorld, 'perspective'>, p: Perch): number {
  return p.scale ?? w.perspective(p.depth, p.x);
}

const inView = (v: Rect, q: Pt, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

function free(q: Pt, taken: readonly Pt[], gap = DOVE_TUNING.clear): boolean {
  return taken.every((t) => dist(t, q) >= gap);
}

/** A point inside a plot's ellipse (`r` of its radii), clear of `taken`. */
export function groundPoint(g: GroundSpot, rng: Rng, taken: readonly Pt[] = [], r = 0.7): Pt | null {
  for (let i = 0; i < 24; i++) {
    const a = rng.range(0, TAU);
    const d = Math.sqrt(rng.next()) * r;
    const q = { x: g.x + Math.cos(a) * g.rx * d, y: g.y + Math.sin(a) * g.ry * d };
    if (free(q, taken, 20)) return q;
  }
  return null;
}

export const inEllipse = (g: GroundSpot, q: Pt, k = 1) => ((q.x - g.x) / g.rx) ** 2 + ((q.y - g.y) / g.ry) ** 2 <= k * k;

function perchPlace(w: Pick<FaunaWorld, 'perspective' | 'perches' | 'pond'>, p: Perch, x: number, drink: boolean): Place {
  return { kind: p.kind as PlaceKind, perch: p, ground: null, x, y: alongPerch(p, x), scale: perchScale(w, p), depth: p.depth + 0.5, drink };
}

function groundPlace(w: Pick<FaunaWorld, 'perspective'>, g: GroundSpot, q: Pt): Place {
  return { kind: 'ground', perch: null, ground: g, x: q.x, y: q.y, scale: w.perspective(q.y, q.x), depth: q.y + 0.5, drink: false };
}

type PlaceWorld = Pick<FaunaWorld, 'perches' | 'ground' | 'pond' | 'view' | 'perspective'>;

/**
 * Somewhere to go: a free frond, wall top, drinking rim or plot, weighted by kind; in view when
 * one is (a phone shows only the basin), never where another creature is or is making for.
 */
export function choosePlace(w: PlaceWorld, rng: Rng, taken: readonly Pt[], o: { pair?: boolean; not?: Place | null; kinds?: readonly PlaceKind[] } = {}): Place | null {
  const v = w.view;
  const drinks = new Set(drinkPerches(w));
  const kinds = o.kinds ?? (['frond', 'wall', 'rim', 'ground'] as const);
  const options: { kind: PlaceKind; perch?: Perch; ground?: GroundSpot; seen: boolean }[] = [];
  for (const p of dovePerches(w)) {
    if (p.kind === 'rim' && !drinks.has(p)) continue;
    if (!kinds.includes(p.kind as PlaceKind) || p === o.not?.perch || !free(p, taken)) continue;
    options.push({ kind: p.kind as PlaceKind, perch: p, seen: inView(v, p, 30) });
  }
  if (kinds.includes('ground')) {
    for (const g of w.ground) if (g !== o.not?.ground) options.push({ kind: 'ground', ground: g, seen: inView(v, g, 20) });
  }
  const seen = options.filter((c) => c.seen);
  const pool = seen.length > 0 ? seen : options;
  // each kind's weight is shared among its options, so ten fronds don't crowd out one plot
  const count = (k: PlaceKind) => pool.filter((c) => c.kind === k).length;
  for (let tries = 0; tries < 6 && pool.length > 0; tries++) {
    let r = rng.next() * pool.reduce((s, c) => s + DOVE_TUNING.weights[c.kind] / count(c.kind), 0);
    let pick = pool[pool.length - 1]!;
    for (const c of pool) {
      r -= DOVE_TUNING.weights[c.kind] / count(c.kind);
      if (r < 0) {
        pick = c;
        break;
      }
    }
    if (pick.perch) {
      const p = pick.perch;
      const s = perchScale(w, p);
      const half = o.pair ? (DOVE_TUNING.pair * s) / 2 : 0;
      const room = Math.max(0, p.spread - half);
      return perchPlace(w, p, p.x + rng.range(-room, room) * 0.8, pick.kind === 'rim');
    }
    const q = groundPoint(pick.ground!, rng, taken, 0.6);
    if (q) return groundPlace(w, pick.ground!, q);
    pool.splice(pool.indexOf(pick), 1);
  }
  return null;
}

/** The mate's place beside the leader's: along the same perch, or a step away on the same plot. */
export function besidePlace(w: Pick<FaunaWorld, 'perspective' | 'perches' | 'pond'>, lead: Place, side: number, rng: Rng): Place {
  const gap = DOVE_TUNING.pair * lead.scale;
  if (lead.perch) return perchPlace(w, lead.perch, lead.x + side * gap, lead.drink);
  const g = lead.ground!;
  for (let i = 0; i < 12; i++) {
    const q = { x: lead.x + side * gap * rng.range(0.8, 1.6), y: lead.y + rng.range(-0.4, 0.4) * g.ry };
    if (inEllipse(g, q, 0.85)) return groundPlace(w, g, q);
  }
  return groundPlace(w, g, { x: lerp(lead.x, g.x, 0.3), y: lerp(lead.y, g.y, 0.3) });
}

// ---------------------------------------------------------------------------------------------

interface Flight {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  len: number;
  u: number;
  s0: number;
  s1: number;
  /** seconds in the air; a take-off from a spot clatters first */
  t: number;
  clatter: boolean;
}

type Act = 'rest' | 'bow' | 'shuffle' | 'step' | 'peck' | 'look' | 'drink';

export class Dove extends BaseCreature {
  readonly kind = 'dove' as const;
  readonly visitor = true;
  place: Place | null = null;
  mate: Dove | null = null;
  lead = true;
  /** bouts of bowing, drinks, take-offs (tests) */
  bows = 0;
  drinks = 0;
  clatters = 0;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private flight: Flight | null = null;
  private next: Place | null = null;
  private spellFor = 0;
  private act: Act = 'rest';
  private actT = 0;
  private actFor = 1;
  private age = 0;
  private flap = 0;
  private pitch = 0;
  private walkTo: Pt | null = null;
  private walkPh = 0;
  private bowsLeft = 0;
  private headTurn = 0;
  private cue = -1;
  private drinkRing = 0;
  private first = true;
  private leaveIn = -1;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    readonly stay: number,
    to: Place,
    delay = 0,
  ) {
    super();
    const side = rng.chance(0.5) ? -1 : 1;
    const start = entryPoint(w.view, rng, 0.04, 0.3, side);
    // a follower comes in a little behind its mate
    this.pos = { x: start.x + side * delay * 60, y: start.y + rng.range(-10, 10) };
    this.scale = to.scale;
    this.flyTo(to, false, 'arrive');
    this.sync();
  }

  /** Where it sits or is making for (so others keep off its perch). */
  spot(): Pt | null {
    const p = this.next ?? this.place;
    if (!p || this.state === 'depart') return null;
    return { x: p.x, y: p.y };
  }

  private flyTo(to: Place | null, clatter: boolean, state: string, exit?: Pt): void {
    const from = { ...this.pos };
    const end = to ? { x: to.x, y: to.y } : exit!;
    const dx = end.x - from.x;
    const s0 = this.scale;
    const s1 = to ? to.scale : this.scale;
    const climb = clatter ? this.rng.range(28, 46) * Math.max(0.6, s0) : this.rng.range(0, 20);
    const p1 = { x: from.x + dx * 0.18, y: from.y - climb };
    const p2 = to ? { x: end.x - dx * 0.28, y: Math.min(end.y, from.y) - this.rng.range(24, 44) * Math.max(0.6, s1) } : { x: from.x + dx * 0.7, y: Math.min(from.y, end.y) - 20 };
    const f: Flight = { p0: from, p1, p2, p3: { ...end }, len: 0, u: 0, s0, s1, t: 0, clatter };
    f.len = Math.max(1, cubicLength(f.p0, f.p1, f.p2, f.p3));
    this.flight = f;
    this.next = to;
    if (to) this.place = null;
    if (Math.abs(dx) > 2) this.facing = Math.sign(dx);
    this.layer = 'air';
    if (clatter) this.clatters++;
    this.go(clatter ? 'clatter' : state);
    this.flightState = state;
  }

  private flightState = 'arrive';

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.tick(dt, w);
    this.timer += dt;
    this.age += dt;
    if (this.age > this.stay) this.leaving = true;
    if (this.mate?.done) this.mate = null;
    if (!this.mate) this.lead = true;
    if (this.flight) this.flyStep(dt, w);
    else this.groundStep(dt, w);
    this.sync();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const f = this.flight!;
    const sf = w.speed;
    f.t += dt * sf;
    const left = f.len * (1 - f.u);
    const landing = this.next !== null;
    // a clattering climb, an even pace, a long braking glide into the landing
    const kick = f.clatter ? lerp(0.55, 1, clamp(f.t / DOVE_TUNING.clatter, 0, 1)) : 1;
    const brake = landing ? clamp(left / (60 * Math.max(0.6, f.s1)), 0.28, 1) : 1;
    const s = lerp(f.s0, f.s1, easeInOut(f.u));
    f.u = Math.min(1, f.u + (DOVE_TUNING.flight * sf * kick * brake * Math.max(0.5, s) * dt) / f.len);
    const q = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
    const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
    this.pos = q;
    this.scale = s;
    if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
    const climb = clamp(Math.atan2(tg.y, Math.abs(tg.x)), -0.6, 0.6);
    const flare = landing ? clamp(1 - left / (26 * Math.max(0.6, f.s1)), 0, 1) : 0;
    this.pitch = approach(this.pitch, climb * 0.7 - flare * 0.7, 5, dt);
    // wingbeats: quick and deep in the clatter, then bursts between glides, fluttering to land
    const rate = this.state === 'clatter' ? 8.5 : flare > 0 ? 6.5 : 4.6;
    this.flap += dt * sf * rate;
    if (this.state === 'clatter' && f.t > DOVE_TUNING.clatter) this.go(this.flightState);
    if (!landing && isOffscreen(this.pos, w.view, 30)) {
      this.done = true;
      return;
    }
    if (f.u < 1) return;
    this.flight = null;
    if (!landing) {
      this.done = true;
      return;
    }
    this.land(w);
  }

  private land(w: FaunaWorld): void {
    const p = this.next!;
    this.place = p;
    this.next = null;
    this.pos = { x: p.x, y: p.y };
    this.scale = p.scale;
    this.pitch = 0;
    this.layer = 'entities';
    const sf = w.speed;
    const span = this.first ? DOVE_TUNING.firstSpell : DOVE_TUNING.spell;
    this.first = false;
    this.spellFor = rangeOf(this.rng, [...span]) / sf;
    // a pair sits facing the same way, or now and then toward each other
    if (this.mate && !this.lead && this.mate.place && this.rng.chance(0.75)) this.facing = this.mate.facing;
    this.go(p.kind === 'ground' ? 'walk' : 'perch');
    this.setAct(p.drink ? 'look' : 'rest', this.rng.range(0.6, 1.6) / sf);
  }

  private setAct(a: Act, t: number): void {
    this.act = a;
    this.actT = 0;
    this.actFor = t;
  }

  private groundStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const rng = this.rng;
    const p = this.place!;
    this.actT += dt;
    if (this.leaveIn >= 0) {
      this.leaveIn -= dt;
      if (this.leaveIn < 0) this.depart(w);
      return;
    }
    if (this.cue >= 0) {
      // the mate bowed: bow back a moment later
      this.cue -= dt;
      if (this.cue < 0 && this.act === 'rest') this.startBows(rng.int(1, 3), sf);
    }
    this.headTurn = approach(this.headTurn, Math.sin(w.t * 0.37 + this.id) * 0.12, 1, dt);
    if (this.act === 'step' && this.walkTo) {
      const v = DOVE_TUNING.walk * sf * p.scale;
      const d = dist(this.pos, this.walkTo);
      const k = Math.min(1, (v * dt) / Math.max(1e-6, d));
      this.pos = { x: lerp(this.pos.x, this.walkTo.x, k), y: lerp(this.pos.y, this.walkTo.y, k) };
      this.walkPh += (v * dt) / (DOVE_TUNING.stride * p.scale);
      if (p.ground) this.place = { ...p, x: this.pos.x, y: this.pos.y, depth: this.pos.y + 0.5, scale: w.perspective(this.pos.y, this.pos.x) };
      this.scale = this.place!.scale;
      if (d < 0.3) this.endAct(w);
      return;
    }
    if (this.act === 'drink') {
      this.drinkRing -= dt * sf;
      if (this.drinkRing <= 0 && this.actT > 0.5 / sf && this.actT < this.actFor - 0.5 / sf) {
        const at = this.billWater(w);
        if (at) w.ripple(at.x, at.y, 7 * this.scale, 0.3);
        this.drinkRing = rng.range(1.4, 2.4);
      }
    }
    if (this.actT >= this.actFor) this.endAct(w);
  }

  /** Where the bill meets the water while it drinks, if the water is there. */
  billWater(w: Pick<FaunaWorld, 'pond'>): Pt | null {
    const bill = { x: this.pos.x + this.facing * 10 * this.scale, y: this.pos.y };
    const c = closestOnPolygon(bill, w.pond.world);
    if (c.d > 10) return null;
    const ctr = w.pond.centre;
    const k = 3 / Math.max(1, dist(c.pt, ctr));
    return { x: c.pt.x + (ctr.x - c.pt.x) * k, y: c.pt.y + (ctr.y - c.pt.y) * k };
  }

  private startBows(n: number, sf: number): void {
    this.bowsLeft = n;
    this.bows++;
    this.setAct('bow', 1.15 / sf);
    if (this.mate && !this.mate.flight && this.mate.place?.perch === this.place?.perch && this.rng.chance(0.6)) this.mate.cue = this.rng.range(0.4, 1.2);
  }

  /** What next: on a perch rest, bow and coo, shuffle; on a plot walk with nodding steps and peck; at the rim drink. */
  private endAct(w: FaunaWorld): void {
    const rng = this.rng;
    const sf = w.speed;
    const p = this.place!;
    if (this.act === 'bow' && --this.bowsLeft > 0) {
      this.setAct('bow', 1.15 / sf);
      return;
    }
    if (this.act === 'drink') this.drinks++;
    if (this.leaving && this.lead) {
      this.depart(w);
      return;
    }
    if (this.lead && this.timer > this.spellFor && this.act !== 'drink') {
      this.move(w);
      return;
    }
    if (p.drink && this.act === 'look' && this.drinks === 0) {
      this.setAct('drink', rangeOf(rng, [...DOVE_TUNING.drink]) / sf);
      this.drinkRing = 0;
      return;
    }
    if (p.kind === 'ground') {
      const r = rng.next();
      if (r < 0.5) {
        const g = p.ground!;
        const to = { x: this.pos.x + rng.range(4, 16) * p.scale * (rng.chance(0.7) ? this.facing : -this.facing), y: this.pos.y + rng.range(-0.3, 0.3) * g.ry };
        if (inEllipse(g, to, 0.85)) {
          this.walkTo = to;
          if (Math.abs(to.x - this.pos.x) > 0.5) this.facing = Math.sign(to.x - this.pos.x);
          this.setAct('step', 99);
          return;
        }
        this.facing = Math.sign(g.x - this.pos.x) || this.facing;
      }
      if (r < 0.8) this.setAct('peck', rng.int(1, 3) * 0.42 / sf);
      else this.setAct('look', rng.range(0.8, 2.4) / sf);
      return;
    }
    const r = rng.next();
    if (r < 0.22 && p.kind !== 'rim') this.startBows(rng.int(2, 4), sf);
    else if (r < 0.34 && p.perch && p.perch.spread > 4) {
      const to = clamp(this.pos.x + rng.range(-1, 1) * 5 * p.scale, p.perch.x - p.perch.spread, p.perch.x + p.perch.spread);
      if (!this.mate?.place || Math.abs(to - this.mate.pos.x) > DOVE_TUNING.pair * p.scale * 0.7) {
        this.walkTo = { x: to, y: alongPerch(p.perch, to) };
        this.setAct('step', 99);
      } else this.setAct('rest', rng.range(1, 3) / sf);
    } else if (r < 0.42) {
      this.facing = -this.facing;
      this.setAct('rest', rng.range(1.2, 3) / sf);
    } else this.setAct('rest', rng.range(1.5, 5) / sf);
  }

  /** The leader picks the next place; the mate follows a moment later and lands beside it. */
  private move(w: FaunaWorld): void {
    const taken = this.taken(w);
    const to = choosePlace(w, this.rng, taken, { pair: !!this.mate, not: this.place });
    if (!to) {
      this.timer = 0;
      this.spellFor = rangeOf(this.rng, [...DOVE_TUNING.spell]) / w.speed;
      this.setAct('rest', 1);
      return;
    }
    const side = this.rng.chance(0.5) ? -1 : 1;
    const half = to.perch ? (DOVE_TUNING.pair * to.scale) / 2 : 0;
    const mine = this.mate && to.perch ? perchPlace(w, to.perch, to.x - side * half, to.drink) : to;
    this.flyTo(mine, true, 'fly');
    const m = this.mate;
    if (m && m.place) m.follow(besidePlace(w, mine, side, this.rng), this.rng.range(0.3, 0.9) / w.speed);
  }

  private pending: { to: Place | null; t: number } | null = null;

  /** Told by the leader: take off after `delay` s to `to` (null: away). */
  follow(to: Place | null, delay: number): void {
    this.pending = { to, t: delay };
    this.next = to;
  }

  private taken(w: FaunaWorld): Pt[] {
    const mine = new Set([this.spot() && `${this.spot()!.x},${this.spot()!.y}`, this.mate?.spot() && `${this.mate.spot()!.x},${this.mate.spot()!.y}`]);
    return heldSpots(w).filter((q) => !mine.has(`${q.x},${q.y}`));
  }

  private depart(w: FaunaWorld): void {
    const to = exitPoint(w.view, this.pos, this.rng, 160, this.rng.chance(0.5) ? -1 : 1);
    this.place = null;
    this.flyTo(null, true, 'depart', to);
    const m = this.mate;
    if (m && m.place && !m.leaving) {
      m.leaving = true;
      m.leaveIn = this.rng.range(0.3, 1) / w.speed;
    }
  }

  override leave(): void {
    this.leaving = true;
  }

  /** A follower's delayed take-off. */
  private tick(dt: number, w: FaunaWorld): void {
    if (this.pending && !this.flight) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) {
        const to = this.pending.to;
        this.pending = null;
        if (to) this.flyTo(to, true, 'fly');
        else this.depart(w);
      }
    }
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    return !this.flight && this.place ? this.place.depth : null;
  }

  /** The pose for now (pure of the update: reads the state only). */
  pose(t: number): DovePose {
    const q: DovePose = { ...REST_POSE };
    if (this.flight) {
      const f = this.flight;
      const landing = this.next !== null;
      const left = f.len * (1 - f.u);
      const flare = landing ? clamp(1 - left / (26 * Math.max(0.6, f.s1)), 0, 1) : 0;
      q.fly = true;
      q.pitch = this.pitch;
      const ph = Math.cos(this.flap * TAU);
      if (this.state === 'clatter') {
        // deep, loud beats: high over the back and well down
        q.wing = 0.15 + 1.0 * ph;
        q.fan = 0.75;
        q.tail = -0.1;
      } else if (flare > 0) {
        q.wing = 0.25 + 0.75 * ph;
        q.fan = 0.5 + 0.5 * flare;
        q.tail = -0.25 * flare;
        q.legsDown = flare;
        q.headRot = -0.5 * flare;
      } else {
        // bursts of beats, then a glide on bowed wings
        const burst = Math.sin(this.flap * 0.7 + this.id) > -0.2 || (landing && f.u > 0.55);
        const glide = landing && f.u > 0.55 ? 1 : burst ? 0 : 1;
        q.wing = glide ? -0.22 + 0.04 * Math.sin(t * 3) : 0.2 + 0.8 * ph;
        q.fan = glide ? 0.35 : 0.2;
      }
      return q;
    }
    const p = this.place;
    q.headRot = this.headTurn;
    if (p?.kind === 'ground' || this.act === 'step') {
      q.pitch = 0.1;
      q.tail = 0.05;
    }
    const k = clamp(this.actT / Math.max(1e-6, this.actFor), 0, 1);
    switch (this.act) {
      case 'step': {
        // the nodding walk: the head thrusts forward, then holds still while the body catches up
        const s = this.walkPh % 1;
        const thrust = s < 0.3 ? easeInOut(s / 0.3) : 1 - (s - 0.3) / 0.7;
        q.headX = 1.3 * thrust - 0.4;
        q.headY = 0.3 * Math.sin(s * TAU);
        const sw = Math.sin(this.walkPh * Math.PI);
        q.legNear = 0.42 * sw;
        q.legFar = -0.42 * sw;
        q.liftNear = Math.max(0, sw);
        q.liftFar = Math.max(0, -sw);
        q.tail = 0.05 + 0.04 * Math.sin(this.walkPh * TAU);
        break;
      }
      case 'peck': {
        const s = (this.actT * 2.4) % 1;
        const d = Math.sin(s * Math.PI);
        q.pitch = 0.1 + 0.45 * d;
        q.headRot = 1.1 * d;
        q.headX = 0.6 * d;
        q.headY = 1.4 * d;
        q.tail = -0.25 * d;
        break;
      }
      case 'bow': {
        // the bow-and-coo: the breast dips, the head goes down, the tail lifts
        const d = Math.sin(k * Math.PI) ** 2;
        q.pitch = -0.12 + 0.55 * d;
        q.headRot = 0.75 * d;
        q.headY = 1.0 * d;
        q.tail = -0.4 * d;
        q.crouch = 0.4 * d;
        break;
      }
      case 'drink': {
        // down to the water, and held there: it sucks up water without lifting its head
        const down = Math.min(easeInOut(this.actT / 0.6), easeInOut((this.actFor - this.actT) / 0.6));
        const sip = Math.sin(this.actT * 7) * 0.12 * down;
        q.pitch = -0.12 + 0.85 * down;
        q.crouch = 1.0 * down;
        q.headRot = 1.25 * down + sip * 0.3;
        q.headX = 1.6 * down;
        q.headY = (2.6 + sip) * down;
        q.tail = -0.45 * down;
        q.legNear = 0.25 * down;
        q.legFar = -0.05;
        break;
      }
      case 'look':
        q.headRot = this.headTurn + 0.25 * Math.sin(this.actT * 2);
        break;
      default:
        break;
    }
    return q;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const grounded = !this.flight;
    if ((grounded && layer !== 'entities') || (!grounded && layer !== 'air')) return;
    const parts = w.art.get('dove', (res) => paintDove(res, 2900));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * this.facing, this.scale);
    drawDove(ctx, parts, this.pose(w.t));
    ctx.restore();
  }
}

const dove: CreatureDef = {
  kind: 'dove',
  title: 'laughing dove',
  role: 'visitor',
  visit: { gap: [150, 340], first: [30, 90], stay: [90, 170], group: [1, 2], max: 2, diurnal: true, visitor: true },
  needs: (w) => w.perches.some((p) => p.kind === 'frond') || w.ground.length > 0,
  spawn(w, s) {
    if (!dove.needs!(w)) return [];
    const rng = w.rng.fork(`dove:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const n = Math.min(2, Math.max(1, s.count));
    const to = choosePlace(w, rng, heldSpots(w), { pair: n > 1, kinds: ['frond', 'wall', 'rim', 'ground'] });
    if (!to) return [];
    const stay = (s.stay || 120) * rng.range(0.9, 1.1);
    const side = rng.chance(0.5) ? -1 : 1;
    const half = n > 1 && to.perch ? (DOVE_TUNING.pair * to.scale) / 2 : 0;
    const first = to.perch ? perchPlace(w, to.perch, to.x - side * half, to.drink) : to;
    const a = new Dove(w, rng.fork('a'), stay, first);
    if (n === 1) return [a];
    const brng = rng.fork('b');
    const b = new Dove(w, brng, stay + 5, besidePlace(w, first, side, brng), brng.range(0.4, 1));
    a.mate = b;
    b.mate = a;
    b.lead = false;
    return [a, b];
  },
  sheet: {
    w: 760,
    h: 170,
    make(res, seed) {
      const a = paintDove(res, seed);
      return [a.body, a.head, a.tail, a.fan, a.leg, a.flyBody, a.wing];
    },
  },
  show: { stage: 'oasis', spec: { x: 520, y: 30, w: 880, h: 880 }, w: 620, h: 620, group: 2, order: 40 },
};
export default dove;
