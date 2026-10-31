import type { Biome, Climate, Range, Realm } from './biomes';

/**
 * Which species a scenery offers (ADR 0250), from where they grow. Pure: the species list is a
 * parameter. docs/systems/plants.md › Flora.
 */

/** A scenery's place in the world, for its flora. */
export interface SceneryBiome {
  realm: Realm;
  biomes: Biome[];
  climate: Climate;
  /** a garden people plant: it also offers what is planted in its realm (`range.cultivatedIn`) */
  cultivated: boolean;
  /** species offered here although their range says no (each with a comment why) */
  also?: string[];
  /** species not offered here although their range says yes (each with a comment why) */
  except?: string[];
}

/** Whether a species with this range is offered by a scenery with this profile. */
export function growsIn(id: string, range: Range, profile: SceneryBiome): boolean {
  if (profile.except?.includes(id)) return false;
  if (profile.also?.includes(id)) return true;
  const wild =
    range.realms.includes(profile.realm) &&
    range.biomes.some((b) => profile.biomes.includes(b)) &&
    range.climates.includes(profile.climate);
  return wild || (profile.cultivated && (range.cultivatedIn?.includes(profile.realm) ?? false));
}

/** The species a scenery offers, in the given order. */
export function floraOf<S extends { id: string; range: Range }>(all: readonly S[], profile: SceneryBiome): S[] {
  return all.filter((s) => growsIn(s.id, s.range, profile));
}

/** Each scenery's flora, worked out once per scenery: `of(id)` and `grows(speciesId, id)`. */
export function floraLookup<K, S extends { id: string; range: Range }>(
  all: readonly S[],
  profileOf: (id: K) => SceneryBiome,
): { of(id: K): S[]; grows(speciesId: string, id: K): boolean } {
  const cache = new Map<K, { list: S[]; ids: Set<string> }>();
  const get = (id: K) => {
    let hit = cache.get(id);
    if (!hit) {
      const list = floraOf(all, profileOf(id));
      hit = { list, ids: new Set(list.map((s) => s.id)) };
      cache.set(id, hit);
    }
    return hit;
  };
  return { of: (id) => get(id).list, grows: (speciesId, id) => get(id).ids.has(speciesId) };
}
