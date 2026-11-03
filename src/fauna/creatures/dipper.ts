/**
 * Brown dipper (kawagarasu, Cinclus pallasii): the waterfall's resident. A plump, short-tailed,
 * chocolate-brown bird that bobs and blinks a white eyelid on wet rocks, flies low and straight
 * along the water, and walks into the pool or stream, vanishes under and comes up further on.
 * Side view, painted facing right. docs/systems/fauna.md › Creatures and behaviour.
 */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { clamp, dist, easeInOut, insideWithMargin, isOffscreen, lerp, polygonCentroid, rangeOf, TAU } from '../math';
import { deepCopy, paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';
import { entryPoint } from './lib/flight';

/** Bill to tail tip at perspective 1 (world units): a little longer than the wagtail, twice its bulk. */
export const DIPPER_SIZE = 23;
const LEG = 3.0; // hip height above the feet, in body units (r)

export const DIPPER_TUNING = {
  /** seconds on a perch before the next big move (dive, flight, away) */
  perch: [10, 30] as const,
  /** seconds under water */
  under: [5, 12] as const,
  /** seconds away down the stream */
  away: [25, 70] as const,
  /** world units / s, low and fast */
  flight: 240,
  /** chance of each big move when a perch spell ends (the rest: fly to another perch) */
  dive: 0.5,
  goAway: 0.12,
};

export interface DipperParts {
  body: Sprite; // standing body and head, anchored at the hip
  legs: Sprite; // anchored at the feet
  legsDeep: Sprite; // the legs seen through the water while it wades
  tail: Sprite; // anchored at its root, pointing back and up
  lid: Sprite; // the white eyelid, anchored at the eye
  flyUp: Sprite; // flight frames, anchored at the body centre
  flyMid: Sprite;
  flyDown: Sprite;
  haze: Sprite; // the whirr, under every flight frame
  swim: Sprite; // wings half open, level: under water as a deep copy
  deep: Sprite; // the body seen through the water
  wake: Sprite; // rings at the waterline
  size: number;
}

interface Colours {
  sheen: Pigment;
  brown: Pigment;
  dark: Pigment;
  light: Pigment;
  legs: Pigment;
}

function colours(): Colours {
  // research palette: chocolate #5a4536, the back's wet sheen #6b5646
  return {
    brown: '#5a4536',
    sheen: '#7a6350',
    dark: '#33271f',
    light: '#a08670',
    legs: '#aaa0a3',
  };
}

const EYE = { x: 5.9, y: -10.3 };
const P0 = (r: number, x: number, y: number): Pt => ({ x: x * r, y: y * r });
type Wing = 'fold' | 'up' | 'mid' | 'down' | 'swim';

/** A short, round dipper wing from the shoulder (0, 0) along +x, turned by `a`; `side` puts the trailing edge on ±v. */
function wingShape(r: number, a: number, len: number, wide: number, side: number): Pt[] {
  const pts = [
    [0, -0.7],
    [0.4, -0.95],
    [0.75, -0.8],
    [1.0, -0.35],
    [1.05, 0.05],
    [0.92, 0.3],
    [0.8, 0.2],
    [0.7, 0.45],
    [0.55, 0.38],
    [0.42, 0.6],
    [0.2, 0.55],
    [0, 0.7],
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
function paintBody(p: Painter, r: number, c: Colours, wing: Wing): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  // round as a wren: a big head with a steep brow, a full breast, the back sloping to a cocked rump
  const sil = smoothPolygon(
    [P(8.3, -10.2), P(8.0, -11.7), P(6.7, -13.0), P(4.8, -13.5), P(2.9, -13.1), P(1.5, -12.2), P(0.4, -11.4), P(-1.9, -11.0), P(-4.5, -10.0), P(-6.4, -8.6), P(-6.7, -7.2), P(-5.5, -5.0), P(-3.1, -2.4), P(0.4, -0.9), P(3.8, -1.3), P(6.4, -3.1), P(7.7, -5.7), P(7.5, -8.0), P(8.0, -9.3)],
    2,
  );
  // wet-in-wet: the lit crown and back into chocolate below, darker drops bleeding in the belly
  p.wetInWet(sil, c.sheen, c.brown, {
    rng,
    angle: Math.PI / 2 + 0.3,
    split: 0.42,
    softness: 0.55,
    fingers: 0.6,
    opacity: 0.96,
    edge: 0.28,
    edgeWidth: 0.5 * r,
    sharpness: 0.4,
    centreLift: 0.06,
    granulation: 0.25,
    flow: 0.45,
    flowScale: 3 * r,
    deform: 0.07,
    spread: 0.08,
    blend: 'source-over',
    fade: { angle: -Math.PI / 2 - 0.6, start: 0.7, amount: 0.4, ragged: 0.8 },
    drops: [
      { pigment: c.dark, at: P(0.5, -2.6), size: 4.5 * r, alpha: 0.5 },
      { pigment: c.dark, at: P(-4.2, -5.2), size: 2.6 * r, alpha: 0.45 },
      { pigment: c.light, at: P(3.8, -11.9), size: 2.4 * r, alpha: 0.35 },
    ],
  });
  // feather tracts in one wet layer, so they bleed and dry together
  const M = p.layer({ x: -8 * r, y: -15 * r, w: 18 * r, h: 15 * r });
  M.clip(sil);
  if (wing === 'fold') {
    // the folded wing: ragged dark masses, coverts to primaries, no outline of its own
    M.fill(blob(-0.8 * r, -8.0 * r, 4.4 * r, 1.9 * r, rng, { rotation: 0.3, irregularity: 0.3 }), c.dark, 0.26);
    M.fill(blob(-3.6 * r, -7.2 * r, 2.6 * r, 1.3 * r, rng, { rotation: 0.45, irregularity: 0.35 }), c.dark, 0.34);
    M.fill(blob(1.6 * r, -8.9 * r, 2.0 * r, 1.0 * r, rng, { rotation: 0.15, irregularity: 0.3 }), c.dark, 0.22);
  }
  // scalloped flank and breast feathering, and the shade under the belly
  for (let i = 0; i < 9; i++) {
    const q = P(rng.range(-3.5, 6.0), rng.range(-6.0, -2.0));
    M.fill(blob(q.x, q.y, rng.range(0.7, 1.3) * r, rng.range(0.3, 0.55) * r, rng, { rotation: rng.range(-0.4, 0.2), irregularity: 0.35, points: 12 }), c.dark, rng.range(0.14, 0.26));
  }
  M.fill(blob(0.8 * r, -1.0 * r, 6.0 * r, 1.6 * r, rng, { rotation: -0.08, irregularity: 0.25 }), c.dark, 0.3);
  M.fill(blob(7.2 * r, -8.6 * r, 1.4 * r, 2.6 * r, rng, { irregularity: 0.25 }), c.dark, 0.14);
  M.dry({ opacity: 0.85, edge: 0.15, edgeWidth: 0.35 * r, sharpness: 0.3, centreLift: 0, granulation: 0.35, granules: 0.12, flow: 0.4, flowScale: 2.5 * r });
  // a chocolate glaze deepens all but the lit top; fine granules settle in it
  p.glaze(sil, c.brown, { rng, opacity: 0.5, edge: 0.12, edgeWidth: 0.3 * r, sharpness: 0.35, granulation: 0.3, deform: 0.05, spread: 0.08, fade: { angle: -Math.PI / 2 - 0.3, start: 0.45, amount: 0.95, ragged: 0.7 } });
  p.granulate(sil, c.dark, { rng, strength: 0.2 });
  // where the light hits: a soft paler wash over the crown and mantle, lost downward
  const Lt = p.layer({ x: -8 * r, y: -15 * r, w: 18 * r, h: 9 * r });
  Lt.clip(sil);
  Lt.fill(blob(1.6 * r, -12.4 * r, 6.2 * r, 1.9 * r, rng, { rotation: 0.18, irregularity: 0.3 }), c.light, 0.55);
  Lt.fill(blob(5.0 * r, -12.6 * r, 2.4 * r, 1.0 * r, rng, { irregularity: 0.25 }), c.light, 0.35);
  Lt.dry({ opacity: 0.4, edge: 0, sharpness: 0.12, centreLift: 0, granulation: 0.25, flow: 0.5, flowScale: 2 * r, blend: 'source-over' });
  // and a dry, broken lift of warm sheen along it
  p.dryBrush([P(-3.8, -9.6), P(-0.6, -11.3), P(2.6, -12.4), P(5.4, -12.4)], { rng, pigment: c.light, width: 0.9 * r, opacity: 0.35, dryness: 0.6 });
  // a slender dark bill, the eye set in the head with a soft dark socket
  const bill = smoothPolygon([P(8.0, -10.6), P(9.4, -10.25), P(10.5, -9.95), P(9.4, -9.75), P(8.0, -9.4)], 1);
  p.wash(bill, '#2a221d', { rng, opacity: 0.9, edge: 0.3, edgeWidth: 0.2 * r, sharpness: 0.5, deform: 0.03, spread: 0.03 });
  p.dab(P(EYE.x - 0.1, EYE.y + 0.1), c.dark, { rng, variant: 'round', angle: 0, length: 1.9 * r, width: 1.6 * r, opacity: 0.35, edge: 0.05, sharpness: 0.15 });
  p.dab(P(EYE.x, EYE.y), '#1d1714', { rng, variant: 'round', angle: 0, length: 0.95 * r, width: 0.9 * r, opacity: 0.92, edge: 0.3 });
  p.dab(P(EYE.x + 0.2, EYE.y - 0.22), '#fbf7ef', { rng, variant: 'round', angle: 0, length: 0.26 * r, width: 0.24 * r, opacity: 0.85, blend: 'source-over' });
  if (wing === 'fold') {
    // two broken tertial edges, the only lines on the bird
    for (let k = 0; k < 2; k++) {
      const y = -7.4 + k * 0.9;
      p.inkLine([P(0.4 - k * 0.6, y), P(-2.6 - k * 0.8, y + 0.9), P(-4.6 - k * 0.6, y + 1.3)], { rng, width: 0.2 * r, opacity: 0.3, breaks: 0.45, pigment: c.light, taper: [0.3, 0.6] });
    }
    return;
  }
  // open wings: short and round, dark coverts bled into paler flight feathers, a lost trailing edge
  const shoulder = P(1.8, -9.2);
  const wingAt = (a: number, len: number, wide: number, op: number, side: number) => {
    p.ctx.save();
    p.ctx.translate(shoulder.x, shoulder.y);
    const shape = wingShape(r, a, len, wide, side);
    // the leading edge stays found; the notched trailing edge (toward +v·side) is lost
    const trail = a + (side * Math.PI) / 2;
    p.wetInWet(shape, c.dark, c.brown, { rng, angle: trail, split: 0.4, softness: 0.55, opacity: op, edge: 0.22, edgeWidth: 0.35 * r, sharpness: 0.4, granulation: 0.35, flow: 0.5, flowScale: 2 * r, deform: 0.05, spread: 0.06, blend: 'source-over', fade: { angle: trail, start: 0.65, amount: 0.55 } });
    // primary shafts fanning to the tip
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const v of [-0.1, 0.25, 0.55]) {
      const at = (u: number, w: number) => ({ x: u * len * r * ca - w * wide * r * side * sa, y: u * len * r * sa + w * wide * r * side * ca });
      p.inkLine([at(0.45, v * 0.6), at(0.97, v)], { rng, width: 0.16 * r, opacity: 0.28 * op, breaks: 0.4, pigment: c.light, taper: [0.4, 0.5] });
    }
    p.ctx.restore();
  };
  if (wing === 'up') wingAt(-Math.PI / 2 - 0.45, 8.8, 3.3, 0.92, -1);
  else if (wing === 'down') wingAt(Math.PI / 2 + 0.5, 8.0, 3.1, 0.9, 1);
  else if (wing === 'swim') wingAt(Math.PI - 0.35, 8.4, 3.0, 0.85, -1);
  else {
    // mid-beat: the far wing a pale blur behind, the near one level and foreshortened
    wingAt(-Math.PI / 2 - 0.25, 7.0, 3.0, 0.28, -1);
    wingAt(Math.PI - 0.15, 7.0, 2.2, 0.85, -1);
  }
}

function paintTail(p: Painter, r: number, c: Colours): void {
  // a short square stub, broad where it leaves the rump, lost into it at the root
  const tail = smoothPolygon([{ x: 1.4 * r, y: -1.6 * r }, { x: -3.0 * r, y: -1.5 * r }, { x: -4.6 * r, y: -1.0 * r }, { x: -4.9 * r, y: 0.1 * r }, { x: -4.4 * r, y: 1.1 * r }, { x: -2.8 * r, y: 1.2 * r }, { x: 1.4 * r, y: 1.7 * r }], 1);
  p.wetInWet(tail, c.brown, c.dark, { rng: p.rng, angle: Math.PI, split: 0.3, softness: 0.5, opacity: 0.95, edge: 0.3, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.45, flow: 0.5, flowScale: 2 * r, deform: 0.05, blend: 'source-over', fade: { angle: 0, start: 0.8, amount: 0.5 } });
  p.inkLine([{ x: 0.6 * r, y: 0.1 * r }, { x: -4.2 * r, y: 0.1 * r }], { rng: p.rng, width: 0.16 * r, opacity: 0.15, breaks: 0.5, pigment: c.light });
}

export function paintDipper(res: number, seed: number): DipperParts {
  const S = DIPPER_SIZE;
  const r = S / 20;
  const c = colours();
  const box = { w: S * 0.95, h: S * 0.72, ox: S * 0.38, oy: S * 0.65 };
  const body = paintSprite(res, box, seed, (p) => paintBody(p, r, c, 'fold'));
  const legs = paintSprite(res, { w: S * 0.5, h: S * 0.34, ox: S * 0.24, oy: S * 0.3 }, seed + 1, (p, rng) => {
    // stout pale legs rooted up in the belly feathers, the far one a little greyer
    for (const [hx, fx, far] of [
      [-0.9, -0.7, true],
      [0.8, 1.3, false],
    ] as const) {
      const pig = far ? mix(c.legs, PIGMENTS.shadow, 0.3) : c.legs;
      // a stout tarsus from under the belly feathers, slanting back to the foot
      const ankle = { x: (hx + 0.5) * r, y: -LEG * 0.6 * r };
      p.stroke([{ x: hx * r, y: -(LEG + 1.4) * r }, ankle, { x: fx * r, y: -0.1 * r }], { rng, pigment: pig, width: 0.85 * r, opacity: far ? 0.7 : 0.88, wetness: 0.55, wobble: 0.08, taper: [0.0, 0.25] });
      // three long toes forward, one back, gripping the stone
      const f = { x: fx * r, y: 0 };
      for (const [tx, ty] of [
        [2.4, 0.12],
        [1.8, 0.4],
        [-1.4, 0.08],
      ] as const) {
        p.stroke([f, { x: f.x + tx * r, y: f.y + ty * r }], { rng, pigment: pig, width: 0.26 * r, opacity: far ? 0.6 : 0.75, wetness: 0.4, wobble: 0.15, taper: [0.1, 0.6] });
      }
    }
  });
  const legsDeep = deepCopy(legs, res, PIGMENTS.celadonDeep, 0.35, 2);
  const tail = paintSprite(res, { w: S * 0.34, h: S * 0.2, ox: S * 0.27, oy: S * 0.1 }, seed + 2, (p) => paintTail(p, r, c));
  const lid = paintSprite(res, { w: S * 0.12, h: S * 0.1, ox: S * 0.06, oy: S * 0.05 }, seed + 3, (p, rng) =>
    p.dab({ x: -0.75 * r, y: 0 }, PIGMENTS.petalWhite, { rng, variant: 'leaf', angle: 0, length: 1.6 * r, width: 1.15 * r, opacity: 1, blend: 'source-over', layers: 6 }),
  );
  const flyBox = { w: S * 1.25, h: S * 1.15, ox: S * 0.6, oy: S * 0.65 };
  const fly = (wing: 'up' | 'mid' | 'down' | 'swim', k: number) =>
    paintSprite(res, flyBox, seed + 4 + k, (p) => {
      p.ctx.save();
      p.ctx.rotate(0.08);
      p.ctx.translate(-1 * r, 6 * r);
      if (wing !== 'swim') {
        // the feet tucked up under the belly
        p.stroke([P0(r, 0.6, -1.6), P0(r, -1.2, -0.4), P0(r, -2.4, -0.2)], { rng: p.rng, pigment: c.legs, width: 0.55 * r, opacity: 0.6, wetness: 0.5, taper: [0.1, 0.5] });
      }
      p.ctx.save();
      p.ctx.translate(-6.1 * r, -7.8 * r);
      p.ctx.rotate(wing === 'swim' ? 0.1 : -0.12);
      paintTail(p, r, c);
      p.ctx.restore();
      paintBody(p, r, c, wing);
      p.ctx.restore();
    });
  // the whirr: a pale haze over the wing's sweep, drawn under every frame so the beat never pops
  const haze = paintSprite(res, flyBox, seed + 8, (p, rng) => {
    p.ctx.save();
    p.ctx.rotate(0.08);
    p.ctx.translate(0.8 * r, -3.2 * r);
    const fan = smoothPolygon(
      Array.from({ length: 13 }, (_, i) => {
        const a = -Math.PI / 2 - 0.5 + (i / 12) * (Math.PI + 1.0);
        const d = (7.6 + Math.sin(i * 1.7) * 0.4) * r;
        return { x: Math.cos(a) * d * 0.8, y: Math.sin(a) * d };
      }).concat([{ x: 0.6 * r, y: 0.8 * r }, { x: 0.6 * r, y: -0.8 * r }]),
      2,
    );
    p.wash(fan, mix(c.brown, c.sheen, 0.5), { rng, opacity: 0.22, edge: 0, sharpness: 0.1, centreLift: 0, granulation: 0.2, deform: 0.08, spread: 0.2, fade: { angle: Math.PI, start: 0.3, amount: 0.8 } });
    p.ctx.restore();
  });
  const swim = fly('swim', 3);
  const wake = paintSprite(res, { w: S * 1.5, h: S * 0.4, ox: S * 0.75, oy: S * 0.16 }, seed + 9, (p, rng) => {
    p.ripple({ x: 0, y: 0 }, { rng, width: S * 1.3, count: 2, squash: 0.2, opacity: 0.55, light: 0.8, lineWidth: 0.7 * r, pigment: PIGMENTS.celadonDeep });
  });
  return {
    body,
    legs,
    legsDeep,
    tail,
    lid,
    flyUp: fly('up', 0),
    flyMid: fly('mid', 1),
    flyDown: fly('down', 2),
    haze,
    swim: deepCopy(swim, res, PIGMENTS.celadonDeep, 0.22, 4),
    deep: deepCopy(body, res, PIGMENTS.celadonDeep, 0.25, 3),
    wake,
    size: S,
  };
}

// ---------------------------------------------------------------------------------------------
// where it can go (pure)

/** Still water (foam carved out) and the streams: where it may wade, swim and dive. */
export function dipperWaters(w: Pick<FaunaWorld, 'pond' | 'water'>): Pt[][] {
  return [w.pond.world, ...w.water.moving].filter((p) => p.length >= 3);
}

/** Inside one of the waters, `margin` from its edge. */
export function inWater(p: Pt, waters: readonly Pt[][], margin = 4): boolean {
  return waters.some((poly) => insideWithMargin(p, poly, margin));
}

/** A point at the water's edge beside or in front of a rock perch, where it can walk in; null when none. */
export function diveEntry(perch: Perch, waters: readonly Pt[][], rng: Rng): Pt | null {
  if (perch.kind === 'ledge') return null;
  const half = perch.spread * 2.1; // the rock's half-width (perches stand on its middle ~half)
  for (let i = 0; i < 64; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    // nearest first: it walks down to the water at the rock's foot
    const k = 0.45 + (1.4 * i) / 64;
    const q = { x: perch.x + side * rng.range(k - 0.15, k + 0.15) * half, y: perch.depth + rng.range(-0.3, 1.2) * half * 0.5 };
    // beside the rock, or in front of it: never behind its painted body
    if (q.y < perch.depth - 2 && Math.abs(q.x - perch.x) < half + 4) continue;
    if (inWater(q, waters, 6)) return q;
  }
  return null;
}

/** Where it comes up after a dive from `entry`: 24–70 units on, the whole way under water. */
export function underExit(entry: Pt, waters: readonly Pt[][], rng: Rng): Pt | null {
  const body = waters.find((poly) => insideWithMargin(entry, poly, 0));
  if (!body) return null;
  for (let i = 0; i < 32; i++) {
    const a = rng.range(0, TAU);
    const d = rng.range(24, 70);
    const q = { x: entry.x + Math.cos(a) * d, y: entry.y + Math.sin(a) * d * 0.4 };
    let ok = true;
    for (let k = 1; k <= 6 && ok; k++) ok = insideWithMargin({ x: lerp(entry.x, q.x, k / 6), y: lerp(entry.y, q.y, k / 6) }, body, 6);
    if (ok) return q;
  }
  return null;
}

/** Downstream, just off the view: where it flies away to and comes back from. */
export function streamMouth(w: Pick<FaunaWorld, 'pond' | 'water' | 'view'>, rng: Rng): Pt {
  const stream = w.water.moving[0];
  if (!stream || stream.length < 3) return entryPoint(w.view, rng, 0.45, 0.7);
  const c = w.pond.centre;
  const far = stream.reduce((a, b) => (dist(b, c) > dist(a, c) ? b : a));
  const mid = polygonCentroid(stream);
  const dx = far.x - mid.x;
  const dy = far.y - mid.y;
  const d = Math.hypot(dx, dy) || 1;
  const p = { x: far.x, y: far.y };
  for (let i = 0; i < 60 && !isOffscreen(p, w.view, 40); i++) {
    p.x += (dx / d) * 20;
    p.y += (dy / d) * 20;
  }
  return clampNear(p, w.view);
}

function clampNear(p: Pt, v: Rect): Pt {
  return { x: clamp(p.x, v.x - 150, v.x + v.w + 150), y: clamp(p.y, v.y - 150, v.y + v.h + 120) };
}

/** Where its feet rest: a rock's painted top sits a little below the perch line. */
function standY(p: Perch, x: number): number {
  return perchY(p, x) + (p.kind === 'rock' ? p.dome * 0.35 : 0);
}

/** The dip: down fast, up a little slower (0..1 over one bob). */
export function dipCurve(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  return k < 0.35 ? Math.sin((k / 0.35) * Math.PI * 0.5) : Math.cos(((k - 0.35) / 0.65) * Math.PI * 0.5) ** 2;
}

/** A perch to fly to: rocks by the water much likelier than ledges, near ones likelier, never `not`. */
export function nextPerch(perches: readonly Perch[], from: Pt, rng: Rng, not: Perch | null, taken: readonly Pt[]): Perch | null {
  const free = perches.filter((p) => p !== not && taken.every((t) => dist(t, p) >= 26));
  if (free.length === 0) return not;
  const weights = free.map((p) => (p.kind === 'ledge' ? 1 : 4) / (1 + dist(p, from) / 300));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

// ---------------------------------------------------------------------------------------------

interface Leg {
  from: Pt;
  to: Pt;
  len: number;
  u: number;
  s0: number;
  s1: number;
  /** + sags toward the water, − arcs up */
  arc: number;
  then: 'perch' | 'away' | 'gone';
}

export class Dipper extends BaseCreature {
  readonly kind = 'dipper' as const;
  readonly visitor = false;
  perch: Perch | null = null;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private leg: Leg | null = null;
  private perchFor = 0;
  /** bobbing: time into the current dip (−1: still), the gap to the next, dips left in the burst */
  private dipT = -1;
  private dipGap = 1;
  private dips = 0;
  private blink = 0;
  private blinkGap = 2;
  private pitch = 0;
  private peer = 0;
  private flap = 0;
  /** 0 standing … 1 fully under the surface */
  private sink = 0;
  private water: Pt = { x: 0, y: 0 };
  private under: { from: Pt; to: Pt; for: number } | null = null;
  private walk: { from: Pt; to: Pt; for: number } | null = null;
  private wadeFor = 0;
  private swimFor = 0;
  private baseDepth = 0;
  private awayFor = 0;
  private ripple = 0;
  private scale = 1;
  private age = 0;

  constructor(w: FaunaWorld, taken: readonly Pt[]) {
    super();
    const rng = w.rng;
    this.perch = nextPerch(w.perches, w.pond.centre, rng, null, taken);
    this.blinkGap = rng.range(1, 4);
    if (!this.perch) {
      this.done = true;
      return;
    }
    if (w.t < 2) {
      // there from the start: already on its stone
      this.settle(this.perch, w, this.perch.x + rng.range(-0.5, 0.5) * this.perch.spread);
      this.facing = rng.chance(0.5) ? 1 : -1;
    } else {
      this.pos = streamMouth(w, rng);
      this.flyTo(this.perch, w);
      this.state = 'enter';
    }
    this.sync();
  }

  spot(): Pt | null {
    if (this.leg && this.leg.then === 'perch') return this.leg.to;
    return this.perch && this.state === 'perch' ? { x: this.perch.x, y: this.perch.y } : null;
  }

  private settle(p: Perch, w: FaunaWorld, x: number): void {
    this.perch = p;
    this.pos = { x, y: standY(p, x) };
    this.layer = 'entities';
    this.sink = 0;
    this.scale = w.perspective(p.depth, p.x);
    this.perchFor = rangeOf(w.rng, [...DIPPER_TUNING.perch]) / w.speed;
    this.go('perch');
  }

  private flyTo(target: Perch | Pt, w: FaunaWorld, then: Leg['then'] = 'perch'): void {
    const isPerch = 'kind' in target;
    const to = isPerch ? { x: target.x + w.rng.range(-0.4, 0.4) * target.spread, y: 0 } : { x: target.x, y: target.y };
    if (isPerch) {
      to.y = standY(target, to.x);
      this.perch = target;
    }
    const s1 = isPerch ? w.perspective(target.depth, target.x) : w.perspective(to.y, to.x);
    const len = Math.max(1, dist(this.pos, to));
    const mid = { x: (this.pos.x + to.x) / 2, y: (this.pos.y + to.y) / 2 + 8 };
    // over water it skims down toward the surface; over the cliff it arcs a little
    const arc = inWater(mid, dipperWaters(w), 0) ? Math.min(10, len * 0.05) : -Math.min(22, len * 0.1);
    this.leg = { from: { ...this.pos }, to, len, u: 0, s0: this.scale || s1, s1, arc, then };
    if (Math.abs(to.x - this.pos.x) > 1) this.facing = Math.sign(to.x - this.pos.x);
    this.layer = 'air';
    this.sink = 0;
    this.go(then === 'perch' ? 'fly' : 'depart');
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    this.age += dt;
    const sf = w.speed;
    this.blinkStep(dt, w);
    switch (this.state) {
      case 'enter':
      case 'fly':
      case 'depart':
        this.flyStep(dt, w);
        break;
      case 'perch':
        this.bobStep(dt, w);
        this.peer = Math.max(0, this.peer - dt);
        if (w.rng.chance(dt / 9)) this.facing = -this.facing;
        if (w.rng.chance(dt / 7)) this.peer = w.rng.range(0.6, 1.4);
        if (this.leaving) this.depart(w);
        else if (this.timer > this.perchFor) this.nextMove(w);
        break;
      case 'walk': {
        const m = this.walk!;
        const k = clamp(this.timer / m.for, 0, 1);
        const hops = 3;
        const h = (k * hops) % 1;
        this.pos = { x: lerp(m.from.x, m.to.x, k), y: lerp(m.from.y, m.to.y, easeInOut(k)) - Math.sin(h * Math.PI) * 1.6 };
        this.scale = lerp(this.scale, w.perspective(Math.max(this.baseDepth, m.to.y), m.to.x), Math.min(1, dt * 4));
        this.sink = 0.3 * clamp((k - 0.7) / 0.3, 0, 1);
        if (k >= 1) {
          this.pos = { ...m.to };
          this.water = { ...m.to };
          this.layer = 'entities';
          this.wadeFor = w.rng.range(1, 3) / sf;
          w.ripple(this.pos.x, this.pos.y, 14, 0.45);
          this.go('wade');
        }
        break;
      }
      case 'wade':
        this.bobStep(dt, w);
        this.surfaceRipples(dt, w, 0.9, 12);
        if (this.timer > this.wadeFor) this.go('dive');
        break;
      case 'dive': {
        // walks on in, the water rising over its back
        const k = clamp(this.timer / (1.4 / sf), 0, 1);
        this.sink = lerp(0.3, 1, easeInOut(k));
        this.pitch = 0.25 * k;
        const u = this.under!;
        const dir = Math.sign(u.to.x - this.water.x) || this.facing;
        this.facing = dir;
        this.pos = { x: this.water.x + dir * 5 * easeInOut(k), y: this.water.y + 1.5 * k };
        this.surfaceRipples(dt, w, 0.5, 10);
        if (k >= 1) {
          w.ripple(this.pos.x, this.pos.y, 20, 0.7);
          u.from = { ...this.pos };
          this.layer = 'underwater';
          this.pitch = 0;
          this.go('under');
        }
        break;
      }
      case 'under': {
        const u = this.under!;
        const k = clamp(this.timer / u.for, 0, 1);
        const wob = Math.sin(k * Math.PI * 3 + this.id) * 3 * Math.sin(k * Math.PI);
        this.pos = { x: lerp(u.from.x, u.to.x, easeInOut(k)), y: lerp(u.from.y, u.to.y, easeInOut(k)) + wob * 0.4 };
        if (Math.abs(u.to.x - u.from.x) > 1) this.facing = Math.sign(u.to.x - u.from.x);
        this.scale = w.perspective(this.pos.y, this.pos.x);
        // a bead of air now and then
        this.ripple -= dt;
        if (this.ripple <= 0) {
          this.ripple = w.rng.range(1.4, 3) / sf;
          w.ripple(this.pos.x, this.pos.y, 6, 0.3);
        }
        if (k >= 1) {
          this.pos = { ...u.to };
          this.water = { ...u.to };
          this.baseDepth = u.to.y;
          this.layer = 'entities';
          w.ripple(this.pos.x, this.pos.y, 18, 0.6);
          this.go('emerge');
        }
        break;
      }
      case 'emerge': {
        const k = clamp(this.timer / (0.7 / sf), 0, 1);
        this.sink = lerp(1, 0.5, easeInOut(k));
        if (k >= 1) {
          this.swimFor = w.rng.range(1, 2.6) / sf;
          this.go('swim');
        }
        break;
      }
      case 'swim':
        // floats a moment like a little duck, paddling on, then whirrs off
        this.sink = 0.5 + Math.sin(this.timer * 5) * 0.03;
        this.pos = { x: this.pos.x + this.facing * 4 * dt * sf, y: this.pos.y };
        if (!inWater(this.pos, dipperWaters(w), 3)) this.pos.x -= this.facing * 4 * dt * sf;
        this.surfaceRipples(dt, w, 1.1, 10);
        if (this.timer > this.swimFor) {
          if (this.leaving) this.depart(w);
          else {
            const p = nextPerch(w.perches, this.pos, w.rng, null, this.taken(w));
            if (p) this.flyTo(p, w);
            else this.depart(w);
          }
        }
        break;
      case 'away':
        if (this.leaving) this.done = true;
        else if (this.timer > this.awayFor) {
          const p = nextPerch(w.perches, this.pos, w.rng, null, this.taken(w));
          if (p) {
            this.scale = w.perspective(this.pos.y, this.pos.x);
            this.flyTo(p, w);
            this.state = 'enter';
          }
        }
        break;
    }
    this.sync();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const f = this.leg!;
    const sf = w.speed;
    // quick off the mark, slows only to land
    const k = f.then === 'perch' ? 0.45 + 0.55 * Math.min(1, (1 - f.u) * 4) : 0.6 + f.u;
    f.u = Math.min(1, f.u + (DIPPER_TUNING.flight * sf * k * dt) / f.len);
    const e = f.u;
    this.pos = { x: lerp(f.from.x, f.to.x, e), y: lerp(f.from.y, f.to.y, e) + Math.sin(e * Math.PI) * f.arc };
    this.scale = lerp(f.s0, f.s1, e);
    this.flap += dt * sf;
    if (f.u >= 1) {
      this.leg = null;
      if (f.then === 'perch' && this.perch) this.settle(this.perch, w, f.to.x);
      else if (f.then === 'away' && !this.leaving) {
        this.layer = 'air';
        this.awayFor = rangeOf(w.rng, [...DIPPER_TUNING.away]) / sf;
        this.go('away');
      } else this.done = true;
    }
  }

  private bobStep(dt: number, w: FaunaWorld): void {
    const rng = w.rng;
    if (this.dipT >= 0) {
      this.dipT += dt * w.speed;
      if (this.dipT >= 0.32) this.dipT = -1;
      return;
    }
    this.dipGap -= dt;
    if (this.dipGap > 0) return;
    this.dipT = 0;
    if (this.dips > 0) this.dips--;
    else this.dips = rng.int(1, 5);
    this.dipGap = (this.dips > 0 ? rng.range(0.42, 0.7) : rng.range(1.2, 3.5)) / w.speed;
    if (rng.chance(0.4)) this.blink = 0.11;
  }

  private blinkStep(dt: number, w: FaunaWorld): void {
    this.blink = Math.max(0, this.blink - dt);
    this.blinkGap -= dt;
    if (this.blinkGap <= 0) {
      this.blink = 0.11;
      this.blinkGap = w.rng.range(1.5, 5);
      // now and then a double flash
      if (w.rng.chance(0.25)) this.blinkGap = 0.25;
    }
  }

  private surfaceRipples(dt: number, w: FaunaWorld, every: number, size: number): void {
    this.ripple -= dt;
    if (this.ripple > 0) return;
    this.ripple = every * w.rng.range(0.7, 1.3) / w.speed;
    w.ripple(this.pos.x, this.pos.y + 0.5, size * this.scale, 0.35);
  }

  private taken(w: FaunaWorld): Pt[] {
    const out: Pt[] = [];
    for (const c of w.creatures) {
      if (c === this || c.done) continue;
      const s = (c as { spot?: () => Pt | null }).spot?.();
      if (s) out.push(s);
    }
    return out;
  }

  private nextMove(w: FaunaWorld): void {
    const rng = w.rng;
    const p = this.perch!;
    const r = rng.next();
    if (r < DIPPER_TUNING.dive) {
      const waters = dipperWaters(w);
      const entry = diveEntry(p, waters, rng);
      const exit = entry && underExit(entry, waters, rng);
      if (entry && exit) {
        this.under = { from: entry, to: exit, for: rangeOf(rng, [...DIPPER_TUNING.under]) / w.speed };
        this.walk = { from: { ...this.pos }, to: entry, for: (0.5 + dist(this.pos, entry) / 40) / w.speed };
        this.baseDepth = p.depth;
        this.facing = Math.sign(entry.x - this.pos.x) || this.facing;
        this.go('walk');
        return;
      }
    }
    // it settles in before it first wanders off down the stream
    if (r > 1 - DIPPER_TUNING.goAway && this.age > 90) {
      this.depart(w);
      return;
    }
    const to = nextPerch(w.perches, this.pos, rng, p, this.taken(w));
    if (to && to !== p) this.flyTo(to, w);
    else this.perchFor = this.timer + rangeOf(rng, [...DIPPER_TUNING.perch]) / w.speed;
  }

  /** Off down the stream, low over the water. */
  private depart(w: FaunaWorld): void {
    this.flyTo(streamMouth(w, w.rng), w, this.leaving ? 'gone' : 'away');
    this.perch = null;
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    switch (this.state) {
      case 'perch':
        return this.perch ? this.perch.depth : this.y;
      case 'walk':
      case 'wade':
      case 'dive':
      case 'emerge':
      case 'swim':
        return Math.max(this.baseDepth, this.y);
      default:
        return null;
    }
  }

  private wet(): boolean {
    return this.state === 'wade' || this.state === 'dive' || this.state === 'emerge' || this.state === 'swim' || (this.state === 'walk' && this.sink > 0);
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (this.state === 'away') return;
    const parts = w.art.get(`dipper:${this.id % 2}`, (res) => paintDipper(res, 1700 + (this.id % 2) * 11));
    const ps = this.scale;
    const air = this.state === 'enter' || this.state === 'fly' || this.state === 'depart';
    if (air) {
      if (layer === 'air') this.drawFlight(ctx, parts, ps);
      return;
    }
    if (this.state === 'under') {
      if (layer === 'underwater') this.drawUnder(ctx, parts, ps);
      return;
    }
    if (layer === 'underwater' && this.wet()) {
      // the body seen through the water, below the waterline
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(ps * this.facing, ps);
      ctx.beginPath();
      ctx.rect(-40, 0.2, 80, 40);
      ctx.clip();
      ctx.globalAlpha *= 0.6 * (1 - this.sink * 0.5);
      this.drawStanding(ctx, parts, 'deep');
      ctx.restore();
      return;
    }
    if (layer !== 'entities') return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * this.facing, ps);
    if (this.wet()) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, -60, 80, 60.4);
      ctx.clip();
      this.drawStanding(ctx, parts, 'dry');
      ctx.restore();
      const wk = parts.wake;
      ctx.globalAlpha *= 0.55 + 0.45 * Math.min(1, this.sink * 2);
      ctx.drawImage(wk.img as CanvasImageSource, -wk.ox, -wk.oy, wk.w, wk.h);
    } else this.drawStanding(ctx, parts, 'dry');
    ctx.restore();
  }

  /** Legs, tail, body and lid at the feet origin, sunk by `sink` and dipping with the bob. */
  private drawStanding(ctx: Ctx, parts: DipperParts, look: 'dry' | 'deep'): void {
    const lid = look === 'dry';
    const r = parts.size / 20;
    const d = dipCurve(this.dipT < 0 ? 0 : this.dipT / 0.32) * (this.state === 'wade' || this.state === 'perch' ? 1 : 0);
    const legH = LEG * r;
    const bend = 0.42 * d;
    ctx.translate(0, this.sink * 15 * r);
    if ((this.sink < 0.2 && lid) || (!lid && this.sink < 0.6)) {
      // dry legs on the stone; under the waterline a refracted, cooler pair (shifted, a little short)
      const legs = lid ? parts.legs : parts.legsDeep;
      ctx.save();
      if (!lid) ctx.translate(0.5 * r, -0.6 * r);
      ctx.scale(1, (1 - bend) * (lid ? 1 : 0.85));
      ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
      ctx.restore();
    }
    ctx.translate(0, -legH * (1 - bend));
    const pitch = this.pitch + (this.peer > 0 ? 0.3 : 0) + d * 0.08;
    ctx.rotate(pitch);
    const tail = parts.tail;
    ctx.save();
    ctx.translate(-5.9 * r, -7.8 * r);
    ctx.rotate(0.5 + d * 0.35 - pitch * 0.6); // cocked up, flicked higher with each dip
    ctx.drawImage(tail.img as CanvasImageSource, -tail.ox, -tail.oy, tail.w, tail.h);
    ctx.restore();
    const b = lid ? parts.body : parts.deep;
    ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
    if (lid && this.blink > 0) {
      const l = parts.lid;
      ctx.drawImage(l.img as CanvasImageSource, EYE.x * r - l.ox + 0.15 * r, EYE.y * r - l.oy, l.w, l.h);
    }
  }

  private drawFlight(ctx: Ctx, parts: DipperParts, ps: number): void {
    const f = this.leg;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * this.facing, ps);
    if (f) ctx.rotate(clamp(Math.atan2(f.to.y - f.from.y, Math.abs(f.to.x - f.from.x) || 1) * 0.5, -0.35, 0.35));
    // whirring: up, mid, down, mid at ~15 beats a second, over a steady haze; the body lifts on the downstroke
    const ph = Math.floor(this.flap * 60) % 4;
    const s = ph === 0 ? parts.flyUp : ph === 2 ? parts.flyDown : parts.flyMid;
    const hz = parts.haze;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.7;
    ctx.drawImage(hz.img as CanvasImageSource, -hz.ox, -hz.oy, hz.w, hz.h);
    ctx.globalAlpha = a;
    const lift = ph === 2 ? -0.25 : ph === 0 ? 0.2 : 0;
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy + lift, s.w, s.h);
    ctx.restore();
  }

  private drawUnder(ctx: Ctx, parts: DipperParts, ps: number): void {
    const u = this.under!;
    const k = clamp(this.timer / u.for, 0, 1);
    // darkest just after it goes in and before it comes up; deeper and fainter between
    const a = 0.75 - 0.35 * Math.sin(k * Math.PI);
    const s = parts.swim;
    ctx.save();
    ctx.translate(this.x, this.y + 3 * Math.sin(k * Math.PI));
    ctx.scale(ps * this.facing, ps);
    ctx.rotate(0.12 * Math.sin(this.timer * 3));
    ctx.globalAlpha *= a;
    ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }
}

const dipper: CreatureDef = {
  kind: 'dipper',
  title: 'brown dipper',
  role: 'resident',
  rank: 3,
  // one, by day: it flies off down the stream at dusk and is back on its stone in the morning
  resident: (n, mode) => (n > 0 && !mode.night ? 1 : 0),
  needs: (w) => w.perches.some((p) => p.kind !== 'ledge') && dipperWaters(w).length > 0,
  spawn(w, s) {
    const taken: Pt[] = [];
    for (const c of w.creatures) {
      const spot = (c as { spot?: () => Pt | null }).spot?.();
      if (spot && !c.done) taken.push(spot);
    }
    const out: Dipper[] = [];
    for (let i = 0; i < s.count; i++) {
      const d = new Dipper(w, taken);
      if (d.done) break;
      const spot = d.spot();
      if (spot) taken.push(spot);
      out.push(d);
    }
    return out;
  },
  sheet: {
    w: 640,
    h: 150,
    make(res, seed) {
      const a = paintDipper(res, seed);
      return [a.body, a.tail, a.legs, a.lid, a.flyUp, a.flyMid, a.flyDown, a.swim, a.wake];
    },
  },
  show: { stage: 'falls', spec: { w: 380, h: 240 }, w: 570, h: 361, order: 20 },
};
export default dipper;
