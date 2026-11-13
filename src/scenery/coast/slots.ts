/**
 * The Greek coast's planting slots (SPEC §3 › Placement). The foreground, the beach and the sea
 * edge take `perspectiveScale(y)`; slots on a terrace, its wall's coping or face take that
 * terrace's lift (`terraceScale`, ADR 0360). docs/systems/scenery.md › Coast › Slots.
 */
import type { Slot } from '../../scene/geometry';
import type { Habitat, SizeClass } from '../../plants/types';
import { terraceScale, type Terrace } from './layout';

/** id, x, y, max size, and the terrace it stands on when it is not the ground's. */
type SlotSpec = [id: string, x: number, y: number, maxSize: SizeClass, terrace?: Terrace];

const SPECS: Record<Habitat, SlotSpec[]> = {
  // the cove's shallows (the seagrass meadow's large one) and the rock pools in the shelf
  water: [
    ['shallows-1', 262, 680, 'large'],
    ['shallows-2', 476, 706, 'medium'],
    ['shallows-3', 668, 696, 'small'],
    ['shallows-4', 520, 590, 'medium'],
    ['shallows-5', 188, 650, 'small'],
    ['shallows-6', 370, 610, 'medium'],
    ['pool-1', 230, 894, 'small'],
    ['pool-2', 400, 904, 'medium'],
    ['pool-3', 566, 888, 'small'],
  ],
  // the pebble beach between the waterline and the rock shelf
  shore: [
    ['beach-1', 160, 796, 'small'],
    ['beach-2', 300, 822, 'large'],
    ['beach-3', 450, 806, 'medium'],
    ['beach-4', 580, 830, 'small'],
    ['beach-5', 236, 772, 'small'],
  ],
  // the beds on the three terraces
  meadow: [
    ['top-1', 1020, 548, 'tree', 'top'],
    ['top-2', 1220, 556, 'medium', 'top'],
    ['top-3', 1400, 552, 'small', 'top'],
    ['mid-1', 880, 684, 'large', 'middle'],
    ['mid-2', 1120, 676, 'small', 'middle'],
    ['mid-3', 1300, 680, 'small', 'middle'],
    ['mid-4', 1420, 676, 'small', 'middle'],
    ['mid-5', 1474, 680, 'small', 'middle'],
    ['low-1', 812, 826, 'small', 'lower'],
    ['low-2', 990, 822, 'small', 'lower'],
    ['low-3', 1200, 812, 'medium', 'lower'],
    ['low-4', 1560, 812, 'medium', 'lower'],
  ],
  // beside the gravel path, on the foreground and the terraces
  path: [
    ['path-1', 790, 975, 'small'],
    ['path-2', 990, 950, 'small'],
    ['path-3', 846, 946, 'small'],
    ['path-4', 870, 792, 'small', 'lower'],
    ['path-5', 1170, 560, 'small', 'top'],
  ],
  // the scrub: the promontory's cliff top right of the olive (a tree), the pine's rock, the foreground's corners
  back: [
    ['scrub-1', 1468, 306, 'tree'],
    ['scrub-2', 80, 826, 'small'],
    ['scrub-3', 1300, 965, 'medium'],
    ['scrub-4', 1580, 960, 'small'],
    ['scrub-5', 700, 985, 'small'],
    ['scrub-6', 1180, 960, 'small'],
  ],
  // the walls' copings and faces, the splash rocks, and the bastion's rock shelf
  rock: [
    ['wall-1', 1310, 567, 'small', 'top'],
    ['wall-2', 1060, 704, 'small', 'middle'],
    ['wall-3', 690, 855, 'small', 'lower'],
    ['wall-5', 1460, 563, 'small', 'top'],
    ['crack-1', 1356, 724, 'small', 'middle'],
    ['wall-4', 1110, 842, 'small', 'lower'],
    ['crack-2', 1420, 860, 'small', 'lower'],
    ['splash-1', 590, 654, 'medium'],
    ['splash-2', 384, 712, 'small'],
    ['splash-3', 190, 702, 'small'],
    ['shelf-1', 744, 726, 'medium', 'middle'],
  ],
};

export const COAST_SLOTS: Slot[] = (Object.keys(SPECS) as Habitat[]).flatMap((habitat) =>
  SPECS[habitat].map(([id, x, y, maxSize, terrace]) => ({ id, x, y, habitat, maxSize, scale: terraceScale(y, terrace) })),
);

/** The terrace each slot stands on (none: the foreground, the beach and the sea edge), for tests and the map. */
export const SLOT_TERRACE: ReadonlyMap<string, Terrace> = new Map(
  Object.values(SPECS)
    .flat()
    .filter((s) => s[4])
    .map((s) => [s[0], s[4]!]),
);
