import { describe, expect, it } from 'vitest';
import {
  FAUNA_IDS,
  FAUNA_UNLOCKS,
  faunaUnlock,
  gardenCounts,
  newlyArrived,
  unlockedFauna,
  type FaunaSpecies,
} from './fauna-unlocks';
import type { PlantInstance } from './state';

const SPECIES: Record<string, FaunaSpecies> = {
  grass: { pollinators: false, habitats: ['meadow'] },
  flower: { pollinators: true, habitats: ['meadow', 'path'] },
  lotus: { pollinators: true, habitats: ['water'] },
};
const lookup = (id: string) => SPECIES[id];

const plants = (n: number, speciesId = 'grass'): PlantInstance[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${speciesId}-${i}`,
    speciesId,
    slotId: `slot-${speciesId}-${i}`,
    taskName: 'Task',
    completedAt: 0,
    seed: i,
    plantedAt: 0,
    sessionMinutes: 25,
  }));
const garden = (...groups: PlantInstance[][]) => ({ plants: groups.flat(), faunaSeen: [] as string[] });
const unlocked = (...groups: PlantInstance[][]) => unlockedFauna(garden(...groups), lookup);

describe('fauna unlock table', () => {
  it('has the contract ids in SPEC order', () => {
    expect(FAUNA_IDS).toEqual([
      'striders',
      'dragonfly',
      'koi-1',
      'butterflies',
      'bees',
      'koi-2',
      'small-birds',
      'frog',
      'swallows',
      'heron',
      'koi-3',
    ]);
  });

  it('every creature has an arrival line; only striders are silent', () => {
    for (const f of FAUNA_UNLOCKS) expect(f.arrival.length).toBeGreaterThan(5);
    expect(FAUNA_UNLOCKS.filter((f) => !f.announce).map((f) => f.id)).toEqual(['striders']);
    expect(faunaUnlock('koi-1')!.arrival).toBe('A koi has found your pond.');
    expect(faunaUnlock('nope')).toBeUndefined();
  });
});

describe('unlockedFauna', () => {
  it('water striders are always there', () => {
    expect(unlocked()).toEqual(['striders']);
  });

  it.each([
    [1, ['striders']],
    [2, ['striders', 'dragonfly']],
    [3, ['striders', 'dragonfly', 'koi-1']],
    [7, ['striders', 'dragonfly', 'koi-1', 'koi-2']],
    [8, ['striders', 'dragonfly', 'koi-1', 'koi-2', 'small-birds']],
    [10, ['striders', 'dragonfly', 'koi-1', 'koi-2', 'small-birds']],
    [14, ['striders', 'dragonfly', 'koi-1', 'koi-2', 'small-birds', 'swallows']],
    [20, ['striders', 'dragonfly', 'koi-1', 'koi-2', 'small-birds', 'swallows', 'heron']],
    [25, ['striders', 'dragonfly', 'koi-1', 'koi-2', 'small-birds', 'swallows', 'heron', 'koi-3']],
  ])('%i non-pollinator plants → %j', (n, ids) => {
    expect(unlocked(plants(n))).toEqual(ids);
  });

  it('thresholds are exact (one below does not unlock)', () => {
    expect(unlocked(plants(2))).toContain('dragonfly');
    expect(unlocked(plants(1))).not.toContain('dragonfly');
    expect(unlocked(plants(24))).not.toContain('koi-3');
    expect(unlocked(plants(19))).not.toContain('heron');
    expect(unlocked(plants(13))).not.toContain('swallows');
  });

  it('butterflies need 4 pollinator flowers, bees 6', () => {
    expect(unlocked(plants(3, 'flower'), plants(10))).not.toContain('butterflies');
    expect(unlocked(plants(4, 'flower'))).toContain('butterflies');
    expect(unlocked(plants(5, 'flower'))).not.toContain('bees');
    expect(unlocked(plants(6, 'flower'))).toEqual(expect.arrayContaining(['butterflies', 'bees']));
  });

  it('the frog needs a water plant and 10 plants', () => {
    expect(unlocked(plants(10))).not.toContain('frog');
    expect(unlocked(plants(1, 'lotus'), plants(8))).not.toContain('frog');
    expect(unlocked(plants(1, 'lotus'), plants(9))).toContain('frog');
  });

  it('unknown species still count as plants but never as flowers', () => {
    const ghosts = plants(6, 'ghost');
    expect(gardenCounts({ plants: ghosts }, lookup)).toEqual({ plants: 6, pollinatorFlowers: 0, waterPlants: 0 });
    expect(unlocked(ghosts)).toContain('koi-1');
    expect(unlocked(ghosts)).not.toContain('bees');
  });
});

describe('newlyArrived', () => {
  it('is unlocked minus already announced', () => {
    const g = { plants: plants(3), faunaSeen: ['striders'] };
    expect(newlyArrived(g, lookup)).toEqual(['dragonfly', 'koi-1']);
    expect(newlyArrived({ ...g, faunaSeen: ['striders', 'dragonfly', 'koi-1'] }, lookup)).toEqual([]);
  });

  it('ignores seen ids that are no longer unlocked (e.g. after swaps)', () => {
    expect(newlyArrived({ plants: [], faunaSeen: ['koi-3'] }, lookup)).toEqual(['striders']);
  });
});
