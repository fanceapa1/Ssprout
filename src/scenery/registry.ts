/**
 * The registered sceneries: the Japanese garden, and the waterfall behind a dev flag until it is
 * painted (`?dev&scenery=waterfall`). docs/systems/scenery.md.
 */
import { DEFAULT_SCENERY, type SceneryId } from './ids';
import { JAPANESE_GARDEN } from './japanese-garden';
import type { Scenery } from './types';
import { WATERFALL } from './waterfall';

const SCENERIES: ReadonlyMap<SceneryId, Scenery> = new Map([
  [JAPANESE_GARDEN.id, JAPANESE_GARDEN],
  [WATERFALL.id, WATERFALL],
]);

/** The scenery with this id, or the default one when it is not registered (yet). */
export function getScenery(id: SceneryId): Scenery {
  return SCENERIES.get(id) ?? SCENERIES.get(DEFAULT_SCENERY)!;
}

/** Whether a scenery with this id is registered. */
export function hasScenery(id: SceneryId): boolean {
  return SCENERIES.has(id);
}

/** Registered sceneries available under these URL flags, in their order. */
export function sceneries(flags: URLSearchParams = new URLSearchParams()): Scenery[] {
  return [...SCENERIES.values()].filter((s) => s.available(flags)).sort((a, b) => a.order - b.order);
}
