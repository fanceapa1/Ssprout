import type { Habitat, SizeClass } from '../plants/types';
import type { Pt } from '../render/viewport';
import { GARDEN_SLOTS } from './slots';

export type { Pt };

export interface Slot {
  id: string;
  x: number;
  y: number;
  habitat: Habitat;
  maxSize: SizeClass;
  /** perspective, ~0.55 far … 1.15 near */
  scale: number;
}

export interface Rock {
  id: string;
  /** base centre (where the boulder meets the ground), world units */
  x: number;
  y: number;
  w: number;
  h: number;
  /** birds may land here */
  perch: boolean;
}

export interface Stone {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface SceneGeometry {
  /** closed polygon, world units */
  pond: Pt[];
  /** y used for reflection mirroring (per point: reflect about local shore y) */
  waterline: number;
  rocks: Rock[];
  /** stepping stones */
  path: Stone[];
  pavilion: { x: number; y: number; w: number; h: number; lantern: Pt };
  slots: Slot[];
  /** where flying creatures travel */
  skyBand: { top: number; bottom: number };
}

/**
 * The garden's fixed geometry in world units (1600 × 1000). Composition map and the reasoning
 * behind every number: docs/systems/scene.md. Painting-only details (trees, hills, banks,
 * tufts) live in `layout.ts`; slots in `slots.ts`.
 *
 * The pond is a wide kidney a little right of the world centre. Its right end turns back well
 * short of the pavilion, so the engawa stands on the grassy bank (it used to run under the deck).
 * Clockwise from the far-left corner.
 */
export const POND: Pt[] = [
  // far (back) edge — almost straight, seen nearly edge-on
  { x: 520, y: 470 },
  { x: 618, y: 458 },
  { x: 740, y: 452 },
  { x: 862, y: 453 },
  { x: 982, y: 458 },
  { x: 1082, y: 468 },
  { x: 1150, y: 484 },
  // the right end: a soft bay that turns back toward the viewer
  { x: 1198, y: 504 },
  { x: 1236, y: 532 },
  { x: 1256, y: 566 },
  { x: 1250, y: 602 },
  { x: 1222, y: 636 },
  { x: 1176, y: 664 },
  { x: 1112, y: 688 },
  // near (front) edge, where the path arrives
  { x: 1040, y: 704 },
  { x: 960, y: 712 },
  { x: 880, y: 713 },
  { x: 800, y: 711 },
  { x: 728, y: 704 },
  { x: 660, y: 690 },
  { x: 602, y: 668 },
  { x: 560, y: 642 },
  // left edge
  { x: 518, y: 620 },
  { x: 482, y: 594 },
  { x: 460, y: 562 },
  { x: 464, y: 528 },
  { x: 486, y: 498 },
];

/**
 * Boulders ringing the pond. `x, y` is the base centre; birds perch on `perch` rocks. All
 * rocks are foreground sprites in the `entities` layer (depth = base y) so plants can stand
 * behind or in front of them.
 */
export const ROCKS: Rock[] = [
  { id: 'rock-left-big', x: 506, y: 654, w: 150, h: 88, perch: true },
  { id: 'rock-left-small', x: 600, y: 692, w: 76, h: 40, perch: false },
  { id: 'rock-left-edge', x: 452, y: 574, w: 74, h: 44, perch: false },
  { id: 'rock-back-left', x: 612, y: 466, w: 128, h: 62, perch: true },
  { id: 'rock-back-left-small', x: 708, y: 458, w: 62, h: 30, perch: false },
  { id: 'rock-back-right', x: 1000, y: 467, w: 132, h: 64, perch: true },
  { id: 'rock-back-right-small', x: 1094, y: 476, w: 66, h: 34, perch: false },
  { id: 'rock-lobe', x: 1262, y: 548, w: 104, h: 56, perch: true },
  { id: 'rock-front-right', x: 1060, y: 722, w: 140, h: 78, perch: true },
  { id: 'rock-front-right-small', x: 1186, y: 682, w: 62, h: 34, perch: false },
  { id: 'rock-path', x: 704, y: 720, w: 62, h: 32, perch: false },
];

/**
 * Stepping stones from the bottom centre up to the pond (near → far): broad flat stones set
 * close, winding gently left and right and shrinking with distance, the last one at the water.
 */
export const PATH: Stone[] = [
  { x: 804, y: 968, rx: 92, ry: 27 },
  { x: 760, y: 912, rx: 80, ry: 23 },
  { x: 794, y: 862, rx: 70, ry: 20 },
  { x: 834, y: 818, rx: 61, ry: 17.5 },
  { x: 808, y: 778, rx: 53, ry: 15 },
  { x: 780, y: 744, rx: 45, ry: 13 },
];

/**
 * The pavilion (engawa corner) at the right edge: bounding box of the painted structure, with
 * the hanging lantern under the eave (its glow is the lighting system's night accent).
 */
export const PAVILION = { x: 1290, y: 168, w: 310, h: 450, lantern: { x: 1352, y: 300 } };

/** The far shore line the far-bank reflections mirror about. */
export const WATERLINE = 456;

export const gardenScene: SceneGeometry = {
  pond: POND,
  waterline: WATERLINE,
  rocks: ROCKS,
  path: PATH,
  pavilion: PAVILION,
  slots: GARDEN_SLOTS,
  skyBand: { top: 40, bottom: 300 },
};
