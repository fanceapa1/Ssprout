/**
 * The far shore (G2): pale headlands on the horizon, the hill across the bay in aerial
 * perspective, and its whitewashed village with the blue-domed chapel on the crest.
 * docs/systems/scenery.md › Coast › Rock.
 */
import type { Rng } from '../../core/rng';
import { blob, mix, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { CHAPEL, FAR_HILL, HORIZON, VILLAGE } from './layout';
import { VILLAGE_CUBES } from './shapes';
import { box, ellipse, liftBatch, rough, wetBatch, type Mark } from './rock-kit';

const HAZE = {
  far: '#b4b8d4',
  hill: '#b6b2c6',
  maquis: '#a3a99a',
  shade: '#8d8ba9',
  dark: '#6e7468',
  white: '#fdfbf5',
  wall: '#a9acc8',
  hole: '#535a72',
  dome: '#2a6cc6',
  domeDeep: '#1f4a90',
} satisfies Record<string, Pigment>;

/** The headlands beyond: a far ridge over the hill's left end, a low island behind the temple's point. */
export const HEADLANDS: readonly (readonly Pt[])[] = [
  [{ x: -40, y: 310 }, { x: 10, y: 304 }, { x: 52, y: 306 }, { x: 96, y: 313 }, { x: 140, y: 322 }, { x: 180, y: 336 }, { x: 180, y: HORIZON }, { x: -40, y: HORIZON }],
  [{ x: 650, y: HORIZON }, { x: 668, y: 393 }, { x: 700, y: 386 }, { x: 742, y: 381 }, { x: 792, y: 380 }, { x: 846, y: 383 }, { x: 900, y: 390 }, { x: 960, y: HORIZON }],
];

/** The far hill and the headlands (a soft step: painted at draft resolution). */
export function* paintFarHill(p: Painter, rng: Rng): Strokes {
  for (const [i, h] of HEADLANDS.entries()) {
    yield* p.parts.wash(rough(h, rng, 0.8, 4), mix(HAZE.far, HAZE.shade, i * 0.2), { rng, opacity: 0.34, deform: 0.03, spread: 0.04, edge: 0.15, sharpness: 0.6, granulation: 0.15, fade: { angle: Math.PI / 2, start: 0.5, amount: 0.6, ragged: 0.4 } });
    yield;
  }
  const hill = rough(FAR_HILL, rng, 0.9, 4);
  yield* p.parts.wetInWet(hill, HAZE.hill, HAZE.maquis, { rng, angle: Math.PI / 2 + 0.4, split: 0.45, softness: 0.7, opacity: 0.5, deform: 0.03, spread: 0.03, edge: 0.2, sharpness: 0.7, granulation: 0.35 });
  yield;
  // the right slope turned from the sun; maquis in soft patches; a few dark cypresses; the shore line
  yield* p.parts.glaze([{ x: 300, y: 300 }, { x: 330, y: 308 }, { x: 392, y: 332 }, { x: 448, y: 362 }, { x: 492, y: 388 }, { x: 520, y: 404 }, { x: 330, y: 404 }], HAZE.shade, { rng, opacity: 0.32, edge: 0.05, deform: 0.05, fade: { angle: Math.PI, start: 0.3, amount: 1, ragged: 0.6 } });
  const patches: Mark[] = [];
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-10, 490);
    const y = rng.range(318, 396);
    if (VILLAGE.some((v) => x > v.x - 8 && x < v.x + v.w + 8 && y > v.y - 6 && y < v.y + v.h + 6)) continue;
    patches.push({ poly: blob(x, y, rng.range(5, 16), rng.range(2, 4.5), rng, { irregularity: 0.5 }), alpha: rng.range(0.16, 0.3) });
  }
  const darks: Mark[] = [];
  for (const [x, y] of [[96, 368], [150, 352], [200, 340], [292, 360], [318, 342], [62, 384], [380, 372]] as const) {
    darks.push({ poly: rough(ellipse(x, y, 1.4, 4.2, 10), rng, 0.4, 2), alpha: 0.45 });
  }
  darks.push({ poly: rough([{ x: -30, y: HORIZON - 3 }, { x: 520, y: HORIZON - 2 }, { x: 520, y: HORIZON + 2 }, { x: -30, y: HORIZON + 2 }], rng, 0.8, 6), alpha: 0.28 });
  yield* wetBatch(p, patches, mix(HAZE.maquis, HAZE.dark, 0.35), { edge: 0.12, sharpness: 0.4, granulation: 0.4 });
  yield* wetBatch(p, darks, HAZE.dark, { edge: 0.2, sharpness: 0.6 });
}

/** The whitewashed village, a row at a time from the top of the slope, then the chapel. */
export function* paintVillage(p: Painter, rng: Rng): Strokes {
  for (const row of VILLAGE_CUBES) {
    const walls: Mark[] = row.map((c) => ({ poly: rough(box(c.x, c.y, c.x + c.w, c.y + c.h), rng, 0.3, 2), alpha: 0.95 }));
    yield* liftBatch(p, walls, HAZE.white, { edge: 0.05, sharpness: 0.9, granulation: 0 });
    const shade: Mark[] = row.map((c) => ({ poly: rough(box(c.x + c.w * (1 - c.side), c.y + 0.3, c.x + c.w + 0.2, c.y + c.h), rng, 0.25, 2), alpha: 0.42 }));
    // a thin shade along the foot where the house meets the slope
    for (const c of row) shade.push({ poly: rough(box(c.x - 0.5, c.y + c.h - 1, c.x + c.w + 0.5, c.y + c.h + 0.8), rng, 0.3, 2), alpha: 0.35 });
    yield* wetBatch(p, shade, HAZE.wall, { edge: 0.2, sharpness: 0.8, granulation: 0.2 });
    const holes = row.flatMap((c) => c.holes.map((h) => ({ poly: rough(box(h.x, h.y, h.x + h.w, h.y + h.h), rng, 0.2, 1), alpha: 0.75 })));
    yield* wetBatch(p, holes, HAZE.hole, { edge: 0.3, edgeWidth: 0.6, sharpness: 0.8 });
  }
  yield* paintChapel(p, rng.fork('chapel'));
}

/** The chapel on the crest: a white cell under a blue dome, a small bell wall on its left. */
function* paintChapel(p: Painter, rng: Rng): Strokes {
  const { x, y } = CHAPEL;
  const cell = rough(box(x - 10, y + 0.5, x + 10, y + 15), rng, 0.3, 2);
  const drum = rough(box(x - 7, y - 2, x + 7, y + 1), rng, 0.25, 2);
  const bell = rough([{ x: x - 20, y: y + 15 }, { x: x - 20, y: y - 4 }, { x: x - 18, y: y - 7.5 }, { x: x - 15.5, y: y - 9 }, { x: x - 13, y: y - 7.5 }, { x: x - 11, y: y - 4 }, { x: x - 11, y: y + 15 }], rng, 0.25, 2);
  yield* liftBatch(p, [cell, drum, bell].map((poly) => ({ poly, alpha: 0.97 })), HAZE.white, { edge: 0.05, sharpness: 0.9, granulation: 0 });
  yield* wetBatch(p, [
    { poly: box(x + 4.5, y + 0.8, x + 10.2, y + 15), alpha: 0.42 },
    { poly: box(x + 3, y - 2, x + 7.2, y + 1), alpha: 0.4 },
    { poly: box(x - 13.5, y - 6, x - 11, y + 15), alpha: 0.35 },
    { poly: box(x - 20.5, y + 14, x + 10.5, y + 15.6), alpha: 0.4 },
  ], HAZE.wall, { edge: 0.2, sharpness: 0.8 });
  // the door, the bell's arch and the bell
  yield* wetBatch(p, [
    { poly: rough([{ x: x - 4, y: y + 15 }, { x: x - 4, y: y + 9 }, { x: x - 2.6, y: y + 7.6 }, { x: x - 1.2, y: y + 9 }, { x: x - 1.2, y: y + 15 }], rng, 0.15, 1), alpha: 0.8 },
    { poly: rough([{ x: x - 17.6, y: y + 1 }, { x: x - 17.6, y: y - 3.6 }, { x: x - 15.5, y: y - 5.6 }, { x: x - 13.4, y: y - 3.6 }, { x: x - 13.4, y: y + 1 }], rng, 0.15, 1), alpha: 0.75 },
  ], HAZE.hole, { edge: 0.3, edgeWidth: 0.6, sharpness: 0.8 });
  // the dome: one clear blue note, lit on its left shoulder, a little deeper to the right; a small cross
  const dome: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    dome.push({ x: x + Math.cos(a) * 8.6, y: y - 1.6 + Math.sin(a) * 8.4 });
  }
  yield* wetBatch(p, [{ poly: rough(dome, rng, 0.2, 1.5), alpha: 0.92 }], HAZE.dome, { edge: 0.35, edgeWidth: 1, sharpness: 0.8, granulation: 0.2, blend: 'source-over' });
  yield* wetBatch(p, [{ poly: dome.filter((q) => q.x > x + 1).concat({ x: x + 1.5, y: y - 1.6 }), alpha: 0.4 }], HAZE.domeDeep, { edge: 0.1, sharpness: 0.4 });
  yield* liftBatch(p, [{ poly: rough(ellipse(x - 3.2, y - 5, 1.8, 2.2, 10), rng, 0.2, 1), alpha: 0.45 }], HAZE.white, { edge: 0 });
  yield* wetBatch(p, [
    { poly: box(x - 0.35, y - 13.5, x + 0.35, y - 8.6), alpha: 0.75 },
    { poly: box(x - 1.8, y - 12.2, x + 1.8, y - 11.6), alpha: 0.7 },
  ], HAZE.hole, { edge: 0.1, sharpness: 0.8 });
}
