import { fitsSize, type SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import type { PlantInstance } from './state';

/**
 * Placement compatibility (SPEC §3 › Placement). A species fits a slot when the slot's habitat
 * is one the species likes and the species' size class is at most the slot's `maxSize`
 * (small < medium < large < tree).
 */

export type PlacementSpecies = Pick<SpeciesDef, 'habitats' | 'sizeClass'>;
export type PlacementSlot = Pick<Slot, 'id' | 'habitat' | 'maxSize'>;

export function isCompatible(species: PlacementSpecies, slot: Omit<PlacementSlot, 'id'>): boolean {
  return species.habitats.includes(slot.habitat) && fitsSize(species.sizeClass, slot.maxSize);
}

export interface CompatibleSlot<S extends PlacementSlot = Slot> {
  slot: S;
  /** The plant currently growing there; choosing this slot swaps it into the herbarium. */
  occupiedBy?: PlantInstance;
}

/** Every slot this species may go into, in slot order, with its current occupant (if any). */
export function compatibleSlots<S extends PlacementSlot>(
  species: PlacementSpecies,
  slots: readonly S[],
  plants: readonly PlantInstance[],
): CompatibleSlot<S>[] {
  const occupant = new Map(plants.map((p) => [p.slotId, p]));
  const out: CompatibleSlot<S>[] = [];
  for (const slot of slots) {
    if (!isCompatible(species, slot)) continue;
    const plant = occupant.get(slot.id);
    out.push(plant ? { slot, occupiedBy: plant } : { slot });
  }
  return out;
}

/** Ids of slots with nothing growing in them. */
export function freeSlotIds(slots: readonly PlacementSlot[], plants: readonly PlantInstance[]): string[] {
  const used = new Set(plants.map((p) => p.slotId));
  return slots.filter((s) => !used.has(s.id)).map((s) => s.id);
}
