/**
 * The ruined temple on the promontory's point (G2): a stepped base, four weathered Doric columns
 * (two whole under a piece of architrave, two broken), a fallen drum and blocks. Warm ivory in
 * the light from the left, cool on the shade side. docs/systems/scenery.md › Coast › Rock.
 */
import { createRng, type Rng } from '../../core/rng';
import { createSimplex2D, mix, type Painter } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { ARCHITRAVE, COLUMNS, COLUMN_W, DRUM, STYLOBATE } from './layout';
import { MARBLE, LIME, band, box, clipTo, ellipse, fillUnder, liftBatch, rough, streak, wetBatch, type Mark } from './rock-kit';

const NOISE = createSimplex2D(createRng('coast-temple-noise'));
const BASE = STYLOBATE.y;
/** The architrave's underside: it has slumped a little to the left, onto the shorter column's capital. */
const ARCH_LOW = BASE - Math.max(COLUMNS[0]!.h, COLUMNS[1]!.h);
const archLowAt = (x: number): number => ARCH_LOW + ((ARCHITRAVE.x1 - x) / (ARCHITRAVE.x1 - ARCHITRAVE.x0)) * 2.5;
const ARCH_TOP = (x: number): number => archLowAt(x) - ARCHITRAVE.h;

/** The krepis: three steps, each wider and lower, their left ends broken away. */
const STEPS = [
  { x0: 684, x1: 834, y0: BASE, y1: BASE + 5 },
  { x0: 676, x1: 840, y0: BASE + 5, y1: BASE + 10.5 },
  { x0: 666, x1: 846, y0: BASE + 10.5, y1: BASE + 16 },
] as const;

export interface Col {
  x: number;
  h: number;
  top: number;
  whole: boolean;
  outline: Pt[];
}

/** A column's shaft: a slight taper, a hand-cut edge, a broken one ending in a jagged slant. */
function column(x: number, h: number, rng: Rng): Col {
  const top = BASE - h;
  const whole = h >= 80;
  const hw = COLUMN_W / 2 - 0.3;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const t0 = whole ? top + 9 : top;
  // a broken shaft's right side stops at the low end of its slanted break
  const t1 = whole ? t0 : top + 6;
  const side = (y: number) => {
    const k = (BASE - y) / h;
    return hw * (1 - 0.1 * k) + Math.sin(k * Math.PI) * 0.35;
  };
  for (let y = BASE; y > t0; y -= 3) left.push({ x: x - side(y) + NOISE(y / 6, x) * 0.35, y });
  left.push({ x: x - side(t0), y: t0 });
  for (let y = BASE; y > t1; y -= 3) right.push({ x: x + side(y) + NOISE(y / 6, x + 9) * 0.35, y });
  right.push({ x: x + side(t1), y: t1 });
  const crown: Pt[] = [];
  if (whole) {
    crown.push({ x: x - hw * 0.9, y: t0 }, { x: x + hw * 0.9, y: t0 });
  } else {
    // the break: high on the left, falling to the right in jagged steps
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      crown.push({ x: x - hw + u * hw * 2, y: top + u * 6 - (i % 2 ? rng.range(0, 0.8) : rng.range(0.8, 2.4)) });
    }
  }
  return { x, h, top, whole, outline: [...left, ...crown.slice(whole ? 0 : 1, whole ? 2 : -1), ...right.reverse()] };
}

/** The four shafts as painted, from fixed seeds. */
export const columnShapes = (): Col[] => COLUMNS.map((c, i) => column(c.x, c.h, createRng(`coast-column-${i}`)));

export function* paintTemple(p: Painter, rng: Rng): Strokes {
  const cols = columnShapes();
  yield* paintKrepis(p, rng.fork('krepis'));
  yield* paintFallen(p, rng.fork('fallen'));
  for (const c of cols) fillUnder(p, rough(c.outline, rng, 0.25, 2), LIME.under);
  yield* paintShafts(p, cols, rng.fork('shafts'));
  yield* paintCapitals(p, cols.filter((c) => c.whole), rng.fork('capitals'));
  yield* paintArchitrave(p, rng.fork('architrave'));
}

function* paintKrepis(p: Painter, rng: Rng): Strokes {
  const outline = rough([
    { x: STEPS[0].x0 + 2, y: STEPS[0].y0 - 0.5 }, { x: STEPS[0].x1, y: STEPS[0].y0 }, { x: STEPS[0].x1, y: STEPS[1].y0 }, { x: STEPS[1].x1, y: STEPS[1].y0 },
    { x: STEPS[1].x1, y: STEPS[2].y0 }, { x: STEPS[2].x1, y: STEPS[2].y0 }, { x: STEPS[2].x1 + 1, y: STEPS[2].y1 + 1 }, { x: STEPS[2].x0 - 1, y: STEPS[2].y1 + 1 },
    { x: STEPS[2].x0, y: STEPS[2].y0 }, { x: STEPS[1].x0 + 4, y: STEPS[2].y0 - 1 }, { x: STEPS[1].x0, y: STEPS[1].y0 + 1 }, { x: STEPS[0].x0 - 3, y: STEPS[1].y0 - 1.5 },
  ], rng, 0.6, 3);
  fillUnder(p, outline, LIME.under);
  clipTo(p, outline);
  yield* p.parts.wetInWet(box(650, BASE - 4, 860, BASE + 20), MARBLE.ivory, mix(MARBLE.warm, MARBLE.shade, 0.35), { rng, angle: 0.2, split: 0.55, softness: 0.6, opacity: 0.45, edge: 0, deform: 0.02, spread: 0.03, granulation: 0.6, granules: 0.2 });
  const shade: Mark[] = [];
  const joints: Mark[] = [];
  const lips: Mark[] = [];
  for (const s of STEPS) {
    // the riser's lower half a shade darker, a crisp shadow under the lip of the step above
    shade.push({ poly: band(s.x0 - 2, s.x1 + 2, () => s.y0 + (s.y1 - s.y0) * 0.45, () => s.y1, 8), alpha: 0.22 });
    // the shadow under each lip comes and goes; a few joints, worn blocks with their arrises chipped
    for (let x = s.x0; x < s.x1; ) {
      const len = rng.range(16, 60);
      if (rng.chance(0.75)) joints.push({ poly: rough(band(x, Math.min(s.x1 + 2, x + len), () => s.y1 - 0.4, () => s.y1 + rng.range(0.5, 1.1), 6), rng, 0.4, 3), alpha: rng.range(0.4, 0.62) });
      x += len + rng.range(2, 10);
    }
    lips.push({ poly: band(s.x0 + 2, s.x1 - 1, () => s.y0 + 0.2, () => s.y0 + 1.4, 8), alpha: 0.6 });
    for (let x = s.x0 + rng.range(6, 20); x < s.x1 - 4; x += rng.range(13, 30)) {
      if (rng.chance(0.6)) joints.push({ poly: rough(box(x - 0.4, s.y0 + rng.range(0.6, 2), x + 0.4, s.y1 - rng.range(0, 1.5)), rng, 0.3, 2), alpha: rng.range(0.22, 0.45) });
      if (rng.chance(0.25)) shade.push({ poly: rough(box(x - rng.range(3, 7), s.y0, x, s.y0 + rng.range(1.5, 3.5)), rng, 0.7, 2), alpha: 0.45 });
    }
  }
  // the right end turned from the sun
  shade.push({ poly: box(826, BASE - 2, 850, BASE + 18), alpha: 0.24 });
  yield* liftBatch(p, lips, LIME.lit, { edge: 0.05 });
  yield* wetBatch(p, shade, MARBLE.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, joints, MARBLE.deep, { edge: 0.25, edgeWidth: 0.8, sharpness: 0.8 });
  p.ctx.restore();
  // each column throws a short shade to the right along the top step
  yield* wetBatch(p, COLUMNS.map((c) => ({ poly: rough(box(c.x + 4, BASE - 0.5, c.x + COLUMN_W + 6, BASE + 4), rng, 0.8, 3), alpha: 0.35 })), MARBLE.shade, { edge: 0.1, sharpness: 0.4 });
}

/** The fallen drum lying on the slope (its flat end to the light) and a few blocks. */
function* paintFallen(p: Painter, rng: Rng): Strokes {
  const { x, y } = DRUM;
  const a = -0.18;
  const rot = (dx: number, dy: number): Pt => ({ x: x + dx * Math.cos(a) - dy * Math.sin(a), y: y + dx * Math.sin(a) + dy * Math.cos(a) });
  const r = 8.5;
  const len = 13;
  const body = rough([rot(-len / 2, -r), rot(len / 2, -r), rot(len / 2 + 2.5, -r * 0.5), rot(len / 2 + 3, 0), rot(len / 2 + 2.5, r * 0.5), rot(len / 2, r), rot(-len / 2, r)], rng, 0.4, 2);
  const end = ellipse(0, 0, 3, r, 20).map((q) => rot(-len / 2 + q.x, q.y));
  const blocks = [
    { x: 670, y: BASE + 16, w: 12, h: 6 }, { x: 852, y: BASE - 1.5, w: 9, h: 5 }, { x: 886, y: 374, w: 14, h: 7 }, { x: 661, y: BASE + 10, w: 7, h: 4 },
  ].map((b) => rough([{ x: b.x - b.w / 2, y: b.y }, { x: b.x - b.w / 2 + 0.6, y: b.y - b.h }, { x: b.x + b.w / 2 - 0.4, y: b.y - b.h - 0.6 }, { x: b.x + b.w / 2, y: b.y }], rng, 0.4, 2));
  for (const s of [body, ...blocks]) fillUnder(p, s, LIME.under);
  fillUnder(p, end, LIME.lit);
  yield;
  yield* wetBatch(p, [{ poly: body, alpha: 0.45 }, ...blocks.map((poly) => ({ poly, alpha: 0.45 }))], MARBLE.warm, { edge: 0.25, sharpness: 0.7, granulation: 0.6 });
  // the drum's underside and far end in shade, its flat end lit with a worn ring; the blocks' right sides
  const shade: Mark[] = [{ poly: [rot(-len / 2, r * 0.1), rot(len / 2 + 2, r * 0.1), rot(len / 2 + 2.5, r * 0.5), rot(len / 2, r), rot(-len / 2, r)], alpha: 0.42 }];
  for (const b of blocks) {
    const bb = { x: Math.min(...b.map((q) => q.x)), y: Math.min(...b.map((q) => q.y)), x1: Math.max(...b.map((q) => q.x)), y1: Math.max(...b.map((q) => q.y)) };
    shade.push({ poly: box(bb.x + (bb.x1 - bb.x) * 0.6, bb.y, bb.x1 + 0.5, bb.y1), alpha: 0.42 });
  }
  yield* wetBatch(p, shade, MARBLE.shade, { edge: 0.2, sharpness: 0.7, granulation: 0.5 });
  const ink: Mark[] = [
    { poly: ellipse(0, 0, 3, r, 20).map((q) => rot(-len / 2 + q.x + 0.4, q.y)).filter((q, i) => i >= 4 && i <= 14).concat(ellipse(0, 0, 2.2, r - 0.8, 20).map((q) => rot(-len / 2 + q.x + 0.4, q.y)).filter((q, i) => i >= 4 && i <= 14).reverse()), alpha: 0.3 },
    { poly: [rot(-len / 2, r - 0.5), rot(len / 2, r - 0.5), rot(len / 2, r + 1.5), rot(-len / 2, r + 1.8)], alpha: 0.55 },
  ];
  // two broken flutes along the body
  for (const dy of [-r + 2.4, -1]) {
    const a = rng.range(-len / 2 + 2, -len / 2 + 7);
    const c = rng.range(len / 2 - 8, len / 2 - 2);
    ink.push({ poly: [rot(a, dy), rot(c, dy + 0.3), rot(c, dy + 0.8), rot(a, dy + 0.5)], alpha: 0.22 });
  }
  for (const b of blocks) {
    const y1 = Math.max(...b.map((q) => q.y));
    const x0 = Math.min(...b.map((q) => q.x));
    const x1 = Math.max(...b.map((q) => q.x));
    ink.push({ poly: band(x0 - 0.5, x1 + 1.5, () => y1 - 0.6, () => y1 + 1.2, 4), alpha: 0.6 });
  }
  yield* wetBatch(p, ink, MARBLE.deep, { edge: 0.25, edgeWidth: 0.8, sharpness: 0.8 });
  yield* wetBatch(p, [{ poly: rough(ellipse(rot(len / 2 + 6, r + 1).x, rot(len / 2 + 6, r + 1).y, 10, 2, 16), rng, 0.5, 2), alpha: 0.35 }], MARBLE.shade, { edge: 0.05, sharpness: 0.3 });
}

/** The shafts: ivory, the shade side cool and turning, fluting in broken vertical touches, drum joints, stains and chips. */
function* paintShafts(p: Painter, cols: readonly Col[], rng: Rng): Strokes {
  const body: Mark[] = [];
  const shade: Mark[] = [];
  const core: Mark[] = [];
  const flutes: Mark[] = [];
  const joints: Mark[] = [];
  const stains: Mark[] = [];
  const lit: Mark[] = [];
  for (const c of cols) {
    const t0 = c.whole ? c.top + 9 : c.top;
    const x = c.x;
    const hw = COLUMN_W / 2;
    body.push({ poly: c.outline, alpha: 0.4 });
    // the light from the left: the shade side turns from a soft edge near the axis to the far rim
    shade.push({ poly: rough(box(x + 0.5, t0 - 2, x + hw + 1, BASE + 1), rng, 0.8, 4), alpha: 0.24 });
    shade.push({ poly: rough(box(x + 2.8, t0 - 2, x + hw + 1, BASE + 1), rng, 0.6, 4), alpha: 0.32 });
    core.push({ poly: rough(box(x + 3.4, t0, x + 5.4, BASE), rng, 0.5, 4), alpha: 0.28 });
    lit.push({ poly: rough(box(x - hw + 1.2, t0 + 2, x - hw + 3.4, BASE - 2), rng, 0.4, 4), alpha: 0.5 });
    for (const u of [-5.6, -3.1, -0.8, 1.6, 4, 6.2]) {
      for (let y = t0 + rng.range(1, 5); y < BASE - 3; ) {
        const len = rng.range(5, 18);
        const y1 = Math.min(BASE - 2, y + len);
        if (rng.chance(u < 0 ? 0.45 : 0.75)) flutes.push({ poly: rough(box(x + u - 0.35, y, x + u + 0.35, y1), rng, 0.2, 2), alpha: u < 0 ? rng.range(0.25, 0.4) : rng.range(0.4, 0.6) });
        y = y1 + rng.range(2, 9);
      }
    }
    // drums of uneven height; the joints arch a little (they are above the eye)
    for (let y = BASE - rng.range(14, 20); y > t0 + 5; y -= rng.range(15, 22)) {
      const yy = y;
      const arc = (q: number) => yy - 0.6 * Math.cos(((q - x) / hw) * 1.2);
      // a joint is a broken line: clear on the shade side, lost here and there in the light
      const a = x - hw + rng.range(0.4, 5);
      if (rng.chance(0.85)) joints.push({ poly: rough(band(a, x + hw - 0.4, arc, (q) => arc(q) + rng.range(0.5, 0.9), 2), rng, 0.25, 2), alpha: rng.range(0.3, 0.55) });
      if (rng.chance(0.3)) {
        const side = rng.chance(0.35) ? -1 : 1;
        joints.push({ poly: rough(ellipse(x + side * (hw - 1), yy + 0.4, rng.range(1, 1.8), rng.range(0.6, 1.1), 8), rng, 0.2, 1), alpha: 0.35 });
      }
    }
    // weather: rust and ochre runs from the top, a grey patch of lichen
    for (let k = 0; k < 2; k++) {
      const sx = x + rng.range(-5, 5);
      const sy = t0 + rng.range(0, 20);
      stains.push({ poly: streak({ x: sx, y: sy }, { x: sx + rng.range(-1, 1), y: sy + rng.range(16, 50) }, rng.range(2, 4), rng), alpha: rng.range(0.15, 0.28) });
    }
  }
  yield* wetBatch(p, body, MARBLE.ivory, { edge: 0.2, sharpness: 0.7, granulation: 0.6, granules: 0.15 });
  yield* wetBatch(p, stains, MARBLE.stain, { edge: 0.05, sharpness: 0.3, granulation: 0.5 });
  yield* wetBatch(p, shade, MARBLE.shade, { edge: 0.12, sharpness: 0.5, granulation: 0.5 });
  yield* wetBatch(p, core, MARBLE.deep, { edge: 0.05, sharpness: 0.3, granulation: 0.4 });
  yield* liftBatch(p, lit, LIME.lit, { edge: 0 });
  yield* wetBatch(p, flutes, MARBLE.deep, { edge: 0.2, edgeWidth: 0.6, sharpness: 0.7, granulation: 0.2 });
  yield* wetBatch(p, joints, MARBLE.deep, { edge: 0.25, edgeWidth: 0.6, sharpness: 0.8 });
  // the broken tops' fresher, paler stone
  yield* liftBatch(p, cols.filter((c) => !c.whole).map((c) => ({ poly: rough(band(c.x - 7, c.x + 7, (q) => c.top + ((q - c.x + 8) / 16) * 6 - 0.5, (q) => c.top + ((q - c.x + 8) / 16) * 6 + 2.4, 2), rng, 0.6, 2), alpha: 0.7 })), LIME.lit, { edge: 0.1 });
}

/** The two Doric capitals: a flaring echinus under a square abacus, the necking lines below. */
function* paintCapitals(p: Painter, cols: readonly Col[], rng: Rng): Strokes {
  const parts: Pt[][] = [];
  const shade: Mark[] = [];
  const ink: Mark[] = [];
  for (const c of cols) {
    const t = Math.min(c.top, archLowAt(c.x));
    const y9 = c.top + 9;
    const abacus = rough(box(c.x - 10.5, t, c.x + 10.5, t + 3.8), rng, 0.4, 2);
    const echinus = rough([{ x: c.x - 10, y: t + 3.8 }, { x: c.x + 10, y: t + 3.8 }, { x: c.x + 8.2, y: t + 6.8 }, { x: c.x + 7.2, y: y9 + 0.5 }, { x: c.x - 7.2, y: y9 + 0.5 }, { x: c.x - 8.2, y: t + 6.8 }], rng, 0.35, 2);
    parts.push(abacus, echinus);
    shade.push({ poly: box(c.x + 1, t + 3.8, c.x + 11, y9 + 0.5), alpha: 0.4 });
    shade.push({ poly: box(c.x + 4, t, c.x + 11, t + 3.8), alpha: 0.3 });
    ink.push({ poly: rough(band(c.x - 10, c.x + 10, () => t + 3.6, () => t + 4.5, 2), rng, 0.25, 1.5), alpha: 0.55 });
    ink.push({ poly: rough(band(c.x - 9, c.x + 9, () => t + 6.6, () => t + 7.4, 2), rng, 0.25, 1.5), alpha: 0.35 });
    for (const dy of [9.6, 11.2]) ink.push({ poly: rough(band(c.x - 7.6, c.x + 7.6, () => c.top + dy, () => c.top + dy + 0.6, 2), rng, 0.2, 1.5), alpha: 0.4 });
  }
  for (const s of parts) fillUnder(p, s, LIME.under);
  yield* wetBatch(p, parts.map((poly) => ({ poly, alpha: 0.42 })), MARBLE.ivory, { edge: 0.25, sharpness: 0.7, granulation: 0.6 });
  yield* wetBatch(p, shade, MARBLE.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, ink, MARBLE.deep, { edge: 0.2, edgeWidth: 0.6, sharpness: 0.8 });
}

/** The architrave's fragment: two fasciae in the light, its underside in shade, the right end broken away. */
function* paintArchitrave(p: Painter, rng: Rng): Strokes {
  const { x0, x1 } = ARCHITRAVE;
  const top: Pt[] = [];
  for (let x = x0; x <= x1 - 8; x += 3) top.push({ x, y: ARCH_TOP(x) + (x < x0 + 4 ? 0.8 : 0) });
  // the broken end: a jagged edge falling away to the lower right
  const broken: Pt[] = [];
  for (let i = 0; i <= 6; i++) broken.push({ x: x1 - 8 + i * 1.6 + rng.range(-1, 1), y: ARCH_TOP(x1) + (i / 6) * ARCHITRAVE.h + rng.range(-1, 1) });
  const low: Pt[] = [];
  for (let x = x1 - 1; x >= x0; x -= 3) low.push({ x, y: archLowAt(x) });
  const outline = rough([...top, ...broken, ...low], rng, 0.35, 2);
  fillUnder(p, outline, LIME.under);
  yield* wetBatch(p, [{ poly: outline, alpha: 0.42 }], MARBLE.ivory, { edge: 0.25, sharpness: 0.7, granulation: 0.65, granules: 0.15 });
  const shade: Mark[] = [
    { poly: band(x0 - 1, x1 + 1, (x) => archLowAt(x) - 2.6, (x) => archLowAt(x) + 0.5, 4), alpha: 0.4 },
    { poly: rough(band(x1 - 12, x1 + 2, (x) => ARCH_TOP(x), (x) => archLowAt(x), 2), rng, 1, 2), alpha: 0.3 },
  ];
  const ink: Mark[] = [
    { poly: rough(band(x0 + 1, x1 - 9, (x) => ARCH_TOP(x) + 5.2, (x) => ARCH_TOP(x) + 5.9, 3), rng, 0.25, 1.5), alpha: 0.45 },
    { poly: rough(band(x0 + 2, x1 - 10, (x) => ARCH_TOP(x) + 2.4, (x) => ARCH_TOP(x) + 2.9, 3), rng, 0.25, 1.5), alpha: 0.3 },
    { poly: rough(box(719.5, ARCH_TOP(720) + 0.5, 720.4, archLowAt(720) - 0.5), rng, 0.25, 1.5), alpha: 0.55 },
  ];
  for (let k = 0; k < 3; k++) {
    const cx = x0 + 4 + rng.range(0, x1 - x0 - 16);
    shade.push({ poly: rough(ellipse(cx, ARCH_TOP(cx) + 0.5, rng.range(1.5, 3), rng.range(0.8, 1.6), 8), rng, 0.3, 1.5), alpha: 0.5 });
  }
  yield* wetBatch(p, shade, MARBLE.shade, { edge: 0.15, sharpness: 0.6, granulation: 0.5 });
  yield* wetBatch(p, ink, MARBLE.deep, { edge: 0.2, edgeWidth: 0.6, sharpness: 0.8 });
  yield* liftBatch(p, [{ poly: band(x0 + 1, x1 - 10, (x) => ARCH_TOP(x) + 0.4, (x) => ARCH_TOP(x) + 1.5, 3), alpha: 0.6 }], LIME.lit, { edge: 0 });
}
