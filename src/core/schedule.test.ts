import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  dueOccurrences,
  dueUntil,
  expandSchedule,
  expandSchedules,
  isDateKey,
  isTimeOfDay,
  lengthPlanProblem,
  localTime,
  makeSchedule,
  MAX_DUE_MS,
  nextOccurrence,
  occurrenceOn,
  occurrenceStatus,
  occursOn,
  scheduleProblem,
  startPrefill,
  timeOfDay,
  viewOccurrences,
  weekdayOf,
  type Schedule,
  type StatusContext,
} from './schedule';
import { dayRange, monthRange, weekRange } from './session-log';

/**
 * Recurrence, due/missed detection and prefill (ADRs 0171–0173). The tests run in Europe/London so
 * the DST changes are real ones: 2026-03-29 01:00 → 02:00 and 2026-10-25 02:00 → 01:00.
 */
const TZ = process.env.TZ;
// set before the describe blocks build their fixtures (they compute local times when collected)
process.env.TZ = 'Europe/London';
beforeAll(() => {
  process.env.TZ = 'Europe/London';
});
afterAll(() => {
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

const MIN = 60_000;
const HOUR = 60 * MIN;
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  name: 'Biology',
  date: '2026-10-19',
  time: '09:00',
  lengthMinutes: 50,
  planId: null,
  repeat: 'none',
  until: null,
  notes: {},
  createdAt: 0,
  ...over,
});

const ctx = (now: number, over: Partial<StatusContext> = {}): StatusContext => ({ now, inProgress: new Set(), log: [], ...over });
const dates = (list: { date: string }[]) => list.map((o) => o.date);

describe('local calendar maths', () => {
  it('validates dates and times', () => {
    expect(isDateKey('2026-10-23')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-3')).toBe(false);
    expect(isTimeOfDay('09:30')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('9:30')).toBe(false);
    expect(timeOfDay(9 * 60 + 5)).toBe('09:05');
    expect(timeOfDay(-30)).toBe('23:30');
  });

  it('moves by calendar days, across months, years and DST', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-30', '2026-10-23')).toBe(-7);
    expect(weekdayOf('2026-10-23')).toBe(5); // a Friday
  });

  it('local times keep their wall clock across a DST change', () => {
    expect(localTime('2026-03-29', '09:00') - localTime('2026-03-28', '09:00')).toBe(23 * HOUR);
    expect(localTime('2026-10-25', '09:00') - localTime('2026-10-24', '09:00')).toBe(25 * HOUR);
    expect(new Date(localTime('2026-10-25', '09:00')).getHours()).toBe(9);
    // a time inside the spring-forward gap lands just after it
    expect(new Date(localTime('2026-03-29', '01:30')).getHours()).toBe(2);
  });
});

describe('recurrence', () => {
  it('a one-off occurs once', () => {
    const s = schedule();
    expect(occursOn(s, '2026-10-19')).toBe(true);
    expect(occursOn(s, '2026-10-20')).toBe(false);
    expect(dates(expandSchedule(s, monthRange(local(2026, 10, 15))))).toEqual(['2026-10-19']);
    expect(expandSchedule(s, monthRange(local(2026, 11, 15)))).toEqual([]);
  });

  it('daily repeats every day from its date', () => {
    const s = schedule({ repeat: 'daily' });
    const week = expandSchedule(s, weekRange(local(2026, 10, 21)));
    expect(dates(week)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(week.every((o) => new Date(o.at).getHours() === 9)).toBe(true);
    // nothing before its first date
    expect(expandSchedule(s, weekRange(local(2026, 10, 12)))).toEqual([]);
  });

  it('weekdays repeat Monday to Friday', () => {
    const s = schedule({ repeat: 'weekdays', date: '2026-10-17' }); // a Saturday: the first is Monday
    const two = expandSchedule(s, { from: local(2026, 10, 17), to: local(2026, 10, 31) });
    expect(dates(two)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
    ]);
  });

  it('weekly repeats on the weekday of its date', () => {
    const s = schedule({ repeat: 'weekly', date: '2026-10-21' }); // Wednesdays
    expect(dates(expandSchedule(s, monthRange(local(2026, 11, 1))))).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25']);
  });

  it('until ends the series before that date', () => {
    const s = schedule({ repeat: 'daily', until: '2026-10-22' });
    expect(dates(expandSchedule(s, weekRange(local(2026, 10, 21))))).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('exceptions: a skipped day is left out, an edited one carries its own name, time, length and plan', () => {
    const s = schedule({
      repeat: 'daily',
      planId: 'pomodoro',
      lengthMinutes: 60,
      notes: {
        '2026-10-20': { skipped: true },
        '2026-10-21': { name: 'Chemistry', time: '14:30', lengthMinutes: 90, planId: 'deep-work' },
        '2026-10-22': { lengthMinutes: null },
      },
    });
    const week = expandSchedule(s, weekRange(local(2026, 10, 21)));
    expect(dates(week)).not.toContain('2026-10-20');
    const wed = week.find((o) => o.date === '2026-10-21')!;
    expect([wed.name, wed.time, wed.lengthMinutes, wed.planId]).toEqual(['Chemistry', '14:30', 90, 'deep-work']);
    expect(new Date(wed.at).getHours()).toBe(14);
    expect(wed.end - wed.at).toBe(90 * MIN);
    const thu = week.find((o) => o.date === '2026-10-22')!;
    expect([thu.lengthMinutes, thu.planId]).toEqual([null, null]);
    expect(thu.end - thu.at).toBe(30 * MIN); // open length drawn as half an hour
    const fri = week.find((o) => o.date === '2026-10-23')!;
    expect([fri.name, fri.lengthMinutes, fri.planId]).toEqual(['Biology', 60, 'pomodoro']);
  });

  it('daily and weekly stay at their wall-clock time across both DST changes', () => {
    const daily = schedule({ repeat: 'daily', date: '2026-03-27', time: '09:00' });
    const spring = expandSchedule(daily, { from: local(2026, 3, 27), to: local(2026, 3, 31) });
    expect(dates(spring)).toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30']);
    expect(spring.map((o) => new Date(o.at).getHours())).toEqual([9, 9, 9, 9]);
    expect(spring[2]!.at - spring[1]!.at).toBe(23 * HOUR);

    const weekly = schedule({ repeat: 'weekly', date: '2026-10-18', time: '20:15' }); // Sundays
    const autumn = expandSchedule(weekly, { from: local(2026, 10, 18), to: local(2026, 11, 2) });
    expect(dates(autumn)).toEqual(['2026-10-18', '2026-10-25', '2026-11-01']);
    expect(autumn.map((o) => `${new Date(o.at).getHours()}:${new Date(o.at).getMinutes()}`)).toEqual(['20:15', '20:15', '20:15']);
    expect(autumn[1]!.at - autumn[0]!.at).toBe(7 * 24 * HOUR + HOUR);
  });

  it('a day range across the DST change is 23 or 25 hours and holds that day’s occurrences', () => {
    const s = schedule({ repeat: 'daily', date: '2026-10-20', time: '23:30', lengthMinutes: 60 });
    const sunday = dayRange(local(2026, 10, 25, 12));
    expect(sunday.to - sunday.from).toBe(25 * HOUR);
    // the occurrence late on Saturday runs into Sunday, so Sunday shows it too
    expect(dates(expandSchedule(s, sunday))).toEqual(['2026-10-24', '2026-10-25']);
  });

  it('expandSchedules merges series in time order', () => {
    const a = schedule({ id: 'a', repeat: 'daily', time: '10:00' });
    const b = schedule({ id: 'b', repeat: 'weekly', time: '08:00', date: '2026-10-21' });
    const day = expandSchedules([a, b], dayRange(local(2026, 10, 21)));
    expect(day.map((o) => o.key)).toEqual(['b@2026-10-21', 'a@2026-10-21']);
  });
});

describe('due, missed, done', () => {
  const s = schedule({ date: '2026-10-23', time: '14:00', lengthMinutes: 50 });
  const at = local(2026, 10, 23, 14);
  const o = occurrenceOn(s, '2026-10-23')!;

  it('the grace window is the length plus 30 minutes (an hour when the length is open)', () => {
    expect(dueUntil(o)).toBe(at + 80 * MIN);
    expect(dueUntil({ at, lengthMinutes: null })).toBe(at + 60 * MIN);
    expect(MAX_DUE_MS).toBe(210 * MIN);
  });

  it('upcoming → due at its time → missed after the grace window', () => {
    expect(occurrenceStatus(o, ctx(at - 1))).toBe('upcoming');
    expect(occurrenceStatus(o, ctx(at))).toBe('due');
    expect(occurrenceStatus(o, ctx(at + 79 * MIN))).toBe('due');
    expect(occurrenceStatus(o, ctx(at + 80 * MIN))).toBe('missed');
  });

  it('let pass is dismissed; a linked session is started, done or ended', () => {
    expect(occurrenceStatus({ ...o, note: { dismissed: true } }, ctx(at))).toBe('dismissed');
    const linked = { ...o, note: { sessionId: 'x' } };
    expect(occurrenceStatus(linked, ctx(at + 10 * HOUR, { inProgress: new Set(['x']) }))).toBe('started');
    expect(occurrenceStatus(linked, ctx(at + 10 * HOUR, { log: [{ id: 'x', outcome: 'completed' }] }))).toBe('done');
    expect(occurrenceStatus(linked, ctx(at + 10 * HOUR, { log: [{ id: 'x', outcome: 'cancelled' }] }))).toBe('ended');
  });

  it('dueOccurrences lists only the ones inside their window (a closed tab is read right on return)', () => {
    const daily = schedule({ repeat: 'daily', date: '2026-10-20', time: '14:00', lengthMinutes: null });
    expect(dueOccurrences([daily], ctx(at + 30 * MIN)).map((x) => x.date)).toEqual(['2026-10-23']);
    expect(dueOccurrences([daily], ctx(at + 61 * MIN))).toEqual([]);
    expect(dueOccurrences([daily], ctx(at - MIN))).toEqual([]);
    const v = viewOccurrences([daily], weekRange(at), ctx(at + 30 * MIN));
    expect(v.map((x) => [x.date, x.status])).toEqual([
      ['2026-10-20', 'missed'],
      ['2026-10-21', 'missed'],
      ['2026-10-22', 'missed'],
      ['2026-10-23', 'due'],
      ['2026-10-24', 'upcoming'],
      ['2026-10-25', 'upcoming'],
    ]);
  });

  it('nextOccurrence skips the ones already started or let pass', () => {
    const daily = schedule({ repeat: 'daily', date: '2026-10-23', notes: { '2026-10-24': { dismissed: true } } });
    expect(nextOccurrence([daily], local(2026, 10, 23, 10))?.date).toBe('2026-10-25');
  });
});

describe('prefill', () => {
  it('maps name, length and plan; open ones stay open; the link points back', () => {
    const s = schedule({ lengthMinutes: 60, planId: 'pomodoro' });
    expect(startPrefill(occurrenceOn(s, s.date)!)).toEqual({
      taskName: 'Biology',
      goalMinutes: 60,
      planId: 'pomodoro',
      link: { scheduleId: 's1', date: '2026-10-19' },
    });
    const open = schedule({ lengthMinutes: null });
    expect(startPrefill(occurrenceOn(open, open.date)!)).toMatchObject({ goalMinutes: null, planId: null });
    // a plan that does not fit the length is left for the start flow
    expect(startPrefill({ scheduleId: 'x', date: '2026-10-19', name: 'n', lengthMinutes: 20, planId: 'pomodoro' }).planId).toBeNull();
  });
});

describe('validation', () => {
  it('makeSchedule normalises the name and rejects bad input', () => {
    const s = makeSchedule('id', { name: '  ', date: '2026-10-23', time: '09:00' }, 1);
    expect(s).toMatchObject({ name: 'Study session', repeat: 'none', lengthMinutes: null, planId: null, until: null, notes: {} });
    expect(makeSchedule('id', { name: 'x', date: '2026-13-01', time: '09:00' }, 1)).toBeNull();
    expect(makeSchedule('id', { name: 'x', date: '2026-10-23', time: '9am' }, 1)).toBeNull();
    expect(makeSchedule('id', { name: 'x', date: '2026-10-23', time: '09:00', lengthMinutes: 7 }, 1)).toBeNull();
    // a plan without a length is dropped (chosen at start)
    expect(makeSchedule('id', { name: 'x', date: '2026-10-23', time: '09:00', planId: 'pomodoro' }, 1)?.planId).toBeNull();
  });

  it('lengthPlanProblem and scheduleProblem', () => {
    expect(lengthPlanProblem(null, null)).toBeNull();
    expect(lengthPlanProblem(60, 'pomodoro')).toBeNull();
    expect(lengthPlanProblem(null, 'pomodoro')).toMatch(/needs a length/);
    expect(lengthPlanProblem(20, 'pomodoro')).toMatch(/no plan/);
    expect(scheduleProblem(schedule({ until: '2026-10-19' }))).toBe('until');
    expect(scheduleProblem(schedule({ notes: { '2026-10-19': { time: '25:00' } } }))).toMatch(/notes/);
    expect(scheduleProblem(schedule())).toBeNull();
  });
});
