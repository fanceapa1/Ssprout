/**
 * Common octopus (Octopus vulgaris): the coast's rare rock-pool sight, seen from above through the
 * pool's water; it sits camouflaged, ripples across, feels into the rim and dens. devlog 210.
 */
import type { Rng } from '../../core/rng';
import { blob, makeCanvas, mix, PIGMENTS, type AnyCanvas, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { angleDiff, approach, clamp, lerp, polygonBounds, rangeOf, smoothstep, TAU, turnToward } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** World units a plan unit at perspective 1: about 1.2 × life (0.83 cm a unit), so it reads in the pool. */
export const OCTOPUS_K = 1.2;
/** Its plan is seen at this squash: a little rounder than the pool's own ellipse, so it reads. */
export const SQUASH = 0.46;
/** Half the plan box it is composed in (plan units). */
const BOX = 27;
/** Its parts are painted this much finer than the art cache's resolution (the plan is drawn up to 1.1 × a world unit). */
const PAINT_UP = 1.25;
/** The finest it is composed at (px a plan unit). */
const MAX_K = 6;

export const OCTOPUS_TUNING = {
  /** crawl speed (plan units/s), and into or out of its den */
  speed: 9,
  denSpeed: 13,
  /** turning while it crawls (rad/s) */
  turn: 1.7,
  /** seconds sitting camouflaged (the first sit after it comes out is longer) */
  sit: [10, 24] as const,
  firstSit: [16, 30] as const,
  /** what it does after a sit: crawl, feel into a crack, or shift and sit on */
  moveChance: 0.5,
  reachChance: 0.35,
  /** the arm into a crack: out, feeling, back (s) */
  reachOut: 1.4,
  probe: [3.5, 7] as const,
  reachBack: 1.1,
  /** a red-brown flush: its chance in a crawl and in a probe, and how long (s) */
  flushMove: 0.6,
  flushProbe: 0.4,
  flush: [0.9, 1.6] as const,
  /** pale and flat before it goes (s) */
  alarm: [1.1, 2.4] as const,
  /** how near each big creature may come before it pales (world units) */
  threats: { cat: 110, heron: 170, gull: 100, goat: 100 } as Record<string, number>,
  /** a spot it sits on keeps this far from a crab (world units) */
  crabGap: 30,
  /** colour changes: per second while calm, and when frightened */
  skinRate: 1.4,
  alarmRate: 5,
};

// ---------------------------------------------------------------------------------------------
// skin: four looks blended smoothly

export type SkinId = 'stone' | 'sand' | 'flush' | 'pale';
export const SKIN_IDS: readonly SkinId[] = ['stone', 'sand', 'flush', 'pale'];

export interface Skin {
  /** the colour laid over the painted values, and how strongly */
  tint: string;
  alpha: number;
  /** the camouflage pattern's strength: pale blotches, a dark net, raised papillae */
  mottle: number;
}

export const SKINS: Record<SkinId, Skin> = {
  // stone-grey mottled, papillae up: the pool's stones
  stone: { tint: '#7f7666', alpha: 0.62, mottle: 0.95 },
  // smooth and sandy while it crawls
  sand: { tint: '#b4a07e', alpha: 0.58, mottle: 0.25 },
  // the brief red-brown flush
  flush: { tint: '#8e4636', alpha: 0.74, mottle: 0.3 },
  // frightened: blanched, almost no pattern
  pale: { tint: '#efe9dd', alpha: 0.72, mottle: 0.06 },
};

export type SkinWeights = Record<SkinId, number>;

/** The blended look for weights over the four skins (weights need not sum to 1). */
export function skinOf(wt: SkinWeights): Skin {
  let sum = 0;
  for (const id of SKIN_IDS) sum += Math.max(0, wt[id]);
  if (sum <= 1e-6) return { ...SKINS.stone };
  let tint = '';
  let acc = 0;
  let alpha = 0;
  let mottle = 0;
  for (const id of SKIN_IDS) {
    const f = Math.max(0, wt[id]) / sum;
    if (f <= 0) continue;
    const s = SKINS[id];
    tint = tint ? mix(tint, s.tint, f / (acc + f)) : s.tint;
    acc += f;
    alpha += s.alpha * f;
    mottle += s.mottle * f;
  }
  return { tint, alpha, mottle };
}

/** The skin it heads for: stone sitting, sand moving, pale frightened, with a flush on top. */
export function skinTarget(doing: OctopusMode, flush: boolean, alarmed: boolean): SkinWeights {
  const w: SkinWeights = { stone: 0, sand: 0, flush: 0, pale: 0 };
  if (alarmed || doing === 'alarm') w.pale = 1;
  else if (doing === 'move' || doing === 'emerge' || doing === 'den') w.sand = 1;
  else if (doing === 'reach') {
    w.stone = 0.75;
    w.sand = 0.25;
  } else w.stone = 1;
  if (flush && !alarmed && doing !== 'alarm') {
    for (const id of SKIN_IDS) w[id] *= 0.15;
    w.flush = 0.85;
  }
  return w;
}

// ---------------------------------------------------------------------------------------------
// the arms: eight curves from a ring round the head, each a bend and a coil toward the tip

export interface ArmShape {
  /** the root's direction (plan radians, 0 = the way the head faces) */
  dir: number;
  /** a steady curvature along it (rad per unit) */
  bend: number;
  /** extra curvature growing toward the tip: the coil (rad per unit at the tip) */
  curl: number;
  /** its length now (plan units) */
  len: number;
  /** the travelling wave's amplitude (rad) */
  wave: number;
}

/** Arm length at rest (plan units), the root's width, the head ring the arms leave from. */
export const ARM_LEN = 17;
const ARM_W = 3.1;
const RING = { x: 0.5, r: 1.9 };
/** Each pair's root angle (a side's) and length: the second and third pairs are the longest. */
const PAIRS = [
  { rho: 0.42, len: 0.92 },
  { rho: 1.05, len: 1.05 },
  { rho: 1.75, len: 1.06 },
  { rho: 2.45, len: 0.95 },
] as const;
/** Arm order: left 1–4, right 1–4 (side −1 is the octopus's left, up on the plan). */
export const ARMS: readonly { pair: number; side: 1 | -1 }[] = [0, 1, 2, 3].flatMap((pair) => [
  { pair, side: -1 as const },
  { pair, side: 1 as const },
]);

const SEGS = 11;
const WAVE_L = 9;

export function armRoot(i: number): Pt {
  const a = ARMS[i]!;
  const rho = a.side * PAIRS[a.pair]!.rho;
  return { x: RING.x + Math.cos(rho) * RING.r, y: Math.sin(rho) * RING.r };
}

/** Width of an arm `f` of the way to its tip. */
export const armWidth = (f: number, len: number) => ARM_W * (ARM_LEN / Math.max(6, len)) ** 0.25 * (1 - 0.84 * f ** 1.15);

/**
 * The arm's centre line: `SEGS + 1` points from the root, finer toward the tip (where it coils),
 * each step turning by the bend and the coil, with a wave travelling tipward.
 */
export function armPoints(root: Pt, a: ArmShape, phase: number, t: number, out: Pt[] = []): Pt[] {
  out.length = 0;
  out.push({ x: root.x, y: root.y });
  let theta = a.dir;
  let x = root.x;
  let y = root.y;
  let prev = 0;
  for (let k = 1; k <= SEGS; k++) {
    const s = a.len * (1 - (1 - k / SEGS) ** 1.35);
    const ds = s - prev;
    const mid = (s + prev) / 2;
    const f = mid / a.len;
    // the wave bends the arm (it is integrated, so the arm stays smooth)
    const wave = a.wave * (0.25 + f) * ((TAU * 1.4) / WAVE_L) * Math.cos((TAU * mid) / WAVE_L - t * 5.2 + phase);
    theta += (a.bend + a.curl * f ** 2.2 * 1.6 + wave) * ds;
    x += Math.cos(theta) * ds;
    y += Math.sin(theta) * ds;
    out.push({ x, y });
    prev = s;
  }
  return out;
}

/** Per-arm quirks from its seed, so no two arms (or octopuses) lie alike. */
export interface ArmQuirk {
  len: number;
  turn: number;
  bend: number;
  coil: number;
  phase: number;
}

export function armQuirks(rng: Rng): ArmQuirk[] {
  return ARMS.map((a) => ({
    len: rng.range(0.92, 1.06),
    turn: rng.range(-0.18, 0.22),
    bend: rng.range(-0.02, 0.025),
    // most tips coil back toward the body, a few the other way
    coil: (rng.chance(0.75) ? -a.side : a.side) * rng.range(0.45, 0.75),
    phase: rng.range(0, TAU),
  }));
}

/** How it holds itself: weights of the three whole-body poses and one reaching arm. */
export interface OctopusPose {
  sit: number;
  move: number;
  flat: number;
  /** the reaching arm (−1: none), where it reaches (plan angle and length) and how far out (0..1) */
  reachArm: number;
  reachDir: number;
  reachLen: number;
  reach: number;
  /** squeezing into the den (0..1): the arms gather and shorten */
  squeeze: number;
}

export const POSE_SIT: OctopusPose = { sit: 1, move: 0, flat: 0, reachArm: -1, reachDir: 0, reachLen: 0, reach: 0, squeeze: 0 };

/** One arm's shape in a pose at time `t` (`idle` marks the arm that curls and uncurls while it sits). */
export function armShape(i: number, q: OctopusPose, quirk: ArmQuirk, t: number, idle: boolean): ArmShape {
  const { pair, side } = ARMS[i]!;
  const rho = side * PAIRS[pair]!.rho;
  const L = ARM_LEN * PAIRS[pair]!.len * quirk.len;
  const sum = q.sit + q.move + q.flat || 1;
  const ws = q.sit / sum;
  const wm = q.move / sum;
  const wf = q.flat / sum;
  // sitting: out a little round the body, the tips coiled; the idle arm's coil breathes
  const breathe = idle ? Math.sin(t * 0.8 + quirk.phase) : 0;
  const sit: ArmShape = {
    dir: rho + side * (0.3 + quirk.turn) + breathe * 0.12 * side,
    bend: side * 0.025 + quirk.bend,
    curl: quirk.coil * (1 + 0.35 * breathe) * (1 + 0.04 * Math.sin(t * 1.3 + quirk.phase)),
    len: L * (0.8 + 0.08 * breathe),
    wave: 0,
  };
  // crawling: the first pair feels ahead, the rest stream behind on a travelling wave
  const move: ArmShape =
    pair === 0
      ? { dir: side * (0.75 + quirk.turn * 0.5), bend: side * 0.1, curl: quirk.coil * 0.5, len: L * 0.9, wave: 0.2 }
      : { dir: side * (2.35 + 0.28 * (pair - 1) + quirk.turn * 0.3), bend: -side * 0.012 + quirk.bend * 0.4, curl: -side * 0.12, len: L * 1.04, wave: 0.3 };
  // frightened and flat: straight out all round, a slight coil at the tips
  const flat: ArmShape = { dir: rho * 1.04 + quirk.turn * 0.3, bend: quirk.bend * 0.5, curl: quirk.coil * 0.18, len: L * 1.06, wave: 0 };
  let a: ArmShape = {
    dir: sit.dir * ws + move.dir * wm + flat.dir * wf,
    bend: sit.bend * ws + move.bend * wm + flat.bend * wf,
    curl: sit.curl * ws + move.curl * wm + flat.curl * wf,
    len: sit.len * ws + move.len * wm + flat.len * wf,
    wave: sit.wave * ws + move.wave * wm + flat.wave * wf,
  };
  if (i === q.reachArm && q.reach > 0) {
    const r = smoothstep(q.reach);
    // feeling in the crack: the tip curls this way and that
    const feel = 0.3 * Math.sin(t * 2.6 + quirk.phase) + 0.15 * Math.sin(t * 4.1);
    a = { dir: lerp(a.dir, q.reachDir, r), bend: lerp(a.bend, 0, r), curl: lerp(a.curl, feel, r), len: lerp(a.len, q.reachLen, r), wave: lerp(a.wave, 0.05, r) };
  }
  if (q.squeeze > 0) {
    const s = q.squeeze;
    a = { ...a, len: a.len * (1 - 0.35 * s), dir: lerp(a.dir, side * (2.6 + 0.1 * pair), s * 0.6) };
  }
  return a;
}

// ---------------------------------------------------------------------------------------------
// art: painted in values (light body, pooled dark edges), tinted by the skin when composed

const VALUE = { body: '#ddd6ca', rim: '#5a5047', deep: '#7a6e62' };
const EYE = { iris: '#e6d49a', ring: '#9a7c48', pupil: '#2b2520', lid: '#6e6254' };
/** The pool's water over it: a cool tint, and it shows a little through it. */
const WATER = { tint: '#6fb1a8', alpha: 0.2, show: 0.9 };

export interface OctopusParts {
  /** arm stamps: a tapered dab with pooled flanks and feathered ends (two variants) */
  stamps: [Sprite, Sprite];
  /** the coiled tips show their suckers: a stamp with a pale row on one flank */
  sucker: Sprite;
  /** the web joining the arms' roots round the head */
  web: Sprite;
  head: Sprite;
  mantle: Sprite;
  eye: Sprite;
  /** a wet sheen on the mantle */
  sheen: Sprite;
  /** the camouflage: pale blotches, a dark net and the papillae's speckle (plan box) */
  pattern: Sprite;
  /** its soft shadow on the pool floor */
  shadow: Sprite;
}

function feather(p: Painter, half: number, soft: number): void {
  const c = p.ctx;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const s of [-1, 1]) {
    const g = c.createLinearGradient(s * half, 0, s * (half - soft), 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(s > 0 ? half - soft : -half - 1, -2, soft + 1, 4);
  }
  c.restore();
}

function paintStamp(p: Painter, suckers: boolean): void {
  const rng = p.rng;
  const shape = blob(0, 0, 1.38, 0.5, rng, { irregularity: 0.1, points: 18 });
  p.wash(shape, VALUE.body, { rng, opacity: 1, layers: 6, edge: 0.95, edgeWidth: 0.16, sharpness: 0.8, centreLift: 0.12, darken: 0.65, granulation: 0.35, deform: 0.03, spread: 0.02, blend: 'source-over' });
  // pigment settled along both flanks
  for (const s of [-1, 1]) p.inkLine([{ x: -1.3, y: s * 0.44 }, { x: 0, y: s * 0.48 }, { x: 1.3, y: s * 0.44 }], { rng, width: 0.12, opacity: 0.5, breaks: 0.1, wobble: 0.15, taper: [0, 0], pigment: VALUE.rim });
  if (suckers) {
    for (const x of [-0.9, -0.3, 0.3, 0.9]) p.dab({ x, y: 0.3 }, '#f1ebdf', { rng, variant: 'round', angle: 0, length: 0.32, width: 0.3, opacity: 0.9, blend: 'source-over' });
  }
  feather(p, 1.6, 0.85);
}

function paintHead(p: Painter): void {
  const rng = p.rng;
  const head = blob(0.4, 0, 3.3, 3.1, rng, { irregularity: 0.08 });
  p.wash(head, VALUE.body, { rng, opacity: 1, layers: 8, edge: 0.8, edgeWidth: 0.3, sharpness: 0.5, centreLift: 0.2, darken: 0.55, granulation: 0.3, deform: 0.05, blend: 'source-over' });
  // the eye bumps on either side, and the brow between them
  for (const s of [-1, 1]) {
    p.wash(blob(0.8, s * 2.75, 1.35, 1.15, rng, { irregularity: 0.12 }), VALUE.body, { rng, opacity: 1, layers: 5, edge: 0.75, edgeWidth: 0.22, sharpness: 0.5, darken: 0.5, deform: 0.05, blend: 'source-over' });
  }
  p.inkLine([{ x: 1.9, y: -1.4 }, { x: 2.4, y: 0 }, { x: 1.9, y: 1.4 }], { rng, width: 0.2, opacity: 0.35, breaks: 0.2, wobble: 0.2, pigment: VALUE.rim });
}

function paintWeb(p: Painter): void {
  const rng = p.rng;
  // scalloped between the arms: a rounded star of eight lobes
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const r = 4.4 + 1.3 * Math.cos(a * 8) ** 2 + rng.range(-0.2, 0.2);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  p.wash(pts, VALUE.body, { rng, opacity: 1, layers: 6, edge: 0.6, edgeWidth: 0.25, sharpness: 0.45, centreLift: 0.1, darken: 0.45, granulation: 0.3, deform: 0.05, blend: 'source-over' });
}

function paintMantle(p: Painter): void {
  const rng = p.rng;
  // the bag behind the head, a little fuller toward its rounded end
  const bag = blob(-5.9, 0, 6.2, 4.5, rng, { irregularity: 0.07, points: 26 });
  p.wetInWet(bag, VALUE.body, VALUE.deep, { rng, angle: Math.PI, split: 0.55, softness: 0.6, fingers: 0.4, opacity: 1, layers: 8, edge: 0.85, edgeWidth: 0.3, sharpness: 0.55, centreLift: 0.15, darken: 0.6, granulation: 0.35, deform: 0.05, blend: 'source-over' });
  // the neck's fold where the mantle meets the head, and two wrinkles
  p.inkLine([{ x: -1.0, y: -3.2 }, { x: -0.3, y: 0 }, { x: -1.0, y: 3.2 }], { rng, width: 0.24, opacity: 0.45, breaks: 0.2, wobble: 0.2, pigment: VALUE.rim });
  for (const s of [-1, 1]) p.inkLine([{ x: -3.4, y: s * 2.4 }, { x: -6.0, y: s * 3.0 }, { x: -8.8, y: s * 2.2 }], { rng, width: 0.14, opacity: 0.3, breaks: 0.35, wobble: 0.3, pigment: VALUE.rim });
}

function paintEye(p: Painter): void {
  const rng = p.rng;
  p.wash(blob(0, 0, 1.05, 0.95, rng, { irregularity: 0.1 }), EYE.lid, { rng, opacity: 0.9, layers: 4, edge: 0.6, edgeWidth: 0.2, sharpness: 0.4, darken: 0.4, deform: 0.05, blend: 'source-over' });
  p.wash(blob(0, 0, 0.78, 0.56, rng, { irregularity: 0.08 }), EYE.iris, { rng, opacity: 1, layers: 4, edge: 0.7, edgeWidth: 0.12, sharpness: 0.6, darken: 0.45, deform: 0.04, blend: 'source-over' });
  p.inkLine([{ x: -0.8, y: 0.05 }, { x: 0, y: -0.55 }, { x: 0.8, y: 0.05 }], { rng, width: 0.12, opacity: 0.6, breaks: 0, wobble: 0.1, pigment: EYE.ring });
  // the horizontal pupil: a dark slit along the body
  p.dab({ x: -0.5, y: 0.02 }, EYE.pupil, { rng, variant: 'leaf', angle: 0, length: 1.0, width: 0.26, opacity: 0.95, layers: 3, pool: 0.2, blend: 'source-over' });
  p.dab({ x: 0.22, y: -0.18 }, '#fbf8f1', { rng, variant: 'round', angle: 0, length: 0.18, width: 0.15, opacity: 0.8, blend: 'source-over' });
}

function paintMottle(p: Painter): void {
  const rng = p.rng;
  const near = (spread: number): Pt => {
    const a = rng.range(0, TAU);
    const d = Math.abs(rng.next() + rng.next() - 1) * spread;
    return { x: Math.cos(a) * d - 1.5, y: Math.sin(a) * d };
  };
  // pale blotches: rows of white spots down the mantle and scattered over the arms
  for (let i = 0; i < 80; i++) {
    const q = i < 12 ? { x: -2.5 - (i % 6) * 1.5 + rng.range(-0.4, 0.4), y: (i < 6 ? -1 : 1) * rng.range(1.0, 2.6) } : near(21);
    const r = rng.range(0.3, i < 12 ? 0.8 : 1.05);
    p.wash(blob(q.x, q.y, r, r * rng.range(0.6, 0.95), rng, { irregularity: 0.3 }), '#f2ecdf', { rng, opacity: rng.range(0.45, 0.8), layers: 3, edge: 0.3, edgeWidth: 0.15, sharpness: 0.4, deform: 0.2, blend: 'source-over' });
  }
  // the dark net between them, and darker patches
  for (let i = 0; i < 40; i++) {
    const q = near(20);
    const a = rng.range(0, TAU);
    const l = rng.range(0.8, 2.2);
    p.inkLine([q, { x: q.x + Math.cos(a) * l * 0.5 + rng.range(-0.3, 0.3), y: q.y + Math.sin(a) * l * 0.5 }, { x: q.x + Math.cos(a) * l, y: q.y + Math.sin(a) * l }], { rng, width: rng.range(0.16, 0.3), opacity: rng.range(0.45, 0.75), breaks: 0.25, wobble: 0.35, pigment: '#3d3329' });
  }
  for (let i = 0; i < 16; i++) {
    const q = near(18);
    const r = rng.range(0.6, 1.5);
    p.glaze(blob(q.x, q.y, r, r * 0.7, rng, { irregularity: 0.3 }), '#4f4236', { rng, opacity: 0.4, layers: 3, edge: 0.2, sharpness: 0.2, deform: 0.25 });
  }
}

function paintGrain(p: Painter): void {
  const rng = p.rng;
  // the papillae: small raised points, a pale top and a dark foot
  for (let i = 0; i < 120; i++) {
    const a = rng.range(0, TAU);
    const d = Math.sqrt(rng.next()) * 21;
    const q = { x: Math.cos(a) * d - 1.5, y: Math.sin(a) * d };
    const r = rng.range(0.16, 0.34) * (d < 8 ? 1.3 : 1);
    p.dab({ x: q.x + r * 0.4, y: q.y + r * 0.4 }, '#3b3128', { rng, variant: 'round', angle: 0, length: r * 2, width: r * 1.6, opacity: 0.55, layers: 2, blend: 'source-over' });
    p.dab(q, '#f4eee2', { rng, variant: 'round', angle: 0, length: r * 1.6, width: r * 1.3, opacity: 0.75, layers: 2, blend: 'source-over' });
  }
}

export function paintOctopus(res: number, seed: number): OctopusParts {
  const plan = { w: BOX * 2, h: BOX * 2, ox: BOX, oy: BOX };
  const stamp = { w: 3.2, h: 1.3, ox: 1.6, oy: 0.65 };
  return {
    stamps: [paintSprite(res, stamp, seed + 1, (p) => paintStamp(p, false)), paintSprite(res, stamp, seed + 2, (p) => paintStamp(p, false))],
    sucker: paintSprite(res, stamp, seed + 3, (p) => paintStamp(p, true)),
    web: paintSprite(res, { w: 15, h: 15, ox: 7.5, oy: 7.5 }, seed + 11, paintWeb),
    head: paintSprite(res, { w: 8.4, h: 10.4, ox: 3.8, oy: 5.2 }, seed + 4, paintHead),
    mantle: paintSprite(res, { w: 15, h: 10.6, ox: 13, oy: 5.3 }, seed + 5, paintMantle),
    eye: paintSprite(res * 1.5, { w: 2.6, h: 2.4, ox: 1.3, oy: 1.2 }, seed + 6, paintEye),
    sheen: paintSprite(res, { w: 8, h: 5, ox: 4, oy: 2.5 }, seed + 7, (p, rng) => {
      p.dab({ x: -1.6, y: 0 }, '#fffdf8', { rng, variant: 'leaf', angle: 0, length: 4.2, width: 1.3, opacity: 0.8, pool: 0.1, blend: 'source-over' });
    }),
    pattern: paintSprite(res, plan, seed + 8, (p) => {
      paintMottle(p);
      paintGrain(p);
    }),
    shadow: paintSprite(res * 0.5, { w: 40, h: 34, ox: 20, oy: 17 }, seed + 10, (p, rng) => {
      p.glaze(blob(-2.5, 0, 10, 7.5, rng, { irregularity: 0.15 }), mix(PIGMENTS.shadow, '#3c5a5a', 0.4), { rng, opacity: 0.4, edge: 0, sharpness: 0.05, deform: 0.2 });
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// composing a frame (plan units, the body centre at the origin, facing +x)

export interface BodyPose {
  /** frightened flatness (0..1) */
  flat: number;
  /** the mantle's breath (−1..1) */
  breath: number;
  /** the eye's look: the slit tilts a little */
  look: number;
}

/** A box in plan units. */
export interface PlanBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Lay the octopus into a scratch canvas whose plan transform is `k` px a unit about (`cx`, `cy`):
 * arms, web, head and mantle in values, the skin's tint and pattern over them, the eyes, the water.
 * Returns the box it painted (plan units): the fills and the blit keep to it.
 */
export function composeOctopus(ctx: Ctx, parts: OctopusParts, arms: readonly Pt[][], body: BodyPose, skin: Skin, k: number, cx: number, cy: number): PlanBox {
  const blit = (sp: Sprite, x: number, y: number, rot: number, sx: number, sy: number): void => {
    const c = Math.cos(rot) * k;
    const n = Math.sin(rot) * k;
    ctx.setTransform(c * sx, n * sx, -n * sy, c * sy, cx + k * x, cy + k * y);
    ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
  };
  const box: PlanBox = { x0: -12.5, y0: -5.6, x1: 4.8, y1: 5.6 };
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let pair = 3; pair >= 0; pair--) {
    for (let i = 0; i < arms.length; i++) {
      if (ARMS[i]!.pair !== pair) continue;
      const pts = arms[i]!;
      const len = arcLength(pts);
      let s = len;
      for (let j = pts.length - 1; j > 0; j--) {
        const a = pts[j - 1]!;
        const b = pts[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l = Math.hypot(dx, dy);
        s -= l;
        const f = (s + l / 2) / (len || 1);
        const w = armWidth(f, len);
        const rot = Math.atan2(dy, dx);
        // the coiled tip turns its suckers up, on the inside of the coil
        const coil = j >= pts.length - 3 && j < pts.length - 1 ? angleDiff(rot, Math.atan2(pts[j + 1]!.y - b.y, pts[j + 1]!.x - b.x)) : 0;
        const st = Math.abs(coil) > 0.35 ? parts.sucker : parts.stamps[(i + j) % 2]!;
        blit(st, (a.x + b.x) / 2, (a.y + b.y) / 2, rot, (l * 2.3) / 2.76, w * (coil > 0 ? -1 : 1));
        const m = l * 0.6 + w;
        box.x0 = Math.min(box.x0, b.x - m);
        box.x1 = Math.max(box.x1, b.x + m);
        box.y0 = Math.min(box.y0, b.y - m);
        box.y1 = Math.max(box.y1, b.y + m);
      }
    }
  }
  box.x0 = Math.max(-BOX, Math.floor(box.x0));
  box.y0 = Math.max(-BOX, Math.floor(box.y0));
  box.x1 = Math.min(BOX, Math.ceil(box.x1));
  box.y1 = Math.min(BOX, Math.ceil(box.y1));
  const fl = body.flat;
  blit(parts.web, 0.3, 0, 0, 1 + 0.15 * fl, 1 + 0.15 * fl);
  blit(parts.head, 0, 0, 0, 1 + 0.08 * fl, 1 + 0.12 * fl);
  blit(parts.mantle, 0.2 * fl, 0, 0, (1 + 0.022 * body.breath) * (1 - 0.1 * fl), (1 + 0.03 * body.breath) * (1 + 0.16 * fl));
  // the skin over the values, then its pattern: only inside the painted box
  const bx = cx + box.x0 * k;
  const by = cy + box.y0 * k;
  const bw = (box.x1 - box.x0) * k;
  const bh = (box.y1 - box.y0) * k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = skin.alpha;
  ctx.fillStyle = skin.tint;
  ctx.fillRect(bx, by, bw, bh);
  if (skin.mottle > 0.02) {
    const pt = parts.pattern;
    const u = (pt.img as { width: number }).width / pt.w;
    ctx.globalAlpha = skin.mottle;
    ctx.drawImage(pt.img as CanvasImageSource, (box.x0 + pt.ox) * u, (box.y0 + pt.oy) * u, (box.x1 - box.x0) * u, (box.y1 - box.y0) * u, bx, by, bw, bh);
  }
  ctx.globalAlpha = 0.35 * (1 - 0.5 * fl);
  blit(parts.sheen, -5.2, -1.1, -0.08, 1.2, 1.2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  for (const s of [-1, 1]) blit(parts.eye, 0.85, s * 2.8, body.look * 0.15, 1, s);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = WATER.alpha;
  ctx.fillStyle = WATER.tint;
  ctx.fillRect(bx, by, bw, bh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  return box;
}

function arcLength(pts: readonly Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return l;
}

// ---------------------------------------------------------------------------------------------
// where it lives (pure): the coast's rock pools, as ellipses

export interface Pool {
  id: string;
  cx: number;
  cy: number;
  /** the water's half axes */
  rx: number;
  ry: number;
  /** the visible water inside the painted rim, and the drawing's clip */
  ix: number;
  iy: number;
}

/** How far in from the water's outline the painted rim reaches (x, y): the clip. */
export const RIM = { x: 2.6, y: 1.8 };

const poolCache = new WeakMap<object, Pool[]>();

/** The garden's rock pools (`pool-*` regions), each as its ellipse. */
export function poolsOf(w: Pick<FaunaWorld, 'regions'>): Pool[] {
  let out = poolCache.get(w.regions);
  if (out) return out;
  out = w.regions
    .filter((r) => r.kind === 'pool' && r.outline.length >= 8)
    .map((r) => {
      const b = polygonBounds(r.outline);
      const rx = b.w / 2;
      const ry = b.h / 2;
      return { id: r.id, cx: b.x + rx, cy: b.y + ry, rx, ry, ix: rx - RIM.x, iy: ry - RIM.y };
    })
    .filter((p) => p.ix > 12 && p.iy > 6);
  poolCache.set(w.regions, out);
  return out;
}

/** How far out a point is in the visible water (0 the middle, 1 the rim's inner edge). */
export function poolRadius(p: Pool, q: Pt): number {
  return Math.hypot((q.x - p.cx) / p.ix, (q.y - p.cy) / p.iy);
}

/** The point on the rim's inner edge at angle `a` (`out` > 1: beyond it, under the rim). */
export function rimPoint(p: Pool, a: number, out = 1): Pt {
  return { x: p.cx + Math.cos(a) * p.ix * out, y: p.cy + Math.sin(a) * p.iy * out };
}

/** Half extents (world) of the body and of the curled arms at a scale. */
export const bodyReach = (sc: number) => ({ x: 10 * sc, y: 10 * sc * SQUASH });
export const sitReach = (sc: number) => ({ x: 14 * sc, y: 14 * sc * SQUASH });

/** Can it sit at `q`: its curled arms inside the visible water. */
export function fitsAt(p: Pool, q: Pt, sc: number): boolean {
  const r = sitReach(sc);
  return Math.hypot((q.x - p.cx) / Math.max(1, p.ix - r.x), (q.y - p.cy) / Math.max(1, p.iy - r.y)) <= 1;
}

/** A spot to sit in the pool: its arms inside the water, `away` from `from`, clear of the crabs. */
export function chooseSpot(p: Pool, rng: Rng, sc: number, crabs: readonly Pt[], from: Pt | null, away = 0): Pt {
  let best: Pt = { x: p.cx, y: p.cy };
  let bestScore = -Infinity;
  const r = sitReach(sc);
  const fx = Math.max(1, p.ix - r.x);
  const fy = Math.max(1, p.iy - r.y);
  for (let i = 0; i < 32; i++) {
    const a = rng.range(0, TAU);
    const d = Math.sqrt(rng.next()) * 0.999;
    const q = { x: p.cx + Math.cos(a) * d * fx, y: p.cy + Math.sin(a) * d * fy };
    const crab = crabs.reduce((m, c) => Math.min(m, Math.hypot(c.x - q.x, c.y - q.y)), Infinity);
    const far = from ? Math.hypot(q.x - from.x, q.y - from.y) : away;
    const score = (crab >= OCTOPUS_TUNING.crabGap ? 0 : crab - 100) + (far >= away ? 0 : far - 50) + rng.next();
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

/** The nearest big creature close enough to frighten it, or null. */
export function threatNear(at: Pt, creatures: readonly { kind: string; x: number; y: number; done: boolean }[]): string | null {
  for (const c of creatures) {
    if (c.done) continue;
    const reach = OCTOPUS_TUNING.threats[c.kind];
    if (reach && Math.hypot(c.x - at.x, c.y - at.y) < reach) return c.kind;
  }
  return null;
}

/** Plan angle of a world direction (the plan is squashed on screen). */
export const planAngle = (dx: number, dy: number) => Math.atan2(dy / SQUASH, dx);

// ---------------------------------------------------------------------------------------------

export type OctopusMode = 'emerge' | 'sit' | 'move' | 'reach' | 'alarm' | 'den' | 'gone';

export class Octopus extends BaseCreature {
  readonly kind = 'octopus' as const;
  readonly visitor = false;
  override layer: LayerId = 'underwater';
  readonly pool: Pool;
  /** facing, plan radians */
  heading: number;
  /** the den under the far rim: its angle round the pool */
  readonly denAngle: number;
  skin: SkinWeights = { stone: 0, sand: 1, flush: 0, pale: 0 };
  pose: OctopusPose = { ...POSE_SIT, sit: 0, move: 1, squeeze: 1 };
  /** for tests: crawls, reaches, flushes, frights, and whether it was frightened off */
  did = { moves: 0, reaches: 0, flushes: 0, frights: 0, fled: false };
  readonly quirks: ArmQuirk[];
  private readonly idleArm: number;
  private target: Pt;
  private waitFor = 0;
  private age = 0;
  private flushLeft = 0;
  private flushAt = -1;
  private alarmed = false;
  private sizeMul = 1;
  private scale = 1;
  private speedNow = 0;
  private readonly arms: Pt[][] = ARMS.map(() => []);
  private crackDir = 0;
  private crackLen = 0;
  /** its last composed picture */
  private picture: { canvas: AnyCanvas; ctx: Ctx; k: number; t: number; box: PlanBox } | null = null;

  constructor(
    w: FaunaWorld,
    pool: Pool,
    readonly rng: Rng,
    readonly stay: number,
  ) {
    super();
    this.pool = pool;
    this.quirks = armQuirks(rng);
    this.idleArm = rng.pick([0, 1, 2, 3]);
    this.denAngle = rng.range(Math.PI * 1.2, Math.PI * 1.8);
    const den = rimPoint(pool, this.denAngle, 1.3);
    this.x = den.x;
    this.y = den.y;
    this.scale = w.perspective(pool.cy, pool.cx) * OCTOPUS_K;
    this.target = chooseSpot(pool, rng, this.scale, this.crabs(w), null);
    this.heading = planAngle(this.target.x - den.x, this.target.y - den.y);
    this.alpha = 0;
    this.go('emerge');
  }

  /** What it is doing (tests). */
  doing(): OctopusMode {
    return this.state as OctopusMode;
  }

  /** Its look now. */
  skinNow(): Skin {
    return skinOf(this.skin);
  }

  /** Its size factor now (world units a plan unit). */
  get size(): number {
    return this.scale * this.sizeMul;
  }

  /** What it keeps clear of: the crabs out on the rim, and a water plant growing in its pool. */
  private crabs(w: FaunaWorld): Pt[] {
    const crabs = w.creatures.filter((c) => c.kind === 'rock-crab' && !c.done && c.state !== 'hidden').map((c) => ({ x: c.x, y: c.y }));
    return [...crabs, ...w.pads.filter((d) => poolRadius(this.pool, d) < 1.1)];
  }

  override leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    if (this.state !== 'den' && this.state !== 'gone') this.toDen();
  }

  private toDen(): void {
    this.target = rimPoint(this.pool, this.denAngle, 1.3);
    this.flushLeft = 0;
    this.go('den');
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const step = dt * w.speed;
    const T = OCTOPUS_TUNING;
    this.age += step;
    this.timer += step;
    // a drifter: the sim sends it nowhere, so it watches the day and its stay itself
    if (!this.leaving && (w.mode.night || this.age > this.stay)) this.leave();
    const big = this.alpha > 0.05 ? threatNear(this, w.creatures) : null;
    if (big && (this.state === 'sit' || this.state === 'move' || this.state === 'reach' || this.state === 'emerge')) {
      this.did.frights++;
      this.alarmed = true;
      this.waitFor = rangeOf(this.rng, [...T.alarm]);
      this.go('alarm');
    }
    switch (this.state) {
      case 'emerge':
      case 'move':
      case 'den':
        this.crawl(step);
        break;
      case 'sit':
        if (this.timer >= this.waitFor) this.next(w);
        break;
      case 'reach':
        this.reachStep();
        break;
      case 'alarm':
        if (this.timer >= this.waitFor) {
          if (big || this.leaving) {
            this.did.fled = this.did.fled || !!big;
            this.toDen();
          } else {
            this.alarmed = false;
            this.sit(T.sit);
          }
        }
        break;
    }
    // a flush comes and goes on its own clock
    if (this.flushAt >= 0 && this.timer >= this.flushAt) {
      this.flushAt = -1;
      this.flushLeft = rangeOf(this.rng, [...T.flush]);
      this.did.flushes++;
    }
    this.flushLeft = Math.max(0, this.flushLeft - step);
    const want = skinTarget(this.doing(), this.flushLeft > 0, this.alarmed);
    const rate = this.alarmed ? T.alarmRate : T.skinRate;
    for (const id of SKIN_IDS) this.skin[id] = approach(this.skin[id], want[id], rate, step);
    this.easePose(step);
    // in and out under the rim: it fades and narrows as it squeezes
    const r = poolRadius(this.pool, this);
    const hidden = smoothstep((r - 0.78) / 0.27);
    this.alpha = 1 - hidden;
    this.sizeMul = 1 - 0.22 * hidden;
    if (this.state === 'den' && r >= 1.22) {
      this.state = 'gone';
      this.done = true;
    }
  }

  private easePose(step: number): void {
    const q = this.pose;
    const s = this.state;
    const crawling = s === 'move' || s === 'emerge' || s === 'den';
    const rate = s === 'alarm' ? 6 : 2.2;
    q.sit = approach(q.sit, s === 'sit' || s === 'reach' ? 1 : 0, rate, step);
    q.move = approach(q.move, crawling ? 1 : 0, rate, step);
    q.flat = approach(q.flat, s === 'alarm' ? 1 : 0, rate, step);
    q.squeeze = approach(q.squeeze, s === 'den' || s === 'emerge' ? smoothstep((poolRadius(this.pool, this) - 0.6) / 0.5) : 0, 3, step);
    if (s !== 'reach') q.reach = approach(q.reach, 0, 2.5, step);
  }

  /** Crawl toward the target, turning as it goes; sits on arrival (but in its den). */
  private crawl(step: number): void {
    const T = OCTOPUS_TUNING;
    const sc = this.scale;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const left = Math.hypot(dx / sc, dy / (sc * SQUASH));
    const top = this.state === 'move' ? T.speed : T.denSpeed;
    // eases in, slows near the spot: a ripple across, not a slide
    const want = top * clamp(left / 6, 0.15, 1) * clamp(this.timer / 0.9, 0.2, 1);
    this.speedNow = approach(this.speedNow, want, 3, step);
    this.heading = turnToward(this.heading, planAngle(dx, dy), T.turn * (this.state === 'move' ? 1 : 2), step);
    const d = Math.min(left, this.speedNow * step);
    // along its heading when it faces the way, else straight in (so it never overshoots)
    const off = Math.abs(angleDiff(this.heading, planAngle(dx, dy)));
    const hx = off < 0.6 ? Math.cos(this.heading) : dx / sc / (left || 1);
    const hy = off < 0.6 ? Math.sin(this.heading) : dy / (sc * SQUASH) / (left || 1);
    this.x += hx * d * sc;
    this.y += hy * d * sc * SQUASH;
    if (this.state === 'move') this.keepIn();
    if (this.state === 'den' || left > 0.6) return;
    this.speedNow = 0;
    if (this.state === 'emerge') this.sit(OCTOPUS_TUNING.firstSit);
    else this.sit(OCTOPUS_TUNING.sit);
  }

  private keepIn(): void {
    const p = this.pool;
    const r = bodyReach(this.scale);
    const ex = (this.x - p.cx) / Math.max(1, p.ix - r.x);
    const ey = (this.y - p.cy) / Math.max(1, p.iy - r.y);
    const e = Math.hypot(ex, ey);
    if (e <= 1) return;
    this.x = p.cx + (ex / e) * (p.ix - r.x);
    this.y = p.cy + (ey / e) * (p.iy - r.y);
  }

  private sit(range: readonly [number, number]): void {
    this.waitFor = rangeOf(this.rng, [...range]);
    this.flushAt = -1;
    this.go('sit');
  }

  /** After a sit: crawl, feel into a crack, or sit on; or go home. */
  private next(w: FaunaWorld): void {
    const T = OCTOPUS_TUNING;
    if (this.leaving) return this.toDen();
    const roll = this.rng.next();
    if (roll < T.moveChance) {
      this.target = chooseSpot(this.pool, this.rng, this.scale, this.crabs(w), this, this.pool.ix * 0.6);
      this.flushAt = this.rng.chance(T.flushMove) ? this.rng.range(1, 2.6) : -1;
      this.did.moves++;
      this.go('move');
    } else if (roll < T.moveChance + T.reachChance && this.aimCrack()) {
      this.waitFor = rangeOf(this.rng, [...T.probe]);
      this.flushAt = this.rng.chance(T.flushProbe) ? T.reachOut + this.rng.range(0.8, 2.5) : -1;
      this.did.reaches++;
      this.go('reach');
    } else this.sit(T.sit);
  }

  /** The crack it feels into: the rim's nearest stretch within an arm's stretch, and the arm nearest it. */
  private aimCrack(): boolean {
    const p = this.pool;
    let best: { d: number; a: number; q: Pt } | null = null;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const q = rimPoint(p, a, 1.06);
      const d = Math.hypot((q.x - this.x) / this.scale, (q.y - this.y) / (this.scale * SQUASH));
      if (!best || d < best.d) best = { d, a, q };
    }
    if (!best || best.d > ARM_LEN * 1.55) return false;
    const dir = angleDiff(this.heading, planAngle(best.q.x - this.x, best.q.y - this.y));
    let arm = 0;
    let bestOff = Infinity;
    for (let i = 0; i < ARMS.length; i++) {
      const rho = ARMS[i]!.side * PAIRS[ARMS[i]!.pair]!.rho;
      const off = Math.abs(angleDiff(rho, dir));
      if (off < bestOff) {
        bestOff = off;
        arm = i;
      }
    }
    this.pose.reachArm = arm;
    this.crackDir = dir;
    this.crackLen = best.d + 2;
    this.pose.reachDir = dir;
    this.pose.reachLen = this.crackLen;
    return true;
  }

  private reachStep(): void {
    const T = OCTOPUS_TUNING;
    const q = this.pose;
    const t = this.timer;
    const total = T.reachOut + this.waitFor + T.reachBack;
    q.reachDir = this.crackDir;
    q.reachLen = this.crackLen * (1 + 0.04 * Math.sin(t * 1.9));
    if (t < T.reachOut) q.reach = t / T.reachOut;
    else if (t < T.reachOut + this.waitFor) q.reach = 1;
    else q.reach = clamp((total - t) / T.reachBack, 0, 1);
    if (t >= total) this.sit(T.sit);
  }

  /** The arms now (plan units about the body centre), and the body's pose (studio, drawing). */
  armsAt(t: number): Pt[][] {
    for (let i = 0; i < ARMS.length; i++) armPoints(armRoot(i), armShape(i, this.pose, this.quirks[i]!, t + this.id * 1.7, i === this.idleArm), this.quirks[i]!.phase, t, this.arms[i]);
    return this.arms;
  }

  bodyAt(t: number): BodyPose {
    return { flat: this.pose.flat, breath: Math.sin((t * TAU) / 3.4 + this.quirks[0]!.phase), look: Math.sin(t * 0.37 + this.quirks[1]!.phase) };
  }

  /** Seconds between composing its picture: ten a second sitting still, thirty when it moves. */
  private every(): number {
    const q = this.pose;
    return this.state === 'sit' && q.move < 0.03 && q.flat < 0.03 && q.reach < 0.01 && q.squeeze < 0.01 ? 0.1 : 1 / 30 - 1e-4;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'underwater' || this.alpha <= 0.01) return;
    const parts = w.art.get('octopus', (res) => paintOctopus(res * PAINT_UP, 6230));
    const sc = this.size;
    // composed at most 6 px a plan unit (the closest views blow it up a little)
    const k = Math.min(w.art.res * sc, MAX_K);
    const px = Math.ceil(BOX * 2 * k);
    let c = this.picture;
    if (!c || c.canvas.width < px || c.canvas.width > px * 1.3) {
      const canvas = makeCanvas(px, px);
      c = this.picture = { canvas, ctx: canvas.getContext('2d') as Ctx, k: 0, t: 0, box: { x0: 0, y0: 0, x1: 0, y1: 0 } };
    }
    if (c.k !== k || w.t < c.t || w.t - c.t >= this.every()) {
      c.ctx.setTransform(1, 0, 0, 1, 0, 0);
      c.ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.box = composeOctopus(c.ctx, parts, this.armsAt(w.t), this.bodyAt(w.t), this.skinNow(), k, BOX * k, BOX * k);
      c.k = k;
      c.t = w.t;
    }
    const p = this.pool;
    ctx.save();
    // the visible water: whatever passes the rim's inner edge is under the rock
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, p.ix, p.iy, 0, 0, TAU);
    ctx.clip();
    ctx.translate(this.x, this.y);
    placeOctopus(ctx, c.canvas, c.box, k, parts, sc, this.heading, this.alpha, this.pose.move);
    ctx.restore();
  }
}

/**
 * Compose the octopus in a scratch canvas and lay it at `ctx`'s origin: its shadow on the floor,
 * then the body, squashed into the pool's plane and seen through the water (`res` px a world unit).
 */
export function layOctopus(ctx: Ctx, scratch: (px: number) => { canvas: AnyCanvas; ctx: Ctx }, parts: OctopusParts, arms: readonly Pt[][], body: BodyPose, skin: Skin, res: number, sc: number, heading: number, alpha: number, lift: number): void {
  const k = res * sc;
  const s = scratch(Math.ceil(BOX * 2 * k));
  const b = composeOctopus(s.ctx, parts, arms, body, skin, k, BOX * k, BOX * k);
  placeOctopus(ctx, s.canvas, b, k, parts, sc, heading, alpha, lift);
}

/** Lay a composed picture (`k` px a plan unit, its box) at `ctx`'s origin: two `drawImage`s at most. */
export function placeOctopus(ctx: Ctx, img: AnyCanvas, b: PlanBox, k: number, parts: OctopusParts, sc: number, heading: number, alpha: number, lift: number): void {
  const a = ctx.globalAlpha;
  ctx.save();
  ctx.scale(sc, sc * SQUASH);
  ctx.globalAlpha = a * alpha * lift * 0.45;
  const sh = parts.shadow;
  if (lift > 0.03) ctx.drawImage(sh.img as CanvasImageSource, -sh.ox + 0.8, -sh.oy + 1.6, sh.w, sh.h);
  ctx.rotate(heading);
  ctx.globalAlpha = a * alpha * WATER.show;
  ctx.drawImage(img as CanvasImageSource, (b.x0 + BOX) * k, (b.y0 + BOX) * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.restore();
}

const octopus: CreatureDef = {
  kind: 'octopus',
  title: 'common octopus',
  role: 'drifter',
  // rare: a short visit now and then, by day; one at a time
  visit: { gap: [1300, 2600], first: [500, 1300], stay: [100, 170], group: [1, 1], max: 1, diurnal: true, visitor: false },
  needs: (w) => poolsOf(w).length > 0,
  spawn(w, s) {
    const pools = poolsOf(w);
    if (pools.length === 0 || w.creatures.some((c) => c.kind === 'octopus' && !c.done)) return [];
    const rng = w.rng.fork(`octopus:${s.seed}:${w.t.toFixed(3)}:${w.creatures.length}`);
    const v = w.view;
    const seen = pools.filter((p) => p.cx > v.x && p.cx < v.x + v.w && p.cy > v.y && p.cy < v.y + v.h);
    // a pool with a water plant in it hides it: an open pool in view, then any open one, then in view
    const open = (ps: Pool[]) => ps.filter((p) => !w.pads.some((d) => poolRadius(p, d) < 1.1));
    const from = [open(seen), open(pools), seen, pools].find((ps) => ps.length > 0)!;
    // the bigger pools likelier
    const total = from.reduce((n, p) => n + p.ix * p.iy, 0);
    let roll = rng.range(0, total);
    let pool = from[from.length - 1]!;
    for (const p of from) {
      roll -= p.ix * p.iy;
      if (roll <= 0) {
        pool = p;
        break;
      }
    }
    return [new Octopus(w, pool, rng, s.stay || 140)];
  },
  sheet: {
    w: 560,
    h: 120,
    make(res, seed) {
      const a = paintOctopus(res, seed);
      return [a.mantle, a.head, a.web, a.eye, a.stamps[0], a.sucker, a.pattern];
    },
  },
  show: { stage: 'coast', spec: { x: 330, y: 872, w: 140, h: 60 }, w: 700, h: 300, order: 347 },
};
export default octopus;
