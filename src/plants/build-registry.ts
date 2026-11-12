import type { SpeciesDef } from './types';

/** Species modules by glob path (`./species/<id>.ts`), checked and sorted by id. */
export function buildRegistry(mods: Record<string, { default: SpeciesDef }>): Map<string, SpeciesDef> {
  const map = new Map<string, SpeciesDef>();
  for (const [path, mod] of Object.entries(mods)) {
    const def = mod.default;
    const fileId = path.replace(/^.*\//, '').replace(/\.ts(\?.*)?$/, '');
    if (!def || typeof def !== 'object') throw new Error(`species module ${path} has no default export`);
    if (def.id !== fileId) throw new Error(`species id "${def.id}" must equal its file name "${fileId}"`);
    if (map.has(def.id)) throw new Error(`duplicate species id "${def.id}"`);
    map.set(def.id, def);
  }
  // Stable, deterministic order regardless of glob order.
  return new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
