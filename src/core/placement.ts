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

/**
 * Every slot this species may go into, in slot order, with its current occupant (if any).
 * `held` slots — where another session's seedling is growing (ADR 0150) — are left out: they
 * are occupied, not swappable.
 */
export function compatibleSlots<S extends PlacementSlot>(
  species: PlacementSpecies,
  slots: readonly S[],
  plants: readonly PlantInstance[],
  held: ReadonlySet<string> = new Set(),
): CompatibleSlot<S>[] {
  const occupant = new Map(plants.map((p) => [p.slotId, p]));
  const out: CompatibleSlot<S>[] = [];
  for (const slot of slots) {
    if (held.has(slot.id) || !isCompatible(species, slot)) continue;
    const plant = occupant.get(slot.id);
    out.push(plant ? { slot, occupiedBy: plant } : { slot });
  }
  return out;
}

/** Ids of slots with nothing growing in them (finished plants, and `held` seedlings' slots). */
export function freeSlotIds(slots: readonly PlacementSlot[], plants: readonly PlantInstance[], held: ReadonlySet<string> = new Set()): string[] {
  const used = new Set([...plants.map((p) => p.slotId), ...held]);
  return slots.filter((s) => !used.has(s.id)).map((s) => s.id);
}
