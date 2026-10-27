/**
 * The sceneries' ids (pure). Schema task S1 moves or re-exports these from `src/core/sceneries.ts`.
 * docs/systems/scenery.md.
 */
export const SCENERY_IDS = ['japanese-garden', 'waterfall'] as const;
export type SceneryId = (typeof SCENERY_IDS)[number];
export const DEFAULT_SCENERY: SceneryId = 'japanese-garden';

export function isSceneryId(v: unknown): v is SceneryId {
  return typeof v === 'string' && (SCENERY_IDS as readonly string[]).includes(v);
}
