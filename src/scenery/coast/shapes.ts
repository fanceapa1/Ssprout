/**
 * The coast's shapes, data only so eager code can read them (devlog 149). The rock's (G2): the
 * splash rocks with their dry tops, the shoreline's blocks and the village's houses. The land's
 * and vegetation's (G4): the walls' faces and copings, the beds, the flights, the jars, the
 * scenery olive, the leaning pine, the promontory's pines and maquis, phrygana, grass and scrub.
 * Fixed seeds, so only the brushwork follows the art seed.
 */
import { createRng, type Rng } from '../../core/rng';
import { pointInPolygon, resample, smoothPath } from '../../paint/geometry';
import type { Pt, Rect } from '../../render/viewport';
import {
  copingAt, LAND, OLIVE, PINE, PROMONTORY, PROMONTORY_PINES, SHORE_BOULDERS, SPLASH_ROCKS, STEPS, VILLAGE, WALLS, WALL_TERRACE, type Terrace, type Wall,
} from './layout';
import { COAST_SLOTS } from './slots';

/** One column of a boulder's profile: its silhouette's top, the dry top's front edge, its foot. */
export interface RockColumn {
  x: number;
  top: number;
  front: number;
  base: number;
}

export interface RockShape {
  /** base centre on the water or the ground */
  x: number;
  y: number;
  w: number;
  /** the whole silhouette above the water */
  outline: Pt[];
  /** the broad dry top, seen a little from above: where a plant or a heron stands */
  top: Pt[];
  /** the top's front edge at the rock's centre */
  topY: number;
  /** the profile left to right, every 2 units */
  columns: RockColumn[];
  /** standing on the land (a cast shadow) rather than in the water (a wet foot, foam, a reflection) */
  ground?: boolean;
}

/**
 * A sea-worn limestone boulder seen a little from above: a squarish dome (rounded shoulders, a
 * broad flattish crown) whose crown is the dry top, foreshortened behind its front edge. `lean`
 * shifts the crown sideways. One shoulder is cut by a flat facet and the crown breaks in a small
 * step, so no two read as the same loaf.
 */
export function boulderShape(x: number, y: number, w: number, front: number, rng: Rng, lean = 0): RockShape {
  const hw = w / 2 + 3;
  const pd = Math.max(5, w * 0.2);
  const base0 = y + 3;
  const H = base0 - front + pd;
  const n = rng.range(2.2, 3.4);
  const ph = rng.range(0, 6);
  const amp = rng.range(0.6, 1.4);
  const side = rng.chance(0.5) ? 1 : -1;
  const chip = { from: rng.range(0.5, 0.7), depth: H * rng.range(0.12, 0.28) };
  const brk = { at: (rng.chance(0.5) ? 1 : -1) * rng.range(0.4, 0.6), d: rng.range(-1.6, 1.6) };
  const columns: RockColumn[] = [];
  const steps = Math.max(8, Math.round((hw * 2) / 2));
  for (let i = 0; i <= steps; i++) {
    const u = -1 + (2 * i) / steps;
    // the crown leans: its highest point moves off the centre, the far shoulder drops a little
    const v = Math.max(-1, Math.min(1, u - lean * (1 - u * u) * 0.35));
    const dome = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), n)), 1 / n);
    const wob = Math.sin(u * 4.1 + ph) * amp * dome;
    const base = base0 + 1.6 * (1 - u * u);
    const cut = u * side > chip.from ? ((u * side - chip.from) / (1 - chip.from)) * chip.depth : 0;
    const step = (u > brk.at ? brk.d : 0) * dome * Math.min(1, Math.abs(u - brk.at) * 8);
    const top = Math.min(base - 1, base0 - H * dome + wob + Math.min(cut, H * dome * 0.6) + step);
    const lens = pd * Math.pow(Math.max(0, 1 - u * u), 0.7);
    columns.push({ x: x + u * hw, top, front: Math.min(base - 1, top + lens), base });
  }
  const outline: Pt[] = [...columns.map((c) => ({ x: c.x, y: c.top })), ...columns.slice().reverse().map((c) => ({ x: c.x, y: c.base }))];
  const top: Pt[] = [...columns.map((c) => ({ x: c.x, y: c.top })), ...columns.slice().reverse().map((c) => ({ x: c.x, y: c.front }))];
  const mid = columns[Math.round(steps / 2)]!;
  return { x, y, w, outline, top, topY: mid.front, columns };
}

const slotOver = (x: number): number | null => COAST_SLOTS.find((s) => s.habitat === 'rock' && Math.abs(s.x - x) < 4)?.y ?? null;

/** The splash rocks: sea-worn boulders, the slot on the broad dry top. */
export const SPLASH_ROCK_SHAPES: readonly RockShape[] = SPLASH_ROCKS.map((r, i) => {
  const rng = createRng(`coast-splash-${i}`);
  const front = (slotOver(r.x) ?? r.y - r.w * 0.2) + 2;
  return boulderShape(r.x, r.y, r.w, front, rng, rng.range(-0.4, 0.4));
});

/** The beach flight's box: no boulder or stone of the shore's rock lies on it. */
export const BEACH_FLIGHT_BOX = { x: 668, y: 786, w: 70, h: 62 } as const;
const onFlight = (x: number, y: number, r: number): boolean =>
  x + r > BEACH_FLIGHT_BOX.x && x - r < BEACH_FLIGHT_BOX.x + BEACH_FLIGHT_BOX.w && y + r > BEACH_FLIGHT_BOX.y && y - r * 0.6 < BEACH_FLIGHT_BOX.y + BEACH_FLIGHT_BOX.h;

/**
 * Boulders fallen from the shoreline's ledge: the layout's dropped into the water at the ledge's
 * foot (or left on the ledge where the foot is land), and smaller ones out in the water.
 */
export const SHORE_BOULDER_SHAPES: readonly RockShape[] = [
  ...SHORE_BOULDERS.map((b) => (pointInPolygon({ x: b.x, y: b.y + 14 }, LAND) ? { ...b, ground: true } : { ...b, y: b.y + 14, ground: false })),
  ...[{ x: 784, y: 618, w: 16 }, { x: 670, y: 736, w: 20 }, { x: 728, y: 776, w: 14 }, { x: 812, y: 660, w: 12 },
    { x: 864, y: 528, w: 12 }, { x: 838, y: 553, w: 16 }, { x: 801, y: 585, w: 10 }, { x: 762, y: 688, w: 16 }, { x: 720, y: 710, w: 12 }].map((b) => ({ ...b, ground: false })),
]
  .filter((b) => !onFlight(b.x, b.y, b.w / 2))
  .map((b, i) => {
    const rng = createRng(`coast-boulder-${i}`);
    return { ...boulderShape(b.x, b.y, b.w, b.y - b.w * rng.range(0.2, 0.3), rng, rng.range(-0.6, 0.6)), ground: b.ground };
  });

/** Stones fallen from the cliff onto the top terrace: base x, y and width. */
export const CLIFF_STONES: readonly RockShape[] = [
  [946, 508, 14], [1012, 511, 9], [1088, 512, 18], [1176, 508, 11], [1352, 506, 16], [1418, 509, 8], [1530, 505, 13],
].map(([x, y, w], i) => {
  const rng = createRng(`coast-cliff-stone-${i}`);
  return { ...boulderShape(x!, y!, w!, y! - w! * 0.12, rng, rng.range(-0.5, 0.5)), ground: true };
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

export const BEDS: readonly Bed[] = BED_SPECS.map(([wall, x0, x1, back, front], b) => {
  // each bed dug by hand: its back edge wanders, its ends are rounded unevenly
  const rng = createRng(`coast-bed-${b}`);
  const amp = rng.range(1.2, 3.2);
  const period = rng.range(28, 52);
  const phase = rng.range(0, 6);
  const swell = rng.range(-2.5, 2.5);
  const r = (back - front) / 2;
  const n = Math.max(4, Math.round((x1 - x0 - 2 * r) / 12));
  const far: Pt[] = [];
  const near: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = x0 + r + (x1 - x0 - 2 * r) * u;
    const k = Math.sin(Math.PI * u);
    far.push({ x, y: copingY(wall, x) - back + (amp * Math.sin(x / period + phase) + swell) * Math.sqrt(k) });
    near.push({ x, y: copingY(wall, x) - front });
  }
  // rounded ends, squashed by the low view, one fuller than the other
  const end = (cx: number, cy: number, from: number, k: number): Pt[] => Array.from({ length: 5 }, (_, j) => {
    const a = from + (Math.PI * (j + 1)) / 6;
    return { x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r };
  });
  const y0 = copingY(wall, x0 + r) - front - r;
  const y1 = copingY(wall, x1 - r) - front - r;
  const poly = [...far, ...end(x1 - r, y1, -Math.PI / 2, rng.range(0.7, 1.25)), ...near.reverse(), ...end(x0 + r, y0, Math.PI / 2, rng.range(0.7, 1.25))];
  return { terrace: WALL_TERRACE[wall]!, wall, poly };
});

// ── stone flights and jars ───────────────────────────────────────────────────────────────

/** One step of a flight: its lit tread (seen from above) and its riser below. */
export interface Step {
  tread: Pt[];
  riser: Pt[];
}

/** The flight down to the beach (`STEPS[3]`): it runs down to the left along the shoreline. */
export const BEACH_FLIGHT = 3;

/** Each flight in `STEPS` order, top step first: rough slabs widening downward, a little askew. */
export const FLIGHTS: readonly Step[][] = STEPS.map((s, f) =>
  Array.from({ length: s.n }, (_, k) => {
    if (f === BEACH_FLIGHT) {
      // narrow slabs stepping down and to the left, from the lower terrace onto the beach's tip
      const x = s.x + 58 - k * 15;
      const y = s.y - 1 + k * 13;
      const w = 13 + k;
      const tread = [{ x: x - w + 1, y: y + k * 0.4 }, { x: x + w - 1, y: y - 0.5 }, { x: x + w + 1, y: y + 5 }, { x: x - w - 1, y: y + 5.4 }];
      const riser = [tread[3]!, tread[2]!, { x: x + w + 0.5, y: y + 13 }, { x: x - w - 0.5, y: y + 13 }];
      return { tread, riser };
    }
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

/**
 * The Aleppo pine at the beach's west end: the `aleppo-pine` species' tree planned from `seed`
 * leaning `lean`, bare below its fork, drawn `scale` × its box units with its foot on `PINE.base`
 * (ADR 0380). The literals below come from that plan; `veg.test.ts` checks them.
 */
export const PINE_TREE = { seed: 101, scale: 1.9, marks: 1.3, lean: -1, base: PINE.base } as const;
/** Its trunk, foot to top (the cicada's bark). */
export const PINE_TRUNK: readonly Pt[] = [
  PINE.base, { x: 152, y: 684 }, { x: 133, y: 607 }, { x: 116, y: 529 }, { x: 101, y: 451 }, { x: 87, y: 373 }, { x: 72, y: 295 }, PINE.top,
];
/** Its limbs and big branches (perches). */
export const PINE_BRANCHES: readonly (readonly Pt[])[] = [
  [{ x: 90, y: 392 }, { x: 65, y: 357 }, { x: 28, y: 334 }, { x: 0, y: 303 }, { x: -28, y: 269 }],
  [{ x: 87, y: 374 }, { x: 82, y: 338 }, { x: 79, y: 302 }, { x: 72, y: 267 }, { x: 70, y: 230 }],
  [{ x: 82, y: 344 }, { x: 94, y: 315 }, { x: 103, y: 288 }, { x: 109, y: 257 }, { x: 115, y: 229 }],
  [{ x: 42, y: 344 }, { x: 34, y: 329 }, { x: 19, y: 317 }, { x: 3, y: 309 }, { x: -12, y: 301 }],
  [{ x: 25, y: 331 }, { x: 10, y: 336 }, { x: -7, y: 335 }, { x: -23, y: 338 }, { x: -40, y: 339 }],
  [{ x: -4, y: 298 }, { x: -15, y: 283 }, { x: -26, y: 270 }, { x: -36, y: 255 }, { x: -45, y: 241 }],
  [{ x: 63, y: 259 }, { x: 95, y: 225 }, { x: 110, y: 178 }, { x: 133, y: 136 }, { x: 155, y: 95 }],
  [{ x: 57, y: 239 }, { x: 23, y: 220 }, { x: -7, y: 190 }, { x: -29, y: 157 }, { x: -58, y: 128 }],
  [{ x: 125, y: 150 }, { x: 140, y: 151 }, { x: 155, y: 152 }, { x: 171, y: 153 }, { x: 185, y: 156 }],
  [{ x: 138, y: 126 }, { x: 142, y: 111 }, { x: 148, y: 96 }, { x: 155, y: 83 }, { x: 162, y: 70 }],
];
/** Its crown's needle clouds that reach into the frame. */
export const PINE_PADS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: -55, y: 222, rx: 67, ry: 40 }, { x: 167, y: 244, rx: 56, ry: 38 }, { x: 83, y: 221, rx: 66, ry: 50 },
  { x: 3, y: 202, rx: 61, ry: 41 }, { x: 46, y: 165, rx: 36, ry: 21 }, { x: -34, y: 331, rx: 61, ry: 37 },
  { x: 155, y: 49, rx: 67, ry: 47 }, { x: 139, y: 69, rx: 47, ry: 23 }, { x: 22, y: 278, rx: 63, ry: 39 },
  { x: 68, y: 281, rx: 35, ry: 41 }, { x: 177, y: 139, rx: 60, ry: 43 },
];
/** The low rock its foot grips (centre x, foot y, width, height). */
export const PINE_ROCK = { x: 160, y: 778, w: 84, h: 26 } as const;

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

/** A far pine: its crown's centre and half extents, its trunk (foot to top), limbs and needle clouds. */
export interface FarPine {
  x: number;
  y: number;
  rx: number;
  ry: number;
  trunk: Pt[];
  limbs: Pt[][];
  clouds: { x: number; y: number; rx: number; ry: number }[];
}

/**
 * The promontory's far Aleppo pines, a few strokes each: a slender leaning stem forking into two
 * to four limbs, each ending in a small flat cloud, with sky between. The painter draws these.
 */
export const PROMONTORY_PINE_SHAPES: readonly FarPine[] = PROMONTORY_PINES.map(({ x, h, lean }, i) => {
  const rng = createRng(`coast-far-pine-${i}`);
  const foot = { x, y: (promontoryTop(x) ?? 300) + rng.range(7, 13) };
  const at = (f: number, a: number, from: Pt) => ({ x: from.x + Math.sin(a) * h * f, y: from.y - Math.cos(a) * h * f });
  const fork = at(rng.range(0.55, 0.7), lean, foot);
  const top = at(0.3, lean * 1.3, fork);
  const n = rng.int(2, 4);
  const limbs = Array.from({ length: n }, (_, k) => {
    const a = lean + (k / (n - 1) - 0.5) * rng.range(1.6, 2.2) + rng.range(-0.15, 0.15);
    const from = k === 0 ? fork : at(rng.range(0, 0.25), lean, fork);
    return [from, at(rng.range(0.28, 0.42), a, from)];
  });
  const clouds = [...limbs.map((l) => l[1]!), top].map((q, k) => {
    const rx = h * rng.range(0.17, 0.26) * (k === limbs.length ? 1.15 : 1);
    return { x: q.x, y: q.y - rx * 0.15, rx, ry: rx * rng.range(0.42, 0.58) };
  });
  const x0 = Math.min(...clouds.map((c) => c.x - c.rx));
  const x1 = Math.max(...clouds.map((c) => c.x + c.rx));
  const y0 = Math.min(...clouds.map((c) => c.y - c.ry));
  const y1 = Math.max(...clouds.map((c) => c.y + c.ry));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, trunk: [foot, fork, top], limbs, clouds };
});

/** The tree slot on the promontory's cliff top (`scrub-1`): a pocket of soil under it, no maquis on its foot. */
export const CLIFF_TOP_SLOT = COAST_SLOTS.find((s) => s.id === 'scrub-1')!;

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
  // none on the cliff-top tree slot's foot: a pocket of soil is painted there instead
  return out.filter((m) => Math.abs(m.x - CLIFF_TOP_SLOT.x) > m.r + 14 || Math.abs(m.y - CLIFF_TOP_SLOT.y) > m.r + 10);
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

/** Scrub clumps in pockets of soil behind the shoreline's ledge (not on it, not on the slots): centre, radii. */
export const SHORE_CLUMPS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 866, y: 560, rx: 18, ry: 9 }, { x: 760, y: 742, rx: 12, ry: 6 },
];
