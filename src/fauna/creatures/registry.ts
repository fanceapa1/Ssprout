/**
 * Every creature module, found by file name: `creatures/<kind>.ts` default-exports its
 * `CreatureDef` (ADR 0248). Adding a creature adds a file; nothing here changes.
 */
import type { CreatureDef } from './lib/def';

const modules = import.meta.glob<{ default: CreatureDef }>(['./*.ts', '!./registry.ts', '!./*.test.ts', '!./*.studio.ts'], { eager: true });

/** Kind from a module path (`./koi.ts` → `koi`). */
export function kindFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.ts$/, '');
}

const DEFS: ReadonlyMap<string, CreatureDef> = new Map(
  Object.entries(modules)
    .filter(([, m]) => m.default)
    .map(([path, m]) => [kindFromPath(path), m.default] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);

/** The creature of this kind, or undefined while its module does not exist yet. */
export function creatureDef(kind: string): CreatureDef | undefined {
  return DEFS.get(kind);
}

/** Every creature, by kind. */
export function creatureDefs(): CreatureDef[] {
  return [...DEFS.values()];
}

/** Every kind with a module. */
export function creatureKinds(): string[] {
  return [...DEFS.keys()];
}

/** Path → kind pairs as globbed (the registry test checks each file's def names its own kind). */
export function registryEntries(): [string, CreatureDef][] {
  return Object.entries(modules)
    .filter(([, m]) => m.default)
    .map(([p, m]) => [p, m.default]);
}
