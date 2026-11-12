/**
 * The coast's shapes, data only so eager code can read them (devlog 149). The rock's (G2): the
 * splash rocks with their dry tops, the shoreline's blocks and the village's houses. The land's
 * and vegetation's (G4): the walls' faces and copings, the beds, the flights, the jars, the
 * scenery olive, the leaning pine, the promontory's pines and maquis, phrygana, grass and scrub.
 * Fixed seeds, so only the brushwork follows the art seed.
 */
import { createRng, type Rng } from '../../core/rng';
import { resample, smoothPath } from '../../paint/geometry';
import type { Pt, Rect } from '../../render/viewport';
import {
  copingAt, OLIVE, PINE, PROMONTORY, PROMONTORY_PINES, SHORE_BOULDERS, SPLASH_ROCKS, STEPS, VILLAGE, WALLS, WALL_TERRACE, type Terrace, type Wall,
} from './layout';
import { COAST_SLOTS } from './slots';

export interface RockShape {
  /** base centre on the water or the ground */
  x: number;
  y: number;
  w: number;
  /** the whole silhouette above the water */
  outline: Pt[];
  /** the flat dry top, seen a little from above: where a plant or a heron stands */
  top: Pt[];
  /** the top's front edge at the rock's centre */
  topY: number;
  /** the broken block on the top's back, if any: its x span and top */
  block: { x0: number; x1: number; y: number } | null;
}

/**
 * A limestone ledge seen a little from above: a flat top foreshortened behind its front edge, a
 * low front face to the water, and on some a higher broken block standing on the top's back.
 */
function rockShape(x: number, y: number, w: number, front: number, lift: number, rng: Rng): RockShape {
  const hw = w / 2 + 3;
  const j = (k: number) => rng.range(-k, k);
  const pd = Math.max(5, w * 0.2);
  const back = front - pd;
  const edge: Pt[] = [
    { x: x + hw + 1, y: front + j(1) },
    { x: x + hw * 0.35 + j(4), y: front + 1.2 + j(0.6) },
    { x: x - hw * 0.25 + j(4), y: front + 0.3 + j(0.6) },
    { x: x - hw - 1, y: front + 1.5 + j(1) },
  ];
  const rear: Pt[] = [{ x: x - hw * 0.86, y: back + pd * 0.35 + j(1) }];
  let block: RockShape['block'] = null;
  if (lift > 0) {
    // the block stands on the left or the right of the top's back
    const bw = hw * rng.range(0.7, 1.05);
    const b0 = rng.chance(0.5) ? x - hw * 0.7 + j(3) : x + hw * 0.8 - bw + j(3);
    const b1 = b0 + bw;
    const tilt = j(3);
    rear.push(
      { x: b0, y: back + j(1) }, { x: b0 + 1 + j(1), y: back - lift * 0.6 }, { x: b0 + 4, y: back - lift + tilt },
      { x: b1 - 6, y: back - lift - tilt + j(1.5) }, { x: b1 - 1.5, y: back - lift * 0.7 - tilt }, { x: b1, y: back + j(1) },
    );
    block = { x0: b0, x1: b1, y: back - lift };
  } else {
    rear.push({ x: x - hw * 0.45, y: back + j(1.2) }, { x: x + hw * 0.1, y: back - 1 + j(1.2) });
  }
  rear.push({ x: x + hw * 0.6, y: back + 1 + j(1) }, { x: x + hw * 0.92, y: back + pd * 0.45 + j(1) });
  const outline: Pt[] = [
    { x: x - hw + j(1), y: y + 3 },
    { x: x - hw - 1, y: front + 1.5 },
    ...rear,
    { x: x + hw + 1, y: front },
    { x: x + hw + j(1), y: y + 3 },
    { x: x + hw * 0.35, y: y + 4 + j(1) },
    { x: x - hw * 0.4, y: y + 3.5 + j(1) },
  ];
  const top: Pt[] = [{ x: x - hw * 0.86, y: back + pd * 0.35 }, { x: x - hw * 0.45, y: back }, { x: x + hw * 0.6, y: back + 1 }, { x: x + hw * 0.92, y: back + pd * 0.45 }, ...edge];
  return { x, y, w, outline, top, topY: front, block };
}

const slotOver = (x: number): number | null => COAST_SLOTS.find((s) => s.habitat === 'rock' && Math.abs(s.x - x) < 4)?.y ?? null;

/** The splash rocks: low limestone ledges, the slot on the flat top, a broken block behind on most. */
export const SPLASH_ROCK_SHAPES: readonly RockShape[] = SPLASH_ROCKS.map((r, i) => {
  const rng = createRng(`coast-splash-${i}`);
  const front = (slotOver(r.x) ?? r.y - r.w * 0.2) + 2;
  return rockShape(r.x, r.y, r.w, front, rng.chance(0.6) ? rng.range(5, 10) : 0, rng);
});

/** The blocks on the broken shoreline: taller ledges, each with a block on its back. */
export const SHORE_BOULDER_SHAPES: readonly RockShape[] = SHORE_BOULDERS.map((b, i) => {
  const rng = createRng(`coast-boulder-${i}`);
  return rockShape(b.x, b.y, b.w, b.y - b.w * 0.24, rng.range(8, 16), rng);
});

export interface Cube extends Rect {
  /** the shade side's share of the width */
  side: number;
  holes: Rect[];
}

/** The village's houses: each layout house as one to three white cubes, an upper storey on some; back rows first. */
export const VILLAGE_CUBES: readonly Cube[][] = (() => {
  const rng = createRng('coast-village');
  const rows = new Map<number, Cube[]>();
  const add = (row: number, x: number, y: number, w: number, h: number) => {
    const holes: Rect[] = [];
    const n = rng.chance(0.3) ? 0 : rng.chance(0.6) ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const hw = rng.range(1.4, 2.4);
      const hh = rng.chance(0.4) ? h * rng.range(0.4, 0.55) : rng.range(1.8, 2.8);
      holes.push({ x: x + rng.range(1.5, w * 0.6 - hw), y: y + h - hh - (hh > 4 ? 0 : rng.range(2, h - hh - 2)), w: hw, h: hh });
    }
    const list = rows.get(row) ?? [];
    list.push({ x, y, w, h, side: rng.range(0.28, 0.42), holes });
    rows.set(row, list);
  };
  for (const v of VILLAGE) {
    const row = Math.round(v.y / 6);
    add(row, v.x + rng.range(-1, 1), v.y, v.w * rng.range(0.8, 1), v.h);
    if (rng.chance(0.55)) {
      const w = v.w * rng.range(0.45, 0.65);
      add(row - 1, v.x + (rng.chance(0.5) ? 0 : v.w * 0.35), v.y - v.h * rng.range(0.45, 0.6), w, v.h * 0.6);
    }
    if (rng.chance(0.45)) {
      const w = rng.range(9, 14);
      add(row + 1, v.x + v.w * rng.range(0.6, 0.9), v.y + v.h * rng.range(0.3, 0.5), w, v.h * rng.range(0.6, 0.8));
    }
  }
  return [...rows.keys()].sort((a, b) => a - b).map((k) => rows.get(k)!);
})();

// ── walls ────────────────────────────────────────────────────────────────────────────────

/** A wall's coping line, left to right, every 6 units, run `ext` past its right end (under the margin). */
export function copingLine(w: Wall, ext = 20): Pt[] {
  const e = w.edge.map((q) => ({ x: q.x, y: q.y }));
  const y = e[e.length - 1]!;
  const z = e[e.length - 2]!;
  const post = { x: y.x + ext, y: y.y + ((y.y - z.y) / (y.x - z.x)) * ext };
  return resample(smoothPath([...e, post], 8), 6);
}

/** Each wall's coping (the perch line along its top), in `WALLS` order. */
export const WALL_TOPS: readonly Pt[][] = WALLS.map((w) => copingLine(w));

/** A wall's drop at x: full height, stepping down over its last 60 units at the seaward end into the slope. */
export function wallDrop(i: number, x: number): number {
  const w = WALLS[i]!;
  const u = Math.min(1, Math.max(0, (x - w.edge[0]!.x) / 60));
  return w.h * (0.3 + 0.7 * u * u * (3 - 2 * u));
}

/** Each wall's face, coping first then its foot right to left, for the painters and daylight. */
export const WALL_FACES: readonly Pt[][] = WALLS.map((_, i) => {
  const top = WALL_TOPS[i]!;
  return [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + wallDrop(i, q.x) }))];
});

/** The coping's height at x on wall `i`, run on flat past its ends. */
export function copingY(i: number, x: number): number {
  const w = WALLS[i]!;
  const e = w.edge;
  return copingAt(w, Math.min(e[e.length - 1]!.x, Math.max(e[0]!.x, x)))!;
}

// ── beds ─────────────────────────────────────────────────────────────────────────────────

/** A bed of darker tilled soil along a terrace's front, behind the coping of the wall that holds it. */
export interface Bed {
  terrace: Terrace;
  wall: number;
  poly: Pt[];
}

/** wall index, x from, x to, back and front (units behind the coping). */
const BED_SPECS: readonly [number, number, number, number, number][] = [
  [0, 940, 1066, 38, 3], [0, 1150, 1252, 34, 3], [0, 1340, 1500, 34, 3],
  [1, 820, 968, 48, 3], [1, 1040, 1180, 42, 3], [1, 1240, 1540, 44, 3],
  [2, 750, 888, 44, 3], [2, 958, 1040, 40, 3], [2, 1140, 1262, 42, 3], [2, 1490, 1610, 42, 3],
];

export const BEDS: readonly Bed[] = BED_SPECS.map(([wall, x0, x1, back, front]) => {
  const r = (back - front) / 2;
  const n = Math.max(4, Math.round((x1 - x0 - 2 * r) / 12));
  const far: Pt[] = [];
  const near: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + r + ((x1 - x0 - 2 * r) * i) / n;
    far.push({ x, y: copingY(wall, x) - back });
    near.push({ x, y: copingY(wall, x) - front });
  }
  // rounded ends, squashed by the low view
  const end = (cx: number, cy: number, from: number): Pt[] => Array.from({ length: 5 }, (_, k) => {
    const a = from + (Math.PI * (k + 1)) / 6;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  const y0 = copingY(wall, x0 + r) - front - r;
  const y1 = copingY(wall, x1 - r) - front - r;
  return { terrace: WALL_TERRACE[wall]!, wall, poly: [...far, ...end(x1 - r, y1, -Math.PI / 2), ...near.reverse(), ...end(x0 + r, y0, Math.PI / 2)] };
});

// ── stone flights and jars ───────────────────────────────────────────────────────────────

/** One step of a flight: its lit tread (seen from above) and its riser below. */
export interface Step {
  tread: Pt[];
  riser: Pt[];
}

/** Each flight in `STEPS` order, top step first: rough slabs widening downward, a little askew. */
export const FLIGHTS: readonly Step[][] = STEPS.map((s, f) =>
  Array.from({ length: s.n }, (_, k) => {
    const y = s.y + k * 15;
    const w = 24 + k * 3;
    const skew = ((f * 7 + k * 3) % 5) - 2;
    const x = s.x + skew;
    const tread = [{ x: x - w + 1, y: y + skew * 0.4 }, { x: x + w - 1, y: y - skew * 0.3 }, { x: x + w + 2, y: y + 5.5 }, { x: x - w - 2, y: y + 5.5 + skew * 0.2 }];
    const riser = [tread[3]!, tread[2]!, { x: x + w + 1, y: y + 15 }, { x: x - w - 1, y: y + 15 }];
    return { tread, riser };
  }),
);

/** Terracotta pithos jars beside the path: foot x, y, height and lean (rad). */
export const JARS: readonly { x: number; y: number; h: number; lean: number }[] = [
  { x: 1074, y: 914, h: 54, lean: -0.04 },
  { x: 1322, y: 790, h: 40, lean: 0.05 },
];

// ── the scenery olive ────────────────────────────────────────────────────────────────────

/**
 * The big olive on the top terrace: the `olive` species' tree planned from `seed` at growth 1,
 * drawn `scale` × its box units with its base on `OLIVE.base` (ADR 0367).
 */
export const OLIVE_TREE = { seed: 4, scale: 1.12, base: OLIVE.base } as const;

/**
 * Its trunk and scaffold limbs in world units (perches), from the plan: `veg.test.ts` checks
 * them against `planOlive(OLIVE_TREE.seed)`.
 */
export const OLIVE_LIMBS: readonly (readonly Pt[])[] = [
  [{ x: 1290, y: 540 }, { x: 1286, y: 511 }, { x: 1277, y: 482 }, { x: 1266, y: 458 }, { x: 1251, y: 432 }],
  [{ x: 1245, y: 448 }, { x: 1231, y: 422 }, { x: 1216, y: 395 }, { x: 1207, y: 370 }, { x: 1202, y: 340 }],
  [{ x: 1260, y: 448 }, { x: 1257, y: 404 }, { x: 1250, y: 361 }, { x: 1237, y: 320 }, { x: 1234, y: 276 }],
  [{ x: 1276, y: 448 }, { x: 1297, y: 422 }, { x: 1324, y: 402 }, { x: 1353, y: 385 }, { x: 1381, y: 369 }],
];

/** The olive's shadow on the gravel, cast right and a little toward the viewer (light from the left). */
export const OLIVE_SHADOW = { cx: OLIVE.base.x + 70, cy: OLIVE.base.y + 8, rx: 170, ry: 18 } as const;

// ── the leaning pine ─────────────────────────────────────────────────────────────────────

/** The Aleppo pine on its rock at the beach's west end: a crooked trunk leaning out over the sea. */
export const PINE_TRUNK: readonly Pt[] = [
  PINE.base, { x: 46, y: 700 }, { x: 72, y: 610 }, { x: 98, y: 520 }, { x: 108, y: 440 }, { x: 120, y: 360 }, { x: 126, y: 300 }, PINE.top,
];
/** Its branches (perches), each from the trunk out to a needle pad. */
export const PINE_BRANCHES: readonly (readonly Pt[])[] = [
  [{ x: 118, y: 372 }, { x: 80, y: 320 }, { x: 40, y: 290 }, { x: 8, y: 272 }],
  [{ x: 124, y: 316 }, { x: 160, y: 290 }, { x: 204, y: 258 }, { x: 246, y: 236 }],
  [{ x: 127, y: 296 }, { x: 108, y: 262 }, { x: 88, y: 230 }],
  [{ x: 128, y: 270 }, { x: 150, y: 226 }, { x: 166, y: 192 }],
  [{ x: 110, y: 450 }, { x: 140, y: 432 }, { x: 166, y: 424 }],
];
/** Its needle pads: open, flat-bottomed clouds at the branch tips. */
export const PINE_PADS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 22, y: 270, rx: 52, ry: 17 }, { x: 236, y: 232, rx: 56, ry: 17 }, { x: 96, y: 222, rx: 46, ry: 16 },
  { x: 164, y: 186, rx: 48, ry: 17 }, { x: 150, y: 262, rx: 34, ry: 12 }, { x: 64, y: 300, rx: 30, ry: 10 }, { x: 170, y: 420, rx: 22, ry: 8 },
];
/** The rock it grows from. */
export const PINE_ROCK = { x: 34, y: 790, w: 130, h: 54 } as const;

// ── the promontory's back ────────────────────────────────────────────────────────────────

/** The promontory's top edge at x (its highest crossing), or null beyond it. */
export function promontoryTop(x: number): number | null {
  let best: number | null = null;
  const poly = PROMONTORY;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y < best) best = y;
  }
  return best;
}

/** The promontory's pines: their trunk (foot to crown) and crown, each leaning a little. */
export const PROMONTORY_PINE_SHAPES = PROMONTORY_PINES.map((t, i) => {
  const lean = ((i * 5) % 3) - 1;
  return { ...t, trunk: [{ x: t.x - 3 + lean * 4, y: t.y + t.ry * 2.6 }, { x: t.x + lean * 2, y: t.y + t.ry * 0.4 }] as Pt[] };
});

/** Dark maquis (lentisk, kermes oak, myrtle) along the promontory's back: centre and radius. */
export const MAQUIS: readonly { x: number; y: number; r: number }[] = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  let k = 0;
  for (let x = 884; x < 1640; x += 30 + ((k * 37) % 23)) {
    const top = promontoryTop(Math.min(1619, x)) ?? 300;
    const r = 13 + ((k * 13) % 11);
    out.push({ x, y: top + r * 0.55 + ((k * 7) % 9), r });
    // a second, lower row where the slope is broad
    if (x > 960 && k % 2 === 0) out.push({ x: x + 14, y: top + 30 + ((k * 11) % 16), r: r * 0.8 });
    k++;
  }
  return out;
})();

// ── phrygana, dry grass and the shoreline scrub ──────────────────────────────────────────

/** Phrygana cushions (thorny burnet, thyme, spurge): low grey-green domes; centre x, foot y, radius. */
export const PHRYGANA: readonly { x: number; y: number; r: number; rust: boolean }[] = [
  { x: 902, y: 520, r: 18, rust: false }, { x: 1500, y: 512, r: 15, rust: true },
  { x: 822, y: 604, r: 14, rust: true }, { x: 1590, y: 650, r: 16, rust: false },
  { x: 1060, y: 760, r: 12, rust: true },
  { x: 726, y: 800, r: 13, rust: false },
  { x: 664, y: 940, r: 22, rust: false }, { x: 1250, y: 1004, r: 26, rust: true }, { x: 1468, y: 980, r: 28, rust: false }, { x: 1610, y: 920, r: 22, rust: true },
];

/** Dry golden grass: base x, y and height. */
export const GRASS: readonly (readonly [number, number, number])[] = [
  [930, 512, 22], [1478, 508, 20],
  [842, 616, 18], [1560, 612, 18], [1240, 610, 16],
  [790, 742, 20], [1200, 752, 18], [1610, 746, 22],
  [748, 866, 22], [1450, 880, 24], [1590, 884, 22],
  [720, 940, 30], [1100, 1006, 40], [1390, 1010, 44], [1530, 1004, 40], [1604, 994, 46], [970, 1010, 34],
];

/** Dry grass on the walls' faces, away from the wall-top and crack slots: wall index, x, depth below the coping. */
export const WALL_GRASS: readonly (readonly [number, number, number])[] = [
  [0, 960, 30], [0, 1200, 34], [0, 1560, 26], [1, 860, 36], [1, 1240, 30], [1, 1520, 38], [2, 800, 40], [2, 1290, 36], [2, 1540, 30],
];

/** Scrub clumps softening the shoreline's edge (not on the slots): centre, radii. */
export const SHORE_CLUMPS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 884, y: 536, rx: 30, ry: 14 }, { x: 834, y: 568, rx: 22, ry: 10 }, { x: 806, y: 664, rx: 30, ry: 13 },
  { x: 742, y: 786, rx: 30, ry: 13 },
];
