import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createDefaultState } from '../core/state';
import { validateState } from '../core/persistence';
import { buildHistory, withHistory } from './fill-history';

const SPECIES = [
  { id: 'violet', tier: 1 as const },
  { id: 'iris', tier: 2 as const },
  { id: 'peony', tier: 3 as const },
];

describe('buildHistory (dev)', () => {
  const now = new Date(2026, 9, 23, 18).getTime();

  it('builds a plausible, valid month of history, all in the past, deterministic per seed', () => {
    const log = buildHistory(createRng(5), SPECIES, { now, days: 30 });
    expect(log.length).toBeGreaterThan(25);
    expect(log.every((e) => e.endedAt <= now && e.startedAt < e.endedAt)).toBe(true);
    expect(log.some((e) => e.outcome === 'cancelled')).toBe(true);
    expect(new Set(log.map((e) => e.id)).size).toBe(log.length);
    expect(buildHistory(createRng(5), SPECIES, { now, days: 30 })).toEqual(log);
    const state = withHistory(createDefaultState(0), log);
    expect(validateState(state).ok).toBe(true);
    expect(state.stats.completed + state.stats.cancelled).toBe(log.length);
    // merging again adds nothing
    expect(withHistory(state, log).log).toHaveLength(log.length);
    expect(log.every((e) => e.sceneryId === 'japanese-garden' && e.slotId === 'meadow-1')).toBe(true);
  });

  it('belongs to the garden it is asked for and takes that garden’s slots, never assuming one', () => {
    const log = buildHistory(createRng(5), SPECIES, { now, days: 10, sceneryId: 'waterfall', slotIds: ['pool-1', 'ledge-1'] });
    expect(log.every((e) => e.sceneryId === 'waterfall')).toBe(true);
    expect(new Set(log.map((e) => e.slotId))).toEqual(new Set(['pool-1', 'ledge-1']));
    expect(() => buildHistory(createRng(5), SPECIES, { now, days: 10, sceneryId: 'waterfall' })).toThrow(/no slots/);
  });
});
