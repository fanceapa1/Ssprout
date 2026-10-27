import { describe, expect, it } from 'vitest';
import v1Paused from './fixtures/garden-v1-paused.json';
import v1Session from './fixtures/garden-v1-session.json';
import v2Parallel from './fixtures/garden-v2-parallel.json';
import { EXPORT_FORMAT, importState, loadState, migrate, migrateV1toV2, migrateV2toV3, migrateV3toV4, STORAGE_KEY, validateState, type StorageLike } from './persistence';
import { makeSchedule } from './schedule';
import { backfillLog } from './session-log';
import { defaultSoundscape, levelsWith } from './soundscape';
import { createDefaultState, STATE_VERSION } from './state';
import { makePlant, makePressed, makeSession, MIN, T0 } from './testing';

function legacyGarden() {
  const plant = makePlant({ slotId: 'rock-1' });
  return {
    version: 2,
    createdAt: T0,
    plants: [plant], pressed: [makePressed()],
    session: makeSession({ weather: 'rain', focusWaterings: 2 }),
    waiting: [makeSession({ id: 's2', slotId: 'shore-1', pausedAt: T0 + MIN })],
    log: backfillLog([plant]),
    schedules: [makeSchedule('reading', { name: 'Reading', date: '2026-10-23', time: '16:00', repeat: 'daily' }, T0)!],
    stats: { totalMinutes: 25, completed: 1, cancelled: 0 },
    faunaSeen: ['small-birds'], tips: { sound: 'seen' },
    settings: { muted: true, lastGoalMinutes: 50, notifications: 'granted' },
  };
}

describe('v2 → v3 sound preferences migration', () => {
  it('preserves the whole garden and every in-progress session without mutating input', () => {
    const legacy = legacyGarden(), before = JSON.stringify(legacy);
    const upgraded = migrateV2toV3(legacy);
    expect(upgraded).toEqual({ ...legacy, version: 3 });
    expect(JSON.stringify(legacy)).toBe(before);
    const result = validateState(migrateV3toV4(upgraded));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toEqual({ ...legacy, version: STATE_VERSION, scenery: 'japanese-garden' });
      expect(result.value.state.settings.soundscape).toBeUndefined();
      expect(result.value.state.settings.muted).toBe(true);
    }
  });

  it('loads and re-saves v2 once at the same storage key, then loads without migration', () => {
    const values = new Map([[STORAGE_KEY, JSON.stringify(legacyGarden())]]);
    const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
    const first = loadState(storage, T0 + MIN);
    expect(first.status).toBe('migrated');
    expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(STATE_VERSION);
    const second = loadState(storage, T0 + MIN);
    expect(second.status).toBe('loaded');
    expect(second.state).toEqual(first.state);
    expect(values.size).toBe(1);
  });

  it('imports an old export envelope and requires migration before current validation', () => {
    const legacy = legacyGarden();
    const imported = importState(JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, schemaVersion: 2, state: legacy }));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.state.version).toBe(STATE_VERSION);
    const current = createDefaultState(T0);
    current.settings.soundscape = defaultSoundscape();
    current.settings.soundscape.standard = levelsWith({ cafe: 35, lofi: 25 });
    expect(validateState(current).ok).toBe(true);
    // Current validation never silently accepts an older document without its migration step.
    expect(validateState(legacy)).toMatchObject({ ok: false, error: { path: 'version' } });
  });
});

/** Saved documents as the released app wrote them: v1 (one session) and v2 (parallel sessions, log, schedules). */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
/** As v4 tags it: grown in the Japanese garden (ADR 0240). */
const jp = <T extends object>(x: T) => ({ ...x, sceneryId: 'japanese-garden' });
function storageWith(doc: unknown) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(doc)]]);
  const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  return { storage, saved: () => JSON.parse(values.get(STORAGE_KEY)!) as { version: number } };
}

describe('v1 and v2 fixtures reach v3, then the current schema', () => {
  it('a v2 garden keeps its active and waiting sessions, its log and its schedules, and gains no sound preferences', () => {
    const v3 = migrate(clone(v2Parallel), { target: 3 });
    expect(v3.ok && v3.value.doc).toEqual({ ...v2Parallel, version: 3 });
    const r = migrate(clone(v2Parallel));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.from).toBe(2);
    const v = validateState(r.value.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const state = v.value.state;
    expect(state.version).toBe(STATE_VERSION);
    expect(state.session).toEqual(jp(v2Parallel.session));
    expect(state.waiting).toEqual(v2Parallel.waiting.map(jp));
    expect(state.log).toEqual(v2Parallel.log.map(jp));
    expect(state.schedules).toEqual(v2Parallel.schedules);
    expect(state.plants).toEqual(v2Parallel.plants.map(jp));
    expect(state.settings).toEqual(v2Parallel.settings); // unmuted stays unmuted, no soundscape key
    expect('soundscape' in state.settings).toBe(false);
  });

  it('a stored v2 fixture loads as migrated, is saved at the current version and then loads as is', () => {
    const { storage, saved } = storageWith(v2Parallel);
    const now = v2Parallel.session.startedAt + 10 * MIN;
    const first = loadState(storage, now);
    expect(first.status).toBe('migrated');
    expect(saved().version).toBe(STATE_VERSION);
    const second = loadState(storage, now);
    expect(second.status).toBe('loaded');
    expect(second.state).toEqual(first.state);
  });

  it('a v2 export file imports at the current version', () => {
    const file = JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, schemaVersion: 2, state: v2Parallel });
    const r = importState(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.version).toBe(STATE_VERSION);
    expect(r.state.waiting).toHaveLength(1);
    expect(r.state.schedules).toEqual(v2Parallel.schedules);
  });

  it.each([
    ['running', v1Session],
    ['paused', v1Paused],
  ])('a v1 garden with a %s session chains v1 → v2 → v3 → v4 to the same garden as the three steps', (_name, v1) => {
    const r = migrate(clone(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.from).toBe(1);
    expect(r.value.doc).toEqual(migrateV3toV4(migrateV2toV3(migrateV1toV2(clone(v1)))));
    const v = validateState(r.value.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.state.version).toBe(STATE_VERSION);
    expect(v.value.state.settings.soundscape).toBeUndefined();
    expect(v.value.state.settings.muted).toBe(v1.settings.muted);
    const { storage, saved } = storageWith(v1);
    expect(loadState(storage, v1.session.startedAt + 5 * MIN).status).toBe('migrated');
    expect(saved().version).toBe(STATE_VERSION);
  });
});
