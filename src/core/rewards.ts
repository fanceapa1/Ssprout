import type { SpeciesDef, Tier } from '../plants/types';
import type { Rng } from './rng';

/**
 * Reward tiers and offer generation (SPEC §3, ADR 0030). Pure: the species list is a
 * parameter, so this module never imports the plant registry.
 */

/** Lower bound (inclusive) of each tier's goal minutes. */
export const TIER_MIN_MINUTES: Readonly<Record<Tier, number>> = { 1: 10, 2: 25, 3: 50, 4: 90 };
export const OFFER_SIZE = 3;

/** 10–24 → 1 · 25–49 → 2 · 50–89 → 3 · 90+ → 4 (anything below 25 is tier 1). */
export function tierForMinutes(goalMinutes: number): Tier {
  if (goalMinutes >= TIER_MIN_MINUTES[4]) return 4;
  if (goalMinutes >= TIER_MIN_MINUTES[3]) return 3;
  if (goalMinutes >= TIER_MIN_MINUTES[2]) return 2;
  return 1;
}

type OfferSpecies = Pick<SpeciesDef, 'id' | 'tier'>;

const byId = (a: OfferSpecies, b: OfferSpecies): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Up to 3 species ids for a completed session of `tier`.
 *
 * Preference order: earned tier unowned → earned tier owned → next lower tier unowned → next
 * lower tier owned → … down to tier 1. Ids are shuffled within each group, so the result is a
 * pure function of (rng seed, tier, species ids, owned ids) — the input order does not matter.
 * Fewer than 3 come back only when the whole pool (earned tier and below) is smaller.
 */
export function generateOffer(
  rng: Rng,
  tier: Tier,
  species: readonly OfferSpecies[],
  ownedIds: Iterable<string> = [],
  size = OFFER_SIZE,
): string[] {
  const owned = new Set(ownedIds);
  const unique = new Map<string, OfferSpecies>();
  for (const s of species) if (!unique.has(s.id)) unique.set(s.id, s);
  const sorted = [...unique.values()].sort(byId);

  const out: string[] = [];
  for (let t = tier; t >= 1 && out.length < size; t--) {
    const pool = sorted.filter((s) => s.tier === t);
    const fresh = rng.shuffle(pool.filter((s) => !owned.has(s.id)));
    const known = rng.shuffle(pool.filter((s) => owned.has(s.id)));
    for (const s of [...fresh, ...known]) {
      if (out.length >= size) break;
      out.push(s.id);
    }
  }
  return out;
}

/** Species ids currently growing in the garden (pressed flowers do not count as owned). */
export function ownedSpeciesIds(plants: readonly { speciesId: string }[]): Set<string> {
  return new Set(plants.map((p) => p.speciesId));
}
