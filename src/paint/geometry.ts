/**
 * Pure geometry for the paint engine: polygons, recursive deformation, organic blobs, brush
 * outlines and smoothed paths. No canvas here, so everything is unit-testable and deterministic
 * for a given `Rng`.
 */
import type { Rng } from '../core/rng';
import type { Pt } from '../render/viewport';

export type { Pt };
export type Polygon = Pt[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ellipse description accepted wherever a `Shape` is expected (turned into an organic blob). */
export interface EllipseShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** rotation in radians (default 0) */
  rotation?: number;
}

/** A closed polygon or an ellipse spec. */
export type Shape = readonly Pt[] | EllipseShape;

export const isEllipse = (s: Shape): s is EllipseShape => !Array.isArray(s);

// ---------------------------------------------------------------------------------------------
// basics

export function bounds(pts: readonly Pt[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function padRect(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Signed area (positive for clockwise in screen coordinates, y down). */
export function area(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, pts.length);
  return { x: x / n, y: y / n };
}

export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Uniformly sample a point inside a polygon (rejection sampling; falls back to the centroid). */
export function randomPointIn(poly: readonly Pt[], rng: Rng, tries = 40): Pt {
  const b = bounds(poly);
  for (let i = 0; i < tries; i++) {
    const p = { x: b.x + rng.next() * b.w, y: b.y + rng.next() * b.h };
    if (pointInPolygon(p, poly)) return p;
  }
  return centroid(poly);
}

/** Scale a polygon about `origin` (default its centroid). */
export function scalePolygon(pts: readonly Pt[], sx: number, sy = sx, origin = centroid(pts)): Polygon {
  return pts.map((p) => ({ x: origin.x + (p.x - origin.x) * sx, y: origin.y + (p.y - origin.y) * sy }));
}

export function translatePolygon(pts: readonly Pt[], dx: number, dy: number): Polygon {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Total length of an open path. */
export function pathLength(pts: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}

// ---------------------------------------------------------------------------------------------
// organic shapes

export interface BlobOptions {
  /** number of outline vertices (default 28) */
  points?: number;
  /** radial irregularity 0..1 — low-frequency lumpiness (default 0.12) */
  irregularity?: number;
  /** small high-frequency scallops 0..1, e.g. for foliage dabs (default 0) */
  scallop?: number;
  /** scallop count around the outline (default 9) */
  scallops?: number;
  /** rotation in radians (default 0) */
  rotation?: number;
  /** flatten the bottom (0..1) — boulders and pads sit on something (default 0) */
  flatBottom?: number;
}

/**
 * An irregular closed blob around `(cx, cy)` with radii `rx, ry`. The radius is a sum of a few
 * random low harmonics, so the outline is smooth-but-lumpy rather than jagged; pass the result
 * through `deformPolygon` for watercolour edge detail.
 */
export function blob(cx: number, cy: number, rx: number, ry: number, rng: Rng, opts: BlobOptions = {}): Polygon {
  const n = Math.max(6, Math.round(opts.points ?? 28));
  const irr = opts.irregularity ?? 0.12;
  const scallop = opts.scallop ?? 0;
  const scallops = opts.scallops ?? 9;
  const rot = opts.rotation ?? 0;
  const flat = opts.flatBottom ?? 0;
  const harmonics = [2, 3, 4, 5].map((k) => ({ k, a: (irr / Math.sqrt(k)) * rng.range(0.4, 1), ph: rng.range(0, Math.PI * 2) }));
  const scPh = rng.range(0, Math.PI * 2);
  const scJit = Array.from({ length: n }, () => rng.range(0.6, 1.2));
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const out: Polygon = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let r = 1;
    for (const h of harmonics) r += h.a * Math.cos(h.k * th + h.ph);
    if (scallop > 0) r += scallop * 0.18 * Math.abs(Math.sin((scallops * th) / 2 + scPh)) * scJit[i]! - scallop * 0.09;
    let x = Math.cos(th) * rx * r;
    let y = Math.sin(th) * ry * r;
    if (flat > 0 && y > 0) y *= 1 - flat * Math.min(1, (y / ry) * 1.2) * 0.45;
    out.push({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos });
  }
  return out;
}

/** Turn any `Shape` into a polygon (an ellipse spec becomes a gently irregular blob). */
export function toPolygon(shape: Shape, rng: Rng): Polygon {
  if (!isEllipse(shape)) return shape.slice();
  return blob(shape.cx, shape.cy, shape.rx, shape.ry, rng, { rotation: shape.rotation ?? 0, irregularity: 0.08 });
}

/**
 * Boulder silhouette with its base at `(x, y)`: a domed top, a flatter underside, slight lean.
 * `w`, `h` are the overall width and height.
 */
export function stoneShape(x: number, y: number, w: number, h: number, rng: Rng): Polygon {
  const lean = rng.range(-0.12, 0.12);
  const pts = blob(0, 0, w / 2, h / 2, rng, { points: 26, irregularity: 0.1, flatBottom: 0.8 });
  const b = bounds(pts);
  return pts.map((p) => {
    const t = (p.y - b.y) / Math.max(1e-6, b.h); // 0 top .. 1 bottom
    return { x: x + p.x + lean * (1 - t) * w * 0.5, y: y - (b.y + b.h - p.y) * (h / Math.max(1e-6, b.h)) };
  });
}

// ---------------------------------------------------------------------------------------------
// Hobbs-style recursive deformation

/** Cheap approximately normal deviate (Irwin–Hall, n = 3, unit s.d.) — no log/sqrt/cos. */
export function gauss(rng: Rng): number {
  return (rng.next() + rng.next() + rng.next() - 1.5) * 2;
}

export interface DeformOptions {
  /** recursion depth: each level doubles the vertex count (default 3) */
  depth?: number;
  /** displacement s.d. as a fraction of edge length (default 0.35) */
  variance?: number;
  /** variance multiplier per level (default 0.55) */
  decay?: number;
  /** random spread of per-edge variance, 0..1 (default 0.6) — some edges stay crisp, some wander */
  spread?: number;
  /** optional per-vertex variance multiplier (e.g. to make one side of a shape wander more) */
  weight?: (p: Pt, index: number) => number;
  /** absolute cap on the displacement s.d. — stops long edges of thin shapes from spiking */
  cap?: number;
}

/**
 * Recursive midpoint displacement of a closed polygon (after Tyler Hobbs' watercolour
 * technique). Every edge gets its own variance; each level inserts a displaced midpoint and
 * hands a decayed variance to both halves. Deterministic for a given `rng` state.
 */
export function deformPolygon(pts: readonly Pt[], rng: Rng, opts: DeformOptions = {}): Polygon {
  const depth = Math.max(0, Math.round(opts.depth ?? 3));
  const variance = opts.variance ?? 0.35;
  const decay = opts.decay ?? 0.55;
  const spread = opts.spread ?? 0.6;
  const cap = opts.cap ?? Infinity;
  let poly: Pt[] = pts.slice();
  let vars = poly.map((p, i) => variance * (1 - spread / 2 + rng.next() * spread) * (opts.weight ? opts.weight(p, i) : 1));
  for (let d = 0; d < depth; d++) {
    const n = poly.length;
    const next: Pt[] = new Array(n * 2);
    const nextVars: number[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      const v = vars[i]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const t = 0.5 + (rng.next() - 0.5) * 0.28;
      // displacement mostly perpendicular to the edge, a little along it
      const sd = Math.min(len * v, cap);
      const off = gauss(rng) * sd;
      const along = (rng.next() - 0.5) * sd * 0.5;
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;
      const ux = len > 0 ? dx / len : 0;
      const uy = len > 0 ? dy / len : 0;
      next[i * 2] = a;
      next[i * 2 + 1] = { x: a.x + dx * t + nx * off + ux * along, y: a.y + dy * t + ny * off + uy * along };
      const k = decay * (1 - spread / 2 + rng.next() * spread);
      nextVars[i * 2] = v * k;
      nextVars[i * 2 + 1] = v * decay * (1 - spread / 2 + rng.next() * spread);
    }
    poly = next;
    vars = nextVars;
  }
  return poly;
}

/** Chaikin corner cutting on a closed polygon (`iterations` times): rounds off sharp corners. */
export function smoothPolygon(pts: readonly Pt[], iterations = 1): Polygon {
  let poly = pts.slice();
  for (let k = 0; k < iterations; k++) {
    const n = poly.length;
    const out: Pt[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      out[i * 2] = { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 };
      out[i * 2 + 1] = { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 };
    }
    poly = out;
  }
  return poly;
}

/**
 * Move every vertex `d` units inward along its averaged edge normal (a cheap polygon offset,
 * fine for the gently curved outlines the engine makes). Orientation-independent.
 */
export function insetPolygon(pts: readonly Pt[], d: number): Polygon {
  const n = pts.length;
  const sign = area(pts) > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]!;
    const b = pts[(i + 1) % n]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // for clockwise (screen) polygons the inward normal is (-dy, dx)
    return { x: p.x - (dy / len) * d * sign, y: p.y + (dx / len) * d * sign };
  });
}

/** A smooth clip path just inside an outline, so clipped passes never poke past its edge. */
export function innerClip(o: Outline, inset?: number): Polygon {
  const minDim = Math.max(1, Math.min(o.bounds.w, o.bounds.h));
  return insetPolygon(smoothPolygon(o.coarse, 1), inset ?? Math.max(1.5, minDim * 0.03));
}

/** Resample a closed polygon at `spacing` (keeps the loop closed, drops the duplicate end). */
export function closedResample(poly: readonly Pt[], spacing: number): Polygon {
  if (poly.length < 3) return poly.slice();
  const loop = resample([...poly, poly[0]!], spacing);
  loop.pop();
  return loop.length >= 3 ? loop : poly.slice();
}

/**
 * A watercolour outline family. `coarse` is the shape resampled evenly, deformed once and
 * rounded; every wash layer is a fresh recursive deformation of `coarse` (`outlineLayer`), so
 * layers wander apart at mid scale like real overlapping washes, while staying fractal down to
 * `edge` units. `cap` limits displacement relative to the shape's thinnest dimension.
 */
export interface Outline {
  coarse: Polygon;
  /** one representative fine outline (for clipping, sampling, bounds) */
  base: Polygon;
  depth: number;
  cap: number;
  bounds: Rect;
}

export interface OutlineOptions {
  /** coarse deformation (Hobbs variance, default 0.3) */
  deform?: number;
  /** number of coarse vertices around the outline (default 24) */
  detail?: number;
  /** target length of the finest edges, in user units (default ≈ 1.1% of the size, ≥ 1.2) */
  edge?: number;
}

export function organicOutline(poly: readonly Pt[], rng: Rng, opts: OutlineOptions = {}): Outline {
  const b = bounds(poly);
  const size = (b.w + b.h) / 2;
  const minDim = Math.max(1, Math.min(b.w, b.h));
  const perim = pathLength([...poly, poly[0]!]);
  const spacing = Math.max(perim / Math.max(6, opts.detail ?? 24), 0.5);
  const cap = minDim * 0.07 + 0.3;
  const deform = opts.deform ?? 0.3;
  const coarse = smoothPolygon(deformPolygon(closedResample(poly, spacing), rng, { depth: 1, variance: deform, cap }), 1);
  const target = opts.edge ?? Math.max(1.2, size * 0.011);
  const depth = Math.max(0, Math.min(4, Math.ceil(Math.log2(spacing / 3 / target))));
  const o: Outline = { coarse, base: coarse, depth, cap, bounds: b };
  o.base = outlineLayer(o, rng, deform * 0.7);
  o.bounds = bounds(o.base);
  return o;
}

/** A fresh fine deformation of an outline's coarse shape (one wash layer). */
export function outlineLayer(o: Outline, rng: Rng, variance: number): Polygon {
  return smoothPolygon(deformPolygon(o.coarse, rng, { depth: o.depth, variance, decay: 0.7, cap: o.cap }), 2);
}

// ---------------------------------------------------------------------------------------------
// paths and brush outlines

/**
 * Smooth an open path with a Catmull-Rom spline and resample it every `spacing` units.
 * Returns at least the two end points.
 */
export function smoothPath(pts: readonly Pt[], spacing = 3): Pt[] {
  if (pts.length < 2) return pts.slice();
  const dense: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(n - 1, i + 2)]!;
    const seg = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(seg / Math.max(0.5, spacing / 2)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  dense.push(pts[n - 1]!);
  return resample(dense, spacing);
}

/** Resample an open path at (approximately) equal `spacing`, keeping both end points. */
export function resample(pts: readonly Pt[], spacing: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const total = pathLength(pts);
  const count = Math.max(1, Math.round(total / Math.max(1e-6, spacing)));
  const step = total / count;
  const out: Pt[] = [pts[0]!];
  let seg = 1;
  let segStart = 0;
  let segLen = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
  for (let k = 1; k < count; k++) {
    const d = k * step;
    while (seg < pts.length - 1 && segStart + segLen < d) {
      segStart += segLen;
      seg++;
      segLen = Math.hypot(pts[seg]!.x - pts[seg - 1]!.x, pts[seg]!.y - pts[seg - 1]!.y);
    }
    const a = pts[seg - 1]!;
    const b = pts[seg]!;
    const t = segLen > 0 ? (d - segStart) / segLen : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Unit normals of an open path (averaged at interior points). */
export function pathNormals(pts: readonly Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

/**
 * Closed outline of a brush stroke along `path`: `halfWidth(t, i)` gives the half width at
 * normalised arc position `t` (0..1). Left side forward, right side back.
 */
export function ribbon(path: readonly Pt[], halfWidth: (t: number, i: number) => number, offset?: (t: number, i: number) => number): Polygon {
  const n = path.length;
  if (n < 2) return [];
  const normals = pathNormals(path);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = path[i]!;
    const nm = normals[i]!;
    const hw = Math.max(0, halfWidth(t, i));
    const o = offset ? offset(t, i) : 0;
    left.push({ x: p.x + nm.x * (o + hw), y: p.y + nm.y * (o + hw) });
    right.push({ x: p.x + nm.x * (o - hw), y: p.y + nm.y * (o - hw) });
  }
  return [...left, ...right.reverse()];
}

/** Brush dab variants — the basic unit for foliage, petals, grass and needles. */
export type DabVariant = 'leaf' | 'petal' | 'blade' | 'needle' | 'round';

export interface DabGeometry {
  /** direction from base to tip, radians (0 = right, -π/2 = up) */
  angle: number;
  /** base-to-tip length */
  length: number;
  /** maximum width */
  width: number;
  /** bend of the axis, as a fraction of length; sign chooses the side (default 0) */
  curve?: number;
  /** -1..1 — widens one side and narrows the other (default 0) */
  asym?: number;
  variant?: DabVariant;
}

/** Width profile parameters per variant: peak position exponent p and roundness q. */
const PROFILES: Record<DabVariant, { p: number; q: number; tipRound: number }> = {
  leaf: { p: 0.76, q: 0.85, tipRound: 0 },
  petal: { p: 1.6, q: 0.5, tipRound: 0.25 },
  blade: { p: 0.42, q: 1.15, tipRound: 0 },
  needle: { p: 0.5, q: 1.4, tipRound: 0 },
  round: { p: 1, q: 0.38, tipRound: 0.3 },
};

/** Half width of a dab at axis position t (0 base … 1 tip), normalised to a max of 0.5. */
export function dabProfile(variant: DabVariant, t: number): number {
  const { p, q } = PROFILES[variant];
  const tt = Math.min(1, Math.max(0, t));
  return 0.5 * Math.sin(Math.PI * tt ** p) ** q;
}

/**
 * Outline polygon of a tapered, asymmetric brush dab whose base is at `(x, y)`.
 * The axis bends by `curve`; `asym` makes one flank fuller, like a real loaded brush pressed
 * on one side.
 */
export function dabOutline(x: number, y: number, g: DabGeometry, samples = 14): Polygon {
  const variant = g.variant ?? 'leaf';
  const curve = g.curve ?? 0;
  const asym = Math.max(-0.9, Math.min(0.9, g.asym ?? 0));
  const ux = Math.cos(g.angle);
  const uy = Math.sin(g.angle);
  const nx = -uy;
  const ny = ux;
  const axis = (t: number): Pt => {
    const bend = curve * g.length * (t * t * 0.7 + Math.sin(Math.PI * t) * 0.15);
    return { x: x + ux * g.length * t + nx * bend, y: y + uy * g.length * t + ny * bend };
  };
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const c = axis(t);
    const hw = dabProfile(variant, t) * g.width;
    left.push({ x: c.x + nx * hw * (1 + asym), y: c.y + ny * hw * (1 + asym) });
    right.push({ x: c.x - nx * hw * (1 - asym), y: c.y - ny * hw * (1 - asym) });
  }
  const tip = PROFILES[variant].tipRound;
  const out = [...left];
  if (tip > 0) {
    // round the tip a little past the axis end
    const e = axis(1);
    out.push({ x: e.x + ux * g.width * tip * 0.3, y: e.y + uy * g.width * tip * 0.3 });
  }
  out.push(...right.reverse().slice(1, -1));
  return out;
}

/** A half-plane (as a big quad) whose boundary passes through `p` perpendicular to `angle`, covering the side `angle` points to. */
export function halfPlane(p: Pt, angle: number, size: number): Polygon {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const s = size;
  return [
    { x: p.x + nx * s, y: p.y + ny * s },
    { x: p.x + nx * s + ux * s, y: p.y + ny * s + uy * s },
    { x: p.x - nx * s + ux * s, y: p.y - ny * s + uy * s },
    { x: p.x - nx * s, y: p.y - ny * s },
  ];
}

/** Subdivide a polygon's edges so no edge is longer than `maxLen` (keeps deformation even). */
export function densify(pts: readonly Pt[], maxLen: number): Polygon {
  const out: Pt[] = [];
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(len / Math.max(1e-6, maxLen)));
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k });
  }
  return out;
}

/** Projection extent of a polygon on the unit direction `angle`: [min, max]. */
export function extentAlong(pts: readonly Pt[], angle: number): [number, number] {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    const d = p.x * ux + p.y * uy;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}
