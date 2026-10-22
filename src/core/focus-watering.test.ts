import { describe, expect, it } from 'vitest';
import {
  dueFocusWaterings,
  FOCUS_WATER_MAX_MS,
  FOCUS_WATER_MIN_MS,
  FOCUS_WATER_TAIL_MS,
  focusWateringTimes,
  nextFocusWateringIn,
} from './session';
import { makeSession, MIN, plan, T0 } from './testing';

/**
 * Automatic focus watering (SPEC §2, ADR 0153): seeded intervals of 4–10 minutes of focused time,
 * never counted down by pauses or breaks, none in the last minute of focus.
 */
describe('focusWateringTimes', () => {
  it('spaces waterings 4–10 focused minutes apart, from the start of focus', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const times = focusWateringTimes(seed, 180 * MIN);
      expect(times.length).toBeGreaterThan(0);
      let prev = 0;
      for (const t of times) {
        expect(t - prev).toBeGreaterThanOrEqual(FOCUS_WATER_MIN_MS - 1);
        expect(t - prev).toBeLessThanOrEqual(FOCUS_WATER_MAX_MS + 1);
        prev = t;
      }
      expect(times.at(-1)!).toBeLessThan(180 * MIN - FOCUS_WATER_TAIL_MS);
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(focusWateringTimes(42, 90 * MIN)).toEqual(focusWateringTimes(42, 90 * MIN));
    expect(focusWateringTimes(42, 90 * MIN)).not.toEqual(focusWateringTimes(43, 90 * MIN));
    // a longer session shares the beginning of the schedule
    expect(focusWateringTimes(42, 180 * MIN).slice(0, focusWateringTimes(42, 90 * MIN).length)).toEqual(focusWateringTimes(42, 90 * MIN));
  });

  it('a 10-minute session gets at most two, never in its last minute', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const times = focusWateringTimes(seed, 10 * MIN);
      expect(times.length).toBeLessThanOrEqual(2);
      for (const t of times) expect(t).toBeLessThan(9 * MIN);
    }
  });
});

describe('due waterings follow focused time only', () => {
  const s = makeSession({ seed: 9, plan: plan([30, -10, 30]), goalMs: 70 * MIN });
  const times = focusWateringTimes(9, 60 * MIN);

  it('counts the scheduled times reached by focused time', () => {
    expect(dueFocusWaterings(s, T0)).toBe(0);
    expect(dueFocusWaterings(s, T0 + times[0]! - 1)).toBe(0);
    expect(dueFocusWaterings(s, T0 + times[0]!)).toBe(1);
    expect(nextFocusWateringIn(s, T0 + times[0]! - 1000)).toBe(1000);
  });

  it('a pause holds the count and the countdown', () => {
    const paused = { ...s, pausedAt: T0 + times[0]! - 2 * MIN };
    expect(dueFocusWaterings(paused, T0 + 500 * MIN)).toBe(0);
    expect(nextFocusWateringIn(paused, T0 + 500 * MIN)).toBe(2 * MIN);
  });

  it('a break holds them too: break time is not focus time', () => {
    const inBreak = T0 + 35 * MIN; // 30 focused, 5 into the break
    const endOfBreak = T0 + 40 * MIN - 1;
    expect(dueFocusWaterings(s, inBreak)).toBe(dueFocusWaterings(s, endOfBreak));
    expect(nextFocusWateringIn(s, inBreak)).toBe(nextFocusWateringIn(s, endOfBreak));
  });

  it('no watering is left once the schedule is used up', () => {
    expect(nextFocusWateringIn(s, T0 + 70 * MIN)).toBeNull();
    expect(dueFocusWaterings(s, T0 + 70 * MIN)).toBe(times.length);
  });
});
