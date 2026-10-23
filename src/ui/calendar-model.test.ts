import { afterAll, describe, expect, it } from 'vitest';
import { viewOccurrences, type Schedule } from '../core/schedule';
import { createDefaultState, type GardenState, type SessionLogEntry } from '../core/state';
import { makeSession } from '../core/testing';
import {
  calendarItems,
  dayFraction,
  dayMarks,
  dayMinute,
  daySpan,
  daysOf,
  FOLLOW,
  followTarget,
  formatMinutes,
  glideScroll,
  itemsOnDay,
  layoutColumns,
  layoutDay,
  localeWeekStart,
  MIN_BLOCK_MS,
  minuteAt,
  shortTime,
  monthGrid,
  noonOf,
  openingMinute,
  shiftAnchor,
  viewRange,
  wallMinute,
} from './calendar-model';
import { dayRange } from '../core/session-log';

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
    // deliberate (ADR 0183): the calendar follows the browser's own week, as the system calendar does
    expect(localeWeekStart('en-GB')).toBe(1);
    expect(localeWeekStart('en-US')).toBe(0);
    expect(localeWeekStart('fr-FR')).toBe(1);
    expect(localeWeekStart('ja-JP')).toBe(0);
    expect(localeWeekStart('ar-EG')).toBe(6);
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

  it('sessions started in the same instant keep their names in order, whatever their ids', () => {
    const at = local(2026, 10, 22, 16, 10);
    const now = local(2026, 10, 22, 16, 30);
    const mk = (id: string, taskName: string) => makeSession({ id, taskName, startedAt: at, pausedAt: now });
    const state: GardenState = { ...createDefaultState(0), session: null, waiting: [mk('session-k-zz', 'Task 2'), mk('session-k-aa', 'Task 3'), mk('session-k-mm', 'Task 1')] };
    const items = calendarItems(state, [], day, now);
    expect(items.map((i) => i.title)).toEqual(['Task 1', 'Task 2', 'Task 3']);
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

  it('in a week, a plan and a session half an hour apart share the column (they are drawn two lines tall)', () => {
    // "Japanese kanji" planned at 15:40 (time open: 30 min) and a session started at 16:10 used to be
    // laid out as if they did not touch, then drawn over each other (ADR 0183)
    const plan = it_('kanji', at(15, 40), at(16, 10));
    const session = it_('stats', at(16, 10), at(16, 25));
    expect(layoutColumns([plan, session], MIN_BLOCK_MS.day).map((p) => p.cols)).toEqual([1, 1]);
    expect(layoutColumns([plan, session], MIN_BLOCK_MS.week).map((p) => [p.item.id, p.col, p.cols])).toEqual([
      ['kanji', 0, 2],
      ['stats', 1, 2],
    ]);
    // the week's minimum is at least the drawn height of a time line and a title line at 56 px per hour
    expect(((MIN_BLOCK_MS.week / (60 * MIN)) * 56)).toBeGreaterThanOrEqual(38);
  });

  it('a week shows short times ("4:10"); 24-hour clocks are unchanged', () => {
    const t = at(16, 10);
    expect(shortTime(t, new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }))).toBe('4:10');
    expect(shortTime(at(9, 5), new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }))).toBe('9:05');
    expect(shortTime(t, new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }))).toBe('16:10');
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

describe('following now (ADR 0191)', () => {
  // a 540 px window over a 1344 px day (56 px an hour); now leads by 90 minutes (84 px)
  const view = 540;
  const max = 1344 - view;
  const lead = 84;

  it('rests while now is in the comfortable band', () => {
    expect(followTarget(400, 300, view, max, lead)).toBeNull();
    expect(followTarget(300 + view * FOLLOW.to, 300, view, max, lead)).toBeNull();
  });

  it('glides on before now leaves the window, leaving the same lead as when it opened', () => {
    expect(followTarget(300 + view * 0.8, 300, view, max, lead)).toBeCloseTo(300 + view * 0.8 - lead, 6);
    // now above the window (e.g. the window was left low): back up to it
    expect(followTarget(200, 300, view, max, lead)).toBe(116);
  });

  it('never scrolls past the day', () => {
    expect(followTarget(1330, 300, view, max, lead)).toBe(max);
    expect(followTarget(10, 300, view, max, lead)).toBe(0);
    expect(followTarget(1330, max, view, max, lead)).toBeNull();
    expect(followTarget(400, 300, 0, max, lead)).toBeNull();
  });

  it('the glide eases in and out and lands exactly', () => {
    expect(glideScroll(100, 300, 0, 1000)).toBe(100);
    expect(glideScroll(100, 300, 500, 1000)).toBeCloseTo(200, 6);
    expect(glideScroll(100, 300, 100, 1000) - 100).toBeLessThan(10);
    expect(glideScroll(100, 300, 1000, 1000)).toBe(300);
    expect(glideScroll(100, 300, 5000, 1000)).toBe(300);
  });
});

describe('daylight-saving days on the wall-clock face (ADR 0210)', () => {
  // Europe/London 2026: spring forward Sun 29 Mar at 01:00 GMT (01:00–02:00 never happens, a 23 h
  // day); fall back Sun 25 Oct at 02:00 BST (01:00–02:00 happens twice, a 25 h day)
  const spring = '2026-03-29';
  const autumn = '2026-10-25';
  const utc = (m: number, d: number, h: number, min = 0) => Date.UTC(2026, m - 1, d, h, min);

  it('the days are 23 and 25 hours long, but the clock still reads its own minutes', () => {
    const s = dayRange(noonOf(spring));
    const a = dayRange(noonOf(autumn));
    expect(s.to - s.from).toBe(23 * HOUR);
    expect(a.to - a.from).toBe(25 * HOUR);
    // 15:00 on the clock is 14 h after midnight in spring and 16 h in autumn: always minute 900
    expect(local(2026, 3, 29, 15) - s.from).toBe(14 * HOUR);
    expect(local(2026, 10, 25, 15) - a.from).toBe(16 * HOUR);
    expect(wallMinute(local(2026, 3, 29, 15))).toBe(900);
    expect(wallMinute(local(2026, 10, 25, 15))).toBe(900);
    expect(wallMinute(local(2026, 10, 25, 15, 30) + 30_000)).toBe(930.5);
  });

  it('spring: the now line and blocks sit on the hour the clock reads; the skipped hour is an empty band', () => {
    // the now line at 09:00 BST sits on the 9 o'clock line (elapsed time would put it at 8/23)
    expect(dayFraction(local(2026, 3, 29, 9), local(2026, 3, 29, 9), spring).top).toBe(9 / 24);
    expect(dayFraction(local(2026, 3, 29, 9), local(2026, 3, 29, 10), spring)).toEqual({ top: 9 / 24, height: 1 / 24 });
    // the last minute before the change and the first after it: the hour between is skipped
    expect(dayMinute(utc(3, 29, 0, 59), spring)).toBe(59);
    expect(dayMinute(utc(3, 29, 1, 0), spring)).toBe(120);
    // an hour's session across the change is drawn from 00:30 to 02:30, across the empty band
    expect(daySpan(utc(3, 29, 0, 30), utc(3, 29, 1, 30), spring)).toEqual({ from: 30, to: 150 });
  });

  it('autumn: both passes of the repeated hour fold onto one band', () => {
    // 01:15 BST (00:15 UTC) and 01:15 GMT (01:15 UTC), an hour apart, read the same on the clock
    expect(dayMinute(utc(10, 25, 0, 15), autumn)).toBe(75);
    expect(dayMinute(utc(10, 25, 1, 15), autumn)).toBe(75);
    // the now line at 09:00 GMT sits on the 9 o'clock line (elapsed time would put it at 10/25)
    expect(dayFraction(local(2026, 10, 25, 9), local(2026, 10, 25, 9), autumn).top).toBe(9 / 24);
    // a session ending in the second pass "before" it started on the clock keeps its real length
    expect(daySpan(utc(10, 25, 0, 40), utc(10, 25, 1, 10), autumn)).toEqual({ from: 100, to: 130 });
    // one that runs on past the repeated hour is drawn from its start to its end on the clock
    expect(daySpan(utc(10, 25, 0, 30), utc(10, 25, 2, 30), autumn)).toEqual({ from: 90, to: 150 });
  });

  it('blocks that share a band on the face share the column, even an hour apart in elapsed time', () => {
    const first = { id: 'bst', start: utc(10, 25, 0, 15), end: utc(10, 25, 0, 45) };
    const second = { id: 'gmt', start: utc(10, 25, 1, 15), end: utc(10, 25, 1, 45) };
    // by elapsed time they never overlap…
    expect(layoutColumns([first, second]).map((p) => p.cols)).toEqual([1, 1]);
    // …but they are drawn on the same band, so they sit side by side
    const placed = layoutDay([first, second], autumn);
    expect(placed.map((p) => [p.item.id, p.col, p.cols, p.top])).toEqual([
      ['bst', 0, 2, 75 / 1440],
      ['gmt', 1, 2, 75 / 1440],
    ]);
    // on an ordinary day the same layout as layoutColumns, with the drawn minimum
    const day = '2026-10-22';
    const a = { start: local(2026, 10, 22, 9), end: local(2026, 10, 22, 9, 5) };
    const b = { start: local(2026, 10, 22, 9, 20), end: local(2026, 10, 22, 10) };
    expect(layoutDay([a, b], day, MIN_BLOCK_MS.day).map((p) => [p.col, p.cols, p.height])).toEqual(
      layoutColumns([a, b], MIN_BLOCK_MS.day).map((p) => [p.col, p.cols, dayFraction(p.item.start, p.item.end, day, MIN_BLOCK_MS.day).height]),
    );
  });

  it('the day opens at the hour the clock reads, on both changes', () => {
    // now 15:00: open at 13:30 on the clock (elapsed minutes would open at 12:30 in spring, 14:30 in autumn)
    expect(openingMinute([], spring, local(2026, 3, 29, 15))).toBe(13 * 60 + 30);
    expect(openingMinute([], autumn, local(2026, 10, 25, 15))).toBe(13 * 60 + 30);
    // another day's view opens half an hour before its first item, as the clock reads it
    const items = [{ start: local(2026, 10, 25, 10), end: local(2026, 10, 25, 11) }] as never[];
    expect(openingMinute(items, autumn, local(2026, 10, 30, 12))).toBe(9 * 60 + 30);
    const springItems = [{ start: local(2026, 3, 29, 10), end: local(2026, 3, 29, 11) }] as never[];
    expect(openingMinute(springItems, spring, local(2026, 3, 30, 12))).toBe(9 * 60 + 30);
    // a tap on the face gives the time the clock reads there (unchanged: the face is 24 hours)
    expect(minuteAt(9.5 / 24)).toBe(9 * 60 + 30);
  });
});
