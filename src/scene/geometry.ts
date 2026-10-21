import type { Habitat, SizeClass } from '../plants/types';
import type { Pt } from '../render/viewport';

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
 * PLACEHOLDER geometry so the renderer has something to show. The scene task replaces every
 * value here (and may move slots to src/scene/slots.ts).
 */
const POND_CENTRE: Pt = { x: 800, y: 560 };
const POND_WOBBLE = [1, 0.94, 1.05, 0.98, 0.9, 1.04, 1.08, 0.97, 1, 0.93, 1.02, 1.06, 0.95, 1, 1.03, 0.96];

export const placeholderScene: SceneGeometry = {
  pond: POND_WOBBLE.map((k, i) => {
    const a = (i / POND_WOBBLE.length) * Math.PI * 2;
    return { x: POND_CENTRE.x + Math.cos(a) * 300 * k, y: POND_CENTRE.y + Math.sin(a) * 115 * k };
  }),
  waterline: 560,
  rocks: [
    { id: 'rock-west', x: 520, y: 600, w: 90, h: 60, perch: true },
    { id: 'rock-east', x: 1090, y: 585, w: 110, h: 70, perch: true },
    { id: 'rock-south', x: 700, y: 690, w: 70, h: 45, perch: false },
  ],
  path: [
    { x: 800, y: 965, rx: 46, ry: 18 },
    { x: 770, y: 900, rx: 42, ry: 16 },
    { x: 810, y: 840, rx: 38, ry: 14 },
    { x: 785, y: 785, rx: 34, ry: 12 },
    { x: 805, y: 735, rx: 30, ry: 11 },
  ],
  pavilion: { x: 1280, y: 260, w: 320, h: 380, lantern: { x: 1260, y: 610 } },
  slots: [
    { id: 'water-1', x: 740, y: 560, habitat: 'water', maxSize: 'medium', scale: 0.9 },
    { id: 'water-2', x: 900, y: 535, habitat: 'water', maxSize: 'medium', scale: 0.85 },
    { id: 'shore-1', x: 560, y: 620, habitat: 'shore', maxSize: 'medium', scale: 0.95 },
    { id: 'shore-2', x: 1050, y: 640, habitat: 'shore', maxSize: 'medium', scale: 0.95 },
    { id: 'meadow-1', x: 300, y: 780, habitat: 'meadow', maxSize: 'large', scale: 1.05 },
    { id: 'meadow-2', x: 1250, y: 800, habitat: 'meadow', maxSize: 'large', scale: 1.05 },
    { id: 'path-1', x: 700, y: 880, habitat: 'path', maxSize: 'small', scale: 1.1 },
    { id: 'path-2', x: 900, y: 930, habitat: 'path', maxSize: 'small', scale: 1.15 },
    { id: 'back-1', x: 380, y: 420, habitat: 'back', maxSize: 'tree', scale: 0.6 },
    { id: 'back-2', x: 1120, y: 410, habitat: 'back', maxSize: 'tree', scale: 0.6 },
    { id: 'rock-1', x: 620, y: 700, habitat: 'rock', maxSize: 'small', scale: 1 },
  ],
  skyBand: { top: 40, bottom: 300 },
};
