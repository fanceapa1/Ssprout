import { createRng } from '../core/rng';

/**
 * The guiding path's geometry (ADR 0202), pure so it is tested on its own and drawn the same in
 * the page and the studio. The path leaves the garden where the stepping stones run out of the
 * painting, crosses the empty band above the first heading to the lane on the left of the dock's
 * content edge, then walks down the lane from stop to stop — one stop beside each section
 * heading, in order — and lifts off after the last one. Below the first heading it never leaves
 * the lane, so it cannot cross text; above it, it only crosses the dock's empty top margin.
 *
 * Units are CSS pixels in the path layer's own coordinates (its origin is the layer's top left).
 */
export interface Pt {
  x: number;
  y: number;
}

export interface PathPlan {
  /** where the line leaves the stones */
  start: Pt;
  /** the lane's centre (stops sit on it) */
  lane: number;
  /** the content's left edge: below `clearTop` nothing of the line goes right of `lane + sway` */
  contentLeft: number;
  /** the top of the first heading: the crossing to the lane is done above it */
  clearTop: number;
  /** each stop's height (a heading's centre), in page order */
  stops: { id: string; y: number }[];
  /** how far below the last stop the brush lifts off */
  tail: number;
  /** sideways drift allowed in the lane (px, each way) */
  sway: number;
  seed: number | string;
}

export interface PathPoint extends Pt {
  /** arc length from the start */
  s: number;
}

export interface PathLayout {
  /** the centre line, resampled every `STEP` px of arc length */
  points: PathPoint[];
  /** the stops, on the line, with their arc position */
  stops: { id: string; x: number; y: number; s: number }[];
  length: number;
}

const STEP = 4;
/** the crossing reaches the lane this far above the first heading's text */
export const CLEARANCE = 16;

type Cubic = [Pt, Pt, Pt, Pt];

function cubicAt([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return { x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y };
}

/** A soft S from `a` to `b` that leaves and arrives travelling straight down. */
function vertical(a: Pt, b: Pt, k = 0.5): Cubic {
  const dy = Math.max(1, b.y - a.y);
  return [a, { x: a.x, y: a.y + dy * k }, { x: b.x, y: b.y - dy * k }, b];
}

/** The path's centre line and stops. Pure. */
export function layoutPath(plan: PathPlan): PathLayout {
  const rng = createRng(`wayfinding:${plan.seed}`);
  const sway = Math.max(0, plan.sway);
  const lane = plan.lane;
  const first = plan.stops[0];
  const segs: Cubic[] = [];
  // never start right of the page's content or below the crossing band
  const reach: Pt = { x: lane, y: Math.min(plan.clearTop - CLEARANCE, first ? first.y - CLEARANCE : plan.clearTop) };
  const start: Pt = { x: Math.max(lane, plan.start.x), y: Math.min(plan.start.y, reach.y - 24) };
  // 1 · the crossing: from the stones over the empty top margin to the lane, arriving straight down
  segs.push(vertical(start, reach, 0.62));
  let at = reach;
  const stops: { id: string; x: number; y: number }[] = [];
  let side = rng.next() < 0.5 ? -1 : 1;
  for (const st of plan.stops) {
    const to: Pt = { x: lane, y: Math.max(at.y + 1, st.y) };
    const dy = to.y - at.y;
    if (dy > 140 && sway > 0) {
      // a long way between two headings: the line meanders once inside the lane
      const m: Pt = { x: lane + side * sway * rng.range(0.55, 1), y: at.y + dy * rng.range(0.42, 0.58) };
      segs.push(vertical(at, m, 0.45), vertical(m, to, 0.45));
      side = -side;
    } else {
      segs.push(vertical(at, to, 0.45));
    }
    stops.push({ id: st.id, x: to.x, y: to.y });
    at = to;
  }
  // 2 · the tail: the brush drifts a little and lifts off
  const tail = Math.max(0, plan.tail);
  if (tail > 0) segs.push(vertical(at, { x: lane + side * sway * 0.5, y: at.y + tail }, 0.5));

  // sample finely, then resample by arc length
  const raw: Pt[] = [];
  for (const c of segs) {
    const n = Math.max(8, Math.ceil(Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y) / 2));
    for (let i = raw.length === 0 ? 0 : 1; i <= n; i++) raw.push(cubicAt(c, i / n));
  }
  const points: PathPoint[] = [];
  let s = 0;
  let next = 0;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i]!;
    if (i > 0) {
      const q = raw[i - 1]!;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      while (next <= s + d && d > 0) {
        const t = (next - s) / d;
        points.push({ x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t, s: next });
        next += STEP;
      }
      s += d;
    } else {
      points.push({ ...p, s: 0 });
      next = STEP;
    }
  }
  const last = raw[raw.length - 1];
  if (last && (points.length === 0 || points[points.length - 1]!.s < s)) points.push({ ...last, s });
  // the stops' arc positions: the nearest sample at their height
  const withS = stops.map((st) => {
    let best = points[0]!;
    for (const p of points) if (Math.abs(p.y - st.y) + Math.abs(p.x - st.x) < Math.abs(best.y - st.y) + Math.abs(best.x - st.x)) best = p;
    return { ...st, s: best.s };
  });
  return { points, stops: withS, length: s };
}

export interface BrushOptions {
  /** the stroke's widest (px) */
  width: number;
  /** the line stops short of each stop by this radius (it steps from stone to stone) */
  stopRadius: number;
  /** the line emerges from the garden over this length */
  fadeIn: number;
  /** and lifts off over this length */
  liftOff: number;
  seed: number | string;
}

/**
 * The brush line as filled outlines (one SVG subpath per run between stones): it emerges thin
 * from the garden, swells and thins with the brush's pressure, breaks once or twice where the
 * brush ran dry on a long stretch, stops short of each stone and lifts off at the end. Pure.
 */
export function brushOutline(layout: PathLayout, o: BrushOptions): string {
  const pts = layout.points;
  if (pts.length < 2) return '';
  const rng = createRng(`wayfinding-brush:${o.seed}`);
  const L = layout.length;
  // pressure: two slow waves and a little grain, seeded
  const f1 = rng.range(0.004, 0.007);
  const f2 = rng.range(0.011, 0.017);
  const p1 = rng.range(0, Math.PI * 2);
  const p2 = rng.range(0, Math.PI * 2);
  const pressure = (s: number) => 0.84 + 0.12 * Math.sin(s * f1 + p1) + 0.06 * Math.sin(s * f2 + p2);
  // dry breaks: on stretches longer than 260 px between stones, one short gap, seeded
  const cuts: Array<[number, number]> = layout.stops.map((st) => [st.s - o.stopRadius, st.s + o.stopRadius]);
  const marks = [0, ...layout.stops.map((st) => st.s), L];
  for (let i = 0; i + 1 < marks.length; i++) {
    const a = marks[i]! + o.stopRadius + 40;
    const b = marks[i + 1]! - o.stopRadius - 40;
    if (b - a > 260 && i > 0) {
      const at = rng.range(a, b);
      cuts.push([at, at + rng.range(5, 8)]);
    }
  }
  const inCut = (s: number) => cuts.some(([a, b]) => s > a && s < b);
  const edgeOf = (s: number) => {
    let d = Infinity;
    for (const [a, b] of cuts) d = Math.min(d, Math.abs(s - a), Math.abs(s - b));
    return d;
  };
  const widthAt = (s: number) => {
    const emerge = Math.min(1, 0.12 + (0.88 * s) / Math.max(1, o.fadeIn));
    const lift = Math.min(1, (L - s) / Math.max(1, o.liftOff));
    const meet = Math.min(1, 0.35 + edgeOf(s) / 14); // the line thins where it meets a stone or a break
    return o.width * pressure(s) * emerge * Math.max(0, lift) * meet;
  };
  // runs of points outside the cuts
  const runs: PathPoint[][] = [];
  let run: PathPoint[] = [];
  for (const p of pts) {
    if (inCut(p.s)) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length > 1) runs.push(run);
  const f = (v: number) => v.toFixed(1);
  const out: string[] = [];
  for (const r of runs) {
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[Math.max(0, i - 1)]!;
      const b = r[Math.min(r.length - 1, i + 1)]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const p = r[i]!;
      const w = widthAt(p.s) / 2;
      // the brush is a little heavier on its left flank, as a held brush is
      left.push(`${f(p.x + nx * w * 1.08)} ${f(p.y + ny * w * 1.08)}`);
      right.push(`${f(p.x - nx * w * 0.92)} ${f(p.y - ny * w * 0.92)}`);
    }
    right.reverse();
    out.push(`M${left.join('L')}L${right.join('L')}Z`);
  }
  return out.join('');
}

/**
 * A stop: a small flat stepping stone seen from above, like the garden's path stones — an uneven
 * ellipse (wider than tall, a little tilted) around the origin. Pure, seeded.
 */
export function stonePath(seed: number | string, rx: number, ry: number): string {
  const rng = createRng(`wayfinding-stone:${seed}`);
  const n = 14;
  const tilt = rng.range(-0.12, 0.12);
  const pts: Pt[] = [];
  let d = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d = d * 0.5 + rng.range(-0.09, 0.09);
    // flatter underneath, as a stone set in the ground
    const k = (1 + d) * (Math.sin(a) > 0 ? 0.92 : 1);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push({ x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) });
  }
  // smooth through the midpoints
  const mid = (p: Pt, q: Pt) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const f = (v: number) => v.toFixed(2);
  const m0 = mid(pts[n - 1]!, pts[0]!);
  let path = `M${f(m0.x)} ${f(m0.y)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % n]!);
    path += `Q${f(p.x)} ${f(p.y)} ${f(m.x)} ${f(m.y)}`;
  }
  return `${path}Z`;
}

/** The centre line as an SVG path (for the draw-in reveal). */
export function centrePath(layout: PathLayout): string {
  return layout.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The points of the line that fall inside any box grown by `pad` (for tests: the line never crosses text). */
export function pointsInBoxes(points: readonly Pt[], boxes: readonly Box[], pad = 0): Pt[] {
  return points.filter((p) => boxes.some((b) => p.x > b.left - pad && p.x < b.right + pad && p.y > b.top - pad && p.y < b.bottom + pad));
}
