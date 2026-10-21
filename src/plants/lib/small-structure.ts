/**
 * Pure plant-structure geometry shared by the tier 1–2 species (docs/systems/plants-species-a.md).
 *
 * A species first *plans* its whole plant from the rng (stems, leaf nodes, flowers, petals) —
 * consuming random numbers in a fixed order that never depends on growth — and only then
 * *renders* that plan at a growth value. These helpers are the planning vocabulary: turtle
 * stems that can be grown and straightened, points along paths, petal rings and the
 * perspective projection of a flower that opens from a closed bud.
 *
 * Coordinates are plant-local world units: base of the plant at (0, 0), y down (so "up" is −y).
 */
import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint';
import { clamp01, lerp } from './small-growth';

export const UP = -Math.PI / 2;

// ---------------------------------------------------------------------------------------------
// stems

/** A stem as a turtle walk: `bends[i]` is the turn after segment i at full growth. */
export interface StemPlan {
  /** where the stem starts (plant-local) */
  base: Pt;
  /** full length at growth 1 */
  length: number;
  /** initial direction, radians (−π/2 = straight up) */
  angle: number;
  /** per-segment turns at full growth (also sets the segment count) */
  bends: number[];
}

/**
 * Random bend profile: `n` segment turns summing to about `total`, weighted toward the tip by
 * `tipBias` (0 = uniform, 1 = mostly at the tip — a nodding head), plus a little `wobble`.
 */
export function bendProfile(rng: Rng, n: number, total: number, tipBias = 0.3, wobble = 0.04): number[] {
  const w: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const v = lerp(1, t * t * 3, tipBias);
    w.push(v);
    sum += v;
  }
  return w.map((v) => (total * v) / sum + rng.gaussian(0, wobble));
}

export function makeStem(rng: Rng, o: { base?: Pt; length: number; angle: number; bend: number; segments?: number; tipBias?: number; wobble?: number }): StemPlan {
  return {
    base: o.base ?? { x: 0, y: 0 },
    length: o.length,
    angle: o.angle,
    bends: bendProfile(rng, o.segments ?? 8, o.bend, o.tipBias ?? 0.3, o.wobble ?? 0.04),
  };
}

/**
 * Points of a stem grown to `extent` (0..1 of its length) with its turns scaled by `bendK`
 * (young shoots are straighter; heads nod as they grow heavy). Always `bends.length + 1` points.
 */
export function stemPoints(s: StemPlan, extent: number, bendK = 1): Pt[] {
  const n = s.bends.length;
  const seg = (s.length * clamp01(extent)) / Math.max(1, n);
  const pts: Pt[] = [{ ...s.base }];
  let a = s.angle;
  let x = s.base.x;
  let y = s.base.y;
  for (let i = 0; i < n; i++) {
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    pts.push({ x, y });
    a += s.bends[i]! * bendK;
  }
  return pts;
}

export function pathLen(pts: readonly Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return L;
}

/** Point and tangent angle at fraction `t` (0..1) of a path's length. */
export function pointAt(pts: readonly Pt[], t: number): { x: number; y: number; angle: number } {
  const first = pts[0] ?? { x: 0, y: 0 };
  if (pts.length < 2) return { x: first.x, y: first.y, angle: UP };
  const total = pathLen(pts);
  if (total <= 1e-9) {
    return { x: first.x, y: first.y, angle: Math.atan2(pts[1]!.y - first.y, pts[1]!.x - first.x) || UP };
  }
  let want = clamp01(t) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= l || i === pts.length - 1) {
      const k = l > 0 ? Math.min(1, want / l) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    want -= l;
  }
  const last = pts[pts.length - 1]!;
  return { x: last.x, y: last.y, angle: UP };
}

/** The first `t` (0..1 of length) of a path. */
export function subPath(pts: readonly Pt[], t: number): Pt[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  const total = pathLen(pts);
  let want = clamp01(t) * total;
  const out: Pt[] = [{ ...pts[0]! }];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= l) {
      const k = l > 0 ? want / l : 0;
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      return out;
    }
    out.push({ ...b });
    want -= l;
  }
  return out;
}

/** Quadratic arc from `a` to `b` bowed sideways by `bow` (fraction of the chord), `n` segments. */
export function arc(a: Pt, b: Pt, bow: number, n = 6): Pt[] {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c = { x: mx - dy * bow, y: my + dx * bow };
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return pts;
}

export const add = (p: Pt, a: number, d: number): Pt => ({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d });

/** Interpolate angles the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------------------------------------------------------------------------------------------
// flowers

export interface PetalPlan {
  /** angle around the flower centre, in the flower's own plane */
  a: number;
  /** length multiplier (≈1) */
  len: number;
  /** width multiplier (≈1) */
  wid: number;
  /** curl of the petal axis (signed fraction) */
  curve: number;
  /** colour jitter seed in 0..1 */
  tone: number;
}

/** `n` petals evenly round the centre with seeded irregularity (never symmetric). */
export function petalRing(rng: Rng, n: number, o: { rot?: number; angJit?: number; lenJit?: number; widJit?: number; curve?: number } = {}): PetalPlan[] {
  const rot = o.rot ?? rng.range(0, Math.PI * 2);
  const out: PetalPlan[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      a: rot + (i / n) * Math.PI * 2 + rng.gaussian(0, o.angJit ?? 0.12),
      len: 1 + rng.gaussian(0, o.lenJit ?? 0.09),
      wid: 1 + rng.gaussian(0, o.widJit ?? 0.08),
      curve: rng.gaussian(0, o.curve ?? 0.08),
      tone: rng.next(),
    });
  }
  return out;
}

/**
 * How a flower is seen: `tilt` 1 = face-on … 0.2 = almost edge-on (a cup seen from the side);
 * `roll` = screen direction of the flower's own "up" (the way its face points), −π/2 = up.
 */
export interface FlowerView {
  tilt: number;
  roll: number;
}

/** Screen direction (unit-ish vector, foreshortened) of a petal at plane angle `a`. */
export function projectDir(a: number, v: FlowerView): Pt {
  // flower plane: u across, w toward the face direction; w is foreshortened by tilt
  const u = Math.cos(a);
  const w = Math.sin(a) * v.tilt;
  // rotate so the plane's −w axis lies along roll
  const r = v.roll + Math.PI / 2;
  return { x: u * Math.cos(r) - w * Math.sin(r), y: u * Math.sin(r) + w * Math.cos(r) };
}

/**
 * A petal's screen angle and length factor at opening `open` (0 = closed bud, 1 = open):
 * closed petals point along the flower's face direction, short and foreshortened; open ones
 * radiate in the flower's (tilted) plane. Interpolates angle and length separately so a petal
 * swings open instead of shrinking through the centre.
 */
export function petalPose(a: number, v: FlowerView, open: number, closedLen = 0.45): { angle: number; len: number; depth: number } {
  const d = projectDir(a, v);
  const openAngle = Math.atan2(d.y, d.x);
  const openLen = Math.hypot(d.x, d.y);
  const k = clamp01(open);
  // closed: petals cluster around the face direction, fanned only slightly by their position
  const closedAngle = v.roll + Math.cos(a) * 0.35;
  return {
    angle: lerpAngle(closedAngle, openAngle, k),
    len: lerp(closedLen, Math.max(0.18, openLen), k),
    // petals on the near side (sin a > 0) are painted last
    depth: Math.sin(a),
  };
}
