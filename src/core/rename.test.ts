import { describe, expect, it } from 'vitest';
import { createEventBus } from './events';
import { createManualClock } from './clock';
import { createSessionController } from './controller';
import { loadState, saveState, type StorageLike } from './persistence';
import { createDefaultState, createStore, logEntry, reducer } from './state';
import { makePlant, makeSession, MIN, T0 } from './testing';

describe('renaming a plant / study session', () => {
  const initial = () => ({
    ...createDefaultState(T0),
    session: makeSession(),
    waiting: [makeSession({ id: 'waiting', pausedAt: T0, slotId: 'meadow-2' })],
    plants: [makePlant()],
    log: [logEntry(makeSession({ id: 'p1' }), 'completed', T0 + 25 * MIN)],
  });

  it.each(['s1', 'waiting', 'p1'])('changes only the name of %s, including its history', (id) => {
    const before = initial();
    const after = reducer(before, { type: 'session/rename', id, taskName: '  Linear\n algebra  ' });
    const expected = structuredClone(before);
    for (const item of [expected.session, ...expected.waiting, ...expected.plants, ...expected.log]) {
      if (item.id === id) item.taskName = 'Linear algebra';
    }
    expect(after).toEqual(expected);
    expect(before).toEqual(initial());
  });

  it('normalizes blank names, caps Unicode names, and ignores missing or unchanged targets', () => {
    const state = initial();
    const renamed = reducer(state, { type: 'session/rename', id: 's1', taskName: '🌱'.repeat(45) });
    expect(renamed.session?.taskName).toBe('🌱'.repeat(40));
    expect(reducer(state, { type: 'session/rename', id: 's1', taskName: '\t  ' }).session?.taskName).toBe('Study session');
    expect(reducer(state, { type: 'session/rename', id: 'missing', taskName: 'New' })).toBe(state);
    expect(reducer(state, { type: 'session/rename', id: 's1', taskName: state.session.taskName })).toBe(state);
  });

  it('keeps the renamed task when the session blooms and when that plant is pressed', () => {
    let state = reducer(initial(), { type: 'session/rename', id: 's1', taskName: 'Revised task' });
    state = reducer(state, { type: 'session/complete', now: T0 + 25 * MIN });
    expect(state.plants.find((p) => p.id === 's1')?.taskName).toBe('Revised task');
    expect(state.log.find((e) => e.id === 's1')?.taskName).toBe('Revised task');
    state = reducer(state, { type: 'session/rename', id: 's1', taskName: 'Final task' });
    state = reducer(state, { type: 'session/start', id: 'next', taskName: 'Next', goalMinutes: 25,
      plan: makeSession().plan, speciesId: 'violet', slotId: 'meadow-1', seed: 3, now: T0 + 26 * MIN, weather: 'sun' });
    state = reducer(state, { type: 'session/complete', now: T0 + 51 * MIN });
    expect(state.pressed.some((p) => p.taskName === 'Final task')).toBe(true);
  });

  it('the controller saves growing and finished names through the existing persistence', () => {
    const store = createStore(initial(), reducer);
    const controller = createSessionController({ store, clock: createManualClock(T0), bus: createEventBus(), species: [], ticker: { start: () => () => {} } });
    expect(controller.rename('s1', 'Reading')).toBe(true);
    expect(controller.rename('p1', 'Botany')).toBe(true);
    expect(controller.rename('p1', 'Botany')).toBe(false);
    expect(controller.rename('missing', 'Botany')).toBe(false);
    const values = new Map<string, string>();
    const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
    expect(saveState(storage, store.get()).ok).toBe(true);
    const loaded = loadState(storage, T0).state;
    expect(loaded.session?.taskName).toBe('Reading');
    expect(loaded.plants[0]?.taskName).toBe('Botany');
    expect(loaded.log[0]?.taskName).toBe('Botany');
    controller.dispose();
  });
});
