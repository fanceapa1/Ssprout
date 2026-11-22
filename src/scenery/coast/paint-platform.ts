/**
 * The platform's rock (GO1, ADR 0388): the headlands' bedded limestone faces dropping from the
 * floor's rim into the sea, their wet feet, shade and broken reflection on the water and the foam
 * where the sea meets them; along the back edges the floor's rock lip over deeper water. Lit from
 * the left over the sea. Shapes in `platform.ts`. docs/systems/scenery.md › Coast › Platform.
 */
import type { Rng } from '../../core/rng';
import { blob, bounds, createSimplex2D, mix, padRect, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { inView } from './paint-land';
import { SAND, SEA } from './paint-water';
import { BEACH_FLIGHT, FLIGHTS } from './shapes';
import { BACK_EDGES, FACE_FORM, lineY, PLATFORM_FACES, type PlatformFace } from './platform';
import { LIME, band, clipBatch, fillUnder, liftBatch, rough, settle, streak, wetBatch, type Mark } from './rock-kit';

/** Where the rock meets the sea: its shade and reflection on the water, the wet foot, weed, lichen, foam. */
const FOOT = {
  shade: mix(SEA.deepTeal, LIME.recess, 0.45),
  reflection: mix(SEA.deepTeal, LIME.wet, 0.5),
  wet: mix(LIME.wet, LIME.algae, 0.3),
  weed: mix(LIME.algae, '#3f4a2e', 0.35),
  lichen: '#3e3a3a',
  foam: '#fdfcf5',
} satisfies Record<string, Pigment>;

/** The platform's rock, after the land and the walls: each headland's face, then the floor's lip along the back edges. */
export function* paintPlatform(p: Painter, rng: Rng): Strokes {
  for (const [i, pf] of PLATFORM_FACES.entries()) {
    if (inView(p, padRect(bounds(pf.outline), 30))) {
      yield* paintFace(p, pf, i, rng.fork(`face-${pf.id}`));
      yield* settle(p);
    }
  }
  yield* paintBackEdges(p, rng.fork('back-edges'));
  yield* settle(p);
  yield* paintStepsRock(p, rng.fork('steps-rock'));
  yield* settle(p);
}

/** Where the beach steps leave the sand: the platform's corner, the stair's stepped side rising out of it. */
export const STEPS_ROCK: readonly Pt[] = (() => {
  const f = FLIGHTS[BEACH_FLIGHT]!;
  const n = f.length;
  const left = (k: number) => f[k]!.riser[3]!.x - 1;
  const low = (k: number) => f[k]!.riser[3]!.y;
  const ground = low(n - 1) + 3;
  const out: Pt[] = [{ x: left(n - 1), y: ground }, { x: left(n - 1), y: low(n - 1) }];
  for (let k = n - 2; k >= 0; k--) out.push({ x: left(k), y: low(k + 1) }, { x: left(k), y: low(k) });
  const right = f[0]!.riser[2]!.x + 1;
  out.push({ x: right, y: low(0) }, { x: right + 2, y: ground + 2 });
  return out;
})();

/** The stair's side: limestone lit from the sea, a bed or two, sand drifted against its foot. */
function* paintStepsRock(p: Painter, rng: Rng): Strokes {
  if (!inView(p, padRect(bounds(STEPS_ROCK), 20))) return;
  const clip = rough(STEPS_ROCK, rng, 0.8, 3);
  const b = bounds(STEPS_ROCK);
  const ground = b.y + b.h;
  fillUnder(p, clip, LIME.under);
  const body = [{ clip, marks: [{ poly: clip, alpha: 0.7 }] as Mark[] }];
  yield* clipBatch(p, body, mix(LIME.cream, LIME.body, 0.45), { edge: 0.1, sharpness: 0.5, granulation: 0.7, granules: 0.25 });
  const shade = [{ clip, marks: [{ poly: band(b.x - 2, b.x + b.w + 2, () => ground - 16, () => ground + 2, 4), alpha: 0.3 }, { poly: band(b.x + b.w * 0.7, b.x + b.w + 3, () => b.y, () => ground + 2, 4), alpha: 0.22 }] as Mark[] }];
  yield* clipBatch(p, shade, LIME.shade, { edge: 0.12, sharpness: 0.45, granulation: 0.6 });
  const dark: Mark[] = [];
  for (let y = b.y + rng.range(8, 12); y < ground - 4; y += rng.range(7, 11)) {
    const x0 = b.x + rng.range(0, 10);
    dark.push({ poly: band(x0, x0 + rng.range(14, 40), (x) => y + (x - x0) * -0.02, (x) => y + 1.1 + (x - x0) * -0.02, 4), alpha: rng.range(0.35, 0.5) });
  }
  for (let k = 0; k < 4; k++) {
    const x = rng.range(b.x + 6, b.x + b.w - 4);
    dark.push({ poly: streak({ x, y: Math.max(b.y + 4, ground - rng.range(14, 30)) }, { x: x + rng.range(-1, 1), y: ground - 2 }, rng.range(1, 1.5), rng), alpha: 0.45 });
  }
  yield* clipBatch(p, [{ clip, marks: dark }], LIME.deep, { edge: 0.25, sharpness: 0.75 });
  // sand drifted against its foot, a dark seam where the rock goes under
  const drift: Mark[] = [{ poly: rough(band(b.x - 14, b.x + b.w + 6, (x) => ground - 3 - 2.5 * Math.sin((x - b.x) / 9), () => ground + 4, 4), rng, 1, 3), alpha: 0.5 }];
  yield* wetBatch(p, drift, mix(SAND.dry, SAND.warm, 0.4), { edge: 0.08, sharpness: 0.4, granulation: 0.7, granules: 0.3 });
}

/** One headland's face: a body graded darker to the wet foot, beds and joints, the lit corner and rim, stains, the foot in the sea. */
function* paintFace(p: Painter, pf: PlatformFace, i: number, rng: Rng): Strokes {
  const { beds, joints } = FACE_FORM[i]!;
  const x0 = Math.min(...pf.outline.map((q) => q.x));
  const x1 = pf.rim[pf.rim.length - 1]!.x;
  const top = (x: number) => lineY(pf.rim, x);
  const bot = (x: number) => lineY(pf.foot, x);
  const noise = createSimplex2D(rng.fork('wander'));
  const bedY = (f: number, x: number) => top(x) + (bot(x) - top(x)) * f + noise(x / 30, f * 9) * 1.6;
  const clip = rough(pf.outline, rng, 0.9, 3);
  const g = (): { clip: Pt[]; marks: Mark[] }[] => [{ clip, marks: [] }];

  // the water at its foot first: the face's shade and a broken dark reflection under it
  const water: Mark[] = [];
  const refl: Mark[] = [];
  for (const [d0, d1, a] of [[-1, 6, 0.38], [5, 11, 0.22], [10, 18, 0.11]] as const) {
    water.push({ poly: rough(band(x0 - 6, x1 + 4, (x) => bot(x) + d0, (x) => bot(x) + d1 + noise(x / 9, 3) * 2, 3), rng, 1, 3), alpha: a });
  }
  for (let k = 0; k < 4; k++) {
    for (let x = x0 - 2; x < x1; ) {
      const xb = Math.min(x1, x + rng.range(6, 16));
      const o = 1 + k * rng.range(2.6, 3.6);
      if (rng.chance(0.75 - k * 0.12)) refl.push({ poly: band(x, xb, (q) => bot(q) + o, (q) => bot(q) + o + rng.range(1.1, 2), 3), alpha: [0.55, 0.38, 0.24, 0.14][k]! });
      x = xb + rng.range(1, 5);
    }
  }
  yield* wetBatch(p, water, FOOT.shade, { edge: 0.05, sharpness: 0.3, granulation: 0.3 });
  yield* wetBatch(p, refl, FOOT.reflection, { edge: 0.08, sharpness: 0.4, granulation: 0.3 });

  // the face: opaque under, a limestone body graded cooler and darker toward the sea
  fillUnder(p, clip, LIME.under);
  const body = g();
  body[0]!.marks.push({ poly: clip, alpha: 0.7 });
  for (let k = 0; k < 5; k++) {
    const x = rng.range(x0, x1);
    const y = rng.range(top(x) + 6, bot(x) - 6);
    body[0]!.marks.push({ poly: blob(x, y, rng.range(10, 22), rng.range(5, 10), rng, { irregularity: 0.5 }), alpha: rng.range(0.12, 0.22) });
  }
  yield* clipBatch(p, body, mix(LIME.cream, LIME.body, 0.45), { edge: 0.08, sharpness: 0.45, granulation: 0.75, granules: 0.25, flow: 0.4, flowScale: 24 });
  const grade = g();
  grade[0]!.marks.push(
    { poly: band(x0 - 4, x1 + 4, (x) => bedY(0.3, x), (x) => bot(x) + 2, 3), alpha: 0.26 },
    { poly: band(x0 - 4, x1 + 4, (x) => bedY(0.58, x), (x) => bot(x) + 2, 3), alpha: 0.3 },
    { poly: band(x0 - 4, x1 + 4, (x) => bedY(0.8, x), (x) => bot(x) + 2, 3), alpha: 0.22 },
  );
  // each block's side turned from the sun: a shade plane right of its joint
  for (let j = 0; j < joints.length; j++) {
    const jt = joints[j]!;
    const next = joints[j + 1]?.x ?? x1;
    const w = (next - jt.x) * rng.range(0.25, 0.45);
    const fa = beds[jt.from]?.f ?? 0;
    const fb = beds[jt.to - 1]?.f ?? 1;
    if (rng.chance(0.7)) grade[0]!.marks.push({ poly: rough(band(next - w, next + 0.5, (x) => bedY(Math.max(0, fa - 0.12), x), (x) => bedY(Math.min(1.05, fb + 0.14), x), 3), rng, 0.8, 3), alpha: rng.range(0.18, 0.3) });
  }
  yield* clipBatch(p, grade, LIME.shade, { edge: 0.12, sharpness: 0.45, granulation: 0.6, granules: 0.15 });

  // the beds: a dark undercut under each hard one's lit lip, faint lines for the soft ones, overhangs
  const dark = g();
  const lit = g();
  const stain = g();
  for (const b of beds) {
    for (const [a, c] of b.runs) {
      const y = (x: number) => bedY(b.f, x);
      if (b.hard) {
        const h = rng.range(1, 1.7);
        dark[0]!.marks.push({ poly: band(a, c, (x) => y(x) + 0.2, (x) => y(x) + h, 3), alpha: rng.range(0.45, 0.6) });
        lit[0]!.marks.push({ poly: band(a + 1, c - 1, (x) => y(x) - 1.6, (x) => y(x) - 0.2, 3), alpha: 0.6 });
        if (b.over) {
          // an overhang: its shadow under one end, lost toward the other
          const left = rng.chance(0.5);
          dark[0]!.marks.push({ poly: band(a, c, (x) => y(x) + 0.5, (x) => y(x) + 0.8 + 2.6 * (left ? (c - x) / (c - a) : (x - a) / (c - a)), 3), alpha: 0.34 });
        }
      } else {
        dark[0]!.marks.push({ poly: band(a, c, (x) => y(x), (x) => y(x) + 0.8, 4), alpha: 0.3 });
      }
    }
  }
  // the joints: broken dark cracks between beds, a lit hairline on the sunward wall
  for (const jt of joints) {
    const fa = beds[jt.from]?.f ?? 0;
    const fb = beds[jt.to - 1]?.f ?? 1;
    const ya = bedY(fa, jt.x) + 1;
    const yb = bedY(Math.min(1, fb + 0.1), jt.x);
    const xb = jt.x + jt.lean * (yb - ya);
    dark[0]!.marks.push({ poly: streak({ x: jt.x, y: ya }, { x: xb, y: yb }, jt.deep ? rng.range(1.6, 2.4) : rng.range(0.9, 1.4), rng), alpha: jt.deep ? 0.62 : 0.45 });
    lit[0]!.marks.push({ poly: streak({ x: jt.x - 1.4, y: ya + 1 }, { x: xb - 1.4, y: yb - 2 }, 0.9, rng), alpha: 0.5 });
  }
  // pits in the stone
  for (let k = 0; k < (x1 - x0) / 5; k++) {
    const x = rng.range(x0 + 2, x1 - 2);
    dark[0]!.marks.push({ poly: blob(x, rng.range(top(x) + 4, bot(x) - 8), rng.range(0.5, 1.2), rng.range(0.4, 0.8), rng, { points: 6 }), alpha: rng.range(0.3, 0.55) });
  }
  // the west corner turned to the sun, and the rim's lit arris with the floor's lip over it
  const west = pf.outline.filter((q) => q.x <= x0 + 6);
  if (west.length > 1) {
    const wy0 = Math.min(...west.map((q) => q.y));
    const wy1 = Math.max(...west.map((q) => q.y));
    lit[0]!.marks.push({ poly: rough([{ x: x0 - 2, y: wy0 }, { x: x0 + rng.range(6, 9), y: wy0 + 2 }, { x: x0 + rng.range(4, 7), y: wy1 - 10 }, { x: x0 - 2, y: wy1 - 6 }], rng, 0.8, 3), alpha: 0.55 });
  }
  lit[0]!.marks.push({ poly: band(x0 - 2, x1, (x) => top(x) - 1.5, (x) => top(x) + 2.2, 3), alpha: 0.85 });
  for (let x = x0 + rng.range(2, 8); x < x1 - 4; ) {
    const xb = Math.min(x1, x + rng.range(8, 22));
    if (rng.chance(0.6)) dark[0]!.marks.push({ poly: band(x, xb, (q) => top(q) + 2.4, (q) => top(q) + 2.4 + rng.range(1.2, 2.6) * Math.sin(((q - x) / (xb - x)) * Math.PI) + 0.3, 2), alpha: 0.55 });
    x = xb + rng.range(2, 8);
  }
  // ochre and rust stains under the rim, grey streaks down the face
  for (let x = x0 + rng.range(4, 12); x < x1 - 2; x += rng.range(8, 20)) {
    const y = top(x) + rng.range(3, 8);
    const len = rng.range(0.25, 0.6) * (bot(x) - top(x));
    stain[0]!.marks.push({ poly: streak({ x, y }, { x: x + rng.range(-1.5, 1.5), y: y + len }, rng.range(1.8, 3.6), rng), alpha: rng.range(0.15, 0.3) });
  }
  yield* clipBatch(p, stain, mix(LIME.ochre, LIME.rust, 0.35), { edge: 0.1, sharpness: 0.4, granulation: 0.5 });

  // the foot: a dark wet band wandering in height, black lichen above it, weed at the water
  const wet = g();
  const weed = g();
  const lichen = g();
  const ph = rng.range(0, 6);
  wet[0]!.marks.push({ poly: band(x0 - 4, x1 + 4, (x) => bot(x) - 7 - 2.2 * Math.sin(x / 7 + ph) - noise(x / 5, 7), (x) => bot(x) + 2, 2), alpha: 0.66 });
  for (let x = x0; x < x1; ) {
    const xb = Math.min(x1, x + rng.range(6, 18));
    if (rng.chance(0.65)) lichen[0]!.marks.push({ poly: band(x, xb, (q) => bot(q) - 12 - Math.sin(q / 6 + ph) * 1.5, (q) => bot(q) - 8.5, 2), alpha: rng.range(0.25, 0.4) });
    x = xb + rng.range(2, 8);
  }
  weed[0]!.marks.push({ poly: band(x0 - 4, x1 + 4, (x) => bot(x) - 2.6 + Math.sin(x / 2.9 + ph) * 0.7, (x) => bot(x) + 2, 2), alpha: 0.55 });
  for (let k = 0; k < (x1 - x0) / 7; k++) {
    const x = rng.range(x0, x1);
    weed[0]!.marks.push({ poly: streak({ x, y: bot(x) + 0.5 }, { x: x + rng.range(-1, 1), y: bot(x) - rng.range(3, 6) }, rng.range(1.6, 2.8), rng), alpha: 0.45 });
  }
  yield* clipBatch(p, wet, FOOT.wet, { edge: 0.2, sharpness: 0.55, granulation: 0.5 });
  yield* clipBatch(p, lichen, FOOT.lichen, { edge: 0.15, sharpness: 0.5, granulation: 0.6 });
  yield* clipBatch(p, weed, FOOT.weed, { edge: 0.15, sharpness: 0.5, granulation: 0.5 });
  yield* clipBatch(p, dark, LIME.deep, { edge: 0.25, sharpness: 0.75, granulation: 0.3 });
  yield* clipBatch(p, lit, LIME.lit, { edge: 0.05, sharpness: 0.6 }, true);

  // the floor's rock lip over the rim: bare limestone where the gravel thins out, cracked
  yield* paintLip(p, pf.rim, -1, rng.fork('lip'));

  // foam hugging the foot, and a fainter lap mark in front of it
  const foam: Mark[] = [];
  for (let x = x0 - 2; x < x1 + 2; ) {
    const xb = Math.min(x1 + 2, x + rng.range(5, 14));
    const th = rng.range(0.8, 1.7);
    if (rng.chance(0.8)) foam.push({ poly: band(x, xb, (q) => bot(q) + 0.2, (q) => bot(q) + 0.4 + th * Math.sin(((q - x) / Math.max(1, xb - x)) * Math.PI), 2), alpha: 0.85 });
    if (rng.chance(0.35)) foam.push({ poly: band(x, xb, (q) => bot(q) + 3.6, (q) => bot(q) + 3.6 + 0.8 * Math.sin(((q - x) / Math.max(1, xb - x)) * Math.PI), 2), alpha: 0.35 });
    x = xb + rng.range(0.8, 3);
  }
  yield* liftBatch(p, foam, FOOT.foam, { edge: 0.05, sharpness: 0.6 });
}

/**
 * The floor's rock lip along a rim (`side` -1: the floor lies above the line, +1: to its lower
 * right): a band of bare limestone, cracks running in from the edge, and the lit arris at the edge.
 */
function* paintLip(p: Painter, rim: readonly Pt[], side: number, rng: Rng): Strokes {
  const n = rim.length;
  const pts: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = rim[i]!;
    const b = rim[i + 1]!;
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 0; k < steps; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  }
  pts.push(rim[n - 1]!);
  const inward = pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return side < 0 ? { x: 0, y: -1 } : { x: (b.y - a.y) / l, y: -(b.x - a.x) / l };
  });
  const noise = createSimplex2D(rng.fork('lip'));
  const wide = pts.map((_, i) => 6 + 8 * (0.5 + 0.5 * noise(i / 6, 1)));
  const inner = pts.map((q, i) => ({ x: q.x + inward[i]!.x * wide[i]!, y: q.y + inward[i]!.y * wide[i]! }));
  const lip = rough([...pts, ...inner.slice().reverse()], rng, 1.1, 3);
  const cracks: Mark[] = [];
  for (let i = 2; i < pts.length - 2; i += rng.int(3, 7)) {
    const q = pts[i]!;
    const r = inner[i]!;
    cracks.push({ poly: streak({ x: q.x + inward[i]!.x * 0.6, y: q.y + inward[i]!.y * 0.6 }, { x: q.x + (r.x - q.x) * rng.range(0.5, 1.1), y: q.y + (r.y - q.y) * rng.range(0.5, 1.1) }, rng.range(0.8, 1.3), rng), alpha: rng.range(0.3, 0.5) });
  }
  const arris: Mark[] = [];
  for (let i = 0; i < pts.length - 1; ) {
    const j = Math.min(pts.length - 1, i + rng.int(3, 8));
    const seg = pts.slice(i, j + 1);
    if (rng.chance(0.8)) arris.push({ poly: [...seg.map((q, k) => ({ x: q.x + inward[i + k]!.x * 0.2, y: q.y + inward[i + k]!.y * 0.2 })), ...seg.slice().reverse().map((q, k) => ({ x: q.x + inward[j - k]!.x * 2.4, y: q.y + inward[j - k]!.y * 2.4 }))], alpha: 0.75 });
    i = j + rng.int(0, 2);
  }
  yield* wetBatch(p, [{ poly: lip, alpha: 0.62 }], mix(LIME.body, LIME.grey, 0.55), { edge: 0.12, sharpness: 0.4, granulation: 0.75, granules: 0.25, flow: 0.5, flowScale: 20 });
  yield* wetBatch(p, cracks, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  yield* liftBatch(p, arris, LIME.lit, { edge: 0.05 });
}

/**
 * The back edges, which run away from the viewer: the floor's lip ends in a crisp lit edge, a thin
 * dark line where the rock drops away under it, and the deeper water beyond in the rock's shade.
 * No foam and no stones: the sea meets this rock out of sight, at the foot of the drop.
 */
function* paintBackEdges(p: Painter, rng: Rng): Strokes {
  for (const [k, edge] of BACK_EDGES.entries()) {
    if (!inView(p, padRect(bounds(edge), 30))) continue;
    const r = rng.fork(`edge-${k}`);
    const pts: Pt[] = [];
    // an edge that leaves a face's foot starts a little in, clear of the face
    const from = k ? 1 : 0;
    for (let i = from; i < edge.length - 1; i++) {
      const a = edge[i]!;
      const b = edge[i + 1]!;
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let s = 0; s < steps; s++) pts.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
    pts.push(edge[edge.length - 1]!);
    // outward: toward the water (up and to the left of a line running down to the left)
    const out = pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(pts.length - 1, i + 1)]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    });
    const strip = (d0: number, d1: number, i0 = 0, i1 = pts.length - 1): Pt[] => {
      const s0: Pt[] = [];
      const s1: Pt[] = [];
      for (let i = i0; i <= i1; i++) {
        s0.push({ x: pts[i]!.x + out[i]!.x * d0, y: pts[i]!.y + out[i]!.y * d0 });
        s1.push({ x: pts[i]!.x + out[i]!.x * d1, y: pts[i]!.y + out[i]!.y * d1 });
      }
      return [...s0, ...s1.reverse()];
    };
    const shade: Mark[] = [{ poly: strip(0, 7), alpha: 0.36 }, { poly: strip(6, 13), alpha: 0.2 }, { poly: strip(12, 20), alpha: 0.09 }];
    // the rock's thickness at the edge, a sliver of its face with vertical cracks, then the drop's dark line
    const sliver: Mark[] = [{ poly: rough(strip(-0.6, 3), r, 0.5, 3), alpha: 0.6 }];
    const drop: Mark[] = [];
    for (let i = 0; i < pts.length - 1; ) {
      const j = Math.min(pts.length - 1, i + r.int(3, 9));
      drop.push({ poly: strip(2.6, 2.6 + r.range(1.2, 2.6), i, j), alpha: r.range(0.5, 0.7) });
      i = j;
    }
    for (let i = 1; i < pts.length - 1; i += r.int(1, 3)) drop.push({ poly: strip(0.4, r.range(2.4, 3.4), i, i + 1), alpha: r.range(0.25, 0.45) });
    yield* wetBatch(p, shade, FOOT.shade, { edge: 0.04, sharpness: 0.3, granulation: 0.3 });
    fillUnder(p, sliver[0]!.poly, LIME.under);
    yield* wetBatch(p, sliver, mix(LIME.grey, LIME.shade, 0.4), { edge: 0.12, sharpness: 0.5, granulation: 0.6 });
    yield* wetBatch(p, drop, mix(LIME.deep, FOOT.wet, 0.4), { edge: 0.2, sharpness: 0.6, granulation: 0.4 });
    yield* paintLip(p, edge, 1, r.fork('lip'));
  }
}
