/**
 * The Greek coast's composition (G1, ADR 0360): draft B's shapes moved onto the final layout. The
 * far hill and village, the sea, the temple promontory, the broken shoreline, the three terraces
 * and their walls, the path, the beach and the rock shelf; the skyline traced from the painted
 * silhouette, the terraces' lifts, the sky layout, the view and the ambience.
 * docs/systems/scenery.md › Coast.
 */
import type { SkyLayout } from '../../ambience/sky-layout';
import type { Habitat } from '../../plants/types';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import type { SceneryAmbience } from '../types';

/** The sea's horizon: the far hill and the promontory stand on it. */
export const HORIZON = 400;

/** The far hill across the bay, upper left, down to the sea right of the village. */
export const FAR_HILL: readonly Pt[] = [
  { x: -20, y: 338 }, { x: 60, y: 320 }, { x: 150, y: 306 }, { x: 240, y: 300 }, { x: 320, y: 308 },
  { x: 390, y: 332 }, { x: 446, y: 362 }, { x: 490, y: 388 }, { x: 516, y: HORIZON },
  { x: -20, y: HORIZON },
];
/** Whitewashed houses on the hill's seaward slope: top-left corner, width, height. */
export const VILLAGE: readonly Rect[] = [
  { x: 120, y: 338, w: 24, h: 15 }, { x: 152, y: 330, w: 20, h: 14 }, { x: 180, y: 322, w: 24, h: 15 },
  { x: 268, y: 330, w: 18, h: 13 }, { x: 166, y: 360, w: 26, h: 15 }, { x: 204, y: 350, w: 22, h: 14 },
  { x: 238, y: 344, w: 24, h: 14 }, { x: 296, y: 342, w: 20, h: 13 }, { x: 322, y: 360, w: 24, h: 14 },
  { x: 100, y: 372, w: 22, h: 14 }, { x: 262, y: 376, w: 28, h: 14 }, { x: 352, y: 380, w: 22, h: 12 },
];
/** The blue-domed chapel on the crest: the foot of its dome. */
export const CHAPEL: Pt = { x: 232, y: 300 };

/** The near limestone promontory: its point on the left, rising to the right edge; its foot is the top terrace's back. */
export const PROMONTORY: readonly Pt[] = [
  { x: 636, y: 414 }, { x: 652, y: 400 }, { x: 680, y: 393 }, { x: 830, y: 393 }, { x: 870, y: 378 },
  { x: 930, y: 352 }, { x: 1010, y: 330 }, { x: 1110, y: 314 }, { x: 1250, y: 302 }, { x: 1400, y: 294 },
  { x: 1620, y: 298 }, { x: 1620, y: 500 }, { x: 1300, y: 502 }, { x: 1040, y: 504 }, { x: 900, y: 498 },
  { x: 800, y: 478 }, { x: 716, y: 450 }, { x: 664, y: 428 },
];
/** The temple's stylobate on the point, and its columns (x, height; the short ones broken). */
export const STYLOBATE = { x0: 680, x1: 830, y: 393 } as const;
export const COLUMN_W = 16;
export const COLUMNS: readonly { x: number; h: number }[] = [
  { x: 700, h: 92 }, { x: 738, h: 96 }, { x: 776, h: 58 }, { x: 810, h: 72 },
];
/** The architrave's fragment over the two tall columns, and the fallen drum. */
export const ARCHITRAVE = { x0: 688, x1: 752, h: 12 } as const;
export const DRUM: Pt = { x: 856, y: 388 };
/** Pine crowns along the promontory's back. */
export const PROMONTORY_PINES: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 960, y: 330, rx: 34, ry: 14 }, { x: 1060, y: 300, rx: 48, ry: 17 }, { x: 1180, y: 284, rx: 58, ry: 19 },
  { x: 1310, y: 272, rx: 54, ry: 18 }, { x: 1450, y: 268, rx: 62, ry: 20 }, { x: 1570, y: 272, rx: 50, ry: 18 },
];

/** The moored caique, its hull's waterline centre. */
export const CAIQUE: Pt = { x: 430, y: 500 };

/**
 * The shoreline, top to bottom (ADR 0360): not one diagonal but a broken edge. The top terrace
 * ends in a rock shelf, the sea cuts in under it, the middle terrace ends in a rock bastion with a
 * second small cove below, the lower terrace ends in scrub, and stone steps come down to the beach.
 */
export const SHORE_EDGE: readonly Pt[] = [
  { x: 900, y: 498 }, { x: 878, y: 522 }, { x: 852, y: 548 }, { x: 826, y: 572 }, { x: 792, y: 598 },
  { x: 818, y: 614 }, { x: 846, y: 630 }, { x: 828, y: 654 }, { x: 790, y: 676 }, { x: 750, y: 700 },
  { x: 690, y: 726 }, { x: 712, y: 746 }, { x: 754, y: 764 }, { x: 734, y: 786 }, { x: 704, y: 800 },
  { x: 684, y: 812 }, { x: 676, y: 846 },
];

/** The beach's waterline, left to right, ending at the foot of the steps (a point of the shoreline). */
export const WATERLINE_EDGE: readonly Pt[] = [
  { x: -20, y: 756 }, { x: 120, y: 742 }, { x: 300, y: 748 }, { x: 450, y: 762 }, { x: 560, y: 780 }, { x: 640, y: 800 }, { x: 684, y: 812 },
];
/** The pebble beach: the waterline, then its back where the rock shelf begins. */
export const BEACH: readonly Pt[] = [
  ...WATERLINE_EDGE, { x: 676, y: 846 }, { x: 600, y: 852 }, { x: 420, y: 846 }, { x: 200, y: 840 }, { x: -20, y: 848 },
];
/** The rock shelf below the beach with its pools, out to the bottom-left corner (the paper's margin fades its lower part). */
export const SHELF: readonly Pt[] = [
  { x: -20, y: 848 }, { x: 200, y: 840 }, { x: 420, y: 846 }, { x: 600, y: 852 }, { x: 676, y: 846 }, { x: 650, y: 1020 }, { x: -20, y: 1020 },
];
export const POOLS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 230, cy: 892, rx: 58, ry: 17 }, { cx: 400, cy: 902, rx: 62, ry: 18 }, { cx: 566, cy: 886, rx: 38, ry: 12 },
];
/** Rocks in the shallows the spray reaches: base centre x, y and width. */
export const SPLASH_ROCKS: readonly { x: number; y: number; w: number }[] = [
  { x: 190, y: 712, w: 46 }, { x: 384, y: 724, w: 62 }, { x: 590, y: 670, w: 74 }, { x: 630, y: 772, w: 52 },
];
/** Boulders and scrub that break the shoreline (painted over its edge). */
export const SHORE_BOULDERS: readonly { x: number; y: number; w: number }[] = [
  { x: 812, y: 606, w: 56 }, { x: 842, y: 640, w: 40 }, { x: 706, y: 738, w: 64 }, { x: 760, y: 770, w: 38 },
  { x: 694, y: 818, w: 40 },
];
export const SHORE_SCRUB: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 878, y: 540, rx: 36, ry: 16 }, { x: 812, y: 680, rx: 40, ry: 16 }, { x: 742, y: 800, rx: 40, ry: 18 },
  { x: 704, y: 836, rx: 26, ry: 12 },
];

/** The dry-stone walls: top edge (left to right) and face height; each holds the terrace above it. */
export interface Wall {
  edge: readonly Pt[];
  h: number;
}
export const WALLS: readonly Wall[] = [
  { edge: [{ x: 856, y: 578 }, { x: 1100, y: 572 }, { x: 1350, y: 566 }, { x: 1620, y: 560 }], h: 40 },
  { edge: [{ x: 772, y: 716 }, { x: 1000, y: 708 }, { x: 1300, y: 700 }, { x: 1620, y: 694 }], h: 44 },
  { edge: [{ x: 690, y: 855 }, { x: 900, y: 848 }, { x: 1250, y: 840 }, { x: 1620, y: 834 }], h: 48 },
];

/** All the land: the promontory's foot, the broken shoreline, the steps' foot, the bottom edge. */
export const LAND: readonly Pt[] = [
  { x: 1620, y: 496 }, { x: 1300, y: 498 }, { x: 1040, y: 500 }, ...SHORE_EDGE, { x: 650, y: 1020 }, { x: 1620, y: 1020 },
];

/** The big gnarled olive on the top terrace, right of the path. */
export const OLIVE = { base: { x: 1290, y: 540 }, crown: { x: 1290, y: 330 }, rx: 210, ry: 120 } as const;
/** The leaning pine framing the left edge, on its rock at the beach's end. */
export const PINE = { base: { x: 30, y: 770 }, top: { x: 130, y: 250 } } as const;

/** The gravel path from the viewer's feet up the terraces to the olive, nearest first, and where it climbs a wall. */
export const PATH: readonly Pt[] = [
  { x: 900, y: 1000 }, { x: 906, y: 930 }, { x: 920, y: 870 }, { x: 944, y: 800 }, { x: 972, y: 740 },
  { x: 1008, y: 680 }, { x: 1050, y: 620 }, { x: 1090, y: 570 }, { x: 1130, y: 522 },
];
/** Stone flights: up each wall on the path, and down from the lower terrace to the beach. */
export const STEPS: readonly { x: number; y: number; n: number }[] = [
  { x: 924, y: 852, n: 3 }, { x: 990, y: 712, n: 3 }, { x: 1094, y: 574, n: 3 }, { x: 664, y: 798, n: 3 },
];

/** The top of a closed shape at x (its highest crossing), or null where it does not reach. */
function topAt(poly: readonly Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x)) continue;
    const y = a.x === b.x ? Math.min(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y < best) best = y;
  }
  return best;
}

/** Each column's outline (a broken one cut on a slant), with the architrave's fragment. */
export const TEMPLE_SHAPES: readonly (readonly Pt[])[] = [
  ...COLUMNS.map(({ x, h }) => {
    const top = STYLOBATE.y - h;
    return [{ x: x - COLUMN_W / 2, y: top }, { x: x + COLUMN_W / 2, y: top + (h < 80 ? 6 : 0) }, { x: x + COLUMN_W / 2, y: STYLOBATE.y }, { x: x - COLUMN_W / 2, y: STYLOBATE.y }];
  }),
  (() => {
    const top = STYLOBATE.y - Math.max(COLUMNS[0]!.h, COLUMNS[1]!.h) - ARCHITRAVE.h;
    return [{ x: ARCHITRAVE.x0, y: top }, { x: ARCHITRAVE.x1, y: top }, { x: ARCHITRAVE.x1 - 2, y: top + ARCHITRAVE.h }, { x: ARCHITRAVE.x0 + 2, y: top + ARCHITRAVE.h }];
  })(),
];

/**
 * The highest painted edge at x behind the garden: the far hill, the sea's horizon, the promontory
 * and its temple. Its pines are left out: the sky multiplies over their crowns (as over the oasis's palms).
 */
export function silhouetteAt(x: number): number {
  let y = HORIZON;
  for (const poly of [FAR_HILL, PROMONTORY, ...TEMPLE_SHAPES]) {
    const t = topAt(poly, x);
    if (t !== null && t < y) y = t;
  }
  // past the world's edges the hill and the promontory run on
  if (x < FAR_HILL[0]!.x) y = Math.min(y, FAR_HILL[0]!.y);
  if (x > WORLD_W + 20) y = Math.min(y, 298);
  return y;
}

/**
 * The open sky's lower edge, left → right, sampled from the painted silhouette. Each sample takes
 * the lowest edge within a step either side, so the sky runs between the columns rather than
 * leaving paper. The olive, the leaning pine and the promontory's pines cross it, as the oasis's palms do.
 */
export const SKYLINE: readonly Pt[] = (() => {
  const step = 2;
  const out: Pt[] = [];
  for (let x = -80; x <= 1680; x += step) {
    let y = -Infinity;
    for (const dx of [-step, -step / 2, 0, step / 2, step]) y = Math.max(y, silhouetteAt(x + dx));
    out.push({ x, y: y + 1 });
  }
  return out.filter((q, i) => i === 0 || i === out.length - 1 || q.y !== out[i - 1]!.y || q.y !== out[i + 1]!.y);
})();

/** The skyline's height at x (linear between its points). */
export function skylineAt(x: number): number {
  const s = SKYLINE;
  if (x <= s[0]!.x) return s[0]!.y;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    if (b.x >= x) return b.x === a.x ? Math.max(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return s[s.length - 1]!.y;
}

/** Top of the sky plates' band (as the other sceneries': paper above the world for tall phones). */
export const SKY_TOP = -240;

/** The open sky above the skyline, with `below` units hanging under it. */
export function openSky(below = 0): Pt[] {
  const line = SKYLINE.map((q) => ({ x: q.x, y: q.y + below }));
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/** The world band the coast's sky plates cover: down past the horizon. */
export const COAST_SKY_RECT: Rect = { x: 0, y: SKY_TOP, w: WORLD_W, h: 700 };

/**
 * How high each terrace stands above the foreground's ground: the drops of the walls in front of
 * it (ADR 0300, as the oasis). Raised ground takes `perspectiveScale(y + lift)`.
 */
export const LIFT = {
  /** the lower terrace, and the coping and face of the wall that holds it */
  lower: WALLS[2]!.h,
  /** the middle terrace, and its wall */
  middle: WALLS[2]!.h + WALLS[1]!.h,
  /** the top terrace with the olive, its wall, and the scrub at the promontory's foot */
  top: WALLS[2]!.h + WALLS[1]!.h + WALLS[0]!.h,
} as const;
export type Terrace = keyof typeof LIFT;
/** The terrace each wall holds, in `WALLS` order. */
export const WALL_TERRACE: readonly Terrace[] = ['top', 'middle', 'lower'];

/** The scale of what stands at world y on a terrace (or on the foreground, the beach and the sea edge without one). */
export function terraceScale(y: number, terrace?: Terrace): number {
  return perspectiveScale(y + (terrace ? LIFT[terrace] : 0));
}

/** A wall's coping height at x (linear along its edge), or null beyond its ends. */
export function copingAt(wall: Wall, x: number): number | null {
  const e = wall.edge;
  if (x < e[0]!.x || x > e[e.length - 1]!.x) return null;
  for (let i = 1; i < e.length; i++) {
    const a = e[i - 1]!;
    const b = e[i]!;
    if (b.x >= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return null;
}

/**
 * Where the light comes from (ADR 0360): the sea and the open sky are on the left, so both low
 * suns stand over the sea's horizon between the far hill and the temple's point; the moon arcs
 * over the bay, left of the temple.
 */
export const COAST_SKY_LAYOUT: SkyLayout = {
  horizonY: HORIZON,
  sunriseX: 636,
  sunsetX: 552,
  moonArc: [
    { x: 450, y: 266 },
    { x: 610, y: 196 },
    { x: 760, y: 252 },
  ],
  // high over the whole sky; none round the moon's arc
  stars: { top: 20, depth: 130, gap: { x: 610, halfW: 220, y0: 150, y1: 420 } },
  sunSide: { sunrise: -1, sunset: -1 },
};

/**
 * Where the eye rests: the sea edge under the temple. The portrait crop (600 wide) round it holds
 * the temple, the open sea, the shallows, splash rocks, beach and a pool, and the terraces' left
 * ends; on a 16:9 screen (y 100–1000) it keeps 190 units of sky over the temple.
 */
export const FOCUS: Pt = { x: 760, y: 600 };

export const COAST_AMBIENCE: SceneryAmbience = {
  // the beach and the foreground either side of the path
  dew: [
    { x: 120, y: 770, w: 420, h: 60 },
    { x: 700, y: 910, w: 600, h: 80 },
  ],
  mistBands: [0, 1, 2],
  // the sea's near shallows; the veil stops above the beach
  veilTo: 780,
};

/** How the planting sheet names each habitat here (`COAST.habitatWords`, docs/research/coast-biome.md §5). */
export const COAST_HABITAT_WORDS: Readonly<Record<Habitat, string>> = {
  water: 'in the shallows',
  shore: 'on the beach',
  meadow: 'in the terrace beds',
  path: 'along the path',
  back: 'in the scrub',
  rock: 'on the walls and rocks',
};
