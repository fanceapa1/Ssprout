/**
 * The waterfall's planting slots (SPEC §3 › Placement). Ground slots take `perspectiveScale(y)`
 * like the garden's; slots on the cliff take their ledge's scale (`LEDGES`, `CROWN_SCALE`), since
 * a cliff breaks "scale is linear in y" (ADR 0245). docs/systems/scenery.md › Waterfall.
 */
import type { Slot } from '../../scene/geometry';
import { perspectiveScale } from '../../scene/slots';
import type { Habitat, SizeClass } from '../../plants/types';
import { CROWN_SCALE, LEDGES } from './layout';

/** id, x, y, max size, and the scale when it is not the ground's (`perspectiveScale(y)`). */
type SlotSpec = [id: string, x: number, y: number, maxSize: SizeClass, scale?: number];

const ledge = (id: string): number => LEDGES.find((l) => l.id === id)!.scale;

const SPECS: Record<Habitat, SlotSpec[]> = {
  // the calm right half of the plunge pool, clear of the foam at the foot of the falls
  water: [
    ['pool-1', 790, 690, 'large'],
    ['pool-2', 926, 676, 'large'],
    ['pool-3', 520, 668, 'medium'],
    ['pool-4', 680, 712, 'medium'],
  ],
  // the pool's rim and the stream's banks
  shore: [
    ['bank-1', 436, 652, 'medium'],
    ['bank-2', 990, 646, 'medium'],
    ['bank-3', 530, 752, 'medium'],
    ['bank-4', 880, 766, 'medium'],
    ['stream-1', 1040, 790, 'medium'],
    ['stream-2', 1222, 788, 'large'],
    ['stream-3', 1110, 884, 'medium'],
    ['stream-4', 1252, 900, 'medium'],
    ['stream-5', 1000, 980, 'small'],
  ],
  // the grassy banks: left of the trail, between the trail and the stream, right of the stream
  meadow: [
    ['bank-5', 200, 720, 'large'],
    ['bank-6', 350, 790, 'large'],
    ['bank-7', 120, 830, 'medium'],
    ['bank-8', 470, 870, 'medium'],
    ['bank-9', 860, 880, 'medium'],
    ['bank-10', 950, 820, 'medium'],
    ['bank-11', 900, 956, 'large'],
    ['bank-12', 1270, 690, 'medium'],
    ['bank-13', 1390, 770, 'large'],
    ['bank-14', 1480, 870, 'large'],
    ['bank-15', 1360, 950, 'medium'],
    // a framing tree at the right edge, clear of the sun's and the moon's paths
    ['bank-16', 1560, 700, 'tree'],
  ],
  // beside the trail's stepping stones
  path: [
    ['trail-1', 560, 962, 'small'],
    ['trail-2', 790, 940, 'medium'],
    ['trail-3', 560, 820, 'small'],
    ['trail-4', 780, 860, 'small'],
    ['trail-5', 610, 790, 'small'],
    ['trail-6', 760, 790, 'small'],
  ],
  // the cliff's foot and crown, and the far plain under the ridge
  back: [
    ['cliff-1', 90, 662, 'tree'],
    ['cliff-2', 1000, 590, 'large'],
    ['cliff-3', 300, 264, 'large', CROWN_SCALE],
    ['cliff-4', 450, 262, 'medium', CROWN_SCALE],
    ['cliff-5', 790, 240, 'medium', CROWN_SCALE],
    ['bank-17', 1160, 470, 'small'],
    ['bank-18', 1330, 440, 'medium'],
  ],
  // the mossy ledges either side of the falls
  rock: [
    ['ledge-1', 360, 334, 'small', ledge('left-high')],
    ['ledge-2', 500, 330, 'small', ledge('left-high')],
    ['ledge-3', 430, 424, 'medium', ledge('left-mid')],
    ['ledge-4', 320, 428, 'small', ledge('left-mid')],
    ['ledge-5', 380, 532, 'small', ledge('left-low')],
    ['ledge-6', 500, 536, 'small', ledge('left-low')],
    ['ledge-7', 730, 342, 'small', ledge('right-high')],
    ['ledge-8', 820, 448, 'medium', ledge('right-mid')],
    ['ledge-9', 730, 450, 'small', ledge('right-mid')],
    ['ledge-10', 720, 556, 'small', ledge('right-low')],
    ['ledge-11', 840, 560, 'small', ledge('right-low')],
  ],
};

export const WATERFALL_SLOTS: Slot[] = (Object.keys(SPECS) as Habitat[]).flatMap((habitat) =>
  SPECS[habitat].map(([id, x, y, maxSize, scale]) => ({ id, x, y, habitat, maxSize, scale: scale ?? perspectiveScale(y) })),
);
