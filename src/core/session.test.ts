import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  blockStartMs,
  blockStartsMs,
  clampGoalMinutes,
  completionTime,
  DEFAULT_TASK_NAME,
  elapsedMs,
  formatClock,
  goalMinutesOf,
  growth,
  isComplete,
  isLongPause,
  isPaused,
  isValidGoalMinutes,
  LONG_PAUSE_MS,
  normalizeTaskName,
  pausedFor,
  pickWeather,
  planPositionMs,
  progress,
  remainingMs,
  sessionPhase,
  sessionTimeline,
} from './session';
import { makeSession, MIN, plan, T0 } from './testing';

/** 25 focus · 5 break · 25 focus · 5 break · 30 focus = 90 */
const POMODORO = plan([25, -5, 25, -5, 30]);

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
    expect(isValidGoalMinutes(5)).toBe(false);
    expect(isValidGoalMinutes(27)).toBe(false);
    expect(isValidGoalMinutes(185)).toBe(false);
    expect(isValidGoalMinutes(Number.NaN)).toBe(false);
  });
});

describe('elapsed / plan position / remaining', () => {
  it('counts wall time since start while running', () => {
    const s = makeSession();
    expect(elapsedMs(s, T0)).toBe(0);
    expect(elapsedMs(s, T0 + 5 * MIN)).toBe(5 * MIN);
    expect(remainingMs(s, T0 + 5 * MIN)).toBe(20 * MIN);
  });

  it('excludes previous pauses and freezes during the current one', () => {
    expect(elapsedMs(makeSession({ pausedTotalMs: 3 * MIN }), T0 + 10 * MIN)).toBe(7 * MIN);
    const paused = makeSession({ pausedAt: T0 + 4 * MIN, pausedTotalMs: MIN });
    expect(elapsedMs(paused, T0 + 400 * MIN)).toBe(3 * MIN);
  });

  it('skipped break time moves the plan position forward', () => {
    const s = makeSession({ plan: POMODORO, skippedMs: 3 * MIN });
    expect(planPositionMs(s, T0 + 10 * MIN)).toBe(13 * MIN);
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(77 * MIN);
  });

  it('is never negative and caps at the total', () => {
    const s = makeSession();
    expect(elapsedMs(s, T0 - 10_000)).toBe(0);
    expect(planPositionMs(s, T0 + 999 * MIN)).toBe(25 * MIN);
    expect(remainingMs(s, T0 + 999 * MIN)).toBe(0);
  });

  it('goalMinutesOf converts back to minutes', () => {
    expect(goalMinutesOf(makeSession({ plan: POMODORO }))).toBe(90);
  });
});

describe('isComplete / progress', () => {
  it('completes exactly when the plan position reaches the total', () => {
    const s = makeSession();
    expect(isComplete(s, T0 + 25 * MIN - 1)).toBe(false);
    expect(isComplete(s, T0 + 25 * MIN)).toBe(true);
  });

  it('paused time delays completion; skipped time brings it forward', () => {
    expect(isComplete(makeSession({ pausedTotalMs: 10 * MIN }), T0 + 30 * MIN)).toBe(false);
    expect(isComplete(makeSession({ pausedTotalMs: 10 * MIN }), T0 + 35 * MIN)).toBe(true);
    const skipped = makeSession({ plan: POMODORO, skippedMs: 10 * MIN });
    expect(isComplete(skipped, T0 + 80 * MIN)).toBe(true);
    expect(isComplete(skipped, T0 + 80 * MIN - 1)).toBe(false);
  });

  it('never completes while paused short of the end', () => {
    expect(isComplete(makeSession({ pausedAt: T0 + 5 * MIN }), T0 + 1000 * MIN)).toBe(false);
  });

  it('progress goes 0..1 of the whole plan', () => {
    const s = makeSession({ plan: plan([20]) });
    expect(progress(s, T0)).toBe(0);
    expect(progress(s, T0 + 5 * MIN)).toBeCloseTo(0.25);
    expect(progress(s, T0 + 60 * MIN)).toBe(1);
    expect(progress(makeSession({ goalMs: 0 }), T0)).toBe(1);
  });
});

describe('pauses', () => {
  it('pausedFor is 0 when running and grows while paused', () => {
    expect(pausedFor(makeSession(), T0 + 5 * MIN)).toBe(0);
    const s = makeSession({ pausedAt: T0 + MIN });
    expect(isPaused(s)).toBe(true);
    expect(isPaused(makeSession())).toBe(false);
    expect(pausedFor(s, T0 + 8 * MIN)).toBe(7 * MIN);
    expect(pausedFor(s, T0)).toBe(0);
  });

  it('detects a long pause at 30 minutes', () => {
    const s = makeSession({ pausedAt: T0 });
    expect(LONG_PAUSE_MS).toBe(30 * MIN);
    expect(isLongPause(s, T0 + 30 * MIN - 1)).toBe(false);
    expect(isLongPause(s, T0 + 30 * MIN)).toBe(true);
    expect(isLongPause(makeSession(), T0 + 99 * MIN)).toBe(false);
  });
});

describe('completionTime', () => {
  it('is start + paused + total − skipped while running', () => {
    const s = makeSession({ plan: POMODORO, pausedTotalMs: 2 * MIN, skippedMs: 4 * MIN });
    expect(completionTime(s)).toBe(T0 + 88 * MIN);
    expect(isComplete(s, completionTime(s)!)).toBe(true);
    expect(isComplete(s, completionTime(s)! - 1)).toBe(false);
  });

  it('is null while paused before the end, and the real moment if paused after it', () => {
    expect(completionTime(makeSession({ pausedAt: T0 + 5 * MIN }))).toBeNull();
    expect(completionTime(makeSession({ pausedAt: T0 + 40 * MIN }))).toBe(T0 + 25 * MIN);
  });
});

describe('blocks', () => {
  it('blockStartsMs / blockStartMs', () => {
    expect(blockStartsMs(POMODORO)).toEqual([0, 25 * MIN, 30 * MIN, 55 * MIN, 60 * MIN]);
    expect(blockStartMs(POMODORO, 2)).toBe(30 * MIN);
    expect(blockStartMs(POMODORO, 5)).toBeNull();
    expect(blockStartMs(POMODORO, -1)).toBeNull();
    expect(blockStartMs(POMODORO, 1.5)).toBeNull();
  });
});

describe('sessionTimeline', () => {
  const s = makeSession({ plan: POMODORO });
  const at = (min: number, over = {}) => sessionTimeline({ ...s, ...over }, T0 + min * MIN);

  it('starts in the first focus block with no growth', () => {
    expect(at(0)).toEqual({
      elapsedMs: 0,
      blockIndex: 0,
      block: { kind: 'focus', minutes: 25 },
      blockElapsedMs: 0,
      blockRemainingMs: 25 * MIN,
      totalRemainingMs: 90 * MIN,
      focusDoneMs: 0,
      focusTotalMs: 80 * MIN,
      growth: 0,
      progress: 0,
      watered: false,
      complete: false,
    });
  });

  it('grows only during focus: growth = focused ÷ total focus', () => {
    expect(at(10).growth).toBeCloseTo(10 / 80);
    expect(at(25).growth).toBeCloseTo(25 / 80);
    expect(at(27).growth).toBeCloseTo(25 / 80); // in the break
    expect(at(30).growth).toBeCloseTo(25 / 80);
    expect(at(40).growth).toBeCloseTo(35 / 80);
    expect(at(90).growth).toBe(1);
  });

  it('tracks the current block, its remaining time and the total remaining', () => {
    const t = at(27);
    expect(t.blockIndex).toBe(1);
    expect(t.block.kind).toBe('break');
    expect(t.blockElapsedMs).toBe(2 * MIN);
    expect(t.blockRemainingMs).toBe(3 * MIN);
    expect(t.totalRemainingMs).toBe(63 * MIN);
    expect(t.progress).toBeCloseTo(27 / 90);
    // a block boundary belongs to the next block
    expect(at(25).blockIndex).toBe(1);
    expect(at(30).blockIndex).toBe(2);
  });

  it('reports the last block, full, at the end', () => {
    const t = at(200);
    expect(t.blockIndex).toBe(4);
    expect(t.blockRemainingMs).toBe(0);
    expect(t.totalRemainingMs).toBe(0);
    expect(t.complete).toBe(true);
    expect(t.progress).toBe(1);
  });

  it('watered reflects the current break', () => {
    expect(at(27, { waterings: [1] }).watered).toBe(true);
    expect(at(27, { waterings: [3] }).watered).toBe(false);
    expect(at(10, { waterings: [1] }).watered).toBe(false);
  });

  it('a skipped break jumps straight to the next focus block', () => {
    const t = at(26, { skippedMs: 4 * MIN });
    expect(t.blockIndex).toBe(2);
    expect(t.elapsedMs).toBe(30 * MIN);
    expect(t.growth).toBeCloseTo(25 / 80);
  });

  it('pauses freeze the timeline', () => {
    expect(at(80, { pausedAt: T0 + 10 * MIN }).elapsedMs).toBe(10 * MIN);
  });

  it('growth() mirrors the timeline', () => {
    expect(growth(s, T0 + 40 * MIN)).toBeCloseTo(35 / 80);
  });
});

describe('sessionPhase', () => {
  it('maps state to idle / focus / break / paused', () => {
    const s = makeSession({ plan: POMODORO });
    expect(sessionPhase({ session: null }, T0)).toBe('idle');
    expect(sessionPhase({ session: s }, T0 + MIN)).toBe('focus');
    expect(sessionPhase({ session: s }, T0 + 26 * MIN)).toBe('break');
    expect(sessionPhase({ session: { ...s, pausedAt: T0 + 26 * MIN } }, T0 + 26 * MIN)).toBe('paused');
  });
});

describe('normalizeTaskName', () => {
  it('trims, collapses whitespace and caps at 40 characters', () => {
    expect(normalizeTaskName('  Biology   ch. 4 ')).toBe('Biology ch. 4');
    expect(normalizeTaskName('x'.repeat(50))).toHaveLength(40);
    expect(normalizeTaskName('日本語'.repeat(20))).toBe('日本語'.repeat(20).slice(0, 40));
  });

  it('falls back to "Study session"', () => {
    expect(DEFAULT_TASK_NAME).toBe('Study session');
    expect(normalizeTaskName('   ')).toBe('Study session');
    expect(normalizeTaskName(undefined)).toBe('Study session');
    expect(normalizeTaskName(42)).toBe('Study session');
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
