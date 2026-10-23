import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, importState, loadState, migrateV2toV3, STORAGE_KEY, validateState, type StorageLike } from './persistence';
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
    const result = validateState(upgraded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toEqual({ ...legacy, version: STATE_VERSION });
      expect(result.value.state.settings.soundscape).toBeUndefined();
      expect(result.value.state.settings.muted).toBe(true);
    }
  });

  it('loads and re-saves v2 once at the same storage key, then loads without migration', () => {
    const values = new Map([[STORAGE_KEY, JSON.stringify(legacyGarden())]]);
    const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
    const first = loadState(storage, T0 + MIN);
    expect(first.status).toBe('migrated');
    expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(3);
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
    expect(imported.state.version).toBe(3);
    const current = createDefaultState(T0);
    current.settings.soundscape = defaultSoundscape();
    current.settings.soundscape.standard = levelsWith({ cafe: 35, lofi: 25 });
    expect(validateState(current).ok).toBe(true);
    // Current validation never silently accepts an older document without its migration step.
    expect(validateState(legacy)).toMatchObject({ ok: false, error: { path: 'version' } });
  });
});
