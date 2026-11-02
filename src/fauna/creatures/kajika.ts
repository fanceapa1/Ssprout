/**
 * Kajika frog (カジカガエル, Buergeria buergeri): the waterfall's singing frog. A small flat
 * grey-brown frog mottled like the stone it sits on, with big toe pads and gold eyes. It sits on wet
 * stones in the stream and at the pool's edge, and sings in rhythmic bouts after dark, a pale throat
 * sac swelling under its lifted chin. It freezes when a bird comes near and swims to another stone
 * now and then. Three-quarter side view, painted facing right. docs/systems/fauna.md.
 */
import type { Rng } from '../../core/rng';
import { blob, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, closestOnPolygon, dist, easeInOut, insideWithMargin, lerp, rangeOf } from '../math';
import { deepCopy, paintSprite, type Sprite } from '../sprite';
import { perchesOf, perchY } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Snout to vent at perspective 1 (world units): as big as the garden frog, so it reads on its stone. */
export const KAJIKA_SIZE = 18;

export const KAJIKA_TUNING = {
  /** seconds on a stone before moving to another, by day and by night */
  stayDay: [80, 220] as const,
  stayNight: [45, 130] as const,
  /** by day a move is sometimes a spell hidden under a stone instead */
  hideDay: 0.4,
  hide: [40, 110] as const,
  /** seconds between song bouts: the evening chorus, the night, the day */
  boutDusk: [3, 9] as const,
  boutNight: [7, 22] as const,
  boutDay: [45, 150] as const,
  /** notes in a bout; their gaps shorten from the first to the last (a trill) */
  notes: [6, 12] as const,
  gap: [0.62, 0.17] as const,
  /** the evening chorus: this long after nightfall */
  dusk: 20 * 60,
  /** world units / s on the water */
  swim: 24,
  /** stones closer than this: one hop, no swim */
  hop: 64,
};

/** Who it fears, and how near (world units): freeze inside `freeze`, dive inside `flee`. */
export const THREATS: Readonly<Record<string, { freeze: number; flee: number }>> = {
  dipper: { freeze: 60, flee: 26 },
  bird: { freeze: 50, flee: 22 },
  heron: { freeze: 190, flee: 110 },
  yamasemi: { freeze: 150, flee: 80 },
};

const C = {
  back: '#8a8070',
  flank: '#a29c8f',
  blotch: '#6b6458',
  warm: '#7d6c58',
  leg: '#7f7564',
  bar: '#5d564b',
  pad: '#c4baa4',
  eye: '#c99a3e',
  sac: '#ece7dc',
};

// ---------------------------------------------------------------------------------------------
// art

export interface KajikaParts {
  sit: Sprite; // flat on the stone, anchored at the feet below the middle of the body
  raised: Sprite; // calling: the front lifted on straight arms
  sac: Sprite; // the throat bubble, anchored where it joins the chin
  leap: Sprite; // stretched out, anchored at the body centre
  swim: Sprite; // the head and eyes at the surface
  deep: Sprite; // the leap seen through the water
}

/** Chin points (where the sac hangs), in body lengths, for the sit and the raised pose. */
export const CHIN = { sit: { x: 0.42, y: -0.04 }, raised: { x: 0.43, y: -0.14 } } as const;
/** The front rises about the hips (x −0.2) when it calls. */
const lift = (x: number, y: number, raise: number) => ({ x, y: y - raise * 0.21 * Math.max(0, x + 0.2) });

function paintBody(p: Painter, L: number, raise: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => {
    const q = lift(x, y, raise);
    return { x: q.x * L, y: q.y * L };
  };
  const G = (x: number, y: number) => ({ x: x * L, y: y * L });
  // a soft cool shadow where it presses on the stone
  p.wash(blob(-0.02 * L, 0.012 * L, 0.42 * L, 0.04 * L, rng, { irregularity: 0.08 }), '#8c89a1', { rng, opacity: 0.3, edge: 0, sharpness: 0.15, centreLift: 0, granulation: 0.3, fade: { angle: 0, start: 0.6, amount: 0.8 } });

  const body = smoothPolygon(
    [P(0.56, -0.085), P(0.5, -0.16), P(0.4, -0.215), P(0.31, -0.28), P(0.2, -0.285), P(0.09, -0.245), P(-0.1, -0.255), P(-0.28, -0.235), P(-0.42, -0.17), P(-0.49, -0.08), P(-0.44, -0.005), P(-0.15, 0.01), P(0.2, 0.0), P(0.42, -0.025), P(0.52, -0.05)],
    2,
  );
  p.wetInWet(body, C.back, C.flank, {
    rng,
    angle: Math.PI / 2 + 0.1,
    split: 0.48,
    softness: 0.5,
    opacity: 0.9,
    edge: 0.2,
    edgeWidth: L * 0.02,
    sharpness: 0.4,
    granulation: 0.55,
    flow: 0.6,
    flowScale: L * 0.25,
    deform: 0.05,
    spread: 0.04,
    drops: [
      { pigment: C.blotch, at: P(-0.15, -0.22), size: L * 0.12, alpha: 0.45 },
      { pigment: C.warm, at: P(0.15, -0.19), size: L * 0.07, alpha: 0.2 },
    ],
  });
  // the folded hind leg, its bars and the mottling in one wet layer: they bleed and dry as one
  const thigh = smoothPolygon([P(-0.44, -0.1), P(-0.33, -0.18), P(-0.1, -0.15), P(0.07, -0.085), P(0.04, -0.035), P(-0.2, -0.045), P(-0.41, -0.025)], 2);
  const shank = smoothPolygon([P(0.06, -0.06), P(0.03, -0.02), P(-0.34, -0.004), P(-0.38, -0.035), P(-0.2, -0.05)], 2);
  const M = p.layer({ x: -L * 0.6, y: -L * 0.5, w: L * 1.25, h: L * 0.6 });
  M.clip(body);
  for (let i = 0; i < 9; i++) {
    const c = P(rng.range(-0.42, 0.44), rng.range(-0.27, -0.1));
    M.fill(blob(c.x, c.y, L * rng.range(0.035, 0.075), L * rng.range(0.022, 0.045), rng, { irregularity: 0.4 }), rng.chance(0.15) ? C.warm : C.blotch, rng.range(0.3, 0.55));
  }
  const bar = P(0.13, -0.26);
  M.fill(blob(bar.x, bar.y, L * 0.06, L * 0.03, rng, { irregularity: 0.35 }), C.bar, 0.55);
  M.fill(thigh, C.leg, 0.4);
  M.fill(shank, C.leg, 0.3);
  for (const u of [-0.33, -0.17, -0.03]) {
    const c = P(u + rng.range(-0.02, 0.02), -0.1);
    M.fill(blob(c.x, c.y, L * 0.03, L * 0.065, rng, { irregularity: 0.45 }), C.bar, rng.range(0.25, 0.4));
  }
  M.dry({ opacity: 0.72, edge: 0.25, edgeWidth: L * 0.015, sharpness: 0.35, granulation: 0.5, flow: 0.5 });
  p.granulate(body, '#7e7a6e', { rng, strength: 0.5 });
  // a cool glaze low on the flank, lost upward: it sits on the stone
  p.glaze(body, '#8c89a1', { rng, opacity: 0.2, edge: 0, fade: { angle: -Math.PI / 2, start: 0.25, amount: 1 } });

  const toes = (from: Pt, tips: readonly Pt[], op: number) => {
    for (const t of tips) {
      p.stroke([from, { x: lerp(from.x, t.x, 0.6), y: lerp(from.y, t.y, 0.6) - L * 0.006 }, t], { rng, pigment: C.leg, width: L * 0.016, opacity: op, wetness: 0.5, wobble: 0.2, taper: [0.1, 0.2] });
      // the big round toe pad, paler than the toe
      p.dab(t, C.pad, { rng, variant: 'round', angle: 0, length: L * 0.032, width: L * 0.028, opacity: 0.6, edge: 0.3, blend: 'source-over' });
    }
  };
  toes(G(-0.28, -0.005), [G(-0.1, 0.012), G(0.0, 0.006)], 0.45);
  // the near arm: a tapering wash from the shoulder to a splayed hand on the stone
  const sh = P(0.27, -0.1);
  const wr = G(0.34, -0.006);
  // the elbow sits back and out: the arm bends under the shoulder
  const el = { x: lerp(sh.x, wr.x, 0.45) - L * 0.035, y: lerp(sh.y, wr.y, 0.55) };
  const arm = smoothPolygon([{ x: sh.x - L * 0.035, y: sh.y }, { x: sh.x + L * 0.035, y: sh.y - L * 0.005 }, { x: el.x + L * 0.03, y: el.y }, { x: wr.x + L * 0.016, y: wr.y }, { x: wr.x - L * 0.014, y: wr.y + L * 0.004 }, { x: el.x - L * 0.022, y: el.y + L * 0.01 }], 1);
  p.wetInWet(arm, C.leg, C.blotch, { rng, angle: Math.PI, split: 0.55, opacity: 0.85, edge: 0.25, edgeWidth: L * 0.01, sharpness: 0.4, granulation: 0.4, deform: 0.04 });
  toes(wr, [G(0.42, 0.01), G(0.46, 0.002), G(0.38, 0.016)], 0.5);

  // eye: a bump, a gold iris with a dark horizontal pupil, a lidded top and one speck of light
  const eye = P(0.265, -0.262);
  p.dab({ x: eye.x, y: eye.y - L * 0.002 }, C.back, { rng, variant: 'round', angle: 0, length: L * 0.105, width: L * 0.092, opacity: 0.45, edge: 0.1, sharpness: 0.2 });
  p.dab(eye, C.eye, { rng, variant: 'round', angle: 0, length: L * 0.085, width: L * 0.075, opacity: 0.95, edge: 0.45, blend: 'source-over' });
  p.dab({ x: eye.x + L * 0.004, y: eye.y + L * 0.003 }, '#3b352e', { rng, variant: 'round', angle: 0, length: L * 0.052, width: L * 0.02, opacity: 0.9 });
  p.dab({ x: eye.x + L * 0.018, y: eye.y - L * 0.014 }, '#faf6ee', { rng, variant: 'round', angle: 0, length: L * 0.015, width: L * 0.013, opacity: 0.85, blend: 'source-over' });
  // eardrum and the line of the mouth, faint
  const ear = P(0.14, -0.18);
  p.dab(ear, C.blotch, { rng, variant: 'round', angle: 0, length: L * 0.055, width: L * 0.05, opacity: 0.3, edge: 0.35 });
  p.inkLine([P(0.54, -0.085), P(0.4, -0.13), P(0.22, -0.15)], { rng, pigment: '#5e564a', width: L * 0.01, opacity: 0.3, breaks: 0.35, taper: [0.2, 0.5] });
}

function paintSac(p: Painter, L: number): void {
  const rng = p.rng;
  const r = L * 0.165;
  // a pale bubble hung from the chin: no rim, lost where it joins, a cool shade low, light high
  const shape = blob(0, r * 0.95, r, r * 0.9, rng, { irregularity: 0.05 });
  p.wetInWet(shape, '#f4f0e8', '#bdb7c6', { rng, angle: Math.PI / 2 + 0.5, split: 0.62, softness: 0.55, opacity: 0.9, edge: 0.04, sharpness: 0.25, centreLift: 0, granulation: 0.08, fade: { angle: -Math.PI / 2, start: 0.6, amount: 0.7 }, deform: 0.03, blend: 'source-over' });
  p.dab({ x: r * 0.28, y: r * 0.5 }, '#ffffff', { rng, variant: 'round', angle: 0, length: r * 0.42, width: r * 0.34, opacity: 0.7, edge: 0, sharpness: 0.2, blend: 'source-over' });
}

function paintLeap(p: Painter, L: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * L, y: y * L });
  // the hind legs trail behind, nearly straight, the webbed feet spread: one wet layer
  const LG = p.layer({ x: -L * 1.08, y: -L * 0.2, w: L * 0.95, h: L * 0.36 });
  for (const [dy, op] of [[0.035, 0.5], [-0.03, 0.7]] as const) {
    const leg = smoothPolygon([P(-0.2, dy - 0.08), P(-0.42, dy - 0.045), P(-0.55, dy - 0.03), P(-0.72, dy - 0.004), P(-0.87, dy + 0.004), P(-0.87, dy + 0.02), P(-0.72, dy + 0.018), P(-0.56, dy + 0.012), P(-0.45, dy + 0.035), P(-0.22, dy + 0.065)], 2);
    LG.fill(leg, C.leg, op);
    LG.fill(smoothPolygon([P(-0.85, dy - 0.005), P(-0.99, dy - 0.04), P(-1.02, dy + 0.015), P(-0.98, dy + 0.06), P(-0.85, dy + 0.03)], 1), C.leg, op * 0.6);
  }
  LG.dry({ opacity: 0.85, edge: 0.25, edgeWidth: L * 0.012, sharpness: 0.4, granulation: 0.45, flow: 0.5 });
  for (const dy of [0.035, -0.03]) for (const t of [-0.04, 0.012, 0.062]) p.dab(P(-1.0, dy + t), C.pad, { rng, variant: 'round', angle: 0, length: L * 0.03, width: L * 0.026, opacity: 0.55, blend: 'source-over' });
  const body = smoothPolygon([P(0.5, -0.03), P(0.42, -0.11), P(0.2, -0.15), P(-0.1, -0.13), P(-0.3, -0.07), P(-0.32, 0.02), P(0.0, 0.06), P(0.3, 0.05), P(0.48, 0.02)], 2);
  p.wetInWet(body, C.back, C.flank, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.9, edge: 0.2, edgeWidth: L * 0.02, sharpness: 0.4, granulation: 0.5, flow: 0.6, flowScale: L * 0.25, deform: 0.05, drops: [{ pigment: C.blotch, at: P(-0.05, -0.08), size: L * 0.12, alpha: 0.45 }, { pigment: C.warm, at: P(0.2, -0.08), size: L * 0.06, alpha: 0.2 }] });
  p.granulate(body, '#7e7a6e', { rng, strength: 0.45 });
  // the arms reach forward and down for the landing
  const arm = smoothPolygon([P(0.26, 0.0), P(0.34, -0.01), P(0.55, 0.07), P(0.53, 0.09)], 2);
  p.wash(arm, C.leg, { rng, opacity: 0.5, edge: 0.2, sharpness: 0.35, deform: 0.05 });
  const eye = P(0.3, -0.13);
  p.dab(eye, C.eye, { rng, variant: 'round', angle: 0, length: L * 0.075, width: L * 0.068, opacity: 0.9, blend: 'source-over' });
  p.dab(eye, '#3b352e', { rng, variant: 'round', angle: 0, length: L * 0.045, width: L * 0.018, opacity: 0.85 });
}

function paintSwim(p: Painter, L: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * L, y: y * L });
  // only the top of the head breaks the surface: a low wedge with two eye bumps
  const head = smoothPolygon([P(0.32, 0), P(0.26, -0.06), P(0.12, -0.1), P(-0.04, -0.09), P(-0.12, -0.03), P(-0.1, 0.01), P(0.15, 0.015)], 2);
  p.wash(head, C.back, { rng, opacity: 0.85, edge: 0.25, edgeWidth: L * 0.02, sharpness: 0.4, granulation: 0.5, fade: { angle: Math.PI, start: 0.6, amount: 0.7 } });
  for (const [x, s] of [[0.12, 1], [0.04, 0.75]] as const) {
    p.dab(P(x, -0.095), C.eye, { rng, variant: 'round', angle: 0, length: L * 0.06 * s, width: L * 0.055 * s, opacity: 0.9, blend: 'source-over' });
    p.dab(P(x, -0.095), '#3b352e', { rng, variant: 'round', angle: 0, length: L * 0.035 * s, width: L * 0.016 * s, opacity: 0.85 });
  }
}

export function paintKajika(res: number, seed: number): KajikaParts {
  const L = KAJIKA_SIZE;
  const box = { w: L * 1.3, h: L * 0.66, ox: L * 0.64, oy: L * 0.52 };
  const leap = paintSprite(res, { w: L * 1.8, h: L * 0.5, ox: L * 1.1, oy: L * 0.26 }, seed + 3, (p) => paintLeap(p, L));
  return {
    sit: paintSprite(res, box, seed, (p) => paintBody(p, L, 0)),
    // the same seed: the same mottling, lifted
    raised: paintSprite(res, box, seed, (p) => paintBody(p, L, 1)),
    sac: paintSprite(res, { w: L * 0.4, h: L * 0.38, ox: L * 0.2, oy: L * 0.02 }, seed + 2, (p) => paintSac(p, L)),
    leap,
    swim: paintSprite(res, { w: L * 0.5, h: L * 0.16, ox: L * 0.14, oy: L * 0.12 }, seed + 4, (p) => paintSwim(p, L)),
    deep: deepCopy(leap, res, '#5b9a91', 0.3, 3),
  };
}

// ---------------------------------------------------------------------------------------------
// where it can sit (pure)

/** A stone to sit on: a wet rock's top. `y` is its surface at `x`, `depth` its base (+1). */
export interface Seat {
  id: string;
  x: number;
  y: number;
  spread: number;
  dome: number;
  depth: number;
}

type Where = Pick<FaunaWorld, 'pond' | 'water' | 'perches' | 'scene' | 'view'>;

/** The still pool (foam carved out) and the streams. */
export function kajikaWaters(w: Pick<FaunaWorld, 'pond' | 'water'>): Pt[][] {
  return [w.pond.world, ...w.water.moving].filter((p) => p.length >= 3);
}

function nearWater(q: Pt, waters: readonly Pt[][], reach: number): boolean {
  return waters.some((poly) => insideWithMargin(q, poly, 0) || closestOnPolygon(q, poly).d < reach);
}

/**
 * Wet stones: the rock perches (never cliff ledges) and the scene's other boulders whose foot is in
 * or by the water, in view.
 */
export function kajikaSeats(w: Where): Seat[] {
  const waters = kajikaWaters(w);
  const v = w.view;
  const inView = (q: Pt) => q.x > v.x + 30 && q.x < v.x + v.w - 30 && q.y > v.y + 30 && q.y < v.y + v.h - 20;
  const out: Seat[] = [];
  const seen = new Set<string>();
  const add = (p: { id: string; kind: string; x: number; y: number; spread: number; dome: number; depth: number }) => {
    if (p.kind === 'ledge' || seen.has(p.id)) return;
    if (!inView(p) || !nearWater({ x: p.x, y: p.depth - 1 }, waters, 26)) return;
    seen.add(p.id);
    out.push({ id: p.id, x: p.x, y: p.y, spread: Math.min(p.spread, KAJIKA_SIZE * 0.6), dome: p.dome, depth: p.depth });
  };
  for (const p of w.perches) add(p);
  for (const p of perchesOf({ rocks: w.scene.rocks.map((r) => ({ ...r, perch: true })), path: [] })) add(p);
  return out;
}

/** Where its feet rest on a seat at `x`: a rock's painted top sits a little below the perch line. */
export function seatY(s: Seat, x: number): number {
  return perchY({ ...s, kind: 'rock' }, x) + s.dome * 0.35;
}

/** A point in the water at a seat's foot, beside or in front of it (never behind); null when none. */
export function edgePoint(s: Seat, waters: readonly Pt[][], rng: Rng): Pt | null {
  const half = s.spread * 3;
  for (let i = 0; i < 48; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const k = 0.5 + (1.5 * i) / 48;
    const q = { x: s.x + side * rng.range(k - 0.2, k + 0.2) * half, y: s.depth + rng.range(-0.2, 1) * half * 0.45 };
    if (q.y < s.depth - 2 && Math.abs(q.x - s.x) < half + 4) continue;
    if (waters.some((poly) => insideWithMargin(q, poly, 4))) return q;
  }
  return null;
}

/** Whether a swim from `a` to `b` stays on the water the whole way. */
export function swimmable(a: Pt, b: Pt, waters: readonly Pt[][]): boolean {
  const n = Math.max(4, Math.ceil(dist(a, b) / 10));
  for (let k = 0; k <= n; k++) {
    const q = { x: lerp(a.x, b.x, k / n), y: lerp(a.y, b.y, k / n) };
    if (!waters.some((poly) => insideWithMargin(q, poly, 1))) return false;
  }
  return true;
}

/** A free seat to go to: near ones likelier, never `not`, 22 units clear of `taken`. */
export function chooseSeat(seats: readonly Seat[], from: Pt, rng: Rng, not: Seat | null, taken: readonly Pt[]): Seat | null {
  const free = seats.filter((s) => s.id !== not?.id && taken.every((t) => dist(t, s) >= 22));
  if (free.length === 0) return null;
  const weights = free.map((s) => 1 / (1 + (dist(s, from) / 200) ** 2));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

/** Note start times of a bout of `n` notes (s), their gaps shortening toward a trill. */
export function boutNotes(n: number): number[] {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    out.push(t);
    const u = n > 1 ? i / (n - 1) : 1;
    t += lerp(KAJIKA_TUNING.gap[0], KAJIKA_TUNING.gap[1], u ** 0.8);
  }
  return out;
}

/** Throat swell 0..1 at `t` seconds into a bout with notes at `notes` (the trill holds it fuller). */
export function sacAt(t: number, notes: readonly number[]): number {
  if (notes.length === 0 || t < 0) return 0;
  const end = notes[notes.length - 1]! + 0.3;
  if (t > end + 0.45) return 0;
  let pulse = 0;
  for (let i = 0; i < notes.length; i++) {
    const next = notes[i + 1] ?? notes[i]! + 0.36;
    const dur = Math.min(0.32, (next - notes[i]!) * 0.92);
    const u = (t - notes[i]!) / dur;
    if (u >= 0 && u <= 1) pulse = Math.max(pulse, Math.sin(Math.PI * u) ** 0.7);
  }
  const k = clamp(t / Math.max(0.01, end), 0, 1);
  const hold = t <= end ? 0.3 * k * k : 0.3 * (1 - (t - end) / 0.45);
  return clamp(Math.max(pulse, hold), 0, 1);
}

// ---------------------------------------------------------------------------------------------

interface Jump {
  from: Pt;
  to: Pt;
  s0: number;
  s1: number;
  dur: number;
  h: number;
  then: 'sit' | 'swim' | 'under' | 'gone';
}

export class Kajika extends BaseCreature {
  readonly kind = 'kajika' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  seat: Seat | null = null;
  /** where it swims to and climbs out for `goal` */
  private goal: Seat | null = null;
  private landing: Pt | null = null;
  private facing = 1;
  private jump: Jump | null = null;
  private stayFor = 60;
  private boutIn = 5;
  private notes: number[] = [];
  private boutT = -1;
  private raise = 0;
  private flat = 0;
  private breath = 0;
  private calm = 0;
  private hideFor = 0;
  private wakeIn = 0;
  private nightSince = -1;
  private scale = 1;
  private bouts = 0;

  constructor(w: FaunaWorld, taken: readonly Pt[]) {
    super();
    const rng = w.rng;
    this.breath = rng.range(0, 6);
    const seats = kajikaSeats(w);
    const seat = chooseSeat(seats, w.pond.centre, rng, null, taken);
    if (!seat) {
      this.done = true;
      return;
    }
    this.facing = rng.chance(0.5) ? 1 : -1;
    if (w.t < 2) {
      // there from the start: already on its stone
      this.settle(seat, w, seat.x + rng.range(-0.6, 0.6) * seat.spread);
      this.state = 'sit';
    } else {
      const from = edgePoint(seat, kajikaWaters(w), rng);
      this.goal = seat;
      if (from) {
        this.x = from.x;
        this.y = from.y;
        this.climb(w);
        this.alpha = 0;
      } else {
        this.settle(seat, w, seat.x);
        this.alpha = 0;
        this.state = 'sit';
      }
    }
    // a male that has just found its stone soon sings from it
    this.boutIn = rng.range(3, 12);
  }

  /** The stone it is on or heading for (others keep off it). */
  spot(): Pt | null {
    const s = this.goal ?? this.seat;
    return s ? { x: s.x, y: s.y } : null;
  }

  /** Whether it is singing, and how full its throat is (0..1), for tests and the studio. */
  song(): { calling: boolean; sac: number; bouts: number } {
    return { calling: this.state === 'call', sac: this.state === 'call' ? sacAt(this.boutT, this.notes) : 0, bouts: this.bouts };
  }

  private settle(s: Seat, w: FaunaWorld, x: number): void {
    this.seat = s;
    this.goal = null;
    this.x = clamp(x, s.x - s.spread, s.x + s.spread);
    this.y = seatY(s, this.x);
    this.scale = w.perspective(s.depth, s.x);
    this.layer = 'entities';
    this.stayFor = rangeOf(w.rng, w.mode.night ? KAJIKA_TUNING.stayNight : KAJIKA_TUNING.stayDay);
  }

  private taken(w: FaunaWorld): Pt[] {
    const out: Pt[] = [];
    for (const c of w.creatures) {
      if (c === this || c.done) continue;
      const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
      const s = o.perchPoint?.() ?? o.spot?.();
      if (s) out.push(s);
    }
    return out;
  }

  /** The nearest threat: 2 dive, 1 freeze, 0 none. */
  private alarm(w: FaunaWorld): number {
    let level = 0;
    for (const c of w.creatures) {
      const th = THREATS[c.kind];
      if (!th || c.done) continue;
      const d = dist(c, this);
      if (d < th.flee) return 2;
      if (d < th.freeze) level = 1;
    }
    return level;
  }

  private night(w: FaunaWorld): 'dusk' | 'night' | 'day' {
    if (!w.mode.night) {
      this.nightSince = -1;
      return 'day';
    }
    if (this.nightSince < 0) this.nightSince = w.t;
    return w.t - this.nightSince < KAJIKA_TUNING.dusk ? 'dusk' : 'night';
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const rng = w.rng;
    const sp = w.speed;
    this.timer += dt;
    this.breath += dt * sp;
    const time = this.night(w);
    this.alpha = Math.min(1, this.alpha + dt * 1.5);
    const sitting = this.state === 'sit' || this.state === 'call' || this.state === 'freeze';
    const threat = sitting ? this.alarm(w) : 0;
    this.raise = this.state === 'call' ? Math.min(1, this.raise + (dt * sp) / 0.35) : Math.max(0, this.raise - (dt * sp) / 0.5);
    this.flat = this.state === 'freeze' ? Math.min(1, this.flat + dt * 4) : Math.max(0, this.flat - dt * 0.8);
    if (sitting && threat === 2) {
      this.dive(w, 'under');
      return;
    }
    switch (this.state) {
      case 'sit':
        if (threat === 1) {
          this.go('freeze');
          this.calm = 0;
          break;
        }
        if (this.leaving) {
          this.dive(w, 'gone');
          break;
        }
        this.boutIn -= dt * sp;
        this.stayFor -= dt * sp;
        if (this.boutIn <= 0) {
          this.notes = boutNotes(rng.int(KAJIKA_TUNING.notes[0], KAJIKA_TUNING.notes[1]));
          this.boutT = -0.35;
          this.bouts++;
          this.go('call');
        } else if (this.stayFor <= 0) this.move(w, time);
        else if (rng.chance((dt * sp) / 90)) this.shuffle(w);
        break;
      case 'call': {
        if (threat === 1) {
          // it stops mid-song and goes still
          this.go('freeze');
          this.calm = 0;
          break;
        }
        this.boutT += dt * sp;
        const end = this.notes[this.notes.length - 1]! + 0.75;
        if (this.boutT > end) {
          this.boutIn = rangeOf(rng, time === 'dusk' ? KAJIKA_TUNING.boutDusk : time === 'night' ? KAJIKA_TUNING.boutNight : KAJIKA_TUNING.boutDay);
          this.go('sit');
        }
        break;
      }
      case 'freeze':
        // still until the bird has gone, and a few seconds more
        this.calm = threat === 0 ? this.calm + dt * sp : 0;
        if (this.calm > 4 + (this.id % 5)) {
          this.boutIn = Math.max(this.boutIn, rng.range(6, 20));
          this.go('sit');
        }
        break;
      case 'hop':
      case 'leap':
      case 'climb':
        this.stepJump(dt, w);
        break;
      case 'swim':
        this.swim(dt, w);
        break;
      case 'under':
        this.hideFor -= dt * sp;
        if (this.leaving) {
          this.done = true;
          break;
        }
        if (this.hideFor <= 0 && this.alarmAt(w, this.goal) === 0) this.resurface(w);
        break;
    }
  }

  private alarmAt(w: FaunaWorld, s: Seat | null): number {
    if (!s) return 0;
    for (const c of w.creatures) {
      const th = THREATS[c.kind];
      if (th && !c.done && dist(c, s) < th.freeze) return 1;
    }
    return 0;
  }

  /** A little turn or shift on its own stone. */
  private shuffle(w: FaunaWorld): void {
    const s = this.seat;
    if (!s) return;
    const x = clamp(this.x + w.rng.range(-1, 1) * s.spread * 0.6, s.x - s.spread, s.x + s.spread);
    if (w.rng.chance(0.6)) this.facing = -this.facing;
    this.jump = { from: { x: this.x, y: this.y }, to: { x, y: seatY(s, x) }, s0: this.scale, s1: this.scale, dur: 0.28, h: 2.5 * this.scale, then: 'sit' };
    this.goal = s;
    this.go('hop');
  }

  /** Time to leave this stone: another one by a hop or a swim, or (by day) a spell under a stone. */
  private move(w: FaunaWorld, time: 'dusk' | 'night' | 'day'): void {
    const rng = w.rng;
    if (time === 'day' && rng.chance(KAJIKA_TUNING.hideDay)) {
      this.dive(w, 'under');
      return;
    }
    const seats = kajikaSeats(w);
    const waters = kajikaWaters(w);
    const here: Pt = { x: this.x, y: this.y };
    const taken = this.taken(w);
    for (let i = 0; i < 4; i++) {
      const to = chooseSeat(seats, here, rng, this.seat, taken);
      if (!to) break;
      if (dist(to, here) < KAJIKA_TUNING.hop) {
        const x = to.x + rng.range(-0.6, 0.6) * to.spread;
        this.goal = to;
        this.facing = x >= this.x ? 1 : -1;
        const d = dist({ x, y: seatY(to, x) }, here);
        this.jump = { from: here, to: { x, y: seatY(to, x) }, s0: this.scale, s1: w.perspective(to.depth, to.x), dur: (0.4 + d / 260) / w.speed, h: (6 + d * 0.18) * this.scale, then: 'sit' };
        this.go('hop');
        return;
      }
      const a = this.seat ? edgePoint(this.seat, waters, rng) : null;
      const b = edgePoint(to, waters, rng);
      if (a && b && swimmable(a, b, waters)) {
        this.goal = to;
        this.landing = b;
        this.leapTo(a, w, 'swim');
        return;
      }
    }
    this.stayFor = rangeOf(rng, KAJIKA_TUNING.stayNight);
  }

  /** Off the stone into the water at its foot: to hide there, or to leave for good. */
  private dive(w: FaunaWorld, then: 'under' | 'gone'): void {
    const a = this.seat ? edgePoint(this.seat, kajikaWaters(w), w.rng) : null;
    this.goal = then === 'under' ? this.seat : null;
    if (!a) {
      // nowhere to dive: it fades into the stone
      this.go('under');
      this.hideFor = rangeOf(w.rng, KAJIKA_TUNING.hide);
      this.layer = 'entities';
      this.alpha = 0;
      if (then === 'gone') this.done = true;
      return;
    }
    this.leapTo(a, w, then);
  }

  private leapTo(a: Pt, w: FaunaWorld, then: Jump['then']): void {
    const from = { x: this.x, y: this.y };
    this.facing = a.x >= from.x ? 1 : -1;
    const d = dist(a, from);
    this.jump = { from, to: a, s0: this.scale, s1: w.perspective(a.y, a.x), dur: (0.35 + d / 300) / w.speed, h: (5 + d * 0.15) * this.scale, then };
    this.seat = null;
    this.go('leap');
  }

  /** From the water up onto `goal`. */
  private climb(w: FaunaWorld): void {
    const s = this.goal!;
    const x = s.x + w.rng.range(-0.5, 0.5) * s.spread;
    const to = { x, y: seatY(s, x) };
    this.facing = to.x >= this.x ? 1 : -1;
    const d = dist(to, this);
    this.jump = { from: { x: this.x, y: this.y }, to, s0: w.perspective(this.y, this.x), s1: w.perspective(s.depth, s.x), dur: (0.4 + d / 260) / w.speed, h: (5 + d * 0.2) * w.perspective(s.depth, s.x), then: 'sit' };
    this.go('climb');
  }

  private resurface(w: FaunaWorld): void {
    const rng = w.rng;
    const waters = kajikaWaters(w);
    const s = chooseSeat(kajikaSeats(w), this, rng, null, this.taken(w));
    if (!s) {
      this.hideFor = 10;
      return;
    }
    this.goal = s;
    const from = edgePoint(s, waters, rng);
    w.ripple(from?.x ?? s.x, from?.y ?? s.depth, 10 * this.scale, 0.5);
    if (from) {
      this.x = from.x;
      this.y = from.y;
      this.alpha = 0.3;
      this.climb(w);
    } else {
      this.settle(s, w, s.x);
      this.alpha = 0;
      this.go('sit');
    }
    this.boutIn = rng.range(4, 14);
  }

  private stepJump(dt: number, w: FaunaWorld): void {
    const j = this.jump!;
    const k = clamp(this.timer / j.dur, 0, 1);
    const e = easeInOut(k);
    this.x = lerp(j.from.x, j.to.x, e);
    this.y = lerp(j.from.y, j.to.y, e) - Math.sin(Math.PI * k) * j.h;
    this.scale = lerp(j.s0, j.s1, e);
    this.layer = this.state === 'hop' ? 'entities' : 'air';
    if (k < 1) return;
    this.jump = null;
    const ps = this.scale;
    if (j.then === 'sit') {
      const s = this.goal ?? this.seat!;
      if (this.state !== 'hop' || s !== this.seat) this.splashNear(w, j.to, ps);
      this.settle(s, w, j.to.x);
      this.go('sit');
      if (dt > 0 && this.boutIn > 20 && w.mode.night) this.boutIn = w.rng.range(3, 10);
      return;
    }
    // into the water: a small splash ring
    w.ripple(j.to.x, j.to.y, 16 * ps, 0.9);
    if (j.then === 'gone') {
      this.done = true;
      return;
    }
    if (j.then === 'under') {
      this.hideFor = rangeOf(w.rng, KAJIKA_TUNING.hide);
      this.layer = 'underwater';
      this.go('under');
      return;
    }
    this.wakeIn = 0;
    this.go('swim');
  }

  /** A little water flicked up where it lands on a wet stone. */
  private splashNear(w: FaunaWorld, at: Pt, ps: number): void {
    for (const poly of kajikaWaters(w)) {
      const c = closestOnPolygon({ x: at.x, y: at.y + 6 }, poly);
      if (c.d < 30 * ps) {
        w.ripple(c.pt.x, c.pt.y + 2, 9 * ps, 0.55);
        return;
      }
    }
  }

  private swim(dt: number, w: FaunaWorld): void {
    const b = this.landing;
    if (!b || !this.goal) {
      this.dive(w, 'under');
      return;
    }
    const d = dist(b, this);
    const step = KAJIKA_TUNING.swim * w.speed * dt * (0.7 + 0.6 * Math.max(0, Math.sin(this.timer * 7)));
    this.layer = 'waterSurface';
    this.facing = b.x >= this.x ? 1 : -1;
    this.scale = w.perspective(this.y, this.x);
    this.wakeIn -= dt;
    if (this.wakeIn <= 0) {
      w.ripple(this.x - this.facing * 3 * this.scale, this.y, 9 * this.scale, 0.45);
      this.wakeIn = 0.7 / w.speed;
    }
    if (d <= step) {
      this.x = b.x;
      this.y = b.y;
      this.landing = null;
      if (this.alarmAt(w, this.goal) > 0) {
        this.hideFor = rangeOf(w.rng, [10, 25]);
        this.layer = 'underwater';
        this.go('under');
        return;
      }
      this.climb(w);
      return;
    }
    this.x += ((b.x - this.x) / d) * step;
    this.y += ((b.y - this.y) / d) * step;
  }

  override depth(): number | null {
    if (this.layer !== 'entities') return null;
    const s = this.goal ?? this.seat;
    return s ? s.depth + 0.5 : this.y;
  }

  override leave(): void {
    this.leaving = true;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (this.state === 'under' || this.alpha <= 0.01) return;
    const parts = w.art.get('kajika', (res) => paintKajika(res, 2600));
    const s = this.scale;
    if (this.state === 'swim') {
      if (layer === 'underwater') {
        const kick = 1 + 0.12 * Math.sin(this.timer * 7);
        this.blit(ctx, parts.deep, this.x, this.y + 2 * s, s * kick, s, 0.5);
      } else if (layer === 'waterSurface') this.blit(ctx, parts.swim, this.x, this.y, s, s, 1);
      return;
    }
    if (layer !== this.layer) return;
    if (this.state === 'leap' || this.state === 'climb' || (this.state === 'hop' && this.jump && this.jump.h > 4 * s)) {
      const j = this.jump;
      const k = j ? clamp(this.timer / j.dur, 0, 1) : 0;
      const dy = j ? j.to.y - j.from.y : 0;
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y - KAJIKA_SIZE * 0.12 * s);
      ctx.scale(s * this.facing, s);
      ctx.rotate(lerp(-0.45, 0.35, k) * (dy >= 0 ? 1 : -0.6) * this.facing * this.facing);
      ctx.drawImage(parts.leap.img as CanvasImageSource, -parts.leap.ox, -parts.leap.oy, parts.leap.w, parts.leap.h);
      ctx.restore();
      return;
    }
    // on the stone: sit or raised, pressed flatter when frozen, the throat swelling as it sings
    const raised = this.raise > 0.5;
    const body = raised ? parts.raised : parts.sit;
    const tilt = raised ? 0.06 * (1 - this.raise) : -0.06 * this.raise;
    const L = KAJIKA_SIZE;
    const sac = this.state === 'call' ? sacAt(this.boutT, this.notes) : 0.1 * Math.max(0, Math.sin(this.breath * 2.6 * Math.PI)) ** 2 * (1 - this.flat);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(s * this.facing, s * (1 - 0.1 * this.flat));
    // each note jerks the head up a little more
    ctx.translate(-0.2 * L, 0);
    ctx.rotate(tilt - 0.035 * sac * this.raise);
    ctx.translate(0.2 * L, 0);
    ctx.drawImage(body.img as CanvasImageSource, -body.ox, -body.oy, body.w, body.h);
    if (sac > 0.02) {
      const chin = raised ? CHIN.raised : CHIN.sit;
      const k = 0.22 + 0.78 * sac;
      ctx.translate(chin.x * L, chin.y * L);
      ctx.scale(k * (1 + 0.06 * sac), k);
      ctx.globalAlpha = this.alpha * Math.min(1, 0.35 + sac);
      ctx.drawImage(parts.sac.img as CanvasImageSource, -parts.sac.ox, -parts.sac.oy, parts.sac.w, parts.sac.h);
    }
    ctx.restore();
  }

  private blit(ctx: Ctx, sp: Sprite, x: number, y: number, sx: number, sy: number, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = this.alpha * alpha;
    ctx.translate(x, y);
    ctx.scale(sx * this.facing, sy);
    ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
    ctx.restore();
  }
}

const kajika: CreatureDef = {
  kind: 'kajika',
  title: 'kajika frog',
  role: 'resident',
  rank: 5,
  // one singer, day and night (by day it often hides under a stone)
  resident: (n) => (n > 0 ? 1 : 0),
  needs: (w) => kajikaWaters(w).length > 0 && kajikaSeats(w).length > 0,
  spawn(w, s) {
    const taken: Pt[] = [];
    for (const c of w.creatures) {
      const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
      const p = o.perchPoint?.() ?? o.spot?.();
      if (p && !c.done) taken.push(p);
    }
    const out: Kajika[] = [];
    for (let i = 0; i < s.count; i++) {
      const k = new Kajika(w, taken);
      if (k.done) break;
      const p = k.spot();
      if (p) taken.push(p);
      out.push(k);
    }
    return out;
  },
  sheet: {
    w: 640,
    h: 150,
    make(res, seed) {
      const a = paintKajika(res, seed);
      return [a.sit, a.raised, a.sac, a.leap, a.swim];
    },
  },
  show: { stage: 'falls', spec: { w: 300, h: 190 }, w: 570, h: 361, order: 23 },
};
export default kajika;
