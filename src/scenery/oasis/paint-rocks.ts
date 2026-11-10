/**
 * The oasis's rock (O2): the red-ochre bluff of conglomerate and sandstone, and the ksar of pisé
 * growing out of it in the same golden-red earth. Lit from the upper right (ADR 0300), painted on
 * white in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Rock.
 */
import { createRng, type Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, closedResample, insetPolygon, createSimplex2D, lighten, mix, rgba, shade, smoothPath, type DryOptions, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { FOOTING, KSAR_PALMS, KSAR_SHAPES, taper, windows, type BlockShape } from './ksar';
import { BLUFF } from './layout';

/** The earth both are made of: golden where the sun strikes, red-ochre in the body, deep in the cuts. */
export const EARTH = {
  lit: '#efc18a',
  gold: '#dca06a',
  body: '#c8784e',
  deep: '#94503e',
  // violet-rose shade on the faces turned from the sun
  shade: '#9e7183',
  cool: '#8c89a1',
  dark: '#5a3a36',
  sand: '#ebcb8b',
} satisfies Record<string, Pigment>;
/** The bluff's painted tone just under the ksar, for the solid seat over the walls' feet. */
const SEAT: Pigment = '#d3a088';
const PEBBLES: readonly Pigment[] = ['#b98a6a', '#d9b48c', '#8f5a48', '#c9a080', '#a79a90', '#e0c39c', '#7d5446'];

/** The shapes daylight (O5) shades and lights: the bluff and each block's front and flank. */
export const ROCK_SHAPES = { bluff: BLUFF, ksar: KSAR_SHAPES } as const;

function trace(p: Painter, shape: readonly Pt[]): void {
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
}

/** Paper over `shape`, so nothing painted earlier shows through it. */
function fillPaper(p: Painter, shape: readonly Pt[]): void {
  fillUnder(p, shape, PAPER_WHITE);
}

/** An opaque underlayer over `shape`: hides what is behind, and no white shows where a wash stops short of the edge. */
function fillUnder(p: Painter, shape: readonly Pt[], pigment: Pigment): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.fillStyle = rgba(pigment);
  p.ctx.fill();
  p.ctx.restore();
}

function clipTo(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  trace(p, shape);
  p.ctx.clip();
}

/** A hand-cut outline: resampled and nudged by noise (washes would smooth the shape's steps). */
export function roughOutline(poly: readonly Pt[], rng: Rng, amp = 1.6, spacing = 4): Pt[] {
  const noise = createSimplex2D(rng.fork('rough'));
  return closedResample(poly, spacing).map((q) => ({ x: q.x + noise(q.x / 14, q.y / 14) * amp, y: q.y + noise(q.y / 14 + 40, q.x / 14) * amp }));
}

function box(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

/** The bluff's top edge at x (its highest crossing). */
export function bluffTopAt(x: number): number {
  let best = Infinity;
  for (let i = 0; i < BLUFF.length; i++) {
    const a = BLUFF[i]!;
    const b = BLUFF[(i + 1) % BLUFF.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    best = Math.min(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best;
}

/** The bluff's foot at x (its lowest crossing). */
function bluffFootAt(x: number): number {
  let best = -Infinity;
  for (let i = 0; i < BLUFF.length; i++) {
    const a = BLUFF[i]!;
    const b = BLUFF[(i + 1) % BLUFF.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    best = Math.max(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best;
}

/** The shoulder's right edge at y (for the runnels and strata that wrap round it). */
const SHOULDER = BLUFF.filter((q, i) => i >= BLUFF.findIndex((r) => r.x === 900) && i <= BLUFF.findIndex((r) => r.x === 1022));
function shoulderAt(y: number): number {
  for (let i = 1; i < SHOULDER.length; i++) {
    const a = SHOULDER[i - 1]!;
    const b = SHOULDER[i]!;
    if (y <= b.y && y >= a.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
  }
  return y < SHOULDER[0]!.y ? SHOULDER[0]!.x : SHOULDER[SHOULDER.length - 1]!.x;
}

// ── the bluff ───────────────────────────────────────────────────────────────────────────────

/** The hard beds that stand out as ledges (caprock), by height; the softer beds between them. */
const HARD_BEDS = [236, 290, 342, 386] as const;
const SOFT_BEDS = [254, 270, 314, 364, 404] as const;
const SHADOW = mix(EARTH.shade, EARTH.cool, 0.42);
const RECESS = mix(EARTH.shade, EARTH.deep, 0.45);
const VARNISH = mix(EARTH.dark, EARTH.shade, 0.35);
const SCREE = mix(EARTH.sand, EARTH.body, 0.3);

type Noise = (a: number, b: number) => number;

/** A gully: a funnel notched into the rim, narrowing to a chute, opening onto the scree. */
interface Gully {
  x: number;
  top: number;
  foot: number;
  /** how deeply it is cut, 0..1 */
  depth: number;
  /** its west wall (turned to the sun) and east wall (in shade), top → foot */
  left: Pt[];
  right: Pt[];
}

/** Where the cliff gives way to its scree apron. */
function screeAt(x: number, noise: Noise): number {
  return bluffFootAt(x) - 40 - noise(x / 80, 5) * 9;
}

/** The gullies left → right, cut between buttresses; the shoulder's prow stays whole. */
function layGullies(rng: Rng, noise: Noise): Gully[] {
  const out: Gully[] = [];
  for (let x = rng.range(30, 70); x < 880; x += rng.range(80, 165)) {
    const top = bluffTopAt(x) + (x > 424 ? 16 : 0) + rng.range(-2, 8);
    const foot = screeAt(x, noise) + 4;
    const depth = rng.range(0.35, 1);
    const w = rng.range(18, 34) + depth * 10;
    const lean = rng.range(-6, 6);
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.1) {
      const y = top + t * (foot - top);
      const cx = x + lean * t + noise(x / 20, t * 3) * 3;
      const half = w * ((x > 424 ? 0.4 : 0.75) * (1 - t) ** 2.2 + 0.11 + 0.14 * t * t);
      left.push({ x: cx - half * (1 + 0.3 * noise(t * 4, x)), y });
      right.push({ x: cx + half * (0.9 + 0.3 * noise(x, t * 4)), y });
    }
    out.push({ x, top, foot, depth, left, right });
  }
  return out;
}

/** The bluff's fixed form (the brushwork varies with the seed, the cliff does not): its gullies and hard beds. */
const FORM_NOISE = createSimplex2D(createRng('bluff-form'));
export const BLUFF_FORM = { gullies: layGullies(createRng('bluff-gullies'), FORM_NOISE), hard: HARD_BEDS } as const;

/** A gully wall's x at height y (its ends held beyond them). */
function wallAt(edge: readonly Pt[], y: number): number {
  if (y <= edge[0]!.y) return edge[0]!.x;
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1]!;
    const b = edge[i]!;
    if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / Math.max(1e-6, b.y - a.y);
  }
  return edge[edge.length - 1]!.x;
}

/** The buttresses: the rock between two gullies, as [west edge, east edge] at a height. */
function buttresses(gullies: readonly Gully[]): ((y: number) => [number, number])[] {
  const out: ((y: number) => [number, number])[] = [];
  for (let i = 0; i <= gullies.length; i++) {
    const a = gullies[i - 1];
    const b = gullies[i];
    out.push((y) => [a ? wallAt(a.right, y) : -30, b ? wallAt(b.left, y) : 1030]);
  }
  return out;
}

/** A band from x0 to x1, d0..d1 below height y, with a slow sway. */
function bedBand(y: number, x0: number, x1: number, d0: number, d1: number, sway: (x: number) => number, ragged = 0): Pt[] {
  const top: Pt[] = [];
  const low: Pt[] = [];
  for (let x = x0; x <= x1 + 0.01; x += Math.max(3, (x1 - x0) / 12)) {
    const s = sway(x);
    top.push({ x, y: y + d0 + s });
    const ends = ragged ? Math.min(1, (x - x0) / 14, (x1 - x) / 14) : 1;
    low.push({ x, y: y + d0 + s + Math.max(1, (d1 - d0) * ends + ragged * Math.sin(x * 0.21 + y) * Math.sin(x * 0.067 + d1)) });
  }
  return [...top, ...low.reverse()];
}

/**
 * The bluff: a Draa sandstone and conglomerate cliff. Buttresses between eroded gullies, each lit
 * on its sun side (right) and turned into cool shade on the other; horizontal beds with harder
 * caprock ledges over dark undercuts; desert varnish hanging from the lips; scree fans at the foot.
 */
export function* paintBluff(p: Painter, rng: Rng): Strokes {
  const body = roughOutline(BLUFF, rng, 1.8);
  const b = bounds(body);
  const noise = FORM_NOISE;
  const gullies = BLUFF_FORM.gullies;
  fillPaper(p, body);
  clipTo(p, body);
  yield;
  // a red-ochre body, rosier on the left, golden toward the shoulder: the shade is glazed over it
  yield* p.parts.wetInWet(box(b.x - 20, b.y - 20, b.x + b.w + 20, b.y + b.h + 20), mix(mix(EARTH.body, EARTH.gold, 0.25), EARTH.shade, 0.2), mix(EARTH.gold, EARTH.body, 0.3), {
    rng, angle: -0.2, split: 0.55, softness: 0.7, opacity: 0.78, deform: 0.04, spread: 0.03, edge: 0, granulation: 0.6, granules: 0.18, flow: 0.55, flowScale: 90,
    drops: [{ pigment: EARTH.deep, at: { x: 260, y: 400 }, size: 0.25, alpha: 0.3 }, { pigment: EARTH.body, at: { x: 640, y: 380 }, size: 0.25, alpha: 0.3 }, { pigment: EARTH.lit, at: { x: 960, y: 370 }, size: 0.2, alpha: 0.4 }],
  });
  yield;
  // the left end: the ridge's west face turned away in cool shade, its crown and stepped east side to the sun
  yield* p.parts.glaze({ cx: 20, cy: 340, rx: 150, ry: 150 }, SHADOW, { rng, opacity: 0.45, deform: 0.2, spread: 0.3, fade: { angle: 0, start: 0.3, amount: 1, ragged: 0.6 } });
  yield;
  yield* p.parts.glaze([{ x: 120, y: 214 }, { x: 206, y: 228 }, { x: 262, y: 266 }, { x: 330, y: 290 }, { x: 410, y: 316 }, { x: 380, y: 340 }, { x: 300, y: 320 }, { x: 200, y: 280 }, { x: 130, y: 250 }], EARTH.lit, { rng, opacity: 0.35, deform: 0.15, spread: 0.2, blend: 'source-over', fade: { angle: Math.PI * 0.7, start: 0.3, amount: 1, ragged: 0.7 } });
  yield;
  // the right end: the prow's face to the sun, a core shade further in
  const rim: Pt[] = [];
  const core: Pt[] = [];
  for (let y = 318; y <= 480; y += 8) {
    const x = shoulderAt(y);
    rim.push({ x: x + 6, y });
    core.push({ x: x - 52 - (y - 318) * 0.12, y });
  }
  yield* p.parts.glaze([...rim, ...rim.slice().reverse().map((q) => ({ x: q.x - 46, y: q.y }))], EARTH.lit, { rng, opacity: 0.4, deform: 0.12, spread: 0.15, blend: 'source-over', fade: { angle: Math.PI, start: 0.4, amount: 1, ragged: 0.6 } });
  yield;
  yield* p.parts.glaze([...core.map((q) => ({ x: q.x + 16, y: q.y })), ...core.slice().reverse().map((q) => ({ x: q.x - 34, y: q.y }))], SHADOW, { rng, opacity: 0.3, deform: 0.25, spread: 0.35, fade: { angle: Math.PI, start: 0.25, amount: 1, ragged: 0.8 } });
  yield;
  yield* paintButtresses(p, gullies, rng.fork('buttresses'));
  yield* paintLedges(p, gullies, noise, rng.fork('ledges'));
  yield* paintGullies(p, gullies, rng.fork('gully'));
  yield* paintVarnish(p, gullies, rng.fork('varnish'));
  yield* paintScree(p, gullies, noise, rng.fork('scree'));
  p.ctx.restore();
  // the lit rim along the skyline where the rock turns to the sun, broken where a gully notches it
  const lip = closedResample(BLUFF, 3).filter((q) => q.y <= bluffTopAt(q.x) + 0.5 && q.y < bluffFootAt(q.x) - 20 && ((q.x > 100 && q.x < 430) || q.x > 880));
  for (let i = 0; i < lip.length; ) {
    const run: Pt[] = [];
    while (i < lip.length && run.length < 12) {
      const q = lip[i++]!;
      if (run.length && Math.hypot(q.x - run[run.length - 1]!.x, q.y - run[run.length - 1]!.y) > 8) break;
      run.push({ x: q.x - 1.2, y: q.y + 2 });
    }
    const mid = run[run.length >> 1];
    if (!mid || run.length < 3 || gullies.some((g) => mid.x > g.left[0]!.x - 2 && mid.x < g.right[0]!.x + 2 && g.top < mid.y + 6)) continue;
    p.dryBrush(run, { rng, pigment: lighten(EARTH.lit, 0.14), width: 3, opacity: 0.6, dryness: 0.4, blend: 'source-over' });
  }
  yield;
  // the scree spilling from the gully mouths onto the terrace
  yield* wetBatch(p, gullies.map((g) => {
    const y = bluffFootAt(g.x);
    const w = rng.range(34, 56);
    return { poly: roughOutline([{ x: g.x - 10, y: y - 14 }, { x: g.x + 10, y: y - 14 }, { x: g.x + w, y: y + 7 }, { x: g.x - w, y: y + 7 }], rng, 2.5, 5), alpha: 0.32 };
  }), SCREE, { edge: 0.05, granulation: 0.7, granules: 0.3 });
}

/** Marks wet together and dried in one pass: a glaze each would pay a drying pass each. */
function* wetBatch(p: Painter, marks: readonly { poly: readonly Pt[]; alpha: number }[], pigment: Pigment, dry: DryOptions): Strokes {
  if (!marks.length) return;
  const r = bounds(marks.flatMap((m) => m.poly));
  const L = p.layer({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 });
  for (const m of marks) L.fill(m.poly, pigment, m.alpha);
  L.flush();
  yield;
  yield* L.dryParts(dry);
  yield;
}

/** A band beside a wall, stacked three times narrower toward it: soft away from the wall, strongest at it. */
function graded(wall: readonly Pt[], width: number, alpha: number, rng: Rng): { poly: Pt[]; alpha: number }[] {
  return [1, 0.62, 0.3].map((k) => ({
    poly: roughOutline([...wall, ...wall.slice().reverse().map((q) => ({ x: q.x + width * k, y: q.y }))], rng, 2.2 + 2 * k, 5),
    alpha: alpha / 3,
  }));
}

/** Each buttress: its west face in cool shade along the gully's wall, its east face catching the sun. */
function* paintButtresses(p: Painter, gullies: readonly Gully[], rng: Rng): Strokes {
  const all = buttresses(gullies);
  const shade: { poly: Pt[]; alpha: number }[] = [];
  const lit: { poly: Pt[]; alpha: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    const edges = all[i]!;
    const [m0, m1] = edges(380);
    const w = m1 - m0;
    const top = Math.min(bluffTopAt(Math.max(-20, m0)), bluffTopAt(Math.min(1020, m1)), bluffTopAt((m0 + m1) / 2)) - 6;
    const foot = 486;
    const ys: number[] = [];
    for (let y = top; y <= foot; y += (foot - top) / 8) ys.push(y);
    if (i > 0) shade.push(...graded(ys.map((y) => ({ x: edges(y)[0] - 2, y })), w * rng.range(0.3, 0.5), rng.range(0.45, 0.62), rng));
    if (i < all.length - 1) lit.push(...graded(ys.map((y) => ({ x: edges(y)[1] - 1, y })), -w * rng.range(0.2, 0.36), rng.range(0.26, 0.38), rng));
    // a vertical joint or two splitting the buttress, broken by the beds
    for (let k = 0; k < (w > 95 ? 2 : 1); k++) {
      if (!rng.chance(0.6)) continue;
      const jx = m0 + w * rng.range(0.4, 0.75);
      const y0 = Math.max(bluffTopAt(jx) + 16, rng.pick(HARD_BEDS) + 14);
      const y1 = Math.min(bluffFootAt(jx) - 46, y0 + rng.range(26, 70));
      if (y1 - y0 < 18) continue;
      const pts = [{ x: jx, y: y0 }, { x: jx + rng.range(-1.5, 1.5), y: (y0 + y1) / 2 }, { x: jx + rng.range(-2, 2), y: y1 }];
      p.stroke(pts, { rng, pigment: RECESS, width: rng.range(1.4, 2.2), taper: [0.2, 0.5], opacity: 0.32, wetness: 0.35, dryness: 0.4, wobble: 0.15 });
      p.dryBrush(pts.map((q) => ({ x: q.x + 2, y: q.y })), { rng, pigment: EARTH.lit, width: 1.4, opacity: 0.3, dryness: 0.55, blend: 'source-over' });
    }
  }
  yield;
  yield* wetBatch(p, shade, SHADOW, { edge: 0.12, sharpness: 0.4, granulation: 0.4 });
  yield* wetBatch(p, lit, mix(EARTH.lit, EARTH.gold, 0.3), { edge: 0, granulation: 0.3, blend: 'source-over' });
}

/**
 * The beds across each buttress: soft ones as faint broken lines; hard caprock as a ledge, a lit
 * lip and a pale face over a dark undercut that deepens into recesses here and there. Each
 * buttress carries them at its own small offset, and now and then one has weathered away.
 */
function* paintLedges(p: Painter, gullies: readonly Gully[], noise: Noise, rng: Rng): Strokes {
  const sway = (x: number) => noise(x / 120, 11) * 2.5 + Math.max(0, x - 900) * 0.05;
  const span = (y: number, edges: (y: number) => [number, number]): [number, number] | null => {
    const [e0, e1] = edges(y);
    let x0: number | null = null;
    let x1 = e0;
    for (let x = e0 + 3; x <= e1 - 3; x += 3) {
      const ok = y + sway(x) > bluffTopAt(x) + 5 && y + sway(x) < screeAt(x, noise) + 4;
      if (ok && x0 === null) x0 = x;
      if (ok) x1 = x;
      else if (x0 !== null) break;
    }
    return x0 !== null && x1 - x0 > 10 ? [x0, x1] : null;
  };
  const faces: { poly: Pt[]; alpha: number }[] = [];
  const cuts: { poly: Pt[]; alpha: number }[] = [];
  const holes: { poly: Pt[]; alpha: number }[] = [];
  for (const edges of buttresses(gullies)) {
    const dy = rng.range(-4, 4);
    for (const y0 of SOFT_BEDS) {
      const s = span(y0 + dy, edges);
      if (!s || !rng.chance(0.5)) continue;
      const [x0, x1] = s;
      const a = x0 + rng.range(0, (x1 - x0) * 0.3);
      const c = x1 - rng.range(0, (x1 - x0) * 0.3);
      const pts = [0, 0.5, 1].map((t) => ({ x: a + (c - a) * t, y: y0 + dy + sway(a + (c - a) * t) + rng.range(-0.8, 0.8) }));
      p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + 2 })), { rng, pigment: mix(EARTH.shade, EARTH.deep, 0.3), width: rng.range(1.4, 2.4), opacity: 0.24, dryness: 0.6 });
      if (rng.chance(0.5)) p.dryBrush(pts, { rng, pigment: EARTH.lit, width: rng.range(1, 1.8), opacity: 0.26, dryness: 0.6, blend: 'source-over' });
    }
    for (const y0 of HARD_BEDS) {
      const y = y0 + dy + rng.range(-1.5, 1.5);
      const s = span(y, edges);
      if (!s || !rng.chance(0.9)) continue;
      const x0 = s[0] + rng.range(0, 0.18) * (s[1] - s[0]);
      const x1 = s[1] - rng.range(0, 0.18) * (s[1] - s[0]);
      const th = rng.range(4, 9);
      const cut = th + rng.range(5, 9);
      faces.push({ poly: roughOutline(bedBand(y, x0, x1, 0, th, sway), rng, 0.8, 3), alpha: 0.42 });
      cuts.push({ poly: roughOutline(bedBand(y, x0 - 2, x1 + 2, th, cut, sway, 3), rng, 1, 3), alpha: 0.4 });
      cuts.push({ poly: bedBand(y, x0 + 4, x1 - 4, th, th + (cut - th) * 0.5, sway, 1.5), alpha: 0.22 });
      for (let x = x0; x < x1 - 4; ) {
        const len = Math.min(x1 - x, rng.range(24, 70));
        const pts = [0, 0.5, 1].map((t) => ({ x: x + len * t, y: y + sway(x + len * t) + 0.5 }));
        p.dryBrush(pts, { rng, pigment: lighten(EARTH.lit, 0.12), width: rng.range(1.8, 2.8), opacity: 0.55, dryness: 0.45, blend: 'source-over' });
        if (rng.chance(0.5)) p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + th + 0.5 })), { rng, pigment: mix(EARTH.dark, EARTH.shade, 0.4), width: rng.range(1.2, 2.6), opacity: 0.32, dryness: 0.5 });
        x += len + rng.range(3, 16);
      }
      // a recess where the soft rock under the ledge has weathered back
      if (x1 - x0 > 40 && rng.chance(0.45)) {
        const cx = rng.range(x0 + 12, x1 - 12);
        holes.push({ poly: blob(cx, y + sway(cx) + th + 4, rng.range(7, 15), rng.range(3, 5), rng, { irregularity: 0.3, points: 12 }), alpha: 0.55 });
      }
    }
    yield;
  }
  yield* wetBatch(p, faces, lighten(EARTH.lit, 0.04), { edge: 0, granulation: 0.3, blend: 'source-over' });
  yield* wetBatch(p, cuts, RECESS, { edge: 0.25, sharpness: 0.5, granulation: 0.4 });
  yield* wetBatch(p, holes, mix(RECESS, EARTH.dark, 0.35), { edge: 0.3, sharpness: 0.5 });
}

/** The gullies: a funnel in shade, its sun-facing west wall catching the light, a dark cleft down its chute. */
function* paintGullies(p: Painter, gullies: readonly Gully[], rng: Rng): Strokes {
  const funnels: { poly: Pt[]; alpha: number }[] = [];
  const walls: { poly: Pt[]; alpha: number }[] = [];
  for (const g of gullies) {
    const axis = g.left.map((q, i) => ({ x: (q.x + g.right[i]!.x) / 2, y: q.y }));
    const d = g.depth;
    funnels.push({ poly: roughOutline([...g.left, ...g.right.slice().reverse()], rng, 1.5, 4), alpha: 0.18 + 0.26 * d });
    walls.push({ poly: roughOutline([...axis.map((q) => ({ x: q.x - 1, y: q.y })), ...g.right.slice().reverse()], rng, 1.2, 4), alpha: 0.14 + 0.3 * d });
    const chute = axis.slice(3);
    if (d > 0.55) p.stroke(chute.map((q, i) => ({ x: q.x + Math.sin(i * 1.7 + g.x) * 0.8, y: q.y })), { rng, pigment: mix(EARTH.dark, RECESS, 0.4), width: rng.range(1.8, 2.8), taper: [0.2, 0.5], opacity: 0.42, wetness: 0.45, dryness: 0.3, wobble: 0.2 });
    p.dryBrush(g.left.slice(1, -1).map((q) => ({ x: q.x + 2.2, y: q.y })), { rng, pigment: lighten(EARTH.lit, 0.08), width: 2.4, opacity: 0.45, dryness: 0.5, blend: 'source-over' });
  }
  yield;
  yield* wetBatch(p, funnels, SHADOW, { edge: 0.2, sharpness: 0.45, granulation: 0.4 });
  yield* wetBatch(p, walls, RECESS, { edge: 0.3, sharpness: 0.5 });
}

/** Desert varnish: dark stains hanging from the lips in loose curtains, long and short, never a row of drips. */
function* paintVarnish(p: Painter, gullies: readonly Gully[], rng: Rng): Strokes {
  const stains: { poly: Pt[]; alpha: number }[] = [];
  for (const y of [...HARD_BEDS, 0]) {
    for (let cx = rng.range(-10, 80); cx < 1000; cx += rng.range(90, 200)) {
      const from = y === 0 ? bluffTopAt(cx) + 4 : y + 12;
      if (from < bluffTopAt(cx) + 2 || from > bluffFootAt(cx) - 60) continue;
      if (gullies.some((g) => Math.abs(g.x - cx) < 10)) continue;
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const x = cx + rng.range(-24, 24);
        const len = rng.range(10, 50) * (rng.chance(0.25) ? 1.8 : 1);
        const w = rng.range(2.5, 9);
        const end = Math.min(from + len, bluffFootAt(x) - 44);
        if (end - from < 8) continue;
        const drift = rng.range(-2, 2);
        const a = rng.range(0.14, 0.3);
        // stacked shorter toward the lip: darkest where it hangs from, lost toward its end
        for (const k of [1, 0.65, 0.35]) {
          const e = from + (end - from) * k;
          stains.push({ poly: roughOutline([{ x: x - w / 2, y: from }, { x: x + w / 2, y: from }, { x: x + w * 0.2 + drift * k, y: e }, { x: x - w * 0.15 + drift * k, y: e }], rng, 0.8, 3), alpha: a / 3 });
        }
      }
    }
  }
  yield* wetBatch(p, stains, VARNISH, { edge: 0.15, sharpness: 0.4, granulation: 0.5 });
}

/** The scree apron at the foot: pale fans from each gully's mouth, lit on their sun side, a few fallen blocks. */
function* paintScree(p: Painter, gullies: readonly Gully[], noise: Noise, rng: Rng): Strokes {
  const top: Pt[] = [];
  for (let x = -30; x <= 1040; x += 10) top.push({ x, y: screeAt(Math.min(1022, x), noise) });
  yield* p.parts.wash([...top, { x: 1040, y: 490 }, { x: -30, y: 490 }], SCREE, { rng, layers: 8, opacity: 0.5, deform: 0.03, spread: 0.06, edge: 0.1, granulation: 0.8, granules: 0.25, fade: { angle: -Math.PI / 2, start: 0.55, amount: 1, ragged: 0.8 } });
  yield;
  const pale: { poly: Pt[]; alpha: number }[] = [];
  const dim: { poly: Pt[]; alpha: number }[] = [];
  for (const g of gullies) {
    const mouth = g.left[g.left.length - 1]!;
    const gx = (mouth.x + g.right[g.right.length - 1]!.x) / 2;
    const y0 = g.foot - 8;
    const foot = bluffFootAt(gx) + 6;
    const fw = rng.range(26, 40) + g.depth * 24;
    // a cone of scree: its crest from the mouth down, the sun side pale, the west side in shade
    const crest = gx + rng.range(-0.15, 0.15) * fw;
    for (const k of [1, 0.7]) {
      const yk = foot - (foot - y0) * k;
      pale.push({ poly: roughOutline([{ x: gx - 8 * k, y: yk }, { x: gx + 8 * k, y: yk }, { x: gx + fw * k, y: foot }, { x: gx - fw * 0.9 * k, y: foot }], rng, 2.5, 5), alpha: 0.17 });
    }
    dim.push({ poly: roughOutline([{ x: gx - 3, y: y0 + 2 }, { x: gx + 1, y: y0 }, { x: crest, y: foot }, { x: gx - fw * 0.9, y: foot }], rng, 2.5, 5), alpha: 0.13 });
    dim.push({ poly: roughOutline([{ x: gx - 3, y: y0 + 2 }, { x: gx, y: y0 + 2 }, { x: crest - fw * 0.15, y: foot }, { x: gx - fw * 0.5, y: foot }], rng, 2, 5), alpha: 0.13 });
    // fallen pebbles and stones down the fan, sparse and close in tone
    for (let i = 0; i < 6; i++) {
      const t = rng.range(0.3, 1);
      const x = gx + rng.range(-0.8, 0.9) * fw * t;
      const y = y0 + (foot - y0) * t;
      const r = rng.range(1.2, 2.8) * (0.6 + t * 0.6);
      p.dab({ x, y }, mix(rng.pick(PEBBLES), EARTH.body, 0.4), { rng, variant: 'round', length: r * 2, width: r * 1.4, opacity: 0.35, layers: 1 });
    }
  }
  yield;
  yield* wetBatch(p, pale, mix(EARTH.sand, EARTH.lit, 0.4), { edge: 0, granulation: 0.8, blend: 'source-over' });
  yield* wetBatch(p, dim, SHADOW, { edge: 0, granulation: 0.6 });
  // a few blocks fallen from the ledges, resting on the scree
  const stones: { poly: Pt[]; alpha: number }[] = [];
  const under: { poly: Pt[]; alpha: number }[] = [];
  const tops: Pt[][] = [];
  for (let i = 0; i < 9; i++) {
    const x = rng.range(10, 1000);
    const y = bluffFootAt(x) - rng.range(6, 26);
    const r = rng.range(4, 9);
    stones.push({ poly: blob(x, y, r, r * 0.62, rng, { irregularity: 0.28, points: 10 }), alpha: 0.55 });
    under.push({ poly: blob(x - r * 0.35, y + r * 0.2, r * 0.7, r * 0.5, rng, { irregularity: 0.3, points: 10 }), alpha: 0.3 });
    under.push({ poly: blob(x - r * 0.9, y + r * 0.6, r * 1.1, r * 0.3, rng, { irregularity: 0.3, points: 10 }), alpha: 0.2 });
    tops.push([{ x: x - r * 0.3, y: y - r * 0.5 }, { x: x + r * 0.6, y: y - r * 0.3 }]);
  }
  yield* wetBatch(p, stones, mix(EARTH.body, EARTH.gold, 0.4), { edge: 0.3, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, under, SHADOW, { edge: 0.05 });
  for (const t of tops) p.dryBrush(t, { rng, pigment: lighten(EARTH.lit, 0.1), width: 1.6, opacity: 0.5, dryness: 0.4, blend: 'source-over' });
  // warm light bounced up from the sand along the foot
  yield* p.parts.glaze(box(-20, 430, 1030, 486), mix(EARTH.sand, EARTH.gold, 0.4), { rng, opacity: 0.22, deform: 0.2, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
  yield;
}

// ── the ksar ────────────────────────────────────────────────────────────────────────────────

/** The bases the rock lip seats the walls on: the lowest block base over x, or null. */
function seatAt(x: number): number | null {
  let y: number | null = null;
  for (const s of KSAR_SHAPES) {
    const { block: b } = s;
    if (x >= b.x - 2 && x <= b.x + b.w + b.side + 2) y = Math.max(y ?? -Infinity, b.base);
  }
  return y;
}

/**
 * The ksar: the palms inside its walls, then each block back to front (the far houses, the near
 * houses, the towers, the ruined curtain walls), then the bluff's lip in front of their feet so
 * they grow out of the rock.
 */
export function* paintKsar(p: Painter, rng: Rng): Strokes {
  for (const k of KSAR_PALMS) {
    yield* ksarPalm(p, k.top, k.base, k.size, rng.fork(`palm-${k.top.x}`));
  }
  for (let i = 0; i < KSAR_SHAPES.length; i++) yield* paintBlock(p, KSAR_SHAPES[i]!, i, rng.fork(KSAR_SHAPES[i]!.block.id));
  yield* paintSeat(p, rng.fork('seat'));
}

const PALM = { trunk: '#8a6a4e', frond: '#8c9a5c', shade: '#66714a', lit: '#b3bb78' } satisfies Record<string, Pigment>;

/** A date palm growing in a courtyard: its trunk, then its fronds a pair at a time. */
function* ksarPalm(p: Painter, top: Pt, base: Pt, size: number, rng: Rng): Strokes {
  p.stroke(smoothPath([base, { x: (top.x + base.x) / 2 + rng.range(-4, 4), y: (top.y + base.y) / 2 }, top], 6), { rng, pigment: PALM.trunk, width: 6 * size, taper: [0, 0.05], opacity: 0.8, wetness: 0.35, dryness: 0.25 });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const lower = i < 5;
    const a0 = lower ? (i % 2 ? rng.range(-0.2, 0.4) : Math.PI - rng.range(-0.2, 0.4)) : -Math.PI - 0.2 + rng.range(0, Math.PI + 0.4);
    const len = size * rng.range(40, 54);
    const droop = lower ? 0.9 : 0.2 + Math.abs(Math.cos(a0)) * 0.5;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.125) pts.push({ x: top.x + Math.cos(a0) * len * t, y: top.y + Math.sin(a0) * len * t * 0.85 + droop * len * t * t * 0.55 });
    const pig = lower ? PALM.shade : Math.cos(a0) > 0.1 ? PALM.lit : PALM.frond;
    p.stroke(pts, { rng, pigment: pig, width: size * 2.6, taper: [0.05, 0.75], opacity: 0.7, wetness: 0.3, dryness: 0.3 });
    for (let k = 2; k < pts.length; k++) {
      const q = pts[k]!;
      const dir = Math.atan2(q.y - pts[k - 1]!.y, q.x - pts[k - 1]!.x);
      for (const sgn of [-1, 1]) p.dab(q, pig, { rng, variant: 'blade', angle: dir + sgn * 0.75, length: size * rng.range(8, 12) * (1.2 - k / pts.length), width: size * 1.6, opacity: 0.42, layers: 1 });
    }
    yield;
  }
  p.dab(top, PALM.shade, { rng, variant: 'round', length: size * 8, width: size * 7, opacity: 0.6 });
  yield;
}

/** A block's own earth: each tower a slightly different mud, the far houses paler and cooler. */
interface Tint {
  lit: Pigment;
  body: Pigment;
  shade: Pigment;
  /** how far back it stands: 0 for the towers and walls, up to 0.4 for the far houses */
  far: number;
}

function tintOf(s: BlockShape, rng: Rng): Tint {
  const b = s.block;
  const far = b.id.endsWith('-back') ? 0.55 : b.kind === 'house' ? 0.35 : 0;
  const warm = rng.range(-0.12, 0.12);
  const body = mix(mix(mix(EARTH.body, EARTH.gold, 0.42 + warm), EARTH.cool, far * 0.4), EARTH.lit, far * 0.3);
  return {
    lit: mix(mix(EARTH.lit, EARTH.gold, 0.4 + warm), EARTH.cool, far * 0.3),
    body,
    shade: mix(mix(EARTH.shade, EARTH.deep, 0.3), EARTH.cool, 0.05 + far * 0.35),
    far,
  };
}

/** What lies behind each block (the fronts painted before it), where its shade falls. */
const BEHIND: readonly (readonly Pt[])[][] = KSAR_SHAPES.map((_, i) => KSAR_SHAPES.slice(0, i).filter((q) => q.block.kind === 'house').map((q) => q.front));

function* paintBlock(p: Painter, s: BlockShape, index: number, rng: Rng): Strokes {
  const b = s.block;
  const top = b.base - b.h;
  const foot = b.base + FOOTING;
  const tower = b.kind === 'tower';
  const tint = tintOf(s, rng.fork('tint'));
  clipAboveSeat(p);
  // a block throws its shade left onto the houses behind it (the sun is on the right)
  const behind = BEHIND[index]!;
  if (behind.length && b.kind !== 'curtain') {
    p.ctx.save();
    p.ctx.beginPath();
    for (const h of behind) h.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.clip();
    const len = tower ? 30 : 12;
    yield* p.parts.glaze([{ x: b.x - len, y: top + len * 0.9 }, { x: b.x + 4, y: top + 6 }, { x: b.x + 4, y: foot }, { x: b.x - len, y: foot }], mix(EARTH.shade, EARTH.cool, 0.3), { rng, opacity: tower ? 0.55 : 0.4, deform: 0.12, spread: 0.2, edge: 0.15, fade: { angle: Math.PI, start: 0.5, amount: 1, ragged: 0.6 } });
    p.ctx.restore();
    yield;
  }
  const front = roughOutline(s.front, rng, 0.6, 3);
  const flank = s.flank.length ? roughOutline(s.flank, rng.fork('flank'), 0.5, 3) : [];
  if (flank.length) {
    fillUnder(p, insetPolygon(flank, 1), mix(PAPER_WHITE, tint.lit, 0.6));
    // the flank turned to the sun: the palest wash, pooling darker at its far edge
    yield* p.parts.wetInWet(flank, tint.lit, mix(tint.lit, tint.body, 0.6), { rng, angle: Math.PI / 2, split: 0.6, opacity: 0.85 - tint.far * 0.3, deform: 0.03, spread: 0.02, edge: 0.45, sharpness: 0.75, granulation: 0.55, granules: 0.2 });
    yield;
  }
  fillUnder(p, insetPolygon(front, 1.2), mix(PAPER_WHITE, tint.lit, 0.35));
  // the front: warm where the light strikes high on the right, cooling down and to the left
  yield* p.parts.wetInWet(front, mix(tint.lit, tint.body, 0.45), mix(tint.body, tint.shade, 0.2), {
    rng, angle: Math.PI / 2 + 0.55, split: 0.5, softness: 0.7, opacity: 0.8 - tint.far * 0.35, deform: 0.03, spread: 0.02, edge: 0.3, sharpness: 0.65,
    granulation: 0.45, granules: 0.2, flow: 0.5, flowScale: 40,
  });
  yield;
  // the parapet with a smaller brush: a big wash's outline is too coarse for the merlons
  const crest = roughOutline([...s.top, { x: b.x + b.w - taper(b), y: top + 9 }, { x: b.x + taper(b), y: top + 9 }], rng.fork('crest'), 0.4, 1.5);
  yield* p.parts.wash(crest, mix(tint.lit, tint.body, 0.5), { rng, layers: 6, opacity: 0.6 - tint.far * 0.3, deform: 0.02, spread: 0.02, edge: 0.3, sharpness: 0.6, granulation: 0.4, fade: { angle: Math.PI / 2, start: 0.5, amount: 1 } });
  yield;
  clipTo(p, front);
  const x0 = b.x;
  const x1 = b.x + b.w;
  // pisé is patchy: newer mud in pale patches, damp darker ones, soft and overlapping
  for (let i = 0; i < Math.max(2, Math.round((b.w * b.h) / 2600)); i++) {
    const dark = rng.chance(0.5);
    p.glaze({ cx: rng.range(x0, x1), cy: rng.range(top + 8, b.base), rx: rng.range(8, 20), ry: rng.range(6, 16) }, dark ? mix(tint.body, EARTH.deep, 0.5) : tint.lit, { rng, opacity: dark ? 0.16 : 0.22, deform: 0.5, spread: 0.5, edge: 0.15, granulation: 0.5 });
  }
  yield;
  // the face turns from the sun toward its left edge; a cool shade gathers there and at the foot
  yield* p.parts.glaze(box(x0 - 4, top - 20, x0 + Math.max(10, b.w * 0.38), foot), mix(EARTH.shade, EARTH.cool, 0.3 + tint.far * 0.3), { rng, opacity: b.kind === 'tower' ? 0.5 : 0.4, deform: 0.14, spread: 0.2, edge: 0.05, fade: { angle: 0, start: 0.15, amount: 1, ragged: 0.7 } });
  yield* p.parts.glaze(box(x0 - 4, b.base - 30, x1 + 4, foot), mix(tint.shade, EARTH.deep, 0.3), { rng, opacity: 0.28, deform: 0.2, spread: 0.3, edge: 0, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.7 } });
  yield;
  // the lifts of the formwork: short broken courses, never a ruled line across
  for (let y = top + rng.range(12, 18); y < b.base - 6; y += rng.range(10, 14)) {
    for (let x = x0 + rng.range(-2, 10); x < x1; ) {
      const len = rng.range(12, 34);
      if (rng.chance(0.6)) p.dryBrush([{ x, y: y + rng.range(-0.6, 0.6) }, { x: x + len * 0.5, y: y + rng.range(-0.8, 0.8) }, { x: x + len, y: y + rng.range(-0.6, 0.6) }], { rng, pigment: mix(tint.shade, EARTH.deep, 0.4), width: rng.range(1, 1.6), opacity: 0.2, dryness: 0.7 });
      x += len + rng.range(4, 16);
    }
    if (tower && rng.chance(0.25)) {
      // the putlog holes of one lift, a short run of them
      const hx = rng.range(x0 + 8, x1 - 24);
      for (let k = 0; k < 3; k++) p.dab({ x: hx + k * rng.range(6, 9), y: y - 2 }, mix(EARTH.dark, tint.shade, 0.3), { rng, variant: 'round', length: 1.5, width: 1.3, opacity: 0.35, layers: 1 });
    }
  }
  yield;
  if (tower) paintBands(p, s, tint, rng.fork('bands'));
  if (b.kind === 'curtain') yield* paintRuin(p, s, tint, rng.fork('ruin'));
  paintOpenings(p, b, tint, rng.fork('openings'));
  yield;
  // rain has washed down from the merlons and gullied the corners
  for (let i = 0; i < Math.round(b.w / 14); i++) {
    const x = rng.range(x0 + 4, x1 - 4);
    const len = rng.range(10, b.h * (tower ? 0.55 : 0.4));
    const y = top + rng.range(0, 6);
    p.stroke([{ x, y }, { x: x + rng.range(-1, 1), y: y + len * 0.5 }, { x: x + rng.range(-1.5, 1.5), y: y + len }], { rng, pigment: mix(tint.shade, EARTH.deep, 0.35), width: rng.range(1.4, 2.8), taper: [0.2, 0.9], opacity: 0.18, wetness: 0.6, dryness: 0.3 });
  }
  for (let i = 0; i < Math.round(b.h / 34) + 1; i++) {
    const left = rng.chance(0.8);
    const x = left ? x0 + rng.range(-1, 3) : x1 - rng.range(-1, 3);
    p.lift({ cx: x, cy: rng.range(top + 4, b.base - 4), rx: rng.range(2, 4), ry: rng.range(3, 7) }, { rng, amount: 0.25, layers: 3, deform: 0.5 });
  }
  // the light catches the worn tops: broken, loose touches along the parapet
  const lit = smoothPath(s.top.map((q) => ({ x: q.x, y: q.y + 1.6 })), 3);
  for (let i = 0; i < lit.length; ) {
    const n = Math.round(rng.range(4, 9));
    const run = lit.slice(i, i + n);
    if (run.length > 1 && rng.chance(0.5)) p.dryBrush(run, { rng, pigment: lighten(tint.lit, 0.08), width: rng.range(1.4, 2.2), opacity: 0.36 - tint.far * 0.3, dryness: 0.5, blend: 'source-over' });
    i += n + Math.round(rng.range(1, 4));
  }
  p.ctx.restore();
  p.ctx.restore();
  yield;
}

/**
 * A tower's carved band near the top, done as quick loose brushwork: a broken fillet, a running
 * zigzag of uneven teeth, a row of lozenges flicked in two strokes each, some faint or missing.
 */
function paintBands(p: Painter, s: BlockShape, tint: Tint, rng: Rng): void {
  const b = s.block;
  const top = b.base - b.h;
  const tp = taper(b);
  const x0 = b.x + tp + 4;
  const x1 = b.x + b.w - tp - 4;
  const incise = mix(EARTH.deep, tint.shade, 0.35);
  // the band stands proud of the wall: a touch lighter, with a soft shade under its lower fillet
  p.glaze(box(x0 - 3, top + 6, x1 + 3, top + 32), tint.lit, { rng, opacity: 0.18, deform: 0.2, spread: 0.3, edge: 0 });
  const broken = (y: number, width: number, op: number) => {
    for (let x = x0 - 3; x < x1 + 2; ) {
      const len = rng.range(10, 26);
      p.dryBrush([{ x, y: y + rng.range(-0.5, 0.5) }, { x: Math.min(x1 + 3, x + len), y: y + rng.range(-0.7, 0.7) }], { rng, pigment: incise, width, opacity: op, dryness: 0.5 });
      x += len + rng.range(1, 5);
    }
  };
  const y1 = top + 11 + rng.range(-1, 1);
  broken(y1 - 3, 1.3, 0.38);
  // the zigzag: one flick of the brush per tooth edge, heavy where it lands, now and then skipped
  const flick = (a: Pt, c: Pt, op: number) => p.stroke([a, c], { rng, pigment: incise, width: rng.range(1.1, 1.6), taper: [0.05, 0.6], opacity: op, wetness: 0.3, wobble: 0.2 });
  let up = true;
  for (let x = x0; x < x1 - 3; x += rng.range(4.2, 5.4), up = !up) {
    if (rng.chance(0.08)) continue;
    const lo = y1 + rng.range(4.6, 6.2);
    const hi = y1 + rng.range(0, 1);
    const nx = Math.min(x1, x + rng.range(4.2, 5.4));
    flick({ x, y: up ? lo : hi }, { x: nx, y: up ? hi : lo }, rng.range(0.3, 0.5));
  }
  const y2 = y1 + 13;
  const n = Math.max(2, Math.floor((x1 - x0) / 10.5));
  const dx = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    if (rng.chance(0.12)) continue;
    const cx = x0 + dx * (i + 0.5) + rng.range(-0.8, 0.8);
    const rx = rng.range(3.2, 4.2);
    const ry = rng.range(4.2, 5.4);
    const op = rng.range(0.3, 0.48);
    const t = { x: cx + rng.range(-0.4, 0.4), y: y2 - ry };
    const l = { x: cx - rx, y: y2 + rng.range(-0.4, 0.4) };
    const bt = { x: cx + rng.range(-0.4, 0.4), y: y2 + ry };
    const r = { x: cx + rx, y: y2 + rng.range(-0.4, 0.4) };
    // a lozenge in four flicks, the corners overlapping or just missing as a quick hand leaves them
    flick(t, l, op);
    flick(l, bt, op * 0.9);
    flick({ x: t.x + 0.4, y: t.y }, r, op * 0.85);
    if (rng.chance(0.85)) flick(r, { x: bt.x + 0.5, y: bt.y - 0.3 }, op * 0.8);
  }
  const y3 = y2 + 8 + rng.range(-0.5, 0.5);
  broken(y3, 1.4, 0.36);
  p.glaze(box(x0 - 3, y3 + 1, x1 + 3, y3 + 6), tint.shade, { rng, opacity: 0.22, deform: 0.2, spread: 0.2, edge: 0, fade: { angle: Math.PI / 2, start: 0.1, amount: 1, ragged: 0.5 } });
  // on the tallest towers, two blind niches under the band
  if (b.h > 125) {
    for (const f of [0.34, 0.66]) {
      const cx = x0 + (x1 - x0) * f + rng.range(-1.5, 1.5);
      p.wash(arch(cx - 2.6, y3 + 9, 5.2, 9), mix(tint.shade, EARTH.deep, 0.35), { rng, layers: 3, opacity: 0.4, deform: 0.08, edge: 0.4, sharpness: 0.6 });
    }
  }
}

/** A ruined curtain wall's wear: a lit crest, a shade under it, rain gullies down the face, a few holes. */
function* paintRuin(p: Painter, s: BlockShape, tint: Tint, rng: Rng): Strokes {
  const b = s.block;
  const crest = s.top;
  const band = (d0: number, d1: number) => [...crest.map((q) => ({ x: q.x, y: q.y + d0 })), ...crest.slice().reverse().map((q) => ({ x: q.x, y: q.y + d1 }))];
  yield* p.parts.glaze(band(-2, 9), tint.lit, { rng, opacity: 0.4, deform: 0.15, spread: 0.2, edge: 0, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.6 } });
  yield* p.parts.glaze(band(8, 16), mix(tint.shade, EARTH.deep, 0.3), { rng, opacity: 0.22, deform: 0.25, spread: 0.3, edge: 0, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.8 } });
  for (let x = b.x + rng.range(6, 14); x < b.x + b.w - 6; x += rng.range(14, 26)) {
    const i = crest.findIndex((q) => q.x >= x);
    const y0 = (crest[Math.max(0, i)]?.y ?? b.base - b.h) + rng.range(1, 4);
    const len = rng.range(0.35, 0.8) * (b.base - y0);
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.25) pts.push({ x: x + Math.sin(t * 2.6 + x) * 1.2, y: y0 + t * len });
    p.stroke(pts, { rng, pigment: mix(tint.shade, EARTH.deep, 0.4), width: rng.range(2, 3.2), taper: [0.15, 0.85], opacity: 0.3, wetness: 0.45, dryness: 0.3 });
    p.dryBrush(pts.slice(0, 4).map((q) => ({ x: q.x - 1.8, y: q.y })), { rng, pigment: tint.lit, width: 1.1, opacity: 0.35, dryness: 0.6, blend: 'source-over' });
  }
  for (let i = 0; i < 2; i++) {
    const x = rng.range(b.x + 10, b.x + b.w - 10);
    const y = rng.range(b.base - b.h * 0.6, b.base - 8);
    p.wash(blob(x, y, rng.range(1.5, 2.6), rng.range(1.2, 2), rng, { irregularity: 0.35, points: 8 }), mix(EARTH.dark, tint.shade, 0.35), { rng, layers: 3, opacity: 0.5, deform: 0.1, edge: 0.4, sharpness: 0.6 });
  }
  yield;
}

/** An opening's outline: a box, or a box under a round head. */
function arch(x: number, y: number, w: number, h: number): Pt[] {
  const r = w / 2;
  const out: Pt[] = [{ x, y: y + h }, { x, y: y + r }];
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (Math.PI * i) / 6;
    out.push({ x: x + r + Math.cos(a) * r, y: y + r + Math.sin(a) * r });
  }
  out.push({ x: x + w, y: y + r }, { x: x + w, y: y + h });
  return out;
}

/** The openings: soft dark washes darkest at their top, a palm-wood lintel and a lit sill on some. */
function paintOpenings(p: Painter, b: BlockShape['block'], tint: Tint, rng: Rng): void {
  const hole = mix(mix(EARTH.dark, EARTH.deep, 0.35), tint.shade, 0.2 + tint.far);
  for (const w of windows(b)) {
    const shape = w.kind === 'arch' ? arch(w.x, w.y, w.w, w.h) : roughOutline(box(w.x, w.y, w.x + w.w, w.y + w.h), rng, 0.3, 1.5);
    p.wash(shape, hole, { rng, layers: 4, opacity: 0.66 - tint.far * 0.4, deform: 0.06, spread: 0.05, edge: 0.45, sharpness: 0.7, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.35 } });
    if (w.lintel) {
      const over = rng.range(1.5, 3);
      p.stroke([{ x: w.x - over, y: w.y - 1.3 }, { x: w.x + w.w + over, y: w.y - 1.1 + rng.range(-0.4, 0.4) }], { rng, pigment: mix('#7a5a40', EARTH.dark, 0.25), width: 1.5, opacity: 0.6 - tint.far * 0.3, wetness: 0.15, wobble: 0.2 });
    }
    p.dryBrush([{ x: w.x - 0.5, y: w.y + w.h + 1.2 }, { x: w.x + w.w + 1, y: w.y + w.h + 1.4 }], { rng, pigment: tint.lit, width: 1.2, opacity: 0.4, dryness: 0.4, blend: 'source-over' });
  }
}

/** The ksar's span over the rock, with a little room either side. */
const SEAT_X0 = KSAR_SHAPES.reduce((a, s) => Math.min(a, s.block.x), Infinity) - 6;
const SEAT_X1 = KSAR_SHAPES.reduce((a, s) => Math.max(a, s.block.x + s.block.w + s.block.side), -Infinity) + 6;

/**
 * Where the walls go into the rock, left → right: just above each block's base, with the rock
 * swelling up into them here and there as outcrops the builders kept. Deterministic.
 */
export const SEAT_LINE: readonly Pt[] = (() => {
  const rng = createRng('ksar-seat');
  const noise = createSimplex2D(rng.fork('rise'));
  const out: Pt[] = [];
  for (let x = SEAT_X0; x <= SEAT_X1; x += 4) {
    const seat = seatAt(x);
    // and at the two ends the rock is carried well up into the walls
    const end = 30 * Math.exp(-(((x - SEAT_X0 - 12) / 24) ** 2)) + 30 * Math.exp(-(((x - SEAT_X1 + 26) / 24) ** 2));
    const rise = Math.max(0, noise(x / 40, 3) - 0.1) * 17 + Math.max(0, noise(x / 13, 9)) * 1.5 + end;
    out.push({ x, y: (seat === null ? bluffTopAt(x) : seat - 2 - rise) + rng.range(-1.2, 1.2) });
  }
  return out;
})();

/** Clip to everything above the seat line, so no wall foot is painted over the rock. */
function clipAboveSeat(p: Painter): void {
  clipTo(p, [{ x: SEAT_X0 - 60, y: -100 }, { x: SEAT_X1 + 60, y: -100 }, { x: SEAT_X1 + 60, y: SEAT_LINE[SEAT_LINE.length - 1]!.y }, ...SEAT_LINE.slice().reverse(), { x: SEAT_X0 - 60, y: SEAT_LINE[0]!.y }]);
}

/**
 * Where the ksar meets the bluff: the walls stop at the seat line, and the rock rises into them
 * in outcrops of its own earth over the bluff's top, so the ksar grows out of the rock rather
 * than standing on it; the join broken, not ruled.
 */
function* paintSeat(p: Painter, rng: Rng): Strokes {
  const top = SEAT_LINE;
  const x0 = SEAT_X0;
  const x1 = SEAT_X1;
  // the rock's tone creeps up the wall feet, so pisé and rock read as one earth
  yield* p.parts.glaze([...top.map((q) => ({ x: q.x, y: q.y - 22 })), ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + 2 }))], mix(SEAT, EARTH.body, 0.3), { rng, opacity: 0.28, deform: 0.2, spread: 0.3, edge: 0, granulation: 0.4, fade: { angle: -Math.PI / 2, start: 0.25, amount: 1, ragged: 0.8 } });
  yield;
  // the outcrops above the bluff's own top: an underlayer so no paper shows, then a granulating wash
  // that runs on down over the bluff and is lost in it, in stretches (one big mark's work each)
  const under = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: Math.max(q.y, bluffTopAt(q.x) + 3) }))];
  fillUnder(p, under, mix(PAPER_WHITE, SEAT, 0.85));
  for (let sx = x0; sx < x1; sx += 120) {
    const run = top.filter((q) => q.x >= sx - 4 && q.x <= sx + 124);
    if (run.length < 2) continue;
    const low = Math.max(...run.map((q) => q.y));
    const fade = Math.min(1, (run[0]!.x - x0 + 20) / 40, (x1 - run[run.length - 1]!.x + 20) / 40);
    const shape = [...run, { x: run[run.length - 1]!.x, y: low + 20 }, { x: run[0]!.x, y: low + 20 }];
    yield* p.parts.wash(shape, SEAT, { rng, layers: 6, opacity: 0.75 * fade, deform: 0.04, spread: 0.06, edge: 0.12, sharpness: 0.4, granulation: 0.7, granules: 0.3, fade: { angle: Math.PI / 2, start: 0.35, amount: 1, ragged: 0.8 } });
  }
  yield;
  yield* paintEndOutcrops(p, rng.fork('ends'));
  // the outcrops' faces turned from the sun, and the beds running on through them
  for (let i = 2; i < top.length - 2; i++) {
    const q = top[i]!;
    const prev = top[i - 2]!;
    if (prev.y - q.y > 3) p.glaze({ cx: q.x - 3, cy: q.y + 6, rx: 4, ry: 7 }, mix(EARTH.shade, EARTH.deep, 0.3), { rng, opacity: 0.2, deform: 0.4, spread: 0.4, edge: 0 });
  }
  for (let x = x0 + rng.range(0, 30); x < x1 - 20; x += rng.range(60, 120)) {
    const len = rng.range(20, 50);
    const y = Math.max(top[Math.round((x - x0) / 4)]?.y ?? 318, 314) + rng.range(8, 16);
    const pts = [{ x, y }, { x: x + len * 0.5, y: y + rng.range(-1, 1) }, { x: x + len, y: y + rng.range(-1.5, 1.5) }];
    p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + 2.5 })), { rng, pigment: mix(EARTH.deep, EARTH.shade, 0.3), width: rng.range(2, 3), opacity: 0.25, dryness: 0.6 });
    p.dryBrush(pts, { rng, pigment: EARTH.lit, width: rng.range(1.5, 2.2), opacity: 0.3, dryness: 0.6, blend: 'source-over' });
  }
  yield;
  // the join, in broken touches: a dark crack here, the rock's lit edge there
  const seam = smoothPath(top.map((q) => ({ x: q.x, y: q.y - 0.3 })), 3);
  for (let i = 0; i < seam.length; ) {
    const n = Math.round(rng.range(4, 12));
    const run = seam.slice(i, i + n);
    if (run.length > 1) {
      if (rng.chance(0.55)) p.dryBrush(run, { rng, pigment: mix(EARTH.dark, EARTH.shade, 0.45), width: rng.range(1.2, 2.2), opacity: 0.34, dryness: 0.5 });
      if (rng.chance(0.55)) p.dryBrush(run.map((q) => ({ x: q.x, y: q.y + 2.4 })), { rng, pigment: EARTH.lit, width: 1.6, opacity: 0.34, dryness: 0.6, blend: 'source-over' });
    }
    i += n + Math.round(rng.range(0, 5));
  }
  // fallen pisé slumped below the ruined stretches, in the walls' own colour
  for (const s of KSAR_SHAPES.filter((q) => q.block.kind === 'curtain')) {
    const b = s.block;
    for (let i = 0; i < 3; i++) {
      const x = rng.range(b.x + 6, b.x + b.w - 6);
      const y = b.base + rng.range(0, 4);
      const w = rng.range(8, 14);
      p.wash(blob(x, y, w, w * 0.3, rng, { irregularity: 0.3, points: 12 }), mix(SEAT, EARTH.gold, 0.35), { rng, layers: 4, opacity: 0.35, deform: 0.2, edge: 0.15, sharpness: 0.5, granulation: 0.6, fade: { angle: Math.PI / 2, start: 0.3, amount: 0.7 } });
    }
  }
  // the shade the walls cast down the rock just below them
  yield* p.parts.glaze([...top.map((q) => ({ x: q.x, y: q.y + 2 })), ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + 18 }))], shade(EARTH.shade, 0.1), { rng, opacity: 0.16, deform: 0.3, spread: 0.3, edge: 0, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.7 } });
  yield;
}

/** The rock carried up into the ksar's two ends, modelled as the bluff is: shade to the west, sun to the east, a ledge. */
function* paintEndOutcrops(p: Painter, rng: Rng): Strokes {
  for (const [a, c] of [[SEAT_X0 - 2, SEAT_X0 + 54], [SEAT_X1 - 62, SEAT_X1 + 2]] as const) {
    const run = SEAT_LINE.filter((q) => q.x >= a && q.x <= c);
    const hi = Math.min(...run.map((q) => q.y));
    const lo = Math.max(...run.map((q) => bluffTopAt(q.x))) + 16;
    clipTo(p, [...run, ...run.slice().reverse().map((q) => ({ x: q.x, y: bluffTopAt(q.x) + 16 }))]);
    const w = c - a;
    p.glaze(blob(a + w * 0.2, (hi + lo) / 2, w * 0.38, (lo - hi) * 0.7, rng, { irregularity: 0.25 }), SHADOW, { rng, opacity: 0.4, deform: 0.15, spread: 0.25, edge: 0.05, fade: { angle: 0, start: 0.35, amount: 1, ragged: 0.7 } });
    p.glaze(blob(a + w * 0.8, (hi + lo) / 2, w * 0.3, (lo - hi) * 0.7, rng, { irregularity: 0.25 }), mix(EARTH.lit, EARTH.gold, 0.25), { rng, opacity: 0.28, deform: 0.15, spread: 0.25, edge: 0, blend: 'source-over', fade: { angle: Math.PI, start: 0.35, amount: 1, ragged: 0.7 } });
    for (const y of [hi + (lo - hi) * rng.range(0.3, 0.45), hi + (lo - hi) * rng.range(0.6, 0.75)]) {
      const x0 = a + rng.range(4, 14);
      const x1 = c - rng.range(4, 14);
      const pts = [0, 0.5, 1].map((t) => ({ x: x0 + (x1 - x0) * t, y: y + rng.range(-1, 1) }));
      p.dryBrush(pts.map((q) => ({ x: q.x, y: q.y + 3 })), { rng, pigment: mix(EARTH.dark, EARTH.shade, 0.4), width: rng.range(1.8, 2.6), opacity: 0.36, dryness: 0.5 });
      p.dryBrush(pts, { rng, pigment: lighten(EARTH.lit, 0.1), width: rng.range(1.6, 2.4), opacity: 0.45, dryness: 0.5, blend: 'source-over' });
    }
    p.ctx.restore();
    // the outcrop's crest catches the light
    const crest = smoothPath(run.map((q) => ({ x: q.x, y: q.y + 1.5 })), 3);
    p.dryBrush(crest, { rng, pigment: lighten(EARTH.lit, 0.1), width: 2.2, opacity: 0.45, dryness: 0.5, blend: 'source-over' });
    yield;
  }
}
