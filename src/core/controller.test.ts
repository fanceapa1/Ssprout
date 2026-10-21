import { describe, expect, it, vi } from 'vitest';
import type { Habitat, SizeClass, SpeciesDef, Tier } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { createManualClock } from './clock';
import { createSessionController, createIntervalTicker, type Ticker } from './controller';
import { createEventBus, EVENT_NAMES, type EventMap, type EventName } from './events';
import { createDefaultState, createReducer, createStore, type GardenState } from './state';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

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
  def('clover', 1, ['meadow']),
  def('moss', 1, ['rock']),
  def('iris', 2, ['shore'], 'medium'),
  def('anemone', 2, ['meadow'], 'medium'),
  def('bellflower', 2, ['meadow', 'path']),
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
  return { clock, store, bus, ticker, controller, events, names, payload };
}

describe('start', () => {
  it('starts a session with a seeded id and weather and emits session:start', () => {
    const { controller, store, payload } = setup();
    const s = controller.start(50);
    expect(s).not.toBeNull();
    expect(store.get().session).toBe(s);
    expect(s!.goalMs).toBe(50 * MIN);
    expect(s!.startedAt).toBe(T0);
    expect(['sun', 'rain', 'mist']).toContain(s!.weather);
    expect(payload('session:start')).toEqual([{ session: s }]);
  });

  it('defaults to the last goal and clamps', () => {
    const { controller } = setup({ ...createDefaultState(T0), settings: { muted: true, lastGoalMinutes: 90, notifications: 'unasked' } });
    expect(controller.start()!.goalMs).toBe(90 * MIN);
    const b = setup();
    expect(b.controller.start(7)!.goalMs).toBe(10 * MIN);
  });

  it('is deterministic for a seed', () => {
    const a = setup(undefined, 'x').controller.start(25);
    const b = setup(undefined, 'x').controller.start(25);
    expect(a).toEqual(b);
  });

  it('refuses while a session runs or a reward is pending', () => {
    const { controller, clock, names } = setup();
    controller.start(10);
    expect(controller.start(10)).toBeNull();
    clock.advance(10 * MIN);
    controller.check();
    expect(controller.start(10)).toBeNull();
    expect(names().filter((n) => n === 'session:start')).toHaveLength(1);
  });

  it('retires the duration tip and announces it', () => {
    const { controller, store, payload } = setup();
    controller.start(25);
    expect(store.get().tips.duration).toBe('seen');
    expect(payload('tip:retired')).toEqual([{ id: 'duration' }]);
  });
});

describe('pause / resume / cancel', () => {
  it('excludes paused time and emits events with timestamps', () => {
    const { controller, clock, payload } = setup();
    const s = controller.start(25)!;
    clock.advance(5 * MIN);
    expect(controller.pause()).toBe(true);
    expect(controller.pause()).toBe(false); // idempotent
    clock.advance(60 * MIN);
    expect(controller.status()).toMatchObject({ phase: 'paused', elapsedMs: 5 * MIN, longPause: true, pausedForMs: 60 * MIN });
    expect(controller.resume()).toBe(true);
    expect(controller.resume()).toBe(false);
    expect(controller.status()).toMatchObject({ phase: 'running', elapsedMs: 5 * MIN, remainingMs: 20 * MIN, longPause: false });
    expect(payload('session:pause')).toEqual([{ sessionId: s.id, at: T0 + 5 * MIN }]);
    expect(payload('session:resume')).toEqual([{ sessionId: s.id, at: T0 + 65 * MIN }]);
  });

  it('cancel ends the session without reward', () => {
    const { controller, store, payload } = setup();
    const s = controller.start(25)!;
    expect(controller.cancel()).toBe(true);
    expect(store.get().session).toBeNull();
    expect(store.get().pendingReward).toBeNull();
    expect(store.get().stats.cancelled).toBe(1);
    expect(payload('session:cancel')).toEqual([{ sessionId: s.id, at: T0 }]);
    expect(controller.cancel()).toBe(false);
  });

  it('pause/resume/cancel without a session do nothing', () => {
    const { controller, names } = setup();
    expect(controller.pause()).toBe(false);
    expect(controller.resume()).toBe(false);
    expect(controller.cancel()).toBe(false);
    expect(names()).toEqual([]);
  });
});

describe('completion', () => {
  it('the ticker completes the session with a tiered, seeded offer', () => {
    const { controller, clock, ticker, store, payload } = setup();
    const s = controller.start(25)!;
    expect(ticker.running).toBe(true);
    clock.advance(25 * MIN - 1);
    ticker.tick();
    expect(store.get().session).not.toBeNull();
    clock.advance(1);
    ticker.tick();
    const r = store.get().pendingReward!;
    expect(r).toMatchObject({ sessionId: s.id, goalMinutes: 25, tier: 2, chosen: null, completedAt: T0 + 25 * MIN });
    expect(r.options).toHaveLength(3);
    expect(r.options.sort()).toEqual(['anemone', 'bellflower', 'iris']);
    expect(payload('session:complete')).toEqual([{ sessionId: s.id, reward: r }]);
    expect(store.get().stats).toMatchObject({ completed: 1, totalMinutes: 25 });
    expect(ticker.running).toBe(false); // no session → no ticking
  });

  it('falls back to lower tiers and prefers unowned species', () => {
    const owned: GardenState = {
      ...createDefaultState(T0),
      plants: [{ id: 'p', speciesId: 'violet', slotId: 'rock-1', seed: 1, plantedAt: 0, sessionMinutes: 10 }],
    };
    const { controller, clock, store } = setup(owned);
    controller.start(90); // tier 4: only cherry, then tier 2 (3 species)
    clock.advance(90 * MIN);
    controller.check();
    const r = store.get().pendingReward!;
    expect(r.tier).toBe(4);
    expect(r.options[0]).toBe('cherry');
    expect(r.options).toHaveLength(3);
    expect(r.options).not.toContain('violet');
  });

  it('offers are deterministic per seed', () => {
    const run = (seed: number) => {
      const { controller, clock, store } = setup(undefined, seed);
      controller.start(10);
      clock.advance(10 * MIN);
      controller.check();
      return store.get().pendingReward!.options;
    };
    expect(run(3)).toEqual(run(3));
  });

  it('does not complete while paused short of the goal', () => {
    const { controller, clock } = setup();
    controller.start(10);
    clock.advance(MIN);
    controller.pause();
    clock.advance(100 * MIN);
    expect(controller.check()).toBe(false);
  });

  it('completes on startup a session that finished while the app was closed', () => {
    const saved: GardenState = {
      ...createDefaultState(T0),
      session: { id: 's-old', goalMs: 25 * MIN, startedAt: T0 - 3 * 60 * MIN, pausedAt: null, pausedTotalMs: 10 * MIN, weather: 'mist' },
    };
    const { store, payload, ticker } = setup(saved);
    const r = store.get().pendingReward!;
    expect(r.sessionId).toBe('s-old');
    expect(r.completedAt).toBe(T0 - 3 * 60 * MIN + 35 * MIN); // the real moment it finished
    expect(payload('session:complete')).toHaveLength(1);
    expect(ticker.running).toBe(false);
  });

  it('resumes ticking on startup for a session still in progress', () => {
    const saved: GardenState = {
      ...createDefaultState(T0),
      session: { id: 's-old', goalMs: 25 * MIN, startedAt: T0 - 5 * MIN, pausedAt: null, pausedTotalMs: 0, weather: 'sun' },
    };
    const { store, ticker, controller } = setup(saved);
    expect(store.get().session).not.toBeNull();
    expect(ticker.running).toBe(true);
    expect(controller.status().remainingMs).toBe(20 * MIN);
  });

  it('check() is a no-op without a session', () => {
    expect(setup().controller.check()).toBe(false);
  });
});

describe('choose and place', () => {
  const rewarded = (initial?: GardenState) => {
    const ctx = setup(initial);
    ctx.controller.start(10);
    ctx.clock.advance(10 * MIN);
    ctx.controller.check();
    return ctx;
  };

  it('offer() returns the species definitions of the options', () => {
    const { controller, store } = rewarded();
    expect(controller.offer().map((s) => s.id)).toEqual(store.get().pendingReward!.options);
  });

  it('choose emits reward:chosen; placementOptions lists compatible slots', () => {
    const { controller, payload } = rewarded();
    expect(controller.placementOptions()).toEqual([]);
    expect(controller.choose('violet')).toBe(true);
    expect(controller.choose('violet')).toBe(false);
    expect(controller.choose('cherry')).toBe(false); // not offered
    expect(payload('reward:chosen')).toEqual([{ speciesId: 'violet' }]);
    expect(controller.placementOptions().map((o) => o.slot.id)).toEqual(['meadow-1', 'meadow-2', 'rock-1']);
  });

  it('place plants the species, retires the placement tip and emits plant:placed', () => {
    const { controller, store, payload } = rewarded();
    controller.choose('violet');
    const plant = controller.place('meadow-2')!;
    expect(plant).toMatchObject({ speciesId: 'violet', slotId: 'meadow-2', plantedAt: T0 + 10 * MIN, sessionMinutes: 10 });
    expect(Number.isInteger(plant.seed)).toBe(true);
    expect(store.get().plants).toEqual([plant]);
    expect(store.get().pendingReward).toBeNull();
    expect(store.get().tips.placement).toBe('seen');
    expect(payload('plant:placed')).toEqual([{ plant }]);
    expect(payload('plant:swapped')).toEqual([]);
  });

  it('place into an incompatible slot fails quietly', () => {
    const { controller, store, names } = rewarded();
    controller.choose('violet');
    expect(controller.place('shore-1')).toBeNull();
    expect(controller.place('nowhere')).toBeNull();
    expect(store.get().pendingReward).not.toBeNull();
    expect(names()).not.toContain('plant:placed');
  });

  it('swapping presses the old plant and emits plant:swapped before plant:placed', () => {
    const old = { id: 'old', speciesId: 'clover', slotId: 'meadow-1', seed: 5, plantedAt: T0 - 1, sessionMinutes: 10 };
    const { controller, store, payload, names } = rewarded({ ...createDefaultState(T0), plants: [old] });
    controller.choose(store.get().pendingReward!.options.find((id) => id !== 'moss')!);
    const opts = controller.placementOptions();
    expect(opts.find((o) => o.slot.id === 'meadow-1')?.occupiedBy).toEqual(old);
    const plant = controller.place('meadow-1')!;
    const removed = { speciesId: 'clover', seed: 5, plantedAt: T0 - 1, removedAt: T0 + 10 * MIN };
    expect(store.get().pressed).toEqual([removed]);
    expect(payload('plant:swapped')).toEqual([{ plant, removed }]);
    const n = names();
    expect(n.indexOf('plant:swapped')).toBeLessThan(n.indexOf('plant:placed'));
    expect(store.get().tips.swap).toBe('seen');
  });

  it('place without a chosen species does nothing', () => {
    const { controller } = rewarded();
    expect(controller.place('meadow-1')).toBeNull();
  });

  it('discard drops the reward', () => {
    const { controller, store } = rewarded();
    expect(controller.discard()).toBe(true);
    expect(store.get().pendingReward).toBeNull();
    expect(controller.discard()).toBe(false);
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
    const { controller, clock, ticker } = setup();
    const seen: number[] = [];
    const off = controller.onTick((s) => seen.push(s.remainingMs));
    controller.start(10);
    clock.advance(MIN);
    ticker.tick();
    clock.advance(MIN);
    ticker.tick();
    off();
    ticker.tick();
    expect(seen).toEqual([9 * MIN, 8 * MIN]);
  });

  it('status() while idle and with a pending reward', () => {
    const { controller, clock } = setup();
    expect(controller.status()).toMatchObject({ phase: 'idle', elapsedMs: 0, progress: 0, session: null });
    controller.start(10);
    clock.advance(5 * MIN);
    expect(controller.status().progress).toBeCloseTo(0.5);
    clock.advance(5 * MIN);
    controller.check();
    expect(controller.status().phase).toBe('reward');
  });

  it('setTicker swaps the tick source without losing the session', () => {
    const { controller, ticker, clock, store } = setup();
    controller.start(10);
    const other = manualTicker();
    controller.setTicker(other);
    expect(ticker.running).toBe(false);
    expect(other.running).toBe(true);
    clock.advance(10 * MIN);
    other.tick();
    expect(store.get().pendingReward).not.toBeNull();
  });

  it('dispose stops ticking and listening', () => {
    const { controller, ticker, store } = setup();
    controller.start(10);
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

  it('setSeed makes subsequent ids and weather reproducible', () => {
    const a = setup();
    a.controller.setSeed(99);
    const s1 = a.controller.start(10)!;
    const b = setup(undefined, 'something-else');
    b.controller.setSeed(99);
    const s2 = b.controller.start(10)!;
    expect(s1).toEqual(s2);
  });
});
