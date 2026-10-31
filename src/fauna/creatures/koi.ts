/**
 * Koi: residents of the pond (1–3). They drift slowly beneath the surface on a sinuous spine,
 * sweep their tails, turn in long arcs, rise toward the light now and then (crisper, warmer) and
 * sink again (softer, cooler). Painted body strip + fins, composed along the spine each frame.
 */
import type { Rng } from '../../core/rng';
import { blob, jitter, lighten, mix, PIGMENTS, shade, smoothPolygon, type Painter, type Pigment } from '../../paint';
import type { LayerId } from '../../render/types';
import type { Pt } from '../../render/viewport';
import {
  angleDiff,
  approach,
  clamp,
  containPoint,
  dist,
  insideWithMargin,
  lerp,
  randomPointInside,
  rangeOf,
  smoothstep,
  TAU,
  toWorld,
  turnToward,
} from '../math';
import { deepCopy, drawSprite, paintSprite, type Sprite } from '../sprite';
import { FAUNA_TUNING, SIZES, SPEEDS } from '../tuning';
import { BaseCreature, type Ctx, type FaunaWorld } from '../types';
import { hashString } from '../../core/rng';
import type { CreatureDef } from './lib/def';

export type KoiPattern = 'kohaku' | 'sanke' | 'yamabuki' | 'showa' | 'asagi';
/** Classic varieties, in the order the pond's koi take them (the first is usually a kohaku). */
export const KOI_PATTERNS: readonly KoiPattern[] = ['kohaku', 'yamabuki', 'sanke', 'showa', 'asagi'];
export const KOI_NAMES: Record<KoiPattern, string> = {
  kohaku: 'Kohaku',
  sanke: 'Sanke',
  yamabuki: 'Yamabuki ogon',
  showa: 'Showa',
  asagi: 'Asagi',
};

/** Body length share (the caudal fin is a separate part) and half width. */
const BODY = 0.78;
const HALF_W = 0.11;
/** spine segments the body strip is cut into */
const SEGMENTS = 9;
/** koi are drawn a little less foreshortened than the pond plane (they'd read as slivers) */
const DRAW_SQUASH = 0.62;
/** where the pectoral fins sit along the body */
const FIN_AT = 0.2;

/**
 * Body half-width along the body (s: 0 = snout … 1 = tail root), as a fraction of HALF_W: a
 * broad, rounded head, the widest point a third of the way back, a long torpedo taper.
 */
export function koiProfile(s: number): number {
  const nose = Math.sqrt(clamp(s / 0.07, 0, 1)) * (0.75 + 0.25 * clamp(s / 0.12, 0, 1));
  const body = s < 0.34 ? 0.8 + 0.2 * Math.sin((s / 0.34) * (Math.PI / 2)) : 1 - 0.78 * ((s - 0.34) / 0.66) ** 1.35;
  return nose * body;
}

export interface KoiParts {
  len: number;
  pattern: KoiPattern;
  body: Sprite;
  bodyDeep: Sprite;
  tail: Sprite;
  tailDeep: Sprite;
  fin: Sprite;
  finDeep: Sprite;
}

function bodyPolygon(len: number): Pt[] {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const s = i / 30;
    const w = hw * koiProfile(s);
    top.push({ x: s * lb, y: -w });
    bottom.push({ x: s * lb, y: w });
  }
  return [...top, ...bottom.reverse()];
}

const RED = mix(PIGMENTS.vermilion, '#c45a3e', 0.3);
const GOLD = mix(PIGMENTS.gold, '#e0a85a', 0.35);
const SUMI = mix(PIGMENTS.sumi, '#2f3438', 0.3);
const ASAGI_BACK = mix(PIGMENTS.bellflower, PIGMENTS.stone, 0.55);
const ASAGI_BELLY = mix(PIGMENTS.vermilion, PIGMENTS.gold, 0.45);

/** Base colour and fin tint per variety. */
function palette(pattern: KoiPattern): { base: Pigment; fin: Pigment } {
  switch (pattern) {
    case 'yamabuki':
      return { base: GOLD, fin: lighten(GOLD, 0.2) };
    case 'asagi':
      return { base: ASAGI_BELLY, fin: mix(PIGMENTS.petalWhite, ASAGI_BELLY, 0.35) };
    case 'showa':
      return { base: PIGMENTS.petalWhite, fin: mix(PIGMENTS.petalWhite, PIGMENTS.stone, 0.25) };
    default:
      return { base: PIGMENTS.petalWhite, fin: PIGMENTS.petalWhite };
  }
}

interface Spot {
  s: number;
  dy: number;
  rx: number;
  ry: number;
}

/** Wet-in-wet pattern patches inside the body, each set merging in one drying pass. */
function patches(p: Painter, rng: Rng, poly: Pt[], len: number, pigment: Pigment, spots: Spot[], opts: { alpha?: number; over?: boolean } = {}): void {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const L = p.layer({ x: -3, y: -hw - 3, w: lb + 6, h: hw * 2 + 6 });
  L.clip(poly);
  for (const q of spots) {
    const shape = blob(q.s * lb, q.dy * hw, q.rx * lb, q.ry * hw, rng, { irregularity: 0.3, points: 22 });
    for (let k = 0; k < 4; k++) L.fill(shape, jitter(pigment, rng, 0.03), (opts.alpha ?? 0.92) / 4 + 0.04);
  }
  L.dry({ opacity: 0.9, edge: 0.42, edgeWidth: 1.2, sharpness: 0.45, centreLift: 0.15, flow: 0.55, flowScale: 6, blend: opts.over ? 'source-over' : 'multiply' });
}

/** Red patches along the back, kohaku-style: 2–3, broad, wrapping the body, a gap at the tail. */
function redSpots(rng: Rng, head = true): Spot[] {
  const out: Spot[] = [];
  let s = head ? rng.range(0.05, 0.1) : rng.range(0.2, 0.28);
  const n = rng.int(2, 3);
  for (let i = 0; i < n && s < 0.8; i++) {
    const rx = rng.range(0.07, 0.13);
    out.push({ s: s + rx, dy: rng.range(-0.3, 0.3), rx, ry: rng.range(0.85, 1.4) });
    s += rx * 2 + rng.range(0.05, 0.13);
  }
  return out;
}

function paintBody(p: Painter, rng: Rng, len: number, pattern: KoiPattern): void {
  const lb = len * BODY;
  const hw = len * HALF_W;
  const poly = bodyPolygon(len);
  const pal = palette(pattern);
  const wash = { rng, blend: 'source-over' as const, opacity: 0.94, deform: 0.04, spread: 0.03, edge: 0.35, edgeWidth: 0.9, centreLift: 0.12, granulation: 0.04, flow: 0.25, flowScale: 8 };
  p.wash(poly, pal.base, wash);
  if (pattern === 'asagi') {
    // orange flanks under a blue-grey back, the two bleeding into each other; a pale head
    patches(p, rng, poly, len, ASAGI_BACK, [{ s: 0.56, dy: 0, rx: 0.44, ry: 0.62 }], { over: true });
    p.glaze(blob(lb * 0.07, 0, lb * 0.09, hw * 0.75, rng), lighten(ASAGI_BACK, 0.45), { rng, opacity: 0.7, blend: 'source-over' });
    // the netted scales: tiny broken arcs
    for (let i = 0; i < 7; i++) {
      for (let j = -1; j <= 1; j++) {
        const x = lb * (0.2 + i * 0.085) + (j & 1) * lb * 0.04;
        const y = j * hw * 0.32;
        p.inkLine([{ x: x - 1, y: y - 0.9 }, { x: x + 0.4, y }, { x: x - 1, y: y + 0.9 }], { rng, width: 0.25, opacity: 0.22, breaks: 0, pigment: shade(ASAGI_BACK, 0.4) });
      }
    }
  }
  if (pattern === 'yamabuki') {
    // soft metallic sheen: a pale lift along the back and on the head
    p.glaze(blob(lb * 0.45, 0, lb * 0.34, hw * 0.28, rng), lighten(GOLD, 0.45), { rng, opacity: 0.55, blend: 'source-over' });
    p.glaze(blob(lb * 0.1, 0, lb * 0.1, hw * 0.65, rng), lighten(GOLD, 0.3), { rng, opacity: 0.45, blend: 'source-over' });
  }
  if (pattern === 'kohaku' || pattern === 'sanke') patches(p, rng, poly, len, RED, redSpots(rng, pattern === 'kohaku' || rng.chance(0.5)));
  if (pattern === 'sanke') {
    const spots = Array.from({ length: rng.int(3, 5) }, () => ({ s: rng.range(0.3, 0.8), dy: rng.range(-0.55, 0.55), rx: rng.range(0.02, 0.04), ry: rng.range(0.2, 0.38) }));
    patches(p, rng, poly, len, SUMI, spots, { alpha: 0.8 });
  }
  if (pattern === 'showa') {
    // black base patterns wrapping the body (and the head), red and white between
    patches(p, rng, poly, len, RED, redSpots(rng, true), { over: true });
    const bands = [{ s: 0.1, dy: 0, rx: 0.1, ry: 1.3 }, ...Array.from({ length: rng.int(3, 4) }, (_, i) => ({ s: 0.3 + i * 0.17 + rng.range(-0.03, 0.03), dy: rng.range(-0.5, 0.5), rx: rng.range(0.06, 0.1), ry: rng.range(0.8, 1.4) }))];
    patches(p, rng, poly, len, SUMI, bands, { over: true, alpha: 1 });
  }
  // continuous dorsal fin along the back: a translucent ridge with a fine ink edge
  const ridge = smoothPolygon(
    [
      { x: lb * 0.3, y: 0 },
      { x: lb * 0.45, y: -hw * 0.12 },
      { x: lb * 0.72, y: -hw * 0.07 },
      { x: lb * 0.8, y: 0 },
      { x: lb * 0.6, y: hw * 0.06 },
    ],
    1,
  );
  p.glaze(ridge, shade(pal.base === PIGMENTS.petalWhite ? PIGMENTS.petalShade : pal.base, 0.25), { rng, opacity: 0.4 });
  p.inkLine(
    [
      { x: lb * 0.3, y: rng.range(-0.2, 0.2) },
      { x: lb * 0.55, y: rng.range(-0.3, 0.3) },
      { x: lb * 0.8, y: 0 },
    ],
    { rng, width: 0.45, opacity: 0.25, breaks: 0.35, wobble: 0.2 },
  );
  // the far flank in cool shade
  const lower = poly.filter((q) => q.y >= 0);
  p.glaze([{ x: 0, y: 0 }, ...lower.reverse(), { x: lb, y: 0 }], shade(pal.base, 0.35), { rng, opacity: 0.14, fade: -Math.PI / 2 });
  // eyes set wide on the broad head, and the pair of barbels at the mouth
  for (const side of [-1, 1]) {
    p.dab({ x: lb * 0.07, y: side * hw * 0.62 }, PIGMENTS.sumi, { rng, variant: 'round', length: 1.3, width: 1.1, opacity: 0.6, angle: 0 });
    p.inkLine(
      [
        { x: lb * 0.012, y: side * hw * 0.32 },
        { x: -len * 0.02, y: side * hw * 0.55 },
        { x: -len * 0.035, y: side * hw * 0.85 },
      ],
      { rng, width: 0.32, opacity: 0.45, breaks: 0, taper: [0.05, 0.7], wobble: 0.1 },
    );
  }
}

/** Paint one koi's parts (body strip, caudal fin, pectoral fin) and their deep-water copies. */
export function paintKoi(res: number, seed: number, pattern: KoiPattern, len: number): KoiParts {
  const pal = palette(pattern);
  const lb = len * BODY;
  const hw = len * HALF_W;
  const pad = 3;
  const body = paintSprite(res, { w: lb + pad + len * 0.05, h: hw * 2 + pad * 2, ox: len * 0.05, oy: hw + pad }, seed, (p, rng) => paintBody(p, rng, len, pattern));

  // soft, flowing caudal fin: two long lobes that curl outward, fine rays
  const tailLen = len * 0.28;
  const tail = paintSprite(res, { w: tailLen + 4, h: tailLen * 1.3 + 4, ox: 1.5, oy: tailLen * 0.65 + 2 }, seed + 1, (p, rng) => {
    const finPig = pattern === 'showa' ? mix(pal.fin, SUMI, 0.2) : pal.fin;
    for (const side of [-1, 1]) {
      p.dab({ x: 0, y: 0 }, finPig, { rng, variant: 'petal', angle: side * rng.range(0.24, 0.31), length: tailLen * rng.range(0.92, 1.04), width: tailLen * 0.38, curve: side * 0.26, opacity: 0.55, blend: 'source-over', pool: 0.25, edge: 0.35 });
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 5 - 0.5) * 1.1;
      p.inkLine(
        [
          { x: 1, y: 0 },
          { x: Math.cos(a) * tailLen * 0.5, y: Math.sin(a) * tailLen * 0.5 + Math.sign(a) * 0.6 },
          { x: Math.cos(a) * tailLen * 0.85, y: Math.sin(a) * tailLen * 0.85 + Math.sign(a) * 1.5 },
        ],
        { rng, width: 0.22, opacity: 0.12, breaks: 0.3 },
      );
    }
  });

  // long, flowing pectoral fins
  const finLen = len * 0.22;
  const fin = paintSprite(res, { w: finLen + 3, h: finLen * 0.85 + 2, ox: 1, oy: finLen * 0.42 + 1 }, seed + 2, (p, rng) => {
    const finPig = pattern === 'showa' ? mix(pal.fin, SUMI, 0.35) : pal.fin;
    p.dab({ x: 0, y: 0 }, finPig, { rng, variant: 'petal', angle: 0, length: finLen, width: finLen * 0.6, curve: 0.15, opacity: 0.5, blend: 'source-over', pool: 0.2, edge: 0.35 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 3 - 0.5) * 0.6;
      p.inkLine([{ x: 0.5, y: 0 }, { x: Math.cos(a) * finLen * 0.85, y: Math.sin(a) * finLen * 0.85 }], { rng, width: 0.2, opacity: 0.12, breaks: 0.2 });
    }
  });

  return { len, pattern, body, bodyDeep: deepCopy(body, res), tail, tailDeep: deepCopy(tail, res), fin, finDeep: deepCopy(fin, res) };
}

/** A koi laid out straight (snout at x, tail to the right), for the studio varieties sheet. */
export function drawKoiStraight(ctx: Ctx, parts: KoiParts, x: number, y: number, deep = false): void {
  const lb = parts.len * BODY;
  const hw = parts.len * HALF_W;
  const off = hw * koiProfile(FIN_AT) * 0.75;
  drawSprite(ctx, deep ? parts.tailDeep : parts.tail, x + lb * 0.93, y, 0);
  for (const side of [-1, 1]) drawSprite(ctx, deep ? parts.finDeep : parts.fin, x + lb * FIN_AT, y + side * off, side * 0.75, 1, 1, 0.9);
  drawSprite(ctx, deep ? parts.bodyDeep : parts.body, x, y);
}

// ---------------------------------------------------------------------------------------------
// behaviour

/** Sample a point at arc distance `d` behind the head along the trail (newest first). */
export function trailPoint(trail: readonly Pt[], d: number): { pt: Pt; dir: number } {
  let acc = 0;
  for (let i = 0; i < trail.length - 1; i++) {
    const a = trail[i]!;
    const b = trail[i + 1]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= d && seg > 1e-6) {
      const t = (d - acc) / seg;
      return { pt: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    acc += seg;
  }
  const n = trail.length;
  const a = trail[Math.max(0, n - 2)]!;
  const b = trail[n - 1]!;
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const extra = d - acc;
  return { pt: { x: b.x + Math.cos(dir) * extra, y: b.y + Math.sin(dir) * extra }, dir };
}

export interface KoiOptions {
  seed: number;
  pattern: KoiPattern;
  /** plane position to start at (default: a random point inside) */
  at?: Pt;
}

export class Koi extends BaseCreature {
  readonly kind = 'koi' as const;
  readonly visitor = false;
  override layer: LayerId = 'underwater';
  readonly len: number;
  readonly seed: number;
  readonly pattern: KoiPattern;
  /** head position in the pond plane */
  p: Pt;
  heading: number;
  speed = 3;
  cruise: number;
  target: Pt;
  /** 0 at the surface … 1 deep */
  deep = 0.95;
  deepTarget = 0.55;
  private deepTimer = 8;
  private kissed = false;
  private phase = 0;
  private turnBoost = 0;
  private trail: Pt[] = [];
  private readonly wobble: number;

  constructor(w: FaunaWorld, opts: KoiOptions) {
    super();
    const rng = w.rng;
    this.seed = opts.seed;
    this.pattern = opts.pattern;
    this.len = SIZES.koi * rng.range(0.85, 1.15);
    this.cruise = rangeOf(rng, SPEEDS.koi);
    this.p = opts.at ?? randomPointInside(w.pond.plane, rng, this.margin());
    this.heading = rng.range(0, TAU);
    this.target = this.pickTarget(w);
    this.heading = Math.atan2(this.target.y - this.p.y, this.target.x - this.p.x);
    this.wobble = rng.range(0, 100);
    this.alpha = 0;
    this.state = 'cruise';
    for (let d = 0; d <= this.len * BODY + 8; d += 1.5) {
      this.trail.push({ x: this.p.x - Math.cos(this.heading) * d, y: this.p.y - Math.sin(this.heading) * d });
    }
    this.syncWorld(w);
  }

  private margin(): number {
    return FAUNA_TUNING.koiMargin;
  }

  /** A wander target ahead-ish, inside the pond with a margin. */
  private pickTarget(w: FaunaWorld, towardCentre = false): Pt {
    const plane = w.pond.plane;
    const c = { x: w.pond.centre.x, y: w.pond.cy };
    let best: Pt | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < 8; i++) {
      const q = randomPointInside(plane, w.rng, this.margin() * 1.4);
      const d = dist(q, this.p);
      if (d < this.len * 1.2) continue;
      const turn = Math.abs(angleDiff(this.heading, Math.atan2(q.y - this.p.y, q.x - this.p.x)));
      const toC = towardCentre ? Math.abs(angleDiff(Math.atan2(c.y - this.p.y, c.x - this.p.x), Math.atan2(q.y - this.p.y, q.x - this.p.x))) : 0;
      const score = turn * 1.2 + toC * 2 + w.rng.range(0, 0.8);
      if (score < bestScore) {
        bestScore = score;
        best = q;
      }
    }
    return best ?? randomPointInside(plane, w.rng, this.margin());
  }

  update(dt: number, w: FaunaWorld): void {
    if (dt <= 0) return;
    const sf = w.speed;
    this.timer += dt;
    const plane = w.pond.plane;

    // depth: long slow changes, now and then rising toward the light
    this.deepTimer -= dt;
    if (this.deepTimer <= 0 && !this.leaving) {
      const rise = w.rng.chance(0.3);
      this.deepTarget = rise ? w.rng.range(0.02, 0.12) : w.rng.range(0.3, 0.8);
      this.deepTimer = rise ? w.rng.range(7, 15) : w.rng.range(14, 32);
      this.kissed = false;
    }
    this.deep = approach(this.deep, this.deepTarget, 0.22 * sf, dt);
    if (!this.kissed && this.deep < 0.09) {
      this.kissed = true;
      if (w.rng.chance(0.6)) w.ripple(this.x, this.y, this.len * 0.45, 0.6);
    }

    // speed: cruising, or a slow glide on spread fins
    let want = this.cruise;
    if (this.state === 'glide') {
      want = 1.2;
      if (this.timer > 5) this.go('cruise');
    }
    if (this.leaving) want = this.cruise * 0.6;
    this.speed = approach(this.speed, want * sf, 0.5, dt);

    // steering: toward the target, around the shore, apart from the other koi
    if (dist(this.p, this.target) < this.len * 0.5) {
      if (this.state === 'cruise' && w.rng.chance(0.35)) this.go('glide');
      this.target = this.pickTarget(w);
    }
    const look = this.len * 0.8 + this.speed * 2;
    const ahead = { x: this.p.x + Math.cos(this.heading) * look, y: this.p.y + Math.sin(this.heading) * look };
    if (!insideWithMargin(ahead, plane, this.margin())) {
      if (this.turnBoost <= 0) this.target = this.pickTarget(w, true);
      this.turnBoost = 2;
    }
    this.turnBoost -= dt;
    let dx = this.target.x - this.p.x;
    let dy = this.target.y - this.p.y;
    const dn = Math.hypot(dx, dy) || 1;
    dx /= dn;
    dy /= dn;
    for (const o of w.creatures) {
      if (o === this || !(o instanceof Koi)) continue;
      const ox = this.p.x - o.p.x;
      const oy = this.p.y - o.p.y;
      const d = Math.hypot(ox, oy);
      const r = (this.len + o.len) * 0.55;
      if (d < r && d > 1e-3) {
        const k = ((r - d) / r) * 1.5;
        dx += (ox / d) * k;
        dy += (oy / d) * k;
      }
    }
    const rate = SPEEDS.koiTurn * sf * (this.turnBoost > 0 ? 2.2 : 1) * (0.45 + 0.55 * clamp(this.speed / this.cruise, 0, 1.2));
    this.heading = turnToward(this.heading, Math.atan2(dy, dx), rate, dt);

    this.p = { x: this.p.x + Math.cos(this.heading) * this.speed * dt, y: this.p.y + Math.sin(this.heading) * this.speed * dt };
    this.p = containPoint(this.p, plane, this.margin() * 0.5);

    const last = this.trail[0]!;
    if (dist(last, this.p) >= 1.5) {
      this.trail.unshift({ ...this.p });
      const keep = Math.ceil((this.len * BODY + 10) / 1.5) + 2;
      if (this.trail.length > keep) this.trail.length = keep;
    } else {
      this.trail[0] = { ...this.p };
    }

    // tail beat follows speed; a gliding koi barely moves its tail
    this.phase += dt * TAU * (0.28 + (this.speed / this.len) * 1.6);

    if (this.leaving) {
      this.deepTarget = 1;
      this.alpha = Math.max(0, this.alpha - dt * 0.12);
      if (this.alpha <= 0) this.done = true;
    } else {
      this.alpha = Math.min(1, this.alpha + dt * 0.15);
    }
    this.syncWorld(w);
  }

  private syncWorld(w: FaunaWorld): void {
    const q = toWorld(this.p, w.pond.cy, w.pond.squash);
    this.x = q.x;
    this.y = q.y;
  }

  draw(layer: LayerId, ctx: Ctx, w: FaunaWorld): void {
    if (layer !== 'underwater') return;
    const parts = w.art.get(`koi:${this.seed}:${this.pattern}:${this.len.toFixed(1)}`, (res) => paintKoi(res, this.seed, this.pattern, this.len));
    const near = 1 - smoothstep((this.deep - 0.25) / 0.6);
    const a = lerp(0.95, 0.5, this.deep) * this.alpha;
    if (a < 0.01) return;
    const ps = w.perspective(this.y, this.x);
    const pts = this.spine(w.t);
    // compose each variant at full opacity, then lay it down faded (no doubled alpha at seams)
    const R = this.len * 1.25;
    const k = w.art.res * ps;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(ps, ps * DRAW_SQUASH);
    for (const deep of [true, false]) {
      const weight = deep ? 1 - near : near;
      if (weight < 0.03) continue;
      const sc = w.art.scratch(2 * R * k);
      sc.ctx.setTransform(k, 0, 0, k, R * k, R * k);
      this.compose(sc.ctx, parts, deep, pts, w.t);
      ctx.globalAlpha = a * weight;
      ctx.drawImage(sc.canvas as CanvasImageSource, 0, 0, 2 * R * k, 2 * R * k, -R, -R, 2 * R, 2 * R);
    }
    ctx.restore();
  }

  /** Spine points (relative to the head, plane units): the trail plus a travelling swim wave. */
  private spine(t: number): Pt[] {
    const lb = this.len * BODY;
    const pts: Pt[] = [];
    const amp = this.ampNow();
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const { pt, dir } = trailPoint(this.trail, s * lb);
      // swim wave: mostly in the rear half, travelling tailward; plus a faint refraction wobble
      const lat = amp * (0.1 + 0.9 * s * s) * Math.sin(this.phase - s * TAU * 0.8) + 0.25 * Math.sin(t * 1.7 + s * 5 + this.wobble);
      pts.push({ x: pt.x - Math.sin(dir) * lat - this.p.x, y: pt.y + Math.cos(dir) * lat - this.p.y });
    }
    return pts;
  }

  private ampNow(): number {
    return this.len * 0.05 * clamp(0.3 + this.speed / (this.cruise * 1.4), 0.3, 1);
  }

  private compose(ctx: Ctx, parts: KoiParts, deep: boolean, pts: Pt[], t: number): void {
    const lb = this.len * BODY;
    const hw = this.len * HALF_W;
    const angle = (i: number) => {
      const j = Math.min(i, SEGMENTS - 1);
      const a = pts[j]!;
      const b = pts[j + 1]!;
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    const body = deep ? parts.bodyDeep : parts.body;
    const tail = deep ? parts.tailDeep : parts.tail;
    const fin = deep ? parts.finDeep : parts.fin;

    // caudal fin: rooted just inside the body's end, following the last segment plus a lagging sweep
    const tq = pts[SEGMENTS - 1]!;
    const te = pts[SEGMENTS]!;
    const tp = { x: tq.x + (te.x - tq.x) * 0.7, y: tq.y + (te.y - tq.y) * 0.7 };
    const sweep = 0.45 * clamp(this.ampNow() / (this.len * 0.05), 0.2, 1) * Math.sin(this.phase - TAU * 0.8 - 0.9);
    drawSprite(ctx, tail, tp.x, tp.y, angle(SEGMENTS - 1) + sweep);

    // pectoral fins: paddle slowly, spread wide when gliding
    const fi = Math.round(SEGMENTS * FIN_AT);
    const fp = pts[fi]!;
    const fa = angle(fi);
    const spread = this.state === 'glide' ? 1.05 : 0.75;
    for (const side of [-1, 1]) {
      const paddle = 0.22 * Math.sin(t * 1.4 + side * 0.8 + this.wobble);
      const off = hw * koiProfile(FIN_AT) * 0.75;
      drawSprite(ctx, fin, fp.x - Math.sin(fa) * off * side, fp.y + Math.cos(fa) * off * side, fa + side * (spread + paddle), 1, 1, 0.9);
    }

    // body: the painted strip cut into segments laid along the spine (overlapping a little)
    const img = body.img as CanvasImageSource;
    const res = body.img.width / body.w;
    const segLen = lb / SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) {
      const p0 = pts[i]!;
      const x0 = i === 0 ? -body.ox : i * segLen - 0.8;
      const x1 = i === SEGMENTS - 1 ? body.w - body.ox : (i + 1) * segLen + 0.8;
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

export function koiPattern(koiSeed: number, index: number) {
  // the first koi is a kohaku more often than not; then the others in a seeded order
  const start = koiSeed % 3 === 0 ? 1 : 0;
  return KOI_PATTERNS[(start + index) % KOI_PATTERNS.length]!;
}

const koi: CreatureDef = {
  kind: 'koi',
  title: 'koi',
  role: 'resident',
  rank: 0,
  // one per unlocked row (koi-1, koi-2, koi-3), each with its own seeded pattern
  resident: (n) => n,
  needs: (w) => w.pond.world.length >= 3,
  spawn(w, s) {
    if (w.pond.world.length < 3) return [];
    return [new Koi(w, { seed: hashString(`${s.seed}:${s.index}`), pattern: koiPattern(s.seed, s.index) })];
  },
  sheet: {
    w: 620,
    h: 150,
    make(res, seed) {
      const a = paintKoi(res, seed, 'kohaku', 60);
      return [a.body, a.tail, a.fin, a.bodyDeep, a.tailDeep, a.finDeep];
    },
  },
  show: { order: 0, spec: { w: 380, h: 230 }, w: 570, h: 345 },
};
export default koi;
