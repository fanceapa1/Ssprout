/**
 * Scenery ids (pure): the places a garden can grow in. Core keys plants, sessions and slots by
 * them; `src/scenery` holds the places themselves (ADRs 0240, 0241; docs/systems/scenery.md).
 */
export const SCENERY_IDS = ['japanese-garden', 'waterfall'] as const;
export type SceneryId = (typeof SCENERY_IDS)[number];
export const DEFAULT_SCENERY: SceneryId = 'japanese-garden';

export function isSceneryId(v: unknown): v is SceneryId {
  return typeof v === 'string' && (SCENERY_IDS as readonly string[]).includes(v);
}

/** A scenery's slots (none for a scenery that is not registered). */
export type SlotsOf<S> = (sceneryId: SceneryId) => readonly S[];

export interface SlotLookup<S> {
  of: SlotsOf<S>;
  get(sceneryId: SceneryId, slotId: string): S | undefined;
}

/** Slots by scenery and id, indexed once per scenery (main.ts builds it from the scenery registry). */
export function slotLookup<S extends { id: string }>(of: SlotsOf<S>): SlotLookup<S> {
  const index = new Map<SceneryId, Map<string, S>>();
  return {
    of,
    get(sceneryId, slotId) {
      let byId = index.get(sceneryId);
      if (!byId) index.set(sceneryId, (byId = new Map(of(sceneryId).map((s) => [s.id, s]))));
      return byId.get(slotId);
    },
  };
}

/** `slots` as a lookup: a plain list is the default scenery's slots (the others have none). */
export function slotsOfAny<S>(slots: readonly S[] | SlotsOf<S> | undefined): SlotsOf<S> {
  if (typeof slots === 'function') return slots;
  const list = slots ?? [];
  return (id) => (id === DEFAULT_SCENERY ? list : []);
}
