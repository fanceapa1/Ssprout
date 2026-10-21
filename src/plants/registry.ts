import type { SpeciesDef, Tier } from './types';

/**
 * Species are auto-discovered: drop `src/plants/species/<id>.ts` with a default-exported
 * SpeciesDef and it is registered. The file name must equal the species id.
 */
const modules = import.meta.glob<{ default: SpeciesDef }>(
  ['./species/*.ts', '!./species/*.test.ts', '!./species/*.studio.ts'],
  { eager: true },
);

export function buildRegistry(mods: Record<string, { default: SpeciesDef }>): Map<string, SpeciesDef> {
  const map = new Map<string, SpeciesDef>();
  for (const [path, mod] of Object.entries(mods)) {
    const def = mod.default;
    const fileId = path.replace(/^.*\//, '').replace(/\.ts$/, '');
    if (!def || typeof def !== 'object') throw new Error(`species module ${path} has no default export`);
    if (def.id !== fileId) throw new Error(`species id "${def.id}" must equal its file name "${fileId}"`);
    if (map.has(def.id)) throw new Error(`duplicate species id "${def.id}"`);
    map.set(def.id, def);
  }
  // Stable, deterministic order regardless of glob order.
  return new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const registry = buildRegistry(modules);

export function getSpecies(id: string): SpeciesDef | undefined {
  return registry.get(id);
}

export function allSpecies(): SpeciesDef[] {
  return [...registry.values()];
}

export function speciesByTier(tier: Tier): SpeciesDef[] {
  return allSpecies().filter((s) => s.tier === tier);
}
