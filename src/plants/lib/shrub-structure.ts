/**
 * Pure structure generators for the tier-3 shrubs: branching skeletons, dome scatters and
 * petal projection. Everything here is deterministic for a given `Rng` and independent of
 * growth — species build their whole plant with these first, then paint it by growth.
 *
 * Coordinates are "plant units": world units at slot scale 1, origin at the plant's base,
 * y pointing down (so up is negative).
 */
import type { Rng } from '../../core/rng';
import type { Pigment, Pt } from '../../paint';

// ---------------------------------------------------------------------------------------------
// polylines

/** Length of an open polyline. */
export function polyLength(pts: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return d;
}

/** Point at fraction `f` (0..1) of the arc length of an open polyline. */
export function pointAt(pts: readonly Pt[], f: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1 || f <= 0) return { ...pts[0]! };
  const target = polyLength(pts) * Math.min(1, f);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target && seg > 0) {
      const t = (target - acc) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += seg;
  }
  return { ...pts[pts.length - 1]! };
}

/** Direction (radians) of the polyline at fraction `f`. */
export function angleAt(pts: readonly Pt[], f: number): number {
  const a = pointAt(pts, Math.max(0, f - 0.04));
  const b = pointAt(pts, Math.min(1, f + 0.04));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** The first `f` (0..1) of an open polyline, by arc length (always ≥ 2 points). */
export function partialPath(pts: readonly Pt[], f: number): Pt[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  if (f >= 1) return pts.map((p) => ({ ...p }));
  const total = polyLength(pts);
  const target = total * Math.max(0, f);
  const out: Pt[] = [{ ...pts[0]! }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target) {
      const t = seg > 0 ? (target - acc) / seg : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return out;
    }
    out.push({ ...b });
    acc += seg;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// branching skeleton

export interface Branch {
  /** base → tip, plant units */
  pts: Pt[];
  /** width at the base */
  width: number;
  /** 0 = a stem from the ground, 1 = a side branch, … */
  depth: number;
  /** index of the parent branch (-1 for stems) */
  parent: number;
  /** growth window over which the branch extends from nothing to full length */
  t0: number;
  t1: number;
  /** seed for this branch's own paint stream */
  seed: number;
}

export interface SkeletonOptions {
  /** number of stems from the ground [min, max] */
  stems: [number, number];
  /** typical stem length */
  height: number;
  /** stem length variation (fraction, default 0.25) */
  heightVar?: number;
  /** total fan angle of the stems (radians) */
  spread: number;
  /** whole-plant lean (radians, + = right) */
  lean?: number;
  /** half-width of the stem bases along the ground */
  baseSpread?: number;
  /** branching levels below the stems (default 1) */
  levels?: number;
  /** side branches per branch [min, max] (default [1, 3]) */
  branches?: [number, number];
  /** child length as a fraction of its parent [min, max] (default [0.35, 0.6]) */
  childLength?: [number, number];
  /** child angle away from its parent [min, max] radians (default [0.35, 0.8]) */
  childAngle?: [number, number];
  /** where children sprout along the parent [min, max] (default [0.35, 0.85]) */
  childAt?: [number, number];
  /** axis curvature (radians over the length, default 0.35) */
  bend?: number;
  /** extra upward pull on outer stems: they arc back toward vertical (default 0.3) */
  rise?: number;
  /** stem base width (default 4) */
  width?: number;
  /** growth window of the whole skeleton (default [0.04, 0.45]) */
  window?: [number, number];
  /** fraction of the window one stem takes to grow (default 0.65) */
  stemDuration?: number;
}

function branchPath(rng: Rng, from: Pt, angle: number, length: number, bend: number, rise: number): Pt[] {
  const n = 5;
  const pts: Pt[] = [{ ...from }];
  const side = rng.chance(0.5) ? 1 : -1;
  let a = angle;
  let p = from;
  const step = length / (n - 1);
  for (let k = 1; k < n; k++) {
    // curve gently; outer branches arc back toward the vertical like a real shrub
    const toUp = -Math.PI / 2 - a;
    a += (bend / (n - 1)) * side * rng.range(0.4, 1.2) + toUp * rise * 0.25 + rng.gaussian(0, 0.06);
    p = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step };
    pts.push(p);
  }
  return pts;
}

/**
 * A shrub skeleton: stems fanning from the ground, each with side branches. Each branch
 * starts growing when its parent's tip passes the fork, so the plant extends continuously.
 */
export function growSkeleton(rng: Rng, o: SkeletonOptions): Branch[] {
  const levels = o.levels ?? 1;
  const [w0, w1] = o.window ?? [0.04, 0.45];
  const stemDur = (w1 - w0) * (o.stemDuration ?? 0.65);
  const lean = o.lean ?? 0;
  const hv = o.heightVar ?? 0.25;
  const bend = o.bend ?? 0.35;
  const rise = o.rise ?? 0.3;
  const out: Branch[] = [];
  const nStems = rng.int(o.stems[0], o.stems[1]);
  for (let i = 0; i < nStems; i++) {
    const u = nStems === 1 ? 0 : i / (nStems - 1) - 0.5;
    const angle = -Math.PI / 2 + lean + u * o.spread + rng.gaussian(0, o.spread * 0.06);
    const centre = 1 - Math.abs(u) * 0.6; // central stems tallest
    const length = o.height * centre * (1 + rng.range(-hv, hv));
    const base = { x: u * 2 * (o.baseSpread ?? 4) + rng.gaussian(0, 1), y: 0 };
    const t0 = w0 + rng.range(0, (w1 - w0 - stemDur) * 0.5);
    out.push({
      pts: branchPath(rng, base, angle, length, bend, rise),
      width: (o.width ?? 4) * rng.range(0.8, 1.15) * (0.75 + centre * 0.25),
      depth: 0,
      parent: -1,
      t0,
      t1: t0 + stemDur,
      seed: rng.int(1, 0x7fffffff),
    });
  }
  let frontier = out.map((_, i) => i);
  for (let level = 1; level <= levels; level++) {
    const next: number[] = [];
    for (const pi of frontier) {
      const parent = out[pi]!;
      const plen = polyLength(parent.pts);
      const nb = rng.int((o.branches ?? [1, 3])[0], (o.branches ?? [1, 3])[1]);
      for (let k = 0; k < nb; k++) {
        const [a0, a1] = o.childAt ?? [0.35, 0.85];
        const at = a0 + ((k + rng.range(0.2, 0.8)) / nb) * (a1 - a0);
        const from = pointAt(parent.pts, at);
        const pa = angleAt(parent.pts, at);
        const side = (k % 2 === 0 ? 1 : -1) * (rng.chance(0.2) ? -1 : 1);
        const [ca0, ca1] = o.childAngle ?? [0.35, 0.8];
        const angle = pa + side * rng.range(ca0, ca1);
        const [cl0, cl1] = o.childLength ?? [0.35, 0.6];
        const length = plen * (1 - at * 0.4) * rng.range(cl0, cl1);
        const t0 = parent.t0 + at * (parent.t1 - parent.t0);
        const dur = (parent.t1 - parent.t0) * Math.max(0.35, length / plen) * 1.1;
        out.push({
          pts: branchPath(rng, from, angle, length, bend * 0.8, rise),
          width: parent.width * (1 - at * 0.5) * 0.6,
          depth: level,
          parent: pi,
          t0,
          t1: Math.min(w1, t0 + dur),
          seed: rng.int(1, 0x7fffffff),
        });
        next.push(out.length - 1);
      }
    }
    frontier = next;
  }
  return out;
}

/** Branches with no children (where flowers and leaf tufts sit). */
export function terminalBranches(branches: readonly Branch[]): Branch[] {
  const hasChild = new Set(branches.map((b) => b.parent));
  return branches.filter((_, i) => !hasChild.has(i));
}

// ---------------------------------------------------------------------------------------------
// dome scatter

export interface DomePoint {
  x: number;
  y: number;
  /** 0 = back of the mound … 1 = front (paint back to front) */
  z: number;
  /** -1 shadow side … 1 lit side (light from the upper left) */
  lit: number;
  /** distance from the dome centre, 0 centre … 1 rim */
  rim: number;
}

export interface DomeOptions {
  /** half-width of the dome */
  rx: number;
  /** height of the dome above the base */
  ry: number;
  /** centre offset (default 0) */
  cx?: number;
  /** minimum distance between points (default from area / count) */
  spacing?: number;
  /** lowest point as a fraction of the height above the base (default 0.12) */
  floor?: number;
  /** how far points may sit outside the dome edge (fraction, default 0) */
  overhang?: number;
}

/**
 * Up to `n` points spread over the visible face of a dome (half ellipse sitting on the ground),
 * kept apart by a minimum spacing so blooms do not pile up. Sorted back to front.
 */
export function domeScatter(rng: Rng, n: number, o: DomeOptions): DomePoint[] {
  const cx = o.cx ?? 0;
  const floor = o.floor ?? 0.12;
  const over = 1 + (o.overhang ?? 0);
  const area = (Math.PI * o.rx * o.ry) / 2;
  const spacing = o.spacing ?? Math.sqrt(area / Math.max(1, n)) * 0.75;
  const out: DomePoint[] = [];
  let tries = 0;
  while (out.length < n && tries < n * 40) {
    tries++;
    const ux = rng.range(-1, 1);
    const uy = rng.range(floor, 1);
    if (ux * ux + uy * uy > over * over) continue;
    const x = cx + ux * o.rx;
    const y = -uy * o.ry;
    if (out.some((q) => Math.hypot(q.x - x, q.y - y) < spacing)) continue;
    const rim = Math.min(1, Math.hypot(ux, uy));
    // points low on the dome face the viewer (front); high ones are on top/back
    const z = Math.max(0, Math.min(1, 1 - uy * 0.7 - (1 - Math.abs(ux)) * 0.1 + rng.range(-0.1, 0.1)));
    const lit = Math.max(-1, Math.min(1, -ux * 0.6 + uy * 0.6 - 0.1));
    out.push({ x, y, z, lit, rim });
  }
  return out.sort((a, b) => a.z - b.z);
}

// ---------------------------------------------------------------------------------------------
// petal projection

/**
 * Screen-space vector of a petal on a flower whose face is tipped toward the viewer.
 *
 * `around` is the petal's angle around the flower axis, `open` its angle away from the axis
 * (0 = closed upright bud, π/2 = flat open), `view` the viewer's elevation above the flower's
 * plane (π/2 = looking straight down the axis), `roll` tilts the whole flower sideways.
 * Returns the screen angle and the foreshortening of the petal's length (0..1).
 */
export function petalVector(around: number, open: number, view: number, roll = 0): { angle: number; scale: number; front: number } {
  // petal direction in flower space: z is the flower axis (up)
  const dx = Math.cos(around) * Math.sin(open);
  const dy = Math.sin(around) * Math.sin(open); // + = toward the viewer
  const dz = Math.cos(open);
  // project: screen y grows downward; the axis points up the screen by cos(view)
  let sx = dx;
  let sy = -dz * Math.cos(view) + dy * Math.sin(view);
  if (roll !== 0) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const rx = sx * c - sy * s;
    sy = sx * s + sy * c;
    sx = rx;
  }
  const scale = Math.hypot(sx, sy);
  // depth toward the viewer: + front, − back
  const front = dy * Math.cos(view) + dz * Math.sin(view) * 0.2;
  return { angle: Math.atan2(sy, sx), scale, front };
}

// ---------------------------------------------------------------------------------------------
// foliage elements

export interface Clump {
  x: number;
  y: number;
  r: number;
  t0: number;
  t1: number;
  seed: number;
  /** 0 = back … 1 = front */
  z?: number;
}

export interface Leaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  /** width as a fraction of length (default 0.42) */
  width?: number;
  curve?: number;
  pigment: Pigment;
  t0: number;
  t1: number;
  seed: number;
  /** batch: leaves sharing a group are painted into one wet layer */
  group?: number;
  /** 0 = back … 1 = front */
  z?: number;
}


/** Growth window helper: a window of `len` starting at `t0`. */
const win = (t0: number, len: number): [number, number] => [t0, t0 + len];

export interface SprayOptions {
  /** leaflets per spray [min, max] (default [3, 3]) */
  leaflets?: [number, number];
  /** lobes per leaflet [min, max] (default [1, 1]) */
  lobes?: [number, number];
  /** fan angle between leaflets (radians, default 0.65) */
  fan?: number;
  /** leaf width as a fraction of length (default 0.42) */
  width?: number;
  /** bend magnitude (default 0.18) */
  curve?: number;
  /** growth window length of one spray (default 0.13) */
  duration?: number;
  /** stalk length before the leaflets, as a fraction of size (default 0) */
  petiole?: number;
}

/**
 * One leaf spray: a few leaflets fanning from a point (a peony's compound leaf, a cluster of
 * camellia leaves at a twig tip). Pure; consumes `rng` in a fixed order.
 */
export function leafSpray(rng: Rng, at: Pt, dir: number, size: number, pigment: Pigment, t0: number, o: SprayOptions = {}): Leaf[] {
  const [l0, l1] = o.leaflets ?? [3, 3];
  const [b0, b1] = o.lobes ?? [1, 1];
  const fan = o.fan ?? 0.65;
  const n = rng.int(l0, l1);
  const out: Leaf[] = [];
  const [s0, s1] = win(t0, o.duration ?? 0.13);
  // leaflets sit at the end of a short stalk (petiole): side ones pair off, the last points on
  const stalk = size * (o.petiole ?? 0);
  const node = { x: at.x + Math.cos(dir) * stalk, y: at.y + Math.sin(dir) * stalk };
  for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : k / (n - 1) - 0.5;
    const a = dir + u * fan * (n - 1) * rng.range(0.8, 1.15) + rng.gaussian(0, 0.08);
    const len = size * (1 - Math.abs(u) * 0.4) * rng.range(0.88, 1.1);
    const lobes = rng.int(b0, b1);
    const lobeFan = rng.range(0.45, 0.7);
    for (let l = 0; l < lobes; l++) {
      const lu = lobes === 1 ? 0 : l / (lobes - 1) - 0.5;
      // lobes split part-way along the leaflet, not at its base
      const split = lobes === 1 ? 0 : len * 0.22;
      out.push({
        x: node.x + Math.cos(a) * (size * 0.05 + split),
        y: node.y + Math.sin(a) * (size * 0.05 + split),
        angle: a + lu * lobeFan * 1.4 + rng.gaussian(0, 0.06),
        length: (len - split) * (1 - Math.abs(lu) * 0.35),
        width: o.width ?? 0.42,
        curve: rng.range(-1, 1) * (o.curve ?? 0.18),
        pigment,
        // leaflets unfold one after another
        t0: s0 + (s1 - s0) * 0.25 * (k / Math.max(1, n)),
        t1: s1,
        seed: rng.int(1, 0x7fffffff),
      });
    }
  }
  return out;
}

export interface DomeLeavesOptions extends DomeOptions, SprayOptions {
  /** number of sprays */
  sprays: number;
  /** spray size [min, max] */
  size: [number, number];
  /** growth window: the lowest sprays start at window[0], the top ones by window[1] − duration */
  window: [number, number];
  /** pigments for lit, middle and shadowed sprays */
  pigments: { light: Pigment; mid: Pigment; shadow: Pigment };
  /** picks a slightly varied pigment (pure colour maths, injected to keep this module light) */
  vary?: (p: Pigment, rng: Rng) => Pigment;
}

/** Leaf sprays covering a dome, radiating from its heart; the lowest unfold first. */
export function domeLeaves(rng: Rng, o: DomeLeavesOptions): Leaf[] {
  const pts = domeScatter(rng, o.sprays, o);
  const out: Leaf[] = [];
  const dur = o.duration ?? 0.13;
  const heart = { x: o.cx ?? 0, y: -o.ry * 0.35 };
  for (const q of pts) {
    const h = Math.min(1, -q.y / o.ry);
    const reach = Math.max(h, Math.abs(q.x - (o.cx ?? 0)) / o.rx);
    const t0 = o.window[0] + (o.window[1] - dur - o.window[0]) * Math.min(1, reach * 0.85 + rng.range(0, 0.15));
    const dir = Math.atan2(q.y - heart.y, q.x - heart.x) + rng.gaussian(0, 0.35);
    const base = q.lit > 0.25 ? o.pigments.light : q.lit < -0.25 ? o.pigments.shadow : o.pigments.mid;
    const pig = o.vary ? o.vary(base, rng) : base;
    const leaves = leafSpray(rng, q, dir, rng.range(o.size[0], o.size[1]), pig, t0, o);
    for (const l of leaves) out.push({ ...l, z: q.z });
  }
  return out;
}

/**
 * Re-time growing elements so they fill in from the heart of the plant outward and upward:
 * an element's window starts once the stems could have reached it (its "reach", the larger of
 * its relative height and relative distance from the centre). Mutates and returns `items`.
 */
export function growOutward<T extends { x: number; y: number; t0: number; t1: number }>(
  items: T[],
  o: { cx: number; rx: number; ry: number; window: [number, number]; len: number },
): T[] {
  for (const it of items) {
    const reach = Math.min(1, Math.max(-it.y / o.ry, Math.abs(it.x - o.cx) / o.rx));
    it.t0 = o.window[0] + (o.window[1] - o.len - o.window[0]) * reach;
    it.t1 = it.t0 + o.len;
  }
  return items;
}
