/**
 * Marbled rock crab (Pachygrapsus marmoratus): the coast's splash-rock crab. A flat square dark
 * crab with pale marbling, seen from above and in front; it sidles over the splash rocks' faces and
 * the rock pools' rims in quick runs, picks at the rock, freezes and darts away from anything big.
 * Day and night. docs/devlog/203-rock-crab.md
 */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { approach, clamp, dist, lerp, polygonCentroid, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Carapace width at perspective 1 (world units): about 2.5 × life, so it reads in the close view. */
export const ROCK_CRAB_SIZE = 8;

export const ROCK_CRAB_TUNING = {
  /** a quick sideways run: how far (world units) and how fast (units/s at perspective 1) */
  run: [3, 12] as const,
  speed: 26,
  /** the dash to cover */
  dart: 60,
  /** a stop between runs (s), and how often a stop turns into feeding */
  stop: [0.6, 3] as const,
  feed: [3, 9] as const,
  feedChance: 0.45,
  /** claw picks a second while feeding (each claw in turn) */
  pickHz: 2.2,
  /** chance a run climbs between the dry crown edge and the waterline */
  climb: 0.3,
  /** frozen before the dart (s), then hidden in its crack (s) */
  freeze: [0.4, 1.1] as const,
  hidden: [6, 15] as const,
  /** the first look out after it appears (s) */
  first: [0.5, 3] as const,
  /** seconds on one rock before it moves to another, out of sight */
  stayPut: [60, 180] as const,
  /** a swell washes up the waterline every this many seconds */
  swell: 6.5,
  /** world units of stride per gait frame */
  stride: 1.4,
  /** how near each kind may come before it freezes (world units) */
  threats: { gull: 80, heron: 160, cat: 90, goat: 90, tortoise: 40, 'rock-thrush': 50, hoopoe: 50, octopus: 45, 'scops-owl': 60 } as Record<string, number>,
};

// ---------------------------------------------------------------------------------------------
// art: from above and a little in front, the front edge (eyes, claws) toward the viewer (+y)

const k = ROCK_CRAB_SIZE / 10;
const P = (x: number, y: number): Pt => ({ x: x * k, y: y * k });

const COL = {
  shell: '#3e3040',
  green: '#2e382c',
  deep: mix(PIGMENTS.sumi, '#2a2230', 0.5),
  marble: '#d8c88c',
  legs: '#6a4646',
  legDark: mix('#6a4646', PIGMENTS.sumi, 0.45),
  claw: '#5e4248',
  tip: '#d8c9a0',
  eye: mix(PIGMENTS.sumi, '#1e1a20', 0.5),
  foam: '#e8f2ef',
};

export interface RockCrabParts {
  shadow: Sprite;
  /** carapace, marbling and eyes, anchored at the body centre */
  body: Sprite;
  /** standing, gait A, gait B: all eight walking legs, anchored at the body centre */
  legs: [Sprite, Sprite, Sprite];
  /** the right claw, anchored at its shoulder; the left is drawn mirrored */
  claw: Sprite;
  /** the swell's foam over its legs, anchored at the body centre */
  foam: Sprite;
}

/** Hip, knee and tip of the right walking legs (front to back), in tenths of the carapace width. */
const LEGS: readonly [Pt, Pt, Pt][] = [
  [{ x: 4.4, y: 2.0 }, { x: 7.4, y: 3.0 }, { x: 8.8, y: 5.6 }],
  [{ x: 4.8, y: 0.6 }, { x: 8.4, y: 1.0 }, { x: 10.4, y: 3.6 }],
  [{ x: 4.8, y: -0.8 }, { x: 8.4, y: -1.2 }, { x: 10.6, y: 1.4 }],
  [{ x: 4.2, y: -2.2 }, { x: 7.2, y: -3.4 }, { x: 9.2, y: -1.4 }],
];
const SHOULDER = { x: 2.9, y: 2.9 };

function carapace(): Pt[] {
  // squarish: a straight front edge, the sides converging a little toward the back
  return smoothPolygon([P(-4.3, 3.3), P(0, 3.6), P(4.3, 3.3), P(4.9, 2.2), P(4.7, -1.0), P(4.0, -3.2), P(2.4, -3.8), P(-2.4, -3.8), P(-4.0, -3.2), P(-4.7, -1.0), P(-4.9, 2.2)], 2);
}

function paintBody(p: Painter): void {
  const rng = p.rng;
  const shell = carapace();
  p.wetInWet(shell, COL.shell, COL.green, { rng, angle: Math.PI / 2 + 0.4, split: 0.45, softness: 0.5, fingers: 0.5, opacity: 0.97, edge: 0.6, edgeWidth: 0.4 * k, deform: 0.05, granulation: 0.4, blend: 'source-over' });
  // the fine pale marbling: short broken wavy lines across the shell, more toward the back
  for (let i = 0; i < 24; i++) {
    const y = rng.range(-3.3, 2.6);
    const x = rng.range(-3.6, 3.6) * (1 - Math.max(0, -y - 2) * 0.3);
    const a = rng.range(-0.5, 0.5);
    const l = rng.range(0.9, 2.0);
    const q = (s: number) => P(x + Math.cos(a) * l * s, y + Math.sin(a) * l * s + Math.sin(s * 3) * 0.25);
    p.inkLine([q(-1), q(-0.3), q(0.4), q(1)], { rng, width: rng.range(0.26, 0.42) * k, opacity: rng.range(0.6, 0.9), breaks: 0.3, wobble: 0.25, taper: [0.3, 0.3], pigment: COL.marble });
  }
  // the transverse ridges on the flanks and the gastric groove
  for (const s of [-1, 1]) {
    for (const y of [0.6, -0.6, -1.8]) p.inkLine([P(s * 4.6, y), P(s * 3.4, y - 0.3)], { rng, width: 0.25 * k, opacity: 0.5, breaks: 0.2, wobble: 0.1, pigment: COL.deep });
  }
  p.inkLine([P(-1.6, -0.4), P(0, 0.3), P(1.6, -0.4)], { rng, width: 0.3 * k, opacity: 0.45, breaks: 0.2, wobble: 0.1, pigment: COL.deep });
  // a wet gloss on the lit back
  p.dab(P(-1.8, -2.6), PIGMENTS.petalWhite, { rng, variant: 'leaf', angle: 0.2, length: 1.8 * k, width: 0.45 * k, opacity: 0.3, blend: 'source-over' });
  // the front edge darker, the eyes on short stalks in its corners
  p.inkLine([P(-3.7, 3.4), P(0, 3.7), P(3.7, 3.4)], { rng, width: 0.45 * k, opacity: 0.7, breaks: 0.1, wobble: 0.05, pigment: COL.deep });
  for (const s of [-1, 1]) {
    p.dab(P(s * 3.75 - 0.5, 3.75), COL.eye, { rng, variant: 'round', angle: 0, length: 1.0 * k, width: 0.95 * k, opacity: 0.95, layers: 3 });
    p.dab(P(s * 3.75 - 0.25, 3.55), PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.35 * k, width: 0.3 * k, opacity: 0.7, blend: 'source-over' });
  }
}

function legDab(p: Painter, rng: Rng, a: Pt, b: Pt, pig: string, width: number, opacity: number): void {
  p.dab(a, pig, { rng, variant: 'leaf', angle: Math.atan2(b.y - a.y, b.x - a.x), length: dist(a, b) * 1.06, width, opacity, pool: 0.5, basePool: 0.2, curve: rng.range(-0.06, 0.06) });
}

function paintLegs(p: Painter, gait: 0 | 1 | 2): void {
  const rng = p.rng;
  for (const side of [-1, 1]) {
    LEGS.forEach(([hip, knee, tip], i) => {
      // alternate legs lift and reach between the two gait frames
      const up = gait === 0 ? 0 : (i + (side > 0 ? 0 : 1) + gait) % 2 === 0 ? 1 : -0.4;
      const H = { x: side * hip.x * k, y: hip.y * k };
      const K = { x: side * (knee.x + up * 0.5) * k, y: (knee.y - up * 0.7) * k };
      const T = { x: side * (tip.x + up * 0.9) * k, y: (tip.y - up * 1.1) * k };
      const pig = mix(COL.legs, COL.shell, rng.range(0.1, 0.4));
      legDab(p, rng, H, K, pig, 1.0 * k, 0.9);
      legDab(p, rng, K, T, mix(pig, COL.legDark, 0.3), 0.6 * k, 0.88);
      // a pale band at the knee, the dark dactyl
      p.dab(K, COL.marble, { rng, variant: 'round', angle: 0, length: 0.5 * k, width: 0.45 * k, opacity: 0.45, blend: 'source-over' });
      legDab(p, rng, { x: T.x - (T.x - K.x) * 0.3, y: T.y - (T.y - K.y) * 0.3 }, T, COL.legDark, 0.32 * k, 0.7);
    });
  }
}

/** The right claw, shoulder at the origin, folded in front of the face, fingers inward (−x). */
function paintClaw(p: Painter): void {
  const rng = p.rng;
  legDab(p, rng, P(0, 0), P(0.8, 1.5), COL.claw, 1.15 * k, 0.95);
  const hand = smoothPolygon([P(1.5, 1.1), P(1.9, 2.2), P(1.2, 3.0), P(-0.4, 3.3), P(-1.9, 2.9), P(-0.7, 2.4), P(-0.2, 1.6), P(0.6, 1.0)], 1);
  p.wetInWet(hand, COL.claw, mix(COL.claw, PIGMENTS.sumi, 0.3), { rng, angle: Math.PI / 2, split: 0.5, softness: 0.5, fingers: 0.3, opacity: 1, edge: 0.45, edgeWidth: 0.25 * k, deform: 0.05, blend: 'source-over' });
  // the pale finger tips
  p.dab(P(-0.7, 2.9), COL.tip, { rng, variant: 'leaf', angle: Math.PI + 0.2, length: 1.0 * k, width: 0.35 * k, opacity: 0.85, blend: 'source-over' });
  p.dab(P(-0.5, 2.3), COL.tip, { rng, variant: 'leaf', angle: Math.PI - 0.3, length: 0.8 * k, width: 0.3 * k, opacity: 0.7, blend: 'source-over' });
}

export function paintRockCrab(res: number, seed: number): RockCrabParts {
  const legBox = { w: 24 * k, h: 12 * k, ox: 12 * k, oy: 5.5 * k };
  return {
    shadow: paintSprite(res, { w: 22 * k, h: 6 * k, ox: 11 * k, oy: 3 * k }, seed + 8, (p, rng) => {
      p.glaze(blob(0, 0, 8.5 * k, 2 * k, rng, { irregularity: 0.1 }), mix(PIGMENTS.shadow, PIGMENTS.sumi, 0.3), { rng, opacity: 0.32, edge: 0, sharpness: 0.1, deform: 0.15 });
    }),
    body: paintSprite(res, { w: 11 * k, h: 9.5 * k, ox: 5.5 * k, oy: 4.5 * k }, seed, paintBody),
    legs: ([0, 1, 2] as const).map((g) => paintSprite(res, legBox, seed + 2 + g, (p) => paintLegs(p, g))) as RockCrabParts['legs'],
    claw: paintSprite(res, { w: 5.5 * k, h: 4.6 * k, ox: 2.6 * k, oy: 0.8 * k }, seed + 6, paintClaw),
    foam: paintSprite(res, { w: 26 * k, h: 9 * k, ox: 13 * k, oy: 2 * k }, seed + 9, (p, rng) => {
      p.wash(blob(0, 3 * k, 12 * k, 3 * k, rng, { irregularity: 0.2 }), COL.foam, { rng, opacity: 0.7, edge: 0.5, edgeWidth: 0.5 * k, deform: 0.2, blend: 'source-over' });
      p.inkLine([P(-11, 1.2), P(-4, 0.4), P(4, 0.6), P(11, 1.4)], { rng, width: 0.5 * k, opacity: 0.6, breaks: 0.4, wobble: 0.3, pigment: PIGMENTS.petalWhite });
    }),
  };
}

export interface RockCrabPose {
  /** 0 standing, 1 or 2 a gait frame */
  gait: 0 | 1 | 2;
  /** how far each claw is down at the rock (0..1) */
  pickL: number;
  pickR: number;
  /** pressed to the rock (0..1) */
  flat: number;
  /** the swell's foam over its legs (0..1) */
  wash: number;
}

export const CRAB_REST: RockCrabPose = { gait: 0, pickL: 0, pickR: 0, flat: 0, wash: 0 };

/** A feeding pose at time t: the claws pick at the rock in turn. */
export function feedPose(t: number): RockCrabPose {
  const a = t * TAU * ROCK_CRAB_TUNING.pickHz;
  return { ...CRAB_REST, pickL: Math.max(0, Math.sin(a)), pickR: Math.max(0, -Math.sin(a)) };
}

function drawClaw(ctx: Ctx, s: Sprite, side: 1 | -1, pick: number): void {
  ctx.save();
  ctx.translate(side * SHOULDER.x * k, (SHOULDER.y + pick * 0.9) * k);
  ctx.scale(side, 1);
  ctx.rotate(-pick * 0.35);
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

/** The crab at the origin (the body centre on the rock), in world units: five or six `drawImage`s. */
export function drawRockCrab(ctx: Ctx, parts: RockCrabParts, q: RockCrabPose): void {
  const sh = parts.shadow;
  ctx.drawImage(sh.img as CanvasImageSource, -sh.ox, -sh.oy + 1.2 * k, sh.w, sh.h);
  ctx.save();
  ctx.scale(1 + 0.06 * q.flat, 1 - 0.12 * q.flat);
  const legs = parts.legs[q.gait];
  ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
  drawClaw(ctx, parts.claw, -1, q.pickL);
  drawClaw(ctx, parts.claw, 1, q.pickR);
  const b = parts.body;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  ctx.restore();
  if (q.wash > 0.02) {
    const f = parts.foam;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * q.wash;
    ctx.drawImage(f.img as CanvasImageSource, -f.ox, -f.oy + (1 - q.wash) * 3 * k, f.w, f.h);
    ctx.globalAlpha = a;
  }
}

// ---------------------------------------------------------------------------------------------
// where it lives (pure)

/**
 * A rock it runs over: a dry row (the crown's front lip, or a pool's back rim) and a wet row (the
 * waterline), both left → right; `dryU` is where the dry row is clear of the slot on the crown.
 */
export interface CrabRock {
  id: string;
  dry: Pt[];
  wet: Pt[];
  dryU: [number, number] | null;
  depth: number;
}

function rowAt(row: readonly Pt[], u: number): Pt {
  const f = clamp(u, 0, 1) * (row.length - 1);
  const i = Math.min(row.length - 2, Math.floor(f));
  const a = row[i]!;
  const b = row[i + 1]!;
  return { x: lerp(a.x, b.x, f - i), y: lerp(a.y, b.y, f - i) };
}

/** A point on a rock: `u` along it (0 left … 1 right), `v` from the dry row (0) to the waterline (1). */
export function rockPoint(r: CrabRock, u: number, v: number): Pt {
  const a = rowAt(r.dry, u);
  const b = rowAt(r.wet, u);
  return { x: lerp(a.x, b.x, v), y: lerp(a.y, b.y, v) };
}

const rockCache = new WeakMap<object, CrabRock[]>();

/** The coast's splash rocks (their `splash-*` faces) and the rock pools' back rims. */
export function crabRocks(w: Pick<FaunaWorld, 'walls' | 'regions' | 'perches'>): CrabRock[] {
  let out = rockCache.get(w.walls);
  if (out) return out;
  out = [];
  for (const f of w.walls) {
    if (!f.id.startsWith('splash-') || f.top.length < 4) continue;
    const dry = f.top.map((q) => ({ x: q.x, y: q.y - 1.5 }));
    const wet = f.top.map((q) => ({ x: q.x, y: q.y + f.h - 2 }));
    // the crown's front lip only near the rock's perch: the perch is placed clear of the slot
    const perch = w.perches.find((p) => p.kind === 'rock' && p.id === `rock-${f.id.slice(7)}`);
    const x0 = dry[0]!.x;
    const span = dry[dry.length - 1]!.x - x0;
    const dryU: [number, number] | null = perch ? [clamp((perch.x - perch.spread - 4 - x0) / span, 0, 1), clamp((perch.x + perch.spread + 4 - x0) / span, 0, 1)] : null;
    out.push({ id: f.id, dry, wet, dryU, depth: Math.max(...wet.map((q) => q.y)) + 3 });
  }
  if (out.length > 0) {
    for (const r of w.regions) {
      if (r.kind !== 'pool') continue;
      const c = polygonCentroid(r.outline);
      const back = r.outline.filter((q) => q.y < c.y - 1).sort((a, b) => a.x - b.x);
      if (back.length < 4) continue;
      const out1 = (q: Pt, d: number) => {
        const l = Math.hypot(q.x - c.x, q.y - c.y) || 1;
        return { x: q.x + ((q.x - c.x) / l) * d, y: q.y + ((q.y - c.y) / l) * d };
      };
      out.push({ id: r.id, dry: back.map((q) => out1(q, 6)), wet: back.map((q) => out1(q, 1.5)), dryU: [0.15, 0.85], depth: c.y });
    }
  }
  rockCache.set(w.walls, out);
  return out;
}

const inView = (q: Pt, v: Rect, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

/** A rock for it (in view when it can), not `not`, not one another crab holds. */
export function chooseRock(rocks: readonly CrabRock[], view: Rect, rng: Rng, taken: readonly CrabRock[], not: CrabRock | null = null): CrabRock | null {
  const free = rocks.filter((r) => r !== not && !taken.includes(r));
  const pool = free.length > 0 ? free : rocks.filter((r) => r !== not);
  if (pool.length === 0) return rocks[0] ?? null;
  const seen = pool.filter((r) => inView(rockPoint(r, 0.5, 1), view, 10));
  return rng.pick(seen.length > 0 ? seen : pool);
}

/** The nearest big creature close enough to frighten it, or null. */
export function bigNear(at: Pt, creatures: readonly { kind: string; x: number; y: number; done: boolean }[], self?: object): string | null {
  for (const c of creatures) {
    if (c === self || c.done) continue;
    const reach = ROCK_CRAB_TUNING.threats[c.kind];
    if (reach && Math.hypot(c.x - at.x, c.y - at.y) < reach) return c.kind;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

export type RockCrabMode = 'hidden' | 'run' | 'stop' | 'feed' | 'freeze' | 'dart';

export class RockCrab extends BaseCreature {
  readonly kind = 'rock-crab' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  rock: CrabRock;
  u = 0;
  v = 1;
  /** for tests: runs, feeds, frights, swells sat through */
  runs = 0;
  feeds = 0;
  frights = 0;
  swells = 0;
  private toU = 0;
  private toV = 1;
  private waitFor = 0;
  private stride = 0;
  private flat = 0;
  private onRock = 0;
  private stayPut: number;
  private scale = 1;
  private salt: number;
  private lastWash = 0;

  constructor(
    w: FaunaWorld,
    rock: CrabRock,
    readonly rng: Rng,
  ) {
    super();
    this.rock = rock;
    this.salt = rng.range(0, TAU);
    this.stayPut = rangeOf(rng, [...ROCK_CRAB_TUNING.stayPut]);
    this.hideAt(rng.chance(0.5) ? 0 : 1, rangeOf(rng, [...ROCK_CRAB_TUNING.first]));
    this.sync(w);
  }

  /** What it is doing (tests). */
  doing(): RockCrabMode {
    return this.state as RockCrabMode;
  }

  flatness(): number {
    return this.flat;
  }

  private hideAt(u: number, wait: number): void {
    this.u = u;
    this.toU = u;
    this.v = this.toV = this.rock.dryU ? this.v : 1;
    this.alpha = 0;
    this.waitFor = wait;
    this.go('hidden');
  }

  /** The swell's foam on it now (0..1): only at the waterline. */
  wash(t: number): number {
    if (this.state === 'hidden' || this.v < 0.7) return 0;
    const s = Math.sin((t * TAU) / ROCK_CRAB_TUNING.swell + this.salt);
    return Math.max(0, s) ** 6 * clamp((this.v - 0.7) / 0.3, 0, 1);
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sf = w.speed;
    this.timer += dt;
    this.onRock += dt;
    if (this.leaving && this.state === 'hidden') {
      this.done = true;
      return;
    }
    const here = rockPoint(this.rock, this.u, this.v);
    const big = bigNear(here, w.creatures, this);
    const out = this.state !== 'hidden' && this.state !== 'dart';
    if (big && out && this.state !== 'freeze') {
      this.frights++;
      this.waitFor = rangeOf(this.rng, [...ROCK_CRAB_TUNING.freeze]) / sf;
      this.go('freeze');
    }
    this.flat = approach(this.flat, this.state === 'freeze' || this.state === 'dart' ? 1 : 0, 6, dt);
    const T = ROCK_CRAB_TUNING;
    switch (this.state) {
      case 'hidden':
        this.alpha = approach(this.alpha, 0, 4, dt);
        if (this.timer < this.waitFor || big) break;
        if (this.onRock > this.stayPut / sf) this.moveRock(w);
        this.alpha = 0.01;
        this.startRun(true);
        break;
      case 'freeze':
        if (this.timer >= this.waitFor) {
          // round the back of the rock: off its nearer end
          this.toU = this.u < 0.5 ? 0 : 1;
          this.toV = this.v;
          this.go('dart');
        }
        break;
      case 'dart':
        if (this.walk(dt, T.dart * sf)) this.hideAt(this.u, rangeOf(this.rng, [...T.hidden]) / sf);
        break;
      case 'run':
        if (this.walk(dt, T.speed * sf)) this.pause(w);
        break;
      case 'stop':
      case 'feed':
        if (this.timer >= this.waitFor) {
          if (this.leaving || this.onRock > this.stayPut / sf) {
            this.toU = this.u < 0.5 ? 0 : 1;
            this.go('dart');
          } else this.startRun(false);
        }
        break;
    }
    if (this.state !== 'hidden') this.alpha = approach(this.alpha, 1, 3, dt);
    const wash = this.wash(w.t);
    if (wash > 0.5 && this.lastWash <= 0.5) this.swells++;
    this.lastWash = wash;
    this.sync(w);
  }

  private pause(w: FaunaWorld): void {
    const T = ROCK_CRAB_TUNING;
    if (this.rng.chance(T.feedChance)) {
      this.feeds++;
      this.waitFor = rangeOf(this.rng, [...T.feed]) / w.speed;
      this.go('feed');
    } else {
      this.waitFor = rangeOf(this.rng, [...T.stop]) / w.speed;
      this.go('stop');
    }
  }

  /** A quick sideways run along the rock, sometimes climbing between the lip and the waterline. */
  private startRun(emerging: boolean): void {
    const T = ROCK_CRAB_TUNING;
    const len = Math.max(1, dist(this.rock.wet[0]!, this.rock.wet[this.rock.wet.length - 1]!));
    const d = rangeOf(this.rng, [...T.run]) / len;
    const dir = emerging ? (this.u < 0.5 ? 1 : -1) : this.u < 0.12 ? 1 : this.u > 0.88 ? -1 : this.rng.chance(0.5) ? 1 : -1;
    this.toU = clamp(this.u + dir * d * (emerging ? 1.5 : 1), 0.04, 0.96);
    const dry = this.rock.dryU;
    let toV = this.v < 0.5 ? 0 : 1;
    if (dry && this.rng.chance(T.climb)) toV = 1 - toV;
    if (toV === 0) {
      if (dry) this.toU = clamp(this.toU, dry[0], dry[1]);
      else toV = 1;
    }
    this.toV = toV;
    this.runs++;
    this.go('run');
  }

  /** Step toward (toU, toV); true on arrival. */
  private walk(dt: number, speed: number): boolean {
    const a = rockPoint(this.rock, this.u, this.v);
    const b = rockPoint(this.rock, this.toU, this.toV);
    const left = dist(a, b);
    const step = speed * this.scale * dt;
    this.stride += Math.min(step, left);
    if (left <= step || left < 1e-6) {
      this.u = this.toU;
      this.v = this.toV;
      return true;
    }
    const f = step / left;
    this.u = lerp(this.u, this.toU, f);
    this.v = lerp(this.v, this.toV, f);
    return false;
  }

  private moveRock(w: FaunaWorld): void {
    const taken = w.creatures.filter((c): c is RockCrab => c instanceof RockCrab && c !== this && !c.done).map((c) => c.rock);
    const next = chooseRock(crabRocks(w), w.view, this.rng, taken, this.rock);
    if (next) this.rock = next;
    this.onRock = 0;
    this.stayPut = rangeOf(this.rng, [...ROCK_CRAB_TUNING.stayPut]);
    this.u = this.u < 0.5 ? 0 : 1;
    this.v = this.rock.dryU && this.rng.chance(0.3) ? 0 : 1;
    if (this.v === 0 && this.rock.dryU) this.u = this.u === 0 ? this.rock.dryU[0] : this.rock.dryU[1];
  }

  private sync(w: FaunaWorld): void {
    const q = rockPoint(this.rock, this.u, this.v);
    this.x = q.x;
    this.y = q.y;
    this.scale = w.perspective(q.y, q.x);
  }

  override leave(_w?: FaunaWorld): void {
    this.leaving = true;
  }

  override depth(): number | null {
    return this.rock.depth;
  }

  /** Its pose now (studio, tests). */
  pose(t: number): RockCrabPose {
    const wash = this.wash(t);
    const moving = this.state === 'run' || this.state === 'dart';
    const gait = moving ? ((1 + (Math.floor(this.stride / ROCK_CRAB_TUNING.stride) % 2)) as 1 | 2) : 0;
    const base = this.state === 'feed' ? feedPose(this.timer) : CRAB_REST;
    return { ...base, gait, flat: this.flat, wash };
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities' || this.alpha <= 0.01) return;
    const parts = w.art.get('rock-crab', (res) => paintRockCrab(res, 6120));
    const q = this.pose(w.t);
    ctx.save();
    ctx.globalAlpha *= this.alpha;
    // half in the water while the swell is up
    ctx.translate(this.x, this.y + q.wash * 0.8);
    ctx.scale(this.scale, this.scale);
    drawRockCrab(ctx, parts, q);
    ctx.restore();
  }
}

const rockCrab: CreatureDef = {
  kind: 'rock-crab',
  title: 'marbled rock crab',
  role: 'resident',
  rank: 6,
  // one on the splash rocks by day, a second comes out after dark
  resident: (n, mode) => (n > 0 ? (mode.night && !mode.reduced ? 2 : 1) : 0),
  needs: (w) => crabRocks(w).length > 0,
  spawn(w, s) {
    const rocks = crabRocks(w);
    if (rocks.length === 0) return [];
    const taken = w.creatures.filter((c): c is RockCrab => c instanceof RockCrab && !c.done).map((c) => c.rock);
    const out: RockCrab[] = [];
    for (let i = 0; i < Math.max(1, s.count); i++) {
      const rng = w.rng.fork(`rock-crab:${s.seed}:${w.t.toFixed(3)}:${s.index + i}:${w.creatures.length}`);
      const rock = chooseRock(rocks, w.view, rng, taken);
      if (!rock) break;
      out.push(new RockCrab(w, rock, rng));
      taken.push(rock);
    }
    return out;
  },
  sheet: {
    w: 560,
    h: 130,
    make(res, seed) {
      const parts = paintRockCrab(res, seed);
      const box = { w: 26 * k, h: 14 * k, ox: 13 * k, oy: 6 * k };
      const pose = (q: RockCrabPose) => paintSprite(res, box, seed + 11, (pt) => drawRockCrab(pt.ctx, parts, q));
      return [pose(CRAB_REST), pose({ ...CRAB_REST, gait: 1 }), pose(feedPose(0.11)), pose({ ...CRAB_REST, flat: 1 }), pose({ ...CRAB_REST, wash: 1 }), parts.body, parts.legs[1], parts.claw];
    },
  },
  show: { stage: 'coast', spec: { x: 340, y: 680, w: 90, h: 60 }, w: 540, h: 360, order: 346 },
};
export default rockCrab;
