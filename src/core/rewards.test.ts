import { describe, expect, it } from 'vitest';
import type { Tier } from '../plants/types';
import { selectableSpecies, TIER_MIN_MINUTES, tierForMinutes } from './rewards';

const sp = (id: string, tier: Tier, name = id) => ({ id, tier, name });
const POOL = [
  sp('violet', 1, 'Violet'),
  sp('clover', 1, 'Clover'),
  sp('iris', 2, 'Japanese Iris'),
  sp('anemone', 2, 'Anemone'),
  sp('peony', 3, 'Peony'),
  sp('weeping-cherry', 4, 'Weeping Cherry'),
];

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

  it('TIER_MIN_MINUTES are the tier thresholds', () => {
    expect(TIER_MIN_MINUTES).toEqual({ 1: 10, 2: 25, 3: 50, 4: 90 });
  });
});

describe('selectableSpecies', () => {
  const view = (min: number) =>
    selectableSpecies(POOL, min).map((s) => `${s.species.id}:${s.locked ? 'L' : ''}${s.earned ? 'E' : ''}`);

  it('every species with tier ≤ earned is selectable; higher tiers are locked', () => {
    const r = selectableSpecies(POOL, 50);
    expect(r).toHaveLength(POOL.length);
    for (const s of r) expect(s.locked).toBe(s.species.tier > 3);
  });

  it('flags the earned tier and orders earned → lower → locked, by name within a tier', () => {
    expect(view(50)).toEqual(['peony:E', 'anemone:', 'iris:', 'clover:', 'violet:', 'weeping-cherry:L']);
    expect(view(10)).toEqual(['clover:E', 'violet:E', 'anemone:L', 'iris:L', 'peony:L', 'weeping-cherry:L']);
    expect(view(180)).toEqual(['weeping-cherry:E', 'peony:', 'anemone:', 'iris:', 'clover:', 'violet:']);
  });

  it('tells how many minutes unlock each species', () => {
    const byId = Object.fromEntries(selectableSpecies(POOL, 10).map((s) => [s.species.id, s.requiredMinutes]));
    expect(byId).toEqual({ violet: 10, clover: 10, iris: 25, anemone: 25, peony: 50, 'weeping-cherry': 90 });
  });

  it('does not reorder the input array', () => {
    const input = [...POOL];
    selectableSpecies(input, 90);
    expect(input).toEqual(POOL);
  });
});
