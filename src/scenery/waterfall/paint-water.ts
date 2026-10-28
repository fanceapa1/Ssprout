/**
 * The waterfall's water: the falling sheet (still), the plunge pool and the outflow stream.
 * Painted on white in world units, in parts (ADR 0226, 0238), after the rock so the falls lie
 * over the cliff. docs/systems/scenery.md › Waterfall › Painting › Water.
 */
import type { Rng } from '../../core/rng';
import {
  PIGMENTS,
  blob,
  bounds,
  insetPolygon,
  lighten,
  mix,
  pointInPolygon,
  shade,
  smoothPolygon,
  type Painter,
  type Pigment,
} from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Rock } from '../../scene/geometry';
import type { Strokes } from '../../scene/paint-land';
import { FALLS, POOL, ROCKS, STREAM, STREAM_LINE, WATERLINE } from './geometry';
import { WET_ROCK } from './paint-rocks';

/** The water's palette: a cooler, bluer celadon than the garden's still pond. */
export const WATER = {
  light: mix(lighten(PIGMENTS.celadon, 0.1), PIGMENTS.cerulean, 0.18),
  mid: mix(PIGMENTS.celadonMid, PIGMENTS.cerulean, 0.22),
  deep: mix(mix(PIGMENTS.celadonDeep, PIGMENTS.indigo, 0.3), PIGMENTS.stoneDark, 0.15),
  shallow: lighten(mix(PIGMENTS.stoneWarm, PIGMENTS.ochre, 0.25), 0.1),
  /** the falling sheet's shadowed streaks */
  sheet: mix(lighten(PIGMENTS.bellflower, 0.2), PIGMENTS.celadonMid, 0.45),
} satisfies Record<string, Pigment>;

const LEFT_EDGE = [FALLS.outline[0]!, FALLS.outline[7]!, FALLS.outline[6]!, FALLS.outline[5]!];
const RIGHT_EDGE = [FALLS.outline[1]!, FALLS.outline[2]!, FALLS.outline[3]!, FALLS.outline[4]!];
const TOP = FALLS.outline[0]!.y;
const BOTTOM = FALLS.outline[4]!.y;

function edgeAt(edge: readonly Pt[], y: number): number {
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1]!;
    const b = edge[i]!;
    if (y <= b.y || i === edge.length - 1) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return edge[0]!.x;
}

/** A point on the sheet: `u` across it (0 left, 1 right), at height `y`. */
export function sheetAt(u: number, y: number): Pt {
  const l = edgeAt(LEFT_EDGE, y);
  return { x: l + (edgeAt(RIGHT_EDGE, y) - l) * u, y };
}

/** A vertical strip of the sheet between `u0` and `u1`, from `y0` down to `y1`, a little wavy. */
function strip(rng: Rng, u0: number, u1: number, y0: number, y1: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = Math.max(3, Math.round((y1 - y0) / 24));
  const ph = rng.range(0, 6);
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    const w = 0.006 * Math.sin(y * 0.04 + ph);
    left.push(sheetAt(u0 + w, y));
    right.push(sheetAt(u1 + w, y));
  }
  return [...left, ...right.reverse()];
}

/** The falls, still: thin dark edges over the wet cliff, streaked washes with paper left white, the lip and the foam. */
export function* paintFalls(p: Painter, rng: Rng): Strokes {
  // reserve the sheet: the alcove's dark is lifted back to paper, less at the thin edges
  yield* p.parts.lift(FALLS.outline, { rng, amount: 0.8, deform: 0.02, spread: 0.04, layers: 6, sharpness: 0.3 });
  yield;
  yield* p.parts.lift(strip(rng, 0.1, 0.9, TOP + 4, BOTTOM), { rng, amount: 1, deform: 0.03, spread: 0.06, layers: 6, sharpness: 0.2 });
  yield;
  // the wet cliff glimpsed through the thin edges, broken where the water thickens
  for (const [u0, u1] of [[-0.01, 0.08], [0.92, 1.01]] as const) {
    for (let y = TOP + rng.range(0, 30); y < BOTTOM - 30; ) {
      const len = rng.range(50, 140);
      yield* p.parts.wash(strip(rng, u0, u1, y, Math.min(BOTTOM - 20, y + len)), WET_ROCK, {
        rng,
        deform: 0.1,
        spread: 0.15,
        layers: 6,
        opacity: rng.range(0.22, 0.36),
        edge: 0.2,
        sharpness: 0.3,
        fade: { angle: Math.PI / 2, start: 0.5, amount: 0.8 },
      });
      yield;
      y += len + rng.range(10, 50);
    }
  }
  // the sheet's shaded side (the light comes from the upper right), bled out toward the lit side
  yield* p.parts.glaze(strip(rng, 0, 0.55, TOP + 10, BOTTOM - 10), WATER.sheet, { rng, opacity: 0.22, deform: 0.1, spread: 0.2, fade: { angle: 0, start: 0.3, amount: 1, ragged: 0.8 } });
  yield;
  // the falling water: streaks of cool shadow, white paper between them
  for (let u = 0.03; u < 0.95; ) {
    const w = rng.range(0.02, 0.08);
    if (rng.chance(0.85)) {
      const y0 = TOP + rng.range(0, 60);
      const y1 = BOTTOM - rng.range(10, 90);
      const deep = rng.chance(0.3);
      yield* p.parts.wash(strip(rng, u, u + w, y0, y1), deep ? WATER.mid : WATER.sheet, {
        rng,
        deform: 0.08,
        spread: 0.14,
        layers: 6,
        opacity: deep ? rng.range(0.28, 0.42) : rng.range(0.22, 0.36),
        edge: 0.35,
        sharpness: 0.35,
        centreLift: 0.15,
        flow: 0.6,
        flowScale: 24,
        fade: { angle: rng.chance(0.6) ? Math.PI / 2 : -Math.PI / 2, start: rng.range(0.25, 0.6), amount: rng.range(0.7, 1), ragged: 0.8 },
      });
      yield;
    }
    u += w + rng.range(0.015, 0.05);
  }
  // lifted lines: the brightest falling threads drawn back out of the streaks
  for (let i = 0; i < 9; i++) {
    const u = rng.range(0.12, 0.88);
    const y0 = TOP + rng.range(20, 140);
    yield* p.parts.lift(strip(rng, u, u + rng.range(0.006, 0.014), y0, y0 + rng.range(120, 260)), { rng, amount: rng.range(0.5, 0.8), deform: 0.05, spread: 0.05, layers: 4, sharpness: 0.5 });
    yield;
  }
  // the lip: a glassy, darker roll where the water bends over, a lifted gleam on top
  const lip: Pt[] = [...FALLS.lip.map((q) => ({ x: q.x, y: q.y - 2 })), ...FALLS.lip.slice().reverse().map((q) => ({ x: q.x + (q.x - 612) * 0.04, y: q.y + 14 }))];
  yield* p.parts.wash(lip, WATER.mid, { rng, deform: 0.1, spread: 0.1, layers: 6, opacity: 0.4, edge: 0.4, sharpness: 0.5, fade: { angle: Math.PI / 2, start: 0.35, amount: 1 } });
  yield;
  yield* p.parts.lift({ cx: 612, cy: 296, rx: 40, ry: 2 }, { rng, amount: 0.7, deform: 0.2, spread: 0.2, layers: 4 });
  yield;
  yield* paintFoam(p, rng);
}

/** The foam at the foot: a pale, churning mass in soft lifts, a cool shade under it. */
function* paintFoam(p: Painter, rng: Rng): Strokes {
  const { foot } = FALLS;
  yield* p.parts.glaze({ cx: foot.x + 6, cy: foot.y + 16, rx: 120, ry: 22 }, WATER.sheet, { rng, opacity: 0.3, deform: 0.3, spread: 0.3, fade: { angle: -Math.PI / 2, start: 0.4, amount: 1 } });
  yield;
  for (let i = 0; i < 9; i++) {
    const t = (i / 8) * 2 - 1;
    const cx = foot.x + t * 92 + rng.range(-10, 10);
    const cy = foot.y + 2 + Math.abs(t) * 8 + rng.range(-5, 5);
    const r = 34 - Math.abs(t) * 18 + rng.range(-4, 6);
    yield* p.parts.lift(blob(cx, cy, r, r * 0.42, rng, { irregularity: 0.35, points: 14 }), { rng, amount: rng.range(0.75, 0.95), deform: 0.3, spread: 0.3, layers: 5, sharpness: 0.05, edge: 0 });
    yield;
  }
  // mist rising off the foam into the base of the sheet
  yield* p.parts.lift({ cx: foot.x, cy: foot.y - 26, rx: 80, ry: 30 }, { rng, amount: 0.45, deform: 0.3, spread: 0.4, layers: 5, sharpness: 0.05 });
  yield;
}

/** The rim between water and bank: thin at the back, wider toward the viewer (as the garden's pond). */
function* reserveRim(p: Painter, rng: Rng, shape: readonly Pt[]): Strokes {
  const unit = insetPolygon(shape, -1);
  const rim = shape.map((q, i) => {
    const k = 3 + 8 * Math.min(1, Math.max(0, (q.y - 600) / 360));
    const u = unit[i]!;
    return { x: q.x + (u.x - q.x) * k, y: q.y + (u.y - q.y) * k };
  });
  yield* p.parts.lift(rim, { rng, amount: 0.9, deform: 0.03, spread: 0.08, layers: 8, sharpness: 0.5 });
}

const inPool = (q: Pt) => pointInPolygon(q, POOL);

/** Clip what follows to `shapes` (or, `outside`, to everything but one) until `p.ctx.restore()`. */
function clipTo(p: Painter, shapes: readonly (readonly Pt[])[], outside = false): void {
  const { ctx } = p;
  ctx.save();
  ctx.beginPath();
  if (outside) ctx.rect(-1e4, -1e4, 2e4, 2e4);
  for (const shape of shapes) {
    shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  }
  ctx.clip(outside ? 'evenodd' : 'nonzero');
}

/** The plunge pool: a deep, cool centre, warm shallows, the cliff's reflection and the churn round the foot. */
export function* paintPool(p: Painter, rng: Rng): Strokes {
  const b = bounds(POOL);
  yield* reserveRim(p, rng, POOL);
  yield;
  yield* p.parts.waterBody(POOL, { rng, pigments: [WATER.light, WATER.mid, WATER.deep], bands: 4, ripples: 0, reflection: 0, farShadow: 0.7, granulation: 0.3 });
  yield;
  const clip = smoothPolygon(insetPolygon(POOL, 6), 1);
  clipTo(p, [clip]);
  // the deep heart under the falls, bled in wet: two glazes, the inner darker
  for (const [rx, ry, a] of [[230, 56, 0.34], [140, 34, 0.3]] as const) {
    yield* p.parts.glaze(blob(660, 668, rx, ry, rng, { irregularity: 0.2, points: 24 }), WATER.deep, { rng, opacity: a, deform: 0.4, spread: 0.35, edge: 0.05, sharpness: 0.05, flow: 0.6, flowScale: 60 });
    yield;
  }
  // warm shallows along the near edge, fading out toward the deep
  const near = clip.filter((q) => q.y > 690);
  const shallows: Pt[] = [...near, ...near.slice().reverse().map((q) => ({ x: q.x + (660 - q.x) * 0.05, y: q.y - 26 }))];
  yield* p.parts.glaze(shallows, WATER.shallow, { rng, opacity: 0.26, deform: 0.25, spread: 0.3, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.8 } });
  yield;
  // the cliff's dark, wet reflection under the waterline, broken; the falls' reflection stays pale
  for (let x = b.x + 20; x < b.x + b.w - 30; ) {
    const w = rng.range(50, 130);
    const under = x + w > 530 && x < 700;
    if (!under) {
      const shape: Pt[] = [
        { x, y: WATERLINE + 2 },
        { x: x + w, y: WATERLINE + 4 },
        { x: x + w * 0.9, y: WATERLINE + rng.range(26, 46) },
        { x: x + w * 0.1, y: WATERLINE + rng.range(30, 50) },
      ];
      yield* p.parts.glaze(shape, mix(WET_ROCK, WATER.deep, 0.4), { rng, opacity: 0.3, deform: 0.3, spread: 0.3, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.8 } });
      yield;
    }
    x += w + rng.range(4, 24);
  }
  // the boulders' soft, dark reflections (their wet waterline is the sprite's own)
  for (const r of ROCKS.filter((q) => inPool({ x: q.x, y: q.y + 4 }))) {
    yield* p.parts.glaze(blob(r.x, r.y + r.h * 0.22, r.w * 0.42, r.h * 0.28, rng, { irregularity: 0.25, points: 16 }), mix(WET_ROCK, WATER.deep, 0.5), {
      rng,
      opacity: 0.32,
      deform: 0.3,
      spread: 0.3,
      fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.8 },
    });
    yield;
  }
  // reserves: the falls' pale reflection and the sky band, lifted in broken horizontal strokes
  for (let i = 0; i < 12; i++) {
    const y = 640 + i * 7 + rng.range(-2, 2);
    const w = rng.range(30, 70) * (1 - i / 24);
    const x = 615 + rng.range(-20, 20);
    if (!inPool({ x: x - w / 2, y }) || !inPool({ x: x + w / 2, y })) continue;
    yield* p.parts.lift({ cx: x, cy: y, rx: w / 2, ry: rng.range(1, 2.2) }, { rng, amount: rng.range(0.25, 0.45), deform: 0.25, spread: 0.3, layers: 4 });
    yield;
  }
  for (let i = 0; i < 9; i++) {
    const y = b.y + b.h * (0.42 + 0.48 * (i / 9)) + rng.range(-5, 5);
    const w = rng.range(40, 150);
    const x = rng.range(b.x + 60, b.x + b.w - 60);
    if (Math.abs(x - 615) < 60) continue;
    if (!inPool({ x: x - w / 2, y }) || !inPool({ x: x + w / 2, y })) continue;
    yield* p.parts.lift({ cx: x, cy: y, rx: w / 2, ry: rng.range(0.8, 1.6) }, { rng, amount: rng.range(0.2, 0.38), deform: 0.2, spread: 0.3, layers: 4 });
    yield;
  }
  // the churn: rings spreading from the foot, drifting toward the outflow
  for (const [dx, dy, w, n] of [[10, 22, 150, 3], [70, 44, 220, 3], [150, 70, 200, 2], [280, 92, 160, 2]] as const) {
    p.ripple({ x: FALLS.foot.x + dx, y: FALLS.foot.y + dy }, { rng, width: w, count: n, squash: 0.1, pigment: WATER.deep, opacity: 0.3, light: 0.8, lineWidth: 1.1 });
    yield;
  }
  // foam flecks carried off on the current
  for (let i = 0; i < 12; i++) {
    const x = FALLS.foot.x + rng.range(-60, 340);
    const y = FALLS.foot.y + 24 + (x - FALLS.foot.x) * 0.2 + rng.range(-10, 14);
    if (!inPool({ x, y })) continue;
    yield* p.parts.lift({ cx: x, cy: y, rx: rng.range(6, 22), ry: rng.range(1.2, 2.6) }, { rng, amount: rng.range(0.5, 0.8), deform: 0.3, spread: 0.3, layers: 3 });
    yield;
  }
  p.ctx.restore();
}

/** The direction of the flow at a point of the stream's centre line. */
function flowAt(i: number): Pt {
  const a = STREAM_LINE[Math.max(0, i - 1)]!;
  const c = STREAM_LINE[Math.min(STREAM_LINE.length - 1, i + 1)]!;
  const len = Math.hypot(c.x - a.x, c.y - a.y);
  return { x: (c.x - a.x) / len, y: (c.y - a.y) / len };
}

/** A point beside the centre line: `s` along it (0..length-1), `side` across (-1 left bank, 1 right). */
function streamAt(s: number, side: number): Pt {
  const i = Math.min(STREAM_LINE.length - 2, Math.floor(s));
  const f = s - i;
  const a = STREAM_LINE[i]!;
  const c = STREAM_LINE[i + 1]!;
  const d = flowAt(f < 0.5 ? i : i + 1);
  const half = a.half + (c.half - a.half) * f;
  return { x: a.x + (c.x - a.x) * f - d.y * side * half, y: a.y + (c.y - a.y) * f + d.x * side * half };
}

const STREAM_ROCKS: readonly Rock[] = ROCKS.filter((r) => ['rock-outflow', 'rock-stream', 'rock-stream-bank'].includes(r.id));

/** The stream: shallow and light, deeper down its channel, broken ripple strokes and pale riffles round its rocks. */
export function* paintStream(p: Painter, rng: Rng): Strokes {
  // the rim stops where the stream leaves the pool
  clipTo(p, [POOL], true);
  yield* reserveRim(p, rng, STREAM);
  p.ctx.restore();
  yield;
  yield* p.parts.wetInWet(STREAM, WATER.mid, lighten(WATER.light, 0.15), {
    rng,
    angle: Math.PI / 2,
    split: 0.4,
    softness: 0.5,
    fingers: 0.5,
    deform: 0.04,
    spread: 0.1,
    opacity: 0.6,
    edge: 0.45,
    edgeWidth: 2,
    centreLift: 0.2,
    granulation: 0.15,
    flow: 0.4,
    flowScale: 50,
  });
  yield;
  // the channel: a deeper ribbon down the middle, lost toward the banks
  const last = STREAM_LINE.length - 1;
  const ribbon = (lo: number, hi: number): Pt[] => {
    const l: Pt[] = [];
    const r: Pt[] = [];
    for (let s = lo; s <= hi + 1e-6; s += 0.5) {
      const sway = Math.sin(s * 1.7) * 0.15;
      l.push(streamAt(s, sway - 0.35));
      r.push(streamAt(s, sway + 0.3));
    }
    return [...l, ...r.reverse()];
  };
  yield* p.parts.glaze(ribbon(0.2, last - 0.2), WATER.mid, { rng, opacity: 0.3, deform: 0.25, spread: 0.3, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.8 } });
  yield;
  // warm shallows on the inside of each bend
  for (const [s, side] of [[2.6, 1], [5.2, -1], [7.2, 1]] as const) {
    const c = streamAt(s, side * 0.6);
    yield* p.parts.glaze({ cx: c.x, cy: c.y, rx: 34 + s * 4, ry: 10 + s }, WATER.shallow, { rng, opacity: 0.22, deform: 0.4, spread: 0.4 });
    yield;
  }
  // broken ripple strokes: short, nearly level marks (the stream lies flat, seen from above), dark and pale
  clipTo(p, [STREAM, POOL]);
  for (let i = 0; i < 30; i++) {
    const s = rng.range(0.5, last - 0.1);
    const q = streamAt(s, rng.range(-0.6, 0.6));
    const len = rng.range(10, 26) * (1 + s * 0.1);
    const tilt = rng.range(-0.12, 0.12) * len;
    const pts: Pt[] = [
      { x: q.x - len / 2, y: q.y - tilt },
      { x: q.x, y: q.y + rng.range(-1.5, 1.5) },
      { x: q.x + len / 2, y: q.y + tilt },
    ];
    if (rng.chance(0.5)) {
      p.stroke(pts, { rng, pigment: shade(WATER.mid, 0.2), width: rng.range(0.8, 1.4), opacity: 0.32, wetness: 0.4, wobble: 0.6, taper: [0.4, 0.4] });
    } else {
      yield* p.parts.lift([...pts, ...pts.slice().reverse().map((v) => ({ x: v.x, y: v.y + 2 }))], { rng, amount: 0.6, deform: 0.1, spread: 0.2, layers: 3, sharpness: 0.4, edge: 0 });
    }
    yield;
  }
  // riffles: a pale collar where the water piles against each rock, and a broken wake below it
  for (const r of STREAM_ROCKS) yield* riffle(p, rng, r);
  p.ctx.restore();
}

function* riffle(p: Painter, rng: Rng, r: Rock): Strokes {
  const cy = r.y - r.h * 0.02;
  yield* p.parts.lift(blob(r.x, cy, r.w * 0.78, r.h * 0.26, rng, { irregularity: 0.3, points: 16 }), { rng, amount: 0.75, deform: 0.3, spread: 0.3, layers: 5, sharpness: 0.2, edge: 0 });
  yield;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const x0 = r.x + side * r.w * (0.35 + k * 0.12);
      const y0 = cy + r.h * (0.12 + k * 0.1);
      const len = r.w * rng.range(0.4, 0.7);
      const pts: Pt[] = [
        { x: x0, y: y0 },
        { x: x0 + side * len * 0.5, y: y0 + len * 0.25 },
        { x: x0 + side * len, y: y0 + len * 0.42 },
      ];
      yield* p.parts.lift([...pts, ...pts.slice().reverse().map((v) => ({ x: v.x, y: v.y + 2 }))], { rng, amount: 0.6, deform: 0.15, spread: 0.2, layers: 3, sharpness: 0.3, edge: 0 });
      yield;
    }
  }
}
