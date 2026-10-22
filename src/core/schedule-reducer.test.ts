import { describe, expect, it } from 'vitest';
import { expandSchedules, type Schedule } from './schedule';
import { planEdit, planRemove, reduceSchedules, type ScheduleAction } from './schedule-reducer';
import { createDefaultState, reducer, type GardenState } from './state';

/** Schedule reducers and the "only this one" / "this and following" edits (ADR 0171). */

const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  name: 'Biology',
  date: '2026-10-19',
  time: '09:00',
  lengthMinutes: 50,
  planId: null,
  repeat: 'daily',
  until: null,
  notes: {},
  createdAt: 0,
  ...over,
});

const withSchedules = (...list: Schedule[]): GardenState => ({ ...createDefaultState(0), schedules: list });
const run = (state: GardenState, actions: ScheduleAction[]) => actions.reduce((s, a) => reducer(s, a), state);
const range = (from: string, to: string) => ({ from: new Date(`${from}T00:00`).getTime(), to: new Date(`${to}T00:00`).getTime() });
const occ = (list: Schedule[], from = '2026-10-19', to = '2026-10-26') =>
  expandSchedules(list, range(from, to)).map((o) => `${o.date} ${o.time} ${o.name}${o.lengthMinutes === null ? '' : ` ${o.lengthMinutes}`}`);

describe('schedule reducers', () => {
  it('add validates and keeps ids unique; invalid actions are no-ops', () => {
    const s0 = createDefaultState(0);
    const s1 = reducer(s0, { type: 'schedule/add', schedule: schedule() });
    expect(s1.schedules).toHaveLength(1);
    expect(reducer(s1, { type: 'schedule/add', schedule: schedule() })).toBe(s1);
    expect(reducer(s1, { type: 'schedule/add', schedule: schedule({ id: 's2', time: '9:00' }) })).toBe(s1);
    expect(reducer(s1, { type: 'schedule/add', schedule: schedule({ id: 's3', lengthMinutes: null, planId: 'pomodoro' }) })).toBe(s1);
  });

  it('update re-validates, opens a stale plan and drops notes the rule no longer has', () => {
    const s = withSchedules(schedule({ lengthMinutes: 60, planId: 'pomodoro', notes: { '2026-10-24': { dismissed: true }, '2026-10-21': { name: 'x' } } }));
    const next = reducer(s, { type: 'schedule/update', id: 's1', patch: { repeat: 'weekdays', lengthMinutes: 90 } });
    expect(next.schedules[0]).toMatchObject({ repeat: 'weekdays', lengthMinutes: 90, planId: null });
    expect(Object.keys(next.schedules[0]!.notes)).toEqual(['2026-10-21']); // Saturday's note is gone
    expect(reducer(s, { type: 'schedule/update', id: 's1', patch: { time: 'noon' } })).toBe(s);
    expect(reducer(s, { type: 'schedule/update', id: 'nope', patch: { time: '10:00' } })).toBe(s);
    const open = reducer(s, { type: 'schedule/update', id: 's1', patch: { lengthMinutes: null } });
    expect(open.schedules[0]).toMatchObject({ lengthMinutes: null, planId: null });
  });

  it('note only lands on a date the rule has; null clears it; the same note is no change', () => {
    const s = withSchedules(schedule({ repeat: 'weekly' }));
    expect(reducer(s, { type: 'schedule/note', id: 's1', date: '2026-10-20', note: { skipped: true } })).toBe(s);
    const n = reducer(s, { type: 'schedule/note', id: 's1', date: '2026-10-26', note: { dismissed: true } });
    expect(n.schedules[0]!.notes).toEqual({ '2026-10-26': { dismissed: true } });
    expect(reducer(n, { type: 'schedule/note', id: 's1', date: '2026-10-26', note: { dismissed: true } })).toBe(n);
    expect(reducer(n, { type: 'schedule/note', id: 's1', date: '2026-10-26', note: null }).schedules[0]!.notes).toEqual({});
    expect(reducer(s, { type: 'schedule/note', id: 's1', date: '2026-10-26', note: { time: 'late' } })).toBe(s);
  });

  it('remove drops the schedule', () => {
    const s = withSchedules(schedule(), schedule({ id: 's2' }));
    expect(reducer(s, { type: 'schedule/remove', id: 's1' }).schedules.map((x) => x.id)).toEqual(['s2']);
  });

  it('split ends the series and starts a new one carrying the later notes', () => {
    const s = withSchedules(schedule({ until: '2026-11-30', notes: { '2026-10-20': { sessionId: 'a' }, '2026-10-23': { sessionId: 'b' } } }));
    const n = reducer(s, { type: 'schedule/split', id: 's1', date: '2026-10-22', newId: 's9', now: 5, patch: { time: '18:00' } });
    expect(n.schedules.map((x) => [x.id, x.date, x.until, x.time, Object.keys(x.notes)])).toEqual([
      ['s1', '2026-10-19', '2026-10-22', '09:00', ['2026-10-20']],
      ['s9', '2026-10-22', '2026-11-30', '18:00', ['2026-10-23']],
    ]);
    // at the first date it is a plain update
    expect(reducer(s, { type: 'schedule/split', id: 's1', date: '2026-10-19', newId: 's9', now: 5, patch: { time: '18:00' } }).schedules).toHaveLength(1);
    // a date the rule does not have, or a taken id, is refused
    expect(reducer(s, { type: 'schedule/split', id: 's1', date: '2026-10-01', newId: 's9', now: 5, patch: {} })).toBe(s);
    expect(reducer(s, { type: 'schedule/split', id: 's1', date: '2026-10-22', newId: 's1', now: 5, patch: {} })).toBe(s);
  });

  it('reduceSchedules returns the same array when nothing changes', () => {
    const list = [schedule()];
    expect(reduceSchedules(list, { type: 'schedule/remove', id: 'x' })).toBe(list);
  });
});

describe('edits: only this one, or this and following', () => {
  const ids = { newId: 'new', now: 1 };
  const apply = (s: Schedule, actions: ScheduleAction[]) => run(withSchedules(s), actions).schedules;

  it('only this one: name, time, length and plan for that day; the others keep the rule', () => {
    const s = schedule({ lengthMinutes: 60, planId: 'pomodoro' });
    const out = apply(s, planEdit(s, '2026-10-21', { name: 'Exam prep', time: '07:30', lengthMinutes: 90 }, 'this', ids));
    expect(occ(out, '2026-10-20', '2026-10-23')).toEqual(['2026-10-20 09:00 Biology 60', '2026-10-21 07:30 Exam prep 90', '2026-10-22 09:00 Biology 60']);
    expect(out[0]!.notes['2026-10-21']).toMatchObject({ planId: null });
  });

  it('only this one moved to another day: skipped there, a one-off on the new day', () => {
    const s = schedule();
    const out = apply(s, planEdit(s, '2026-10-21', { date: '2026-10-25', time: '16:00' }, 'this', ids));
    expect(occ(out)).toEqual([
      '2026-10-19 09:00 Biology 50',
      '2026-10-20 09:00 Biology 50',
      '2026-10-22 09:00 Biology 50',
      '2026-10-23 09:00 Biology 50',
      '2026-10-24 09:00 Biology 50',
      '2026-10-25 09:00 Biology 50',
      '2026-10-25 16:00 Biology 50',
    ]);
    expect(out[1]).toMatchObject({ id: 'new', repeat: 'none', date: '2026-10-25' });
  });

  it('this and following: the series splits; earlier days keep the old rule', () => {
    const s = schedule();
    const out = apply(s, planEdit(s, '2026-10-22', { time: '18:00', lengthMinutes: null }, 'following', ids));
    expect(occ(out, '2026-10-20', '2026-10-24')).toEqual([
      '2026-10-20 09:00 Biology 50',
      '2026-10-21 09:00 Biology 50',
      '2026-10-22 18:00 Biology',
      '2026-10-23 18:00 Biology',
    ]);
  });

  it('a new repeat always applies to this and the following', () => {
    const s = schedule();
    const out = apply(s, planEdit(s, '2026-10-21', { repeat: 'weekly' }, 'this', ids));
    expect(occ(out, '2026-10-19', '2026-11-02')).toEqual([
      '2026-10-19 09:00 Biology 50',
      '2026-10-20 09:00 Biology 50',
      '2026-10-21 09:00 Biology 50',
      '2026-10-28 09:00 Biology 50',
    ]);
  });

  it('a one-off is simply edited', () => {
    const s = schedule({ repeat: 'none' });
    const out = apply(s, planEdit(s, '2026-10-19', { date: '2026-10-24', name: 'Essay' }, 'this', ids));
    expect(occ(out)).toEqual(['2026-10-24 09:00 Essay 50']);
  });

  it('remove only this one, this and following, or a whole one-off', () => {
    const s = schedule();
    expect(occ(apply(s, planRemove(s, '2026-10-21', 'this')), '2026-10-20', '2026-10-23')).toEqual(['2026-10-20 09:00 Biology 50', '2026-10-22 09:00 Biology 50']);
    expect(occ(apply(s, planRemove(s, '2026-10-21', 'following')))).toEqual(['2026-10-19 09:00 Biology 50', '2026-10-20 09:00 Biology 50']);
    expect(apply(s, planRemove(s, '2026-10-19', 'following'))).toEqual([]);
    const one = schedule({ repeat: 'none' });
    expect(apply(one, planRemove(one, '2026-10-19', 'this'))).toEqual([]);
  });
});
