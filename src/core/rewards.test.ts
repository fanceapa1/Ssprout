import { describe, expect, it } from 'vitest';
import type { Tier } from '../plants/types';
import { generateOffer, ownedSpeciesIds, tierForMinutes } from './rewards';
import { createRng } from './rng';

const sp = (id: string, tier: Tier) => ({ id, tier });
const POOL = [
  sp('violet', 1),
  sp('clover', 1),
  sp('forget-me-not', 1),
  sp('wild-strawberry', 1),
  sp('iris', 2),
  sp('anemone', 2),
  sp('bellflower', 2),
  sp('dianthus', 2),
  sp('peony', 3),
  sp('weeping-cherry', 4),
];
const tierOf = (id: string) => POOL.find((s) => s.id === id)!.tier;

describe('tierForMinutes', () => {
  it.each([
    [10, 1],
    [24, 1],
    [25, 2],
    [49, 2],
    [50, 3],
    [89, 3],
    [90, 4],
    [180, 4],
    [5, 1],
  ] as const)('%i min → tier %i', (min, tier) => {
    expect(tierForMinutes(min)).toBe(tier);
  });
});

describe('generateOffer', () => {
  it('offers 3 distinct species from the earned tier', () => {
    const offer = generateOffer(createRng(1), 2, POOL);
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    for (const id of offer) expect(tierOf(id)).toBe(2);
  });

  it('is deterministic per seed and independent of input order', () => {
    const a = generateOffer(createRng(7), 1, POOL);
    const b = generateOffer(createRng(7), 1, [...POOL].reverse());
    expect(a).toEqual(b);
    const seeds = new Set(Array.from({ length: 30 }, (_, i) => generateOffer(createRng(i), 1, POOL).join()));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('prefers species the gardener does not own yet', () => {
    const owned = ['iris', 'anemone'];
    for (let seed = 0; seed < 20; seed++) {
      const offer = generateOffer(createRng(seed), 2, POOL, owned);
      expect(offer).toHaveLength(3);
      // bellflower + dianthus are the only unowned tier-2 species: both always offered
      expect(offer).toEqual(expect.arrayContaining(['bellflower', 'dianthus']));
      expect(offer.slice(0, 2).sort()).toEqual(['bellflower', 'dianthus']);
    }
  });

  it('still fills from owned species of the earned tier before dropping a tier', () => {
    const owned = ['iris', 'anemone', 'bellflower', 'dianthus'];
    const offer = generateOffer(createRng(3), 2, POOL, owned);
    expect(offer).toHaveLength(3);
    for (const id of offer) expect(tierOf(id)).toBe(2);
  });

  it('falls back to the next lower tier to fill', () => {
    // tier 3 has only peony → 2 more from tier 2
    const offer = generateOffer(createRng(5), 3, POOL);
    expect(offer[0]).toBe('peony');
    expect(offer.slice(1).map(tierOf)).toEqual([2, 2]);
  });

  it('walks down several tiers when needed', () => {
    const pool = [sp('cherry', 4), sp('violet', 1), sp('clover', 1)];
    const offer = generateOffer(createRng(9), 4, pool);
    expect(offer[0]).toBe('cherry');
    expect(offer.slice(1).sort()).toEqual(['clover', 'violet']);
  });

  it('never offers a higher tier than earned', () => {
    const offer = generateOffer(createRng(2), 1, [sp('violet', 1), sp('peony', 3), sp('iris', 2)]);
    expect(offer).toEqual(['violet']);
  });

  it('returns 2 (or fewer) when the whole pool is too small', () => {
    expect(generateOffer(createRng(1), 2, [sp('a', 2), sp('b', 1)])).toHaveLength(2);
    expect(generateOffer(createRng(1), 2, [sp('a', 2)])).toEqual(['a']);
    expect(generateOffer(createRng(1), 2, [])).toEqual([]);
  });

  it('ignores duplicate species ids in the input', () => {
    const offer = generateOffer(createRng(1), 1, [sp('a', 1), sp('a', 1), sp('b', 1)]);
    expect(offer.sort()).toEqual(['a', 'b']);
  });
});

describe('ownedSpeciesIds', () => {
  it('collects the species growing in the garden', () => {
    expect([...ownedSpeciesIds([{ speciesId: 'a' }, { speciesId: 'b' }, { speciesId: 'a' }])].sort()).toEqual([
      'a',
      'b',
    ]);
  });
});
