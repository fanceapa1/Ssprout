import { describe, expect, it } from 'vitest';
import { compatibleSlots, isCompatible } from '../core/placement';
import { gardenScene } from '../scene/geometry';
import { allSpecies, getSpecies } from './registry';

/**
 * SPEC §2 step 4 / §3 Placement: a species offered in the planting sheet must have at least one
 * slot in the real garden that accepts its habitat and size class, or choosing it leads nowhere.
 *
 * KNOWN_UNPLANTABLE tracks species that currently fail this (a bug, reported in
 * docs/devlog/15-qa-docs.md): the test fails both when a new species cannot be planted and when
 * a listed one becomes plantable, so the list is kept honest.
 */
const KNOWN_UNPLANTABLE: string[] = [];

describe('every species can be planted in the garden', () => {
  it('has a compatible slot for each species (except the tracked bugs)', () => {
    const unplantable = allSpecies()
      .filter((s) => !gardenScene.slots.some((slot) => isCompatible(s, slot)))
      .map((s) => s.id)
      .sort();
    expect(unplantable).toEqual([...KNOWN_UNPLANTABLE].sort());
  });
});

describe('lotus (Q1)', () => {
  const lotus = () => {
    const def = getSpecies('lotus');
    if (!def) throw new Error('lotus missing from the registry');
    return def;
  };

  it('fits the two large open-water slots', () => {
    expect(compatibleSlots(lotus(), gardenScene.slots, []).map((o) => o.slot.id)).toEqual(['water-1', 'water-3']);
  });

  it('has no spot only when seedlings of sessions in progress hold both (the planting sheet then marks it full)', () => {
    expect(compatibleSlots(lotus(), gardenScene.slots, [], new Set(['water-1']))).toHaveLength(1);
    expect(compatibleSlots(lotus(), gardenScene.slots, [], new Set(['water-1', 'water-3']))).toEqual([]);
  });
});
