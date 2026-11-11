import { buildRegistry } from './build-registry';
import { lazySpecies, loadPainter } from './painter';
import type { SpeciesDef, Tier } from './types';

export { buildRegistry } from './build-registry';

/**
 * Species are auto-discovered: drop `src/plants/species/<id>.ts` with a default-exported
 * SpeciesDef and it is registered. The file name must equal the species id.
 *
 * The main thread imports each species' metadata only (`?meta`, ADR 0348): a production build
 * extracts it (src/build/species-meta.ts) and the painter loads per species (`loadPainter`).
 * The dev server and Vitest serve the full module as its metadata, so nothing is lazy there.
 */
const metas = import.meta.glob<{ default: SpeciesDef }>(
  ['./species/*.ts', '!./species/*.test.ts', '!./species/*.studio.ts'],
  { eager: true, query: '?meta' },
);
const loaders = import.meta.glob<SpeciesDef>(
  ['./species/*.ts', '!./species/*.test.ts', '!./species/*.studio.ts'],
  { import: 'default' },
);

/** Metadata modules to definitions: one without `draw` becomes a lazy species (`painter.ts`). */
export function fromMeta(
  mods: Record<string, { default: SpeciesDef }>,
  load: Record<string, () => Promise<SpeciesDef>>,
): Record<string, { default: SpeciesDef }> {
  const out: Record<string, { default: SpeciesDef }> = {};
  for (const [path, mod] of Object.entries(mods)) {
    const def = mod.default;
    const file = path.replace(/\?.*$/, '');
    const loader = load[file];
    out[file] = { default: def && typeof def.draw !== 'function' && loader ? lazySpecies(def, loader) : def };
  }
  return out;
}

const registry = buildRegistry(fromMeta(metas, loaders));

export function getSpecies(id: string): SpeciesDef | undefined {
  return registry.get(id);
}

export function allSpecies(): SpeciesDef[] {
  return [...registry.values()];
}

export function speciesByTier(tier: Tier): SpeciesDef[] {
  return allSpecies().filter((s) => s.tier === tier);
}

/** Start loading these species' painters (unknown ids are skipped); resolves once all settled. */
export function loadPainters(ids: Iterable<string>): Promise<void> {
  const defs = [...new Set(ids)].map((id) => registry.get(id)).filter((d): d is SpeciesDef => !!d);
  return Promise.all(defs.map(loadPainter)).then(() => undefined);
}

/** Every species' painter (the studio paints them synchronously). */
export const loadAllPainters = (): Promise<void> => loadPainters(registry.keys());
