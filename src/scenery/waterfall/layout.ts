/**
 * The waterfall's painting layout and numbers: the skyline, the cliff mass and its ledges, the far
 * ridge, the sky layout, the view, the ambience boxes and the habitat words. Composition and the
 * reasoning behind the numbers: docs/systems/scenery.md › Waterfall.
 */
import type { SkyLayout } from '../../ambience/sky-layout';
import type { Habitat } from '../../plants/types';
import type { Pt } from '../../render/viewport';
import type { SceneryAmbience } from '../types';

/** The open sky's lower edge, left → right: crown woods, the notch the falls pour from, the buttress, the far ridge. */
export const SKYLINE: readonly Pt[] = [
  // crown woods, highest at the left edge, stepping down toward the falls in broken blocks
  { x: -80, y: 214 },
  { x: 0, y: 208 },
  { x: 60, y: 200 },
  { x: 92, y: 202 },
  { x: 102, y: 216 },
  { x: 150, y: 220 },
  { x: 164, y: 234 },
  { x: 226, y: 240 },
  { x: 238, y: 252 },
  { x: 322, y: 254 },
  { x: 336, y: 240 },
  { x: 402, y: 230 },
  { x: 416, y: 238 },
  { x: 462, y: 240 },
  { x: 474, y: 254 },
  { x: 512, y: 258 },
  { x: 530, y: 264 },
  // the notch: the gorge's far end, the lip ~37 units below it
  { x: 556, y: 258 },
  { x: 586, y: 255 },
  { x: 604, y: 250 },
  { x: 632, y: 254 },
  { x: 664, y: 258 },
  // the buttress right of the falls, the tallest rock beside them, its crest broken into blocks
  { x: 684, y: 256 },
  { x: 700, y: 242 },
  { x: 722, y: 238 },
  { x: 732, y: 224 },
  { x: 762, y: 214 },
  { x: 804, y: 216 },
  { x: 816, y: 226 },
  { x: 846, y: 230 },
  // its right flank steps down to the far ridge in jointed blocks of uneven size
  { x: 854, y: 254 },
  { x: 868, y: 256 },
  { x: 882, y: 264 },
  { x: 889, y: 290 },
  { x: 912, y: 292 },
  { x: 926, y: 300 },
  { x: 931, y: 318 },
  { x: 958, y: 326 },
  { x: 966, y: 346 },
  { x: 990, y: 350 },
  { x: 1002, y: 356 },
  { x: 1010, y: 360 },
  { x: 1080, y: 372 },
  { x: 1180, y: 360 },
  { x: 1300, y: 348 },
  { x: 1420, y: 358 },
  { x: 1540, y: 344 },
  { x: 1680, y: 350 },
];

/** The skyline's height at x (linear between its points). */
export function skylineAt(x: number): number {
  const s = SKYLINE;
  if (x <= s[0]!.x) return s[0]!.y;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    if (b.x >= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return s[s.length - 1]!.y;
}

/** Top of the sky plates' band (as the Japanese garden's: paper above the world for tall phones). */
export const SKY_TOP = -240;

/** The open sky above the skyline, with `below` units hanging under it. */
export function openSky(below = 0): Pt[] {
  const line = SKYLINE.map((q) => ({ x: q.x, y: q.y + below }));
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/** The buttress's right edge under the skyline, top to bottom, where the far ridge meets it. */
export const BUTTRESS_END: readonly Pt[] = [
  { x: 1028, y: 368 },
  { x: 1034, y: 392 },
  { x: 1046, y: 398 },
  { x: 1050, y: 436 },
  { x: 1041, y: 452 },
];

/** Where the cliff stands on the ground: its right flank, then the plunge pool's back edge, then its left foot. */
const CLIFF_FOOT: readonly Pt[] = [
  // the buttress's last blocks, standing in front of the far ridge
  ...BUTTRESS_END,
  { x: 1042, y: 488 },
  { x: 1026, y: 506 },
  { x: 1016, y: 540 },
  { x: 990, y: 570 },
  { x: 930, y: 616 },
  { x: 910, y: 624 },
  { x: 840, y: 612 },
  { x: 760, y: 604 },
  { x: 680, y: 598 },
  { x: 600, y: 597 },
  { x: 532, y: 600 },
  { x: 480, y: 612 },
  { x: 452, y: 640 },
  { x: 380, y: 636 },
  { x: 200, y: 640 },
  { x: -80, y: 644 },
];

/** The cliff mass, skyline to foot (the sky beyond x 1010 is over the far ridge, not the cliff). */
export const CLIFF: readonly Pt[] = [...SKYLINE.filter((q) => q.x <= 1010), ...CLIFF_FOOT];

/** The far ridge and the plain under it, right of the cliff: pale and far. */
export const FAR_RIDGE: readonly Pt[] = [
  ...SKYLINE.filter((q) => q.x >= 1010),
  { x: 1680, y: 470 },
  { x: 1044, y: 470 },
  ...BUTTRESS_END.slice().reverse(),
];

/**
 * A shelf on the cliff face: its top edge, left → right, and the perspective scale of what grows on
 * it. The cliff leans back, so higher ledges are farther away than its foot (0.76 at y 600).
 */
export interface Ledge {
  id: string;
  edge: readonly [Pt, Pt];
  scale: number;
}

export const LEDGES: readonly Ledge[] = [
  { id: 'left-high', edge: [{ x: 330, y: 336 }, { x: 520, y: 328 }], scale: 0.64 },
  { id: 'left-mid', edge: [{ x: 300, y: 428 }, { x: 520, y: 420 }], scale: 0.68 },
  { id: 'left-low', edge: [{ x: 330, y: 530 }, { x: 530, y: 536 }], scale: 0.72 },
  { id: 'right-high', edge: [{ x: 700, y: 344 }, { x: 820, y: 338 }], scale: 0.64 },
  { id: 'right-mid', edge: [{ x: 710, y: 452 }, { x: 880, y: 446 }], scale: 0.68 },
  { id: 'right-low', edge: [{ x: 700, y: 556 }, { x: 860, y: 560 }], scale: 0.72 },
];

/** The scale of plants on the cliff's crown, just under the skyline: the farthest ground. */
export const CROWN_SCALE = 0.6;

/**
 * Where the light comes from: the sun low over the far ridge on the right of the buttress (sets
 * just right of the cliff, rises farther right), the moon arcing over the open sky between them.
 */
export const WATERFALL_SKY_LAYOUT: SkyLayout = {
  // under the far ridge (y 344–372): the sun rises and sets behind it
  horizonY: 384,
  sunriseX: 1270,
  sunsetX: 1040,
  moonArc: [
    { x: 1300, y: 296 },
    { x: 1150, y: 196 },
    { x: 990, y: 292 },
  ],
  // above the crown woods (the skyline's highest point is y 200), clear of the moon's arc
  stars: { top: 26, depth: 160, gap: { x: 1150, halfW: 190, y0: 150, y1: 340 } },
};

/** Where the portrait crop stays (the falls' right edge, the pool, the setting sun) and its width. */
export const FOCUS: Pt = { x: 760, y: 560 };

export const WATERFALL_AMBIENCE: SceneryAmbience = {
  // the near banks, left of the trail and right of the stream
  dew: [
    { x: 60, y: 770, w: 420, h: 180 },
    { x: 1250, y: 760, w: 320, h: 200 },
  ],
  // the bands on the pool and the cliff foot
  mistBands: [0, 1, 2],
  // the pool's top (y 597) + 140
  veilTo: 737,
};

/** How the planting sheet names each habitat here (`WATERFALL.habitatWords`). */
export const WATERFALL_HABITAT_WORDS: Readonly<Record<Habitat, string>> = {
  water: 'in the plunge pool',
  shore: 'by the pool and the stream',
  meadow: 'on the grassy banks',
  path: 'beside the trail',
  back: 'under and atop the cliff',
  rock: 'on the mossy ledges',
};
