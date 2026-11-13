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

export const CAT_TUNING = {
  /** seconds asleep in one place; the first doze is shorter so a visitor soon sees it stir */
  doze: [50, 140] as const,
  firstDoze: [25, 60] as const,
  /** seconds sitting up, awake, and washing a paw */
  sit: [6, 18] as const,
  wash: [4, 9] as const,
  /** the front stretch on waking */
  stretch: [2.2, 3.2] as const,
  /** at nightfall: seconds sitting up facing the sea before it strolls away */
  dusk: [45, 90] as const,
  /** world units / s at perspective 1: an unhurried stroll */
  walk: 24,
  /** body travel per walk cycle (world units at perspective 1) */
  stride: 18,
  /** keeps this far from a planting slot when it walks or settles */
  clear: 22,
  /** the furthest it strolls in one go (route length, world units) */
  reach: 520,
  /** seconds of a pose's cross-fade */
  blend: 0.45,
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
const TORSO = pts([[16.2, -15.6], [17.4, -20.4], [16.6, -24.6], [13.4, -26.6], [9.6, -26.4], [5.5, -26], [0, -25], [-6.5, -25.2], [-12, -25.6], [-16.4, -24.2], [-19.4, -20.6], [-20, -16.4], [-18, -13.4], [-14, -12.8], [-10, -14.6], [-4, -14.4], [3, -13.4], [8, -12.6], [12.4, -13.2], [15.2, -15]]);
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
/** The front stretch: forelegs out along the ground, chest down, rump up. */
const BOW = pts([[25.6, -0.2], [25.2, -2.0], [18, -2.4], [12, -3.8], [8.6, -7.6], [5.4, -12.2], [0, -17], [-8, -21.6], [-14.2, -24], [-19.4, -22.4], [-21.4, -17.6], [-20.4, -12.4], [-18.8, -6.4], [-19.2, -0.2], [-12.8, -0.2], [-13.2, -5.4], [-11.6, -12.6], [-4, -10.6], [2, -5.6], [6, -1.8], [10, -0.2], [16, 0]]);
const BOW_NECK = P(11.4, -8.2);
const BOW_TAIL = P(-18.6, -20.6);
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
  p.glaze(shape, c.shade, { rng, opacity: 0.3, edge: 0.05, darken: 0, deform: 0.08, spread: 0.05, fade: { angle: -Math.PI / 2 - 0.25, start: 0.15, amount: 1, ragged: 0.7 } });
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

function paintForeleg(p: Painter, c: Coat, far: boolean): void {
  const shape = smoothPolygon(pts([[-2.2, -2], [2.2, -2], [1.9, 6], [1.4, 12.6], [2.6, 14.8], [3.0, 16.2], [-1.3, 16.4], [-1.3, 13.6], [-1.5, 6]]), 1);
  fur(p, shape, far ? { ...c, white: mix(c.white, c.shade, 0.45) } : c, { patches: [], strokes: [[P(0.6, 2), P(0.4, 9)]], edges: [[P(2.0, 5), P(1.5, 12)]], stripeAngle: 0 });
  p.inkLine([P(0.6, 16.3), P(3.0, 16.2)], { rng: p.rng, width: 0.3, opacity: 0.35, breaks: 0.3, pigment: c.ink });
}

function paintHindleg(p: Painter, c: Coat, far: boolean): void {
  const shape = smoothPolygon(pts([[-3.6, -2], [3.4, -2], [3.0, 5.4], [0.4, 11.4], [1.0, 14.4], [2.4, 15.4], [2.4, 16.4], [-3.0, 16.4], [-3.4, 14], [-4.6, 11.2], [-3.8, 5]]), 1);
  fur(p, shape, far ? { ...c, white: mix(c.white, c.shade, 0.45) } : c, { patches: [], strokes: [[P(-1.6, 3), P(-2.6, 10)]], edges: [[P(-4.4, 11.4), P(-3.4, 15.4)]], stripeAngle: 0 });
}

export interface CatParts {
  head: Sprite; // awake, origin at the neck join
  headSleep: Sprite;
  loaf: Sprite; // origin on the ground under the body
  curl: Sprite;
  sit: Sprite;
  sitLeg: Sprite; // the near foreleg when sitting, origin at its shoulder
  bow: Sprite;
  torso: Sprite;
  foreNear: Sprite; // walking legs, origin at the shoulder or hip
  foreFar: Sprite;
  hindNear: Sprite;
  hindFar: Sprite;
  tailUp: Sprite; // origin at its root
  tailWrap: Sprite;
  tailTip: Sprite;
  shadow: Sprite;
}

const headBox = { w: 23, h: 21, ox: 3.6, oy: 17.6 };
/** Head painted around its centre, shifted so the sprite's origin is the neck join. */
const headAt = (p: Painter, c: Coat, sleep: boolean) => {
  p.ctx.save();
  p.ctx.translate(-NECK_JOIN.x, -NECK_JOIN.y);
  paintHead(p, c, sleep);
  p.ctx.restore();
};

export function paintCat(res: number, seed: number, coatName: CatCoat): CatParts {
  const c = coat(coatName);
  const S = (box: { w: number; h: number; ox: number; oy: number }, k: number, f: (p: Painter) => void) => paintSprite(res, box, seed + k, (p) => f(p));
  return {
    head: S(headBox, 1, (p) => headAt(p, c, false)),
    headSleep: S(headBox, 1, (p) => headAt(p, c, true)),
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
    sitLeg: S({ w: 8, h: 21, ox: 3.4, oy: 2.6 }, 5, (p) => paintForeleg(p, c, false)),
    bow: S({ w: 50, h: 27, ox: 23.6, oy: 25 }, 6, (p) =>
      fur(p, smoothPolygon(BOW, 1), c, {
        patches: [
          [-11, -19.6, 7.6, 3.8, 0.38],
          [-18.4, -17, 3.4, 4.0, 0.2],
        ],
        strokes: [[P(-15, -14), P(-17, -7)], [P(4, -10), P(10, -5)]],
        edges: [[P(-16.2, -9), P(-16, -0.6)], [P(-11.6, -12.6), P(-4, -10.6), P(2, -5.6)], [P(9, -2.6), P(16, -2.2), P(24, -1.2)]],
        stripeAngle: Math.PI / 2 + 0.4,
      }),
    ),
    torso: S({ w: 40, h: 18, ox: 21.4, oy: 28.6 }, 7, (p) =>
      fur(p, smoothPolygon(TORSO, 2), c, {
        patches: [
          [-4.6, -24, 9.6, 3.4, 0.0],
          [-15.4, -21.4, 4.0, 4.2, 0.3],
        ],
        strokes: [[P(-15, -19), P(-18, -15)], [P(12.6, -20), P(14.2, -16)], [P(5.5, -24), P(0, -24.2)]],
        edges: [[P(-17.8, -13.6), P(-14, -12.9), P(-10, -14)], [P(-2, -14.2), P(5, -13.7), P(11, -13.4)]],
        stripeAngle: Math.PI / 2,
      }),
    ),
    foreNear: S({ w: 8, h: 21, ox: 3.4, oy: 2.6 }, 8, (p) => paintForeleg(p, c, false)),
    foreFar: S({ w: 8, h: 21, ox: 3.4, oy: 2.6 }, 9, (p) => paintForeleg(p, c, true)),
    hindNear: S({ w: 10, h: 21, ox: 5.4, oy: 2.6 }, 10, (p) => paintHindleg(p, c, false)),
    hindFar: S({ w: 10, h: 21, ox: 5.4, oy: 2.6 }, 11, (p) => paintHindleg(p, c, true)),
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

export type CatShape = 'loaf' | 'curl' | 'sit' | 'wash' | 'bow' | 'walk' | 'reach' | 'crouch' | 'leap';

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
}

export const REST_POSE: CatPose = { shape: 'loaf', sleep: true, breath: 0, head: 0, tip: 0, sway: 0, walk: 0, pitch: 0, lift: 0, paw: 0, shadow: 1 };

const img = (ctx: Ctx, s: Sprite) => ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);

function at(ctx: Ctx, s: Sprite, q: Pt, rot = 0, sx = 1, sy = 1): void {
  ctx.save();
  ctx.translate(q.x, q.y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  img(ctx, s);
  ctx.restore();
}

/** Leg angle and lift in a lateral-sequence walk: stance 60 % sweeping back, swing 40 % forward with the paw lifted. */
export function legSwing(ph: number, amp = 0.38): { a: number; lift: number } {
  const s = ((ph % 1) + 1) % 1;
  if (s < 0.6) return { a: lerp(amp, -amp, s / 0.6), lift: 0 };
  const k = (s - 0.6) / 0.4;
  return { a: lerp(-amp, amp, easeInOut(k)), lift: Math.sin(k * Math.PI) };
}

/** The four legs, the tail, torso and head of the walking rig (also the crouch, leap and the hind-leg reach). */
function drawRig(ctx: Ctx, parts: CatParts, q: CatPose): void {
  const crouch = q.shape === 'crouch' ? 1 : 0;
  const leap = q.shape === 'leap';
  const reach = q.shape === 'reach';
  const leg = (s: Sprite, joint: Pt, ph: number, fore: boolean) => {
    let a: number;
    let sy = 1;
    if (leap) a = fore ? 0.7 : -0.75;
    else if (reach) a = fore ? 0.1 : ph < 0.25 ? -0.95 : 0.05;
    else {
      const sw = legSwing(q.walk + ph);
      a = sw.a;
      sy = 1 - 0.22 * sw.lift;
    }
    if (crouch) sy *= 0.72;
    at(ctx, s, joint, -a, 1, sy);
  };
  ctx.save();
  ctx.translate(0, -q.lift + crouch * 3.6);
  ctx.rotate(q.pitch);
  const bob = q.shape === 'walk' ? 0.35 * Math.sin(q.walk * TAU * 2) : 0;
  ctx.translate(0, bob);
  leg(parts.hindFar, HIP, 0.5, false);
  leg(parts.foreFar, SHOULDER, 0.75, true);
  at(ctx, parts.tailUp, WALK_TAIL, leap ? -1.25 : crouch ? -0.6 : 0.12 + q.sway);
  leg(parts.hindNear, HIP, 0, false);
  leg(parts.foreNear, SHOULDER, 0.25, true);
  img(ctx, parts.torso);
  at(ctx, q.sleep ? parts.headSleep : parts.head, WALK_NECK, q.head - q.pitch * 0.5 + (crouch ? 0.25 : 0), HEAD_K, HEAD_K);
  ctx.restore();
}

/** The cat at the origin (its feet's line), facing +x, in world units at perspective 1. */
export function drawCat(ctx: Ctx, parts: CatParts, q: CatPose): void {
  if (q.shadow > 0) {
    ctx.save();
    ctx.globalAlpha *= q.shadow;
    ctx.translate(-1, 0.6);
    img(ctx, parts.shadow);
    ctx.restore();
  }
  const head = q.sleep ? parts.headSleep : parts.head;
  const breathe = (s: Sprite) => at(ctx, s, P(0, 0), 0, 1 - q.breath * 0.006, 1 + q.breath * 0.018);
  switch (q.shape) {
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
    case 'bow':
      at(ctx, parts.tailUp, BOW_TAIL, -0.5 + q.sway);
      img(ctx, parts.bow);
      at(ctx, head, BOW_NECK, -0.25 + q.head, HEAD_K, HEAD_K);
      return;
    default:
      drawRig(ctx, parts, q);
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
    if (clearAt(w, q)) nodes.push({ id: p.id, x: q.x, y: q.y, terrace: t, kind: 'coping', shade: false, perch: p, ground: null });
  }
  for (const g of w.ground) {
    const t = terraceOf(g.id);
    if (t === null) continue;
    const xs = g.rx > 40 ? [-0.6, 0, 0.6] : [0];
    xs.forEach((k, i) => {
      const q = P(g.x + k * g.rx, g.y);
      const shade = t === 0 && oliveX !== null && Math.abs(q.x - oliveX) < 180;
      if (clearAt(w, q)) nodes.push({ id: `${g.id}${xs.length > 1 ? `-${i + 1}` : ''}`, x: q.x, y: q.y, terrace: t, kind: 'ground', shade, perch: null, ground: g });
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
 * one jump), in view first, never where another creature is.
 */
export function chooseRest(map: CatMap, rng: Rng, view: Rect, from: number | null, held: readonly Pt[], route?: { cost: readonly number[]; jumps: readonly number[] }): number | null {
  const ok = (i: number) => {
    const n = map.nodes[i]!;
    if (i === from || map.edges[i]!.length === 0) return false;
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

/** The node nearest a point. */
function nearestNode(map: CatMap, q: Pt): number {
  let best = 0;
  for (let i = 1; i < map.nodes.length; i++) if (dist(map.nodes[i]!, q) < dist(map.nodes[best]!, q)) best = i;
  return best;
}

// ---------------------------------------------------------------------------------------------

type Mode = 'doze' | 'wake' | 'stretch' | 'sit' | 'wash' | 'walk' | 'crouch' | 'leap' | 'land' | 'dusk';

interface Leg {
  kind: 'walk' | 'jump' | 'off';
  from: Pt;
  to: Pt;
  /** node it arrives at (−1: off the view) */
  node: number;
}

export class Cat extends BaseCreature {
  readonly kind = 'cat' as const;
  readonly visitor = false;
  readonly coat: CatCoat;
  /** for tests: dozes, stretches, washes, jumps, strolls */
  dozes = 0;
  stretches = 0;
  washes = 0;
  jumps = 0;
  strolls = 0;
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
  private prev: CatPose | null = null;
  private blendT = 1;
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
    const start = chooseRest(map, rng, w.view, null, held);
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
      this.setMode('walk', 0);
      this.layer = 'entities';
    }
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

  private settleAt(w: FaunaWorld, i: number): void {
    const n = catMap(w).nodes[i]!;
    this.node = i;
    let x = n.x;
    let y = n.y;
    if (n.perch) {
      x = clamp(n.x + this.rng.range(-0.5, 0.5) * n.perch.spread, n.perch.x - n.perch.spread, n.perch.x + n.perch.spread);
      y = perchY(n.perch, x);
    }
    this.pos = P(x, y);
    this.scale = n.perch ? (n.perch.scale ?? w.perspective(n.perch.depth, n.perch.x)) : w.perspective(y, x);
    this.layer = 'entities';
  }

  private setMode(m: Mode, t: number): void {
    if (m !== this.mode) {
      // a soft cross-fade from the old pose to the new one
      this.prev = this.pose();
      this.blendT = 0;
    }
    this.mode = m;
    this.modeT = 0;
    this.modeFor = t;
    this.state = m;
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
    this.blendT += (dt * sf) / CAT_TUNING.blend;
    this.ticks(dt * sf, w);
    if (this.leaving && this.mode !== 'dusk' && !this.route.length && !this.gone) {
      // nightfall: it sits up facing the sea for a while, then strolls off
      this.facing = Math.sign(w.pond.centre.x - this.pos.x) || -1;
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
    if (this.mode === 'sit' || this.mode === 'dusk' || this.mode === 'wake') {
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
    const held = heldSpots(w).filter((h) => dist(h, this.pos) > 1);
    const to = chooseRest(map, this.rng, w.view, this.node, held, route);
    if (to === null) return false;
    const path = pathTo(route.prev, this.node, to);
    if (path.length < 2) return false;
    this.route = [];
    let from = { ...this.pos };
    for (let k = 1; k < path.length; k++) {
      const n = map.nodes[path[k]!]!;
      const e = map.edges[path[k - 1]!]!.find((x) => x.to === path[k])!;
      let x = n.x;
      if (k === path.length - 1 && n.perch) x = clamp(n.x + this.rng.range(-0.5, 0.5) * n.perch.spread, n.perch.x - n.perch.spread, n.perch.x + n.perch.spread);
      const toPt = P(x, n.perch ? perchY(n.perch, x) : n.y);
      this.route.push({ kind: e.kind, from, to: toPt, node: path[k]! });
      from = toPt;
    }
    this.strolls++;
    this.startLeg(w);
    return true;
  }

  /** Away for the night: along its terrace to the landward edge of the view. */
  private goAway(w: FaunaWorld): void {
    const off = Math.max(w.view.x + w.view.w, 1600) + 50;
    this.route = [{ kind: 'off', from: { ...this.pos }, to: P(off, this.pos.y), node: -1 }];
    this.startLeg(w);
  }

  private startLeg(w: FaunaWorld): void {
    const leg = this.route[0]!;
    if (Math.abs(leg.to.x - leg.from.x) > 2) this.facing = Math.sign(leg.to.x - leg.from.x);
    this.layer = 'entities';
    this.setMode(leg.kind === 'jump' ? 'crouch' : 'walk', leg.kind === 'jump' ? 0.5 / w.speed : 0);
  }

  private travel(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const leg = this.route[0]!;
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
    const v = CAT_TUNING.walk * sf * this.scale;
    const d = dist(this.pos, leg.to);
    const k = Math.min(1, (v * dt) / Math.max(1e-6, d));
    this.pos = P(lerp(this.pos.x, leg.to.x, k), lerp(this.pos.y, leg.to.y, k));
    this.walkPh += (v * dt) / (CAT_TUNING.stride * this.scale);
    const node = leg.node >= 0 ? catMap(w).nodes[leg.node] : null;
    this.scale = node?.perch && d < 3 ? (node.perch.scale ?? w.perspective(node.perch.depth, node.perch.x)) : w.perspective(this.pos.y, this.pos.x);
    if (leg.kind === 'off' && this.pos.x > w.view.x + w.view.w + 30 * this.scale) {
      this.gone = true;
      this.done = true;
      return;
    }
    if (d < 0.3) this.arrive(w);
  }

  private arrive(w: FaunaWorld): void {
    const leg = this.route.shift()!;
    if (leg.node >= 0) this.node = leg.node;
    if (this.route.length) {
      this.startLeg(w);
      return;
    }
    if (leg.node >= 0) {
      const n = catMap(w).nodes[leg.node]!;
      this.pos = { ...leg.to };
      this.scale = n.perch ? (n.perch.scale ?? w.perspective(n.perch.depth, n.perch.x)) : w.perspective(this.pos.y, this.pos.x);
    }
    // a look round, then it sits
    if (this.rng.chance(0.4)) this.facing = -this.facing;
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
    const q: CatPose = { ...REST_POSE };
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
        q.sleep = k > 0.3 && k < 0.55;
        if (k < 0.7) q.shape = 'bow';
        else {
          q.shape = 'reach';
          q.pitch = 0.08;
        }
        return q;
      case 'sit':
      case 'dusk':
      case 'land':
        q.shape = this.mode === 'land' ? 'crouch' : 'sit';
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
      case 'crouch':
        q.shape = 'crouch';
        q.pitch = this.route[0] && this.route[0].to.y < this.route[0].from.y ? -0.12 : 0.12;
        return q;
      case 'leap': {
        const leg = this.route[0];
        q.shape = 'leap';
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

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities') return;
    const parts = w.art.get(`cat:${this.coat}`, (res) => paintCat(res, 3700 + CAT_COATS.indexOf(this.coat) * 40, this.coat));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * this.facing, this.scale);
    const now = this.pose();
    const b = clamp(this.blendT, 0, 1);
    if (this.prev && b < 1) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * (1 - b);
      drawCat(ctx, parts, this.prev);
      ctx.globalAlpha = a * b;
      drawCat(ctx, parts, now);
      ctx.globalAlpha = a;
    } else drawCat(ctx, parts, now);
    ctx.restore();
  }
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
    const c = new Cat(w, rng, coatName ?? CAT_COATS[Math.abs(s.seed) % CAT_COATS.length]!, heldSpots(w));
    return c.done ? [] : [c];
  },
  sheet: {
    w: 900,
    h: 200,
    make(res, seed) {
      const a = paintCat(res, seed, 'tabby');
      return [a.loaf, a.headSleep, a.head, a.curl, a.sit, a.sitLeg, a.bow, a.torso, a.foreNear, a.hindNear, a.tailUp, a.tailWrap, a.tailTip];
    },
  },
  show: { stage: 'coast', spec: { x: 760, y: 470, w: 560, h: 320 }, w: 840, h: 480, order: 40 },
};
export default cat;
