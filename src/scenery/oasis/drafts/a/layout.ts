/**
 * Oasis draft A, "Ksar & palmeraie", round 2: standing on the basin's terrace. A large stone basin
 * in the middle, the red bluff with its ksar close behind on the left, big palms cropped by the top
 * on the right, terraces stepping down on the left, and the oued bending past on the right.
 */
import type { SizeClass } from '../../../../plants/types';
import type { Pt } from '../../../../render/viewport';

/** Where the eye rests: the basin's near rim, a little left of centre. */
export const FOCUS: Pt = { x: 800, y: 640 };

/** A sliver of the far flat-topped range, seen between the bluff and the palms. */
export const FAR_RANGE: readonly Pt[] = [
  { x: 780, y: 336 }, { x: 900, y: 322 }, { x: 936, y: 304 }, { x: 1100, y: 300 }, { x: 1132, y: 314 },
  { x: 1300, y: 318 }, { x: 1336, y: 304 }, { x: 1500, y: 302 }, { x: 1540, y: 318 }, { x: 1620, y: 320 },
];

/** Golden dune crests behind the grove (mostly hidden by it). */
export const DUNE_CRESTS: readonly Pt[] = [
  { x: 780, y: 384 }, { x: 960, y: 352 }, { x: 1110, y: 362 }, { x: 1260, y: 342 }, { x: 1420, y: 356 }, { x: 1640, y: 338 },
];
export const DUNE_BASE = 480;

/** The bluff: a high cliff on the left, the ksar's shoulder, a lit right flank down to the foot. */
export const BLUFF: readonly Pt[] = [
  { x: -20, y: 140 }, { x: 60, y: 126 }, { x: 150, y: 132 }, { x: 206, y: 160 }, { x: 236, y: 214 },
  { x: 270, y: 256 }, { x: 420, y: 262 }, { x: 600, y: 264 }, { x: 760, y: 268 }, { x: 800, y: 276 },
  { x: 836, y: 306 }, { x: 862, y: 352 }, { x: 884, y: 400 }, { x: 904, y: 440 }, { x: 930, y: 476 },
  { x: 880, y: 482 }, { x: 700, y: 466 }, { x: 420, y: 452 }, { x: 160, y: 446 }, { x: -20, y: 448 },
];
/** The bluff's lit right flank (a sub-shape of BLUFF). */
export const BLUFF_FLANK: readonly Pt[] = [
  { x: 770, y: 268 }, { x: 800, y: 276 }, { x: 836, y: 306 }, { x: 862, y: 352 }, { x: 884, y: 400 },
  { x: 904, y: 440 }, { x: 930, y: 476 }, { x: 880, y: 482 }, { x: 846, y: 430 }, { x: 818, y: 370 },
  { x: 796, y: 316 }, { x: 778, y: 286 },
];
/** The high cliff's lit edge on the left, where the shoulder steps down to the ksar. */
export const CLIFF_STEP: readonly Pt[] = [
  { x: 150, y: 132 }, { x: 206, y: 160 }, { x: 236, y: 214 }, { x: 270, y: 256 }, { x: 250, y: 300 }, { x: 214, y: 240 }, { x: 180, y: 180 },
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

/** Back to front: houses behind, towers, the ruined curtain walls last. */
export const KSAR: readonly Block[] = [
  { x: 340, w: 180, h: 150, base: 266, side: 30, tower: false },
  { x: 606, w: 150, h: 132, base: 268, side: 28, tower: false },
  { x: 256, w: 84, h: 214, base: 270, side: 26, tower: true },
  { x: 506, w: 96, h: 246, base: 272, side: 30, tower: true },
  { x: 730, w: 76, h: 188, base: 276, side: 30, tower: true },
  { x: 336, w: 172, h: 84, base: 300, side: 0, tower: false, ruined: true },
  { x: 600, w: 130, h: 74, base: 300, side: 0, tower: false, ruined: true },
];
/** Detail scale of the ksar (window slits, chevrons, horns) against round 1. */
export const KSAR_DETAIL = 1.8;

/** Palms rising from behind the ksar (crown x, crown y, size). */
export const PALMS_BEHIND: readonly [number, number, number][] = [
  [450, 120, 1.5], [680, 136, 1.4], [580, 150, 1.2],
];

/** Big palms on the right, crowns cut by the top edge, plus one framing the left terraces. */
export const BIG_PALMS: readonly { top: Pt; base: Pt; size: number }[] = [
  { top: { x: 1236, y: 70 }, base: { x: 1276, y: 548 }, size: 3.0 },
  { top: { x: 1452, y: 14 }, base: { x: 1410, y: 580 }, size: 3.5 },
  { top: { x: 1600, y: 150 }, base: { x: 1572, y: 560 }, size: 2.8 },
  { top: { x: 1090, y: 190 }, base: { x: 1116, y: 472 }, size: 2.0 },
];

/** The pisé terrace walls' top edges and their face height (the drop toward the viewer). */
export interface Wall {
  edge: readonly Pt[];
  h: number;
}
export const WALLS: readonly Wall[] = [
  { edge: [{ x: 880, y: 478 }, { x: 1100, y: 474 }, { x: 1300, y: 480 }, { x: 1620, y: 470 }], h: 24 },
  { edge: [{ x: -20, y: 506 }, { x: 200, y: 500 }, { x: 400, y: 494 }, { x: 500, y: 490 }], h: 34 },
  { edge: [{ x: -20, y: 602 }, { x: 200, y: 592 }, { x: 380, y: 580 }, { x: 478, y: 574 }], h: 36 },
];

/** The seguia's runs along the terraces, and the falls over each wall into the basin. */
export const SEGUIA_RUNS: readonly (readonly Pt[])[] = [
  [{ x: 300, y: 446 }, { x: 370, y: 462 }, { x: 430, y: 478 }, { x: 458, y: 490 }],
  [{ x: 458, y: 526 }, { x: 466, y: 544 }, { x: 480, y: 562 }, { x: 490, y: 574 }],
  [{ x: 560, y: 662 }, { x: 480, y: 720 }, { x: 380, y: 790 }, { x: 290, y: 880 }, { x: 230, y: 1020 }],
];
export const SEGUIA_FALLS: readonly { top: Pt; drop: number }[] = [
  { top: { x: 458, y: 492 }, drop: 34 },
  { top: { x: 492, y: 576 }, drop: 34 },
];

/** The basin: a stone-edged rectangle in perspective (outer rim), its near face, its rim width. */
export const BASIN: readonly Pt[] = [
  { x: 540, y: 476 }, { x: 1150, y: 476 }, { x: 1214, y: 640 }, { x: 476, y: 640 },
];
export const BASIN_RIM = { far: 12, near: 26, side: 22, face: 18 };

/** The sluice from the basin's near right corner into the oued. */
export const SLUICE: readonly Pt[] = [
  { x: 1196, y: 618 }, { x: 1250, y: 640 }, { x: 1300, y: 664 }, { x: 1334, y: 676 },
];

/** The oued: from behind the big palms on the right, bending down past the viewer's feet. */
export const OUED: readonly Pt[] = [
  { x: 1630, y: 572 }, { x: 1520, y: 590 }, { x: 1420, y: 620 }, { x: 1346, y: 670 }, { x: 1300, y: 746 },
  { x: 1272, y: 840 }, { x: 1250, y: 940 }, { x: 1240, y: 1020 },
  { x: 1520, y: 1020 }, { x: 1500, y: 920 }, { x: 1514, y: 820 }, { x: 1560, y: 740 }, { x: 1630, y: 700 },
];
/** A sand bar on the inside of the bend. */
export const BAR = { cx: 1400, cy: 830, rx: 46, ry: 70 };

/** A plant slot for the composition map: base point and size class. */
export interface DraftSlot {
  x: number;
  y: number;
  size: SizeClass;
  where: string;
}
export const SLOTS: readonly DraftSlot[] = [
  { x: 70, y: 486, size: 'small', where: 'upper terrace' },
  { x: 220, y: 482, size: 'medium', where: 'upper terrace' },
  { x: 80, y: 584, size: 'medium', where: 'middle terrace' },
  { x: 250, y: 570, size: 'small', where: 'middle terrace' },
  { x: 390, y: 560, size: 'small', where: 'middle terrace' },
  { x: 180, y: 680, size: 'tree', where: 'basin terrace' },
  { x: 400, y: 690, size: 'large', where: 'basin terrace' },
  { x: 560, y: 704, size: 'medium', where: 'basin rim' },
  { x: 720, y: 716, size: 'small', where: 'basin rim' },
  { x: 900, y: 712, size: 'small', where: 'basin rim' },
  { x: 1080, y: 704, size: 'medium', where: 'basin rim' },
  { x: 1280, y: 610, size: 'medium', where: 'between basin and oued' },
  { x: 330, y: 800, size: 'medium', where: 'foreground' },
  { x: 560, y: 830, size: 'small', where: 'foreground' },
  { x: 770, y: 800, size: 'medium', where: 'foreground' },
  { x: 980, y: 830, size: 'small', where: 'foreground' },
  { x: 1160, y: 790, size: 'large', where: 'oued bank' },
  { x: 150, y: 900, size: 'medium', where: 'foreground' },
  { x: 440, y: 920, size: 'small', where: 'foreground' },
  { x: 1010, y: 940, size: 'medium', where: 'foreground' },
  { x: 1200, y: 950, size: 'small', where: 'oued bank' },
  { x: 1340, y: 760, size: 'small', where: 'shallows' },
  { x: 1400, y: 880, size: 'small', where: 'sand bar' },
  { x: 1580, y: 800, size: 'medium', where: 'oued far bank' },
  { x: 1560, y: 950, size: 'small', where: 'oued far bank' },
];
