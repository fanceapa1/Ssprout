/**
 * The far distance's shapes (GB1), data only: the islands on the horizon, the far hill's
 * terraces, olive groves, cypresses and the road up to the chapel, the harbour at its foot, the
 * village's tiled roofs and pastel walls, and the places of the sky's clouds. Fixed seeds.
 * docs/systems/scenery.md › Coast › Rock and › Daylight.
 */
import { createRng } from '../../core/rng';
import { pointInPolygon, smoothPath } from '../../paint/geometry';
import type { Pt, Rect } from '../../render/viewport';
import { FAR_HILL, HORIZON } from './layout';
import { VILLAGE_CUBES } from './shapes';

/** The far hill's top at x (its outline's highest crossing), or the horizon past its ends. */
export function hillTop(x: number): number {
  let best = HORIZON;
  for (let i = 0; i < FAR_HILL.length; i++) {
    const a = FAR_HILL[i]!;
    const b = FAR_HILL[(i + 1) % FAR_HILL.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    best = Math.min(best, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return best;
}

/**
 * The headlands beyond: a far ridge over the hill's left end, a low island behind the temple's
 * point, and in the gap between the hill and the point a long far island with a paler, higher
 * coast behind it, both low enough that a sun sets on the sea beside them.
 */
export const HEADLANDS: readonly (readonly Pt[])[] = [
  [{ x: -40, y: 310 }, { x: 10, y: 304 }, { x: 52, y: 306 }, { x: 96, y: 313 }, { x: 140, y: 322 }, { x: 180, y: 336 }, { x: 180, y: HORIZON }, { x: -40, y: HORIZON }],
  [{ x: 650, y: HORIZON }, { x: 668, y: 393 }, { x: 700, y: 386 }, { x: 742, y: 381 }, { x: 792, y: 380 }, { x: 846, y: 383 }, { x: 900, y: 390 }, { x: 960, y: HORIZON }],
];
/** The far coast in the gap: a pale mainland ridge, then a nearer island in front of it. */
export const GAP_ISLANDS: readonly (readonly Pt[])[] = [
  [{ x: 496, y: HORIZON }, { x: 512, y: 394.5 }, { x: 536, y: 391 }, { x: 560, y: 389.5 }, { x: 578, y: 387.2 }, { x: 594, y: 388 }, { x: 612, y: 390.6 }, { x: 628, y: 393.4 }, { x: 646, y: 396.5 }, { x: 664, y: HORIZON }],
  [{ x: 500, y: HORIZON }, { x: 514, y: 396.4 }, { x: 530, y: 394.2 }, { x: 544, y: 393.6 }, { x: 556, y: 394.8 }, { x: 568, y: 396.8 }, { x: 582, y: 398.6 }, { x: 596, y: HORIZON }],
];
/** A far sail on the horizon, in the gap: its foot on the water. */
export const FAR_SAIL: Pt = { x: 616, y: 399.4 };

/** The hill's gullies: two shallow creases from the crest down to the sea, in shade on their right. */
export const GULLIES: readonly (readonly Pt[])[] = [
  [{ x: 70, y: 324 }, { x: 64, y: 346 }, { x: 58, y: 372 }, { x: 52, y: 398 }],
  [{ x: 372, y: 326 }, { x: 382, y: 350 }, { x: 396, y: 374 }, { x: 404, y: 398 }],
];

/** Where the village stands, so the field walls, groves and wild patches keep their distance. */
const HOUSES: readonly Rect[] = VILLAGE_CUBES.flat();
const nearHouse = (x: number, y: number, pad: number): boolean => HOUSES.some((c) => x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad);

/** The road from the harbour up the bare right slope in hairpins, then along the crest to the chapel. */
export const CHAPEL_ROAD: readonly Pt[] = smoothPath(
  [
    { x: 404, y: 398 }, { x: 392, y: 390 }, { x: 378, y: 383 }, { x: 392, y: 376 }, { x: 414, y: 368 }, { x: 400, y: 358 }, { x: 378, y: 349 },
    { x: 362, y: 342 }, { x: 374, y: 333 }, { x: 386, y: 327 }, { x: 362, y: 318 }, { x: 330, y: 313 }, { x: 296, y: 312 }, { x: 266, y: 314 }, { x: 246, y: 315 },
  ],
  3,
);

/**
 * The hill's old field terraces: contours of the hill drawn as broken lines (a lit riser top and
 * its shade), dense on the open slopes either side of the village, sparse in it.
 */
export const FIELD_TERRACES: readonly (readonly Pt[])[] = (() => {
  const rng = createRng('coast-far-terraces');
  const out: Pt[][] = [];
  const levels = [0.9, 0.8, 0.71, 0.62, 0.54, 0.46, 0.38, 0.3, 0.22, 0.14];
  for (const f of levels) {
    const wave = rng.range(0, 6);
    for (let x = 30 + rng.range(0, 30); x < 500; ) {
      const len = rng.range(18, 64);
      const open = x < 118 || x > 330;
      if (rng.chance(open ? 0.82 : 0.22)) {
        const run: Pt[] = [];
        for (let q = x; q <= Math.min(x + len, 506); q += 3) {
          const top = hillTop(q);
          const y = HORIZON - (HORIZON - top) * f + Math.sin(q / 23 + wave) * 1.1;
          if (y < top + 3 || y > HORIZON - 2 || nearHouse(q, y, 2) || roadNear(q, y, 2.4)) {
            if (run.length > 3) out.push(run.splice(0));
            run.length = 0;
            continue;
          }
          run.push({ x: q, y });
        }
        if (run.length > 3) out.push(run);
      }
      x += len + rng.range(4, 26);
    }
  }
  return out;
})();

function roadNear(x: number, y: number, d: number): boolean {
  return CHAPEL_ROAD.some((q) => Math.abs(q.x - x) < d && Math.abs(q.y - y) < d);
}

/** Olive groves on the terraces of the lower slopes: one small grey-green crown each, in rows. */
export const FAR_OLIVES: readonly { x: number; y: number; r: number }[] = (() => {
  const rng = createRng('coast-far-olives');
  const groves: readonly Rect[] = [
    { x: 34, y: 352, w: 62, h: 44 },
    { x: 122, y: 376, w: 120, h: 20 },
    { x: 380, y: 352, w: 104, h: 44 },
    { x: 300, y: 318, w: 60, h: 18 },
  ];
  const out: { x: number; y: number; r: number }[] = [];
  for (const line of FIELD_TERRACES) {
    for (let i = 0; i < line.length; i += 2) {
      const q = line[i]!;
      if (!groves.some((g) => q.x > g.x && q.x < g.x + g.w && q.y > g.y && q.y < g.y + g.h)) continue;
      if (!rng.chance(0.72)) continue;
      const x = q.x + rng.range(-1, 1);
      const y = q.y - rng.range(1.2, 2);
      if (nearHouse(x, y, 2) || roadNear(x, y, 3) || !pointInPolygon({ x, y: y - 2 }, FAR_HILL)) continue;
      out.push({ x, y, r: rng.range(1.3, 2) });
    }
  }
  return out;
})();

/** Cypresses standing up among the houses and beside the road: foot, height, half-width. */
export const FAR_CYPRESSES: readonly { x: number; y: number; h: number; w: number }[] = [
  { x: 150, y: 360, h: 17, w: 1.9 },
  { x: 199, y: 349, h: 14, w: 1.7 },
  { x: 233, y: 372, h: 16, w: 1.8 },
  { x: 317, y: 361, h: 19, w: 2 },
  { x: 372, y: 381, h: 13, w: 1.6 },
  { x: 96, y: 371, h: 12, w: 1.6 },
  { x: 292, y: 329, h: 11, w: 1.5 },
  { x: 410, y: 366, h: 11, w: 1.5 },
];

/** The settled ground under the village: walls, yards and garden plots, a little warmer than the hill. */
export const VILLAGE_GROUND: readonly Pt[] = [
  { x: 110, y: 334 }, { x: 150, y: 318 }, { x: 186, y: 311 }, { x: 214, y: 318 }, { x: 262, y: 326 }, { x: 300, y: 328 }, { x: 330, y: 348 },
  { x: 372, y: 372 }, { x: 378, y: 396 }, { x: 250, y: 397 }, { x: 160, y: 386 }, { x: 96, y: 390 }, { x: 94, y: 360 },
];

/** Houses (indices into the flat `VILLAGE_CUBES`) under a low tiled roof, the Ionian way, and pastel walls. */
export const TILED_ROOFS: readonly number[] = [2, 12, 18, 24];
export const PASTEL_WALLS: readonly { cube: number; tint: 'ochre' | 'rose' }[] = [
  { cube: 6, tint: 'ochre' },
  { cube: 14, tint: 'rose' },
  { cube: 25, tint: 'ochre' },
];

/** A small bell tower in the lower village: its foot's centre, width and height. */
export const CAMPANILE = { x: 318, y: 394, w: 4.6, h: 17 } as const;

/**
 * The harbour at the hill's foot: a stone quay along the water under the lower houses, a mole
 * curving out to the right with a light at its head, a few small boats moored in its lee and two
 * drawn up on a strip of shingle to the left.
 */
export const HARBOUR = {
  quay: [{ x: 252, y: 398.2 }, { x: 300, y: 398.6 }, { x: 348, y: 398.8 }, { x: 392, y: 399.4 }, { x: 392, y: 402.2 }, { x: 348, y: 401.6 }, { x: 300, y: 401.4 }, { x: 252, y: 401.2 }] as readonly Pt[],
  mole: [{ x: 388, y: 399.6 }, { x: 408, y: 400.6 }, { x: 428, y: 401.8 }, { x: 446, y: 403.2 }, { x: 452, y: 404.2 }, { x: 452, y: 406.2 }, { x: 444, y: 405.6 }, { x: 426, y: 404.2 }, { x: 406, y: 402.8 }, { x: 388, y: 402.4 }] as readonly Pt[],
  light: { x: 449, y: 403.6 } as Pt,
  shingle: [{ x: 214, y: 398.6 }, { x: 236, y: 397.8 }, { x: 252, y: 398.4 }, { x: 252, y: 401 }, { x: 232, y: 401.4 }, { x: 212, y: 401 }] as readonly Pt[],
  boats: [
    { x: 404, y: 404.4, w: 7, colour: 'white' },
    { x: 418, y: 405.4, w: 5.6, colour: 'blue' },
    { x: 432, y: 406.4, w: 6.4, colour: 'white' },
    { x: 312, y: 403.4, w: 6, colour: 'blue' },
    { x: 362, y: 403.8, w: 6.6, colour: 'white' },
    { x: 224, y: 399.6, w: 5.6, colour: 'white', beached: true },
    { x: 240, y: 399.4, w: 6, colour: 'blue', beached: true },
  ] as readonly { x: number; y: number; w: number; colour: 'white' | 'blue'; beached?: boolean }[],
} as const;

/** Low rock along the hill's foot where it meets the sea, either side of the harbour: x span and how far it juts. */
export const HILL_SHORE: readonly { x0: number; x1: number; jut: number }[] = [
  { x0: 44, x1: 92, jut: 2.4 }, { x0: 98, x1: 150, jut: 1.4 }, { x0: 156, x1: 210, jut: 2.8 },
  { x0: 456, x1: 490, jut: 2.2 }, { x0: 494, x1: 516, jut: 1.6 },
];

/**
 * The sky's clouds, the same places in every light: a low bank of fair-weather cumulus building
 * over the far hill and a smaller one over the promontory, and a few high thin streaks.
 */
export const CLOUD_BANKS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 236, y: 286, w: 300, h: 44 },
  { x: 960, y: 246, w: 170, h: 26 },
];
export const CLOUD_STREAKS: readonly { x: number; y: number; len: number; tilt: number }[] = [
  { x: 520, y: 224, len: 260, tilt: -0.05 },
  { x: 800, y: 206, len: 300, tilt: -0.04 },
  { x: 330, y: 212, len: 170, tilt: -0.06 },
  { x: 700, y: 150, len: 240, tilt: -0.03 },
];
