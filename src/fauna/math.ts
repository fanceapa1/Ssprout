/**
 * Pure motion and geometry helpers for creatures (unit-tested, no canvas).
 */
import type { Rng } from '../core/rng';
import type { Pt, Rect } from '../render/viewport';
import type { Range } from './tuning';

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Ease in-out like a breath (sinusoidal). */
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
export const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 2;
export const rangeOf = (rng: Rng, r: Range) => (r[1] > r[0] ? rng.range(r[0], r[1]) : r[0]);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed shortest difference b − a in (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Turn `angle` toward `target` by at most `maxRate · dt`. */
export function turnToward(angle: number, target: number, maxRate: number, dt: number): number {
  const d = angleDiff(angle, target);
  const step = maxRate * dt;
  return Math.abs(d) <= step ? target : angle + Math.sign(d) * step;
}

/** Exponential approach: frame-rate independent smoothing (`rate` per second). */
export function approach(v: number, target: number, rate: number, dt: number): number {
  return target + (v - target) * Math.exp(-rate * dt);
}

/**
 * Critically damped spring step toward `target` (semi-implicit Euler). `omega` ≈ 4 / settle time.
 * Mutates and returns `pos`/`vel` for allocation-free per-frame use.
 */
export function springStep(pos: Pt, vel: Pt, target: Pt, omega: number, dt: number): void {
  const k = omega * omega;
  const c = 2 * omega;
  vel.x += (k * (target.x - pos.x) - c * vel.x) * dt;
  vel.y += (k * (target.y - pos.y) - c * vel.y) * dt;
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
}

/**
 * Steering "arrive": desired velocity toward `target`, slowing inside `slowRadius`; velocity
 * changes by at most `maxAccel · dt`. Mutates `pos`/`vel`.
 */
export function arrive(pos: Pt, vel: Pt, target: Pt, maxSpeed: number, maxAccel: number, slowRadius: number, dt: number): void {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const d = Math.hypot(dx, dy);
  const speed = d < slowRadius ? maxSpeed * (d / slowRadius) : maxSpeed;
  const dvx = (d > 1e-6 ? (dx / d) * speed : 0) - vel.x;
  const dvy = (d > 1e-6 ? (dy / d) * speed : 0) - vel.y;
  const dv = Math.hypot(dvx, dvy);
  const lim = maxAccel * dt;
  const k = dv > lim ? lim / dv : 1;
  vel.x += dvx * k;
  vel.y += dvy * k;
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
}

// ---------------------------------------------------------------------------------------------
// polygons

export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Closest point on segment ab to p. */
export function closestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1) : 0;
  return { x: a.x + vx * t, y: a.y + vy * t };
}

/** Closest point on the polygon's boundary and its distance. */
export function closestOnPolygon(p: Pt, poly: readonly Pt[]): { pt: Pt; d: number } {
  let best: Pt = poly[0] ?? p;
  let bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const q = closestOnSegment(p, poly[j]!, poly[i]!);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return { pt: best, d: bd };
}

/** Inside the polygon and at least `margin` from its edge. */
export function insideWithMargin(p: Pt, poly: readonly Pt[], margin: number): boolean {
  return pointInPolygon(p, poly) && (margin <= 0 || closestOnPolygon(p, poly).d >= margin);
}

export function polygonCentroid(poly: readonly Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j]!;
    const q = poly[i]!;
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = Math.max(1, poly.length);
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function polygonBounds(poly: readonly Pt[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A random point inside `poly` at least `margin` from the edge (falls back to the centroid). */
export function randomPointInside(poly: readonly Pt[], rng: Rng, margin = 0, tries = 60): Pt {
  const b = polygonBounds(poly);
  for (let i = 0; i < tries; i++) {
    const p = { x: b.x + rng.next() * b.w, y: b.y + rng.next() * b.h };
    if (insideWithMargin(p, poly, margin)) return p;
  }
  return polygonCentroid(poly);
}

/**
 * Keep a moving point inside `poly` (with `margin`): if `p` is outside, return the nearest
 * point pulled `margin` inward toward the centroid (or, where a notch faces away from the
 * centroid, along the edge's inward normal); otherwise `p` itself.
 */
export function containPoint(p: Pt, poly: readonly Pt[], margin: number, centre = polygonCentroid(poly)): Pt {
  if (insideWithMargin(p, poly, margin)) return p;
  const { pt, d: off } = closestOnPolygon(p, poly);
  const dx = centre.x - pt.x;
  const dy = centre.y - pt.y;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(margin, d * 0.9);
  const q = { x: pt.x + (dx / d) * k, y: pt.y + (dy / d) * k };
  if (off < 1e-6 || pointInPolygon(q, poly)) return q;
  const sign = pointInPolygon(p, poly) ? 1 : -1;
  return { x: pt.x + ((p.x - pt.x) / off) * sign * margin, y: pt.y + ((p.y - pt.y) / off) * sign * margin };
}

/** Twice the signed area (positive: clockwise on screen, y down). */
export function signedArea(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j]!.x * poly[i]!.y - poly[i]!.x * poly[j]!.y;
  return a;
}

/** The same polygon, wound clockwise on screen (so a nonzero clip of several is their union). */
export function clockwise(poly: readonly Pt[]): Pt[] {
  return signedArea(poly) >= 0 ? poly.map((p) => ({ ...p })) : [...poly].reverse().map((p) => ({ ...p }));
}

/**
 * `poly` with an ellipse (`cx, cy, rx, ry`) bitten out of its edge: vertices inside are dropped and
 * the bite follows the ellipse inside the polygon. For a bite at the edge (foam at a pool's back).
 */
export function carveEllipse(poly: readonly Pt[], e: { x: number; y: number; rx: number; ry: number }, steps = 14): Pt[] {
  const n = poly.length;
  const toU = (p: Pt): Pt => ({ x: (p.x - e.x) / e.rx, y: (p.y - e.y) / e.ry });
  const toW = (p: Pt): Pt => ({ x: e.x + p.x * e.rx, y: e.y + p.y * e.ry });
  const inside = (p: Pt) => {
    const u = toU(p);
    return u.x * u.x + u.y * u.y < 1;
  };
  const start = poly.findIndex((p) => !inside(p));
  if (start < 0) return [];
  const out: Pt[] = [];
  let entry: number | null = null;
  for (let k = 0; k < n; k++) {
    const a = poly[(start + k) % n]!;
    const b = poly[(start + k + 1) % n]!;
    if (entry === null) out.push(a);
    const ua = toU(a);
    const ub = toU(b);
    const dx = ub.x - ua.x;
    const dy = ub.y - ua.y;
    const qa = dx * dx + dy * dy;
    const qb = 2 * (ua.x * dx + ua.y * dy);
    const qc = ua.x * ua.x + ua.y * ua.y - 1;
    const disc = qb * qb - 4 * qa * qc;
    if (disc <= 0 || qa === 0) continue;
    const ts = [(-qb - Math.sqrt(disc)) / (2 * qa), (-qb + Math.sqrt(disc)) / (2 * qa)].filter((t) => t > 0 && t < 1);
    for (const t of ts) {
      const u = { x: ua.x + dx * t, y: ua.y + dy * t };
      const ang = Math.atan2(u.y, u.x);
      if (entry === null) {
        out.push(toW(u));
        entry = ang;
        continue;
      }
      // the arc from entry to exit that runs inside the polygon
      let sweep = ang - entry;
      while (sweep <= -Math.PI) sweep += 2 * Math.PI;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      const mid = toW({ x: Math.cos(entry + sweep / 2), y: Math.sin(entry + sweep / 2) });
      if (!pointInPolygon(mid, poly)) sweep -= Math.sign(sweep) * 2 * Math.PI;
      for (let i = 1; i < steps; i++) {
        const t2 = entry + (sweep * i) / steps;
        out.push(toW({ x: Math.cos(t2), y: Math.sin(t2) }));
      }
      out.push(toW(u));
      entry = null;
    }
  }
  return out;
}

/** Pond plane ↔ world: the pond is seen at an angle, so plane y is stretched by 1/squash about `cy`. */
export function toPlane(p: Pt, cy: number, squash: number): Pt {
  return { x: p.x, y: cy + (p.y - cy) / squash };
}
export function toWorld(p: Pt, cy: number, squash: number): Pt {
  return { x: p.x, y: cy + (p.y - cy) * squash };
}

// ---------------------------------------------------------------------------------------------
// paths

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export function cubicTangent(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

/** Approximate arc length of a cubic (polyline of `n` pieces). */
export function cubicLength(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= n; i++) {
    const q = cubic(p0, p1, p2, p3, i / n);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

/** A point just outside the visible rect on `side` (−1 left, 1 right) at height `y`. */
export function offscreenPoint(view: Rect, side: number, y: number, margin: number): Pt {
  return { x: side < 0 ? view.x - margin : view.x + view.w + margin, y };
}

/** Is `p` outside the visible rect by more than `margin`? */
export function isOffscreen(p: Pt, view: Rect, margin: number): boolean {
  return p.x < view.x - margin || p.x > view.x + view.w + margin || p.y < view.y - margin || p.y > view.y + view.h + margin;
}

/** Local hour in [0, 24) for an epoch ms (the user's clock). */
export function localHour(now: number): number {
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60;
}

/** Inside [from, to) on a 24 h dial (wrapping midnight when from > to). */
export function inHours(hour: number, [from, to]: Range): boolean {
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}
