import { describe, expect, it } from 'vitest';
import { isCompatible } from '../core/placement';
import { createRng } from '../core/rng';
import { createDefaultState } from '../core/state';
import type { Habitat, SizeClass, Tier } from '../plants/types';
import { plantRandomly, SAMPLE_TASKS } from './fill-garden';

const sp = (id: string, tier: Tier, habitats: Habitat[], sizeClass: SizeClass) => ({ id, tier, habitats, sizeClass });
const SPECIES = [
  sp('violet', 1, ['meadow', 'rock'], 'small'),
  sp('iris', 2, ['shore'], 'medium'),
  sp('cherry', 4, ['back'], 'tree'),
];
const SLOTS = [
  { id: 'm1', habitat: 'meadow' as const, maxSize: 'large' as const },
  { id: 'm2', habitat: 'meadow' as const, maxSize: 'small' as const },
  { id: 's1', habitat: 'shore' as const, maxSize: 'medium' as const },
  { id: 'b1', habitat: 'back' as const, maxSize: 'tree' as const },
  { id: 'w1', habitat: 'water' as const, maxSize: 'medium' as const },
];

describe('plantRandomly', () => {
  it('fills free compatible slots only, one plant per slot', () => {
    const { state, added } = plantRandomly(createDefaultState(0), createRng(1), SPECIES, SLOTS, 10, 5);
    expect(added).toHaveLength(4); // water slot has no species
    expect(new Set(state.plants.map((p) => p.slotId)).size).toBe(4);
    for (const p of state.plants) {
      const def = SPECIES.find((s) => s.id === p.speciesId)!;
      expect(isCompatible(def, SLOTS.find((s) => s.id === p.slotId)!)).toBe(true);
      expect(p.completedAt).toBe(5);
      expect(p.plantedAt).toBe(5 - p.sessionMinutes * 60_000);
      expect(SAMPLE_TASKS).toContain(p.taskName);
    }
  });

  it('respects n and the tier filter', () => {
    expect(plantRandomly(createDefaultState(0), createRng(1), SPECIES, SLOTS, 2, 0).added).toHaveLength(2);
    const t4 = plantRandomly(createDefaultState(0), createRng(1), SPECIES, SLOTS, 10, 0, 4);
    expect(t4.added.map((p) => p.speciesId)).toEqual(['cherry']);
    expect(t4.added[0]!.sessionMinutes).toBe(90);
  });

  it('never touches occupied slots and returns the same state when nothing fits', () => {
    const base = createDefaultState(0);
    const full = plantRandomly(base, createRng(1), SPECIES, SLOTS, 10, 0).state;
    const again = plantRandomly(full, createRng(2), SPECIES, SLOTS, 10, 0);
    expect(again.added).toEqual([]);
    expect(again.state).toBe(full);
  });

  it('is deterministic per seed', () => {
    const a = plantRandomly(createDefaultState(0), createRng(7), SPECIES, SLOTS, 3, 0);
    const b = plantRandomly(createDefaultState(0), createRng(7), SPECIES, SLOTS, 3, 0);
    expect(a.state).toEqual(b.state);
  });
});
