/**
 * Sawagani (サワガニ, Geothelphusa dehaani): the Japanese freshwater crab of the waterfall. It lives
 * under a wet stone at the waterline, sidles out (mostly after dark), picks at the moss with its
 * milky claws, freezes when a bird or the camera comes near and scuttles back under. Front view.
 * docs/systems/fauna.md › Creatures and behaviour.
 */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import type { Rock } from '../../scene/geometry';
import { clamp, closestOnPolygon, dist, pointInPolygon, rangeOf } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { variantOf, type CreatureDef } from './lib/def';

/** Carapace width at perspective 1 (world units): about three times life size, so it reads (the bee is five). */
export const SAWAGANI_SIZE = 9;
export const SAWAGANI_VARIANTS = ['red', 'blue'] as const;
export type SawaganiMorph = (typeof SAWAGANI_VARIANTS)[number];

export const SAWAGANI_TUNING = {
  /** seconds out, then under its stone: by day it keeps mostly hidden, after dark it is out */
  outDay: [8, 20] as const,
  hideDay: [25, 70] as const,
  outNight: [30, 90] as const,
  hideNight: [5, 16] as const,
  /** the first outing after it appears */
  first: [0.6, 2.5] as const,
  /** under after a fright */
  hideScared: [6, 14] as const,
  /** world units / s at perspective 1 */
  sidle: 9,
  emerge: 4.5,
  scuttle: 32,
  /** how near each kind may come before it freezes (world units) */
  threats: { dipper: 80, bird: 70, heron: 170, yamasemi: 150 } as Record<string, number>,
  /** the rare blue-grey regional morph */
  blue: 0.1,
};

// ---------------------------------------------------------------------------------------------
// art

interface Colours {
  light: Pigment;
  shell: Pigment;
  deep: Pigment;
  legs: Pigment;
  claw: Pigment;
  clawWarm: Pigment;
  tip: Pigment;
}

function colours(morph: SawaganiMorph): Colours {
  if (morph === 'blue') {
    const shell = '#7f8fa8';
    return {
      shell,
      light: mix(shell, PIGMENTS.celadon, 0.35),
      deep: mix(shell, PIGMENTS.indigo, 0.45),
      legs: mix(shell, PIGMENTS.shadow, 0.3),
      claw: '#eceeee',
      clawWarm: mix('#eceeee', PIGMENTS.shadow, 0.35),
      tip: mix(PIGMENTS.indigo, PIGMENTS.sumi, 0.4),
    };
  }
  const shell = '#b5614a';
  return {
    shell,
    light: mix(shell, PIGMENTS.ochre, 0.35),
    deep: mix(mix(shell, PIGMENTS.crimson, 0.3), PIGMENTS.sumi, 0.35),
    legs: mix(shell, PIGMENTS.vermilion, 0.3),
    claw: '#efe6d8',
    clawWarm: mix('#efe6d8', PIGMENTS.apricot, 0.45),
    tip: mix(shell, PIGMENTS.sumi, 0.45),
  };
}

export interface SawaganiParts {
  shadow: Sprite; // the soft wet shadow under it, anchored on the ground under the body
  body: Sprite; // carapace and face, anchored at the body centre
  eyes: Sprite; // the stalked eyes, anchored at the body centre
  legs: [Sprite, Sprite, Sprite]; // standing, gait A, gait B: anchored at the body centre
  claw: Sprite; // the big right claw, anchored at its shoulder
  clawOpen: Sprite; // the same, fingers apart (raised)
  small: Sprite; // the smaller left claw (drawn mirrored), anchored at its shoulder
  size: number;
}

/** Hip, knee and tip of the right walking legs (front to back), in tenths of the carapace width from the body centre. */
const LEGS: readonly [Pt, Pt, Pt][] = [
  [{ x: 4.3, y: 1.2 }, { x: 6.9, y: 0.4 }, { x: 8.3, y: 3.6 }],
  [{ x: 4.9, y: 0.1 }, { x: 7.9, y: -0.9 }, { x: 9.8, y: 2.6 }],
  [{ x: 4.9, y: -1.1 }, { x: 7.9, y: -2.2 }, { x: 9.7, y: 1.0 }],
  [{ x: 4.3, y: -2.3 }, { x: 6.8, y: -3.4 }, { x: 8.3, y: -0.6 }],
];
/** Body centre above the ground, in tenths of the carapace width. */
const RIDE = 3.4;
const SHOULDER = { x: 2.3, y: 1.1 };
const EYE = { x: 2.3, y: 1.55 };

function paintCarapace(p: Painter, k: number, c: Colours): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * k, y: y * k });
  // a rounded square seen from the front and a little above: the front margin nearly straight
  const shell = smoothPolygon(
    [P(-4.4, 1.9), P(-2.2, 2.3), P(0, 2.35), P(2.2, 2.3), P(4.4, 1.9), P(5.1, 0.7), P(5.0, -1.2), P(4.2, -2.8), P(2.3, -3.6), P(0, -3.8), P(-2.3, -3.6), P(-4.2, -2.8), P(-5.0, -1.2), P(-5.1, 0.7)],
    2,
  );
  // the face under the front margin, in shadow, where the claws fold
  p.wash(blob(0, 2.55 * k, 3.4 * k, 0.85 * k, rng, { irregularity: 0.1 }), c.deep, { rng, opacity: 0.85, edge: 0.3, edgeWidth: 0.3 * k, deform: 0.08, blend: 'source-over' });
  p.wetInWet(shell, c.light, c.shell, {
    rng,
    angle: Math.PI / 2 + 0.55,
    split: 0.42,
    softness: 0.5,
    fingers: 0.45,
    opacity: 0.96,
    edge: 0.7,
    edgeWidth: 0.5 * k,
    deform: 0.06,
    granulation: 0.45,
    flow: 0.5,
    flowScale: 3 * k,
    blend: 'source-over',
  });
  const M = p.layer({ x: -6 * k, y: -5 * k, w: 12 * k, h: 8.5 * k });
  M.clip(shell);
  // the shell rounds off into deeper colour on its shaded right flank and along the front margin
  M.fill(blob(5.0 * k, 0.6 * k, 3.4 * k, 4.4 * k, rng, { rotation: 0.25 }), c.deep, 0.3);
  M.fill(blob(-5.2 * k, 0.6 * k, 1.6 * k, 3.2 * k, rng, { rotation: -0.2 }), c.deep, 0.18);
  M.fill(blob(0.4 * k, 2.3 * k, 5.2 * k, 1.0 * k, rng), c.deep, 0.34);
  M.dry({ opacity: 0.8, edge: 0, edgeWidth: 0.4 * k, sharpness: 0.1, flow: 0.5, flowScale: 2 * k, granulation: 0.3 });
  // wet gloss along the lit back edge
  p.dab(P(-1.6, -2.7), PIGMENTS.petalWhite, { rng, variant: 'leaf', angle: 0.25, length: 2.2 * k, width: 0.55 * k, opacity: 0.45, blend: 'source-over', layers: 3 });
}

function paintEyes(p: Painter, k: number, c: Colours): void {
  const rng = p.rng;
  const dark = mix(PIGMENTS.sumi, c.deep, 0.45);
  for (const s of [-1, 1]) {
    p.dab({ x: s * EYE.x * k * 0.95, y: (EYE.y + 0.55) * k }, mix(c.shell, c.deep, 0.5), { rng, variant: 'leaf', angle: -Math.PI / 2, length: 0.8 * k, width: 0.45 * k, opacity: 0.8 });
    p.dab({ x: s * EYE.x * k, y: EYE.y * k }, dark, { rng, variant: 'round', angle: 0, length: 0.62 * k, width: 0.58 * k, opacity: 0.9, edge: 0.6 });
  }
}

function legDab(p: Painter, rng: Rng, a: Pt, b: Pt, pig: Pigment, width: number, opacity: number): void {
  const len = dist(a, b);
  p.dab(a, pig, { rng, variant: 'leaf', angle: Math.atan2(b.y - a.y, b.x - a.x), length: len * 1.06, width, opacity, pool: 0.6, basePool: 0.2, curve: rng.range(-0.06, 0.06) });
}

function paintLegs(p: Painter, k: number, c: Colours, gait: 0 | 1 | 2): void {
  const rng = p.rng;
  const tipPig = mix(c.legs, c.deep, 0.55);
  for (const side of [-1, 1]) {
    LEGS.forEach(([hip, knee, tip], i) => {
      // alternate legs lift and reach between the two gait frames
      const up = gait === 0 ? 0 : (i + (side > 0 ? 0 : 1) + gait) % 2 === 0 ? 1 : -0.4;
      const K = { x: side * (knee.x + up * 0.3) * k, y: (knee.y - up * 0.5) * k };
      const T = { x: side * (tip.x + up * 0.7) * k, y: (tip.y - up * 0.9) * k };
      const H = { x: side * (hip.x - 0.6) * k, y: hip.y * k };
      const pig = mix(c.legs, i % 2 ? c.shell : c.light, rng.range(0.1, 0.4));
      // a flattened thigh, then the slimmer lower leg pointed at the tip
      legDab(p, rng, H, { x: K.x + (K.x - H.x) * 0.12, y: K.y + (K.y - H.y) * 0.12 }, pig, 1.0 * k, 0.88);
      legDab(p, rng, { x: K.x - (T.x - K.x) * 0.08, y: K.y - (T.y - K.y) * 0.08 }, T, mix(pig, c.legs, 0.5), 0.6 * k, 0.85);
      p.dab(K, mix(pig, c.deep, 0.4), { rng, variant: 'round', angle: 0, length: 0.62 * k, width: 0.55 * k, opacity: 0.7 });
      const d = { x: T.x - (T.x - K.x) * 0.28, y: T.y - (T.y - K.y) * 0.28 };
      legDab(p, rng, d, T, tipPig, 0.32 * k, 0.6);
    });
  }
}

/** One claw in its rest pose, shoulder at the origin, folded in front of the face, fingers inward (to −x). */
function paintClaw(p: Painter, k: number, c: Colours, big: boolean, open: boolean): void {
  const rng = p.rng;
  const g = big ? 1.3 : 0.95;
  const P = (x: number, y: number) => ({ x: x * k * g, y: y * k * g });
  // the arm: short and reddish, bent out and down to the wrist
  legDab(p, rng, P(0, 0), P(0.9, 1.4), mix(c.legs, c.deep, 0.25), 0.8 * k * g, 0.9);
  // palm and fixed finger in one milky shape, warmer at the wrist, a cool shade along the underside
  const hand = smoothPolygon([P(1.7, 0.9), P(2.3, 1.8), P(2.1, 2.8), P(1.1, 3.35), P(-0.4, 3.45), P(-2.0, 3.25), P(-0.7, 2.85), P(-0.3, 2.3), P(-0.2, 1.5), P(0.5, 0.95)], 1);
  p.wetInWet(hand, c.clawWarm, c.claw, { rng, angle: Math.PI + 0.4, split: 0.32, softness: 0.5, fingers: 0.3, opacity: 1, edge: 0.45, edgeWidth: 0.25 * k, deform: 0.05, blend: 'source-over' });
  p.glaze(blob(0.4 * k * g, 2.95 * k * g, 1.7 * k * g, 0.45 * k * g, rng, { rotation: -0.1 }), PIGMENTS.shadow, { rng, opacity: 0.35, edge: 0.15, deform: 0.12, fade: { angle: -Math.PI / 2, start: 0.35 } });
  // the moving finger hinged at the top of the palm
  const hinge = P(-0.1, 1.85);
  const ang = Math.PI - 0.32 - (open ? 0.55 : 0);
  const len = 1.75 * k * g;
  p.dab(hinge, c.claw, { rng, variant: 'leaf', angle: ang, length: len, width: 0.62 * k * g, opacity: 1, blend: 'source-over', layers: 4, pool: 0.35, curve: 0.12 });
  // darker horn at both finger tips
  const tip = { x: hinge.x + Math.cos(ang) * len * 0.8, y: hinge.y + Math.sin(ang) * len * 0.8 };
  p.dab(tip, c.tip, { rng, variant: 'leaf', angle: ang, length: len * 0.3, width: 0.26 * k * g, opacity: 0.65 });
  p.dab(P(-1.5, 3.2), c.tip, { rng, variant: 'leaf', angle: Math.PI + 0.12, length: 0.6 * k * g, width: 0.26 * k * g, opacity: 0.55 });
}

export interface SawaganiPose {
  /** 0 standing, 1 or 2 a gait frame */
  gait: 0 | 1 | 2;
  bob: number;
  tilt: number;
  /** eyes up, claws guarding (0..1) */
  alert: number;
  /** which claw picks (0 the small one, 1 the big one) and how far down it is (0..1) */
  pickClaw: number;
  pick: number;
  /** the big claw raised (0..1) */
  raise: number;
}

export const REST_POSE: SawaganiPose = { gait: 0, bob: 0, tilt: 0, alert: 0, pickClaw: 0, pick: 0, raise: 0 };

function drawClaw(ctx: Ctx, s: Sprite, k: number, side: 1 | -1, pick: number, lift: number): void {
  ctx.save();
  ctx.translate(side * SHOULDER.x * k, SHOULDER.y * k);
  ctx.scale(side, 1);
  ctx.translate(0, pick * 1.2 * k);
  ctx.rotate(-lift + pick * 0.3);
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

/** The crab at the origin (the ground under its body), in world units: shadow, legs, shell, eyes, claws. */
export function drawSawagani(ctx: Ctx, parts: SawaganiParts, pose: SawaganiPose): void {
  const k = parts.size / 10;
  const sh = parts.shadow;
  ctx.save();
  ctx.globalAlpha *= 0.7;
  ctx.drawImage(sh.img as CanvasImageSource, -sh.ox, -sh.oy, sh.w, sh.h);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -(RIDE * k) - pose.bob * k);
  ctx.rotate(pose.tilt);
  const legs = parts.legs[pose.gait];
  ctx.drawImage(legs.img as CanvasImageSource, -legs.ox, -legs.oy, legs.w, legs.h);
  const b = parts.body;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  const e = parts.eyes;
  ctx.drawImage(e.img as CanvasImageSource, -e.ox, -e.oy - pose.alert * 0.7 * k, e.w, e.h);
  // picking dips one claw to the moss; raising lifts the big one up beside the eyes, fingers open
  const guard = pose.alert * 0.35;
  drawClaw(ctx, parts.small, k, -1, pose.pickClaw === 0 ? pose.pick : 0, guard);
  const up = pose.raise * pose.raise * (3 - 2 * pose.raise);
  drawClaw(ctx, up > 0.5 ? parts.clawOpen : parts.claw, k, 1, pose.pickClaw === 1 ? pose.pick : 0, Math.max(guard, up * 1.7));
  ctx.restore();
}

export function paintSawagani(res: number, seed: number, morph: SawaganiMorph = 'red'): SawaganiParts {
  const S = SAWAGANI_SIZE;
  const k = S / 10;
  const c = colours(morph);
  const body = paintSprite(res, { w: 12 * k, h: 9 * k, ox: 6 * k, oy: 4.8 * k }, seed, (p) => paintCarapace(p, k, c));
  const eyes = paintSprite(res, { w: 6.5 * k, h: 3.4 * k, ox: 3.25 * k, oy: 0.8 * k + 0.0 }, seed + 1, (p) => paintEyes(p, k, c));
  const legBox = { w: 24 * k, h: 10.5 * k, ox: 12 * k, oy: 5.8 * k };
  const legs = ([0, 1, 2] as const).map((g) => paintSprite(res, legBox, seed + 2 + g, (p) => paintLegs(p, k, c, g))) as SawaganiParts['legs'];
  const clawBox = { w: 6.5 * k, h: 6.2 * k, ox: 3.3 * k, oy: 0.9 * k };
  const claw = paintSprite(res, clawBox, seed + 6, (p) => paintClaw(p, k, c, true, false));
  const clawOpen = paintSprite(res, clawBox, seed + 6, (p) => paintClaw(p, k, c, true, true));
  const small = paintSprite(res, clawBox, seed + 7, (p) => paintClaw(p, k, c, false, false));
  const shadow = paintSprite(res, { w: 20 * k, h: 5 * k, ox: 10 * k, oy: 2.5 * k }, seed + 8, (p, rng) => {
    p.glaze(blob(0, 0, 7.5 * k, 1.5 * k, rng, { irregularity: 0.1 }), mix(PIGMENTS.shadow, PIGMENTS.sumi, 0.3), { rng, opacity: 0.3, edge: 0, sharpness: 0.1, deform: 0.15, fade: { angle: -Math.PI / 2, start: 0.1, amount: 0.7 } });
  });
  return { shadow, body, eyes, legs, claw, clawOpen, small, size: S };
}

/** The assembled crab as one sprite (studio sheet). */
export function sawaganiPortrait(res: number, seed: number, morph: SawaganiMorph, pose: SawaganiPose): Sprite {
  const parts = paintSawagani(res, seed, morph);
  const k = parts.size / 10;
  return paintSprite(res, { w: 24 * k, h: 14 * k, ox: 12 * k, oy: 10.5 * k }, seed, (p) => drawSawagani(p.ctx, parts, pose));
}

// ---------------------------------------------------------------------------------------------
// where it lives (pure)

/** A wet stone and the side of it a crab lives under: its den, the door it comes out by, the spots it forages. */
export interface CrabHome {
  rock: Rock;
  side: 1 | -1;
  /** behind the stone's foot, out of sight */
  den: Pt;
  /** just clear of the stone's side, at the waterline */
  door: Pt;
  /** on the stone's lower face (`face`) or along its foot (`foot`) */
  spots: (Pt & { on: 'face' | 'foot' })[];
}

type Waters = Pick<FaunaWorld, 'pond' | 'water' | 'view'>;

/** In the water the layers clip to (pool with its foam, streams) but in neither the still water nor a stream: the foam. */
export function inFoam(p: Pt, w: Pick<FaunaWorld, 'pond' | 'water'>, margin = 0): boolean {
  const probe = margin > 0 ? [p, { x: p.x - margin, y: p.y }, { x: p.x + margin, y: p.y }, { x: p.x, y: p.y - margin * 0.5 }, { x: p.x, y: p.y + margin * 0.5 }] : [p];
  return probe.some((q) => w.water.clip.some((c) => pointInPolygon(q, c)) && !pointInPolygon(q, w.pond.world) && !w.water.moving.some((m) => pointInPolygon(q, m)));
}

/** Distance to the nearest water edge (still water or a stream); Infinity without water. */
export function waterlineDistance(p: Pt, w: Pick<FaunaWorld, 'pond' | 'water'>): number {
  let d = Infinity;
  for (const poly of [w.pond.world, ...w.water.moving]) if (poly.length >= 3) d = Math.min(d, closestOnPolygon(p, poly).d);
  return d;
}

function inView(p: Pt, w: Waters, margin: number): boolean {
  const v = w.view;
  return p.x > v.x + margin && p.x < v.x + v.w - margin && p.y > v.y + margin && p.y < v.y + v.h - margin;
}

/** Off the stone, a spot is at the waterline (within a few units of it) and clear of the foam. */
function goodFoot(p: Pt, w: Waters): boolean {
  return inView(p, w, 40) && waterlineDistance(p, w) <= 12 && !inFoam(p, w, 8);
}

/** Every wet stone side a crab could live under: its door and foot spots at the waterline, none in or near the foam. */
export function crabHomes(w: Pick<FaunaWorld, 'pond' | 'water' | 'view' | 'scene'>): CrabHome[] {
  const out: CrabHome[] = [];
  for (const rock of w.scene.rocks) {
    for (const side of [1, -1] as const) {
      const half = rock.w * 0.5;
      const door = { x: rock.x + side * (half + 6), y: rock.y + 1 };
      if (!goodFoot(door, w)) continue;
      const den = { x: rock.x + side * Math.max(2, half - 9), y: rock.y - 1.5 };
      const spots: CrabHome['spots'] = [];
      for (const u of [0.14, 0.26, 0.38]) {
        for (const v of [0.1, 0.2]) {
          const q = { x: rock.x + side * rock.w * u, y: rock.y - rock.h * v, on: 'face' as const };
          if (inView(q, w, 40) && !inFoam(q, w, 6)) spots.push(q);
        }
      }
      for (const dx of [3, 9]) {
        const q = { x: door.x + side * dx, y: door.y + (dx > 5 ? 2 : 0), on: 'foot' as const };
        if (goodFoot(q, w)) spots.push(q);
      }
      if (spots.length >= 2) out.push({ rock, side, den, door, spots });
    }
  }
  return out;
}

const homeCache = new WeakMap<object, { key: string; homes: CrabHome[] }>();

/** `crabHomes`, cached per scene, water and view (upkeep asks every frame). */
export function homesOf(w: Pick<FaunaWorld, 'pond' | 'water' | 'view' | 'scene'>): CrabHome[] {
  const key = `${w.view.x},${w.view.y},${w.view.w},${w.view.h},${w.pond.world.length},${w.water.moving.length}`;
  const hit = homeCache.get(w.scene);
  if (hit && hit.key === key) return hit.homes;
  const homes = crabHomes(w);
  homeCache.set(w.scene, { key, homes });
  return homes;
}

/** The nearest bird close enough to frighten it (its distance over the kind's reach, < 1), or null. */
export function threatNear(at: Pt, creatures: readonly { kind: string; x: number; y: number; done: boolean }[]): number | null {
  let worst: number | null = null;
  for (const c of creatures) {
    const reach = SAWAGANI_TUNING.threats[c.kind];
    if (!reach || c.done) continue;
    const k = dist(c, at) / reach;
    if (k < 1 && (worst === null || k < worst)) worst = k;
  }
  return worst;
}

// ---------------------------------------------------------------------------------------------

type Pace = 'emerge' | 'sidle' | 'scuttle';

export class Sawagani extends BaseCreature {
  readonly kind = 'sawagani' as const;
  readonly visitor = false;
  readonly home: CrabHome;
  readonly morph: SawaganiMorph;
  private pos: Pt;
  private path: (Pt & { den: boolean })[] = [];
  private pace: Pace = 'sidle';
  private behind = true;
  private hideFor: number;
  private outFor = 0;
  private dwell = 0;
  private pause = 0;
  private scale = 1;
  private gait = 0;
  private moving = false;
  /** claws: which one is picking, its phase, and the big claw's raise (0..1) */
  private pickClaw = 0;
  private pickT = -1;
  private pickGap = 0.5;
  private raise = 0;
  private raiseFor = 0;
  private alert = 0;
  private freezeFor = 0;
  private resumeTo: string = 'forage';
  private watch = 0;
  private seenRes = 0;
  private tilt = 0;
  private wake = 0;

  constructor(w: FaunaWorld, home: CrabHome, morph: SawaganiMorph) {
    super();
    this.home = home;
    this.morph = morph;
    this.variant = morph;
    this.pos = { ...home.den };
    this.layer = 'entities';
    this.state = 'hidden';
    this.hideFor = rangeOf(w.rng, [...SAWAGANI_TUNING.first]) / w.speed;
    this.scale = w.perspective(home.rock.y, home.rock.x);
    this.seenRes = w.art.res;
    this.alpha = 0;
    this.sync();
  }

  /** Out from under its stone (for tests and the arrival line). */
  get out(): boolean {
    return this.state !== 'hidden';
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  private walkTo(points: Pt[], pace: Pace): void {
    this.path = points.map((p) => ({ x: p.x, y: p.y, den: p === this.home.den }));
    this.pace = pace;
  }

  private speed(w: FaunaWorld): number {
    const base = this.pace === 'scuttle' ? SAWAGANI_TUNING.scuttle : this.pace === 'emerge' ? SAWAGANI_TUNING.emerge : SAWAGANI_TUNING.sidle;
    return base * this.scale * w.speed;
  }

  /** Back the way it came: to the door, then under. */
  private homeward(pace: Pace): void {
    const h = this.home;
    const pts = this.behind ? [h.den] : [h.door, h.den];
    this.walkTo(pts, pace);
  }

  private pickSpot(w: FaunaWorld): Pt {
    const spots = this.home.spots.filter((s) => dist(s, this.pos) > 2.5);
    const s = spots.length ? w.rng.pick(spots) : this.home.door;
    return { x: s.x + w.rng.range(-1.2, 1.2), y: s.y + w.rng.range(-0.8, 0.8) };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    const sf = w.speed;
    const night = w.mode.night;
    this.scale = w.perspective(this.home.rock.y, this.pos.x);
    this.alert = Math.max(0, this.alert - dt * 0.6);
    if (this.state !== 'hidden') this.senses(dt, w);
    this.moving = false;
    switch (this.state) {
      case 'hidden':
        if (this.leaving) {
          this.done = true;
          break;
        }
        if (this.timer > this.hideFor) {
          // out by the door, in little stops, looking about
          this.walkTo([this.home.door], 'emerge');
          this.pause = w.rng.range(0.3, 0.9) / sf;
          this.outFor = rangeOf(w.rng, night ? [...SAWAGANI_TUNING.outNight] : [...SAWAGANI_TUNING.outDay]) / sf;
          this.go('emerge');
        }
        break;
      case 'emerge':
        if (this.step(dt, w)) {
          this.behind = false;
          this.dwell = w.rng.range(1.5, 4) / sf;
          this.go('forage');
        }
        break;
      case 'forage':
        this.forage(dt, w);
        if (this.leaving || this.timer > this.outFor) {
          this.homeward('sidle');
          this.go('return');
        }
        break;
      case 'sidle':
        if (this.step(dt, w)) {
          this.dwell = w.rng.range(2.5, 7) / sf;
          this.tilt = w.rng.range(-0.12, 0.12);
          this.go('forage');
        }
        break;
      case 'freeze':
        this.freezeFor -= dt;
        this.alert = 1;
        if (this.freezeFor <= 0) {
          const threat = threatNear(this.pos, w.creatures);
          if (threat !== null || this.resumeTo === 'flee') {
            this.homeward('scuttle');
            this.go('flee');
          } else this.go(this.resumeTo === 'sidle' && this.path.length ? 'sidle' : 'forage');
        }
        break;
      case 'flee':
      case 'return':
        if (this.step(dt, w)) {
          this.behind = true;
          const scared = this.state === 'flee';
          this.hideFor = rangeOf(w.rng, scared ? [...SAWAGANI_TUNING.hideScared] : night ? [...SAWAGANI_TUNING.hideNight] : [...SAWAGANI_TUNING.hideDay]) / sf;
          this.raise = 0;
          this.pickT = -1;
          this.go('hidden');
        }
        break;
    }
    // it fades under the stone's foot, in case nothing in front of it hides it there
    const under = dist(this.pos, this.home.den);
    this.alpha = this.state === 'hidden' ? 0 : clamp(under / 5, 0, 1);
    this.sync();
  }

  /** Watches for birds and for the camera coming close (the paint resolution rises when a close view rests). */
  private senses(dt: number, w: FaunaWorld): void {
    if (this.state === 'freeze' || this.state === 'flee') return;
    this.watch -= dt;
    let fright: 'bird' | 'camera' | null = null;
    if (this.watch <= 0) {
      this.watch = 0.25;
      if (threatNear(this.pos, w.creatures) !== null) fright = 'bird';
    }
    const res = w.art.res;
    if (res > this.seenRes * 1.15) fright ??= 'camera';
    this.seenRes = res;
    if (!fright) return;
    if (this.state === 'return') {
      // already on its way home: it just hurries
      this.pace = 'scuttle';
      this.state = 'flee';
      return;
    }
    if (this.state === 'emerge') this.resumeTo = 'flee';
    else this.resumeTo = this.state === 'sidle' ? 'sidle' : fright === 'camera' && w.rng.chance(0.45) ? 'flee' : 'forage';
    this.freezeFor = (fright === 'bird' ? w.rng.range(0.5, 1.4) : w.rng.range(1.5, 3.5)) / w.speed;
    this.raise = Math.min(this.raise, 0.3);
    this.pickT = -1;
    this.go('freeze');
  }

  private forage(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const rng = w.rng;
    // the big claw goes up now and then, fingers open
    if (this.raiseFor > 0) {
      this.raiseFor -= dt;
      this.raise = Math.min(1, this.raise + dt * 4 * sf);
      return;
    }
    this.raise = Math.max(0, this.raise - dt * 3 * sf);
    if (rng.chance((dt * sf) / 14)) {
      this.raiseFor = rng.range(1, 2.4) / sf;
      this.pickT = -1;
      return;
    }
    // picking: one claw down to the moss and up to the mouth, in bursts
    if (this.pickT >= 0) {
      this.pickT += (dt * sf) / 0.62;
      if (this.pickT >= 1) {
        this.pickT = -1;
        this.pickGap = (rng.chance(0.7) ? rng.range(0.1, 0.35) : rng.range(0.8, 2.2)) / sf;
      }
    } else {
      this.pickGap -= dt;
      if (this.pickGap <= 0) {
        this.pickT = 0;
        this.pickClaw = rng.chance(0.5) ? 0 : 1;
      }
    }
    this.dwell -= dt;
    if (this.dwell <= 0 && this.raise <= 0) {
      this.walkTo([this.pickSpot(w)], 'sidle');
      this.pickT = -1;
      this.go('sidle');
    }
  }

  /** Walk the path; true once at its end. Behind the stone while going to or from its den. */
  private step(dt: number, w: FaunaWorld): boolean {
    if (this.pause > 0) {
      this.pause -= dt;
      return false;
    }
    const to = this.path[0];
    if (!to) return true;
    const d = dist(this.pos, to);
    const s = this.speed(w) * dt;
    this.moving = true;
    this.gait += dt * w.speed * (this.pace === 'scuttle' ? 16 : 7);
    if (d <= s) {
      this.pos = { x: to.x, y: to.y };
      this.path.shift();
    } else {
      this.pos = { x: this.pos.x + ((to.x - this.pos.x) / d) * s, y: this.pos.y + ((to.y - this.pos.y) / d) * s };
      // cautious: a stop or two on the way out
      if (this.pace === 'emerge' && w.rng.chance(dt / 1.2)) this.pause = w.rng.range(0.4, 1.2) / w.speed;
    }
    const next = this.path[0];
    this.behind = this.state === 'emerge' ? next !== undefined : next !== undefined ? next.den === true : this.behind;
    this.ripples(dt, w);
    return this.path.length === 0;
  }

  private ripples(dt: number, w: FaunaWorld): void {
    this.wake -= dt;
    if (this.wake > 0 || waterlineDistance(this.pos, w) > 0 || !pointInPolygon(this.pos, w.pond.world)) return;
    this.wake = w.rng.range(0.6, 1.2) / w.speed;
    w.ripple(this.pos.x, this.pos.y + 0.5, 6 * this.scale, 0.25);
  }

  override leave(): void {
    this.leaving = true;
  }

  override depth(): number {
    // in front of its stone when out, behind its foot when under
    return this.home.rock.y + (this.behind ? -0.5 : 0.5);
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'entities' || this.state === 'hidden' || this.alpha <= 0.01) return;
    const id = this.id % 2;
    const parts = w.art.get(`sawagani:${this.morph}:${id}`, (res) => paintSawagani(res, 2300 + id * 13, this.morph));
    ctx.save();
    ctx.globalAlpha *= this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    drawSawagani(ctx, parts, this.pose());
    ctx.restore();
  }

  /** How it holds itself right now (for drawing). */
  pose(): SawaganiPose {
    return {
      gait: this.moving ? (1 + (Math.floor(this.gait) % 2)) as 1 | 2 : 0,
      bob: this.moving ? Math.abs(Math.sin(this.gait * Math.PI)) * 0.25 : 0,
      tilt: this.tilt,
      alert: this.alert,
      pickClaw: this.pickClaw,
      pick: this.pickT >= 0 ? Math.sin(this.pickT * Math.PI) : 0,
      raise: this.raise,
    };
  }
}

/** Choose a home stone for a new crab: one no other crab lives under. */
export function chooseHome(homes: readonly CrabHome[], taken: readonly CrabHome[], rng: Rng): CrabHome | null {
  const free = homes.filter((h) => taken.every((t) => t.rock.id !== h.rock.id));
  if (free.length === 0) return null;
  return rng.pick(free);
}

const sawagani: CreatureDef = {
  kind: 'sawagani',
  title: 'sawagani crab',
  role: 'resident',
  rank: 4,
  variants: SAWAGANI_VARIANTS,
  // one under its stone by day, a second one comes out after dark
  resident: (n, mode) => (n > 0 ? (mode.night && !mode.reduced ? 2 : 1) : 0),
  needs: (w) => homesOf(w).length > 0,
  spawn(w, s) {
    const homes = homesOf(w);
    const taken = w.creatures.filter((c): c is Sawagani => c instanceof Sawagani && !c.done).map((c) => c.home);
    const out: Sawagani[] = [];
    for (let i = 0; i < s.count; i++) {
      const home = chooseHome(homes, taken, w.rng);
      if (!home) break;
      const morph = variantOf(s.variants, SAWAGANI_VARIANTS, w.rng, () => (w.rng.chance(SAWAGANI_TUNING.blue) ? 'blue' : 'red'));
      out.push(new Sawagani(w, home, morph));
      taken.push(home);
    }
    return out;
  },
  sheet: {
    w: 640,
    h: 150,
    make(res, seed) {
      const a = paintSawagani(res, seed, 'red');
      return [
        sawaganiPortrait(res, seed, 'red', REST_POSE),
        sawaganiPortrait(res, seed, 'red', { ...REST_POSE, gait: 1, raise: 1, alert: 1 }),
        sawaganiPortrait(res, seed, 'blue', { ...REST_POSE, pick: 1 }),
        a.body,
        a.legs[1],
        a.claw,
        a.clawOpen,
      ];
    },
  },
  show: { stage: 'falls', spec: { w: 300, h: 190 }, w: 570, h: 361, order: 22 },
};
export default sawagani;
