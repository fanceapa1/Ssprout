/**
 * The coast's rock (G2): the limestone promontory under the temple, and the shore's rock (the
 * shelf and its pools' rims, the shoreline's lips and faces, its boulders, the splash rocks and
 * the stones at the beach's ends). Lit from the left, over the sea. docs/systems/scenery.md › Coast › Rock.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, createSimplex2D, mix, type Painter, type Pigment } from '../../paint';
import { resample } from '../../paint/geometry';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { POOLS, PROMONTORY, SHELF, SHORE_EDGE } from './layout';
import { inView, paintFlight } from './paint-land';
import { SAND, SEA } from './paint-water';
import { LIME, band, box, clipBatch, clipTo, ellipse, fillUnder, lineAt, liftBatch, rough, streak, wetBatch, type Mark } from './rock-kit';
import { BEACH_FLIGHT, BEACH_FLIGHT_BOX, CLIFF_STONES, SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES, type RockColumn, type RockShape } from './shapes';

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
  /** where it opens below the rim, 0..1 down the face (0: from the rim) */
  start: number;
  /** where a side branch leaves it, 0..1 down the face (0: none) */
  branch: number;
}
interface Bed {
  y: number;
  hard: boolean;
  /** its own tilt on the face's slope, and how far it wanders */
  tilt: number;
  wander: number;
}

const FORM_NOISE = createSimplex2D(createRng('coast-promontory-noise'));
/** The face's form, fixed (seeded by name): only the brushwork follows the art seed. */
export const PROMONTORY_FORM = (() => {
  const rng = createRng('coast-promontory-form');
  const fissures: Fissure[] = [];
  for (let x = 668; x < 1660; ) {
    fissures.push({ x, lean: rng.range(-0.22, 0.3), depth: rng.chance(0.3) ? rng.range(0.3, 0.6) : rng.range(0.78, 1), drop: rng.range(-4.5, 4.5), seed: rng.range(0, 100), start: rng.chance(0.3) ? rng.range(0.15, 0.4) : 0, branch: rng.chance(0.4) ? rng.range(0.25, 0.6) : 0 });
    // some fissures come in pairs a joint's width apart, the rest at uneven spacing
    x += rng.chance(0.25) ? rng.range(12, 26) : x < 900 ? rng.range(34, 95) : rng.range(55, 210);
  }
  const beds: Bed[] = [];
  for (let y = 336; y < 580; y += rng.chance(0.3) ? rng.range(5, 9) : rng.range(12, 32)) beds.push({ y, hard: rng.chance(0.38), tilt: rng.range(-0.04, 0.04), wander: rng.range(1.5, 6) });
  return { fissures, beds };
})();

const SLOPE = -0.055;
/** A bed's height at x: tilted (each bed its own way), stepped across the deep fissures, wandering. */
function bedAt(bed: Bed, x: number): number {
  let drop = 0;
  for (const f of PROMONTORY_FORM.fissures) if (f.depth > 0.75 && f.x < x) drop += f.drop;
  return bed.y + (SLOPE + bed.tilt) * (x - 636) + drop + FORM_NOISE(x / 90, bed.y) * bed.wander + FORM_NOISE(x / 23, bed.y + 9) * 1.2;
}
/** A fissure's x at depth y: zigzagging at two scales. */
function fissureAt(f: Fissure, y: number): number {
  return f.x + f.lean * (y - topAt(f.x)) + FORM_NOISE(y / 40, f.seed) * 4 + FORM_NOISE(y / 11, f.seed + 5) * 1.6;
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
      // the lip crumbles: lit in broken pieces, its undercut thick and thin along the run
      for (let x = x0 + 2; x < x1 - 2; ) {
        const e = Math.min(x1 - 2, x + rng.range(6, 30));
        if (rng.chance(0.7)) lips.push({ poly: rough(band(x, e, (q) => sag(q) - rng.range(1.6, 2.6), (q) => sag(q) - 0.3, 4), rng, 0.4, 3), alpha: 0.6 });
        x = e + rng.range(1, 6);
      }
      under.push({ poly: rough(band(x0, x1, sag, (x) => sag(x) + th * (0.25 + 0.3 * Math.abs(FORM_NOISE(x / 14, bed.y + 2))), 4), rng, 0.6, 3), alpha: 0.3 });
      under.push({ poly: rough(band(x0 + 3, x1 - 3, sag, (x) => sag(x) + th * (0.7 + 0.5 * FORM_NOISE(x / 20, bed.y)), 6), rng, 1.1, 4), alpha: 0.14 });
      // an overhang here and there: a shadow deep under its outer end, lost toward the face
      if (x1 - x0 > 30 && rng.chance(0.2)) {
        const m = x0 + rng.range(0.05, 0.5) * (x1 - x0);
        const n = Math.min(x1 - 2, m + rng.range(16, 46));
        const k = rng.chance(0.5) ? 1 : -1;
        deep.push({ poly: rough(band(m, n, (x) => sag(x) + 0.4, (x) => sag(x) + 1 + th * 1.5 * Math.pow(k > 0 ? 1 - (x - m) / (n - m) : (x - m) / (n - m), 0.6), 3), rng, 0.8, 3), alpha: 0.3 });
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
    const top = topAt(f.x) + rng.range(0, 6) + (fissureFoot(f) - topAt(f.x)) * f.start;
    const foot = fissureFoot(f);
    // a branch leaving it on a slant and dying out
    if (f.branch) {
      const y = topAt(f.x) + (foot - topAt(f.x)) * f.branch;
      const x = fissureAt(f, y);
      const lean = f.lean + (rng.chance(0.5) ? 0.45 : -0.45);
      dark.push({ poly: crack({ ...f, x: x - lean * (y - topAt(x)), lean, seed: f.seed + 17 }, y, Math.min(foot + 10, y + rng.range(20, 60)), rng.range(0.5, 1)), alpha: rng.range(0.4, 0.65) });
    }
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
  // the undercut: one soft recess along the seaward foot, deepening downward, its depth wandering
  // and pinched where a buttress comes down; a lit overhang over it in places
  const depth = (q: number) => notchAt(q) * (0.75 + 0.35 * FORM_NOISE(q / 40, 3)) * (0.55 + 0.45 * Math.abs(FORM_NOISE(q / 17, 8)));
  const top = (q: number) => footAt(q) - 3 - depth(q) + FORM_NOISE(q / 9, 3) * 0.8;
  for (const k of [0, 0.35, 0.65]) notch.push({ poly: rough(band(632, x1, (q) => top(q) + depth(q) * k, (q) => footAt(q) + 1, 3), rng, 0.5, 3), alpha: 0.16 });
  for (let x = 640; x < x1; ) {
    const b = Math.min(x1, x + rng.range(10, 40));
    if (rng.chance(0.3)) lip.push({ poly: band(x, b, (q) => top(q) - 1, (q) => top(q) - 0.1, 3), alpha: 0.35 });
    x = b + rng.range(6, 30);
  }
  const wetTop = (x: number) => footAt(x) - 3.2 - 2.5 * (0.5 + 0.5 * FORM_NOISE(x / 18, 5)) - depth(x) * 0.25;
  wet.push({ poly: band(630, x1, wetTop, (x) => footAt(x) + 3, 3), alpha: 0.5 });
  algae.push({ poly: band(630, x1, (x) => wetTop(x) + 1.6, (x) => footAt(x) + 3, 3), alpha: 0.34 });
  yield* wetBatch(p, notch, LIME.recess, { edge: 0.08, sharpness: 0.35, granulation: 0.4 });
  yield* liftBatch(p, lip, LIME.lit, { edge: 0.05, sharpness: 0.8 });
  yield* wetBatch(p, wet, LIME.wet, { edge: 0.25, sharpness: 0.7, granulation: 0.5 });
  yield* wetBatch(p, algae, LIME.algae, { edge: 0.1, granulation: 0.5 });
}

/** The top terrace's back edge (the land's), which the cliff's foot is painted over. */
const LAND_BACK: readonly Pt[] = [SHORE_EDGE[0]!, { x: 1040, y: 500 }, { x: 1300, y: 498 }, { x: 1620, y: 496 }, { x: 1690, y: 496 }];

/**
 * The cliff's foot over the top terrace's back (after the land): the face's base in a cool shade,
 * an uneven foot coming down over the gravel's edge, its shadow on the gravel, scree fans under
 * the fissures and stones fallen onto the terrace.
 */
export function* paintCliffFoot(p: Painter, rng: Rng): Strokes {
  if (!inView(p, { x: LAND_FOOT - 20, y: 420, w: 820, h: 120 })) return;
  const noise = createSimplex2D(rng.fork('foot'));
  const back = (x: number) => lineAt(LAND_BACK, x);
  const foot = (x: number) => back(x) + 2 + 7 * Math.max(0, noise(x / 46, 1)) + 2.5 * noise(x / 9, 2);
  const x0 = LAND_FOOT - 2;
  const x1 = 1690;
  const ramp = (x: number) => Math.min(1, (x - x0) / 30);
  // the face's base in shade, so the lit terrace stands in front of a wall of rock
  const rise = (x: number) => foot(x) - (34 + 26 * (0.5 + 0.5 * noise(x / 70, 3))) * ramp(x);
  yield* p.parts.glaze(band(x0, x1, rise, (x) => foot(x) + 1, 10), mix(LIME.shade, LIME.recess, 0.35), { rng, opacity: 0.34, edge: 0, deform: 0.08, spread: 0.1, granulation: 0.5, fade: { angle: -Math.PI / 2, start: 0.05, amount: 1, ragged: 0.8 } });
  // the foot itself: rock over the gravel's straight edge, ending unevenly
  const toe = rough(band(x0, x1, (x) => back(x) - 3, foot, 6), rng, 1.2, 3);
  fillUnder(p, toe, mix(LIME.under, LIME.body, 0.4));
  yield* wetBatch(p, [{ poly: toe, alpha: 0.45 }], mix(LIME.grey, LIME.shade, 0.4), { edge: 0.15, sharpness: 0.5, granulation: 0.7, granules: 0.2 });
  // the shadow at the base on the gravel, and the dark seam where the rock meets it
  const shadow: Mark[] = [];
  const seam: Mark[] = [];
  shadow.push({ poly: band(x0 + 6, x1, (x) => foot(x) - 1, (x) => foot(x) + (5 + 6 * (0.5 + 0.5 * noise(x / 30, 4))) * ramp(x), 6), alpha: 0.3 });
  shadow.push({ poly: band(x0 + 6, x1, (x) => foot(x) - 1, (x) => foot(x) + 2.5 * ramp(x), 6), alpha: 0.3 });
  for (let x = x0 + 4; x < x1; ) {
    const len = rng.range(10, 50);
    if (rng.chance(0.7)) seam.push({ poly: band(x, Math.min(x1, x + len), (q) => foot(q) - 1.6, (q) => foot(q) + 0.4, 4), alpha: rng.range(0.35, 0.55) });
    x += len + rng.range(3, 16);
  }
  // scree fans: from a fissure's foot out over the gravel, pale debris shaded on the right, stones on it and beyond
  const fans: Mark[] = [];
  const fanShade: Mark[] = [];
  const stones: Mark[] = [];
  const stoneShade: Mark[] = [];
  const heads = PROMONTORY_FORM.fissures.filter((q) => q.x > LAND_FOOT + 24 && q.depth > 0.6).map((f) => fissureAt(f, footAt(f.x))).concat([968, 1136, 1262, 1468, 1566]);
  for (const x of heads) {
    const y = foot(x);
    const w = rng.range(24, 50);
    const h = rng.range(7, 18);
    const d = rng.range(5, 11);
    const lean = rng.range(-0.3, 0.3) * w;
    const fan = rough([{ x: x - 2, y: y - h }, { x: x + 2.5, y: y - h }, { x: x + w * 0.8 + lean, y: y + d * 0.5 }, { x: x + w * 0.4 + lean, y: y + d }, { x: x - w * 0.3 + lean, y: y + d * 0.9 }, { x: x - w * 0.9 + lean, y: y + d * 0.35 }], rng, 1.6, 3);
    fans.push({ poly: fan, alpha: 0.45 });
    fanShade.push({ poly: rough([{ x: x + 1, y: y - h }, { x: x + 3, y: y - h }, { x: x + w * 0.8 + lean, y: y + d * 0.5 }, { x: x + w * 0.4 + lean, y: y + d }, { x: x + w * 0.1 + lean, y: y + d * 0.9 }], rng, 1.2, 3), alpha: 0.3 });
    for (let k = 0; k < 7; k++) {
      const t = Math.sqrt(rng.next());
      const sx = x + lean * t + rng.range(-w, w) * t * 0.8;
      const sy = y - h * (1 - t) + d * t * rng.range(0.2, 1.4);
      const r = rng.range(0.9, 2.4) * (0.6 + t * 0.6);
      stones.push({ poly: ellipse(sx, sy, r, r * 0.6, 7), alpha: rng.range(0.35, 0.6) });
      stoneShade.push({ poly: ellipse(sx + r * 0.5, sy + r * 0.45, r * 0.9, r * 0.35, 7), alpha: 0.4 });
    }
  }
  yield* wetBatch(p, shadow, mix(LIME.shade, LIME.recess, 0.2), { edge: 0.05, sharpness: 0.3, granulation: 0.4 });
  yield* wetBatch(p, seam, LIME.recess, { edge: 0.2, sharpness: 0.6 });
  yield* wetBatch(p, fans, mix(LIME.grey, LIME.body, 0.6), { edge: 0.06, sharpness: 0.4, granulation: 0.9, granules: 0.4 });
  yield* wetBatch(p, fanShade, LIME.shade, { edge: 0.06, sharpness: 0.3, granulation: 0.7, opacity: 0.7 });
  yield* wetBatch(p, stones, mix(LIME.grey, LIME.body, 0.4), { edge: 0.35, sharpness: 0.7, granulation: 0.4 });
  yield* wetBatch(p, stoneShade, LIME.recess, { edge: 0.2, sharpness: 0.7 });
  yield* paintBoulders(p, CLIFF_STONES, rng.fork('stones'));
}

// ---------------------------------------------------------------------------------------------
// The shore's rock

/** The pools' holes in the shelf (their water is the water painter's). */
const POOL_HOLES: readonly Pt[][] = POOLS.map((q) => ellipse(q.cx, q.cy, q.rx - 1, q.ry - 0.8, 36));

/** A shoreline's runs that face the viewer (a rock face shows under the edge) and those that face away (a lip shows). */
function shoreRuns(edge: readonly Pt[]): { face: Pt[][]; lip: Pt[][] } {
  const face: Pt[][] = [];
  const lip: Pt[][] = [];
  let run: Pt[] = [edge[0]!];
  let facing = edge[1]!.x > edge[0]!.x;
  for (let i = 1; i < edge.length; i++) {
    const q = edge[i]!;
    const f = q.x > edge[i - 1]!.x;
    if (f !== facing) {
      (facing ? face : lip).push(run);
      run = [edge[i - 1]!];
      facing = f;
    }
    run.push(q);
  }
  (facing ? face : lip).push(run);
  return { face, lip };
}

export const SHORE_RUNS = shoreRuns(SHORE_EDGE);
/** The ledge runs down the shoreline to the head of the beach flight, where the rock yields to the steps. */
export const LEDGE_EDGE: readonly Pt[] = SHORE_EDGE.slice(0, SHORE_EDGE.findIndex((q) => q.y >= BEACH_FLIGHT_BOX.y) + 1);
const LEDGE_RUNS = shoreRuns(LEDGE_EDGE);

/** The colours where rock meets the sea: its broken reflection, the wet foot, weed, foam. */
const SEAM = {
  reflection: mix(SEA.deepTeal, LIME.wet, 0.5),
  glint: mix(SEA.aquaPale, LIME.lit, 0.5),
  wet: mix(LIME.wet, LIME.algae, 0.3),
  weed: mix(LIME.algae, '#3f4a2e', 0.35),
  foam: '#fdfcf5',
  cast: mix(LIME.shade, LIME.recess, 0.3),
} satisfies Record<string, Pigment>;

/** The shore's rock, after the land: the shelf and pool rims, the shoreline's ledge, the beach flight, boulders, beach-end stones. */
export function* paintShoreRocks(p: Painter, rng: Rng): Strokes {
  yield* paintShelf(p, rng.fork('shelf'));
  yield* paintShoreline(p, rng.fork('shoreline'));
  yield* paintFlight(p, BEACH_FLIGHT, rng.fork('flight'));
  const stones = rng.fork('stones');
  for (const s of BEACH_STONES) {
    p.stone({ x: s.x, y: s.y, w: s.w, h: s.w * 0.5 }, { rng: stones, pigment: mix(LIME.body, LIME.grey, 0.3), warm: 0.35, light: -2.7, moss: 0, ink: 0.18, granulation: 0.5, patches: 1 });
    yield;
  }
  yield* paintBoulders(p, [...SHORE_BOULDER_SHAPES, ...SPLASH_ROCK_SHAPES], rng.fork('boulders'));
}

/** Stones at the beach's two ends: under the pine's rock on the left, by the flight's foot on the right. */
const BEACH_STONES: readonly { x: number; y: number; w: number }[] = [
  { x: 108, y: 786, w: 26 }, { x: 136, y: 800, w: 16 }, { x: 70, y: 812, w: 20 }, { x: 160, y: 776, w: 12 },
  { x: 610, y: 838, w: 22 }, { x: 640, y: 830, w: 18 }, { x: 588, y: 848, w: 14 }, { x: 658, y: 842, w: 9 },
];

/** Rock tongues running up into the sand (d < 0) and hollows the sand drifts into (d > 0): centre, half-width, depth. */
const SHELF_LOBES: readonly { x: number; w: number; d: number }[] = [
  { x: 40, w: 30, d: -9 }, { x: 160, w: 34, d: 5 }, { x: 250, w: 22, d: -6 }, { x: 362, w: 34, d: -11 }, { x: 448, w: 28, d: 5 },
  { x: 506, w: 26, d: -9 }, { x: 560, w: 18, d: 4 }, { x: 622, w: 22, d: -7 },
];
export const shelfTopAt = (x: number): number =>
  lineAt(SHELF.slice(0, 5), x) - 2 + SHELF_LOBES.reduce((s, l) => s + (Math.abs(x - l.x) < l.w ? l.d * Math.cos(((x - l.x) / l.w) * (Math.PI / 2)) ** 2 : 0), 0);

/** The rock shelf in front of the beach: pale slabs with cracks and pits, wet round its pools, sand drifted into its hollows. */
function* paintShelf(p: Painter, rng: Rng): Strokes {
  const edge: Pt[] = [];
  for (let x = -30; x <= 676; x += 6) edge.push({ x, y: shelfTopAt(x) });
  // its right end meets the lower wall's foot and the flight's landing, leaving no bare strip
  const shelf = rough([...edge, { x: 675, y: 837 }, { x: 706, y: 835 }, { x: 712, y: 846 }, { x: 706, y: 860 }, { x: 698, y: 884 }, { x: 690, y: 930 }, { x: 678, y: 1030 }, { x: -30, y: 1030 }], rng, 1.6, 4);
  clipTo(p, shelf, POOL_HOLES);
  fillUnder(p, box(-40, 820, 730, 1040), LIME.under);
  yield;
  yield* p.parts.wetInWet(box(-40, 820, 730, 1040), mix(LIME.cream, LIME.body, 0.5), LIME.grey, { rng, angle: Math.PI / 2 - 0.3, split: 0.45, softness: 0.7, opacity: 0.5, deform: 0.03, spread: 0.03, edge: 0, granulation: 0.7, granules: 0.25, flow: 0.5, flowScale: 60 });
  yield;
  // slab edges: a dark crack with a lit lip above, the slabs' fronts a shade lower
  const cracks: Mark[] = [];
  const fronts: Mark[] = [];
  const lips: Mark[] = [];
  const noise = createSimplex2D(rng.fork('slabs'));
  for (let y = 858; y < 1010; y += rng.range(12, 26)) {
    const tilt = rng.range(-0.04, 0.04);
    const at = (x: number) => Math.max(shelfTopAt(x) + 6, y + tilt * (x - 300) + noise(x / 60, y) * 3);
    for (let x = rng.range(-30, 40); x < 690; ) {
      const len = rng.range(40, 200);
      const x1 = Math.min(690, x + len);
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
    const x = rng.range(-10, 680);
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
  // sand drifted into the shelf's hollows and cracks near the beach, thinning away from it
  const drifts: Mark[] = [];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-10, 676);
    const deep = SHELF_LOBES.find((l) => l.d > 0 && Math.abs(x - l.x) < l.w);
    const y = shelfTopAt(x) + (deep ? rng.range(0, 6) : rng.range(3, 20));
    if (POOLS.some((q) => ((x - q.cx) / (q.rx + 14)) ** 2 + ((y - q.cy) / (q.ry + 8)) ** 2 < 1)) continue;
    const rx = deep ? rng.range(14, 30) : rng.range(5, 16);
    drifts.push({ poly: rough(ellipse(x, y, rx, rx * rng.range(0.14, 0.24), 16), rng, 1.2, 3), alpha: rng.range(0.4, 0.65) });
  }
  // the shelf's top edge rising out of the sand: a lit arris, broken
  const arris: Mark[] = [];
  for (let x = -20; x < 670; ) {
    const len = rng.range(14, 60);
    if (rng.chance(0.6)) arris.push({ poly: band(x, Math.min(676, x + len), (q) => shelfTopAt(q) + 0.6, (q) => shelfTopAt(q) + 2.4, 6), alpha: 0.6 });
    x += len + rng.range(6, 30);
  }
  yield* wetBatch(p, fronts, LIME.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.6 });
  yield* wetBatch(p, cracks, LIME.deep, { edge: 0.25, sharpness: 0.8, granulation: 0.3 });
  yield* liftBatch(p, lips, LIME.lit, { edge: 0.05 });
  yield* wetBatch(p, pits, LIME.recess, { edge: 0.4, sharpness: 0.8 });
  yield* wetBatch(p, wet, mix(LIME.wet, LIME.algae, 0.3), { edge: 0.15, sharpness: 0.5, granulation: 0.6 });
  yield* wetBatch(p, drifts, mix(SAND.dry, SAND.warm, 0.45), { edge: 0.08, sharpness: 0.4, granulation: 0.7, granules: 0.3 });
  yield* liftBatch(p, arris, LIME.lit, { edge: 0.05 });
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
  // pebbles gathered on the sand at the shelf's foot, each with its shade to the lower right
  const pebbles: Mark[] = [];
  const shades: Mark[] = [];
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-10, 668);
    const y = shelfTopAt(x) - Math.abs(rng.next() - rng.next()) * 9 - 0.5;
    const r = rng.range(0.8, 2.6) * (rng.chance(0.15) ? 1.6 : 1);
    pebbles.push({ poly: ellipse(x, y, r, r * rng.range(0.55, 0.75), 8), alpha: rng.range(0.4, 0.75) });
    shades.push({ poly: ellipse(x + r * 0.35, y + r * 0.35, r * 0.85, r * 0.4, 8), alpha: 0.4 });
  }
  yield* wetBatch(p, pebbles, mix(SAND.pebble, SAND.pebbleWarm, 0.3), { edge: 0.3, sharpness: 0.7, granulation: 0.4 });
  yield* wetBatch(p, shades, SAND.pebbleDark, { edge: 0.2, sharpness: 0.7 });
}

/** One block of the ledge's face: a span of the run, its top and its wet foot over the water. */
interface FaceBlock {
  x0: number;
  x1: number;
  top: (x: number) => number;
  bot: (x: number) => number;
  poly: Pt[];
}

/**
 * The shoreline as one broken limestone ledge: a pale top on the land behind the edge; under the
 * runs that face the viewer, a face in blocks of uneven height stepping into the water; along the
 * runs that face away, a wet lip; foam, a contact shade and a broken reflection at the water.
 */
function* paintShoreline(p: Painter, rng: Rng): Strokes {
  const noise = createSimplex2D(rng.fork('ledge'));
  const edge = resample(LEDGE_EDGE, 3);
  const n = edge.length;
  const inner = edge.map((q, i) => {
    const taper = Math.min(1, i / 6, (n - 1 - i) / 5);
    return { x: q.x + (7 + 15 * (0.5 + 0.5 * noise(i / 7, 1))) * taper + 1, y: q.y + noise(i / 4, 2) * 2 * taper };
  });
  const top: Pt[] = rough([...edge, ...inner.slice().reverse()], rng, 1.4, 3);
  // the faces in blocks: each its own height and a small step at its top
  const blocks: FaceBlock[] = [];
  for (const run of LEDGE_RUNS.face) {
    const at = (x: number) => lineAt(run, x);
    const b = bounds(run);
    let d = 0;
    for (let x = b.x - 3; x < b.x + b.w + 1; ) {
      const x0 = x;
      const x1 = Math.min(b.x + b.w + 4, x + rng.range(12, 30));
      d = Math.max(-2.2, Math.min(2.2, d + rng.range(-1.8, 1.8)));
      const h0 = rng.range(11, 22);
      const h1 = h0 + rng.range(-4, 4);
      const ph = rng.range(0, 6);
      const step = d;
      const blockTop = (q: number) => at(q) - 1.4 + step * 0.6;
      const bot = (q: number) => at(q) + h0 + ((q - x0) / Math.max(1, x1 - x0)) * (h1 - h0) + Math.sin(q / 4.5 + ph) * 1.2;
      blocks.push({ x0, x1, top: blockTop, bot, poly: rough(band(x0, x1, blockTop, bot, 3), rng, 0.9, 3) });
      x = x1 - 0.5;
    }
  }
  // the water at the ledge's foot: a contact shade and a broken reflection, before the rock
  const refl: Mark[] = [];
  for (const k of blocks) {
    const h = k.bot((k.x0 + k.x1) / 2) - k.top((k.x0 + k.x1) / 2);
    for (let i = 0; i < 3; i++) {
      const s = Math.max(1.6, h * 0.17);
      const off = i * s * 1.1;
      const sh = (i % 2 ? 1.5 : -1) * i;
      refl.push({ poly: band(k.x0 + 1 + sh + i * 2, k.x1 - 1 + sh - i, (q) => k.bot(q) + 0.3 + off, (q) => k.bot(q) + 0.3 + off + s * 0.65, 3), alpha: [0.5, 0.3, 0.16][i]! });
    }
  }
  const contact: Mark[] = [];
  for (const run of LEDGE_RUNS.lip) {
    const pts = resample(run, 3);
    contact.push({ poly: [...pts.map((q) => ({ x: q.x - 0.5, y: q.y })), ...pts.slice().reverse().map((q) => ({ x: q.x - 7, y: q.y - 2.2 }))], alpha: 0.3 });
  }
  yield* wetBatch(p, [...refl, ...contact], SEAM.reflection, { edge: 0.08, sharpness: 0.4, granulation: 0.3 });
  // the ledge's top: pale limestone over the gravel, a soft inner edge, cracks, a lit arris at the water
  fillUnder(p, top, mix(LIME.under, LIME.cream, 0.3));
  for (const k of blocks) fillUnder(p, k.poly, LIME.under);
  yield* wetBatch(p, [{ poly: top, alpha: 0.75 }], mix(LIME.body, LIME.grey, 0.45), { edge: 0.1, sharpness: 0.4, granulation: 0.7, granules: 0.25, flow: 0.5, flowScale: 30 });
  const g = (k: FaceBlock) => ({ clip: k.poly, marks: [] as Mark[] });
  const body = blocks.map(g);
  const shade = blocks.map(g);
  const lit = blocks.map(g);
  const dark = blocks.map(g);
  const wet = blocks.map(g);
  const weed = blocks.map(g);
  blocks.forEach((k, i) => {
    const w = k.x1 - k.x0;
    body[i]!.marks.push({ poly: k.poly, alpha: 0.5 });
    shade[i]!.marks.push(
      { poly: band(k.x0 - 2, k.x1 + 2, (q) => k.top(q) + 1, (q) => k.bot(q) + 2, 3), alpha: 0.18 },
      { poly: band(k.x0 - 2, k.x1 + 2, (q) => k.top(q) + (k.bot(q) - k.top(q)) * rng.range(0.25, 0.45), (q) => k.bot(q) + 2, 3), alpha: 0.26 },
      { poly: rough(band(k.x1 - w * rng.range(0.2, 0.45), k.x1 + 2, (q) => k.top(q) - 1, (q) => k.bot(q) + 2, 3), rng, 0.8, 3), alpha: 0.3 },
    );
    lit[i]!.marks.push({ poly: band(k.x0, k.x1, (q) => k.top(q) - 2, (q) => k.top(q) + 1.8, 3), alpha: 0.75 });
    if (rng.chance(0.6)) lit[i]!.marks.push({ poly: band(k.x0, k.x0 + rng.range(2, 4), (q) => k.top(q) + 2, (q) => k.bot(q) - 6, 2), alpha: 0.35 });
    dark[i]!.marks.push({ poly: streak({ x: k.x0 + 0.8, y: k.top(k.x0) }, { x: k.x0 + rng.range(-1, 1.5), y: k.bot(k.x0) - rng.range(1, 6) }, rng.range(1.2, 2), rng), alpha: 0.55 });
    if (rng.chance(0.45)) {
      const m = rng.range(0.3, 0.6);
      dark[i]!.marks.push({ poly: rough(band(k.x0 + 2, k.x1 - 2, (q) => k.top(q) + (k.bot(q) - k.top(q)) * m, (q) => k.top(q) + (k.bot(q) - k.top(q)) * m + 0.9, 4), rng, 0.5, 3), alpha: 0.4 });
    }
    for (let j = 0; j < 1 + Math.round(w / 12); j++) {
      const x = rng.range(k.x0 + 2, k.x1 - 2);
      dark[i]!.marks.push({ poly: ellipse(x, rng.range(k.top(x) + 3, k.bot(x) - 4), rng.range(0.5, 1.3), rng.range(0.4, 0.9), 7), alpha: rng.range(0.35, 0.6) });
    }
    const ph = rng.range(0, 6);
    const wetH = rng.range(4.5, 7);
    wet[i]!.marks.push({ poly: band(k.x0 - 1, k.x1 + 1, (q) => k.bot(q) - wetH + Math.sin(q / 3.7 + ph) * 1, (q) => k.bot(q) + 2, 3), alpha: 0.6 });
    weed[i]!.marks.push({ poly: band(k.x0 - 1, k.x1 + 1, (q) => k.bot(q) - 2.4 + Math.sin(q / 2.9 + ph) * 0.7, (q) => k.bot(q) + 2, 3), alpha: 0.5 });
    for (let j = 0; j < 1 + Math.round(w / 10); j++) {
      const x = rng.range(k.x0, k.x1);
      weed[i]!.marks.push({ poly: streak({ x, y: k.bot(x) + 0.5 }, { x: x + rng.range(-1, 1), y: k.bot(x) - rng.range(3, 6.5) }, rng.range(1.6, 3), rng), alpha: 0.45 });
    }
  });
  // the lips: a wet band at the water under the top's lit arris, weed at the waterline
  const lips: Mark[] = [];
  const lipWeed: Mark[] = [];
  const lipLit: Mark[] = [];
  const crack: Mark[] = [];
  for (const run of LEDGE_RUNS.lip) {
    const pts = resample(run, 3);
    const off = (dx: number, dy: number) => pts.map((q, i) => ({ x: q.x + dx * (1 + 0.3 * noise(i / 3, 5)), y: q.y + dy }));
    lips.push({ poly: [...off(-0.5, 0), ...off(2.6, 3.4).reverse()], alpha: 0.55 });
    lipWeed.push({ poly: [...off(-0.5, 0), ...off(1, 1.4).reverse()], alpha: 0.45 });
    lipLit.push({ poly: [...off(3, 3.8), ...off(4.6, 5.4).reverse()], alpha: 0.55 });
  }
  // cracks across the top, from the edge inland
  for (let i = 4; i < n - 3; i += 2 + Math.floor(rng.range(0, 5))) {
    const q = edge[i]!;
    const r = inner[i]!;
    const t = rng.range(0.4, 0.95);
    crack.push({ poly: streak({ x: q.x + 1, y: q.y + 0.5 }, { x: q.x + (r.x - q.x) * t, y: q.y + (r.y - q.y) * t + rng.range(-3, 3) }, rng.range(0.9, 1.5), rng), alpha: rng.range(0.3, 0.5) });
  }
  yield* clipBatch(p, body, mix(LIME.cream, LIME.body, 0.4), { edge: 0.12, sharpness: 0.5, granulation: 0.7, granules: 0.2 });
  yield* clipBatch(p, shade, LIME.shade, { edge: 0.15, sharpness: 0.5, granulation: 0.6 });
  yield* clipBatch(p, lit, LIME.lit, { edge: 0.05, sharpness: 0.6 }, true);
  yield* wetBatch(p, lips, SEAM.wet, { edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  yield* clipBatch(p, wet, SEAM.wet, { edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  yield* clipBatch(p, weed, SEAM.weed, { edge: 0.15, sharpness: 0.5, granulation: 0.5 });
  yield* wetBatch(p, lipWeed, SEAM.weed, { edge: 0.15, sharpness: 0.5, granulation: 0.5 });
  yield* liftBatch(p, lipLit, LIME.lit, { edge: 0.05 });
  yield* wetBatch(p, crack, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  yield* clipBatch(p, dark, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  // foam at the foot of the faces and along the lips
  const foam: Mark[] = [];
  for (const k of blocks) foam.push(...foamLine(k.x0 - 1, k.x1 + 1, (q) => k.bot(q), rng));
  for (const run of LEDGE_RUNS.lip) {
    const pts = resample(run, 3);
    for (let i = 1; i < pts.length; ) {
      const j = Math.min(pts.length - 1, i + rng.int(2, 5));
      if (rng.chance(0.75)) {
        const seg = pts.slice(i - 1, j + 1);
        const th = rng.range(1, 1.9);
        foam.push({ poly: [...seg.map((q) => ({ x: q.x - 1.2, y: q.y - 0.2 })), ...seg.slice().reverse().map((q) => ({ x: q.x - 1.2 - th * 1.4, y: q.y - 0.2 - th * 0.5 }))], alpha: 0.8 });
      }
      i = j + 1;
    }
  }
  yield* liftBatch(p, foam, SEAM.foam, { edge: 0.05, sharpness: 0.6 });
}

/** Broken foam hugging a foot line over x0..x1, and a fainter lap mark just in front of it. */
function foamLine(x0: number, x1: number, foot: (x: number) => number, rng: Rng, ring = 0): Mark[] {
  const out: Mark[] = [];
  const y = (q: number) => (q < x0 + ring ? foot(x0 + ring) - (x0 + ring - q) * 0.45 : q > x1 - ring ? foot(x1 - ring) - (q - x1 + ring) * 0.45 : foot(q));
  for (let x = x0; x < x1; ) {
    const xb = Math.min(x1, x + rng.range(6, 18));
    const th = rng.range(0.7, 1.5);
    if (rng.chance(0.82)) out.push({ poly: band(x, xb, (q) => y(q) + 0.3, (q) => y(q) + 0.3 + th * Math.sin(((q - x) / Math.max(1, xb - x)) * Math.PI) + 0.2, 2), alpha: 0.85 });
    x = xb + rng.range(0.6, 2.5);
  }
  for (let x = x0 + 4; x < x1 - 4; ) {
    const xb = Math.min(x1 - 4, x + rng.range(5, 16));
    if (rng.chance(0.4)) out.push({ poly: band(x, xb, (q) => y(q) + 3.4, (q) => y(q) + 3.4 + 0.8 * Math.sin(((q - x) / Math.max(1, xb - x)) * Math.PI), 2), alpha: 0.3 });
    x = xb + rng.range(3, 10);
  }
  return out;
}

/** A boulder's profile at x, held at its ends. */
function columnAt(r: RockShape, x: number): RockColumn {
  const c = r.columns;
  const step = (c[c.length - 1]!.x - c[0]!.x) / (c.length - 1);
  const f = Math.max(0, Math.min(c.length - 1.0001, (x - c[0]!.x) / step));
  const i = Math.floor(f);
  const t = f - i;
  const a = c[i]!;
  const b = c[i + 1] ?? a;
  return { x, top: a.top + (b.top - a.top) * t, front: a.front + (b.front - a.front) * t, base: a.base + (b.base - a.base) * t };
}

/**
 * Sea-worn limestone boulders, all wet in shared layers (each clipped to its own outline): a pale
 * dry crown, the right flank and the face turned from the sun, pits and cracks; in the water a
 * dark wet foot with weed, a broken reflection and a foam ring; on land a shadow cast right.
 */
export function* paintBoulders(p: Painter, rocks: readonly RockShape[], rng: Rng): Strokes {
  const refl: Mark[] = [];
  const glint: Mark[] = [];
  const cast: Mark[] = [];
  const foam: Mark[] = [];
  const outs: Pt[][] = [];
  type Group = { clip: Pt[]; marks: Mark[] };
  const groups = { body: [] as Group[], shade: [] as Group[], lit: [] as Group[], dark: [] as Group[], wet: [] as Group[], weed: [] as Group[] };
  for (const [i, r] of rocks.entries()) {
    const rr = rng.fork(`rock-${i}`);
    const c = r.columns;
    const x0 = c[0]!.x;
    const x1 = c[c.length - 1]!.x;
    const hw = (x1 - x0) / 2;
    const cx = x0 + hw;
    const top = (x: number) => columnAt(r, x).top;
    const front = (x: number) => columnAt(r, x).front;
    const base = (x: number) => columnAt(r, x).base;
    const H = Math.max(...c.map((q) => q.base)) - Math.min(...c.map((q) => q.top));
    const out = rough(r.outline, rr, 0.5, 3);
    outs.push(out);
    const add = (k: keyof typeof groups, marks: Mark[]) => groups[k].push({ clip: out, marks });
    const ph = rr.range(0, 6);
    add('body', [{ poly: out, alpha: 0.5 }]);
    const xs = cx + hw * rr.range(0.05, 0.35);
    add('shade', [
      { poly: band(x0 - 2, x1 + 2, (x) => front(x) + 0.6, (x) => base(x) + 2, 3), alpha: 0.24 },
      { poly: band(xs, x1 + 2, (x) => front(x) - (front(x) - top(x)) * Math.min(1, ((x - xs) / (x1 - xs)) * 1.5) + 0.8, (x) => base(x) + 2, 3), alpha: 0.3 },
      { poly: band(cx - hw * 0.25, x1, (x) => front(x) + 0.5, (x) => front(x) + 1.6 + (base(x) - front(x)) * 0.25, 3), alpha: 0.22 },
    ]);
    add('lit', [
      { poly: rough(r.top, rr, 0.5, 3), alpha: 0.8 },
      { poly: band(x0, x0 + hw * 0.45, (x) => top(x) + 0.5, (x) => front(x) + (base(x) - front(x)) * 0.4, 3), alpha: 0.35 },
    ]);
    const dark: Mark[] = [];
    for (let k = 0; r.w > 20 && k < 2 + Math.round(r.w / 10); k++) {
      const x = rr.range(x0 + 2, x1 - 2);
      if (base(x) - front(x) < 4) continue;
      dark.push({ poly: ellipse(x, rr.range(front(x) + 1, base(x) - 2.5), rr.range(0.5, 1.4), rr.range(0.4, 1), 7), alpha: rr.range(0.35, 0.6) });
    }
    for (let k = 0; r.w > 20 && k < 1 + Math.round(r.w / 30); k++) {
      const x = rr.range(cx - hw * 0.6, cx + hw * 0.6);
      dark.push({ poly: ellipse(x, (top(x) + front(x)) / 2 + rr.range(-1, 1), rr.range(0.4, 0.9), rr.range(0.3, 0.6), 6), alpha: 0.25 });
    }
    if (r.w > 26) {
      const x = rr.range(x0 + hw * 0.4, x1 - hw * 0.3);
      dark.push({ poly: streak({ x, y: front(x) + 0.3 }, { x: x + rr.range(-7, 7), y: front(x) + (base(x) - front(x)) * rr.range(0.5, 0.8) }, rr.range(0.8, 1.3), rr), alpha: 0.4 });
    }
    if (r.w > 36) {
      const x = rr.range(cx - hw * 0.4, cx + hw * 0.3);
      dark.push({ poly: streak({ x, y: top(x) + 1 }, { x: x + rr.range(-5, 5), y: front(x) - 0.5 }, 0.9, rr), alpha: 0.3 });
    }
    if (r.ground) {
      dark.push({ poly: band(x0, x1, (x) => base(x) - 1.6, (x) => base(x) + 1, 3), alpha: 0.4 });
      cast.push({ poly: rough([{ x: cx - hw * 0.3, y: base(cx) - 1 }, { x: x1 + r.w * 0.5, y: base(x1) + 0.3 }, { x: x1 + r.w * 0.3, y: base(x1) + 2.6 }, { x: cx - hw * 0.4, y: base(cx) + 2.2 }], rr, 0.6, 2), alpha: 0.38 });
    } else {
      const wetTop = (x: number) => base(x) - Math.max(2.4, (base(x) - front(x)) * 0.45) + Math.sin(x / 4.3 + ph) * 0.9 + Math.sin(x / 11 + ph * 2) * 1.6;
      add('wet', [
        { poly: band(x0 - 2, x1 + 2, (x) => wetTop(x) - 1.5, (x) => base(x) + 2, 3), alpha: 0.3 },
        { poly: band(x0 - 2, x1 + 2, wetTop, (x) => base(x) + 2, 3), alpha: 0.42 },
      ]);
      const weed: Mark[] = [{ poly: band(x0 - 2, x1 + 2, (x) => base(x) - 1.8 + Math.sin(x / 3.1 + ph) * 0.6, (x) => base(x) + 2, 3), alpha: 0.55 }];
      for (let k = 0; k < 2 + Math.round(r.w / 14); k++) {
        const x = rr.range(x0, x1);
        weed.push({ poly: streak({ x, y: base(x) + 0.5 }, { x: x + rr.range(-1, 1), y: base(x) - rr.range(2.5, 5.5) }, rr.range(1.6, 3), rr), alpha: 0.45 });
      }
      add('weed', weed);
      // the reflection: the wet foot dark just under it, the crown pale further down, in broken slices
      const s = Math.max(1.4, H * 0.16);
      refl.push({ poly: rough(band(x0 + 1, x1 - 1, (x) => base(x) + 0.2, (x) => base(x) + s * 1.6 - Math.abs(x - cx) / hw, 3), rr, 0.8, 3), alpha: 0.42 });
      for (let k = 1; k < 4; k++) {
        const off = s * (1.3 + k * 0.9);
        const sh = (k % 2 ? 1.6 : -1.2) * k * 0.5;
        const inset = hw * (0.1 + 0.12 * k) + rr.range(0, hw * 0.1);
        const poly = rough(band(x0 + inset + sh, x1 - inset * 0.8 + sh, (x) => base(x) + off, (x) => base(x) + off + s * 0.45, 3), rr, 0.5, 3);
        if (k < 3) refl.push({ poly, alpha: k === 1 ? 0.24 : 0.14 });
        else glint.push({ poly, alpha: 0.2 });
      }
      foam.push(...foamLine(x0 - 5, x1 + 5, base, rr, 5));
    }
    add('dark', dark);
  }
  yield* wetBatch(p, cast, SEAM.cast, { edge: 0.1, sharpness: 0.4, granulation: 0.4 });
  yield* wetBatch(p, refl, SEAM.reflection, { edge: 0.08, sharpness: 0.4, granulation: 0.3 });
  yield* liftBatch(p, glint, SEAM.glint, { edge: 0.05 });
  for (const o of outs) fillUnder(p, o, LIME.under);
  yield;
  yield* clipBatch(p, groups.body, mix(LIME.cream, LIME.body, 0.45), { edge: 0.12, sharpness: 0.5, granulation: 0.7, granules: 0.2, flow: 0.4, flowScale: 20 });
  yield* clipBatch(p, groups.shade, LIME.shade, { edge: 0.15, sharpness: 0.45, granulation: 0.6, granules: 0.1 });
  yield* clipBatch(p, groups.lit, LIME.lit, { edge: 0.05, sharpness: 0.4, granulation: 0.3 }, true);
  yield* clipBatch(p, groups.wet, SEAM.wet, { edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  yield* clipBatch(p, groups.weed, SEAM.weed, { edge: 0.15, sharpness: 0.5, granulation: 0.5 });
  yield* clipBatch(p, groups.dark, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  yield* liftBatch(p, foam, SEAM.foam, { edge: 0.05, sharpness: 0.6 });
}
