import { describe, expect, it } from 'vitest';
import type { Habitat, SizeClass, Tier } from '../plants/types';
import { findPlan, type StudyPlan } from './plans';
import {
  createDefaultState,
  createReducer,
  mergeSettings,
  reducer as worldlessReducer,
  type Action,
  type GardenState,
  type ReducerWorld,
} from './state';
import { makePlant, MIN, plan, T0 } from './testing';

const SPECIES: Record<string, { habitats: Habitat[]; sizeClass: SizeClass; tier: Tier }> = {
  violet: { habitats: ['meadow', 'rock'], sizeClass: 'small', tier: 1 },
  iris: { habitats: ['shore'], sizeClass: 'medium', tier: 2 },
  peony: { habitats: ['meadow'], sizeClass: 'medium', tier: 3 },
  cherry: { habitats: ['back', 'meadow'], sizeClass: 'tree', tier: 4 },
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
/** 25 focus · 5 break · 25 focus · 5 break · 30 focus */
const POMODORO = plan([25, -5, 25, -5, 30], 'pomodoro');

type StartOver = Partial<Omit<Extract<Action, { type: 'session/start' }>, 'type'>>;
const start = (over: StartOver = {}): Action => {
  const goalMinutes = over.goalMinutes ?? (over.plan ? over.plan.blocks.reduce((s, b) => s + b.minutes, 0) : 25);
  return {
    type: 'session/start',
    id: 'session-1',
    taskName: 'Biology ch. 4',
    goalMinutes,
    plan: over.plan ?? (findPlan(goalMinutes, 'unbroken') as StudyPlan),
    speciesId: 'violet',
    slotId: 'meadow-1',
    seed: 42,
    now: T0,
    weather: 'rain',
    ...over,
  };
};
const at = (min: number) => T0 + min * MIN;
const running = (over: StartOver = {}, base = fresh()) => run(base, start(over));

/** Asserts the action is a no-op: the exact same state object comes back. */
const expectNoop = (state: GardenState, action: Action) => expect(reducer(state, action)).toBe(state);

describe('session/start', () => {
  it('plants a seedling session with everything chosen up front', () => {
    const s = running({ plan: POMODORO, goalMinutes: 90 });
    expect(s.session).toEqual({
      id: 'session-1',
      taskName: 'Biology ch. 4',
      goalMs: 90 * MIN,
      plan: POMODORO,
      speciesId: 'violet',
      slotId: 'meadow-1',
      seed: 42,
      displacedPlantId: null,
      startedAt: T0,
      pausedAt: null,
      pausedTotalMs: 0,
      skippedMs: 0,
      weather: 'rain',
      waterings: [],
      focusWaterings: 0,
    });
    expect(s.settings.lastGoalMinutes).toBe(90);
    expect(s.plants).toEqual([]);
  });

  it('copies the plan (later mutation of the input does not leak in)', () => {
    const p = plan([25]);
    const s = running({ plan: p });
    p.blocks[0]!.minutes = 99;
    expect(s.session!.plan.blocks[0]!.minutes).toBe(25);
  });

  it('normalises the task name', () => {
    expect(running({ taskName: '   ' }).session!.taskName).toBe('Study session');
    expect(running({ taskName: '  French  verbs ' }).session!.taskName).toBe('French verbs');
    expect(running({ taskName: 'x'.repeat(60) }).session!.taskName).toHaveLength(40);
  });

  it('records the finished plant in the chosen slot as displaced (it stays until completion)', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1' });
    const s = running({}, { ...fresh(), plants: [old] });
    expect(s.session!.displacedPlantId).toBe('old');
    expect(s.plants).toEqual([old]);
  });

  it('cannot start while a session exists', () => {
    expectNoop(running(), start({ id: 'session-2' }));
  });

  it('requires a valid total on the 5-minute grid and a plan summing to it', () => {
    expectNoop(fresh(), start({ goalMinutes: 27, plan: plan([27]) }));
    expectNoop(fresh(), start({ goalMinutes: 5, plan: plan([5]) }));
    expectNoop(fresh(), start({ goalMinutes: 30, plan: plan([25]) }));
    expectNoop(fresh(), start({ goalMinutes: 30, plan: plan([25, -5]) })); // ends with a break
    expectNoop(fresh(), start({ goalMinutes: 30, plan: { id: 'x', name: 'x', blocks: [] } }));
  });

  it('only allows species whose tier is earned by the total', () => {
    expectNoop(fresh(), start({ speciesId: 'peony', goalMinutes: 25 }));
    expect(running({ speciesId: 'peony', goalMinutes: 50 }).session!.speciesId).toBe('peony');
    expect(running({ speciesId: 'violet', goalMinutes: 180 }).session).not.toBeNull(); // lower tiers ok
    expectNoop(fresh(), start({ speciesId: 'cherry', slotId: 'back-1', goalMinutes: 85 }));
    expect(running({ speciesId: 'cherry', slotId: 'back-1', goalMinutes: 90 }).session).not.toBeNull();
  });

  it('requires a compatible slot (habitat + size class)', () => {
    expectNoop(fresh(), start({ speciesId: 'violet', slotId: 'shore-1' }));
    expectNoop(fresh(), start({ speciesId: 'cherry', slotId: 'meadow-1', goalMinutes: 90 })); // too big
    expectNoop(fresh(), start({ slotId: 'nowhere' }));
    expectNoop(fresh(), start({ speciesId: 'ghost' }));
  });

  it('rejects malformed payloads', () => {
    const s = fresh();
    expectNoop(s, start({ id: '' }));
    expectNoop(s, start({ speciesId: '' }));
    expectNoop(s, start({ slotId: '' }));
    expectNoop(s, start({ now: Number.NaN }));
    expectNoop(s, start({ seed: Infinity }));
    expectNoop(s, start({ weather: 'snow' as never }));
    expectNoop(s, start({ goalMinutes: Number.NaN }));
  });

  it('rejects a session id already used by a finished plant', () => {
    expectNoop({ ...fresh(), plants: [makePlant({ id: 'session-1', slotId: 'rock-1' })] }, start());
  });

  it('without a world, any species and slot are accepted', () => {
    const s = worldlessReducer(fresh(), start({ speciesId: 'anything', slotId: 'anywhere' }));
    expect(s.session!.slotId).toBe('anywhere');
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
    let s = run(running(), { type: 'session/pause', now: at(5) });
    expect(s.session!.pausedAt).toBe(at(5));
    s = run(s, { type: 'session/resume', now: at(12) });
    expect(s.session!.pausedAt).toBeNull();
    expect(s.session!.pausedTotalMs).toBe(7 * MIN);
  });

  it('pause and resume are idempotent', () => {
    const paused = run(running(), { type: 'session/pause', now: at(1) });
    expectNoop(paused, { type: 'session/pause', now: at(2) });
    expectNoop(running(), { type: 'session/resume', now: at(1) });
  });

  it('a clock running backwards never produces negative spans', () => {
    const s = run(running(), { type: 'session/pause', now: at(5) }, { type: 'session/resume', now: at(4) });
    expect(s.session!.pausedTotalMs).toBe(0);
    expect(run(running(), { type: 'session/pause', now: T0 - 10 }).session!.pausedAt).toBe(T0);
  });

  it('pause / resume without a session are no-ops', () => {
    expectNoop(fresh(), { type: 'session/pause', now: T0 });
    expectNoop(fresh(), { type: 'session/resume', now: T0 });
  });
});

describe('session/water', () => {
  const pom = () => running({ plan: POMODORO });

  it('waters the current break once', () => {
    const s = run(pom(), { type: 'session/water', blockIndex: 1, now: at(26) });
    expect(s.session!.waterings).toEqual([1]);
    expectNoop(s, { type: 'session/water', blockIndex: 1, now: at(27) });
    const later = run(s, { type: 'session/water', blockIndex: 3, now: at(56) });
    expect(later.session!.waterings).toEqual([1, 3]);
  });

  it('only during a break, and only the current one', () => {
    const s = pom();
    expectNoop(s, { type: 'session/water', blockIndex: 0, now: at(10) }); // focus
    expectNoop(s, { type: 'session/water', blockIndex: 1, now: at(10) }); // not yet
    expectNoop(s, { type: 'session/water', blockIndex: 3, now: at(26) }); // not current
    expectNoop(s, { type: 'session/water', blockIndex: 1, now: at(31) }); // already over
    expectNoop(fresh(), { type: 'session/water', blockIndex: 1, now: at(26) });
    expectNoop(s, { type: 'session/water', blockIndex: 1, now: Number.NaN });
  });

  it('is allowed while paused in a break', () => {
    const s = run(pom(), { type: 'session/pause', now: at(26) }, { type: 'session/water', blockIndex: 1, now: at(40) });
    expect(s.session!.waterings).toEqual([1]);
  });

  it('not watering changes nothing about the outcome', () => {
    const dry = run(pom(), { type: 'session/complete', now: at(90) });
    const wet = run(pom(), { type: 'session/water', blockIndex: 1, now: at(26) }, { type: 'session/complete', now: at(90) });
    expect(dry.plants).toEqual(wet.plants);
    expect(dry.stats).toEqual(wet.stats);
  });
});

describe('session/skipBreak', () => {
  const pom = () => running({ plan: POMODORO });

  it('removes the rest of the current break; the session ends that much sooner', () => {
    const s = run(pom(), { type: 'session/skipBreak', now: at(27) });
    expect(s.session!.skippedMs).toBe(3 * MIN);
    expectNoop(s, { type: 'session/complete', now: at(87) - 1 });
    expect(run(s, { type: 'session/complete', now: at(87) }).session).toBeNull();
  });

  it('accumulates across breaks and keeps the tier (total) unchanged', () => {
    const s = run(pom(), { type: 'session/skipBreak', now: at(25) }, { type: 'session/skipBreak', now: at(50) });
    expect(s.session!.skippedMs).toBe(10 * MIN);
    const done = run(s, { type: 'session/complete', now: at(80) });
    expect(done.plants[0]!.sessionMinutes).toBe(90);
  });

  it('is a no-op during focus, without a session, or at the end', () => {
    expectNoop(pom(), { type: 'session/skipBreak', now: at(10) });
    expectNoop(fresh(), { type: 'session/skipBreak', now: at(26) });
    expectNoop(pom(), { type: 'session/skipBreak', now: at(200) });
    expectNoop(pom(), { type: 'session/skipBreak', now: Number.NaN });
  });
});

describe('session/cancel', () => {
  it('clears the session and counts it; nothing grows', () => {
    const s = run(running(), { type: 'session/cancel', now: at(1) });
    expect(s.session).toBeNull();
    expect(s.plants).toEqual([]);
    expect(s.stats).toEqual({ totalMinutes: 0, completed: 0, cancelled: 1 });
  });

  it('a displaced plant returns (it was never removed)', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1' });
    const s = run(running({}, { ...fresh(), plants: [old] }), { type: 'session/cancel', now: at(1) });
    expect(s.plants).toEqual([old]);
    expect(s.pressed).toEqual([]);
  });

  it('works while paused; no-op without a session', () => {
    const s = run(running(), { type: 'session/pause', now: at(1) }, { type: 'session/cancel', now: at(2) });
    expect(s.session).toBeNull();
    expectNoop(fresh(), { type: 'session/cancel', now: T0 });
  });
});

describe('session/complete', () => {
  it('finalises the plant with its task name and updates stats with focused minutes', () => {
    const s = run(running({ plan: POMODORO }), { type: 'session/complete', now: at(91) });
    expect(s.session).toBeNull();
    expect(s.plants).toEqual([
      {
        id: 'session-1',
        speciesId: 'violet',
        slotId: 'meadow-1',
        seed: 42,
        plantedAt: T0,
        sessionMinutes: 90,
        taskName: 'Biology ch. 4',
        completedAt: at(91),
      },
    ]);
    expect(s.stats).toEqual({ totalMinutes: 80, completed: 1, cancelled: 0 });
  });

  it('presses the displaced plant with its task name', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1', speciesId: 'cherry', taskName: 'Old task' });
    const other = makePlant({ id: 'other', slotId: 'rock-1' });
    const s = run(running({}, { ...fresh(), plants: [old, other] }), { type: 'session/complete', now: at(25) });
    expect(s.plants.map((p) => p.id)).toEqual(['other', 'session-1']);
    expect(s.pressed).toEqual([
      { speciesId: 'cherry', seed: old.seed, plantedAt: old.plantedAt, removedAt: at(25), taskName: 'Old task' },
    ]);
  });

  it('keeps one plant per slot even if the slot was filled meanwhile', () => {
    const s0 = running();
    const intruder = makePlant({ id: 'intruder', slotId: 'meadow-1' });
    const s = run({ ...s0, plants: [intruder] }, { type: 'session/complete', now: at(25) });
    expect(s.plants.map((p) => p.id)).toEqual(['session-1']);
    expect(s.pressed).toHaveLength(1);
  });

  it('tolerates a displaced plant that no longer exists', () => {
    const old = makePlant({ id: 'old', slotId: 'meadow-1' });
    const s0 = running({}, { ...fresh(), plants: [old] });
    const s = run({ ...s0, plants: [] }, { type: 'session/complete', now: at(25) });
    expect(s.plants).toHaveLength(1);
    expect(s.pressed).toEqual([]);
  });

  it('is rejected before the plan has run, and while paused short of it', () => {
    expectNoop(running(), { type: 'session/complete', now: at(25) - 1 });
    const paused = run(running(), { type: 'session/pause', now: at(5) });
    expectNoop(paused, { type: 'session/complete', now: at(500) });
    expectNoop(fresh(), { type: 'session/complete', now: at(500) });
    expectNoop(running(), { type: 'session/complete', now: Number.NaN });
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
    expect(mergeSettings(cur, { lastGoalMinutes: 26 })).toBe(cur);
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
    expectNoop(s, { type: 'state/replace', state: { ...s, version: 1 } as never });
    expectNoop(s, { type: 'state/replace', state: null as never });
    expectNoop(s, { type: 'state/replace', state: s });
  });

  it('reset returns a fresh default garden', () => {
    const s = run(running(), { type: 'state/reset', now: T0 + 99 });
    expect(s).toEqual(createDefaultState(T0 + 99));
    expectNoop(fresh(), { type: 'state/reset', now: Number.NaN });
  });
});

describe('unknown actions', () => {
  it('return the same state', () => {
    const s = fresh();
    expect(reducer(s, { type: 'reward/choose', speciesId: 'x' } as never)).toBe(s);
  });
});

describe('full loop', () => {
  it('start → break (water) → skip → pause → resume → complete', () => {
    const s = run(
      fresh(),
      start({ plan: POMODORO, taskName: 'Thesis' }),
      { type: 'session/water', blockIndex: 1, now: at(26) },
      { type: 'session/skipBreak', now: at(27) },
      { type: 'session/pause', now: at(40) },
      { type: 'session/resume', now: at(50) },
      { type: 'session/complete', now: at(97) },
    );
    expect(s.session).toBeNull();
    expect(s.plants).toHaveLength(1);
    expect(s.plants[0]).toMatchObject({ taskName: 'Thesis', sessionMinutes: 90, completedAt: at(97) });
    expect(s.stats).toEqual({ totalMinutes: 80, completed: 1, cancelled: 0 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
