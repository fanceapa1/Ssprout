import { isCompatible, type PlacementSlot, type PlacementSpecies } from '../core/placement';
import { TIER_MIN_MINUTES } from '../core/rewards';
import type { Rng } from '../core/rng';
import type { SceneryId } from '../core/sceneries';
import type { GardenState, PlantInstance } from '../core/state';
import type { SpeciesDef, Tier } from '../plants/types';

type FillSpecies = Pick<SpeciesDef, 'id' | 'tier'> & PlacementSpecies;

/** Sample task names for dev-planted gardens. */
export const SAMPLE_TASKS: readonly string[] = [
  'Biology ch. 4',
  'French verbs',
  'Linear algebra',
  'Essay draft',
  'History reading',
  'Organic chemistry',
  'Piano theory',
  'Statistics problem set',
  'Japanese kanji',
  'Thesis outline',
  'Physics lab report',
  'Poetry notes',
];

/**
 * Dev helper behind `window.sprout.addPlants(n, tier?, sceneryId?)`: plant up to `n` finished
 * plants of random species (with sample task names) into random free compatible `slots` of one
 * garden (default: the one on view; no swaps), e.g. for screenshots of a full garden. Pure.
 */
export function plantRandomly(
  state: GardenState,
  rng: Rng,
  species: readonly FillSpecies[],
  slots: readonly PlacementSlot[],
  n: number,
  now: number,
  tier?: Tier,
  sceneryId: SceneryId = state.scenery,
): { state: GardenState; added: PlantInstance[] } {
  const pool = tier === undefined ? species : species.filter((s) => s.tier === tier);
  const used = new Set(state.plants.filter((p) => p.sceneryId === sceneryId).map((p) => p.slotId));
  const ids = new Set(state.plants.map((p) => p.id));
  const added: PlantInstance[] = [];

  for (const slot of rng.shuffle(slots)) {
    if (added.length >= n) break;
    if (used.has(slot.id)) continue;
    const fits = pool.filter((s) => isCompatible(s, slot));
    if (fits.length === 0) continue;
    const def = rng.pick(fits);
    let id: string;
    do id = `dev-${rng.int(0, 0xffffff).toString(36)}`;
    while (ids.has(id));
    ids.add(id);
    used.add(slot.id);
    const sessionMinutes = TIER_MIN_MINUTES[def.tier];
    added.push({
      id,
      speciesId: def.id,
      sceneryId,
      slotId: slot.id,
      seed: rng.int(0, 0xffffffff) >>> 0,
      plantedAt: now - sessionMinutes * 60_000,
      sessionMinutes,
      taskName: rng.pick(SAMPLE_TASKS),
      completedAt: now,
    });
  }
  if (added.length === 0) return { state, added };
  return { state: { ...state, plants: [...state.plants, ...added] }, added };
}
