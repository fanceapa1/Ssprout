import type { SpeciesDef } from '../plants/types';
import type { GardenState } from './state';

/**
 * Which creatures have moved in (SPEC §4). Tune the thresholds here; ids are the contract
 * with `src/fauna` (one creature module per id).
 */

export type FaunaSpecies = Pick<SpeciesDef, 'pollinators' | 'habitats'>;
export type SpeciesLookup = (id: string) => FaunaSpecies | undefined;

export interface GardenCounts {
  /** plants growing in the garden */
  plants: number;
  /** plants whose species attracts pollinators */
  pollinatorFlowers: number;
  /** plants whose species can grow on the water (lotus, water lily…) */
  waterPlants: number;
}

export interface FaunaUnlock {
  id: string;
  /** short human description of the rule (docs, dev tools) */
  rule: string;
  /** the single quiet line shown when it first appears */
  arrival: string;
  /** false for creatures that are there from the start (no arrival line) */
  announce: boolean;
  unlocked(c: GardenCounts): boolean;
}

export const FAUNA_UNLOCKS: readonly FaunaUnlock[] = [
  {
    id: 'striders',
    rule: 'always',
    arrival: 'Water striders skate across the pond.',
    announce: false,
    unlocked: () => true,
  },
  {
    id: 'dragonfly',
    rule: '2 plants',
    arrival: 'A dragonfly hovers over the water.',
    announce: true,
    unlocked: (c) => c.plants >= 2,
  },
  {
    id: 'koi-1',
    rule: '3 plants',
    arrival: 'A koi has found your pond.',
    announce: true,
    unlocked: (c) => c.plants >= 3,
  },
  {
    id: 'butterflies',
    rule: '4 pollinator flowers',
    arrival: 'Butterflies drift in among the flowers.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 4,
  },
  {
    id: 'bees',
    rule: '6 pollinator flowers',
    arrival: 'Bees have started visiting your flowers.',
    announce: true,
    unlocked: (c) => c.pollinatorFlowers >= 6,
  },
  {
    id: 'koi-2',
    rule: '7 plants',
    arrival: 'A second koi joins the first.',
    announce: true,
    unlocked: (c) => c.plants >= 7,
  },
  {
    id: 'small-birds',
    rule: '8 plants',
    arrival: 'Small birds come to rest on the stones.',
    announce: true,
    unlocked: (c) => c.plants >= 8,
  },
  {
    id: 'frog',
    rule: 'a water plant + 10 plants',
    arrival: 'A frog has settled on a lily pad.',
    announce: true,
    unlocked: (c) => c.waterPlants >= 1 && c.plants >= 10,
  },
  {
    id: 'swallows',
    rule: '14 plants',
    arrival: 'Swallows pass high over the garden.',
    announce: true,
    unlocked: (c) => c.plants >= 14,
  },
  {
    id: 'heron',
    rule: '20 plants',
    arrival: 'A grey heron visits the pond edge.',
    announce: true,
    unlocked: (c) => c.plants >= 20,
  },
  {
    id: 'koi-3',
    rule: '25 plants',
    arrival: 'A third koi glides beneath the lilies.',
    announce: true,
    unlocked: (c) => c.plants >= 25,
  },
];

export const FAUNA_IDS: readonly string[] = FAUNA_UNLOCKS.map((f) => f.id);

/** Plants whose species is unknown (e.g. removed) still count as plants, but not as flowers. */
export function gardenCounts(state: Pick<GardenState, 'plants'>, lookup: SpeciesLookup): GardenCounts {
  let pollinatorFlowers = 0;
  let waterPlants = 0;
  for (const p of state.plants) {
    const def = lookup(p.speciesId);
    if (!def) continue;
    if (def.pollinators) pollinatorFlowers++;
    if (def.habitats.includes('water')) waterPlants++;
  }
  return { plants: state.plants.length, pollinatorFlowers, waterPlants };
}

/** Unlocked creature ids, in table order. */
export function unlockedFauna(state: Pick<GardenState, 'plants'>, lookup: SpeciesLookup): string[] {
  const counts = gardenCounts(state, lookup);
  return FAUNA_UNLOCKS.filter((f) => f.unlocked(counts)).map((f) => f.id);
}

/** Unlocked but not yet announced (`state.faunaSeen`), in table order. */
export function newlyArrived(state: Pick<GardenState, 'plants' | 'faunaSeen'>, lookup: SpeciesLookup): string[] {
  const seen = new Set(state.faunaSeen);
  return unlockedFauna(state, lookup).filter((id) => !seen.has(id));
}

export function faunaUnlock(id: string): FaunaUnlock | undefined {
  return FAUNA_UNLOCKS.find((f) => f.id === id);
}
