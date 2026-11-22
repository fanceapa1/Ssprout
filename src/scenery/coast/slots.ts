/**
 * The Greek coast's planting slots (SPEC §3 › Placement). The foreground, the beach and the sea
 * edge take `perspectiveScale(y)`; slots on a terrace, its wall's coping or face take that
 * terrace's lift (`terraceScale`, ADR 0360). docs/systems/scenery.md › Coast › Slots.
 */
import type { Slot } from '../../scene/geometry';
import type { Habitat, Site, SizeClass } from '../../plants/types';
import { terraceScale, type Terrace } from './layout';

/** id, x, y, max size, the terrace it stands on when it is not the ground's, and its site (ADR 0383). */
type SlotSpec = [id: string, x: number, y: number, maxSize: SizeClass, terrace?: Terrace, site?: Site];

const SPECS: Record<Habitat, SlotSpec[]> = {
  // the cove's shallows (the seagrass meadow's large one) and the rock pools in the shelf
  water: [
    ['shallows-1', 262, 680, 'large'],
    ['shallows-2', 476, 706, 'medium'],
    ['shallows-3', 668, 696, 'small'],
    ['shallows-4', 520, 590, 'medium'],
    ['shallows-5', 188, 650, 'small'],
    ['shallows-6', 370, 610, 'medium'],
    ['pool-1', 230, 868, 'small'],
    ['pool-2', 400, 876, 'medium'],
    ['pool-3', 566, 876, 'small'],
  ],
  // the pebble beach between the waterline and the rock shelf, all sea-washed sand (ADR 0383)
  shore: [
    ['beach-1', 160, 796, 'small', undefined, 'beach'],
    ['beach-2', 300, 814, 'large', undefined, 'beach'],
    ['beach-3', 450, 806, 'medium', undefined, 'beach'],
    ['beach-4', 580, 830, 'small', undefined, 'beach'],
    ['beach-5', 236, 772, 'small', undefined, 'beach'],
    // on the sand at the beach's west end, though its id says scrub (ids are kept in saved gardens)
    ['scrub-2', 80, 826, 'small', undefined, 'beach'],
  ],
  // the beds on the three terraces
  meadow: [
    ['top-1', 1020, 548, 'tree', 'top'],
    ['top-2', 1220, 556, 'medium', 'top'],
    ['top-3', 1400, 552, 'small', 'top'],
    ['mid-1', 860, 684, 'large', 'middle'],
    ['mid-2', 1120, 676, 'small', 'middle'],
    ['mid-3', 1300, 680, 'small', 'middle'],
    ['mid-4', 1420, 676, 'small', 'middle'],
    ['mid-5', 1474, 680, 'small', 'middle'],
    ['low-1', 812, 822, 'small', 'lower'],
    ['low-2', 990, 822, 'small', 'lower'],
    ['low-3', 1200, 812, 'medium', 'lower'],
    ['low-4', 1560, 812, 'medium', 'lower'],
  ],
  // beside the gravel path on the terraces; the foreground under the lowest wall is the painting's
  // foot, faded into the margin, so nothing grows there (ADR 0384)
  path: [
    ['path-1', 1040, 822, 'small', 'lower'],
    ['path-2', 940, 684, 'small', 'middle'],
    ['path-3', 846, 822, 'small', 'lower'],
    ['path-4', 882, 822, 'small', 'lower'],
    ['path-5', 1170, 560, 'small', 'top'],
  ],
  // the scrub: the promontory's cliff top right of the olive (a tree), its foot, and the lower terrace's ends
  back: [
    ['scrub-1', 1468, 306, 'tree'],
    ['scrub-3', 1508, 510, 'medium', 'top'],
    ['scrub-4', 1480, 822, 'small', 'lower'],
    ['scrub-5', 752, 838, 'small', 'lower'],
    ['scrub-6', 1300, 834, 'small', 'lower'],
  ],
  // the walls' copings and faces, the splash rocks in the sea, and the bastion's headland ledge (ADR 0383)
  rock: [
    ['wall-1', 1310, 567, 'small', 'top', 'wall'],
    ['wall-2', 1060, 704, 'small', 'middle', 'wall'],
    ['wall-3', 690, 855, 'small', 'lower', 'wall'],
    ['wall-5', 1460, 563, 'small', 'top', 'wall'],
    ['crack-1', 1356, 724, 'small', 'middle', 'wall'],
    ['wall-4', 1110, 842, 'small', 'lower', 'wall'],
    ['crack-2', 1420, 860, 'small', 'lower', 'wall'],
    ['splash-1', 590, 654, 'medium', undefined, 'sea-rock'],
    ['splash-2', 384, 712, 'small', undefined, 'sea-rock'],
    ['splash-3', 190, 702, 'small', undefined, 'sea-rock'],
    ['shelf-1', 744, 726, 'medium', 'middle', 'ledge'],
  ],
};

export const COAST_SLOTS: Slot[] = (Object.keys(SPECS) as Habitat[]).flatMap((habitat) =>
  SPECS[habitat].map(([id, x, y, maxSize, terrace, site]) => ({
    id,
    x,
    y,
    habitat,
    maxSize,
    scale: terraceScale(y, terrace),
    ...(site ? { site } : {}),
  })),
);

/** The terrace each slot stands on (none: the foreground, the beach and the sea edge), for tests and the map. */
export const SLOT_TERRACE: ReadonlyMap<string, Terrace> = new Map(
  Object.values(SPECS)
    .flat()
    .filter((s) => s[4])
    .map((s) => [s[0], s[4]!]),
);
