/**
 * The coast's shore (GB2): painted over the beach, the pools' water and the shelf. The static wet
 * band, the shingle sorted by the sea (fine sand low, the berm's cobbles packed up the back), the
 * Posidonia wrack and its sea balls, dry tufts at the back, and each rock pool as a hollow in a low
 * limestone platform. On white, in world units, in parts (ADR 0330). docs/systems/scenery.md › Coast › Shore.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, mix, type DryOptions, type Painter, type Pigment, type WetLayer } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { inView } from './paint-land';
import { SAND, SEA } from './paint-water';
import { LIME, band, box, fillUnder, streak, trace } from './rock-kit';
import { WRACK_LINE } from './sea';
import {
  BACK_TUFTS, BEACH_X, BURIED, COBBLES, POOL_SHAPES, SEA_BALLS, WRACK_DRIFTS, backAt, foamAt, wetWidth, type PoolShape,
} from './shore-shapes';

/** The shore's own colours, beside the beach's `SAND` and the rock's `LIME`. */
export const SHORE = {
  wet: mix(SAND.wetDark, SEA.seabed, 0.35),
  grain: '#b39770',
  coarse: '#b3a692',
  shade: '#8c89a1',
  cast: '#7d7a90',
  leaf: '#4d3f2b',
  leafOlive: '#685a3a',
  leafPale: '#a8946f',
  leafGrey: '#7b7163',
  ball: '#8a6a47',
  straw: '#c6ab76',
  strawDark: '#97814f',
  grassGrey: '#9a9e82',
  crust: '#e4c3c3',
  weed: mix(LIME.algae, SEA.seagrass, 0.45),
  crevice: mix(SEA.cliffDark, LIME.deep, 0.4),
  floor: mix(SAND.pebble, SEA.aqua, 0.4),
} satisfies Record<string, Pigment>;

/** The cobbles' palette, cream to dark, by `Cobble.tone`. */
const TONES: readonly Pigment[] = ['#e6dcc8', '#d6c09c', '#b9b1a6', '#a2a3a8', '#7a736a', '#c09a7a', '#f0ebe2'];

/** Paper laid back over the paint, dried in one layer. */
const LIFT: DryOptions = { edge: 0.05, sharpness: 0.35, centreLift: 0, granulation: 0, flow: 0.3, darken: 0, blend: 'source-over' };

/** The beach's box, waterline to back, past both ends. */
const BEACH_BOX: Rect = { x: BEACH_X[0] - 8, y: 728, w: BEACH_X[1] - BEACH_X[0] + 24, h: 132 };

/** A thin lens from `a` to `b`, `w` wide in its middle: a leaf, a blade, a streak of light. */
function sliver(a: Pt, b: Pt, w: number, bow = 0): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const hw = (w / 2) * Math.sin(Math.PI * t) ** 0.8;
    const c = { x: a.x + dx * t + nx * bow * Math.sin(Math.PI * t), y: a.y + dy * t + ny * bow * Math.sin(Math.PI * t) };
    left.push({ x: c.x + nx * hw, y: c.y + ny * hw });
    right.push({ x: c.x - nx * hw, y: c.y - ny * hw });
  }
  return [...left, ...right.reverse()];
}

/** A point along a polyline at fraction `t` of its points. */
function along(path: readonly Pt[], t: number): Pt {
  const f = Math.max(0, Math.min(1, t)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const k = f - i;
  return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * k, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * k };
}

/** A ring: `outer` with `inner` cut out (opposite winding, so a non-zero fill leaves the hole). */
const ring = (outer: readonly Pt[], inner: readonly Pt[]): Pt[] => [...outer, outer[0]!, inner[0]!, ...inner.slice().reverse(), inner[0]!];

/** A closed outline pushed out from its centre by `d` units (`d * k` down). */
function grow(poly: readonly Pt[], cx: number, cy: number, d: number, k = 0.5): Pt[] {
  return poly.map((q) => {
    const l = Math.hypot(q.x - cx, q.y - cy) || 1;
    return { x: q.x + ((q.x - cx) / l) * d, y: q.y + ((q.y - cy) / l) * d * k };
  });
}

function* dry(L: WetLayer, opts: DryOptions): Strokes {
  L.flush();
  yield;
  yield* L.dryParts(opts);
  yield;
}

export function* paintShore(p: Painter, rng: Rng): Strokes {
  if (inView(p, BEACH_BOX)) {
    yield* paintWetSand(p, rng.fork('wet'));
    yield* paintSorting(p, rng.fork('sorting'));
    yield* paintWrack(p, rng.fork('wrack'));
    yield* paintCobbles(p, rng.fork('cobbles'));
    yield* paintBuried(p, rng.fork('buried'));
    yield* paintBalls(p, rng.fork('balls'));
    yield* paintTufts(p, rng.fork('tufts'));
  }
  yield* paintPoolStone(p, rng.fork('stone'));
  for (const [i, q] of POOL_SHAPES.entries()) yield* paintPool(p, q, rng.fork(`pool-${i}`));
}

// ── the beach ─────────────────────────────────────────────────────────────────────────────

/** The sand the swash keeps wet under the waterline: darker and cooler, lost up the beach, with the sky's sheen in it. */
function* paintWetSand(p: Painter, rng: Rng): Strokes {
  const [x0, x1] = BEACH_X;
  const wet = band(x0, x1 + 12, (x) => foamAt(x) - 0.5, (x) => foamAt(x) + wetWidth(x), 6);
  yield* p.parts.glaze(wet, SHORE.wet, { rng, opacity: 0.32, layers: 6, deform: 0.06, spread: 0.18, edge: 0.04, granulation: 0.4, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.7 } });
  yield;
  const sheen = p.layer(BEACH_BOX);
  for (let x = x0 + rng.range(0, 30); x < x1 - 10; x += rng.range(20, 70)) {
    const len = rng.range(10, 34);
    const y = foamAt(x) + rng.range(2, 6);
    sheen.fill(sliver({ x, y }, { x: x + len, y: foamAt(x + len) + (y - foamAt(x)) + rng.range(-0.5, 0.5) }, rng.range(0.6, 1.3)), PAPER_WHITE, 0.6);
  }
  yield* dry(sheen, { ...LIFT, opacity: 0.4, flow: 0.4, flowScale: 20 });
}

/** The sea's sorting: fine pale grains low on the beach, a coarser grey cast up the berm. */
function* paintSorting(p: Painter, rng: Rng): Strokes {
  const [x0, x1] = BEACH_X;
  const depth = (x: number, u: number) => foamAt(x) + (backAt(x) - foamAt(x)) * u;
  const fine = p.layer(BEACH_BOX);
  fine.fill(band(x0, x1, (x) => foamAt(x) + wetWidth(x) * 0.7, (x) => depth(x, 0.5), 6), SHORE.grain, 0.5);
  yield* dry(fine, { speckle: 1, granulation: 1, opacity: 0.3, flow: 0.6, flowScale: 30 });
  yield* p.parts.glaze(band(x0, x1, (x) => depth(x, 0.42), (x) => backAt(x) - 0.5, 6), SHORE.coarse, {
    rng, opacity: 0.12, layers: 5, deform: 0.08, spread: 0.2, edge: 0.03, granulation: 0.6, granules: 0.2, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.8 },
  });
  yield;
}

/** The wrack line's drifts of dead Posidonia: a soft brown mat, then the leaves, dark to bleached. */
function* paintWrack(p: Painter, rng: Rng): Strokes {
  const box = bounds(WRACK_LINE);
  const area = { x: box.x - 10, y: box.y - 10, w: box.w + 20, h: box.h + 20 };
  const mat = p.layer(area);
  const leaves = p.layer(area);
  const n = WRACK_LINE.length - 1;
  for (const d of WRACK_DRIFTS) {
    const run = WRACK_LINE.slice(Math.round(d.t0 * n), Math.round(d.t1 * n) + 1);
    if (run.length > 1) {
      const x0 = run[0]!.x;
      const x1 = run[run.length - 1]!.x;
      // thick in the middle of the drift, thin at its ends
      const thick = (x: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, (x - x0) / (x1 - x0 || 1)))) ** 0.6;
      for (let k = 0; k < 3; k++) mat.fill(band(x0, x1, (x) => lineOn(run, x) - (1 + 1.4 * k) * thick(x) * 0.6, (x) => lineOn(run, x) + (1.5 + 1.6 * k) * thick(x) * 0.6, 3), SHORE.leaf, 0.22);
    }
    const count = Math.round((d.t1 - d.t0) * 640);
    for (let k = 0; k < count; k++) {
      const t = rng.range(d.t0, d.t1);
      const q = along(WRACK_LINE, t);
      const a = along(WRACK_LINE, Math.min(1, t + 0.01));
      const ang = Math.atan2(a.y - q.y, a.x - q.x) + rng.gaussian(0, 0.25);
      const len = rng.range(3, 7);
      const c = { x: q.x + rng.range(-1, 1), y: q.y + rng.gaussian(0.3, 1.1) };
      const half = { x: (Math.cos(ang) * len) / 2, y: (Math.sin(ang) * len) / 2 };
      const pig = rng.pick([SHORE.leaf, SHORE.leaf, SHORE.leafOlive, SHORE.leafGrey, SHORE.leafPale]);
      leaves.fill(sliver({ x: c.x - half.x, y: c.y - half.y }, { x: c.x + half.x, y: c.y + half.y }, rng.range(0.45, 0.9), rng.range(-0.4, 0.4)), pig, rng.range(0.45, 0.75));
    }
  }
  // a few stray leaves blown up the beach
  for (let k = 0; k < 18; k++) {
    const x = rng.range(BEACH_X[0], BEACH_X[1] - 30);
    const y = foamAt(x) + (backAt(x) - foamAt(x)) * rng.range(0.45, 0.9);
    const ang = rng.range(-0.6, 0.6);
    const len = rng.range(3, 6);
    leaves.fill(sliver({ x, y }, { x: x + Math.cos(ang) * len, y: y + Math.sin(ang) * len }, rng.range(0.5, 0.9), rng.range(-0.5, 0.5)), rng.pick([SHORE.leafPale, SHORE.leafGrey]), 0.6);
  }
  yield* dry(mat, { opacity: 0.6, edge: 0.05, sharpness: 0.2, centreLift: 0, granulation: 0.5, granules: 0.2, flow: 0.6, flowScale: 10 });
  yield* dry(leaves, { opacity: 0.75, edge: 0.3, edgeWidth: 0.5, sharpness: 0.7, centreLift: 0.1, granulation: 0.2, flow: 0.3 });
}

/** y on a polyline sorted by x, linear between its points. */
function lineOn(run: readonly Pt[], x: number): number {
  for (let i = 1; i < run.length; i++) if (run[i]!.x >= x) return run[i - 1]!.y + ((run[i]!.y - run[i - 1]!.y) * (x - run[i - 1]!.x)) / (run[i]!.x - run[i - 1]!.x || 1);
  return run[run.length - 1]!.y;
}

/** The berm's cobbles, each its own colour, sat in the sand: a cast shade, the body, its shaded underside, a lit top. */
function* paintCobbles(p: Painter, rng: Rng): Strokes {
  const cast = p.layer(BEACH_BOX);
  const body = p.layer(BEACH_BOX);
  const shade = p.layer(BEACH_BOX);
  const lit = p.layer(BEACH_BOX);
  for (const c of COBBLES) {
    const ry = c.r * c.squash;
    cast.fill(blob(c.x + c.r * 0.4, c.y + ry * 0.75, c.r * 1.05, ry * 0.5, rng, { points: 9, irregularity: 0.15, rotation: c.tilt * 0.5 }), SHORE.cast, 0.5);
    body.fill(blob(c.x, c.y, c.r, ry, rng, { points: 11, irregularity: 0.12, rotation: c.tilt }), TONES[c.tone]!, rng.range(0.5, 0.72));
    shade.fill(blob(c.x + c.r * 0.22, c.y + ry * 0.38, c.r * 0.82, ry * 0.55, rng, { points: 9, irregularity: 0.15, rotation: c.tilt }), SHORE.shade, 0.5);
    if (c.r > 1.6) lit.fill(blob(c.x - c.r * 0.28, c.y - ry * 0.38, c.r * 0.48, ry * 0.3, rng, { points: 8, irregularity: 0.2, rotation: c.tilt }), PAPER_WHITE, 0.85);
  }
  yield* dry(cast, { opacity: 0.32, edge: 0.1, edgeWidth: 1, sharpness: 0.3, centreLift: 0, granulation: 0.3, flow: 0.3 });
  yield* dry(body, { opacity: 0.7, edge: 0.45, edgeWidth: 0.7, sharpness: 0.75, centreLift: 0.2, granulation: 0.6, granules: 0.15, flow: 0.4, flowScale: 8 });
  yield* dry(shade, { opacity: 0.42, edge: 0.2, edgeWidth: 0.6, sharpness: 0.6, centreLift: 0, granulation: 0.3, flow: 0.3 });
  yield* dry(lit, { ...LIFT, opacity: 0.6, sharpness: 0.6 });
}

/** Larger stones half buried in the berm: the dome above the sand, flat at its foot, a line of shade where the sand meets it. */
function* paintBuried(p: Painter, rng: Rng): Strokes {
  const body = p.layer(BEACH_BOX);
  const shade = p.layer(BEACH_BOX);
  const lit = p.layer(BEACH_BOX);
  for (const s of BURIED) {
    const rx = s.w / 2;
    const ry = s.w * 0.3;
    const cy = s.y - ry * 0.45;
    body.fill(blob(s.x, cy, rx, ry, rng, { points: 16, irregularity: 0.1, flatBottom: 1 }), mix(LIME.body, LIME.grey, rng.range(0.2, 0.6)), 0.75);
    shade.fill(blob(s.x + rx * 0.2, cy + ry * 0.3, rx * 0.85, ry * 0.6, rng, { points: 12, irregularity: 0.12, flatBottom: 1 }), SHORE.shade, 0.55);
    shade.fill(band(s.x - rx * 0.6, s.x + rx * 1.25, (x) => s.y - 0.4 + (x - s.x) * 0.02, (x) => s.y + 1 + 0.8 * Math.max(0, (x - s.x) / rx), 2), SHORE.cast, 0.55);
    lit.fill(blob(s.x - rx * 0.3, cy - ry * 0.45, rx * 0.5, ry * 0.28, rng, { points: 10, irregularity: 0.2 }), PAPER_WHITE, 0.85);
  }
  yield* dry(body, { opacity: 0.7, edge: 0.4, edgeWidth: 0.9, sharpness: 0.7, centreLift: 0.2, granulation: 0.8, granules: 0.25, flow: 0.5, flowScale: 10 });
  yield* dry(shade, { opacity: 0.45, edge: 0.15, edgeWidth: 0.8, sharpness: 0.5, centreLift: 0, granulation: 0.4, flow: 0.3 });
  yield* dry(lit, { ...LIFT, opacity: 0.6, sharpness: 0.6 });
}

/** The felted Posidonia balls: brown, fibrous, each with its shade. */
function* paintBalls(p: Painter, rng: Rng): Strokes {
  const body = p.layer(BEACH_BOX);
  const shade = p.layer(BEACH_BOX);
  for (const b of SEA_BALLS) {
    shade.fill(blob(b.x + b.r * 0.5, b.y + b.r * 0.6, b.r * 1.2, b.r * 0.45, rng, { points: 9 }), SHORE.cast, 0.45);
    body.fill(blob(b.x, b.y, b.r * 1.25, b.r * 0.85, rng, { points: 12, irregularity: 0.18, rotation: rng.range(-0.4, 0.4) }), SHORE.ball, 0.75);
    shade.fill(blob(b.x + b.r * 0.25, b.y + b.r * 0.3, b.r * 0.95, b.r * 0.5, rng, { points: 9 }), SHORE.leaf, 0.4);
  }
  yield* dry(body, { opacity: 0.75, edge: 0.35, edgeWidth: 0.5, sharpness: 0.55, centreLift: 0.25, granulation: 1, granules: 0.5, flow: 0.6, flowScale: 3 });
  yield* dry(shade, { opacity: 0.5, edge: 0.15, sharpness: 0.5, centreLift: 0, granulation: 0.4 });
}

/** Dry grass in the sand against the shelf: a few bleached blades fanned from each foot, a little shade under it. */
function* paintTufts(p: Painter, rng: Rng): Strokes {
  const L = p.layer(BEACH_BOX);
  const shade = p.layer(BEACH_BOX);
  for (const t of BACK_TUFTS) {
    shade.fill(blob(t.x + 2, t.y + 0.6, t.h * 0.5, 1.4, rng, { points: 10 }), SHORE.cast, 0.4);
    const n = 7 + Math.round(t.h / 2);
    const lean = rng.range(-0.25, 0.35);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + lean + rng.gaussian(0, 0.42);
      const h = t.h * rng.range(0.45, 1);
      const foot = { x: t.x + rng.range(-2.4, 2.4), y: t.y + rng.range(-0.5, 0.5) };
      const tip = { x: foot.x + Math.cos(a) * h, y: foot.y + Math.sin(a) * h };
      L.fill(streak(foot, tip, rng.range(0.7, 1.2), rng), rng.pick([SHORE.straw, SHORE.straw, SHORE.strawDark, SHORE.grassGrey]), rng.range(0.6, 0.85));
    }
  }
  yield* dry(shade, { opacity: 0.35, edge: 0.05, sharpness: 0.2, centreLift: 0, granulation: 0.3 });
  yield* dry(L, { opacity: 0.8, edge: 0.3, edgeWidth: 0.4, sharpness: 0.75, centreLift: 0.05, granulation: 0.2, dry: 0.25, flow: 0.3 });
}

// ── the rock pools ────────────────────────────────────────────────────────────────────────

/**
 * Paper over the old pools' smooth edges, then the shelf's own first wash again (its pigments over
 * its box, clipped to the covers), so the cover reads as the shelf and the hand-cut water edge shows.
 */
function* paintPoolStone(p: Painter, rng: Rng): Strokes {
  const covers = POOL_SHAPES.map((q) => ring(q.rim, q.water));
  const b = bounds(covers.flat());
  if (!inView(p, b)) return;
  for (const c of covers) fillUnder(p, c, LIME.under);
  p.ctx.save();
  p.ctx.beginPath();
  for (const c of covers) c.forEach((v, i) => (i ? p.ctx.lineTo(v.x, v.y) : p.ctx.moveTo(v.x, v.y)));
  p.ctx.clip();
  yield;
  yield* p.parts.wetInWet(box(-40, 820, 730, 1040), mix(LIME.cream, LIME.body, 0.5), LIME.grey, {
    rng, angle: Math.PI / 2 - 0.3, split: 0.45, softness: 0.7, opacity: 0.5, deform: 0.03, spread: 0.03, edge: 0, granulation: 0.7, granules: 0.25, flow: 0.5, flowScale: 60,
  });
  p.ctx.restore();
  yield;
}

/**
 * A rock pool: the low pitted platform it lies in, its rim of stone over the old water's edge (a
 * lit lip on the near side, the inner wall in shade on the far side, pink crusts at the
 * waterline), and in the water the dark hollow under the far wall, the floor, weed and the sky's sheen.
 */
function* paintPool(p: Painter, q: PoolShape, rng: Rng): Strokes {
  const b = bounds(q.platform);
  const area: Rect = { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 };
  if (!inView(p, area)) return;
  // the platform: cooler, pitted limestone round the pool, lost into the shelf
  const plat = p.layer(area);
  for (let k = 0; k < 4; k++) plat.fill(grow(q.platform, q.cx, q.cy, -k * 4), mix(LIME.grey, LIME.shade, 0.25), 0.09);
  plat.lift(q.water, 1);
  yield* dry(plat, { opacity: 0.8, edge: 0.04, sharpness: 0.2, centreLift: 0, granulation: 0.5, granules: 0.08, flow: 0.6, flowScale: 12 });
  const pits = p.layer(area);
  for (let k = 0; k < Math.round(q.rx * 0.5); k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(1, 1.45) ** 1.5;
    const x = q.cx + Math.cos(a) * (q.rx + 3) * d;
    const y = q.cy + Math.sin(a) * (q.ry + 2.5) * d;
    pits.fill(blob(x, y, rng.range(0.6, 1.8), rng.range(0.4, 0.9), rng, { points: 7 }), LIME.recess, rng.range(0.35, 0.6));
  }
  yield* dry(pits, { opacity: 0.5, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.1, granulation: 0.3 });
  const damp = p.layer(area);
  damp.fill(ring(grow(q.water, q.cx, q.cy, 2.2), q.water), mix(LIME.wet, LIME.algae, 0.5), 0.14);
  for (let k = 0; k < Math.round(q.rx / 5); k++) {
    const v = q.water[rng.int(0, q.water.length - 1)]!;
    const l = Math.hypot(v.x - q.cx, (v.y - q.cy) * 2) || 1;
    const out = rng.range(1, 4);
    damp.fill(blob(v.x + ((v.x - q.cx) / l) * out, v.y + ((v.y - q.cy) / l) * out, rng.range(4, 10), rng.range(1.6, 3.4), rng, { irregularity: 0.35 }), mix(LIME.wet, LIME.algae, 0.6), 0.09);
  }
  damp.lift(q.water, 1);
  yield* dry(damp, { opacity: 0.7, edge: 0.05, sharpness: 0.15, centreLift: 0, granulation: 0.3, flow: 0.5, flowScale: 10 });
  // the far inner wall in shade, dark and wet at the waterline; a wet line along the near edge
  const wall = p.layer(area);
  wall.fill([...q.wallTop, ...q.wallFoot.slice().reverse()], mix(LIME.shade, LIME.recess, 0.3), 0.75);
  wall.fill([...q.wallFoot.map((v) => ({ x: v.x, y: v.y - 1.1 })), ...q.wallFoot.slice().reverse().map((v) => ({ x: v.x, y: v.y + 0.3 }))], LIME.wet, 0.45);
  wall.fill([...q.nearEdge.map((v) => ({ x: v.x, y: v.y - 0.2 })), ...q.nearEdge.slice().reverse().map((v) => ({ x: v.x, y: v.y + 0.7 }))], LIME.wet, 0.35);
  yield* dry(wall, { opacity: 0.65, edge: 0.2, edgeWidth: 0.8, sharpness: 0.5, centreLift: 0, granulation: 0.6, flow: 0.4 });
  const lip = p.layer(area);
  const inner = q.nearEdge.slice(3, -3);
  lip.fill([...inner.map((v) => ({ x: v.x, y: v.y + 0.9 })), ...inner.slice().reverse().map((v) => ({ x: v.x, y: v.y + 2.3 }))], PAPER_WHITE, 0.8);
  for (const c of q.crust) lip.fill(blob(c.x, c.y, c.r, c.r * 0.45, rng, { points: 8, irregularity: 0.3 }), PAPER_WHITE, 0.5);
  yield* dry(lip, { ...LIFT, opacity: 0.65, sharpness: 0.5 });
  const crust = p.layer(area);
  for (const c of q.crust) crust.fill(blob(c.x, c.y, c.r, c.r * 0.45, rng, { points: 8, irregularity: 0.3 }), SHORE.crust, 0.6);
  yield* dry(crust, { opacity: 0.6, edge: 0.3, edgeWidth: 0.5, sharpness: 0.45, centreLift: 0.2, granulation: 0.7, granules: 0.3, flow: 0.5, flowScale: 4 });
  // the water: the hollow under the far wall, the floor, the weed, the sky's sheen
  p.ctx.save();
  trace(p, q.water);
  p.ctx.clip();
  yield* p.parts.glaze(q.water, mix(SEA.deepTeal, SEA.turquoise, 0.3), { rng, opacity: 0.3, layers: 6, deform: 0.05, spread: 0.1, edge: 0, fade: { angle: Math.PI / 2, start: 0.05, amount: 1, ragged: 0.5 } });
  yield;
  const deep = p.layer(area);
  const foot = q.wallFoot;
  deep.fill([...foot.map((v) => ({ x: v.x, y: v.y - 0.5 })), ...foot.slice().reverse().map((v, i, a) => ({ x: v.x, y: v.y + 1 + q.ry * 0.22 * Math.sin((Math.PI * i) / (a.length - 1)) ** 0.7 }))], SHORE.crevice, 0.75);
  const notch = foot[Math.round(foot.length * 0.62)]!;
  deep.fill(blob(notch.x, notch.y + 1.2, q.rx * 0.16, q.ry * 0.16, rng, { points: 12, irregularity: 0.3 }), SHORE.crevice, 0.5);
  yield* dry(deep, { opacity: 0.55, edge: 0.05, sharpness: 0.12, centreLift: 0, granulation: 0.3, flow: 0.5, flowScale: 6 });
  const floor = p.layer(area);
  for (const s of q.floor) floor.fill(blob(s.x, s.y, s.r, s.r * 0.55, rng, { points: 10, irregularity: 0.2 }), s.dark ? mix(SEA.seabed, SEA.deepTeal, 0.3) : SHORE.floor, s.dark ? 0.35 : 0.45);
  for (const w of q.weed) {
    for (let k = 0; k < 4; k++) {
      const a = Math.atan2(q.cy - w.y, q.cx - w.x) + rng.gaussian(0, 0.6);
      const l = w.r * rng.range(0.8, 1.6);
      floor.fill(sliver({ x: w.x, y: w.y }, { x: w.x + Math.cos(a) * l, y: w.y + Math.sin(a) * l * 0.6 }, rng.range(0.5, 0.9), rng.range(-0.4, 0.4)), SHORE.weed, 0.6);
    }
  }
  yield* dry(floor, { opacity: 0.5, edge: 0.15, edgeWidth: 0.6, sharpness: 0.3, centreLift: 0.1, granulation: 0.4, flow: 0.4 });
  const sheen = p.layer(area);
  sheen.fill(blob(q.cx - q.rx * 0.08, q.cy + q.ry * 0.12, q.rx * 0.36, q.ry * 0.3, rng, { irregularity: 0.25 }), PAPER_WHITE, 0.35);
  sheen.fill(sliver({ x: q.cx - q.rx * 0.62, y: q.cy + q.ry * 0.38 }, { x: q.cx + q.rx * 0.1, y: q.cy + q.ry * 0.42 }, 0.9, 0.3), PAPER_WHITE, 0.7);
  yield* dry(sheen, { ...LIFT, opacity: 0.5, sharpness: 0.2, flow: 0.4, flowScale: 10 });
  p.ctx.restore();
}
