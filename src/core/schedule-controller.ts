import type { Clock } from './clock';
import { createIntervalTicker, type Ticker } from './controller';
import type { EventBus } from './events';
import { createRng, type Rng } from './rng';
import {
  dueOccurrences,
  dueUntil,
  makeSchedule,
  nextOccurrence,
  occurrenceOn,
  occurrenceStatus,
  viewOccurrences,
  type Occurrence,
  type OccurrenceRef,
  type OccurrenceView,
  type Schedule,
  type ScheduleInput,
  type StatusContext,
} from './schedule';
import { planEdit, planRemove, type EditScope, type ScheduleAction, type ScheduleEdit } from './schedule-reducer';
import type { TimeRange } from './session-log';
import { inProgressSessions, type GardenState, type Store } from './state';

/**
 * The scheduler (ADRs 0171–0173): the API the calendar, the waiting card and the dev tools use for
 * scheduled sessions. Like the session controller it owns the impure inputs (ids from a seeded
 * Rng, time from the Clock), turns intent into `schedule/*` actions, and announces occurrences
 * whose time has come (`schedule:due`, once per occurrence per page) from its tick. It ticks
 * while any schedule exists — `main.ts` gives it the widget's Web Worker ticker, so a background
 * tab still notices on time (ADR 0090). Due / missed / done are derived, never stored. No DOM.
 */

export interface SchedulerDeps {
  store: Store;
  clock: Clock;
  bus: EventBus;
  ticker?: Ticker;
  seed?: number | string;
}

export interface Scheduler {
  /** Add a schedule; null when the input is invalid. */
  add(input: ScheduleInput): Schedule | null;
  /** Edit one occurrence, or it and the following (one-offs: the schedule itself). */
  edit(ref: OccurrenceRef, edit: ScheduleEdit, scope: EditScope): boolean;
  /** Remove one occurrence, or it and the following (one-offs: the schedule). */
  remove(ref: OccurrenceRef, scope: EditScope): boolean;
  /** "Not this time": let a due (or upcoming) occurrence pass quietly. */
  dismiss(ref: OccurrenceRef): boolean;
  /** A session started from this occurrence (the calendar then shows it done when it blooms). */
  link(ref: OccurrenceRef, sessionId: string): boolean;
  get(ref: OccurrenceRef): OccurrenceView | null;
  /** Occurrences overlapping a range, with their status. */
  occurrences(range: TimeRange): OccurrenceView[];
  /** Occurrences waiting for one-tap Start now, oldest first. */
  due(): OccurrenceView[];
  /** The next occurrence still to come (or null). */
  next(): Occurrence | null;
  /** Announce newly due occurrences and notice status changes; runs on every tick. Returns the new ones. */
  check(): OccurrenceView[];
  /** Called when the set of due occurrences changes without a store change (time passing). */
  onChange(fn: () => void): () => void;
  /** Called after every tick. */
  onTick(fn: () => void): () => void;
  setTicker(t: Ticker): void;
  setSeed(seed: number | string): void;
  dispose(): void;
}

/** What occurrence statuses are derived from: now, the sessions in progress, the log. */
export function statusContext(state: Pick<GardenState, 'session' | 'waiting' | 'log'>, now: number): StatusContext {
  return { now, inProgress: new Set(inProgressSessions(state).map((s) => s.id)), log: state.log };
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const { store, clock, bus } = deps;
  let rng: Rng = createRng(deps.seed ?? clock.now()).fork('schedule');
  let ticker = deps.ticker ?? createIntervalTicker();
  let stopTicker: (() => void) | null = null;
  const announced = new Set<string>();
  const changeListeners = new Set<() => void>();
  const tickListeners = new Set<() => void>();
  let lastDue = '';

  const newId = (): string =>
    `schedule-${Math.max(0, Math.floor(clock.now())).toString(36)}-${rng.int(0, 0xffffff).toString(36).padStart(5, '0')}`;
  const ctx = (): StatusContext => statusContext(store.get(), clock.now());
  const findSchedule = (id: string): Schedule | undefined => store.get().schedules.find((s) => s.id === id);

  /** Dispatch a batch; true when the state changed. */
  const applyAll = (actions: ScheduleAction[]): boolean => {
    const before = store.get();
    for (const a of actions) store.dispatch(a);
    return store.get() !== before;
  };

  const view = (o: Occurrence): OccurrenceView => ({ ...o, status: occurrenceStatus(o, ctx()), dueUntil: dueUntil(o) });

  const tick = (): void => {
    scheduler.check();
    for (const fn of [...tickListeners]) fn();
  };

  /** Tick only while some schedule exists. */
  const syncTicker = (): void => {
    const want = store.get().schedules.length > 0;
    if (want && !stopTicker) stopTicker = ticker.start(tick);
    if (!want && stopTicker) {
      stopTicker();
      stopTicker = null;
    }
  };
  const unsubscribe = store.subscribe((next, prev) => {
    if (next.schedules !== prev.schedules) syncTicker();
  });

  const scheduler: Scheduler = {
    add(input) {
      const s = makeSchedule(newId(), input, clock.now());
      if (!s) return null;
      return applyAll([{ type: 'schedule/add', schedule: s }]) ? s : null;
    },

    edit(ref, edit, scope) {
      const s = findSchedule(ref.scheduleId);
      if (!s || !occurrenceOn(s, ref.date)) return false;
      return applyAll(planEdit(s, ref.date, edit, scope, { newId: newId(), now: clock.now() }));
    },

    remove(ref, scope) {
      const s = findSchedule(ref.scheduleId);
      if (!s || !occurrenceOn(s, ref.date)) return false;
      return applyAll(planRemove(s, ref.date, scope));
    },

    dismiss(ref) {
      const s = findSchedule(ref.scheduleId);
      const o = s ? occurrenceOn(s, ref.date) : null;
      if (!s || !o || o.note?.sessionId) return false;
      return applyAll([{ type: 'schedule/note', id: s.id, date: ref.date, note: { ...(o.note ?? {}), dismissed: true } }]);
    },

    link(ref, sessionId) {
      const s = findSchedule(ref.scheduleId);
      const o = s ? occurrenceOn(s, ref.date) : null;
      if (!s || !o || !sessionId) return false;
      const rest = { ...(o.note ?? {}) };
      delete rest.dismissed;
      return applyAll([{ type: 'schedule/note', id: s.id, date: ref.date, note: { ...rest, sessionId } }]);
    },

    get(ref) {
      const s = findSchedule(ref.scheduleId);
      const o = s ? occurrenceOn(s, ref.date) : null;
      return o ? view(o) : null;
    },

    occurrences: (range) => viewOccurrences(store.get().schedules, range, ctx()),
    due: () => dueOccurrences(store.get().schedules, ctx()),
    next: () => nextOccurrence(store.get().schedules, clock.now()),

    check() {
      const due = scheduler.due();
      const fresh = due.filter((o) => !announced.has(o.key));
      for (const o of fresh) {
        announced.add(o.key);
        bus.emit('schedule:due', { occurrence: o });
      }
      const sig = due.map((o) => o.key).join('|');
      if (sig !== lastDue) {
        lastDue = sig;
        for (const fn of [...changeListeners]) fn();
      }
      return fresh;
    },

    onChange(fn) {
      changeListeners.add(fn);
      return () => {
        changeListeners.delete(fn);
      };
    },

    onTick(fn) {
      tickListeners.add(fn);
      return () => {
        tickListeners.delete(fn);
      };
    },

    setTicker(next) {
      if (stopTicker) {
        stopTicker();
        stopTicker = null;
      }
      ticker = next;
      syncTicker();
    },

    setSeed(seed) {
      rng = createRng(seed).fork('schedule');
    },

    dispose() {
      unsubscribe();
      stopTicker?.();
      stopTicker = null;
      changeListeners.clear();
      tickListeners.clear();
    },
  };

  // the first tick announces what came due while the app was closed (the notifier then decides)
  syncTicker();
  return scheduler;
}
