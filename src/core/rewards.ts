import type { SpeciesDef, Tier } from '../plants/types';

/**
 * Tiers (SPEC §3, ADR 0036). The total session length earns a tier; every species with
 * tier ≤ the earned tier can be planted. Pure: the species list is a parameter, so this module
 * never imports the plant registry.
 */

/** Lower bound (inclusive) of each tier's total minutes. */
export const TIER_MIN_MINUTES: Readonly<Record<Tier, number>> = { 1: 10, 2: 25, 3: 50, 4: 90 };

/** 10–24 → 1 · 25–49 → 2 · 50–89 → 3 · 90+ → 4 (anything below 25 is tier 1). */
export function tierForMinutes(totalMinutes: number): Tier {
  if (totalMinutes >= TIER_MIN_MINUTES[4]) return 4;
  if (totalMinutes >= TIER_MIN_MINUTES[3]) return 3;
  if (totalMinutes >= TIER_MIN_MINUTES[2]) return 2;
  return 1;
}

export interface SelectableSpecies<S extends Pick<SpeciesDef, 'id' | 'tier' | 'name'> = SpeciesDef> {
  species: S;
  /** tier above the one earned by this total (shown, not plantable) */
  locked: boolean;
  /** minimum total minutes that unlocks this species' tier */
  requiredMinutes: number;
  /** exactly the earned tier (highlighted) */
  earned: boolean;
}

/**
 * Every species with its availability for a session of `totalMinutes`, ordered: earned tier
 * first, then lower tiers (highest first), then locked tiers (lowest first); by name within a tier.
 */
export function selectableSpecies<S extends Pick<SpeciesDef, 'id' | 'tier' | 'name'>>(
  species: readonly S[],
  totalMinutes: number,
): SelectableSpecies<S>[] {
  const earned = tierForMinutes(totalMinutes);
  const rank = (t: Tier) => (t <= earned ? earned - t : 10 + t);
  return [...species]
    .sort((a, b) => rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1))
    .map((s) => ({
      species: s,
      locked: s.tier > earned,
      requiredMinutes: TIER_MIN_MINUTES[s.tier],
      earned: s.tier === earned,
    }));
}
