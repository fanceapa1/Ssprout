/**
 * Unlocked rows of a scenery's table (core/fauna-unlocks.ts) → what the fauna system keeps alive
 * (ADR 0248). Rows whose creature module does not exist yet are skipped.
 */
import type { FaunaUnlock } from '../core/fauna-unlocks';
import { creatureDef } from './creatures/registry';
import type { FaunaKind } from './tuning';

export type RosterRow = Pick<FaunaUnlock, 'kind' | 'variant' | 'boost'>;

export interface Roster {
  /** resident kind → its unlocked rows (koi: 3 at 25 plants) */
  residents: Map<FaunaKind, number>;
  /** visiting and drifting kinds that may be scheduled, in table order */
  visitors: Set<FaunaKind>;
  /** kind → the variants its rows name, in table order (none: any) */
  variants: Map<FaunaKind, string[]>;
  /** kinds whose visits come more often */
  boosts: Set<FaunaKind>;
}

export function rosterFor(rows: readonly RosterRow[], has: (kind: string) => boolean = (k) => !!creatureDef(k)): Roster {
  const roster: Roster = { residents: new Map(), visitors: new Set(), variants: new Map(), boosts: new Set() };
  for (const row of rows) {
    if (row.boost) roster.boosts.add(row.boost);
    if (!has(row.kind)) continue;
    const def = creatureDef(row.kind);
    if (def?.role === 'resident') roster.residents.set(row.kind, (roster.residents.get(row.kind) ?? 0) + 1);
    else roster.visitors.add(row.kind);
    if (row.variant) roster.variants.set(row.kind, [...(roster.variants.get(row.kind) ?? []), row.variant]);
  }
  return roster;
}
