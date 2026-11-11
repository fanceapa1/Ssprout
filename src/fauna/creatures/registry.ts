/**
 * The creatures, loaded per garden (ADR 0346): `creatures/<kind>.ts` default-exports its
 * `CreatureDef` (ADR 0248), and `sets/creatures-<scenery id>.ts` lists the kinds of that garden's
 * table. Each set is a lazy chunk; the lookups below answer from the sets loaded so far.
 */
import { lazyPainters, type Painters } from '../../scenery/painters';
import type { CreatureDef } from './lib/def';

const SET_MODULES = import.meta.glob<{ default: readonly CreatureDef[] }>('./sets/creatures-*.ts');

/** Kind from a module path (`./koi.ts` → `koi`). */
export function kindFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.ts$/, '');
}

/** Scenery id from a set's path (`./sets/creatures-oasis.ts` → `oasis`). */
export function setIdFromPath(path: string): string {
  return kindFromPath(path).replace(/^creatures-/, '');
}

const DEFS = new Map<string, CreatureDef>();
let sorted: CreatureDef[] = [];

const SETS: ReadonlyMap<string, Painters<readonly CreatureDef[]>> = new Map(
  Object.entries(SET_MODULES).map(([path, load]) => [
    setIdFromPath(path),
    lazyPainters(() =>
      load().then((m) => {
        if (!m?.default) return undefined;
        for (const def of m.default) DEFS.set(def.kind, def);
        sorted = [...DEFS.values()].sort((a, b) => a.kind.localeCompare(b.kind));
        return m.default;
      }),
    ),
  ]),
);

/** Load a garden's creatures (once; a failed load may be tried again). A garden without a set has none. */
export async function loadCreatures(sceneryId: string): Promise<void> {
  await SETS.get(sceneryId)?.load();
}

/** Whether that garden's creatures are here (a garden without a set: always). */
export function creaturesLoaded(sceneryId: string): boolean {
  const set = SETS.get(sceneryId);
  return !set || set.get() !== null;
}

/** Every garden's creatures (the studio, unit tests, `sprout.fauna.loadAll`). */
export async function loadAllCreatures(): Promise<void> {
  await Promise.all([...SETS.values()].map((s) => s.load()));
}

/** Gardens with a creature set. */
export function creatureGardens(): string[] {
  return [...SETS.keys()];
}

/** The creature of this kind, or undefined while no loaded garden brings it (or its module does not exist yet). */
export function creatureDef(kind: string): CreatureDef | undefined {
  return DEFS.get(kind);
}

/** Every loaded creature, by kind (the same array until another set loads). */
export function creatureDefs(): readonly CreatureDef[] {
  return sorted;
}

/** Every loaded kind. */
export function creatureKinds(): string[] {
  return sorted.map((d) => d.kind);
}
