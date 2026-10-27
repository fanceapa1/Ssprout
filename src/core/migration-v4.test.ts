import { describe, expect, it } from 'vitest';
import v1Paused from './fixtures/garden-v1-paused.json';
import v1Session from './fixtures/garden-v1-session.json';
import v2Parallel from './fixtures/garden-v2-parallel.json';
import v3Sound from './fixtures/garden-v3-sound.json';
import {
  EXPORT_FORMAT,
  exportState,
  importState,
  loadState,
  migrate,
  migrateV1toV2,
  migrateV2toV3,
  migrateV3toV4,
  STORAGE_KEY,
  validateState,
  type StorageLike,
} from './persistence';
import { createDefaultState, STATE_VERSION, type GardenState } from './state';
import { makePlant, makePressed, makeSession, MIN, T0 } from './testing';

/**
 * Schema v3 → v4 (ADR 0240): per-scenery gardens. Every plant, pressed flower, session in
 * progress and log entry of an older garden grew in the Japanese garden, which is the one on view.
 */

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const jp = <T extends object>(x: T) => ({ ...x, sceneryId: 'japanese-garden' });

function storageWith(doc: unknown) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(doc)]]);
  const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
  return { storage, values, saved: () => JSON.parse(values.get(STORAGE_KEY)!) as GardenState };
}

const current = (doc: unknown): GardenState => {
  const m = migrate(clone(doc));
  if (!m.ok) throw new Error(m.error.message);
  const v = validateState(m.value.doc);
  if (!v.ok) throw new Error(v.error.message);
  return v.value.state;
};

describe('v3 → v4 migration', () => {
  it('tags every plant, pressed flower, session and log entry with the Japanese garden and shows it', () => {
    const doc = clone(v3Sound);
    const before = JSON.stringify(doc);
    const out = migrateV3toV4(doc);
    expect(JSON.stringify(doc)).toBe(before); // never mutates its input
    expect(out).toEqual({
      ...v3Sound,
      version: 4,
      scenery: 'japanese-garden',
      plants: v3Sound.plants.map(jp),
      pressed: v3Sound.pressed.map(jp),
      session: jp(v3Sound.session),
      waiting: v3Sound.waiting.map(jp),
      log: v3Sound.log.map(jp),
    });
  });

  it('keeps everything else as it was: schedules, stats, tips, settings and sound mixes, announced wildlife', () => {
    const state = current(v3Sound);
    expect(state.version).toBe(STATE_VERSION);
    expect(state.scenery).toBe('japanese-garden');
    expect(state.schedules).toEqual(v3Sound.schedules);
    expect(state.stats).toEqual(v3Sound.stats);
    expect(state.tips).toEqual(v3Sound.tips);
    expect(state.settings).toEqual(v3Sound.settings);
    expect(state.faunaSeen).toEqual(['dragonfly', 'koi-1']); // Japanese ids are not namespaced
    expect(state.session).toEqual(jp(v3Sound.session));
    expect(state.waiting).toEqual(v3Sound.waiting.map(jp));
  });

  it('adds no keys an older garden did not have and leaves malformed entries for validation', () => {
    expect(migrateV3toV4({ version: 3 })).toEqual({ version: 4, scenery: 'japanese-garden' });
    const out = migrateV3toV4({ version: 3, plants: [3], session: null });
    expect(out).toEqual({ version: 4, scenery: 'japanese-garden', plants: [3], session: null });
    expect(validateState(out)).toMatchObject({ ok: false, error: { path: 'plants[0]' } });
  });

  it('a stored v3 garden loads as migrated, is saved as v4 at the same key and then loads as is', () => {
    const { storage, values, saved } = storageWith(v3Sound);
    const now = v3Sound.session.startedAt + 10 * MIN;
    const first = loadState(storage, now);
    expect(first.status).toBe('migrated');
    expect(saved().version).toBe(4);
    expect(saved().scenery).toBe('japanese-garden');
    const second = loadState(storage, now);
    expect(second.status).toBe('loaded');
    expect(second.state).toEqual(first.state);
    expect(values.size).toBe(1);
  });

  it.each([
    ['v1 garden with a running session', v1Session, 1],
    ['v1 garden with a paused session', v1Paused, 1],
    ['v2 garden with parallel sessions', v2Parallel, 2],
  ])('a %s chains through to v4, the same as step by step', (_name, doc, from) => {
    const r = migrate(clone(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.from).toBe(from);
    const steps = from === 1 ? migrateV3toV4(migrateV2toV3(migrateV1toV2(clone(doc)))) : migrateV3toV4(migrateV2toV3(clone(doc)));
    expect(r.value.doc).toEqual(steps);
    const state = current(doc);
    const all = [...state.plants, ...state.pressed, ...state.waiting, ...state.log, ...(state.session ? [state.session] : [])];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((x) => x.sceneryId === 'japanese-garden')).toBe(true);
    expect(state.scenery).toBe('japanese-garden');
  });
});

describe('v4 round trips', () => {
  /** A garden with plants, a pressed flower and sessions in both sceneries. */
  function twoGardens(): GardenState {
    return {
      ...createDefaultState(T0),
      scenery: 'waterfall',
      plants: [
        makePlant({ id: 'p1', slotId: 'shared-1' }),
        makePlant({ id: 'p2', sceneryId: 'waterfall', slotId: 'shared-1' }),
      ],
      pressed: [makePressed(), makePressed({ sceneryId: 'waterfall' })],
      session: makeSession({ id: 's1', sceneryId: 'waterfall', slotId: 'pool-1' }),
      waiting: [makeSession({ id: 's2', slotId: 'pool-1', pausedAt: T0 + MIN })],
      faunaSeen: ['dragonfly', 'waterfall:dragonfly'],
    };
  }

  it('JSON and back is the same garden', () => {
    const state = twoGardens();
    const r = validateState(JSON.parse(JSON.stringify(state)));
    expect(r.ok && r.value.state).toEqual(state);
  });

  it('a v4 export imports to the same garden; a v3 export imports as v4', () => {
    const state = twoGardens();
    const back = importState(exportState(state, T0));
    expect(back.ok && back.state).toEqual(state);
    expect(JSON.parse(exportState(state, T0)).schemaVersion).toBe(4);

    const v3File = JSON.stringify({ format: EXPORT_FORMAT, formatVersion: 1, schemaVersion: 3, state: v3Sound });
    const v3 = importState(v3File);
    expect(v3.ok).toBe(true);
    if (!v3.ok) return;
    expect(v3.state.version).toBe(4);
    expect(v3.state.plants).toEqual(v3Sound.plants.map(jp));
    expect(v3.state.log).toEqual(v3Sound.log.map(jp));
  });

  it('a stored v4 garden loads without migration', () => {
    const { storage } = storageWith(twoGardens());
    const r = loadState(storage, T0);
    expect(r.status).toBe('loaded');
    expect(r.state).toEqual(twoGardens());
  });
});
