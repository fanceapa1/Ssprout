/**
 * The coast's land (G4): the terraces' pale gravel and dry earth, the gravel path, the dry-stone
 * walls and their stone flights, the tended beds waiting for plants, and the jars. Lit from the
 * left over the sea (ADR 0360), painted on white in world units, in parts (ADR 0226, 0238).
 * docs/systems/scenery.md › Coast › Land.
 */
import type { Rng } from '../../core/rng';
import { blob, bounds, jitter, lighten, mix, padRect, ribbon, shade, smoothPath, type DryOptions, type Painter, type Pigment, type StrokeOptions } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { perspectiveScale } from '../../scene/slots';
import { batchLayer, dryBrushDry, dryBrushInto } from '../oasis/paint-batch';
import { LAND, PATH, WALLS } from './layout';
import { BEACH_FLIGHT, BEDS, copingY, FLIGHTS, JARS, wallDrop, WALL_FACES, WALL_GRASS, WALL_TOPS } from './shapes';
import { COAST_SLOTS } from './slots';

/** The land's palette: pale limestone gravel, dry earth, tilled soil, limestone, terracotta. */
export const EARTH = {
  gravel: '#e8dbbd',
  gravelWarm: '#e2c99c',
  gravelShade: '#c4b08c',
  pebble: '#a69c8c',
  earth: '#d2b58a',
  earthDark: '#a8865e',
  soil: '#b08d6a',
  soilDark: '#8a6a50',
  stone: '#ddd3c0',
  stoneWarm: '#dcc39a',
  stoneCool: '#c6bfb4',
  joint: '#6a6056',
  lichen: '#d4a24e',
  lichenGrey: '#cfc9b4',
  shadow: '#8c89a1',
  straw: '#d8bf82',
  strawDark: '#a98d55',
  pot: '#c47a50',
  potDark: '#8c4e36',
  potLit: '#e8b088',
} satisfies Record<string, Pigment>;

/** The line `n` units below the line `y(x)` between x0 and x1, sampled every `step`. */
function line(y: (x: number) => number, x0: number, x1: number, step = 20): Pt[] {
  const out: Pt[] = [];
  for (let x = x0; x < x1; x += step) out.push({ x, y: y(x) });
  out.push({ x: x1, y: y(x1) });
  return out;
}

/** The back edge of the terrace held by wall `i`: the wall above's foot, or the promontory's foot. */
export function terraceBack(i: number, x: number): number {
  if (i === 0) return 498 + (x < 1300 ? 2 * ((1300 - Math.max(900, x)) / 400) : 0);
  return copingY(i - 1, x) + WALLS[i - 1]!.h;
}

/** Does `r` (world units) reach the painter's canvas? Work outside it is skipped. */
export function inView(p: Painter, r: { x: number; y: number; w: number; h: number }): boolean {
  const m = p.ctx.getTransform();
  const x0 = m.a * r.x + m.e;
  const x1 = m.a * (r.x + r.w) + m.e;
  const y0 = m.d * r.y + m.f;
  const y1 = m.d * (r.y + r.h) + m.f;
  return Math.max(x0, x1) > 0 && Math.min(x0, x1) < p.ctx.canvas.width && Math.max(y0, y1) > 0 && Math.min(y0, y1) < p.ctx.canvas.height;
}

function reserve(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = '#fffdf8';
  p.ctx.fill();
  p.ctx.restore();
}

// ── the ground ───────────────────────────────────────────────────────────────────────────

/** The terraces' gravel and the foreground's dry earth, raked lines, pebbles, and the gravel path. */
export function* paintGround(p: Painter, rng: Rng): Strokes {
  const land = LAND.map((q) => ({ x: q.x, y: q.y }));
  reserve(p, land);
  yield* p.parts.wetInWet(land, EARTH.gravel, mix(EARTH.gravelWarm, EARTH.earth, 0.4), { rng, angle: Math.PI / 2 - 0.3, split: 0.55, softness: 0.7, opacity: 0.55, deform: 0.03, spread: 0.04, edge: 0.08, granulation: 0.6, granules: 0.25, flow: 0.5, flowScale: 120 });
  // warm passages and cool ones across the gravel, so it is not one flat tone
  for (let k = 0; k < 4; k++) {
    const x = rng.range(760, 1560);
    const y = rng.range(520, 980);
    yield* p.parts.glaze(blob(x, y, rng.range(140, 240), rng.range(20, 40), rng, { irregularity: 0.4 }), k % 2 ? EARTH.gravelWarm : mix(EARTH.gravelShade, EARTH.stoneCool, 0.5), { rng, opacity: 0.18, deform: 0.3, spread: 0.3, edge: 0.03, granulation: 0.4 });
  }
  // the promontory's cool shade over the top terrace's back
  const back = line((x) => terraceBack(0, x) - 2, 880, 1640);
  yield* p.parts.glaze([...back, ...back.slice().reverse().map((q) => ({ x: q.x, y: q.y + 24 }))], mix(EARTH.shadow, EARTH.gravelShade, 0.25), { rng, opacity: 0.38, edge: 0.03, deform: 0.2, fade: { angle: Math.PI / 2, start: 0.1, amount: 1, ragged: 0.6 } });
  // the foreground below the lowest wall: drier, darker earth toward the viewer
  const fgTop = line((x) => copingY(2, x) + WALLS[2]!.h, 660, 1640);
  yield* p.parts.wetInWet([...fgTop, { x: 1640, y: 1020 }, { x: 640, y: 1020 }], mix(EARTH.gravel, EARTH.earth, 0.3), EARTH.earthDark, { rng, angle: Math.PI / 2, split: 0.6, softness: 0.8, opacity: 0.4, deform: 0.05, spread: 0.05, edge: 0.04, granulation: 0.55, granules: 0.2 });
  yield* paintRaking(p, rng.fork('rake'));
  yield* paintPebbles(p, rng.fork('pebbles'));
  yield* paintPath(p, rng.fork('path'));
}

/** Raked gravel: broken lines along each terrace's walk, between the wall above and the beds. */
function* paintRaking(p: Painter, rng: Rng): Strokes {
  for (let i = 0; i < WALLS.length; i++) {
    const x0 = WALLS[i]!.edge[0]!.x + 16;
    const marks: Pt[][] = [];
    for (let f = 0.12; f < 0.62; f += 0.08) {
      for (let x = x0 + rng.range(0, 40); x < 1610; ) {
        const len = rng.range(60, 180);
        const pts: Pt[] = [];
        for (let u = x; u < Math.min(1630, x + len); u += 12) {
          const b = terraceBack(i, u);
          pts.push({ x: u, y: b + (copingY(i, u) - b) * f + rng.range(-0.4, 0.4) });
        }
        if (pts.length > 2) marks.push(pts);
        x += len + rng.range(20, 90);
      }
    }
    const opts = { rng, pigment: EARTH.gravelShade, width: 2.2, dryness: 0.7, wetness: 0.15 };
    const L = batchLayer(p, padRect(bounds(marks.flat()), 6), { x: 0, y: 0, w: 120, h: 6 }, 4);
    if (L.empty) continue;
    for (const m of marks) dryBrushInto(L, p, m, opts);
    L.flush();
    yield;
    yield* L.dryParts({ ...dryBrushDry(opts), opacity: 0.38 });
  }
}

/** Small pebbles and grit on the gravel: grey and ochre specks, darker under their light. */
function* paintPebbles(p: Painter, rng: Rng): Strokes {
  const area = { x: 640, y: 500, w: 1000, h: 520 };
  const L = batchLayer(p, area, { x: 0, y: 0, w: 6, h: 4 }, 2);
  if (L.empty) return;
  for (let k = 0; k < 900; k++) {
    const x = rng.range(660, 1630);
    const y = rng.range(505, 1010);
    const s = perspectiveScale(y) * rng.range(0.8, 2);
    const pig = rng.chance(0.6) ? EARTH.pebble : mix(EARTH.earthDark, EARTH.gravelShade, 0.4);
    L.fill(blob(x, y, s, s * 0.6, rng, { points: 6, irregularity: 0.3 }), jitter(pig, rng, 0.05), rng.range(0.25, 0.5));
    if (k % 300 === 299) {
      L.flush();
      yield;
    }
  }
  yield* L.dryParts({ opacity: 0.7, edge: 0.4, edgeWidth: 0.6, sharpness: 0.8, centreLift: 0.1, granulation: 0.2, flow: 0.2, flowScale: 6 });
}

/** The gravel path: worn paler down its middle, edged by darker grit, widening toward the viewer. */
function* paintPath(p: Painter, rng: Rng): Strokes {
  const walk = smoothPath(PATH.slice().reverse().map((q) => ({ x: q.x, y: q.y })), 8);
  const half = (t: number) => 12 + 30 * t * t + 6 * t;
  const body = ribbon(walk, half);
  yield* p.parts.lift(body, { rng, amount: 0.75, deform: 0.2, spread: 0.2, edge: 0.05 });
  yield* p.parts.glaze(body, mix(EARTH.gravel, EARTH.gravelWarm, 0.6), { rng, opacity: 0.35, deform: 0.15, spread: 0.15, edge: 0.15, granulation: 0.6, granules: 0.3 });
  // the trodden middle, a little compacted and warmer
  yield* p.parts.glaze(ribbon(walk, (t) => half(t) * 0.35, (t) => Math.sin(t * 9) * half(t) * 0.15), EARTH.gravelWarm, { rng, opacity: 0.2, deform: 0.3, spread: 0.3, edge: 0.02 });
  const edges: { pts: Pt[]; w: number }[] = [];
  for (const side of [-1, 1]) {
    for (let a = 0; a < walk.length - 3; ) {
      const n = rng.int(5, 12);
      const seg = walk.slice(a, a + n);
      const ts = seg.map((_, j) => (a + j) / (walk.length - 1));
      const edge = seg.map((q, j) => {
        const k = j < seg.length - 1 ? j : j - 1;
        const d = { x: seg[k + 1]!.x - seg[k]!.x, y: seg[k + 1]!.y - seg[k]!.y };
        const l = Math.hypot(d.x, d.y) || 1;
        return { x: q.x - (d.y / l) * half(ts[j]!) * side, y: q.y + (d.x / l) * half(ts[j]!) * side };
      });
      if (edge.length > 1) edges.push({ pts: edge, w: 3 + 4 * ts[0]! });
      a += n + rng.int(1, 4);
    }
  }
  const opts = { rng, pigment: mix(EARTH.gravelShade, EARTH.earthDark, 0.4), dryness: 0.55, wetness: 0.15 };
  const L = batchLayer(p, padRect(bounds(body), 8), { x: 0, y: 0, w: 60, h: 6 }, 4);
  if (L.empty) return;
  for (const [i, e] of edges.entries()) {
    dryBrushInto(L, p, e.pts, { ...opts, width: e.w });
    if (i % 8 === 7) {
      L.flush();
      yield;
    }
  }
  L.flush();
  yield;
  yield* L.dryParts({ ...dryBrushDry({ ...opts, width: 5 }), opacity: 0.6 });
}

// ── the walls ────────────────────────────────────────────────────────────────────────────

interface Stone {
  poly: Pt[];
  pig: Pigment;
  coping: boolean;
}

/** One wall's stones: a coping course of broad slabs, then flat pieces in rough courses, gaps between. */
function wallStones(i: number, rng: Rng): Stone[] {
  const w = WALLS[i]!;
  const top = WALL_TOPS[i]!;
  const x0 = top[0]!.x;
  const x1 = top[top.length - 1]!.x;
  const out: Stone[] = [];
  const courses: [number, number][] = [];
  for (let d = 0; d < w.h - 2; ) {
    const h = d === 0 ? rng.range(8, 10) : rng.range(6.5, 11);
    courses.push([d, Math.min(h, w.h - d)]);
    d += h;
  }
  for (const [c, [d, h]] of courses.entries()) {
    const coping = c === 0;
    for (let x = x0 + (c % 2 ? rng.range(-8, 0) : 0); x < x1; ) {
      const sw = coping ? rng.range(26, 56) : rng.range(12, 40) * (rng.chance(0.15) ? 0.5 : 1);
      const gap = rng.range(0.5, 1.3);
      const a = Math.max(x0, x + gap / 2);
      const b = Math.min(x1, x + sw - gap / 2);
      if (b - a > 3) {
        const dt = coping ? 0 : rng.range(-1.2, 1);
        const db = rng.range(-1, 1.4);
        const yt = (u: number) => copingY(i, u) + d + gap / 2 + dt;
        const yb = (u: number) => copingY(i, u) + d + h - gap / 2 + db;
        const ch = Math.min(1.4, (b - a) * 0.1);
        const tilt = rng.range(-0.8, 0.8);
        const m = (a + b) / 2 + rng.range(-0.2, 0.2) * (b - a);
        const poly: Pt[] = [
          { x: a + ch, y: yt(a) + tilt },
          { x: m, y: yt(m) + rng.range(-0.7, 0.4) },
          { x: b - ch, y: yt(b) - tilt },
          { x: b + rng.range(-0.6, 0.6), y: (yt(b) + yb(b)) / 2 },
          { x: b - ch, y: yb(b) - tilt * 0.5 },
          { x: m + rng.range(-3, 3), y: yb(m) + rng.range(-0.3, 0.7) },
          { x: a + ch, y: yb(a) + tilt * 0.5 },
          { x: a + rng.range(-0.6, 0.6), y: (yt(a) + yb(a)) / 2 },
        ];
        const warm = rng.next();
        const pig = warm < 0.25 ? EARTH.stoneWarm : warm < 0.55 ? EARTH.stoneCool : EARTH.stone;
        out.push({ poly, pig: jitter(pig, rng, 0.05), coping });
      }
      x += sw;
    }
  }
  return out;
}

const shift = (poly: readonly Pt[], dx: number, dy: number): Pt[] => poly.map((q) => ({ x: q.x + dx, y: q.y + dy }));

/** The cracks the crack slots stand in: a dark pocket of soil between the stones. */
const CRACKS = COAST_SLOTS.filter((s) => s.id.startsWith('crack-'));

/** The dry-stone walls, back to front: cast shade on the terrace below, joints, stones, stains, the lit coping, grass. */
export function* paintWalls(p: Painter, rng: Rng): Strokes {
  for (let i = 0; i < WALLS.length; i++) {
    const r = rng.fork(`wall-${i}`);
    const w = WALLS[i]!;
    const face = WALL_FACES[i]!;
    if (!inView(p, padRect(bounds(face), 24))) continue;
    const top = WALL_TOPS[i]!;
    const foot = top.map((q) => ({ x: q.x, y: q.y + wallDrop(i, q.x) }));
    // its shade on the terrace below, soft and lost toward the viewer
    yield* p.parts.glaze([...foot, ...foot.slice().reverse().map((q) => ({ x: q.x + 8, y: q.y + 16 }))], mix(EARTH.shadow, EARTH.gravelShade, 0.35), { rng: r, opacity: 0.4, deform: 0.12, spread: 0.15, edge: 0.04, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
    reserve(p, face);
    // the stones stay inside the face, which steps down into the slope at its seaward end
    p.ctx.save();
    p.ctx.beginPath();
    face.forEach((q, j) => (j ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
    p.ctx.clip();
    // the face's body: limestone, warmer up top in the sun, cooler and darker at the damp foot
    yield* p.parts.wetInWet(face, mix(EARTH.stone, EARTH.stoneWarm, 0.4), mix(EARTH.stoneCool, EARTH.joint, 0.25), { rng: r, angle: Math.PI / 2, split: 0.55, softness: 0.7, opacity: 0.45, deform: 0.01, spread: 0.01, edge: 0.1, granulation: 0.5, granules: 0.2 });
    const stones = wallStones(i, r.fork('stones'));
    const area = padRect(bounds(face), 4);
    const sample = { x: 0, y: 0, w: 30, h: 9 };
    // the joints: the face in shadow with every stone lifted out of it
    const J = batchLayer(p, area, sample, 3);
    if (!J.empty) {
      J.fill(face, EARTH.joint, 0.8);
      for (const s of stones) J.lift(s.poly, 1);
      for (const c of CRACKS) {
        const cy = c.y;
        if (Math.abs(cy - (copingY(i, c.x) + w.h * 0.45)) > w.h * 0.6) continue;
        J.fill(blob(c.x, cy + 2, 9, 5, r, { irregularity: 0.35, points: 9 }), shade(EARTH.soilDark, 0.15), 0.85);
      }
      J.flush();
      yield;
      yield* J.dryParts({ opacity: 0.62, edge: 0.3, edgeWidth: 0.8, sharpness: 0.7, centreLift: 0.05, granulation: 0.3, flow: 0.3, flowScale: 8 });
    }
    // the stones: each its own limestone, then the shade under each one's lower right
    const S = batchLayer(p, area, sample, 3);
    if (!S.empty) {
      for (const s of stones) S.fill(s.poly, s.pig, s.coping ? 0.4 : 0.5);
      S.flush();
      yield;
      yield* S.dryParts({ opacity: 0.6, edge: 0.5, edgeWidth: 1, sharpness: 0.6, centreLift: 0.2, granulation: 0.45, granules: 0.25, flow: 0.3, flowScale: 10 });
    }
    const D = batchLayer(p, area, sample, 3);
    if (!D.empty) {
      for (const s of stones) {
        D.fill(s.poly, mix(EARTH.stoneCool, EARTH.shadow, 0.5), 0.55);
        D.lift(shift(s.poly, -1.6, -2.2), 1);
      }
      D.flush();
      yield;
      yield* D.dryParts({ opacity: 0.6, edge: 0.3, edgeWidth: 0.8, sharpness: 0.5, centreLift: 0.05, granulation: 0.3, flow: 0.3, flowScale: 8 });
    }
    // lichen (ochre and grey) and rain stains running down from the coping
    const L = batchLayer(p, area, { x: 0, y: 0, w: 8, h: 5 }, 2);
    if (!L.empty) {
      for (let k = 0; k < Math.round(top.length * 0.9); k++) {
        const q = top[r.int(0, top.length - 1)]!;
        const y = q.y + r.range(2, w.h - 4);
        L.fill(blob(q.x + r.range(-3, 3), y, r.range(1.5, 4.5), r.range(1, 2.6), r, { points: 7, irregularity: 0.45 }), r.chance(0.55) ? EARTH.lichen : EARTH.lichenGrey, r.range(0.35, 0.6));
      }
      for (let k = 0; k < top.length / 8; k++) {
        const q = top[r.int(0, top.length - 1)]!;
        const len = r.range(0.3, 0.8) * w.h;
        L.fill(ribbon([{ x: q.x, y: q.y + 6 }, { x: q.x + r.range(-1, 1), y: q.y + 6 + len }], (t) => r.range(1.2, 2.6) * (1 - t * 0.6)), mix(EARTH.joint, EARTH.stoneCool, 0.4), 0.18);
      }
      L.flush();
      yield;
      yield* L.dryParts({ opacity: 0.7, edge: 0.35, edgeWidth: 0.7, sharpness: 0.6, centreLift: 0.15, granulation: 0.5, flow: 0.4, flowScale: 8 });
    }
    p.ctx.restore();
    // the coping's lit top, broken, and the shade line under its course
    const lit: Pt[][] = [];
    const under: Pt[][] = [];
    for (let k = 0; k < top.length - 1; ) {
      const n = r.int(4, 10);
      const seg = top.slice(k, k + n);
      if (seg.length > 1) {
        lit.push(seg.map((q) => ({ x: q.x, y: q.y - 0.6 })));
        under.push(seg.map((q) => ({ x: q.x, y: q.y + 10 })));
      }
      k += n + r.int(0, 2);
    }
    const marks: [Pt[][], StrokeOptions, DryOptions][] = [
      [under, { rng: r, pigment: mix(EARTH.joint, EARTH.shadow, 0.4), width: 2, dryness: 0.5, wetness: 0.15 }, { opacity: 0.3 }],
      [lit, { rng: r, pigment: lighten(EARTH.stone, 0.4), width: 3, dryness: 0.3, wetness: 0.2 }, { opacity: 0.85, blend: 'source-over' }],
    ];
    for (const [list, opts, dry] of marks) {
      const C = batchLayer(p, padRect(bounds(list.flat()), 4), { x: 0, y: 0, w: 60, h: 4 }, 3);
      if (C.empty) continue;
      for (const m of list) dryBrushInto(C, p, m, opts);
      C.flush();
      yield;
      yield* C.dryParts({ ...dryBrushDry(opts), ...dry });
    }
    // the foot in the shade of its own bulge, and a fine lost edge where the terrace meets it
    yield* p.parts.glaze([...foot.map((q) => ({ x: q.x, y: q.y - w.h * 0.35 })), ...foot.slice().reverse()], mix(EARTH.shadow, EARTH.joint, 0.3), { rng: r, opacity: 0.25, edge: 0.03, deform: 0.1, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.5 } });
    for (const [wi, x, d] of WALL_GRASS) {
      if (wi !== i) continue;
      p.grassTuft({ x, y: copingY(i, x) + d }, { rng: r, height: 16, blades: r.int(7, 11), spread: 10, lean: r.range(-0.3, 0.1), pigments: [lighten(EARTH.straw, 0.1), EARTH.straw, EARTH.strawDark, mix(EARTH.strawDark, '#7f8a5a', 0.4)], ground: false, opacity: 0.7 });
    }
    yield;
  }
  yield* paintFlights(p, rng.fork('steps'));
}

/** The stone flights up the walls (the beach flight is painted over the shore's rock, `paintShoreRocks`). */
function* paintFlights(p: Painter, rng: Rng): Strokes {
  for (let f = 0; f < FLIGHTS.length; f++) if (f !== BEACH_FLIGHT) yield* paintFlight(p, f, rng.fork(`flight-${f}`));
}

/** One stone flight: each step a rough slab, its lit tread over a shaded riser, casting a little shade right and below. */
export function* paintFlight(p: Painter, f: number, rf: Rng): Strokes {
  const flight = FLIGHTS[f]!;
  const slabs = flight.map((s) => [...s.tread.slice(0, 2), s.riser[2]!, s.riser[3]!]);
  const b = bounds(slabs.flat());
  if (!inView(p, padRect(b, 12))) return;
  // the shade the flight casts on the wall face and the ground to its right
  yield* p.parts.glaze(slabs.flatMap((q) => [q[1]!, q[2]!]).concat(slabs.slice().reverse().flatMap((q) => [{ x: q[2]!.x + 7, y: q[2]!.y + 3 }, { x: q[1]!.x + 7, y: q[1]!.y + 4 }])), mix(EARTH.joint, EARTH.shadow, 0.5), { rng: rf, opacity: 0.4, edge: 0.05, deform: 0.15 });
  for (const q of slabs) reserve(p, q);
  const T = batchLayer(p, padRect(b, 4), { x: 0, y: 0, w: 50, h: 10 }, 3);
  if (T.empty) return;
  for (const s of flight) {
    T.fill(s.riser, jitter(mix(EARTH.stoneCool, EARTH.joint, 0.4), rf, 0.05), 0.62);
    T.fill(s.tread, jitter(mix(EARTH.stone, EARTH.stoneWarm, 0.5), rf, 0.06), 0.42);
  }
  T.flush();
  yield;
  yield* T.dryParts({ opacity: 0.8, edge: 0.5, edgeWidth: 0.8, sharpness: 0.75, centreLift: 0.2, granulation: 0.5, granules: 0.25, flow: 0.3, flowScale: 10 });
  for (const s of flight) {
    // the worn, lit nose of each tread, and the dark line where the riser tucks under
    p.dryBrush([s.tread[3]!, s.tread[2]!], { rng: rf, pigment: lighten(EARTH.stone, 0.4), width: 2.2, opacity: 0.75, dryness: 0.45, blend: 'source-over' });
    p.dryBrush([s.riser[3]!, s.riser[2]!].map((q) => ({ x: q.x, y: q.y - 0.5 })), { rng: rf, pigment: EARTH.joint, width: 1.8, opacity: 0.5, dryness: 0.5 });
  }
  yield;
}

// ── the beds and the jars ────────────────────────────────────────────────────────────────

/** The tended beds: darker tilled soil, a raked surface, a lit rim on the gravel side; then the jars. */
export function* paintBeds(p: Painter, rng: Rng): Strokes {
  const beds = BEDS.filter((bed) => inView(p, padRect(bounds(bed.poly), 12)));
  if (beds.length) {
    const area = padRect(bounds(beds.flatMap((b) => b.poly)), 8);
    const B = batchLayer(p, area, { x: 0, y: 0, w: 120, h: 40 }, 6);
    const furrows: { pts: Pt[]; rng: Rng }[] = [];
    for (const bed of beds) {
      const r = rng.fork(`bed-${BEDS.indexOf(bed)}`);
      // a ragged outline, the soil darker toward the coping where it was last watered
      const ragged = bed.poly.map((q, j) => ({ x: q.x + r.range(-1.5, 1.5), y: q.y + Math.sin(j * 1.7 + r.range(0, 6)) * 1.4 }));
      B.fill(ragged, mix(EARTH.soil, EARTH.earth, 0.3), 0.42);
      const nFar = bed.poly.findIndex((q, j) => j > 0 && q.x < bed.poly[j - 1]!.x) - 3;
      const far = bed.poly.slice(0, Math.max(2, nFar));
      const near = far.map((q) => ({ x: q.x, y: copingY(bed.wall, q.x) - 3 }));
      B.fill([...far.map((q, j) => ({ x: q.x, y: q.y + (near[j]!.y - q.y) * 0.55 })), ...near.slice().reverse()], EARTH.soilDark, 0.12);
      for (let f = 0.18; f < 0.95; f += 0.16) {
        furrows.push({ pts: far.slice(1, -1).map((q, j) => ({ x: q.x, y: q.y + (near[j + 1]!.y - q.y) * f + r.range(-0.5, 0.5) })), rng: r });
      }
    }
    B.flush();
    yield;
    yield* B.dryParts({ opacity: 0.85, edge: 0.3, edgeWidth: 1.4, sharpness: 0.45, centreLift: 0.15, granulation: 0.6, granules: 0.3, flow: 0.45, flowScale: 16 });
    const opts = { pigment: EARTH.soilDark, width: 1.8, dryness: 0.6, wetness: 0.1 };
    const F = batchLayer(p, area, { x: 0, y: 0, w: 80, h: 4 }, 3);
    for (const [i, m] of furrows.entries()) {
      if (m.pts.length > 1) dryBrushInto(F, p, m.pts, { ...opts, rng: m.rng });
      if (i % 12 === 11) {
        F.flush();
        yield;
      }
    }
    F.flush();
    yield;
    yield* F.dryParts({ ...dryBrushDry(opts), opacity: 0.45 });
    // the back edge against the gravel: a fine lit lip of raked-up grit
    const lips = beds.map((bed) => bed.poly.slice(0, Math.max(2, bed.poly.findIndex((q, j) => j > 0 && q.x < bed.poly[j - 1]!.x) - 3)).map((q) => ({ x: q.x, y: q.y - 1.2 })));
    const lipOpts = { rng, pigment: lighten(EARTH.gravel, 0.35), width: 2.4, dryness: 0.5, wetness: 0.15 };
    const Lp = batchLayer(p, area, { x: 0, y: 0, w: 80, h: 4 }, 3);
    for (const l of lips) dryBrushInto(Lp, p, l, lipOpts);
    Lp.flush();
    yield;
    yield* Lp.dryParts({ ...dryBrushDry(lipOpts), opacity: 0.7, blend: 'source-over' });
  }
  for (const [i, jar] of JARS.entries()) if (inView(p, { x: jar.x - jar.h, y: jar.y - jar.h * 1.2, w: jar.h * 3, h: jar.h * 1.5 })) yield* paintJar(p, rng.fork(`jar-${i}`), jar);
}

/** A terracotta pithos: a round shoulder over a tapering foot, its rolled lip, lit on the left, its shadow cast right. */
function* paintJar(p: Painter, rng: Rng, jar: (typeof JARS)[number]): Strokes {
  const { x, y, h, lean } = jar;
  const w = h * 0.7;
  const at = (u: number, v: number): Pt => ({ x: x + u * w + v * h * lean, y: y - v * h });
  const side = (u: number): Pt[] => [at(u * 0.32, 0), at(u * 0.46, 0.25), at(u * 0.5, 0.55), at(u * 0.44, 0.78), at(u * 0.26, 0.9), at(u * 0.2, 0.94)];
  const body = smoothPath([...side(-1).reverse(), ...side(1)], 2);
  yield* p.parts.glaze(blob(x + w * 0.55, y + 1, w * 0.8, h * 0.09, rng, { irregularity: 0.3 }), mix(EARTH.shadow, EARTH.gravelShade, 0.3), { rng, opacity: 0.45, edge: 0.05, deform: 0.2, fade: { angle: 0, start: 0.4, amount: 1, ragged: 0.5 } });
  reserve(p, body);
  yield* p.parts.wetInWet(body, EARTH.potLit, EARTH.potDark, { rng, angle: -0.25, split: 0.45, softness: 0.55, opacity: 0.8, deform: 0.01, spread: 0.02, edge: 0.35, edgeWidth: 1, sharpness: 0.7, granulation: 0.5, granules: 0.2 });
  // the rolled lip and the dark mouth, a band of raised cord round the shoulder
  const lip = blob(at(0, 0.95).x, at(0, 0.95).y, w * 0.24, h * 0.045, rng, { irregularity: 0.05, points: 12 });
  p.wash(lip, EARTH.pot, { rng, opacity: 0.8, layers: 4, edge: 0.4, sharpness: 0.7 });
  p.wash(blob(at(0, 0.955).x, at(0, 0.955).y, w * 0.15, h * 0.022, rng, { irregularity: 0.05, points: 10 }), shade(EARTH.potDark, 0.3), { rng, opacity: 0.85, layers: 3, edge: 0.3, sharpness: 0.8 });
  const band = [at(-0.47, 0.62), at(-0.2, 0.6), at(0.2, 0.6), at(0.47, 0.62)];
  p.stroke(band, { rng, pigment: EARTH.potDark, width: 1.4, opacity: 0.5, taper: [0.2, 0.2] });
  p.dryBrush([at(-0.3, 0.2), at(-0.4, 0.5), at(-0.32, 0.8)], { rng, pigment: lighten(EARTH.potLit, 0.3), width: 3, opacity: 0.55, dryness: 0.6, blend: 'source-over' });
  // a lichen bloom and earth splashed up on its foot
  p.dab(at(0.18, 0.4), EARTH.lichenGrey, { rng, variant: 'round', length: 4, width: 3, opacity: 0.5, layers: 2 });
  p.dryBrush([at(-0.3, 0.06), at(0.3, 0.06)], { rng, pigment: EARTH.earthDark, width: 3, opacity: 0.3, dryness: 0.7 });
  yield;
}
