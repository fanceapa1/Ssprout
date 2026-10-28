import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../core/state';
import { makePlant, makeSession, T0 } from '../core/testing';
import { gardenOnView } from './system';

describe('gardenOnView (ADR 0243)', () => {
  const state = {
    ...createDefaultState(T0),
    plants: [makePlant({ id: 'jp', slotId: 'meadow-1' }), makePlant({ id: 'wf', sceneryId: 'waterfall', slotId: 'ledge-1' })],
    session: makeSession({ id: 'falls', sceneryId: 'waterfall', slotId: 'ledge-2' }),
    waiting: [makeSession({ id: 'pond', slotId: 'meadow-2' })],
  };

  it('shows only the viewed garden’s plants and seedlings', () => {
    const jp = gardenOnView(state, 'japanese-garden');
    expect(jp.plants.map((p) => p.id)).toEqual(['jp']);
    expect(jp.sessions.map((s) => s.id)).toEqual(['pond']);
    const wf = gardenOnView(state, 'waterfall');
    expect(wf.plants.map((p) => p.id)).toEqual(['wf']);
    expect(wf.sessions.map((s) => s.id)).toEqual(['falls']);
  });
});
