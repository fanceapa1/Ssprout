import { describe, expect, it, vi } from 'vitest';
import {
  CORRUPT_KEY_PREFIX,
  MIGRATIONS,
  createSaver,
  EXPORT_FORMAT,
  exportFileName,
  exportState,
  importState,
  loadState,
  migrate,
  parseGarden,
  saveState,
  STORAGE_KEY,
  validateState,
  type Migrations,
  type StorageLike,
} from './persistence';
import { getSpecies } from '../plants/registry';
import { createDefaultState, STATE_VERSION, type GardenState } from './state';
import { makePlant, makePressed, makeSession, MIN, plan } from './testing';

const T0 = 1_700_000_000_000;

function memoryStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  const storage: StorageLike & { map: Map<string, string> } = {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
  return storage;
}

const garden = (): GardenState => ({
  ...createDefaultState(T0),
  plants: [
    makePlant({ id: 'p1', speciesId: 'violet', slotId: 'meadow-1', seed: 11, taskName: 'French verbs' }),
    makePlant({ id: 'p2', speciesId: 'iris', slotId: 'shore-1', seed: 22, taskName: 'Biology ch. 4' }),
  ],
  pressed: [makePressed({ speciesId: 'clover' })],
  stats: { totalMinutes: 35, completed: 2, cancelled: 1 },
  faunaSeen: ['striders'],
  tips: { duration: 'seen' },
  settings: { muted: false, lastGoalMinutes: 50, notifications: 'granted' },
});

const known = new Set(['violet', 'iris', 'clover']);
const isKnownSpecies = (id: string) => known.has(id);

/** A fake v0 schema: plants were `flowers`, settings were flat. */
const v0 = {
  version: 0,
  created: T0,
  flowers: [{ id: 'p1', species: 'violet', slot: 'meadow-1', seed: 11, at: T0 + 1, minutes: 10 }],
  muted: false,
};
const fakeMigrations: Migrations = {
  ...MIGRATIONS,
  0: (d) => ({
    version: 1,
    createdAt: d.created,
    plants: (d.flowers as Array<Record<string, unknown>>).map((f) => ({
      id: f.id,
      speciesId: f.species,
      slotId: f.slot,
      seed: f.seed,
      plantedAt: f.at,
      sessionMinutes: f.minutes,
    })),
    settings: { muted: d.muted },
  }),
};

describe('migrate', () => {
  it('passes current documents through untouched', () => {
    const doc = garden();
    const r = migrate(doc);
    expect(r.ok && r.value.doc).toBe(doc);
    expect(r.ok && r.value.from).toBe(STATE_VERSION);
  });

  it('runs a v0 → v1 → v2 → v3 chain', () => {
    const r = migrate(v0, { migrations: fakeMigrations });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.from).toBe(0);
    expect(r.value.doc.version).toBe(STATE_VERSION);
    const v = validateState(r.value.doc);
    expect(v.ok && v.value.state.plants[0]!.speciesId).toBe('violet');
    // fields that did not exist in v0 take their defaults
    expect(v.ok && v.value.state.plants[0]!.taskName).toBe('Study session');
    expect(v.ok && v.value.state.plants[0]!.completedAt).toBe(T0 + 1);
    expect(v.ok && v.value.state.settings.muted).toBe(false);
  });

  it('chains several steps', () => {
    const migrations: Migrations = {
      0: (d) => ({ ...d, version: 1, a: 1 }),
      1: (d) => ({ ...d, version: 2, b: 2 }),
    };
    const r = migrate({ version: 0 }, { migrations, target: 2 });
    expect(r.ok && r.value.doc).toEqual({ version: 2, a: 1, b: 2 });
  });

  it('rejects newer, missing or unmigratable versions', () => {
    expect(migrate({ version: STATE_VERSION + 1 })).toMatchObject({ ok: false, error: { code: 'unsupported-version' } });
    expect(migrate({ version: 0 })).toMatchObject({ ok: false, error: { code: 'unsupported-version' } });
    expect(migrate({})).toMatchObject({ ok: false, error: { code: 'not-a-garden' } });
    expect(migrate({ version: 'one' })).toMatchObject({ ok: false, error: { code: 'not-a-garden' } });
    expect(migrate([1])).toMatchObject({ ok: false, error: { code: 'not-a-garden' } });
    expect(migrate(null)).toMatchObject({ ok: false, error: { code: 'not-a-garden' } });
  });

  it('reports migrations that throw or produce the wrong version', () => {
    const boom: Migrations = {
      0: () => {
        throw new Error('x');
      },
    };
    expect(migrate({ version: 0 }, { migrations: boom })).toMatchObject({ ok: false, error: { code: 'migration-failed' } });
    const wrong: Migrations = { 0: (d) => ({ ...d, version: 5 }) };
    expect(migrate({ version: 0 }, { migrations: wrong })).toMatchObject({ ok: false, error: { code: 'migration-failed' } });
  });
});

describe('validateState', () => {
  it('accepts a well-formed garden unchanged', () => {
    const g = garden();
    const r = validateState(JSON.parse(JSON.stringify(g)), { isKnownSpecies });
    expect(r.ok && r.value.state).toEqual(g);
    expect(r.ok && r.value.warnings.unknownSpecies).toEqual([]);
  });

  it('fills absent keys with defaults and drops unknown keys', () => {
    const r = validateState({ version: STATE_VERSION, createdAt: T0, extra: 'x', settings: { muted: false } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toEqual({ ...createDefaultState(T0), settings: { ...createDefaultState(T0).settings, muted: false } });
    expect('extra' in r.value.state).toBe(false);
  });

  it('uses `now` when createdAt is missing', () => {
    const r = validateState({ version: STATE_VERSION }, { now: 99 });
    expect(r.ok && r.value.state.createdAt).toBe(99);
  });

  it('keeps unknown species but flags them (sorted, unique)', () => {
    const g = garden();
    g.plants.push(makePlant({ id: 'p3', speciesId: 'moonflower', slotId: 'x' }));
    g.pressed.push(makePressed({ speciesId: 'ghost-fern' }));
    g.pressed.push(makePressed({ speciesId: 'moonflower' }));
    const r = validateState(g, { isKnownSpecies });
    expect(r.ok && r.value.state.plants).toHaveLength(3);
    expect(r.ok && r.value.warnings.unknownSpecies).toEqual(['ghost-fern', 'moonflower']);
  });

  it('flags an unknown species growing in the active session', () => {
    const g: GardenState = { ...createDefaultState(0), session: makeSession({ speciesId: 'nova' }) };
    const r = validateState(g, { isKnownSpecies });
    expect(r.ok && r.value.warnings.unknownSpecies).toEqual(['nova']);
  });

  it('round-trips an active session with a plan, waterings and skips', () => {
    const session = makeSession({
      plan: plan([25, -5, 25, -5, 30]),
      waterings: [1],
      skippedMs: 2 * MIN,
      pausedAt: T0 + 40 * MIN,
      pausedTotalMs: MIN,
      displacedPlantId: 'p1',
    });
    const g: GardenState = { ...garden(), session };
    const r = validateState(JSON.parse(JSON.stringify(g)), { isKnownSpecies });
    expect(r.ok && r.value.state).toEqual(g);
  });

  it('defaults optional session fields and normalises names', () => {
    const { skippedMs: _s, waterings: _w, displacedPlantId: _d, ...bare } = makeSession({ taskName: '  Essay  ' });
    const r = validateState({ version: STATE_VERSION, session: bare });
    expect(r.ok && r.value.state.session).toMatchObject({ skippedMs: 0, waterings: [], displacedPlantId: null, taskName: 'Essay' });
  });

  it('ignores a leftover pendingReward key (pre-ADR 0003 drafts)', () => {
    const r = validateState({ version: STATE_VERSION, pendingReward: { anything: true } });
    expect(r.ok && 'pendingReward' in r.value.state).toBe(false);
  });

  it('clamps lastGoalMinutes and dedupes faunaSeen', () => {
    const r = validateState({ version: STATE_VERSION, settings: { lastGoalMinutes: 7 }, faunaSeen: ['koi-1', 'koi-1'] });
    expect(r.ok && r.value.state.settings.lastGoalMinutes).toBe(10);
    expect(r.ok && r.value.state.faunaSeen).toEqual(['koi-1']);
  });

  it.each([
    ['wrong version', { version: STATE_VERSION + 1 }, 'version'],
    ['plants not an array', { version: STATE_VERSION, plants: {} }, 'plants'],
    ['plant missing seed', { version: STATE_VERSION, plants: [{ id: 'a', speciesId: 's', slotId: 'x', plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].seed'],
    ['plant with empty id', { version: STATE_VERSION, plants: [{ id: '', speciesId: 's', slotId: 'x', seed: 1, plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].id'],
    ['NaN-ish seed', { version: STATE_VERSION, plants: [{ id: 'a', speciesId: 's', slotId: 'x', seed: '1', plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].seed'],
    ['pressed entry', { version: STATE_VERSION, pressed: [{ speciesId: 's', seed: 1, plantedAt: 0 }] }, 'pressed[0].removedAt'],
    ['plant task name not a string', { version: STATE_VERSION, plants: [{ ...makePlant(), taskName: 3 }] }, 'plants[0].taskName'],
    ['bad weather', { version: STATE_VERSION, session: { ...makeSession(), weather: 'snow' } }, 'session.weather'],
    ['zero goal', { version: STATE_VERSION, session: { ...makeSession(), goalMs: 0 } }, 'session.goalMs'],
    ['goal not whole minutes', { version: STATE_VERSION, session: { ...makeSession(), goalMs: 25 * MIN + 1 } }, 'session.goalMs'],
    ['negative pause total', { version: STATE_VERSION, session: { ...makeSession(), pausedTotalMs: -5 } }, 'session.pausedTotalMs'],
    ['negative skipped', { version: STATE_VERSION, session: { ...makeSession(), skippedMs: -5 } }, 'session.skippedMs'],
    ['missing plan', { version: STATE_VERSION, session: { ...makeSession(), plan: undefined } }, 'session.plan'],
    ['plan not summing to goal', { version: STATE_VERSION, session: { ...makeSession(), plan: plan([20]) } }, 'session.plan'],
    ['plan ending with a break', { version: STATE_VERSION, session: { ...makeSession(), goalMs: 30 * MIN, plan: plan([25, -5]) } }, 'session.plan'],
    ['bad block kind', { version: STATE_VERSION, session: { ...makeSession(), plan: { id: 'x', name: 'x', blocks: [{ kind: 'nap', minutes: 25 }] } } }, 'session.plan.blocks[0].kind'],
    ['missing species', { version: STATE_VERSION, session: { ...makeSession(), speciesId: '' } }, 'session.speciesId'],
    ['watering a focus block', { version: STATE_VERSION, session: { ...makeSession(), waterings: [0] } }, 'session.waterings[0]'],
    ['bad displaced id', { version: STATE_VERSION, session: { ...makeSession(), displacedPlantId: 5 } }, 'session.displacedPlantId'],
    ['negative stats', { version: STATE_VERSION, stats: { totalMinutes: -1 } }, 'stats.totalMinutes'],
    ['muted not boolean', { version: STATE_VERSION, settings: { muted: 'no' } }, 'settings.muted'],
    ['bad notifications', { version: STATE_VERSION, settings: { notifications: 'maybe' } }, 'settings.notifications'],
    ['tip value', { version: STATE_VERSION, tips: { duration: true } }, 'tips.duration'],
    ['fauna id', { version: STATE_VERSION, faunaSeen: [3] }, 'faunaSeen[0]'],
  ])('rejects %s', (_name, doc, path) => {
    const r = validateState(doc);
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid-state', path } });
  });

  it('rejects duplicate plant ids and two plants in one slot', () => {
    const p = { speciesId: 's', seed: 1, plantedAt: 0, sessionMinutes: 1, taskName: 't', completedAt: 0 };
    expect(validateState({ version: STATE_VERSION, plants: [{ ...p, id: 'a', slotId: 'x' }, { ...p, id: 'a', slotId: 'y' }] })).toMatchObject({
      ok: false,
      error: { path: 'plants[1].id' },
    });
    expect(validateState({ version: STATE_VERSION, plants: [{ ...p, id: 'a', slotId: 'x' }, { ...p, id: 'b', slotId: 'x' }] })).toMatchObject({
      ok: false,
      error: { path: 'plants[1].slotId' },
    });
  });

  it('rejects a session whose id is already a finished plant', () => {
    const doc = { version: STATE_VERSION, plants: [makePlant({ id: 's1' })], session: makeSession({ id: 's1', slotId: 'rock-1' }) };
    expect(validateState(doc)).toMatchObject({ ok: false, error: { code: 'invalid-state', path: 'session.id' } });
  });
});

describe('loadState', () => {
  it('fresh when nothing is stored', () => {
    const r = loadState(memoryStorage(), T0);
    expect(r.status).toBe('fresh');
    expect(r.state).toEqual(createDefaultState(T0));
  });

  it('loads a saved garden', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(garden()) });
    const r = loadState(storage, T0 + 1000, { isKnownSpecies });
    expect(r.status).toBe('loaded');
    expect(r.state).toEqual(garden());
  });

  it('migrates old data and saves the upgraded version', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(v0) });
    const r = loadState(storage, T0, { migrations: fakeMigrations });
    expect(r.status).toBe('migrated');
    expect(r.state.plants[0]!.id).toBe('p1');
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).version).toBe(STATE_VERSION);
  });

  it('recovers from corrupt JSON: default state, backup kept, main key reset', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{"version":1,"plants":[' });
    const r = loadState(storage, T0);
    expect(r.status).toBe('recovered');
    expect(r.error?.code).toBe('invalid-json');
    expect(r.state).toEqual(createDefaultState(T0));
    expect(r.backupKey).toBe(`${CORRUPT_KEY_PREFIX}${T0}`);
    expect(storage.map.get(r.backupKey!)).toBe('{"version":1,"plants":[');
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!)).toEqual(createDefaultState(T0));
    // loading again is now clean
    expect(loadState(storage, T0 + 1).status).toBe('loaded');
  });

  it('treats structurally invalid and future-version data as corrupt', () => {
    const bad = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, plants: 'lots' }) });
    expect(loadState(bad, T0)).toMatchObject({ status: 'recovered', error: { code: 'invalid-state' } });
    const future = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 9 }) });
    expect(loadState(future, T0)).toMatchObject({ status: 'recovered', error: { code: 'unsupported-version' } });
    expect(future.map.get(`${CORRUPT_KEY_PREFIX}${T0}`)).toBe('{"version":9}');
  });

  it('keeps the original if the backup cannot be written', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: 'garbage' });
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const r = loadState(storage, T0);
    expect(r.status).toBe('recovered');
    expect(r.backupKey).toBeUndefined();
    expect(storage.map.get(STORAGE_KEY)).toBe('garbage');
  });

  it('unavailable when there is no storage or reading throws', () => {
    expect(loadState(null, T0).status).toBe('unavailable');
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    const r = loadState(throwing, T0);
    expect(r.status).toBe('unavailable');
    expect(r.error?.code).toBe('storage-failed');
    expect(r.state).toEqual(createDefaultState(T0));
  });

  it('flags unknown species on load', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(garden()) });
    const r = loadState(storage, T0, { isKnownSpecies: (id) => id === 'violet' });
    expect(r.warnings.unknownSpecies).toEqual(['clover', 'iris']);
    expect(r.state.plants).toHaveLength(2);
  });

  it('loads a plant whose species its garden no longer offers, without a warning (ADR 0250)', () => {
    // the real registry: the lotus is a garden species, offered nowhere wild
    const lotus = makePlant({ id: 'wf-lotus', speciesId: 'lotus', sceneryId: 'waterfall', slotId: 'pool-1' });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...createDefaultState(T0), plants: [lotus] }) });
    const r = loadState(storage, T0, { isKnownSpecies: (id) => getSpecies(id) !== undefined });
    expect(r.status).toBe('loaded');
    expect(r.warnings.unknownSpecies).toEqual([]);
    expect(r.state.plants).toEqual([lotus]);
  });
});

describe('saveState / createSaver', () => {
  it('saveState writes JSON and reports storage failures', () => {
    const storage = memoryStorage();
    expect(saveState(storage, garden()).ok).toBe(true);
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!)).toEqual(garden());
    storage.setItem = () => {
      throw new Error('full');
    };
    expect(saveState(storage, garden())).toMatchObject({ ok: false, error: { code: 'storage-failed' } });
  });

  it('debounces: only the latest state is written, once, after the delay', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const spy = vi.spyOn(storage, 'setItem');
      const saver = createSaver(storage, { delayMs: 300 });
      const a = createDefaultState(1);
      const b = createDefaultState(2);
      saver.schedule(a);
      vi.advanceTimersByTime(100);
      saver.schedule(b);
      expect(saver.pending).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(storage.map.get(STORAGE_KEY)!).createdAt).toBe(2);
      expect(saver.pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush writes immediately; cancel drops the pending write', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const saver = createSaver(storage);
      saver.schedule(createDefaultState(5));
      saver.flush();
      expect(JSON.parse(storage.map.get(STORAGE_KEY)!).createdAt).toBe(5);
      saver.flush(); // nothing pending: no-op
      saver.schedule(createDefaultState(6));
      saver.cancel();
      vi.runAllTimers();
      expect(JSON.parse(storage.map.get(STORAGE_KEY)!).createdAt).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports write errors to onError', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('full');
    };
    const onError = vi.fn();
    const saver = createSaver(storage, { onError });
    saver.schedule(createDefaultState(0));
    saver.flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'storage-failed' }));
  });

  it('accepts injected timers', () => {
    const timers: Array<() => void> = [];
    const storage = memoryStorage();
    const saver = createSaver(storage, { setTimer: (fn) => timers.push(fn), clearTimer: () => {} });
    saver.schedule(createDefaultState(3));
    expect(timers).toHaveLength(1);
    timers[0]!();
    expect(storage.map.has(STORAGE_KEY)).toBe(true);
  });
});

describe('export / import', () => {
  it('exportState wraps the garden with metadata', () => {
    const json = exportState(garden(), Date.UTC(2026, 9, 21, 12));
    const doc = JSON.parse(json);
    expect(doc).toMatchObject({
      format: EXPORT_FORMAT,
      formatVersion: 1,
      schemaVersion: STATE_VERSION,
      exportedAt: '2026-10-21T12:00:00.000Z',
      summary: { plants: 2, pressed: 1, totalMinutes: 35, completed: 2 },
    });
    expect(doc.state).toEqual(garden());
  });

  it('exportFileName uses the local date', () => {
    expect(exportFileName(new Date(2026, 0, 5, 9, 30).getTime())).toBe('study-sprout-garden-2026-01-05.json');
    expect(exportFileName(new Date(2026, 9, 21, 23, 59).getTime())).toBe('study-sprout-garden-2026-10-21.json');
  });

  it('round-trips export → import', () => {
    const r = importState(exportState(garden(), T0), { isKnownSpecies });
    expect(r).toEqual({ ok: true, state: garden(), warnings: { unknownSpecies: [] } });
  });

  it('also accepts a bare stored state', () => {
    const r = importState(JSON.stringify(garden()));
    expect(r.ok && r.state).toEqual(garden());
  });

  it('migrates old exports', () => {
    const file = JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, state: v0 });
    const r = importState(file, { migrations: fakeMigrations });
    expect(r.ok && r.state.plants[0]!.slotId).toBe('meadow-1');
  });

  it('keeps unknown species but flags them', () => {
    const g = garden();
    g.plants[0]!.speciesId = 'starflower';
    const r = importState(exportState(g, T0), { isKnownSpecies });
    expect(r.ok && r.state.plants[0]!.speciesId).toBe('starflower');
    expect(r.ok && r.warnings.unknownSpecies).toEqual(['starflower']);
  });

  it.each([
    ['not json', 'nope{', 'invalid-json'],
    ['another file format', JSON.stringify({ format: 'photos', state: {} }), 'not-a-garden'],
    ['envelope without a state', JSON.stringify({ format: EXPORT_FORMAT }), 'not-a-garden'],
    ['a number', '42', 'not-a-garden'],
    ['newer schema', JSON.stringify({ version: 7 }), 'unsupported-version'],
    ['broken plants', JSON.stringify({ version: 1, plants: [{ id: 1 }] }), 'invalid-state'],
  ])('rejects %s with a typed error', (_n, json, code) => {
    const r = importState(json);
    expect(r).toMatchObject({ ok: false, error: { code } });
  });

  it('parseGarden reports the source version', () => {
    const r = parseGarden(JSON.stringify(v0), { migrations: fakeMigrations });
    expect(r.ok && r.value.from).toBe(0);
  });
});

describe('scheduled sessions (ADR 0170: an optional key, no schema bump)', () => {
  const schedule = {
    id: 'sch-1',
    name: 'Biology',
    date: '2026-10-23',
    time: '09:00',
    lengthMinutes: 60,
    planId: 'pomodoro',
    repeat: 'weekdays',
    until: null,
    notes: { '2026-10-26': { skipped: true }, '2026-10-27': { sessionId: 'session-x', time: '10:30', junk: 1 } },
    createdAt: T0,
  };

  it('a v2 garden saved before schedules loads with none', () => {
    const old: Partial<GardenState> = { ...createDefaultState(T0) };
    delete old.schedules;
    const r = validateState(old);
    expect(r.ok && r.value.state.schedules).toEqual([]);
  });

  it('round-trips schedules through export and import (unknown note keys dropped)', () => {
    const state = { ...createDefaultState(T0), schedules: [schedule] } as unknown as GardenState;
    const r = importState(exportState(state, T0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.schedules[0]).toEqual({ ...schedule, notes: { '2026-10-26': { skipped: true }, '2026-10-27': { sessionId: 'session-x', time: '10:30' } } });
  });

  it.each([
    ['a bad time', { time: '9am' }],
    ['a plan without a length', { lengthMinutes: null }],
    ['an unknown repeat', { repeat: 'monthly' }],
    ['an until before the start', { until: '2026-10-01' }],
    ['a bad note', { notes: { '2026-10-26': { time: 'later' } } }],
  ])('rejects a schedule with %s', (_n, over) => {
    const r = validateState({ ...createDefaultState(T0), schedules: [{ ...schedule, ...over }] });
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid-state' } });
  });

  it('rejects duplicate schedule ids', () => {
    const r = validateState({ ...createDefaultState(T0), schedules: [schedule, schedule] });
    expect(r).toMatchObject({ ok: false, error: { path: 'schedules[1].id' } });
  });
});

describe('per-scenery gardens (schema v4, ADR 0240)', () => {
  const p = { speciesId: 's', seed: 1, plantedAt: 0, sessionMinutes: 1, taskName: 't', completedAt: 0 };
  const logEntry = {
    id: 'l1', outcome: 'completed', taskName: 't', speciesId: 's', sceneryId: 'japanese-garden', slotId: 'x', seed: 1,
    plan: null, goalMinutes: 25, focusedMinutes: 25, startedAt: T0, endedAt: T0 + 25 * MIN,
  };

  it('a scenery id must be a known one, wherever it is stored', () => {
    const bad = 'coast' as never;
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ scenery: bad }, 'scenery'],
      [{ plants: [makePlant({ sceneryId: bad })] }, 'plants[0].sceneryId'],
      [{ pressed: [makePressed({ sceneryId: bad })] }, 'pressed[0].sceneryId'],
      [{ session: makeSession({ sceneryId: bad }) }, 'session.sceneryId'],
      [{ waiting: [makeSession({ sceneryId: bad, pausedAt: T0 })] }, 'waiting[0].sceneryId'],
      [{ log: [{ ...logEntry, sceneryId: bad }] }, 'log[0].sceneryId'],
    ];
    for (const [doc, path] of cases) {
      expect(validateState({ version: STATE_VERSION, ...doc })).toMatchObject({ ok: false, error: { code: 'invalid-state', path } });
    }
    expect(validateState({ version: STATE_VERSION, log: [logEntry] }).ok).toBe(true);
  });

  it('an absent scenery id is the Japanese garden (hand-written and dev documents)', () => {
    const r = validateState({ version: STATE_VERSION, plants: [{ ...p, id: 'a', slotId: 'x' }], session: { ...makeSession(), sceneryId: undefined } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state.scenery).toBe('japanese-garden');
    expect(r.value.state.plants[0]!.sceneryId).toBe('japanese-garden');
    expect(r.value.state.session!.sceneryId).toBe('japanese-garden');
  });

  it('one plant per slot of each garden: the same slot id may hold a plant in each scenery', () => {
    const two = [{ ...p, id: 'a', slotId: 'x' }, { ...p, id: 'b', slotId: 'x', sceneryId: 'waterfall' }];
    expect(validateState({ version: STATE_VERSION, plants: two }).ok).toBe(true);
    const same = [{ ...p, id: 'a', slotId: 'x', sceneryId: 'waterfall' }, { ...p, id: 'b', slotId: 'x', sceneryId: 'waterfall' }];
    expect(validateState({ version: STATE_VERSION, plants: same })).toMatchObject({
      ok: false,
      error: { path: 'plants[1].slotId', message: 'plants[1].slotId: two plants in slot "waterfall/x"' },
    });
  });

  it('one seedling per slot of each garden', () => {
    const active = makeSession({ id: 's1', slotId: 'x' });
    const elsewhere = makeSession({ id: 's2', slotId: 'x', sceneryId: 'waterfall', pausedAt: T0 });
    expect(validateState({ version: STATE_VERSION, session: active, waiting: [elsewhere] }).ok).toBe(true);
    const clash = makeSession({ id: 's2', slotId: 'x', pausedAt: T0 });
    expect(validateState({ version: STATE_VERSION, session: active, waiting: [clash] })).toMatchObject({
      ok: false,
      error: { path: 'waiting[0].slotId' },
    });
  });

  it('a sound mix missing a layer reads it as 0; present levels must still be valid', () => {
    const levels = { water: 70, wind: 45, birds: 40 }; // e.g. written before a layer existed
    const soundscape = { collection: 'scenery', volume: 90, standard: { rain: 55 }, sceneries: { pond: { mode: 'custom', levels } } };
    const r = validateState({ version: STATE_VERSION, settings: { soundscape } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.value.state.settings.soundscape!;
    expect(s.standard).toMatchObject({ rain: 55, waves: 0, brown: 0 });
    expect(Object.keys(s.standard)).toHaveLength(11);
    expect(s.sceneries.pond!.levels).toMatchObject({ water: 70, crickets: 0, rain: 0 });
    const invalid = { ...soundscape, standard: { rain: 55, brown: 120 } };
    expect(validateState({ version: STATE_VERSION, settings: { soundscape: invalid } })).toMatchObject({
      ok: false,
      error: { path: 'settings.soundscape' },
    });
  });
});
