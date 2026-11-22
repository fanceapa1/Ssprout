/**
 * The coast's rock (G2): the limestone promontory under the temple, and the shore's rock (the
 * shelf and its pools' rims, the shoreline's lips and faces, its boulders, the splash rocks and
 * the stones at the beach's ends). Lit from the left, over the sea. docs/systems/scenery.md › Coast › Rock.
 */
import type { Rng } from '../../core/rng';
import { blob, createSimplex2D, mix, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { POOLS, SHELF, SHORE_EDGE, WALLS } from './layout';
import { inView, paintFlight } from './paint-land';
import { SAND, SEA } from './paint-water';
import { FOOT_BOULDER_SHAPES, FOOT_SHELF, FOOT_STONES, SHORE_RUNS } from './lip-shapes';
import { LIME, band, box, clipBatch, clipTo, ellipse, fillUnder, lineAt, liftBatch, rough, streak, wetBatch, type Mark } from './rock-kit';
import {
  BEACH_FLIGHT, bedAt, CLIFF_STONES, type Fissure, GOAT_TRACKS, LEDGE_SCRUB, fissureAt, fissureFoot, footAt, FORM_NOISE, PROMONTORY_FOOT_LINE, PROMONTORY_FORM, PROMONTORY_TOP_LINE, SHORE_BOULDER_SHAPES,
  SPLASH_ROCK_SHAPES, topAt, type RockColumn, type RockShape,
} from './shapes';

export { footAt, PROMONTORY_FORM, topAt };

/** Where the foot leaves the sea for the top terrace (the shoreline's first point). */
const LAND_FOOT = SHORE_EDGE[0]!.x;

/** The painted outline: the layout's, run on past the right edge and under the top terrace (which overlaps it). */
const OUTLINE: readonly Pt[] = [
  ...PROMONTORY_TOP_LINE,
  { x: 1680, y: 518 },
  ...PROMONTORY_FOOT_LINE.filter((q) => q.x > LAND_FOOT + 4 && q.x < 1680).reverse().map((q) => ({ x: q.x, y: q.y + 16 })),
  { x: LAND_FOOT + 6, y: footAt(LAND_FOOT) + 12 },
  ...PROMONTORY_FOOT_LINE.filter((q) => q.x <= LAND_FOOT).reverse(),
];

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
  yield* paintTint(p, rng.fork('tint'));
  yield* paintPlanes(p, rng.fork('planes'));
  yield* paintBeds(p, rng.fork('beds'));
  yield* paintFissures(p, rng.fork('fissures'));
  yield* paintStains(p, rng.fork('stains'));
  yield* paintLedgeScrub(p, rng.fork('scrub'));
  yield* paintFoot(p, rng.fork('foot'));
  yield* paintTide(p, rng.fork('tide'));
  p.ctx.restore();
}

/** The limestone's own variety: broad soft patches of warmer cream and of cooler grey across the face. */
function* paintTint(p: Painter, rng: Rng): Strokes {
  const warm: Mark[] = [];
  const cool: Mark[] = [];
  for (let i = 0; i < 16; i++) {
    const x = rng.range(640, 1640);
    const y = rng.range(topAt(x) + 8, footAt(x) - 10);
    const poly = blob(x, y, rng.range(30, 90), rng.range(12, 34), rng, { irregularity: 0.5, rotation: rng.range(-0.3, 0.3) });
    (rng.chance(0.5) ? warm : cool).push({ poly, alpha: rng.range(0.1, 0.18) });
  }
  yield* wetBatch(p, warm, mix(LIME.cream, LIME.ochre, 0.35), { edge: 0.02, sharpness: 0.2, granulation: 0.5 });
  yield* wetBatch(p, cool, mix(LIME.grey, LIME.shade, 0.4), { edge: 0.02, sharpness: 0.2, granulation: 0.6 });
}

/**
 * Scrub caught on the ledges (`LEDGE_SCRUB`, GA1): small tufted cushions on the lip, many small
 * soft lobes in a dome, a lit top toward the sun, a shaded foot, its shadow on the rock to the
 * lower right, a few twig flecks, now and then a sprig hanging over.
 */
function* paintLedgeScrub(p: Painter, rng: Rng): Strokes {
  const body: Mark[] = [];
  const lit: Mark[] = [];
  const foot: Mark[] = [];
  const cast: Mark[] = [];
  const twigs: Mark[] = [];
  for (const s of LEDGE_SCRUB) {
    const r = s.r;
    for (let k = rng.int(5, 8); k > 0; k--) {
      const u = rng.range(-1, 1);
      const dome = Math.sqrt(Math.max(0, 1 - u * u));
      const lr = r * rng.range(0.28, 0.42);
      const x = s.x + u * (r - lr * 0.6);
      const y = s.y - lr * 0.55 - rng.next() * dome * r * 0.55;
      body.push({ poly: blob(x, y, lr, lr * 0.85, rng, { irregularity: 0.45, points: 10 }), alpha: rng.range(0.4, 0.6) });
      if (u < 0.3 && y < s.y - r * 0.35 && rng.chance(0.7)) lit.push({ poly: blob(x - lr * 0.25, y - lr * 0.3, lr * 0.55, lr * 0.4, rng, { irregularity: 0.4, points: 8 }), alpha: rng.range(0.35, 0.55) });
    }
    foot.push({ poly: blob(s.x + r * 0.15, s.y - r * 0.16, r * 0.95, r * 0.24, rng, { irregularity: 0.35, points: 12 }), alpha: 0.5 });
    cast.push({ poly: blob(s.x + r * 0.95, s.y + 1.1, r * 0.85, Math.max(0.9, r * 0.16), rng, { irregularity: 0.3, points: 10 }), alpha: 0.32 });
    for (let k = rng.int(3, 6); k > 0; k--) {
      const x = s.x + rng.range(-0.7, 0.7) * r;
      twigs.push({ poly: streak({ x, y: s.y - rng.range(0.1, 0.35) * r }, { x: x + rng.range(-1.2, 1.2), y: s.y - rng.range(0.4, 0.7) * r }, 0.6, rng), alpha: 0.45 });
    }
    if (rng.chance(0.5)) twigs.push({ poly: streak({ x: s.x + rng.range(-2, 2), y: s.y - 0.5 }, { x: s.x + rng.range(-3, 3), y: s.y + rng.range(4, 9) }, 1.4, rng), alpha: 0.4 });
  }
  yield* wetBatch(p, cast, mix(LIME.shade, LIME.recess, 0.4), { edge: 0.05, sharpness: 0.25, granulation: 0.4 });
  yield* wetBatch(p, body, mix(VEG_SCRUB, LIME.grey, 0.25), { edge: 0.08, sharpness: 0.3, granulation: 0.7, granules: 0.3 });
  yield* wetBatch(p, foot, mix(VEG_SCRUB, LIME.recess, 0.6), { edge: 0.04, sharpness: 0.25, granulation: 0.5 });
  yield* liftBatch(p, lit, mix(VEG_SCRUB, '#e4e2b0', 0.55), { edge: 0.04, sharpness: 0.3 });
  yield* wetBatch(p, twigs, mix(VEG_SCRUB, LIME.deep, 0.6), { edge: 0.2, sharpness: 0.7 });
}

/**
 * The tide's marks along the seaward foot: a broken band of black lichen above the wet rock, and
 * above that, where the spray reaches, specks and small crusts of orange lichen.
 */
function* paintTide(p: Painter, rng: Rng): Strokes {
  const x1 = LAND_FOOT + 4;
  const black: Mark[] = [];
  const orange: Mark[] = [];
  const top = (x: number) => footAt(x) - 6 - notchAt(x) * 0.3 - 2.5 * (0.5 + 0.5 * FORM_NOISE(x / 26, 12));
  for (let x = 634; x < x1; ) {
    const e = Math.min(x1, x + rng.range(10, 46));
    if (rng.chance(0.75)) black.push({ poly: rough(band(x, e, (q) => top(q) - rng.range(1.5, 3.5), (q) => top(q) + 2.4, 3), rng, 0.5, 2), alpha: rng.range(0.2, 0.32) });
    x = e + rng.range(2, 14);
  }
  // in loose clusters a little above the black band, never a scatter over the face
  for (let c = 0; c < 9; c++) {
    const cx = rng.range(650, x1 - 10);
    for (let i = rng.int(3, 6); i > 0; i--) {
      const x = cx + rng.range(-6, 6);
      const y = top(x) - rng.range(1.5, 6);
      if (y < topAt(x) + 4) continue;
      orange.push({ poly: blob(x, y, rng.range(0.5, 1.3), rng.range(0.35, 0.8), rng, { irregularity: 0.4, points: 8 }), alpha: rng.range(0.2, 0.34) });
    }
  }
  // a few crusts on the point's upper face, where the gulls rest
  for (let i = 0; i < 8; i++) {
    const x = rng.range(644, 740);
    const y = rng.range(topAt(x) + 3, topAt(x) + 14);
    orange.push({ poly: blob(x, y, rng.range(0.8, 2), rng.range(0.5, 1.2), rng, { irregularity: 0.5, points: 9 }), alpha: rng.range(0.18, 0.3) });
  }
  yield* wetBatch(p, black, mix(LIME.deep, LIME.wet, 0.4), { edge: 0.15, sharpness: 0.5, granulation: 0.7, granules: 0.25 });
  yield* wetBatch(p, orange, LICHEN, { edge: 0.2, sharpness: 0.6, granulation: 0.4 });
}

/** The ledges' scrub and the spray zone's orange lichen. */
const VEG_SCRUB: Pigment = '#7b8758';
const LICHEN: Pigment = '#c98a4c';

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
  // the goats' ledges: the lip unbroken (gaps a hoof can step), a broader shelf and its undercut
  const g = rng.fork('goat-ledges');
  for (const t of GOAT_TRACKS) {
    if (t.bed === null) continue;
    const bed = PROMONTORY_FORM.beds[t.bed]!;
    const at = (x: number) => bedAt(bed, x);
    for (let x = t.x0 - 4; x < t.x1 + 4; ) {
      const e = Math.min(t.x1 + 4, x + g.range(8, 26));
      lips.push({ poly: rough(band(x, e, (q) => at(q) - g.range(1.6, 3.4), (q) => at(q) - 0.3, 4), g, 0.5, 3), alpha: g.range(0.5, 0.8) });
      const th = g.range(0.8, 2.6);
      under.push({ poly: rough(band(x, e, at, (q) => at(q) + th * (0.5 + Math.abs(FORM_NOISE(q / 11, bed.y + 4))), 4), g, 0.5, 3), alpha: g.range(0.14, 0.26) });
      x = e + g.range(0.6, 4);
    }
    under.push({ poly: rough(band(t.x0 + 2, t.x1 - 2, (x) => at(x) + 1, (x) => at(x) + 4 + 3 * FORM_NOISE(x / 20, bed.y + 6), 6), g, 1.1, 4), alpha: 0.1 });
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
  const wetTop = (x: number) => footAt(x) - 3.2 - 4.5 * Math.max(0, FORM_NOISE(x / 18, 5) + 0.35 * FORM_NOISE(x / 6, 9)) - depth(x) * 0.25;
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

export { SHORE_RUNS };

/** The colours where rock meets the sea: its broken reflection, the wet foot, weed, foam. */
const SEAM = {
  reflection: mix(SEA.deepTeal, LIME.wet, 0.5),
  glint: mix(SEA.aquaPale, LIME.lit, 0.5),
  wet: mix(LIME.wet, LIME.algae, 0.3),
  weed: mix(LIME.algae, '#3f4a2e', 0.35),
  foam: '#fdfcf5',
  cast: mix(LIME.shade, LIME.recess, 0.3),
} satisfies Record<string, Pigment>;

/** The shore's rock, after the land and the platform: the shelf and pool rims, the cliff's foot shelf, the beach flight, boulders, beach-end stones. */
export function* paintShoreRocks(p: Painter, rng: Rng): Strokes {
  yield* paintShelf(p, rng.fork('shelf'));
  yield* paintFootShelf(p, rng.fork('foot-shelf'));
  yield* paintFlight(p, BEACH_FLIGHT, rng.fork('flight'));
  const stones = rng.fork('stones');
  for (const s of BEACH_STONES) {
    p.stone({ x: s.x, y: s.y, w: s.w, h: s.w * 0.5 }, { rng: stones, pigment: mix(LIME.body, LIME.grey, 0.3), warm: 0.35, light: -2.7, moss: 0, ink: 0.18, granulation: 0.5, patches: 1 });
    yield;
  }
  yield* paintFootGround(p, rng.fork('foot-ground'));
  yield* paintBoulders(p, [...SHORE_BOULDER_SHAPES, ...SPLASH_ROCK_SHAPES, ...FOOT_BOULDER_SHAPES, ...FOOT_STONES], rng.fork('boulders'));
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
  // GA1: joints across the beds, so the shelf breaks into slabs, and each slab its own grey
  const joints: Mark[] = [];
  const slabTone: Mark[] = [];
  const inPool = (x: number, y: number, pad: number) => POOLS.some((q) => ((x - q.cx) / (q.rx + pad)) ** 2 + ((y - q.cy) / (q.ry + pad * 0.6)) ** 2 < 1);
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
        for (let jx = x + rng.range(12, 40); jx < x1 - 8; jx += rng.range(22, 60)) {
          if (inPool(jx, at(jx) + 6, 6)) continue;
          joints.push({ poly: streak({ x: jx, y: at(jx) + 1 }, { x: jx + rng.range(-4, 4), y: at(jx) + rng.range(8, 17) }, rng.range(0.8, 1.3), rng), alpha: rng.range(0.35, 0.55) });
        }
        if (rng.chance(0.7)) slabTone.push({ poly: rough(band(x + 2, x1 - 2, (q) => at(q) + 1.5, (q) => at(q) + rng.range(7, 16), 8), rng, 1, 4), alpha: rng.range(0.3, 0.5) });
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
  yield* wetBatch(p, slabTone, mix(LIME.grey, LIME.shade, 0.4), { edge: 0.08, sharpness: 0.4, granulation: 0.8, granules: 0.3 });
  yield* wetBatch(p, fronts, LIME.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.6 });
  yield* wetBatch(p, joints, LIME.deep, { edge: 0.25, sharpness: 0.8, granulation: 0.3 });
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

/** Limestone ledges breaking through the foreground's soil below the lowest wall, and sand drifted against the wall's foot (GA1). */
const FOOT_LEDGES: readonly [number, number, number, number][] = [
  [700, 790, 948, 5], [1120, 1230, 962, 6], [1300, 1420, 950, 5], [1480, 1590, 968, 6], [800, 868, 986, 4], [960, 1030, 930, 4],
];
function* paintFootGround(p: Painter, rng: Rng): Strokes {
  if (!inView(p, { x: 640, y: 860, w: 980, h: 150 })) return;
  const tops: Mark[] = [];
  const fronts: Mark[] = [];
  const lips: Mark[] = [];
  const drift: Mark[] = [];
  for (const [x0, x1, y, h] of FOOT_LEDGES) {
    const wob = rng.range(0, 6);
    const top = (x: number) => y - 3 + Math.sin(x / 13 + wob) * 1.2;
    const lip = (x: number) => y + Math.sin(x / 9 + wob) * 0.8;
    tops.push({ poly: rough(band(x0, x1, top, lip, 6), rng, 1.2, 4), alpha: 0.55 });
    fronts.push({ poly: rough(band(x0 + 3, x1 - 2, lip, (x) => lip(x) + h, 6), rng, 1, 4), alpha: 0.4 });
    lips.push({ poly: band(x0 + 4, x1 - 5, (x) => lip(x) - 1.4, (x) => lip(x) - 0.2, 6), alpha: 0.6 });
  }
  for (let i = 0; i < 9; i++) {
    const x = rng.range(700, 1590);
    if (Math.abs(x - 915) < 40 || Math.abs(x - 1074) < 40) continue;
    const y = lineAt(WALLS[2]!.edge, x) + WALLS[2]!.h + rng.range(4, 12);
    drift.push({ poly: rough(ellipse(x, y, rng.range(18, 46), rng.range(3, 6), 16), rng, 1.2, 4), alpha: rng.range(0.3, 0.5) });
  }
  for (const s of tops) fillUnder(p, s.poly, LIME.under);
  yield;
  yield* wetBatch(p, drift, mix(SAND.dry, SAND.warm, 0.4), { edge: 0.08, sharpness: 0.4, granulation: 0.7, granules: 0.3 });
  yield* wetBatch(p, tops, mix(LIME.body, LIME.grey, 0.35), { edge: 0.12, sharpness: 0.5, granulation: 0.8, granules: 0.25 });
  yield* wetBatch(p, fronts, LIME.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.6 });
  yield* liftBatch(p, lips, LIME.lit, { edge: 0.05 });
}

/**
 * The wave-cut shelf along the cliff's foot (GA1, `FOOT_SHELF`): low slabs awash in front of the
 * face, each a lit top over a wet front with weed, joints between them, a broken reflection and
 * foam at the water; where the shelf is missing the face drops straight into the sea.
 */
function* paintFootShelf(p: Painter, rng: Rng): Strokes {
  const { foot, depth, rise, blocks } = FOOT_SHELF;
  const front = (i: number) => foot[i]!.y + depth[i]!;
  const slabs: { clip: Pt[]; marks: Mark[] }[] = [];
  const lit: Mark[] = [];
  const wet: Mark[] = [];
  const weed: Mark[] = [];
  const joints: Mark[] = [];
  const refl: Mark[] = [];
  const foam: Mark[] = [];
  const span = (i0: number, i1: number, a: (i: number) => number, b: (i: number) => number): Pt[] => {
    const up: Pt[] = [];
    const dn: Pt[] = [];
    for (let i = i0; i <= i1; i++) {
      up.push({ x: foot[i]!.x, y: a(i) });
      dn.push({ x: foot[i]!.x, y: b(i) });
    }
    return [...up, ...dn.reverse()];
  };
  for (const k of blocks) {
    if (k.out <= 0) continue;
    const i0 = Math.max(0, k.i0 - 1);
    const i1 = Math.min(foot.length - 1, k.i1 + 1);
    const top = (i: number) => foot[i]!.y - 1 - rise[i]!;
    const poly = rough(span(i0, i1, top, (i) => front(i) + 0.4), rng, 0.6, 3);
    slabs.push({ clip: poly, marks: [{ poly, alpha: 0.6 }, { poly: span(i0, i1, (i) => top(i) + (front(i) - top(i)) * 0.4, (i) => front(i) + 1), alpha: 0.25 }] });
    lit.push({ poly: rough(span(i0, i1, (i) => top(i) - 0.2, (i) => top(i) + (front(i) - top(i)) * rng.range(0.25, 0.4)), rng, 0.4, 3), alpha: rng.range(0.3, 0.45) });
    wet.push({ poly: span(i0, i1, (i) => top(i) + (front(i) - top(i)) * rng.range(0.5, 0.65), (i) => front(i) + 0.6), alpha: 0.55 });
    weed.push({ poly: span(i0, i1, (i) => front(i) - 1.1 + Math.sin(i * 1.7) * 0.4, (i) => front(i) + 0.6), alpha: 0.5 });
    joints.push({ poly: streak({ x: foot[i0]!.x + 0.5, y: foot[i0]!.y - 1 }, { x: foot[i0]!.x + rng.range(-1, 1), y: front(i0) + 0.3 }, rng.range(0.8, 1.3), rng), alpha: 0.5 });
    for (let j = 0; j < 2; j++) {
      const o = 0.8 + j * 1.8;
      refl.push({ poly: span(i0 + j, i1 - j, (i) => front(i) + o, (i) => front(i) + o + 1.1), alpha: j ? 0.18 : 0.32 });
    }
    const x0 = foot[i0]!.x;
    const x1 = foot[i1]!.x;
    foam.push(...foamLine(x0 - 1, x1 + 1, (x) => lineAt(FOOT_SHELF.front, x), rng));
  }
  fillUnderAll(p, slabs.map((g) => g.clip));
  yield;
  yield* wetBatch(p, refl, SEAM.reflection, { edge: 0.08, sharpness: 0.4, granulation: 0.3 });
  yield* clipBatch(p, slabs, mix(LIME.body, LIME.grey, 0.45), { edge: 0.12, sharpness: 0.5, granulation: 0.8, granules: 0.25 });
  yield* liftBatch(p, lit, LIME.lit, { edge: 0.05, sharpness: 0.6 });
  yield* wetBatch(p, wet, SEAM.wet, { edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, weed, SEAM.weed, { edge: 0.15, sharpness: 0.5, granulation: 0.5 });
  yield* wetBatch(p, joints, LIME.deep, { edge: 0.25, sharpness: 0.8 });
  yield* liftBatch(p, foam, SEAM.foam, { edge: 0.05, sharpness: 0.6 });
}

function fillUnderAll(p: Painter, shapes: readonly Pt[][]): void {
  for (const s of shapes) fillUnder(p, s, LIME.under);
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
