/**
 * Iwatsubame (イワツバメ, Asian house martin, Delichon dasypus): the waterfall's cliff swallows.
 * A loose flock swirls in arcs along the cliff face and through the falls' spray; now and then one
 * darts up under a ledge's overhang to its mud cup, clings there and drops away again. Stubby:
 * blue-black above with a bright white rump, dusky white below, a short shallow-forked tail.
 * Plan view against the cliff, painted facing right. docs/systems/fauna.md › Creatures and behaviour.
 */
import type { Rng } from '../../core/rng';
import { blob, darken, lighten, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { angleDiff, approach, clamp, cubic, cubicLength, cubicTangent, dist, isOffscreen, lerp, offscreenPoint, polygonBounds, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import type { Perch } from '../targets';
import { FAUNA_TUNING } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Wingspan at perspective 1 (world units): a touch over life size, so it reads far up the cliff. */
export const MARTIN_SPAN = 34;

export const IWATSUBAME_TUNING = {
  /** world units / s at perspective 1 */
  cruise: [120, 175] as const,
  /** tightest turn radius at perspective 1 (world units) */
  radius: [24, 52] as const,
  /** seconds between one bird's darts to its cup */
  nestGap: [6, 20] as const,
  /** seconds clinging at the cup */
  cling: [0.7, 2.6] as const,
  /** chance a new waypoint is down in the falls' spray */
  spray: 0.24,
  /** chance of a tight loop when a waypoint is reached */
  loop: 0.16,
  /** wingbeats a second, and the share of time spent flapping (the rest: short stiff glides) */
  hz: 9.5,
  flap: 0.6,
  /** most birds at the cups at once */
  atCups: 2,
};

const BLUE = '#3a3f5c';
const UNDER = '#e6e1d8';

interface Colours {
  sheen: Pigment;
  back: Pigment;
  soot: Pigment;
  underwing: Pigment;
  under: Pigment;
  flank: Pigment;
  rump: Pigment;
  mud: Pigment;
  mudDark: Pigment;
}

function colours(): Colours {
  return {
    sheen: darken(mix(BLUE, PIGMENTS.sumi, 0.15), 0.12),
    back: darken(mix(BLUE, PIGMENTS.sumi, 0.45), 0.25),
    soot: darken(mix(BLUE, PIGMENTS.sumi, 0.6), 0.3),
    underwing: mix(mix(BLUE, PIGMENTS.stone, 0.5), PIGMENTS.wood, 0.15),
    under: UNDER,
    flank: mix(UNDER, PIGMENTS.stoneDark, 0.3),
    rump: mix(PIGMENTS.petalWhite, UNDER, 0.25),
    mud: mix(PIGMENTS.stoneWarm, PIGMENTS.woodLight, 0.45),
    mudDark: mix(PIGMENTS.wood, PIGMENTS.stoneDark, 0.5),
  };
}

/** Wings apart from the body, so a beat or a roll foreshortens the wings and not the bird. */
export interface MartinWings {
  /** spread on the downstroke */
  beat: Sprite;
  /** stiff-winged glide */
  glide: Sprite;
  /** swept back in a dive or a hard turn */
  swept: Sprite;
}

export interface MartinParts {
  /** seen from above: blue-black, the white rump; and from below: dusky white */
  back: Sprite;
  belly: Sprite;
  backWings: MartinWings;
  bellyWings: MartinWings;
  /** at the cup, from behind: anchored at the cup's entrance, body hanging below */
  cling: Sprite;
}

/** Design units (span 24): the body runs from the bill (+5.4) to the tail's prongs (−7.4). */
const K = MARTIN_SPAN / 24;
const P = (x: number, y: number): Pt => ({ x: x * K, y: y * K });

type Pose = { arm: number; sweep: number; reach: number };
/** Downstroke: arms a touch forward, hands spread. Glide: stiff, a little swept. Swept: a crescent. */
const BEAT: Pose = { arm: -0.12, sweep: 0.3, reach: 1 };
const GLIDE: Pose = { arm: 0.06, sweep: 0.55, reach: 0.97 };
const SWEPT: Pose = { arm: 0.5, sweep: 0.7, reach: 0.92 };

/** Outward along a wing at sweep `a` (back from perpendicular), and its forward normal; `side` ±1. */
const dir = (a: number, side: number): Pt => ({ x: -Math.sin(a), y: side * Math.cos(a) });
const fwd = (a: number, side: number): Pt => ({ x: Math.cos(a), y: side * Math.sin(a) });
const add = (q: Pt, d: Pt, k: number): Pt => ({ x: q.x + d.x * k * K, y: q.y + d.y * k * K });

/** One wing from the shoulder: a broad arm to the wrist, then a tapering hand swept back to a sharp tip. */
function wingGeometry(side: number, pose: Pose): { shape: Pt[]; wrist: Pt; tip: Pt; hand: number } {
  const S = P(1.7, side * 1.25);
  const a1 = pose.arm;
  const a2 = pose.arm + pose.sweep;
  const W = add(S, dir(a1, side), 4.1);
  const T = add(W, dir(a2, side), 7.6 * pose.reach);
  const mid = add(W, dir(a2, side), 3.6 * pose.reach);
  const near = add(W, dir(a2, side), 6.4 * pose.reach);
  const shape = smoothPolygon(
    [
      add(S, fwd(a1, side), 0.8),
      add(add(S, dir(a1, side), 2.2), fwd(a1, side), 0.95),
      add(W, fwd(a2, side), 0.75),
      add(mid, fwd(a2, side), 0.55),
      add(near, fwd(a2, side), 0.25),
      T,
      add(near, fwd(a2, side), -0.9),
      add(mid, fwd(a2, side), -1.75),
      add(W, fwd(a1, side), -2.7),
      add(add(S, dir(a1, side), 2.0), fwd(a1, side), -3.0),
      P(-1.9, side * 1.45),
    ],
    2,
  );
  return { shape, wrist: W, tip: T, hand: a2 };
}

function bodyShape(): Pt[] {
  // stubby: a round head on a short neck, a broad chest, tapering to the rump
  return smoothPolygon([P(5.6, 0), P(5.2, -0.95), P(4.3, -1.45), P(3.2, -1.45), P(1.6, -1.95), P(-0.5, -1.85), P(-2.6, -1.45), P(-3.8, -0.95), P(-4.3, 0), P(-3.8, 0.95), P(-2.6, 1.45), P(-0.5, 1.85), P(1.6, 1.95), P(3.2, 1.45), P(4.3, 1.45), P(5.2, 0.95)], 2);
}

function tailShape(): Pt[] {
  // short and square-ish, a shallow notch between two blunt prongs
  return smoothPolygon([P(-3.0, -1.2), P(-5.2, -1.6), P(-7.2, -1.75), P(-6.8, -0.6), P(-6.3, 0), P(-6.8, 0.6), P(-7.2, 1.75), P(-5.2, 1.6), P(-3.0, 1.2)], 1);
}

function paintWings(p: Painter, c: Colours, pose: Pose, below: boolean): void {
  const rng = p.rng;
  for (const side of [-1, 1]) {
    const { shape, wrist, tip, hand } = wingGeometry(side, pose);
    const out = Math.atan2(tip.y - wrist.y * 0.5, tip.x);
    if (below) {
      // grey-brown underwing, the flight feathers darker toward the tip, light through them
      p.wetInWet(shape, c.underwing, c.soot, { rng, angle: out, split: 0.45, softness: 0.55, fingers: 0.5, opacity: 0.86, edge: 0.4, edgeWidth: 0.5, deform: 0.07, granulation: 0.25, flow: 0.4, flowScale: 2, blend: 'source-over' });
    } else {
      // glossy blue-black coverts on the arm bleeding into sooty flight feathers
      p.wetInWet(shape, c.sheen, c.soot, { rng, angle: out + side * 0.6, split: 0.4, softness: 0.45, fingers: 0.55, opacity: 0.96, edge: 0.45, edgeWidth: 0.45, deform: 0.07, granulation: 0.3, flow: 0.45, flowScale: 2, blend: 'source-over' });
    }
    // two primaries hinted along the hand, broken
    for (let k = 0; k < 2; k++) {
      const from = add(wrist, fwd(hand, side), -(0.7 + k * 0.6));
      const to = add(add(tip, dir(hand, side), -1.4 - k), fwd(hand, side), -(0.2 + k * 0.3));
      p.inkLine([from, to], { rng, width: 0.2 * K, opacity: below ? 0.16 : 0.2, breaks: 0.5, wobble: 0.15, pigment: below ? c.soot : lighten(c.sheen, 0.2) });
    }
  }
}

function paintBack(p: Painter, c: Colours): void {
  const rng = p.rng;
  p.wetInWet(tailShape(), c.soot, mix(c.soot, PIGMENTS.sumi, 0.3), { rng, angle: Math.PI, split: 0.55, opacity: 0.94, edge: 0.55, edgeWidth: 0.5, deform: 0.06, blend: 'source-over' });
  const body = bodyShape();
  // the cap and mantle darkest, a bluer sheen on the back
  p.wetInWet(body, c.back, c.sheen, { rng, angle: Math.PI, split: 0.35, softness: 0.4, fingers: 0.4, opacity: 0.97, edge: 0.3, edgeWidth: 0.6, deform: 0.05, blend: 'source-over' });
  // the white rump: a broad saddle over the lower back, spilling onto the flanks
  const rump = smoothPolygon([P(-0.5, -1.4), P(-1.9, -2.4), P(-4.0, -2.2), P(-5.0, 0), P(-4.0, 2.2), P(-1.9, 2.4), P(-0.5, 1.4), P(-0.9, 0)], 2);
  p.wash(rump, c.rump, { rng, opacity: 1, edge: 0.12, edgeWidth: 0.4, centreLift: 0, deform: 0.1, blend: 'source-over', layers: 7 });
  // the mantle's blue-black bleeding a little into its front edge, a cool shade toward the tail
  p.glaze(rump, c.back, { rng, opacity: 0.3, edge: 0.05, deform: 0.12, fade: { angle: Math.PI, start: 0.02, amount: 1, ragged: 0.8 } });
  p.glaze(rump, PIGMENTS.shadow, { rng, opacity: 0.12, edge: 0.05, deform: 0.08, fade: { angle: 0, start: 0.4 } });
  // a wet blue gloss lifted along the crown and mantle
  p.dab(P(2.2, -0.3), mix(c.sheen, PIGMENTS.cerulean, 0.35), { rng, variant: 'leaf', angle: Math.PI, length: 4.2 * K, width: 0.9 * K, opacity: 0.4, blend: 'source-over', edge: 0.15 });
}

function paintBelly(p: Painter, c: Colours): void {
  const rng = p.rng;
  p.wetInWet(tailShape(), mix(c.soot, c.underwing, 0.3), c.soot, { rng, angle: Math.PI, split: 0.5, opacity: 0.88, edge: 0.55, edgeWidth: 0.5, deform: 0.06, blend: 'source-over' });
  const body = bodyShape();
  // dusky white below, greyer on the flanks, the dark cap just showing at the bill
  p.wetInWet(body, c.under, c.flank, { rng, angle: Math.PI / 2, split: 0.5, softness: 0.6, fingers: 0.4, opacity: 0.96, edge: 0.3, edgeWidth: 0.6, deform: 0.05, blend: 'source-over' });
  p.glaze(body, c.flank, { rng, opacity: 0.18, edge: 0.1, deform: 0.05, fade: { angle: -Math.PI / 2, start: 0.35 } });
  // the dark cap reaching round the eyes to the bill, lost into the throat
  p.glaze(blob(4.7 * K, 0, 1.2 * K, 1.4 * K, rng), c.back, { rng, opacity: 0.75, edge: 0.1, deform: 0.08, fade: { angle: Math.PI, start: 0.25, amount: 1, ragged: 0.6 } });
  // white undertail coverts
  p.dab(P(-3.4, 0), c.rump, { rng, variant: 'round', angle: Math.PI, length: 2.4 * K, width: 2.6 * K, opacity: 0.9, blend: 'source-over' });
}

/** At the cup, from behind: head up in the entrance (the origin), back and white rump, folded wings and tail below. */
function paintCling(p: Painter, c: Colours): void {
  const rng = p.rng;
  const Q = (x: number, y: number): Pt => ({ x: x * K, y: y * K });
  // the folded wings, crossing a little below the tail
  for (const side of [-1, 1]) {
    const wing = smoothPolygon([Q(side * 1.2, 2.4), Q(side * 2.4, 3.6), Q(side * 2.2, 7.5), Q(side * 0.9, 11.2), Q(-side * 0.2, 11.6), Q(side * 0.3, 7.5), Q(side * 0.4, 3.4)], 2);
    p.wetInWet(wing, c.sheen, c.soot, { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.94, edge: 0.6, edgeWidth: 0.45, deform: 0.06, blend: 'source-over' });
  }
  const tail = smoothPolygon([Q(-1.1, 7.6), Q(1.1, 7.6), Q(1.5, 10.6), Q(0.4, 10.0), Q(0, 9.4), Q(-0.4, 10.0), Q(-1.5, 10.6)], 1);
  p.wash(tail, c.soot, { rng, opacity: 0.9, edge: 0.5, deform: 0.05, blend: 'source-over' });
  const body = smoothPolygon([Q(0, 0.2), Q(1.5, 0.9), Q(2.0, 3.0), Q(1.9, 5.6), Q(1.3, 7.6), Q(0, 8.2), Q(-1.3, 7.6), Q(-1.9, 5.6), Q(-2.0, 3.0), Q(-1.5, 0.9)], 2);
  p.wetInWet(body, c.back, c.sheen, { rng, angle: Math.PI / 2, split: 0.3, opacity: 0.97, edge: 0.5, edgeWidth: 0.5, deform: 0.05, blend: 'source-over' });
  const rump = smoothPolygon([Q(-2.1, 5.2), Q(0, 4.8), Q(2.1, 5.2), Q(1.8, 7.3), Q(0, 7.9), Q(-1.8, 7.3)], 2);
  p.wash(rump, c.rump, { rng, opacity: 0.98, edge: 0.25, edgeWidth: 0.35, centreLift: 0.1, deform: 0.08, blend: 'source-over', layers: 6 });
  p.glaze(rump, PIGMENTS.shadow, { rng, opacity: 0.2, edge: 0.1, deform: 0.08, fade: { angle: -Math.PI / 2, start: 0.5 } });
}

/** A mud cup under an overhang, hanging from the origin: rows of pellets, the dark entrance on top. */
function paintCup(p: Painter, c: Colours, rng: Rng): void {
  const cup = smoothPolygon([P(-4.6, -0.2), P(4.6, -0.2), P(4.4, 2.0), P(3.3, 4.3), P(0.4, 5.9), P(-2.9, 4.6), P(-4.3, 2.2)], 2);
  p.wetInWet(cup, c.mud, c.mudDark, { rng, angle: Math.PI / 2 + 0.3, split: 0.55, softness: 0.5, opacity: 0.92, edge: 0.55, edgeWidth: 0.5, deform: 0.1, granulation: 0.7, blend: 'source-over' });
  for (let row = 0; row < 4; row++) {
    const y = 0.9 + row * 1.25;
    const half = 4.0 - row * 0.85;
    for (let x = -half; x <= half; x += rng.range(1.0, 1.4)) {
      p.dab(P(x, y + rng.range(-0.2, 0.2)), rng.chance(0.5) ? mix(c.mud, c.mudDark, 0.6) : lighten(c.mud, 0.12), { rng, variant: 'round', angle: rng.range(0, TAU), length: rng.range(0.8, 1.2) * K, width: 0.7 * K, opacity: rng.range(0.12, 0.3), edge: 0.3 });
    }
  }
  // the entrance: a dark slot against the rock above
  p.dab(P(0.4, 0.4), mix(PIGMENTS.sumi, PIGMENTS.indigo, 0.2), { rng, variant: 'round', angle: 0, length: 2.6 * K, width: 0.95 * K, opacity: 0.8 });
  // the shadow it throws on the rock
  p.glaze(blob(1.0 * K, 3.8 * K, 4.4 * K, 2.8 * K, rng), PIGMENTS.shadow, { rng, opacity: 0.18, edge: 0.05, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.3 } });
}

export function paintMartin(res: number, seed: number): MartinParts {
  const c = colours();
  const box = { w: 26 * K, h: 27 * K, ox: 13 * K, oy: 13.5 * K };
  let k = 2;
  const wing = (pose: Pose, below: boolean) => paintSprite(res, box, seed + k++, (p) => paintWings(p, c, pose, below));
  const wings = (below: boolean): MartinWings => ({ beat: wing(BEAT, below), glide: wing(GLIDE, below), swept: wing(SWEPT, below) });
  return {
    back: paintSprite(res, { w: 14 * K, h: 6 * K, ox: 7.8 * K, oy: 3 * K }, seed, (p) => paintBack(p, c)),
    belly: paintSprite(res, { w: 14 * K, h: 6 * K, ox: 7.8 * K, oy: 3 * K }, seed + 1, (p) => paintBelly(p, c)),
    backWings: wings(false),
    bellyWings: wings(true),
    cling: paintSprite(res, { w: 6 * K, h: 13 * K, ox: 3 * K, oy: 0.5 * K }, seed + 5, (p) => paintCling(p, c)),
  };
}

/** The bird at the origin facing +x: wings foreshortened to `span`, the body narrowing as it rolls edge-on (`bank`). */
export function drawMartin(ctx: Ctx, parts: MartinParts, belly: boolean, wing: keyof MartinWings, span: number, bank: number): void {
  const w = (belly ? parts.bellyWings : parts.backWings)[wing];
  const b = belly ? parts.belly : parts.back;
  ctx.save();
  ctx.scale(1, Math.max(0.08, span));
  ctx.drawImage(w.img as CanvasImageSource, -w.ox, -w.oy, w.w, w.h);
  ctx.restore();
  ctx.save();
  ctx.scale(1, lerp(1, 0.72, bank));
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  ctx.restore();
}

export function paintCups(res: number, seed: number): Sprite[] {
  const c = colours();
  return [0, 1, 2].map((i) => paintSprite(res, { w: 12 * K, h: 9.5 * K, ox: 5.8 * K, oy: 0.8 * K }, seed + i, (p, rng) => paintCup(p, c, rng)));
}

// ---------------------------------------------------------------------------------------------
// where they fly (pure)

/** A mud cup under a ledge's overhang. */
export interface Nest {
  id: string;
  ledge: string;
  x: number;
  /** where the cup hangs from (just under the lip) */
  y: number;
  /** perspective there */
  s: number;
  look: number;
}

type FaceWorld = Pick<FaunaWorld, 'perches' | 'scene' | 'view'>;

const ledgesOf = (w: Pick<FaunaWorld, 'perches'>): Perch[] => w.perches.filter((p) => p.kind === 'ledge');

/** The cliff face the flock works: the ledges and the falls, a little wider, inside the view. Null without ledges. */
export function cliffFace(w: FaceWorld): Rect | null {
  const ledges = ledgesOf(w);
  if (ledges.length === 0) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const l of ledges) {
    // a ledge perch spans 0.7 of its edge's half-width each side (`ledgePerch`)
    const half = l.spread / 0.7;
    x0 = Math.min(x0, l.x - half);
    x1 = Math.max(x1, l.x + half);
    y0 = Math.min(y0, l.y);
    y1 = Math.max(y1, l.y);
  }
  const falls = w.scene.falls;
  if (falls) {
    const b = polygonBounds(falls.outline);
    x0 = Math.min(x0, b.x);
    x1 = Math.max(x1, b.x + b.w);
    y0 = Math.min(y0, b.y);
    y1 = Math.max(y1, falls.foot.y - (falls.foot.y - b.y) * 0.12);
  }
  const padX = (x1 - x0) * 0.08;
  const padY = (y1 - y0) * 0.12;
  const v = w.view;
  const inset = Math.min(30, v.w * 0.06);
  const r = {
    x0: Math.max(x0 - padX, v.x + inset),
    x1: Math.min(x1 + padX, v.x + v.w - inset),
    y0: Math.max(y0 - padY, v.y + inset),
    y1: Math.min(y1 + padY * 0.3, v.y + v.h - inset),
  };
  // a view that hardly shows the cliff: keep the cliff's own box
  if (r.x1 - r.x0 < 60 || r.y1 - r.y0 < 40) return { x: x0 - padX, y: y0 - padY, w: x1 - x0 + 2 * padX, h: y1 - y0 + padY * 1.3 };
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
}

/** The colony: a few mud cups huddled under some of the ledges' overhangs (stable per world). */
export function nestSites(w: Pick<FaunaWorld, 'perches' | 'rng' | 'perspective'>): Nest[] {
  const out: Nest[] = [];
  const ledges = ledgesOf(w);
  ledges.forEach((l, i) => {
    const rng = w.rng.fork(`iwatsubame:colony:${l.id}`);
    // most ledges have a colony; the first always does
    if (i > 0 && !rng.chance(0.65)) return;
    const s = w.perspective(l.y, l.x);
    const n = rng.int(1, 3);
    const cx = l.x + rng.range(-0.55, 0.55) * l.spread;
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * 8.6 * s + rng.range(-0.6, 0.6) * s;
      out.push({ id: `${l.id}:${k}`, ledge: l.id, x, y: l.y + (4.5 + rng.range(0, 2)) * s, s, look: rng.int(0, 2) });
    }
  });
  return out;
}

/** A point in the falls' spray, low on the sheet and either side of it. */
export function sprayPoint(w: Pick<FaunaWorld, 'scene'>, rng: Rng): Pt | null {
  const falls = w.scene.falls;
  if (!falls) return null;
  const b = polygonBounds(falls.outline);
  const y = lerp(b.y, falls.foot.y, rng.range(0.45, 0.9));
  return { x: b.x + b.w * rng.range(-0.2, 1.2), y };
}

/** A point on the face near `around`, kept inside the face. */
export function facePoint(face: Rect, around: Pt, rng: Rng): Pt {
  return {
    x: clamp(around.x + rng.gaussian(0, face.w * 0.28), face.x, face.x + face.w),
    y: clamp(around.y + rng.gaussian(0, face.h * 0.3), face.y, face.y + face.h),
  };
}

export const inRect = (q: Pt, r: Rect, m = 0) => q.x >= r.x - m && q.x <= r.x + r.w + m && q.y >= r.y - m && q.y <= r.y + r.h + m;

// ---------------------------------------------------------------------------------------------

/** What the birds of one visit share: the cliff face, the drifting centre they swirl round, the cups. */
export class Flock {
  readonly birds: Martin[] = [];
  nests: Nest[] = [];
  face: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private refreshed = -Infinity;
  /** cups fade in with the flock and out after the last bird */
  cups = 0;

  constructor(readonly salt: number) {}

  refresh(w: FaunaWorld): void {
    if (w.t - this.refreshed < 0.5 && w.t >= this.refreshed) return;
    this.refreshed = w.t;
    this.face = cliffFace(w) ?? this.face;
    if (this.nests.length === 0) this.nests = nestSites(w);
  }

  centre(w: FaunaWorld): Pt {
    const f = this.face;
    return {
      x: f.x + f.w * (0.5 + 0.4 * w.noise(w.t * 0.035, this.salt)),
      y: f.y + f.h * (0.5 + 0.36 * w.noise(this.salt + 7.3, w.t * 0.045)),
    };
  }

  /** A free cup (no other bird at it or on its way), or null. */
  freeNest(rng: Rng, me: Martin): Nest | null {
    const busy = this.birds.filter((b) => b !== me && b.nest !== null && !b.done);
    if (busy.length >= IWATSUBAME_TUNING.atCups) return null;
    const free = this.nests.filter((n) => busy.every((b) => b.nest!.id !== n.id) && inRect(n, this.face, 40));
    return free.length > 0 ? rng.pick(free) : null;
  }

  /** The first bird still here draws the cups. */
  leader(): Martin | null {
    return this.birds.find((b) => !b.done) ?? null;
  }
}

interface Path {
  p: [Pt, Pt, Pt, Pt];
  len: number;
  u: number;
  v0: number;
  v1: number;
}

function pathOf(p0: Pt, p1: Pt, p2: Pt, p3: Pt, v0: number, v1: number): Path {
  return { p: [p0, p1, p2, p3], len: Math.max(1, cubicLength(p0, p1, p2, p3)), u: 0, v0, v1 };
}

export class Martin extends BaseCreature {
  readonly kind = 'iwatsubame' as const;
  /** small and far on the cliff: the flock does not count against the visitor cap */
  readonly visitor = false;
  override layer: LayerId = 'air';
  /** the cup it is going to or clinging at */
  nest: Nest | null = null;
  private heading: number;
  private speed: number;
  private readonly cruise: number;
  private readonly radius: number;
  private target: Pt;
  private targetT = 0;
  private loop = 0;
  private loopDir = 1;
  private path: Path | null = null;
  private delay: number;
  private nestT: number;
  private visitT = 0;
  private flapT: number;
  private bank = 0;
  private turnRate = 0;
  private belly = false;
  private edgeOn = false;
  private ps = 0.7;
  private readonly rng: Rng;

  constructor(
    w: FaunaWorld,
    readonly flock: Flock,
    rng: Rng,
    private readonly stay: number,
    delay: number,
    side: number,
  ) {
    super();
    this.rng = rng;
    flock.refresh(w);
    const f = flock.face;
    // in from the side, at the height of the face, or down over the skyline
    const high = rng.chance(0.35);
    const start = high ? { x: f.x + f.w * rng.range(0.1, 0.9), y: w.view.y - FAUNA_TUNING.offscreen } : offscreenPoint(w.view, side, f.y + f.h * rng.range(0.1, 0.7), FAUNA_TUNING.offscreen);
    this.x = start.x;
    this.y = start.y;
    this.target = facePoint(f, flock.centre(w), rng);
    this.heading = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.cruise = rangeOf(rng, IWATSUBAME_TUNING.cruise);
    this.radius = rangeOf(rng, IWATSUBAME_TUNING.radius) * (w.mode.reduced ? 1.6 : 1);
    this.speed = this.cruise;
    this.delay = delay;
    this.nestT = rng.range(3, IWATSUBAME_TUNING.nestGap[1]);
    this.flapT = rng.range(0, 10);
    this.ps = w.perspective(clamp(this.y, f.y, f.y + f.h), clamp(this.x, f.x, f.x + f.w));
    this.belly = rng.chance(0.35);
    this.state = delay > 0 ? 'wait' : 'enter';
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    if (this.state === 'wait') this.go('enter');
    this.flock.refresh(w);
    this.timer += dt;
    this.visitT += dt;
    this.flapT += dt * w.speed;
    // not counted as a visitor, so nightfall does not send it off: it goes by itself
    if (!this.leaving && (this.visitT > this.stay || w.mode.night)) this.leaving = true;
    if (this.leaving && (this.state === 'swirl' || this.state === 'enter')) this.depart(w);
    switch (this.state) {
      case 'cling':
        this.clingStep(dt, w);
        break;
      case 'dart':
      case 'drop':
        this.pathStep(dt, w);
        break;
      default:
        this.flyStep(dt, w);
    }
    this.ps = approach(this.ps, this.scaleAt(w), 2.5, dt);
    if (this.flock.leader() === this) {
      // the cups show while the flock is about, and fade once all are going
      const fl = this.flock;
      fl.cups = approach(fl.cups, fl.birds.every((b) => b.leaving || b.done) ? 0 : 1, 0.8, dt);
    }
    // roll edge-on in hard screen turns; passing edge-on it may show the other side
    const k = clamp(Math.abs(this.turnRate) / 4.5, 0, 1);
    this.bank = approach(this.bank, this.state === 'cling' ? 0 : k, 6, dt);
    if (this.bank > 0.7 && !this.edgeOn) {
      this.edgeOn = true;
      if (this.rng.chance(0.55)) this.belly = !this.belly;
    } else if (this.bank < 0.35) this.edgeOn = false;
  }

  /** Perspective where it is: the cliff's scale in front of the cliff, held while it is off the face. */
  private scaleAt(w: FaunaWorld): number {
    if (this.nest && (this.state === 'cling' || (this.state === 'dart' && (this.path?.u ?? 0) > 0.5))) return this.nest.s;
    const f = this.flock.face;
    // a little in front of the rock it flies along
    return 1.1 * w.perspective(clamp(this.y, f.y, f.y + f.h + 20), clamp(this.x, f.x - 40, f.x + f.w + 40));
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const f = this.flock.face;
    const rng = this.rng;
    const here = { x: this.x, y: this.y };
    if (this.state === 'enter' && inRect(here, f)) this.go('swirl');
    if (this.state === 'swirl') {
      this.targetT += dt;
      this.nestT -= dt * sf;
      const d = dist(here, this.target);
      const off = angleDiff(this.heading, Math.atan2(this.target.y - this.y, this.target.x - this.x));
      // reached, stale, or circling inside its turn: a new point to make for
      if (d < 24 || this.targetT > 3.2 || (d < this.radius * 1.6 && Math.abs(off) > 1.9)) {
        if (d < 24 && this.loop <= 0 && rng.chance(IWATSUBAME_TUNING.loop * (w.mode.reduced ? 0.3 : 1))) {
          this.loop = rng.range(0.7, 1.2);
          this.loopDir = rng.chance(0.5) ? 1 : -1;
        }
        this.pick(w);
      }
      if (this.nestT <= 0 && this.loop <= 0) {
        this.nestT = rangeOf(rng, IWATSUBAME_TUNING.nestGap) * (w.mode.reduced ? 1.5 : 1);
        if (this.toNest(w)) return;
      }
      // well off the face: back toward the flock
      if (!inRect(here, f, 50)) this.target = this.flock.centre(w);
    }
    const ps = this.ps;
    const wanted = this.cruise * (0.85 + 0.25 * w.noise(this.timer * 0.6, this.id * 3.1)) * (this.state === 'leave' ? 1.2 : 1);
    this.speed = approach(this.speed, wanted, 2, dt);
    const v = this.speed * ps * sf;
    const maxTurn = v / Math.max(6, this.radius * ps);
    let turn: number;
    if (this.loop > 0) {
      this.loop -= dt * sf;
      turn = this.loopDir * maxTurn * 0.95;
    } else {
      const want = Math.atan2(this.target.y - this.y, this.target.x - this.x) + w.noise(this.timer * 1.1, this.id * 1.7) * 0.5;
      const diff = angleDiff(this.heading, want);
      turn = clamp(diff * 3, -maxTurn, maxTurn);
    }
    this.heading += turn * dt;
    this.turnRate = turn;
    this.x += Math.cos(this.heading) * v * dt;
    this.y += Math.sin(this.heading) * v * dt;
    if (this.state === 'leave' && isOffscreen(here, w.view, FAUNA_TUNING.offscreen * 0.6)) this.done = true;
    if (this.state === 'leave' && this.timer > 30) this.done = true;
  }

  private pick(w: FaunaWorld): void {
    const rng = this.rng;
    const spray = rng.chance(IWATSUBAME_TUNING.spray) ? sprayPoint(w, rng) : null;
    this.target = spray && inRect(spray, this.flock.face, 20) ? spray : facePoint(this.flock.face, this.flock.centre(w), rng);
    this.targetT = 0;
  }

  /** Start a dart in to a free cup: a swoop that comes up to it from below. */
  private toNest(w: FaunaWorld): boolean {
    const nest = this.flock.freeNest(this.rng, this);
    if (!nest) return false;
    const here = { x: this.x, y: this.y };
    const L = dist(here, nest);
    if (L < 30 || L > 520) return false;
    const h = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
    const side = nest.x > this.x ? -1 : 1;
    const p1 = { x: this.x + h.x * L * 0.35, y: this.y + h.y * L * 0.35 };
    const p2 = { x: nest.x + side * L * 0.12, y: nest.y + Math.max(26, L * 0.35) * nest.s };
    this.nest = nest;
    this.path = pathOf(here, p1, p2, { x: nest.x, y: nest.y }, this.speed, 22);
    this.go('dart');
    return true;
  }

  private pathStep(dt: number, w: FaunaWorld): void {
    const path = this.path;
    if (!path) {
      this.go('swirl');
      return;
    }
    // braking into the cup, gathering speed dropping away from it
    const k = path.u;
    const v = lerp(path.v0, path.v1, this.state === 'dart' ? clamp((k - 0.55) / 0.45, 0, 1) ** 1.5 : Math.sqrt(k));
    path.u = Math.min(1, path.u + (v * this.ps * w.speed * dt) / path.len);
    const [a, b, c, d] = path.p;
    const q = cubic(a, b, c, d, path.u);
    const t = cubicTangent(a, b, c, d, path.u);
    const h = Math.atan2(t.y, t.x);
    this.turnRate = dt > 0 ? angleDiff(this.heading, h) / dt : 0;
    this.heading = h;
    this.speed = v;
    this.x = q.x;
    this.y = q.y;
    if (path.u < 1) return;
    this.path = null;
    if (this.state === 'dart') {
      this.go('cling');
      this.clingFor = rangeOf(this.rng, IWATSUBAME_TUNING.cling) / w.speed;
    } else {
      this.nest = null;
      this.go('swirl');
      this.pick(w);
    }
  }

  private clingFor = 1;

  private clingStep(dt: number, w: FaunaWorld): void {
    this.turnRate = 0;
    if (this.timer < this.clingFor) return;
    const nest = this.nest!;
    const rng = this.rng;
    // drops off, falls clear of the rock and swings away along the face
    const side = rng.chance(0.5) ? -1 : 1;
    const out = facePoint(this.flock.face, this.flock.centre(w), rng);
    const p1 = { x: nest.x + side * 6 * nest.s, y: nest.y + 34 * nest.s };
    const p2 = { x: nest.x + side * 60 * nest.s, y: nest.y + 70 * nest.s };
    this.path = pathOf({ x: nest.x, y: nest.y }, p1, p2, out, 30, this.cruise);
    this.heading = Math.PI / 2;
    this.go('drop');
  }

  private depart(w: FaunaWorld): void {
    const side = this.x < w.view.x + w.view.w / 2 ? -1 : 1;
    // up and out over the skyline, toward the nearer side
    this.target = { x: side < 0 ? w.view.x - 200 : w.view.x + w.view.w + 200, y: w.view.y - 120 };
    this.loop = 0;
    this.go('leave');
  }

  override leave(): void {
    this.leaving = true;
  }

  /** The cup it clings at, for tests. */
  clingingAt(): Nest | null {
    return this.state === 'cling' ? this.nest : null;
  }

  showsBelly(): boolean {
    return this.belly;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'air' || this.state === 'wait') return;
    if (this.flock.leader() === this) this.drawCups(ctx, w);
    const look = this.id % 2;
    const parts = w.art.get(`iwatsubame:${look}`, (res) => paintMartin(res, 2500 + look * 11));
    const ps = this.ps;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.state === 'cling') {
      const s = parts.cling;
      // a tiny settling shuffle as it grips
      const sway = Math.sin(this.timer * 7) * 0.04 * Math.exp(-this.timer * 2);
      ctx.rotate(sway);
      ctx.scale(ps, ps);
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
      return;
    }
    const sf = w.speed;
    // bursts of quick beats between short stiff-winged glides
    const flapping = this.state === 'drop' || this.state === 'leave' || w.noise(this.flapT * 0.9, this.id * 5.3) > 0.2 - IWATSUBAME_TUNING.flap;
    const beat = flapping ? 0.5 + 0.5 * Math.cos(this.flapT * TAU * IWATSUBAME_TUNING.hz * (0.8 + 0.2 * sf)) : 1;
    const swept = this.state === 'dart' && this.path !== null && this.path.u < 0.7;
    const span = (flapping ? 0.45 + 0.55 * beat : 1) * lerp(1, 0.42, this.bank);
    ctx.rotate(this.heading);
    ctx.scale(ps, ps);
    drawMartin(ctx, parts, this.belly, swept ? 'swept' : flapping ? 'beat' : 'glide', span, this.bank);
    ctx.restore();
  }

  private drawCups(ctx: Ctx, w: FaunaWorld): void {
    const fl = this.flock;
    const cups = w.art.get('iwatsubame:cups', (res) => paintCups(res, 2600));
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * fl.cups;
    for (const n of fl.nests) {
      const s = cups[n.look]!;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.scale(n.s, n.s);
      ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    }
    ctx.globalAlpha = a;
  }
}

const iwatsubame: CreatureDef = {
  kind: 'iwatsubame',
  title: 'iwatsubame house martins',
  // scheduled but not counted: a flock small and far on the cliff
  role: 'drifter',
  visit: { gap: [110, 280], first: [20, 60], stay: [70, 150], group: [3, 7], max: 8, diurnal: true, visitor: false },
  spawnCount: 5,
  needs: (w) => ledgesOf(w).length > 0,
  spawn(w, s) {
    if (!cliffFace(w)) return [];
    const rng = w.rng.fork(`iwatsubame:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const flock = new Flock(rng.range(0, 1000));
    const n = w.mode.reduced ? Math.min(Math.max(s.count, 2), 3) : Math.max(1, s.count);
    const side = rng.chance(0.5) ? -1 : 1;
    const stay = s.stay || 110;
    for (let i = 0; i < n; i++) {
      const b = new Martin(w, flock, rng.fork(`bird:${i}`), stay * rng.range(0.8, 1.15), i === 0 ? 0 : rng.range(0.2, 1.1) * i, side);
      flock.birds.push(b);
    }
    return flock.birds;
  },
  sheet: {
    w: 640,
    h: 130,
    make(res, seed) {
      const a = paintMartin(res, seed);
      const box = { w: 26 * K, h: 27 * K, ox: 13 * K, oy: 13.5 * K };
      const pose = (belly: boolean, wing: keyof MartinWings, span: number, bank: number) => paintSprite(res, box, seed + 9, (p) => drawMartin(p.ctx, a, belly, wing, span, bank));
      return [pose(false, 'beat', 1, 0), pose(false, 'glide', 1, 0), pose(false, 'swept', 1, 0), pose(false, 'beat', 0.45, 0), pose(true, 'beat', 1, 0), pose(true, 'glide', 0.6, 0.5), a.cling, ...paintCups(res, seed + 20)];
    },
  },
  show: { stage: 'falls', spec: { w: 420, h: 266 }, w: 570, h: 361, order: 23, group: 5 },
};
export default iwatsubame;
