/**
 * The coast's rock (G2): the limestone promontory under the temple, and the shore's rock (the
 * shelf and its pools' rims, the shoreline's lips and faces, its boulders, the splash rocks and
 * the stones at the beach's ends). Lit from the left, over the sea. docs/systems/scenery.md › Coast › Rock.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, createSimplex2D, mix, type Painter } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { POOLS, PROMONTORY, SHELF, SHORE_EDGE } from './layout';
import { LIME, band, box, clipTo, ellipse, fillUnder, lineAt, liftBatch, rough, streak, wetBatch, type Mark } from './rock-kit';
import { SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES, type RockShape } from './shapes';

const TIP = PROMONTORY.findIndex((q) => q.x >= 1620);
/** The promontory's top (the skyline) and its foot (the sea, then the top terrace's back), by x. */
const TOP: readonly Pt[] = [...PROMONTORY.slice(0, TIP + 1), { x: 1680, y: PROMONTORY[TIP]!.y }];
const FOOT: readonly Pt[] = [PROMONTORY[0]!, ...PROMONTORY.slice(TIP + 1).reverse(), { x: 1680, y: 500 }].sort((a, b) => a.x - b.x);
export const topAt = (x: number): number => lineAt(TOP, x);
export const footAt = (x: number): number => lineAt(FOOT, x);
/** Where the foot leaves the sea for the top terrace (the shoreline's first point). */
const LAND_FOOT = SHORE_EDGE[0]!.x;

/** The painted outline: the layout's, run on past the right edge and under the top terrace (which overlaps it). */
const OUTLINE: readonly Pt[] = [
  ...TOP,
  { x: 1680, y: 518 },
  ...FOOT.filter((q) => q.x > LAND_FOOT + 4 && q.x < 1680).reverse().map((q) => ({ x: q.x, y: q.y + 16 })),
  { x: LAND_FOOT + 6, y: footAt(LAND_FOOT) + 12 },
  ...FOOT.filter((q) => q.x <= LAND_FOOT).reverse(),
];

interface Fissure {
  x: number;
  lean: number;
  /** how far down the face it runs, 0..1 */
  depth: number;
  /** how far the beds step down across it */
  drop: number;
  seed: number;
}
interface Bed {
  y: number;
  hard: boolean;
}

const FORM_NOISE = createSimplex2D(createRng('coast-promontory-noise'));
/** The face's form, fixed (seeded by name): only the brushwork follows the art seed. */
export const PROMONTORY_FORM = (() => {
  const rng = createRng('coast-promontory-form');
  const fissures: Fissure[] = [];
  for (let x = 668; x < 1660; ) {
    fissures.push({ x, lean: rng.range(-0.1, 0.2), depth: rng.chance(0.3) ? rng.range(0.3, 0.6) : rng.range(0.78, 1), drop: rng.range(-3.5, 3.5), seed: rng.range(0, 100) });
    x += x < 900 ? rng.range(30, 70) : rng.range(60, 190);
  }
  const beds: Bed[] = [];
  for (let y = 336; y < 580; y += rng.range(8, 21)) beds.push({ y, hard: rng.chance(0.38) });
  return { fissures, beds };
})();

const SLOPE = -0.055;
/** A bed's height at x: tilted, stepped across the deep fissures, wandering a little. */
function bedAt(bed: Bed, x: number): number {
  let drop = 0;
  for (const f of PROMONTORY_FORM.fissures) if (f.depth > 0.75 && f.x < x) drop += f.drop;
  return bed.y + SLOPE * (x - 636) + drop + FORM_NOISE(x / 90, bed.y) * 2.2;
}
/** A fissure's x at depth y. */
function fissureAt(f: Fissure, y: number): number {
  return f.x + f.lean * (y - topAt(f.x)) + FORM_NOISE(y / 26, f.seed) * 2.4;
}
const fissureFoot = (f: Fissure): number => topAt(f.x) + (footAt(f.x) - topAt(f.x)) * f.depth;
/** The notch height the sea has cut along the seaward foot. */
const notchAt = (x: number): number => (x > LAND_FOOT + 4 ? 0 : Math.min(12, (footAt(x) - topAt(x)) * 0.28));

/** The pieces of [a, c] a broken line keeps: runs with gaps, cut at the deep fissures. */
function pieces(a: number, c: number, rng: Rng, keep = 0.7): [number, number][] {
  const out: [number, number][] = [];
  for (let x = a; x < c; ) {
    const len = rng.range(30, 170);
    if (rng.chance(keep)) {
      let x0 = x;
      const x1 = Math.min(c, x + len);
      for (const f of PROMONTORY_FORM.fissures) {
        if (f.depth < 0.75 || f.x <= x0 + 6 || f.x >= x1 - 6) continue;
        out.push([x0, f.x - rng.range(1, 3)]);
        x0 = f.x + rng.range(1, 3);
      }
      if (x1 - x0 > 6) out.push([x0, x1]);
    }
    x += len + rng.range(8, 50);
  }
  return out;
}

/** The near limestone promontory: a cliff in planes, beds and fissures, a sea-cut notch at its foot. */
export function* paintPromontory(p: Painter, rng: Rng): Strokes {
  const body = rough(OUTLINE, rng, 1.1, 4);
  fillUnder(p, body, LIME.under);
  clipTo(p, body);
  yield;
  // warm cream at the sunlit seaward end, white-grey along the face, cooler and greyer to the right
  yield* p.parts.wetInWet(box(610, 280, 1690, 530), LIME.cream, mix(LIME.body, LIME.grey, 0.3), {
    rng, angle: 0.12, split: 0.32, softness: 0.8, opacity: 0.36, deform: 0.03, spread: 0.03, edge: 0, granulation: 0.6, granules: 0.16, flow: 0.55, flowScale: 70,
    drops: [{ pigment: LIME.ochre, at: { x: 760, y: 430 }, size: 0.12, alpha: 0.22 }, { pigment: LIME.grey, at: { x: 1150, y: 420 }, size: 0.2, alpha: 0.3 }],
  });
  yield;
  yield* paintPlanes(p, rng.fork('planes'));
  yield* paintBeds(p, rng.fork('beds'));
  yield* paintFissures(p, rng.fork('fissures'));
  yield* paintStains(p, rng.fork('stains'));
  yield* paintFoot(p, rng.fork('foot'));
  p.ctx.restore();
}

/** Each block between deep fissures in planes: a narrow shade plane on its right, a half-tone facet on some, the lit face left pale. */
function* paintPlanes(p: Painter, rng: Rng): Strokes {
  const deep = PROMONTORY_FORM.fissures.filter((f) => f.depth > 0.75);
  const shade: Mark[] = [];
  const half: Mark[] = [];
  const lit: Mark[] = [];
  for (let i = 0; i < deep.length; i++) {
    const a = deep[i - 1]?.x ?? 636;
    const f = deep[i]!;
    const w = f.x - a;
    const y0 = Math.min(topAt(a), topAt(f.x)) - 6;
    const y1 = fissureFoot(f) + 4;
    // one plane from the rim down, its width easing between the hard beds and jogging at them; graded darker into the recess
    const jogs = PROMONTORY_FORM.beds.filter((q) => q.hard).map((q) => ({ y: bedAt(q, f.x), d: rng.range(-0.08, 0.08) * w })).filter((j) => j.y > y0 + 10 && j.y < y1 - 10);
    const k0 = rng.range(0.2, 0.45);
    const widen = rng.range(-0.3, 0.3);
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let y = y0; y <= y1; y += 4) {
      const t = (y - y0) / (y1 - y0);
      const jog = jogs.reduce((s, j) => s + j.d * Math.min(1, Math.max(0, (y - j.y) / 4)), 0);
      left.push({ x: fissureAt(f, y) - w * k0 * (1 + widen * (t - 0.5)) + jog + FORM_NOISE(y / 30, f.seed + 7) * 2.5, y });
      right.push({ x: fissureAt(f, y) + 0.6, y });
    }
    const towards = (k: number) => [...left.map((q, n) => ({ x: q.x + (right[n]!.x - q.x) * k, y: q.y })), ...right.slice().reverse()];
    shade.push({ poly: towards(0), alpha: rng.chance(0.3) ? rng.range(0.3, 0.4) : rng.range(0.14, 0.24) });
    shade.push({ poly: towards(0.4), alpha: 0.14 });
    shade.push({ poly: towards(0.75), alpha: 0.14 });
    if (rng.chance(0.4) && w > 50) half.push({ poly: [...left.map((q) => ({ x: q.x - w * 0.18, y: q.y })), ...left.slice().reverse()], alpha: rng.range(0.1, 0.18) });
    if (rng.chance(0.75)) {
      const h = (footAt(a + w / 2) - topAt(a + w / 2)) * rng.range(0.35, 0.75);
      lit.push({ poly: band(a + 2, f.x - w * 0.3, (x) => topAt(x) - 4, (x) => topAt(x) + h * (0.6 + 0.4 * FORM_NOISE(x / 30, f.seed)), 6), alpha: rng.range(0.55, 0.85) });
    }
  }
  yield* liftBatch(p, lit, LIME.lit, { edge: 0.05, sharpness: 0.3 });
  yield* wetBatch(p, half, mix(LIME.shade, LIME.body, 0.4), { edge: 0.15, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, shade, LIME.shade, { edge: 0.18, edgeWidth: 2, sharpness: 0.55, granulation: 0.6, granules: 0.1, flow: 0.45, flowScale: 50 });
}

/** The bedding: soft beds as thin broken lines; hard beds as ledges, a lit lip over an undercut lost downward; a few deep overhangs. */
function* paintBeds(p: Painter, rng: Rng): Strokes {
  const lines: Mark[] = [];
  const under: Mark[] = [];
  const deep: Mark[] = [];
  const lips: Mark[] = [];
  const inFace = (x: number, y: number, pad: number) => y > topAt(x) + pad && y < footAt(x) - notchAt(x) - pad - 2;
  for (const bed of PROMONTORY_FORM.beds) {
    const at = (x: number) => bedAt(bed, x);
    for (const [a, c0] of pieces(640, 1670, rng, bed.hard ? 0.55 : 0.4)) {
      // short runs, kept where they lie on the face
      const c = Math.min(c0, a + rng.range(24, bed.hard ? 120 : 80));
      let x0 = a;
      while (x0 < c && !inFace(x0, at(x0), 3)) x0 += 4;
      let x1 = c;
      while (x1 > x0 && !inFace(x1, at(x1), 3)) x1 -= 4;
      if (x1 - x0 < 12) continue;
      const sag = (x: number) => at(x) + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * rng.range(-0.6, 1.4);
      if (!bed.hard) {
        const th = rng.range(0.6, 1.3);
        lines.push({ poly: rough(band(x0, x1, sag, (x) => sag(x) + th, 10), rng, 0.6, 3), alpha: rng.range(0.08, 0.2) });
        continue;
      }
      const th = rng.range(3, 7) * Math.min(1, (footAt((x0 + x1) / 2) - topAt((x0 + x1) / 2)) / 70 + 0.3);
      lips.push({ poly: rough(band(x0 + 2, x1 - 2, (x) => sag(x) - 2.2, (x) => sag(x) - 0.3, 6), rng, 0.4, 3), alpha: 0.6 });
      under.push({ poly: rough(band(x0, x1, sag, (x) => sag(x) + th * 0.4, 6), rng, 0.6, 3), alpha: 0.3 });
      under.push({ poly: rough(band(x0 + 3, x1 - 3, sag, (x) => sag(x) + th * (0.85 + 0.2 * FORM_NOISE(x / 20, bed.y)), 6), rng, 1.1, 4), alpha: 0.14 });
      if (x0 < 1100 && x1 - x0 > 40 && rng.chance(0.06)) {
        const m = x0 + rng.range(0.15, 0.4) * (x1 - x0);
        const n = Math.min(x1 - 4, m + rng.range(18, 40));
        deep.push({ poly: rough(band(m, n, (x) => sag(x) + 0.4, (x) => sag(x) + th * 1.6 * Math.sin(((x - m) / (n - m)) * Math.PI) + 1, 3), rng, 0.8, 3), alpha: 0.3 });
      }
    }
  }
  yield;
  yield* wetBatch(p, lines, LIME.recess, { edge: 0.15, sharpness: 0.5, granulation: 0.3 });
  yield* wetBatch(p, under, LIME.recess, { edge: 0.25, sharpness: 0.75, granulation: 0.5 });
  yield* wetBatch(p, deep, LIME.deep, { edge: 0.3, sharpness: 0.8, granulation: 0.4 });
  yield* liftBatch(p, lips, LIME.lit, { edge: 0.05, sharpness: 0.8 });
}

/** The fissures: dark, broken, tapering down; a lit hairline on the sunward wall of the deep ones. */
function* paintFissures(p: Painter, rng: Rng): Strokes {
  const dark: Mark[] = [];
  const lit: Mark[] = [];
  const crack = (f: Fissure, y0: number, y1: number, w0: number): Pt[] => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let y = y0; y <= y1; y += 3) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const hw = w0 * (1 - t * 0.75) * (0.6 + 0.6 * Math.abs(FORM_NOISE(y / 9, f.seed + 3)));
      const x = fissureAt(f, y);
      left.push({ x: x - hw, y });
      right.push({ x: x + hw, y });
    }
    return [...left, ...right.reverse()];
  };
  for (const f of PROMONTORY_FORM.fissures) {
    const top = topAt(f.x) + rng.range(0, 6);
    const foot = fissureFoot(f);
    for (let y = top; y < foot - 4; ) {
      const len = rng.range(14, 60);
      const y1 = Math.min(foot, y + len);
      if (rng.chance(0.82)) dark.push({ poly: crack(f, y, y1, f.depth > 0.75 ? rng.range(0.9, 1.6) : rng.range(0.5, 0.9)), alpha: rng.range(0.5, 0.85) });
      if (f.depth > 0.75 && rng.chance(0.5)) lit.push({ poly: crack({ ...f, x: f.x + 2.2 }, y, y1, 0.5), alpha: 0.6 });
      y = y1 + rng.range(2, 10);
    }
    // a few side cracks off the deep ones
    if (f.depth > 0.75 && rng.chance(0.6)) {
      const y = topAt(f.x) + (foot - topAt(f.x)) * rng.range(0.2, 0.6);
      const x = fissureAt(f, y);
      const dx = rng.range(-26, -8);
      dark.push({ poly: streak({ x, y }, { x: x + dx, y: y + rng.range(6, 22) }, 1.4, rng), alpha: 0.4 });
    }
  }
  yield* wetBatch(p, dark, LIME.deep, { edge: 0.25, edgeWidth: 1, sharpness: 0.8, granulation: 0.3 });
  yield* liftBatch(p, lit, LIME.lit, { edge: 0, sharpness: 0.7 });
}

/** Rust and ochre stains under the ledges and the rim, a few grey dissolution streaks, fine runnels. */
function* paintStains(p: Painter, rng: Rng): Strokes {
  const ochre: Mark[] = [];
  const rust: Mark[] = [];
  const grey: Mark[] = [];
  const runnels: Mark[] = [];
  const hard = PROMONTORY_FORM.beds.filter((b) => b.hard);
  for (let i = 0; i < 34; i++) {
    const x = rng.range(650, 1640);
    const from = rng.chance(0.4) ? topAt(x) + 2 : bedAt(rng.pick(hard), x) + 2;
    const room = footAt(x) - notchAt(x) - from - 4;
    if (room < 10 || from < topAt(x)) continue;
    const len = Math.min(room, rng.range(14, 80));
    const s = streak({ x, y: from }, { x: x + rng.range(-3, 3), y: from + len }, rng.range(3, 9), rng);
    const r = rng.next();
    (r < 0.5 ? ochre : r < 0.72 ? rust : grey).push({ poly: s, alpha: rng.range(0.14, 0.3) });
  }
  // the limestone's long grey streaks from the rim and the ledges, wider and paler than the runnels
  for (let i = 0; i < 46; i++) {
    const x = rng.range(640, 1660);
    const y = rng.chance(0.5) ? topAt(x) + 1 : rng.range(topAt(x) + 4, footAt(x) - 30);
    const room = footAt(x) - notchAt(x) - y - 4;
    if (room < 12) continue;
    grey.push({ poly: streak({ x, y }, { x: x + rng.range(-2, 2), y: y + Math.min(room, rng.range(20, 110)) }, rng.range(2.5, 8), rng), alpha: rng.range(0.07, 0.16) });
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.range(640, 1660);
    const y = rng.range(topAt(x) + 4, footAt(x) - 8);
    runnels.push({ poly: streak({ x, y }, { x: x + rng.range(-1, 1), y: y + rng.range(8, 26) }, rng.range(0.8, 1.6), rng), alpha: rng.range(0.1, 0.2) });
  }
  yield* wetBatch(p, ochre, LIME.ochre, { edge: 0.1, sharpness: 0.4, granulation: 0.5 });
  yield* wetBatch(p, rust, LIME.rust, { edge: 0.1, sharpness: 0.4, granulation: 0.5 });
  yield* wetBatch(p, [...grey, ...runnels], LIME.grey, { edge: 0.12, sharpness: 0.5, granulation: 0.4 });
}

/** The foot: a cool shade low on the face, the sea-cut notch under a lit lip and the wet band at the water, scree onto the top terrace. */
function* paintFoot(p: Painter, rng: Rng): Strokes {
  yield* p.parts.glaze(box(610, 380, 1690, 530), mix(LIME.shade, LIME.recess, 0.3), { rng, opacity: 0.24, edge: 0, deform: 0.02, fade: { angle: -Math.PI / 2, start: 0.55, amount: 1, ragged: 0.5 } });
  yield;
  const notch: Mark[] = [];
  const wet: Mark[] = [];
  const algae: Mark[] = [];
  const lip: Mark[] = [];
  const x1 = LAND_FOOT + 6;
  // the notch in runs of its own depth, broken where a buttress's foot comes down to the water
  for (let x = 632; x < x1; ) {
    const len = rng.range(18, 70);
    const b = Math.min(x1, x + len);
    const k = rng.range(0.5, 1.2);
    const top = (q: number) => footAt(q) - 3 - notchAt(q) * k * (0.75 + 0.25 * Math.sin(((q - x) / (b - x)) * Math.PI)) + FORM_NOISE(q / 12, 3) * 1;
    notch.push({ poly: rough(band(x, b, top, (q) => top(q) + notchAt(q) * k * 0.45, 3), rng, 0.6, 3), alpha: rng.range(0.16, 0.3) });
    notch.push({ poly: rough(band(x + 1, b - 1, top, (q) => footAt(q) - 1, 3), rng, 0.6, 3), alpha: 0.12 });
    if (rng.chance(0.15)) lip.push({ poly: band(x + 2, b - 2, (q) => top(q) - 1.8, (q) => top(q) - 0.3, 3), alpha: 0.6 });
    x = b + rng.range(5, 16);
  }
  const wetTop = (x: number) => footAt(x) - 3.2 - 2 * (0.5 + 0.5 * FORM_NOISE(x / 18, 5));
  wet.push({ poly: band(630, x1, wetTop, (x) => footAt(x) + 3, 3), alpha: 0.42 });
  algae.push({ poly: band(630, x1, (x) => wetTop(x) + 1.6, (x) => footAt(x) + 3, 3), alpha: 0.34 });
  yield* wetBatch(p, notch, LIME.recess, { edge: 0.08, sharpness: 0.35, granulation: 0.4 });
  yield* liftBatch(p, lip, LIME.lit, { edge: 0.05, sharpness: 0.8 });
  yield* wetBatch(p, wet, LIME.wet, { edge: 0.25, sharpness: 0.7, granulation: 0.5 });
  yield* wetBatch(p, algae, LIME.algae, { edge: 0.1, granulation: 0.5 });
  // scree cones under the deep fissures where the face meets the top terrace
  const cone: Mark[] = [];
  const coneShade: Mark[] = [];
  const pebbles: Mark[] = [];
  for (const f of PROMONTORY_FORM.fissures.filter((q) => q.x > LAND_FOOT + 20 && q.depth > 0.75)) {
    const y = footAt(f.x);
    const x = fissureAt(f, y);
    const w = rng.range(26, 50);
    const h = rng.range(26, 46);
    cone.push({ poly: rough([{ x: x - 3, y: y - h }, { x: x + 3, y: y - h }, { x: x + w, y: y + 10 }, { x: x - w, y: y + 10 }], rng, 2.5, 5), alpha: 0.5 });
    coneShade.push({ poly: rough([{ x: x + 1, y: y - h }, { x: x + 4, y: y - h }, { x: x + w, y: y + 10 }, { x: x + w * 0.2, y: y + 10 }], rng, 2, 5), alpha: 0.28 });
    for (let k = 0; k < 4; k++) {
      const t = rng.next();
      pebbles.push({ poly: ellipse(x + rng.range(-w, w) * t, y - h * (1 - t) + rng.range(0, 6), rng.range(1, 2.6), rng.range(0.8, 1.6), 8), alpha: rng.range(0.22, 0.42) });
    }
  }
  yield* liftBatch(p, cone, LIME.under, { edge: 0.05, granulation: 0.6, granules: 0.25 });
  yield* wetBatch(p, coneShade, LIME.shade, { edge: 0.1, granulation: 0.6 });
  yield* wetBatch(p, pebbles, LIME.recess, { edge: 0.4, sharpness: 0.8 });
}

// ---------------------------------------------------------------------------------------------
// The shore's rock

/** The pools' holes in the shelf (their water is the water painter's). */
const POOL_HOLES: readonly Pt[][] = POOLS.map((q) => ellipse(q.cx, q.cy, q.rx - 1, q.ry - 0.8, 36));

/** The shoreline's runs that face the viewer (its rock face shows under the edge) and those that face away (a lip shows). */
function shoreRuns(): { face: Pt[][]; lip: Pt[][] } {
  const face: Pt[][] = [];
  const lip: Pt[][] = [];
  let run: Pt[] = [SHORE_EDGE[0]!];
  let facing = SHORE_EDGE[1]!.x > SHORE_EDGE[0]!.x;
  for (let i = 1; i < SHORE_EDGE.length; i++) {
    const q = SHORE_EDGE[i]!;
    const f = q.x > SHORE_EDGE[i - 1]!.x;
    if (f !== facing) {
      (facing ? face : lip).push(run);
      run = [SHORE_EDGE[i - 1]!];
      facing = f;
    }
    run.push(q);
  }
  (facing ? face : lip).push(run);
  return { face, lip };
}

export const SHORE_RUNS = shoreRuns();

/** The shore's rock, after the land: the shelf and pool rims, the shoreline's lips and faces, boulders, splash rocks, beach-end stones. */
export function* paintShoreRocks(p: Painter, rng: Rng): Strokes {
  yield* paintShelf(p, rng.fork('shelf'));
  yield* paintShoreline(p, rng.fork('shoreline'));
  const stones = rng.fork('stones');
  for (const s of BEACH_STONES) {
    p.stone({ x: s.x, y: s.y, w: s.w, h: s.w * 0.5 }, { rng: stones, pigment: mix(LIME.body, LIME.grey, 0.3), warm: 0.35, light: -2.7, moss: 0, ink: 0.18, granulation: 0.5, patches: 1 });
    yield;
  }
  for (const [i, r] of SHORE_BOULDER_SHAPES.entries()) yield* paintRock(p, r, rng.fork(`boulder-${i}`));
  for (const [i, r] of SPLASH_ROCK_SHAPES.entries()) yield* paintRock(p, r, rng.fork(`splash-${i}`));
}

/** Stones at the beach's two ends: under the pine's rock on the left, by the steps on the right. */
const BEACH_STONES: readonly { x: number; y: number; w: number }[] = [
  { x: 108, y: 786, w: 26 }, { x: 136, y: 800, w: 16 }, { x: 70, y: 812, w: 20 }, { x: 160, y: 776, w: 12 },
  { x: 610, y: 838, w: 22 }, { x: 640, y: 826, w: 28 }, { x: 588, y: 848, w: 14 }, { x: 660, y: 846, w: 16 },
];

/** The rock shelf in front of the beach: pale slabs with cracks and pits, wet round its pools. */
function* paintShelf(p: Painter, rng: Rng): Strokes {
  const shelf = rough([{ x: -30, y: SHELF[0]!.y - 2 }, ...SHELF.slice(1, 5).map((q) => ({ x: q.x, y: q.y - 2 })), { x: 666, y: 1030 }, { x: -30, y: 1030 }], rng, 1.8, 5);
  clipTo(p, shelf, POOL_HOLES);
  fillUnder(p, box(-40, 820, 700, 1040), LIME.under);
  yield;
  yield* p.parts.wetInWet(box(-40, 820, 700, 1040), mix(LIME.cream, LIME.body, 0.5), LIME.grey, { rng, angle: Math.PI / 2 - 0.3, split: 0.45, softness: 0.7, opacity: 0.5, deform: 0.03, spread: 0.03, edge: 0, granulation: 0.7, granules: 0.25, flow: 0.5, flowScale: 60 });
  yield;
  // slab edges: a dark crack with a lit lip above, the slabs' fronts a shade lower
  const cracks: Mark[] = [];
  const fronts: Mark[] = [];
  const lips: Mark[] = [];
  const noise = createSimplex2D(rng.fork('slabs'));
  for (let y = 858; y < 1010; y += rng.range(12, 26)) {
    const tilt = rng.range(-0.04, 0.04);
    const at = (x: number) => y + tilt * (x - 300) + noise(x / 60, y) * 3;
    for (let x = rng.range(-30, 40); x < 680; ) {
      const len = rng.range(40, 200);
      const x1 = Math.min(680, x + len);
      if (rng.chance(0.7)) {
        cracks.push({ poly: rough(band(x, x1, at, (q) => at(q) + rng.range(0.8, 1.5), 8), rng, 0.6, 3), alpha: rng.range(0.4, 0.7) });
        const h = rng.range(3, 7);
        fronts.push({ poly: rough(band(x + 2, x1 - 2, (q) => at(q) + 1, (q) => at(q) + h, 8), rng, 0.8, 4), alpha: rng.range(0.18, 0.3) });
        lips.push({ poly: band(x + 3, x1 - 3, (q) => at(q) - 2, (q) => at(q) - 0.5, 8), alpha: 0.55 });
      }
      x = x1 + rng.range(10, 60);
    }
  }
  const pits: Mark[] = [];
  for (let i = 0; i < 110; i++) {
    const x = rng.range(-10, 670);
    const y = rng.range(852, 1000);
    if (POOLS.some((q) => ((x - q.cx) / (q.rx + 6)) ** 2 + ((y - q.cy) / (q.ry + 5)) ** 2 < 1)) continue;
    pits.push({ poly: ellipse(x, y, rng.range(0.8, 2.6), rng.range(0.5, 1.4), 8), alpha: rng.range(0.3, 0.6) });
  }
  // the wet rock round each pool, the far inner wall in shade, a lit lip on the near rim
  const wet: Mark[] = [];
  const wall: Mark[] = [];
  const nearLip: Mark[] = [];
  for (const q of POOLS) {
    const outer = rough(ellipse(q.cx + 2, q.cy + 1, q.rx + 9, q.ry + 6, 40), rng, 2.5, 5);
    wet.push({ poly: outer, alpha: 0.2 });
    wet.push({ poly: rough(ellipse(q.cx + 1, q.cy + 0.5, q.rx + 4, q.ry + 2.6, 40), rng, 1.6, 4), alpha: 0.24 });
    wall.push({ poly: band(q.cx - q.rx * 0.92, q.cx + q.rx * 0.92, (x) => q.cy - q.ry * Math.sqrt(Math.max(0, 1 - ((x - q.cx) / q.rx) ** 2)) - 1, (x) => q.cy - q.ry * Math.sqrt(Math.max(0, 1 - ((x - q.cx) / q.rx) ** 2)) * 0.55, 4), alpha: 0.45 });
    nearLip.push({ poly: band(q.cx - q.rx * 0.7, q.cx + q.rx * 0.75, (x) => q.cy + q.ry * Math.sqrt(Math.max(0, 1 - ((x - q.cx) / q.rx) ** 2)) + 1.6, (x) => q.cy + q.ry * Math.sqrt(Math.max(0, 1 - ((x - q.cx) / q.rx) ** 2)) + 3.6, 4), alpha: 0.6 });
  }
  yield* wetBatch(p, fronts, LIME.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.6 });
  yield* wetBatch(p, cracks, LIME.deep, { edge: 0.25, sharpness: 0.8, granulation: 0.3 });
  yield* liftBatch(p, lips, LIME.lit, { edge: 0.05 });
  yield* wetBatch(p, pits, LIME.recess, { edge: 0.4, sharpness: 0.8 });
  yield* wetBatch(p, wet, mix(LIME.wet, LIME.algae, 0.3), { edge: 0.15, sharpness: 0.5, granulation: 0.6 });
  p.ctx.restore();
  // the rims reach over the water's edge, so the pools sit in the rock
  const rims: Mark[] = POOLS.map((q) => {
    const o = rough(ellipse(q.cx, q.cy, q.rx + 1.5, q.ry + 1.2, 40), rng, 1.1, 3);
    const i = rough(ellipse(q.cx, q.cy, q.rx - 2.2, q.ry - 1.6, 40), rng, 0.7, 3);
    return { poly: [...o, o[0]!, i[0]!, ...i.reverse()], alpha: 0.4 };
  });
  yield* wetBatch(p, rims, LIME.wet, { edge: 0.3, sharpness: 0.7, granulation: 0.4 });
  yield* wetBatch(p, wall, mix(LIME.algae, LIME.recess, 0.5), { edge: 0.1, sharpness: 0.5, granulation: 0.4 });
  yield* liftBatch(p, nearLip, LIME.lit, { edge: 0.05 });
}

/** The broken shoreline: a low rock face under the runs that face the viewer, a rocky lip along those that face away. */
function* paintShoreline(p: Painter, rng: Rng): Strokes {
  const faces = SHORE_RUNS.face.map((run) => {
    const top = run.map((q, i) => ({ x: q.x + (i === 0 ? -4 : 0), y: q.y - 1.5 }));
    const h = (i: number) => 14 + 6 * Math.sin(i * 1.7);
    return rough([...top, ...top.slice().reverse().map((q, i) => ({ x: q.x + 3, y: q.y + h(i) }))], rng, 1.6, 4);
  });
  const lips = SHORE_RUNS.lip.map((run) => {
    const edge = run.map((q) => ({ x: q.x - 1.5, y: q.y }));
    return rough([...edge, ...edge.slice().reverse().map((q, i) => ({ x: q.x + 9 + 4 * Math.sin(i * 2.3), y: q.y + 3 }))], rng, 2, 4);
  });
  for (const f of faces) fillUnder(p, f, LIME.under);
  yield* liftBatch(p, lips.map((poly) => ({ poly, alpha: 0.85 })), LIME.under, { edge: 0.1, granulation: 0.4 });
  const body: Mark[] = [...faces, ...lips].map((poly) => ({ poly, alpha: 0.45 }));
  yield* wetBatch(p, body, mix(LIME.body, LIME.cream, 0.4), { edge: 0.15, sharpness: 0.6, granulation: 0.7, granules: 0.2 });
  // the faces: shaded lower down, wet at the water, a few fissures; the lips: a dark seam at the water
  const shade: Mark[] = [];
  const dark: Mark[] = [];
  const wet: Mark[] = [];
  const lit: Mark[] = [];
  for (const run of SHORE_RUNS.face) {
    const b = bounds(run);
    const at = (x: number) => lineAt(run, x);
    shade.push({ poly: band(b.x - 2, b.x + b.w + 2, (x) => at(x) + 5, (x) => at(x) + 18, 6), alpha: 0.4 });
    wet.push({ poly: band(b.x - 2, b.x + b.w + 3, (x) => at(x) + 11 + Math.sin(x / 6) * 1.5, (x) => at(x) + 20, 4), alpha: 0.6 });
    lit.push({ poly: band(b.x, b.x + b.w, (x) => at(x) - 2, (x) => at(x) + 0.5, 4), alpha: 0.7 });
    for (let x = b.x + rng.range(4, 12); x < b.x + b.w - 3; x += rng.range(8, 16)) {
      dark.push({ poly: streak({ x, y: at(x) + 1 }, { x: x + rng.range(-1, 2), y: at(x) + rng.range(8, 16) }, rng.range(1, 1.8), rng), alpha: 0.6 });
    }
  }
  for (const run of SHORE_RUNS.lip) {
    const pts = run.map((q) => ({ x: q.x - 1, y: q.y }));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const c = pts[i]!;
      if (rng.chance(0.6)) dark.push({ poly: rough([a, c, { x: c.x + 1.6, y: c.y + 0.8 }, { x: a.x + 1.6, y: a.y + 0.8 }], rng, 0.7, 3), alpha: rng.range(0.2, 0.4) });
    }
  }
  yield* wetBatch(p, shade, LIME.shade, { edge: 0.15, sharpness: 0.5, granulation: 0.6 });
  yield* wetBatch(p, wet, LIME.wet, { edge: 0.25, sharpness: 0.7, granulation: 0.5 });
  yield* wetBatch(p, dark, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  yield* liftBatch(p, lit, LIME.lit, { edge: 0.05 });
}

/** One ledge above the water: a pale dry top, a low face in light shade to a dark wet foot, a broken block on its back lit on the left. */
function* paintRock(p: Painter, r: RockShape, rng: Rng): Strokes {
  const out = rough(r.outline, rng, 0.7, 3);
  fillUnder(p, out, LIME.under);
  clipTo(p, out);
  const b = bounds(out);
  const x1 = b.x + b.w;
  yield* p.parts.wetInWet(box(b.x - 4, b.y - 4, x1 + 4, b.y + b.h + 4), LIME.cream, mix(LIME.body, LIME.grey, 0.5), { rng, angle: 0.5, split: 0.5, softness: 0.6, opacity: 0.38, edge: 0, deform: 0.02, spread: 0.03, granulation: 0.7, granules: 0.2 });
  const faceAt = (x: number) => r.topY + 1 + Math.sin(x / 9 + r.x) * 0.8;
  const shade: Mark[] = [
    { poly: band(b.x - 2, x1 + 2, faceAt, () => r.y + 6, 6), alpha: 0.48 },
    // the right end of the face turned from the sun
    { poly: rough(box(r.x + r.w * rng.range(0.15, 0.3), r.topY - 2, x1 + 3, r.y + 6), rng, 1.2, 3), alpha: 0.3 },
  ];
  const lit: Mark[] = [{ poly: rough(r.top, rng, 0.8, 3), alpha: 0.8 }];
  if (r.block) {
    const { x0, x1: bx1, y } = r.block;
    const foot = r.topY - Math.max(5, r.w * 0.2) + 1;
    const arris = x0 + (bx1 - x0) * rng.range(0.55, 0.72);
    shade.push({ poly: rough(box(x0 - 1, y + 2.5, bx1 + 1, foot), rng, 0.5, 2), alpha: 0.2 });
    shade.push({ poly: rough(box(arris, y - 1, bx1 + 2, foot), rng, 0.5, 2), alpha: 0.38 });
    lit.push({ poly: rough(box(x0 + 1.5, y - 1, arris - 1, y + 2.6), rng, 0.4, 2), alpha: 0.7 });
  }
  yield* wetBatch(p, shade, LIME.shade, { edge: 0.25, sharpness: 0.7, granulation: 0.6 });
  yield* liftBatch(p, lit, LIME.lit, { edge: 0.05, sharpness: 0.5, granulation: 0.3 });
  const dark: Mark[] = [];
  // the shadow line under the top's front edge, broken; joints down the face; a crack across the top
  for (const [a, c] of [[b.x, r.x - r.w * 0.1], [r.x + r.w * 0.05, x1]] as const) {
    if (rng.chance(0.85)) dark.push({ poly: rough(band(a + 2, c - 2, (x) => faceAt(x) - 0.2, (x) => faceAt(x) + 1.3, 4), rng, 0.4, 2), alpha: 0.5 });
  }
  for (let k = 0; k < 1 + Math.round(r.w / 26); k++) {
    const x = r.x + rng.range(-0.42, 0.42) * r.w;
    const y = faceAt(x) + 1;
    dark.push({ poly: streak({ x, y }, { x: x + rng.range(-1.5, 1.5), y: r.y - rng.range(0, 3) }, rng.range(0.9, 1.6), rng), alpha: 0.5 });
  }
  if (r.w > 44) {
    const x = r.x + rng.range(-0.2, 0.2) * r.w;
    dark.push({ poly: streak({ x, y: r.topY - Math.max(5, r.w * 0.2) + 2 }, { x: x + rng.range(-6, 6), y: r.topY }, 1.1, rng), alpha: 0.35 });
  }
  yield* wetBatch(p, dark, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  const wetTop = (x: number) => r.y - Math.min(5, (r.y - r.topY) * 0.4) + Math.sin(x / 5 + r.x) * 1;
  yield* wetBatch(p, [
    { poly: band(b.x - 3, x1 + 3, wetTop, () => r.y + 7, 4), alpha: 0.62 },
    { poly: band(b.x - 3, x1 + 3, (x) => wetTop(x) + 2.2, () => r.y + 7, 4), alpha: 0.35 },
  ], mix(LIME.wet, LIME.algae, 0.35), { edge: 0.2, sharpness: 0.7, granulation: 0.5 });
  p.ctx.restore();
}
