/**
 * Coast draft B, "Stepped terraces down to the shore": dry-stone terraces step down from the right
 * to a pebble beach and rock pools; the sea runs along the coast to a temple promontory behind.
 */
import type { SizeClass } from '../../../../plants/types';
import type { Pt } from '../../../../render/viewport';

/** Where the eye rests: the sea edge below the temple point. */
export const FOCUS: Pt = { x: 860, y: 760 };

export const HORIZON = 410;

/** The far hill across the bay, upper left, with its village. */
export const FAR_HILL: readonly Pt[] = [
  { x: -20, y: 352 }, { x: 90, y: 326 }, { x: 210, y: 300 }, { x: 300, y: 288 }, { x: 380, y: 300 },
  { x: 480, y: 336 }, { x: 600, y: 380 }, { x: 680, y: 410 },
];
export const VILLAGE: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 150, y: 352, w: 26, h: 16 }, { x: 186, y: 344, w: 20, h: 14 }, { x: 214, y: 334, w: 24, h: 15 },
  { x: 246, y: 326, w: 18, h: 13 }, { x: 196, y: 372, w: 28, h: 15 }, { x: 236, y: 362, w: 22, h: 14 },
  { x: 270, y: 350, w: 26, h: 14 }, { x: 304, y: 340, w: 20, h: 13 }, { x: 330, y: 360, w: 24, h: 14 },
  { x: 120, y: 380, w: 24, h: 14 }, { x: 286, y: 384, w: 30, h: 14 }, { x: 360, y: 384, w: 22, h: 12 },
];
export const CHAPEL: Pt = { x: 278, y: 314 };

/** The near limestone promontory: point at the left, rising to the right edge. */
export const PROMONTORY: readonly Pt[] = [
  { x: 680, y: 470 }, { x: 712, y: 436 }, { x: 760, y: 410 }, { x: 900, y: 402 }, { x: 960, y: 372 },
  { x: 1080, y: 330 }, { x: 1220, y: 300 }, { x: 1400, y: 280 }, { x: 1620, y: 290 },
  { x: 1620, y: 560 }, { x: 1100, y: 540 }, { x: 860, y: 510 }, { x: 680, y: 486 },
];
/** Temple columns on the point: base x, height, broken. */
export const COLUMNS: readonly { x: number; h: number }[] = [
  { x: 772, h: 92 }, { x: 812, h: 96 }, { x: 852, h: 58 }, { x: 888, h: 74 },
];
export const COLUMN_BASE = 404;
export const DRUM: Pt = { x: 930, y: 404 };

export const CAIQUE: Pt = { x: 560, y: 520 };

/** Dry-stone terrace walls: top edge and face height. */
export interface Wall {
  edge: readonly Pt[];
  h: number;
}
export const WALLS: readonly Wall[] = [
  { edge: [{ x: 1040, y: 560 }, { x: 1250, y: 552 }, { x: 1620, y: 544 }], h: 40 },
  { edge: [{ x: 780, y: 690 }, { x: 1000, y: 680 }, { x: 1300, y: 672 }, { x: 1620, y: 664 }], h: 46 },
  { edge: [{ x: 600, y: 846 }, { x: 820, y: 834 }, { x: 1120, y: 824 }, { x: 1620, y: 818 }], h: 52 },
];

/** The terrace land, right and foreground. */
export const LAND: readonly Pt[] = [
  { x: 980, y: 540 }, { x: 1620, y: 520 }, { x: 1620, y: 1020 }, { x: 520, y: 1020 }, { x: 560, y: 900 },
  { x: 640, y: 846 }, { x: 760, y: 700 }, { x: 900, y: 600 },
];

export const BEACH: readonly Pt[] = [
  { x: -20, y: 818 }, { x: 160, y: 800 }, { x: 360, y: 812 }, { x: 560, y: 846 }, { x: 640, y: 846 },
  { x: 580, y: 910 }, { x: 300, y: 900 }, { x: -20, y: 906 },
];
export const SHELF: readonly Pt[] = [
  { x: -20, y: 900 }, { x: 300, y: 892 }, { x: 590, y: 904 }, { x: 540, y: 1020 }, { x: -20, y: 1020 },
];
export const POOLS: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 140, cy: 950, rx: 70, ry: 20 }, { cx: 360, cy: 970, rx: 56, ry: 16 }, { cx: 470, cy: 930, rx: 36, ry: 11 },
];
export const SPLASH_ROCKS: readonly [number, number, number][] = [
  [60, 800, 90], [420, 790, 60], [690, 780, 70], [250, 760, 40],
];

/** The gravel path down the tiers, back to front. */
export const PATH: readonly Pt[] = [
  { x: 1180, y: 556 }, { x: 1100, y: 620 }, { x: 1060, y: 690 }, { x: 980, y: 760 }, { x: 900, y: 836 },
  { x: 820, y: 920 }, { x: 760, y: 1020 },
];
export const STEPS_AT: readonly Pt[] = [{ x: 1150, y: 556 }, { x: 1060, y: 680 }, { x: 900, y: 830 }];

export const OLIVE = { base: { x: 1340, y: 600 }, crown: { x: 1340, y: 300 } };
export const PINE = { base: { x: 50, y: 760 }, top: { x: 180, y: 250 } };

export interface DraftSlot {
  x: number;
  y: number;
  size: SizeClass;
  where: string;
}
export const SLOTS: readonly DraftSlot[] = [
  { x: 1080, y: 610, size: 'small', where: 'upper bed' },
  { x: 1500, y: 620, size: 'medium', where: 'upper bed' },
  { x: 1200, y: 560, size: 'small', where: 'wall top' },
  { x: 1560, y: 556, size: 'small', where: 'wall top' },
  { x: 900, y: 700, size: 'small', where: 'wall top' },
  { x: 1180, y: 740, size: 'medium', where: 'middle bed' },
  { x: 1400, y: 770, size: 'large', where: 'middle bed' },
  { x: 1580, y: 760, size: 'medium', where: 'middle bed' },
  { x: 1300, y: 712, size: 'small', where: 'wall crack' },
  { x: 1020, y: 790, size: 'small', where: 'path edge' },
  { x: 880, y: 790, size: 'small', where: 'path edge' },
  { x: 700, y: 850, size: 'small', where: 'wall top' },
  { x: 1000, y: 950, size: 'medium', where: 'lower bed' },
  { x: 1240, y: 960, size: 'large', where: 'lower bed' },
  { x: 1500, y: 980, size: 'medium', where: 'lower bed' },
  { x: 1100, y: 868, size: 'small', where: 'wall crack' },
  { x: 680, y: 960, size: 'small', where: 'scrub' },
  { x: 110, y: 860, size: 'small', where: 'beach sand' },
  { x: 380, y: 870, size: 'medium', where: 'beach sand' },
  { x: 690, y: 784, size: 'small', where: 'splash rock' },
  { x: 60, y: 802, size: 'small', where: 'splash rock' },
  { x: 140, y: 952, size: 'small', where: 'rock pool' },
  { x: 360, y: 972, size: 'small', where: 'rock pool' },
  { x: 260, y: 700, size: 'medium', where: 'shallows' },
  { x: 520, y: 740, size: 'small', where: 'shallows' },
  { x: 780, y: 620, size: 'small', where: 'shallows' },
];
