/**
 * The registered sceneries. Only the Japanese garden for now; the waterfall registers itself
 * here once it can be painted (S4). docs/systems/scenery.md.
 */
import { DEFAULT_SCENERY, type SceneryId } from './ids';
import { JAPANESE_GARDEN } from './japanese-garden';
import type { Scenery } from './types';

const SCENERIES: ReadonlyMap<SceneryId, Scenery> = new Map([[JAPANESE_GARDEN.id, JAPANESE_GARDEN]]);

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
