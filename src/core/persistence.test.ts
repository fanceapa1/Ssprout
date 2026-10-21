import { describe, expect, it, vi } from 'vitest';
import {
  CORRUPT_KEY_PREFIX,
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
import { createDefaultState, type GardenState } from './state';

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
    { id: 'p1', speciesId: 'violet', slotId: 'meadow-1', seed: 11, plantedAt: T0 + 1, sessionMinutes: 10 },
    { id: 'p2', speciesId: 'iris', slotId: 'shore-1', seed: 22, plantedAt: T0 + 2, sessionMinutes: 25 },
  ],
  pressed: [{ speciesId: 'clover', seed: 3, plantedAt: T0, removedAt: T0 + 5 }],
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
    expect(r.ok && r.value.from).toBe(1);
  });

  it('runs a v0 → v1 migration', () => {
    const r = migrate(v0, { migrations: fakeMigrations });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.from).toBe(0);
    expect(r.value.doc.version).toBe(1);
    const v = validateState(r.value.doc);
    expect(v.ok && v.value.state.plants[0]!.speciesId).toBe('violet');
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
    expect(migrate({ version: 2 })).toMatchObject({ ok: false, error: { code: 'unsupported-version' } });
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
    const r = validateState({ version: 1, createdAt: T0, extra: 'x', settings: { muted: false } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state).toEqual({ ...createDefaultState(T0), settings: { ...createDefaultState(T0).settings, muted: false } });
    expect('extra' in r.value.state).toBe(false);
  });

  it('uses `now` when createdAt is missing', () => {
    const r = validateState({ version: 1 }, { now: 99 });
    expect(r.ok && r.value.state.createdAt).toBe(99);
  });

  it('keeps unknown species but flags them (sorted, unique)', () => {
    const g = garden();
    g.plants.push({ id: 'p3', speciesId: 'moonflower', slotId: 'x', seed: 1, plantedAt: 0, sessionMinutes: 10 });
    g.pressed.push({ speciesId: 'ghost-fern', seed: 1, plantedAt: 0, removedAt: 0 });
    g.pressed.push({ speciesId: 'moonflower', seed: 2, plantedAt: 0, removedAt: 0 });
    const r = validateState(g, { isKnownSpecies });
    expect(r.ok && r.value.state.plants).toHaveLength(3);
    expect(r.ok && r.value.warnings.unknownSpecies).toEqual(['ghost-fern', 'moonflower']);
  });

  it('flags unknown species in a pending offer', () => {
    const g: GardenState = {
      ...createDefaultState(0),
      pendingReward: { sessionId: 's', goalMinutes: 25, tier: 2, options: ['violet', 'nova'], chosen: 'nova', completedAt: 1 },
    };
    const r = validateState(g, { isKnownSpecies });
    expect(r.ok && r.value.warnings.unknownSpecies).toEqual(['nova']);
  });

  it('clamps lastGoalMinutes and dedupes faunaSeen', () => {
    const r = validateState({ version: 1, settings: { lastGoalMinutes: 7 }, faunaSeen: ['koi-1', 'koi-1'] });
    expect(r.ok && r.value.state.settings.lastGoalMinutes).toBe(10);
    expect(r.ok && r.value.state.faunaSeen).toEqual(['koi-1']);
  });

  it.each([
    ['wrong version', { version: 2 }, 'version'],
    ['plants not an array', { version: 1, plants: {} }, 'plants'],
    ['plant missing seed', { version: 1, plants: [{ id: 'a', speciesId: 's', slotId: 'x', plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].seed'],
    ['plant with empty id', { version: 1, plants: [{ id: '', speciesId: 's', slotId: 'x', seed: 1, plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].id'],
    ['NaN-ish seed', { version: 1, plants: [{ id: 'a', speciesId: 's', slotId: 'x', seed: '1', plantedAt: 0, sessionMinutes: 1 }] }, 'plants[0].seed'],
    ['pressed entry', { version: 1, pressed: [{ speciesId: 's', seed: 1, plantedAt: 0 }] }, 'pressed[0].removedAt'],
    ['bad weather', { version: 1, session: { id: 's', goalMs: 1000, startedAt: 0, pausedAt: null, pausedTotalMs: 0, weather: 'snow' } }, 'session.weather'],
    ['zero goal', { version: 1, session: { id: 's', goalMs: 0, startedAt: 0, pausedAt: null, pausedTotalMs: 0, weather: 'sun' } }, 'session.goalMs'],
    ['negative pause total', { version: 1, session: { id: 's', goalMs: 10, startedAt: 0, pausedAt: null, pausedTotalMs: -5, weather: 'sun' } }, 'session.pausedTotalMs'],
    ['bad tier', { version: 1, pendingReward: { sessionId: 's', goalMinutes: 25, tier: 5, options: [], chosen: null, completedAt: 0 } }, 'pendingReward.tier'],
    ['chosen not offered', { version: 1, pendingReward: { sessionId: 's', goalMinutes: 25, tier: 2, options: ['a'], chosen: 'b', completedAt: 0 } }, 'pendingReward.chosen'],
    ['duplicate options', { version: 1, pendingReward: { sessionId: 's', goalMinutes: 25, tier: 2, options: ['a', 'a'], chosen: null, completedAt: 0 } }, 'pendingReward.options'],
    ['negative stats', { version: 1, stats: { totalMinutes: -1 } }, 'stats.totalMinutes'],
    ['muted not boolean', { version: 1, settings: { muted: 'no' } }, 'settings.muted'],
    ['bad notifications', { version: 1, settings: { notifications: 'maybe' } }, 'settings.notifications'],
    ['tip value', { version: 1, tips: { duration: true } }, 'tips.duration'],
    ['fauna id', { version: 1, faunaSeen: [3] }, 'faunaSeen[0]'],
  ])('rejects %s', (_name, doc, path) => {
    const r = validateState(doc);
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid-state', path } });
  });

  it('rejects duplicate plant ids and two plants in one slot', () => {
    const p = { speciesId: 's', seed: 1, plantedAt: 0, sessionMinutes: 1 };
    expect(validateState({ version: 1, plants: [{ ...p, id: 'a', slotId: 'x' }, { ...p, id: 'a', slotId: 'y' }] })).toMatchObject({
      ok: false,
      error: { path: 'plants[1].id' },
    });
    expect(validateState({ version: 1, plants: [{ ...p, id: 'a', slotId: 'x' }, { ...p, id: 'b', slotId: 'x' }] })).toMatchObject({
      ok: false,
      error: { path: 'plants[1].slotId' },
    });
  });

  it('rejects a session alongside a pending reward', () => {
    const doc = {
      version: 1,
      session: { id: 's', goalMs: 10, startedAt: 0, pausedAt: null, pausedTotalMs: 0, weather: 'sun' },
      pendingReward: { sessionId: 's0', goalMinutes: 25, tier: 2, options: [], chosen: null, completedAt: 0 },
    };
    expect(validateState(doc)).toMatchObject({ ok: false, error: { code: 'invalid-state' } });
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
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).version).toBe(1);
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
      schemaVersion: 1,
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
