/** Short-beaked common dolphins (Delphinus delphis): a small pod crossing the coast's bay far out, rolling up to breathe.
 * docs/devlog/197-dolphins.md; docs/systems/fauna.md › Creatures and behaviour. */
import type { Rng } from '../../core/rng';
import { mix, PIGMENTS, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import { clamp, lerp, polygonBounds, smoothstep } from '../math';
import { paintSprite, type Sprite } from '../sprite';
import { regionScale, type Region } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Beak tip to fluke notch at perspective 1 (world units): about 2.1 m. */
export const DOLPHIN_LIFE = 253;
/** Drawn at this many times life, so an arc still reads at the overview while it stays a fleck far out. */
export const DOLPHIN_K = 1.8;
/** The painted body's length (world units): its largest size in the bay. */
const DL = 18;
const U = DL / 40;

export const DOLPHIN_TUNING = {
  /** animals in a pod, with weights */
  pod: [[2, 0.2], [3, 0.35], [4, 0.3], [5, 0.15]] as const,
  /** a calf beside its mother in a pod of three or more */
  calf: 0.5,
  calfSize: 0.62,
  /** seconds between one animal's breaths (each its own rhythm) */
  breath: [3.4, 6.6] as const,
  /** of the rolls: a high one showing the beak */
  high: 0.2,
  /** passes with one modest leap */
  leap: 0.3,
  /** passes where the pod stops and mills a while */
  mill: 0.4,
  millFor: [15, 35] as const,
  /** the share of the bay's width a pass crosses */
  cross: [0.65, 1] as const,
  /** the track's place between the bay's top (0) and bottom (1): the lower half, where they read */
  track: [0.4, 0.8] as const,
};

// ---------------------------------------------------------------------------------------------
// the roll (pure: tests and the studio use it)

export type RollKind = 'low' | 'high' | 'dive' | 'leap';

/** Each roll's path, in body lengths: `run` travelled, the centre `d0` deep at the ends and `p` above the water at the top. */
const ROLLS: Record<RollKind, { time: number; run: number; d0: number; d1: number; p: number; tip: number }> = {
  low: { time: 1.5, run: 1.8, d0: 0.34, d1: 0.36, p: -0.04, tip: 0 },
  high: { time: 1.45, run: 1.7, d0: 0.36, d1: 0.46, p: 0.06, tip: 0 },
  dive: { time: 2.1, run: 1.6, d0: 0.36, d1: 0.6, p: 0.05, tip: 0.75 },
  leap: { time: 1.15, run: 3, d0: 0.6, d1: 0.6, p: 0.45, tip: 0 },
};

export const rollTime = (k: RollKind): number => ROLLS[k].time;

/** The body's centre (body lengths from the surfacing point, facing right, y down) and its pitch (clockwise: nose down) at `u` of a roll. */
export function rollAt(kind: RollKind, u: number): { x: number; y: number; angle: number } {
  const r = ROLLS[kind];
  const v = clamp(u, 0, 1);
  const x = r.run * (v - 0.5);
  if (kind === 'leap') {
    // ballistic: up out of the water, over and back in
    const y = r.d0 - (r.d0 + r.p) * 4 * v * (1 - v);
    const dy = -(r.d0 + r.p) * 4 * (1 - 2 * v);
    return { x, y, angle: Math.atan2(dy, r.run) };
  }
  // the centre rises on a sine and sinks again (deeper at the end of a dive), the body along its path
  const d = lerp(r.d0, r.d1, smoothstep((v - 0.5) * 2));
  const y = d - (d + r.p) * Math.sin(Math.PI * v);
  const dy = -(r.d0 + r.p) * Math.PI * Math.cos(Math.PI * v);
  // a dive pitches over at the end, so the tail stock and flukes lift clear
  return { x, y, angle: Math.atan2(dy, r.run) + r.tip * smoothstep((v - 0.55) / 0.45) };
}

// ---------------------------------------------------------------------------------------------
// art (side view, facing right, the body's centre at the origin; design units: 40 = beak to notch)

const P = (x: number, y: number): Pt => ({ x: x * U, y: y * U });
const pts = (a: readonly (readonly [number, number])[]): Pt[] => a.map(([x, y]) => P(x, y));

const BODY = pts([
  [20, 0.3], [17.2, -0.5], [15.6, -0.9], [14.2, -2.1], [11, -3.1], [6, -3.7], [0, -3.8], [-5, -3.3], [-10, -2.4], [-14, -1.5], [-17.4, -1.0], [-18.6, -0.9],
  [-18.6, 0.9], [-17.4, 1.1], [-14, 1.8], [-10, 2.8], [-5, 3.5], [0, 3.7], [6, 3.4], [11, 2.5], [14, 1.4], [15.6, 0.9], [17.2, 0.7],
]);
const FIN = pts([[4.6, -3.4], [3.2, -5.6], [1, -8.2], [-2.6, -10.2], [-3.2, -9.8], [-2.2, -7.8], [-1.6, -5.6], [-2.4, -3.2]]);
const FLUKES = pts([[-18, -0.9], [-20.4, -2.1], [-22.8, -2.6], [-21.6, -1], [-21.2, 0.1], [-21.8, 1.5], [-20, 1.3], [-18, 0.9]]);
const FLIPPER = pts([[9.6, 1.8], [8, 3.1], [6, 4.0], [5.6, 3.8], [7, 2.6], [7.6, 2.0]]);
/** the dark cape, dipping to a V under the fin between the two halves of the hourglass */
const CAPE = pts([
  [17.2, -0.5], [15.6, -0.9], [14.2, -2.1], [11, -3.1], [6, -3.7], [0, -3.8], [-5, -3.3], [-10, -2.4], [-14, -1.5], [-17.4, -1.0], [-18.6, -0.9],
  [-18.6, -0.1], [-15, -0.4], [-10, -0.8], [-5.4, -1.2], [-1.2, 0.9], [2.6, -1.1], [7.6, -1.7], [11.4, -1.2], [14, -0.3], [16, 0.1],
]);
/** the hourglass: the ochre front half from the eye to under the fin, the grey rear half to the tail stock */
const THORAX = pts([[13, 0.4], [10.6, -0.9], [7.4, -1.3], [2.8, -0.8], [-0.6, 1.4], [3, 2.4], [8, 2.0], [11.6, 1.3]]);
const REAR = pts([[-1.6, 1.3], [-5.6, -0.8], [-10, -0.5], [-15, -0.1], [-17.6, 0.3], [-15, 1.4], [-10, 2.1], [-5, 2.6]]);

/** The outline (body, fin, flukes) in body lengths about the centre: what must stay under the water at a roll's ends (tests). */
export const OUTLINE: readonly Pt[] = [...BODY, ...FIN, ...FLUKES].map((q) => ({ x: q.x / DL, y: q.y / DL }));

const COLOURS = {
  belly: '#ece8dc',
  cape: '#323c48',
  capeSoft: '#4a5a6a',
  ochre: '#ecc683',
  grey: '#8a96a0',
  shade: mix(PIGMENTS.shadow, '#8a96a0', 0.5),
  white: '#fffdf8',
  ring: mix('#1f5f8e', '#1d7891', 0.4),
};

function paintBody(p: Painter): void {
  const rng = p.rng;
  const c = COLOURS;
  const body = smoothPolygon(BODY, 2);
  // the pale ground, opaque: the sea must not show through where it is out
  p.wash(body, c.belly, { rng, opacity: 1, edge: 0, darken: 0, deform: 0.02, spread: 0.01, layers: 4, blend: 'source-over' });
  p.glaze(body, c.shade, { rng, opacity: 0.3, edge: 0, darken: 0, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.45, amount: 1, ragged: 0.6 } });
  p.glaze(smoothPolygon(REAR, 1), c.grey, { rng, opacity: 0.75, edge: 0.15, deform: 0.12, spread: 0.08 });
  p.glaze(smoothPolygon(THORAX, 1), c.ochre, { rng, opacity: 0.7, edge: 0.15, deform: 0.12, spread: 0.08 });
  // the cape: one wet stroke, darkest along the back
  p.wetInWet(smoothPolygon(CAPE, 1), c.cape, c.capeSoft, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.6, fingers: 0.3, opacity: 0.96, edge: 0.3, edgeWidth: 0.4, deform: 0.05, granulation: 0.25, blend: 'source-over' });
  for (const s of [FIN, FLUKES]) p.wash(smoothPolygon(s, 1), c.cape, { rng, opacity: 0.97, edge: 0.3, edgeWidth: 0.4, sharpness: 0.4, deform: 0.03, spread: 0.02, layers: 4, blend: 'source-over' });
  p.wash(smoothPolygon(FLIPPER, 1), mix(c.cape, c.grey, 0.35), { rng, opacity: 0.92, edge: 0.3, deform: 0.04, layers: 3, blend: 'source-over' });
  // the eye in its dark stripe to the beak, and the beak's dark top
  p.inkLine(pts([[12.6, -0.4], [15, -0.1], [17.6, 0]]), { rng, width: 0.7 * U, opacity: 0.7, breaks: 0.2, pigment: c.cape, taper: [0.4, 0.3] });
  p.dab(P(12.6, -0.5), c.cape, { rng, variant: 'round', angle: 0, length: 1.2 * U, width: 1 * U, opacity: 0.95, layers: 2 });
  // wet: the sky caught along the back and the fin's leading edge
  p.inkLine(pts([[10, -2.6], [4, -3.1], [-3, -3.0], [-9, -2.0]]), { rng, width: 0.55 * U, opacity: 0.55, breaks: 0.35, wobble: 0.2, pigment: c.white, taper: [0.5, 0.6] });
  p.inkLine(pts([[3.6, -4.8], [1.6, -7.2], [-1.2, -9.2]]), { rng, width: 0.35 * U, opacity: 0.35, breaks: 0.4, pigment: c.white, taper: [0.4, 0.6] });
}

/** A splash where the body cuts back in: a few pale drops thrown up and a flat foam lip, its base at the origin. `big` for a leap. */
function paintSplash(p: Painter, big: boolean): void {
  const rng = p.rng;
  const k = big ? 1.7 : 1;
  // a few thin streaks thrown up unevenly, and loose drops over them
  for (let i = 0; i < (big ? 5 : 3); i++) {
    const a = -Math.PI / 2 + rng.range(-0.75, 0.75);
    p.dab({ x: rng.range(-1.2, 1.2) * k, y: 0 }, COLOURS.white, { rng, variant: 'leaf', angle: a, length: rng.range(0.9, 2.4) * k, width: rng.range(0.3, 0.5) * k, opacity: 0.92, layers: 2, edge: 0.05, blend: 'source-over' });
  }
  for (let i = 0; i < (big ? 6 : 3); i++) {
    const r = rng.range(0.25, 0.45) * k;
    p.dab({ x: rng.range(-1.8, 1.8) * k, y: -rng.range(1, 2.8) * k }, COLOURS.white, { rng, variant: 'round', angle: 0, length: r, width: r, opacity: 0.85, layers: 1, edge: 0, blend: 'source-over' });
  }
  p.inkLine([{ x: -2.2 * k, y: 0.1 }, { x: rng.range(-0.5, 0.5), y: 0.3 }, { x: 2.2 * k, y: 0.1 }], { rng, width: 0.5 * k, opacity: 0.9, breaks: 0.35, pigment: COLOURS.white, taper: [0.5, 0.5] });
}

export interface DolphinParts {
  body: Sprite; // the centre at the origin, facing right
  splash: Sprite; // base at the origin
  bigSplash: Sprite;
  ring: Sprite; // a ring on the far water, `RING_W` wide
}

const RING_W = 16;

export function paintDolphin(res: number, seed: number): DolphinParts {
  return {
    body: paintSprite(res, { w: 44 * U, h: 16.5 * U, ox: 23.2 * U, oy: 11.2 * U }, seed, (p) => paintBody(p)),
    splash: paintSprite(res, { w: 7, h: 4, ox: 3.5, oy: 3.2 }, seed + 1, (p) => paintSplash(p, false)),
    bigSplash: paintSprite(res, { w: 11, h: 6, ox: 5.5, oy: 5 }, seed + 2, (p) => paintSplash(p, true)),
    ring: paintSprite(res, { w: RING_W + 2, h: 4, ox: RING_W / 2 + 1, oy: 2 }, seed + 3, (p, rng) =>
      p.ripple({ x: 0, y: 0 }, { rng, width: RING_W, count: 1, squash: 0.13, pigment: COLOURS.ring, opacity: 0.4, light: 0.8, lineWidth: 0.45 }),
    ),
  };
}

/** One body in a roll at `u`: its surfacing point `(x, y)` on the water, `L` long, `dir` its heading; clipped at the waterline. */
export function drawRoll(ctx: Ctx, parts: DolphinParts, kind: RollKind, u: number, x: number, y: number, L: number, dir: number): void {
  const q = rollAt(kind, u);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2 * L, y - 1.6 * L, 4 * L, 1.6 * L);
  ctx.clip();
  ctx.translate(x + dir * q.x * L, y + q.y * L);
  ctx.scale((dir * L) / DL, L / DL);
  ctx.rotate(q.angle);
  const s = parts.body;
  ctx.drawImage(s.img as CanvasImageSource, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

/** The nose's height (body lengths, − above the water) and x at `u` of a roll. */
export function noseAt(kind: RollKind, u: number): { x: number; y: number } {
  const q = rollAt(kind, u);
  return { x: q.x + 0.5 * Math.cos(q.angle), y: q.y + 0.5 * Math.sin(q.angle) };
}

/** Where the nose cuts back into the water in each roll (`u`, x in body lengths): the splash. */
const REENTRY: Record<RollKind, { u: number; x: number }> = (() => {
  const out = {} as Record<RollKind, { u: number; x: number }>;
  for (const k of Object.keys(ROLLS) as RollKind[]) {
    let at = { u: 0.7, x: 0.5 };
    for (let i = 50; i < 200; i++) {
      const u = i / 200;
      const n = noseAt(k, u);
      if (n.y >= 0 && noseAt(k, u - 0.005).y < 0) {
        at = { u, x: n.x };
        break;
      }
    }
    out[k] = at;
  }
  return out;
})();

// ---------------------------------------------------------------------------------------------
// the bay

/** The bay's span at `y`: where a horizontal line crosses its outline. */
export function spanAt(r: Pick<Region, 'outline'>, y: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  const o = r.outline;
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!;
    const b = o[(i + 1) % o.length]!;
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      const x = a.y === b.y ? Math.min(a.x, b.x) : a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      const x2 = a.y === b.y ? Math.max(a.x, b.x) : x;
      lo = Math.min(lo, x, x2);
      hi = Math.max(hi, x, x2);
    }
  }
  return lo < hi ? [lo, hi] : null;
}

/** A dolphin's drawn length at `y` in the bay. */
export const dolphinLength = (bay: Region, y: number): number => DOLPHIN_LIFE * DOLPHIN_K * (regionScale(bay, y) ?? 0.03);

const bays = new WeakMap<readonly Region[], Region | null>();
export function bayOf(w: Pick<FaunaWorld, 'regions'>): Region | null {
  let b = bays.get(w.regions);
  if (b === undefined) {
    b = w.regions.find((r) => r.kind === 'bay' && r.scale) ?? null;
    bays.set(w.regions, b);
  }
  return b;
}

/** A pass across the bay: its track's y, heading, start and end x, how long it travels and whether (and where) it mills. */
export interface PassPlan {
  y: number;
  dir: number;
  x0: number;
  x1: number;
  travel: number;
  millAt: number | null;
  millFor: number;
  leapAt: number | null;
  size: number;
  calf: boolean;
}

export function planPass(bay: Region, rng: Rng, o: { stay: number; size?: number; reduced?: boolean }): PassPlan {
  const T = DOLPHIN_TUNING;
  const b = polygonBounds(bay.outline);
  const y = b.y + b.h * rng.range(T.track[0], T.track[1]);
  const L = dolphinLength(bay, y);
  const [lo, hi] = spanAt(bay, y) ?? [b.x, b.x + b.w];
  const dir = rng.chance(0.5) ? 1 : -1;
  const width = hi - lo - 4.4 * L;
  const run = width * rng.range(T.cross[0], T.cross[1]);
  // in at one side, a little inside its edge
  const start = dir > 0 ? lo + 2.2 * L : hi - 2.2 * L;
  const mill = rng.chance(T.mill);
  const millFor = mill ? rng.range(T.millFor[0], T.millFor[1]) : 0;
  const travel = Math.max(30, o.stay - millFor);
  let size = o.size ?? 0;
  if (!size) {
    let v = rng.next();
    size = T.pod[T.pod.length - 1]![0];
    for (const [n, wgt] of T.pod) {
      if ((v -= wgt) < 0) {
        size = n;
        break;
      }
    }
  }
  size = clamp(Math.round(size), 2, 5);
  return {
    y,
    dir,
    x0: start,
    x1: start + dir * run,
    travel,
    millAt: mill ? rng.range(0.3, 0.65) : null,
    millFor,
    leapAt: !o.reduced && rng.chance(T.leap) ? rng.range(0.2, 0.75) : null,
    size,
    calf: size >= 3 && rng.chance(T.calf),
  };
}

// ---------------------------------------------------------------------------------------------
// the pod

interface Roll {
  kind: RollKind;
  u: number;
  x: number;
  y: number;
  L: number;
  dir: number;
  splashed: boolean;
}

interface Animal {
  /** body lengths behind (−) or ahead of the pod's centre along its track, and its depth offset (world units) */
  lag: number;
  dy: number;
  size: number;
  period: number;
  next: number;
  roll: Roll | null;
  /** index of its mother (a calf) */
  mother: number;
  out: boolean;
  /** breaths it could not take while the pod leaves */
  blocked: number;
  /** its last roll (a calf: the one it follows its mother in) */
  last: RollKind;
  /** milling: where it wanders round the pod's centre */
  mx: number;
  my: number;
}

interface Mark {
  x: number;
  y: number;
  age: number;
  life: number;
  w0: number;
  w1: number;
  a: number;
  big?: boolean;
}

export class Pod extends BaseCreature {
  readonly kind = 'dolphin' as const;
  readonly visitor = false;
  override layer: LayerId = 'waterSurface';
  readonly animals: Animal[] = [];
  /** what it did (tests and the studio) */
  readonly did = { rolls: 0, high: 0, dive: 0, leap: 0, mill: 0 };
  private rings: Mark[] = [];
  private splashes: Mark[] = [];
  private px: number;
  private age = 0;
  private millLeft = -1;
  private leapt = false;
  private gone = false;

  constructor(
    readonly bay: Region,
    readonly rng: Rng,
    readonly plan: PassPlan,
  ) {
    super();
    this.state = 'travel';
    this.px = plan.x0;
    const T = DOLPHIN_TUNING;
    const adults = plan.size - (plan.calf ? 1 : 0);
    for (let i = 0; i < adults; i++) {
      this.animals.push({
        // a loose line: the leader ahead, the others strung out behind and a little to either side
        lag: i === 0 ? rng.range(0.4, 1) : -i * rng.range(1, 1.8),
        dy: rng.range(-1.6, 1.6),
        size: rng.range(0.92, 1.06),
        period: rng.range(T.breath[0], T.breath[1]),
        // the leader breaks the surface at once (the arrival line is true), the others in turn
        next: i === 0 ? 0 : rng.range(0.8, 3.2) * i,
        roll: null,
        mother: -1,
        out: false,
        blocked: 0,
        last: 'low',
        mx: 0,
        my: 0,
      });
    }
    if (plan.calf) {
      const m = rng.int(0, adults - 1);
      const mother = this.animals[m]!;
      this.animals.push({ lag: mother.lag + rng.range(-0.1, 0.25), dy: mother.dy + 0.9, size: T.calfSize, period: mother.period, next: Infinity, roll: null, mother: m, out: false, blocked: 0, last: 'low', mx: 0, my: 0 });
    }
    this.x = this.px;
    this.y = plan.y;
  }

  /** Seconds since the pass began. */
  get time(): number {
    return this.age;
  }

  /** Bodies at the surface now (tests). */
  surfacing(): { x: number; y: number; L: number; kind: RollKind; u: number }[] {
    return this.animals.filter((a) => a.roll).map((a) => ({ x: a.roll!.x, y: a.roll!.y, L: a.roll!.L, kind: a.roll!.kind, u: a.roll!.u }));
  }

  /** Every mark on the water now: rings and splashes (tests). */
  marks(): { x: number; y: number; w: number }[] {
    return [...this.rings.map((r) => ({ x: r.x, y: r.y, w: lerp(r.w0, r.w1, r.age / r.life) })), ...this.splashes.map((s) => ({ x: s.x, y: s.y, w: s.w1 }))];
  }

  override leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.state = 'dive';
  }

  private animalAt(a: Animal): Pt {
    const L = dolphinLength(this.bay, this.plan.y);
    return { x: this.px + this.plan.dir * a.lag * L + a.mx * L, y: this.plan.y + a.dy + a.my };
  }

  private startRoll(i: number, kind: RollKind): boolean {
    const a = this.animals[i]!;
    const at = this.animalAt(a);
    const L = dolphinLength(this.bay, at.y) * a.size;
    // milling, each goes its own way
    const dir = this.state === 'mill' ? (this.rng.chance(0.5) ? 1 : -1) : this.plan.dir;
    const span = spanAt(this.bay, at.y);
    const reach = (ROLLS[kind].run / 2 + 0.7 + (kind === 'leap' ? 0.6 : 0)) * L;
    if (!span || at.x - reach < span[0] || at.x + reach > span[1]) return false;
    a.roll = { kind, u: 0, x: at.x, y: at.y, L, dir, splashed: false };
    this.did.rolls++;
    if (kind === 'high') this.did.high++;
    if (kind === 'dive') this.did.dive++;
    if (kind === 'leap') this.did.leap++;
    // its calf comes up beside it a beat later
    this.animals.forEach((c) => {
      if (c.mother !== i || c.roll || c.out) return;
      c.next = this.rng.range(0.2, 0.4);
      c.last = kind === 'leap' ? 'low' : kind;
    });
    return true;
  }

  private rollStep(a: Animal, step: number): void {
    const r = a.roll!;
    r.u += step / rollTime(r.kind);
    const re = REENTRY[r.kind];
    if (!r.splashed && r.u >= re.u) {
      r.splashed = true;
      const sx = r.x + r.dir * re.x * r.L;
      const big = r.kind === 'leap';
      this.splashes.push({ x: sx, y: r.y, age: 0, life: big ? 1.1 : 0.75, w0: 0, w1: (big ? 0.6 : 0.36) * r.L, a: big ? 1 : 0.85, big });
      this.rings.push({ x: sx, y: r.y, age: 0, life: big ? 5 : 3.6, w0: 0.35 * r.L, w1: (big ? 2.2 : 1.5) * r.L, a: big ? 0.9 : 0.7 });
    }
    if (r.u < 1) return;
    a.roll = null;
    a.last = r.kind;
    if (r.kind === 'dive' && this.leaving) a.out = true;
    a.next = a.mother >= 0 ? Infinity : a.period * this.rng.range(0.85, 1.15);
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const step = dt * w.speed;
    this.age += step;
    this.timer += step;
    // a drifter: the sim sends it nowhere, so it watches the day and its pass itself
    if (!this.leaving && (w.mode.night || this.age > this.plan.travel + this.plan.millFor + 20)) this.leave();
    const { plan } = this;
    if (this.state === 'travel') {
      const speed = Math.abs(plan.x1 - plan.x0) / plan.travel;
      const before = (this.px - plan.x0) * plan.dir;
      this.px += plan.dir * speed * step;
      const done = (this.px - plan.x0) * plan.dir;
      const total = Math.abs(plan.x1 - plan.x0);
      if (plan.millAt !== null && this.millLeft < 0 && before < plan.millAt * total && done >= plan.millAt * total) {
        this.state = 'mill';
        this.millLeft = plan.millFor;
        this.did.mill++;
      }
      if (done >= total) this.leave();
    } else if (this.state === 'mill') {
      this.millLeft -= step;
      // they spread round the spot and drift about it
      for (const [i, a] of this.animals.entries()) {
        if (a.mother >= 0) continue;
        a.mx = Math.sin(this.age * 0.21 + i * 2.1) * 1.4;
        a.my = Math.cos(this.age * 0.17 + i * 1.3) * 1.1;
      }
      if (this.millLeft <= 0) {
        this.state = 'travel';
        this.millLeft = 0;
      }
    }
    for (const [i, a] of this.animals.entries()) {
      const mum = a.mother >= 0 ? this.animals[a.mother]! : null;
      if (mum) {
        a.mx = mum.mx;
        a.my = mum.my;
      }
      if (a.roll) {
        this.rollStep(a, step);
        continue;
      }
      // a calf goes down with its mother
      if (mum?.out) a.out = true;
      if (a.out || a.next === Infinity) continue;
      a.next -= step;
      if (a.next > 0) continue;
      let kind: RollKind = 'low';
      if (mum) kind = a.last;
      else if (this.leaving) kind = 'dive';
      else if (plan.leapAt !== null && !this.leapt && this.state === 'travel' && this.age > plan.leapAt * plan.travel) kind = 'leap';
      else if (this.rng.chance(DOLPHIN_TUNING.high)) kind = 'high';
      if (this.startRoll(i, kind)) {
        if (kind === 'leap') this.leapt = true;
      } else if (this.leaving && ++a.blocked > 4) {
        a.out = true;
      } else {
        // out of the bay's reach (still coming in, or past its end): stay under a while
        a.next = mum && !this.leaving ? Infinity : 1.2;
      }
    }
    for (const m of this.rings) m.age += step;
    for (const m of this.splashes) m.age += step;
    this.rings = this.rings.filter((m) => m.age < m.life);
    this.splashes = this.splashes.filter((m) => m.age < m.life);
    if (this.leaving && this.animals.every((a) => a.out && !a.roll) && this.rings.length === 0 && this.splashes.length === 0) {
      this.gone = true;
      this.done = true;
    }
    this.x = this.px;
    this.y = plan.y;
    if (this.gone) this.state = 'gone';
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'waterSurface') return;
    const parts = w.art.get('dolphin', (res) => paintDolphin(res, 6100));
    const ring = parts.ring;
    for (const m of this.rings) {
      const k = m.age / m.life;
      const s = lerp(m.w0, m.w1, 1 - (1 - k) ** 2) / RING_W;
      ctx.globalAlpha = m.a * (1 - k) ** 1.3;
      ctx.drawImage(ring.img as CanvasImageSource, m.x - ring.ox * s, m.y - ring.oy * s, ring.w * s, ring.h * s);
    }
    ctx.globalAlpha = 1;
    // far ones first
    const up = this.animals.filter((a) => a.roll).sort((a, b) => a.roll!.y - b.roll!.y);
    for (const a of up) {
      const r = a.roll!;
      drawRoll(ctx, parts, r.kind, r.u, r.x, r.y, r.L, r.dir);
    }
    for (const m of this.splashes) {
      const k = m.age / m.life;
      const sp = m.big ? parts.bigSplash : parts.splash;
      const s = m.w1 / sp.w;
      // thrown up quickly, falling back slower
      const rise = k < 0.2 ? smoothstep(k / 0.2) : 1 - 0.55 * smoothstep((k - 0.2) / 0.8);
      ctx.globalAlpha = m.a * (1 - smoothstep((k - 0.45) / 0.55));
      ctx.drawImage(sp.img as CanvasImageSource, m.x - sp.ox * s, m.y - sp.oy * s * rise, sp.w * s, sp.h * s * rise);
    }
    ctx.globalAlpha = 1;
  }

  override depth(): number | null {
    return null;
  }
}

const dolphin: CreatureDef = {
  kind: 'dolphin',
  title: 'common dolphins',
  role: 'drifter',
  // rare: a pass now and then, by day; one pod at a time
  visit: { gap: [1500, 3000], first: [600, 1500], stay: [60, 100], group: [1, 1], max: 1, diurnal: true, visitor: false },
  needs: (w) => bayOf(w) !== null,
  spawn(w, s) {
    const bay = bayOf(w);
    if (!bay) return [];
    const rng = w.rng.fork(`dolphin:${s.seed}:${w.t.toFixed(3)}:${w.creatures.length}`);
    const plan = planPass(bay, rng, { stay: s.stay || 80, size: s.count > 1 ? s.count : undefined /* a hand spawn's count is the pod's size */, reduced: w.mode.reduced });
    return [new Pod(bay, rng.fork('pod'), plan)];
  },
  sheet: {
    w: 520,
    h: 90,
    make(res, seed) {
      const a = paintDolphin(res * 3, seed);
      return [a.body, a.splash, a.bigSplash, a.ring];
    },
  },
  show: { stage: 'coast', spec: { x: 160, y: 380, w: 400, h: 90 }, w: 840, h: 189, order: 43 },
};
export default dolphin;
