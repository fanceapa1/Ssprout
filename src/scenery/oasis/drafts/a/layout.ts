/**
 * Oasis draft A, "Ksar & palmeraie": the shapes of the composition in world units (1600 × 1000).
 * A red-ochre bluff crowned by a ksar on the left, palm terraces with a seguia and a stone basin
 * in the middle, an oued bend in the foreground. A rough draft (phase 13), not a scenery yet.
 */
import type { Pt } from '../../../../render/viewport';

/** Where the eye rests: the basin's near left corner. The phone crop is 600 wide around it. */
export const FOCUS: Pt = { x: 750, y: 640 };

/** The far flat-topped ranges (lilac), their skyline left to right. */
export const FAR_RANGE: readonly Pt[] = [
  { x: -20, y: 300 }, { x: 560, y: 298 }, { x: 640, y: 286 }, { x: 690, y: 266 }, { x: 870, y: 262 },
  { x: 905, y: 274 }, { x: 960, y: 284 }, { x: 1090, y: 286 }, { x: 1125, y: 270 }, { x: 1150, y: 256 },
  { x: 1340, y: 254 }, { x: 1375, y: 268 }, { x: 1430, y: 288 }, { x: 1510, y: 292 }, { x: 1545, y: 280 },
  { x: 1620, y: 276 },
];

/** The nearer, rosier range, lower and broken. */
export const NEAR_RANGE: readonly Pt[] = [
  { x: 520, y: 332 }, { x: 610, y: 322 }, { x: 690, y: 318 }, { x: 728, y: 304 }, { x: 820, y: 302 },
  { x: 850, y: 316 }, { x: 1000, y: 324 }, { x: 1180, y: 320 }, { x: 1215, y: 306 }, { x: 1240, y: 300 },
  { x: 1300, y: 302 }, { x: 1330, y: 316 }, { x: 1450, y: 326 }, { x: 1620, y: 322 },
];

/** The golden dune crests beyond the grove (x, crest y), a strip between the ranges and the palms. */
export const DUNE_CRESTS: readonly Pt[] = [
  { x: 560, y: 376 }, { x: 700, y: 352 }, { x: 860, y: 344 }, { x: 990, y: 338 }, { x: 1130, y: 350 },
  { x: 1250, y: 332 }, { x: 1400, y: 340 }, { x: 1530, y: 348 }, { x: 1640, y: 342 },
];
export const DUNE_BASE = 452;

/** The bluff: flat top under the ksar, a lit right face dropping to the grove, the foot at ~490. */
export const BLUFF: readonly Pt[] = [
  { x: -20, y: 262 }, { x: 30, y: 246 }, { x: 70, y: 244 }, { x: 120, y: 238 }, { x: 210, y: 240 }, { x: 300, y: 234 },
  { x: 420, y: 240 }, { x: 500, y: 242 }, { x: 545, y: 246 }, { x: 568, y: 254 }, { x: 596, y: 274 }, { x: 610, y: 306 },
  { x: 628, y: 346 }, { x: 650, y: 390 }, { x: 676, y: 428 }, { x: 706, y: 462 }, { x: 690, y: 480 },
  { x: 600, y: 488 }, { x: 460, y: 494 }, { x: 260, y: 500 }, { x: -20, y: 506 },
];
/** The bluff's lit right flank (a sub-shape of BLUFF). */
export const BLUFF_FLANK: readonly Pt[] = [
  { x: 548, y: 248 }, { x: 568, y: 252 }, { x: 596, y: 274 }, { x: 610, y: 306 }, { x: 628, y: 346 },
  { x: 650, y: 390 }, { x: 676, y: 428 }, { x: 706, y: 462 }, { x: 690, y: 480 }, { x: 640, y: 484 },
  { x: 606, y: 430 }, { x: 584, y: 370 }, { x: 568, y: 310 }, { x: 552, y: 270 },
];

/** A ksar block: front face from `x` to `x + w`, `h` tall above `base`; `side` deep lit flank. */
export interface Block {
  x: number;
  w: number;
  h: number;
  base: number;
  side: number;
  tower: boolean;
  ruined?: boolean;
}

/** Back to front: houses behind, towers, the curtain wall last. */
export const KSAR: readonly Block[] = [
  { x: 196, w: 120, h: 86, base: 244, side: 18, tower: false },
  { x: 352, w: 92, h: 76, base: 244, side: 16, tower: false },
  { x: 84, w: 70, h: 52, base: 252, side: 12, tower: false, ruined: true },
  { x: 136, w: 50, h: 138, base: 252, side: 14, tower: true },
  { x: 290, w: 58, h: 164, base: 254, side: 18, tower: true },
  { x: 438, w: 48, h: 120, base: 254, side: 14, tower: true },
  { x: 182, w: 108, h: 52, base: 276, side: 0, tower: false, ruined: true },
  { x: 346, w: 92, h: 48, base: 276, side: 0, tower: false, ruined: true },
  { x: 480, w: 64, h: 60, base: 258, side: 14, tower: false, ruined: true },
  { x: 528, w: 44, h: 104, base: 262, side: 18, tower: true },
];

/** Palms rising from behind the ksar (crown x, crown y, size). */
export const PALMS_BEHIND: readonly [number, number, number][] = [
  [60, 150, 0.85], [246, 128, 0.95], [404, 138, 0.9], [212, 160, 0.75], [500, 166, 0.75],
];

/** The pisé terrace walls' top edges, left to right, and their face height. */
export interface Wall {
  edge: readonly Pt[];
  h: number;
}
export const WALLS: readonly Wall[] = [
  { edge: [{ x: 600, y: 520 }, { x: 760, y: 534 }, { x: 960, y: 532 }, { x: 1150, y: 524 }, { x: 1380, y: 532 }, { x: 1620, y: 522 }], h: 12 },
  { edge: [{ x: -20, y: 552 }, { x: 180, y: 548 }, { x: 380, y: 552 }, { x: 540, y: 536 }], h: 12 },
  { edge: [{ x: -20, y: 646 }, { x: 200, y: 660 }, { x: 460, y: 664 }, { x: 640, y: 684 }, { x: 800, y: 694 }, { x: 960, y: 690 }, { x: 1120, y: 674 }, { x: 1360, y: 668 }, { x: 1620, y: 650 }], h: 22 },
];


/** The seguia: from the bluff's foot down across the terraces to the basin's left end. */
export const SEGUIA: readonly Pt[] = [
  { x: 470, y: 494 }, { x: 520, y: 512 }, { x: 560, y: 540 }, { x: 600, y: 566 }, { x: 640, y: 590 }, { x: 690, y: 606 },
];

/** The basin, a stone-edged rectangle in perspective (outer rim). */
export const BASIN: readonly Pt[] = [
  { x: 690, y: 592 }, { x: 900, y: 590 }, { x: 918, y: 646 }, { x: 676, y: 650 },
];
export const BASIN_RIM = 9;

/** The overflow runnel from the basin's near right corner down through the wall to the oued. */
export const OVERFLOW: readonly Pt[] = [
  { x: 880, y: 650 }, { x: 896, y: 690 }, { x: 930, y: 730 }, { x: 980, y: 768 }, { x: 1020, y: 792 },
];

/** The oued: a wide bend from the lower left, up toward the centre, and out at the right. */
export const OUED: readonly Pt[] = [
  { x: -30, y: 880 }, { x: 160, y: 856 }, { x: 380, y: 822 }, { x: 600, y: 796 }, { x: 860, y: 782 },
  { x: 1080, y: 776 }, { x: 1300, y: 772 }, { x: 1460, y: 764 }, { x: 1630, y: 752 },
  { x: 1630, y: 832 }, { x: 1440, y: 850 }, { x: 1250, y: 858 }, { x: 1060, y: 864 }, { x: 860, y: 872 },
  { x: 640, y: 892 }, { x: 440, y: 924 }, { x: 240, y: 962 }, { x: 80, y: 996 }, { x: -30, y: 1010 },
]

/** Sand bars in the oued, pale islands near the inside of the bend. */
export const BARS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 1200, cy: 830, rx: 110, ry: 11 },
  { cx: 560, cy: 884, rx: 70, ry: 8 },
];

/** Palms on the upper terraces at the bluff's foot and by the seguia's head. */
export const TERRACE_PALMS: readonly [number, number, number][] = [
  [330, 410, 1.0], [430, 400, 1.05], [560, 420, 0.95], [190, 430, 0.9], [1050, 452, 1.0], [1350, 456, 1.05],
  [40, 560, 0.45], [1570, 580, 0.5], [610, 590, 0.4], [780, 430, 0.85], [1240, 438, 0.9], [1500, 444, 0.9],
];

/** Plantable zones for the composition map (centre, radii, label, slot count). */
export const ZONES: readonly { cx: number; cy: number; rx: number; ry: number; label: string; n: number }[] = [
  { cx: 430, cy: 610, rx: 160, ry: 34, label: 'upper plots W', n: 4 },
  { cx: 1050, cy: 612, rx: 120, ry: 34, label: 'plots by the basin', n: 3 },
  { cx: 1390, cy: 604, rx: 140, ry: 34, label: 'upper plots E', n: 3 },
  { cx: 380, cy: 740, rx: 260, ry: 34, label: 'lower terrace', n: 4 },
  { cx: 1280, cy: 720, rx: 220, ry: 28, label: 'river bank E', n: 3 },
  { cx: 760, cy: 830, rx: 130, ry: 20, label: 'shallows', n: 2 },
  { cx: 1200, cy: 830, rx: 90, ry: 14, label: 'sand bar', n: 1 },
  { cx: 920, cy: 940, rx: 380, ry: 40, label: 'near sand bank', n: 5 },
];
