import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass } from '../plants/types';
import { compatibleSlots, freeSlotIds, isCompatible } from './placement';
import type { PlantInstance } from './state';

const slot = (id: string, habitat: Habitat, maxSize: SizeClass) => ({ id, habitat, maxSize });
const SLOTS = [
  slot('water-1', 'water', 'medium'),
  slot('shore-1', 'shore', 'medium'),
  slot('meadow-1', 'meadow', 'large'),
  slot('meadow-2', 'meadow', 'small'),
  slot('back-1', 'back', 'tree'),
  slot('rock-1', 'rock', 'small'),
];
const plant = (id: string, slotId: string): PlantInstance => ({
  id,
  speciesId: 'violet',
  sceneryId: 'japanese-garden',
  slotId,
  seed: 1,
  plantedAt: 0,
  sessionMinutes: 10,
  taskName: 'Task',
  completedAt: 0,
});

describe('isCompatible', () => {
  it('requires a liked habitat', () => {
    expect(isCompatible({ habitats: ['water'], sizeClass: 'small' }, slot('x', 'water', 'small'))).toBe(true);
    expect(isCompatible({ habitats: ['water'], sizeClass: 'small' }, slot('x', 'shore', 'tree'))).toBe(false);
  });

  it('orders sizes small < medium < large < tree; maxSize is inclusive', () => {
    const at = (size: SizeClass, max: SizeClass) =>
      isCompatible({ habitats: ['meadow'], sizeClass: size }, slot('x', 'meadow', max));
    expect(at('small', 'small')).toBe(true);
    expect(at('medium', 'small')).toBe(false);
    expect(at('medium', 'large')).toBe(true);
    expect(at('large', 'large')).toBe(true);
    expect(at('tree', 'large')).toBe(false);
    expect(at('tree', 'tree')).toBe(true);
    expect(at('small', 'tree')).toBe(true);
  });
});

describe('compatibleSlots', () => {
  it('lists only slots with a matching habitat and enough room, in slot order', () => {
    const res = compatibleSlots({ habitats: ['meadow', 'rock'], sizeClass: 'small' }, SLOTS, []);
    expect(res.map((r) => r.slot.id)).toEqual(['meadow-1', 'meadow-2', 'rock-1']);
    expect(res.every((r) => r.occupiedBy === undefined)).toBe(true);
  });

  it('keeps trees out of small slots', () => {
    const res = compatibleSlots({ habitats: ['meadow', 'back'], sizeClass: 'tree' }, SLOTS, []);
    expect(res.map((r) => r.slot.id)).toEqual(['back-1']);
  });

  it('includes occupied slots with their occupant (swap candidates)', () => {
    const p = plant('p1', 'meadow-2');
    const res = compatibleSlots({ habitats: ['meadow'], sizeClass: 'small' }, SLOTS, [p, plant('p2', 'water-1')]);
    expect(res).toEqual([{ slot: SLOTS[2] }, { slot: SLOTS[3], occupiedBy: p }]);
    expect('occupiedBy' in res[0]!).toBe(false);
  });

  it('returns nothing when no habitat matches', () => {
    expect(compatibleSlots({ habitats: ['path'], sizeClass: 'small' }, SLOTS, [])).toEqual([]);
  });
});

describe('freeSlotIds', () => {
  it('lists unoccupied slots', () => {
    expect(freeSlotIds(SLOTS, [plant('a', 'water-1'), plant('b', 'back-1')])).toEqual([
      'shore-1',
      'meadow-1',
      'meadow-2',
      'rock-1',
    ]);
  });
});
