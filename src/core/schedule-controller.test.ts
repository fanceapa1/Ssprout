import { describe, expect, it } from 'vitest';
import { EVERYWHERE } from '../plants/biomes';
import type { SpeciesDef } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { createManualClock } from './clock';
import { createSessionController, type Ticker } from './controller';
import { createEventBus, type EventMap } from './events';
import { localTime, type OccurrenceView } from './schedule';
import { createScheduler } from './schedule-controller';
import { dayRange } from './session-log';
import { createDefaultState, createReducer, createStore } from './state';

/**
 * The scheduler (ADRs 0171–0173): add/edit/remove through occurrence refs, the due tick and its
 * `schedule:due` event (once per occurrence), missed after the grace window, dismiss, the link
 * from a session started from an occurrence (done when it blooms), ticking only while schedules
 * exist.
 */
const MIN = 60_000;

function manualTicker() {
  let fn: (() => void) | null = null;
  const t: Ticker & { tick(): void; readonly running: boolean } = {
    start(tick) {
      fn = tick;
      return () => {
        fn = null;
      };
    },
    tick: () => fn?.(),
    get running() {
      return fn !== null;
    },
  };
  return t;
}

const VIOLET: SpeciesDef = {
  id: 'violet',
  name: 'Violet',
  range: EVERYWHERE,
  tier: 1,
  habitats: ['meadow'],
  sizeClass: 'small',
  size: { w: 10, h: 10 },
  anchor: { x: 0.5, y: 1 },
  description: '',
  bloomColor: '#fff',
  pollinators: true,
  draw: () => {},
};
const SLOTS: Slot[] = [{ id: 'meadow-1', x: 0, y: 0, habitat: 'meadow', maxSize: 'large', scale: 1 }];

function setup() {
  // 08:00 local on a Friday
  const T = localTime('2026-10-23', '08:00');
  const clock = createManualClock(T);
  const store = createStore(createDefaultState(T), createReducer());
  const bus = createEventBus();
  const due: EventMap['schedule:due'][] = [];
  bus.on('schedule:due', (p) => due.push(p));
  const ticker = manualTicker();
  const scheduler = createScheduler({ store, clock, bus, ticker, seed: 3 });
  const sessionTicker = manualTicker();
  const controller = createSessionController({ store, clock, bus, species: [VIOLET], slots: SLOTS, ticker: sessionTicker, seed: 1 });
  return { T, clock, store, bus, due, ticker, scheduler, controller };
}

describe('scheduler', () => {
  it('adds schedules with fresh ids and lists their occurrences with a status', () => {
    const { scheduler, T } = setup();
    const a = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '09:00', lengthMinutes: 50, repeat: 'daily' })!;
    const b = scheduler.add({ name: 'Essay', date: '2026-10-23', time: '07:30' })!;
    expect(a.id).not.toBe(b.id);
    expect(scheduler.add({ name: 'x', date: 'soon', time: '09:00' })).toBeNull();
    const today = scheduler.occurrences(dayRange(T));
    expect(today.map((o) => [o.name, o.status])).toEqual([
      ['Essay', 'due'],
      ['Biology', 'upcoming'],
    ]);
    expect(scheduler.next()?.name).toBe('Biology');
  });

  it('ticks only while a schedule exists', () => {
    const { scheduler, ticker } = setup();
    expect(ticker.running).toBe(false);
    const s = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '09:00' })!;
    expect(ticker.running).toBe(true);
    scheduler.remove({ scheduleId: s.id, date: '2026-10-23' }, 'this');
    expect(ticker.running).toBe(false);
  });

  it('announces an occurrence once when its time comes, and notices it pass into missed', () => {
    const { scheduler, ticker, clock, due } = setup();
    const changes: number[] = [];
    scheduler.onChange(() => changes.push(clock.now()));
    scheduler.add({ name: 'Biology', date: '2026-10-23', time: '09:00', lengthMinutes: 25 });
    ticker.tick();
    expect(due).toHaveLength(0);
    clock.set(localTime('2026-10-23', '09:00'));
    ticker.tick();
    ticker.tick();
    expect(due).toHaveLength(1);
    expect(due[0]!.occurrence).toMatchObject({ name: 'Biology', status: 'due', lengthMinutes: 25 });
    expect(scheduler.due().map((o) => o.name)).toEqual(['Biology']);
    expect(changes).toHaveLength(1);
    // 25 min + 30 min of grace later it has quietly passed
    clock.set(localTime('2026-10-23', '09:55'));
    ticker.tick();
    expect(scheduler.due()).toEqual([]);
    expect(changes).toHaveLength(2);
    const [o] = scheduler.occurrences(dayRange(clock.now()));
    expect(o!.status).toBe('missed');
    expect(due).toHaveLength(1);
  });

  it('an occurrence that came due while the app was closed is due on return (and announced by the first tick)', () => {
    const { clock, store, bus } = setup();
    const ticker = manualTicker();
    const first = createScheduler({ store, clock, bus, ticker: manualTicker(), seed: 1 });
    first.add({ name: 'Reading', date: '2026-10-23', time: '08:30', lengthMinutes: null });
    first.dispose();
    clock.set(localTime('2026-10-23', '09:10'));
    const seen: OccurrenceView[] = [];
    bus.on('schedule:due', (p) => seen.push(p.occurrence));
    const again = createScheduler({ store, clock, bus, ticker, seed: 2 });
    expect(again.due().map((o) => o.name)).toEqual(['Reading']);
    ticker.tick();
    expect(seen.map((o) => o.name)).toEqual(['Reading']);
    clock.set(localTime('2026-10-23', '09:31'));
    expect(again.due()).toEqual([]);
  });

  it('dismiss lets an occurrence pass quietly', () => {
    const { scheduler, clock } = setup();
    const s = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '08:00' })!;
    const ref = { scheduleId: s.id, date: '2026-10-23' };
    expect(scheduler.get(ref)?.status).toBe('due');
    expect(scheduler.dismiss(ref)).toBe(true);
    expect(scheduler.get(ref)?.status).toBe('dismissed');
    expect(scheduler.due()).toEqual([]);
    expect(clock.now()).toBeGreaterThan(0);
  });

  it('a session started from an occurrence links back: started, then done when it blooms', () => {
    const { scheduler, controller, clock, store } = setup();
    const s = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '08:00', lengthMinutes: 25 })!;
    const ref = { scheduleId: s.id, date: '2026-10-23' };
    expect(controller.start({ taskName: 'Biology', goalMinutes: 25, speciesId: 'violet', slotId: 'meadow-1' })).toBe(true);
    const sessionId = store.get().session!.id;
    expect(scheduler.link(ref, sessionId)).toBe(true);
    expect(scheduler.get(ref)?.status).toBe('started');
    expect(scheduler.dismiss(ref)).toBe(false);
    clock.advance(25 * MIN);
    controller.check();
    expect(store.get().log.at(-1)?.outcome).toBe('completed');
    expect(scheduler.get(ref)?.status).toBe('done');
  });

  it('a linked session that ends without a bloom leaves the occurrence ended', () => {
    const { scheduler, controller, store } = setup();
    const s = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '08:00' })!;
    const ref = { scheduleId: s.id, date: '2026-10-23' };
    controller.start({ taskName: 'Biology', goalMinutes: 25, speciesId: 'violet', slotId: 'meadow-1' });
    scheduler.link(ref, store.get().session!.id);
    controller.cancel();
    expect(scheduler.get(ref)?.status).toBe('ended');
  });

  it('edit and remove through occurrence refs', () => {
    const { scheduler, T } = setup();
    const s = scheduler.add({ name: 'Biology', date: '2026-10-23', time: '09:00', repeat: 'daily' })!;
    expect(scheduler.edit({ scheduleId: s.id, date: '2026-10-24' }, { time: '10:00' }, 'this')).toBe(true);
    expect(scheduler.edit({ scheduleId: s.id, date: '2026-10-26' }, { name: 'Physics' }, 'following')).toBe(true);
    expect(scheduler.remove({ scheduleId: s.id, date: '2026-10-25' }, 'this')).toBe(true);
    expect(scheduler.edit({ scheduleId: s.id, date: '2025-01-01' }, { name: 'x' }, 'this')).toBe(false);
    const week = scheduler.occurrences({ from: T, to: T + 5 * 86_400_000 });
    expect(week.map((o) => `${o.date} ${o.time} ${o.name}`)).toEqual([
      '2026-10-23 09:00 Biology',
      '2026-10-24 10:00 Biology',
      '2026-10-26 09:00 Physics',
      '2026-10-27 09:00 Physics',
    ]);
  });
});
