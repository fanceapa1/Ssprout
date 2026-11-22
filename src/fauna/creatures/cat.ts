/** Island cat: the coast's quiet resident, dozing on the wall copings and in the olive's shade. Side view, facing right.
 * docs/devlog/185-island-cat.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { clamp, dist, easeInOut, lerp, pointInPolygon, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type GroundSpot, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import type { CreatureDef } from './lib/def';
import { blockerOn, GROUND_ROOM, groundBodies, groundFree, hiddenByPlant, plantCovers, stepsRound, type GroundBody } from './lib/ground';

/** Drawn a little larger than life (about 55 cm nose to rump) so the outline reads at the overview. */
export const CAT_K = 1.2;

export const CAT_TUNING = {
  /** seconds asleep in one place; the first doze is shorter so a visitor soon sees it stir */
  doze: [50, 140] as const,
  firstDoze: [25, 60] as const,
  /** seconds sitting up, awake, and washing a paw */
  sit: [6, 18] as const,
  wash: [4, 9] as const,
  /** the front stretch on waking and its follow-through */
  stretch: [3.2, 4.4] as const,
  /** at nightfall: seconds sitting up facing the sea before it strolls away */
  dusk: [45, 90] as const,
  /** world units / s at perspective 1: an unhurried stroll */
  walk: 30,
  /** body travel per walk cycle (world units at perspective 1): a little under one step a second */
  stride: 28 * CAT_K,
  /** keeps this far from a planting slot when it walks or settles */
  clear: 22,
  /** where it lies down or sits: further off, so no plant spreads over it */
  rest: 40,
  /** the furthest it strolls in one go (route length, world units) */
  reach: 520,
  /** seconds of a drawn change of pose: between two painted poses, a painted pose and the rig, two rig poses */
  change: { paint: 0.9, mixed: 0.6, rig: 0.3 },
  /** seconds of the dissolve where the rig meets a painted pose (their outlines nearly match there) */
  meet: 0.14,
  /** seconds of turning to or from the viewer */
  turn: 0.45,
  /** seconds it stops to look at a creature in its way before it steps round (or gives the way up) */
  look: [0.8, 1.8] as const,
  /** where it settles next: a sunny coping, the olive's shade, another walk or the path */
  weights: { coping: 0.55, shade: 0.3, ground: 0.15 },
};

// ---------------------------------------------------------------------------------------------
// art

export const CAT_COATS = ['ginger', 'tabby', 'black'] as const;
export type CatCoat = (typeof CAT_COATS)[number];

interface Coat {
  white: Pigment;
  shade: Pigment;
  warm: Pigment;
  patch: Pigment;
  patchLight: Pigment;
  stripe: Pigment;
  stripes: number;
  ink: Pigment;
  eye: Pigment;
  nose: Pigment;
  ear: Pigment;
  /** the near ear's tip clipped square (a neutered feral cat's mark) */
  tipped: boolean;
}

function coat(c: CatCoat): Coat {
  const base = { white: '#f8f3ea', shade: mix(PIGMENTS.shadow, '#b8aa9c', 0.35), warm: '#e8d4b8', ink: PIGMENTS.sumi, nose: '#b98078', ear: '#e0a69c' };
  if (c === 'ginger') return { ...base, patch: '#d08a4a', patchLight: '#e6b27c', stripe: '#a95f2c', stripes: 0.35, eye: '#b9a23e', tipped: false };
  if (c === 'tabby') return { ...base, patch: '#8c7c68', patchLight: '#b0a28c', stripe: '#4a4036', stripes: 0.6, eye: '#a8a448', tipped: true };
  return { ...base, patch: '#3f3b42', patchLight: '#5e5a66', stripe: '#2a272c', stripes: 0, eye: '#c2a43a', tipped: false };
}

const P = (x: number, y: number): Pt => ({ x, y });
const pts = (a: readonly (readonly [number, number])[]): Pt[] => a.map(([x, y]) => P(x, y));

/** The head (3/4 view toward +x), around its centre; ears apart so they keep their points. */
const SKULL = pts([[3.6, 5.0], [6.4, 3.4], [7.6, 1.0], [7.4, -2.0], [6.2, -4.6], [3.0, -6.2], [-0.6, -6.6], [-4.2, -5.6], [-6.4, -2.4], [-6.6, 1.2], [-5.4, 3.8], [-2.0, 5.6]]);
const EAR_FAR = pts([[3.0, -5.4], [6.6, -11.0], [6.8, -3.6]]);
const EAR_NEAR = pts([[-5.8, -4.0], [-3.4, -12.2], [0.2, -6.2]]);
const EAR_NEAR_TIPPED = pts([[-5.8, -4.0], [-4.4, -9.6], [-2.6, -10.2], [0.2, -6.2]]);
/** the head drawn smaller than painted (painted large for the close view) */
const HEAD_K = 0.8;
/** where the head joins the neck, from its centre: the head sprite's origin */
const NECK_JOIN = P(-4.2, 3.6);

/** Walking torso, legs apart, feet level at y 0: chest toward +x. */
const TORSO = pts([[16.4, -15.8], [17.6, -20.2], [16.6, -24.4], [13.6, -26.4], [9.6, -26.2], [4, -25.6], [-2, -25.0], [-8, -25.4], [-13, -25.8], [-17.2, -24.4], [-20.2, -20.8], [-20.8, -16.6], [-19.4, -12.8], [-16.4, -11.0], [-12.6, -11.4], [-9.6, -13.2], [-4, -13.0], [2, -12.6], [7, -11.6], [11.8, -11.8], [15, -13.6]]);
const SHOULDER = P(10, -16);
const HIP = P(-14, -16.5);
const WALK_NECK = P(14.4, -22.8);
const WALK_TAIL = P(-18.2, -23);
/** The loaf: paws tucked, a rounded block. */
const LOAF = pts([[15.2, -1.0], [16.4, -5.6], [14.6, -11.6], [9, -15.6], [1, -17.2], [-7, -17.0], [-13.4, -14.8], [-17.4, -10.0], [-18.2, -4.4], [-16.4, -0.8], [-8, 0], [6, 0]]);
const LOAF_NECK = P(7.8, -11.6);
const LOAF_TAIL = P(-16.6, -1.6);
/** Sitting upright: big haunch behind, chest up, front legs straight (the near one apart). */
const SIT = pts([[11.6, -0.4], [11.2, -10], [11.0, -17], [9.0, -25.2], [5.6, -29.4], [1.0, -28.6], [-4.6, -22.6], [-9.8, -15.8], [-13.6, -9.6], [-14.2, -4.0], [-12.0, -0.6], [-4, 0.2], [4, 0.2]]);
const SIT_NECK = P(5.2, -25.4);
const SIT_TAIL = P(-12.4, -1.2);
const SIT_LEG = P(7.6, -16.5);
/** The curled sleeper, low and oval, the head tucked at the front end. */
const CURL = pts([[14.6, -2.6], [13.4, -8.4], [9.2, -12.2], [2, -14.0], [-6, -13.6], [-12.6, -10.6], [-15.6, -5.6], [-15.2, -1.0], [-8, 0.2], [4, 0.2], [11, -0.2]]);

interface FurOpts {
  /** coat patches: [cx, cy, rx, ry, rotation] */
  patches: readonly (readonly [number, number, number, number, number])[];
  /** fur strokes, each a short line of points */
  strokes: readonly Pt[][];
  /** broken lines where the white body turns away from the light */
  edges: readonly Pt[][];
  /** the direction tabby stripes run across (radians) */
  stripeAngle: number;
  /** stripes across the whole shape (a tail) */
  allOver?: boolean;
}

/** A white wash, the cool turn of the form underneath, coat patches bled in wet, a few dry strokes and broken edges. */
function fur(p: Painter, shape: Pt[], c: Coat, o: FurOpts): void {
  const rng = p.rng;
  const xs = shape.map((q) => q.x);
  const ys = shape.map((q) => q.y);
  const box = { x: Math.min(...xs) - 2, y: Math.min(...ys) - 2, w: Math.max(...xs) - Math.min(...xs) + 4, h: Math.max(...ys) - Math.min(...ys) + 4 };
  p.wash(shape, c.white, { rng, opacity: 0.97, edge: 0.28, edgeWidth: 0.5, sharpness: 0.35, centreLift: 0.05, granulation: 0.12, deform: 0.05, spread: 0.04, layers: 6, blend: 'source-over' });
  // cool where the body turns under, a warm bounce off the stone along the belly's edge
  p.glaze(shape, c.shade, { rng, opacity: 0.24, edge: 0.05, darken: 0, deform: 0.08, spread: 0.05, fade: { angle: -Math.PI / 2 - 0.25, start: 0.15, amount: 1, ragged: 0.7 } });
  p.glaze(shape, c.warm, { rng, opacity: 0.22, edge: 0, darken: 0, deform: 0.12, fade: { angle: -Math.PI / 2, start: 0.05, amount: 1, ragged: 0.8 } });
  if (o.patches.length > 0 || o.allOver) {
    const M = p.layer(box);
    M.clip(shape);
    if (o.allOver) M.fill(shape, c.patch, 0.9);
    for (const [x, y, rx, ry, rot] of o.patches) {
      M.fill(blob(x, y, rx, ry, rng, { rotation: rot, irregularity: 0.28, points: 18 }), c.patch, 0.9);
      M.fill(blob(x + rx * 0.15, y - ry * 0.3, rx * 0.55, ry * 0.4, rng, { rotation: rot, irregularity: 0.3 }), c.patchLight, 0.35);
    }
    // tabby bars, soft in the wet patch
    if (c.stripes > 0) {
      const n = Math.round(Math.max(box.w, box.h) / 2.6);
      for (let i = 0; i < n; i++) {
        const q = P(box.x + rng.range(0, box.w), box.y + rng.range(0, box.h));
        M.fill(blob(q.x, q.y, rng.range(1.6, 2.6), rng.range(0.32, 0.5), rng, { rotation: o.stripeAngle + rng.range(-0.2, 0.2), irregularity: 0.3, points: 10 }), c.stripe, c.stripes * rng.range(0.5, 0.9));
      }
    }
    M.dry({ opacity: 0.88, edge: 0.1, edgeWidth: 0.4, sharpness: 0.16, centreLift: 0.1, granulation: 0.35, granules: 0.1, flow: 0.55, flowScale: 2.5 });
    if (o.patches.length > 0) p.glaze(shape, c.shade, { rng, opacity: 0.22, edge: 0, darken: 0, deform: 0.06, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 } });
  }
  for (const s of o.strokes) p.dryBrush(s, { rng, pigment: mix(c.shade, c.ink, 0.2), width: 1.0, opacity: 0.12, dryness: 0.8, taper: [0.3, 0.6] });
  for (const e of o.edges) p.inkLine(e, { rng, width: 0.3, opacity: 0.3, breaks: 0.45, wobble: 0.25, pigment: mix(c.shade, c.ink, 0.45), taper: [0.3, 0.5] });
}

/** The head around its centre, sleeping (eyes shut) or awake. */
function paintHead(p: Painter, c: Coat, sleep: boolean): void {
  const rng = p.rng;
  const skull = smoothPolygon(SKULL, 2);
  const far = smoothPolygon(EAR_FAR, 1);
  const near = smoothPolygon(c.tipped ? EAR_NEAR_TIPPED : EAR_NEAR, 1);
  // the ears first, coat colour with pink inside, then the skull over their roots
  for (const [ear, k] of [
    [far, 0.75],
    [near, 1],
  ] as const) {
    p.wash(ear, mix(c.patch, c.white, 0.08), { rng, opacity: 0.92, edge: 0.5, edgeWidth: 0.4, sharpness: 0.4, deform: 0.04, spread: 0.03, layers: 4, blend: 'source-over' });
    const xs = ear.map((q) => q.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    p.dab(P(cx + 0.3, -6.6), c.ear, { rng, variant: 'leaf', angle: -Math.PI / 2 + (cx > 0 ? 0.2 : -0.3), length: 4.2 * k, width: 1.7 * k, opacity: 0.55, layers: 2, edge: 0.2 });
  }
  fur(p, skull, c, {
    // the cap: crown and the back of the head, a white blaze and muzzle left
    patches: [
      [-2.8, -5.4, 4.4, 2.4, 0.3],
      [4.6, -5.9, 2.2, 1.3, -0.4],
    ],
    strokes: [[P(-5.6, 1.4), P(-4.2, 3.6)], [P(5.8, 3.0), P(4.0, 4.6)]],
    edges: [[P(-2.0, 5.6), P(1.6, 5.4), P(3.6, 5.0)]],
    stripeAngle: -0.3,
  });
  // the eyes: shut, a downward curve; open, an amber-green almond with a slit
  const eyes = [
    { at: P(-0.6, -0.8), k: 1 },
    { at: P(4.8, -1.0), k: 0.7 },
  ];
  for (const e of eyes) {
    const w = 1.6 * e.k;
    if (sleep) {
      p.inkLine([P(e.at.x - w, e.at.y - 0.2), P(e.at.x, e.at.y + 0.45), P(e.at.x + w, e.at.y - 0.1)], { rng, width: 0.36, opacity: 0.75, breaks: 0, pigment: c.ink, taper: [0.3, 0.3] });
    } else {
      p.dab(P(e.at.x - 1.1 * e.k, e.at.y), c.eye, { rng, variant: 'round', angle: 0, length: 2.6 * e.k, width: 2.1, opacity: 0.9, layers: 3, edge: 0.35, blend: 'source-over' });
      p.dab(P(e.at.x, e.at.y + 1.0), c.ink, { rng, variant: 'leaf', angle: -Math.PI / 2, length: 1.9, width: 0.5 * e.k, opacity: 0.85, layers: 2, edge: 0.2 });
      p.inkLine([P(e.at.x - w, e.at.y + 0.2), P(e.at.x - w * 0.2, e.at.y - 0.9), P(e.at.x + w * 0.9, e.at.y - 0.1)], { rng, width: 0.18, opacity: 0.3, breaks: 0.2, pigment: c.ink, taper: [0.2, 0.3] });
    }
  }
  // nose, mouth, whiskers only suggested
  p.dab(P(6.3, 0.9), c.nose, { rng, variant: 'round', angle: 0, length: 1.0, width: 0.8, opacity: 0.8, layers: 2, edge: 0.3, blend: 'source-over' });
  p.inkLine([P(6.8, 1.9), P(6.5, 2.9), P(5.6, 3.4)], { rng, width: 0.2, opacity: 0.4, breaks: 0.2, pigment: c.ink, taper: [0.2, 0.5] });
  for (const [dy, len] of [
    [-0.4, 7.5],
    [0.5, 7],
    [1.4, 6],
  ] as const) {
    p.inkLine([P(6.2, 2.4 + dy * 0.3), P(6.2 + len * 0.55, 2.2 + dy), P(6.2 + len, 2.6 + dy * 1.8)], { rng, width: 0.1, opacity: 0.32, breaks: 0.3, pigment: c.ink, taper: [0.1, 0.8] });
  }
}

/** A tail along a centre line (`line`), round-tipped, all in coat colour with darker rings for a tabby. */
function paintTail(p: Painter, c: Coat, line: readonly Pt[], w0: number, w1: number): void {
  const left: Pt[] = [];
  const right: Pt[] = [];
  line.forEach((q, i) => {
    const a = line[Math.max(0, i - 1)]!;
    const b = line[Math.min(line.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const w = lerp(w0, w1, i / (line.length - 1)) / 2;
    const nx = -(b.y - a.y) / l;
    const ny = (b.x - a.x) / l;
    left.push(P(q.x + nx * w, q.y + ny * w));
    right.push(P(q.x - nx * w, q.y - ny * w));
  });
  const end = line[line.length - 1]!;
  const prev = line[line.length - 2]!;
  const l = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const tip = P(end.x + ((end.x - prev.x) / l) * w1 * 0.6, end.y + ((end.y - prev.y) / l) * w1 * 0.6);
  const shape = smoothPolygon([...left, tip, ...right.reverse()], 1);
  fur(p, shape, c, { patches: [], strokes: [], edges: [], stripeAngle: 0, allOver: true });
  if (c.stripes > 0) {
    for (let i = 2; i < line.length - 1; i += 2) {
      const a = line[i - 1]!;
      const b = line[i + 1]!;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const q = line[i]!;
      const w = lerp(w0, w1, i / (line.length - 1)) * 0.55;
      p.inkLine([P(q.x - Math.cos(ang) * w, q.y - Math.sin(ang) * w), P(q.x + Math.cos(ang) * w, q.y + Math.sin(ang) * w)], { rng: p.rng, width: 0.8, opacity: 0.4 * c.stripes, breaks: 0.2, pigment: c.stripe, taper: [0.3, 0.3] });
    }
  }
}

/** A smooth centre line through `ctrl` (Catmull-Rom), `n` points. */
function curve(ctrl: readonly Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * (ctrl.length - 1);
    const i = Math.min(ctrl.length - 2, Math.floor(t));
    const u = t - i;
    const p0 = ctrl[Math.max(0, i - 1)]!;
    const p1 = ctrl[i]!;
    const p2 = ctrl[i + 1]!;
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]!;
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    out.push(P(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y)));
  }
  return out;
}

const TAIL_UP = curve(pts([[0, 0], [-4, -6], [-5.6, -13.2], [-4.6, -19.6], [-2, -23.2], [0.4, -23.6]]), 12);
/** wrapped round on the ground from the root forward; the tip apart so it can twitch */
const TAIL_WRAP = curve(pts([[0, 0], [5, 0.8], [12, 1.0], [19, 0.6], [23.4, 0]]), 10);
const TAIL_TIP = curve(pts([[0, 0], [2.6, -0.3], [5, -1.2], [6.6, -2.6]]), 6);

type Shape = readonly (readonly [number, number])[];

/** The washing paw (sitting), drawn down from its shoulder. */
function paintForeleg(p: Painter, c: Coat): void {
  const shape = smoothPolygon(pts([[-2.2, -2], [2.2, -2], [1.9, 6], [1.4, 12.6], [2.6, 14.8], [3.0, 16.2], [-1.3, 16.4], [-1.3, 13.6], [-1.5, 6]]), 1);
  fur(p, shape, c, { patches: [], strokes: [[P(0.6, 2), P(0.4, 9)]], edges: [[P(2.0, 5), P(1.5, 12)]], stripeAngle: 0 });
  p.inkLine([P(0.6, 16.3), P(3.0, 16.2)], { rng: p.rng, width: 0.3, opacity: 0.35, breaks: 0.3, pigment: c.ink });
}

// The walking legs: one sprite per bone, each drawn down from its upper joint (+x forward).
const UPPER_ARM: Shape = [[-2.6, -1.8], [1.4, -2.2], [2.4, 0.4], [1.9, 3.6], [1.5, 6.6], [0.9, 8.4], [-0.6, 8.8], [-1.9, 8.0], [-2.2, 4.2], [-2.7, 0.6]];
const FOREARM: Shape = [[-1.5, -0.9], [1.3, -1.0], [1.35, 3], [1.0, 6.8], [1.15, 8.6], [0.2, 9.5], [-1.0, 9.0], [-1.15, 6.4], [-1.55, 3]];
const PAW: Shape = [[-1.1, -0.9], [1.0, -1.0], [1.7, 0.1], [2.7, 0.6], [3.5, 1.1], [3.6, 1.8], [2.8, 2.05], [0.6, 2.05], [-0.9, 1.7], [-1.35, 0.5]];
const PALM: Shape = [[-1.1, -0.9], [1.0, -1.0], [1.7, 0.0], [2.5, 0.6], [2.7, 1.6], [2.0, 2.05], [0.6, 2.05], [-0.9, 1.7], [-1.35, 0.5]];
const THIGH: Shape = [[-3.6, -3.2], [2.6, -3.6], [4.0, -0.6], [3.6, 3.0], [2.4, 5.8], [1.2, 7.6], [-0.4, 7.8], [-1.6, 6.2], [-2.8, 3.2], [-3.9, 0]];
const SHIN: Shape = [[-1.7, -1.0], [1.6, -1.2], [1.3, 2.8], [0.7, 5.6], [0.7, 7.0], [-0.2, 7.9], [-1.5, 7.7], [-1.7, 5.4], [-1.8, 2.6]];
const META: Shape = [[-1.5, -0.9], [0.9, -0.8], [1.2, 2.4], [2.0, 5.0], [3.0, 6.1], [4.0, 6.8], [4.1, 7.6], [3.2, 7.85], [1.2, 7.85], [-0.2, 7.5], [-0.9, 5.6], [-1.3, 3.0], [-1.7, 0.8]];
/** Bone lengths (joint to joint) and where the sole meets the ground from the wrist or the hock. */
export const BONES = { upperArm: 7.4, forearm: 8.4, thigh: 6.6, shin: 6.8 };
export const PAW_TOE = P(2.0, 2.05);
export const META_TOE = P(2.6, 7.85);
// The front and back views: legs as columns down from the body, the head turned to or from us.
const LEG_FRONT: Shape = [[-2.1, -1], [2.1, -1], [1.9, 5], [1.6, 10.2], [2.1, 12.0], [2.5, 13.3], [1.9, 14.0], [-1.9, 14.0], [-2.5, 13.3], [-2.1, 12.0], [-1.6, 10.2], [-1.9, 5]];
const LEG_BACK: Shape = [[-2.8, -1.5], [2.8, -1.5], [2.5, 3], [1.8, 5.4], [1.9, 6.4], [1.5, 9.2], [2.1, 10.3], [1.7, 11.0], [-1.7, 11.0], [-2.1, 10.3], [-1.5, 9.2], [-1.9, 6.4], [-1.8, 5.4], [-2.5, 3]];
export const LEG_FRONT_LEN = 14;
export const LEG_BACK_LEN = 11;
const BODY_FRONT: Shape = [[0, -11.4], [4.8, -11.8], [7.4, -14], [8.4, -17.4], [7.6, -20.6], [5, -22.8], [0, -23.6], [-5, -22.8], [-7.6, -20.6], [-8.4, -17.4], [-7.4, -14], [-4.8, -11.8]];
const BODY_BACK: Shape = [[0, -8.8], [5.2, -9.4], [8.2, -11.8], [8.8, -15.4], [7.6, -18.6], [5, -20.8], [0, -21.6], [-5, -20.8], [-7.6, -18.6], [-8.8, -15.4], [-8.2, -11.8], [-5.2, -9.4]];
const SKULL_FRONT = pts([[0, 6.2], [3.8, 5.4], [6.2, 3.0], [7.0, -0.4], [6.4, -3.6], [4.4, -5.8], [0, -6.6], [-4.4, -5.8], [-6.4, -3.6], [-7.0, -0.4], [-6.2, 3.0], [-3.8, 5.4]]);
const SKULL_BACK = pts([[0, 6.0], [4.2, 5.0], [6.6, 2.4], [7.0, -1.0], [6.2, -4.2], [3.8, -6.2], [0, -6.8], [-3.8, -6.2], [-6.2, -4.2], [-7.0, -1.0], [-6.6, 2.4], [-4.2, 5.0]]);
const EARS_FRONT = [pts([[-6.2, -3.4], [-5.6, -11.6], [-1.8, -6.0]]), pts([[6.2, -3.4], [5.6, -11.6], [1.8, -6.0]])];
const EAR_TIPPED_FRONT = pts([[6.2, -3.4], [5.9, -9.2], [4.4, -10.0], [1.8, -6.0]]);
/** where the front or back head joins the neck, from its centre */
const NECK_FRONT = P(0, 5.0);

/** A box round a shape, `m` units of margin for the wash's spread. */
function boxOf(shape: Shape, m = 0.8): { w: number; h: number; ox: number; oy: number } {
  const xs = shape.map((q) => q[0]);
  const ys = shape.map((q) => q[1]);
  const x0 = Math.min(...xs) - m;
  const y0 = Math.min(...ys) - m;
  return { w: Math.max(...xs) + m - x0, h: Math.max(...ys) + m - y0, ox: -x0, oy: -y0 };
}

const farCoat = (c: Coat, far: boolean): Coat => (far ? { ...c, white: mix(c.white, c.shade, 0.45) } : c);

function paintLimb(p: Painter, c: Coat, shape: Shape, stroke: Pt[], edge: Pt[]): void {
  fur(p, smoothPolygon(pts(shape), 1), c, { patches: [], strokes: [stroke], edges: [edge], stripeAngle: 0 });
}

/** A paw from the side, toes forward; spread, the toes fanned apart with the claws just out. */
function paintPaw(p: Painter, c: Coat, spread: boolean): void {
  const rng = p.rng;
  if (spread) {
    for (const [x, y, a] of [
      [3.3, 0.35, -0.7],
      [3.95, 1.0, -0.25],
      [4.05, 1.75, 0.15],
      [3.45, 2.2, 0.5],
    ] as const) {
      p.wash(blob(x, y, 0.85, 0.55, rng, { rotation: a, irregularity: 0.15, points: 10 }), c.white, { rng, opacity: 0.95, edge: 0.35, edgeWidth: 0.35, sharpness: 0.3, deform: 0.03, layers: 3, blend: 'source-over' });
      p.inkLine([P(x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.7), P(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5 + 0.2)], { rng, width: 0.16, opacity: 0.45, breaks: 0, pigment: c.ink, taper: [0.1, 0.9] });
    }
  }
  paintLimb(p, c, spread ? PALM : PAW, [P(0.2, 0.2), P(1.6, 0.8)], [P(0.4, 2.0), P(2.6, 2.0)]);
  if (!spread)
    for (const x of [2.5, 3.1]) p.inkLine([P(x, 1.0), P(x + 0.2, 1.95)], { rng, width: 0.16, opacity: 0.35, breaks: 0.2, pigment: mix(c.shade, c.ink, 0.5) });
}

/** The face turned to us: both eyes, the nose between them, the ears either side. */
function paintHeadFront(p: Painter, c: Coat): void {
  const rng = p.rng;
  const ears = c.tipped ? [EARS_FRONT[0]!, EAR_TIPPED_FRONT] : EARS_FRONT;
  for (const e of ears) {
    const ear = smoothPolygon(e, 1);
    p.wash(ear, mix(c.patch, c.white, 0.08), { rng, opacity: 0.92, edge: 0.5, edgeWidth: 0.4, sharpness: 0.4, deform: 0.04, spread: 0.03, layers: 4, blend: 'source-over' });
    const cx = e[1]!.x * 0.85;
    p.dab(P(cx + (cx < 0 ? 0.8 : -0.8), -7.2), c.ear, { rng, variant: 'leaf', angle: -Math.PI / 2 + (cx < 0 ? 0.25 : -0.25), length: 3.8, width: 1.6, opacity: 0.55, layers: 2, edge: 0.2 });
  }
  fur(p, smoothPolygon(SKULL_FRONT, 2), c, {
    patches: [
      [-3.4, -4.4, 3.4, 2.2, 0.35],
      [3.4, -4.4, 3.4, 2.2, -0.35],
    ],
    strokes: [[P(-5.8, 1.4), P(-4.4, 3.8)], [P(5.8, 1.4), P(4.4, 3.8)]],
    edges: [[P(-3.0, 5.6), P(0, 6.2), P(3.0, 5.6)]],
    stripeAngle: Math.PI / 2,
  });
  for (const x of [-2.7, 2.7]) {
    p.dab(P(x, -0.6), c.eye, { rng, variant: 'round', angle: 0, length: 2.4, width: 2.0, opacity: 0.9, layers: 3, edge: 0.35, blend: 'source-over' });
    p.dab(P(x, -0.4), c.ink, { rng, variant: 'leaf', angle: -Math.PI / 2, length: 1.8, width: 0.5, opacity: 0.85, layers: 2, edge: 0.2 });
    p.inkLine([P(x - 1.4, -0.4), P(x, -1.6), P(x + 1.4, -0.4)], { rng, width: 0.18, opacity: 0.3, breaks: 0.2, pigment: c.ink, taper: [0.2, 0.3] });
  }
  p.dab(P(0, 2.2), c.nose, { rng, variant: 'round', angle: 0, length: 1.3, width: 0.9, opacity: 0.8, layers: 2, edge: 0.3, blend: 'source-over' });
  p.inkLine([P(-1.2, 3.8), P(0, 3.2), P(1.2, 3.8)], { rng, width: 0.18, opacity: 0.4, breaks: 0.2, pigment: c.ink, taper: [0.3, 0.3] });
  for (const s of [-1, 1])
    for (const dy of [-0.3, 0.6]) p.inkLine([P(s * 1.6, 3.0 + dy * 0.3), P(s * 5.6, 2.6 + dy), P(s * 9.4, 3.2 + dy * 1.8)], { rng, width: 0.1, opacity: 0.3, breaks: 0.3, pigment: c.ink, taper: [0.1, 0.8] });
}

/** The back of the head: the cap and the ears' backs, a pale nape. */
function paintHeadBack(p: Painter, c: Coat): void {
  const rng = p.rng;
  for (const e of EARS_FRONT) p.wash(smoothPolygon(e, 1), mix(c.patch, c.shade, 0.15), { rng, opacity: 0.92, edge: 0.5, edgeWidth: 0.4, sharpness: 0.4, deform: 0.04, spread: 0.03, layers: 4, blend: 'source-over' });
  fur(p, smoothPolygon(SKULL_BACK, 2), c, {
    patches: [[0, -2.4, 6.6, 4.2, 0]],
    strokes: [[P(-3, 3.6), P(-1, 5.2)], [P(3, 3.6), P(1, 5.2)]],
    edges: [[P(-4.2, 5.0), P(0, 6.0), P(4.2, 5.0)]],
    stripeAngle: 0,
  });
}

export interface CatParts {
  head: Sprite; // awake, origin at the neck join
  headSleep: Sprite;
  headFront: Sprite; // turned to us or away, origin at the neck join
  headBack: Sprite;
  loaf: Sprite; // origin on the ground under the body
  curl: Sprite;
  sit: Sprite;
  sitLeg: Sprite; // the near foreleg when sitting, origin at its shoulder
  torso: Sprite;
  /** walking legs, a sprite per bone, near and far, origin at the upper joint */
  upperArm: [Sprite, Sprite];
  forearm: [Sprite, Sprite];
  paw: [Sprite, Sprite];
  pawSpread: [Sprite, Sprite];
  thigh: [Sprite, Sprite];
  shin: [Sprite, Sprite];
  meta: [Sprite, Sprite];
  /** the front and back views: bodies (origin on the ground), legs as columns (origin at the top) */
  bodyFront: Sprite;
  bodyBack: Sprite;
  legFront: [Sprite, Sprite];
  legBack: [Sprite, Sprite];
  pads: Sprite; // a hind foot lifted, from behind: the pads show
  tailUp: Sprite; // origin at its root
  tailWrap: Sprite;
  tailTip: Sprite;
  shadow: Sprite;
}

const headBox = { w: 23, h: 21, ox: 3.6, oy: 17.6 };
const headFrontBox = { w: 20, h: 20, ox: 10, oy: 17.4 };
/** Head painted around its centre, shifted so the sprite's origin is the neck join. */
const headAt = (p: Painter, join: Pt, f: () => void) => {
  p.ctx.save();
  p.ctx.translate(-join.x, -join.y);
  f();
  p.ctx.restore();
};

export function paintCat(res: number, seed: number, coatName: CatCoat): CatParts {
  const c = coat(coatName);
  const S = (box: { w: number; h: number; ox: number; oy: number }, k: number, f: (p: Painter) => void) => paintSprite(res, box, seed + k, (p) => f(p));
  const pair = (k: number, shape: Shape, f: (p: Painter, c: Coat) => void): [Sprite, Sprite] => [S(boxOf(shape), k, (p) => f(p, c)), S(boxOf(shape), k + 1, (p) => f(p, farCoat(c, true)))];
  return {
    head: S(headBox, 1, (p) => headAt(p, NECK_JOIN, () => paintHead(p, c, false))),
    headSleep: S(headBox, 1, (p) => headAt(p, NECK_JOIN, () => paintHead(p, c, true))),
    headFront: S(headFrontBox, 16, (p) => headAt(p, NECK_FRONT, () => paintHeadFront(p, c))),
    headBack: S(headFrontBox, 17, (p) => headAt(p, NECK_FRONT, () => paintHeadBack(p, c))),
    loaf: S({ w: 38, h: 20, ox: 20, oy: 18.5 }, 2, (p) =>
      fur(p, smoothPolygon(LOAF, 2), c, {
        patches: [
          [-6, -15, 10, 4.6, 0.05],
          [-15, -9, 3.6, 4.4, 0.3],
        ],
        strokes: [[P(9, -10), P(12, -5)], [P(-12, -11), P(-15, -6)], [P(2, -13), P(-4, -13.5)]],
        edges: [[P(-17.6, -4), P(-16, -0.6), P(-8, 0)], [P(12.6, -12.6), P(15.6, -7), P(15.6, -1.4)]],
        stripeAngle: Math.PI / 2 - 0.2,
      }),
    ),
    curl: S({ w: 40, h: 22, ox: 19, oy: 20 }, 3, (p) => {
      fur(p, smoothPolygon(CURL, 2), c, {
        patches: [
          [-4, -11.6, 9.5, 4, 0.08],
          [-12.6, -6, 3.2, 3.6, 0.4],
        ],
        strokes: [[P(-8, -10), P(-12, -6)], [P(4, -11), P(-2, -12.4)]],
        edges: [[P(-15.2, -3), P(-12, -0.2), P(-2, 0.2)]],
        stripeAngle: Math.PI / 2,
      });
      // the head tucked down at the front, chin on the paws; the tail round over the nose
      p.ctx.save();
      p.ctx.translate(10.4, -7.2);
      p.ctx.rotate(0.55);
      p.ctx.scale(HEAD_K, HEAD_K);
      paintHead(p, c, true);
      p.ctx.restore();
      paintTail(p, c, curve(pts([[-14.6, -2.6], [-6, -0.8], [4, -0.6], [11, -1.6], [15.6, -3.8]]), 12), 4.2, 3.0);
    }),
    sit: S({ w: 30, h: 34, ox: 15.6, oy: 31.6 }, 4, (p) =>
      fur(p, smoothPolygon(SIT, 2), c, {
        patches: [
          [-6, -18, 6.6, 7.2, -0.7],
          [-11, -8, 3.6, 4.8, -0.2],
        ],
        strokes: [[P(-9, -14), P(-12, -8)], [P(3, -22), P(0, -16)], [P(9.6, -18), P(10, -10)]],
        edges: [[P(-13.6, -6), P(-12, -0.6), P(-4, 0.2)], [P(6.4, -14), P(6.8, -6), P(7.4, -0.6)]],
        stripeAngle: 0.4,
      }),
    ),
    sitLeg: S({ w: 8, h: 21, ox: 3.4, oy: 2.6 }, 5, (p) => paintForeleg(p, c)),
    torso: S({ w: 40, h: 18, ox: 21.4, oy: 28.6 }, 7, (p) =>
      fur(p, smoothPolygon(TORSO, 2), c, {
        patches: [
          [-4.6, -24, 9.6, 3.4, 0.0],
          [-15.4, -21.4, 4.0, 4.2, 0.3],
        ],
        strokes: [[P(-15, -19), P(-18, -15)], [P(12.6, -20), P(14.2, -16)], [P(5.5, -24), P(0, -24.2)]],
        edges: [[P(-19, -13), P(-16.4, -11.2), P(-12.6, -11.6)], [P(-2, -13.0), P(5, -12.2), P(11, -12.0)]],
        stripeAngle: Math.PI / 2,
      }),
    ),
    upperArm: pair(20, UPPER_ARM, (p, k) => paintLimb(p, k, UPPER_ARM, [P(0.4, 0.5), P(0.2, 5)], [P(-2.0, 2), P(-1.6, 7.6)])),
    forearm: pair(22, FOREARM, (p, k) => paintLimb(p, k, FOREARM, [P(0.3, 1), P(0.2, 6.5)], [P(1.2, 2.5), P(1.0, 7.5)])),
    paw: pair(24, PAW, (p, k) => paintPaw(p, k, false)),
    pawSpread: pair(26, [...PALM, [4.9, 1.5]], (p, k) => paintPaw(p, k, true)),
    thigh: pair(28, THIGH, (p, k) => paintLimb(p, k, THIGH, [P(-1, 0), P(0.2, 5)], [P(3.4, 0.5), P(2.2, 5.8)])),
    shin: pair(30, SHIN, (p, k) => paintLimb(p, k, SHIN, [P(-0.4, 0.5), P(-0.6, 5.5)], [P(-1.6, 3), P(-1.4, 7.4)])),
    meta: pair(32, META, (p, k) => {
      paintLimb(p, k, META, [P(-0.2, 1), P(0.6, 5)], [P(0.6, 7.8), P(3.4, 7.8)]);
      for (const x of [2.9, 3.5]) p.inkLine([P(x, 6.8), P(x + 0.2, 7.8)], { rng: p.rng, width: 0.16, opacity: 0.35, breaks: 0.2, pigment: mix(k.shade, k.ink, 0.5) });
    }),
    bodyFront: S(boxOf(BODY_FRONT), 34, (p) =>
      fur(p, smoothPolygon(pts(BODY_FRONT), 2), c, {
        patches: [
          [0, -22.6, 6.4, 1.8, 0],
          [-6.8, -18.4, 1.8, 3.2, 0.2],
          [6.8, -18.4, 1.8, 3.2, -0.2],
        ],
        strokes: [[P(-5.6, -16), P(-5, -12.8)], [P(5.6, -16), P(5, -12.8)]],
        edges: [[P(-6.6, -13.4), P(-3.4, -11.8), P(0, -11.6)], [P(6.6, -13.4), P(3.4, -11.8)]],
        stripeAngle: 0,
      }),
    ),
    bodyBack: S(boxOf(BODY_BACK), 35, (p) =>
      fur(p, smoothPolygon(pts(BODY_BACK), 2), c, {
        patches: [
          [0, -19.4, 6.6, 2.6, 0],
          [3.4, -14.6, 4.4, 3.4, 0.2],
        ],
        strokes: [[P(-6, -15), P(-6.6, -11.4)], [P(6, -15), P(6.6, -11.4)]],
        edges: [[P(-7.8, -12), P(-5, -9.2), P(0, -9.0)], [P(7.8, -12), P(5, -9.2)]],
        stripeAngle: 0,
      }),
    ),
    legFront: pair(36, LEG_FRONT, (p, k) => {
      paintLimb(p, k, LEG_FRONT, [P(0, 1), P(0, 9)], [P(1.4, 4), P(1.3, 11)]);
      for (const x of [-0.8, 0.8]) p.inkLine([P(x, 12.6), P(x, 13.9)], { rng: p.rng, width: 0.16, opacity: 0.35, breaks: 0.2, pigment: mix(k.shade, k.ink, 0.5) });
    }),
    legBack: pair(38, LEG_BACK, (p, k) => paintLimb(p, k, LEG_BACK, [P(0, 0), P(0, 6)], [P(-1.5, 5.6), P(-1.3, 10)])),
    pads: S(boxOf(LEG_BACK), 40, (p) => {
      paintLimb(p, c, LEG_BACK, [P(0, 0), P(0, 6)], [P(-1.5, 5.6), P(-1.3, 10)]);
      const pad = mix(c.nose, c.ink, 0.35);
      p.dab(P(0, 9.6), pad, { rng: p.rng, variant: 'round', angle: 0, length: 2.0, width: 1.5, opacity: 0.6, layers: 2, edge: 0.3 });
      for (const x of [-1, 0, 1]) p.dab(P(x, 10.7), pad, { rng: p.rng, variant: 'round', angle: 0, length: 0.7, width: 0.6, opacity: 0.55, layers: 1, edge: 0.3 });
    }),
    tailUp: S({ w: 11, h: 28, ox: 7.4, oy: 26 }, 12, (p) => paintTail(p, c, TAIL_UP, 3.4, 2.6)),
    tailWrap: S({ w: 28, h: 7, ox: 2.6, oy: 3.4 }, 13, (p) => paintTail(p, c, TAIL_WRAP, 4.4, 3.4)),
    tailTip: S({ w: 11, h: 8, ox: 1.6, oy: 5 }, 14, (p) => paintTail(p, c, TAIL_TIP, 3.4, 2.6)),
    shadow: S({ w: 46, h: 6, ox: 23, oy: 3 }, 15, (p) =>
      p.wash(smoothPolygon(pts([[-21, 0], [-12, -1.6], [8, -1.8], [20, -0.4], [9, 1.6], [-12, 1.4]]), 1), PIGMENTS.shadow, {
        rng: p.rng,
        opacity: 0.32,
        edge: 0,
        darken: 0,
        deform: 0.2,
        spread: 0.15,
        layers: 5,
        fade: { angle: Math.PI, start: 0.4, ragged: 0.6 },
      }),
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// drawing (pure: the studio draws poses with it)

export type CatShape = 'loaf' | 'curl' | 'sit' | 'wash' | 'bow' | 'walk' | 'stand' | 'reach' | 'crouch' | 'leap' | 'rig';
/** Side-on, or walking toward the viewer (`front`) or away (`back`). */
export type CatView = 'side' | 'front' | 'back';

/** A foot in the ground frame (y up is negative): where the sole meets the ground, and the paw's (fore) or the hock's (hind) turn. */
export interface Foot {
  x: number;
  y: number;
  r: number;
}

/** The side-on rig's joints: girdle heights over the ground, the torso shifted along, the feet, head and tail. */
export interface Rig {
  sh: number;
  hip: number;
  x: number;
  /** hindFar, foreFar, hindNear, foreNear */
  feet: Foot[];
  /** the head's tilt (+ chin down), added to the pose's */
  head: number;
  /** the raised tail's angle (0 up, − leaning back), and how far it is wrapped on the ground instead (0..1) */
  tail: number;
  tailDown: number;
  /** the shoulder blades slid down the chest (sitting up: the forelegs stand under it) */
  drop?: number;
}

export interface CatPose {
  shape: CatShape;
  /** eyes shut */
  sleep: boolean;
  /** breath (−1..1): the body swells a little */
  breath: number;
  /** head tilt (+ chin down) and a quick flick (an ear twitch reads as one) */
  head: number;
  /** tail tip lifted (rad) on the wrapped tail; the raised tail's sway */
  tip: number;
  sway: number;
  /** walk cycle phase (cycles) */
  walk: number;
  /** body pitch (+ nose down) and lift above its feet's line (units) in a leap */
  pitch: number;
  lift: number;
  /** paw raised to wash (0..1) and the lick's stroke (0..1) */
  paw: number;
  /** its shadow (0 in the air) */
  shadow: number;
  view: CatView;
  /** where a walk goes on the picture in the cat's own frame (x forward, y toward the viewer), a unit vector */
  dir: Pt;
  /** joints given outright (an in-between); else they follow from the shape */
  rig: Rig | null;
}

export const REST_POSE: CatPose = { shape: 'loaf', sleep: true, breath: 0, head: 0, tip: 0, sway: 0, walk: 0, pitch: 0, lift: 0, paw: 0, shadow: 1, view: 'side', dir: { x: 1, y: 0 }, rig: null };

/** The poses painted whole (the others are the rig). */
export const SPRITE_SHAPES: readonly CatShape[] = ['loaf', 'curl', 'sit', 'wash'];

const img = (ctx: Ctx, s: Sprite) => ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);

function at(ctx: Ctx, s: Sprite, q: Pt, rot = 0, sx = 1, sy = 1): void {
  ctx.save();
  ctx.translate(q.x, q.y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  img(ctx, s);
  ctx.restore();
}

/** The walk: a lateral sequence (near hind, near fore, far hind, far fore), each fore a little over a quarter cycle behind its hind. */
export const GAIT = {
  /** body travel per cycle side-on (cat units; the world's is `CAT_TUNING.stride`) */
  stride: CAT_TUNING.stride / CAT_K,
  /** share of a cycle each foot is down */
  duty: 0.6,
  /** touchdown of each leg (hindFar, foreFar, hindNear, foreNear) in the cycle */
  touch: [0.5, 0.77, 0, 0.27] as const,
  /** paws lifted in the swing (units), fore and hind */
  lift: [3.2, 2.8] as const,
  /** the ground's foreshortening: a walk at the viewer covers this much picture per unit walked */
  depth: 0.45,
};
/** Where the feet stand at mid-stance; the hind lands in the print its fore has just left (see `walkFoot`). */
export const FORE_X = 8.6;
export const HIND_X = FORE_X - GAIT.stride * (1 - (GAIT.touch[3] - GAIT.touch[2]));
/** the far legs' feet stand this much higher on the picture (further from the viewer) */
const FAR_UP = 0.9;

const frac = (v: number) => v - Math.floor(v);

/** How far into its stance a leg is: 0 at touchdown and lift-off, 1 at mid-stance, 0 in the swing. */
function stanceMid(leg: number, ph: number): number {
  const s = frac(ph - GAIT.touch[leg]!);
  return s < GAIT.duty ? Math.sin((Math.PI * s) / GAIT.duty) : 0;
}

/**
 * One foot of the walk (leg: hindFar, foreFar, hindNear, foreNear) at phase `ph`, the body
 * travelling `V` a cycle (cat units). Down, it sweeps back exactly as far as the body goes, so it
 * stays planted; in the swing it eases from print to print in the world, lifted.
 */
export function walkFoot(leg: number, ph: number, V: Pt): Foot {
  const D = GAIT.duty;
  const s = frac(ph - GAIT.touch[leg]!);
  const fore = leg % 2 === 1;
  const nx = fore ? FORE_X : HIND_X;
  if (s < D) {
    const u = D / 2 - s;
    const late = clamp((s / D - 0.5) / 0.5, 0, 1);
    return { x: nx + u * V.x, y: u * V.y, r: (fore ? 0.45 : 0.35) * late * late };
  }
  const k = (s - D) / (1 - D);
  const u = easeInOut(k) - (1 - D) * k - D / 2;
  const lift = Math.sin(Math.PI * k) * GAIT.lift[fore ? 0 : 1];
  const r = fore ? 0.45 * (1 - k) + 1.35 * Math.sin(Math.PI * Math.min(1, k / 0.8)) : 0.35 * (1 - k) + 0.9 * Math.sin(Math.PI * Math.min(1, k / 0.85));
  return { x: nx + u * V.x, y: u * V.y - lift, r };
}

/** Body travel per cycle (cat units) for a walk going `dir` on the picture: shorter toward the viewer. */
export function travelPerCycle(dir: Pt): Pt {
  const m = Math.hypot(dir.x, dir.y / GAIT.depth) || 1;
  return P((GAIT.stride * dir.x) / m, (GAIT.stride * dir.y) / m);
}

export function walkRig(ph: number, dir: Pt): Rig {
  const V = travelPerCycle(dir);
  const up = (a: number, b: number) => Math.max(stanceMid(a, ph), stanceMid(b, ph)) - 0.65;
  return { sh: 16 + 0.7 * up(1, 3), hip: 16.5 + 0.6 * up(0, 2), x: 0, feet: [0, 1, 2, 3].map((i) => walkFoot(i, ph, V)), head: 0, tail: 0.12 + 0.05 * Math.sin(ph * TAU), tailDown: 0 };
}

const F = (x: number, y = 0, r = 0): Foot => ({ x, y, r });
const rig = (sh: number, hip: number, x: number, feet: Foot[], head = 0, tail = 0.12, tailDown = 0): Rig => ({ sh, hip, x, feet, head, tail, tailDown });
/** The rig's poses: standing, the stretch and its follow-through, the jump, and the in-betweens that meet the painted poses. */
export const RIGS = {
  stand: rig(16, 16.5, 0, [F(HIND_X - 1.2), F(FORE_X + 1.4), F(HIND_X + 1), F(FORE_X - 0.4)]),
  /** the front stretch: forelegs out along the ground, chest down, rump up, the tail up and curved */
  bow: rig(6, 20, -1, [F(-15.4, 0, 0.25), F(24, 0, 0), F(-14.2, 0, 0.2), F(21.2, 0, 0)], -0.2, -0.3),
  /** the follow-through: the long back stretch, a hind leg trailing on its toes */
  reach: rig(15.2, 14, 2.5, [F(HIND_X - 1), F(FORE_X + 3.6), F(HIND_X - 17, 0, 1.3), F(FORE_X + 2)], 0.05, -0.25),
  crouch: rig(11, 10.5, 0, [F(HIND_X - 1, 0, -0.8), F(FORE_X + 2.4, 0, 0.1), F(HIND_X + 1, 0, -0.8), F(FORE_X + 1, 0, 0.1)], 0.2, -0.5),
  leap: rig(16, 16, 0, [F(HIND_X - 9, -2, 0.9), F(FORE_X + 8, -2.4, 0.2), F(HIND_X - 7.6, -1.6, 0.9), F(FORE_X + 6.6, -1.8, 0.2)], 0, -1.1),
  /** meets the painted sit, the loaf and the curl, for the moment the painting takes over */
  sit: { ...rig(21, 3.5, 0, [F(-4.4, 0, -1.2), F(FORE_X - 0.2), F(-3, 0, -1.2), F(FORE_X - 1.2)], 0, -0.6, 1), drop: 3.6 },
  loaf: rig(5.5, 6, -2, [F(-9, 0, -1.2), F(FORE_X + 2.6, 0, 1.5), F(-8, 0, -1.2), F(FORE_X + 3.6, 0, 1.5)], 0, -0.6, 1),
  curl: rig(4.2, 4.6, -2, [F(-9, 0, -1.2), F(FORE_X + 2, 0, 1.5), F(-8, 0, -1.2), F(FORE_X + 3, 0, 1.5)], 0.5, -0.6, 1),
};

export function lerpRig(a: Rig, b: Rig, k: number): Rig {
  return {
    sh: lerp(a.sh, b.sh, k),
    hip: lerp(a.hip, b.hip, k),
    x: lerp(a.x, b.x, k),
    feet: a.feet.map((f, i) => ({ x: lerp(f.x, b.feet[i]!.x, k), y: lerp(f.y, b.feet[i]!.y, k), r: lerp(f.r, b.feet[i]!.r, k) })),
    head: lerp(a.head, b.head, k),
    tail: lerp(a.tail, b.tail, k),
    tailDown: lerp(a.tailDown, b.tailDown, k),
    drop: lerp(a.drop ?? 0, b.drop ?? 0, k),
  };
}

/** The rig a pose stands for: its own, the walk's, or the in-between that meets a painted pose. */
export function rigOf(q: CatPose): Rig {
  if (q.rig) return q.rig;
  switch (q.shape) {
    case 'walk':
      return walkRig(q.walk, q.dir);
    case 'sit':
    case 'wash':
      return RIGS.sit;
    case 'loaf':
    case 'curl':
    case 'bow':
    case 'reach':
    case 'crouch':
    case 'leap':
      return RIGS[q.shape];
    default:
      return RIGS.stand;
  }
}

/** The middle joint of a two-bone limb from `a` to `b` (lengths l1, l2), bending to the side `bend` (+1: back, for a leg pointing down). */
export function ik2(a: Pt, b: Pt, l1: number, l2: number, bend: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d0 = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d0;
  const uy = dy / d0;
  const d = clamp(d0, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return P(a.x + ux * along - bend * uy * h, a.y + uy * along + bend * ux * h);
}

const rot = (v: Pt, r: number): Pt => P(v.x * Math.cos(r) - v.y * Math.sin(r), v.x * Math.sin(r) + v.y * Math.cos(r));
const D_GIRDLE = Math.hypot(SHOULDER.x - HIP.x, SHOULDER.y - HIP.y);
const PITCH0 = Math.asin((HIP.y - SHOULDER.y) / D_GIRDLE);

/** Where the torso's own points land for a rig: its pitch (+ nose down) and a mapping. */
export function torsoOf(r: Rig): { pitch: number; to: (p: Pt) => Pt } {
  const pitch = -(Math.asin(clamp((r.sh - r.hip) / D_GIRDLE, -1, 1)) - PITCH0);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  return { pitch, to: (p) => P(HIP.x + r.x + (p.x - HIP.x) * c - (p.y - HIP.y) * s, -r.hip + (p.x - HIP.x) * s + (p.y - HIP.y) * c) };
}

export interface LegJoints {
  /** shoulder or hip, elbow or knee, wrist or hock, and the sole on the ground */
  top: Pt;
  mid: Pt;
  low: Pt;
  foot: Pt;
  r: number;
}

/** A leg's joints for a rig (leg: hindFar, foreFar, hindNear, foreNear): the shoulder blade or pelvis slides with it. */
export function legJoints(r: Rig, leg: number, torso = torsoOf(r)): LegJoints {
  const fore = leg % 2 === 1;
  const f = r.feet[leg]!;
  const foot = P(f.x, f.y - (leg < 2 ? FAR_UP : 0));
  const j = torso.to(fore ? SHOULDER : HIP);
  const top = P(j.x + clamp((f.x - (fore ? FORE_X : HIND_X)) * (fore ? 0.3 : 0.2), -2.6, 2.6), j.y + (fore ? (r.drop ?? 0) : 0));
  const toe = rot(fore ? PAW_TOE : META_TOE, f.r);
  const low = P(foot.x - toe.x, foot.y - toe.y);
  const mid = fore ? ik2(top, low, BONES.upperArm, BONES.forearm, 1) : ik2(top, low, BONES.thigh, BONES.shin, -1);
  return { top, mid, low, foot, r: f.r };
}

/** A bone sprite (drawn down from its origin) laid from `a` toward `b`. */
function bone(ctx: Ctx, s: Sprite, a: Pt, b: Pt): void {
  at(ctx, s, a, Math.atan2(-(b.x - a.x), b.y - a.y));
}

function drawLeg(ctx: Ctx, parts: CatParts, r: Rig, torso: ReturnType<typeof torsoOf>, leg: number, spread: boolean): void {
  const j = legJoints(r, leg, torso);
  const k = leg < 2 ? 1 : 0;
  if (leg % 2 === 1) {
    at(ctx, (spread ? parts.pawSpread : parts.paw)[k], j.low, j.r);
    bone(ctx, parts.forearm[k], j.mid, j.low);
    bone(ctx, parts.upperArm[k], j.top, j.mid);
  } else {
    at(ctx, parts.meta[k], j.low, j.r);
    bone(ctx, parts.shin[k], j.mid, j.low);
    bone(ctx, parts.thigh[k], j.top, j.mid);
  }
}

/** The side-on rig: the four legs from their joints to their feet, the tail, torso and head. */
function drawRig(ctx: Ctx, parts: CatParts, q: CatPose, r: Rig): void {
  const torso = torsoOf(r);
  const spread = q.shape === 'bow';
  ctx.save();
  ctx.translate(0, -q.lift);
  if (q.pitch) ctx.rotate(q.pitch);
  drawLeg(ctx, parts, r, torso, 0, spread);
  drawLeg(ctx, parts, r, torso, 1, spread);
  const root = torso.to(WALK_TAIL);
  const hip = torso.to(HIP);
  const a = ctx.globalAlpha;
  if (r.tailDown < 1) {
    ctx.globalAlpha = a * (1 - r.tailDown);
    at(ctx, parts.tailUp, root, r.tail + torso.pitch * 0.6 + q.sway);
  }
  if (r.tailDown > 0) {
    ctx.globalAlpha = a * r.tailDown;
    const g = P(hip.x - 1.5, -1.2);
    at(ctx, parts.tailWrap, g, -0.02);
    at(ctx, parts.tailTip, P(g.x + 23.2, g.y - 0.2), -0.25 - q.tip);
  }
  ctx.globalAlpha = a;
  drawLeg(ctx, parts, r, torso, 2, spread);
  drawLeg(ctx, parts, r, torso, 3, spread);
  ctx.save();
  ctx.translate(HIP.x + r.x, -r.hip);
  ctx.rotate(torso.pitch);
  ctx.translate(-HIP.x, -HIP.y);
  img(ctx, parts.torso);
  ctx.restore();
  // the head stays level whatever the body does
  at(ctx, q.sleep ? parts.headSleep : parts.head, torso.to(WALK_NECK), r.head + q.head - q.pitch * 0.5, HEAD_K, HEAD_K);
  ctx.restore();
}

/** The front view's and back view's feet: a stride's offsets from each foot's place, as `walkFoot` gives them side-on. */
function viewFeet(q: CatPose): Pt[] {
  if (q.shape !== 'walk') return [P(0, 0), P(0, 0), P(0, 0), P(0, 0)];
  const V = travelPerCycle(q.dir);
  return [0, 1, 2, 3].map((i) => {
    const f = walkFoot(i, q.walk, V);
    return P(f.x - (i % 2 === 1 ? FORE_X : HIND_X), f.y);
  });
}

/** How far up the hind feet stand behind the fore ones in the front view (and the fore behind the hind from the back). */
const VIEW_DEPTH = 6.5;

/** Walking toward the viewer: the face over the chest, the forelegs as columns, the hind feet behind, the tail up behind the back. */
function drawFront(ctx: Ctx, parts: CatParts, q: CatPose): void {
  const o = viewFeet(q);
  const bob = q.shape === 'walk' ? -0.5 * (Math.max(stanceMid(1, q.walk), stanceMid(3, q.walk)) - 0.65) : 0;
  at(ctx, parts.tailUp, P(4.6, -17.6 + bob), 0.55 + q.sway * 2, 0.68, 0.68);
  for (const [i, x] of [
    [0, -4.6],
    [2, 4.6],
  ] as const)
    at(ctx, parts.legFront[1], P(x + o[i]!.x, -VIEW_DEPTH + o[i]!.y - LEG_FRONT_LEN * 0.9), 0, 0.9, 0.9);
  at(ctx, parts.bodyFront, P(0, bob));
  for (const [i, x] of [
    [1, -3.6],
    [3, 3.6],
  ] as const) {
    const top = P(x, -12.6 + bob);
    const foot = P(x + o[i]!.x, o[i]!.y);
    at(ctx, parts.legFront[0], top, Math.atan2(-(foot.x - top.x), foot.y - top.y), 1, (foot.y - top.y) / LEG_FRONT_LEN);
  }
  at(ctx, parts.headFront, P(0, -17.6 + bob * 1.2), q.head * 0.3, HEAD_K * 0.92, HEAD_K * 0.92);
}

/** Walking away: the back of the head over the shoulders, the rump, the hind legs and hocks, the tail up to one side. */
function drawBack(ctx: Ctx, parts: CatParts, q: CatPose): void {
  const o = viewFeet(q);
  const bob = q.shape === 'walk' ? -0.5 * (Math.max(stanceMid(0, q.walk), stanceMid(2, q.walk)) - 0.65) : 0;
  at(ctx, parts.headBack, P(0, -20.4 + bob * 1.2), q.head * 0.3, HEAD_K * 0.9, HEAD_K * 0.9);
  for (const [i, x] of [
    [1, -3.2],
    [3, 3.2],
  ] as const)
    at(ctx, parts.legFront[1], P(x + o[i]!.x, -VIEW_DEPTH + o[i]!.y - LEG_FRONT_LEN * 0.85), 0, 0.85, 0.85);
  for (const [i, x] of [
    [0, -4.0],
    [2, 4.0],
  ] as const) {
    const top = P(x, -10.4 + bob);
    const foot = P(x + o[i]!.x, o[i]!.y);
    const lifted = foot.y < -1.2;
    at(ctx, lifted ? parts.pads : parts.legBack[0], top, Math.atan2(-(foot.x - top.x), foot.y - top.y), 1, (foot.y - top.y) / LEG_BACK_LEN);
  }
  at(ctx, parts.bodyBack, P(0, bob));
  at(ctx, parts.tailUp, P(-0.6, -14.4 + bob), -0.32 + q.sway * 2, 0.92, 0.92);
}

/** The cat at the origin (its feet's line), facing +x (or the viewer), in world units at perspective 1. */
export function drawCat(ctx: Ctx, parts: CatParts, q: CatPose): void {
  if (q.shadow > 0) {
    ctx.save();
    ctx.globalAlpha *= q.shadow;
    if (q.view === 'side') ctx.translate(-1, 0.6);
    else {
      ctx.translate(0, q.view === 'front' ? -2.6 : -2.2);
      ctx.scale(0.42, 2.2);
    }
    img(ctx, parts.shadow);
    ctx.restore();
  }
  if (q.view === 'front') return drawFront(ctx, parts, q);
  if (q.view === 'back') return drawBack(ctx, parts, q);
  const head = q.sleep ? parts.headSleep : parts.head;
  const breathe = (s: Sprite) => at(ctx, s, P(0, 0), 0, 1 - q.breath * 0.006, 1 + q.breath * 0.018);
  switch (q.rig ? 'rig' : q.shape) {
    case 'loaf':
      breathe(parts.loaf);
      at(ctx, parts.tailWrap, LOAF_TAIL, -0.02);
      at(ctx, parts.tailTip, P(LOAF_TAIL.x + 23.2, LOAF_TAIL.y - 0.2), -q.tip);
      at(ctx, head, P(LOAF_NECK.x, LOAF_NECK.y - q.breath * 0.25), q.head, HEAD_K, HEAD_K);
      return;
    case 'curl':
      breathe(parts.curl);
      return;
    case 'sit':
    case 'wash': {
      breathe(parts.sit);
      at(ctx, parts.tailWrap, SIT_TAIL, -0.02);
      at(ctx, parts.tailTip, P(SIT_TAIL.x + 23.2, SIT_TAIL.y - 0.2), -0.25 - q.tip);
      // washing: the near paw up to the mouth, the head down to it, licking in strokes
      const paw = q.shape === 'wash' ? q.paw : 0;
      at(ctx, head, P(SIT_NECK.x, SIT_NECK.y - q.breath * 0.3 + paw * 1.2), q.head + paw * 0.5, HEAD_K, HEAD_K);
      if (paw > 0) at(ctx, parts.sitLeg, SIT_LEG, -paw * 2.25, 1, 1 - paw * 0.4);
      return;
    }
    default:
      drawRig(ctx, parts, q, rigOf(q));
  }
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** A place the cat can be: a coping stretch or a point on a walk or the path, on a terrace (0 top … 3 the foreground). */
export interface CatNode {
  id: string;
  x: number;
  y: number;
  terrace: number;
  kind: 'coping' | 'ground';
  /** in the olive's shade */
  shade: boolean;
  /** far enough from the plants to lie down (`CAT_TUNING.rest`) */
  rest: boolean;
  perch: Perch | null;
  ground: GroundSpot | null;
}

export interface CatEdge {
  to: number;
  kind: 'walk' | 'jump';
  len: number;
}

export interface CatMap {
  nodes: CatNode[];
  edges: CatEdge[][];
}

const TERRACES = ['top', 'middle', 'lower'];

/** The terrace a coping or a walk belongs to, read from its name; null for any other place. */
export function terraceOf(id: string): number | null {
  const m = /^(wall|walk)-(top|middle|lower)-/.exec(id);
  if (m) return TERRACES.indexOf(m[2]!);
  if (id === 'path-middle') return 1;
  if (id === 'path-lower') return 2;
  if (id === 'path-foreground') return 3;
  return null;
}

type MapWorld = Pick<FaunaWorld, 'perches' | 'ground' | 'regions' | 'scene'>;

/** Clear of the planting slots, the jars and the trees' trunks. */
export function clearAt(w: MapWorld, q: Pt, gap = CAT_TUNING.clear): boolean {
  for (const s of w.scene.slots) if (Math.abs(s.x - q.x) < gap && Math.abs(s.y - q.y) < gap && Math.hypot(s.x - q.x, s.y - q.y) < gap) return false;
  for (const p of w.perches) if (p.kind === 'jar' && Math.hypot(p.x - q.x, p.depth - q.y) < 14) return false;
  for (const r of w.regions) if (r.kind === 'bark' && pointInPolygon(q, r.outline)) return false;
  return true;
}

function clearLine(w: MapWorld, a: Pt, b: Pt): boolean {
  const n = Math.max(2, Math.ceil(dist(a, b) / 5));
  for (let i = 0; i <= n; i++) if (!clearAt(w, P(lerp(a.x, b.x, i / n), lerp(a.y, b.y, i / n)))) return false;
  return true;
}

const maps = new WeakMap<readonly Perch[], CatMap>();

/** Its places and the ways between them: strolls along a terrace, and jumps between a coping and the terrace below. */
export function catMap(w: MapWorld): CatMap {
  const cached = maps.get(w.perches);
  if (cached) return cached;
  const nodes: CatNode[] = [];
  const olive = w.regions.find((r) => r.id === 'bark-olive');
  const oliveX = olive ? olive.outline.reduce((s, q) => s + q.x, 0) / olive.outline.length : null;
  for (const p of w.perches) {
    const t = p.kind === 'wall' ? terraceOf(p.id) : null;
    if (t === null) continue;
    const q = P(p.x, perchY(p, p.x));
    if (clearAt(w, q)) nodes.push({ id: p.id, x: q.x, y: q.y, terrace: t, kind: 'coping', shade: false, rest: clearAt(w, q, CAT_TUNING.rest), perch: p, ground: null });
  }
  for (const g of w.ground) {
    const t = terraceOf(g.id);
    if (t === null) continue;
    const xs = g.rx > 40 ? [-0.6, 0, 0.6] : [0];
    xs.forEach((k, i) => {
      const q = P(g.x + k * g.rx, g.y);
      const shade = t === 0 && oliveX !== null && Math.abs(q.x - oliveX) < 180;
      if (clearAt(w, q)) nodes.push({ id: `${g.id}${xs.length > 1 ? `-${i + 1}` : ''}`, x: q.x, y: q.y, terrace: t, kind: 'ground', shade, rest: clearAt(w, q, CAT_TUNING.rest), perch: null, ground: g });
    });
  }
  const edges: CatEdge[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const d = dist(a, b);
      let kind: CatEdge['kind'] | null = null;
      const steps = a.ground?.id.startsWith('path-') && b.ground?.id.startsWith('path-') && Math.abs(a.terrace - b.terrace) === 1;
      if ((a.terrace === b.terrace || steps) && d <= 170 && clearLine(w, a, b)) kind = 'walk';
      else if (Math.abs(a.terrace - b.terrace) === 1) {
        // a coping and the terrace below it: one jump, up or down
        const [hi, lo] = a.terrace < b.terrace ? [a, b] : [b, a];
        if (hi.kind === 'coping' && lo.kind === 'ground' && Math.abs(hi.x - lo.x) <= 60 && lo.y - hi.y > 25 && lo.y - hi.y < 130) kind = 'jump';
      }
      if (!kind) continue;
      // a jump costs a little; so does a stroll mostly toward or away from the viewer (side view)
      const len = kind === 'jump' ? d + 40 : Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? d * 1.8 : d;
      edges[i]!.push({ to: j, kind, len });
      edges[j]!.push({ to: i, kind, len });
    }
  }
  const map = { nodes, edges };
  maps.set(w.perches, map);
  return map;
}

/** Route lengths from `from` to every node (Dijkstra) and the step before each. */
export function routes(map: CatMap, from: number): { cost: number[]; prev: number[]; jumps: number[] } {
  const n = map.nodes.length;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const jumps = new Array<number>(n).fill(0);
  const done = new Array<boolean>(n).fill(false);
  cost[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && cost[i]! < Infinity && (u < 0 || cost[i]! < cost[u]!)) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const e of map.edges[u]!) {
      const c = cost[u]! + e.len;
      if (c < cost[e.to]!) {
        cost[e.to] = c;
        prev[e.to] = u;
        jumps[e.to] = jumps[u]! + (e.kind === 'jump' ? 1 : 0);
      }
    }
  }
  return { cost, prev, jumps };
}

/** The nodes from `from` to `to`, both included. */
export function pathTo(prev: readonly number[], from: number, to: number): number[] {
  const out = [to];
  while (out[0] !== from) {
    const p = prev[out[0]!]!;
    if (p < 0) return [];
    out.unshift(p);
  }
  return out;
}

const inView = (v: Rect, q: Pt, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;
const classOf = (n: CatNode): keyof typeof CAT_TUNING.weights => (n.kind === 'coping' ? 'coping' : n.shade ? 'shade' : 'ground');

/**
 * Where to settle next: a coping, the olive's shade or another walk within reach (`route`: at most
 * one jump), in view first, never where another creature is nor behind a planted plant (`hidden`).
 */
export function chooseRest(map: CatMap, rng: Rng, view: Rect, from: number | null, held: readonly Pt[], route?: { cost: readonly number[]; jumps: readonly number[] }, hidden?: (q: Pt) => boolean): number | null {
  const ok = (i: number) => {
    const n = map.nodes[i]!;
    if (i === from || !n.rest || map.edges[i]!.length === 0 || hidden?.(n)) return false;
    if (route && !(route.cost[i]! <= CAT_TUNING.reach && route.jumps[i]! <= 1)) return false;
    return held.every((h) => dist(h, n) > 30);
  };
  const all = map.nodes.map((_, i) => i).filter(ok);
  const seen = all.filter((i) => inView(view, map.nodes[i]!, 40));
  const pool = seen.length > 0 ? seen : all;
  if (pool.length === 0) return null;
  const count = (k: string) => pool.filter((i) => classOf(map.nodes[i]!) === k).length;
  const wt = (i: number) => CAT_TUNING.weights[classOf(map.nodes[i]!)] / count(classOf(map.nodes[i]!));
  let r = rng.next() * pool.reduce((s, i) => s + wt(i), 0);
  for (const i of pool) {
    r -= wt(i);
    if (r < 0) return i;
  }
  return pool[pool.length - 1]!;
}

/** Where along a coping it lies: somewhere in its spread clear of the plants and not behind one, else the middle. */
export function restX(w: MapWorld, n: CatNode, rng: Rng, hidden?: (q: Pt) => boolean): number {
  const p = n.perch;
  if (!p) return n.x;
  for (let i = 0; i < 6; i++) {
    const x = clamp(n.x + rng.range(-0.5, 0.5) * p.spread, p.x - p.spread, p.x + p.spread);
    const q = P(x, perchY(p, x));
    if (clearAt(w, q, CAT_TUNING.rest) && !hidden?.(q)) return x;
  }
  return n.x;
}

/** The node nearest a point. */
function nearestNode(map: CatMap, q: Pt): number {
  let best = 0;
  for (let i = 1; i < map.nodes.length; i++) if (dist(map.nodes[i]!, q) < dist(map.nodes[best]!, q)) best = i;
  return best;
}

// ---------------------------------------------------------------------------------------------

type Mode = 'doze' | 'wake' | 'stretch' | 'sit' | 'wash' | 'walk' | 'crouch' | 'leap' | 'land' | 'dusk' | 'turn' | 'wait';

interface Leg {
  kind: 'walk' | 'jump' | 'off';
  from: Pt;
  to: Pt;
  /** node it arrives at (−1: off the view or a step round something) */
  node: number;
  /** a step round another creature: it stays side-on */
  round?: boolean;
}

/** Room the cat keeps (`GROUND_ROOM`); where it settles it wants half of it clear. */
const ROOM = GROUND_ROOM.cat!;
/** how near its side may pass another creature (with that one's own room): near enough to brush past, never over it */
const PASS = ROOM * 0.25;

/** Where it may put its feet stepping round something: clear of the plants and on a walk or the path of its terrace. */
export function walkable(w: MapWorld, q: Pt, terrace: number): boolean {
  if (!clearAt(w, q)) return false;
  return w.ground.some((g) => terraceOf(g.id) === terrace && ((q.x - g.x) / g.rx) ** 2 + ((q.y - g.y) / (g.ry + 8)) ** 2 <= 1);
}

/** Behind a planted plant, out of the viewer's sight. */
const hiddenFor = (w: Pick<FaunaWorld, 'flowers' | 'scene'>) => {
  const cs = plantCovers(w);
  return (q: Pt) => hiddenByPlant(cs, q);
};

/** The places others hold: their spots, and where every ground creature is now. */
function takenBy(w: FaunaWorld, self: object, bodies: readonly GroundBody[]): Pt[] {
  const near = (h: Pt) => h.x === (self as Cat).x && h.y === (self as Cat).y;
  return [...heldSpots(w).filter((h) => !near(h)), ...bodies.map((b) => b.at)];
}

const isPainted = (q: CatPose) => !q.rig && q.view === 'side' && SPRITE_SHAPES.includes(q.shape);
const paintedAs = (q: CatPose) => (q.shape === 'wash' ? 'sit' : q.shape);

/** Seconds of the drawn change from pose `a` to pose `b`: none when the same painting goes on. */
export function changeFor(a: CatPose, b: CatPose): number {
  if (a.view !== 'side' || b.view !== 'side') return 0;
  const pa = isPainted(a);
  const pb = isPainted(b);
  if (pa && pb) return paintedAs(a) === paintedAs(b) ? 0 : CAT_TUNING.change.paint;
  return pa || pb ? CAT_TUNING.change.mixed : CAT_TUNING.change.rig;
}

/** The view for a walk going (dx, dy) on the picture: toward or away from the viewer when mostly in depth (with some hold). */
export function viewFor(dx: number, dy: number, now: CatView = 'side'): CatView {
  const across = Math.abs(dx);
  const deep = Math.abs(dy) / GAIT.depth;
  const k = now === 'side' ? 1.35 : 0.9;
  if (deep <= k * across || Math.abs(dy) < 2) return 'side';
  return dy > 0 ? 'front' : 'back';
}

export class Cat extends BaseCreature {
  readonly kind = 'cat' as const;
  readonly visitor = false;
  readonly coat: CatCoat;
  /** for tests: dozes, stretches, washes, jumps, strolls, turns to or from the viewer, steps round */
  dozes = 0;
  stretches = 0;
  washes = 0;
  jumps = 0;
  strolls = 0;
  turns = 0;
  detours = 0;
  node = -1;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private mode: Mode = 'doze';
  private modeT = 0;
  private modeFor = 1;
  private route: Leg[] = [];
  private walkPh = 0;
  private lie: 'loaf' | 'curl' = 'loaf';
  /** the drawn change of pose under way: from what was shown, `t` of `dur` seconds */
  private change: { from: CatPose; t: number; dur: number } | null = null;
  private view: CatView = 'side';
  private wantView: CatView = 'side';
  private turnFrom: CatView = 'side';
  private turnFacing = 1;
  private turnT = 1;
  private dir: Pt = { x: 1, y: 0 };
  private flick = -1;
  private flickIn = 5;
  private twitch = -1;
  private twitchIn = 4;
  private blinkIn = 6;
  private blink = -1;
  private look = 0;
  private first = true;
  private gone = false;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    coatName: CatCoat,
    held: readonly Pt[],
  ) {
    super();
    this.coat = coatName;
    this.variant = coatName;
    const map = catMap(w);
    const start = chooseRest(map, rng, w.view, null, held, undefined, hiddenFor(w));
    if (start === null) {
      this.done = true;
      return;
    }
    if (w.t < 2) {
      // there from the first visit: already asleep in its place
      this.settleAt(w, start);
      this.facing = rng.chance(0.5) ? 1 : -1;
      this.startDoze(w);
    } else {
      // back in the morning: strolls in from the terraces' landward end
      const n = map.nodes[start]!;
      this.pos = P(Math.max(w.view.x + w.view.w, 1600) + 40, n.y);
      this.scale = w.perspective(n.y, n.x);
      this.route = [{ kind: 'walk', from: { ...this.pos }, to: P(n.x, n.y), node: start }];
      this.startLeg(w);
    }
    this.change = null;
    this.sync();
  }

  /** Where it lies or is going (birds keep off its coping). */
  spot(): Pt | null {
    if (this.gone) return null;
    const last = this.route[this.route.length - 1];
    return last && last.node >= 0 ? { ...last.to } : { ...this.pos };
  }

  /** What it is doing (tests, studio). */
  doing(): Mode {
    return this.mode;
  }

  /** Side-on, or walking toward or away from the viewer (tests, studio). */
  facingView(): CatView {
    return this.view;
  }

  private settleAt(w: FaunaWorld, i: number): void {
    const n = catMap(w).nodes[i]!;
    this.node = i;
    let x = n.x;
    let y = n.y;
    if (n.perch) {
      x = restX(w, n, this.rng, hiddenFor(w));
      y = perchY(n.perch, x);
    }
    this.pos = P(x, y);
    this.scale = n.perch ? (n.perch.scale ?? w.perspective(n.perch.depth, n.perch.x)) : w.perspective(y, x);
    this.layer = 'entities';
  }

  private setMode(m: Mode, t: number): void {
    if (m !== this.mode) {
      // from what is shown now to the new pose, drawn (`changeFor`)
      const was = this.shown();
      this.mode = m;
      this.modeT = 0;
      const dur = changeFor(was, this.pose());
      this.change = dur > 0 ? { from: was, t: 0, dur } : null;
    }
    this.mode = m;
    this.modeT = 0;
    this.modeFor = t;
    this.state = m;
  }

  private changing(): boolean {
    return this.change !== null && this.change.t < this.change.dur;
  }

  private startDoze(w: FaunaWorld): void {
    const n = catMap(w).nodes[this.node];
    this.lie = n?.kind === 'ground' && this.rng.chance(n.shade ? 0.75 : 0.4) ? 'curl' : 'loaf';
    this.dozes++;
    this.setMode('doze', rangeOf(this.rng, this.first ? CAT_TUNING.firstDoze : CAT_TUNING.doze) / w.speed);
    this.first = false;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sf = w.speed;
    this.timer += dt;
    this.modeT += dt;
    if (this.change) {
      this.change.t += dt * sf;
      if (this.change.t >= this.change.dur) this.change = null;
    }
    this.turnT = Math.min(1, this.turnT + (dt * sf) / CAT_TUNING.turn);
    this.ticks(dt * sf, w);
    if (this.leaving && this.mode !== 'dusk' && !this.route.length && !this.gone && this.mode !== 'turn') {
      // nightfall: it sits up facing the sea for a while, then strolls off
      this.flipTo(Math.sign(w.pond.centre.x - this.pos.x) || -1);
      this.setMode('dusk', rangeOf(this.rng, CAT_TUNING.dusk) / sf);
    }
    if (this.route.length) this.travel(dt, w);
    else if (this.modeT >= this.modeFor) this.next(w);
    this.sync();
  }

  /** Twitches, blinks and where it looks. */
  private ticks(dt: number, w: FaunaWorld): void {
    const rng = this.rng;
    if (this.flick >= 0) {
      this.flick += dt;
      if (this.flick > 0.3) this.flick = -1;
    } else if ((this.flickIn -= dt) < 0) {
      this.flick = 0;
      this.flickIn = rng.range(5, 14);
    }
    if (this.twitch >= 0) {
      this.twitch += dt;
      if (this.twitch > 0.6) this.twitch = -1;
    } else if ((this.twitchIn -= dt) < 0) {
      this.twitch = 0;
      this.twitchIn = rng.range(4, 11);
    }
    if (this.blink >= 0) {
      this.blink += dt;
      if (this.blink > 0.7) this.blink = -1;
    } else if ((this.blinkIn -= dt) < 0) {
      this.blink = 0;
      this.blinkIn = rng.range(6, 14);
    }
    // awake and still: the head follows a bird or a butterfly passing near
    let target = 0;
    if (this.mode === 'sit' || this.mode === 'dusk' || this.mode === 'wake' || this.mode === 'wait') {
      let best = 260 * this.scale;
      for (const c of w.creatures) {
        if (c === this || c.done || c.kind === 'cat') continue;
        const d = Math.hypot(c.x - this.pos.x, c.y - this.pos.y);
        if (d < best && (c.x - this.pos.x) * this.facing > -10) {
          best = d;
          target = clamp(Math.atan2(c.y - (this.pos.y - 30 * this.scale), Math.abs(c.x - this.pos.x)) * 0.6, -0.55, 0.45);
        }
      }
    }
    this.look += (target - this.look) * Math.min(1, dt * 2);
  }

  /** The next thing to do when the current one ends. */
  private next(w: FaunaWorld): void {
    const rng = this.rng;
    const sf = w.speed;
    switch (this.mode) {
      case 'doze':
        this.setMode('wake', rng.range(1.4, 2.6) / sf);
        return;
      case 'wake':
        this.stretches++;
        this.setMode('stretch', rangeOf(rng, CAT_TUNING.stretch) / sf);
        return;
      case 'stretch':
      case 'land':
        if (this.mode === 'stretch' && rng.chance(0.55) && this.stroll(w)) return;
        this.setMode('sit', rangeOf(rng, CAT_TUNING.sit) / sf);
        return;
      case 'sit': {
        const r = rng.next();
        if (r < 0.4) {
          this.washes++;
          this.setMode('wash', rangeOf(rng, CAT_TUNING.wash) / sf);
        } else if (r < 0.7 && this.stroll(w)) return;
        else this.startDoze(w);
        return;
      }
      case 'wash':
        if (rng.chance(0.5)) this.startDoze(w);
        else this.setMode('sit', rangeOf(rng, CAT_TUNING.sit) / sf);
        return;
      case 'dusk':
        this.goAway(w);
        return;
      default:
        this.setMode('sit', rangeOf(rng, CAT_TUNING.sit) / sf);
    }
  }

  /** Off to another place within reach; false when there is none. */
  private stroll(w: FaunaWorld): boolean {
    const map = catMap(w);
    if (this.node < 0) this.node = nearestNode(map, this.pos);
    const route = routes(map, this.node);
    const bodies = groundBodies(w, this);
    const held = takenBy(w, this, bodies);
    // never through another creature: a way that passes one is given up for another place
    for (let tries = 0; tries < 4; tries++) {
      const to = chooseRest(map, this.rng, w.view, this.node, held, route, hiddenFor(w));
      if (to === null) return false;
      const path = pathTo(route.prev, this.node, to);
      if (path.length < 2) return false;
      const legs: Leg[] = [];
      let from = { ...this.pos };
      for (let k = 1; k < path.length; k++) {
        const n = map.nodes[path[k]!]!;
        const e = map.edges[path[k - 1]!]!.find((x) => x.to === path[k])!;
        let x = n.x;
        if (k === path.length - 1 && n.perch) x = restX(w, n, this.rng, hiddenFor(w));
        const toPt = P(x, n.perch ? perchY(n.perch, x) : n.y);
        legs.push({ kind: e.kind, from, to: toPt, node: path[k]! });
        from = toPt;
      }
      if (legs.some((l) => (l.kind === 'jump' ? !groundFree(l.to, ROOM * 0.5 * this.scale, bodies) : blockerOn(l.from, l.to, PASS * this.scale, bodies)))) {
        held.push(map.nodes[to]!);
        continue;
      }
      this.route = legs;
      this.strolls++;
      this.startLeg(w);
      return true;
    }
    return false;
  }

  /** Away for the night: along its terrace to the landward edge of the view. */
  private goAway(w: FaunaWorld): void {
    const off = Math.max(w.view.x + w.view.w, 1600) + 50;
    this.route = [{ kind: 'off', from: { ...this.pos }, to: P(off, this.pos.y), node: -1 }];
    this.startLeg(w);
  }

  private startLeg(w: FaunaWorld): void {
    const leg = this.route[0]!;
    const dx = leg.to.x - this.pos.x;
    const dy = leg.to.y - this.pos.y;
    if (Math.abs(dx) > 2) this.flipTo(Math.sign(dx));
    this.wantView = leg.kind === 'jump' || leg.round ? 'side' : viewFor(dx, dy, this.view);
    const d = Math.hypot(dx, dy);
    // set now, so the stride it gets up into is the one it walks
    if (d > 1e-3 && this.mode !== 'walk') this.dir = P(this.wantView === 'side' ? (dx * this.facing) / d : dx / d, dy / d);
    this.layer = 'entities';
    this.setMode(leg.kind === 'jump' ? 'crouch' : 'walk', leg.kind === 'jump' ? 0.5 / w.speed : 0);
  }

  /** Turning to face the way it goes: the old view narrows and the new one opens out. */
  private turnTo(v: CatView): void {
    if (v === this.view) return;
    this.turnFrom = this.view;
    this.turnFacing = this.facing;
    this.view = v;
    this.turnT = 0;
    this.turns++;
  }

  /** Turning round side-on: the same narrowing and opening out, mirrored. */
  private flipTo(f: number): void {
    if (f === this.facing) return;
    if (this.view === 'side' && this.turnT >= 1) {
      this.turnFrom = 'side';
      this.turnFacing = this.facing;
      this.turnT = 0;
      this.turns++;
    }
    this.facing = f;
  }

  private travel(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const leg = this.route[0]!;
    // up from where it sat or lay, then round to face the way, then off
    if (this.changing() && this.mode !== 'leap') return;
    if (this.wantView !== this.view) this.turnTo(this.wantView);
    if (this.turnT < 1) return;
    if (this.mode === 'wait') {
      if (this.modeT < this.modeFor) return;
      this.giveWay(w);
      return;
    }
    if ((leg.kind !== 'jump' || this.mode === 'crouch') && this.inTheWay(w)) {
      this.setMode('wait', rangeOf(this.rng, CAT_TUNING.look) / sf);
      return;
    }
    if (leg.kind === 'jump') {
      if (this.mode === 'crouch') {
        if (this.modeT >= this.modeFor) {
          this.jumps++;
          this.setMode('leap', (0.45 + dist(leg.from, leg.to) / 260) / sf);
        }
        return;
      }
      if (this.mode === 'leap') {
        const k = clamp(this.modeT / this.modeFor, 0, 1);
        // a quadratic arc whose top clears the higher end
        const c = Math.min(leg.from.y, leg.to.y) - 24 * this.scale;
        const u = easeInOut(k) * 0.3 + k * 0.7;
        this.pos = P(lerp(leg.from.x, leg.to.x, u), (1 - u) ** 2 * leg.from.y + 2 * u * (1 - u) * c + u * u * leg.to.y);
        this.scale = w.perspective(lerp(leg.from.y, leg.to.y, easeInOut(k)), this.pos.x);
        if (k >= 1) {
          this.pos = { ...leg.to };
          this.setMode('land', 0.35 / sf);
        }
        return;
      }
      if (this.mode === 'land' && this.modeT < this.modeFor) return;
      this.arrive(w);
      return;
    }
    if (this.mode !== 'walk') this.setMode('walk', 0);
    const d = dist(this.pos, leg.to);
    const ux = (leg.to.x - this.pos.x) / Math.max(1e-6, d);
    const uy = (leg.to.y - this.pos.y) / Math.max(1e-6, d);
    // the same pace on the ground whichever way: toward the viewer it covers less of the picture
    const m = Math.hypot(ux, uy / GAIT.depth);
    const step = Math.min(d, (CAT_TUNING.walk * sf * this.scale * dt) / m);
    this.pos = P(this.pos.x + ux * step, this.pos.y + uy * step);
    this.walkPh += (step * m) / (CAT_TUNING.stride * this.scale);
    if (d > 1e-3) {
      // round a corner the stride swings over a few steps rather than jumping the paws
      const k = Math.min(1, dt * sf * 5);
      const nx = lerp(this.dir.x, this.view === 'side' ? ux * this.facing : ux, k);
      const ny = lerp(this.dir.y, uy, k);
      const n = Math.hypot(nx, ny) || 1;
      this.dir = P(nx / n, ny / n);
    }
    const node = leg.node >= 0 ? catMap(w).nodes[leg.node] : null;
    const left = d - step;
    this.scale = node?.perch && left < 3 ? (node.perch.scale ?? w.perspective(node.perch.depth, node.perch.x)) : w.perspective(this.pos.y, this.pos.x);
    if (leg.kind === 'off' && this.pos.x > w.view.x + w.view.w + 30 * this.scale) {
      this.gone = true;
      this.done = true;
      return;
    }
    if (left < 0.3) this.arrive(w);
  }

  /** Another ground creature close ahead on the way, or on the far side of a jump. */
  private inTheWay(w: FaunaWorld): GroundBody | null {
    const leg = this.route[0]!;
    const bodies = groundBodies(w, this);
    if (bodies.length === 0) return null;
    if (leg.kind === 'jump') return bodies.find((b) => !groundFree(leg.to, ROOM * 0.5 * this.scale, [b])) ?? null;
    const hit = blockerOn(this.pos, leg.to, PASS * this.scale, bodies);
    return hit && hit.along < (24 + ROOM) * this.scale + hit.body.r ? hit.body : null;
  }

  /**
   * After a look: on if the way has cleared, else round the creature on the walk's ground (two
   * steps beside it, nearer the viewer or further), else the stroll is given up and it sits.
   */
  private giveWay(w: FaunaWorld): boolean {
    const body = this.inTheWay(w);
    const leg = this.route[0]!;
    const sf = w.speed;
    if (!body) {
      this.setMode(leg.kind === 'jump' ? 'crouch' : 'walk', leg.kind === 'jump' ? 0.3 / sf : 0);
      return true;
    }
    if (leg.kind !== 'jump') {
      const map = catMap(w);
      const terrace = map.nodes[leg.node >= 0 ? leg.node : nearestNode(map, this.pos)]!.terrace;
      const others = groundBodies(w, this).filter((b) => b !== body);
      const wide = (PASS * this.scale + body.r) * 1.12;
      const long = (24 + ROOM) * this.scale;
      for (const side of body.at.y >= this.pos.y ? [-1, 1] : [1, -1]) {
        const [a, b] = stepsRound(this.pos, leg.to, body.at, long, wide, side);
        const ahead = (a.x - this.pos.x) * (leg.to.x - this.pos.x) + (a.y - this.pos.y) * (leg.to.y - this.pos.y) > 0;
        const steps = ahead ? [a, b] : [b];
        if (!steps.every((q) => walkable(w, q, terrace) && groundFree(q, ROOM * 0.5 * this.scale, others))) continue;
        this.detours++;
        this.route.unshift(...steps.map((q, i): Leg => ({ kind: 'walk', from: i ? steps[i - 1]! : { ...this.pos }, to: q, node: -1, round: true })));
        this.startLeg(w);
        return true;
      }
    }
    // no way round: it gives the stroll up and sits where it is
    this.route = [];
    this.node = nearestNode(catMap(w), this.pos);
    this.setMode('sit', rangeOf(this.rng, [3, 7]) / sf);
    return false;
  }

  private arrive(w: FaunaWorld): void {
    const leg = this.route.shift()!;
    if (leg.node >= 0) this.node = leg.node;
    if (this.route.length) {
      this.startLeg(w);
      return;
    }
    // someone has settled on its place meanwhile: on somewhere else
    if (leg.node >= 0 && !groundFree(leg.to, ROOM * 0.5 * this.scale, groundBodies(w, this)) && this.stroll(w)) return;
    if (leg.node >= 0) {
      const n = catMap(w).nodes[leg.node]!;
      this.pos = { ...leg.to };
      this.scale = n.perch ? (n.perch.scale ?? w.perspective(n.perch.depth, n.perch.x)) : w.perspective(this.pos.y, this.pos.x);
    }
    // round to side-on, a look round, then it sits
    if (this.view !== 'side') {
      this.wantView = 'side';
      this.turnTo('side');
      this.setMode('turn', CAT_TUNING.turn / w.speed);
      return;
    }
    if (this.rng.chance(0.4)) {
      this.flipTo(-this.facing);
      this.setMode('turn', CAT_TUNING.turn / w.speed);
      return;
    }
    this.setMode('sit', rangeOf(this.rng, [3, 7]) / w.speed);
  }

  override leave(): void {
    this.leaving = true;
  }

  /** Back to the garden (the morning came before it left). */
  stay(): void {
    if (this.gone) return;
    this.leaving = false;
    if (this.mode === 'dusk') this.setMode('sit', 2);
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    const leg = this.route[0];
    // in a jump it is in front of the wall face it passes
    if (leg && leg.kind === 'jump') return Math.max(leg.from.y, leg.to.y) + 1;
    return this.pos.y + 1;
  }

  /** The pose now (reads the state only). */
  pose(): CatPose {
    const q: CatPose = { ...REST_POSE, view: this.view, dir: this.dir };
    const k = clamp(this.modeT / Math.max(1e-6, this.modeFor), 0, 1);
    const breath = Math.sin((this.timer / 3.4) * TAU);
    q.tip = this.twitch >= 0 ? 0.55 * Math.sin((this.twitch / 0.6) * Math.PI) : 0;
    const flick = this.flick >= 0 ? 0.12 * Math.sin((this.flick / 0.3) * TAU) : 0;
    q.sway = 0.08 * Math.sin(this.timer * 0.9 + this.id);
    switch (this.mode) {
      case 'doze':
        q.shape = this.lie;
        q.breath = breath;
        q.head = 0.1 + flick;
        return q;
      case 'wake':
        q.shape = this.lie === 'curl' ? 'curl' : 'loaf';
        q.sleep = k < 0.3;
        q.breath = breath * 0.6;
        q.head = this.look;
        return q;
      case 'stretch':
        return stretchPose(q, k);
      case 'sit':
      case 'dusk':
        q.shape = 'sit';
        q.sleep = this.blink >= 0 && this.blink < 0.55;
        q.breath = breath * 0.7;
        q.head = this.look + flick * 0.5;
        return q;
      case 'wash': {
        q.shape = 'wash';
        q.sleep = true;
        const up = Math.min(easeInOut(this.modeT / 0.5), easeInOut((this.modeFor - this.modeT) / 0.5));
        q.paw = up * (0.85 + 0.15 * Math.sin(this.modeT * 7));
        q.head = 0.15 * Math.sin(this.modeT * 7) * up;
        return q;
      }
      case 'turn':
      case 'wait':
        q.shape = 'stand';
        q.sleep = this.blink >= 0 && this.blink < 0.4;
        q.head = this.look * 0.6 + flick * 0.5;
        return q;
      case 'crouch':
      case 'land':
        q.shape = 'crouch';
        q.sleep = false;
        q.pitch = this.mode === 'land' ? 0 : this.route[0] && this.route[0].to.y < this.route[0].from.y ? -0.12 : 0.12;
        return q;
      case 'leap': {
        const leg = this.route[0];
        q.shape = 'leap';
        q.sleep = false;
        q.shadow = 0;
        const up = leg ? leg.to.y < leg.from.y : false;
        q.pitch = (up ? -0.55 : 0.4) * Math.sin(k * Math.PI) * (Math.abs((leg?.to.x ?? 0) - (leg?.from.x ?? 0)) > 8 ? 1 : 0.6);
        return q;
      }
      default:
        q.shape = 'walk';
        q.sleep = false;
        q.walk = this.walkPh;
        q.head = 0.08 + flick * 0.3;
        return q;
    }
  }

  /** What is drawn now: the pose, or the in-between of a change under way (side-on). */
  private shown(): CatPose {
    const now = this.pose();
    const c = this.change;
    if (!c || c.t >= c.dur || now.view !== 'side' || c.from.view !== 'side') return now;
    return inBetween(c.from, now, c.t / c.dur);
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities') return;
    const parts = w.art.get(`cat:${this.coat}`, (res) => paintCat(res, 3700 + CAT_COATS.indexOf(this.coat) * 40, this.coat));
    const now = this.pose();
    const one = (q: CatPose, alpha: number, squeeze = 1, facing = this.facing) => {
      if (alpha <= 0.002) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      const s = this.scale * CAT_K;
      ctx.scale(s * squeeze * (q.view === 'side' ? facing : 1), s);
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * alpha;
      drawCat(ctx, parts, q);
      ctx.globalAlpha = a;
      ctx.restore();
    };
    if (this.turnT < 1) {
      // a turn: the old view narrows to its middle, then the new one opens out (a short overlap)
      const k = this.turnT;
      // turning round side-on it keeps its pose; to or from the viewer it stands
      const round = this.turnFrom === 'side' && this.view === 'side';
      const stand = (v: CatView): CatPose => (round ? this.shown() : { ...now, view: v, shape: v === 'side' ? 'stand' : now.shape === 'walk' ? 'walk' : 'stand', rig: null });
      one(stand(this.turnFrom), clamp((0.6 - k) / 0.2, 0, 1), lerp(1, 0.3, clamp(k / 0.5, 0, 1)), this.turnFacing);
      one(stand(this.view), clamp((k - 0.4) / 0.2, 0, 1), lerp(0.3, 1, clamp((k - 0.5) / 0.5, 0, 1)));
      return;
    }
    const c = this.change;
    if (!c || c.t >= c.dur || now.view !== 'side' || c.from.view !== 'side') {
      one(now, 1);
      return;
    }
    // a change of pose: drawn joints between the two, meeting a painted pose in a short dissolve
    const k = c.t / c.dur;
    const meet = CAT_TUNING.meet / c.dur;
    const aIn = isPainted(c.from) ? clamp(k / meet, 0, 1) : 1;
    const aOut = isPainted(now) ? clamp((1 - k) / meet, 0, 1) : 1;
    one(c.from, 1 - aIn);
    one(now, 1 - aOut);
    one(inBetween(c.from, now, k), Math.min(aIn, aOut));
  }
}

/** The in-between of two side-on poses at `k` (0..1): their rigs eased, the rest from the nearer end. */
export function inBetween(a: CatPose, b: CatPose, k: number): CatPose {
  const e = easeInOut(k);
  const near = k < 0.5 ? a : b;
  return { ...b, shape: 'rig', sleep: near.sleep, rig: lerpRig(rigOf(a), rigOf(b), e), pitch: lerp(a.pitch, b.pitch, e), lift: lerp(a.lift, b.lift, e), shadow: lerp(a.shadow, b.shadow, e) };
}

/** The front stretch, then its follow-through: forelegs out and rump up, then the long back stretch with a hind leg trailing. */
export function stretchPose(q: CatPose, k: number): CatPose {
  q.sleep = k > 0.25 && k < 0.5;
  if (k < 0.58) {
    q.shape = 'bow';
    // pressing forward into it, the forepaws sliding a little further
    const push = easeInOut(k / 0.58);
    q.rig = { ...RIGS.bow, sh: RIGS.bow.sh - push * 0.8, hip: RIGS.bow.hip + push * 0.6, feet: RIGS.bow.feet.map((f, i) => (i % 2 === 1 ? { ...f, x: f.x + push * 1.4 } : f)) };
    q.head = -0.1 * push;
    return q;
  }
  q.shape = 'reach';
  if (k < 0.74) q.rig = lerpRig(RIGS.bow, RIGS.reach, easeInOut((k - 0.58) / 0.16));
  else if (k > 0.9) q.rig = lerpRig(RIGS.reach, RIGS.stand, easeInOut((k - 0.9) / 0.1));
  else q.rig = RIGS.reach;
  return q;
}

const coastLike = (w: Pick<FaunaWorld, 'perches' | 'ground'>) => w.ground.some((g) => g.id.startsWith('walk-')) && w.perches.some((p) => p.kind === 'wall' && terraceOf(p.id) !== null);
const homes = new WeakMap<readonly Perch[], boolean>();

const cat: CreatureDef = {
  kind: 'cat',
  title: 'island cat',
  role: 'resident',
  rank: 3,
  variants: CAT_COATS,
  // one cat, by day and at dusk; away at night
  resident: (n, mode) => (n > 0 && !mode.night ? 1 : 0),
  // the coast's terrace copings and walks (cached: upkeep asks every frame)
  needs: (w) => {
    let v = homes.get(w.perches);
    if (v === undefined) {
      v = coastLike(w);
      homes.set(w.perches, v);
    }
    return v;
  },
  spawn(w, s) {
    if (!cat.needs!(w)) return [];
    // the morning came before it had gone: it stays
    const staying = w.creatures.find((c): c is Cat => c instanceof Cat && !c.done && c.leaving);
    if (staying && !staying.forced) {
      staying.stay();
      return [];
    }
    const rng = w.rng.fork(`cat:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const coatName = s.variants.length ? (s.variants.find((v) => (CAT_COATS as readonly string[]).includes(v)) as CatCoat | undefined) : undefined;
    const c = new Cat(w, rng, coatName ?? CAT_COATS[Math.abs(s.seed) % CAT_COATS.length]!, [...heldSpots(w), ...groundBodies(w).map((b) => b.at)]);
    return c.done ? [] : [c];
  },
  sheet: {
    w: 900,
    h: 200,
    make(res, seed) {
      const a = paintCat(res, seed, 'tabby');
      return [a.loaf, a.headSleep, a.head, a.headFront, a.headBack, a.curl, a.sit, a.sitLeg, a.torso, a.bodyFront, a.bodyBack, a.upperArm[0], a.forearm[0], a.paw[0], a.pawSpread[0], a.thigh[0], a.shin[0], a.meta[0], a.legFront[0], a.legBack[0], a.pads, a.tailUp, a.tailWrap, a.tailTip];
    },
  },
  show: { stage: 'coast', spec: { x: 760, y: 470, w: 560, h: 320 }, w: 840, h: 480, order: 40 },
};
export default cat;
