import type { SpeedClock } from '../core/clock';
import { validateState } from '../core/persistence';
import { createRng } from '../core/rng';
import { dueUntil, timeOfDay, type Occurrence, type OccurrenceView, type Schedule, type ScheduleInput } from '../core/schedule';
import type { Scheduler } from '../core/schedule-controller';
import type { EditScope, ScheduleEdit } from '../core/schedule-reducer';
import { dayKey, weekRange } from '../core/session-log';
import type { Store } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import type { UI } from '../ui';
import type { CalendarView } from '../ui/calendar-model';
import { extendDebug, type SproutDebug } from './debug';
import { buildHistory, withHistory } from './fill-history';
import { msUntilLocalTime } from './local-time';

/** Scheduled sessions and the calendar in `window.sprout` (docs/systems/calendar.md › Debug API). */
declare module './debug' {
  interface SproutDebug {
    schedule: {
      /**
       * Add a schedule. Defaults: name "Planned session", today, the next whole minute (so it is due
       * after `jumpToDue()`), length and plan open, no repeat. Returns it, or null when invalid.
       */
      add(input?: Partial<ScheduleInput>): Schedule | null;
      list(): Schedule[];
      /** occurrences with their status between two dates or times (default: this week) */
      occurrences(from?: string | number, to?: string | number): OccurrenceView[];
      /** occurrences waiting for one-tap Start now */
      due(): OccurrenceView[];
      /** one occurrence by `scheduleId@date` key */
      get(key: string): OccurrenceView | null;
      /** jump the dev clock to the next occurrence (of `scheduleId`, else any) and run the due check; returns it */
      jumpToDue(scheduleId?: string): Occurrence | null;
      /** jump the dev clock just past an occurrence's grace window (it becomes missed) */
      jumpPast(key: string): boolean;
      edit(key: string, edit: ScheduleEdit, scope?: EditScope): boolean;
      remove(key: string, scope?: EditScope): boolean;
      /** run the scheduler's tick now */
      check(): OccurrenceView[];
      /** add `days` of realistic history to the session log (screenshots); returns how many sessions */
      fillHistory(days?: number, seed?: number): number;
      /**
       * A realistic month for looking at the calendar: moves the dev clock forward to the next
       * `hour`:10 (default 16; later today, else tomorrow), adds `days` (35) of history and three
       * schedules (weekdays, a daily with the time open, a weekly). Whatever hour it is called at, it
       * opens at the same time of day, with the daily (15:40, open length) due and waiting for Start.
       * Returns how many past sessions it added.
       */
      demo(opts?: { days?: number; hour?: number }): number;
    };
    calendar: {
      state(): ReturnType<NonNullable<UI['calendar']>['state']> | null;
      setView(view: CalendarView): void;
      go(date: string | number): void;
    };
  }
}

export interface ScheduleDebugDeps {
  store: Store;
  scheduler: Scheduler;
  clock: SpeedClock;
  ui: UI;
  species: readonly Pick<SpeciesDef, 'id' | 'tier'>[];
}

const toTime = (v: string | number): number => (typeof v === 'number' ? v : new Date(`${v}T00:00`).getTime());
const ref = (key: string) => {
  const at = key.lastIndexOf('@');
  return { scheduleId: key.slice(0, at), date: key.slice(at + 1) };
};

export function installScheduleDebug({ store, scheduler, clock, ui, species }: ScheduleDebugDeps): void {
  const after = <T>(v: T): T => {
    scheduler.check();
    ui.refresh();
    return v;
  };
  const api: Pick<SproutDebug, 'schedule' | 'calendar'> = {
    schedule: {
      add(input = {}) {
        const now = clock.now();
        const d = new Date(now + 60_000);
        const s = scheduler.add({
          name: input.name ?? 'Planned session',
          date: input.date ?? dayKey(d.getTime()),
          time: input.time ?? timeOfDay(d.getHours() * 60 + d.getMinutes()),
          lengthMinutes: input.lengthMinutes ?? null,
          planId: input.planId ?? null,
          repeat: input.repeat ?? 'none',
        });
        return after(s);
      },
      list: () => store.get().schedules,
      occurrences(from, to) {
        const range = from === undefined ? weekRange(clock.now()) : { from: toTime(from), to: to === undefined ? toTime(from) + 86_400_000 : toTime(to) };
        return scheduler.occurrences(range);
      },
      due: () => scheduler.due(),
      get: (key) => scheduler.get(ref(key)),
      jumpToDue(scheduleId) {
        const list = scheduleId ? store.get().schedules.filter((s) => s.id === scheduleId) : store.get().schedules;
        const due = scheduler.due().find((o) => !scheduleId || o.scheduleId === scheduleId);
        if (due) return after(due);
        const now = clock.now();
        const next = scheduler.occurrences({ from: now, to: now + 400 * 86_400_000 }).find(
          (o) => o.status === 'upcoming' && list.some((s) => s.id === o.scheduleId),
        );
        if (!next) return null;
        clock.advance(Math.max(0, next.at - now));
        return after(next);
      },
      jumpPast(key) {
        const o = scheduler.get(ref(key));
        if (!o) return false;
        const delta = dueUntil(o) - clock.now();
        if (delta > 0) clock.advance(delta + 1000);
        return after(true);
      },
      edit: (key, edit, scope = 'this') => after(scheduler.edit(ref(key), edit, scope)),
      remove: (key, scope = 'this') => after(scheduler.remove(ref(key), scope)),
      check: () => after(scheduler.check()),
      demo(opts = {}): number {
        // Always the same time of day, so what is due does not depend on when it runs (ADR 0172:
        // the 15:40 daily is due until 16:40). The dev clock only moves forward: past `hour`:10
        // today, that is tomorrow's.
        const hour = String(opts.hour ?? 16).padStart(2, '0');
        clock.advance(msUntilLocalTime(clock.now(), `${hour}:10`));
        const t = clock.now();
        const n: number = api.schedule.fillHistory(opts.days ?? 35);
        const day = (offset: number) => dayKey(t + offset * 86_400_000);
        scheduler.add({ name: 'Essay draft', date: day(-5), time: '17:30', lengthMinutes: 50, planId: 'pomodoro', repeat: 'weekdays' });
        scheduler.add({ name: 'Japanese kanji', date: day(-3), time: '15:40', lengthMinutes: null, repeat: 'daily' });
        scheduler.add({ name: 'Reading for seminar', date: day(2), time: '10:00', lengthMinutes: 90, repeat: 'weekly' });
        return after(n);
      },
      fillHistory(days = 30, seed = 11) {
        const entries = buildHistory(createRng(seed).fork('history'), species, { now: clock.now(), days, idPrefix: `history-${seed}` });
        const r = validateState(withHistory(store.get(), entries), { now: clock.now() });
        if (!r.ok) throw new Error(`fillHistory: ${r.error.message}`);
        store.dispatch({ type: 'state/replace', state: r.value.state });
        return after(entries.length);
      },
    },
    calendar: {
      state: () => ui.calendar?.state() ?? null,
      setView: (v: CalendarView) => ui.calendar?.setView(v),
      go: (d: string | number) => ui.calendar?.go(d),
    },
  };
  extendDebug(api);
}
