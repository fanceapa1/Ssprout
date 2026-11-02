/**
 * Painting helpers for the hototogisu (toad lily): upward-facing six-tepalled stars, white
 * wet-in-wet, dabbed with purple freckles, around a spotted column of styles.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt, type Rect } from '../../paint';
import { clamp01, easeOut, lerp, smooth, visible } from './small-growth';
import { shadowSide } from './small-paint';
import { UP, petalPose, type FlowerView } from './small-structure';

/** A freckle on a tepal: `u` along it (0 base … 1 tip), `v` across (−1 … 1 of its half-width). */
export interface Freckle {
  u: number;
  v: number;
  r: number;
  /** bled into the wet white (soft) or dropped on once it has dried (crisp) */
  soft: boolean;
  tone: number;
}

export interface Tepal {
  /** angle in the flower's plane */
  a: number;
  len: number;
  wid: number;
  curve: number;
  freckles: Freckle[];
}

export interface StarFlower {
  /** stable identity: keeps each flower's marks its own as others open */
  id: number;
  c: Pt;
  tepals: readonly Tepal[];
  view: FlowerView;
  size: number;
  /** 0 = closed … 1 = open */
  open: number;
  /** the three style arms' screen angles, spreading from the column's top */
  arms: readonly number[];
}

export interface StarStyle {
  freckle: Pigment;
  /** pale violet of the column and the flush at the tepals' base */
  column: Pigment;
  area: Rect;
}

const SHADOW = mix(PIGMENTS.shadow, PIGMENTS.olive, 0.25);

interface Pose {
  angle: number;
  length: number;
  width: number;
  curve: number;
  t: Tepal;
  j: number;
}

function poses(f: StarFlower): Pose[] {
  return f.tepals
    .map((t, j) => ({ t, j, pose: petalPose(t.a, f.view, f.open, 0.42) }))
    .sort((a, b) => a.pose.depth - b.pose.depth)
    .map(({ t, j, pose }) => ({
      t,
      j,
      angle: pose.angle,
      length: f.size * t.len * pose.len * lerp(0.3, 1, easeOut(f.open)),
      width: f.size * t.wid * lerp(0.45, 1, smooth(f.open)),
      curve: t.curve,
    }));
}

/** Where a freckle sits on the screen: along the tepal's axis, across within its outline. */
function frecklePoint(c: Pt, p: Pose, fr: Freckle): Pt {
  const ux = Math.cos(p.angle);
  const uy = Math.sin(p.angle);
  const along = fr.u * p.length;
  const bend = p.curve * p.length * (fr.u * fr.u * 0.7 + Math.sin(Math.PI * fr.u) * 0.15);
  // the pointed tepal is widest a little below its middle
  const half = p.width * 0.5 * Math.sin(Math.PI * Math.min(1, fr.u * 1.15)) * 0.8;
  const across = bend + fr.v * half;
  return { x: c.x + ux * along - uy * across, y: c.y + uy * along + ux * across };
}

/**
 * The open flowers in four shared layers: a cool shadow below, the white tepals source-over
 * with a violet flush and soft freckles bled in, crisp freckles on top, then the columns.
 */
export function freckledStars(p: Painter, rng: Rng, flowers: readonly StarFlower[], s: StarStyle): void {
  const open = flowers.filter((f) => visible(f.open) && f.size > 0.2);
  if (!open.length) return;
  const all = open.map((f) => ({ f, ps: poses(f) }));
  const S = p.layer(s.area);
  for (const { f, ps } of all) {
    const off = { x: f.c.x + f.size * 0.08, y: f.c.y + f.size * 0.22 };
    for (const q of ps) {
      p.dabInto(S, off, SHADOW, { rng: rng.fork(`sh-${f.id}-${q.j}`), variant: 'leaf', angle: q.angle, length: q.length * 1.04, width: q.width * 1.15, curve: q.curve, pool: 0.1, basePool: 0.2, layers: 2, asym: 0, jitter: 0 });
    }
  }
  S.dry({ opacity: 0.15, edge: 0.2, edgeWidth: 0.25, sharpness: 0.35, centreLift: 0.05, granulation: 0.05 });

  const W = p.layer(s.area);
  const flush = mix(PIGMENTS.petalWhite, s.column, 0.5);
  const soft = mix(s.freckle, PIGMENTS.petalWhite, 0.55);
  for (const { f, ps } of all) {
    const k = smooth(clamp01((f.open - 0.25) / 0.6));
    for (const q of ps) {
      const common = { variant: 'leaf' as const, angle: q.angle, curve: q.curve, asym: 0 };
      p.dabInto(W, f.c, PIGMENTS.petalWhite, { ...common, rng: rng.fork(`p-${f.id}-${q.j}`), length: q.length, width: q.width, pool: 0.3, poolSide: shadowSide(q.angle), basePool: 0.1, layers: 4 });
      p.dabInto(W, f.c, flush, { ...common, rng: rng.fork(`f-${f.id}-${q.j}`), length: q.length * 0.3, width: q.width * 0.4, pool: 0, basePool: 0.4, layers: 2 });
      if (!visible(k)) continue;
      q.t.freckles.forEach((fr, n) => {
        if (!fr.soft) return;
        const r = fr.r * f.size * 0.06 * k;
        p.dabInto(W, frecklePoint(f.c, q, fr), mix(soft, s.freckle, fr.tone), { rng: rng.fork(`sf-${f.id}-${q.j}-${n}`), variant: 'round', angle: q.angle, length: r * 2.2, width: r * 1.7, pool: 0.2, basePool: 0, layers: 2, asym: 0 });
      });
    }
  }
  W.dry({ opacity: 0.96, edge: 0.45, edgeWidth: 0.2, sharpness: 0.72, centreLift: 0.15, granulation: 0.04, flow: 0.3, flowScale: 2.5, darken: 0.3, blend: 'source-over' });

  const P = p.layer(s.area);
  for (const { f, ps } of all) {
    const k = smooth(clamp01((f.open - 0.4) / 0.55));
    if (!visible(k)) continue;
    for (const q of ps) {
      q.t.freckles.forEach((fr, n) => {
        if (fr.soft) return;
        const r = fr.r * f.size * 0.045 * k;
        p.dabInto(P, frecklePoint(f.c, q, fr), mix(s.freckle, PIGMENTS.sumi, fr.tone * 0.3), { rng: rng.fork(`cf-${f.id}-${q.j}-${n}`), variant: 'round', angle: q.angle + fr.v, length: r * 2, width: r * 1.5, pool: 0.4, basePool: 0, layers: 2, asym: 0 });
      });
    }
  }
  P.dry({ opacity: 0.86, edge: 0.6, edgeWidth: 0.15, sharpness: 0.8, centreLift: 0.1, granulation: 0.08 });

  for (const { f } of all) column(p, rng.fork(`col-${f.id}`), f, s);
}

/** The column of styles: a short pale stalk rising from the heart, three arms arching out, freckled. */
function column(p: Painter, rng: Rng, f: StarFlower, s: StarStyle): void {
  const k = smooth(clamp01((f.open - 0.45) / 0.5));
  if (!visible(k)) return;
  const h = f.size * 0.42 * k;
  const lean = (f.view.roll - UP) * 0.5;
  const top = { x: f.c.x + Math.cos(UP + lean) * h, y: f.c.y + Math.sin(UP + lean) * h };
  const pale = { rng: rng.fork('stalk'), pigment: s.column, width: Math.max(0.35, f.size * 0.13), opacity: 0.7 * k, taper: [0.05, 0.25] as [number, number], wobble: 0.1, wetness: 0.3, edge: 0.4 };
  p.stroke([f.c, { x: (f.c.x + top.x) / 2, y: (f.c.y + top.y) / 2 }, top], pale);
  const dots: Pt[] = [{ x: lerp(f.c.x, top.x, 0.55), y: lerp(f.c.y, top.y, 0.55) }];
  f.arms.forEach((a, i) => {
    const L = f.size * 0.42 * k;
    const mid = { x: top.x + Math.cos(a) * L * 0.55, y: top.y + Math.sin(a) * L * 0.55 - L * 0.1 };
    const end = { x: top.x + Math.cos(a) * L, y: top.y + Math.sin(a) * L + L * 0.3 };
    p.stroke([top, mid, end], { ...pale, rng: rng.fork(`arm-${i}`), width: Math.max(0.3, f.size * 0.09), opacity: 0.65 * k, taper: [0.1, 0.45] });
    dots.push(mid);
  });
  dots.forEach((d, i) => {
    p.dab(d, s.freckle, { rng: rng.fork(`dot-${i}`), variant: 'round', angle: UP, length: f.size * 0.08 * k, width: f.size * 0.065 * k, opacity: 0.7 * k, edge: 0.5, layers: 2 });
  });
}

/** A closed bud: an upright greenish-white spindle, flecked violet as it whitens. */
export function freckledBud(p: Painter, rng: Rng, c: Pt, o: { angle: number; size: number; k: number; white: number; opacity: number; green: Pigment; freckle: Pigment }): void {
  if (!visible(o.k) || !visible(o.opacity)) return;
  const len = lerp(0.5, o.size * 1.05, easeOut(o.k));
  const body = mix(o.green, PIGMENTS.petalWhite, o.white * 0.75);
  p.dab(c, body, { rng: rng.fork('bud'), variant: 'petal', angle: o.angle, length: len, width: len * 0.5, opacity: 0.85 * o.opacity * smooth(o.k * 3), pool: 0.45, poolSide: shadowSide(o.angle), basePool: 0.4, edge: 0.45, layers: 3 });
  if (!visible(o.white)) return;
  for (let i = 0; i < 3; i++) {
    const u = 0.3 + i * 0.22;
    const v = (i % 2 ? 1 : -1) * 0.12 * len;
    const at = { x: c.x + Math.cos(o.angle) * len * u - Math.sin(o.angle) * v, y: c.y + Math.sin(o.angle) * len * u + Math.cos(o.angle) * v };
    p.dab(at, o.freckle, { rng: rng.fork(`fl-${i}`), variant: 'round', angle: o.angle, length: len * 0.12, width: len * 0.1, opacity: 0.7 * o.opacity * o.white, edge: 0.5, layers: 2 });
  }
}
