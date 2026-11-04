/**
 * The oasis's planting slots (SPEC §3 › Placement). The basin terrace's slots take
 * `perspectiveScale(y)`; slots on a raised terrace or a wall's coping take that terrace's lift
 * (`terraceScale`, ADR 0300). docs/systems/scenery.md › Oasis.
 */
import type { Slot } from '../../scene/geometry';
import type { Habitat, SizeClass } from '../../plants/types';
import { terraceScale, type Terrace } from './layout';

/** id, x, y, max size, and the terrace it stands on when it is not the basin's. */
type SlotSpec = [id: string, x: number, y: number, maxSize: SizeClass, terrace?: Terrace];

const SPECS: Record<Habitat, SlotSpec[]> = {
  // the basin's open water, its overflow corner by the sluice, and the oued's shallows
  water: [
    ['basin-1', 620, 575, 'medium'],
    ['basin-2', 760, 540, 'large'],
    ['basin-3', 880, 580, 'medium'],
    ['basin-4', 975, 528, 'medium'],
    ['basin-5', 1040, 582, 'large'],
    ['shallows-1', 1352, 726, 'small'],
    ['shallows-2', 1396, 950, 'small'],
  ],
  // in front of the basin's near face, between the basin and the oued, the seguia's and the oued's banks
  shore: [
    ['rim-1', 610, 690, 'medium'],
    ['rim-2', 750, 684, 'small'],
    ['rim-3', 960, 688, 'small'],
    ['rim-4', 1100, 686, 'medium'],
    ['rim-5', 1236, 622, 'small'],
    ['seguia-1', 520, 756, 'small'],
    ['seguia-2', 300, 808, 'medium'],
    ['seguia-3', 310, 945, 'small'],
    ['oued-1', 1250, 790, 'large'],
    ['oued-2', 1214, 920, 'medium'],
    ['oued-3', 1556, 836, 'large'],
    ['oued-4', 1548, 968, 'small'],
    ['bar-1', 1400, 858, 'small'],
  ],
  // the plots on the basin terrace and the middle terrace
  meadow: [
    ['plot-1', 170, 740, 'small'],
    ['plot-2', 420, 720, 'small'],
    ['plot-3', 150, 880, 'large'],
    ['plot-4', 610, 830, 'medium'],
    ['plot-5', 540, 950, 'large'],
    ['plot-6', 1050, 820, 'large'],
    ['plot-7', 1080, 960, 'medium'],
    ['plot-8', 130, 556, 'small', 'middle'],
    ['plot-9', 320, 552, 'medium', 'middle'],
  ],
  // the foreground sand either side of the footpath to the basin
  path: [
    ['walk-1', 730, 950, 'small'],
    ['walk-2', 920, 940, 'small'],
    ['walk-3', 750, 850, 'small'],
    ['walk-4', 920, 846, 'small'],
    ['walk-5', 770, 760, 'small'],
    ['walk-6', 930, 762, 'small'],
  ],
  // the high terrace under the bluff, the grove's terrace and the palms' floor: a tree at each end
  back: [
    ['high-1', 70, 478, 'tree', 'high'],
    ['high-2', 180, 490, 'medium', 'high'],
    ['grove-1', 1490, 466, 'medium', 'grove'],
    ['palm-1', 1300, 560, 'tree'],
    ['palm-2', 1540, 552, 'small'],
  ],
  // the terrace walls' copings, and the talus at the bluff's foot
  rock: [
    ['wall-1', 400, 494, 'small', 'high'],
    ['wall-2', 60, 600, 'small', 'middle'],
    ['wall-3', 220, 590, 'small', 'middle'],
    ['wall-4', 420, 578, 'small', 'middle'],
    ['wall-5', 1560, 472, 'small', 'grove'],
    ['talus-1', 250, 470, 'small', 'high'],
    ['talus-2', 1040, 472, 'small'],
  ],
};

export const OASIS_SLOTS: Slot[] = (Object.keys(SPECS) as Habitat[]).flatMap((habitat) =>
  SPECS[habitat].map(([id, x, y, maxSize, terrace]) => ({ id, x, y, habitat, maxSize, scale: terraceScale(y, terrace) })),
);

/** The terrace each slot stands on (none: the basin terrace), for tests and the composition map. */
export const SLOT_TERRACE: ReadonlyMap<string, Terrace> = new Map(
  Object.values(SPECS)
    .flat()
    .filter((s) => s[4])
    .map((s) => [s[0], s[4]!]),
);
