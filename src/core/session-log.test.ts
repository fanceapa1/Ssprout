import { describe, expect, it } from 'vitest';
import {
  backfillLog,
  dayKey,
  dayRange,
  entriesBetween,
  entriesInMonth,
  entriesInWeek,
  entriesOnDay,
  focusedMinutes,
  groupByDay,
  monthRange,
  weekRange,
} from './session-log';
import type { SessionLogEntry } from './state';
import { makePlant } from './testing';

/** Local times, so the tests hold in any timezone. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

const entry = (id: string, startedAt: number, endedAt: number, over: Partial<SessionLogEntry> = {}): SessionLogEntry => ({
  id,
  outcome: 'completed',
  taskName: id,
  speciesId: 'violet',
  slotId: 'meadow-1',
  seed: 1,
  plan: null,
  goalMinutes: 25,
  focusedMinutes: 25,
  startedAt,
  endedAt,
  ...over,
});

// Thursday 22 Oct 2026 … a Monday-to-Sunday week runs 19–25 Oct
const LOG: SessionLogEntry[] = [
  entry('sep', local(2026, 9, 30, 20), local(2026, 9, 30, 21)),
  entry('mon', local(2026, 10, 19, 9), local(2026, 10, 19, 9, 25)),
  entry('thu-am', local(2026, 10, 22, 8), local(2026, 10, 22, 9), { focusedMinutes: 50, goalMinutes: 60 }),
  entry('thu-x', local(2026, 10, 22, 10), local(2026, 10, 22, 10, 12), { outcome: 'cancelled', focusedMinutes: 12 }),
  entry('midnight', local(2026, 10, 22, 23, 40), local(2026, 10, 23, 0, 20)),
  entry('sun', local(2026, 10, 25, 18), local(2026, 10, 25, 18, 30)),
  entry('nov', local(2026, 11, 1, 7), local(2026, 11, 1, 8)),
];
const ids = (es: SessionLogEntry[]) => es.map((e) => e.id);
const THU = local(2026, 10, 22, 15);

describe('ranges (local calendar)', () => {
  it('day, Monday week and month around a time', () => {
    expect(dayRange(THU)).toEqual({ from: local(2026, 10, 22), to: local(2026, 10, 23) });
    expect(weekRange(THU)).toEqual({ from: local(2026, 10, 19), to: local(2026, 10, 26) });
    expect(weekRange(THU, 0)).toEqual({ from: local(2026, 10, 18), to: local(2026, 10, 25) });
    expect(weekRange(local(2026, 10, 19, 0, 0))).toEqual({ from: local(2026, 10, 19), to: local(2026, 10, 26) });
    expect(monthRange(THU)).toEqual({ from: local(2026, 10, 1), to: local(2026, 11, 1) });
    expect(monthRange(local(2026, 12, 31, 23))).toEqual({ from: local(2026, 12, 1), to: local(2027, 1, 1) });
  });

  it('dayKey is the local date', () => {
    expect(dayKey(local(2026, 1, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('queries', () => {
  it('a day holds every session whose span touches it (a session across midnight shows on both days)', () => {
    expect(ids(entriesOnDay(LOG, THU))).toEqual(['thu-am', 'thu-x', 'midnight']);
    expect(ids(entriesOnDay(LOG, local(2026, 10, 23, 12)))).toEqual(['midnight']);
    expect(ids(entriesOnDay(LOG, local(2026, 10, 24, 12)))).toEqual([]);
  });

  it('a week and a month', () => {
    expect(ids(entriesInWeek(LOG, THU))).toEqual(['mon', 'thu-am', 'thu-x', 'midnight', 'sun']);
    expect(ids(entriesInWeek(LOG, THU, { weekStartsOn: 0 }))).toEqual(['mon', 'thu-am', 'thu-x', 'midnight']);
    expect(ids(entriesInMonth(LOG, THU))).toEqual(['mon', 'thu-am', 'thu-x', 'midnight', 'sun']);
    expect(ids(entriesInMonth(LOG, local(2026, 9, 2)))).toEqual(['sep']);
  });

  it('filters by outcome', () => {
    expect(ids(entriesInWeek(LOG, THU, { outcome: 'cancelled' }))).toEqual(['thu-x']);
    expect(ids(entriesBetween(LOG, dayRange(THU), { outcome: 'completed' }))).toEqual(['thu-am', 'midnight']);
  });

  it('ranges are half-open: a session ending exactly at midnight belongs to its own day only', () => {
    const e = entry('late', local(2026, 10, 22, 23), local(2026, 10, 23, 0));
    expect(ids(entriesOnDay([e], local(2026, 10, 23, 1)))).toEqual([]);
    expect(ids(entriesOnDay([e], THU))).toEqual(['late']);
    const instant = entry('instant', local(2026, 10, 23), local(2026, 10, 23));
    expect(ids(entriesOnDay([instant], local(2026, 10, 23, 1)))).toEqual(['instant']);
    const before = entry('early', local(2026, 10, 21, 23), local(2026, 10, 21, 23, 59));
    expect(ids(entriesOnDay([before], THU))).toEqual([]);
  });

  it('groups by the day a session started and sums focused minutes', () => {
    const week = entriesInWeek(LOG, THU);
    const days = groupByDay(week);
    expect([...days.keys()]).toEqual(['2026-10-19', '2026-10-22', '2026-10-25']);
    expect(ids(days.get('2026-10-22')!)).toEqual(['thu-am', 'thu-x', 'midnight']);
    expect(focusedMinutes(week)).toBe(25 + 50 + 12 + 25 + 25);
    expect(focusedMinutes(week, { outcome: 'completed' })).toBe(125);
  });
});

describe('backfillLog', () => {
  it('rebuilds completed entries from finished plants, oldest end first', () => {
    const plants = [
      makePlant({ id: 'b', plantedAt: 2000, completedAt: 5000, sessionMinutes: 50, taskName: 'B' }),
      makePlant({ id: 'a', plantedAt: 1000, completedAt: 1500, sessionMinutes: 10, slotId: 'rock-1' }),
    ];
    expect(backfillLog(plants)).toEqual([
      expect.objectContaining({ id: 'a', outcome: 'completed', plan: null, goalMinutes: 10, focusedMinutes: 10, startedAt: 1000, endedAt: 1500, slotId: 'rock-1', backfilled: true }),
      expect.objectContaining({ id: 'b', taskName: 'B', goalMinutes: 50, endedAt: 5000 }),
    ]);
  });
});
