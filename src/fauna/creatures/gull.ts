/** Yellow-legged gull (Larus michahellis): the coast's harbour gull on the caique, a splash rock and the temple. Side view, facing right.
 * docs/devlog/189-yellow-legged-gull.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { approach, clamp, cubic, cubicLength, cubicTangent, dist, distanceToPolygon, easeInOut, isOffscreen, lerp, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { carried, inRegion, perchY, type Perch, type Region } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import type { CreatureDef } from './lib/def';
import { entryPoint, exitPoint } from './lib/flight';

/** Bill tip to tail tip at perspective 1 (world units): about 58 cm. */
export const GULL_LEN = 70;
const U = GULL_LEN / 56;

export const GULL_TUNING = {
  /** world units / s at perspective 1 */
  flight: 92,
  /** wingbeats a second: slow and deep */
  beat: 2.3,
  /** seconds on one place before moving on; the first spell is longer */
  spell: [45, 110] as const,
  firstSpell: [70, 150] as const,
  /** seconds afloat */
  float: [35, 85] as const,
  /** seconds of pattering over the water before it lifts */
  patter: 1.1,
  /** where it goes next */
  weights: { boat: 0.34, rock: 0.2, ruin: 0.2, float: 0.26 },
  /** a flight that first circles over the cove on set wings */
  soar: 0.35,
  /** keeps this far (× its scale, plus 12) from what others hold */
  clear: 30,
  /** floats this far from every planting slot, the heron's stands and any heron */
  slotGap: 58,
  heronGap: 110,
};

// ---------------------------------------------------------------------------------------------
// art

interface Colours {
  white: Pigment;
  shade: Pigment;
  warm: Pigment;
  mantle: Pigment;
  mantleDeep: Pigment;
  black: Pigment;
  bill: Pigment;
  billTip: Pigment;
  red: Pigment;
  leg: Pigment;
  iris: Pigment;
  ink: Pigment;
}

function colours(): Colours {
  return {
    white: '#fbf8f2',
    shade: mix(PIGMENTS.shadow, '#9fb0c4', 0.45),
    warm: '#efe2c8',
    mantle: '#a9b0b4',
    mantleDeep: mix('#a9b0b4', '#6f7a86', 0.45),
    black: mix(PIGMENTS.sumi, '#24262c', 0.55),
    bill: '#e2bf3e',
    billTip: mix('#e2bf3e', '#f2e3a0', 0.4),
    red: '#cf4a2c',
    leg: '#d9b840',
    iris: '#f0e3a2',
    ink: PIGMENTS.sumi,
  };
}

const P = (x: number, y: number): Pt => ({ x: x * U, y: y * U });
const pts = (a: readonly (readonly [number, number])[]): Pt[] => a.map(([x, y]) => P(x, y));

/** Standing, feet at the origin: the legs' length, the neck's root, the head's centre (body coordinates). */
const LEG = 8.2;
const HIP_NEAR = P(1.2, -LEG);
const HIP_FAR = P(-1.4, -LEG - 0.4);
const HEAD = P(15.4, -25);
/** The neck's root on the breast (standing) and on the flying body. */
const NECK = P(10.6, -19.4);
const FLY_NECK = P(11, -1.6);
const SHOULDER_STAND = P(6, -21);
const BODY = pts([[14.4, -11], [15.8, -15.2], [15, -19.6], [12, -23.2], [6, -25], [-2, -24.6], [-10, -22.6], [-17, -19.6], [-24, -17.4], [-24.6, -15.8], [-17, -14.8], [-10, -11.8], [-3, -8.8], [5, -8.4], [11, -9.2]]);
const WING = pts([[11, -20.6], [6.4, -24.4], [-2, -24], [-10, -22], [-16, -19.6], [-19.4, -17.6], [-15, -15.5], [-8, -15], [-1, -15.8], [5, -17.4], [9.2, -18.8]]);
const PRIMARIES = pts([[-12.4, -19.6], [-20, -18.6], [-27, -17.4], [-31.6, -16.4], [-30.2, -15.6], [-24, -15.4], [-15.4, -15.4]]);
/** In flight, the body level about its centre: where the head and the wings join. */
const FLY_BODY = pts([[14.6, -1], [12.4, -4], [6, -5.6], [-4, -5.2], [-14, -3.2], [-22.4, -2.2], [-23, 0.4], [-14, 1.8], [-4, 4], [6, 4.6], [12.4, 2.8]]);
const FLY_HEAD = P(17.4, -2.6);
const FLY_SHOULDER = P(3, -3);
/** One wing in plan view, the shoulder at the origin, out along −y: the arm to the wrist, then the hand from it. */
const ARM = pts([[2.4, 1], [3.6, -8], [4.6, -17], [4.4, -24], [2.6, -28.4], [-3, -29.4], [-7.4, -26], [-9.4, -18], [-10.6, -9], [-11.4, 1]]);
const WRIST = P(3.6, -25.6);
/** The hand swept back from the wrist, its root tucked under the arm's end. */
const HAND = pts([[1.4, 3], [0.6, -4], [-3.4, -11], [-9.6, -18.4], [-17, -24.6], [-23.4, -28.2], [-24.6, -26.6], [-21, -21], [-17, -14.4], [-13.4, -7.6], [-10.6, -1], [-9.4, 3]]);

/** A white wash laid opaque (the paper must not let the sea through), the form turned with cool shade below. */
function whiteForm(p: Painter, c: Colours, shape: Pt[], shadeAngle = -Math.PI / 2 - 0.2, shade = 0.22): void {
  const rng = p.rng;
  p.wash(shape, c.white, { rng, opacity: 0.98, edge: 0.06, edgeWidth: 0.4, sharpness: 0.2, centreLift: 0.06, granulation: 0.08, deform: 0.04, spread: 0.03, layers: 6, blend: 'source-over' });
  p.glaze(shape, c.shade, { rng, opacity: shade, edge: 0.04, darken: 0, deform: 0.1, spread: 0.05, fade: { angle: shadeAngle, start: 0.35, amount: 1, ragged: 0.75 } });
  p.glaze(shape, c.warm, { rng, opacity: 0.12, edge: 0, darken: 0, deform: 0.14, fade: { angle: shadeAngle + Math.PI, start: 0.45, amount: 1, ragged: 0.8 } });
}

/** The standing body (no head, no legs), feet at the origin: white, the grey mantle and folded wing, the crossed black primaries. */
function paintBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  whiteForm(p, c, smoothPolygon(BODY, 2));
  // the mantle and the folded wing: one soft grey wash, darker toward the back's ridge
  const wing = smoothPolygon(WING, 2);
  p.wetInWet(wing, c.mantleDeep, c.mantle, { rng, angle: Math.PI / 2 + 0.25, split: 0.35, softness: 0.6, fingers: 0.35, opacity: 0.8, edge: 0.3, edgeWidth: 0.5, deform: 0.08, granulation: 0.3, flow: 0.4, flowScale: 5 * U, blend: 'source-over' });
  // the tertials' white crescent and the secondaries' white edge along the folded wing's foot
  p.inkLine(pts([[6, -18.2], [0, -16.6], [-8, -16], [-14.6, -16.4]]), { rng, width: 0.9 * U, opacity: 0.85, breaks: 0.3, wobble: 0.2, pigment: c.white, taper: [0.5, 0.6] });
  p.inkLine(pts([[-6, -22.6], [-12, -20.6], [-15.4, -18.6]]), { rng, width: 0.6 * U, opacity: 0.55, breaks: 0.4, pigment: c.white, taper: [0.5, 0.5] });
  // a few feather rows in the grey, barely there
  for (const row of [[[7, -21], [0, -21.4], [-6, -20.2]], [[3, -19], [-4, -18.8], [-10, -18.4]]] as const) p.inkLine(pts(row), { rng, width: 0.25 * U, opacity: 0.16, breaks: 0.6, wobble: 0.3, pigment: c.mantleDeep, taper: [0.4, 0.4] });
  // the long primaries crossed over the tail: crisp black, each tip with a small white spot
  const prim = smoothPolygon(PRIMARIES, 1);
  p.wash(prim, c.black, { rng, opacity: 0.92, edge: 0.45, edgeWidth: 0.35, sharpness: 0.6, deform: 0.02, spread: 0.01, layers: 4, blend: 'source-over', fade: { angle: 0, start: 0.75, ragged: 0.4 } });
  for (const [x, y] of [[-31, -16], [-28.4, -15.8], [-25.8, -15.6], [-23.2, -15.5]] as const) {
    p.dab(P(x, y), c.white, { rng, variant: 'round', angle: 0.1, length: 1.5 * U, width: 0.9 * U, opacity: 0.92, layers: 2, edge: 0.1, blend: 'source-over' });
  }
  for (const k of [0, 1, 2]) p.inkLine(pts([[-13 - k * 2, -18.4 + k * 0.3], [-26 - k * 1.6, -16.6 + k * 0.2]]), { rng, width: 0.2 * U, opacity: 0.4, breaks: 0.3, pigment: mix(c.black, c.mantle, 0.35) });
  // the brush lifts along the belly and the breast: broken cool touches, no outline
  p.inkLine(pts([[15.4, -14], [13.6, -10.2], [8, -8.6], [0, -8.8]]), { rng, width: 0.3 * U, opacity: 0.22, breaks: 0.6, wobble: 0.3, pigment: mix(c.shade, c.ink, 0.35), taper: [0.3, 0.5] });
  p.inkLine(pts([[-10, -12], [-17, -14.8], [-23.6, -15.8]]), { rng, width: 0.25 * U, opacity: 0.18, breaks: 0.6, pigment: mix(c.shade, c.ink, 0.3), taper: [0.3, 0.5] });
}

/** The head about its centre with the bill; `open` drops the lower mandible (the long call). */
function paintHead(p: Painter, c: Colours, open: boolean): void {
  const rng = p.rng;
  const head = smoothPolygon(pts([[6, -2.4], [4.8, -4.6], [1.6, -5.8], [-2.4, -5.6], [-5.2, -3.6], [-6, 0], [-5.4, 3.4], [-2.4, 5], [2.4, 4.6], [5.2, 2.6], [6, 0.6]]), 2);
  whiteForm(p, c, head, Math.PI * 0.85, 0.2);
  // the bill: stout, yellow, the hooked tip paler; the red gonys spot on the lower mandible
  const upper = smoothPolygon(pts([[5, -3.0], [9, -2.8], [12.6, -2.3], [14.3, -1.3], [13.8, -0.3], [12.4, -0.5], [9, -0.7], [5.4, -0.6]]), 1);
  const gape = open ? 0.32 : 0;
  const lowerPts = pts([[5.4, -0.6], [9, -0.4], [12.4, -0.2], [11.8, 1.1], [9, 0.9], [5.8, 1.2]]).map((q) => {
    const x = q.x - 5.4 * U;
    const y = q.y + 0.6 * U;
    return { x: 5.4 * U + x * Math.cos(gape) - y * Math.sin(gape), y: -0.6 * U + x * Math.sin(gape) + y * Math.cos(gape) };
  });
  const lower = smoothPolygon(lowerPts, 1);
  for (const b of [upper, lower]) p.wash(b, c.bill, { rng, opacity: 0.95, edge: 0.35, edgeWidth: 0.4, sharpness: 0.5, deform: 0.03, spread: 0.02, layers: 4, blend: 'source-over', fade: { angle: 0, start: 0.7, ragged: 0.4 } });
  p.dab(P(13.4, -1.2), c.billTip, { rng, variant: 'round', angle: 0, length: 1.4 * U, width: 1.0 * U, opacity: 0.6, layers: 2, edge: 0.1 });
  const spot = lowerPts[3]!;
  p.dab({ x: spot.x - 0.3 * U, y: spot.y - 0.5 * U }, c.red, { rng, variant: 'round', angle: gape, length: 1.6 * U, width: 1.1 * U, opacity: 0.9, layers: 3, edge: 0.3 });
  p.inkLine(open ? [P(5.6, -0.6), P(12.8, -0.4)] : [P(5.6, -0.7), P(13.2, -0.6)], { rng, width: 0.22 * U, opacity: 0.45, breaks: 0.2, pigment: mix(c.bill, c.ink, 0.6), taper: [0.2, 0.6] });
  if (open) p.wash(smoothPolygon([P(6, -0.5), P(12, -0.4), lowerPts[2]!, P(6, 0)], 1), c.red, { rng, opacity: 0.5, edge: 0.2, deform: 0.05, layers: 3 });
  // the eye: pale iris in a red ring, a small pupil (only up close does it show)
  p.dab(P(2.2, -2.8), c.red, { rng, variant: 'round', angle: 0, length: 2.0 * U, width: 1.8 * U, opacity: 0.55, layers: 2, edge: 0.3 });
  p.dab(P(2.2, -2.8), c.iris, { rng, variant: 'round', angle: 0, length: 1.3 * U, width: 1.25 * U, opacity: 0.95, layers: 3, blend: 'source-over', edge: 0.1 });
  p.dab(P(2.3, -2.8), c.ink, { rng, variant: 'round', angle: 0, length: 0.55 * U, width: 0.55 * U, opacity: 0.9, layers: 2 });
  // the brow's slight frown and the nape turning away
  p.inkLine(pts([[0.4, -4.4], [3.6, -4.2]]), { rng, width: 0.25 * U, opacity: 0.2, breaks: 0.4, pigment: mix(c.shade, c.ink, 0.5), taper: [0.4, 0.4] });
  p.inkLine(pts([[-5.6, -2], [-6.2, 2.8], [-5.6, 7.4]]), { rng, width: 0.28 * U, opacity: 0.2, breaks: 0.6, wobble: 0.3, pigment: mix(c.shade, c.ink, 0.4), taper: [0.3, 0.5] });
}

/** One leg from the hip, the webbed foot forward: yellow. */
function paintLeg(p: Painter, c: Colours): void {
  const rng = p.rng;
  p.inkLine([P(0, 0), P(0.3, LEG * 0.5), P(0.2, LEG)], { rng, width: 1.2 * U, opacity: 0.92, breaks: 0, pigment: c.leg, taper: [0, 0.1] });
  p.inkLine([P(-0.3, LEG * 0.1), P(0, LEG * 0.6)], { rng, width: 0.35 * U, opacity: 0.3, breaks: 0.3, pigment: mix(c.leg, c.ink, 0.5) });
  const web = smoothPolygon(pts([[-1.4, LEG - 0.4], [2.6, LEG - 0.6], [4.4, LEG + 0.2], [0.4, LEG + 0.5], [-1.6, LEG + 0.3]]), 1);
  p.wash(web, mix(c.leg, '#c09a34', 0.4), { rng, opacity: 0.92, edge: 0.4, deform: 0.05, layers: 3, blend: 'source-over' });
}

function paintFlyBody(p: Painter, c: Colours): void {
  const rng = p.rng;
  whiteForm(p, c, smoothPolygon(FLY_BODY, 2), -Math.PI / 2, 0.34);
  // the mantle shows along the back between the wings
  p.glaze(smoothPolygon(pts([[10, -4.2], [2, -5.4], [-8, -4.6], [-12, -3.4], [-4, -3.2], [6, -3.2]]), 1), c.mantle, { rng, opacity: 0.55, edge: 0.2, deform: 0.1 });
  p.inkLine(pts([[13, 2], [6, 4.2], [-6, 3.6], [-16, 1.4]]), { rng, width: 0.3 * U, opacity: 0.2, breaks: 0.6, pigment: mix(c.shade, c.ink, 0.35), taper: [0.3, 0.5] });
}

/** The inner wing in plan view: soft grey, a white trailing edge. */
function paintArm(p: Painter, c: Colours): void {
  const rng = p.rng;
  const arm = smoothPolygon(ARM, 1);
  p.wetInWet(arm, c.mantle, mix(c.mantle, c.white, 0.2), { rng, angle: Math.PI, split: 0.6, softness: 0.6, fingers: 0.4, opacity: 0.97, edge: 0.22, edgeWidth: 0.45, deform: 0.06, granulation: 0.3, blend: 'source-over' });
  p.inkLine(pts([[-10.6, 0], [-10, -9], [-8.8, -18], [-6.6, -26]]), { rng, width: 1.4 * U, opacity: 0.9, breaks: 0.2, wobble: 0.15, pigment: c.white, taper: [0.2, 0.3] });
  p.inkLine(pts([[2.6, -1], [3.8, -12], [4.2, -23]]), { rng, width: 0.3 * U, opacity: 0.22, breaks: 0.5, pigment: c.mantleDeep, taper: [0.3, 0.4] });
}

/** The outer wing in plan view from the wrist: grey into crisp black tips with white mirrors and spots. */
function paintHand(p: Painter, c: Colours): void {
  const rng = p.rng;
  const hand = smoothPolygon(HAND, 1);
  p.wetInWet(hand, c.mantle, c.black, { rng, angle: -Math.PI / 2 - 0.75, split: 0.5, softness: 0.25, fingers: 0.7, opacity: 0.97, edge: 0.4, edgeWidth: 0.4, deform: 0.04, granulation: 0.2, blend: 'source-over' });
  // primaries' separations in the black
  for (const k of [0, 1, 2, 3]) p.inkLine(pts([[-9 - k * 1.4, -12 - k * 0.4], [-19 - k * 0.6, -25 + k * 1.4]]), { rng, width: 0.2 * U, opacity: 0.25, breaks: 0.4, pigment: mix(c.black, c.mantle, 0.5) });
  // the mirror near the outermost tip and the small white tips
  p.dab(P(-20.6, -25.4), c.white, { rng, variant: 'round', angle: -0.7, length: 2.4 * U, width: 1.6 * U, opacity: 0.95, layers: 3, edge: 0.1, blend: 'source-over' });
  for (const [x, y] of [[-24, -27.2], [-22.6, -24.2], [-20.6, -21.4]] as const) p.dab(P(x, y), c.white, { rng, variant: 'round', angle: -0.6, length: 1.1 * U, width: 0.8 * U, opacity: 0.85, layers: 2, edge: 0.1, blend: 'source-over' });
  p.inkLine(pts([[-10, 1], [-13, -7], [-16.6, -14]]), { rng, width: 1.1 * U, opacity: 0.8, breaks: 0.3, pigment: c.white, taper: [0.2, 0.6] });
}

export interface GullParts {
  body: Sprite; // standing body and folded wing, feet at the origin
  head: Sprite; // about its centre
  neck: Sprite; // from its root, up along −y, 10 design units
  headOpen: Sprite; // the long call
  leg: Sprite; // from the hip
  flyBody: Sprite; // level, about the body centre
  arm: Sprite; // plan view, the shoulder at the origin
  hand: Sprite; // plan view, the wrist at the origin
  shadow: Sprite; // a soft cool glaze under the feet
}

export function paintGull(res: number, seed: number): GullParts {
  const c = colours();
  return {
    shadow: paintSprite(res, { w: 36 * U, h: 5 * U, ox: 18 * U, oy: 2.5 * U }, seed + 7, (p, rng) =>
      p.wash(smoothPolygon(pts([[-15, 0], [-6, -1.4], [8, -1.5], [15, -0.2], [6, 1.3], [-8, 1.2]]), 1), PIGMENTS.shadow, { rng, opacity: 0.32, edge: 0, darken: 0, deform: 0.2, spread: 0.15, layers: 5, fade: { angle: Math.PI, start: 0.3, ragged: 0.6 } }),
    ),
    body: paintSprite(res, { w: 50 * U, h: 20 * U, ox: 33 * U, oy: 26.6 * U }, seed, (p) => paintBody(p, c)),
    neck: paintSprite(res, { w: 12 * U, h: 16 * U, ox: 6 * U, oy: 13 * U }, seed + 9, (p) => whiteForm(p, c, smoothPolygon(pts([[4, 2], [4.4, -4], [3.6, -9], [0, -11.4], [-3.6, -9], [-4.4, -4], [-4, 2], [0, 2.6]]), 2), Math.PI, 0.16)),
    head: paintSprite(res, { w: 23 * U, h: 18 * U, ox: 8 * U, oy: 8 * U }, seed + 1, (p) => paintHead(p, c, false)),
    headOpen: paintSprite(res, { w: 23 * U, h: 18 * U, ox: 8 * U, oy: 8 * U }, seed + 1, (p) => paintHead(p, c, true)),
    leg: paintSprite(res, { w: 8 * U, h: 11 * U, ox: 2.4 * U, oy: 1 * U }, seed + 4, (p) => paintLeg(p, c)),
    flyBody: paintSprite(res, { w: 40 * U, h: 12 * U, ox: 24.4 * U, oy: 6.4 * U }, seed + 5, (p) => paintFlyBody(p, c)),
    arm: paintSprite(res, { w: 18 * U, h: 32 * U, ox: 12.4 * U, oy: 30.4 * U }, seed + 6, (p) => paintArm(p, c)),
    hand: paintSprite(res, { w: 28 * U, h: 34 * U, ox: 26 * U, oy: 29.6 * U }, seed + 8, (p) => paintHand(p, c)),
  };
}

// ---------------------------------------------------------------------------------------------
// drawing (pure: the studio draws poses with it)

export interface GullPose {
  shape: 'stand' | 'float' | 'fly';
  /** body rotation, + nose down */
  pitch: number;
  /** body lowered (design units) */
  crouch: number;
  /** head offset from its place (design units) and rotation (+ bill down); `back` turns it over the shoulder (preening) */
  headX: number;
  headY: number;
  headRot: number;
  back: boolean;
  open: boolean;
  /** leg lift 0..1, near and far; in flight the legs let down (0..1) */
  liftNear: number;
  liftFar: number;
  legsDown: number;
  /** one wing stretched down and back (0..1) */
  stretch: number;
  /** in flight: each wing's foreshortening, arm and hand (+ up, − down; far wing then near) */
  farArm: number;
  farHand: number;
  nearArm: number;
  nearHand: number;
  /** its shadow on the stone under it */
  shadow: number;
}

export const REST_POSE: GullPose = {
  shape: 'stand', pitch: -0.06, crouch: 0, headX: 0, headY: 0, headRot: 0, back: false, open: false, liftNear: 0, liftFar: 0, legsDown: 0, stretch: 0,
  farArm: 0.62, farHand: 0.46, nearArm: -0.5, nearHand: -0.42, shadow: 0,
};

/** Wings at a wingbeat phase (0..1, 0 = top of the stroke) and in a glide (`glide` 1): set wings, a shallow arch. */
export function wingsAt(phase: number, glide: number, deep = 1): Pick<GullPose, 'farArm' | 'farHand' | 'nearArm' | 'nearHand'> {
  const b = Math.cos(phase * TAU) * deep;
  // the hand trails the arm through the stroke
  const h = Math.cos(phase * TAU - 0.7) * deep;
  return {
    farArm: lerp(0.25 + 0.6 * b, REST_POSE.farArm, glide),
    farHand: lerp(0.15 + 0.7 * h, REST_POSE.farHand, glide),
    nearArm: lerp(-0.3 + 0.55 * b, REST_POSE.nearArm, glide),
    nearHand: lerp(-0.34 + 0.66 * h, REST_POSE.nearHand, glide),
  };
}

const img = (ctx: Ctx, s: Sprite, alpha = 1) => {
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  if (alpha < 1) ctx.globalAlpha /= alpha;
};

const thin = (v: number) => (Math.abs(v) < 0.04 ? 0.04 * Math.sign(v || 1) : v);

/** A wing from the shoulder: the arm foreshortened by `arm`, the hand from the wrist by `hand`, tips swept back; `swing` turns it more. */
function drawWing(ctx: Ctx, parts: GullParts, arm: number, hand: number, swing = 0, alpha = 1): void {
  ctx.save();
  ctx.rotate(swing - 0.22 * clamp(arm * 3, -1, 1));
  ctx.save();
  ctx.translate(WRIST.x, WRIST.y * arm);
  ctx.scale(1, thin(hand));
  img(ctx, parts.hand, alpha);
  ctx.restore();
  // the arm over the hand's root
  ctx.scale(1, thin(arm));
  img(ctx, parts.arm, alpha);
  ctx.restore();
}

/** The neck from its root to the head's centre (a soft white column, stretched or shortened). */
function drawNeck(ctx: Ctx, parts: GullParts, from: Pt, to: Pt): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  ctx.save();
  ctx.translate(from.x, from.y);
  ctx.rotate(Math.atan2(dx, -dy));
  ctx.scale(1, Math.hypot(dx, dy) / (10 * U));
  img(ctx, parts.neck);
  ctx.restore();
}

function drawHead(ctx: Ctx, parts: GullParts, neck: Pt, at: Pt, q: GullPose): void {
  const h = { x: at.x + q.headX * U, y: at.y + q.headY * U };
  drawNeck(ctx, parts, neck, h);
  ctx.save();
  ctx.translate(h.x, h.y);
  if (q.back) ctx.scale(-1, 1);
  ctx.rotate(q.headRot);
  img(ctx, q.open ? parts.headOpen : parts.head);
  ctx.restore();
}

function drawLeg(ctx: Ctx, parts: GullParts, at: Pt, lift: number, alpha = 1): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-0.35 * lift);
  ctx.scale(1, 1 - 0.3 * lift);
  img(ctx, parts.leg, alpha);
  ctx.restore();
}

/** The gull at the origin (feet, the waterline afloat, the body centre in flight), facing +x, in world units at perspective 1. */
export function drawGull(ctx: Ctx, parts: GullParts, q: GullPose): void {
  if (q.shape === 'fly') {
    drawFlying(ctx, parts, q);
    return;
  }
  const float = q.shape === 'float';
  if (!float && q.shadow > 0) {
    ctx.save();
    ctx.translate(-4 * U, 0.4 * U);
    img(ctx, parts.shadow, q.shadow);
    ctx.restore();
  }
  if (!float) drawLeg(ctx, parts, HIP_FAR, q.liftFar, 0.75);
  ctx.save();
  // afloat it sits low: the belly under the waterline
  ctx.translate(0, (float ? LEG + 2.4 : q.crouch) * U);
  ctx.rotate(q.pitch);
  img(ctx, parts.body);
  // preening, the head lies back over the mantle
  drawHead(ctx, parts, NECK, q.back ? P(4, -26) : HEAD, q);
  if (q.stretch > 0) {
    // one wing reached down and back past the tail, spread
    ctx.save();
    ctx.translate(SHOULDER_STAND.x, SHOULDER_STAND.y + 2 * U);
    drawWing(ctx, parts, 0.95 * q.stretch, 0.9 * q.stretch, -1.95, Math.min(1, q.stretch * 1.6));
    ctx.restore();
  }
  ctx.restore();
  if (!float) drawLeg(ctx, parts, HIP_NEAR, q.liftNear);
}

function drawFlying(ctx: Ctx, parts: GullParts, q: GullPose): void {
  ctx.save();
  ctx.rotate(q.pitch);
  ctx.save();
  ctx.translate(FLY_SHOULDER.x - 1.5 * U, FLY_SHOULDER.y);
  drawWing(ctx, parts, q.farArm, q.farHand, 0, 0.85);
  ctx.restore();
  if (q.legsDown > 0.05) {
    for (const dx of [-3, -1]) {
      ctx.save();
      ctx.translate(dx * U, 2 * U);
      ctx.rotate(0.9 * (1 - q.legsDown) + 0.2);
      img(ctx, parts.leg, q.legsDown);
      ctx.restore();
    }
  }
  img(ctx, parts.flyBody);
  ctx.save();
  const h = { x: FLY_HEAD.x + q.headX * U, y: FLY_HEAD.y + q.headY * U };
  drawNeck(ctx, parts, FLY_NECK, h);
  ctx.translate(h.x, h.y);
  ctx.rotate(q.headRot);
  img(ctx, q.open ? parts.headOpen : parts.head);
  ctx.restore();
  ctx.save();
  ctx.translate(FLY_SHOULDER.x, FLY_SHOULDER.y + 1 * U);
  drawWing(ctx, parts, q.nearArm, q.nearHand);
  ctx.restore();
  ctx.restore();
}


// ---------------------------------------------------------------------------------------------
// where it goes (pure)

export type PlaceKind = 'boat' | 'rock' | 'ruin' | 'float';

export interface Place {
  kind: PlaceKind;
  /** the perch, or null afloat */
  perch: Perch | null;
  /** at rest (a boat perch's point before the carrier moves it) */
  x: number;
  y: number;
  scale: number;
  depth: number;
}

/**
 * Drawn a little larger than life where it is very far (the caique, the temple): a white fleck of
 * a few pixels must still read as a gull. Continuous in the scale, so a flight shrinks smoothly.
 */
export const gullScale = (s: number): number => s * lerp(1.4, 1, clamp((s - 0.09) / 0.3, 0, 1));

/** Its outline on a perch: about half a length either side of its feet, a little more than half a length tall. */
function footprintClear(w: Pick<FaunaWorld, 'scene'>, x: number, y: number, s: number): boolean {
  const half = 0.55 * GULL_LEN * s + 8;
  const tall = 0.5 * GULL_LEN * s + 30;
  return w.scene.slots.every((q) => !(Math.abs(q.x - x) < half && q.y > y - tall && q.y < y + 24));
}

/** Where on a perch it can stand, its whole body clear of the planting slots; null if nowhere. */
export function standX(w: Pick<FaunaWorld, 'scene' | 'perspective'>, p: Perch): number | null {
  const s = gullScale(p.scale ?? w.perspective(p.depth, p.x));
  for (const u of [0, -0.6, 0.6, -1, 1]) {
    const x = p.x + u * p.spread;
    if (footprintClear(w, x, perchY(p, x), s)) return x;
  }
  return null;
}

const GULL_PERCHES: readonly Perch['kind'][] = ['boat', 'rock', 'ruin'];

/** The perches a gull takes: the caique's mast and rails, the splash rocks' crowns, the temple; only those where its body clears the slots. */
export function gullPerches(w: Pick<FaunaWorld, 'perches' | 'scene' | 'perspective'>): { perch: Perch; x: number }[] {
  const out: { perch: Perch; x: number }[] = [];
  for (const p of w.perches) {
    if (!GULL_PERCHES.includes(p.kind)) continue;
    const x = standX(w, p);
    if (x !== null) out.push({ perch: p, x });
  }
  return out;
}

const floatCache = new WeakMap<readonly Region[], Pt[]>();

/**
 * Where it floats: points of the shallows (the sea's near water) 14 inside its edge and 18 off its
 * rocks, `slotGap` from every planting slot and the heron's stands. Cached per garden.
 */
export function floatSpots(w: Pick<FaunaWorld, 'regions' | 'scene' | 'stands'>): Pt[] {
  let out = floatCache.get(w.regions);
  if (out) return out;
  out = [];
  const r = w.regions.find((g) => g.kind === 'shallows');
  if (r) {
    const xs = r.outline.map((q) => q.x);
    const ys = r.outline.map((q) => q.y);
    const stands = w.stands();
    for (let y = Math.min(...ys) + 6; y <= Math.max(...ys); y += 12) {
      for (let x = Math.min(...xs) + 6; x <= Math.max(...xs); x += 12) {
        const q = { x, y };
        if (!inRegion(r, q) || distanceToPolygon(q, r.outline) < 14) continue;
        if ((r.holes ?? []).some((h) => distanceToPolygon(q, h) < 18)) continue;
        if (w.scene.slots.some((s) => Math.hypot(s.x - x, s.y - y) < GULL_TUNING.slotGap)) continue;
        if (stands.some((s) => Math.hypot(s.x - x, s.y - y) < GULL_TUNING.slotGap)) continue;
        out.push(q);
      }
    }
  }
  floatCache.set(w.regions, out);
  return out;
}

const inView = (v: Rect, q: Pt, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

const herons = (w: Pick<FaunaWorld, 'creatures'>): Pt[] => w.creatures.filter((c) => c.kind === 'heron' && !c.done);

type PlaceWorld = Pick<FaunaWorld, 'perches' | 'scene' | 'perspective' | 'regions' | 'stands' | 'view' | 'creatures'>;

/**
 * Somewhere to go: the caique, a splash rock, the temple or the water, weighted by kind (each kind's
 * weight shared among its options), in view when one is, never where another creature is or is
 * making for, and away from a heron. `prefer` takes the mast top first when it is free (an arrival).
 */
export function choosePlace(w: PlaceWorld, rng: Rng, taken: readonly Pt[], o: { not?: Place | null; prefer?: 'mast' } = {}): Place | null {
  const v = w.view;
  const avoid = herons(w);
  const free = (q: Pt, s: number) => taken.every((t) => dist(t, q) >= 12 + GULL_TUNING.clear * s);
  const options: Place[] = [];
  for (const { perch: p, x } of gullPerches(w)) {
    const s = p.scale ?? w.perspective(p.depth, p.x);
    const q = { x, y: perchY(p, x) };
    if (p === o.not?.perch || !free(q, s) || avoid.some((h) => dist(h, q) < GULL_TUNING.heronGap)) continue;
    options.push({ kind: p.kind as PlaceKind, perch: p, x: q.x, y: q.y, scale: s, depth: p.depth + 0.5 });
  }
  const spots = floatSpots(w);
  for (let i = 0; i < 6 && spots.length > 0; i++) {
    const q = rng.pick(spots);
    const s = w.perspective(q.y, q.x);
    if (!free(q, s) || avoid.some((h) => dist(h, q) < GULL_TUNING.heronGap) || (o.not?.kind === 'float' && dist(q, o.not) < 80)) continue;
    options.push({ kind: 'float', perch: null, x: q.x, y: q.y, scale: s, depth: q.y + 0.5 });
    break;
  }
  if (o.prefer === 'mast') {
    const mast = options.find((c) => c.perch?.id === 'mast-top' && inView(v, c, 20));
    if (mast) return mast;
  }
  const seen = options.filter((c) => inView(v, c, 20));
  const pool = seen.length > 0 ? seen : options;
  if (pool.length === 0) return null;
  const count = (k: PlaceKind) => pool.filter((c) => c.kind === k).length;
  let r = rng.next() * pool.reduce((a, c) => a + GULL_TUNING.weights[c.kind] / count(c.kind), 0);
  for (const c of pool) {
    r -= GULL_TUNING.weights[c.kind] / count(c.kind);
    if (r < 0) return c;
  }
  return pool[pool.length - 1]!;
}

/** A lazy circle over the cove: its centre, radii and scale, inside the sky region; null without one. */
export function soarCircle(w: Pick<FaunaWorld, 'regions'>, rng: Rng): { c: Pt; r: number; ry: number; scale: number } | null {
  const sky = w.regions.find((g) => g.kind === 'sky');
  if (!sky) return null;
  const xs = sky.outline.map((q) => q.x);
  for (let i = 0; i < 12; i++) {
    const r = rng.range(46, 84);
    const c = { x: rng.range(Math.min(...xs) + r, Math.max(...xs) - r), y: rng.range(130, 250) };
    const ry = r * 0.3;
    let ok = true;
    for (let k = 0; k < 12 && ok; k++) ok = inRegion(sky, { x: c.x + Math.cos((k / 12) * TAU) * r, y: c.y + Math.sin((k / 12) * TAU) * ry });
    if (ok) return { c, r, ry, scale: rng.range(0.24, 0.34) };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

interface Leg {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  len: number;
  u: number;
  s0: number;
  s1: number;
}

interface Soar {
  c: Pt;
  r: number;
  ry: number;
  scale: number;
  a: number;
  dir: number;
  left: number;
}

type Act = 'rest' | 'look' | 'shift' | 'preen' | 'preenBreast' | 'stretch' | 'call' | 'turn' | 'bob';

export class Gull extends BaseCreature {
  readonly kind = 'gull' as const;
  readonly visitor = false;
  place: Place | null = null;
  /** counts of what it did (tests and the studio) */
  readonly did = { call: 0, preen: 0, stretch: 0, shift: 0, soar: 0, float: 0, patter: 0, boat: 0, rock: 0, ruin: 0 };
  scale = 1;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  /** drawn facing: eases through a turn */
  private fx = 1;
  private leg: Leg | null = null;
  private soar: Soar | null = null;
  private after: Place | null = null;
  private next: Place | null = null;
  private spellFor = 0;
  private act: Act = 'rest';
  private actT = 0;
  private actFor = 1;
  private age = 0;
  private flap = 0;
  /** beats left before the next glide, seconds of glide left */
  private beats = 5;
  private glideT = 0;
  private glide = 0;
  private pitch = 0;
  private bank = 0;
  private first = true;
  private ring = 0;
  private patterT = -1;
  private nextCall = 0;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    readonly stay: number,
    to: Place,
  ) {
    super();
    // in from over the sea, high and gliding
    const side = to.x < w.view.x + w.view.w * 0.6 ? -1 : 1;
    const start = entryPoint(w.view, rng, 0.05, 0.25, side);
    this.pos = { ...start };
    this.scale = clamp(to.scale * 1.4, 0.2, 0.6);
    this.nextCall = rng.range(20, 60);
    this.flyTo(to, false, 'arrive');
    this.sync(w);
  }

  /** Where it stands or is making for (birds keep off it, ADR 0346's `heldSpots`). */
  spot(): Pt | null {
    const p = this.next ?? this.after ?? this.place;
    if (!p || this.state === 'depart') return null;
    return { x: p.x, y: p.y };
  }

  /** What it is doing (the act on a place, else the state). */
  doing(): string {
    return this.place && !this.leg && !this.soar && this.patterT < 0 ? this.act : this.state;
  }

  private flyTo(to: Place | null, soar: boolean, state: string, exit?: Pt, w?: FaunaWorld): void {
    const from = { ...this.pos };
    const s0 = this.scale;
    if (soar && w) {
      const c = soarCircle(w, this.rng);
      if (c) {
        this.after = to;
        const dir = this.rng.chance(0.5) ? 1 : -1;
        // join the circle at its point nearest the take-off
        const a = Math.atan2((from.y - c.c.y) / c.ry, from.x - c.c.x);
        this.soar = { ...c, a, dir, left: TAU * this.rng.range(1, 1.8) };
        this.setLeg(from, { x: c.c.x + Math.cos(a) * c.r, y: c.c.y + Math.sin(a) * c.ry }, s0, c.scale);
        this.next = null;
        this.place = null;
        this.layer = 'air';
        this.did.soar++;
        this.go('soar');
        return;
      }
    }
    const end = to ? { x: to.x, y: to.y } : exit!;
    this.setLeg(from, end, s0, to ? to.scale : s0);
    this.next = to;
    this.after = null;
    this.place = null;
    this.layer = 'air';
    this.go(state);
  }

  private setLeg(from: Pt, end: Pt, s0: number, s1: number): void {
    const dx = end.x - from.x;
    const lift = this.rng.range(20, 50) * Math.max(0.3, Math.min(s0, s1));
    const p1 = { x: from.x + dx * 0.25, y: from.y - lift };
    const p2 = { x: end.x - dx * 0.3, y: Math.min(end.y, from.y) - lift * 0.8 };
    const leg: Leg = { p0: from, p1, p2, p3: { ...end }, len: 0, u: 0, s0, s1 };
    leg.len = Math.max(1, cubicLength(leg.p0, leg.p1, leg.p2, leg.p3));
    this.leg = leg;
    if (Math.abs(dx) > 2) this.facing = Math.sign(dx);
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    this.age += dt;
    // a drifter: the sim sends it nowhere, so it watches the day and its stay itself
    if (!this.leaving && (this.age > this.stay || w.mode.night)) this.leaving = true;
    this.fx = approach(this.fx, this.facing, 1 / 0.12, dt);
    if (this.patterT >= 0) this.patterStep(dt, w);
    else if (this.leg || this.soar) this.flyStep(dt, w);
    else this.placeStep(dt, w);
    this.sync(w);
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const landing = this.next !== null && !this.soar;
    // slow deep beats in bursts, then long glides on set wings
    if (this.glideT > 0) {
      this.glideT -= dt * sf;
      this.glide = approach(this.glide, 1, 4, dt);
    } else {
      this.glide = approach(this.glide, 0, 5, dt);
      const before = Math.floor(this.flap);
      this.flap += dt * sf * GULL_TUNING.beat;
      if (Math.floor(this.flap) > before && --this.beats <= 0) {
        this.glideT = this.rng.range(1.6, 4.2);
        this.beats = this.rng.int(2, 5);
      }
    }
    if (this.leg) {
      const f = this.leg;
      const left = f.len * (1 - f.u);
      const brake = landing ? clamp(left / (50 * Math.max(0.3, f.s1)), 0.3, 1) : 1;
      const s = lerp(f.s0, f.s1, easeInOut(f.u));
      f.u = Math.min(1, f.u + (GULL_TUNING.flight * sf * brake * Math.max(0.35, s) * dt) / f.len);
      this.pos = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
      this.scale = lerp(f.s0, f.s1, easeInOut(f.u));
      const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
      if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
      const climb = clamp(Math.atan2(tg.y, Math.abs(tg.x)), -0.5, 0.5);
      const flare = landing ? clamp(1 - left / (22 * Math.max(0.3, f.s1)), 0, 1) : 0;
      // gliding in to land: wings set, then raised as it brakes
      if (landing && f.u > 0.6) this.glideT = Math.max(this.glideT, 0.2);
      this.pitch = approach(this.pitch, climb * 0.6 - flare * 0.5, 4, dt);
      this.bank = approach(this.bank, 0, 2, dt);
      if (!this.next && !this.soar && isOffscreen(this.pos, w.view, 40)) {
        this.done = true;
        return;
      }
      if (f.u < 1) return;
      this.leg = null;
      if (this.soar) return;
      if (!this.next) {
        this.done = true;
        return;
      }
      this.land(w);
      return;
    }
    // circling on set wings
    const c = this.soar!;
    this.glideT = Math.max(this.glideT, 0.3);
    const da = ((GULL_TUNING.flight * 0.8 * sf * Math.max(0.35, c.scale)) / Math.max(1, (c.r + c.ry) / 2)) * dt;
    c.a += da * c.dir;
    c.left -= da;
    this.pos = { x: c.c.x + Math.cos(c.a) * c.r, y: c.c.y + Math.sin(c.a) * c.ry };
    // nearer the viewer on the circle's front, a touch larger
    this.scale = c.scale * (1 + 0.12 * Math.sin(c.a));
    const vx = -Math.sin(c.a) * c.dir;
    if (Math.abs(vx) > 0.05) this.facing = Math.sign(vx);
    this.bank = approach(this.bank, 0.18 * Math.cos(c.a) * c.dir, 2, dt);
    this.pitch = approach(this.pitch, 0.08 * Math.cos(c.a) * c.dir, 2, dt);
    if (c.left > 0 && !(this.leaving && c.left < TAU * 0.5)) return;
    this.soar = null;
    if (this.leaving || !this.after) {
      this.after = null;
      this.depart(w);
      return;
    }
    const to = this.after;
    this.after = null;
    this.setLeg({ ...this.pos }, { x: to.x, y: to.y }, this.scale, to.scale);
    this.next = to;
    this.go('fly');
  }

  private land(w: FaunaWorld): void {
    const p = this.next!;
    this.place = p;
    this.next = null;
    this.pos = { x: p.x, y: p.y };
    this.scale = p.scale;
    this.pitch = 0;
    this.bank = 0;
    this.glide = 1;
    this.layer = 'entities';
    this.did[p.kind === 'float' ? 'float' : p.kind]++;
    const sf = w.speed;
    const span = p.kind === 'float' ? GULL_TUNING.float : this.first ? GULL_TUNING.firstSpell : GULL_TUNING.spell;
    this.first = false;
    this.spellFor = rangeOf(this.rng, [...span]) / sf;
    this.go(p.kind === 'float' ? 'float' : 'stand');
    this.timer = 0;
    // settling: the wings fold, a look about
    this.setAct('look', this.rng.range(1.5, 3) / sf);
  }

  private setAct(a: Act, t: number): void {
    this.act = a;
    this.actT = 0;
    this.actFor = t;
  }

  private placeStep(dt: number, w: FaunaWorld): void {
    const p = this.place!;
    const sf = w.speed;
    this.actT += dt;
    if (p.kind === 'float') {
      // a slow drift on the swell, kept to the open water
      const t = w.t * 0.11 + this.id;
      const v = { x: Math.sin(t) * 0.9 * sf * p.scale, y: Math.cos(t * 0.7) * 0.25 * sf * p.scale };
      const q = { x: this.pos.x + v.x * dt, y: this.pos.y + v.y * dt };
      if (floatSpots(w).some((s) => Math.abs(s.x - q.x) < 9 && Math.abs(s.y - q.y) < 9)) this.pos = q;
      this.place = { ...p, x: this.pos.x, y: this.pos.y, depth: this.pos.y + 0.5, scale: w.perspective(this.pos.y, this.pos.x) };
      this.scale = this.place.scale;
      this.ring -= dt * sf;
      if (this.ring <= 0) {
        w.ripple(this.pos.x, this.pos.y, 26 * this.scale, 0.18);
        this.ring = this.rng.range(4, 9);
      }
    }
    if (this.actT >= this.actFor) this.endAct(w);
  }

  /** What next on its place: mostly standing still; now and then a look, a shift of the feet, a preen, a stretch, the long call. */
  private endAct(w: FaunaWorld): void {
    const rng = this.rng;
    const sf = w.speed;
    const p = this.place!;
    if (this.act === 'call') this.did.call++;
    if (this.act === 'preen' || this.act === 'preenBreast') this.did.preen++;
    if (this.act === 'stretch') this.did.stretch++;
    if (this.act === 'shift') this.did.shift++;
    const heron = herons(w).some((h) => dist(h, this.pos) < GULL_TUNING.heronGap * 0.7);
    if (this.leaving || heron) {
      this.takeOff(w, null);
      return;
    }
    if (this.timer > this.spellFor) {
      const to = choosePlace(w, rng, this.taken(w), { not: p });
      if (to) {
        this.takeOff(w, to);
        return;
      }
      this.timer = 0;
    }
    if (this.timer > this.nextCall && p.kind !== 'float') {
      this.nextCall = this.timer + rng.range(40, 110);
      this.setAct('call', 2.8 / sf);
      return;
    }
    const r = rng.next();
    const float = p.kind === 'float';
    if (r < 0.42) this.setAct(float ? 'bob' : 'rest', rng.range(3, 9) / sf);
    else if (r < 0.62) this.setAct('look', rng.range(1.4, 3.2) / sf);
    else if (r < 0.72 && !float) this.setAct('shift', 1.3 / sf);
    else if (r < 0.84) this.setAct(rng.chance(0.6) ? 'preen' : 'preenBreast', rng.range(3, 7) / sf);
    else if (r < 0.9 && !float) this.setAct('stretch', 2.6 / sf);
    else if (r < 0.96 && (p.perch?.spread ?? 0) > 3) {
      this.facing = -this.facing;
      this.setAct('turn', 1.2 / sf);
    } else this.setAct(float ? 'bob' : 'rest', rng.range(2, 5) / sf);
  }

  private taken(w: FaunaWorld): Pt[] {
    const mine = this.spot();
    return heldSpots(w).filter((q) => !mine || q.x !== mine.x || q.y !== mine.y);
  }

  /** Off its place: from the water a run of pattering steps first; from a perch a drop into the first beat. */
  private takeOff(w: FaunaWorld, to: Place | null): void {
    const p = this.place!;
    this.pos = this.at(w);
    if (to && to.x !== this.pos.x) this.facing = Math.sign(to.x - this.pos.x) || this.facing;
    this.glideT = 0;
    this.glide = 0;
    this.beats = this.rng.int(4, 7);
    this.flap = 0.5;
    if (p.kind === 'float') {
      this.patterT = 0;
      this.next = to;
      this.layer = 'entities';
      this.did.patter++;
      this.go('patter');
      return;
    }
    this.lift(w, to);
  }

  private lift(w: FaunaWorld, to: Place | null): void {
    if (!to) {
      this.depart(w);
      return;
    }
    this.flyTo(to, this.rng.chance(GULL_TUNING.soar), 'fly', undefined, w);
  }

  /** Running over the water with quick beats, a ring at each step, until it lifts. */
  private patterStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const t0 = this.patterT;
    this.patterT += dt * sf;
    this.flap += dt * sf * GULL_TUNING.beat * 1.5;
    const step = 0.18;
    this.pos = { x: this.pos.x + this.facing * 22 * this.scale * dt * sf, y: this.pos.y };
    if (Math.floor(this.patterT / step) > Math.floor(t0 / step) && this.patterT < GULL_TUNING.patter) w.ripple(this.pos.x, this.pos.y, 10 * this.scale, 0.3);
    if (this.patterT < GULL_TUNING.patter) return;
    this.patterT = -1;
    const to = this.next;
    this.next = null;
    this.place = { kind: 'float', perch: null, x: this.pos.x, y: this.pos.y, scale: this.scale, depth: this.pos.y + 0.5 };
    this.lift(w, to);
  }

  private depart(w: FaunaWorld): void {
    // away over the sea, the nearer side
    const to = exitPoint(w.view, this.pos, this.rng, 140);
    this.flyTo(null, false, 'depart', to);
  }

  override leave(): void {
    this.leaving = true;
  }

  /** Its point now: on the caique where the boat has carried it. */
  private at(w: Pick<FaunaWorld, 'carriers'>): Pt {
    const p = this.place;
    if (!p || this.leg || this.soar || this.patterT >= 0 || !p.perch?.carrier) return { ...this.pos };
    return carried(p, w.carriers[p.perch.carrier]);
  }

  private sync(w: Pick<FaunaWorld, 'carriers'>): void {
    const q = this.at(w);
    this.x = q.x;
    this.y = q.y;
  }

  override depth(): number | null {
    return (!this.leg && !this.soar && this.place) || this.patterT >= 0 ? (this.place?.depth ?? this.y + 0.5) : null;
  }

  /** The pose for now (reads the state only). */
  pose(t: number): GullPose {
    const q: GullPose = { ...REST_POSE };
    if (this.leg || this.soar || this.patterT >= 0) {
      q.shape = 'fly';
      q.pitch = this.pitch + this.bank;
      const f = this.leg;
      const landing = !!f && this.next !== null && !this.soar && this.patterT < 0;
      const left = f ? f.len * (1 - f.u) : Infinity;
      const flare = landing ? clamp(1 - left / (22 * Math.max(0.3, f!.s1)), 0, 1) : 0;
      if (this.patterT >= 0) {
        // the run: quick deep beats, legs down, the body low and tilted up
        Object.assign(q, wingsAt(this.flap % 1, 0, 1.1));
        q.legsDown = 1;
        q.pitch = -0.18;
        return q;
      }
      Object.assign(q, wingsAt(this.flap % 1, this.glide, 1));
      if (this.soar) {
        // soaring: the arm lifted a little more, the hand flat
        q.farArm += 0.06;
        q.nearArm -= 0.04;
      }
      if (flare > 0) {
        // braking: the wings raised and spread, the legs let down
        q.farArm = lerp(q.farArm, 0.85, flare);
        q.farHand = lerp(q.farHand, 0.75, flare);
        q.nearArm = lerp(q.nearArm, 0.45, flare);
        q.nearHand = lerp(q.nearHand, 0.35, flare);
        q.legsDown = flare;
      }
      q.headRot = -this.pitch * 0.5;
      return q;
    }
    const p = this.place;
    q.shape = p?.kind === 'float' ? 'float' : 'stand';
    q.shadow = p?.kind === 'rock' ? 0.7 : 0;
    const k = clamp(this.actT / Math.max(1e-6, this.actFor), 0, 1);
    const ease = Math.min(easeInOut(clamp(this.actT / 0.5, 0, 1)), easeInOut(clamp((this.actFor - this.actT) / 0.5, 0, 1)));
    if (q.shape === 'float') {
      q.pitch = -0.1 + 0.03 * Math.sin(t * 1.3 + this.id);
      q.headY = 0.3 * Math.sin(t * 1.3 + this.id + 0.6);
    }
    switch (this.act) {
      case 'look': {
        // the head turns, holds, turns back: a small tilt and a lift
        const s = Math.sin(k * Math.PI * 2 + this.id);
        q.headRot = -0.18 * s * ease;
        q.headY += -0.6 * ease;
        break;
      }
      case 'shift': {
        // weight from foot to foot, a foot lifted and set down
        const s = Math.sin(k * Math.PI * 2);
        q.liftNear = Math.max(0, s) * 0.8;
        q.liftFar = Math.max(0, -s) * 0.8;
        q.pitch += 0.03 * s;
        break;
      }
      case 'preen': {
        // the head over the shoulder, the bill working in the scapulars
        q.back = true;
        q.headRot = (0.7 + 0.15 * Math.sin(this.actT * 5)) * ease + (1 - ease) * 0.2;
        q.headY = 1.5 * Math.sin(this.actT * 3) * ease;
        q.pitch += 0.04 * ease;
        break;
      }
      case 'preenBreast': {
        q.headRot = (1.15 + 0.12 * Math.sin(this.actT * 6)) * ease;
        q.headX = -2.4 * ease;
        q.headY = 3.6 * ease;
        q.pitch += 0.06 * ease;
        break;
      }
      case 'stretch': {
        // the wing and the leg on one side reach down and back together
        const s = Math.sin(k * Math.PI);
        q.stretch = easeInOut(clamp(s * 1.4, 0, 1));
        q.liftNear = 0.5 * q.stretch;
        q.pitch += 0.12 * q.stretch;
        q.headRot = -0.1 * q.stretch;
        break;
      }
      case 'call': {
        // the long call: the head bows low, then is thrown up, bill open, and comes down calling
        const down = k < 0.25 ? easeInOut(k / 0.25) : k < 0.35 ? 1 - easeInOut((k - 0.25) / 0.1) : 0;
        const up = k < 0.25 ? 0 : k < 0.4 ? easeInOut((k - 0.25) / 0.15) : k < 0.85 ? 1 - 0.55 * easeInOut((k - 0.4) / 0.45) : 0.45 * (1 - easeInOut((k - 0.85) / 0.15));
        q.headRot = 0.9 * down - 1.35 * up;
        q.headX = 1.2 * down - 2.2 * up;
        q.headY = 3.6 * down - 3.4 * up;
        q.pitch += 0.22 * down - 0.08 * up;
        q.open = up > 0.15;
        break;
      }
      case 'turn': {
        q.liftNear = Math.max(0, Math.sin(k * Math.PI * 3)) * 0.5;
        q.liftFar = Math.max(0, -Math.sin(k * Math.PI * 3)) * 0.5;
        break;
      }
      default:
        q.headRot += 0.04 * Math.sin(t * 0.4 + this.id);
        break;
    }
    return q;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const grounded = !this.leg && !this.soar;
    if ((grounded && layer !== 'entities') || (!grounded && layer !== 'air')) return;
    const parts = w.art.get('gull', (res) => paintGull(res, 4100));
    const q = this.pose(w.t);
    const s = gullScale(this.scale);
    const c = this.place?.perch?.carrier ? w.carriers[this.place.perch.carrier] : undefined;
    const at = grounded && this.patterT < 0 ? this.at(w) : this.pos;
    const fx = Math.abs(this.fx) < 0.3 ? 0.3 * Math.sign(this.fx || this.facing) : this.fx;
    ctx.save();
    ctx.translate(at.x, at.y);
    if (grounded && c) ctx.rotate(c.pose.angle);
    ctx.scale(s * fx, s);
    if (q.shape === 'float') {
      // the waterline: what is under it is hidden, a faint reflection below
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40 * U, -40 * U, 80 * U, 40 * U);
      ctx.clip();
      drawGull(ctx, parts, q);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40 * U, 0, 80 * U, 14 * U);
      ctx.clip();
      ctx.globalAlpha *= 0.16;
      ctx.scale(1, -0.6);
      drawGull(ctx, parts, q);
      ctx.restore();
    } else drawGull(ctx, parts, q);
    ctx.restore();
  }
}

const homes = new WeakMap<readonly Perch[], boolean>();

const gull: CreatureDef = {
  kind: 'gull',
  title: 'yellow-legged gull',
  role: 'drifter',
  // one bird for long spells, sometimes a second; by day only
  visit: { gap: [260, 520], first: [10, 40], stay: [220, 440], group: [1, 1], max: 2, diurnal: true, visitor: false },
  // the coast's caique and temple (cached: asked often)
  needs: (w) => {
    let v = homes.get(w.perches);
    if (v === undefined) {
      v = w.perches.some((p) => p.kind === 'boat' || p.kind === 'ruin');
      homes.set(w.perches, v);
    }
    return v;
  },
  spawn(w, s) {
    if (!gull.needs!(w)) return [];
    const rng = w.rng.fork(`gull:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const out: Gull[] = [];
    const taken = heldSpots(w);
    for (let i = 0; i < Math.max(1, s.count); i++) {
      const to = choosePlace(w, rng, taken, { prefer: rng.chance(0.75) ? 'mast' : undefined });
      if (!to) break;
      const g = new Gull(w, rng.fork(`g${i}`), (s.stay || 300) * rng.range(0.9, 1.1), to);
      taken.push({ x: to.x, y: to.y });
      out.push(g);
    }
    return out;
  },
  sheet: {
    w: 900,
    h: 200,
    make(res, seed) {
      const a = paintGull(res, seed);
      return [a.body, a.head, a.neck, a.headOpen, a.leg, a.flyBody, a.arm, a.hand, a.shadow];
    },
  },
  show: { stage: 'coast', spec: { x: 280, y: 240, w: 620, h: 540 }, w: 840, h: 732, order: 41 },
};
export default gull;
