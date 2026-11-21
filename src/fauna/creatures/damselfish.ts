/**
 * Damselfish (Chromis chromis): a loose shoal of small oval fish with deeply forked tails that
 * hangs in the cove's clear shallows by day, all facing one way. It drifts a little along the
 * shore, turns as one, and tightens and sinks when a gull, the heron or a shadow passes over.
 * One creature draws the whole shoal. docs/devlog/209-damselfish.md
 */
import type { Rng } from '../../core/rng';
import { blob, lighten, mix, PIGMENTS, shade, smoothPolygon, type Painter } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt, Rect } from '../../render/viewport';
import { angleDiff, approach, clamp, dist, distanceToPolygon, lerp, pointInPolygon, polygonBounds, rangeOf, smoothstep, springStep, TAU, turnToward } from '../math';
import { deepCopy, paintSprite, type Sprite } from '../sprite';
import { inRegion, type Pad, type Region } from '../targets';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

/** Snout to the fork's tips at perspective 1 (world units): about 1.4 × a 10 cm adult, so the shoal reads at the overview. */
export const DAMSELFISH_LEN = 16;
/** The sea plane seen low: offsets across the view keep their size, offsets toward the horizon shrink. */
export const SQUASH = 0.5;

/** The spreads a shoal tries, loosest first: in a narrow stretch it hangs closer. */
export const ROOM = [1, 0.86, 0.73, 0.6] as const;

export const DAMSELFISH_TUNING = {
  /** fish in a shoal */
  fish: [12, 20] as const,
  /** the loose shoal's radius (plane units at perspective 1); tight it shrinks to `tight` of it */
  radius: 50,
  tight: 0.42,
  /** how deep it hangs (0 under the surface … 1 on the bottom), loose and frightened */
  hoverZ: 0.35,
  tightZ: 0.88,
  /** how far over its shadow a fish at the surface hangs (world units at perspective 1) */
  lift: 14,
  /** a still spell (s) before it drifts or turns, and how often that is a drift */
  hover: [10, 26] as const,
  driftChance: 0.55,
  /** a drift along the shore: how far (world units) and how fast (units/s at perspective 1) */
  drift: [24, 110] as const,
  speed: 6,
  /** how near each kind passes before it tightens and sinks (world units, y counted half) */
  threats: { gull: 120, heron: 150 } as Record<string, number>,
  /** it stays tight this long after the last threat (s), and moves off one that lingers this long */
  calm: [5, 10] as const,
  linger: 6,
  /** a shadow from beyond the view (a gull high over, a boat's): every this many seconds, tight this long */
  shadow: [70, 200] as const,
  shadowTight: [3, 6] as const,
  /** its centre stays in this part of the shallows' depth at its column (0 the turquoise's edge … 1 the waterline) */
  band: [0.1, 0.55] as const,
  /** clear of the rocks (the region's holes) and planted water plants (world units) */
  rockGap: 6,
  padGap: 10,
};

// ---------------------------------------------------------------------------------------------
// art: from above, head toward +x, the origin at the body's middle

const L = DAMSELFISH_LEN;
const HEAD = 0.36 * L;
const ROOT = -0.3 * L;
const HW = 0.185 * L;

const COL = {
  back: '#1f2b42',
  flank: '#2f5d92',
  line: '#78aee0',
  fin: mix('#335a86', '#1f2b42', 0.3),
  edge: '#1c2638',
  eye: mix(PIGMENTS.sumi, '#1c2230', 0.5),
  shadow: mix(PIGMENTS.indigo, PIGMENTS.stoneDark, 0.55),
  glint: '#d8ecf4',
};

/** Half-width along the body (s: 0 snout … 1 tail root), as a fraction of `HW`: a blunt head, an oval, a slim stalk. */
export function bodyProfile(s: number): number {
  const nose = Math.sqrt(clamp(s / 0.16, 0, 1));
  const body = s < 0.38 ? 0.84 + 0.16 * Math.sin((s / 0.38) * (Math.PI / 2)) : 1 - 0.78 * ((s - 0.38) / 0.62) ** 1.3;
  return nose * body;
}

function bodyPolygon(): Pt[] {
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    const x = lerp(HEAD, ROOT, s);
    const w = HW * bodyProfile(s);
    top.push({ x, y: -w });
    bottom.push({ x, y: w });
  }
  return [...top, ...bottom.reverse()];
}

/** The forked tail from its root at the origin, pointing −x: two lobes and a deep notch. */
function tailPolygon(): Pt[] {
  const t = 0.3 * L;
  return smoothPolygon(
    [
      { x: 0.6, y: -0.06 * L },
      { x: -t * 0.5, y: -0.14 * L },
      { x: -t, y: -0.23 * L },
      { x: -t * 0.8, y: -0.11 * L },
      { x: -t * 0.5, y: 0 },
      { x: -t * 0.8, y: 0.11 * L },
      { x: -t, y: 0.23 * L },
      { x: -t * 0.5, y: 0.14 * L },
      { x: 0.6, y: 0.06 * L },
    ],
    1,
  );
}

function paintBody(p: Painter, rng: Rng): void {
  const poly = bodyPolygon();
  // pectoral fins held out, sculling: clear and faint
  for (const side of [-1, 1]) {
    p.dab({ x: HEAD - 0.28 * L, y: side * HW * 0.75 }, COL.fin, { rng, variant: 'leaf', angle: Math.PI - side * 0.6, length: 0.14 * L, width: 0.06 * L, opacity: 0.22, blend: 'source-over' });
  }
  p.wash(poly, COL.flank, { rng, blend: 'source-over', opacity: 0.92, deform: 0.04, spread: 0.03, edge: 0.25, edgeWidth: 0.6, sharpness: 0.15, centreLift: 0.05, granulation: 0.15 });
  // the dark back bled into the blue flanks, darkest over the head
  const area = { x: ROOT - 2, y: -HW - 2, w: HEAD - ROOT + 4, h: HW * 2 + 4 };
  const back = p.layer(area);
  back.clip(poly);
  for (let k = 0; k < 4; k++) back.fill(blob((HEAD + ROOT) / 2 + 0.5, 0, (HEAD - ROOT) * 0.5, HW * 0.7, rng, { irregularity: 0.2, points: 24 }), COL.back, 0.24);
  back.fill(blob(HEAD - 0.12 * L, 0, 0.12 * L, HW * 0.62, rng, { irregularity: 0.2 }), shade(COL.back, 0.2), 0.3);
  back.dry({ opacity: 0.95, edge: 0.2, edgeWidth: 0.5, sharpness: 0.2, centreLift: 0.1, granulation: 0.25, flow: 0.6, flowScale: 3, blend: 'source-over' });
  // the young fish's bright line from the snout over each eye toward the dorsal fin
  for (const side of [-1, 1]) {
    p.stroke(
      [
        { x: HEAD - 0.02 * L, y: side * HW * 0.2 },
        { x: HEAD - 0.12 * L, y: side * HW * 0.5 },
        { x: HEAD - 0.32 * L, y: side * HW * 0.48 },
      ],
      { rng, pigment: COL.line, width: 0.035 * L, wetness: 0.6, opacity: 0.5, taper: [0.2, 0.7], blend: 'source-over' },
    );
    p.dab({ x: HEAD - 0.1 * L, y: side * HW * 0.66 }, COL.eye, { rng, variant: 'round', angle: 0, length: 0.07 * L, width: 0.06 * L, opacity: 0.6 });
  }
  // the dorsal fin edge-on along the back
  p.stroke(
    [
      { x: HEAD - 0.26 * L, y: 0 },
      { x: (HEAD + ROOT) / 2 - 0.05 * L, y: rng.range(-0.2, 0.2) },
      { x: ROOT + 0.04 * L, y: 0 },
    ],
    { rng, pigment: COL.edge, width: 0.04 * L, wetness: 0.8, opacity: 0.35, taper: [0.3, 0.6] },
  );
}

function paintTail(p: Painter, rng: Rng): void {
  p.wash(tailPolygon(), COL.fin, { rng, blend: 'source-over', opacity: 0.72, deform: 0.05, edge: 0.45, edgeWidth: 0.4, sharpness: 0.2, centreLift: 0.15 });
  // the lobes' dark trailing edges
  const t = 0.3 * L;
  for (const side of [-1, 1]) {
    p.stroke(
      [
        { x: -t * 0.5, y: side * 0.03 * L },
        { x: -t * 0.8, y: side * 0.12 * L },
        { x: -t, y: side * 0.22 * L },
      ],
      { rng, pigment: COL.edge, width: 0.03 * L, wetness: 0.6, opacity: 0.55, taper: [0.4, 0.2] },
    );
  }
}

export interface DamselfishParts {
  /** body and tail, the tail swept −, 0, + (a flick each way) */
  frames: [Sprite, Sprite, Sprite];
  /** the same, soft and cool: a fish down near the bottom */
  deep: [Sprite, Sprite, Sprite];
  /** the light caught on a flank as it turns */
  glint: Sprite;
  /** its blurred shadow on the bed */
  shadow: Sprite;
  /** the parts alone (sheet) */
  body: Sprite;
  tail: Sprite;
}

export const TAIL_SWEEP = 0.26;

export function paintDamselfish(res: number, seed: number): DamselfishParts {
  const box = { w: HEAD - ROOT + 0.36 * L + 2, h: 0.56 * L + 2, ox: -ROOT + 0.34 * L + 1, oy: 0.28 * L + 1 };
  const body = paintSprite(res, { w: HEAD - ROOT + 2, h: HW * 2 + 0.2 * L, ox: -ROOT + 1, oy: HW + 0.1 * L }, seed, paintBody);
  const tail = paintSprite(res, { w: 0.32 * L + 2, h: 0.5 * L + 2, ox: 0.32 * L + 1, oy: 0.25 * L + 1 }, seed + 1, paintTail);
  const frame = (sweep: number) =>
    paintSprite(res, box, seed + 2, (p) => {
      const c = p.ctx;
      c.save();
      c.translate(ROOT + 0.02 * L, 0);
      c.rotate(sweep);
      c.drawImage(tail.img as CanvasImageSource, -tail.ox, -tail.oy, tail.w, tail.h);
      c.restore();
      c.drawImage(body.img as CanvasImageSource, -body.ox, -body.oy, body.w, body.h);
    });
  const cool = PIGMENTS.celadonDeep;
  // seen through clear water: a little soft even near the surface
  const frames = [frame(-TAIL_SWEEP), frame(0), frame(TAIL_SWEEP)].map((f) => deepCopy(f, res, cool, 0.18, 1.5)) as DamselfishParts['frames'];
  const glint = paintSprite(res, { w: HEAD - ROOT + 2, h: HW * 2 + 2, ox: -ROOT + 1, oy: HW + 1 }, seed + 5, (p, rng) => {
    // a long thin streak of light along one flank, not a spot
    p.dab({ x: (HEAD + ROOT) / 2, y: HW * 0.42 }, COL.glint, { rng, variant: 'leaf', angle: 0, length: (HEAD - ROOT) * 0.85, width: HW * 0.42, opacity: 0.6, blend: 'source-over' });
    p.dab({ x: (HEAD + ROOT) / 2 - 0.04 * L, y: HW * 0.4 }, lighten(COL.line, 0.3), { rng, variant: 'leaf', angle: 0, length: (HEAD - ROOT) * 0.5, width: HW * 0.2, opacity: 0.6, blend: 'source-over' });
  });
  const sh = paintSprite(res, { w: box.w + 4, h: box.h + 4, ox: box.ox + 2, oy: box.oy + 2 }, seed + 6, (p, rng) => {
    p.wash(bodyPolygon(), COL.shadow, { rng, blend: 'source-over', opacity: 0.9, edge: 0, centreLift: 0, sharpness: 0.1 });
    p.ctx.save();
    p.ctx.translate(ROOT + 0.02 * L, 0);
    p.wash(tailPolygon(), COL.shadow, { rng, blend: 'source-over', opacity: 0.7, edge: 0, centreLift: 0, sharpness: 0.1 });
    p.ctx.restore();
  });
  return {
    frames,
    deep: frames.map((f) => deepCopy(f, res, cool, 0.35, 1.9)) as DamselfishParts['deep'],
    glint,
    shadow: deepCopy(deepCopy(sh, res, cool, 0.15, 3), res, cool, 0, 3),
    body,
    tail,
  };
}

// ---------------------------------------------------------------------------------------------
// where it lives (pure)

/** The top and bottom of a closed outline at column x, or null where it does not reach. */
export function columnSpan(poly: readonly Pt[], x: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return hi > lo ? [lo, hi] : null;
}

/** The shoal's half-extents in world units at a perspective and spread (x across, y toward the horizon), its fish and their wander included. */
export function shoalExtent(ps: number, spread = 1): { rx: number; ry: number } {
  const r = (DAMSELFISH_TUNING.radius * spread + DAMSELFISH_LEN * 0.65 + 3) * ps;
  return { rx: r, ry: r * SQUASH };
}

const holeBoxes = new WeakMap<object, Rect[]>();

/** Is a fish's bed point in clear water: in the shallows, off its rocks, off a planted water plant? */
export function clearWater(r: Region, q: Pt, pads: readonly Pad[], gap = 0): boolean {
  if (!pointInPolygon(q, r.outline)) return false;
  const holes = r.holes ?? [];
  let boxes = holeBoxes.get(holes);
  if (!boxes) holeBoxes.set(holes, (boxes = holes.map((h) => polygonBounds(h))));
  for (let i = 0; i < holes.length; i++) {
    const b = boxes[i]!;
    if (q.x < b.x - gap || q.x > b.x + b.w + gap || q.y < b.y - gap || q.y > b.y + b.h + gap) continue;
    const h = holes[i]!;
    if (pointInPolygon(q, h) || (gap > 0 && distanceToPolygon(q, h) < gap)) return false;
  }
  for (const p of pads) if (Math.hypot(p.x - q.x, p.y - q.y) < p.r + gap) return false;
  return true;
}

/** Does a shoal of this spread centred at `c` fit: in the shallows' deeper band, its rim (and its lift over the shadows) in clear water? */
export function shoalFits(r: Region, c: Pt, ps: number, pads: readonly Pad[], spread = 1): boolean {
  const T = DAMSELFISH_TUNING;
  const span = columnSpan(r.outline, c.x);
  if (!span) return false;
  const v = (c.y - span[0]) / (span[1] - span[0]);
  if (v < T.band[0] || v > T.band[1]) return false;
  const { rx, ry } = shoalExtent(ps, spread);
  const lift = T.lift * ps;
  if (!clearWater(r, c, pads, T.rockGap)) return false;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const q = { x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry };
    if (!clearWater(r, q, pads, T.rockGap + (pads.length ? T.padGap : 0))) return false;
    if (Math.sin(a) < -0.5 && !clearWater(r, { x: q.x, y: q.y - lift }, [], 0)) return false;
  }
  return true;
}

/** The loosest spread (of `ROOM`) a shoal at `c` fits at, or 0 where none does. */
export function roomAt(r: Region, c: Pt, ps: number, pads: readonly Pad[]): number {
  if (!shoalFits(r, c, ps, pads, ROOM[3])) return 0;
  for (const s of ROOM) if (s === ROOM[3] || shoalFits(r, c, ps, pads, s)) return s;
  return 0;
}

/** A centre and how loose the shoal may hang there. */
export interface Home extends Pt {
  room: number;
}

export interface ShoalHomes {
  region: Region;
  /** centres where a shoal fits, before the planted water plants are counted */
  spots: Home[];
}

const homeCache = new WeakMap<object, ShoalHomes | null>();

/** The shallows and the centres a shoal fits at, on a 10-unit grid (cached per garden). */
export function shoalHomes(w: Pick<FaunaWorld, 'regions' | 'perspective'>): ShoalHomes | null {
  if (homeCache.has(w.regions)) return homeCache.get(w.regions)!;
  const region = w.regions.find((g) => g.kind === 'shallows') ?? null;
  let out: ShoalHomes | null = null;
  if (region) {
    const xs = region.outline.map((q) => q.x);
    const ys = region.outline.map((q) => q.y);
    const spots: Home[] = [];
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 10) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 10) {
        const q = { x, y };
        if (!inRegion(region, q)) continue;
        const room = roomAt(region, q, w.perspective(y, x), []);
        if (room > 0) spots.push({ x, y, room });
      }
    }
    out = spots.length > 0 ? { region, spots } : null;
  }
  homeCache.set(w.regions, out);
  return out;
}

const inView = (q: Pt, v: Rect, m: number) => q.x > v.x + m && q.x < v.x + v.w - m && q.y > v.y + m && q.y < v.y + v.h - m;

const openCache = new WeakMap<object, Home[]>();

/** Where the shoal can be now: its homes clear of the planted water plants (cached per planting). */
export function openHomes(w: Pick<FaunaWorld, 'regions' | 'perspective' | 'pads'>): Home[] {
  const h = shoalHomes(w);
  if (!h) return [];
  if (w.pads.length === 0) return h.spots;
  let out = openCache.get(w.pads);
  if (!out) {
    out = [];
    for (const q of h.spots) {
      const room = roomAt(h.region, q, w.perspective(q.y, q.x), w.pads);
      if (room > 0) out.push({ x: q.x, y: q.y, room });
    }
    openCache.set(w.pads, out);
  }
  return out;
}

/** A home to appear at: in view when it can, roomier ones likelier. */
export function chooseHome(w: Pick<FaunaWorld, 'regions' | 'perspective' | 'pads' | 'view'>, rng: Rng): Home | null {
  const open = openHomes(w);
  if (open.length === 0) return null;
  const seen = open.filter((q) => inView(q, w.view, 30));
  const pool = seen.length > 0 ? seen : open;
  const roomy = pool.filter((q) => q.room >= 0.86);
  return { ...rng.pick(roomy.length > 0 ? roomy : pool) };
}

/**
 * A drift's end: a home along the shore from `from` (mostly across the view, as the shore runs),
 * reached on a straight line of clear water; `away` pushes it off a point (a bird that lingers).
 * Its `room` is the tightest along the way.
 */
export function driftTarget(w: Pick<FaunaWorld, 'regions' | 'perspective' | 'pads' | 'view'>, from: Pt, rng: Rng, away: Pt | null = null): Home | null {
  const h = shoalHomes(w);
  if (!h) return null;
  const T = DAMSELFISH_TUNING;
  const ok = (q: Pt) => {
    const d = dist(q, from);
    if (away) return Math.hypot(q.x - away.x, (q.y - away.y) * 0.5) > Math.hypot(from.x - away.x, (from.y - away.y) * 0.5) + 30 && d < 220;
    return d >= T.drift[0] && d <= T.drift[1] && Math.abs(q.y - from.y) < Math.abs(q.x - from.x) * 0.8;
  };
  let pool = openHomes(w).filter(ok);
  const seen = pool.filter((q) => inView(q, w.view, 30));
  if (seen.length > 0) pool = seen;
  for (let i = 0; i < 8 && pool.length > 0; i++) {
    const q = rng.pick(pool);
    let room = q.room;
    for (let k = 1; k < 6 && room > 0; k++) {
      const m = { x: lerp(from.x, q.x, k / 6), y: lerp(from.y, q.y, k / 6) };
      room = Math.min(room, roomAt(h.region, m, w.perspective(m.y, m.x), w.pads));
    }
    if (room > 0) return { x: q.x, y: q.y, room };
  }
  return null;
}

/**
 * A new facing for a turn: about or a little aside, but always mostly along the shore (across the
 * view), where a fish shows its oval and its fork; one nose-on to the viewer reads as a dot.
 */
export function turnHeading(from: number, rng: Rng): number {
  const right = Math.cos(from) >= 0;
  const about = rng.chance(0.55);
  const base = right !== about ? 0 : Math.PI;
  let to = base + rng.range(-0.6, 0.6);
  if (Math.abs(angleDiff(from, to)) < 0.4) to += Math.PI;
  return to;
}

/** The nearest bird passing over within reach (y counted half: one high over the water is over it), or null. */
export function threatNear(at: Pt, creatures: readonly { kind: string; x: number; y: number; done: boolean }[]): { kind: string; x: number; y: number } | null {
  for (const c of creatures) {
    const reach = DAMSELFISH_TUNING.threats[c.kind];
    if (!reach || c.done) continue;
    if (Math.hypot(c.x - at.x, (c.y - at.y) * 0.5) < reach) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------

interface Fish {
  /** the bed point under it (world) */
  x: number;
  y: number;
  vel: Pt;
  /** its place in the shoal (unit disc, plane) */
  u: number;
  v: number;
  /** heading in the sea plane, and the turn it waits on */
  heading: number;
  delay: number;
  size: number;
  /** its own depth offset and a salt for its noise */
  dz: number;
  salt: number;
  phase: number;
  shimmer: number;
}

export type ShoalMode = 'enter' | 'hover' | 'drift' | 'turn' | 'tight' | 'leave';

export class Shoal extends BaseCreature {
  readonly kind = 'damselfish' as const;
  readonly visitor = false;
  override layer: LayerId = 'underwater';
  readonly fish: Fish[] = [];
  /** the shoal's centre on the bed (= x, y), its facing, looseness (1 loose) and depth (0..1) */
  heading: number;
  spread = 1;
  z = 0.9;
  /** how loose it may hang where it is (`ROOM`) */
  room = 1;
  /** for tests: drifts, turns, frights (birds), shadows (from beyond the view) */
  drifts = 0;
  turns = 0;
  frights = 0;
  shadows = 0;
  private target: Home | null = null;
  private waitFor = 0;
  private nextShadow: number;
  private calmAt = 0;
  private threatFor = 0;
  private checkAt = 0;
  private awayAt = 0;
  private timerAll = 0;
  /** perspective at its centre: every fish is drawn at it */
  scale = 0.6;

  constructor(
    w: FaunaWorld,
    at: Pt & { room?: number },
    readonly rng: Rng,
    count = 0,
  ) {
    super();
    const T = DAMSELFISH_TUNING;
    this.x = at.x;
    this.y = at.y;
    this.heading = rng.chance(0.5) ? rng.range(-0.5, 0.5) : Math.PI + rng.range(-0.5, 0.5);
    this.scale = w.perspective(at.y, at.x);
    this.room = this.spread = at.room ?? 1;
    const n = count > 0 ? count : rng.int(T.fish[0], T.fish[1]);
    // a sunflower spread over the disc, jittered, denser toward the middle
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt((i + 0.5) / n) ** 1.2 * rng.range(0.85, 1.05);
      const a = i * 2.39996 + rng.range(-0.3, 0.3);
      const f: Fish = { x: 0, y: 0, vel: { x: 0, y: 0 }, u: Math.cos(a) * r, v: Math.sin(a) * r, heading: this.heading + rng.range(-0.2, 0.2), delay: 0, size: rng.range(0.78, 1.12), dz: rng.range(-0.18, 0.18), salt: rng.range(0, 100), phase: rng.range(0, TAU), shimmer: 0 };
      const q = this.slot(f, 0, w);
      f.x = q.x;
      f.y = q.y;
      this.fish.push(f);
    }
    this.alpha = 0;
    this.nextShadow = rangeOf(rng, [...T.shadow]);
    this.waitFor = 3;
    this.go('enter');
  }

  doing(): ShoalMode {
    return this.state as ShoalMode;
  }

  /** Where a fish wants to be now: its place in the shoal, spread, with a slow wander of its own. */
  private slot(f: Fish, t: number, w: FaunaWorld): Pt {
    const R = DAMSELFISH_TUNING.radius * this.spread * this.scale;
    const n1 = w.noise(t * 0.09 + f.salt, f.salt * 0.37) * 2.2 * this.scale;
    const n2 = w.noise(f.salt * 0.53, t * 0.08 + f.salt) * 2.2 * this.scale;
    return { x: this.x + f.u * R + n1, y: this.y + (f.v * R + n2) * SQUASH };
  }

  /** Tighten and sink now, for `seconds` (a shadow passing; the studio). */
  startle(seconds: number): void {
    this.calmAt = Math.max(this.calmAt, this.timerAll + seconds);
    if (this.state !== 'tight' && this.state !== 'leave') {
      this.target = null;
      this.go('tight');
    }
  }

  /** Turn as one by `by` radians: the turn runs across the shoal from one side. */
  turn(by: number): void {
    this.heading += by;
    const ax = this.rng.range(0, TAU);
    for (const f of this.fish) f.delay = 0.35 * (1 + f.u * Math.cos(ax) + f.v * Math.sin(ax));
    this.turns++;
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0 || this.done) return;
    const T = DAMSELFISH_TUNING;
    const sf = w.speed;
    this.timer += dt;
    this.timerAll += dt;
    if (w.mode.night && !this.leaving) this.leave(w);
    const homes = shoalHomes(w);
    if (!homes) {
      this.done = true;
      return;
    }
    // birds passing over and shadows from beyond the view
    const threat = this.state === 'leave' ? null : threatNear(this, w.creatures);
    if (threat) {
      this.threatFor += dt;
      if (this.state !== 'tight') {
        this.frights++;
        this.target = null;
        this.go('tight');
      }
      this.calmAt = this.timerAll + rangeOf(this.rng, [...T.calm]);
    } else this.threatFor = 0;
    if (this.state !== 'leave' && this.state !== 'enter' && this.timerAll >= this.nextShadow) {
      this.shadows++;
      this.startle(rangeOf(this.rng, [...T.shadowTight]));
      this.nextShadow = this.timerAll + rangeOf(this.rng, [...T.shadow]) / sf;
    }
    const tight = this.state === 'tight';
    const room = this.state === 'drift' && this.target ? Math.min(this.room, this.target.room) : this.room;
    this.spread = approach(this.spread, tight ? T.tight : room * (0.94 + 0.06 * w.noise(this.timerAll * 0.05, this.id)), tight ? 2.2 : 0.22, dt);
    this.z = approach(this.z, this.state === 'leave' ? 1 : tight ? T.tightZ : T.hoverZ + 0.06 * w.noise(this.id, this.timerAll * 0.04), tight ? 1.6 : this.state === 'enter' ? 0.6 : 0.2, dt);

    switch (this.state) {
      case 'enter':
        this.alpha = approach(this.alpha, 1, 0.9 * sf, dt);
        if (this.timer > this.waitFor / sf) this.hover(w);
        break;
      case 'hover':
        if (this.timer > this.waitFor) {
          const to = this.rng.chance(T.driftChance) ? driftTarget(w, this, this.rng) : null;
          if (to) this.startDrift(to);
          else {
            this.turn(angleDiff(this.heading, turnHeading(this.heading, this.rng)));
            this.waitFor = 2.5;
            this.go('turn');
          }
        }
        break;
      case 'turn':
        if (this.timer > this.waitFor) this.hover(w);
        break;
      case 'drift':
        if (this.swim(dt, T.speed * sf)) this.hover(w);
        break;
      case 'tight':
        // a bird that lingers over it: slip away along the shore
        if (threat && this.threatFor > T.linger && !this.target && this.timerAll >= this.awayAt) {
          this.awayAt = this.timerAll + 2;
          const to = driftTarget(w, this, this.rng, threat);
          if (to) this.target = to;
        }
        if (this.target && this.swim(dt, T.speed * 1.4 * sf)) this.target = null;
        if (!threat && this.timerAll >= this.calmAt && !this.target) this.hover(w);
        break;
      case 'leave':
        this.alpha = approach(this.alpha, 0, 0.5 * sf, dt);
        this.y -= 3 * this.scale * sf * dt;
        if (this.alpha < 0.02) this.done = true;
        break;
    }
    // a water plant planted under it: hang closer, or move off
    if (this.timerAll >= this.checkAt && (this.state === 'hover' || this.state === 'turn')) {
      this.checkAt = this.timerAll + 2;
      const fits = roomAt(homes.region, this, this.scale, w.pads);
      if (fits === 0) {
        const open = openHomes(w);
        if (open.length > 0) this.startDrift({ ...open.reduce((a, q) => (dist(q, this) < dist(a, this) ? q : a), open[0]!) });
      } else this.room = Math.min(this.room, fits);
    }
    this.scale = w.perspective(this.y, this.x);
    this.steer(dt, w);
  }

  private hover(w: FaunaWorld): void {
    this.target = null;
    const h = shoalHomes(w);
    this.room = (h && roomAt(h.region, this, this.scale, w.pads)) || ROOM[3];
    this.waitFor = rangeOf(this.rng, [...DAMSELFISH_TUNING.hover]);
    this.go('hover');
  }

  private startDrift(to: Home): void {
    this.target = to;
    this.drifts++;
    // it faces the way it drifts, but never more than 0.7 off along the shore
    const way = Math.atan2((to.y - this.y) / SQUASH, to.x - this.x);
    const base = Math.cos(way) >= 0 ? 0 : Math.PI;
    const along = base + clamp(angleDiff(base, way), -0.7, 0.7);
    if (Math.abs(angleDiff(this.heading, along)) > 0.5) this.turn(angleDiff(this.heading, along));
    this.go('drift');
  }

  /** Move the centre toward the target, easing in and out; true on arrival. */
  private swim(dt: number, speed: number): boolean {
    const to = this.target;
    if (!to) return true;
    const d = dist(this, to);
    const ease = clamp(Math.min(this.timer * 0.5, d / 14), 0.15, 1);
    const step = speed * this.scale * ease * dt;
    if (d <= step || d < 0.3) {
      this.x = to.x;
      this.y = to.y;
      return true;
    }
    this.x += ((to.x - this.x) / d) * step;
    this.y += ((to.y - this.y) / d) * step;
    return false;
  }

  private steer(dt: number, w: FaunaWorld): void {
    const tight = this.state === 'tight';
    const omega = tight ? 3.2 : 1.3;
    const rate = tight ? 6 : 3.2;
    const t = this.timerAll;
    for (const f of this.fish) {
      const q = this.slot(f, t, w);
      springStep(f, f.vel, q, omega, dt);
      const was = f.heading;
      if (f.delay > 0) f.delay -= dt;
      else {
        const want = this.heading + 0.16 * w.noise(t * 0.2 + f.salt, f.salt);
        f.heading = turnToward(f.heading, want, rate, dt);
      }
      const turning = Math.abs(angleDiff(was, f.heading)) / dt;
      f.shimmer = approach(f.shimmer, clamp(turning / 2.5, 0, 1), turning > 0.5 ? 14 : 3, dt);
      f.phase += dt * TAU * (1.6 + Math.hypot(f.vel.x, f.vel.y) * 0.25 + (tight ? 1.5 : 0));
    }
  }

  override leave(_w?: FaunaWorld): void {
    if (this.leaving) return;
    this.leaving = true;
    this.target = null;
    this.go('leave');
  }

  /** The bed's under a fish and where the fish is drawn (lifted over its shadow by its height). */
  fishAt(f: Fish): { bed: Pt; at: Pt; z: number } {
    const z = clamp(this.z + f.dz, 0, 1);
    const lift = DAMSELFISH_TUNING.lift * this.scale * (1 - z);
    return { bed: { x: f.x, y: f.y }, at: { x: f.x, y: f.y - lift }, z };
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'underwater' || this.alpha <= 0.01) return;
    const parts = w.art.get('damselfish', (res) => paintDamselfish(res, 6230));
    drawShoal(ctx, parts, this, this.alpha);
  }
}

/** Draw a shoal's shadows, then its fish, then the glints of the turning ones: two or three `drawImage`s a fish. */
export function drawShoal(ctx: Ctx, parts: DamselfishParts, s: Shoal, alpha: number): void {
  const m = ctx.getTransform();
  const A = m.a;
  const B = m.b;
  const C = m.c;
  const D = m.d;
  const E = m.e;
  const F = m.f;
  const ps = s.scale;
  const deep = smoothstep((s.z - 0.62) / 0.3);
  const set = (a: number, b: number, c: number, d: number, x: number, y: number) => ctx.setTransform(A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * x + C * y + E, B * x + D * y + F);
  // a shadow lies on the bed: rotated in the sea plane, then the plane foreshortened
  const flat = (img: Sprite, x: number, y: number, k: number, rot: number) => {
    const cs = Math.cos(rot) * k;
    const sn = Math.sin(rot) * k;
    set(cs, sn * SQUASH, -sn, cs * SQUASH, x, y);
    ctx.drawImage(img.img as CanvasImageSource, -img.ox, -img.oy, img.w, img.h);
  };
  // a fish seen from above and a little to the side keeps its body's width; only its length foreshortens
  const put = (img: Sprite, x: number, y: number, k: number, rot: number) => {
    const dx = Math.cos(rot);
    const dy = Math.sin(rot) * SQUASH;
    const l = Math.hypot(dx, dy);
    const cs = dx / l;
    const sn = dy / l;
    const kl = k * (0.4 + 0.6 * l);
    set(cs * kl, sn * kl, -sn * k, cs * k, x, y);
    ctx.drawImage(img.img as CanvasImageSource, -img.ox, -img.oy, img.w, img.h);
  };
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * alpha * lerp(0.26, 0.4, deep);
  for (const f of s.fish) {
    const q = s.fishAt(f);
    flat(parts.shadow, q.bed.x, q.bed.y, ps * f.size, f.heading);
  }
  for (const f of s.fish) {
    const q = s.fishAt(f);
    const fr = Math.sin(f.phase) > 0.55 ? 2 : Math.sin(f.phase) < -0.55 ? 0 : 1;
    const dm = smoothstep((q.z - 0.62) / 0.3);
    // deeper fish are fainter and a little smaller: the shoal is a cloud, not a layer
    const a = base * alpha * lerp(0.95, 0.5, q.z);
    const k = ps * f.size * (1.06 - 0.14 * q.z);
    if (dm < 0.96) {
      ctx.globalAlpha = a * (dm > 0.04 ? 1 - dm : 1);
      put(parts.frames[fr]!, q.at.x, q.at.y, k, f.heading);
    }
    if (dm > 0.04) {
      ctx.globalAlpha = a * (dm < 0.96 ? dm : 1);
      put(parts.deep[fr]!, q.at.x, q.at.y, k, f.heading);
    }
    if (f.shimmer > 0.05) {
      ctx.globalAlpha = base * alpha * f.shimmer * 0.6 * (1 - 0.6 * dm);
      put(parts.glint, q.at.x, q.at.y, k, f.heading);
    }
  }
  ctx.globalAlpha = base;
  ctx.setTransform(m);
}

const damselfish: CreatureDef = {
  kind: 'damselfish',
  title: 'damselfish shoal',
  role: 'resident',
  rank: 7,
  // one shoal in the shallows by day; it goes down and away at nightfall
  resident: (n, mode) => (n > 0 && !mode.night ? 1 : 0),
  needs: (w) => shoalHomes(w) !== null,
  spawn(w, s) {
    const rng = w.rng.fork(`damselfish:${s.seed}:${w.t.toFixed(3)}:${s.index}:${w.creatures.length}`);
    const at = chooseHome(w, rng);
    if (!at) return [];
    // a hand spawn of 12 or more is the shoal's size
    return [new Shoal(w, at, rng, s.count >= 12 ? Math.min(25, s.count) : 0)];
  },
  sheet: {
    w: 520,
    h: 90,
    make(res, seed) {
      const a = paintDamselfish(res * 3, seed);
      return [a.body, a.tail, a.frames[0], a.frames[1], a.frames[2], a.deep[1], a.glint, a.shadow];
    },
  },
  show: { stage: 'coast', spec: { x: 250, y: 560, w: 300, h: 150 }, w: 720, h: 360, order: 349 },
};
export default damselfish;
