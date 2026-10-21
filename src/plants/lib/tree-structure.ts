/**
 * Tree structure generator (pure, deterministic): the whole branching skeleton of a tree is
 * built up front from a seeded `Rng`, consuming random numbers in a fixed order that never
 * depends on `growth`. Rendering then reveals that one skeleton progressively, so the same seed
 * reads as one tree growing continuously from sapling to full size.
 *
 * Every branch carries a growth window `[t0, t1]` in *structure time* τ (0..1): a child starts
 * once its parent's growth front has passed the point it is attached to, so branches unfurl
 * outward in order. See docs/systems/plants-species-c.md.
 */
import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';

export interface Branch {
  id: number;
  /** parent branch id, -1 for a trunk */
  parent: number;
  /** 0 = trunk, 1 = scaffold limb, 2 = branch, … */
  order: number;
  /** centreline, base → tip, in species units */
  pts: Pt[];
  /** cumulative arc length at each point (cum[0] = 0) */
  cum: number[];
  /** total arc length */
  len: number;
  /** full-grown width at the base and at the tip */
  w0: number;
  w1: number;
  /** where along the parent it is attached (0..1 of the parent's length) */
  attach: number;
  /** growth window in structure time (0..1) */
  t0: number;
  t1: number;
  /** free-form marker for species code ('whip', 'sprout', 'beam', …) */
  tag: string;
  /** stable per-branch random phase (wobble, texture) */
  phase: number;
}

export interface Tree {
  /** base of the (first) trunk */
  base: Pt;
  branches: Branch[];
}

export interface LimbOptions {
  /** polyline segments (default 6) */
  segments?: number;
  /** gaussian heading noise per segment, radians (default 0.12) */
  wander?: number;
  /** per-segment steer toward straight down (> 0, droop) or straight up (< 0), 0..1 (default 0) */
  gravity?: number;
  /** constant heading change per segment, radians (default 0) */
  curl?: number;
  /** zigzag kinks per segment, radians (angular plum-like branches; default 0) */
  kink?: number;
  /** per-segment length variation, 0..1 (default 0.25) */
  lengthJitter?: number;
  /** stop the limb where it would dip below this y (randomness is still consumed) */
  floor?: number;
}

const TAU = Math.PI * 2;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

/** Wrap an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  let x = a % TAU;
  if (x <= -Math.PI) x += TAU;
  if (x > Math.PI) x -= TAU;
  return x;
}

/** Rotate heading `a` toward `target` by fraction `k` of the (shortest) angular gap. */
export function steer(a: number, target: number, k: number): number {
  return a + wrapAngle(target - a) * k;
}

/**
 * A wandering limb: `segments` straight pieces whose heading drifts with noise, curl, kinks and
 * gravity. Always consumes the same amount of randomness for a given segment count.
 */
export function growLimb(rng: Rng, start: Pt, angle: number, length: number, o: LimbOptions = {}): Pt[] {
  const n = Math.max(1, Math.round(o.segments ?? 6));
  const wander = o.wander ?? 0.12;
  const gravity = o.gravity ?? 0;
  const curl = o.curl ?? 0;
  const kink = o.kink ?? 0;
  const lj = o.lengthJitter ?? 0.25;
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const s = 1 + rng.range(-lj, lj);
    seg.push(s);
    total += s;
  }
  const pts: Pt[] = [{ x: start.x, y: start.y }];
  let a = angle;
  let p = start;
  let kinkSide = rng.chance(0.5) ? 1 : -1;
  let stopped = false;
  for (let i = 0; i < n; i++) {
    const g = rng.gaussian(0, 1);
    const kr = rng.range(0.4, 1);
    if (i > 0) {
      a += g * wander + curl;
      if (kink > 0) {
        a += kinkSide * kink * kr;
        kinkSide = -kinkSide;
      }
      if (gravity !== 0) a = steer(a, gravity > 0 ? DOWN : UP, Math.min(1, Math.abs(gravity)));
    }
    const d = (seg[i]! / total) * length;
    p = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
    if (stopped) continue;
    if (o.floor !== undefined && p.y > o.floor && pts.length >= 2) {
      stopped = true;
      continue;
    }
    pts.push(p);
  }
  return pts;
}

function cumulative(pts: readonly Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return cum;
}

/** Point at fraction `f` (0..1) of a branch's arc length. */
export function pointAt(b: Pick<Branch, 'pts' | 'cum' | 'len'>, f: number): Pt {
  const d = Math.max(0, Math.min(1, f)) * b.len;
  for (let i = 1; i < b.pts.length; i++) {
    if (b.cum[i]! >= d || i === b.pts.length - 1) {
      const a = b.pts[i - 1]!;
      const c = b.pts[i]!;
      const sl = b.cum[i]! - b.cum[i - 1]!;
      const t = sl > 0 ? Math.min(1, (d - b.cum[i - 1]!) / sl) : 0;
      return { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t };
    }
  }
  return { ...b.pts[0]! };
}

/** Heading (radians) at fraction `f` of a branch. */
export function headingAt(b: Pick<Branch, 'pts' | 'cum' | 'len'>, f: number): number {
  const d = Math.max(0, Math.min(1, f)) * b.len;
  let i = 1;
  while (i < b.pts.length - 1 && b.cum[i]! < d) i++;
  const a = b.pts[i - 1]!;
  const c = b.pts[i]!;
  return Math.atan2(c.y - a.y, c.x - a.x);
}

/** Full-grown width at fraction `f` of a branch (gentle pipe-model taper). */
export function widthAt(b: Pick<Branch, 'w0' | 'w1'>, f: number): number {
  const t = Math.max(0, Math.min(1, f));
  return b.w0 + (b.w1 - b.w0) * t ** 0.8;
}

/** The part of a branch's centreline from its base to fraction `f` (at least 2 points). */
export function partialPath(b: Pick<Branch, 'pts' | 'cum' | 'len'>, f: number): Pt[] {
  if (f >= 1) return b.pts.slice();
  const d = Math.max(0, f) * b.len;
  const out: Pt[] = [b.pts[0]!];
  for (let i = 1; i < b.pts.length; i++) {
    if (b.cum[i]! < d) out.push(b.pts[i]!);
    else break;
  }
  out.push(pointAt(b, f));
  return out;
}

export interface NewBranch {
  pts: Pt[];
  w0: number;
  w1: number;
  attach?: number;
  t0: number;
  t1: number;
  tag?: string;
}

/** Append a branch (computes arc lengths, ids and a stable phase). */
export function addBranch(tree: Tree, parent: number, order: number, nb: NewBranch, rng: Rng): Branch {
  const cum = cumulative(nb.pts);
  const b: Branch = {
    id: tree.branches.length,
    parent,
    order,
    pts: nb.pts,
    cum,
    len: cum[cum.length - 1]!,
    w0: nb.w0,
    w1: nb.w1,
    attach: nb.attach ?? 0,
    t0: nb.t0,
    t1: nb.t1,
    tag: nb.tag ?? '',
    phase: rng.range(0, 1000),
  };
  tree.branches.push(b);
  return b;
}

export interface LevelSpec {
  /** children per parent, inclusive range */
  count: [number, number];
  /** attach range along the parent (fractions) */
  span: [number, number];
  /** divergence from the parent heading, magnitude range (radians) */
  angle: [number, number];
  /** child length as a fraction of the parent's length */
  length: [number, number];
  /** children near the parent's tip are shorter: length × (1 − shrink × attach) (default 0.35) */
  shrink?: number;
  limb?: LimbOptions;
  /** base width relative to the parent's width at the attach point (default 0.7) */
  width?: number;
  /** tip width as a fraction of the base (default 0.25) */
  tipWidth?: number;
  /** absolute minimum tip width (default 0.45) */
  minTip?: number;
  /** side choice: alternate (default), random, or outward (away from the tree's axis) */
  side?: 'alternate' | 'random' | 'outward';
  /** blend the start heading toward straight up, 0..1 (default 0) */
  up?: number;
  /** blend the start heading toward horizontal-outward, 0..1 (default 0) */
  level?: number;
  /** growth duration relative to the parent's (default 0.8) */
  dur?: number;
  /** extra structure-time delay after the growth front passes the attach point (default 0.02) */
  lag?: number;
  tag?: string;
  /** clamp the start heading to a range (radians, e.g. keep shoots pointing upward) */
  clampHeading?: [number, number];
}

/**
 * Grow `levels[0]` children on `parent`, then recursively `levels[1]` on each of those, etc.
 * Children are attached spread evenly-with-jitter across `span`, alternating sides.
 */
export function growChildren(tree: Tree, parent: Branch, levels: readonly LevelSpec[], rng: Rng, axisX = tree.base.x): void {
  const spec = levels[0];
  if (!spec) return;
  const n = rng.int(spec.count[0], spec.count[1]);
  let side = rng.chance(0.5) ? 1 : -1;
  const children: Branch[] = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? rng.range(0, 1) : (i + rng.range(0.15, 0.85)) / n;
    const attach = spec.span[0] + (spec.span[1] - spec.span[0]) * u;
    const at = pointAt(parent, attach);
    const ph = headingAt(parent, attach);
    const mag = rng.range(spec.angle[0], spec.angle[1]);
    const rnd = rng.chance(0.5) ? 1 : -1;
    const outward = at.x + rng.range(-4, 4) >= axisX ? 1 : -1;
    // heading's x-direction for side s is roughly s·sin(…); choose s so the child goes outward
    const sideFor = (s: number) => Math.cos(ph + s * mag);
    let s = side;
    if (spec.side === 'random') s = rnd;
    else if (spec.side === 'outward') s = Math.sign(sideFor(1)) === outward ? 1 : -1;
    side = -side;
    let a = ph + s * mag;
    if (spec.up) a = steer(a, UP, spec.up);
    if (spec.level) a = steer(a, Math.cos(a) >= 0 ? 0 : Math.PI, spec.level);
    if (spec.clampHeading) a = Math.max(spec.clampHeading[0], Math.min(spec.clampHeading[1], wrapAngle(a)));
    const lenK = rng.range(spec.length[0], spec.length[1]) * (1 - (spec.shrink ?? 0.35) * attach);
    const len = parent.len * lenK;
    const pts = growLimb(rng, at, a, len, spec.limb);
    const w0 = Math.max(spec.minTip ?? 0.45, widthAt(parent, attach) * (spec.width ?? 0.7));
    const w1 = Math.max(spec.minTip ?? 0.45, w0 * (spec.tipWidth ?? 0.25));
    const pd = parent.t1 - parent.t0;
    const t0 = parent.t0 + pd * attach + (spec.lag ?? 0.02);
    const t1 = t0 + pd * (spec.dur ?? 0.8) * Math.sqrt(Math.max(0.05, lenK));
    children.push(addBranch(tree, parent.id, parent.order + 1, { pts, w0, w1, attach, t0, t1, tag: spec.tag }, rng));
  }
  for (const c of children) growChildren(tree, c, levels.slice(1), rng, axisX);
}

export interface TrunkSpec {
  angle: number;
  length: number;
  width: number;
  /** tip width (absolute) */
  tipWidth: number;
  limb?: LimbOptions;
  /** structure-time duration of the trunk before normalisation (default 1) */
  dur?: number;
  tag?: string;
}

/** Start a tree: one trunk at `base`. Grow children with `growChildren`, then `normalise`. */
export function startTree(rng: Rng, base: Pt, trunk: TrunkSpec): Tree {
  const tree: Tree = { base: { ...base }, branches: [] };
  addTrunk(tree, rng, base, trunk);
  return tree;
}

/** Add another trunk (multi-stem trees) — starts at structure time `t0`. */
export function addTrunk(tree: Tree, rng: Rng, base: Pt, trunk: TrunkSpec, t0 = 0): Branch {
  const pts = growLimb(rng, base, trunk.angle, trunk.length, trunk.limb);
  return addBranch(tree, -1, 0, { pts, w0: trunk.width, w1: trunk.tipWidth, t0, t1: t0 + (trunk.dur ?? 1), tag: trunk.tag ?? 'trunk' }, rng);
}

/** Rescale all growth windows so the last branch finishes at τ = 1. */
export function normalise(tree: Tree): Tree {
  const end = tree.branches.reduce((m, b) => Math.max(m, b.t1), 0) || 1;
  for (const b of tree.branches) {
    b.t0 /= end;
    b.t1 /= end;
  }
  return tree;
}

/** Bounding box of every branch point. */
export function treeBounds(tree: Tree): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of tree.branches)
    for (const p of b.pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Fit a tree inside a box (species units): uniformly scale about the base if any point falls
 * outside `[margin, w − margin] × [margin, …]`, so seeds with long limbs never clip the sprite.
 */
export function fitTree(tree: Tree, box: { w: number; h: number }, margin: number, extra = 0): Tree {
  const b = treeBounds(tree);
  const bx = tree.base.x;
  const by = tree.base.y;
  let k = 1;
  const lim = (d: number, room: number) => (d > room && d > 0 ? room / d : 1);
  k = Math.min(k, lim(bx - (b.x - extra), bx - margin));
  k = Math.min(k, lim(b.x + b.w + extra - bx, box.w - margin - bx));
  k = Math.min(k, lim(by - (b.y - extra), by - margin));
  if (k >= 1) return tree;
  for (const br of tree.branches) {
    br.pts = br.pts.map((p) => ({ x: bx + (p.x - bx) * k, y: by + (p.y - by) * k }));
    br.cum = cumulative(br.pts);
    br.len = br.cum[br.cum.length - 1]!;
    br.w0 *= Math.sqrt(k);
    br.w1 *= Math.sqrt(k);
  }
  return tree;
}

/** Descendant ids of a branch (excluding itself). */
export function descendants(tree: Tree, id: number): number[] {
  const out: number[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const b of tree.branches)
      if (b.parent === cur) {
        out.push(b.id);
        stack.push(b.id);
      }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// growth → view

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** smoothstep of `x` between `a` and `b` */
export const ramp = (x: number, a: number, b: number) => smooth((x - a) / (b - a || 1e-6));

/**
 * Staggered arrival: element with delay `d` (0..1) ramps in over `width`, all of them between
 * `start` and `end`.
 */
export function stagger(g: number, start: number, end: number, d: number, width: number): number {
  const a = start + clamp01(d) * Math.max(0, end - start - width);
  return ramp(g, a, a + width);
}

/** How a growth value maps onto the skeleton (see docs: phase table). */
export interface TreeView {
  growth: number;
  /** structure time τ: which branches are visible and how far they reach */
  tau: number;
  /** overall size about the base (sapling → full tree) */
  scale: number;
  /** extra width factor (trunks thicken as the tree ages) */
  thick: number;
  base: Pt;
}

export interface GrowthTiming {
  /** growth at which the skeleton is complete (default 0.5) */
  structureEnd?: number;
  /** size at growth 0 (default 0.32) */
  minScale?: number;
}

/**
 * Map growth to the skeleton view. 0–0.1: a sapling shoot; 0.1–`structureEnd`: branches
 * extend in order; afterwards the skeleton is complete (foliage and blossom are the species'
 * job). All smooth in `g`.
 */
export function treeView(g: number, base: Pt, timing: GrowthTiming = {}): TreeView {
  const end = timing.structureEnd ?? 0.5;
  const min = timing.minScale ?? 0.32;
  const x = clamp01((g - 0.015) / (end - 0.015));
  const tau = 1 - (1 - x) ** 1.35;
  const scale = min + (1 - min) * smooth(clamp01(g / (end + 0.08)));
  const thick = 0.45 + 0.55 * smooth(clamp01((g - 0.02) / (end + 0.2)));
  return { growth: g, tau, scale, thick, base };
}

/** Visible fraction of a branch at structure time τ (eased). */
export function branchProgress(b: Pick<Branch, 't0' | 't1'>, tau: number): number {
  if (tau <= b.t0) return 0;
  if (tau >= b.t1) return 1;
  const x = (tau - b.t0) / (b.t1 - b.t0);
  return 1 - (1 - x) ** 1.6;
}

/** Map a skeleton point into the current view (scaled about the base). */
export function viewPt(v: Pick<TreeView, 'base' | 'scale'>, p: Pt): Pt {
  return { x: v.base.x + (p.x - v.base.x) * v.scale, y: v.base.y + (p.y - v.base.y) * v.scale };
}
