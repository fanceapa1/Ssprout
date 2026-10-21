import type { Habitat, SizeClass } from '../plants/types';
import type { Slot } from './geometry';

/**
 * Planting slots (SPEC §3 › Placement). Coordinates are the plant's base point in world units.
 * Each slot's `scale` follows the ground plane's perspective (`perspectiveScale`), so a plant
 * drawn at `size × scale` sits correctly in depth. Canonical plant sizes per size class are in
 * docs/systems/scene.md (`PLANT_SIZES`).
 */

/** Ground-plane depth range: the far bank (y ≈ 400) to the bottom edge (y ≈ 960). */
export const FAR_Y = 400;
export const NEAR_Y = 960;
export const FAR_SCALE = 0.55;
export const NEAR_SCALE = 1.15;

/** Perspective scale of something standing at world y (linear in y, clamped). */
export function perspectiveScale(y: number): number {
  const t = Math.min(1, Math.max(0, (y - FAR_Y) / (NEAR_Y - FAR_Y)));
  return Math.round((FAR_SCALE + (NEAR_SCALE - FAR_SCALE) * t) * 100) / 100;
}

/**
 * Canonical plant sprite box (world units, w × h) for each size class at slot scale 1. Plant
 * agents size `SpeciesDef.size` from this; the slot's `scale` then shrinks or grows it.
 */
export const PLANT_SIZES: Record<SizeClass, { w: number; h: number }> = {
  small: { w: 86, h: 86 },
  medium: { w: 120, h: 160 },
  large: { w: 200, h: 220 },
  tree: { w: 380, h: 460 },
};

type SlotSpec = [id: string, x: number, y: number, maxSize: SizeClass];

const SPECS: Record<Habitat, SlotSpec[]> = {
  // on the open water, clear of the edges and of each other (lilies, lotus)
  water: [
    ['water-1', 600, 560, 'medium'],
    ['water-2', 716, 612, 'medium'],
    ['water-3', 850, 520, 'medium'],
    ['water-4', 952, 612, 'medium'],
    ['water-5', 1064, 548, 'medium'],
    ['water-6', 1160, 600, 'small'],
    ['water-7', 836, 672, 'small'],
  ],
  // the pond's rim, in the gaps between boulders (iris, reeds)
  shore: [
    ['shore-1', 490, 498, 'medium'],
    ['shore-2', 792, 446, 'medium'],
    ['shore-3', 890, 447, 'medium'],
    ['shore-4', 1192, 494, 'medium'],
    ['shore-5', 1262, 636, 'large'],
    ['shore-6', 1146, 704, 'medium'],
    ['shore-7', 934, 730, 'medium'],
    ['shore-8', 652, 712, 'medium'],
    ['shore-9', 446, 618, 'large'],
  ],
  // grassy banks left and right of the pond, and the foreground
  meadow: [
    ['meadow-1', 112, 562, 'large'],
    ['meadow-2', 262, 546, 'large'],
    ['meadow-3', 372, 616, 'medium'],
    ['meadow-4', 196, 668, 'large'],
    ['meadow-5', 330, 734, 'large'],
    ['meadow-6', 124, 822, 'large'],
    ['meadow-7', 498, 802, 'medium'],
    // (kept above the lower-left corner, where the timer slip sits on wide screens)
    ['meadow-8', 432, 812, 'large'],
    ['meadow-9', 1168, 792, 'medium'],
    ['meadow-10', 1324, 748, 'large'],
    ['meadow-11', 1478, 700, 'large'],
    ['meadow-12', 1496, 838, 'large'],
    ['meadow-13', 1350, 900, 'large'],
    ['meadow-14', 1068, 878, 'medium'],
    ['meadow-15', 566, 872, 'medium'],
    ['meadow-16', 1012, 818, 'medium'],
  ],
  // beside the stepping stones (small things that soften the path)
  path: [
    ['path-1', 676, 962, 'small'],
    ['path-2', 904, 936, 'medium'],
    ['path-3', 690, 880, 'medium'],
    ['path-4', 886, 868, 'small'],
    ['path-5', 722, 818, 'small'],
    ['path-6', 874, 792, 'small'],
    ['path-7', 742, 768, 'small'],
  ],
  // the far bank behind the pond: room for tall plants and trees
  back: [
    ['back-1', 70, 452, 'tree'],
    ['back-2', 196, 458, 'large'],
    ['back-3', 532, 438, 'large'],
    ['back-4', 650, 426, 'tree'],
    ['back-5', 842, 420, 'medium'],
    ['back-6', 944, 430, 'tree'],
    ['back-7', 1040, 438, 'large'],
  ],
  // crevices at the feet of boulders (small rock plants, moss flowers)
  rock: [
    ['rock-1', 426, 664, 'small'],
    ['rock-2', 680, 449, 'small'],
    ['rock-3', 1132, 468, 'small'],
    ['rock-4', 1128, 730, 'small'],
    ['rock-5', 1222, 690, 'small'],
    ['rock-6', 552, 702, 'small'],
  ],
};

export const GARDEN_SLOTS: Slot[] = (Object.keys(SPECS) as Habitat[]).flatMap((habitat) =>
  SPECS[habitat].map(([id, x, y, maxSize]) => ({ id, x, y, habitat, maxSize, scale: perspectiveScale(y) })),
);
