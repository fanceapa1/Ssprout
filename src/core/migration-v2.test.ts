import { describe, expect, it } from 'vitest';
import { createManualClock } from './clock';
import { createSessionController } from './controller';
import { createEventBus } from './events';
import v1Paused from './fixtures/garden-v1-paused.json';
import v1Session from './fixtures/garden-v1-session.json';
import { EXPORT_FORMAT, importState, loadState, migrate, migrateV1toV2, STORAGE_KEY, validateState, type StorageLike } from './persistence';
import { sessionPhase, sessionTimeline } from './session';
import { createReducer, createStore, type ActiveSession, type GardenState } from './state';

/**
 * Schema v1 → v2 (ADRs 0150, 0151): parallel sessions and the session log. The fixtures are v1
 * documents as v1 builds saved them (`src/core/fixtures/garden-v1-*.json`).
 */

const MIN = 60_000;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function memoryStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  const storage: StorageLike & { map: Map<string, string> } = {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
  };
  return storage;
}

const migrated = (doc: unknown): GardenState => {
  const m = migrate(clone(doc));
  if (!m.ok) throw new Error(m.error.message);
  const v = validateState(m.value.doc);
  if (!v.ok) throw new Error(v.error.message);
  return v.value.state;
};

describe('v1 → v2 migration', () => {
  it('keeps the garden and makes the in-progress v1 session the active one, exactly as it was', () => {
    const state = migrated(v1Session);
    expect(state.version).toBe(2);
    expect(state.plants).toEqual(v1Session.plants);
    expect(state.pressed).toEqual(v1Session.pressed);
    expect(state.stats).toEqual(v1Session.stats);
    expect(state.settings).toEqual(v1Session.settings);
    expect(state.tips).toEqual(v1Session.tips);
    expect(state.faunaSeen).toEqual(v1Session.faunaSeen);
    expect(state.session).toEqual({ ...v1Session.session, focusWaterings: 0 });
    expect(state.waiting).toEqual([]);
  });

  it('back-fills the log from the finished plants, oldest first, marked as reconstructed', () => {
    const { log } = migrated(v1Session);
    expect(log.map((e) => e.id)).toEqual(['session-mh1z0000-00001', 'session-mh2a1b2c-0f3k1', 'session-mh3c9d0e-1a2b3']);
    expect(log[2]).toEqual({
      id: 'session-mh3c9d0e-1a2b3',
      outcome: 'completed',
      taskName: 'Biology ch. 4',
      speciesId: 'japanese-iris',
      slotId: 'shore-2',
      seed: 991230477,
      plan: null,
      goalMinutes: 60,
      focusedMinutes: 60,
      startedAt: 1761290000000,
      endedAt: 1761293900000,
      backfilled: true,
    });
    // pressed flowers and cancelled sessions left nothing to rebuild a session from
    expect(log.every((e) => e.outcome === 'completed' && e.backfilled)).toBe(true);
  });

  it('keeps a paused v1 session paused (it stays the active one; the long-pause rule still applies to it)', () => {
    const state = migrated(v1Paused);
    expect(state.session).toMatchObject({ id: 'session-mh4g11bb-3d4e5', pausedAt: 1761300600000, focusWaterings: 0 });
    expect(state.log).toEqual([]);
    expect(sessionPhase(state, 1761300600000 + 40 * MIN)).toBe('paused');
  });

  it('does not mutate the v1 document', () => {
    const doc = clone(v1Session);
    const before = JSON.stringify(doc);
    migrateV1toV2(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('leaves malformed plants out of the back-fill and lets validation report them', () => {
    const doc = { ...clone(v1Session), plants: [{ id: 3 }, ...clone(v1Session.plants)] };
    const out = migrateV1toV2(doc);
    expect((out.log as unknown[]).length).toBe(3);
    expect(validateState(out)).toMatchObject({ ok: false, error: { code: 'invalid-state', path: 'plants[0].plantedAt' } });
  });

  it('a stored v1 garden loads as migrated, is saved as v2 and then loads as is', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(v1Session) });
    const now = v1Session.session.startedAt + 20 * MIN;
    const first = loadState(storage, now);
    expect(first.status).toBe('migrated');
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).version).toBe(2);
    const second = loadState(storage, now);
    expect(second.status).toBe('loaded');
    expect(second.state).toEqual(first.state);
  });

  it('the in-progress session continues where it was: same plan position, block and growth', () => {
    const v1 = v1Session.session as unknown as Omit<ActiveSession, 'focusWaterings'>;
    const now = v1.startedAt + 33 * MIN; // 31 min of session time (2 paused): in the watered break
    const state = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v1Session) }), now).state;
    const before = sessionTimeline({ ...v1, focusWaterings: 0 }, now);
    const after = sessionTimeline(state.session!, now);
    expect(after).toEqual(before);
    expect(after.block.kind).toBe('break');
    expect(after.watered).toBe(true);

    // and the controller picks it up on boot without ending or restarting it
    const clock = createManualClock(now);
    const store = createStore(state, createReducer());
    const ctl = createSessionController({ store, clock, bus: createEventBus(), species: [], ticker: { start: () => () => {} } });
    expect(ctl.status()).toMatchObject({ phase: 'break', session: { id: v1.id } });
    clock.set(v1.startedAt + 2 * MIN + 60 * MIN);
    ctl.check();
    expect(store.get().session).toBeNull();
    expect(store.get().plants.map((p) => p.id)).toContain(v1.id);
    expect(store.get().log.at(-1)).toMatchObject({ id: v1.id, outcome: 'completed', focusedMinutes: 55, plan: { id: 'pomodoro' } });
    ctl.dispose();
  });

  it('an exported v1 file still imports (and validates)', () => {
    const file = JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, schemaVersion: 1, state: v1Session });
    const r = importState(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.version).toBe(2);
    expect(r.state.session?.id).toBe('session-mh4f00aa-2c3d4');
    expect(r.state.log).toHaveLength(3);
  });
});
