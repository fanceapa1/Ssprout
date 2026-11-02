/**
 * Miyama-kawatombo (Calopteryx cornelia): the waterfall's broad-winged damselfly. A long metallic
 * needle (green in the male, bronze in the female) under smoky amber wings that flutter slowly,
 * like a butterfly's. It flits low over the stream and the pool's edge, perches on wet rocks and
 * streamside plants with its wings closed over its back, opens them slowly now and then, and
 * makes short sallies out over the water and back. Side view, painted facing right.
 */
import type { Rng } from '../../core/rng';
import { lighten, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { approach, clamp, closestOnPolygon, dist, insideWithMargin, isOffscreen, lerp, offscreenPoint, randomPointInside, springStep, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY } from '../targets';
import { FAUNA_TUNING } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { variantOf, type CreatureDef } from './lib/def';

/** Head to abdomen tip at perspective 1 (world units): a little longer than the aka-tombo. */
export const DAMSELFLY_SIZE = 31;
export const DAMSELFLY_VARIANTS = ['male', 'female'] as const;
export type DamselflySex = (typeof DAMSELFLY_VARIANTS)[number];

export const DAMSELFLY_TUNING = {
  /** world units / s: slow, fluttering */
  cruise: 30,
  /** wingbeats a second in flight (slow enough to see) */
  hz: 5.2,
  /** seconds on a perch */
  perch: [4, 14] as const,
  /** seconds between slow wing openings on a perch, and how long one takes */
  clapGap: [1.6, 5.5] as const,
  clap: [1.2, 2.2] as const,
  /** height over the water in flight (world units at perspective 1) */
  alt: [6, 20] as const,
  /** after a perch spell: a sally out and back, a move to another perch, else a patrol */
  sally: 0.5,
  move: 0.32,
};

/** Design units: the body is drawn 32.5 long (head +4.5 to tail tip −28) and scaled to the size. */
const D = 32.5;
const K = DAMSELFLY_SIZE / D;
const FEET = { x: 1.0 * K, y: 5.0 * K };
const THORAX = { x: 0.4 * K, y: 1.4 * K };
const FORE = { x: 0.6 * K, y: 0.05 * K };
const HIND = { x: -0.7 * K, y: 0.3 * K };

interface Colours {
  body: Pigment;
  lift: Pigment;
  dark: Pigment;
  tip: Pigment;
  wing: Pigment;
  wingTip: Pigment;
  eye: Pigment;
}

function colours(sex: DamselflySex): Colours {
  if (sex === 'male') {
    const body = '#3f8371';
    return {
      body,
      lift: '#7eb4ac',
      dark: mix(PIGMENTS.sumi, body, 0.45),
      tip: mix(body, PIGMENTS.cerulean, 0.3),
      wing: '#a07a4e',
      wingTip: mix(PIGMENTS.sumi, PIGMENTS.wood, 0.35),
      eye: mix(PIGMENTS.sumi, body, 0.2),
    };
  }
  const body = mix(PIGMENTS.olive, PIGMENTS.wood, 0.55);
  return {
    body,
    lift: mix(PIGMENTS.gold, PIGMENTS.sageLight, 0.5),
    dark: mix(PIGMENTS.sumi, body, 0.4),
    tip: mix(body, PIGMENTS.sumi, 0.2),
    wing: mix('#a07a4e', PIGMENTS.gold, 0.25),
    wingTip: mix('#a07a4e', PIGMENTS.wood, 0.5),
    eye: mix(PIGMENTS.sumi, PIGMENTS.wood, 0.3),
  };
}

export interface DamselflyParts {
  /** body with legs gripping, anchored at the wing base (`FEET` below it) */
  perched: Sprite;
  /** body with legs tucked, same anchor */
  flying: Sprite;
  /** one wing, span along +x from its base, leading edge up */
  wing: Sprite;
  sex: DamselflySex;
}


function wingShape(): Pt[] {
  const s = K;
  return smoothPolygon(
    [
      { x: 0.3 * s, y: -0.3 * s },
      { x: 3 * s, y: -1.25 * s },
      { x: 7 * s, y: -2.05 * s },
      { x: 12 * s, y: -2.4 * s },
      { x: 16 * s, y: -2.35 * s },
      { x: 18.4 * s, y: -1.85 * s },
      { x: 19.5 * s, y: -0.85 * s },
      { x: 19.6 * s, y: 0.35 * s },
      { x: 18.8 * s, y: 1.45 * s },
      { x: 16.5 * s, y: 2.3 * s },
      { x: 12 * s, y: 2.65 * s },
      { x: 7 * s, y: 2.15 * s },
      { x: 3.4 * s, y: 1.2 * s },
      { x: 1 * s, y: 0.4 * s },
    ],
    2,
  );
}

function paintWing(p: Painter, c: Colours, sex: DamselflySex): void {
  const rng = p.rng;
  const s = K;
  const shape = wingShape();
  // smoky amber, deepening wet-in-wet toward the tip, the base losing its edge
  p.wetInWet(shape, lighten(c.wing, 0.08), c.wingTip, { rng, angle: 0, split: 0.6, softness: 0.45, fingers: 0.45, opacity: 0.58, edge: 0.65, edgeWidth: 0.45, sharpness: 0.55, deform: 0.05, spread: 0.06, granulation: 0.35, flow: 0.5, flowScale: 3, fade: { angle: Math.PI, start: 0.72, amount: 0.55 }, blend: 'source-over' });
  // darker smoke pooled where the wing broadens, a paler lift along the leading edge
  const L = p.layer({ x: -1 * s, y: -3.5 * s, w: 22 * s, h: 7 * s });
  L.clip(shape);
  L.fill(smoothPolygon([{ x: 9 * s, y: -0.4 * s }, { x: 15 * s, y: -1.5 * s }, { x: 20 * s, y: 0 }, { x: 16 * s, y: 2.6 * s }, { x: 10 * s, y: 1.9 * s }], 2), c.wingTip, sex === 'male' ? 0.35 : 0.2);
  L.dry({ opacity: 0.6, edge: 0.15, edgeWidth: 0.6, sharpness: 0.2, flow: 0.6, flowScale: 4 });
  // a few long veins, faint and broken
  for (let i = 0; i < 5; i++) {
    const y0 = (-0.5 + i * 0.22) * s;
    const y1 = (-2.1 + i * 1.05) * s;
    p.inkLine([{ x: 0.8 * s, y: y0 }, { x: 9 * s, y: lerp(y0, y1, 0.75) }, { x: 18.2 * s, y: y1 * 0.92 }], { rng, width: 0.11 * s, opacity: 0.2, breaks: 0.45, wobble: 0.2, pigment: c.wingTip });
  }
  p.inkLine([{ x: 0.4 * s, y: -0.35 * s }, { x: 7 * s, y: -2.0 * s }, { x: 16 * s, y: -2.3 * s }], { rng, width: 0.16 * s, opacity: 0.3, breaks: 0.25, pigment: c.wingTip });
  if (sex === 'female') {
    // the female's white false pterostigma near the tip of the leading edge
    p.dab({ x: 17.0 * s, y: -1.85 * s }, PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0.12, length: 1.7 * s, width: 0.75 * s, opacity: 0.9, blend: 'source-over', layers: 5 });
  }
}

/** The abdomen's centre line, thorax to tip, gently drooping and lifting again at the end. */
function abdomenLine(rng: Rng): Pt[] {
  const s = K;
  return [
    { x: -1.2 * s, y: 1.7 * s },
    { x: -7 * s, y: (2.2 + rng.range(-0.1, 0.1)) * s },
    { x: -14 * s, y: (2.55 + rng.range(-0.12, 0.12)) * s },
    { x: -21 * s, y: (2.65 + rng.range(-0.12, 0.12)) * s },
    { x: -25.5 * s, y: 2.45 * s },
    { x: -28 * s, y: 2.1 * s },
  ];
}

function paintBody(p: Painter, c: Colours, sex: DamselflySex, legs: 'grip' | 'tuck'): void {
  const rng = p.rng;
  const s = K;
  const line = abdomenLine(rng);
  // the abdomen: a wet green needle, cooler and a touch broader toward the tip
  p.stroke(line, { rng, pigment: c.body, width: 1.3 * s, taper: [0.02, 0.04], pressure: [1.25, 0.95, 0.8, 0.8, 0.9, 1.05, 0.9], wobble: 0.04, wetness: 0.45, opacity: 0.95, edge: 0.6, edgeWidth: 0.25 });
  p.stroke(line.slice(3), { rng, pigment: c.tip, width: 1.05 * s, taper: [0.3, 0.1], wobble: 0.04, wetness: 0.5, opacity: 0.55, edge: 0.4, edgeWidth: 0.2 });
  // the metallic shine: broken lifts along the back, one per segment or two
  for (let k = 0; k < 9; k++) {
    const u = 0.04 + k * 0.105;
    const a = along(line, u);
    const b = along(line, u + 0.07);
    p.stroke([{ x: a.x, y: a.y - 0.32 * s }, { x: b.x, y: b.y - 0.3 * s }], { rng, pigment: c.lift, width: 0.42 * s, taper: [0.3, 0.3], wobble: 0, wetness: 0.25, opacity: rng.range(0.45, 0.75), edge: 0.2, edgeWidth: 0.15 });
  }
  // segment joints and a shadowed belly, faint and broken (no outline)
  for (let k = 1; k < 10; k++) {
    const q = along(line, k * 0.1);
    p.inkLine([{ x: q.x, y: q.y - 0.5 * s }, { x: q.x - 0.1 * s, y: q.y + 0.55 * s }], { rng, width: 0.12 * s, opacity: 0.3, breaks: 0, pigment: c.dark });
  }
  p.inkLine(line.map((q) => ({ x: q.x, y: q.y + 0.48 * s })), { rng, width: 0.22 * s, opacity: 0.32, breaks: 0.5, taper: [0.05, 0.3], pigment: c.dark });
  // the male's claspers, the female's short ovipositor
  const tip = line[line.length - 1]!;
  p.dab({ x: tip.x + 0.2 * s, y: tip.y }, c.dark, { rng, variant: 'leaf', angle: Math.PI + (sex === 'male' ? -0.25 : 0.3), length: 1.3 * s, width: 0.55 * s, opacity: 0.85 });

  // the thorax: stout and slanted, sheen on the back bleeding into a dark side
  const thorax = smoothPolygon(
    [
      { x: 2.7 * s, y: 0.4 * s },
      { x: 1.4 * s, y: -0.4 * s },
      { x: -0.6 * s, y: -0.2 * s },
      { x: -1.8 * s, y: 0.9 * s },
      { x: -1.6 * s, y: 2.2 * s },
      { x: -0.2 * s, y: 3.0 * s },
      { x: 1.8 * s, y: 3.1 * s },
      { x: 2.9 * s, y: 2.0 * s },
    ],
    2,
  );
  p.wetInWet(thorax, mix(c.body, c.lift, 0.35), c.dark, { rng, angle: Math.PI / 2 + 0.4, split: 0.5, softness: 0.5, fingers: 0.4, opacity: 0.97, edge: 0.55, edgeWidth: 0.3, deform: 0.05, spread: 0.06, blend: 'source-over' });
  p.dab({ x: 0.9 * s, y: 0.1 * s }, lighten(c.lift, 0.2), { rng, variant: 'leaf', angle: -0.35, length: 2.2 * s, width: 0.55 * s, opacity: 0.55, blend: 'source-over', edge: 0.2 });

  // the head: wide dark compound eyes, a small green face
  p.dab({ x: 3.9 * s, y: 1.6 * s }, c.body, { rng, variant: 'round', angle: Math.PI / 2, length: 1.6 * s, width: 1.1 * s, opacity: 0.9 });
  p.dab({ x: 3.6 * s, y: 0.75 * s }, c.eye, { rng, variant: 'round', angle: 0, length: 1.9 * s, width: 1.8 * s, opacity: 0.95, pool: 0.3 });
  p.dab({ x: 3.9 * s, y: 0.45 * s }, PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.45 * s, width: 0.35 * s, opacity: 0.55, blend: 'source-over' });

  // long spiny legs: gripping the perch below, or folded under the thorax in flight
  const hips = [
    { x: 2.0 * s, y: 2.8 * s },
    { x: 1.0 * s, y: 3.0 * s },
    { x: 0.0, y: 3.0 * s },
  ];
  const legPig = mix(PIGMENTS.sumi, c.dark, 0.3);
  hips.forEach((h, i) => {
    const pts =
      legs === 'grip'
        ? [h, { x: h.x + (1.4 - i * 1.1) * s, y: h.y + 0.9 * s }, { x: FEET.x + (2.4 - i * 2.4) * s, y: FEET.y + rng.range(-0.1, 0.1) * s }]
        : [h, { x: h.x + (1.1 - i * 0.3) * s, y: h.y + 0.8 * s }, { x: h.x + (2.0 - i * 0.6) * s, y: h.y + 0.6 * s }];
    p.inkLine(pts, { rng, width: 0.2 * s, opacity: 0.8, breaks: 0, wobble: 0.15, taper: [0.05, 0.4], pigment: legPig });
  });
}

/** A point `u` (0..1) of the way along a polyline, by length. */
function along(line: readonly Pt[], u: number): Pt {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += dist(line[i - 1]!, line[i]!);
  let d = clamp(u, 0, 1) * total;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const l = dist(a, b);
    if (d <= l) return { x: lerp(a.x, b.x, d / (l || 1)), y: lerp(a.y, b.y, d / (l || 1)) };
    d -= l;
  }
  return line[line.length - 1]!;
}

export function paintDamselfly(res: number, seed: number, sex: DamselflySex): DamselflyParts {
  const c = colours(sex);
  const box = { w: 34 * K, h: 10 * K, ox: 29.5 * K, oy: 3.5 * K };
  return {
    perched: paintSprite(res, box, seed, (p) => paintBody(p, c, sex, 'grip')),
    flying: paintSprite(res, box, seed + 1, (p) => paintBody(p, c, sex, 'tuck')),
    wing: paintSprite(res, { w: 21.4 * K, h: 7 * K, ox: 0.7 * K, oy: 3.4 * K }, seed + 2, (p) => paintWing(p, c, sex)),
    sex,
  };
}

// ---------------------------------------------------------------------------------------------
// wings (pure)

/**
 * Screen axes of a wing seen from the side and a little above: `s` for its span, `c` for its chord.
 * `phi` lifts it (+π/2 straight up), `beta` sweeps it back along the body; near wings lean toward us.
 */
export function wingAxes(phi: number, beta: number, near: boolean): { s: Pt; c: Pt } {
  const lateral = Math.cos(beta) * Math.cos(phi);
  return {
    s: { x: -Math.sin(beta), y: -Math.cos(beta) * Math.sin(phi) + lateral * (near ? 0.34 : -0.34) },
    c: { x: -Math.cos(beta), y: Math.sin(beta) * Math.sin(phi) },
  };
}

export interface WingPose {
  fore: { phi: number; beta: number };
  hind: { phi: number; beta: number };
}

/** Closed over the back (`open` 0) to half spread (1). */
export function restPose(open: number): WingPose {
  const k = clamp(open, 0, 1);
  return {
    fore: { phi: Math.PI / 2 - k * 1.05, beta: 1.45 - k * 0.6 },
    hind: { phi: Math.PI / 2 - k * 0.8, beta: 1.39 - k * 0.5 },
  };
}

/** A wingbeat: fore and hind a little out of step, sweeping from high over the back to below the body. */
export function flightPose(phase: number): WingPose {
  return {
    fore: { phi: 0.45 + 0.95 * Math.sin(phase), beta: 0.32 + 0.12 * Math.cos(phase) },
    hind: { phi: 0.4 + 0.9 * Math.sin(phase - 0.65), beta: 0.42 + 0.12 * Math.cos(phase - 0.65) },
  };
}

/** Draw the whole insect at the origin (the wing base), facing +x. */
export function drawDamselfly(ctx: Ctx, parts: DamselflyParts, pose: WingPose, perched: boolean, farAlpha = 0.6): void {
  const wing = (base: Pt, w: { phi: number; beta: number }, near: boolean) => {
    const { s, c } = wingAxes(w.phi, w.beta, near);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.transform(s.x, s.y, c.x, c.y, 0, 0);
    const g = parts.wing;
    ctx.drawImage(g.img as CanvasImageSource, -g.ox, -g.oy, g.w, g.h);
    ctx.restore();
  };
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * farAlpha;
  wing(HIND, pose.hind, false);
  wing(FORE, pose.fore, false);
  ctx.globalAlpha = a;
  const b = perched ? parts.perched : parts.flying;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  wing(HIND, pose.hind, true);
  wing(FORE, pose.fore, true);
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** A point to fly through: `x, y` on screen, `g` the ground y under it (for perspective). */
export interface Waypoint {
  x: number;
  y: number;
  g: number;
  /** the perch it lands on at this point */
  perch?: Spot;
}

/** Somewhere to sit: a wet rock's top or a streamside plant's head. */
export interface Spot {
  id: string;
  kind: 'rock' | 'plant';
  x: number;
  y: number;
  /** ground y (its base), for perspective */
  g: number;
  /** how far along it may land, either side of x */
  spread: number;
}

type Waters = Pick<FaunaWorld, 'pond' | 'water' | 'view'>;

/** The water it flies over: the streams first, then the still pool (foam already carved out). */
export function damselWaters(w: Pick<FaunaWorld, 'pond' | 'water'>): Pt[][] {
  return [...w.water.moving, w.pond.world].filter((p) => p.length >= 3);
}

function inView(q: Pt, w: Pick<FaunaWorld, 'view'>, inset: number): boolean {
  const v = w.view;
  return q.x > v.x + inset && q.x < v.x + v.w - inset && q.y > v.y + inset && q.y < v.y + v.h - inset;
}

/**
 * A ground point over the water: in a stream, or within 70 units of the still pool's edge (it keeps
 * to the margins), in view. With `near`, within `reach` of it. Null when there is none.
 */
export function waterPoint(w: Waters, rng: Rng, near: Pt | null = null, reach: readonly [number, number] = [20, 70]): Pt | null {
  const moving = w.water.moving.filter((p) => p.length >= 3);
  const still = w.pond.world.length >= 3 ? w.pond.world : null;
  const ok = (q: Pt) => {
    if (!inView(q, w, 14)) return false;
    if (moving.some((m) => insideWithMargin(q, m, 4))) return true;
    return !!still && insideWithMargin(q, still, 5) && closestOnPolygon(q, still).d < 70;
  };
  for (let i = 0; i < 48; i++) {
    let q: Pt;
    if (near) {
      const a = rng.range(0, TAU);
      const d = rng.range(reach[0], reach[1]);
      q = { x: near.x + Math.cos(a) * d, y: near.y + Math.abs(Math.sin(a)) * d * 0.45 * (rng.chance(0.7) ? 1 : -1) };
    } else {
      const poly = moving.length > 0 && (rng.chance(0.6) || !still) ? rng.pick(moving) : still;
      if (!poly) return null;
      q = randomPointInside(poly, rng, 5, 12);
    }
    if (ok(q)) return q;
  }
  return null;
}

/** Wet rocks (never cliff ledges) and the heads of plants within 140 units of the water. */
export function perchSpots(w: Pick<FaunaWorld, 'pond' | 'water' | 'perches' | 'flowers'>): Spot[] {
  const waters = damselWaters(w);
  const near = (q: Pt) => waters.some((poly) => insideWithMargin(q, poly, 0) || closestOnPolygon(q, poly).d < 140);
  const out: Spot[] = [];
  for (const p of w.perches) {
    if (p.kind === 'ledge') continue;
    // the tip of a rock: its top, where the painted dome begins
    out.push({ id: p.id, kind: 'rock', x: p.x, y: perchY(p, p.x) + p.dome * 0.3, g: p.depth, spread: p.spread * 0.6 });
  }
  for (const f of w.flowers) {
    if (!near({ x: f.x, y: f.baseY })) continue;
    out.push({ id: f.plantId, kind: 'plant', x: f.x, y: f.y, g: f.baseY, spread: Math.min(3, f.r * 0.3) });
  }
  return out;
}

/** A perch to go to: near ones likelier, rocks a little likelier than plants, never `not`, clear of `taken`. */
export function chooseSpot(spots: readonly Spot[], from: Pt, rng: Rng, not: Spot | null, taken: readonly Pt[]): Spot | null {
  const free = spots.filter((s) => s.id !== not?.id && taken.every((t) => dist(t, s) >= 22));
  if (free.length === 0) return null;
  const weights = free.map((s) => (s.kind === 'rock' ? 1.4 : 1) / (1 + (dist(s, from) / 220) ** 2));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

// ---------------------------------------------------------------------------------------------

export class Damselfly extends BaseCreature {
  readonly kind = 'damselfly' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  readonly sex: DamselflySex;
  /** where it sits (or is about to land) */
  perch: Spot | null = null;
  private pos: Pt;
  private vel: Pt = { x: 0, y: 0 };
  private route: Waypoint[] = [];
  private from: { g: number; d: number } = { g: 0, d: 1 };
  private g: number;
  private facing = 1;
  /** −1..1: the side view's x scale, passing through end-on as it turns */
  private turn = 1;
  private pitch = 0;
  private phase = 0;
  private open = 0;
  private clap: { t: number; for: number; amp: number } | null = null;
  private clapGap = 2;
  private perchFor = 0;
  private home: Spot | null = null;
  private visitT = 0;
  private readonly stay: number;

  constructor(w: FaunaWorld, stay: number, variants: readonly string[] = [], sex?: DamselflySex) {
    super();
    const rng = w.rng;
    this.sex = sex ?? variantOf(variants, DAMSELFLY_VARIANTS, rng, () => (rng.chance(0.6) ? 'male' : 'female'));
    this.variant = this.sex;
    this.stay = stay;
    this.phase = rng.range(0, TAU);
    // in along the water, low, from one side
    const first = waterPoint(w, rng) ?? { x: w.pond.centre.x, y: w.pond.centre.y };
    const side = first.x < w.view.x + w.view.w / 2 ? -1 : 1;
    this.g = first.y;
    this.pos = offscreenPoint(w.view, rng.chance(0.75) ? side : -side, first.y - 30, FAUNA_TUNING.offscreen * 0.6);
    this.facing = this.pos.x < first.x ? 1 : -1;
    this.turn = this.facing;
    this.route = [this.air(first, w)];
    for (let i = rng.int(0, 2); i > 0; i--) {
      const q = waterPoint(w, rng, first, [30, 110]);
      if (q) this.route.push(this.air(q, w));
    }
    this.toPerch(w, null);
    this.state = 'enter';
    this.startLeg();
    this.sync();
  }

  /** The perch it is on or flying to (other damselflies keep off it). */
  perchPoint(): Pt | null {
    return this.perch ? { x: this.perch.x, y: this.perch.y } : null;
  }

  private air(q: Pt, w: FaunaWorld): Waypoint {
    const alt = w.rng.range(DAMSELFLY_TUNING.alt[0], DAMSELFLY_TUNING.alt[1]) * w.perspective(q.y, q.x);
    return { x: q.x, y: q.y - alt, g: q.y };
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

  /** Append a landing on a perch (`to`, or a new one), or nothing when none is free. */
  private toPerch(w: FaunaWorld, to: Spot | null): void {
    const spot = to ?? chooseSpot(perchSpots(w), this.route[this.route.length - 1] ?? this.pos, w.rng, this.perch, this.taken(w));
    if (!spot) return;
    const x = spot.x + w.rng.range(-1, 1) * spot.spread;
    this.perch = spot;
    this.route.push({ x, y: spot.y, g: spot.g, perch: spot });
  }

  private startLeg(): void {
    const wp = this.route[0];
    if (wp) this.from = { g: this.g, d: Math.max(1, dist(this.pos, wp)) };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    this.visitT += dt;
    if (!this.leaving && this.visitT > this.stay && this.state !== 'perch') this.leaving = true;
    if (this.leaving && this.state !== 'leave' && this.state !== 'perch') this.depart(w);
    if (this.state === 'perch') this.perchStep(dt, w);
    else this.flyStep(dt, w);
    this.turn = approach(this.turn, this.facing, 5 * w.speed, dt);
    this.sync();
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.vel.x = 0;
    this.vel.y = 0;
    this.pitch = approach(this.pitch, 0, 2, dt);
    // a slow opening of the wings now and then, and closed again
    if (this.clap) {
      this.clap.t += dt;
      const k = clamp(this.clap.t / this.clap.for, 0, 1);
      this.open = this.clap.amp * Math.sin(k * Math.PI) ** 1.4;
      if (k >= 1) {
        this.clap = null;
        this.clapGap = w.rng.range(DAMSELFLY_TUNING.clapGap[0], DAMSELFLY_TUNING.clapGap[1]) / sf;
      }
    } else {
      this.open = approach(this.open, 0, 1, dt);
      this.clapGap -= dt;
      if (this.clapGap <= 0) this.clap = { t: 0, for: w.rng.range(DAMSELFLY_TUNING.clap[0], DAMSELFLY_TUNING.clap[1]) / sf, amp: w.rng.range(0.45, 1) };
    }
    if (this.timer < this.perchFor && !(this.leaving && this.timer > 1)) return;
    if (this.clap) return; // closes its wings before it lifts off
    this.open = 0;
    if (this.leaving) {
      this.depart(w);
      return;
    }
    this.plan(w);
  }

  /** What to do when a perch spell ends: a sally and back, a move, or a patrol over the water. */
  private plan(w: FaunaWorld): void {
    const rng = w.rng;
    const here = this.perch;
    this.route = [];
    const r = rng.next();
    if (here && r < DAMSELFLY_TUNING.sally) {
      for (let i = rng.int(1, 2); i > 0; i--) {
        const q = waterPoint(w, rng, this.route[this.route.length - 1] ?? here, [16, 55]);
        if (q) this.route.push(this.air(q, w));
      }
      if (this.route.length === 0) this.route.push(this.air({ x: here.x + rng.range(-40, 40), y: here.g + rng.range(-6, 10) }, w));
      this.toPerch(w, here);
    } else {
      const patrol = r >= DAMSELFLY_TUNING.sally + DAMSELFLY_TUNING.move;
      let last: Pt | null = here;
      for (let i = patrol ? rng.int(2, 4) : rng.int(0, 1); i > 0; i--) {
        const q = waterPoint(w, rng, patrol ? null : last, [30, 120]);
        if (q) {
          this.route.push(this.air(q, w));
          last = q;
        }
      }
      this.toPerch(w, null);
      if (this.route.length === 0 || !this.route[this.route.length - 1]!.perch) this.toPerch(w, here);
    }
    this.vel = { x: 0, y: -8 };
    this.go('fly');
    this.startLeg();
  }

  private depart(w: FaunaWorld): void {
    const side = this.pos.x < w.view.x + w.view.w / 2 ? -1 : 1;
    const out = offscreenPoint(w.view, side, this.pos.y - w.rng.range(10, 40), FAUNA_TUNING.offscreen);
    this.route = [{ ...out, g: this.g }];
    this.perch = null;
    this.go('leave');
    this.startLeg();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.phase += dt * TAU * DAMSELFLY_TUNING.hz * sf;
    this.open = 0;
    const wp = this.route[0];
    if (!wp) {
      if (this.state === 'leave') this.done = true;
      else this.plan(w);
      return;
    }
    const d = dist(this.pos, wp);
    if (wp.perch && d < 6) {
      // settling: a gentle spring onto the exact spot
      springStep(this.pos, this.vel, wp, 5 * sf, dt);
      this.state = 'land';
      if (dist(this.pos, wp) < 0.4) {
        this.pos = { x: wp.x, y: wp.y };
        this.g = wp.g;
        this.route.shift();
        this.home = wp.perch;
        this.perchFor = w.rng.range(DAMSELFLY_TUNING.perch[0], DAMSELFLY_TUNING.perch[1]) / sf;
        this.clapGap = w.rng.range(0.6, 2.5) / sf;
        this.go('perch');
      }
    } else {
      // slow and wavering: the heading wanders on noise, each downstroke lifts it a little
      const toward = Math.atan2(wp.y - this.pos.y, wp.x - this.pos.x);
      const wander = w.noise(this.timer * 0.9, this.id * 1.9) * (d > 30 ? 1.1 : 0.4);
      const sp = DAMSELFLY_TUNING.cruise * sf * (this.state === 'leave' ? 1.4 : 1) * (d < 30 ? 0.4 + 0.6 * (d / 30) : 1);
      this.vel.x = approach(this.vel.x, Math.cos(toward + wander) * sp, 2.4, dt);
      this.vel.y = approach(this.vel.y, Math.sin(toward + wander) * sp, 2.4, dt);
      this.pos.x += this.vel.x * dt;
      this.pos.y += (this.vel.y - Math.max(0, Math.sin(this.phase)) * 9 * sf + 5.7 * sf) * dt;
      if (d < 4 && !wp.perch) {
        this.route.shift();
        this.startLeg();
      }
    }
    const k = clamp(1 - dist(this.pos, wp) / this.from.d, 0, 1);
    if (this.state !== 'perch') this.g = lerp(this.from.g, wp.g, k);
    if (Math.abs(this.vel.x) > 5) this.facing = Math.sign(this.vel.x);
    this.pitch = approach(this.pitch, clamp(-this.vel.y * this.facing * 0.006, -0.25, 0.25) - 0.06, 3, dt);
    if (this.state === 'leave' && isOffscreen(this.pos, w.view, FAUNA_TUNING.offscreen * 0.4)) this.done = true;
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  /** Perspective ground under it (tests). */
  ground(): number {
    return this.g;
  }

  /** The perch it last sat on (a sally comes back to it). */
  lastPerch(): Spot | null {
    return this.home;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air') return;
    const v = this.id % 2;
    const parts = w.art.get(`damselfly:${this.sex}:${v}`, (res) => paintDamselfly(res, 2100 + v * 7 + (this.sex === 'male' ? 0 : 3), this.sex));
    const ps = w.perspective(this.g, this.x);
    const perched = this.state === 'perch';
    const fs = Math.abs(this.turn) < 0.12 ? 0.12 * Math.sign(this.turn || 1) : this.turn;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps * fs, ps);
    if (perched) ctx.translate(-FEET.x, -FEET.y);
    else {
      ctx.rotate(this.pitch);
      ctx.translate(-THORAX.x, -THORAX.y);
    }
    drawDamselfly(ctx, parts, perched ? restPose(this.open) : flightPose(this.phase), perched, perched ? 0.45 : 0.7);
    ctx.restore();
  }
}

const damselfly: CreatureDef = {
  kind: 'damselfly',
  title: 'miyama-kawatombo damselfly',
  role: 'visitor',
  visit: { gap: [80, 200], first: [12, 45], stay: [60, 130], group: [1, 2], max: 2, diurnal: true, visitor: true },
  variants: DAMSELFLY_VARIANTS,
  needs: (w) => damselWaters(w).length > 0 && perchSpots(w).length > 0,
  spawn(w, s) {
    const out: Damselfly[] = [];
    for (let i = 0; i < s.count; i++) {
      // a second one is the other sex: a pair along the stream
      const sex = i > 0 && out[0] ? (out[0].sex === 'male' ? 'female' : 'male') : undefined;
      out.push(new Damselfly(w, (s.stay || 90) * w.rng.range(0.85, 1.1), s.variants, sex));
    }
    return out;
  },
  sheet: {
    w: 640,
    h: 150,
    make(res, seed) {
      const m = paintDamselfly(res, seed, 'male');
      const f = paintDamselfly(res, seed + 5, 'female');
      const box = { w: 36 * K, h: 26 * K, ox: 30 * K, oy: 16 * K };
      const pose = (parts: DamselflyParts, p: WingPose, perched: boolean) => paintSprite(res, box, seed + 9, (pt) => drawDamselfly(pt.ctx, parts, p, perched, perched ? 0.45 : 0.7));
      return [pose(m, restPose(0), true), pose(m, restPose(1), true), pose(m, flightPose(1.2), false), pose(m, flightPose(4.4), false), pose(f, restPose(0.3), true), m.wing, f.wing];
    },
  },
  show: { stage: 'falls', spec: { w: 380, h: 240 }, w: 570, h: 361, order: 21 },
};
export default damselfly;
