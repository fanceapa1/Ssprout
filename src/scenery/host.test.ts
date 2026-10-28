import { describe, expect, it } from 'vitest';
import { createDefaultState, createStore, reducer } from '../core/state';
import { makeSession, T0 } from '../core/testing';
import { createSceneryHost } from './host';
import { getScenery } from './registry';
import type { Scenery } from './types';

function setup() {
  const state = {
    ...createDefaultState(T0),
    session: makeSession({ id: 'pond', slotId: 'meadow-1' }),
    waiting: [makeSession({ id: 'falls', sceneryId: 'waterfall', slotId: 'ledge-1' })],
  };
  const store = createStore(state, reducer);
  const shown: string[] = [];
  const renderer = {
    setScenery: (s: Scenery) => (shown.push(s.id), Promise.resolve()),
    whenReady: () => Promise.resolve(),
  };
  const host = createSceneryHost({ store, renderer, getScenery });
  return { store, shown, host };
}

describe('scenery host (ADR 0243)', () => {
  it('shows the garden state.scenery names', () => {
    const { store, shown, host } = setup();
    store.dispatch({ type: 'scenery/view', id: 'waterfall' });
    expect(shown).toEqual(['waterfall']);
    expect(host.viewed().id).toBe('waterfall');
    store.dispatch({ type: 'scenery/view', id: 'japanese-garden' });
    expect(shown).toEqual(['waterfall', 'japanese-garden']);
  });

  it('brings an active session’s garden into view when it becomes active', () => {
    const { store, shown } = setup();
    store.dispatch({ type: 'session/switch', id: 'falls', now: T0 + 1000 });
    expect(store.get().session?.id).toBe('falls');
    expect(store.get().scenery).toBe('waterfall');
    expect(shown).toEqual(['waterfall']);
  });
});
