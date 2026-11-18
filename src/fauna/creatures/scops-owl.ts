/** Scops owl (Otus scops): a starling-sized, bark-grey, streaked owl with short ear tufts and yellow eyes.
 * At night on the olive, a wall coping or the pine: sits thin and upright, turns its head, blinks, calls
 * (the throat puffs), stretches tall when something large comes near, swoops silently to another perch. */
import type { Rng } from '../../core/rng';
import { blob, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, cubic, cubicLength, cubicTangent, dist, easeInOut, lerp, rangeOf } from '../math';
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
  minDraw: 0.5,
  /** a cat, goat or heron this close (world units) makes it stretch tall and thin */
  alarm: 120,
};

const LARGE = new Set(['cat', 'goat', 'heron', 'tortoise']);

export interface OwlParts {
  body: Sprite; // anchored at the feet
  front: Sprite; // head, facing out, anchored at the neck
  side: Sprite; // head turned (three-quarter, toward +x)
  blink: Sprite; // eyes shut
  tall: Sprite; // tufts raised, eyes narrowed
  throat: Sprite; // the pale puff of the call, centred
  flyUp: Sprite;
  flyDown: Sprite;
  glide: Sprite;
  size: number;
}

const C = {
  body: '#7a746a',
  shade: '#4c4740',
  light: '#a49b8c',
  breast: '#c2b8a6',
  streak: '#2c2925',
  disc: '#9c9282',
  rim: '#3a352f',
  eye: '#f0c02c',
  pupil: '#141210',
  bill: '#3a3632',
  spot: '#e8e1d2',
};

const NECK = -12.2;

function paintBody(p: Painter, r: number): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const sil = smoothPolygon([P(0, 3.6), P(-1.6, 2.2), P(-3.4, -0.8), P(-4.1, -4.8), P(-3.9, -8.8), P(-3.2, -11.4), P(0, -12.6), P(3.2, -11.4), P(3.9, -8.8), P(4.1, -4.8), P(3.4, -0.8), P(1.6, 2.2)], 2);
  p.wetInWet(sil, C.light, C.body, { rng, angle: 0, split: 0.5, softness: 0.4, fingers: 0.4, opacity: 0.95, edge: 0.3, edgeWidth: 0.45 * r, sharpness: 0.4, centreLift: 0.06, granulation: 0.45, flow: 0.45, flowScale: 3 * r, deform: 0.06, spread: 0.06, blend: 'source-over', drops: [{ pigment: C.shade, at: P(-3, -6), size: 2.6 * r, alpha: 0.45 }, { pigment: C.shade, at: P(3, -6), size: 2.6 * r, alpha: 0.45 }] });
  // the paler breast, streaked dark like bark
  const M = p.layer({ x: -5 * r, y: -13 * r, w: 10 * r, h: 17 * r });
  M.clip(sil);
  M.fill(blob(0, -5.6 * r, 2.5 * r, 4.6 * r, rng, { irregularity: 0.25 }), C.breast, 0.75);
  M.dry({ opacity: 0.8, edge: 0.06, sharpness: 0.15, centreLift: 0, granulation: 0.35, flow: 0.4, flowScale: 2 * r, blend: 'source-over' });
  for (let i = 0; i < 16; i++) {
    const x = rng.range(-3.2, 3.2);
    const y = rng.range(-11, 0.5);
    p.inkLine([P(x, y), P(x + rng.range(-0.15, 0.15), y + rng.range(1.0, 1.9))], { rng, width: 0.22 * r, opacity: rng.range(0.4, 0.65), breaks: 0.2, pigment: C.streak, taper: [0.2, 0.6] });
    if (i % 2 === 0) p.inkLine([P(x - 0.5, y + 0.8), P(x + 0.5, y + 0.8)], { rng, width: 0.12 * r, opacity: 0.25, breaks: 0.4, pigment: C.streak });
  }
  // the folded wings' edges and the pale scapular spots
  for (const s of [-1, 1]) {
    p.inkLine([P(3.6 * s, -10.6), P(3.9 * s, -5.5), P(2.8 * s, 0.6)], { rng, width: 0.3 * r, opacity: 0.45, breaks: 0.35, pigment: C.shade, taper: [0.3, 0.6] });
    for (let k = 0; k < 3; k++) p.dab(P(3.0 * s, -10.2 + k * 1.1), C.spot, { rng, variant: 'round', angle: 0, length: 0.55 * r, width: 0.4 * r, opacity: 0.7, blend: 'source-over' });
  }
  p.granulate(sil, C.shade, { rng, strength: 0.2 });
  // the feathered feet on the bough
  for (const s of [-1, 1]) p.dab(P(1.1 * s, 0.1), C.light, { rng, variant: 'round', angle: 0, length: 1.2 * r, width: 0.8 * r, opacity: 0.9 });
}

type Look = 'front' | 'side' | 'blink' | 'tall';

/** The head with the neck at the origin: round, the facial disc rimmed dark, the tufts, the yellow eyes. */
function paintHead(p: Painter, r: number, look: Look): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const tuft = look === 'tall' ? 2.0 : 0.9;
  const sh = look === 'side' ? 0.9 : 0;
  const head = smoothPolygon([P(0, 0.4), P(-3.0, -0.3), P(-3.7, -2.6), P(-3.4, -4.6), P(-2.9, -5.6 - tuft), P(-1.8, -5.5), P(0, -5.3), P(1.8, -5.5), P(2.9, -5.6 - tuft), P(3.4, -4.6), P(3.7, -2.6), P(3.0, -0.3)], 2);
  p.wetInWet(head, C.light, C.body, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.4, opacity: 0.95, edge: 0.3, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.45, flow: 0.45, flowScale: 2.5 * r, deform: 0.05, spread: 0.05, blend: 'source-over' });
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-2, 2);
    p.inkLine([P(x, -5), P(x, -4.1)], { rng, width: 0.16 * r, opacity: 0.45, breaks: 0.3, pigment: C.streak });
  }
  // the facial disc, its dark rim
  const disc = blob(sh * r, -2.5 * r, 2.8 * r, 2.1 * r, rng, { irregularity: 0.15 });
  p.wash(disc, C.disc, { rng, opacity: 0.6, edge: 0.4, edgeWidth: 0.35 * r, sharpness: 0.4, deform: 0.04, spread: 0.04 });
  p.inkLine([P(-2.7 + sh, -3.6), P(-3.0 + sh, -2.0), P(-1.8 + sh, -0.6)], { rng, width: 0.25 * r, opacity: 0.55, breaks: 0.3, pigment: C.rim });
  p.inkLine([P(2.7 + sh, -3.6), P(3.0 + sh, -2.0), P(1.8 + sh, -0.6)], { rng, width: 0.25 * r, opacity: 0.55, breaks: 0.3, pigment: C.rim });
  // the eyes and the small hooked bill
  const eyes: [number, number][] = look === 'side' ? [[2.2, 1], [0.1, 0.7]] : [[-1.3, 1], [1.3, 1]];
  for (const [ex, k] of eyes) {
    const at = P(ex, -2.9);
    if (look === 'blink') {
      p.inkLine([P(ex - 0.7, -2.9), P(ex, -2.75), P(ex + 0.7, -2.9)], { rng, width: 0.24 * r, opacity: 0.75, breaks: 0, pigment: C.rim });
      continue;
    }
    const h = look === 'tall' ? 0.55 : 1.4;
    p.dab(at, C.rim, { rng, variant: 'round', angle: 0, length: 1.75 * r * k, width: (h + 0.35) * r * k, opacity: 0.75, edge: 0.1 });
    p.dab(at, C.eye, { rng, variant: 'round', angle: 0, length: 1.4 * r * k, width: h * r * k, opacity: 0.95, edge: 0.15, blend: 'source-over' });
    p.dab(at, C.pupil, { rng, variant: 'round', angle: 0, length: 0.6 * r * k, width: Math.min(0.6, h * 0.6) * r * k, opacity: 0.95, blend: 'source-over' });
  }
  const bx = look === 'side' ? 1.9 : 0;
  p.wash(smoothPolygon([P(bx - 0.4, -1.9), P(bx + 0.4, -1.9), P(bx + 0.15, -0.8), P(bx, -0.6)], 1), C.bill, { rng, opacity: 0.9, edge: 0.3, edgeWidth: 0.12 * r, sharpness: 0.5, deform: 0.02, spread: 0.02 });
}

/** The owl in flight, level, the centre at the origin, broad rounded wings at angle `a` (none: gliding wings level). */
function paintFlight(p: Painter, r: number, a: number | null): void {
  const rng = p.rng;
  const P = (x: number, y: number) => ({ x: x * r, y: y * r });
  const wingAt = (ang: number, len: number, op: number) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const pts = [[0, -1.6], [0.5, -1.9], [0.95, -1.2], [1.05, 0], [0.9, 1.0], [0.5, 1.4], [0, 1.4]].map(([u, v]) => {
      const x = u! * len * r;
      const y = v! * 1.6 * r;
      return { x: x * ca - y * sa, y: x * sa + y * ca };
    });
    p.wetInWet(smoothPolygon(pts, 2), C.body, C.shade, { rng, angle: ang, split: 0.5, softness: 0.5, opacity: op, edge: 0.24, edgeWidth: 0.3 * r, sharpness: 0.4, granulation: 0.4, flow: 0.5, flowScale: 2 * r, deform: 0.05, spread: 0.06, blend: 'source-over' });
    for (const v of [-0.6, 0, 0.6]) p.inkLine([{ x: 0.5 * len * r * ca - v * r * sa, y: 0.5 * len * r * sa + v * r * ca }, { x: 0.95 * len * r * ca - v * 1.3 * r * sa, y: 0.95 * len * r * sa + v * 1.3 * r * ca }], { rng, width: 0.14 * r, opacity: 0.3 * op, breaks: 0.4, pigment: C.streak });
  };
  if (a === null) wingAt(Math.PI - 0.15, 10, 0.5);
  const sil = smoothPolygon([P(4.6, -1.2), P(3.8, -2.6), P(2.2, -2.8), P(-1.6, -2.0), P(-5.2, -1.0), P(-5.4, 0.6), P(-1.6, 1.8), P(2.4, 2.0), P(4.4, 1.0)], 2);
  p.wetInWet(sil, C.light, C.body, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.4, opacity: 0.95, edge: 0.3, edgeWidth: 0.4 * r, sharpness: 0.4, granulation: 0.4, flow: 0.45, flowScale: 2.5 * r, deform: 0.05, spread: 0.05, blend: 'source-over' });
  p.dab(P(3.4, -1.2), C.eye, { rng, variant: 'round', angle: 0, length: 0.9 * r, width: 0.8 * r, opacity: 0.9, blend: 'source-over' });
  p.dab(P(3.45, -1.2), C.pupil, { rng, variant: 'round', angle: 0, length: 0.4 * r, width: 0.4 * r, opacity: 0.95, blend: 'source-over' });
  wingAt(a ?? Math.PI - 0.15, 10.5, 0.9);
}

export function paintOwl(res: number, seed: number): OwlParts {
  const r = R;
  const body = paintSprite(res, { w: 10 * r, h: 18 * r, ox: 5 * r, oy: 13.5 * r }, seed, (p) => paintBody(p, r));
  const hbox = { w: 9 * r, h: 9.5 * r, ox: 4.5 * r, oy: 8.2 * r };
  const head = (look: Look, k: number) => paintSprite(res, hbox, seed + 1 + k, (p) => paintHead(p, r, look));
  const throat = paintSprite(res, { w: 4 * r, h: 3 * r, ox: 2 * r, oy: 1.5 * r }, seed + 6, (p) => p.wash(blob(0, 0, 1.6 * r, 1.0 * r, p.rng, { irregularity: 0.2 }), C.breast, { rng: p.rng, opacity: 0.85, edge: 0.15, edgeWidth: 0.2 * r, sharpness: 0.2, deform: 0.04, spread: 0.04 }));
  const fbox = { w: 26 * r, h: 26 * r, ox: 13 * r, oy: 13 * r };
  const fly = (a: number | null, k: number) => paintSprite(res, fbox, seed + 7 + k, (p) => paintFlight(p, r, a));
  return { body, front: head('front', 0), side: head('side', 1), blink: head('blink', 2), tall: head('tall', 3), throat, flyUp: fly(-Math.PI / 2 - 0.5, 0), flyDown: fly(Math.PI / 2 + 0.6, 1), glide: fly(null, 2), size: OWL_SIZE };
}

// ---------------------------------------------------------------------------------------------
// where it goes (pure)

const group = (p: Perch): 'olive' | 'pine' | 'wall' | null => (p.kind === 'branch' && p.id.startsWith('olive') ? 'olive' : p.kind === 'branch' && p.id.startsWith('pine-branch') ? 'pine' : p.kind === 'wall' ? 'wall' : null);
const WEIGHT = { olive: 3, pine: 2, wall: 1 };

/** The olive's boughs and fork, the leaning pine's branches and the wall copings. */
export function owlPerches(w: Pick<FaunaWorld, 'perches'>): Perch[] {
  return w.perches.filter((p) => group(p) !== null);
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
}

export const SIT: OwlPose = { turn: 0, blink: false, puff: 0, tall: 0 };

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
      to = { x, y: perchY(target, x) };
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
    const k = clamp(this.actT / this.actFor, 0, 1);
    if (this.act === 'call') return { ...callPose(this.actT * (this.actFor > 0 ? 1 : 0)), tall };
    if (this.act === 'turn') return { ...SIT, turn: this.turnTo * Math.sin(k * Math.PI), tall };
    if (this.act === 'blink') return { ...SIT, blink: k > 0.2 && k < 0.7, tall };
    return { ...SIT, tall };
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

/** An owl sitting with its feet at the origin, in world units at perspective 1. */
export function drawPerched(ctx: Ctx, parts: OwlParts, q: OwlPose): void {
  const r = parts.size / 20;
  const sx = 1 - 0.24 * q.tall;
  const sy = 1 + 0.16 * q.tall;
  const b = parts.body;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  if (q.puff > 0) {
    const t = parts.throat;
    const s = 0.6 + 0.6 * q.puff;
    ctx.save();
    ctx.translate(0, (NECK + 1.2) * r);
    ctx.scale(s, s);
    ctx.drawImage(t.img as CanvasImageSource, -t.ox, -t.oy, t.w, t.h);
    ctx.restore();
  }
  ctx.translate(0, NECK * r);
  ctx.scale(1 / sx, 1);
  const h = q.tall > 0.5 ? parts.tall : q.blink ? parts.blink : Math.abs(q.turn) > 0.5 ? parts.side : parts.front;
  if (h === parts.side && q.turn < 0) ctx.scale(-1, 1);
  ctx.rotate(q.turn * 0.12);
  ctx.drawImage(h.img as CanvasImageSource, -h.ox, -h.oy, h.w, h.h);
  ctx.restore();
}

/** An owl in flight at the origin (its feet's place), facing +x: mostly a silent glide, a few soft beats. */
export function drawFlying(ctx: Ctx, parts: OwlParts, flap: number, heading: number): void {
  ctx.translate(0, -LIFT);
  ctx.rotate(heading);
  const ph = (flap * 1.4) % 1;
  const s = ph < 0.6 ? parts.glide : Math.floor(flap * 16) % 2 === 0 ? parts.flyUp : parts.flyDown;
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
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
    w: 560,
    h: 150,
    make(res, seed) {
      const m = paintOwl(res, seed);
      return [m.body, m.front, m.side, m.blink, m.tall, m.flyUp, m.flyDown, m.glide];
    },
  },
  show: { stage: 'coast', spec: { x: 1110, y: 250, w: 360, h: 300 }, w: 576, h: 480, group: 1, order: 348 },
};
export default scopsOwl;
