/** House bunting (Emberiza sahari): the oasis's tame resident, a cinnamon bird with a grey streaked hood.
 * Hops the copings, rim and stones, pecks, drinks, dips from wall to wall; a pair by day. Facing right.
 * docs/devlog/128-house-bunting.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { clamp, cubic, cubicLength, cubicTangent, dist, easeInOut, lerp, rangeOf } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import type { CreatureDef } from './lib/def';
import { exitPoint } from './lib/flight';

/** Bill to tail tip at perspective 1 (world units): about 14 cm, a little smaller than the sparrow (19). */
export const BUNTING_SIZE = 17;
const R = BUNTING_SIZE / 20;
const LEG = 2.3; // the belly's height above the feet, in body units (r)
/** where the body pivots to peck and sip, above the feet (r), and the body's origin below that pivot */
const PIVOT = 4.6;
const DROP = PIVOT - LEG + 2.5;
/** the body's centre above the feet, where the flight frames are anchored */
const LIFT = 6.4 * R;

export const BUNTING_TUNING = {
  /** seconds on one perch before a dip to another */
  perch: [7, 20] as const,
  /** world units / s at perspective 1: short, unhurried dips */
  flight: 130,
  /** chance that an act on the basin rim is a drink */
  drink: 0.22,
  /** distance (world units) that halves a perch's appeal: it keeps to its own stretch of walls */
  reach: 240,
  /** a perch is held when another creature's spot is this close beyond its spread */
  hold: 12,
};

export const BUNTING_SEXES = ['male', 'female'] as const;
export type BuntingSex = (typeof BUNTING_SEXES)[number];

export interface BuntingParts {
  body: Sprite; // standing body and head, anchored at the hip
  legs: Sprite; // anchored at the feet
  tail: Sprite; // anchored at its root, pointing back (−x)
  flyUp: Sprite; // flight frames, anchored at the body centre
  flyMid: Sprite;
  flyDown: Sprite;
  glide: Sprite; // wings shut between bursts of beats
  size: number;
}

interface Colours {
  body: Pigment;
  shade: Pigment;
  light: Pigment;
  hood: Pigment;
  streak: Pigment;
  wing: Pigment;
  wingDark: Pigment;
  edge: Pigment;
  tail: Pigment;
  legs: Pigment;
}

function colours(sex: BuntingSex): Colours {
  // research palette: cinnamon #c98a52, shade #a8703e, hood #8a8c90, streaks #5a5a60
  if (sex === 'female') {
    return { body: '#c49c74', shade: '#a2805e', light: '#dcc09c', hood: '#9c9288', streak: '#6e665e', wing: '#ac8058', wingDark: '#806048', edge: '#d8bc98', tail: '#74583f', legs: '#b99480' };
  }
  return { body: '#c98a52', shade: '#a8703e', light: '#e0b486', hood: '#8a8c90', streak: '#55555c', wing: '#b06a40', wingDark: '#83502f', edge: '#dcaa7c', tail: '#74482f', legs: '#b98c74' };
}

const EYE = { x: 5.55, y: -10.45 };
type Wing = 'fold' | 'up' | 'mid' | 'down';

/** A pointed bunting wing from the shoulder (0, 0) along +x, turned by `a`; `side` puts the trailing edge on ±v. */
function wingShape(r: number, a: number, len: number, wide: number, side: number): Pt[] {
  const pts = [
    [0, -0.6],
    [0.35, -0.85],
    [0.7, -0.7],
    [0.95, -0.3],
    [1.05, 0.0],
    [0.95, 0.22],
    [0.84, 0.18],
    [0.74, 0.4],
    [0.6, 0.34],
    [0.47, 0.56],
    [0.3, 0.52],
    [0.12, 0.66],
    [0, 0.6],
  ];
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return smoothPolygon(
    pts.map(([u, v]) => {
      const x = u! * len * r;
      const y = v! * wide * r * side;
      return { x: x * ca - y * sa, y: x * sa + y * ca };
    }),
    2,
  );
}

/** Body and head in body units (r = S / 20): hip at the origin, bill toward +x. */
function paintBody(p: Painter, r: number, c: Colours, sex: BuntingSex, wing: Wing): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  // a slim finch: round head on a short neck, a full breast, the back running down to the rump
  const sil = smoothPolygon(
    [P(7.7, -10.0), P(7.3, -11.4), P(6.2, -12.3), P(4.7, -12.5), P(3.3, -12.0), P(2.2, -11.0), P(0.8, -10.1), P(-1.8, -9.3), P(-4.4, -8.1), P(-6.4, -6.7), P(-6.8, -5.7), P(-5.4, -4.6), P(-2.6, -3.3), P(0.4, -2.5), P(3.0, -2.8), P(5.0, -4.1), P(6.4, -6.0), P(7.0, -7.9), P(7.5, -9.0)],
    2,
  );
  // one wet wash: the grey hood bleeding into the cinnamon body along a line from nape to breast
  p.wetInWet(sil, c.hood, c.body, {
    rng,
    angle: Math.PI - 0.57,
    split: 0.4,
    softness: 0.22,
    fingers: 0.55,
    opacity: 0.95,
    edge: 0.32,
    edgeWidth: 0.5 * r,
    sharpness: 0.4,
    centreLift: 0.08,
    granulation: 0.3,
    flow: 0.45,
    flowScale: 3 * r,
    deform: 0.07,
    spread: 0.08,
    blend: 'source-over',
    fade: { angle: -Math.PI / 2 - 0.5, start: 0.75, amount: 0.3, ragged: 0.8 },
    drops: [
      { pigment: c.shade, at: P(-1.0, -3.6), size: 3.4 * r, alpha: 0.4 },
      { pigment: c.light, at: P(3.6, -3.9), size: 2.0 * r, alpha: 0.35 },
    ],
  });
  // the throat's grey carried down a little, the flank feathering and the shade under the belly
  const M = p.layer({ x: -8 * r, y: -14 * r, w: 18 * r, h: 13 * r });
  M.clip(sil);
  M.fill(blob(6.0 * r, -7.4 * r, 1.4 * r, 2.0 * r, rng, { rotation: 0.25, irregularity: 0.25 }), c.hood, sex === 'male' ? 0.18 : 0.1);
  for (let i = 0; i < 7; i++) {
    const q = P(rng.range(-4.0, 4.2), rng.range(-5.8, -3.0));
    M.fill(blob(q.x, q.y, rng.range(0.7, 1.2) * r, rng.range(0.28, 0.5) * r, rng, { rotation: rng.range(-0.4, 0.2), irregularity: 0.35, points: 12 }), c.shade, rng.range(0.12, 0.24));
  }
  M.fill(blob(0.0 * r, -2.7 * r, 5.6 * r, 1.2 * r, rng, { rotation: -0.06, irregularity: 0.25 }), c.shade, 0.32);
  M.dry({ opacity: 0.88, edge: 0.14, edgeWidth: 0.3 * r, sharpness: 0.3, centreLift: 0, granulation: 0.3, granules: 0.1, flow: 0.4, flowScale: 2.5 * r });
  // fine dark streaks over the crown and nape, finer and sparser on the throat
  const head = { x: 4.6, y: -10.6 };
  for (let i = 0; i < 16; i++) {
    const a = rng.range(-2.9, -0.5);
    const d = rng.range(0.6, 2.6);
    const q = P(head.x + Math.cos(a) * d * 1.15, head.y + Math.sin(a) * d * 0.9);
    const dir = a + Math.PI / 2 + rng.range(-0.25, 0.25);
    const len = rng.range(0.6, 1.0) * r;
    p.inkLine([q, { x: q.x - Math.sin(dir) * len, y: q.y + Math.cos(dir) * len }], { rng, width: 0.17 * r, opacity: rng.range(0.32, 0.55) * (sex === 'male' ? 1 : 0.7), breaks: 0.2, pigment: c.streak, taper: [0.3, 0.5] });
  }
  for (let i = 0; i < 7; i++) {
    const q = P(rng.range(5.4, 6.9), rng.range(-8.6, -6.0));
    p.inkLine([q, { x: q.x - 0.25 * r, y: q.y + rng.range(0.5, 0.8) * r }], { rng, width: 0.14 * r, opacity: rng.range(0.22, 0.38) * (sex === 'male' ? 1 : 0.6), breaks: 0.3, pigment: c.streak, taper: [0.3, 0.5] });
  }
  // the face: a faint pale brow and moustache, a darker line through the eye
  p.dryBrush([P(3.3, -11.2), P(4.6, -11.35), P(6.2, -11.15)], { rng, pigment: '#e4e0da', width: 0.42 * r, opacity: 0.32, dryness: 0.55 });
  p.dryBrush([P(5.4, -8.8), P(6.5, -8.5)], { rng, pigment: '#e2ddd6', width: 0.36 * r, opacity: 0.26, dryness: 0.6 });
  p.inkLine([P(3.5, -10.25), P(4.8, -10.4)], { rng, width: 0.3 * r, opacity: 0.28, breaks: 0.2, pigment: c.streak, taper: [0.5, 0.2] });
  // a cinnamon glaze deepens the belly and rump, lost before the hood; fine granules settle in it
  p.glaze(sil, c.shade, { rng, opacity: 0.32, edge: 0.12, edgeWidth: 0.3 * r, sharpness: 0.35, granulation: 0.3, deform: 0.05, spread: 0.08, fade: { angle: -0.57, start: 0.4, amount: 1, ragged: 0.7 } });
  p.granulate(sil, c.shade, { rng, strength: 0.16 });
  // where the light hits: the crown and mantle
  const Lt = p.layer({ x: -8 * r, y: -14 * r, w: 18 * r, h: 8 * r });
  Lt.clip(sil);
  Lt.fill(blob(1.0 * r, -10.0 * r, 4.4 * r, 1.2 * r, rng, { rotation: 0.3, irregularity: 0.3 }), c.light, 0.5);
  Lt.fill(blob(5.0 * r, -12.2 * r, 2.0 * r, 0.7 * r, rng, { irregularity: 0.25 }), '#c4c6ca', 0.45);
  Lt.dry({ opacity: 0.4, edge: 0, sharpness: 0.12, centreLift: 0, granulation: 0.2, flow: 0.5, flowScale: 2 * r, blend: 'source-over' });
  // the conical bill: a dark upper mandible over a yellow-orange lower one
  const upper = smoothPolygon([P(7.4, -10.6), P(8.6, -10.25), P(9.7, -9.75), P(8.6, -9.55), P(7.5, -9.6)], 1);
  const lower = smoothPolygon([P(7.5, -9.55), P(8.6, -9.5), P(9.5, -9.65), P(8.5, -9.05), P(7.4, -8.95)], 1);
  p.wash(lower, '#d39e5c', { rng, opacity: 0.92, edge: 0.3, edgeWidth: 0.15 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  p.wash(upper, '#45434a', { rng, opacity: 0.92, edge: 0.3, edgeWidth: 0.15 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  // the eye: a soft dark socket, the iris, a catch-light
  p.dab(P(EYE.x - 0.1, EYE.y + 0.05), c.streak, { rng, variant: 'round', angle: 0, length: 1.6 * r, width: 1.35 * r, opacity: 0.3, edge: 0.05, sharpness: 0.15 });
  p.dab(P(EYE.x, EYE.y), '#1d1714', { rng, variant: 'round', angle: 0, length: 0.95 * r, width: 0.9 * r, opacity: 0.94, edge: 0.3 });
  p.dab(P(EYE.x + 0.2, EYE.y - 0.22), '#fbf7ef', { rng, variant: 'round', angle: 0, length: 0.26 * r, width: 0.24 * r, opacity: 0.85, blend: 'source-over' });
  if (wing === 'fold') {
    paintFoldedWing(p, r, c);
    return;
  }
  // open wings: rufous coverts bled into duskier flight feathers, the trailing edge lost
  const shoulder = P(2.2, -8.8);
  const wingAt = (a: number, len: number, wide: number, op: number, side: number) => {
    p.ctx.save();
    p.ctx.translate(shoulder.x, shoulder.y);
    const shape = wingShape(r, a, len, wide, side);
    const trail = a + (side * Math.PI) / 2;
    p.wetInWet(shape, c.wing, c.wingDark, { rng, angle: a, split: 0.55, softness: 0.5, opacity: op, edge: 0.24, edgeWidth: 0.3 * r, sharpness: 0.4, granulation: 0.3, flow: 0.5, flowScale: 2 * r, deform: 0.05, spread: 0.06, blend: 'source-over', fade: { angle: trail, start: 0.7, amount: 0.45 } });
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const at = (u: number, v: number) => ({ x: u * len * r * ca - v * wide * r * side * sa, y: u * len * r * sa + v * wide * r * side * ca });
    for (const v of [-0.15, 0.15, 0.42]) p.inkLine([at(0.45, v * 0.5), at(0.96, v)], { rng, width: 0.14 * r, opacity: 0.3 * op, breaks: 0.4, pigment: c.edge, taper: [0.4, 0.5] });
    p.ctx.restore();
  };
  if (wing === 'up') wingAt(-Math.PI / 2 - 0.4, 10, 3.0, 0.92, -1);
  else if (wing === 'down') wingAt(Math.PI / 2 + 0.55, 9.2, 2.8, 0.9, 1);
  else {
    // mid-beat: the far wing a pale blur above, the near one swept back and foreshortened
    wingAt(-Math.PI / 2 - 0.2, 8.0, 2.8, 0.3, -1);
    wingAt(Math.PI - 0.2, 8.6, 2.3, 0.88, -1);
  }
}

/** The folded wing along the flank: plain rufous, darker feather centres, warm (never white) edges. */
function paintFoldedWing(p: Painter, r: number, c: Colours): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const wing = smoothPolygon([P(3.0, -8.8), P(0.8, -9.3), P(-2.0, -8.7), P(-4.8, -7.5), P(-7.2, -6.1), P(-8.5, -5.4), P(-7.0, -5.1), P(-4.4, -5.3), P(-1.4, -5.8), P(1.4, -6.4), P(3.1, -7.3)], 2);
  p.wetInWet(wing, c.wing, c.wingDark, { rng, angle: Math.PI + 0.25, split: 0.62, softness: 0.55, fingers: 0.5, opacity: 0.82, edge: 0.18, edgeWidth: 0.3 * r, sharpness: 0.42, granulation: 0.35, flow: 0.45, flowScale: 2 * r, deform: 0.05, spread: 0.05, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.75, amount: 0.3 } });
  // tertial and greater-covert centres, softly darker; no bars
  for (const [x, y, rx, ry, rot] of [
    [-1.8, -7.7, 1.6, 0.65, 0.35],
    [-4.0, -6.8, 1.5, 0.55, 0.4],
    [0.8, -7.9, 1.3, 0.55, 0.2],
  ] as const) {
    p.wash(blob(x * r, y * r, rx * r, ry * r, rng, { rotation: rot, irregularity: 0.3 }), c.wingDark, { rng, opacity: 0.32, edge: 0.2, edgeWidth: 0.2 * r, sharpness: 0.3, deform: 0.06, spread: 0.06 });
  }
  // warm feather edges, broken, and the primaries' dusky tips past the rump
  for (let k = 0; k < 3; k++) {
    const y = -8.0 + k * 0.85;
    p.inkLine([P(1.4 - k * 0.7, y - 0.5), P(-1.9 - k * 0.8, y + 0.4), P(-4.5 - k * 0.6, y + 1.2)], { rng, width: 0.17 * r, opacity: 0.38, breaks: 0.45, pigment: c.edge, taper: [0.3, 0.6] });
  }
  p.dab(P(-7.2, -5.6), c.wingDark, { rng, variant: 'leaf', angle: Math.PI - 0.3, length: 2.6 * r, width: 0.9 * r, opacity: 0.5 });
}

function paintTail(p: Painter, r: number, c: Colours, spread = 1): void {
  // long, a little notched, rufous-edged; lost into the rump at its root
  const w = spread;
  const tail = smoothPolygon(
    [{ x: 1.0 * r, y: -0.7 * r * w }, { x: -3.0 * r, y: -0.85 * r * w }, { x: -6.3 * r, y: -1.2 * r * w }, { x: -6.9 * r, y: -0.75 * r * w }, { x: -6.5 * r, y: 0.0 }, { x: -6.9 * r, y: 0.8 * r * w }, { x: -6.2 * r, y: 1.15 * r * w }, { x: -3.0 * r, y: 0.75 * r * w }, { x: 1.0 * r, y: 0.7 * r * w }],
    2,
  );
  p.wetInWet(tail, c.wing, c.tail, { rng: p.rng, angle: Math.PI, split: 0.3, softness: 0.5, opacity: 0.9, edge: 0.24, edgeWidth: 0.35 * r, sharpness: 0.4, granulation: 0.4, flow: 0.5, flowScale: 2 * r, deform: 0.05, blend: 'source-over', fade: { angle: 0, start: 0.75, amount: 0.55 } });
  p.inkLine([{ x: 0.2 * r, y: -0.8 * r * w }, { x: -6.3 * r, y: -1.05 * r * w }], { rng: p.rng, width: 0.2 * r, opacity: 0.3, breaks: 0.4, pigment: c.wing });
  p.inkLine([{ x: 0.6 * r, y: 0.1 * r }, { x: -6.0 * r, y: 0.1 * r }], { rng: p.rng, width: 0.13 * r, opacity: 0.18, breaks: 0.5, pigment: c.edge });
}

export function paintBunting(res: number, seed: number, sex: BuntingSex): BuntingParts {
  const S = BUNTING_SIZE;
  const r = R;
  const c = colours(sex);
  const body = paintSprite(res, { w: 21 * r, h: 15 * r, ox: 9.5 * r, oy: 14 * r }, seed, (p) => paintBody(p, r, c, sex, 'fold'));
  const legs = paintSprite(res, { w: 9 * r, h: 6 * r, ox: 4.4 * r, oy: 5 * r }, seed + 1, (p, rng) => {
    // slender pinkish legs from the belly feathers, the far one greyer; three toes forward, one back
    for (const [hx, fx, far] of [
      [-0.8, -0.6, true],
      [0.7, 1.1, false],
    ] as const) {
      const pig = far ? mix(c.legs, PIGMENTS.shadow, 0.3) : c.legs;
      const knee = { x: (hx + 0.4) * r, y: -LEG * 0.55 * r };
      p.stroke([{ x: hx * r, y: -(LEG + 1.0) * r }, knee, { x: fx * r, y: -0.1 * r }], { rng, pigment: pig, width: 0.5 * r, opacity: far ? 0.72 : 0.9, wetness: 0.5, wobble: 0.06, taper: [0.0, 0.25] });
      const f = { x: fx * r, y: 0 };
      for (const [tx, ty] of [
        [1.9, 0.1],
        [1.4, 0.35],
        [-1.2, 0.05],
      ] as const) {
        p.stroke([f, { x: f.x + tx * r, y: f.y + ty * r }], { rng, pigment: pig, width: 0.2 * r, opacity: far ? 0.62 : 0.8, wetness: 0.4, wobble: 0.12, taper: [0.1, 0.6] });
      }
    }
  });
  const tail = paintSprite(res, { w: 9.5 * r, h: 4 * r, ox: 7.8 * r, oy: 2 * r }, seed + 2, (p) => paintTail(p, r, c));
  const flyBox = { w: 28 * r, h: 27 * r, ox: 14 * r, oy: 15 * r };
  const fly = (wing: Wing, k: number) =>
    paintSprite(res, flyBox, seed + 3 + k, (p) => {
      p.ctx.save();
      // level in flight, the head forward, the body centre at the origin
      p.ctx.rotate(0.3);
      p.ctx.translate(-0.6 * r, 6.2 * r);
      p.stroke([{ x: 0.2 * r, y: -3.1 * r }, { x: -1.2 * r, y: -2.4 * r }, { x: -2.3 * r, y: -2.3 * r }], { rng: p.rng, pigment: c.legs, width: 0.42 * r, opacity: 0.55, wetness: 0.5, taper: [0.1, 0.5] });
      p.ctx.save();
      p.ctx.translate(-5.4 * r, -5.7 * r);
      p.ctx.rotate(-0.1);
      paintTail(p, r, c, wing === 'fold' ? 1 : 1.25);
      p.ctx.restore();
      paintBody(p, r, c, sex, wing);
      p.ctx.restore();
    });
  return { body, legs, tail, flyUp: fly('up', 0), flyMid: fly('mid', 1), flyDown: fly('down', 2), glide: fly('fold', 3), size: S };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** Its perches: the wall copings, the basin rim and the stones. */
export function buntingPerches(w: Pick<FaunaWorld, 'perches'>): Perch[] {
  return w.perches.filter((p) => p.kind === 'wall' || p.kind === 'rim' || p.kind === 'rock');
}

/** Does any of `held` (other creatures' spots) stand on this perch? */
export function isHeld(p: Perch, held: readonly Pt[]): boolean {
  return held.some((h) => Math.abs(h.x - p.x) <= p.spread + BUNTING_TUNING.hold && Math.abs(h.y - p.y) < 18);
}

const inView = (p: Pt, v: Rect, m: number) => p.x > v.x + m && p.x < v.x + v.w - m && p.y > v.y + m && p.y < v.y + v.h - m;

/** The next perch: free ones in view, near ones likelier, never `not`. Null when every one is held. */
export function choosePerch(w: Pick<FaunaWorld, 'perches' | 'view'>, rng: Rng, from: Pt | null, not: Perch | null, held: readonly Pt[]): Perch | null {
  const free = buntingPerches(w).filter((p) => p !== not && !isHeld(p, held));
  const seen = free.filter((p) => inView(p, w.view, 16));
  const pool = seen.length > 0 ? seen : free;
  if (pool.length === 0) return null;
  const weights = pool.map((p) => (from ? 1 / (1 + (dist(p, from) / BUNTING_TUNING.reach) ** 2) : 1) * (p.kind === 'rock' ? 0.6 : 1));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i]!;
    if (x < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** Where its feet rest: a stone's painted top sits a little below the perch line. */
export function standY(p: Perch, x: number): number {
  return perchY(p, x) + (p.kind === 'rock' ? p.dome * 0.35 : 0);
}

/** A quick dip and a slower rise (0..1 over one peck or sip). */
export function bobCurve(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  return k < 0.3 ? Math.sin((k / 0.3) * Math.PI * 0.5) : Math.cos(((k - 0.3) / 0.7) * Math.PI * 0.5) ** 2;
}

export const SIP_DOWN = 0.78;
export const SIP_UP = -0.38;

/** The drink: lean down, hold, then lift the bill up to swallow (pitch, + = bill down). */
export function sipPitch(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  if (k < 0.3) return SIP_DOWN * easeInOut(k / 0.3);
  if (k < 0.5) return SIP_DOWN;
  if (k < 0.72) return lerp(SIP_DOWN, SIP_UP, easeInOut((k - 0.5) / 0.22));
  return lerp(SIP_UP, 0, easeInOut((k - 0.72) / 0.28));
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
  then: 'perch' | 'gone';
}

type Act = { kind: 'hop'; from: number; to: number } | { kind: 'peck'; n: number } | { kind: 'drink'; n: number } | { kind: 'look' } | { kind: 'turn' };

export class Bunting extends BaseCreature {
  readonly kind = 'bunting' as const;
  readonly visitor = false;
  readonly sex: BuntingSex;
  perch: Perch | null = null;
  /** for tests: dips flown between perches, sips and pecks taken */
  flights = 0;
  sips = 0;
  pecks = 0;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private leg: Leg | null = null;
  private perchFor = 0;
  private act: Act = { kind: 'look' };
  private actT = 0;
  private actFor = 1;
  private pitch = 0;
  private tailFlick = 0;
  private flickT = -1;
  private flap = 0;
  private heading = 0;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    sex: BuntingSex,
    held: readonly Pt[],
  ) {
    super();
    this.sex = sex;
    this.variant = sex;
    const p = choosePerch(w, rng, null, null, held);
    if (!p) {
      this.done = true;
      return;
    }
    if (w.t < 2) {
      // there from the start: already on its wall
      this.settle(p, w, p.x + rng.range(-0.6, 0.6) * p.spread);
      this.facing = rng.chance(0.5) ? 1 : -1;
    } else {
      const v = w.view;
      const side = rng.chance(0.5) ? -1 : 1;
      this.pos = { x: side < 0 ? v.x - 30 : v.x + v.w + 30, y: clamp(p.y - rng.range(40, 120), v.y + 20, v.y + v.h) };
      this.scale = w.perspective(p.depth, p.x);
      this.flyTo(p, w);
      this.state = 'enter';
    }
    this.sync();
  }

  /** Where it stands or is making for (other creatures keep off it). */
  spot(): Pt | null {
    if (this.leg) return this.leg.then === 'perch' && this.perch ? { x: this.perch.x, y: this.perch.y } : null;
    return this.perch && this.state === 'perch' ? { x: this.perch.x, y: this.perch.y } : null;
  }

  private settle(p: Perch, w: FaunaWorld, x: number): void {
    this.perch = p;
    const cx = clamp(x, p.x - p.spread, p.x + p.spread);
    this.pos = { x: cx, y: standY(p, cx) };
    this.layer = 'entities';
    this.scale = p.scale ?? w.perspective(p.depth, p.x);
    this.perchFor = rangeOf(this.rng, [...BUNTING_TUNING.perch]) / w.speed;
    this.go('perch');
    this.nextAct(w);
  }

  /** A short dip to `target` (a perch), or away off the view. */
  private flyTo(target: Perch | Pt, w: FaunaWorld): void {
    const rng = this.rng;
    const isPerch = 'kind' in target;
    let to: Pt;
    let s1: number;
    if (isPerch) {
      const x = target.x + rng.range(-0.5, 0.5) * target.spread;
      to = { x, y: standY(target, x) };
      s1 = target.scale ?? w.perspective(target.depth, target.x);
      this.perch = target;
    } else {
      to = { ...target };
      s1 = this.scale;
      this.perch = null;
    }
    const from = { ...this.pos };
    const dx = to.x - from.x;
    const len = dist(from, to);
    // it drops off the coping, dips low across the gap and swings up onto the next one
    const sag = isPerch ? clamp(len * 0.18, 8, 40) : -clamp(len * 0.1, 10, 40);
    const p1 = { x: from.x + dx * 0.3, y: from.y + (to.y - from.y) * 0.2 + sag };
    const p2 = { x: to.x - dx * 0.28, y: to.y + (isPerch ? sag * 0.75 : 0) };
    this.leg = { p0: from, p1, p2, p3: to, len: Math.max(1, cubicLength(from, p1, p2, to)), u: 0, s0: this.scale, s1, then: isPerch ? 'perch' : 'gone' };
    if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
    this.layer = 'air';
    this.pitch = 0;
    this.go(isPerch ? 'fly' : 'leave');
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    if (this.leg) this.flyStep(dt, w);
    else if (this.state === 'perch') this.perchStep(dt, w);
    this.sync();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const f = this.leg!;
    const sf = w.speed;
    // eases off the perch and slows into the landing
    const k = f.then === 'perch' ? 0.45 + 0.55 * Math.min(1, f.u * 5, (1 - f.u) * 3.5) : 0.6 + f.u;
    f.u = Math.min(1, f.u + (BUNTING_TUNING.flight * sf * k * dt * (f.s0 + f.s1) * 0.5) / f.len);
    const q = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
    const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
    this.flap += dt * sf;
    // bounding: a burst of beats lifts it a little, the shut-winged glide lets it sink
    const bound = Math.sin(f.u * Math.PI);
    this.pos = { x: q.x, y: q.y - Math.sin(this.flap * TAU_BOUND) * 2.2 * this.scale * bound };
    this.scale = lerp(f.s0, f.s1, easeInOut(f.u));
    if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
    this.heading = clamp(Math.atan2(tg.y, Math.abs(tg.x)) * 0.6, -0.45, 0.45);
    if (f.u < 1) return;
    this.leg = null;
    if (f.then === 'perch' && this.perch) {
      this.flights++;
      this.settle(this.perch, w, f.p3.x);
    } else this.done = true;
  }

  /** Wings shut for a glide between bursts (not on take-off or landing). */
  gliding(): boolean {
    const f = this.leg;
    if (!f || f.u < 0.18 || (f.then === 'perch' && f.u > 0.8)) return false;
    return (this.flap * BOUND_HZ) % 1 > 0.62;
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const p = this.perch!;
    this.actT += dt;
    const k = clamp(this.actT / this.actFor, 0, 1);
    this.pitch = 0;
    const a = this.act;
    if (a.kind === 'hop') {
      const x = lerp(a.from, a.to, easeInOut(k));
      this.pos = { x, y: standY(p, x) - Math.sin(k * Math.PI) * 3 * this.scale };
    } else if (a.kind === 'peck') {
      const per = this.actFor / a.n;
      this.pitch = 0.62 * bobCurve((this.actT % per) / per);
    } else if (a.kind === 'drink') {
      const per = this.actFor / a.n;
      this.pitch = sipPitch((this.actT % per) / per);
    }
    // a flick of the tail now and then
    if (this.flickT >= 0) {
      this.flickT += dt * sf;
      this.tailFlick = 0.4 * bobCurve(this.flickT / 0.35);
      if (this.flickT > 0.35) this.flickT = -1;
    } else if (this.rng.chance(dt * sf * 0.12)) this.flickT = 0;
    if (k < 1) return;
    if (a.kind === 'peck') this.pecks += a.n;
    if (a.kind === 'drink') this.sips += a.n;
    if (this.leaving) {
      const to = exitPoint(w.view, this.pos, this.rng, 120);
      this.flyTo(to, w);
      return;
    }
    if (this.timer > this.perchFor) {
      const next = choosePerch(w, this.rng, this.pos, p, heldSpots(w));
      if (next) {
        this.flyTo(next, w);
        return;
      }
      this.perchFor = this.timer + rangeOf(this.rng, [...BUNTING_TUNING.perch]) / sf;
    }
    this.nextAct(w);
  }

  private nextAct(w: FaunaWorld): void {
    const rng = this.rng;
    const p = this.perch!;
    const r = rng.next();
    const rim = p.kind === 'rim' && p.spread > 10;
    let act: Act;
    let dur: number;
    if (rim && r < BUNTING_TUNING.drink) {
      const n = rng.int(1, 3);
      act = { kind: 'drink', n };
      dur = n * 1.4;
    } else if (r < 0.5 && p.spread > 4) {
      let to = this.pos.x + rng.range(3, 8) * (rng.chance(0.65) ? this.facing : -this.facing);
      to = clamp(to, p.x - p.spread, p.x + p.spread);
      if (Math.abs(to - this.pos.x) > 0.5) this.facing = Math.sign(to - this.pos.x);
      act = { kind: 'hop', from: this.pos.x, to };
      dur = 0.24;
    } else if (r < 0.78) {
      const n = rng.int(1, 4);
      act = { kind: 'peck', n };
      dur = n * 0.34;
    } else if (r < 0.86) {
      this.facing = -this.facing;
      act = { kind: 'turn' };
      dur = rng.range(0.5, 1.2);
    } else {
      act = { kind: 'look' };
      dur = rng.range(0.8, 2.4);
      if (rng.chance(0.35)) this.facing = -this.facing;
    }
    this.act = act;
    this.actFor = dur / w.speed;
    this.actT = 0;
  }

  /** What it is doing on its perch (tests, studio). */
  doing(): Act['kind'] | null {
    return this.state === 'perch' ? this.act.kind : null;
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    return this.state === 'perch' && this.perch ? this.perch.depth : null;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const air = this.leg !== null;
    if (air ? layer !== 'air' : layer !== 'entities') return;
    const parts = w.art.get(`bunting:${this.sex}`, (res) => paintBunting(res, this.sex === 'male' ? 2810 : 2830, this.sex));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * this.facing, this.scale);
    if (air) drawFlying(ctx, parts, this.flap, this.heading, this.gliding());
    else drawPerched(ctx, parts, this.pitch, this.tailFlick);
    ctx.restore();
  }
}

const BOUND_HZ = 1.9;
const TAU_BOUND = Math.PI * 2 * BOUND_HZ;
/** wingbeats a second in a burst */
const BEAT_HZ = 9;

/** A bunting standing at the origin (its feet), facing +x, in world units at perspective 1. */
export function drawPerched(ctx: Ctx, parts: BuntingParts, pitch: number, tailFlick = 0): void {
  const r = parts.size / 20;
  const legs = parts.legs;
  ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
  ctx.save();
  ctx.translate(0, -PIVOT * r);
  ctx.rotate(pitch);
  ctx.translate(0, DROP * r);
  const tail = parts.tail;
  ctx.save();
  ctx.translate(-5.3 * r, -5.6 * r);
  // the tail lifts a little as the body leans, and flicks up now and then
  ctx.rotate(-0.42 - pitch * 0.3 + tailFlick);
  ctx.drawImage(tail.img as CanvasImageSource, -tail.ox, -tail.oy, tail.w, tail.h);
  ctx.restore();
  const b = parts.body;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  ctx.restore();
}

/** A bunting in flight at the origin (its feet's place), facing +x: up, mid, down, mid in bursts, shut between. */
export function drawFlying(ctx: Ctx, parts: BuntingParts, flap: number, heading: number, gliding: boolean): void {
  ctx.translate(0, -LIFT);
  ctx.rotate(heading);
  let s = parts.glide;
  let lift = 0;
  if (!gliding) {
    const ph = Math.floor(flap * BEAT_HZ * 4) % 4;
    s = ph === 0 ? parts.flyUp : ph === 2 ? parts.flyDown : parts.flyMid;
    lift = ph === 2 ? -0.3 : ph === 0 ? 0.25 : 0;
  }
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy + lift, s.w, s.h);
}

const bunting: CreatureDef = {
  kind: 'bunting',
  title: 'house bunting',
  role: 'resident',
  rank: 4,
  variants: BUNTING_SEXES,
  // a pair by day; they go to roost in the walls at dusk
  resident: (n, mode) => (n > 0 && !mode.night ? 2 : 0),
  needs: (w) => buntingPerches(w).length > 0,
  spawn(w, s) {
    const rng = w.rng.fork(`bunting:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const held = heldSpots(w);
    const out: Bunting[] = [];
    for (let i = 0; i < s.count; i++) {
      // the pair: a cock and a duller hen
      const live = w.creatures.filter((c) => c instanceof Bunting && !c.done && !c.leaving) as Bunting[];
      const sex: BuntingSex = [...live, ...out].some((b) => b.sex === 'male') ? 'female' : 'male';
      const b = new Bunting(w, rng.fork(`bird:${i}`), sex, held);
      if (b.done) break;
      const spot = b.spot();
      if (spot) held.push(spot);
      out.push(b);
    }
    return out;
  },
  sheet: {
    w: 760,
    h: 170,
    make(res, seed) {
      const m = paintBunting(res, seed, 'male');
      const f = paintBunting(res, seed + 20, 'female');
      return [m.body, m.tail, m.legs, m.flyUp, m.flyMid, m.flyDown, m.glide, f.body];
    },
  },
  show: { stage: 'oasis', spec: { x: 330, y: 450, w: 480, h: 270 }, w: 640, h: 360, group: 2, order: 40 },
};
export default bunting;
