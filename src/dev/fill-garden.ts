import { isCompatible, type PlacementSlot, type PlacementSpecies } from '../core/placement';
import { TIER_MIN_MINUTES } from '../core/rewards';
import type { Rng } from '../core/rng';
import type { GardenState, PlantInstance } from '../core/state';
import type { SpeciesDef, Tier } from '../plants/types';

type FillSpecies = Pick<SpeciesDef, 'id' | 'tier'> & PlacementSpecies;

/**
 * Dev helper behind `window.sprout.addPlants(n, tier?)`: plant up to `n` random species into
 * random free compatible slots (no swaps), e.g. for screenshots of a full garden. Pure.
 */
export function plantRandomly(
  state: GardenState,
  rng: Rng,
  species: readonly FillSpecies[],
  slots: readonly PlacementSlot[],
  n: number,
  now: number,
  tier?: Tier,
): { state: GardenState; added: PlantInstance[] } {
  const pool = tier === undefined ? species : species.filter((s) => s.tier === tier);
  const used = new Set(state.plants.map((p) => p.slotId));
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
    added.push({
      id,
      speciesId: def.id,
      slotId: slot.id,
      seed: rng.int(0, 0xffffffff) >>> 0,
      plantedAt: now,
      sessionMinutes: TIER_MIN_MINUTES[def.tier],
    });
  }
  if (added.length === 0) return { state, added };
  return { state: { ...state, plants: [...state.plants, ...added] }, added };
}
