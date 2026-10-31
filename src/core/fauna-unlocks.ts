import type { SpeciesDef } from '../plants/types';
import { DEFAULT_SCENERY, type SceneryId } from './sceneries';
import type { GardenState } from './state';

/**
 * Which creatures have moved in (SPEC §4), generic over a scenery's unlock table (ADR 0248). The
 * tables are data in `src/scenery/<id>/fauna.ts`; each row names a creature module in `src/fauna`
 * by `kind`. Each garden unlocks its own wildlife from its own plants (ADR 0240).
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
  /** unique within its table; what `faunaSeen` records (namespaced outside the Japanese garden) */
  id: string;
  /** the creature module it brings (`src/fauna/creatures/<kind>.ts`); rows without one are skipped */
  kind: string;
  /** the form the creature takes in this garden ('aka', 'wagtail'…); none: any */
  variant?: string;
  /** short human description of the rule (docs, dev tools) */
  rule: string;
  /** the single quiet line shown when it first appears */
  arrival: string;
  /** false for creatures that are there from the start (no arrival line) */
  announce: boolean;
  unlocked(c: GardenCounts): boolean;
  /** a kind that visits more often once this row unlocks (the third koi: birds) */
  boost?: string;
}

/** A scenery's unlock rows, in the order they are announced. */
export type FaunaTable = readonly FaunaUnlock[];

/** A garden's plants; `scenery` (the garden on view) picks the default scenery. */
type Garden = Pick<GardenState, 'plants'> & Partial<Pick<GardenState, 'scenery'>>;

const viewed = (state: Garden): SceneryId => state.scenery ?? DEFAULT_SCENERY;

/**
 * Counts for `sceneryId`'s garden. Plants whose species is unknown (e.g. removed) still count as
 * plants, but not as flowers.
 */
export function gardenCounts(state: Garden, lookup: SpeciesLookup, sceneryId: SceneryId = viewed(state)): GardenCounts {
  let plants = 0;
  let pollinatorFlowers = 0;
  let waterPlants = 0;
  for (const p of state.plants) {
    if (p.sceneryId !== sceneryId) continue;
    plants++;
    const def = lookup(p.speciesId);
    if (!def) continue;
    if (def.pollinators) pollinatorFlowers++;
    if (def.habitats.includes('water')) waterPlants++;
  }
  return { plants, pollinatorFlowers, waterPlants };
}

/** The rows of `table` unlocked in `sceneryId`'s garden, in table order. */
export function unlockedFauna(state: Garden, lookup: SpeciesLookup, sceneryId: SceneryId, table: FaunaTable): FaunaUnlock[] {
  const counts = gardenCounts(state, lookup, sceneryId);
  return table.filter((f) => f.unlocked(counts));
}

/**
 * The `state.faunaSeen` entry for a creature announced in a garden: the bare id in the Japanese
 * garden (as before v4), `<scenery>:<id>` elsewhere (ADR 0240).
 */
export function faunaSeenKey(sceneryId: SceneryId, id: string): string {
  return sceneryId === 'japanese-garden' ? id : `${sceneryId}:${id}`;
}

/** Whether a creature has been announced in `sceneryId`'s garden. */
export function faunaSeenIn(state: Pick<GardenState, 'faunaSeen'>, sceneryId: SceneryId, id: string): boolean {
  return state.faunaSeen.includes(faunaSeenKey(sceneryId, id));
}

/** Ids unlocked in `sceneryId`'s garden but not yet announced there, in table order. */
export function newlyArrived(state: Garden & Pick<GardenState, 'faunaSeen'>, lookup: SpeciesLookup, sceneryId: SceneryId, table: FaunaTable): string[] {
  return unlockedFauna(state, lookup, sceneryId, table)
    .map((f) => f.id)
    .filter((id) => !faunaSeenIn(state, sceneryId, id));
}

/** The row with this id, if the table has one. */
export function faunaRow(table: FaunaTable, id: string): FaunaUnlock | undefined {
  return table.find((f) => f.id === id);
}
