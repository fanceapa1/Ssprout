/** Violet dropwing (Trithemis annulata): the oasis's dragonfly. A magenta dash on a post or stone by the
 * water, wings drooped forward and down; darts out over the basin and the seguia and back, raises its
 * abdomen in the heat, and a second male is chased off. Side view, facing right. docs/devlog/161-violet-dropwing.md */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { approach, arrive, clamp, closestOnPolygon, dist, lerp, pointInPolygon, rangeOf, springStep, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import { variantOf, type CreatureDef } from './lib/def';
import { exitPoint } from './lib/flight';

/** Head to abdomen tip at perspective 1 (world units): a small dragonfly beside the bunting (17). */
export const DROPWING_SIZE = 15;
export const DROPWING_SEXES = ['male', 'female'] as const;
export type DropwingSex = (typeof DROPWING_SEXES)[number];

export const DROPWING_TUNING = {
  /** seconds still on a perch between sallies */
  perch: [3, 11] as const,
  /** darting speed (world units / s at perspective 1) and how hard it turns */
  dart: 150,
  accel: 900,
  /** a sally: how far out over the water, and the pause at each turn (a midge taken) */
  reach: [18, 85] as const,
  catchHold: [0.12, 0.45] as const,
  /** height over the water in flight (world units at perspective 1) */
  alt: [5, 18] as const,
  /** after a sally: back to the same perch, else a nearby one */
  same: 0.68,
  /** chance a perch spell is spent in the obelisk posture, and how far the abdomen lifts (rad) */
  obelisk: 0.35,
  obeliskLift: [0.75, 1.25] as const,
  /** a rival male within this many units of its perch is chased */
  territory: 110,
  chase: [2.2, 4.5] as const,
  /** wingbeats a second (aliased by the frame rate into a flicker) */
  hz: 27,
  /** perches of these kinds, weighted: posts and stone tips first */
  weights: { post: 3, rock: 2, rim: 1, wall: 0.7 } as Record<string, number>,
  /** a wall coping counts only this close to water */
  wallWater: 60,
  /** a perch is held when another creature's spot is this close beyond its spread */
  hold: 10,
};

/** Design units: head tip +4.5 to abdomen tip −25.5 (30 long), scaled to the size. */
const D = 30;
const K = DROPWING_SIZE / D;
const FEET = { x: 0.9 * K, y: 4.4 * K };
const ROOT = { x: -1.3 * K, y: 1.5 * K };
const FORE = { x: 0.6 * K, y: 0 };
const HIND = { x: -0.7 * K, y: 0.25 * K };

interface Colours {
  body: Pigment;
  light: Pigment;
  bloom: Pigment;
  dark: Pigment;
  eye: Pigment;
  vein: Pigment;
  amber: Pigment;
  stigma: Pigment;
}

function colours(sex: DropwingSex): Colours {
  // research palette: magenta #b04f7e, light #c97aa0, amber wing bases #d9a05a
  if (sex === 'male') {
    return { body: '#b04f7e', light: '#c97aa0', bloom: '#a99ad0', dark: mix(PIGMENTS.sumi, '#7a2a52', 0.5), eye: '#9a3058', vein: '#b04a4a', amber: '#d9a05a', stigma: '#a0503a' };
  }
  return { body: '#c09a4e', light: '#dcc07c', bloom: '#d8c8a0', dark: mix(PIGMENTS.sumi, '#6e5430', 0.55), eye: '#8a6a48', vein: '#a88450', amber: '#dcae62', stigma: '#8a6a3c' };
}

export interface DropwingParts {
  /** head, thorax and gripping legs, anchored at the wing base (`FEET` below it) */
  perched: Sprite;
  /** head and thorax with the legs tucked, same anchor */
  flying: Sprite;
  /** the abdomen, anchored at its root, pointing back (−x) */
  abdomen: Sprite;
  /** one wing each, span along +x from its base, leading edge up */
  fore: Sprite;
  hind: Sprite;
  sex: DropwingSex;
}

function wingShape(hind: boolean): Pt[] {
  const s = K;
  const L = hind ? 21.5 : 22.5;
  const base = hind ? 3.4 : 1.6;
  return smoothPolygon(
    [
      { x: 0.2 * s, y: -0.5 * s },
      { x: 0.25 * L * s, y: -1.6 * s },
      { x: 0.6 * L * s, y: -1.95 * s },
      { x: 0.9 * L * s, y: -1.7 * s },
      { x: L * s, y: -0.6 * s },
      { x: 0.97 * L * s, y: 0.8 * s },
      { x: 0.8 * L * s, y: 1.8 * s },
      { x: 0.5 * L * s, y: 2.25 * s },
      { x: 0.22 * L * s, y: (2.0 + base * 0.45) * s },
      { x: 0.08 * L * s, y: (1.1 + base) * s },
      { x: 0.2 * s, y: 1.0 * s },
    ],
    2,
  );
}

function paintWing(p: Painter, c: Colours, hind: boolean, sex: DropwingSex): void {
  const rng = p.rng;
  const s = K;
  const L = hind ? 21.5 : 22.5;
  const shape = wingShape(hind);
  // glass: the faintest cool wash, lost toward the tip
  p.wash(shape, mix(PIGMENTS.shadow, PIGMENTS.celadon, 0.35), { rng, opacity: 0.16, edge: 0.55, edgeWidth: 0.35, deform: 0.04, spread: 0.04, fade: { angle: Math.PI, start: 0.4, amount: 0.5 }, blend: 'source-over' });
  // the amber patch at the base, wet and soft, larger on the hind wing
  const patch = smoothPolygon(
    hind
      ? [{ x: 1.8 * s, y: -0.5 * s }, { x: 3.8 * s, y: -0.9 * s }, { x: 4.8 * s, y: 0.6 * s }, { x: 4.0 * s, y: 2.6 * s }, { x: 2.4 * s, y: 3.4 * s }, { x: 1.6 * s, y: 1.4 * s }]
      : [{ x: 0.6 * s, y: -0.3 * s }, { x: 1.6 * s, y: -0.6 * s }, { x: 2.0 * s, y: 0.2 * s }, { x: 1.4 * s, y: 1.0 * s }, { x: 0.6 * s, y: 0.8 * s }],
    2,
  );
  const L1 = p.layer({ x: -1 * s, y: -3 * s, w: (L + 2) * s, h: 9 * s });
  L1.clip(shape);
  L1.fill(patch, c.amber, (sex === 'male' ? 0.7 : 0.55) * (hind ? 1 : 0.6));
  L1.dry({ opacity: 0.8, edge: 0.3, edgeWidth: 0.5, sharpness: 0.15, flow: 0.6, flowScale: 2 });
  // red veins: the leading edge, a few long veins, faint and broken
  p.inkLine([{ x: 0.3 * s, y: -0.45 * s }, { x: 0.3 * L * s, y: -1.3 * s }, { x: 0.75 * L * s, y: -1.5 * s }, { x: 0.98 * L * s, y: -0.8 * s }], { rng, width: 0.16 * s, opacity: 0.75, breaks: 0.1, wobble: 0.1, taper: [0.1, 0.4], pigment: c.vein });
  for (let i = 0; i < 4; i++) {
    const y0 = (-0.2 + i * 0.35) * s;
    const y1 = (-0.9 + i * 0.62) * s;
    p.inkLine([{ x: 0.6 * s, y: y0 }, { x: 0.45 * L * s, y: lerp(y0, y1, 0.7) }, { x: 0.9 * L * s, y: y1 }], { rng, width: 0.08 * s, opacity: 0.38, breaks: 0.4, wobble: 0.25, pigment: c.vein });
  }
  // the pterostigma near the tip of the leading edge
  p.dab({ x: 0.86 * L * s, y: -1.3 * s }, c.stigma, { rng, variant: 'round', angle: 0.1, length: 1.4 * s, width: 0.42 * s, opacity: 0.85, layers: 4 });
  // a glint of reserved paper across the glass
  p.stroke([{ x: 0.35 * L * s, y: -0.7 * s }, { x: 0.62 * L * s, y: -0.2 * s }, { x: 0.8 * L * s, y: 0.4 * s }], { rng, pigment: PIGMENTS.petalWhite, width: 0.4 * s, taper: [0.5, 0.5], wobble: 0, wetness: 0.2, opacity: 0.3, edge: 0.05, edgeWidth: 0.1 });
}

/** The abdomen from its root (0, 0) back along −x, drooping a little and stout near the base. */
function abdomenLine(rng: Rng): Pt[] {
  const s = K;
  return [
    { x: 0, y: 0 },
    { x: -4 * s, y: (0.45 + rng.range(-0.05, 0.05)) * s },
    { x: -10 * s, y: (0.75 + rng.range(-0.08, 0.08)) * s },
    { x: -17 * s, y: (0.8 + rng.range(-0.08, 0.08)) * s },
    { x: -21.5 * s, y: 0.55 * s },
    { x: -23.4 * s, y: 0.3 * s },
  ];
}

function paintAbdomen(p: Painter, c: Colours, sex: DropwingSex): void {
  const rng = p.rng;
  const s = K;
  const line = abdomenLine(rng);
  // one wet stroke, stout at segments 2–3 and tapering; the colour pools along the belly
  p.stroke(line, { rng, pigment: c.body, width: 2.2 * s, taper: [0.15, 0.25], pressure: [1.1, 1.15, 1.05, 0.95, 0.85, 0.65], wobble: 0.04, wetness: 0.7, opacity: 0.95, edge: 0.4, edgeWidth: 0.22, flow: 0.5, flowScale: 2 });
  p.stroke(line.map((q) => ({ x: q.x, y: q.y + 0.45 * s })), { rng, pigment: c.dark, width: 0.7 * s, taper: [0.2, 0.3], wobble: 0.08, wetness: 0.7, opacity: 0.35, edge: 0.1, edgeWidth: 0.2 });
  // the bluish bloom along the back (the male's pruinescence), broken
  for (let k = 0; k < 6; k++) {
    const u = 0.05 + k * 0.14 + rng.range(-0.02, 0.02);
    const a = along(line, u);
    const b = along(line, u + rng.range(0.07, 0.11));
    p.stroke([{ x: a.x, y: a.y - 0.45 * s }, { x: b.x, y: b.y - 0.42 * s }], { rng, pigment: k < 4 ? c.bloom : c.light, width: 0.5 * s, taper: [0.4, 0.4], wobble: 0, wetness: 0.4, opacity: rng.range(0.35, 0.6), edge: 0.1, edgeWidth: 0.15, blend: 'source-over' });
  }
  // faint joints, and the dark dorsal marks of the last segments
  for (let k = 1; k < 9; k++) {
    const q = along(line, k * 0.11);
    p.dab({ x: q.x, y: q.y }, c.dark, { rng, variant: 'round', angle: Math.PI / 2, length: 1.2 * s, width: 0.18 * s, opacity: rng.range(0.12, 0.22) });
  }
  for (const u of sex === 'male' ? [0.8, 0.88] : [0.35, 0.5, 0.65, 0.8, 0.88]) {
    const q = along(line, u);
    p.dab({ x: q.x, y: q.y - 0.35 * s }, c.dark, { rng, variant: 'leaf', angle: 0, length: 1.3 * s, width: 0.45 * s, opacity: sex === 'male' ? 0.55 : 0.6 });
  }
  const tip = line[line.length - 1]!;
  p.dab({ x: tip.x - 0.3 * s, y: tip.y }, c.dark, { rng, variant: 'leaf', angle: Math.PI - 0.15, length: 1.0 * s, width: 0.4 * s, opacity: 0.8 });
}

function paintBody(p: Painter, c: Colours, legs: 'grip' | 'tuck'): void {
  const rng = p.rng;
  const s = K;
  // the thorax: stout, slanted back; wet magenta with the bloom on the shoulder
  const thorax = smoothPolygon(
    [
      { x: -1.8 * s, y: 0.3 * s },
      { x: -0.5 * s, y: -0.6 * s },
      { x: 1.2 * s, y: -0.55 * s },
      { x: 2.6 * s, y: 0.5 * s },
      { x: 3.0 * s, y: 2.0 * s },
      { x: 2.2 * s, y: 3.1 * s },
      { x: 0.4 * s, y: 3.2 * s },
      { x: -1.1 * s, y: 2.6 * s },
      { x: -1.9 * s, y: 1.5 * s },
    ],
    2,
  );
  p.wetInWet(thorax, c.light, c.body, { rng, angle: Math.PI / 2, split: 0.15, softness: 0.4, fingers: 0.4, opacity: 0.95, edge: 0.4, edgeWidth: 0.3, sharpness: 0.4, deform: 0.05, spread: 0.06, flow: 0.4, flowScale: 2, blend: 'source-over' });
  p.glaze(thorax, c.dark, { rng, opacity: 0.25, edge: 0.2, edgeWidth: 0.3, deform: 0.05, fade: { angle: -Math.PI / 2, start: 0.45 } });
  p.dab({ x: 0.4 * s, y: -0.1 * s }, c.bloom, { rng, variant: 'leaf', angle: 0.2, length: 2.8 * s, width: 0.6 * s, opacity: 0.55, blend: 'source-over', edge: 0.1 });
  p.inkLine([{ x: 0.2 * s, y: 0.2 * s }, { x: 1.0 * s, y: 1.6 * s }, { x: 1.6 * s, y: 2.9 * s }], { rng, width: 0.22 * s, opacity: 0.3, breaks: 0.3, wobble: 0.2, taper: [0.2, 0.3], pigment: c.dark });

  // the head: big red-violet eyes meeting on top, a paler face below
  const head = blob(3.5 * s, 1.0 * s, 1.35 * s, 1.3 * s, rng, { irregularity: 0.1, rotation: 0.3 });
  p.wash(head, c.eye, { rng, opacity: 0.95, edge: 0.5, edgeWidth: 0.25, centreLift: 0.12, deform: 0.04, spread: 0.05, flow: 0.4, flowScale: 1.5, blend: 'source-over' });
  p.dab({ x: 4.2 * s, y: 1.9 * s }, c.light, { rng, variant: 'round', angle: 0.4, length: 1.1 * s, width: 0.7 * s, opacity: 0.6 });
  p.dab({ x: 3.7 * s, y: 0.45 * s }, PIGMENTS.petalWhite, { rng, variant: 'leaf', angle: -0.5, length: 0.8 * s, width: 0.3 * s, opacity: 0.55, blend: 'source-over' });

  // legs: gripping the tip below, or tucked under the thorax in flight
  const hips = [
    { x: 2.0 * s, y: 2.9 * s },
    { x: 1.1 * s, y: 3.1 * s },
    { x: 0.2 * s, y: 3.0 * s },
  ];
  const legPig = mix(PIGMENTS.sumi, c.dark, 0.3);
  hips.forEach((h, i) => {
    const pts =
      legs === 'grip'
        ? [h, { x: h.x + (1.0 - i * 0.9) * s, y: h.y + 0.8 * s }, { x: FEET.x / K * s + (1.6 - i * 1.6) * s, y: FEET.y + rng.range(-0.08, 0.08) * s }]
        : [h, { x: h.x + (0.8 - i * 0.3) * s, y: h.y + 0.6 * s }, { x: h.x + (1.5 - i * 0.5) * s, y: h.y + 0.4 * s }];
    p.inkLine(pts, { rng, width: 0.2 * s, opacity: 0.85, breaks: 0, wobble: 0.15, taper: [0.05, 0.4], pigment: legPig });
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

export function paintDropwing(res: number, seed: number, sex: DropwingSex): DropwingParts {
  const c = colours(sex);
  const body = { w: 9 * K, h: 7.5 * K, ox: 3 * K, oy: 2.2 * K };
  return {
    perched: paintSprite(res, body, seed, (p) => paintBody(p, c, 'grip')),
    flying: paintSprite(res, body, seed + 1, (p) => paintBody(p, c, 'tuck')),
    abdomen: paintSprite(res, { w: 25.5 * K, h: 4 * K, ox: 24.8 * K, oy: 1.8 * K }, seed + 2, (p) => paintAbdomen(p, c, sex)),
    fore: paintSprite(res, { w: 24 * K, h: 5 * K, ox: 0.5 * K, oy: 2.2 * K }, seed + 3, (p) => paintWing(p, c, false, sex)),
    hind: paintSprite(res, { w: 23 * K, h: 7 * K, ox: 0.5 * K, oy: 2.2 * K }, seed + 4, (p) => paintWing(p, c, true, sex)),
    sex,
  };
}

// ---------------------------------------------------------------------------------------------
// wings (pure)

/** How far the view looks down on the insect (rad): wings toward us read lower on screen. */
const ELEVATION = 0.3;

/**
 * Screen axes of a wing: `s` its span, `c` its chord. `sweep` turns the span forward from straight
 * out sideways, `droop` tips it down (negative: raised); the near wing points toward us.
 */
export function wingAxes(sweep: number, droop: number, near: boolean): { s: Pt; c: Pt } {
  const z = near ? 1 : -1;
  const ce = Math.cos(ELEVATION);
  const se = Math.sin(ELEVATION);
  // the far wing droops less than it should: true to life it would be seen edge-on, a bare line
  const d = near || droop < 0 ? droop : droop * 0.5;
  const sx = Math.sin(sweep) * Math.cos(d);
  const sy = Math.sin(d);
  const sz = z * Math.cos(sweep) * Math.cos(d);
  return {
    s: { x: sx, y: sy * ce + sz * se },
    c: { x: -Math.cos(sweep), y: z * Math.sin(sweep) * se },
  };
}

export interface WingPose {
  fore: { sweep: number; droop: number };
  hind: { sweep: number; droop: number };
}

/** The dropwing's rest: wings spread, drooped forward and down. */
export const REST_POSE: WingPose = { fore: { sweep: 0.92, droop: 0.42 }, hind: { sweep: 0.5, droop: 0.36 } };

/** A wingbeat: fore and hind out of step, from raised high to swept below the body. */
export function flightPose(phase: number): WingPose {
  return {
    fore: { sweep: 0.12 + 0.08 * Math.cos(phase), droop: -0.25 + 0.95 * Math.sin(phase) },
    hind: { sweep: -0.02 + 0.08 * Math.cos(phase - 1.2), droop: -0.25 + 0.9 * Math.sin(phase - 1.2) },
  };
}

/** Draw the whole insect at the origin (the wing base), facing +x; `lift` raises the abdomen (rad). */
export function drawDropwing(ctx: Ctx, parts: DropwingParts, pose: WingPose, perched: boolean, lift = 0, glass = 1): void {
  const wing = (g: Sprite, base: Pt, w: { sweep: number; droop: number }, near: boolean) => {
    const { s, c } = wingAxes(w.sweep, w.droop, near);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.transform(s.x, s.y, c.x, c.y, 0, 0);
    ctx.drawImage(g.img as CanvasImageSource, -g.ox, -g.oy, g.w, g.h);
    ctx.restore();
  };
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.6 * glass;
  wing(parts.hind, HIND, pose.hind, false);
  wing(parts.fore, FORE, pose.fore, false);
  ctx.globalAlpha = a;
  const ab = parts.abdomen;
  ctx.save();
  ctx.translate(ROOT.x, ROOT.y);
  ctx.rotate(lift);
  ctx.drawImage(ab.img as CanvasImageSource, -ab.ox, -ab.oy, ab.w, ab.h);
  ctx.restore();
  const b = perched ? parts.perched : parts.flying;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  ctx.globalAlpha = a * glass;
  wing(parts.hind, HIND, pose.hind, true);
  wing(parts.fore, FORE, pose.fore, true);
  ctx.globalAlpha = a;
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

/** A tip to sit on: a post, a stone, the basin's coping or a wall coping by the water. */
export interface DropPerch {
  id: string;
  kind: Perch['kind'];
  x: number;
  /** where its feet grip at x */
  y: number;
  spread: number;
  depth: number;
  scale: number;
}

type World = Pick<FaunaWorld, 'perches' | 'pond' | 'water' | 'perspective'>;

/** The water it hunts over: the basin and the running channels. */
export function dropWaters(w: Pick<FaunaWorld, 'pond' | 'water'>): Pt[][] {
  return [w.pond.world, ...w.water.moving].filter((p) => p.length >= 3);
}

function waterDistance(q: Pt, waters: readonly Pt[][]): number {
  let d = Infinity;
  for (const poly of waters) d = Math.min(d, pointInPolygon(q, poly) ? 0 : closestOnPolygon(q, poly).d);
  return d;
}

/** Its perches: the gate posts, the stones, the rim, and the wall copings within reach of water. */
export function dropwingPerches(w: World): DropPerch[] {
  const waters = dropWaters(w);
  const out: DropPerch[] = [];
  for (const p of w.perches) {
    if (!(p.kind in DROPWING_TUNING.weights)) continue;
    if (p.kind === 'wall' && waterDistance(p, waters) > DROPWING_TUNING.wallWater) continue;
    // a stone's tip sits a little below its perch line
    const y = perchY(p, p.x) + (p.kind === 'rock' ? p.dome * 0.3 : 0);
    out.push({ id: p.id, kind: p.kind, x: p.x, y, spread: p.kind === 'rim' || p.kind === 'wall' ? p.spread * 0.8 : p.spread * 0.5, depth: p.depth, scale: p.scale ?? w.perspective(p.depth, p.x) });
  }
  return out;
}

/** Where on a perch it sits at x (follows the coping's slope). */
export function sitY(w: Pick<FaunaWorld, 'perches'>, p: DropPerch, x: number): number {
  const src = w.perches.find((q) => q.id === p.id);
  if (!src) return p.y;
  return perchY(src, x) + (src.kind === 'rock' ? src.dome * 0.3 : 0);
}

const inView = (q: Pt, v: Rect, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

/** The next perch: free ones in view, tips first, near ones likelier, never `not`; null when all are held. */
export function chooseDropPerch(perches: readonly DropPerch[], view: Rect, rng: Rng, from: Pt | null, not: DropPerch | null, held: readonly Pt[]): DropPerch | null {
  const free = perches.filter((p) => p.id !== not?.id && !held.some((h) => Math.abs(h.x - p.x) <= p.spread + DROPWING_TUNING.hold && Math.abs(h.y - p.y) < 16));
  const seen = free.filter((p) => inView(p, view, 30));
  const pool = seen.length > 0 ? seen : free;
  if (pool.length === 0) return null;
  const weights = pool.map((p) => (DROPWING_TUNING.weights[p.kind] ?? 1) / (from ? 1 + (dist(p, from) / 200) ** 2 : 1));
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i]!;
    if (x < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** A ground point over water `reach` from `near`, in view; null when there is none. */
export function sallyPoint(w: Pick<FaunaWorld, 'pond' | 'water' | 'view'>, rng: Rng, near: Pt, reach: readonly [number, number] = DROPWING_TUNING.reach): Pt | null {
  const waters = dropWaters(w);
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, TAU);
    const d = rng.range(reach[0], reach[1]);
    const q = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d * 0.5 };
    if (inView(q, w.view, 30) && waters.some((poly) => pointInPolygon(q, poly))) return q;
  }
  return null;
}

/** The abdomen's lift through an obelisk spell (0..1): up slowly, held, down again. */
export function obeliskCurve(k: number): number {
  if (k <= 0 || k >= 1) return 0;
  if (k < 0.2) return Math.sin((k / 0.2) * Math.PI * 0.5) ** 2;
  if (k > 0.85) return Math.cos(((k - 0.85) / 0.15) * Math.PI * 0.5) ** 2;
  return 1;
}

// ---------------------------------------------------------------------------------------------

interface Waypoint extends Pt {
  /** ground y under it, for perspective */
  g: number;
  perch?: DropPerch;
  /** a pause here (s): a midge taken */
  hold?: number;
}

export class Dropwing extends BaseCreature {
  readonly kind = 'dropwing' as const;
  readonly visitor = true;
  override layer: LayerId = 'air';
  readonly sex: DropwingSex;
  perch: DropPerch | null = null;
  /** the perch a sally comes back to */
  home: DropPerch | null = null;
  /** for tests: sallies made, returns to the same perch, chases given */
  sallies = 0;
  returns = 0;
  chases = 0;
  private pos: Pt = { x: 0, y: 0 };
  private vel: Pt = { x: 0, y: 0 };
  private route: Waypoint[] = [];
  private from = { g: 0, d: 1 };
  private g = 0;
  private scale = 1;
  private facing = 1;
  private turn = 1;
  private pitch = 0;
  private phase = 0;
  private hold = 0;
  private perchFor = 0;
  private lift = 0;
  private obelisk: { t: number; for: number; amp: number } | null = null;
  private chasing: Dropwing | null = null;
  private chaseFor = 0;
  private wait: number;
  private visitT = 0;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    sex: DropwingSex,
    private readonly stay: number,
    delay = 0,
  ) {
    super();
    this.sex = sex;
    this.variant = sex;
    this.wait = delay;
    this.phase = rng.range(0, TAU);
    const p = chooseDropPerch(dropwingPerches(w), w.view, rng, null, null, heldSpots(w));
    if (!p) {
      this.done = true;
      return;
    }
    // in low over the water from one side, a dart or two, then the perch
    const side = p.x < w.view.x + w.view.w / 2 ? -1 : 1;
    const start = exitPoint(w.view, p, rng, 80, rng.chance(0.75) ? side : -side);
    this.pos = { ...start };
    this.g = p.depth;
    this.scale = p.scale;
    this.facing = this.pos.x < p.x ? 1 : -1;
    this.turn = this.facing;
    const q = sallyPoint(w, rng, p, [30, 120]);
    if (q) this.route.push(this.air(q, w, 0));
    this.land(p, w);
    this.state = delay > 0 ? 'wait' : 'enter';
    this.startLeg();
    this.sync();
  }

  /** The perch it is on or making for (other creatures keep off it). */
  perchPoint(): Pt | null {
    if (this.state === 'wait' || this.state === 'leave' || this.state === 'flee') return null;
    return this.perch ? { x: this.perch.x, y: this.perch.y } : null;
  }

  private air(q: Pt, w: FaunaWorld, hold: number): Waypoint {
    const alt = this.rng.range(DROPWING_TUNING.alt[0], DROPWING_TUNING.alt[1]) * w.perspective(q.y, q.x);
    return { x: q.x, y: q.y - alt, g: q.y, hold };
  }

  /** Append a landing on `p`. */
  private land(p: DropPerch, w: FaunaWorld): void {
    const x = p.x + this.rng.range(-1, 1) * p.spread;
    this.perch = p;
    this.route.push({ x, y: sitY(w, p, x), g: p.depth, perch: p });
  }

  private startLeg(): void {
    const wp = this.route[0];
    if (wp) this.from = { g: this.g, d: Math.max(1, dist(this.pos, wp)) };
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    if (this.state === 'wait') {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.go('enter');
      this.startLeg();
    }
    this.timer += dt;
    this.visitT += dt;
    if (!this.leaving && this.visitT > this.stay) this.leaving = true;
    if (this.state === 'perch') this.perchStep(dt, w);
    else this.flyStep(dt, w);
    this.turn = approach(this.turn, this.facing, 9 * w.speed, dt);
    this.sync();
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.pitch = approach(this.pitch, 0, 6, dt);
    if (this.obelisk) {
      this.obelisk.t += dt;
      this.lift = this.obelisk.amp * obeliskCurve(this.obelisk.t / this.obelisk.for);
    } else this.lift = approach(this.lift, 0, 3, dt);
    if (this.leaving) {
      this.depart(w);
      return;
    }
    // a rival male near its perch: off after it
    if (this.sex === 'male') {
      const rival = this.rival(w);
      if (rival && this.rng.chance(dt * 1.5 * sf)) {
        this.startChase(rival, w);
        return;
      }
    }
    if (this.timer < this.perchFor) return;
    this.sally(w);
  }

  private rival(w: FaunaWorld): Dropwing | null {
    const home = this.perch;
    if (!home) return null;
    for (const c of w.creatures) {
      if (!(c instanceof Dropwing) || c === this || c.done || c.sex !== 'male') continue;
      if (c.state === 'wait' || c.state === 'flee' || c.state === 'leave' || c.chasing === this) continue;
      if (dist(c, home) < DROPWING_TUNING.territory) return c;
    }
    return null;
  }

  private startChase(rival: Dropwing, w: FaunaWorld): void {
    this.chasing = rival;
    this.chaseFor = rangeOf(this.rng, [...DROPWING_TUNING.chase]) / w.speed;
    this.chases++;
    this.route = [];
    this.home = this.perch;
    this.lift = 0;
    this.obelisk = null;
    this.vel = { x: 0, y: -10 };
    this.go('chase');
    rival.flee(this, w);
  }

  /** Chased: it darts away over the water, then makes for a perch well clear of the chaser's, or leaves. */
  flee(by: Dropwing, w: FaunaWorld): void {
    const rng = this.rng;
    this.route = [];
    this.obelisk = null;
    this.lift = 0;
    let last: Pt = this.pos;
    for (let i = rng.int(2, 4); i > 0; i--) {
      const q = sallyPoint(w, rng, last, [40, 110]);
      if (!q) break;
      this.route.push(this.air(q, w, 0));
      last = q;
    }
    if (this.route.length === 0) this.route.push(this.air({ x: this.pos.x + rng.range(-80, 80), y: this.g }, w, 0));
    this.perch = null;
    const home = by.perch ?? by.home;
    const far = dropwingPerches(w).filter((p) => !home || dist(p, home) > DROPWING_TUNING.territory * 1.4);
    const next = rng.chance(0.4) ? null : chooseDropPerch(far, w.view, rng, last, null, heldSpots(w));
    if (next) this.land(next, w);
    else {
      this.leaving = true;
      this.route.push({ ...exitPoint(w.view, last, rng, 90), g: this.g });
    }
    this.vel = { x: 0, y: -12 };
    this.go('flee');
    this.startLeg();
  }

  /** A short dart out over the water, a turn or two, and back to the same perch or one nearby. */
  private sally(w: FaunaWorld): void {
    const rng = this.rng;
    const here = this.perch;
    this.home = here;
    this.route = [];
    this.lift = 0;
    this.obelisk = null;
    let last: Pt = here ?? this.pos;
    for (let i = rng.int(1, 3); i > 0; i--) {
      const q = sallyPoint(w, rng, last);
      if (!q) break;
      this.route.push(this.air(q, w, rangeOf(rng, [...DROPWING_TUNING.catchHold])));
      last = q;
    }
    if (this.route.length === 0 && here) this.route.push(this.air({ x: here.x + rng.range(-35, 35), y: here.depth + rng.range(-8, 8) }, w, 0.2));
    let to = here && rng.chance(DROPWING_TUNING.same) ? here : null;
    if (!to) {
      const near = dropwingPerches(w).filter((p) => !here || dist(p, here) < 200);
      to = chooseDropPerch(near, w.view, rng, last, here, this.held(w)) ?? here;
    }
    if (to) this.land(to, w);
    else this.leaving = true;
    this.sallies++;
    this.vel = { x: this.facing * 20, y: -15 };
    this.go('fly');
    this.startLeg();
  }

  private held(w: FaunaWorld): Pt[] {
    const out: Pt[] = [];
    for (const c of w.creatures) {
      if (c === this || c.done) continue;
      const o = c as { spot?: () => Pt | null; perchPoint?: () => Pt | null };
      const s = o.perchPoint?.() ?? o.spot?.();
      if (s) out.push(s);
    }
    return out;
  }

  private depart(w: FaunaWorld): void {
    const out = exitPoint(w.view, this.pos, this.rng, 90);
    this.route = [{ ...out, g: this.g }];
    this.perch = null;
    this.chasing = null;
    this.lift = 0;
    this.go('leave');
    this.startLeg();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.phase += dt * TAU * DROPWING_TUNING.hz * sf;
    this.lift = approach(this.lift, 0, 6, dt);
    if (this.leaving && this.state !== 'leave' && this.state !== 'chase' && this.state !== 'flee') this.depart(w);
    const ps = w.perspective(this.g, this.pos.x);
    if (this.state === 'chase') {
      this.chaseStep(dt, w, ps);
      return;
    }
    const wp = this.route[0];
    if (!wp) {
      if (this.state === 'leave' || (this.state === 'flee' && !this.perch)) this.done = true;
      else this.sally(w);
      return;
    }
    if (this.hold > 0) {
      // a pause at the turn, hanging with a small shiver
      this.hold -= dt;
      this.vel.x = approach(this.vel.x, 0, 10, dt);
      this.vel.y = approach(this.vel.y, 0, 10, dt);
      this.pos.x += this.vel.x * dt + w.noise(this.timer * 6, this.id) * 0.3 * ps;
      this.pos.y += this.vel.y * dt;
      if (this.hold <= 0) {
        this.route.shift();
        this.startLeg();
      }
      this.face(dt);
      return;
    }
    // the perch it makes for was taken meanwhile: another, or away
    if (wp.perch && this.state !== 'leave' && this.held(w).some((h) => dist(h, wp.perch!) < wp.perch!.spread + DROPWING_TUNING.hold)) {
      this.route.pop();
      const next = chooseDropPerch(dropwingPerches(w), w.view, this.rng, this.pos, wp.perch, this.held(w));
      if (next) this.land(next, w);
      else this.depart(w);
      this.startLeg();
      return;
    }
    const d = dist(this.pos, wp);
    if (wp.perch && d < 5 * ps) {
      // settling onto the exact spot
      springStep(this.pos, this.vel, wp, 9 * sf, dt);
      if (dist(this.pos, wp) < 0.3) this.settle(wp, w);
    } else {
      const sp = DROPWING_TUNING.dart * sf * ps * (this.state === 'leave' ? 1.2 : 1);
      arrive(this.pos, this.vel, wp, sp, DROPWING_TUNING.accel * sf * ps, wp.perch ? 18 * ps : 10 * ps, dt);
      if (!wp.perch && d < 2.5 * ps) {
        if (wp.hold) this.hold = wp.hold / sf;
        else {
          this.route.shift();
          this.startLeg();
        }
      }
    }
    const k = clamp(1 - dist(this.pos, wp) / this.from.d, 0, 1);
    this.g = lerp(this.from.g, wp.g, k);
    this.scale = lerp(this.scale, w.perspective(this.g, this.pos.x), 0.2);
    this.face(dt);
    if (this.state === 'leave' && !inView(this.pos, w.view, -60)) this.done = true;
  }

  private chaseStep(dt: number, w: FaunaWorld, ps: number): void {
    const sf = w.speed;
    const r = this.chasing;
    this.chaseFor -= dt;
    if (!r || r.done || this.chaseFor <= 0 || r.state === 'leave' && !inView(r, w.view, 20)) {
      // back to its own perch
      this.chasing = null;
      this.route = [];
      const home = this.home && !this.held(w).some((h) => dist(h, this.home!) < this.home!.spread + DROPWING_TUNING.hold) ? this.home : chooseDropPerch(dropwingPerches(w), w.view, this.rng, this.pos, null, this.held(w));
      if (home) this.land(home, w);
      else this.leaving = true;
      this.go(home ? 'fly' : 'leave');
      if (!home) this.depart(w);
      this.startLeg();
      return;
    }
    // close on the rival's tail, a little behind and above
    const target = { x: r.x - Math.sign(r.vel.x || 1) * 6 * ps, y: r.y - 3 * ps };
    arrive(this.pos, this.vel, target, DROPWING_TUNING.dart * 1.25 * sf * ps, DROPWING_TUNING.accel * 1.3 * sf * ps, 4, dt);
    this.g = approach(this.g, r.g, 4, dt);
    this.scale = lerp(this.scale, w.perspective(this.g, this.pos.x), 0.2);
    this.face(dt);
  }

  private face(dt: number): void {
    if (Math.abs(this.vel.x) > 6) this.facing = Math.sign(this.vel.x);
    this.pitch = approach(this.pitch, clamp(this.vel.y * this.facing * 0.004, -0.35, 0.35), 12, dt);
  }

  private settle(wp: Waypoint, w: FaunaWorld): void {
    const p = wp.perch!;
    this.pos = { x: wp.x, y: wp.y };
    this.vel = { x: 0, y: 0 };
    this.g = p.depth;
    this.scale = p.scale;
    this.route = [];
    if (this.home && p.id === this.home.id && this.state === 'fly') this.returns++;
    this.perch = p;
    this.home = p;
    this.perchFor = rangeOf(this.rng, [...DROPWING_TUNING.perch]) / w.speed;
    this.obelisk = this.rng.chance(DROPWING_TUNING.obelisk) ? { t: -this.rng.range(0.3, 1.5), for: this.perchFor, amp: rangeOf(this.rng, [...DROPWING_TUNING.obeliskLift]) } : null;
    this.layer = 'entities';
    this.go('perch');
  }

  protected override go(state: string): void {
    super.go(state);
    if (state !== 'perch') this.layer = 'air';
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  /** The abdomen's lift right now (tests, studio). */
  abdomenLift(): number {
    return this.lift;
  }

  /** The ground under it (tests). */
  ground(): number {
    return this.g;
  }

  override depth(): number | null {
    return this.state === 'perch' && this.perch ? this.perch.depth : null;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (this.state === 'wait') return;
    const perched = this.state === 'perch';
    if (perched ? layer !== 'entities' : layer !== 'air') return;
    const parts = w.art.get(`dropwing:${this.sex}`, (res) => paintDropwing(res, this.sex === 'male' ? 3110 : 3130, this.sex));
    const fs = Math.abs(this.turn) < 0.15 ? 0.15 * Math.sign(this.turn || 1) : this.turn;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale * fs, this.scale);
    if (perched) {
      // in the obelisk the head dips a little as the abdomen rises
      ctx.rotate(this.lift * 0.15);
      ctx.translate(-FEET.x, -FEET.y);
      drawDropwing(ctx, parts, REST_POSE, true, this.lift);
    } else {
      ctx.rotate(this.pitch);
      // the beat flickers: the glass catches the light at some angles and not others
      const glass = 0.55 + 0.45 * Math.abs(Math.cos(this.phase));
      drawDropwing(ctx, parts, flightPose(this.phase), false, 0.05, glass);
    }
    ctx.restore();
  }
}

const dropwing: CreatureDef = {
  kind: 'dropwing',
  title: 'violet dropwing',
  role: 'visitor',
  // long stays: a male holds its stretch of the basin; now and then a second male comes and is chased off
  visit: { gap: [90, 220], first: [12, 40], stay: [90, 200], group: [1, 2], max: 2, diurnal: true, visitor: true },
  variants: DROPWING_SEXES,
  needs: (w) => dropWaters(w).length > 0 && dropwingPerches(w).some((p) => p.kind === 'post' || p.kind === 'rim'),
  spawn(w, s) {
    if (!dropwingPerches(w).some((p) => p.kind === 'post' || p.kind === 'rim')) return [];
    const rng = w.rng.fork(`dropwing:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const out: Dropwing[] = [];
    const stay = s.stay || 150;
    const first = variantOf(s.variants, DROPWING_SEXES, rng, () => (rng.chance(0.78) ? 'male' : 'female'));
    const a = new Dropwing(w, rng.fork('a'), first, stay * rng.range(0.85, 1.1));
    if (a.done) return out;
    out.push(a);
    if (s.count > 1) {
      // the second is a rival male, coming in a little later
      const b = new Dropwing(w, rng.fork('b'), 'male', stay * rng.range(0.3, 0.6), rng.range(6, 30));
      if (!b.done) out.push(b);
    }
    return out;
  },
  sheet: {
    w: 720,
    h: 150,
    make(res, seed) {
      const m = paintDropwing(res, seed, 'male');
      const f = paintDropwing(res, seed + 5, 'female');
      const box = { w: 34 * K, h: 26 * K, ox: 27 * K, oy: 10 * K };
      const pose = (parts: DropwingParts, p: WingPose, perched: boolean, lift = 0) => paintSprite(res, box, seed + 9, (pt) => drawDropwing(pt.ctx, parts, p, perched, lift));
      return [pose(m, REST_POSE, true), pose(m, REST_POSE, true, 1.1), pose(m, flightPose(1.3), false), pose(m, flightPose(4.5), false), pose(f, REST_POSE, true), m.fore, m.hind, m.abdomen];
    },
  },
  show: { stage: 'oasis', spec: { x: 900, y: 520, w: 320, h: 180 }, w: 640, h: 360, group: 1, order: 41 },
};
export default dropwing;
