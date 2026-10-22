import { afterAll, describe, expect, it } from 'vitest';
import { viewOccurrences, type Schedule } from '../core/schedule';
import { createDefaultState, type GardenState, type SessionLogEntry } from '../core/state';
import { makeSession } from '../core/testing';
import {
  calendarItems,
  dayFraction,
  dayMarks,
  daysOf,
  formatMinutes,
  itemsOnDay,
  layoutColumns,
  localeWeekStart,
  minuteAt,
  monthGrid,
  noonOf,
  openingMinute,
  shiftAnchor,
  viewRange,
} from './calendar-model';

/** Calendar range queries and layout maths (ADR 0175), in Europe/London for real DST days. */
const TZ = process.env.TZ;
process.env.TZ = 'Europe/London';
afterAll(() => {
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

const MIN = 60_000;
const HOUR = 60 * MIN;
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const key = (t: number) => new Date(t).toISOString();

const entry = (id: string, start: number, minutes: number, over: Partial<SessionLogEntry> = {}): SessionLogEntry => ({
  id,
  outcome: 'completed',
  taskName: id,
  speciesId: 'violet',
  slotId: 'meadow-1',
  seed: 1,
  plan: null,
  goalMinutes: minutes,
  focusedMinutes: minutes,
  startedAt: start,
  endedAt: start + minutes * MIN,
  ...over,
});

describe('ranges and navigation', () => {
  const thu = local(2026, 10, 22, 15);

  it('day, week (Monday or Sunday first) and the month grid’s whole weeks', () => {
    expect(viewRange('day', thu)).toEqual({ from: local(2026, 10, 22), to: local(2026, 10, 23) });
    expect(viewRange('week', thu)).toEqual({ from: local(2026, 10, 19), to: local(2026, 10, 26) });
    expect(viewRange('week', thu, 0)).toEqual({ from: local(2026, 10, 18), to: local(2026, 10, 25) });
    // October 2026 starts on a Thursday and ends on a Saturday
    expect(viewRange('month', thu)).toEqual({ from: local(2026, 9, 28), to: local(2026, 11, 2) });
    const grid = monthGrid(thu);
    expect(grid).toHaveLength(5);
    expect(grid.every((r) => r.length === 7)).toBe(true);
    expect(grid[0]![0]).toBe('2026-09-28');
    expect(grid[4]![6]).toBe('2026-11-01');
    expect(monthGrid(thu, 0)[0]![0]).toBe('2026-09-27');
  });

  it('a week across the autumn DST change is 7 days (169 hours) and lists 7 dates', () => {
    const r = viewRange('week', local(2026, 10, 25, 12));
    expect(r.to - r.from).toBe(7 * 24 * HOUR + HOUR);
    expect(daysOf(r)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  });

  it('prev/next move by a day, a week or a month in calendar terms', () => {
    expect(key(shiftAnchor('day', thu, 1))).toBe(key(local(2026, 10, 23, 12)));
    expect(key(shiftAnchor('week', local(2026, 10, 22, 12), 1))).toBe(key(local(2026, 10, 29, 12)));
    expect(key(shiftAnchor('month', local(2026, 1, 31, 12), 1))).toBe(key(local(2026, 2, 1, 12)));
    expect(key(shiftAnchor('month', thu, -1))).toBe(key(local(2026, 9, 1, 12)));
    expect(new Date(noonOf('2026-10-25')).getHours()).toBe(12);
  });

  it('the week starts as the locale says (Monday when unknown)', () => {
    expect(localeWeekStart('en-GB')).toBe(1);
    expect(localeWeekStart('en-US')).toBe(0);
    expect(localeWeekStart(undefined)).toBe(1);
    expect(localeWeekStart('not a locale!')).toBe(1);
  });
});

describe('calendarItems', () => {
  const day = viewRange('day', local(2026, 10, 22, 12));
  const schedule: Schedule = {
    id: 's',
    name: 'Essay',
    date: '2026-10-22',
    time: '14:00',
    lengthMinutes: 50,
    planId: null,
    repeat: 'none',
    until: null,
    notes: {},
    createdAt: 0,
  };

  it('lists logged sessions, sessions in progress and scheduled occurrences in time order', () => {
    const now = local(2026, 10, 22, 16, 30);
    const state: GardenState = {
      ...createDefaultState(0),
      log: [
        entry('morning', local(2026, 10, 22, 9), 50),
        entry('early-end', local(2026, 10, 22, 11), 12, { outcome: 'cancelled' }),
        entry('yesterday', local(2026, 10, 21, 9), 25),
      ],
      session: makeSession({ id: 'now', startedAt: local(2026, 10, 22, 16), taskName: 'Reading' }),
      waiting: [makeSession({ id: 'held', slotId: 'rock-1', startedAt: local(2026, 10, 22, 15), pausedAt: local(2026, 10, 22, 15, 20) })],
    };
    const occ = viewOccurrences([schedule], day, { now, inProgress: new Set(['now', 'held']), log: state.log });
    const items = calendarItems(state, occ, day, now);
    expect(items.map((i) => [i.id, i.kind, i.status])).toEqual([
      ['morning', 'session', 'completed'],
      ['early-end', 'session', 'cancelled'],
      ['s@2026-10-22', 'scheduled', 'missed'],
      ['held', 'growing', 'waiting'],
      ['now', 'growing', 'growing'],
    ]);
    const growing = items.find((i) => i.id === 'now')!;
    expect(growing.end).toBe(now);
    expect(items.find((i) => i.id === 'held')!.end).toBe(local(2026, 10, 22, 15, 20));
  });

  it('a started occurrence is merged into its session (and shown done once it bloomed)', () => {
    const linked: Schedule = { ...schedule, notes: { '2026-10-22': { sessionId: 'essay-session' } } };
    const state: GardenState = { ...createDefaultState(0), log: [entry('essay-session', local(2026, 10, 22, 14, 10), 50)] };
    const now = local(2026, 10, 22, 18);
    const occ = viewOccurrences([linked], day, { now, inProgress: new Set(), log: state.log });
    const items = calendarItems(state, occ, day, now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'essay-session', kind: 'session', status: 'completed' });
    expect(items[0]!.occurrence).toMatchObject({ key: 's@2026-10-22', status: 'done' });
  });

  it('itemsOnDay splits a week; a session across midnight is on both days', () => {
    const week = viewRange('week', local(2026, 10, 22, 12));
    const state: GardenState = { ...createDefaultState(0), log: [entry('late', local(2026, 10, 21, 23, 30), 60)] };
    const items = calendarItems(state, [], week, local(2026, 10, 23));
    expect(itemsOnDay(items, '2026-10-21').map((i) => i.id)).toEqual(['late']);
    expect(itemsOnDay(items, '2026-10-22').map((i) => i.id)).toEqual(['late']);
    expect(itemsOnDay(items, '2026-10-23')).toEqual([]);
  });
});

describe('timeline layout', () => {
  const at = (h: number, m = 0) => local(2026, 10, 22, h, m);
  const it_ = (id: string, s: number, e: number) => ({ id, start: s, end: e });

  it('non-overlapping items each get the full width', () => {
    const placed = layoutColumns([it_('a', at(9), at(10)), it_('b', at(10), at(11))]);
    expect(placed.map((p) => [p.item.id, p.col, p.cols])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  it('overlapping items sit side by side; a cluster shares its column count; freed columns are reused', () => {
    const placed = layoutColumns([
      it_('a', at(9), at(11)),
      it_('b', at(9, 30), at(10)),
      it_('c', at(10), at(10, 45)),
      it_('d', at(10, 15), at(10, 30)),
      it_('e', at(12), at(13)),
    ]);
    expect(placed.map((p) => [p.item.id, p.col, p.cols])).toEqual([
      ['a', 0, 1 + 2],
      ['b', 1, 3],
      ['c', 1, 3],
      ['d', 2, 3],
      ['e', 0, 1],
    ]);
  });

  it('short items count as minMs long, so tiny blocks do not draw over each other', () => {
    const placed = layoutColumns([it_('a', at(9), at(9, 2)), it_('b', at(9, 10), at(9, 15))], 20 * MIN);
    expect(placed.map((p) => [p.col, p.cols])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('dayFraction places blocks in their day, clipped at midnight, at least minMs tall', () => {
    expect(dayFraction(at(6), at(12), '2026-10-22')).toEqual({ top: 0.25, height: 0.25 });
    const late = dayFraction(local(2026, 10, 21, 23), local(2026, 10, 22, 1), '2026-10-22');
    expect(late).toEqual({ top: 0, height: 1 / 24 });
    expect(dayFraction(at(12), at(12, 1), '2026-10-22', 30 * MIN).height).toBeCloseTo(1 / 48);
  });

  it('opens an hour and a half before now (waking hours), before the first item, or at 8:00', () => {
    const items = [{ start: at(13), end: at(14) }] as never[];
    expect(openingMinute([], '2026-10-22', at(15))).toBe(13 * 60 + 30);
    expect(openingMinute(items, '2026-10-22', local(2026, 10, 30))).toBe(12 * 60 + 30);
    expect(openingMinute([], '2026-10-22', local(2026, 10, 30))).toBe(8 * 60);
    expect(openingMinute([], '2026-10-22', at(23, 30))).toBe(16 * 60); // the window stays in the day
    // at night the day opens on its first item rather than an empty night
    expect(openingMinute(items, '2026-10-22', at(2, 30))).toBe(12 * 60 + 30);
    // a week opens at its earliest item
    const week = [{ start: local(2026, 10, 20, 9), end: local(2026, 10, 20, 10) }, { start: at(13), end: at(14) }] as never[];
    expect(openingMinute(week, ['2026-10-20', '2026-10-21', '2026-10-22'], local(2026, 10, 30))).toBe(8 * 60 + 30);
  });

  it('a tap snaps to the half hour', () => {
    expect(minuteAt(0)).toBe(0);
    expect(minuteAt(14.4 / 24)).toBe(14 * 60);
    expect(minuteAt(14.6 / 24)).toBe(14 * 60 + 30);
    expect(minuteAt(1)).toBe(23 * 60 + 30);
  });
});

describe('month marks', () => {
  it('blooms as dabs, minutes studied, planned and passed occurrences', () => {
    const items = [
      { id: 'a', kind: 'session', status: 'completed', start: local(2026, 10, 22, 9), end: 0, minutes: 50, speciesId: 'violet', seed: 1 },
      { id: 'b', kind: 'session', status: 'cancelled', start: local(2026, 10, 22, 11), end: 0, minutes: 12, speciesId: 'iris', seed: 2 },
      { id: 'c', kind: 'scheduled', status: 'upcoming', start: local(2026, 10, 22, 18), end: 0, minutes: null },
      { id: 'd', kind: 'scheduled', status: 'missed', start: local(2026, 10, 22, 7), end: 0, minutes: null },
      { id: 'e', kind: 'session', status: 'completed', start: local(2026, 10, 23, 9), end: 0, minutes: 25, speciesId: 'iris', seed: 3 },
    ] as never[];
    expect(dayMarks(items, '2026-10-22')).toEqual({
      date: '2026-10-22',
      blooms: [{ speciesId: 'violet', seed: 1 }],
      cancelled: 1,
      minutes: 62,
      planned: 1,
      passed: 1,
      growing: false,
    });
  });

  it('formats minutes quietly', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(125)).toBe('2 h 05');
  });
});
