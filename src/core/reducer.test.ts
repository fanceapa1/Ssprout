import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass } from '../plants/types';
import {
  createDefaultState,
  createReducer,
  mergeSettings,
  reducer as worldlessReducer,
  type Action,
  type GardenState,
  type PlantInstance,
  type ReducerWorld,
} from './state';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

const SPECIES: Record<string, { habitats: Habitat[]; sizeClass: SizeClass }> = {
  violet: { habitats: ['meadow', 'rock'], sizeClass: 'small' },
  iris: { habitats: ['shore'], sizeClass: 'medium' },
  cherry: { habitats: ['back', 'meadow'], sizeClass: 'tree' },
};
const SLOTS: Record<string, { id: string; habitat: Habitat; maxSize: SizeClass }> = {
  'meadow-1': { id: 'meadow-1', habitat: 'meadow', maxSize: 'large' },
  'shore-1': { id: 'shore-1', habitat: 'shore', maxSize: 'medium' },
  'back-1': { id: 'back-1', habitat: 'back', maxSize: 'tree' },
  'rock-1': { id: 'rock-1', habitat: 'rock', maxSize: 'small' },
};
const world: ReducerWorld = { getSpecies: (id) => SPECIES[id], getSlot: (id) => SLOTS[id] };
const reducer = createReducer(world);

const run = (state: GardenState, ...actions: Action[]): GardenState => actions.reduce(reducer, state);
const fresh = () => createDefaultState(T0);
const start = (goalMinutes = 25, now = T0): Action => ({
  type: 'session/start',
  goalMinutes,
  now,
  id: 'session-1',
  weather: 'rain',
});
const complete = (now: number, tier: 1 | 2 | 3 | 4 = 2, options = ['violet', 'iris', 'cherry']): Action => ({
  type: 'session/complete',
  now,
  options,
  tier,
});
const place = (slotId: string, id = 'plant-1', now = T0 + 30 * MIN): Action => ({
  type: 'plant/place',
  slotId,
  id,
  seed: 42,
  now,
});
/** A state with a completed 25-min session and `chosen` picked. */
const rewarded = (chosen = 'violet', base = fresh()) =>
  run(base, start(25), complete(T0 + 25 * MIN), { type: 'reward/choose', speciesId: chosen });

const plant = (id: string, slotId: string, speciesId = 'violet'): PlantInstance => ({
  id,
  speciesId,
  slotId,
  seed: 7,
  plantedAt: T0 - 1000,
  sessionMinutes: 10,
});

/** Asserts the action is a no-op: the exact same state object comes back. */
const expectNoop = (state: GardenState, action: Action) => expect(reducer(state, action)).toBe(state);

describe('session/start', () => {
  it('starts a session and remembers the goal', () => {
    const s = run(fresh(), start(50));
    expect(s.session).toEqual({
      id: 'session-1',
      goalMs: 50 * MIN,
      startedAt: T0,
      pausedAt: null,
      pausedTotalMs: 0,
      weather: 'rain',
    });
    expect(s.settings.lastGoalMinutes).toBe(50);
  });

  it('clamps and snaps the goal to 10–180 in 5-min steps', () => {
    expect(run(fresh(), start(3)).session!.goalMs).toBe(10 * MIN);
    expect(run(fresh(), start(999)).session!.goalMs).toBe(180 * MIN);
    expect(run(fresh(), start(47)).session!.goalMs).toBe(45 * MIN);
    expect(run(fresh(), start(47)).settings.lastGoalMinutes).toBe(45);
  });

  it('cannot start while a session is active', () => {
    const s = run(fresh(), start());
    expectNoop(s, start(50, T0 + 1000));
  });

  it('cannot start while a reward is pending', () => {
    const s = run(fresh(), start(), complete(T0 + 25 * MIN));
    expect(s.pendingReward).not.toBeNull();
    expectNoop(s, start());
  });

  it('rejects malformed payloads', () => {
    const s = fresh();
    expectNoop(s, { ...start(), id: '' } as Action);
    expectNoop(s, { ...start(), now: Number.NaN } as Action);
    expectNoop(s, { ...start(), goalMinutes: Number.NaN } as Action);
    expectNoop(s, { ...start(), weather: 'snow' } as unknown as Action);
  });

  it('does not mutate the previous state', () => {
    const s = fresh();
    const snapshot = structuredClone(s);
    run(s, start());
    expect(s).toEqual(snapshot);
  });
});

describe('session/pause and session/resume', () => {
  it('pause records the moment; resume adds the paused span', () => {
    let s = run(fresh(), start(), { type: 'session/pause', now: T0 + 5 * MIN });
    expect(s.session!.pausedAt).toBe(T0 + 5 * MIN);
    s = run(s, { type: 'session/resume', now: T0 + 12 * MIN });
    expect(s.session!.pausedAt).toBeNull();
    expect(s.session!.pausedTotalMs).toBe(7 * MIN);
    s = run(s, { type: 'session/pause', now: T0 + 20 * MIN }, { type: 'session/resume', now: T0 + 21 * MIN });
    expect(s.session!.pausedTotalMs).toBe(8 * MIN);
  });

  it('pause is idempotent', () => {
    const s = run(fresh(), start(), { type: 'session/pause', now: T0 + MIN });
    expectNoop(s, { type: 'session/pause', now: T0 + 2 * MIN });
  });

  it('resume is idempotent', () => {
    const s = run(fresh(), start());
    expectNoop(s, { type: 'session/resume', now: T0 + MIN });
  });

  it('a clock running backwards never produces a negative paused span', () => {
    const s = run(
      fresh(),
      start(),
      { type: 'session/pause', now: T0 + 5 * MIN },
      { type: 'session/resume', now: T0 + 4 * MIN },
    );
    expect(s.session!.pausedTotalMs).toBe(0);
    const early = run(fresh(), start(), { type: 'session/pause', now: T0 - 10 });
    expect(early.session!.pausedAt).toBe(T0);
  });

  it('pause / resume without a session are no-ops', () => {
    expectNoop(fresh(), { type: 'session/pause', now: T0 });
    expectNoop(fresh(), { type: 'session/resume', now: T0 });
  });
});

describe('session/cancel', () => {
  it('clears the session and counts it, growing nothing', () => {
    const s = run(fresh(), start(), { type: 'session/cancel', now: T0 + MIN });
    expect(s.session).toBeNull();
    expect(s.pendingReward).toBeNull();
    expect(s.plants).toEqual([]);
    expect(s.stats).toEqual({ totalMinutes: 0, completed: 0, cancelled: 1 });
  });

  it('works while paused', () => {
    const s = run(fresh(), start(), { type: 'session/pause', now: T0 + MIN }, { type: 'session/cancel', now: T0 });
    expect(s.session).toBeNull();
    expect(s.stats.cancelled).toBe(1);
  });

  it('is a no-op without a session', () => {
    expectNoop(fresh(), { type: 'session/cancel', now: T0 });
  });
});

describe('session/complete', () => {
  it('creates the pending reward, clears the session and updates stats', () => {
    const s = run(fresh(), start(25), complete(T0 + 25 * MIN));
    expect(s.session).toBeNull();
    expect(s.pendingReward).toEqual({
      sessionId: 'session-1',
      goalMinutes: 25,
      tier: 2,
      options: ['violet', 'iris', 'cherry'],
      chosen: null,
      completedAt: T0 + 25 * MIN,
    });
    expect(s.stats).toEqual({ totalMinutes: 25, completed: 1, cancelled: 0 });
  });

  it('adds goal minutes (not wall time) to totalMinutes', () => {
    const s = run(fresh(), start(10), complete(T0 + 300 * MIN, 1));
    expect(s.stats.totalMinutes).toBe(10);
  });

  it('is rejected before studied time reaches the goal', () => {
    const s = run(fresh(), start(25));
    expectNoop(s, complete(T0 + 25 * MIN - 1));
  });

  it('accounts for pauses', () => {
    const s = run(fresh(), start(25), { type: 'session/pause', now: T0 }, { type: 'session/resume', now: T0 + 5 * MIN });
    expectNoop(s, complete(T0 + 29 * MIN));
    expect(run(s, complete(T0 + 30 * MIN)).pendingReward).not.toBeNull();
  });

  it('requires the tier to match the goal', () => {
    const s = run(fresh(), start(25));
    expectNoop(s, complete(T0 + 25 * MIN, 1));
    expectNoop(s, complete(T0 + 25 * MIN, 3));
  });

  it('rejects duplicate or empty option ids; allows an empty offer', () => {
    const s = run(fresh(), start(25));
    expectNoop(s, complete(T0 + 25 * MIN, 2, ['a', 'a']));
    expectNoop(s, complete(T0 + 25 * MIN, 2, ['']));
    expect(run(s, complete(T0 + 25 * MIN, 2, [])).pendingReward!.options).toEqual([]);
  });

  it('is a no-op without a session', () => {
    expectNoop(fresh(), complete(T0));
  });
});

describe('reward/choose', () => {
  it('picks one of the offered species and may change its mind', () => {
    let s = rewarded('violet');
    expect(s.pendingReward!.chosen).toBe('violet');
    s = run(s, { type: 'reward/choose', speciesId: 'iris' });
    expect(s.pendingReward!.chosen).toBe('iris');
  });

  it('rejects species that were not offered, repeats and missing rewards', () => {
    const s = rewarded('violet');
    expectNoop(s, { type: 'reward/choose', speciesId: 'lotus' });
    expectNoop(s, { type: 'reward/choose', speciesId: 'violet' });
    expectNoop(fresh(), { type: 'reward/choose', speciesId: 'violet' });
  });
});

describe('plant/place', () => {
  it('plants the chosen species in a compatible empty slot and clears the reward', () => {
    const s = run(rewarded('violet'), place('meadow-1'));
    expect(s.plants).toEqual([
      { id: 'plant-1', speciesId: 'violet', slotId: 'meadow-1', seed: 42, plantedAt: T0 + 30 * MIN, sessionMinutes: 25 },
    ]);
    expect(s.pendingReward).toBeNull();
    expect(s.pressed).toEqual([]);
  });

  it('requires a chosen species', () => {
    const s = run(fresh(), start(25), complete(T0 + 25 * MIN));
    expectNoop(s, place('meadow-1'));
    expectNoop(fresh(), place('meadow-1'));
  });

  it('rejects slots with the wrong habitat', () => {
    expectNoop(rewarded('violet'), place('shore-1'));
    expectNoop(rewarded('iris'), place('meadow-1'));
  });

  it('rejects slots that are too small for the species', () => {
    const s = rewarded('cherry');
    expect(run(s, place('back-1')).plants).toHaveLength(1);
    expectNoop(s, place('meadow-1')); // meadow-1 maxSize large < tree
  });

  it('rejects unknown slots and unknown species', () => {
    expectNoop(rewarded('violet'), place('nowhere'));
    const unknown = run(fresh(), start(25), complete(T0 + 25 * MIN, 2, ['ghost']), {
      type: 'reward/choose',
      speciesId: 'ghost',
    });
    expectNoop(unknown, place('meadow-1'));
  });

  it('rejects duplicate plant ids and malformed payloads', () => {
    const base = { ...fresh(), plants: [plant('plant-1', 'rock-1')] };
    const s = rewarded('violet', base);
    expectNoop(s, place('meadow-1', 'plant-1'));
    expectNoop(s, { ...place('meadow-1'), seed: Number.NaN } as Action);
    expectNoop(s, { ...place('meadow-1'), id: '' } as Action);
  });

  it('swaps an occupant into the pressed flowers', () => {
    const old = plant('old', 'meadow-1', 'cherry');
    const other = plant('other', 'rock-1');
    const s = run(rewarded('violet', { ...fresh(), plants: [old, other] }), place('meadow-1', 'new', T0 + 40 * MIN));
    expect(s.plants.map((p) => p.id)).toEqual(['other', 'new']);
    expect(s.plants.find((p) => p.slotId === 'meadow-1')!.speciesId).toBe('violet');
    expect(s.pressed).toEqual([{ speciesId: 'cherry', seed: 7, plantedAt: T0 - 1000, removedAt: T0 + 40 * MIN }]);
    expect(s.pendingReward).toBeNull();
  });

  it('without a world, any slot id is accepted', () => {
    const s = [start(25), complete(T0 + 25 * MIN), { type: 'reward/choose', speciesId: 'violet' } as Action, place('anything')].reduce(
      worldlessReducer,
      fresh(),
    );
    expect(s.plants[0]!.slotId).toBe('anything');
  });
});

describe('reward/discard', () => {
  it('drops the pending reward', () => {
    expect(run(rewarded(), { type: 'reward/discard' }).pendingReward).toBeNull();
  });

  it('is a no-op without one', () => {
    expectNoop(fresh(), { type: 'reward/discard' });
  });
});

describe('tip/retire', () => {
  it('marks a tip as seen once', () => {
    const s = run(fresh(), { type: 'tip/retire', id: 'duration' });
    expect(s.tips).toEqual({ duration: 'seen' });
    expectNoop(s, { type: 'tip/retire', id: 'duration' });
    expectNoop(s, { type: 'tip/retire', id: '' });
  });
});

describe('settings/update', () => {
  it('merges valid fields', () => {
    const s = run(fresh(), { type: 'settings/update', patch: { muted: false, notifications: 'granted' } });
    expect(s.settings).toEqual({ muted: false, lastGoalMinutes: 25, notifications: 'granted' });
  });

  it('clamps lastGoalMinutes', () => {
    expect(run(fresh(), { type: 'settings/update', patch: { lastGoalMinutes: 400 } }).settings.lastGoalMinutes).toBe(180);
  });

  it('ignores invalid values and returns the same state when nothing changes', () => {
    const s = fresh();
    expectNoop(s, { type: 'settings/update', patch: { muted: true } });
    expectNoop(s, { type: 'settings/update', patch: {} });
    expectNoop(s, { type: 'settings/update', patch: { muted: 'yes', notifications: 'maybe' } as never });
    expectNoop(s, { type: 'settings/update', patch: null as never });
  });

  it('mergeSettings returns the same object when unchanged', () => {
    const cur = fresh().settings;
    expect(mergeSettings(cur, { lastGoalMinutes: 25 })).toBe(cur);
    expect(mergeSettings(cur, { lastGoalMinutes: 26 })).toBe(cur); // snaps back to 25
  });
});

describe('fauna/seen', () => {
  it('records each creature once', () => {
    const s = run(fresh(), { type: 'fauna/seen', id: 'koi-1' }, { type: 'fauna/seen', id: 'dragonfly' });
    expect(s.faunaSeen).toEqual(['koi-1', 'dragonfly']);
    expectNoop(s, { type: 'fauna/seen', id: 'koi-1' });
    expectNoop(s, { type: 'fauna/seen', id: '' });
  });
});

describe('state/replace and state/reset', () => {
  it('replace swaps in a whole state', () => {
    const other = { ...createDefaultState(5), stats: { totalMinutes: 90, completed: 2, cancelled: 0 } };
    expect(run(fresh(), { type: 'state/replace', state: other })).toBe(other);
  });

  it('replace rejects other schema versions and the same state', () => {
    const s = fresh();
    expectNoop(s, { type: 'state/replace', state: { ...s, version: 2 } as never });
    expectNoop(s, { type: 'state/replace', state: null as never });
    expectNoop(s, { type: 'state/replace', state: s });
  });

  it('reset returns a fresh default garden', () => {
    const s = run(rewarded(), place('meadow-1'), { type: 'state/reset', now: T0 + 99 });
    expect(s).toEqual(createDefaultState(T0 + 99));
    expectNoop(fresh(), { type: 'state/reset', now: Number.NaN });
  });
});

describe('full loop', () => {
  it('start → pause → resume → complete → choose → place', () => {
    const s = run(
      fresh(),
      start(10),
      { type: 'session/pause', now: T0 + 2 * MIN },
      { type: 'session/resume', now: T0 + 40 * MIN },
      complete(T0 + 48 * MIN, 1, ['violet']),
      { type: 'reward/choose', speciesId: 'violet' },
      place('rock-1', 'p', T0 + 50 * MIN),
    );
    expect(s.session).toBeNull();
    expect(s.pendingReward).toBeNull();
    expect(s.plants).toHaveLength(1);
    expect(s.plants[0]!.sessionMinutes).toBe(10);
    expect(s.stats).toEqual({ totalMinutes: 10, completed: 1, cancelled: 0 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
