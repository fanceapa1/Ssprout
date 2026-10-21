import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  clampGoalMinutes,
  completionTime,
  elapsedMs,
  formatClock,
  goalMinutesOf,
  isComplete,
  isLongPause,
  isPaused,
  isValidGoalMinutes,
  LONG_PAUSE_MS,
  pausedFor,
  pickWeather,
  progress,
  remainingMs,
  sessionPhase,
} from './session';
import type { ActiveSession, PendingReward } from './state';

const MIN = 60_000;

const session = (over: Partial<ActiveSession> = {}): ActiveSession => ({
  id: 's1',
  goalMs: 25 * MIN,
  startedAt: 1_000_000,
  pausedAt: null,
  pausedTotalMs: 0,
  weather: 'sun',
  ...over,
});

describe('clampGoalMinutes', () => {
  it('clamps to 10–180', () => {
    expect(clampGoalMinutes(0)).toBe(10);
    expect(clampGoalMinutes(-30)).toBe(10);
    expect(clampGoalMinutes(9)).toBe(10);
    expect(clampGoalMinutes(181)).toBe(180);
    expect(clampGoalMinutes(10_000)).toBe(180);
  });

  it('snaps to 5-minute steps', () => {
    expect(clampGoalMinutes(25)).toBe(25);
    expect(clampGoalMinutes(27)).toBe(25);
    expect(clampGoalMinutes(27.5)).toBe(30);
    expect(clampGoalMinutes(33)).toBe(35);
    expect(clampGoalMinutes(178)).toBe(180);
  });

  it('falls back for non-finite input', () => {
    expect(clampGoalMinutes(Number.NaN)).toBe(25);
    expect(clampGoalMinutes(Infinity, 50)).toBe(50);
  });

  it('isValidGoalMinutes accepts only grid values in range', () => {
    expect(isValidGoalMinutes(10)).toBe(true);
    expect(isValidGoalMinutes(180)).toBe(true);
    expect(isValidGoalMinutes(90)).toBe(true);
    expect(isValidGoalMinutes(5)).toBe(false);
    expect(isValidGoalMinutes(27)).toBe(false);
    expect(isValidGoalMinutes(185)).toBe(false);
    expect(isValidGoalMinutes(Number.NaN)).toBe(false);
  });
});

describe('elapsed / remaining maths', () => {
  it('counts wall time since start while running', () => {
    const s = session();
    expect(elapsedMs(s, s.startedAt)).toBe(0);
    expect(elapsedMs(s, s.startedAt + 5 * MIN)).toBe(5 * MIN);
    expect(remainingMs(s, s.startedAt + 5 * MIN)).toBe(20 * MIN);
  });

  it('excludes previous pauses', () => {
    const s = session({ pausedTotalMs: 3 * MIN });
    expect(elapsedMs(s, s.startedAt + 10 * MIN)).toBe(7 * MIN);
  });

  it('freezes during the current pause', () => {
    const s = session({ pausedAt: 1_000_000 + 4 * MIN, pausedTotalMs: 1 * MIN });
    expect(elapsedMs(s, s.startedAt + 4 * MIN)).toBe(3 * MIN);
    expect(elapsedMs(s, s.startedAt + 400 * MIN)).toBe(3 * MIN);
  });

  it('is never negative and remaining never below zero', () => {
    const s = session();
    expect(elapsedMs(s, s.startedAt - 10_000)).toBe(0);
    expect(remainingMs(s, s.startedAt + 999 * MIN)).toBe(0);
  });

  it('goalMinutesOf converts back to minutes', () => {
    expect(goalMinutesOf(session({ goalMs: 90 * MIN }))).toBe(90);
  });
});

describe('isComplete / progress', () => {
  it('completes exactly when studied time reaches the goal', () => {
    const s = session();
    expect(isComplete(s, s.startedAt + 25 * MIN - 1)).toBe(false);
    expect(isComplete(s, s.startedAt + 25 * MIN)).toBe(true);
    expect(isComplete(s, s.startedAt + 26 * MIN)).toBe(true);
  });

  it('paused time delays completion', () => {
    const s = session({ pausedTotalMs: 10 * MIN });
    expect(isComplete(s, s.startedAt + 30 * MIN)).toBe(false);
    expect(isComplete(s, s.startedAt + 35 * MIN)).toBe(true);
  });

  it('never completes while paused short of the goal', () => {
    const s = session({ pausedAt: 1_000_000 + 5 * MIN });
    expect(isComplete(s, s.startedAt + 1000 * MIN)).toBe(false);
  });

  it('progress goes 0..1 and clamps', () => {
    const s = session({ goalMs: 20 * MIN });
    expect(progress(s, s.startedAt)).toBe(0);
    expect(progress(s, s.startedAt + 5 * MIN)).toBeCloseTo(0.25);
    expect(progress(s, s.startedAt + 20 * MIN)).toBe(1);
    expect(progress(s, s.startedAt + 60 * MIN)).toBe(1);
    expect(progress(session({ goalMs: 0 }), 0)).toBe(1);
  });
});

describe('pauses', () => {
  it('pausedFor is 0 when running and grows while paused', () => {
    expect(pausedFor(session(), 5_000_000)).toBe(0);
    const s = session({ pausedAt: 2_000_000 });
    expect(isPaused(s)).toBe(true);
    expect(isPaused(session())).toBe(false);
    expect(pausedFor(s, 2_000_000 + 7 * MIN)).toBe(7 * MIN);
    expect(pausedFor(s, 1_000)).toBe(0);
  });

  it('detects a long pause at 30 minutes', () => {
    const s = session({ pausedAt: 2_000_000 });
    expect(LONG_PAUSE_MS).toBe(30 * MIN);
    expect(isLongPause(s, 2_000_000 + 30 * MIN - 1)).toBe(false);
    expect(isLongPause(s, 2_000_000 + 30 * MIN)).toBe(true);
    expect(isLongPause(session(), 2_000_000 + 99 * MIN)).toBe(false);
  });
});

describe('completionTime', () => {
  it('is start + paused total + goal while running', () => {
    const s = session({ pausedTotalMs: 2 * MIN });
    expect(completionTime(s)).toBe(s.startedAt + 27 * MIN);
    expect(isComplete(s, completionTime(s)!)).toBe(true);
    expect(isComplete(s, completionTime(s)! - 1)).toBe(false);
  });

  it('is null while paused before the goal, and the real moment if paused after it', () => {
    expect(completionTime(session({ pausedAt: 1_000_000 + 5 * MIN }))).toBeNull();
    const late = session({ pausedAt: 1_000_000 + 40 * MIN });
    expect(completionTime(late)).toBe(1_000_000 + 25 * MIN);
  });
});

describe('sessionPhase', () => {
  const reward: PendingReward = {
    sessionId: 's0',
    goalMinutes: 25,
    tier: 2,
    options: ['a'],
    chosen: null,
    completedAt: 0,
  };
  it('maps state to idle / running / paused / reward', () => {
    expect(sessionPhase({ session: null, pendingReward: null })).toBe('idle');
    expect(sessionPhase({ session: session(), pendingReward: null })).toBe('running');
    expect(sessionPhase({ session: session({ pausedAt: 5 }), pendingReward: null })).toBe('paused');
    expect(sessionPhase({ session: null, pendingReward: reward })).toBe('reward');
  });
});

describe('pickWeather', () => {
  it('is deterministic per seed', () => {
    const a = Array.from({ length: 20 }, (_, i) => pickWeather(createRng(i)));
    const b = Array.from({ length: 20 }, (_, i) => pickWeather(createRng(i)));
    expect(a).toEqual(b);
  });

  it('is roughly sun 60 %, rain 25 %, mist 15 %', () => {
    const rng = createRng('weather');
    const n = 20_000;
    const counts = { sun: 0, rain: 0, mist: 0 };
    for (let i = 0; i < n; i++) counts[pickWeather(rng)]++;
    expect(counts.sun / n).toBeCloseTo(0.6, 1);
    expect(counts.rain / n).toBeCloseTo(0.25, 1);
    expect(counts.mist / n).toBeCloseTo(0.15, 1);
  });

  it('maps the unit interval onto the weights', () => {
    const fixed = (v: number) => ({ ...createRng(1), next: () => v });
    expect(pickWeather(fixed(0))).toBe('sun');
    expect(pickWeather(fixed(0.59))).toBe('sun');
    expect(pickWeather(fixed(0.6))).toBe('rain');
    expect(pickWeather(fixed(0.84))).toBe('rain');
    expect(pickWeather(fixed(0.85))).toBe('mist');
    expect(pickWeather(fixed(0.999))).toBe('mist');
  });
});

describe('formatClock', () => {
  it('formats m:ss and h:mm:ss, rounding up', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(24 * MIN + 13_000)).toBe('24:13');
    expect(formatClock(65 * MIN + 9_000)).toBe('1:05:09');
  });
});
