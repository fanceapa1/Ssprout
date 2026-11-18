/**
 * Balkan green lizard (Lacerta trilineata): the coast's wall lizard. Large, grass green, finely
 * speckled, with a yellowish throat and a whip tail twice its body. It basks flat on the terrace
 * walls' faces and copings by day, looks round, runs in straight dashes with stops, and slips head
 * first into a gap between the stones from the cat or a big bird. docs/devlog/207-green-lizard.md
 */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { wallTopAt, type WallFace } from '../targets';
import { clamp, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Snout to tail tip at perspective 1 (world units). */
export const GREEN_LIZARD_SIZE = 30;

export const GREEN_LIZARD_TUNING = {
  /** a basking spell (s), and the chance it lifts its head and looks round after one */
  bask: [6, 18] as const,
  look: [1.5, 3.5] as const,
  lookChance: 0.55,
  /** a dash: how far (units), how fast (units/s at perspective 1), and the stop after it (s) */
  dash: [6, 16] as const,
  speed: 80,
  stop: [0.25, 1.1] as const,
  /** how far either side of its home spot it ranges along the wall (units) */
  range: 34,
  /** in its gap (s), then peering out (s) before it comes out again */
  hidden: [7, 16] as const,
  peer: [1.5, 4] as const,
  first: [0.5, 2.5] as const,
  /** slipping into the gap (s) */
  slip: 0.45,
  /** body lengths of travel per stride (the S swings once each way) */
  stride: 0.35,
  /** how near each kind may come before it runs for its gap (world units) */
  threats: { cat: 100, gull: 90, heron: 160, 'rock-thrush': 45, hoopoe: 55, goat: 70 } as Record<string, number>,
};

// ---------------------------------------------------------------------------------------------
// art: from above (its back against the wall face), head toward +x, the vent at the origin

const k = GREEN_LIZARD_SIZE / 30;
const P = (x: number, y: number): Pt => ({ x: x * k, y: y * k });

const COL = {
  green: '#5fae3a',
  bright: '#8cc83e',
  deep: '#2f6a2a',
  speck: mix(PIGMENTS.sumi, '#1f3a1c', 0.5),
  throat: '#e3cf52',
  belly: '#c9cf63',
  tail: '#6d9a44',
  tailTip: '#8a8a5a',
  claw: mix(PIGMENTS.sumi, '#3a3a2a', 0.4),
  eye: mix(PIGMENTS.sumi, '#20180c', 0.6),
};

/** Shoulder and hip along the spine (x), the neck where the head sprite joins. */
const SHOULDER = 6.5;
const HIP = -0.5;
const NECK = 8.6;
const TAIL_TIP = -20;

/** The spine's sideways swing at x for a bend `b` (-1..1): an S through the trunk, carried down the tail. */
function swing(x: number, b: number): number {
  return b * 1.6 * Math.sin(((x - NECK) / (NECK - TAIL_TIP)) * TAU * 0.9);
}

/** Half width of the body at x along the spine. */
function halfWidth(x: number): number {
  if (x > SHOULDER) return lerpW(x, SHOULDER, NECK, 1.55, 1.15);
  if (x > HIP) return 1.55 + Math.sin(((x - HIP) / (SHOULDER - HIP)) * Math.PI) * 0.35;
  if (x > -2.5) return lerpW(x, -2.5, HIP, 1.15, 1.45);
  return lerpW(x, TAIL_TIP, -2.5, 0.08, 1.15) ** 1.15;
}
const lerpW = (x: number, x0: number, x1: number, w0: number, w1: number) => w0 + ((w1 - w0) * (x - x0)) / (x1 - x0);

function bodyOutline(b: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let x = NECK; x >= TAIL_TIP - 1e-6; x -= 0.7) {
    const y = swing(x, b);
    const dy = (swing(x + 0.1, b) - y) / 0.1;
    const n = 1 / Math.hypot(1, dy);
    const w = halfWidth(x);
    left.push(P(x + dy * n * w, y - w * n));
    right.push(P(x - dy * n * w, y + w * n));
  }
  return smoothPolygon([...left, ...right.reverse()], 1);
}

/** One leg: from the joint on the spine, out sideways, the foot turned forward or back, toes spread. */
function paintLeg(p: Painter, rng: Rng, at: Pt, side: number, fore: boolean, reach: number): void {
  const out = fore ? 1 : 1.15;
  const knee = { x: at.x + (fore ? 0.6 : -0.4) * k + reach * 0.9 * k, y: at.y + side * 2.6 * out * k };
  const foot = { x: knee.x + (fore ? 1.6 : -1.2) * k + reach * 1.4 * k, y: knee.y + side * 0.9 * k };
  const leg = (a: Pt, c: Pt, w: number, pig: string) =>
    p.dab(a, pig, { rng, variant: 'leaf', angle: Math.atan2(c.y - a.y, c.x - a.x), length: Math.hypot(c.x - a.x, c.y - a.y) * 1.1, width: w, opacity: 0.95, pool: 0.4, basePool: 0.2 });
  leg({ x: at.x, y: at.y }, knee, 1.25 * k, COL.green);
  leg(knee, foot, 0.85 * k, mix(COL.green, COL.deep, 0.3));
  // the toes: four or five fine splayed strokes
  const dir = Math.atan2(foot.y - knee.y, foot.x - knee.x);
  for (let i = 0; i < 5; i++) {
    const a = dir + (i - 2) * 0.42 * (fore ? 1 : 1.1);
    const l = (i === 3 ? 1.6 : 1.15) * k;
    p.inkLine([foot, { x: foot.x + Math.cos(a) * l, y: foot.y + Math.sin(a) * l }], { rng, width: 0.22 * k, opacity: 0.85, breaks: 0, wobble: 0.05, taper: [0, 0.6], pigment: COL.claw });
  }
}

function paintBody(p: Painter, bend: number, gait: number): void {
  const rng = p.rng;
  const y = (x: number) => swing(x, bend) * k;
  // legs first, under the body: in the S the legs on the bend's outside reach, the inside trail
  for (const side of [-1, 1]) {
    const r = gait === 0 ? 0 : side * gait;
    paintLeg(p, rng, { x: SHOULDER * k, y: y(SHOULDER) }, side, true, r);
    paintLeg(p, rng, { x: HIP * k, y: y(HIP) }, side, false, -r);
  }
  const body = bodyOutline(bend);
  p.wetInWet(body, COL.bright, COL.deep, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.55, fingers: 0.35, opacity: 0.97, edge: 0.55, edgeWidth: 0.35 * k, deform: 0.03, granulation: 0.3, blend: 'source-over' });
  // the tail's back half dulls toward the tip
  const tail: Pt[] = [];
  for (let x = -9; x >= TAIL_TIP; x -= 1) tail.push({ x: x * k, y: y(x) });
  p.inkLine(tail, { rng, width: 1.3 * k, opacity: 0.35, breaks: 0, wobble: 0.05, taper: [0.2, 1], pigment: COL.tailTip });
  // the spine's darker line and the fine dark speckling over the back
  const spine: Pt[] = [];
  for (let x = NECK - 0.5; x >= -6; x -= 1) spine.push({ x: x * k, y: y(x) });
  p.inkLine(spine, { rng, width: 0.5 * k, opacity: 0.3, breaks: 0.3, wobble: 0.1, pigment: COL.deep });
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-6, NECK - 0.3);
    const w = halfWidth(x) * 0.85;
    p.dab({ x: x * k, y: y(x) + rng.range(-w, w) * k }, COL.speck, { rng, variant: 'round', angle: 0, length: rng.range(0.18, 0.34) * k, width: rng.range(0.16, 0.3) * k, opacity: rng.range(0.5, 0.85) });
  }
  // a sunlit gloss along the back
  p.dab(P(2.5, swing(2.5, bend) - 0.5), PIGMENTS.petalWhite, { rng, variant: 'leaf', angle: 0, length: 5 * k, width: 0.6 * k, opacity: 0.28, blend: 'source-over' });
}

/** The head, the neck at the origin, snout at +x; `up` shows the yellow throat of a lifted head. */
function paintHead(p: Painter, up: boolean): void {
  const rng = p.rng;
  if (up) p.wash(smoothPolygon([P(-0.4, -1.3), P(1.6, -1.6), P(3.4, -0.9), P(3.6, 0.9), P(1.6, 1.6), P(-0.4, 1.3)], 2), COL.throat, { rng, opacity: 0.9, edge: 0.3, edgeWidth: 0.3 * k, deform: 0.05, blend: 'source-over' });
  const head = smoothPolygon([P(-0.6, -1.15), P(1.4, -1.25), P(2.9, -0.8), P(3.9, -0.3), P(4.1, 0), P(3.9, 0.3), P(2.9, 0.8), P(1.4, 1.25), P(-0.6, 1.15)], 2);
  p.wetInWet(head, COL.bright, COL.deep, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.5, fingers: 0.3, opacity: 0.98, edge: 0.6, edgeWidth: 0.3 * k, deform: 0.03, blend: 'source-over' });
  // the large head scales, a hint of jaw, the eyes
  p.inkLine([P(0.6, 0), P(2.8, 0)], { rng, width: 0.2 * k, opacity: 0.3, breaks: 0.4, wobble: 0.05, pigment: COL.deep });
  for (const s of [-1, 1]) {
    p.dab(P(2.1, s * 0.9), COL.eye, { rng, variant: 'round', angle: 0, length: 0.62 * k, width: 0.5 * k, opacity: 0.95, layers: 2 });
    p.dab(P(2.2, s * 0.82), PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.18 * k, width: 0.15 * k, opacity: 0.7, blend: 'source-over' });
  }
}

export interface GreenLizardParts {
  shadow: Sprite;
  /** flat and straight, S one way, S the other way: the body, legs and tail, anchored at the vent */
  body: [Sprite, Sprite, Sprite];
  /** the head flat, and lifted with the throat showing, anchored at the neck */
  head: [Sprite, Sprite];
}

export function paintGreenLizard(res: number, seed: number): GreenLizardParts {
  const box = { w: 34 * k, h: 12 * k, ox: 23 * k, oy: 6 * k };
  const headBox = { w: 6 * k, h: 4.4 * k, ox: 1.2 * k, oy: 2.2 * k };
  return {
    shadow: paintSprite(res, { w: 34 * k, h: 8 * k, ox: 22 * k, oy: 4 * k }, seed + 8, (p, rng) => {
      p.glaze(blob(-2 * k, 0, 13 * k, 2.4 * k, rng, { irregularity: 0.1 }), mix(PIGMENTS.shadow, PIGMENTS.sumi, 0.3), { rng, opacity: 0.3, edge: 0, sharpness: 0.1, deform: 0.1 });
    }),
    body: [
      paintSprite(res, box, seed, (p) => paintBody(p, 0, 0)),
      paintSprite(res, box, seed + 1, (p) => paintBody(p, 1, 1)),
      paintSprite(res, box, seed + 2, (p) => paintBody(p, -1, -1)),
    ],
    head: [paintSprite(res, headBox, seed + 4, (p) => paintHead(p, false)), paintSprite(res, headBox, seed + 5, (p) => paintHead(p, true))],
  };
}

export interface GreenLizardPose {
  /** 0 flat, 1 or 2 the S one way or the other */
  frame: 0 | 1 | 2;
  /** head turn (radians, + toward +y) and lift (0..1) */
  turn: number;
  lift: number;
  /** a gap between the stones at local x `at`: only the part in `keep` of it shows */
  gap: { at: number; keep: 'front' | 'back' } | null;
}

export const LIZARD_REST: GreenLizardPose = { frame: 0, turn: 0, lift: 0, gap: null };

/** Snout and tail tip along the body (world units at perspective 1). */
export const SNOUT_X = (NECK + 4.2) * k;
export const TAIL_X = TAIL_TIP * k;

/** Looking round with the head lifted, at time t. */
export function lookPose(t: number): GreenLizardPose {
  return { ...LIZARD_REST, lift: 1, turn: 0.5 * Math.sin(t * 2.1) + 0.15 * Math.sin(t * 5.3) };
}

/** The lizard at the origin (the vent on the stone), head toward +x: three `drawImage`s. */
export function drawGreenLizard(ctx: Ctx, parts: GreenLizardParts, q: GreenLizardPose): void {
  const clip = q.gap;
  if (clip) {
    ctx.save();
    ctx.beginPath();
    if (clip.keep === 'back') ctx.rect(-40 * k, -10 * k, clip.at + 40 * k, 20 * k);
    else ctx.rect(clip.at, -10 * k, 40 * k - clip.at, 20 * k);
    ctx.clip();
  }
  const sh = parts.shadow;
  ctx.drawImage(sh.img as CanvasImageSource, -sh.ox, -sh.oy + 0.8 * k * (1 + q.lift * 0.4), sh.w, sh.h);
  const b = parts.body[q.frame];
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  const h = parts.head[q.lift > 0.5 ? 1 : 0];
  ctx.save();
  ctx.translate(NECK * k - 0.6 * k, swing(NECK, q.frame === 1 ? 1 : q.frame === 2 ? -1 : 0) * k - q.lift * 0.5 * k);
  ctx.rotate(q.turn);
  const s = 1 + q.lift * 0.08;
  ctx.scale(s, s);
  ctx.drawImage(h.img as CanvasImageSource, -h.ox, -h.oy, h.w, h.h);
  ctx.restore();
  if (clip) ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// where it lives (pure)

/** A stretch of terrace wall it holds: its face, home x, and the gap it hides in at each end. */
export interface LizardHome {
  id: string;
  face: WallFace;
  x: number;
  lo: number;
  hi: number;
}

/** A point on a home's wall: `x`, and `v` down the face from the coping (−0.15 on the coping's top, 1 the foot). */
export function wallPoint(h: LizardHome, x: number, v: number): Pt {
  return { x, y: wallTopAt(h.face, x) + v * h.face.h };
}

const homeCache = new WeakMap<object, LizardHome[]>();
/** The coast's dry-stone terrace walls (ADR 0373). */
const TERRACE_WALL = /^wall-(top|middle|lower)$/;

/** Its homes: the terrace walls' coping perches (clear of the flights and the slots), with the face below. */
export function lizardHomes(w: Pick<FaunaWorld, 'walls' | 'perches'>): LizardHome[] {
  let out = homeCache.get(w.walls);
  if (out) return out;
  out = [];
  const R = GREEN_LIZARD_TUNING.range;
  // only where all three terraces' walls stand (the oasis has a `wall-middle` too)
  const terraced = w.walls.filter((f) => TERRACE_WALL.test(f.id)).length === 3;
  if (!terraced) {
    homeCache.set(w.walls, out);
    return out;
  }
  for (const p of w.perches) {
    if (p.kind !== 'wall') continue;
    const face = w.walls.find((f) => TERRACE_WALL.test(f.id) && p.id.startsWith(`${f.id}-`));
    if (!face) continue;
    const x0 = face.top[0]!.x + 4;
    const x1 = face.top[face.top.length - 1]!.x - 4;
    out.push({ id: p.id, face, x: p.x, lo: clamp(p.x - R, x0, x1), hi: clamp(p.x + R, x0, x1) });
  }
  homeCache.set(w.walls, out);
  return out;
}

const inView = (q: Pt, v: Rect, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

/** A home for it, in view when it can, not `not`. */
export function chooseHome(homes: readonly LizardHome[], view: Rect, rng: Rng, not: LizardHome | null = null): LizardHome | null {
  const pool = homes.filter((h) => h !== not);
  if (pool.length === 0) return homes[0] ?? null;
  const seen = pool.filter((h) => inView(wallPoint(h, h.x, 0.4), view, 20));
  return rng.pick(seen.length > 0 ? seen : pool);
}

/** The kind of the nearest creature close enough to send it into its gap, or null. */
export function threatNear(at: Pt, creatures: readonly { kind: string; x: number; y: number; done: boolean }[], self?: object): string | null {
  for (const c of creatures) {
    if (c === self || c.done) continue;
    const reach = GREEN_LIZARD_TUNING.threats[c.kind];
    if (reach && Math.hypot(c.x - at.x, c.y - at.y) < reach) return c.kind;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

export type GreenLizardMode = 'hidden' | 'peer' | 'bask' | 'look' | 'dash' | 'stop' | 'flee' | 'slip';

export class GreenLizard extends BaseCreature {
  readonly kind = 'green-lizard' as const;
  readonly visitor = false;
  override layer: LayerId = 'entities';
  home: LizardHome;
  /** x is the vent on the wall, v down its face; it heads +1 / −1 */
  v = 0.4;
  dir: 1 | -1 = 1;
  /** for tests: basks, looks, dash legs, stops, frights, peeks out */
  basks = 0;
  looks = 0;
  dashes = 0;
  stops = 0;
  frights = 0;
  peeks = 0;
  /** the gap it is going into ('back' shows) or coming out of ('front' shows), at world x `gap` */
  gapKeep: 'front' | 'back' | null = null;
  gap = 0;
  private toX = 0;
  private toV = 0.4;
  private goalX = 0;
  private goalV = 0.4;
  private waitFor = 0;
  private stride = 0;
  private scale = 1;

  constructor(
    w: FaunaWorld,
    home: LizardHome,
    readonly rng: Rng,
  ) {
    super();
    this.home = home;
    this.hideIn(rng.chance(0.5) ? home.lo : home.hi, rangeOf(rng, [...GREEN_LIZARD_TUNING.first]));
    this.sync(w);
  }

  doing(): GreenLizardMode {
    return this.state as GreenLizardMode;
  }

  private hideIn(gapX: number, wait: number): void {
    this.gap = gapX;
    this.x = gapX;
    this.v = 0.45;
    this.gapKeep = null;
    this.alpha = 0;
    this.waitFor = wait;
    this.go('hidden');
  }

  /** The gap in its own frame (world units at perspective 1 along its heading). */
  gapAt(): number {
    return ((this.gap - this.x) * this.dir) / this.scale;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const T = GREEN_LIZARD_TUNING;
    const sf = w.speed;
    this.timer += dt;
    if (w.mode.night && !this.leaving) this.leave(w);
    if (this.leaving && this.state === 'hidden') {
      this.done = true;
      return;
    }
    const big = threatNear({ x: this.x, y: this.y }, w.creatures, this);
    const exposed = this.state !== 'hidden' && this.state !== 'slip' && this.state !== 'flee';
    if (exposed && (big || this.leaving)) {
      if (big) this.frights++;
      if (this.state === 'peer') this.hideIn(this.gap, rangeOf(this.rng, [...T.hidden]) / sf);
      else this.flee();
    }
    switch (this.state) {
      case 'hidden':
        if (this.timer < this.waitFor || big || this.leaving) break;
        this.peeks++;
        // turned round inside: the head out of the gap, facing along the wall
        this.dir = this.gap <= (this.home.lo + this.home.hi) / 2 ? 1 : -1;
        this.x = this.gap - this.dir * (SNOUT_X - 0.3 * (SNOUT_X - TAIL_X)) * this.scale;
        this.gapKeep = 'front';
        this.alpha = 1;
        this.waitFor = rangeOf(this.rng, [...T.peer]) / sf;
        this.go('peer');
        break;
      case 'peer':
        if (this.timer >= this.waitFor) this.runFor(this.rng.range(this.home.lo + 6, this.home.hi - 6), this.rng.range(-0.15, 0.75));
        break;
      case 'dash':
      case 'flee':
      case 'slip':
        if (this.gapKeep === 'front' && this.gapAt() < TAIL_X) this.gapKeep = null;
        if (this.walk(dt, T.speed * sf * (this.state === 'dash' ? 1 : this.state === 'flee' ? 1.4 : 0.7))) this.arrive(sf);
        break;
      case 'stop':
        if (this.timer >= this.waitFor) this.nextLeg();
        break;
      case 'bask':
        if (this.timer < this.waitFor) break;
        if (this.rng.chance(T.lookChance)) {
          this.looks++;
          this.waitFor = rangeOf(this.rng, [...T.look]) / sf;
          this.go('look');
        } else this.runFor(this.rng.range(this.home.lo + 4, this.home.hi - 4), this.rng.range(-0.15, 0.75));
        break;
      case 'look':
        if (this.timer >= this.waitFor) {
          this.basks++;
          this.waitFor = rangeOf(this.rng, [...T.bask]) / sf;
          this.go('bask');
        }
        break;
    }
    this.sync(w);
  }

  private arrive(sf: number): void {
    const T = GREEN_LIZARD_TUNING;
    if (this.state === 'flee') {
      // head first into the gap: on along the wall until the tail is in
      this.gapKeep = 'back';
      this.toX = this.gap - this.dir * TAIL_X * this.scale + this.dir;
      this.toV = this.v;
      this.go('slip');
    } else if (this.state === 'slip') {
      this.hideIn(this.gap, rangeOf(this.rng, [...T.hidden]) / sf);
    } else if (Math.abs(this.x - this.goalX) < 0.01 && Math.abs(this.v - this.goalV) < 1e-6) {
      this.basks++;
      this.waitFor = rangeOf(this.rng, [...T.bask]) / sf;
      this.go('bask');
    } else {
      this.stops++;
      this.waitFor = rangeOf(this.rng, [...T.stop]) / sf;
      this.go('stop');
    }
  }

  /** To the nearer end of its stretch, the snout at the gap, in one dash. */
  private flee(): void {
    const toLo = this.x - this.home.lo < this.home.hi - this.x;
    this.gap = toLo ? this.home.lo : this.home.hi;
    this.dir = toLo ? -1 : 1;
    this.gapKeep = null;
    this.goalX = this.gap - this.dir * SNOUT_X * this.scale;
    this.goalV = clamp(this.v, 0.2, 0.6);
    this.toX = this.goalX;
    this.toV = this.goalV;
    this.dashes++;
    this.go('flee');
  }

  /** Make for (x, v) in straight dashes with stops. */
  private runFor(x: number, v: number): void {
    this.goalX = clamp(x, this.home.lo, this.home.hi);
    this.goalV = clamp(v, -0.15, 0.75);
    this.nextLeg();
  }

  private nextLeg(): void {
    const d = this.goalX - this.x;
    const len = rangeOf(this.rng, [...GREEN_LIZARD_TUNING.dash]);
    const f = Math.abs(d) <= len ? 1 : len / Math.abs(d);
    // it cannot turn round while still half in the gap: straight out first
    if (this.gapKeep === 'front' && Math.sign(d) !== this.dir) {
      this.toX = this.x + this.dir * len;
      this.toV = this.v;
    } else {
      this.toX = this.x + d * f;
      this.toV = this.v + (this.goalV - this.v) * f;
      if (Math.abs(d) > 0.5) this.dir = d > 0 ? 1 : -1;
    }
    this.dashes++;
    this.go('dash');
  }

  /** Step toward (toX, toV); true on arrival. */
  private walk(dt: number, speed: number): boolean {
    const dx = this.toX - this.x;
    const dy = (this.toV - this.v) * this.home.face.h;
    const left = Math.hypot(dx, dy);
    const step = speed * this.scale * dt;
    this.stride += Math.min(step, left);
    if (left <= step || left < 1e-6) {
      this.x = this.toX;
      this.v = this.toV;
      return true;
    }
    this.x += (dx * step) / left;
    this.v += ((this.toV - this.v) * step) / left;
    return false;
  }

  private sync(w: FaunaWorld): void {
    const q = wallPoint(this.home, this.x, this.v);
    this.y = q.y;
    this.scale = w.perspective(q.y, q.x);
  }

  override leave(_w?: FaunaWorld): void {
    this.leaving = true;
  }

  override depth(): number | null {
    return wallTopAt(this.home.face, this.x) + this.home.face.h + 1;
  }

  /** Its pose now (studio, tests). */
  pose(): GreenLizardPose {
    const moving = this.state === 'dash' || this.state === 'flee' || this.state === 'slip';
    const frame = moving ? ((1 + (Math.floor(this.stride / (GREEN_LIZARD_TUNING.stride * GREEN_LIZARD_SIZE * this.scale)) % 2)) as 1 | 2) : 0;
    const base = this.state === 'look' ? lookPose(this.timer) : this.state === 'peer' ? { ...LIZARD_REST, turn: 0.3 * Math.sin(this.timer * 1.7) } : LIZARD_REST;
    return { ...base, frame, gap: this.gapKeep ? { at: this.gapAt(), keep: this.gapKeep } : null };
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities' || this.state === 'hidden' || this.alpha <= 0.01) return;
    const parts = w.art.get('green-lizard', (res) => paintGreenLizard(res, 7310));
    ctx.save();
    ctx.globalAlpha *= this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * this.dir, this.scale);
    drawGreenLizard(ctx, parts, this.pose());
    ctx.restore();
  }
}

const greenLizard: CreatureDef = {
  kind: 'green-lizard',
  title: 'Balkan green lizard',
  role: 'resident',
  rank: 5,
  // one on the walls, by day only
  resident: (n, mode) => (n > 0 && !mode.night ? 1 : 0),
  needs: (w) => lizardHomes(w).length > 0,
  spawn(w, s) {
    const homes = lizardHomes(w);
    if (homes.length === 0) return [];
    const rng = w.rng.fork(`green-lizard:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const home = chooseHome(homes, w.view, rng);
    return home ? [new GreenLizard(w, home, rng)] : [];
  },
  sheet: {
    w: 620,
    h: 120,
    make(res, seed) {
      const parts = paintGreenLizard(res, seed);
      const box = { w: 36 * k, h: 14 * k, ox: 24 * k, oy: 7 * k };
      const pose = (q: GreenLizardPose) => paintSprite(res, box, seed + 11, (pt) => drawGreenLizard(pt.ctx, parts, q));
      return [pose(LIZARD_REST), pose(lookPose(0.7)), pose({ ...LIZARD_REST, frame: 1 }), pose({ ...LIZARD_REST, frame: 2 }), pose({ ...LIZARD_REST, gap: { at: 2 * k, keep: 'back' } }), parts.head[1]];
    },
  },
  show: { stage: 'coast', spec: { x: 1090, y: 545, w: 110, h: 70 }, w: 540, h: 340, order: 347 },
};
export default greenLizard;
