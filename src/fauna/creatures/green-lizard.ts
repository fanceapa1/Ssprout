/**
 * Balkan green lizard (Lacerta trilineata): the coast's wall lizard. Large, grass green, finely
 * speckled, with a yellowish throat and a whip tail twice its body. It basks flat on the terrace
 * walls' faces and copings by day, looks round, runs in straight dashes with stops, and slips head
 * first into a gap between the stones from the cat or a big bird. docs/devlog/207-green-lizard.md
 */
import type { Rng } from '../../core/rng';
import { mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
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
  /** the flanks and belly edge, the grass-green back, its shaded side, the head's darker green */
  flank: mix('#b9c26a', '#c8c08a', 0.3),
  green: mix('#6f9f3c', '#8b9c5a', 0.3),
  deep: '#3f6a2a',
  head: mix('#5c8a36', '#5e6a34', 0.3),
  /** the whip tail goes olive-brown toward its tip */
  tail: '#8a7d4c',
  speck: mix(PIGMENTS.sumi, '#24321c', 0.4),
  fleck: '#e6d77a',
  throat: '#e6cf5a',
  toe: mix('#6f7a3e', '#7a6a44', 0.4),
  eye: mix(PIGMENTS.sumi, '#3a2414', 0.5),
  shade: mix(PIGMENTS.shadow, PIGMENTS.sumi, 0.25),
};

/** Shoulder and hip along the spine (x), the neck where the head sprite joins. */
const SHOULDER = 6.5;
const HIP = -0.5;
const NECK = 8.6;
const TAIL_TIP = -24;

/** The spine's sideways swing at x for a bend `b` (-1..1): an S through the trunk, carried down the tail. */
function swing(x: number, b: number): number {
  return b * 1.6 * Math.sin(((x - NECK) / (NECK - TAIL_TIP)) * TAU * 0.9);
}

/** Half width of the body at x along the spine. */
function halfWidth(x: number): number {
  if (x > SHOULDER) return lerpW(x, SHOULDER, NECK, 1.55, 1.2);
  if (x > HIP) return 1.55 + Math.sin(((x - HIP) / (SHOULDER - HIP)) * Math.PI) * 0.3;
  if (x > -3) return lerpW(x, -3, HIP, 1.25, 1.45);
  // the tail: thick at the root, then an even taper to a fine point
  return 0.05 + 1.2 * ((x - TAIL_TIP) / (-3 - TAIL_TIP)) ** 1.5;
}
const lerpW = (x: number, x0: number, x1: number, w0: number, w1: number) => w0 + ((w1 - w0) * (x - x0)) / (x1 - x0);

/** The body's outline between `x1` and `x0` (snout side first), `share` of its half width, offset by (dx, dy). */
function bodyOutline(b: number, share = 1, x1 = NECK, x0 = TAIL_TIP, dx = 0, dy = 0): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let x = x1; x >= x0 - 1e-6; x -= 0.6) {
    const y = swing(x, b);
    const d = (swing(x + 0.1, b) - y) / 0.1;
    const n = 1 / Math.hypot(1, d);
    const w = halfWidth(x) * share;
    left.push(P(x + d * n * w + dx, y - w * n + dy));
    right.push(P(x - d * n * w + dx, y + w * n + dy));
  }
  return smoothPolygon([...left, ...right.reverse()], 1);
}

/** A leg's joints: hip or shoulder, knee or elbow, the foot, and the direction the toes point. */
function legJoints(at: Pt, side: number, fore: boolean, reach: number): { knee: Pt; foot: Pt; dir: number } {
  // fore: the upper arm out and a little back, the forearm and hand forward; hind: the thigh out and forward, the shank and foot back
  const knee = { x: at.x + ((fore ? -0.35 : 0.55) + reach * 0.6) * k, y: at.y + side * (fore ? 1.9 : 2.3) * k };
  const foot = { x: knee.x + ((fore ? 1.15 : -1.35) + reach * 1.1) * k, y: knee.y + side * (fore ? 0.95 : 0.7) * k };
  return { knee, foot, dir: Math.atan2(foot.y - knee.y, foot.x - knee.x) };
}

/** One leg from its joint on the spine: splayed out, the foot turned forward (fore) or back (hind),
 * five long thin toes, the hind fourth the longest; `shadow` paints its soft cast shadow instead. */
function paintLeg(p: Painter, rng: Rng, at: Pt, side: number, fore: boolean, reach: number, shadow = false): void {
  const { knee, foot, dir } = legJoints(at, side, fore, reach);
  const off = shadow ? { x: 0.25 * k, y: 0.75 * k } : { x: 0, y: 0 };
  const o = (q: Pt): Pt => ({ x: q.x + off.x, y: q.y + off.y });
  // the limb in one stroke, thick at the joint, through the knee to the foot
  const path: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const [a, b, t] = i <= 4 ? [at, knee, i / 4] : [knee, foot, (i - 4) / 4];
    path.push(o({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  }
  p.stroke(path, { rng, width: (fore ? 1.05 : 1.25) * k, opacity: shadow ? 0.2 : 0.97, wobble: 0.03, wetness: 0.2, taper: [0, 0.15], pressure: [1, 0.8, 0.62, 0.55, 0.55], edge: 0.25, edgeWidth: 0.2 * k, centreLift: 0, pigment: shadow ? COL.shade : mix(COL.green, COL.deep, 0.25) });
  if (shadow) return;
  // a fleck or two on the limb, the small palm the toes spread from
  for (let i = 0; i < 3; i++) {
    const t = rng.range(0.15, 0.7);
    const [a, b, f] = t < 0.5 ? [at, knee, t * 2] : [knee, foot, (t - 0.5) * 2];
    p.dab({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, COL.speck, { rng, variant: 'round', angle: 0, length: 0.14 * k, width: 0.12 * k, opacity: 0.5, layers: 1 });
  }
  p.dab(foot, mix(COL.green, COL.flank, 0.3), { rng, variant: 'round', angle: dir, length: 0.5 * k, width: 0.4 * k, opacity: 0.85, layers: 2, edge: 0.1 });
  const lens = fore ? [0.8, 1.2, 1.45, 1.4, 0.95] : [0.8, 1.2, 1.55, 2.05, 1.05];
  for (let i = 0; i < 5; i++) {
    const a = dir + (i - 2) * 0.27 * side * (fore ? 1 : -1) + rng.range(-0.06, 0.06);
    const l = lens[i]! * k;
    const tip = { x: foot.x + Math.cos(a) * l, y: foot.y + Math.sin(a) * l };
    const mid = { x: (foot.x + tip.x) / 2, y: (foot.y + tip.y) / 2 + rng.range(-0.05, 0.05) * k };
    p.inkLine([foot, mid, tip], { rng, width: 0.22 * k, opacity: 0.75, breaks: 0, wobble: 0.05, taper: [0.05, 0.45], pigment: mix(COL.toe, COL.green, 0.3) });
  }
}

/** Where the legs reach: in the S the trunk's outer (convex) side reaches, fore leg forward and hind leg back; the inner side gathers. */
export function legReach(bend: number, side: number, fore: boolean): number {
  // the trunk curves toward +y for a bend of +1 (`swing`), so its convex side is −y
  const r = -side * bend;
  return fore ? r : -r;
}

function paintBody(p: Painter, bend: number): void {
  const rng = p.rng;
  const y = (x: number) => swing(x, bend) * k;
  const legs = (shadow: boolean) => {
    for (const side of [-1, 1]) {
      paintLeg(p, rng, { x: SHOULDER * k, y: y(SHOULDER) }, side, true, bend === 0 ? 0 : legReach(bend, side, true), shadow);
      paintLeg(p, rng, { x: HIP * k, y: y(HIP) }, side, false, bend === 0 ? 0 : legReach(bend, side, false), shadow);
    }
  };
  // the cast shadow on the stone: the body's own shape and legs, a little down and soft
  p.glaze(bodyOutline(bend, 1.05, NECK, TAIL_TIP + 2, 0.25, 0.85), COL.shade, { rng, opacity: 0.34, edge: 0.05, sharpness: 0.15, deform: 0.06, spread: 0.1, centreLift: 0, granulation: 0.1 });
  legs(true);
  // the legs under the body (it covers their joints)
  legs(false);
  const body = bodyOutline(bend);
  // a pale yellow-green ground for the flanks, then the green back laid into it wet, the tail going olive-brown
  p.wash(body, COL.flank, { rng, opacity: 0.96, edge: 0.12, edgeWidth: 0.5 * k, sharpness: 0.12, deform: 0.04, spread: 0.05, centreLift: 0.1, granulation: 0.15, blend: 'source-over' });
  p.glaze(bodyOutline(bend, 0.88, NECK, TAIL_TIP + 1), COL.green, { rng, opacity: 0.9, edge: 0, sharpness: 0.05, deform: 0.02, spread: 0.035, granulation: 0.35, flowScale: 4 * k, fade: { angle: Math.PI, start: 0.5, amount: 0.6, ragged: 0.4 } });
  p.glaze(bodyOutline(bend, 1, -6, TAIL_TIP), COL.tail, { rng, opacity: 0.75, edge: 0.1, sharpness: 0.3, deform: 0.015, spread: 0.02, fade: { angle: 0, start: 0.1, amount: 1, ragged: 0.5 } });
  // the shaded lower side, so it has a round back in the light from above
  p.glaze(bodyOutline(bend, 1, NECK, -9, 0, 0.7), COL.deep, { rng, opacity: 0.28, edge: 0, sharpness: 0.2, deform: 0.05, fade: { angle: -Math.PI / 2, start: 0.55, amount: 1, ragged: 0.4 } });
  // fine black stipple and yellow flecks over the back, the flecks thicker on the flanks
  for (let i = 0; i < 260; i++) {
    const x = rng.range(-10, NECK - 0.3);
    const w = halfWidth(x) * 0.82;
    const r = rng.range(0.06, 0.13) * k * (x < -3 ? 0.8 : 1);
    p.dab({ x: x * k, y: y(x) + rng.range(-w, w) * k }, COL.speck, { rng, variant: 'round', angle: rng.range(0, TAU), length: r * rng.range(1, 1.6), width: r, opacity: rng.range(0.35, 0.75), layers: 1 });
  }
  for (let i = 0; i < 130; i++) {
    const x = rng.range(-7, NECK - 0.6);
    const w = halfWidth(x);
    const s = rng.chance(0.5) ? 1 : -1;
    const r = rng.range(0.09, 0.17) * k;
    p.dab({ x: x * k, y: y(x) + s * rng.range(0.1, 0.92) ** 0.6 * w * k }, COL.fleck, { rng, variant: 'round', angle: 0, length: r * 1.2, width: r, opacity: rng.range(0.5, 0.85), layers: 1, blend: 'source-over' });
  }
  // the light caught along the spine
  const spine: Pt[] = [];
  for (let x = NECK - 1; x >= -5; x -= 1) spine.push({ x: x * k, y: y(x) - 0.35 * k });
  p.inkLine(spine, { rng, width: 0.5 * k, opacity: 0.2, breaks: 0.45, wobble: 0.1, taper: [0.5, 0.6], pigment: PIGMENTS.petalWhite });
}

/** The head, the neck at the origin, snout at +x; `up` shows the yellow throat of a lifted head. */
function paintHead(p: Painter, up: boolean): void {
  const rng = p.rng;
  const outline = smoothPolygon([P(-0.6, -1.2), P(1.4, -1.3), P(2.9, -0.85), P(3.9, -0.35), P(4.15, 0), P(3.9, 0.35), P(2.9, 0.85), P(1.4, 1.3), P(-0.6, 1.2)], 2);
  // its shadow, further off when the head is lifted
  const off = up ? 1.4 : 0.75;
  p.glaze(outline.map((q) => ({ x: q.x + 0.2 * k, y: q.y + off * k })), COL.shade, { rng, opacity: up ? 0.24 : 0.3, edge: 0, sharpness: 0.15, deform: 0.08 });
  if (up) p.wash(smoothPolygon([P(-0.3, -1.4), P(1.6, -1.55), P(3.2, -0.95), P(3.5, 0.95), P(1.6, 1.55), P(-0.3, 1.4)], 2), COL.throat, { rng, opacity: 0.9, edge: 0.12, edgeWidth: 0.3 * k, sharpness: 0.25, deform: 0.06, blend: 'source-over' });
  // a darker green than the back, paler toward the lips
  p.wash(outline, COL.head, { rng, opacity: 0.97, edge: 0.15, edgeWidth: 0.35 * k, sharpness: 0.3, deform: 0.03, centreLift: 0.05, granulation: 0.3, blend: 'source-over' });
  for (const s of [-1, 1]) p.glaze(smoothPolygon([P(0, s * 1.15), P(1.6, s * 1.2), P(3.2, s * 0.6), P(1.6, s * 0.8)], 1), COL.flank, { rng, opacity: 0.45, edge: 0, sharpness: 0.15, deform: 0.1, blend: 'source-over' });
  // the big head shields: the frontal between the eyes, the parietals behind
  const plate = (pts: [number, number][]) => p.inkLine(pts.map(([x, yy]) => P(x, yy)), { rng, width: 0.1 * k, opacity: 0.32, breaks: 0.25, wobble: 0.04, pigment: COL.deep });
  plate([[0.3, -0.6], [1.4, -0.4], [2.5, -0.28], [3.1, 0], [2.5, 0.28], [1.4, 0.4], [0.3, 0.6]]);
  plate([[1.4, -0.4], [1.4, 0.4]]);
  plate([[0.3, 0], [1.4, 0]]);
  for (let i = 0; i < 6; i++) p.dab(P(rng.range(-0.3, 3), rng.range(-0.8, 0.8)), COL.speck, { rng, variant: 'round', angle: 0, length: 0.13 * k, width: 0.11 * k, opacity: 0.45, layers: 1 });
  // the eyes on the head's edges: a dark eye in a pale lid, a glint; the nostrils
  for (const s of [-1, 1]) {
    p.dab(P(2.15, s * 0.95), mix(COL.flank, '#d8cf96', 0.5), { rng, variant: 'round', angle: 0, length: 0.7 * k, width: 0.5 * k, opacity: 0.85, layers: 2, blend: 'source-over' });
    p.dab(P(2.15, s * 0.95), COL.eye, { rng, variant: 'round', angle: 0, length: 0.46 * k, width: 0.4 * k, opacity: 0.95, layers: 2 });
    p.dab(P(2.25, s * 0.88), PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.13 * k, width: 0.11 * k, opacity: 0.75, blend: 'source-over' });
    p.dab(P(3.75, s * 0.22), COL.eye, { rng, variant: 'round', angle: 0, length: 0.11 * k, width: 0.09 * k, opacity: 0.55, layers: 1 });
  }
}

export interface GreenLizardParts {
  /** flat and straight, S one way, S the other way: the body, legs, tail and their cast shadow, anchored at the vent */
  body: [Sprite, Sprite, Sprite];
  /** the head flat, and lifted with the throat showing, with its shadow, anchored at the neck */
  head: [Sprite, Sprite];
}

export function paintGreenLizard(res: number, seed: number): GreenLizardParts {
  const box = { w: 40 * k, h: 14 * k, ox: 27 * k, oy: 6.5 * k };
  const headBox = { w: 6.4 * k, h: 5.6 * k, ox: 1.4 * k, oy: 2.3 * k };
  return {
    body: [
      paintSprite(res, box, seed, (p) => paintBody(p, 0)),
      paintSprite(res, box, seed + 1, (p) => paintBody(p, 1)),
      paintSprite(res, box, seed + 2, (p) => paintBody(p, -1)),
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

/** The lizard at the origin (the vent on the stone), head toward +x: two `drawImage`s. */
export function drawGreenLizard(ctx: Ctx, parts: GreenLizardParts, q: GreenLizardPose): void {
  const clip = q.gap;
  if (clip) {
    ctx.save();
    ctx.beginPath();
    if (clip.keep === 'back') ctx.rect(-40 * k, -10 * k, clip.at + 40 * k, 20 * k);
    else ctx.rect(clip.at, -10 * k, 40 * k - clip.at, 20 * k);
    ctx.clip();
  }
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
    // one lizard on the walls: a hand spawn beside the resident is refused, as the owl's is
    if (homes.length === 0 || w.creatures.some((c) => c instanceof GreenLizard && !c.done)) return [];
    const rng = w.rng.fork(`green-lizard:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const home = chooseHome(homes, w.view, rng);
    return home ? [new GreenLizard(w, home, rng)] : [];
  },
  sheet: {
    w: 620,
    h: 120,
    make(res, seed) {
      const parts = paintGreenLizard(res, seed);
      const box = { w: 40 * k, h: 14 * k, ox: 28 * k, oy: 7 * k };
      const pose = (q: GreenLizardPose) => paintSprite(res, box, seed + 11, (pt) => drawGreenLizard(pt.ctx, parts, q));
      return [pose(LIZARD_REST), pose(lookPose(0.7)), pose({ ...LIZARD_REST, frame: 1 }), pose({ ...LIZARD_REST, frame: 2 }), pose({ ...LIZARD_REST, gap: { at: 2 * k, keep: 'back' } }), parts.head[1]];
    },
  },
  show: { stage: 'coast', spec: { x: 1090, y: 545, w: 110, h: 70 }, w: 540, h: 340, order: 347 },
};
export default greenLizard;
