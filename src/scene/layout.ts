import type { Pt } from '../render/viewport';

/**
 * Painting-only composition details (world units). Unlike `geometry.ts` nothing here is part
 * of the shared contract: other systems never read it. See docs/systems/scene.md for the map.
 */

export interface TreeSpec {
  id: string;
  /** where the trunk meets the ground */
  base: Pt;
  /** main stems from the base upward (each a polyline) */
  stems: Pt[][];
  /** limbs (polylines) that leave the stems toward the pads */
  limbs: Pt[][];
  /** foliage pads: centre x, y and radius */
  pads: [number, number, number][];
  /** trunk width at the base */
  width: number;
  /** 0 = near and full strength … 1 = far, pale and cool */
  distance: number;
  /** pond waterline this tree reflects about (omit: not reflected) */
  reflectAbout?: number;
}

export interface ShrubSpec {
  x: number;
  y: number;
  r: number;
  distance: number;
}

export interface TuftSpec {
  x: number;
  y: number;
  h: number;
}

/** Upper-left: a large, leaning, multi-stemmed tree; a slimmer one behind it. */
const LEFT_TREES: TreeSpec[] = [
  {
    id: 'tree-left-back',
    base: { x: 176, y: 456 },
    stems: [
      [
        { x: 176, y: 456 },
        { x: 170, y: 396 },
        { x: 162, y: 336 },
        { x: 158, y: 282 },
      ],
    ],
    limbs: [
      [
        { x: 162, y: 336 },
        { x: 132, y: 300 },
        { x: 112, y: 278 },
      ],
      [
        { x: 160, y: 300 },
        { x: 188, y: 262 },
        { x: 200, y: 238 },
      ],
    ],
    pads: [
      [150, 246, 46],
      [204, 220, 38],
      [104, 286, 32],
      [178, 290, 28],
    ],
    width: 4.2,
    distance: 0.55,
  },
  {
    id: 'tree-left',
    base: { x: 318, y: 478 },
    stems: [
      [
        { x: 318, y: 478 },
        { x: 330, y: 432 },
        { x: 328, y: 394 },
        { x: 342, y: 352 },
        { x: 354, y: 318 },
        { x: 360, y: 290 },
      ],
      [
        { x: 312, y: 478 },
        { x: 298, y: 434 },
        { x: 292, y: 394 },
        { x: 272, y: 350 },
        { x: 250, y: 302 },
        { x: 230, y: 266 },
        { x: 214, y: 240 },
      ],
    ],
    limbs: [
      [
        { x: 360, y: 290 },
        { x: 376, y: 236 },
        { x: 380, y: 180 },
        { x: 366, y: 124 },
      ],
      [
        { x: 352, y: 324 },
        { x: 410, y: 274 },
        { x: 470, y: 230 },
        { x: 530, y: 206 },
      ],
      [
        { x: 214, y: 240 },
        { x: 190, y: 196 },
        { x: 182, y: 152 },
      ],
      [
        { x: 248, y: 290 },
        { x: 190, y: 250 },
        { x: 122, y: 222 },
      ],
      [
        { x: 360, y: 290 },
        { x: 318, y: 226 },
        { x: 292, y: 168 },
        { x: 284, y: 110 },
      ],
      [
        { x: 470, y: 230 },
        { x: 540, y: 214 },
        { x: 600, y: 200 },
        { x: 646, y: 176 },
      ],
    ],
    pads: [
      [312, 92, 74],
      [186, 138, 66],
      [430, 132, 62],
      [110, 206, 50],
      [522, 190, 50],
      [262, 186, 48],
      [392, 212, 42],
      [458, 238, 34],
      [246, 104, 46],
      [376, 66, 44],
      [486, 164, 40],
      [146, 176, 38],
      [332, 156, 36],
      [196, 232, 30],
      [566, 218, 28],
      [628, 160, 36],
      [600, 196, 26],
    ],
    width: 9,
    distance: 0.1,
    reflectAbout: 470,
  },
];

/** Right of centre, before the pavilion: two slim trees, the right one farther and paler. */
const RIGHT_TREES: TreeSpec[] = [
  {
    id: 'tree-right-back',
    base: { x: 1180, y: 438 },
    stems: [
      [
        { x: 1180, y: 438 },
        { x: 1184, y: 384 },
        { x: 1190, y: 326 },
        { x: 1192, y: 268 },
      ],
    ],
    limbs: [
      [
        { x: 1190, y: 326 },
        { x: 1162, y: 290 },
        { x: 1152, y: 268 },
      ],
      [
        { x: 1192, y: 300 },
        { x: 1212, y: 270 },
        { x: 1220, y: 252 },
      ],
    ],
    pads: [
      [1190, 228, 42],
      [1152, 262, 32],
      [1218, 252, 28],
    ],
    width: 4,
    distance: 0.5,
    reflectAbout: 470,
  },
  {
    id: 'tree-right',
    base: { x: 1104, y: 448 },
    stems: [
      [
        { x: 1104, y: 448 },
        { x: 1100, y: 384 },
        { x: 1094, y: 316 },
        { x: 1086, y: 254 },
        { x: 1080, y: 204 },
      ],
    ],
    limbs: [
      [
        { x: 1094, y: 316 },
        { x: 1056, y: 262 },
        { x: 1024, y: 222 },
      ],
      [
        { x: 1086, y: 254 },
        { x: 1122, y: 212 },
        { x: 1146, y: 176 },
      ],
      [
        { x: 1080, y: 204 },
        { x: 1074, y: 168 },
        { x: 1068, y: 140 },
      ],
    ],
    pads: [
      [1072, 140, 54],
      [1016, 204, 44],
      [1144, 168, 42],
      [1054, 236, 36],
      [1120, 238, 32],
    ],
    width: 5.5,
    distance: 0.25,
    reflectAbout: 470,
  },
];

export const TREES: TreeSpec[] = [...LEFT_TREES, ...RIGHT_TREES];

/** A couple of rounded shrubs (barren but serene: no flowers). */
export const SHRUBS: ShrubSpec[] = [
  { x: 146, y: 470, r: 50, distance: 0.4 },
  { x: 420, y: 486, r: 32, distance: 0.35 },
  { x: 1262, y: 476, r: 34, distance: 0.4 },
  { x: 1548, y: 694, r: 50, distance: 0.05 },
];

/** Grass tufts painted into the background (heights already in perspective). */
export const TUFTS: TuftSpec[] = [
  { x: 236, y: 470, h: 14 },
  { x: 404, y: 486, h: 14 },
  { x: 770, y: 446, h: 11 },
  { x: 1300, y: 486, h: 14 },
  { x: 92, y: 600, h: 20 },
  { x: 300, y: 650, h: 22 },
  { x: 434, y: 676, h: 22 },
  { x: 1440, y: 650, h: 20 },
  { x: 160, y: 760, h: 26 },
  { x: 620, y: 770, h: 24 },
  { x: 1250, y: 752, h: 24 },
  { x: 1520, y: 790, h: 26 },
  { x: 260, y: 860, h: 28 },
  { x: 1120, y: 846, h: 28 },
  { x: 1410, y: 900, h: 30 },
  { x: 500, y: 930, h: 30 },
];

/**
 * Tufts that plants may stand behind — painted as cached sprites in the `entities` layer
 * (depth = base y) instead of into the background.
 */
export const FOREGROUND_TUFTS: TuftSpec[] = [
  { x: 548, y: 742, h: 34 },
  { x: 990, y: 772, h: 34 },
  { x: 680, y: 930, h: 40 },
  { x: 958, y: 990, h: 44 },
  { x: 1226, y: 860, h: 38 },
  { x: 372, y: 790, h: 36 },
];

/** Distant hills: ridge peaks (x, y) — joined by smooth curves, base at y ≈ 420. */
export const HILLS: { ridge: Pt[]; distance: number }[] = [
  {
    distance: 1,
    ridge: [
      { x: -60, y: 352 },
      { x: 120, y: 334 },
      { x: 330, y: 312 },
      { x: 520, y: 326 },
      { x: 700, y: 350 },
      { x: 860, y: 340 },
      { x: 1020, y: 318 },
      { x: 1200, y: 300 },
      { x: 1380, y: 318 },
      { x: 1660, y: 340 },
    ],
  },
  {
    distance: 0.8,
    ridge: [
      { x: -60, y: 386 },
      { x: 180, y: 372 },
      { x: 420, y: 380 },
      { x: 640, y: 370 },
      { x: 820, y: 378 },
      { x: 980, y: 366 },
      { x: 1180, y: 376 },
      { x: 1400, y: 368 },
      { x: 1660, y: 382 },
    ],
  },
];
