/** Cicada (Cicada orni): the coast's summer singer. A grey-brown insect on the olive's and the pine's
 * bark (`bark-*` regions), seen from behind, head up, clear veined wings held like a roof; it sings in
 * bouts, shuffles along the bark, flattens when a bird comes near. By day only. docs/devlog/201-cicada.md */
import type { Rng } from '../../core/rng';
import { blob, mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { approach, clamp, dist, lerp, polygonBounds, rangeOf, TAU } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { regionScale, type Region } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';
import { exitPoint } from './lib/flight';

/** Head to wing tips at perspective 1 (world units): about 3.5 × life, as the dropwing, so it reads at the close view. */
export const CICADA_SIZE = 11;

export const CICADA_TUNING = {
  /** quiet on the bark between bouts (s) */
  quiet: [4, 14] as const,
  /** a song bout (s) */
  song: [5, 16] as const,
  /** chance a quiet spell ends in a shuffle rather than a song */
  shuffle: 0.3,
  /** a shuffle along the bark: how far (world units) and how fast (units/s) */
  step: [2, 6] as const,
  creep: 1.6,
  /** seconds on one tree before it flies to another spot */
  stayPut: [45, 130] as const,
  /** a buzzing flight: speed (units/s at perspective 1) and the wobble across the line */
  fly: 75,
  wobble: 1.6,
  /** wingbeats a second in flight, and the song's tremble (aliased by the frame rate into a shimmer) */
  hz: 41,
  tremble: 23,
  /** a bird this close (world units) silences it; it stays flat this long after the last one (s) */
  alarm: 90,
  calm: [5, 12] as const,
  /** two cicadas keep this far apart on the bark */
  gap: 12,
};

/** Birds it goes quiet for (any garden's): the ones that take insects or just loom. */
export const CICADA_THREATS: ReadonlySet<string> = new Set(['gull', 'swallow', 'rock-thrush', 'scops-owl', 'hoopoe', 'heron', 'bird', 'bunting', 'dove', 'iwatsubame', 'yamasemi', 'dipper']);

// ---------------------------------------------------------------------------------------------
// art: dorsal view, head up (−y), origin at the wing base

const D = 30;
const K = CICADA_SIZE / D;

const COL = {
  body: '#86806a',
  dark: mix(PIGMENTS.sumi, '#5a5040', 0.55),
  warm: '#8c7a62',
  pale: '#b8b29a',
  eye: mix(PIGMENTS.sumi, '#4a3c30', 0.35),
  vein: '#7a6a50',
  glass: mix(PIGMENTS.shadow, PIGMENTS.celadon, 0.4),
};

export interface CicadaParts {
  /** head, eyes, thorax (and its shadow on the bark), anchored at the wing base */
  body: Sprite;
  /** the abdomen under the wings, anchored at its root (the wing base) */
  abdomen: Sprite;
  /** the left forewing, base at the anchor, tip down (+y); the right is drawn mirrored */
  wing: Sprite;
}

const S = (x: number, y: number): Pt => ({ x: x * K, y: y * K });

function paintBody(p: Painter): void {
  const rng = p.rng;
  // its shadow on the bark, down and to the right of the light
  p.glaze(smoothPolygon([S(-4, -10), S(5.5, -10), S(7, 2), S(5, 17), S(1, 21), S(-2.5, 14)], 2), COL.dark, { rng, opacity: 0.18, edge: 0.1, edgeWidth: 0.4, deform: 0.05 });
  // the thorax: pronotum (collar) then the mesonotum, grey-brown with the two dark wedges and the pale cross
  const pronotum = smoothPolygon([S(-4.6, -7.4), S(4.6, -7.4), S(5.6, -4.2), S(5.2, -2.6), S(-5.2, -2.6), S(-5.6, -4.2)], 2);
  p.wetInWet(pronotum, COL.body, COL.warm, { rng, angle: Math.PI / 2, split: 0.4, softness: 0.4, fingers: 0.3, opacity: 0.95, edge: 0.4, edgeWidth: 0.3, sharpness: 0.4, deform: 0.04, spread: 0.04, blend: 'source-over' });
  const meso = smoothPolygon([S(-5.2, -2.8), S(5.2, -2.8), S(4.4, 1.2), S(2.2, 2.6), S(-2.2, 2.6), S(-4.4, 1.2)], 2);
  p.wetInWet(meso, COL.warm, COL.dark, { rng, angle: Math.PI / 2, split: 0.5, softness: 0.5, fingers: 0.3, opacity: 0.95, edge: 0.45, edgeWidth: 0.3, sharpness: 0.4, deform: 0.04, spread: 0.04, blend: 'source-over' });
  for (const sx of [-1, 1]) {
    p.dab(S(sx * 1.5, -1.0), COL.dark, { rng, variant: 'leaf', angle: Math.PI / 2 + sx * 0.25, length: 3.2 * K, width: 1.1 * K, opacity: 0.7 });
    p.inkLine([S(sx * 4.2, -6.6), S(sx * 3.4, -4.6), S(sx * 4.4, -3.2)], { rng, width: 0.35 * K, opacity: 0.55, breaks: 0.2, wobble: 0.15, taper: [0.2, 0.3], pigment: COL.dark });
  }
  p.dab(S(-0.9, 1.6), COL.pale, { rng, variant: 'round', angle: 0, length: 1.8 * K, width: 1.4 * K, opacity: 0.85, blend: 'source-over' });
  // the head: broad and short, the big dark eyes set wide at its corners
  const head = blob(0, -8.6 * K, 5.0 * K, 2.0 * K, rng, { irregularity: 0.08 });
  p.wash(head, COL.body, { rng, opacity: 0.95, edge: 0.45, edgeWidth: 0.3, deform: 0.04, spread: 0.04, blend: 'source-over' });
  p.dab(S(-0.8, -9.4), COL.dark, { rng, variant: 'round', angle: 0, length: 1.6 * K, width: 0.9 * K, opacity: 0.55 });
  for (const sx of [-1, 1]) {
    p.dab(S(sx * 3.9 - 1.05, -8.5), COL.eye, { rng, variant: 'round', angle: 0, length: 2.1 * K, width: 1.9 * K, opacity: 0.95, layers: 3 });
    p.dab(S(sx * 3.5 - 0.35, -9.0), PIGMENTS.petalWhite, { rng, variant: 'round', angle: 0, length: 0.7 * K, width: 0.6 * K, opacity: 0.7, blend: 'source-over' });
  }
}

function paintAbdomen(p: Painter): void {
  const rng = p.rng;
  const shape = smoothPolygon([S(-3.2, 1), S(3.2, 1), S(3.5, 6), S(2.6, 11), S(0, 14), S(-2.6, 11), S(-3.5, 6)], 2);
  p.wetInWet(shape, COL.warm, COL.dark, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.5, fingers: 0.3, opacity: 0.75, edge: 0.4, edgeWidth: 0.3, sharpness: 0.3, deform: 0.04, spread: 0.04, blend: 'source-over' });
  // pale segment edges
  for (let k = 0; k < 5; k++) {
    const y = 3.2 + k * 2.1;
    const hw = 3.3 - k * 0.45;
    p.inkLine([S(-hw, y), S(0, y + 0.5), S(hw, y)], { rng, width: 0.45 * K, opacity: 0.45, breaks: 0.3, wobble: 0.1, taper: [0.3, 0.3], pigment: COL.pale });
  }
}

/** The left forewing: base by the midline, costa (leading edge) outside, tip well past the abdomen. */
export function wingOutline(): Pt[] {
  return smoothPolygon([S(-0.6, -1.6), S(-3.6, -0.6), S(-5.4, 4), S(-5.6, 11), S(-4.4, 17), S(-2.4, 20.6), S(-0.6, 20.4), S(-0.2, 14), S(-0.2, 4)], 2);
}

function paintWing(p: Painter): void {
  const rng = p.rng;
  const shape = wingOutline();
  // the clear glass, a cool breath darker on the outer slope of the roof
  p.wash(shape, COL.glass, { rng, opacity: 0.3, edge: 0.5, edgeWidth: 0.3, deform: 0.03, spread: 0.03, fade: { angle: 0, start: 0.3, amount: 0.6 }, blend: 'source-over' });
  // the costa, brown and firm, and the veins fanning to the tip, closed by the marginal cells
  p.inkLine([S(-0.8, -1.4), S(-3.8, 0), S(-5.3, 5), S(-5.4, 11), S(-4.3, 16.6), S(-2.5, 20.2)], { rng, width: 0.5 * K, opacity: 0.85, breaks: 0.05, wobble: 0.08, taper: [0.1, 0.5], pigment: COL.vein });
  const veins: Pt[][] = [
    [S(-1.2, -0.6), S(-3.2, 5), S(-4.1, 11), S(-3.6, 15.8)],
    [S(-1.0, 0), S(-2.2, 6), S(-2.6, 11.5), S(-2.4, 16.8)],
    [S(-0.6, 0.4), S(-1.0, 7), S(-1.2, 12.5), S(-1.1, 17.6)],
  ];
  for (const v of veins) p.inkLine(v, { rng, width: 0.28 * K, opacity: 0.6, breaks: 0.15, wobble: 0.12, taper: [0.1, 0.3], pigment: COL.vein });
  // the cross-veins that close the cells, each with the species' small dark spot
  p.inkLine([S(-4.2, 11), S(-0.8, 12.2)], { rng, width: 0.24 * K, opacity: 0.55, breaks: 0.2, wobble: 0.15, pigment: COL.vein });
  p.inkLine([S(-3.9, 15.6), S(-0.8, 17.4)], { rng, width: 0.22 * K, opacity: 0.5, breaks: 0.2, wobble: 0.15, pigment: COL.vein });
  for (const q of [S(-4.0, 11.1), S(-2.5, 11.6), S(-1.2, 12.1), S(-3.7, 15.7), S(-2.4, 16.6)]) {
    p.dab(q, COL.dark, { rng, variant: 'round', angle: 0, length: 0.75 * K, width: 0.65 * K, opacity: 0.7 });
  }
  // the light on the ridge of the roof, reserved paper along the inner edge
  p.stroke([S(-0.7, 1), S(-0.8, 8), S(-1.0, 15)], { rng, pigment: PIGMENTS.petalWhite, width: 0.8 * K, taper: [0.5, 0.5], wobble: 0, wetness: 0.2, opacity: 0.35, edge: 0.05, edgeWidth: 0.1 });
}

export function paintCicada(res: number, seed: number): CicadaParts {
  return {
    body: paintSprite(res, { w: 14 * K, h: 33 * K, ox: 6.5 * K, oy: 11 * K }, seed, paintBody),
    abdomen: paintSprite(res, { w: 10 * K, h: 15 * K, ox: 5 * K, oy: 0 }, seed + 1, paintAbdomen),
    wing: paintSprite(res, { w: 7 * K, h: 24 * K, ox: 6.2 * K, oy: 2.4 * K }, seed + 2, paintWing),
  };
}

/** How it is held: `throb` the abdomen's pulse (0..1), wing angles out from the roof (rad), `flat` pressed to the bark (0..1). */
export interface CicadaPose {
  throb: number;
  wingL: number;
  wingR: number;
  /** wing opacity (a blur in flight, glass catching the light while it sings) */
  glass: number;
  flat: number;
}

export const REST: CicadaPose = { throb: 0, wingL: 0, wingR: 0, glass: 1, flat: 0 };

/** The song's shimmer at time t: the abdomen throbs, the wings tremble, the glass flickers. */
export function songPose(t: number, salt = 0): CicadaPose {
  const a = t * TAU * CICADA_TUNING.tremble;
  return { throb: 0.5 + 0.5 * Math.sin(a), wingL: 0.05 * Math.sin(a * 0.83 + salt), wingR: 0.05 * Math.sin(a * 0.83 + salt + 1.7), glass: 0.7 + 0.3 * Math.abs(Math.sin(a * 0.7 + salt)), flat: 0 };
}

/** A wingbeat in flight: the forewings swung far out, a pale blur. */
export function flightPose(phase: number): CicadaPose {
  const o = 1.2 + 0.45 * Math.sin(phase);
  return { throb: 0, wingL: o, wingR: o, glass: 0.45, flat: 0 };
}

/** Draw it at the origin (the wing base), head up (−y). Three parts, four `drawImage`s. */
export function drawCicada(ctx: Ctx, parts: CicadaParts, q: CicadaPose): void {
  ctx.save();
  ctx.scale(1 + 0.12 * q.flat, 1 - 0.06 * q.flat);
  const ab = parts.abdomen;
  ctx.save();
  ctx.scale(1 + 0.04 * q.throb, 1 - 0.08 * q.throb);
  ctx.drawImage(ab.img as CanvasImageSource, -ab.ox, -ab.oy, ab.w, ab.h);
  ctx.restore();
  const b = parts.body;
  ctx.drawImage(b.img as CanvasImageSource, -b.ox, -b.oy, b.w, b.h);
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * q.glass;
  const g = parts.wing;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side === -1 ? 1 : -1, 1);
    ctx.rotate(side === -1 ? q.wingL + 0.06 * q.flat : q.wingR + 0.06 * q.flat);
    ctx.drawImage(g.img as CanvasImageSource, -g.ox, -g.oy, g.w, g.h);
    ctx.restore();
  }
  ctx.globalAlpha = a;
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// where it sits (pure)

/** A point on a trunk's middle line: `angle` is the way up the trunk (rad, 0 = straight up), `half` its half width. */
export interface SpinePt extends Pt {
  angle: number;
  half: number;
}

export interface Bark {
  id: string;
  spine: SpinePt[];
  /** entities depth: the trunk's foot */
  depth: number;
  region: Region;
}

/** A trunk's middle line, scanned across the bark band every 2 units from top to foot. */
export function barkSpine(outline: readonly Pt[]): SpinePt[] {
  const b = polygonBounds(outline as Pt[]);
  const mids: { x: number; y: number; half: number }[] = [];
  for (let y = b.y + 2; y <= b.y + b.h - 2; y += 2) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i]!;
      const q = outline[(i + 1) % outline.length]!;
      if ((p.y <= y && q.y > y) || (q.y <= y && p.y > y)) {
        const x = p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    if (hi > lo) mids.push({ x: (lo + hi) / 2, y, half: (hi - lo) / 2 });
  }
  return mids.map((m, i) => {
    const a = mids[Math.max(0, i - 1)]!;
    const c = mids[Math.min(mids.length - 1, i + 1)]!;
    return { ...m, angle: Math.atan2(a.x - c.x, c.y - a.y) };
  });
}

const barkCache = new WeakMap<readonly Region[], Bark[]>();

/** The garden's bark: each `bark` region's middle line, at the trunk's foot's depth. */
export function barksOf(w: Pick<FaunaWorld, 'regions'>): Bark[] {
  let out = barkCache.get(w.regions);
  if (!out) {
    out = w.regions.filter((r) => r.kind === 'bark').map((r) => ({ id: r.id, spine: barkSpine(r.outline), depth: Math.max(...r.outline.map((q) => q.y)) + 1, region: r }));
    out = out.filter((b) => b.spine.length >= 6);
    barkCache.set(w.regions, out);
  }
  return out;
}

/** The spine at `u` (0 top … 1 foot), between its scanned points. */
export function spineAt(spine: readonly SpinePt[], u: number): SpinePt {
  const f = clamp(u, 0, 1) * (spine.length - 1);
  const i = Math.min(spine.length - 2, Math.floor(f));
  const a = spine[i]!;
  const b = spine[i + 1]!;
  const k = f - i;
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), angle: lerp(a.angle, b.angle, k), half: lerp(a.half, b.half, k) };
}

/** A spot to sit on: a tree, how far down its trunk, and a little to one side of the middle. */
export interface BarkSpot {
  bark: Bark;
  u: number;
  side: number;
}

export function spotPoint(s: BarkSpot): SpinePt {
  const q = spineAt(s.bark.spine, s.u);
  const off = s.side * q.half * 0.45;
  return { ...q, x: q.x + Math.cos(q.angle) * off, y: q.y + Math.sin(q.angle) * off };
}

const inView = (q: Pt, v: Rect, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

/** A free spot on the bark (in view when it can), away from `held`, on another tree than `not` when there is one. */
export function chooseSpot(barks: readonly Bark[], view: Rect, rng: Rng, held: readonly Pt[], not: Bark | null = null): BarkSpot | null {
  const trees = barks.length > 1 && not ? barks.filter((b) => b !== not) : barks;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 24; i++) {
      const s: BarkSpot = { bark: rng.pick(trees as Bark[]), u: rng.range(0.12, 0.88), side: rng.range(-1, 1) };
      const q = spotPoint(s);
      if (pass === 0 && !inView(q, view, 10)) continue;
      if (held.some((h) => dist(h, q) < CICADA_TUNING.gap)) continue;
      return s;
    }
  }
  return null;
}

/** Is a bird within its alarm distance? */
export function birdNear(w: Pick<FaunaWorld, 'creatures'>, at: Pt, self?: object): boolean {
  for (const c of w.creatures) {
    if (c === self || c.done || !CICADA_THREATS.has(c.kind)) continue;
    if (Math.hypot(c.x - at.x, c.y - at.y) < CICADA_TUNING.alarm) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------

export type CicadaMode = 'fly' | 'sit' | 'sing' | 'shuffle' | 'still' | 'leave';

export class Cicada extends BaseCreature {
  readonly kind = 'cicada' as const;
  readonly visitor = false;
  override layer: LayerId = 'air';
  spot: BarkSpot | null = null;
  /** for tests: bouts sung, flights between trees, shuffles, alarms */
  songs = 0;
  flights = 0;
  shuffles = 0;
  alarms = 0;
  private pos: Pt = { x: 0, y: 0 };
  private from: Pt = { x: 0, y: 0 };
  private to: Pt = { x: 0, y: 0 };
  private angle = 0;
  private scale = 1;
  private depthY = 0;
  private phase = 0;
  private flat = 0;
  private waitFor = 0;
  private onTree = 0;
  private stayPut: number;
  private stepTo = 0;
  private visitT = 0;
  private salt: number;

  constructor(
    w: FaunaWorld,
    readonly rng: Rng,
    private readonly stay: number,
    also: readonly Pt[] = [],
  ) {
    super();
    this.salt = rng.range(0, TAU);
    this.stayPut = rangeOf(rng, [...CICADA_TUNING.stayPut]);
    const s = chooseSpot(barksOf(w), w.view, rng, [...this.held(w), ...also]);
    if (!s) {
      this.done = true;
      return;
    }
    const q = spotPoint(s);
    const start = exitPoint(w.view, q, rng, 70);
    this.pos = { ...start };
    this.scale = this.scaleAt(s.bark, q);
    this.flyTo(s);
    this.x = this.pos.x;
    this.y = this.pos.y;
  }

  /** Where it sits or is making for (other creatures keep off it). */
  perchPoint(): Pt | null {
    return this.spot && this.state !== 'leave' ? spotPoint(this.spot) : null;
  }

  /** What it is doing (tests). */
  doing(): CicadaMode {
    return this.state as CicadaMode;
  }

  /** How flat it is pressed to the bark (0..1, tests). */
  flatness(): number {
    return this.flat;
  }

  private scaleAt(b: Bark, q: Pt): number {
    return regionScale(b.region, q.y) ?? 1;
  }

  private held(w: FaunaWorld): Pt[] {
    const out: Pt[] = [];
    for (const c of w.creatures) {
      if (c === this || c.done || !(c instanceof Cicada)) continue;
      const p = c.perchPoint();
      if (p) out.push(p);
    }
    return out;
  }

  private flyTo(s: BarkSpot): void {
    this.spot = s;
    this.from = { ...this.pos };
    this.to = spotPoint(s);
    this.layer = 'air';
    this.go('fly');
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const sf = w.speed;
    this.timer += dt;
    this.visitT += dt;
    if (!this.leaving && (w.mode.night || (this.stay > 0 && this.visitT > this.stay))) this.leave(w);
    if (this.leaving && this.state !== 'leave') this.depart(w);
    const perched = this.state !== 'fly' && this.state !== 'leave';
    if (perched) {
      this.onTree += dt;
      const here = spotPoint(this.spot!);
      if (birdNear(w, here, this)) {
        if (this.state !== 'still') {
          this.alarms++;
          this.go('still');
        }
        this.waitFor = rangeOf(this.rng, [...CICADA_TUNING.calm]) / sf;
        this.timer = 0;
      }
      this.flat = approach(this.flat, this.state === 'still' ? 1 : 0, 3, dt);
    }
    switch (this.state) {
      case 'fly':
      case 'leave':
        this.flyStep(dt, w);
        break;
      case 'still':
        if (this.timer >= this.waitFor) this.rest(w);
        break;
      case 'sit':
        if (this.timer < this.waitFor) break;
        if (this.onTree > this.stayPut / sf) this.hop(w);
        else if (this.rng.chance(CICADA_TUNING.shuffle)) this.startShuffle();
        else {
          this.songs++;
          this.waitFor = rangeOf(this.rng, [...CICADA_TUNING.song]) / sf;
          this.go('sing');
        }
        break;
      case 'sing':
        this.phase += dt * sf;
        if (this.timer >= this.waitFor) this.rest(w);
        break;
      case 'shuffle': {
        const s = this.spot!;
        const len = s.bark.spine.length * 2;
        const du = ((CICADA_TUNING.creep * sf) / len) * dt;
        s.u = Math.abs(this.stepTo - s.u) <= du ? this.stepTo : s.u + Math.sign(this.stepTo - s.u) * du;
        if (s.u === this.stepTo) this.rest(w);
        break;
      }
    }
    if (this.state !== 'fly' && this.state !== 'leave') {
      const q = spotPoint(this.spot!);
      this.pos = { x: q.x, y: q.y };
      this.angle = q.angle;
    }
    this.sync();
  }

  private rest(w: FaunaWorld): void {
    this.waitFor = rangeOf(this.rng, [...CICADA_TUNING.quiet]) / w.speed;
    this.go('sit');
  }

  private startShuffle(): void {
    const s = this.spot!;
    const len = s.bark.spine.length * 2;
    const d = rangeOf(this.rng, [...CICADA_TUNING.step]) / len;
    // mostly up the trunk, as they do
    const dir = this.rng.chance(0.65) ? -1 : 1;
    this.stepTo = clamp(s.u + dir * d, 0.08, 0.92);
    this.shuffles++;
    this.go('shuffle');
  }

  /** A short buzzing line to another tree (or another spot on this one). */
  private hop(w: FaunaWorld): void {
    const here = this.spot?.bark ?? null;
    const next = chooseSpot(barksOf(w), w.view, this.rng, this.held(w), here);
    if (!next) {
      this.rest(w);
      return;
    }
    this.flights++;
    this.onTree = 0;
    this.stayPut = rangeOf(this.rng, [...CICADA_TUNING.stayPut]);
    this.flyTo(next);
  }

  private depart(w: FaunaWorld): void {
    this.from = { ...this.pos };
    this.to = exitPoint(w.view, this.pos, this.rng, 80);
    this.spot = null;
    this.layer = 'air';
    this.go('leave');
  }

  private flyStep(dt: number, w: FaunaWorld): void {
    const sf = w.speed;
    this.phase += dt * TAU * CICADA_TUNING.hz * sf;
    const total = Math.max(1, dist(this.from, this.to));
    const sp = CICADA_TUNING.fly * sf * this.scale;
    const left = dist(this.pos, this.to);
    if (left <= sp * dt) {
      this.pos = { ...this.to };
      if (this.state === 'leave') {
        this.done = true;
        return;
      }
      // landed: a moment still, then the usual round
      this.layer = 'entities';
      this.onTree = 0;
      this.rest(w);
      return;
    }
    const ux = (this.to.x - this.pos.x) / left;
    const uy = (this.to.y - this.pos.y) / left;
    // a straight line with a buzzing wobble across it, dying out on arrival
    const k = clamp(1 - left / total, 0, 1);
    const wob = Math.sin(this.timer * 17 + this.salt) * CICADA_TUNING.wobble * this.scale * Math.sin(k * Math.PI);
    this.pos.x += ux * sp * dt;
    this.pos.y += uy * sp * dt;
    this.angle = Math.atan2(ux, -uy);
    this.x = this.pos.x - uy * wob;
    this.y = this.pos.y + ux * wob;
    if (this.spot) this.scale = lerp(this.scale, this.scaleAt(this.spot.bark, this.to), 0.1);
  }

  override leave(_w?: FaunaWorld): void {
    this.leaving = true;
  }

  private sync(): void {
    if (this.state === 'fly' || this.state === 'leave') return;
    this.x = this.pos.x;
    this.y = this.pos.y;
    if (this.spot) {
      this.scale = this.scaleAt(this.spot.bark, this.pos);
      this.depthY = this.spot.bark.depth;
    }
  }

  override depth(): number | null {
    return this.layer === 'entities' ? this.depthY : null;
  }

  /** Its pose now (studio, tests). */
  pose(t: number): CicadaPose {
    if (this.state === 'fly' || this.state === 'leave') return flightPose(this.phase);
    if (this.state === 'sing') return songPose(t, this.salt);
    return { ...REST, flat: this.flat };
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== this.layer) return;
    const parts = w.art.get('cicada', (res) => paintCicada(res, 7210));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.rotate(this.angle);
    drawCicada(ctx, parts, this.pose(w.t));
    ctx.restore();
  }
}

const cicada: CreatureDef = {
  kind: 'cicada',
  title: 'cicada',
  role: 'drifter',
  // long summer stays on the trunks; one, sometimes two, by day only
  visit: { gap: [90, 240], first: [8, 30], stay: [300, 700], group: [1, 1.4], max: 2, diurnal: true, visitor: false },
  needs: (w) => barksOf(w).length > 0,
  spawn(w, s) {
    if (barksOf(w).length === 0) return [];
    const rng = w.rng.fork(`cicada:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const out: Cicada[] = [];
    const stay = s.stay || 500;
    for (let i = 0; i < Math.max(1, s.count); i++) {
      // the next one keeps clear of the spots taken before it
      const c = new Cicada(w, rng.fork(`c${i}`), stay * rng.range(0.85, 1.1), out.map((o) => o.perchPoint()!).filter(Boolean));
      if (c.done) break;
      out.push(c);
    }
    return out;
  },
  sheet: {
    w: 520,
    h: 150,
    make(res, seed) {
      const parts = paintCicada(res, seed);
      const box = { w: 26 * K, h: 34 * K, ox: 13 * K, oy: 12 * K };
      const pose = (q: CicadaPose) => paintSprite(res, box, seed + 9, (pt) => drawCicada(pt.ctx, parts, q));
      return [pose(REST), pose(songPose(0.011)), pose({ ...REST, flat: 1 }), pose(flightPose(1.3)), parts.body, parts.abdomen, parts.wing];
    },
  },
  show: { stage: 'coast', spec: { x: 1210, y: 420, w: 140, h: 130 }, w: 560, h: 520, group: 2, order: 345 },
};
export default cicada;
