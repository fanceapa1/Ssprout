/**
 * Iwana (white-spotted char, Salvelinus leucomaenis) and yamame (masu salmon parr): the
 * waterfall's fish. Each holds a station in the pool's tail, nose into the falls' current,
 * sculling; it darts aside, now and then rises to sip at the surface, and drops back.
 */
import { hashString, type Rng } from '../../core/rng';
import { blob, jitter, lighten, mix, PIGMENTS, shade, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import {
  angleDiff,
  approach,
  arrive,
  clamp,
  closestOnPolygon,
  containPoint,
  dist,
  insideWithMargin,
  lerp,
  polygonCentroid,
  smoothstep,
  TAU,
  toPlane,
  toWorld,
  turnToward,
} from '../math';
import { deepCopy, drawSprite, paintSprite, type Sprite } from '../sprite';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import type { CreatureDef } from './lib/def';

export type IwanaVariant = 'iwana' | 'yamame';
export const IWANA_VARIANTS: readonly IwanaVariant[] = ['iwana', 'yamame'];

/** Lengths snout to tail tip at perspective 1 (world units); koi are 56–76. */
export const IWANA_LEN: Record<IwanaVariant, number> = { iwana: 48, yamame: 42 };

const BODY = 0.8;
const HALF_W = 0.095;
const SEGMENTS = 7;
/** drawn a little less foreshortened than the pool plane, like the koi */
const DRAW_SQUASH = 0.62;
const PEC_AT = 0.2;
const PEL_AT = 0.52;
/** seconds after nightfall during which the evening rise runs */
export const DUSK_SECONDS = 1200;

/** Half-width along the body (s: 0 snout … 1 tail root) as a fraction of HALF_W: a pointed snout, a slim torpedo. */
export function iwanaProfile(s: number): number {
  const nose = Math.sqrt(clamp(s / 0.1, 0, 1)) * (0.55 + 0.45 * clamp(s / 0.3, 0, 1) ** 0.8);
  const body = s < 0.34 ? 0.86 + 0.14 * Math.sin((s / 0.34) * (Math.PI / 2)) : 1 - 0.8 * ((s - 0.34) / 0.66) ** 1.05;
  return nose * body;
}

interface Palette {
  back: Pigment;
  flank: Pigment;
  fin: Pigment;
  spot: Pigment;
}

const PALETTE: Record<IwanaVariant, Palette> = {
  iwana: { back: mix('#6f7258', '#4f5446', 0.35), flank: mix('#d9a46a', '#a39c80', 0.45), fin: mix('#d9a46a', '#8a8670', 0.5), spot: '#e8dfc8' },
  yamame: { back: mix('#6f7a66', '#8e958a', 0.35), flank: mix('#c4c8bd', '#b7b2a6', 0.4), fin: mix('#b9b48f', '#9da08e', 0.5), spot: '#5d5a6e' },
};

export interface IwanaParts {
  len: number;
  variant: IwanaVariant;
  body: Sprite;
  bodyDeep: Sprite;
  tail: Sprite;
  tailDeep: Sprite;
  pec: Sprite;
  pecDeep: Sprite;
  pel: Sprite;
  pelDeep: Sprite;
  /** its soft shadow on the pool bed */
  shadow: Sprite;
}

function bodyPolygon(len: number): Pt[] {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const s = i / 30;
    const w = hw * iwanaProfile(s);
    top.push({ x: s * lb, y: -w });
    bottom.push({ x: s * lb, y: w });
  }
  return [...top, ...bottom.reverse()];
}

function paintBody(p: Painter, rng: Rng, len: number, v: IwanaVariant): void {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const poly = bodyPolygon(len);
  const pal = PALETTE[v];
  const area = { x: -3, y: -hw - 3, w: lb + 6, h: hw * 2 + 6 };
  // the flank (iwana: the warm buff belly showing at the edges; yamame: silver)
  p.wash(poly, pal.flank, { rng, blend: 'source-over', opacity: 0.93, deform: 0.03, spread: 0.03, edge: 0.04, edgeWidth: 0.4, sharpness: 0.25, centreLift: 0.08, granulation: 0.1, flow: 0.4, flowScale: 5 });

  // the dark back bled wet-in-wet into the flank, darkest over the head
  const back = p.layer(area);
  back.clip(poly);
  const band = v === 'iwana' ? 0.56 : 0.5;
  for (let k = 0; k < 5; k++) {
    back.fill(blob(lb * 0.5, hw * rng.range(-0.06, 0.06), lb * 0.53, hw * band, rng, { irregularity: 0.22, points: 30 }), jitter(pal.back, rng, 0.04), 0.2);
    back.fill(blob(lb * 0.5, 0, lb * 0.5, hw * band * 1.45, rng, { irregularity: 0.2, points: 30 }), jitter(pal.back, rng, 0.04), 0.1);
  }
  back.fill(blob(lb * 0.12, 0, lb * 0.12, hw * 0.5, rng, { irregularity: 0.2 }), shade(pal.back, 0.25), 0.35);
  back.fill(blob(lb * 0.42, 0, lb * 0.3, hw * 0.25, rng, { irregularity: 0.3 }), shade(pal.back, 0.3), 0.25);
  back.dry({ opacity: 0.95, edge: 0.22, edgeWidth: 0.7, sharpness: 0.18, centreLift: 0.12, granulation: 0.3, flow: 0.7, flowScale: 4, blend: 'source-over' });

  if (v === 'yamame') {
    // a pale silver sheen between back and flank
    for (const side of [-1, 1]) p.glaze(blob(lb * 0.5, side * hw * 0.55, lb * 0.36, hw * 0.16, rng), lighten(pal.flank, 0.35), { rng, opacity: 0.4, blend: 'source-over', sharpness: 0.2, edge: 0.1 });
    // parr marks: a row of dark thumbprints along each flank, bleeding a little
    const parr = p.layer(area);
    parr.clip(poly);
    const n = rng.int(8, 9);
    for (let i = 0; i < n; i++) {
      const s = 0.2 + (i / (n - 1)) * 0.64 + rng.range(-0.015, 0.015);
      for (const side of [-1, 1]) {
        const w0 = iwanaProfile(s);
        const shape = blob(s * lb, side * hw * w0 * rng.range(0.7, 0.8), lb * rng.range(0.022, 0.03), hw * w0 * rng.range(0.28, 0.36), rng, { irregularity: 0.35, points: 16 });
        for (let k = 0; k < 3; k++) parr.fill(shape, jitter(mix(pal.spot, pal.back, 0.3), rng, 0.04), 0.22);
      }
    }
    parr.dry({ opacity: 0.75, edge: 0.3, edgeWidth: 0.45, sharpness: 0.15, centreLift: 0.25, flow: 0.6, flowScale: 3, blend: 'multiply' });
    // tiny black dots over the back
    for (let i = 0; i < rng.int(9, 13); i++) {
      const s = rng.range(0.2, 0.75);
      p.dab({ x: s * lb, y: hw * iwanaProfile(s) * rng.range(-0.45, 0.45) }, PIGMENTS.sumi, { rng, variant: 'round', length: rng.range(0.3, 0.5), width: rng.range(0.28, 0.4), opacity: rng.range(0.4, 0.6), angle: rng.range(0, TAU) });
    }
  } else {
    // pale cream spots, larger low on the flanks, small over the back: lifted, soft-edged
    const spots = p.layer(area);
    spots.clip(poly);
    for (let i = 0; i < 46; i++) {
      const s = rng.range(0.2, 0.92);
      const dy = rng.range(-1, 1);
      const r = lb * (0.008 + 0.01 * Math.abs(dy)) * rng.range(0.8, 1.3);
      const shape = blob(s * lb, dy * hw * iwanaProfile(s) * 0.82, r, r * 0.9, rng, { irregularity: 0.2, points: 10 });
      for (let k = 0; k < 2; k++) spots.fill(shape, jitter(pal.spot, rng, 0.03), 0.45);
    }
    spots.dry({ opacity: 0.8, edge: 0.1, edgeWidth: 0.3, sharpness: 0.45, centreLift: 0, flow: 0.4, flowScale: 3, blend: 'source-over' });
  }

  // dorsal fin seen edge-on along the back, and the little adipose fin
  const dorsal = shade(pal.back, v === 'yamame' ? 0.5 : 0.4);
  p.stroke([{ x: lb * 0.38, y: 0 }, { x: lb * 0.45, y: rng.range(-0.1, 0.1) }, { x: lb * 0.54, y: 0 }], { rng, pigment: dorsal, width: hw * 0.18, wetness: 0.9, opacity: 0.35, taper: [0.3, 0.6] });
  p.dab({ x: lb * 0.8, y: 0 }, dorsal, { rng, variant: 'leaf', length: lb * 0.035, width: hw * 0.12, angle: 0, opacity: 0.2 });
  // eyes at the sides of the head, half lost in the dark cap; a pale gill line
  for (const side of [-1, 1]) {
    p.dab({ x: lb * 0.085, y: side * hw * 0.4 }, shade(pal.back, 0.5), { rng, variant: 'round', length: hw * 0.22, width: hw * 0.18, opacity: 0.4, angle: 0, edge: 0.1 });
    p.stroke(
      [
        { x: lb * 0.15, y: side * hw * 0.25 },
        { x: lb * 0.165, y: side * hw * 0.6 },
        { x: lb * 0.155, y: side * hw * 0.85 },
      ],
      { rng, pigment: lighten(pal.flank, 0.3), width: 0.35, wetness: 0.6, opacity: 0.4 },
    );
  }
}

/** A lower fin rooted at (0, 0) pointing +x; its leading edge on +y (white on the iwana). */
function paintFin(p: Painter, rng: Rng, L: number, v: IwanaVariant): void {
  const pal = PALETTE[v];
  p.dab({ x: 0, y: 0 }, pal.fin, { rng, variant: 'leaf', angle: 0, length: L, width: L * 0.42, curve: -0.14, asym: 0.25, opacity: v === 'iwana' ? 0.5 : 0.38, blend: 'source-over', pool: 0.3, poolSide: -1, edge: 0.3 });
  if (v === 'iwana') {
    p.stroke(
      [
        { x: L * 0.06, y: L * 0.06 },
        { x: L * 0.42, y: L * 0.17 },
        { x: L * 0.8, y: L * 0.08 },
      ],
      { rng, pigment: PIGMENTS.petalWhite, width: L * 0.08, wetness: 0.35, opacity: 0.9, taper: [0.1, 0.45], blend: 'source-over' },
    );
  }
}

/** Paint one fish's parts and their deep-water copies. */
export function paintIwana(res: number, seed: number, v: IwanaVariant, len: number): IwanaParts {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const pal = PALETTE[v];
  const pad = 3;
  const body = paintSprite(res, { w: lb + pad + len * 0.04, h: hw * 2 + pad * 2, ox: len * 0.04, oy: hw + pad }, seed, (p, rng) => paintBody(p, rng, len, v));

  // caudal fin: square-ish on the char, forked on the yamame, a darker trailing edge
  const tl = len * 0.19;
  const tail = paintSprite(res, { w: tl + 4, h: tl * 1.2 + 4, ox: 1.5, oy: tl * 0.6 + 2 }, seed + 1, (p, rng) => {
    const fork = tl * (v === 'yamame' ? 0.26 : 0.1);
    const r0 = hw * 0.22;
    const fan = smoothPolygon(
      [
        { x: 0, y: -r0 },
        { x: tl * 0.55, y: -tl * 0.3 },
        { x: tl, y: -tl * 0.5 },
        { x: tl - fork, y: 0 },
        { x: tl, y: tl * 0.5 },
        { x: tl * 0.55, y: tl * 0.3 },
        { x: 0, y: r0 },
      ],
      2,
    );
    p.wash(fan, mix(pal.fin, pal.back, 0.45), { rng, blend: 'source-over', opacity: 0.62, deform: 0.05, edge: 0.4, edgeWidth: 0.5, sharpness: 0.4, centreLift: 0.2, fade: Math.PI, flow: 0.5, flowScale: 4 });
    for (const f of [-0.3, 0.05, 0.32]) {
      const y = f * tl * 0.8 + rng.range(-0.5, 0.5);
      p.stroke([{ x: 0.5, y: y * 0.15 }, { x: tl * 0.85, y }], { rng, pigment: shade(pal.back, 0.2), width: 0.28, wetness: 0.7, opacity: 0.14 });
    }
  });

  const pl = len * 0.13;
  const pec = paintSprite(res, { w: pl + 3, h: pl * 0.9 + 2, ox: 1, oy: pl * 0.45 + 1 }, seed + 2, (p, rng) => paintFin(p, rng, pl, v));
  const ql = len * 0.095;
  const pel = paintSprite(res, { w: ql + 3, h: ql * 0.9 + 2, ox: 1, oy: ql * 0.45 + 1 }, seed + 3, (p, rng) => paintFin(p, rng, ql, v));

  // the shadow on the bed: the silhouette in one cool wash, blurred well
  const sh = paintSprite(res, { w: len * 1.05 + 6, h: hw * 2 + 8, ox: len * 0.04 + 3, oy: hw + 4 }, seed + 4, (p, rng) => {
    const poly = bodyPolygon(len);
    poly.splice(31, 0, { x: lb + tl * 0.9, y: -tl * 0.35 }, { x: lb + tl * 0.8, y: 0 }, { x: lb + tl * 0.9, y: tl * 0.35 });
    p.wash(poly, mix(PIGMENTS.indigo, PIGMENTS.stoneDark, 0.6), { rng, blend: 'source-over', opacity: 0.9, edge: 0, centreLift: 0, sharpness: 0.1, granulation: 0.2 });
  });
  const cool = PIGMENTS.celadonDeep;
  return {
    len,
    variant: v,
    body,
    bodyDeep: deepCopy(body, res, cool, 0.3, 3),
    tail,
    tailDeep: deepCopy(tail, res, cool, 0.3, 3),
    pec,
    pecDeep: deepCopy(pec, res, cool, 0.3, 3),
    pel,
    pelDeep: deepCopy(pel, res, cool, 0.3, 3),
    shadow: deepCopy(deepCopy(sh, res, cool, 0.2, 4), res, cool, 0, 4),
  };
}

/** The fish laid out straight (snout at x, tail to the right), for the studio. */
export function drawIwanaStraight(ctx: Ctx, parts: IwanaParts, x: number, y: number, deep = false): void {
  const lb = parts.len * BODY;
  const hw = parts.len * HALF_W;
  drawSprite(ctx, deep ? parts.tailDeep : parts.tail, x + lb * 0.96, y, 0);
  for (const side of [-1, 1]) {
    drawSprite(ctx, deep ? parts.pelDeep : parts.pel, x + lb * PEL_AT, y + side * hw * iwanaProfile(PEL_AT) * 0.6, side * 0.9, 1, side);
    drawSprite(ctx, deep ? parts.pecDeep : parts.pec, x + lb * PEC_AT, y + side * hw * iwanaProfile(PEC_AT) * 0.7, side * 0.9, 1, side);
  }
  drawSprite(ctx, deep ? parts.bodyDeep : parts.body, x, y);
}

// ---------------------------------------------------------------------------------------------
// where it lives

/** The pool's current, in the pond plane: from the outflow (`mouth`) up to the falls (`head`). */
export interface PoolAxis {
  mouth: Pt;
  head: Pt;
  /** unit vector up the current (mouth → head) */
  up: Pt;
  length: number;
}

export function poolAxis(w: FaunaWorld): PoolAxis {
  const { plane, cy, squash } = w.pond;
  const P = (q: Pt) => toPlane(q, cy, squash);
  // the outflow: where the streams meet the still water
  let mouth: Pt | null = null;
  let best = Infinity;
  for (const s of w.water.moving) {
    for (const v of s) {
      const c = closestOnPolygon(P(v), plane);
      if (c.d < best) {
        best = c.d;
        mouth = c.pt;
      }
    }
  }
  const foot = w.scene.falls?.foot;
  let head = foot ? P(foot) : null;
  const far = (from: Pt) => plane.reduce((a, q) => (dist(q, from) > dist(a, from) ? q : a), plane[0] ?? from);
  if (!mouth) mouth = far(head ?? polygonCentroid(plane));
  if (!head) head = far(mouth);
  const length = Math.max(1, dist(mouth, head));
  return { mouth, head, up: { x: (head.x - mouth.x) / length, y: (head.y - mouth.y) / length }, length };
}

export interface Station {
  p: Pt;
  /** nose into the current, toward the falls */
  heading: number;
}

/** Head, middle and tail (and the shadow under them) clear of the boulders, which the water draws under. */
export function clearOfRocks(w: FaunaWorld, q: Pt, heading: number, len: number): boolean {
  for (let s = 0; s <= 1; s += 0.5) {
    const b = toWorld({ x: q.x - Math.cos(heading) * s * len * BODY, y: q.y - Math.sin(heading) * s * len * BODY }, w.pond.cy, w.pond.squash);
    for (const dy of [0, len * 0.2]) {
      if (w.scene.rocks.some((r) => Math.hypot((b.x - r.x) / (r.w * 0.55 + 4), (b.y + dy - (r.y - r.h * 0.3)) / (r.h * 0.6 + 3)) < 1)) return false;
    }
  }
  return true;
}

/** Inside the still water with room for the body, clear of the boulders, in view. */
export function stationOk(w: FaunaWorld, q: Pt, heading: number, len: number, room = 0.85): boolean {
  if (!insideWithMargin(q, w.pond.plane, len * room)) return false;
  const p = toWorld(q, w.pond.cy, w.pond.squash);
  const v = w.view;
  if (p.x < v.x + len || p.x > v.x + v.w - len || p.y < v.y + len * 0.5 || p.y > v.y + v.h - len * 0.5) return false;
  return clearOfRocks(w, q, heading, len);
}

/** A station in the pool's tail (a quarter to a half of the way up from the outflow), apart from `others`. */
export function chooseStation(w: FaunaWorld, len: number, rng: Rng, others: readonly Pt[] = []): Station {
  const ax = poolAxis(w);
  const n = { x: -ax.up.y, y: ax.up.x };
  let pick: Pt | null = null;
  let score = -Infinity;
  let pickApart = 0;
  // a small pool has no room in its tail: allow less room and further up, step by step
  for (let i = 0; i < 160; i++) {
    const relax = Math.floor(i / 40);
    if (i % 40 === 0 && pick && pickApart >= len) break;
    const u = rng.range(0.15, 0.5 + relax * 0.15) * ax.length;
    const across = rng.range(-0.3, 0.3) * ax.length;
    const q = { x: ax.mouth.x + ax.up.x * u + n.x * across, y: ax.mouth.y + ax.up.y * u + n.y * across };
    if (!stationOk(w, q, Math.atan2(ax.head.y - q.y, ax.head.x - q.x), len, 0.85 - relax * 0.2)) continue;
    const apart = others.length ? Math.min(...others.map((o) => dist(o, q))) : len * 3;
    const s = Math.min(apart, len * 2.5) - (u / ax.length) * len * 0.8 + rng.range(0, len * 0.4);
    if (s > score) {
      score = s;
      pick = q;
      pickApart = apart;
    }
  }
  const p = pick ?? containPoint(polygonCentroid(w.pond.plane), w.pond.plane, len);
  return { p, heading: Math.atan2(ax.head.y - p.y, ax.head.x - p.x) + rng.range(-0.08, 0.08) };
}

/** A short sideways dart off the station (or a rise point a little up the current), or null. */
export function sidePoint(w: FaunaWorld, st: Station, len: number, rng: Rng, rise: boolean, others: readonly Pt[] = []): Pt | null {
  const up = { x: Math.cos(st.heading), y: Math.sin(st.heading) };
  const n = { x: -up.y, y: up.x };
  for (let i = 0; i < 8; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    const across = side * len * (rise ? rng.range(0, 0.35) : rng.range(0.3, 0.75));
    const along = len * (rise ? rng.range(0.2, 0.5) : rng.range(-0.1, 0.25));
    const q = { x: st.p.x + up.x * along + n.x * across, y: st.p.y + up.y * along + n.y * across };
    if (!insideWithMargin(q, w.pond.plane, len * 0.7)) continue;
    if (others.some((o) => dist(o, q) < len * 0.9)) continue;
    if (!clearOfRocks(w, q, st.heading, len)) continue;
    return q;
  }
  return null;
}

/** How lively it is: 1 by day, most in the evening rise after nightfall, a little more at night. */
export function activity(night: boolean, duskLeft: number): number {
  if (!night) return 1;
  return duskLeft > 0 ? 2.4 : 1.4;
}

// ---------------------------------------------------------------------------------------------
// behaviour

const DEEP = 0.7;

export class Iwana extends BaseCreature {
  readonly kind = 'iwana' as const;
  readonly visitor = false;
  override layer: LayerId = 'underwater';
  override variant: IwanaVariant;
  readonly len: number;
  readonly seed: number;
  station: Station;
  /** head position in the pond plane */
  p: Pt;
  private v: Pt = { x: 0, y: 0 };
  heading: number;
  /** 0 at the surface … 1 deep */
  deep = DEEP;
  private deepTarget = DEEP;
  private target: Pt | null = null;
  private gap: number;
  private hold = 1;
  private phase = 0;
  private bend = 0;
  private night = false;
  private ringed = true;
  /** seconds of evening rise left */
  dusk = 0;
  /** rises to the surface so far (tests) */
  rises = 0;
  darts = 0;
  private readonly wob: number;

  constructor(w: FaunaWorld, opts: { seed: number; variant: IwanaVariant; others?: readonly Pt[] }) {
    super();
    const rng = w.rng;
    this.seed = opts.seed;
    this.variant = opts.variant;
    this.len = IWANA_LEN[opts.variant] * rng.range(0.92, 1.08);
    this.station = chooseStation(w, this.len, rng, opts.others ?? Iwana.stationsOf(w, this));
    this.p = { ...this.station.p };
    this.heading = this.station.heading;
    this.gap = rng.range(2, 8);
    this.wob = rng.range(0, 100);
    this.alpha = 0;
    this.state = 'hold';
    this.syncWorld(w);
  }

  static stationsOf(w: FaunaWorld, not: Iwana | null): Pt[] {
    return w.creatures.filter((c): c is Iwana => c instanceof Iwana && c !== not && !c.done).map((c) => c.station.p);
  }

  private nextMove(w: FaunaWorld, act: number): void {
    const rng = w.rng;
    const others = Iwana.stationsOf(w, this);
    const rise = rng.chance(act > 2 ? 0.45 : act > 1 ? 0.25 : 0.12);
    const q = sidePoint(w, this.station, this.len, rng, rise, others);
    this.gap = rng.range(5, 16);
    if (!q) return;
    this.target = q;
    if (rise) {
      this.deepTarget = 0.02;
      this.go('rise');
    } else {
      this.darts++;
      this.go('dart');
    }
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    const sf = w.speed;
    const k = this.len / 40;
    this.timer += dt;
    if (w.mode.night && !this.night) this.dusk = DUSK_SECONDS;
    this.night = w.mode.night;
    this.dusk = Math.max(0, this.dusk - dt);
    const act = activity(this.night, this.dusk);
    const up = this.station.heading;
    const st = this.station.p;
    const h0 = this.heading;
    let turn = 1.4;
    let want = up + 0.09 * w.noise(this.wob, w.t * 0.12);

    switch (this.state) {
      case 'hold': {
        // a slow drift about the station, nose into the current
        const drift = { x: st.x + 2.2 * k * w.noise(this.wob + w.t * 0.06, 3), y: st.y + 2.2 * k * w.noise(7, this.wob + w.t * 0.06) };
        arrive(this.p, this.v, drift, 3 * k * sf, 8 * k * sf, 5 * k, dt);
        this.gap -= dt * act * sf;
        if (this.gap <= 0 && !this.leaving) this.nextMove(w, act);
        break;
      }
      case 'dart': {
        const q = this.target!;
        arrive(this.p, this.v, q, 75 * k * sf, 420 * k * sf, 10 * k, dt);
        want = up + clamp(angleDiff(up, Math.atan2(q.y - this.p.y, q.x - this.p.x)), -0.95, 0.95);
        turn = 9;
        if (dist(this.p, q) < 1.2 * k || this.timer > 2.5 / sf) {
          this.hold = w.rng.range(0.5, 1.8);
          this.go('pause');
        }
        break;
      }
      case 'pause': {
        arrive(this.p, this.v, this.target ?? st, 2 * k * sf, 260 * k * sf, 4 * k, dt);
        turn = 2.6;
        if (this.timer > this.hold / sf) this.go('back');
        break;
      }
      case 'rise': {
        const q = this.target!;
        arrive(this.p, this.v, q, 16 * k * sf, 30 * k * sf, 8 * k, dt);
        want = up + clamp(angleDiff(up, Math.atan2(q.y - this.p.y, q.x - this.p.x)), -0.5, 0.5);
        if (this.deep < 0.08) {
          // the sip: a ring where the snout breaks the surface
          const ps = w.perspective(this.y, this.x);
          w.ripple(this.x, this.y, this.len * 1.1 * ps, 1);
          this.ringed = false;
          this.rises++;
          this.deepTarget = DEEP;
          this.hold = w.rng.range(0.4, 0.9);
          this.go('sip');
        } else if (this.timer > 6 / sf) {
          this.deepTarget = DEEP;
          this.go('back');
        }
        break;
      }
      case 'sip': {
        arrive(this.p, this.v, this.target ?? st, 3 * k * sf, 20 * k * sf, 4 * k, dt);
        if (!this.ringed && this.timer > 0.3 / sf) {
          // a second, smaller ring as the tail turns down
          this.ringed = true;
          w.ripple(this.x, this.y, this.len * 0.6 * w.perspective(this.y, this.x), 0.6);
        }
        if (this.timer > this.hold / sf) this.go('back');
        break;
      }
      case 'back': {
        // drops back to its station still facing the current
        arrive(this.p, this.v, st, 9 * k * sf, 14 * k * sf, 10 * k, dt);
        turn = 1.8;
        if (dist(this.p, st) < 1.5 * k) this.go('hold');
        break;
      }
      default:
        arrive(this.p, this.v, st, 6 * k * sf, 10 * k * sf, 8 * k, dt);
    }
    this.heading = turnToward(this.heading, want, turn * sf, dt);
    this.p = containPoint(this.p, w.pond.plane, this.len * 0.3);

    // depth: rising fast to sip, sinking back slowly
    this.deep = approach(this.deep, this.deepTarget, (this.state === 'rise' ? 0.9 : 0.5) * sf, dt);

    // the body bends with the turn; the tail sculls slowly holding, fast darting
    const omega = angleDiff(h0, this.heading) / dt;
    this.bend = approach(this.bend, clamp(omega * 0.3, -0.7, 0.7), 8, dt);
    const speed = Math.hypot(this.v.x, this.v.y);
    this.phase += dt * TAU * (0.9 * sf + (speed / this.len) * 2.2);

    if (this.leaving) {
      this.deepTarget = 1;
      this.alpha = Math.max(0, this.alpha - dt * 0.15);
      if (this.alpha <= 0) this.done = true;
    } else {
      this.alpha = Math.min(1, this.alpha + dt * 0.2);
    }
    this.syncWorld(w);
  }

  private syncWorld(w: FaunaWorld): void {
    const q = toWorld(this.p, w.pond.cy, w.pond.squash);
    this.x = q.x;
    this.y = q.y;
  }

  /** Spine points relative to the head (plane units, head → tail). */
  spine(t: number): Pt[] {
    const lb = this.len * BODY;
    const dx = Math.cos(this.heading);
    const dy = Math.sin(this.heading);
    const speed = Math.hypot(this.v.x, this.v.y);
    const amp = this.len * clamp(0.028 + speed * 0.0016, 0.028, 0.075);
    const pts: Pt[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const lat = lb * s * s * this.bend + amp * (0.12 + 0.88 * s * s) * Math.sin(this.phase - s * TAU * 0.7) + 0.2 * Math.sin(t * 1.5 + s * 4 + this.wob);
      pts.push({ x: -dx * s * lb - dy * lat, y: -dy * s * lb + dx * lat });
    }
    return pts;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'underwater') return;
    const a = lerp(0.95, 0.62, this.deep) * this.alpha;
    if (a < 0.01) return;
    const parts = w.art.get(`iwana:${this.seed}:${this.variant}:${this.len.toFixed(1)}`, (res) => paintIwana(res, this.seed, this.variant, this.len));
    const near = 1 - smoothstep((this.deep - 0.3) / 0.8);
    const ps = w.perspective(this.y, this.x);
    const pts = this.spine(w.t);
    const R = this.len * 1.2;
    const k = w.art.res * ps;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps, ps * DRAW_SQUASH);
    // its shadow on the bed, further off the higher it swims
    const tip = pts[SEGMENTS]!;
    const off = this.len * (0.26 + 0.35 * (1 - this.deep));
    drawSprite(ctx, parts.shadow, off * 0.15, off, Math.atan2(tip.y, tip.x), 1, 1, a * (0.16 + 0.12 * this.deep));
    // one scratch: the soft deep copy, the crisp one over it as the fish nears the surface
    const sc = w.art.scratch(2 * R * k);
    sc.ctx.setTransform(k, 0, 0, k, R * k, R * k);
    if (near < 0.97) this.compose(sc.ctx, parts, true, pts, w.t);
    if (near > 0.03) {
      sc.ctx.globalAlpha = near < 0.97 ? near : 1;
      this.compose(sc.ctx, parts, false, pts, w.t);
    }
    ctx.globalAlpha = a;
    ctx.drawImage(sc.canvas as CanvasImageSource, 0, 0, 2 * R * k, 2 * R * k, -R, -R, 2 * R, 2 * R);
    ctx.restore();
  }

  private compose(ctx: Ctx, parts: IwanaParts, deep: boolean, pts: Pt[], t: number): void {
    const lb = this.len * BODY;
    const hw = this.len * HALF_W;
    const angle = (i: number) => {
      const j = Math.min(i, SEGMENTS - 1);
      return Math.atan2(pts[j + 1]!.y - pts[j]!.y, pts[j + 1]!.x - pts[j]!.x);
    };
    const at = (s: number) => {
      const f = s * SEGMENTS;
      const i = Math.min(SEGMENTS - 1, Math.floor(f));
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i), a: angle(i) };
    };
    const tail = at(0.96);
    const sweep = 0.4 * Math.sin(this.phase - TAU * 0.7 - 0.9);
    drawSprite(ctx, deep ? parts.tailDeep : parts.tail, tail.x, tail.y, tail.a + sweep);
    const holding = this.state === 'hold' || this.state === 'pause' ? 1 : 0.6;
    for (const [s, sprite, spread] of [
      [PEL_AT, deep ? parts.pelDeep : parts.pel, 0.55],
      [PEC_AT, deep ? parts.pecDeep : parts.pec, 0.45 + 0.3 * holding],
    ] as const) {
      const q = at(s);
      const off = hw * iwanaProfile(s) * 0.65;
      for (const side of [-1, 1]) {
        const paddle = 0.16 * Math.sin(t * 2.1 + side * 1.1 + this.wob + s * 3);
        drawSprite(ctx, sprite, q.x - Math.sin(q.a) * off * side, q.y + Math.cos(q.a) * off * side, q.a + side * (spread + paddle), 1, side);
      }
    }
    const body = deep ? parts.bodyDeep : parts.body;
    const img = body.img as CanvasImageSource;
    const res = body.img.width / body.w;
    const segLen = lb / SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const p0 = pts[i]!;
      const x0 = i === 0 ? -body.ox : i * segLen - 0.7;
      const x1 = i === SEGMENTS - 1 ? body.w - body.ox : (i + 1) * segLen + 0.7;
      ctx.save();
      ctx.translate(p0.x, p0.y);
      ctx.rotate(angle(i));
      ctx.drawImage(img, (x0 + body.ox) * res, 0, (x1 - x0) * res, body.img.height, x0 - i * segLen, -body.oy, x1 - x0, body.h);
      ctx.restore();
    }
  }

  override leave(): void {
    this.leaving = true;
    this.state = 'sink';
  }
}

/** The variant the garden allows (rows in order; any when empty) that has the fewest fish so far. */
export function nextVariant(allowed: readonly string[], have: readonly IwanaVariant[]): IwanaVariant {
  const ok = IWANA_VARIANTS.filter((v) => allowed.length === 0 || allowed.includes(v));
  const pool = ok.length ? ok : IWANA_VARIANTS;
  const count = (v: IwanaVariant) => have.filter((h) => h === v).length;
  return pool.reduce((a, v) => (count(v) < count(a) ? v : a), pool[0]!);
}

const iwana: CreatureDef = {
  kind: 'iwana',
  title: 'iwana and yamame',
  role: 'resident',
  rank: 4,
  // one per unlocked row: iwana-1 the char, iwana-2 the yamame
  resident: (n) => n,
  variants: IWANA_VARIANTS,
  needs: (w) => w.pond.world.length >= 3,
  spawn(w, s) {
    if (w.pond.world.length < 3) return [];
    const out: Iwana[] = [];
    const others = Iwana.stationsOf(w, null);
    const have = w.creatures.filter((c): c is Iwana => c instanceof Iwana && !c.done).map((c) => c.variant);
    for (let i = 0; i < s.count; i++) {
      const variant = nextVariant(s.variants, have);
      have.push(variant);
      // stations are chosen apart from the fish already there, this group included
      const fish = new Iwana(w, { seed: hashString(`${s.seed}:${s.index + i}`), variant, others });
      others.push(fish.station.p);
      out.push(fish);
    }
    return out;
  },
  sheet: {
    w: 640,
    h: 170,
    make(res, seed) {
      const a = paintIwana(res, seed, 'iwana', 40);
      const b = paintIwana(res, seed + 5, 'yamame', 35);
      return [a.body, a.tail, a.pec, a.bodyDeep, b.body, b.tail, b.pec, b.bodyDeep];
    },
  },
  show: { stage: 'falls', spec: { w: 380, h: 240 }, w: 570, h: 361, order: 21, group: 2 },
};
export default iwana;
