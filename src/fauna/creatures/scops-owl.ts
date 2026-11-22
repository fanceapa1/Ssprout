/** Scops owl (Otus scops): a small, compact, bark-grey streaked owl with short ear tufts and yellow eyes.
 * At night on the olive, a wall coping or the pine: sits round, turns its head, blinks, calls (the throat
 * puffs), stretches tall and thin when something large comes near, swoops silently to another perch. */
import { createRng, type Rng } from '../../core/rng';
import { blob, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, cubic, cubicLength, cubicTangent, dist, easeInOut, lerp, rangeOf, smoothstep } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { perchY, type Perch } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { heldSpots } from './bird';
import type { CreatureDef } from './lib/def';
import { exitPoint } from './lib/flight';

/** Crown to tail tip at perspective 1 (world units): about 20 cm, a starling's length. */
export const OWL_SIZE = 24;
const R = OWL_SIZE / 20;
const LIFT = 8 * R;

export const OWL_TUNING = {
  /** seconds between acts on the perch */
  act: [1.5, 4] as const,
  /** chance an act is a calling bout, a slow head turn, a blink */
  call: 0.3,
  turn: 0.3,
  blink: 0.25,
  /** a calling bout (s), and one puff of the throat every this many seconds */
  bout: [8, 18] as const,
  every: 2.6,
  /** after this long on one perch it may swoop to another (s) */
  stayPut: [30, 90] as const,
  /** world units / s at perspective 1 (a slow, silent swoop), and the least perspective it flies at */
  flight: 120,
  minScale: 0.4,
  /** the least scale it is drawn at, so it reads at a distance */
  minDraw: 0.7,
  /** a cat, goat or heron this close (world units) makes it stretch tall and thin */
  alarm: 120,
};

const LARGE = new Set(['cat', 'goat', 'heron', 'tortoise']);

export interface OwlParts {
  body: Sprite; // sitting relaxed, round and fluffed, anchored at the feet
  tallBody: Sprite; // stretched tall and thin (TALL_W × TALL_H of the relaxed body), anchored at the feet
  heads: Sprite[]; // eyes open, turned 0 … TURN_MAX toward +x in HEAD_STEPS steps, anchored at the neck
  blink: Sprite; // facing out, eyes shut
  narrow: Sprite; // facing out, eyes narrowed to slits (the camouflage pose)
  tuft: Sprite; // one ear tuft, anchored at its base, pointing up
  throat: Sprite; // the pale puff of the call, centred
  flyUp: Sprite;
  flyDown: Sprite;
  glide: Sprite;
  size: number;
}

/** The painted head turns, from facing out to TURN_MAX (radians, past the shoulder). */
export const HEAD_STEPS = 7;
export const TURN_MAX = 1.75;
const TALL_W = 0.72;
const TALL_H = 1.26;
/** The neck (the head's anchor) above the feet, sitting and stretched (units of r). */
const NECK = -10.2;
const NECK_TALL = NECK * TALL_H - 0.6;

const C = {
  body: '#8c8072',
  dark: '#5a4e44',
  shade: '#4a423a',
  light: '#a99d8b',
  breast: '#ddd5c5',
  streak: '#2e2924',
  disc: '#cbc2b0',
  rim: '#3a322b',
  brow: '#ece6d8',
  lid: '#9a8f7e',
  eye: '#f0c02c',
  iris: '#c9901c',
  pupil: '#141210',
  bill: '#4a4540',
  spot: '#eee8da',
  leg: '#c0b49f',
  toe: '#7d7365',
  claw: '#2a2622',
  wing: '#6a5e52',
};

const SPOT = { variant: 'round' as const, angle: 0, blend: 'source-over' as const };

/** The body below the head: relaxed (round, fluffed) or stretched tall and thin, feet at the origin. */
function paintBody(p: Painter, r: number, tall: boolean): void {
  const rng = p.rng;
  const W = tall ? TALL_W : 1;
  const H = tall ? TALL_H : 1;
  // tall: the flanks sleeked in a little more than the shoulders
  const Q = (x: number, y: number) => ({ x: x * r * W * (tall && y > -9 && y < -2 ? 0.94 : 1), y: (y < 0 ? y * H : y * (tall ? 1.15 : 1)) * r });
  const side = [Q(2.4, -12.1), Q(3.6, -11.2), Q(4.7, -9.6), Q(5.3, -7.0), Q(5.35, -4.2), Q(4.85, -1.8), Q(3.8, -0.3), Q(2.4, 0.7), Q(1.5, 1.5), Q(1.2, 2.3), Q(0.5, 2.5)];
  const mirror = (q: { x: number; y: number }) => ({ x: -q.x, y: q.y });
  const sil = smoothPolygon([Q(0, -12.4), ...side, Q(0, 2.55), ...side.slice().reverse().map(mirror)], 2);
  p.wetInWet(sil, C.light, C.body, { rng, angle: Math.PI / 2, split: 0.35, softness: 0.5, fingers: 0.4, opacity: 0.95, edge: 0.28, edgeWidth: 0.45 * r, sharpness: 0.4, centreLift: 0.04, granulation: 0.45, flow: 0.45, flowScale: 3 * r, deform: 0.05, spread: 0.05, blend: 'source-over' });
  // the paler breast between the folded wings
  const M = p.layer({ x: -6 * r, y: -16 * r, w: 12 * r, h: 20 * r });
  M.clip(sil);
  M.fill(blob(0, -5.6 * r * H, 2.9 * r * W, 4.9 * r * H, rng, { irregularity: 0.2 }), C.breast, 0.85);
  M.fill(blob(0, -10.4 * r * H, 2.3 * r * W, 1.2 * r * H, rng, { irregularity: 0.2 }), C.breast, 0.6);
  M.dry({ opacity: 0.85, edge: 0.04, sharpness: 0.12, centreLift: 0, granulation: 0.3, flow: 0.4, flowScale: 2 * r, blend: 'source-over' });
  // bark pattern: dark shaft streaks with fine cross-bars, pale bars between
  for (let y = -10.2; y < -1.4; y += 0.95) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = rng.range(-2.8, 2.8);
      const yy = y + rng.range(-0.35, 0.35);
      const len = rng.range(0.35, 0.8) * (y < -6 ? 1.2 : 0.9);
      p.inkLine([Q(x, yy - len), Q(x + rng.range(-0.12, 0.12), yy + len)], { rng, width: rng.range(0.13, 0.22) * r, opacity: rng.range(0.4, 0.65), breaks: 0.15, pigment: C.streak, taper: [0.35, 0.55] });
      if (rng.chance(0.55)) p.inkLine([Q(x - rng.range(0.3, 0.6), yy + 0.1), Q(x + rng.range(0.3, 0.6), yy + 0.15)], { rng, width: 0.08 * r, opacity: 0.3, breaks: 0.3, pigment: C.streak });
      if (rng.chance(0.5)) p.dab(Q(x + 0.35, yy + 0.45), C.spot, { ...SPOT, rng, length: 0.9 * r * W, width: 0.26 * r, opacity: 0.4 });
    }
  }
  // the folded wings along the sides: mottled, a row of pale scapular spots, barred primaries
  for (const s of [-1, 1]) {
    const S = (x: number, y: number) => Q(x * s, y);
    const wing = smoothPolygon([S(3.2, -11.0), S(4.6, -9.6), S(5.15, -7.0), S(5.05, -4.2), S(4.25, -1.8), S(3.0, -0.1), S(1.9, 1.4), S(1.45, 1.0), S(2.1, -1.4), S(2.75, -4.4), S(2.95, -7.6), S(2.6, -10.2)], 2);
    p.wetInWet(wing, C.body, C.wing, { rng, angle: Math.PI / 2, split: 0.4, softness: 0.5, fingers: 0.5, opacity: 0.88, edge: 0.22, edgeWidth: 0.3 * r, sharpness: 0.4, granulation: 0.55, flow: 0.5, flowScale: 2 * r, deform: 0.05, spread: 0.05, blend: 'source-over' });
    for (let k = 0; k < 9; k++) {
      const v = rng.range(-9.5, -2.5);
      const u = rng.range(3.1, 4.6) - (v > -4 ? 0.6 : 0);
      p.dab(S(u, v), C.dark, { rng, variant: 'round', angle: Math.PI / 2, length: 0.9 * r, width: 0.45 * r, opacity: 0.35 });
      if (k % 2 === 0) p.dab(S(u + 0.3, v - 0.4), C.spot, { ...SPOT, rng, length: 0.45 * r, width: 0.32 * r, opacity: 0.45 });
    }
    for (let k = 0; k < 5; k++) {
      const at = S(3.0 + k * 0.3, -10.3 + k * 0.75);
      p.dab(at, C.spot, { ...SPOT, rng, length: 0.6 * r, width: 0.38 * r, opacity: 0.9 });
    }
    for (let k = 0; k < 3; k++) p.inkLine([S(2.4 - k * 0.3, -1.6 + k * 0.85), S(3.7 - k * 0.45, -2.2 + k * 0.85)], { rng, width: 0.16 * r, opacity: 0.45, breaks: 0.3, pigment: C.spot, blend: 'source-over' });
    p.inkLine([S(2.6, -10.0), S(2.95, -7.4), S(2.75, -4.4), S(2.1, -1.4)], { rng, width: 0.22 * r, opacity: 0.4, breaks: 0.35, pigment: C.shade, taper: [0.2, 0.5] });
  }
  // the tail under the wingtips, barred
  for (const y of [1.3, 2.1]) p.inkLine([Q(-1.0, y), Q(1.0, y + 0.05)], { rng, width: 0.14 * r, opacity: 0.35, breaks: 0.3, pigment: C.spot, blend: 'source-over' });
  // light from the left: the right side in shade
  p.glaze(sil, C.shade, { rng, opacity: 0.22, edge: 0.1, sharpness: 0.3, granulation: 0.3, deform: 0.04, spread: 0.06, fade: { angle: Math.PI, start: 0.35, amount: 1, ragged: 0.6 } });
  p.granulate(sil, C.shade, { rng, strength: 0.18 });
  // feathered legs, toes gripping over the perch, dark claws
  for (const s of [-1, 1]) {
    const fx = 1.15 * s * (tall ? 0.85 : 1);
    p.wash(blob(fx * r, -0.45 * r, 0.95 * r, 0.95 * r, rng, { irregularity: 0.25 }), C.leg, { rng, opacity: 0.9, edge: 0.15, edgeWidth: 0.2 * r, sharpness: 0.3, deform: 0.04, spread: 0.04, blend: 'source-over' });
    for (const dx of [-0.45, 0.45]) {
      const a = { x: (fx + dx * 0.6) * r, y: -0.1 * r };
      const b = { x: (fx + dx * 1.4) * r, y: 0.55 * r };
      const c = { x: (fx + dx * 1.5) * r, y: 1.05 * r };
      p.inkLine([a, b, c], { rng, width: 0.5 * r, opacity: 0.9, breaks: 0, pigment: C.toe, taper: [0.05, 0.35] });
      p.dab(c, C.claw, { rng, variant: 'leaf', angle: Math.PI / 2 - dx * 0.4, length: 0.45 * r, width: 0.2 * r, opacity: 0.6 });
    }
  }
}

/** The head's half width at y (neck at the origin), for laying the face on its round. */
const headHalf = (y: number) => 4.55 * Math.sqrt(Math.max(0.05, 1 - ((y + 3.4) / 4.9) ** 2));
/** A point on the head's surface at azimuth `phi` (0: the face's middle) seen turned by `yaw`; `vis` is how far it faces us. */
function onHead(phi: number, y: number, yaw: number, r: number): { x: number; y: number; vis: number } {
  const a = clamp(phi + yaw, -Math.PI / 2, Math.PI / 2);
  return { x: headHalf(y) * Math.sin(a) * 0.96 * r, y: y * r, vis: Math.cos(phi + yaw) };
}

type Eyes = 'open' | 'shut' | 'slit';

/** The head, neck at the origin, turned `yaw` toward +x: the facial disc, brows, eyes and bill laid on
 * its round so they slide across and narrow as it turns; streaks from `marks`, the same each turn. */
function paintHead(p: Painter, r: number, yaw: number, eyes: Eyes, marks: number): void {
  const rng = p.rng;
  const m = createRng(marks);
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const side = [P(1.9, -6.95), P(3.75, -6.6), P(4.65, -5.2), P(4.95, -3.3), P(4.7, -1.2), P(3.9, 0.6), P(2.4, 1.6)];
  const head = smoothPolygon([P(0, -6.8), ...side, P(0, 1.9), ...side.slice().reverse().map((q) => ({ x: -q.x, y: q.y }))], 2);
  p.wetInWet(head, C.body, C.dark, { rng, angle: -Math.PI / 2, split: 0.78, softness: 0.5, fingers: 0.4, opacity: 0.95, edge: 0.12, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.45, flow: 0.45, flowScale: 2.5 * r, deform: 0.04, spread: 0.04, blend: 'source-over', fade: { angle: Math.PI / 2, start: 0.72, amount: 1, ragged: 0.6 } });
  // crown and nape streaks all round the head: the ones facing us show
  for (let i = 0; i < 72; i++) {
    const phi = m.range(-Math.PI, Math.PI);
    const y = m.range(-6.7, -0.2);
    const inDisc = Math.abs(phi) < 1.15 && y > -6.2;
    const len = m.range(0.5, 0.9);
    const op = m.range(0.35, 0.6);
    if (inDisc) continue;
    const q = onHead(phi, y, yaw, r);
    if (q.vis < 0.15) continue;
    const w = Math.max(0.3, q.vis);
    p.inkLine([q, { x: q.x, y: q.y + len * r }], { rng, width: 0.17 * r * w, opacity: op, breaks: 0.2, pigment: C.streak, taper: [0.3, 0.5] });
    if (i % 2 === 0) p.dab({ x: q.x + 0.25 * r * w, y: q.y + 0.2 * r }, C.spot, { ...SPOT, rng, length: 0.45 * r * w, width: 0.3 * r, opacity: 0.45 });
  }
  // the facial disc: its outline on the head's round, pale, rimmed dark where it faces us
  const N = 32;
  const ring = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const y = -3.3 + (Math.sin(t) < 0 ? 2.9 : 2.45) * Math.sin(t);
    return onHead(1.02 * Math.cos(t), y, yaw, r);
  });
  p.wash(smoothPolygon(ring, 1), C.disc, { rng, opacity: 0.6, edge: 0.3, edgeWidth: 0.4 * r, sharpness: 0.4, deform: 0.03, spread: 0.04, granulation: 0.3 });
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 2) p.inkLine(run, { rng, width: 0.26 * r, opacity: 0.55, breaks: 0.3, pigment: C.rim, taper: [0.3, 0.3] });
    run = [];
  };
  for (let i = 0; i <= N; i++) {
    const q = ring[i % N]!;
    // the rim runs down the sides and under the chin, lost under the brows
    const top = Math.sin(((i % N) / N) * Math.PI * 2) < -0.6;
    if (q.vis > 0.12 && !top) run.push(q);
    else flush();
  }
  flush();
  // fine radial marks in the disc
  for (let k = 0; k < 12; k++) {
    const phi = m.range(-0.85, 0.85);
    const y = m.range(-4.8, -1.3);
    const a = onHead(phi, y, yaw, r);
    const b = onHead(phi * 1.12, y + (y + 3.6) * 0.15, yaw, r);
    if (a.vis > 0.2) p.inkLine([a, b], { rng, width: 0.08 * r, opacity: 0.3, breaks: 0.3, pigment: C.rim });
  }
  // the pale brows rising to the tufts
  for (const s of [-1, 1]) {
    const pts = [0, 0.33, 0.66, 1].map((u) => onHead(s * (0.14 + u * 0.7), -4.85 - u * 1.4, yaw, r));
    if (pts.some((q) => q.vis > 0.2)) p.inkLine(pts.filter((q) => q.vis > 0.05), { rng, width: 0.4 * r, opacity: 0.65, breaks: 0.15, pigment: C.brow, taper: [0.2, 0.5], blend: 'source-over' });
  }
  // the eyes, close together, foreshortened as they turn away
  for (const s of [-1, 1]) {
    const q = onHead(s * 0.4, -3.75, yaw, r);
    if (q.vis < 0.12) continue;
    const k = Math.max(0.25, q.vis);
    if (eyes === 'shut') {
      p.dab(q, C.lid, { rng, variant: 'round', angle: 0, length: 1.7 * r * k, width: 1.2 * r, opacity: 0.45 });
      p.inkLine([{ x: q.x - 0.75 * r * k, y: q.y }, { x: q.x, y: q.y + 0.22 * r }, { x: q.x + 0.75 * r * k, y: q.y }], { rng, width: 0.2 * r, opacity: 0.75, breaks: 0, pigment: C.rim });
      continue;
    }
    p.dab(q, C.rim, { rng, variant: 'round', angle: 0, length: 2.0 * r * k, width: (eyes === 'slit' ? 1.0 : 1.75) * r, opacity: 0.65, edge: 0.1 });
    const h = eyes === 'slit' ? 0.42 : 1.45;
    p.dab(q, C.eye, { ...SPOT, rng, length: 1.55 * r * k, width: h * r, opacity: 0.97, edge: 0.18, sharpness: 0.3 });
    p.dab(q, C.pupil, { ...SPOT, rng, length: 0.72 * r * k, width: Math.min(0.72, h * 0.8) * r, opacity: 0.95 });
    if (eyes === 'slit') {
      p.inkLine([{ x: q.x - 0.85 * r * k, y: q.y - 0.3 * r }, { x: q.x + 0.85 * r * k, y: q.y - 0.32 * r }], { rng, width: 0.3 * r, opacity: 0.7, breaks: 0, pigment: C.lid });
    } else p.dab({ x: q.x - 0.22 * r * k, y: q.y - 0.3 * r }, C.spot, { ...SPOT, rng, length: 0.26 * r, width: 0.24 * r, opacity: 0.85 });
  }
  // the small hooked bill between them, sticking out past the face's edge as it turns
  const a = clamp(yaw, -Math.PI / 2, Math.PI / 2);
  const base = onHead(0, -2.2, yaw, r);
  if (Math.cos(yaw) > -0.2) {
    const out = Math.sin(a) * 0.75;
    const wx = Math.max(0.3, Math.cos(a));
    const B = (x: number, y: number, d: number) => ({ x: base.x + (x * wx + out * d) * r, y: y * r });
    p.wash(smoothPolygon([B(-0.45, -2.55, 0), B(0.45, -2.55, 0), B(0.25, -1.9, 0.8), B(0.05, -1.35, 1), B(-0.12, -1.5, 0.9), B(-0.3, -2.0, 0.3)], 1), C.bill, { rng, opacity: 0.92, edge: 0.3, edgeWidth: 0.12 * r, sharpness: 0.5, deform: 0.02, spread: 0.02 });
    for (const s of [-1, 1]) p.dab(B(0.55 * s, -2.3, 0), C.brow, { ...SPOT, rng, length: 0.5 * r, width: 0.3 * r, opacity: 0.55 });
  }
}

/** One ear tuft, its base at the origin, pointing up: a short dark-streaked feather tuft. */
function paintTuft(p: Painter, r: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const tuft = smoothPolygon([P(-0.8, 0.5), P(-0.75, -0.9), P(-0.45, -2.1), P(-0.05, -3.0), P(0.3, -2.3), P(0.62, -1.0), P(0.8, 0.5)], 2);
  p.wetInWet(tuft, C.body, C.dark, { rng, angle: -Math.PI / 2, split: 0.45, softness: 0.5, opacity: 0.95, edge: 0.25, edgeWidth: 0.25 * r, sharpness: 0.45, granulation: 0.4, deform: 0.04, spread: 0.04, blend: 'source-over' });
  p.inkLine([P(0, 0.2), P(-0.05, -1.4), P(-0.08, -2.6)], { rng, width: 0.2 * r, opacity: 0.6, breaks: 0.1, pigment: C.streak, taper: [0.1, 0.7] });
  p.inkLine([P(-0.5, -0.2), P(-0.35, -1.6)], { rng, width: 0.14 * r, opacity: 0.5, breaks: 0.2, pigment: C.spot, blend: 'source-over' });
}

/** An owl wing from its shoulder along `a`: broad and round, fingered tips, barred flight feathers. */
function paintWing(p: Painter, r: number, o: Pt, a: number, len: number, chord: number, op: number, side: number, near: boolean): void {
  const rng = p.rng;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (u: number, v: number) => {
    const x = u * len * r;
    const y = v * chord * r * side;
    return { x: o.x + x * ca - y * sa, y: o.y + x * sa + y * ca };
  };
  // a broad planform: the wrist on the leading edge, a round fingered tip, the trailing edge scalloped
  const edge: [number, number][] = [
    [0, -0.22], [0.2, -0.3], [0.42, -0.36], [0.6, -0.33], [0.78, -0.3], [0.9, -0.24], [0.98, -0.14], [1.03, -0.04], [0.97, 0.0], [1.0, 0.07],
    [0.93, 0.1], [0.95, 0.16], [0.88, 0.18], [0.89, 0.24], [0.8, 0.25], [0.7, 0.31], [0.6, 0.27], [0.5, 0.33], [0.4, 0.29], [0.3, 0.34],
    [0.18, 0.3], [0.06, 0.33], [0, 0.22],
  ];
  const shape = smoothPolygon(edge.map(([u, v]) => at(u, v)), 1);
  p.wetInWet(shape, near ? C.light : C.body, near ? C.wing : C.dark, { rng, angle: a, split: 0.45, softness: 0.5, fingers: 0.5, opacity: op, edge: 0.24, edgeWidth: 0.3 * r, sharpness: 0.42, granulation: 0.5, flow: 0.5, flowScale: 2 * r, deform: 0.04, spread: 0.05, blend: 'source-over' });
  if (!near) return;
  // pale-spotted coverts, the flight feathers barred dark and pale across, the pale leading edge
  for (let k = 0; k < 10; k++) p.dab(at(rng.range(0.1, 0.5), rng.range(-0.25, 0.05)), C.spot, { ...SPOT, rng, length: 0.5 * r, width: 0.34 * r, opacity: 0.6 });
  p.inkLine([at(0.05, 0.08), at(0.35, 0.06), at(0.62, 0.02)], { rng, width: 0.2 * r, opacity: 0.35, breaks: 0.3, pigment: C.shade });
  for (const u of [0.2, 0.34, 0.48, 0.62, 0.75, 0.87]) {
    const v0 = u > 0.55 ? -0.28 : 0.1;
    p.inkLine([at(u, v0), at(u - 0.03, 0.3)], { rng, width: 0.3 * r, opacity: 0.45, breaks: 0.2, pigment: C.shade, taper: [0.2, 0.3] });
    p.inkLine([at(u + 0.06, v0), at(u + 0.03, 0.29)], { rng, width: 0.16 * r, opacity: 0.4, breaks: 0.3, pigment: C.spot, blend: 'source-over' });
  }
  p.inkLine([at(0.05, -0.22), at(0.42, -0.34), at(0.8, -0.28)], { rng, width: 0.24 * r, opacity: 0.55, breaks: 0.3, pigment: C.spot, blend: 'source-over' });
}

type Stroke = 'up' | 'glide' | 'down';

/** The owl in flight, side on and a little from above, the centre at the origin, facing +x. */
function paintFlight(p: Painter, r: number, stroke: Stroke): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const sh = P(0.8, -1.6);
  const wing = (a: number, len: number, op: number, near: boolean) => paintWing(p, r, sh, a, len, 9, op, near ? 1 : -1, near);
  // the far wing behind the body
  if (stroke === 'up') wing(-Math.PI / 2 - 0.2, 11.5, 0.8, false);
  else if (stroke === 'glide') wing(-Math.PI + 0.95, 11, 0.8, false);
  else wing(-Math.PI + 0.4, 7, 0.75, false);
  const tail = smoothPolygon([P(-3.2, -1.1), P(-6.4, -1.5), P(-7.3, -0.3), P(-6.5, 0.9), P(-3.2, 1.0)], 2);
  p.wetInWet(tail, C.body, C.dark, { rng, angle: Math.PI, split: 0.5, softness: 0.5, opacity: 0.92, edge: 0.25, edgeWidth: 0.3 * r, sharpness: 0.4, granulation: 0.4, deform: 0.04, spread: 0.04, blend: 'source-over' });
  for (const x of [-4.6, -5.8]) p.inkLine([P(x, -1.2), P(x - 0.2, 0.8)], { rng, width: 0.16 * r, opacity: 0.45, breaks: 0.3, pigment: C.spot, blend: 'source-over' });
  const body = smoothPolygon([P(4.3, -2.6), P(1.5, -2.9), P(-1.8, -2.4), P(-3.8, -1.3), P(-4.2, 0.2), P(-3.0, 1.5), P(0, 2.6), P(2.8, 2.7), P(4.5, 1.8)], 2);
  p.wetInWet(body, C.breast, C.body, { rng, angle: -Math.PI / 2, split: 0.55, softness: 0.5, opacity: 0.95, edge: 0.28, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.45, flow: 0.45, flowScale: 2.5 * r, deform: 0.04, spread: 0.05, blend: 'source-over' });
  for (let i = 0; i < 12; i++) {
    const x = rng.range(-2.8, 3.8);
    const y = rng.range(0.2, 2.0);
    p.inkLine([P(x, y - 0.45), P(x - 0.1, y + 0.45)], { rng, width: 0.17 * r, opacity: 0.5, breaks: 0.2, pigment: C.streak, taper: [0.3, 0.5] });
  }
  // the feet tucked under the belly
  p.dab(P(0.6, 2.6), C.leg, { ...SPOT, rng, length: 1.6 * r, width: 0.9 * r, opacity: 0.85 });
  // the big round head, the face three-quarters forward: the disc, two yellow eyes, the bill
  const head = blob(5.1 * r, -1.3 * r, 3.3 * r, 3.1 * r, rng, { irregularity: 0.08 });
  p.wetInWet(head, C.light, C.body, { rng, angle: -Math.PI / 2, split: 0.5, softness: 0.5, opacity: 0.95, edge: 0.26, edgeWidth: 0.35 * r, sharpness: 0.4, granulation: 0.4, deform: 0.03, spread: 0.04, blend: 'source-over' });
  const disc = blob(6.3 * r, -1.0 * r, 2.0 * r, 2.5 * r, rng, { irregularity: 0.1 });
  p.wash(disc, C.disc, { rng, opacity: 0.65, edge: 0.3, edgeWidth: 0.3 * r, sharpness: 0.4, deform: 0.03, spread: 0.03 });
  p.inkLine([P(5.6, -3.2), P(4.6, -1.8), P(4.6, 0.0), P(5.6, 1.3)], { rng, width: 0.28 * r, opacity: 0.6, breaks: 0.2, pigment: C.rim });
  for (const [x, k] of [[6.1, 1], [7.8, 0.6]] as const) {
    p.dab(P(x, -1.6), C.rim, { rng, variant: 'round', angle: 0, length: 1.6 * r * k, width: 1.5 * r, opacity: 0.7 });
    p.dab(P(x, -1.6), C.eye, { ...SPOT, rng, length: 1.2 * r * k, width: 1.15 * r, opacity: 0.97 });
    p.dab(P(x, -1.6), C.pupil, { ...SPOT, rng, length: 0.55 * r * k, width: 0.55 * r, opacity: 0.95 });
  }
  p.wash(smoothPolygon([P(7.3, -1.0), P(8.0, -0.9), P(8.3, -0.2), P(7.9, 0.1), P(7.4, -0.4)], 1), C.bill, { rng, opacity: 0.9, edge: 0.3, edgeWidth: 0.1 * r, sharpness: 0.5, deform: 0.02, spread: 0.02 });
  for (let i = 0; i < 5; i++) {
    const x = rng.range(3.0, 5.0);
    const y = rng.range(-4.0, -2.6);
    p.inkLine([P(x, y), P(x - 0.1, y + 0.6)], { rng, width: 0.15 * r, opacity: 0.45, breaks: 0.2, pigment: C.streak });
  }
  // the near wing over the body
  if (stroke === 'up') wing(-Math.PI / 2 - 0.45, 12.5, 0.95, true);
  else if (stroke === 'glide') wing(-Math.PI + 0.5, 12.5, 0.95, true);
  else wing(Math.PI / 2 + 0.35, 12, 0.95, true);
}

export function paintOwl(res: number, seed: number): OwlParts {
  const r = R;
  const bbox = { w: 12 * r, h: 19 * r, ox: 6 * r, oy: 15.5 * r };
  const body = paintSprite(res, bbox, seed, (p) => paintBody(p, r, false));
  const tallBody = paintSprite(res, { w: 9 * r, h: 22 * r, ox: 4.5 * r, oy: 18.5 * r }, seed + 1, (p) => paintBody(p, r, true));
  const hbox = { w: 12 * r, h: 10.5 * r, ox: 6 * r, oy: 8.2 * r };
  const marks = seed * 7 + 3;
  const head = (yaw: number, eyes: Eyes, k: number) => paintSprite(res, hbox, seed + 2 + k, (p) => paintHead(p, r, yaw, eyes, marks));
  const heads = Array.from({ length: HEAD_STEPS }, (_, i) => head((TURN_MAX * i) / (HEAD_STEPS - 1), 'open', i));
  const tuft = paintSprite(res, { w: 2.4 * r, h: 4 * r, ox: 1.2 * r, oy: 3.4 * r }, seed + 20, (p) => paintTuft(p, r));
  const throat = paintSprite(res, { w: 5 * r, h: 3.6 * r, ox: 2.5 * r, oy: 1.8 * r }, seed + 21, (p) => {
    p.wash(blob(0, 0, 2.0 * r, 1.25 * r, p.rng, { irregularity: 0.15 }), C.breast, { rng: p.rng, opacity: 0.9, edge: 0.18, edgeWidth: 0.25 * r, sharpness: 0.25, deform: 0.04, spread: 0.04, blend: 'source-over' });
    for (let i = 0; i < 4; i++) p.inkLine([{ x: (i - 1.5) * 0.8 * r, y: -0.3 * r }, { x: (i - 1.5) * 0.85 * r, y: 0.6 * r }], { rng: p.rng, width: 0.12 * r, opacity: 0.35, breaks: 0.3, pigment: C.streak });
  });
  const fbox = { w: 34 * r, h: 34 * r, ox: 16 * r, oy: 17 * r };
  const fly = (s: Stroke, k: number) => paintSprite(res, fbox, seed + 30 + k, (p) => paintFlight(p, r, s));
  return {
    body,
    tallBody,
    heads,
    blink: head(0, 'shut', 10),
    narrow: head(0, 'slit', 11),
    tuft,
    throat,
    flyUp: fly('up', 0),
    flyDown: fly('down', 1),
    glide: fly('glide', 2),
    size: OWL_SIZE,
  };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

const group = (p: Perch): 'olive' | 'pine' | 'wall' | null => (p.kind === 'branch' && p.id.startsWith('olive') ? 'olive' : p.kind === 'branch' && p.id.startsWith('pine-branch') ? 'pine' : p.kind === 'wall' ? 'wall' : null);
const WEIGHT = { olive: 3, pine: 1.5, wall: 1 };

/** Beyond these x the painting fades to paper: the pine's far boughs and the walls' ends are barely painted there. */
export const OWL_FRAME = { x0: 60, x1: 1530 };

/** Where its feet go from a perch's line (units), checked in the painting at night: up in the olive's
 * crotch, on a limb's upper side, onto the pine's painted twig, onto a coping's cap stones. */
const SEATS: Record<string, Pt> = {
  'olive-fork': { x: 6, y: -13 },
  'olive-limb-3-1': { x: 0, y: -5 },
  'olive-limb-3-2': { x: 0, y: -2 },
  'pine-branch-9-1': { x: -12, y: -3 },
};
export const seatOf = (p: Perch): Pt => SEATS[p.id] ?? { x: 0, y: p.kind === 'wall' ? -1 : 0 };

/** The olive's boughs and fork, the leaning pine's branches and the wall copings, inside the painted frame. */
export function owlPerches(w: Pick<FaunaWorld, 'perches'>): Perch[] {
  return w.perches.filter((p) => group(p) !== null && p.x >= OWL_FRAME.x0 && p.x <= OWL_FRAME.x1);
}

/** The next perch, free of other creatures' spots and never `not`: the olive most, then the pine, then a wall top. */
export function choosePerch(w: Pick<FaunaWorld, 'perches'>, rng: Rng, held: readonly Pt[], not: Perch | null = null): Perch | null {
  const all = owlPerches(w);
  const count = { olive: 0, pine: 0, wall: 0 };
  for (const p of all) count[group(p)!]++;
  const free = all.filter((p) => p !== not && !held.some((h) => Math.abs(h.x - p.x) <= p.spread + 10 && Math.abs(h.y - p.y) < 18));
  if (free.length === 0) return null;
  const weights = free.map((p) => WEIGHT[group(p)!] / count[group(p)!]);
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    x -= weights[i]!;
    if (x < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

/** Is a cat, goat, heron or tortoise within the alarm distance of `at`? */
export function largeNear(w: Pick<FaunaWorld, 'creatures'>, at: Pt): boolean {
  return w.creatures.some((c) => !c.done && LARGE.has(c.kind) && Math.hypot(c.x - at.x, c.y - at.y) < OWL_TUNING.alarm);
}

// ---------------------------------------------------------------------------------------------

interface Leg {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  len: number;
  u: number;
  s0: number;
  s1: number;
  gone: boolean;
}

export type OwlAct = 'still' | 'turn' | 'blink' | 'call' | 'tall';
export type OwlMode = 'fly' | 'perch' | 'leave';

export interface OwlPose {
  /** −1…1: the head turned away from or toward its facing */
  turn: number;
  blink: boolean;
  /** 0…1: the throat's puff */
  puff: number;
  /** 0…1: stretched tall and thin */
  tall: number;
  /** 0…1: alert (a little slimmer, the tufts half up) while it turns its head or calls */
  alert: number;
}

export const SIT: OwlPose = { turn: 0, blink: false, puff: 0, tall: 0, alert: 0 };

/** One puff of the throat every `every` seconds of the bout (k = seconds into it). */
export function callPose(k: number): OwlPose {
  const ph = (k % OWL_TUNING.every) / OWL_TUNING.every;
  return { ...SIT, puff: ph < 0.18 ? Math.sin((ph / 0.18) * Math.PI) : 0 };
}

export class ScopsOwl extends BaseCreature {
  readonly kind = 'scops-owl' as const;
  readonly visitor = false;
  perch: Perch | null = null;
  /** for tests: calls (throat puffs), blinks, alarms, swoops to another perch */
  calls = 0;
  blinks = 0;
  alarms = 0;
  moves = 0;
  private pos: Pt = { x: 0, y: 0 };
  private facing = 1;
  private scale = 1;
  private leg: Leg | null = null;
  private act: OwlAct = 'still';
  private actT = 0;
  private actFor = 1;
  private onPerch = 0;
  private stayPut: number;
  private flap = 0;
  private heading = 0;
  private turnTo = 1;
  private tallness = 0;
  private alertness = 0;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
  ) {
    super();
    this.stayPut = rangeOf(rng, [...OWL_TUNING.stayPut]);
    const p = choosePerch(w, rng, heldSpots(w));
    if (!p) {
      this.done = true;
      return;
    }
    const v = w.view;
    const side = rng.chance(0.5) ? -1 : 1;
    this.pos = { x: side < 0 ? v.x - 40 : v.x + v.w + 40, y: clamp(p.y - rng.range(30, 90), v.y + 20, v.y + v.h) };
    this.scale = p.scale ?? w.perspective(p.depth, p.x);
    this.flyTo(p, w);
    this.go('fly');
    this.sync();
  }

  spot(): Pt | null {
    return this.perch && this.state !== 'leave' ? { x: this.perch.x, y: this.perch.y } : null;
  }

  doing(): OwlMode {
    return this.state as OwlMode;
  }

  acting(): OwlAct | null {
    return this.state === 'perch' ? this.act : null;
  }

  private flyTo(target: Perch | Pt, w: FaunaWorld, gone = false): void {
    const isPerch = 'kind' in target;
    let to: Pt = { ...target };
    let s1 = this.scale;
    if (isPerch) {
      const x = target.x + this.rng.range(-0.4, 0.4) * target.spread;
      const seat = seatOf(target);
      to = { x: x + seat.x, y: perchY(target, x) + seat.y };
      s1 = target.scale ?? w.perspective(target.depth, target.x);
      this.perch = target;
    } else this.perch = null;
    const from = { ...this.pos };
    const dx = to.x - from.x;
    // a swoop: down off the perch, low across, and up onto the next
    const sag = clamp(dist(from, to) * 0.25, 10, 60);
    const p1 = { x: from.x + dx * 0.3, y: from.y + sag };
    const p2 = { x: to.x - dx * 0.3, y: to.y + sag * 0.7 };
    this.leg = { p0: from, p1, p2, p3: to, len: Math.max(1, cubicLength(from, p1, p2, to)), u: 0, s0: this.scale, s1, gone };
    if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
    this.layer = 'air';
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    this.timer += dt;
    if (!this.leaving && !w.mode.night) this.leaving = true;
    if (this.state === 'perch' && this.leaving) {
      this.perch = null;
      this.flyTo(exitPoint(w.view, this.pos, this.rng, 80), w, true);
      this.go('leave');
    }
    if (this.leg) this.flyStep(dt, w);
    else if (this.state === 'perch') this.perchStep(dt, w);
    this.sync();
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const f = this.leg!;
    const sf = w.speed;
    const k = 0.5 + 0.5 * Math.min(1, f.u * 4, (1 - f.u) * 3);
    f.u = Math.min(1, f.u + (OWL_TUNING.flight * sf * k * dt * Math.max(OWL_TUNING.minScale, (f.s0 + f.s1) * 0.5)) / f.len);
    const tg = cubicTangent(f.p0, f.p1, f.p2, f.p3, f.u);
    this.pos = cubic(f.p0, f.p1, f.p2, f.p3, f.u);
    this.flap += dt * sf;
    this.scale = lerp(f.s0, f.s1, easeInOut(f.u));
    if (Math.abs(tg.x) > 1e-3) this.facing = Math.sign(tg.x);
    this.heading = clamp(Math.atan2(tg.y, Math.abs(tg.x)) * 0.5, -0.5, 0.5);
    if (f.u < 1) return;
    this.leg = null;
    if (f.gone) {
      this.done = true;
      return;
    }
    this.layer = 'entities';
    this.onPerch = 0;
    this.go('perch');
    this.nextAct(w);
  }

  private perchStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    const near = largeNear(w, this.pos);
    this.tallness = clamp(this.tallness + (near ? 3 : -1) * dt * sf, 0, 1);
    const keen = this.act === 'call' || this.act === 'turn';
    this.alertness = clamp(this.alertness + (keen ? 1.2 : -0.5) * dt * sf, 0, 1);
    if (near && this.act !== 'tall') {
      this.alarms++;
      this.act = 'tall';
      this.actT = 0;
      this.actFor = 1 / sf;
    }
    this.actT += dt;
    this.onPerch += dt;
    if (this.act === 'call' && Math.floor((this.actT * sf) / OWL_TUNING.every) > Math.floor(((this.actT - dt) * sf) / OWL_TUNING.every)) this.calls++;
    if (this.actT < this.actFor) return;
    if (near) {
      this.actT = 0;
      return;
    }
    const p = this.perch!;
    if (this.onPerch > this.stayPut / sf) {
      const next = choosePerch(w, this.rng, heldSpots(w).filter((h) => h.x !== p.x || h.y !== p.y), p);
      this.stayPut = rangeOf(this.rng, [...OWL_TUNING.stayPut]);
      if (next) {
        this.moves++;
        this.flyTo(next, w);
        this.go('fly');
        return;
      }
    }
    this.nextAct(w);
  }

  private nextAct(w: FaunaWorld): void {
    const rng = this.rng;
    const t = OWL_TUNING;
    const r = rng.next();
    let dur = rangeOf(rng, [...t.act]);
    if (r < t.call) {
      this.act = 'call';
      this.calls++;
      dur = rangeOf(rng, [...t.bout]);
    } else if (r < t.call + t.turn) {
      this.act = 'turn';
      this.turnTo = rng.chance(0.5) ? -1 : 1;
      dur = rng.range(2.5, 4.5);
    } else if (r < t.call + t.turn + t.blink) {
      this.act = 'blink';
      this.blinks++;
      dur = rng.range(0.4, 0.9);
    } else this.act = 'still';
    this.actFor = dur / w.speed;
    this.actT = 0;
  }

  /** Its pose now (draw, studio, tests). */
  pose(): OwlPose {
    if (this.state !== 'perch') return SIT;
    const tall = this.tallness;
    const alert = this.alertness;
    const k = clamp(this.actT / this.actFor, 0, 1);
    if (this.act === 'call') return { ...callPose(this.actT * (this.actFor > 0 ? 1 : 0)), tall, alert };
    if (this.act === 'turn') return { ...SIT, turn: this.turnTo * Math.sin(k * Math.PI), tall, alert };
    if (this.act === 'blink') return { ...SIT, blink: k > 0.2 && k < 0.7, tall, alert };
    return { ...SIT, tall, alert };
  }

  override leave(): void {
    this.leaving = true;
  }

  private sync(): void {
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  override depth(): number | null {
    if (this.leg) return null;
    return this.perch ? this.perch.depth : this.pos.y + 1;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    const air = this.leg !== null;
    if (air ? layer !== 'air' : layer !== 'entities') return;
    const parts = w.art.get('scops-owl', (res) => paintOwl(res, 4210));
    ctx.save();
    ctx.translate(this.x, this.y);
    const k = Math.max(this.scale, OWL_TUNING.minDraw);
    ctx.scale(k * this.facing, k);
    if (air) drawFlying(ctx, parts, this.flap, this.heading);
    else drawPerched(ctx, parts, this.pose());
    ctx.restore();
  }
}

/** The painted turns for a head turn of `turn` (−1…1): `a` under `b` laid over it at `k`, each
 * mirrored when its flip is set (a turn toward −x; the face-on turn 0 is never mirrored). */
export function headBlend(turn: number): { a: number; b: number; k: number; flipA: boolean; flipB: boolean } {
  const u = clamp(Math.abs(turn), 0, 1) * (HEAD_STEPS - 1);
  const a = Math.min(HEAD_STEPS - 2, Math.floor(u));
  const neg = turn < 0;
  return { a, b: a + 1, k: u - a, flipA: neg && a > 0, flipB: neg };
}

/** Where an ear tuft's base sits (x, y) and how it leans (radians), for a head turned `yaw` and tufts raised 0…1. */
export function tuftAt(s: -1 | 1, yaw: number, raise: number): { x: number; y: number; lean: number; scale: number } {
  const a = s * 0.98 + yaw;
  return { x: 3.75 * Math.sin(a), y: -6.25 - 0.2 * raise, lean: Math.sin(a) * lerp(1.3, 0.25, raise), scale: lerp(0.7, 1.15, raise) };
}

/** How far the body is drawn toward the tall pose (0 sitting relaxed … 1 stretched), and how high the tufts stand. */
export function shapeOf(q: OwlPose): { morph: number; raise: number } {
  return { morph: clamp(Math.max(q.tall, 0.32 * q.alert), 0, 1), raise: clamp(Math.max(q.tall, 0.08 + 0.45 * q.alert), 0, 1) };
}

const img = (ctx: Ctx, s: Sprite) => ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);

/** An owl sitting with its feet at the origin, in world units at perspective 1. */
export function drawPerched(ctx: Ctx, parts: OwlParts, q: OwlPose): void {
  const r = parts.size / 20;
  const { morph, raise } = shapeOf(q);
  const sx = lerp(1, TALL_W, morph);
  const sy = lerp(1, TALL_H, morph);
  const t = smoothstep(morph);
  ctx.save();
  // the relaxed body drawn to the moment's shape, the tall one laid over it as it stretches
  if (t < 1) {
    ctx.save();
    ctx.scale(sx, sy);
    img(ctx, parts.body);
    ctx.restore();
  }
  if (t > 0) {
    ctx.save();
    ctx.globalAlpha *= t;
    ctx.scale(sx / TALL_W, sy / TALL_H);
    img(ctx, parts.tallBody);
    ctx.restore();
  }
  ctx.translate(0, lerp(NECK, NECK_TALL, morph) * r);
  ctx.scale(lerp(1, 0.86, q.tall), 1);
  ctx.rotate(q.turn * 0.1);
  const yaw = q.blink || q.tall > 0.55 ? 0 : q.turn * TURN_MAX;
  for (const s of [-1, 1] as const) {
    const f = tuftAt(s, yaw, raise);
    ctx.save();
    ctx.translate(f.x * r, f.y * r);
    ctx.rotate(f.lean);
    ctx.scale(f.scale, f.scale);
    img(ctx, parts.tuft);
    ctx.restore();
  }
  if (q.blink || q.tall > 0.55) img(ctx, q.blink ? parts.blink : parts.narrow);
  else {
    const h = headBlend(q.turn);
    const draw = (i: number, flip: boolean) => {
      ctx.save();
      if (flip) ctx.scale(-1, 1);
      img(ctx, parts.heads[i]!);
      ctx.restore();
    };
    draw(h.a, h.flipA);
    if (h.k > 0) {
      ctx.save();
      ctx.globalAlpha *= h.k;
      draw(h.b, h.flipB);
      ctx.restore();
    }
  }
  if (q.puff > 0) {
    const s = 0.55 + 0.6 * q.puff;
    ctx.translate(0, 0.5 * r);
    ctx.scale(s, s);
    ctx.globalAlpha *= Math.min(1, q.puff * 2);
    img(ctx, parts.throat);
  }
  ctx.restore();
}

/** Beats a second of the flight cycle: most of it a silent glide, then one deep beat. */
const BEAT = 1.4;

/** The flight frame at `flap` seconds of flight: gliding, or a deep beat (wings up, level, down, level). */
export function flightFrame(flap: number): 'glide' | 'up' | 'down' {
  const ph = (flap * BEAT) % 1;
  if (ph < 0.6) return 'glide';
  const k = (ph - 0.6) / 0.4;
  return k < 0.25 ? 'up' : k < 0.5 ? 'glide' : k < 0.75 ? 'down' : 'glide';
}

/** An owl in flight at the origin (its feet's place), facing +x. */
export function drawFlying(ctx: Ctx, parts: OwlParts, flap: number, heading: number): void {
  ctx.translate(0, -LIFT);
  ctx.rotate(heading);
  const f = flightFrame(flap);
  img(ctx, f === 'up' ? parts.flyUp : f === 'down' ? parts.flyDown : parts.glide);
}

const hasTrees = (w: Pick<FaunaWorld, 'perches'>) => w.perches.some((p) => group(p) === 'olive');

const scopsOwl: CreatureDef = {
  kind: 'scops-owl',
  title: 'scops owl',
  role: 'drifter',
  // one owl, after dark, for most of the night
  visit: { gap: [200, 500], first: [20, 80], stay: [900, 2400], group: [1, 1], max: 1, diurnal: false, nocturnal: true, visitor: false },
  needs: hasTrees,
  spawn(w, s) {
    if (!hasTrees(w) || w.creatures.some((c) => c instanceof ScopsOwl && !c.done)) return [];
    const rng = w.rng.fork(`scops-owl:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const o = new ScopsOwl(w, rng);
    return o.done ? [] : [o];
  },
  sheet: {
    w: 980,
    h: 170,
    make(res, seed) {
      const m = paintOwl(res, seed);
      return [m.body, m.tallBody, ...m.heads, m.blink, m.narrow, m.tuft, m.throat, m.flyUp, m.glide, m.flyDown];
    },
  },
  show: { stage: 'coast', spec: { x: 1110, y: 250, w: 360, h: 300 }, w: 576, h: 480, group: 1, order: 348 },
};
export default scopsOwl;
