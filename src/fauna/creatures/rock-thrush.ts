/** Blue rock thrush (Monticola solitarius): a shy, upright, slate-blue thrush alone on high stone (the
 * temple, the copings, the cliff ledges). Flicks its tail, sings from its perch, drops for an insect and
 * flies straight back, slips away low from the cat. By day. docs/devlog/205-rock-thrush.md */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, cubic, cubicLength, cubicTangent, dist, easeInOut, lerp, rangeOf } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import { bobCurve } from './bunting';
import type { CreatureDef } from './lib/def';
import { exitPoint } from './lib/flight';

/** Bill to tail tip at perspective 1 (world units): about 21 cm, against the bunting's 14 (17 units). */
export const THRUSH_SIZE = 25;
const R = THRUSH_SIZE / 20;
const LEG = 2.6;
const PIVOT = 5.2;
const DROP = PIVOT - LEG + 2.1;
const LIFT = 7 * R;

export const THRUSH_TUNING = {
  /** seconds between acts on the perch */
  act: [1.2, 3.4] as const,
  /** chance an act is a song phrase, a tail flick, a bob */
  sing: 0.3,
  flick: 0.3,
  bob: 0.15,
  /** a song phrase (s) */
  phrase: [1.6, 3.2] as const,
  /** after this long on one perch it may move to another (s) */
  stayPut: [25, 70] as const,
  /** chance per second on the perch of dropping for an insect */
  drop: 0.05,
  /** how far below (world units) a ground spot may be to drop to */
  reach: 260,
  /** on the ground before it flies back (s) */
  snatch: [0.6, 1.4] as const,
  /** world units / s at perspective 1, and the least perspective it flies at (far birds still cross the view briskly) */
  flight: 150,
  minScale: 0.4,
  /** the least scale it is drawn at: on the far temple about 3.5 × life (as the cicada), so it reads close */
  minDraw: 0.45,
  /** a cat, goat or heron this close (world units) sends it away low */
  alarm: 110,
};

const THREATS = new Set(['cat', 'goat', 'heron']);

export interface ThrushParts {
  body: Sprite; // standing body and head, bill shut, anchored at the hip
  half: Sprite; // bill parted (song)
  open: Sprite; // bill open, throat full (song)
  legs: Sprite;
  tail: Sprite; // anchored at its root, pointing back (−x)
  flyUp: Sprite;
  flyMid: Sprite;
  flyDown: Sprite;
  glide: Sprite;
  size: number;
}

const C = {
  body: '#56647e',
  shade: '#3c475d',
  light: '#7d8ba3',
  wing: '#3b4356',
  wingDark: '#262b37',
  edge: '#8590a4',
  tail: '#2c3240',
  bill: '#202228',
  legs: '#2e2e33',
};

type Wing = 'fold' | 'up' | 'mid' | 'down';
const EYE = { x: 3.6, y: -14.0 };

/** Body and head in body units (r = S / 20): hip at the origin, upright, the bill toward +x. */
function paintBody(p: Painter, r: number, bill: 0 | 1 | 2, folded: boolean): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const throat = bill === 2 ? 0.35 : 0;
  const sil = smoothPolygon(
    [P(5.3, -14.3), P(4.6, -15.4), P(3.2, -15.9), P(1.8, -15.4), P(0.9, -14.2), P(0.0, -12.0), P(-1.2, -9.2), P(-2.1, -6.4), P(-2.6, -4.4), P(-2.0, -2.9), P(-0.4, -2.1), P(1.4, -2.4), P(2.9, -3.6), P(4.0, -5.8), P(4.6 + throat * 0.4, -8.4), P(4.8 + throat, -10.9), P(5.0 + throat * 0.6, -12.9)],
    2,
  );
  // one slate wash, a little lighter on the crown and breast, darker down the back and belly
  p.wetInWet(sil, C.light, C.body, {
    rng,
    angle: Math.PI / 2 + 0.3,
    split: 0.35,
    softness: 0.35,
    fingers: 0.4,
    opacity: 0.95,
    edge: 0.32,
    edgeWidth: 0.5 * r,
    sharpness: 0.4,
    centreLift: 0.06,
    granulation: 0.35,
    flow: 0.45,
    flowScale: 3 * r,
    deform: 0.06,
    spread: 0.07,
    blend: 'source-over',
    drops: [
      { pigment: C.shade, at: P(-1.4, -5.0), size: 3.2 * r, alpha: 0.45 },
      { pigment: C.light, at: P(4.0, -9.6), size: 2.0 * r, alpha: 0.3 },
    ],
  });
  // the faint scaling of the plumage and the shade under the belly
  const M = p.layer({ x: -4 * r, y: -17 * r, w: 11 * r, h: 16 * r });
  M.clip(sil);
  for (let i = 0; i < 9; i++) {
    const q = P(rng.range(-1.5, 4.6), rng.range(-11.5, -3.2));
    M.fill(blob(q.x, q.y, rng.range(0.6, 1.0) * r, rng.range(0.25, 0.4) * r, rng, { rotation: rng.range(-0.3, 0.3), irregularity: 0.35, points: 12 }), C.shade, rng.range(0.14, 0.26));
  }
  M.fill(blob(1.2 * r, -2.6 * r, 3.4 * r, 1.1 * r, rng, { rotation: -0.2, irregularity: 0.25 }), C.shade, 0.4);
  M.dry({ opacity: 0.88, edge: 0.14, edgeWidth: 0.3 * r, sharpness: 0.3, centreLift: 0, granulation: 0.3, granules: 0.1, flow: 0.4, flowScale: 2.5 * r });
  p.glaze(sil, C.shade, { rng, opacity: 0.28, edge: 0.12, edgeWidth: 0.3 * r, sharpness: 0.35, granulation: 0.3, deform: 0.05, spread: 0.08, fade: { angle: -Math.PI / 2 - 0.4, start: 0.4, amount: 1, ragged: 0.7 } });
  p.granulate(sil, C.shade, { rng, strength: 0.18 });
  // the light on the crown and the breast's shoulder
  const Lt = p.layer({ x: -4 * r, y: -17 * r, w: 11 * r, h: 10 * r });
  Lt.clip(sil);
  Lt.fill(blob(2.8 * r, -15.4 * r, 2.0 * r, 0.6 * r, rng, { irregularity: 0.25 }), '#a6b2c4', 0.45);
  Lt.fill(blob(4.6 * r, -10.4 * r, 0.8 * r, 1.8 * r, rng, { irregularity: 0.3 }), '#9aa7bb', 0.3);
  Lt.dry({ opacity: 0.4, edge: 0, sharpness: 0.12, centreLift: 0, granulation: 0.2, flow: 0.5, flowScale: 2 * r, blend: 'source-over' });
  // the long straight bill, parted for the song
  const gape = bill === 0 ? 0 : bill === 1 ? 0.22 : 0.48;
  const upper = smoothPolygon([P(5.0, -14.6), P(7.0, -14.4 - gape * 1.4), P(9.3, -13.95 - gape * 2.4), P(7.0, -13.8 - gape * 1.2), P(5.1, -13.75)], 1);
  const lower = smoothPolygon([P(5.1, -13.7), P(7.0, -13.75 + gape * 0.9), P(9.0, -13.85 + gape * 2.2), P(7.0, -13.35 + gape * 0.9), P(5.0, -13.0)], 1);
  p.wash(lower, '#34363e', { rng, opacity: 0.9, edge: 0.3, edgeWidth: 0.15 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  p.wash(upper, C.bill, { rng, opacity: 0.94, edge: 0.3, edgeWidth: 0.15 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  // the eye: a dark socket, the iris, a catch-light
  p.dab(P(EYE.x - 0.1, EYE.y + 0.05), C.shade, { rng, variant: 'round', angle: 0, length: 1.5 * r, width: 1.3 * r, opacity: 0.35, edge: 0.05, sharpness: 0.15 });
  p.dab(P(EYE.x, EYE.y), '#15161a', { rng, variant: 'round', angle: 0, length: 0.95 * r, width: 0.9 * r, opacity: 0.94, edge: 0.3 });
  p.dab(P(EYE.x + 0.2, EYE.y - 0.22), '#fbf7ef', { rng, variant: 'round', angle: 0, length: 0.26 * r, width: 0.24 * r, opacity: 0.85, blend: 'source-over' });
  if (folded) paintFoldedWing(p, r);
}

/** The folded wing down the back: darker than the body, pale-fringed coverts, the primaries past the rump. */
function paintFoldedWing(p: Painter, r: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const wing = smoothPolygon([P(2.2, -11.4), P(0.8, -11.9), P(-0.6, -10.4), P(-1.8, -7.8), P(-2.7, -5.0), P(-3.1, -3.4), P(-2.1, -3.9), P(-0.8, -5.6), P(0.9, -7.6), P(2.1, -9.6)], 2);
  p.wetInWet(wing, C.wing, C.wingDark, { rng, angle: Math.PI / 2 + 0.4, split: 0.55, softness: 0.55, fingers: 0.5, opacity: 0.85, edge: 0.18, edgeWidth: 0.3 * r, sharpness: 0.42, granulation: 0.35, flow: 0.45, flowScale: 2 * r, deform: 0.05, spread: 0.05, blend: 'source-over', fade: { angle: -0.6, start: 0.75, amount: 0.3 } });
  for (let k = 0; k < 3; k++) {
    const y = -10.4 + k * 1.3;
    p.inkLine([P(1.4 - k * 0.4, y), P(-0.2 - k * 0.5, y + 1.6), P(-1.4 - k * 0.5, y + 3.4)], { rng, width: 0.15 * r, opacity: 0.32, breaks: 0.45, pigment: C.edge, taper: [0.3, 0.6] });
  }
  p.dab(P(-2.4, -4.4), C.wingDark, { rng, variant: 'leaf', angle: Math.PI / 2 + 0.45, length: 2.4 * r, width: 0.8 * r, opacity: 0.55 });
}

/** An open wing from its shoulder along angle `a` (flight frames). */
function paintOpenWing(p: Painter, r: number, a: number, len: number, wide: number, op: number, side: number): void {
  const rng = p.rng;
  const pts = [
    [0, -0.6],
    [0.35, -0.8],
    [0.7, -0.68],
    [0.95, -0.3],
    [1.05, 0],
    [0.95, 0.24],
    [0.8, 0.22],
    [0.68, 0.44],
    [0.5, 0.4],
    [0.3, 0.58],
    [0, 0.6],
  ];
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (u: number, v: number) => {
    const x = u * len * r;
    const y = v * wide * r * side;
    return { x: x * ca - y * sa, y: x * sa + y * ca };
  };
  const shape = smoothPolygon(
    pts.map(([u, v]) => at(u!, v!)),
    2,
  );
  p.wetInWet(shape, C.wing, C.wingDark, { rng, angle: a, split: 0.5, softness: 0.5, opacity: op, edge: 0.24, edgeWidth: 0.3 * r, sharpness: 0.4, granulation: 0.3, flow: 0.5, flowScale: 2 * r, deform: 0.05, spread: 0.06, blend: 'source-over', fade: { angle: a + (side * Math.PI) / 2, start: 0.7, amount: 0.4 } });
  for (const v of [-0.15, 0.15, 0.4]) p.inkLine([at(0.45, v * 0.5), at(0.96, v)], { rng, width: 0.13 * r, opacity: 0.28 * op, breaks: 0.4, pigment: C.edge, taper: [0.4, 0.5] });
}

function paintTail(p: Painter, r: number, spread = 1): void {
  const w = spread;
  const tail = smoothPolygon(
    [{ x: 1.0 * r, y: -0.75 * r * w }, { x: -3.0 * r, y: -0.9 * r * w }, { x: -5.6 * r, y: -1.1 * r * w }, { x: -6.0 * r, y: 0 }, { x: -5.6 * r, y: 1.1 * r * w }, { x: -3.0 * r, y: 0.9 * r * w }, { x: 1.0 * r, y: 0.75 * r * w }],
    2,
  );
  p.wetInWet(tail, C.wing, C.tail, { rng: p.rng, angle: Math.PI, split: 0.3, softness: 0.5, opacity: 0.92, edge: 0.24, edgeWidth: 0.35 * r, sharpness: 0.4, granulation: 0.4, flow: 0.5, flowScale: 2 * r, deform: 0.05, blend: 'source-over', fade: { angle: 0, start: 0.75, amount: 0.55 } });
  p.inkLine([{ x: 0.4 * r, y: 0.05 * r }, { x: -5.3 * r, y: 0.05 * r }], { rng: p.rng, width: 0.13 * r, opacity: 0.2, breaks: 0.5, pigment: C.edge });
}

/** The body level in flight, the centre at the origin, the head and long bill forward (+x). */
function paintFlightBody(p: Painter, r: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const sil = smoothPolygon([P(6.6, -0.6), P(5.6, -1.9), P(3.8, -2.2), P(1.0, -1.9), P(-2.4, -1.5), P(-4.6, -0.7), P(-4.8, 0.4), P(-2.6, 1.4), P(0.6, 1.9), P(3.6, 1.5), P(5.6, 0.7), P(6.8, 0.2)], 2);
  p.wetInWet(sil, C.light, C.body, { rng, angle: Math.PI / 2, split: 0.4, softness: 0.4, opacity: 0.95, edge: 0.3, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.35, flow: 0.45, flowScale: 3 * r, deform: 0.05, spread: 0.06, blend: 'source-over' });
  p.granulate(sil, C.shade, { rng, strength: 0.18 });
  p.wash(smoothPolygon([P(6.5, -0.55), P(8.6, -0.25), P(10.4, 0.05), P(8.6, 0.3), P(6.6, 0.45)], 1), C.bill, { rng, opacity: 0.94, edge: 0.3, edgeWidth: 0.15 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  p.dab(P(5.3, -0.75), '#15161a', { rng, variant: 'round', angle: 0, length: 0.9 * r, width: 0.85 * r, opacity: 0.94, edge: 0.3 });
  p.dab(P(5.45, -0.95), '#fbf7ef', { rng, variant: 'round', angle: 0, length: 0.24 * r, width: 0.22 * r, opacity: 0.85, blend: 'source-over' });
}

export function paintThrush(res: number, seed: number): ThrushParts {
  const r = R;
  const box = { w: 15 * r, h: 18 * r, ox: 4.5 * r, oy: 17 * r };
  const body = paintSprite(res, box, seed, (p) => paintBody(p, r, 0, true));
  const half = paintSprite(res, box, seed, (p) => paintBody(p, r, 1, true));
  const open = paintSprite(res, box, seed, (p) => paintBody(p, r, 2, true));
  const legs = paintSprite(res, { w: 9 * r, h: 6 * r, ox: 4.4 * r, oy: 5 * r }, seed + 1, (p, rng) => {
    // dark legs from the belly feathers, the far one greyer; three toes forward, one back
    for (const [hx, fx, far] of [
      [-0.6, -0.5, true],
      [0.6, 0.9, false],
    ] as const) {
      const pig = far ? mix(C.legs, PIGMENTS.shadow, 0.3) : C.legs;
      const knee = { x: (hx + 0.4) * r, y: -LEG * 0.55 * r };
      p.stroke([{ x: hx * r, y: -(LEG + 1.0) * r }, knee, { x: fx * r, y: -0.1 * r }], { rng, pigment: pig, width: 0.5 * r, opacity: far ? 0.7 : 0.9, wetness: 0.5, wobble: 0.06, taper: [0, 0.25] });
      for (const [tx, ty] of [
        [1.9, 0.1],
        [1.4, 0.35],
        [-1.2, 0.05],
      ] as const) {
        p.stroke([{ x: fx * r, y: 0 }, { x: (fx + tx) * r, y: ty * r }], { rng, pigment: pig, width: 0.2 * r, opacity: far ? 0.6 : 0.8, wetness: 0.4, wobble: 0.12, taper: [0.1, 0.6] });
      }
    }
  });
  const tail = paintSprite(res, { w: 10 * r, h: 4 * r, ox: 8.2 * r, oy: 2 * r }, seed + 2, (p) => paintTail(p, r));
  const flyBox = { w: 30 * r, h: 30 * r, ox: 15 * r, oy: 16 * r };
  const fly = (wing: Wing, k: number) =>
    paintSprite(res, flyBox, seed + 3 + k, (p) => {
      p.ctx.save();
      p.ctx.translate(-4.2 * r, 0.3 * r);
      p.ctx.rotate(0.06);
      paintTail(p, r, wing === 'fold' ? 1 : 1.3);
      p.ctx.restore();
      paintFlightBody(p, r);
      if (wing === 'fold') return;
      p.ctx.save();
      p.ctx.translate(0.8 * r, -0.8 * r);
      if (wing === 'up') paintOpenWing(p, r, -Math.PI / 2 - 0.4, 11, 3.2, 0.92, -1);
      else if (wing === 'down') paintOpenWing(p, r, Math.PI / 2 + 0.55, 10, 3, 0.9, 1);
      else {
        paintOpenWing(p, r, -Math.PI / 2 - 0.2, 8.5, 3, 0.3, -1);
        paintOpenWing(p, r, Math.PI - 0.2, 9.2, 2.5, 0.88, -1);
      }
      p.ctx.restore();
    });
  return { body, half, open, legs, tail, flyUp: fly('up', 0), flyMid: fly('mid', 1), flyDown: fly('down', 2), glide: fly('fold', 3), size: THRUSH_SIZE };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** High stone: the temple, the copings and the cliff ledges (no fallen drum). */
export function thrushPerches(w: Pick<FaunaWorld, 'perches'>): Perch[] {
  return w.perches.filter((p) => (p.kind === 'ruin' && p.id !== 'drum') || p.kind === 'wall' || p.kind === 'ledge');
}

/** The next perch, free of other creatures' spots and never `not`: the higher, the likelier; the temple most. */
export function choosePerch(w: Pick<FaunaWorld, 'perches'>, rng: Rng, held: readonly Pt[], not: Perch | null = null): Perch | null {
  const all = thrushPerches(w);
  const free = all.filter((p) => p !== not && !held.some((h) => Math.abs(h.x - p.x) <= p.spread + 10 && Math.abs(h.y - p.y) < 18));
  if (free.length === 0) return null;
  const top = Math.min(...all.map((p) => p.y));
  const weights = free.map((p) => Math.exp(-(p.y - top) / 140) * (p.kind === 'ruin' ? 3 : p.kind === 'ledge' ? 0.15 : 1));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

/** A spot below the perch to drop to, on the same plane (a walk, scrub, a lower ledge or the fallen drum), or null. */
export function dropSpot(w: Pick<FaunaWorld, 'ground' | 'perches' | 'perspective'>, from: Pt, scale: number, rng: Rng): { at: Pt; scale: number } | null {
  const near = (q: Pt, s: number) => q.y > from.y + 15 && dist(q, from) < THRUSH_TUNING.reach && Math.abs(s - scale) < scale * 0.6;
  const pool: { at: Pt; scale: number }[] = [];
  for (const g of w.ground) {
    const at = { x: g.x + rng.range(-0.6, 0.6) * g.rx, y: g.y + rng.range(-0.4, 0.4) * g.ry };
    const s = w.perspective(at.y, at.x);
    if (near(at, s)) pool.push({ at, scale: s });
  }
  for (const p of w.perches) {
    if (p.kind !== 'ledge' && p.id !== 'drum') continue;
    const s = p.scale ?? w.perspective(p.depth, p.x);
    if (near(p, s)) pool.push({ at: { x: p.x, y: perchY(p, p.x) }, scale: s });
  }
  return pool.length === 0 ? null : pool[rng.int(0, pool.length - 1)]!;
}

/** Is a cat, goat or heron within the alarm distance of `at`? */
export function threatNear(w: Pick<FaunaWorld, 'creatures'>, at: Pt): boolean {
  return w.creatures.some((c) => !c.done && THREATS.has(c.kind) && Math.hypot(c.x - at.x, c.y - at.y) < THRUSH_TUNING.alarm);
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
  then: 'perch' | 'ground' | 'gone';
}

export type ThrushAct = 'still' | 'flick' | 'bob' | 'sing' | 'turn';
export type ThrushMode = 'fly' | 'perch' | 'drop' | 'ground' | 'return' | 'flee' | 'leave';

export interface ThrushPose {
  pitch: number;
  tail: number;
  bill: 0 | 1 | 2;
  head: number;
}

export const STAND: ThrushPose = { pitch: 0, tail: 0, bill: 0, head: 0 };

/** The song: the bill parts and opens in pulses, the head lifts (k = seconds into the phrase). */
export function songPose(k: number): ThrushPose {
  const ph = (k * 4.2) % 1;
  return { pitch: -0.12, tail: 0.05, bill: ph < 0.45 ? 2 : ph < 0.7 ? 1 : 0, head: -0.12 };
}

export class RockThrush extends BaseCreature {
  readonly kind = 'rock-thrush' as const;
  readonly visitor = false;
  perch: Perch | null = null;
  /** for tests: phrases sung, drops to the ground, returns, flicks, alarms */
  songs = 0;
  drops = 0;
  returns = 0;
  flicks = 0;
  alarms = 0;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private leg: Leg | null = null;
  private act: ThrushAct = 'still';
  private actT = 0;
  private actFor = 1;
  private onPerch = 0;
  private stayPut: number;
  private flap = 0;
  private heading = 0;
  private home: Perch | null = null;
  private visitT = 0;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    private readonly stay: number,
  ) {
    super();
    this.stayPut = rangeOf(rng, [...THRUSH_TUNING.stayPut]);
    const p = choosePerch(w, rng, heldSpots(w));
    if (!p) {
      this.done = true;
      return;
    }
    const v = w.view;
    const side = rng.chance(0.5) ? -1 : 1;
    this.pos = { x: side < 0 ? v.x - 40 : v.x + v.w + 40, y: clamp(p.y - rng.range(20, 80), v.y + 20, v.y + v.h) };
    this.scale = p.scale ?? w.perspective(p.depth, p.x);
    this.flyTo(p, w, 'perch');
    this.go('fly');
    this.sync();
  }

  /** Where it stands or is making for (other creatures keep off it). */
  spot(): Pt | null {
    const p = this.perch ?? this.home;
    return p && this.state !== 'flee' && this.state !== 'leave' ? { x: p.x, y: p.y } : null;
  }

  doing(): ThrushMode {
    return this.state as ThrushMode;
  }

  acting(): ThrushAct | null {
    return this.state === 'perch' ? this.act : null;
  }

  private flyTo(target: Perch | Pt, w: FaunaWorld, then: Leg['then'], landScale?: number): void {
    const rng = this.rng;
    const isPerch = 'kind' in target;
    let to: Pt;
    let s1: number;
    if (isPerch) {
      const x = target.x + rng.range(-0.4, 0.4) * target.spread;
      to = { x, y: perchY(target, x) };
      s1 = target.scale ?? w.perspective(target.depth, target.x);
      this.perch = target;
    } else {
      to = { ...target };
      s1 = landScale ?? this.scale;
      this.perch = null;
    }
    const from = { ...this.pos };
    const dx = to.x - from.x;
    const len = dist(from, to);
    // a drop is a steep dive; the way back a straight rise; a move or an exit a low dip
    const sag = then === 'ground' ? 0 : then === 'gone' ? clamp(len * 0.08, 6, 30) : then === 'perch' && this.state === 'ground' ? -clamp(len * 0.1, 4, 20) : clamp(len * 0.15, 8, 40);
    const p1 = { x: from.x + dx * 0.25, y: from.y + (to.y - from.y) * (then === 'ground' ? 0.6 : 0.2) + sag };
    const p2 = { x: to.x - dx * 0.25, y: to.y + sag * 0.6 };
    this.leg = { p0: from, p1, p2, p3: to, len: Math.max(1, cubicLength(from, p1, p2, to)), u: 0, s0: this.scale, s1, then };
    if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
    this.layer = 'air';
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    this.visitT += dt;
    if (!this.leaving && (w.mode.night || (this.stay > 0 && this.visitT > this.stay))) this.leaving = true;
    const settled = this.state === 'perch' || this.state === 'ground';
    if (settled && this.state !== 'flee' && threatNear(w, this.pos)) {
      this.alarms++;
      this.flee(w);
    } else if (settled && this.leaving) this.depart(w);
    if (this.leg) this.flyStep(dt, w);
    else if (this.state === 'perch') this.perchStep(dt, w);
    else if (this.state === 'ground') this.groundStep(dt, w);
    this.sync();
  }

  /** Slips away low off the nearer side, away from the threat. */
  private flee(w: FaunaWorld): void {
    const to = exitPoint(w.view, this.pos, this.rng, 10);
    to.y = clamp(this.pos.y + this.rng.range(10, 50), w.view.y + 10, w.view.y + w.view.h - 10);
    this.home = null;
    this.flyTo(to, w, 'gone');
    this.go('flee');
  }

  private depart(w: FaunaWorld): void {
    this.home = null;
    this.flyTo(exitPoint(w.view, this.pos, this.rng, 80), w, 'gone');
    this.go('leave');
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const f = this.leg!;
    const sf = w.speed;
    const k = f.then === 'gone' ? 0.7 + f.u : 0.5 + 0.5 * Math.min(1, f.u * 5, (1 - f.u) * 3.5);
    f.u = Math.min(1, f.u + (THRUSH_TUNING.flight * sf * k * dt * Math.max(THRUSH_TUNING.minScale, (f.s0 + f.s1) * 0.5)) / f.len);
    const q = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
    const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
    this.flap += dt * sf;
    this.pos = q;
    this.scale = lerp(f.s0, f.s1, easeInOut(f.u));
    if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
    this.heading = clamp(Math.atan2(tg.y, Math.abs(tg.x)) * 0.6, -0.6, 0.6);
    if (f.u < 1) return;
    this.leg = null;
    if (f.then === 'gone') {
      this.done = true;
      return;
    }
    this.layer = 'entities';
    if (f.then === 'ground') {
      this.actFor = rangeOf(this.rng, [...THRUSH_TUNING.snatch]) / sf;
      this.actT = 0;
      this.go('ground');
      return;
    }
    if (this.state === 'return') this.returns++;
    else this.onPerch = 0;
    this.go('perch');
    this.nextAct(w);
  }

  private groundStep(dt: number, w: FaunaWorld): void {
    this.actT += dt;
    if (this.actT < this.actFor) return;
    const back = this.home;
    if (!back) {
      this.depart(w);
      return;
    }
    this.flyTo(back, w, 'perch');
    this.go('return');
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.actT += dt;
    this.onPerch += dt;
    if (this.actT < this.actFor) return;
    const p = this.perch!;
    if (this.rng.chance(clamp(THRUSH_TUNING.drop * this.actFor * sf, 0, 1))) {
      const to = dropSpot(w, this.pos, this.scale, this.rng);
      if (to) {
        this.drops++;
        this.home = p;
        this.flyTo(to.at, w, 'ground', to.scale);
        this.go('drop');
        return;
      }
    }
    if (this.onPerch > this.stayPut / sf) {
      const next = choosePerch(w, this.rng, heldSpots(w).filter((h) => h.x !== p.x || h.y !== p.y), p);
      this.stayPut = rangeOf(this.rng, [...THRUSH_TUNING.stayPut]);
      if (next) {
        this.flyTo(next, w, 'perch');
        this.go('fly');
        return;
      }
    }
    this.nextAct(w);
  }

  private nextAct(w: FaunaWorld): void {
    const rng = this.rng;
    const t = THRUSH_TUNING;
    const r = rng.next();
    let dur = rangeOf(rng, [...t.act]);
    if (r < t.sing) {
      this.act = 'sing';
      this.songs++;
      dur = rangeOf(rng, [...t.phrase]);
    } else if (r < t.sing + t.flick) {
      this.act = 'flick';
      this.flicks++;
      dur = rng.range(0.6, 1.2);
    } else if (r < t.sing + t.flick + t.bob) {
      this.act = 'bob';
      dur = rng.range(0.5, 0.9);
    } else if (r < t.sing + t.flick + t.bob + 0.08) {
      this.act = 'turn';
      this.facing = -this.facing;
    } else this.act = 'still';
    this.actFor = dur / w.speed;
    this.actT = 0;
  }

  /** Its pose now (draw, studio, tests). */
  pose(): ThrushPose {
    if (this.state === 'ground') return { ...STAND, pitch: 0.7 * bobCurve(this.actT / this.actFor), tail: 0.15 };
    if (this.state !== 'perch') return STAND;
    const k = clamp(this.actT / this.actFor, 0, 1);
    if (this.act === 'sing') return songPose(this.actT);
    if (this.act === 'flick') return { ...STAND, tail: 0.75 * bobCurve((k * 2) % 1) };
    if (this.act === 'bob') return { ...STAND, pitch: 0.25 * bobCurve(k), tail: 0.3 * bobCurve(k) };
    return STAND;
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    if (this.leg) return null;
    return this.perch ? this.perch.depth : this.pos.y + 1;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const air = this.leg !== null;
    if (air ? layer !== 'air' : layer !== 'entities') return;
    const parts = w.art.get('rock-thrush', (res) => paintThrush(res, 3910));
    ctx.save();
    ctx.translate(this.x, this.y);
    const k = Math.max(this.scale, THRUSH_TUNING.minDraw);
    ctx.scale(k * this.facing, k);
    if (air) drawFlying(ctx, parts, this.flap, this.heading, glides(this.leg!, this.flap));
    else drawPerched(ctx, parts, this.pose());
    ctx.restore();
  }
}

const BEAT_HZ = 10;
const glides = (f: Leg, flap: number) => f.u > 0.2 && f.u < 0.8 && (flap * 1.6) % 1 > 0.6;

/** A thrush standing at the origin (its feet), facing +x, in world units at perspective 1. */
export function drawPerched(ctx: Ctx, parts: ThrushParts, q: ThrushPose): void {
  const r = parts.size / 20;
  const legs = parts.legs;
  ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
  ctx.save();
  ctx.translate(0, -PIVOT * r);
  ctx.rotate(q.pitch + q.head);
  ctx.translate(0, DROP * r);
  const tail = parts.tail;
  ctx.save();
  ctx.translate(-2.1 * r, -3.6 * r);
  // the tail hangs below the rump and flicks up
  ctx.rotate(-1.25 - q.pitch * 0.4 + q.tail);
  ctx.drawImage(tail.img as CanvasImageSource, -tail.ox, -tail.oy, tail.w, tail.h);
  ctx.restore();
  const b = q.bill === 2 ? parts.open : q.bill === 1 ? parts.half : parts.body;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  ctx.restore();
}

/** A thrush in flight at the origin (its feet's place), facing +x. */
export function drawFlying(ctx: Ctx, parts: ThrushParts, flap: number, heading: number, gliding: boolean): void {
  ctx.translate(0, -LIFT);
  ctx.rotate(heading);
  let s = parts.glide;
  if (!gliding) {
    const ph = Math.floor(flap * BEAT_HZ * 4) % 4;
    s = ph === 0 ? parts.flyUp : ph === 2 ? parts.flyDown : parts.flyMid;
  }
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
}

const hasRuins = (w: Pick<FaunaWorld, 'perches'>) => w.perches.some((p) => p.kind === 'ruin');

const rockThrush: CreatureDef = {
  kind: 'rock-thrush',
  title: 'blue rock thrush',
  role: 'drifter',
  // uncommon, alone, by day
  visit: { gap: [150, 360], first: [20, 60], stay: [150, 360], group: [1, 1], max: 1, diurnal: true, visitor: false },
  needs: hasRuins,
  spawn(w, s) {
    if (!hasRuins(w) || w.creatures.some((c) => c instanceof RockThrush && !c.done)) return [];
    const rng = w.rng.fork(`rock-thrush:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const t = new RockThrush(w, rng, s.stay || 240);
    return t.done ? [] : [t];
  },
  sheet: {
    w: 640,
    h: 170,
    make(res, seed) {
      const m = paintThrush(res, seed);
      return [m.body, m.open, m.tail, m.legs, m.flyUp, m.flyMid, m.flyDown, m.glide];
    },
  },
  show: { stage: 'coast', spec: { x: 600, y: 200, w: 400, h: 240 }, w: 640, h: 384, group: 1, order: 346 },
};
export default rockThrush;
