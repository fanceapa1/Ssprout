import type { SceneryId } from '../core/sceneries';

/**
 * The plant card's note on each species' place in Japanese gardens and culture (SPEC §3a,
 * ADRs 0167, 0251): one `notes/<id>.ts` per species, found by glob. Main thread only.
 */
export interface SpeciesNote {
  /** Two or three plain sentences. */
  note: string;
  /** A note for one garden instead of `note`, for a species shared between sceneries. */
  in?: Partial<Record<SceneryId, string>>;
}

const modules = import.meta.glob<{ default: SpeciesNote }>(['./notes/*.ts', '!./notes/*.test.ts'], { eager: true });

/** Every note by species id (file name = id), sorted by id. */
export const SPECIES_NOTES: Readonly<Record<string, SpeciesNote>> = Object.fromEntries(
  Object.entries(modules)
    .map(([path, mod]) => [path.replace(/^.*\//, '').replace(/\.ts$/, ''), mod.default] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);

/** The note for a species, in a garden if given, or null (fixture and placeholder species have none). */
export function speciesNote(id: string, sceneryId?: SceneryId): string | null {
  return pickNote(SPECIES_NOTES[id], sceneryId);
}

/** The garden's own note when the entry has one, else its note. */
export function pickNote(entry: SpeciesNote | undefined, sceneryId?: SceneryId): string | null {
  if (!entry) return null;
  return (sceneryId && entry.in?.[sceneryId]) || entry.note;
}
