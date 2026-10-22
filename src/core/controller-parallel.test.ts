import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass, SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { createManualClock } from './clock';
import { createSessionController, type StartOptions, type Ticker } from './controller';
import { createEventBus, EVENT_NAMES, type EventMap, type EventName } from './events';
import { focusWateringTimes, sessionTimeline } from './session';
import { createDefaultState, createReducer, createStore, type GardenState } from './state';
import { makeSession, MIN, plan, T0 } from './testing';

/**
 * The controller with several sessions in progress (SPEC §2 › Parallel sessions, ADRs 0150–0153):
 * start / switchTo / cancel(id), the limit of three, completion with others waiting, the
 * "Still with us?" rule, reload, and the automatic focus watering.
 */

const def = (id: string, tier: Tier, habitats: Habitat[], sizeClass: SizeClass = 'small'): SpeciesDef => ({
  id,
  name: id,
  tier,
  habitats,
  sizeClass,
  size: { w: 10, h: 10 },
  anchor: { x: 0.5, y: 1 },
  description: '',
  bloomColor: '#fff',
  pollinators: true,
  draw: () => {},
});
const SPECIES = [def('violet', 1, ['meadow', 'rock']), def('cherry', 4, ['back'], 'tree')];
const slot = (id: string, habitat: Habitat, maxSize: SizeClass): Slot => ({ id, x: 0, y: 0, habitat, maxSize, scale: 1 });
const SLOTS = [slot('meadow-1', 'meadow', 'large'), slot('meadow-2', 'meadow', 'medium'), slot('rock-1', 'rock', 'small'), slot('back-1', 'back', 'tree')];

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

function setup(initial: GardenState = createDefaultState(T0)) {
  const clock = createManualClock(T0);
  const reducer = createReducer({ getSpecies: (id) => SPECIES.find((s) => s.id === id), getSlot: (id) => SLOTS.find((s) => s.id === id) });
  const store = createStore(initial, reducer);
  const bus = createEventBus();
  const events: Array<[EventName, unknown]> = [];
  for (const name of EVENT_NAMES) bus.on(name, (p) => events.push([name, p]));
  const ticker = manualTicker();
  const controller = createSessionController({ store, clock, bus, species: SPECIES, slots: SLOTS, ticker, seed: 1 });
  const names = () => events.map(([n]) => n);
  const payload = <K extends EventName>(name: K) => events.filter(([n]) => n === name).map(([, p]) => p as EventMap[K]);
  const to = (min: number) => {
    clock.set(T0 + min * MIN);
    ticker.tick();
  };
  return { clock, store, bus, ticker, controller, names, payload, to };
}

const opts = (over: Partial<StartOptions> = {}): StartOptions => ({ taskName: 'Task', goalMinutes: 25, speciesId: 'violet', slotId: 'meadow-1', ...over });
const POM = opts({ goalMinutes: 90, planId: 'pomodoro' }); // 30 · (5) · 25 · (5) · 25
const A = opts({ taskName: 'A', slotId: 'meadow-1' });
const B = opts({ taskName: 'B', slotId: 'meadow-2' });
const C = opts({ taskName: 'C', slotId: 'rock-1' });
const ids = (st: GardenState) => ({ active: st.session?.id ?? null, waiting: st.waiting.map((w) => w.id) });

describe('parallel sessions', () => {
  it('starting another session pauses the active one (a "switch" pause) and makes the new one active', () => {
    const { controller, store, clock, names, payload } = setup();
    controller.start(A);
    const a = store.get().session!.id;
    clock.advance(5 * MIN);
    expect(controller.start(B)).toBe(true);
    const b = store.get().session!.id;
    expect(ids(store.get())).toEqual({ active: b, waiting: [a] });
    expect(names().slice(-2)).toEqual(['session:pause', 'session:start']);
    expect(payload('session:pause')).toEqual([{ sessionId: a, at: T0 + 5 * MIN, reason: 'switch' }]);
    expect(payload('session:start').at(-1)).toMatchObject({ pausedId: a });
    expect(controller.status().sessions.map((x) => [x.session.id, x.active, x.running])).toEqual([
      [a, false, false],
      [b, true, true],
    ]);
  });

  it('up to three in progress: a fourth start is refused quietly and status says so', () => {
    const { controller, store, names } = setup();
    expect(controller.start(A)).toBe(true);
    expect(controller.start(B)).toBe(true);
    expect(controller.status().canStart).toBe(true);
    expect(controller.start(C)).toBe(true);
    const before = names().length;
    expect(controller.status()).toMatchObject({ canStart: false, maxSessions: 3 });
    expect(controller.start(opts({ taskName: 'D', speciesId: 'cherry', slotId: 'back-1', goalMinutes: 90 }))).toBe(false);
    expect(names()).toHaveLength(before);
    expect(store.get().waiting).toHaveLength(2);
  });

  it('switchTo pauses the current one and resumes the chosen one; the paused one’s time does not advance', () => {
    const { controller, store, clock, names, payload } = setup();
    controller.start({ ...A, goalMinutes: 60 });
    const a = store.get().session!.id;
    clock.advance(4 * MIN);
    controller.start(B);
    const b = store.get().session!.id;
    clock.advance(10 * MIN);
    expect(controller.switchTo(a)).toBe(true);
    expect(names().slice(-3)).toEqual(['session:pause', 'session:resume', 'session:switch']);
    expect(payload('session:switch')).toEqual([{ from: b, to: a, at: T0 + 14 * MIN }]);
    clock.advance(30 * MIN);
    const st = controller.status();
    const row = (id: string) => st.sessions.find((x) => x.session.id === id)!;
    expect(row(a).timeline.elapsedMs).toBe(34 * MIN); // ran 0–4 and 14–44
    expect(row(b).timeline.elapsedMs).toBe(10 * MIN); // ran 4–14, waiting since
    expect(row(b).running).toBe(false);
  });

  it('switchTo the active session resumes it; unknown ids change nothing', () => {
    const { controller, store } = setup();
    controller.start(A);
    const a = store.get().session!.id;
    controller.pause();
    expect(controller.switchTo(a)).toBe(true);
    expect(store.get().session!.pausedAt).toBeNull();
    expect(controller.switchTo(a)).toBe(false);
    expect(controller.switchTo('nope')).toBe(false);
  });

  it('switching into a session mid-break does not announce that break again; its later blocks are announced', () => {
    const { controller, store, to, payload } = setup();
    controller.start(POM);
    const a = store.get().session!.id;
    to(31); // a in its first break
    expect(payload('session:break')).toEqual([{ blockIndex: 1, sessionId: a }]);
    controller.start(B);
    to(40);
    controller.switchTo(a);
    to(41);
    expect(payload('session:break')).toHaveLength(1);
    to(45); // a's break ends: 31 → 35 of its own time
    expect(payload('session:focus')).toEqual([{ blockIndex: 2, sessionId: a }]);
  });

  it('cancel() ends the active session only; cancel(id) ends a waiting one; the others are untouched', () => {
    const { controller, store, payload } = setup();
    controller.start(A);
    const a = store.get().session!.id;
    controller.start(B);
    const b = store.get().session!.id;
    controller.start(C);
    const c = store.get().session!.id;
    expect(controller.cancel(a)).toBe(true);
    expect(ids(store.get())).toEqual({ active: c, waiting: [b] });
    expect(controller.cancel()).toBe(true);
    expect(ids(store.get())).toEqual({ active: null, waiting: [b] });
    expect(payload('session:cancel').map((p) => p.sessionId)).toEqual([a, c]);
    expect(store.get().log.map((e) => [e.id, e.outcome])).toEqual([
      [a, 'cancelled'],
      [c, 'cancelled'],
    ]);
    expect(controller.status().phase).toBe('idle');
    expect(controller.cancel('nope')).toBe(false);
  });

  it('completion blooms the active session; the others stay paused, nothing resumes, the last one left is marked', () => {
    const { controller, store, clock, to, payload, ticker } = setup();
    controller.start(A);
    const a = store.get().session!.id;
    clock.advance(MIN);
    controller.start(B);
    const b = store.get().session!.id;
    clock.advance(MIN);
    controller.start(C);
    to(2 + 25);
    expect(payload('session:complete')).toHaveLength(1);
    expect(store.get().session).toBeNull();
    expect(store.get().waiting.map((w) => w.id)).toEqual([a, b]);
    const st = controller.status();
    expect(st.phase).toBe('idle');
    expect(st.sessions.every((x) => !x.running)).toBe(true);
    expect(st.sessions.find((x) => x.lastLeft)!.session.id).toBe(b);
    expect(ticker.running).toBe(false); // nothing ticks for waiting sessions
    clock.advance(300 * MIN);
    controller.check();
    expect(store.get().waiting.map((w) => [w.id, w.pausedAt])).toEqual([
      [a, T0 + MIN],
      [b, T0 + 2 * MIN],
    ]);
    expect(controller.switchTo(b)).toBe(true);
    expect(payload('session:switch').at(-1)).toMatchObject({ from: null, to: b });
    expect(ticker.running).toBe(true);
  });

  it('placementOptions leaves out the spots of sessions in progress', () => {
    const { controller } = setup();
    controller.start(A);
    controller.start(B);
    expect(controller.placementOptions('violet').map((o) => o.slot.id)).toEqual(['rock-1']);
  });

  it('“Still with us?” is only for the active session the gardener paused', () => {
    const { controller, store, clock } = setup();
    controller.start(A);
    controller.start(B); // A waits, paused by the switch
    clock.advance(45 * MIN);
    expect(controller.status().longPause).toBe(false);
    controller.pause(); // B paused by the gardener
    clock.advance(31 * MIN);
    expect(controller.status().longPause).toBe(true);
    controller.switchTo(store.get().waiting[0]!.id); // back to A: running again, no prompt
    expect(controller.status()).toMatchObject({ longPause: false, phase: 'focus' });
  });

  it('reload with several sessions: only the active one ran while away; the waiting ones stayed paused', () => {
    const a = makeSession({ id: 'a', slotId: 'meadow-1', startedAt: T0, pausedAt: T0 + 5 * MIN });
    const b = makeSession({ id: 'b', slotId: 'meadow-2', startedAt: T0 + 5 * MIN, plan: plan([30, -5, 25]), goalMs: 60 * MIN });
    const { controller, clock, store, names } = setup({ ...createDefaultState(T0), session: b, waiting: [a] });
    expect(names()).toEqual([]);
    clock.set(T0 + 20 * MIN);
    controller.check();
    const st = controller.status();
    expect(st.session!.id).toBe('b');
    expect(st.timeline!.elapsedMs).toBe(15 * MIN);
    expect(st.sessions.find((x) => x.session.id === 'a')!.timeline.elapsedMs).toBe(5 * MIN);
    // hours later the active one has bloomed (stamped at its real end); the waiting one has not
    clock.set(T0 + 600 * MIN);
    controller.check();
    expect(store.get().plants.map((p) => [p.id, p.completedAt])).toEqual([['b', T0 + 65 * MIN]]);
    expect(store.get().waiting.map((w) => w.id)).toEqual(['a']);
  });
});

describe('automatic focus watering', () => {
  const schedule = (store: { get(): GardenState }) => {
    const s = store.get().session!;
    return focusWateringTimes(s.seed, sessionTimeline(s, s.startedAt).focusTotalMs);
  };

  it('waters the active plant when focused time reaches each scheduled moment, once each', () => {
    const { controller, store, clock, ticker, payload } = setup();
    controller.start(opts({ goalMinutes: 60 }));
    const id = store.get().session!.id;
    const times = schedule(store);
    expect(times.length).toBeGreaterThan(3);
    clock.set(T0 + times[0]! - 1000);
    ticker.tick();
    expect(payload('session:water')).toEqual([]);
    expect(controller.nextFocusWatering()).toBe(1000);
    clock.set(T0 + times[0]!);
    ticker.tick();
    ticker.tick();
    expect(payload('session:water')).toEqual([{ blockIndex: 0, sessionId: id, auto: true }]);
    clock.set(T0 + times[1]!);
    ticker.tick();
    expect(payload('session:water')).toHaveLength(2);
    expect(store.get().session!.focusWaterings).toBe(2);
  });

  it('several due at once (a long gap) water once', () => {
    const { controller, store, clock, ticker, payload } = setup();
    controller.start(opts({ goalMinutes: 60 }));
    const times = schedule(store);
    clock.set(T0 + times[2]! + 1);
    ticker.tick();
    expect(payload('session:water')).toHaveLength(1);
    expect(store.get().session!.focusWaterings).toBe(3);
  });

  it('never while paused, and paused time does not count towards the next one', () => {
    const { controller, store, clock, ticker, payload } = setup();
    controller.start(opts({ goalMinutes: 60 }));
    const times = schedule(store);
    clock.set(T0 + times[0]! - 2 * MIN);
    controller.pause();
    clock.advance(120 * MIN);
    ticker.tick();
    expect(payload('session:water')).toEqual([]);
    controller.resume();
    expect(controller.nextFocusWatering()).toBe(2 * MIN);
    clock.advance(2 * MIN);
    ticker.tick();
    expect(payload('session:water')).toHaveLength(1);
  });

  it('never during a break (breaks keep tap-to-water) and never for a waiting session', () => {
    const { controller, store, clock, ticker, payload } = setup();
    controller.start(POM);
    const times = schedule(store);
    clock.set(T0 + 30 * MIN + 30_000); // in the break; waterings came due during the focus block
    ticker.tick();
    expect(payload('session:water')).toEqual([]); // let go, not shown in the break
    expect(store.get().session!.focusWaterings).toBe(times.filter((t) => t <= 30 * MIN).length);
    const id = store.get().session!.id;
    controller.water();
    expect(payload('session:water')).toEqual([{ blockIndex: 1, sessionId: id, auto: false }]);
    // once it waits, it is never watered
    controller.start(opts({ slotId: 'meadow-2' }));
    clock.advance(200 * MIN);
    ticker.tick();
    expect(payload('session:water').filter((p) => p.sessionId === id)).toHaveLength(1); // only the tap
  });
});
