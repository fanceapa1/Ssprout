import { describe, expect, it, vi } from 'vitest';
import type { Habitat, SizeClass, SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { createManualClock } from './clock';
import { createIntervalTicker, createSessionController, type StartOptions, type Ticker } from './controller';
import { createEventBus, EVENT_NAMES, type EventMap, type EventName } from './events';
import { createDefaultState, createReducer, createStore, type GardenState } from './state';
import { makePlant, makeSession, MIN, plan, T0 } from './testing';

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
const SPECIES = [
  def('violet', 1, ['meadow', 'rock']),
  def('iris', 2, ['shore'], 'medium'),
  def('peony', 3, ['meadow'], 'medium'),
  def('cherry', 4, ['back'], 'tree'),
];
const slot = (id: string, habitat: Habitat, maxSize: SizeClass): Slot => ({ id, x: 0, y: 0, habitat, maxSize, scale: 1 });
const SLOTS = [
  slot('meadow-1', 'meadow', 'large'),
  slot('meadow-2', 'meadow', 'medium'),
  slot('shore-1', 'shore', 'medium'),
  slot('rock-1', 'rock', 'small'),
  slot('back-1', 'back', 'tree'),
];

/** A ticker driven by the test. */
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

function setup(initial: GardenState = createDefaultState(T0), seed: number | string = 1) {
  const clock = createManualClock(T0);
  const reducer = createReducer({
    getSpecies: (id) => SPECIES.find((s) => s.id === id),
    getSlot: (id) => SLOTS.find((s) => s.id === id),
  });
  const store = createStore(initial, reducer);
  const bus = createEventBus();
  const events: Array<[EventName, unknown]> = [];
  for (const name of EVENT_NAMES) bus.on(name, (p) => events.push([name, p]));
  const ticker = manualTicker();
  const controller = createSessionController({ store, clock, bus, species: SPECIES, slots: SLOTS, ticker, seed });
  const names = () => events.map(([n]) => n);
  const payload = <K extends EventName>(name: K) => events.filter(([n]) => n === name).map(([, p]) => p as EventMap[K]);
  /** advance the clock to `min` minutes after T0 and tick */
  const to = (min: number) => {
    clock.set(T0 + min * MIN);
    ticker.tick();
  };
  return { clock, store, bus, ticker, controller, events, names, payload, to };
}

const opts = (over: Partial<StartOptions> = {}): StartOptions => ({
  taskName: 'Biology ch. 4',
  goalMinutes: 25,
  speciesId: 'violet',
  slotId: 'meadow-1',
  ...over,
});
/** 90 min "Pomodoro": 30 · (5) · 25 · (5) · 25 */
const POM = opts({ goalMinutes: 90, planId: 'pomodoro' });

describe('start', () => {
  it('plants the chosen species with the chosen plan, seeded id/seed/weather, and emits session:start', () => {
    const { controller, store, payload } = setup();
    expect(controller.start(POM)).toBe(true);
    const s = store.get().session!;
    expect(s).toMatchObject({
      taskName: 'Biology ch. 4',
      goalMs: 90 * MIN,
      speciesId: 'violet',
      slotId: 'meadow-1',
      startedAt: T0,
      displacedPlantId: null,
      plan: { id: 'pomodoro', blocks: plan([30, -5, 25, -5, 25]).blocks },
    });
    expect(s.id).toMatch(/^session-/);
    expect(Number.isInteger(s.seed)).toBe(true);
    expect(['sun', 'rain', 'mist']).toContain(s.weather);
    expect(payload('session:start')).toEqual([{ session: s }]);
  });

  it('defaults to the unbroken plan and clamps the total', () => {
    const { controller, store } = setup();
    expect(controller.start(opts({ goalMinutes: 27 }))).toBe(true);
    expect(store.get().session!.plan.id).toBe('unbroken');
    expect(store.get().session!.goalMs).toBe(25 * MIN);
  });

  it('is deterministic for a seed', () => {
    const a = setup(undefined, 'x');
    const b = setup(undefined, 'x');
    a.controller.start(POM);
    b.controller.start(POM);
    expect(a.store.get().session).toEqual(b.store.get().session);
  });

  it('refuses plans not offered for the total, locked species, incompatible slots and a running session', () => {
    const { controller, store, names } = setup();
    expect(controller.start(opts({ planId: 'pomodoro' }))).toBe(false); // 25 min: only unbroken
    expect(controller.start(opts({ speciesId: 'peony' }))).toBe(false); // tier 3 needs 50
    expect(controller.start(opts({ slotId: 'shore-1' }))).toBe(false);
    expect(store.get().session).toBeNull();
    expect(controller.start(opts())).toBe(true);
    expect(controller.start(opts())).toBe(false);
    expect(names().filter((n) => n === 'session:start')).toHaveLength(1);
  });

  it('retires the start-flow tips', () => {
    const { controller, store, payload } = setup();
    controller.start(POM);
    expect(store.get().tips).toEqual({ task: 'seen', duration: 'seen', placement: 'seen', plan: 'seen' });
    expect(payload('tip:retired').map((p) => p.id)).toEqual(['task', 'duration', 'placement', 'plan']);
  });
});

describe('choices for the start sheet', () => {
  it('recommendPlans proxies the pure function', () => {
    const { controller } = setup();
    expect(controller.recommendPlans(60).map((p) => p.id)).toEqual(['unbroken', 'pomodoro', 'long-focus']);
  });

  it('selectableSpecies marks locked and earned species', () => {
    const { controller } = setup();
    const r = controller.selectableSpecies(50);
    expect(r.map((s) => [s.species.id, s.locked, s.earned, s.requiredMinutes])).toEqual([
      ['peony', false, true, 50],
      ['iris', false, false, 25],
      ['violet', false, false, 10],
      ['cherry', true, false, 90],
    ]);
  });

  it('placementOptions lists compatible slots with occupants', () => {
    const occupant = makePlant({ id: 'old', slotId: 'meadow-2' });
    const { controller } = setup({ ...createDefaultState(T0), plants: [occupant] });
    expect(controller.placementOptions('violet').map((o) => [o.slot.id, o.occupiedBy?.id])).toEqual([
      ['meadow-1', undefined],
      ['meadow-2', 'old'],
      ['rock-1', undefined],
    ]);
    expect(controller.placementOptions('nope')).toEqual([]);
  });
});

describe('blocks: breaks, watering and skipping', () => {
  it('announces each block transition once from the tick', () => {
    const { controller, to, names, payload } = setup();
    controller.start(POM);
    to(10);
    to(29);
    expect(names()).not.toContain('session:break');
    to(30);
    to(31);
    expect(payload('session:break')).toEqual([{ blockIndex: 1 }]);
    to(35);
    to(36);
    expect(payload('session:focus')).toEqual([{ blockIndex: 2 }]);
  });

  it('after a long gap, only the current block is announced', () => {
    const { controller, to, payload } = setup();
    controller.start(POM);
    to(62); // blocks 1, 2, 3 passed / reached while "throttled": now in break 3
    expect(payload('session:break')).toEqual([{ blockIndex: 3 }]);
    expect(payload('session:focus')).toEqual([]);
  });

  it('water() waters the current break once and emits session:water', () => {
    const { controller, to, store, payload } = setup();
    controller.start(POM);
    expect(controller.water()).toBe(false); // focus
    to(31);
    expect(controller.water()).toBe(true);
    expect(controller.water()).toBe(false);
    expect(store.get().session!.waterings).toEqual([1]);
    expect(payload('session:water')).toEqual([{ blockIndex: 1 }]);
    expect(controller.status().timeline!.watered).toBe(true);
    expect(store.get().tips.water).toBe('seen');
  });

  it('skipBreak() jumps to the next focus block and announces it; the session ends sooner', () => {
    const { controller, to, store, payload, clock } = setup();
    controller.start(POM);
    to(31);
    expect(controller.skipBreak()).toBe(true);
    expect(store.get().session!.skippedMs).toBe(4 * MIN);
    expect(payload('session:focus')).toEqual([{ blockIndex: 2 }]);
    expect(controller.skipBreak()).toBe(false); // now in focus
    clock.set(T0 + 86 * MIN - 1);
    controller.check();
    expect(store.get().session).not.toBeNull();
    to(86);
    expect(store.get().session).toBeNull();
    expect(store.get().plants[0]!.sessionMinutes).toBe(90);
  });

  it('skipping the last break straight to the end completes the session', () => {
    const { controller, store, clock } = setup();
    controller.start(opts({ goalMinutes: 30, planId: 'pomodoro' })); // 15 · (5) · 10
    clock.set(T0 + 16 * MIN);
    controller.skipBreak();
    expect(store.get().session).not.toBeNull();
    clock.set(T0 + 26 * MIN);
    controller.check();
    expect(store.get().plants).toHaveLength(1);
  });
});

describe('pause / resume / cancel', () => {
  it('excludes paused time and emits events with timestamps', () => {
    const { controller, clock, store, payload } = setup();
    controller.start(opts());
    const id = store.get().session!.id;
    clock.advance(5 * MIN);
    expect(controller.pause()).toBe(true);
    expect(controller.pause()).toBe(false);
    clock.advance(60 * MIN);
    expect(controller.status()).toMatchObject({ phase: 'paused', longPause: true, pausedForMs: 60 * MIN });
    expect(controller.status().timeline!.elapsedMs).toBe(5 * MIN);
    expect(controller.resume()).toBe(true);
    expect(controller.resume()).toBe(false);
    expect(controller.status()).toMatchObject({ phase: 'focus', longPause: false });
    expect(controller.status().timeline!.totalRemainingMs).toBe(20 * MIN);
    expect(payload('session:pause')).toEqual([{ sessionId: id, at: T0 + 5 * MIN }]);
    expect(payload('session:resume')).toEqual([{ sessionId: id, at: T0 + 65 * MIN }]);
  });

  it('cancel withers the seedling; a displaced plant stays', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1' });
    const { controller, store, payload } = setup({ ...createDefaultState(T0), plants: [old] });
    controller.start(opts());
    const id = store.get().session!.id;
    expect(controller.cancel()).toBe(true);
    expect(store.get().session).toBeNull();
    expect(store.get().plants).toEqual([old]);
    expect(store.get().stats.cancelled).toBe(1);
    expect(payload('session:cancel')).toEqual([{ sessionId: id, at: T0 }]);
    expect(controller.cancel()).toBe(false);
  });

  it('nothing to do without a session', () => {
    const { controller, names } = setup();
    expect(controller.pause()).toBe(false);
    expect(controller.resume()).toBe(false);
    expect(controller.cancel()).toBe(false);
    expect(controller.water()).toBe(false);
    expect(controller.skipBreak()).toBe(false);
    expect(controller.check()).toBe(false);
    expect(names()).toEqual([]);
  });
});

describe('completion', () => {
  it('the tick finalises the plant and emits plant:placed then session:complete', () => {
    const { controller, ticker, store, to, payload, names } = setup();
    controller.start(opts());
    const id = store.get().session!.id;
    expect(ticker.running).toBe(true);
    to(25);
    const plant = store.get().plants[0]!;
    expect(plant).toMatchObject({ id, speciesId: 'violet', slotId: 'meadow-1', taskName: 'Biology ch. 4', sessionMinutes: 25, completedAt: T0 + 25 * MIN, plantedAt: T0 });
    expect(payload('plant:placed')).toEqual([{ plant }]);
    expect(payload('session:complete')).toEqual([{ sessionId: id, plant }]);
    const n = names();
    expect(n.indexOf('plant:placed')).toBeLessThan(n.indexOf('session:complete'));
    expect(ticker.running).toBe(false);
  });

  it('a displaced plant is pressed: plant:swapped precedes plant:placed', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1', taskName: 'Old task' });
    const { controller, store, to, payload, names } = setup({ ...createDefaultState(T0), plants: [old] });
    controller.start(opts());
    to(25);
    const plant = store.get().plants.find((p) => p.slotId === 'meadow-1')!;
    const removed = { speciesId: old.speciesId, seed: old.seed, plantedAt: old.plantedAt, removedAt: T0 + 25 * MIN, taskName: 'Old task' };
    expect(store.get().pressed).toEqual([removed]);
    expect(payload('plant:swapped')).toEqual([{ plant, removed }]);
    const n = names();
    expect(n.indexOf('plant:swapped')).toBeLessThan(n.indexOf('plant:placed'));
    expect(store.get().tips.swap).toBe('seen');
  });

  it('completes on startup a session that finished while the app was closed', () => {
    const saved: GardenState = {
      ...createDefaultState(T0),
      session: makeSession({ id: 's-old', startedAt: T0 - 3 * 60 * MIN, pausedTotalMs: 10 * MIN }),
    };
    const { store, payload, ticker } = setup(saved);
    const plant = store.get().plants[0]!;
    expect(plant.id).toBe('s-old');
    expect(plant.completedAt).toBe(T0 - 3 * 60 * MIN + 35 * MIN); // the real moment it finished
    expect(payload('session:complete')).toHaveLength(1);
    expect(ticker.running).toBe(false);
  });

  it('on startup mid-break: announces the current break once, not past blocks', () => {
    const saved: GardenState = {
      ...createDefaultState(T0),
      session: makeSession({ plan: plan([25, -5, 25, -5, 30]), startedAt: T0 - 57 * MIN }),
    };
    const { payload, ticker, controller } = setup(saved);
    expect(payload('session:break')).toEqual([{ blockIndex: 3 }]);
    ticker.tick();
    ticker.tick();
    expect(payload('session:break')).toHaveLength(1);
    expect(payload('session:focus')).toEqual([]);
    expect(ticker.running).toBe(true);
    expect(controller.status().phase).toBe('break');
  });

  it('on startup in the first focus block: nothing to announce', () => {
    const saved: GardenState = { ...createDefaultState(T0), session: makeSession({ startedAt: T0 - 5 * MIN }) };
    const { names, controller } = setup(saved);
    expect(names()).toEqual([]);
    expect(controller.status().timeline!.totalRemainingMs).toBe(20 * MIN);
  });

  it('does not complete while paused short of the end', () => {
    const { controller, clock } = setup();
    controller.start(opts());
    clock.advance(MIN);
    controller.pause();
    clock.advance(100 * MIN);
    expect(controller.check()).toBe(false);
  });
});

describe('status', () => {
  it('idle → focus → break, with a live timeline', () => {
    const { controller, clock } = setup();
    expect(controller.status()).toEqual({ phase: 'idle', session: null, timeline: null, pausedForMs: 0, longPause: false });
    controller.start(POM);
    clock.set(T0 + 15 * MIN);
    const st = controller.status();
    expect(st.phase).toBe('focus');
    expect(st.timeline!.growth).toBeCloseTo(15 / 80);
    clock.set(T0 + 32 * MIN);
    expect(controller.status().phase).toBe('break');
    expect(controller.status().timeline!.blockRemainingMs).toBe(3 * MIN);
  });
});

describe('settings, tips and fauna', () => {
  it('updateSettings emits settings:changed and retires the sound tip on toggle', () => {
    const { controller, store, payload } = setup();
    expect(controller.updateSettings({ muted: false })).toBe(true);
    expect(controller.updateSettings({ muted: false })).toBe(false);
    expect(payload('settings:changed')).toEqual([{ settings: store.get().settings }]);
    expect(store.get().tips.sound).toBe('seen');
  });

  it('retireTip retires once', () => {
    const { controller, payload } = setup();
    expect(controller.retireTip('widget')).toBe(true);
    expect(controller.retireTip('widget')).toBe(false);
    expect(payload('tip:retired')).toEqual([{ id: 'widget' }]);
  });

  it('announceFauna emits fauna:arrived once per creature', () => {
    const { controller, store, payload } = setup();
    expect(controller.announceFauna('koi-1')).toBe(true);
    expect(controller.announceFauna('koi-1')).toBe(false);
    expect(store.get().faunaSeen).toEqual(['koi-1']);
    expect(payload('fauna:arrived')).toEqual([{ id: 'koi-1' }]);
  });
});

describe('ticking', () => {
  it('onTick delivers the status after each tick', () => {
    const { controller, to } = setup();
    const seen: number[] = [];
    const off = controller.onTick((s) => seen.push(s.timeline!.totalRemainingMs));
    controller.start(opts({ goalMinutes: 10 }));
    to(1);
    to(2);
    off();
    to(3);
    expect(seen).toEqual([9 * MIN, 8 * MIN]);
  });

  it('setTicker swaps the tick source without losing the session', () => {
    const { controller, ticker, clock, store } = setup();
    controller.start(opts({ goalMinutes: 10 }));
    const other = manualTicker();
    controller.setTicker(other);
    expect(ticker.running).toBe(false);
    expect(other.running).toBe(true);
    clock.advance(10 * MIN);
    other.tick();
    expect(store.get().plants).toHaveLength(1);
  });

  it('dispose stops ticking and listening', () => {
    const { controller, ticker, store } = setup();
    controller.start(opts());
    controller.dispose();
    expect(ticker.running).toBe(false);
    store.dispatch({ type: 'settings/update', patch: { muted: false } });
    expect(store.get().tips.sound).toBeUndefined();
  });

  it('createIntervalTicker ticks every interval until stopped', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const stop = createIntervalTicker(1000).start(fn);
      vi.advanceTimersByTime(3500);
      expect(fn).toHaveBeenCalledTimes(3);
      stop();
      vi.advanceTimersByTime(5000);
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('setSeed makes subsequent ids, seeds and weather reproducible', () => {
    const a = setup();
    a.controller.setSeed(99);
    a.controller.start(opts());
    const b = setup(undefined, 'something-else');
    b.controller.setSeed(99);
    b.controller.start(opts());
    expect(a.store.get().session).toEqual(b.store.get().session);
  });
});
