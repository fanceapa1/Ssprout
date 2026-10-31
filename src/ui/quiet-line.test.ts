// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../core/events';
import { faunaSeenKey } from '../core/fauna-unlocks';
import type { SceneryId } from '../core/sceneries';
import { createDefaultState, createStore, reducer } from '../core/state';
import type { UIContext } from './context';
import { createQuietLine } from './quiet-line';

function setup(faunaSeen: string[]) {
  const store = createStore({ ...createDefaultState(0), faunaSeen }, reducer);
  const bus = createEventBus();
  const recorded: string[] = [];
  // records and announces like the session controller (src/core/controller.ts › announceFauna)
  const controller = {
    announceFauna(id: string, sceneryId: SceneryId = store.get().scenery) {
      recorded.push(`${sceneryId}/${id}`);
      const prev = store.get();
      store.dispatch({ type: 'fauna/seen', id: faunaSeenKey(sceneryId, id) });
      if (store.get() === prev) return false;
      bus.emit('fauna:arrived', { id, sceneryId });
      return true;
    },
  };
  const ctx = {
    deps: { store, bus, controller, reducedMotion: true },
    mode: () => 'garden',
    openDialogs: () => [],
    changed: () => {},
    delay: (ms: number) => ms,
  } as unknown as UIContext;
  return { store, bus, line: createQuietLine(ctx), recorded };
}

describe('quiet line: fauna arrivals per garden', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a dragonfly seen in the garden is still announced at the waterfall, in its words, and recorded there', () => {
    const { store, bus, line, recorded } = setup(['dragonfly']);
    bus.emit('fauna:arrived', { id: 'dragonfly', sceneryId: 'waterfall' });
    expect(line.current()).toBe('A red dragonfly hovers over the pool.');
    expect(line.el.dataset.faunaId).toBe('dragonfly');
    expect(recorded).toEqual(['waterfall/dragonfly']);
    expect(store.get().faunaSeen).toEqual(['dragonfly', 'waterfall:dragonfly']);
    line.dispose();
  });

  it('records the garden it was seen in, not the garden on view', () => {
    const { store, bus, line } = setup([]);
    expect(store.get().scenery).toBe('japanese-garden');
    bus.emit('fauna:arrived', { id: 'wagtail', sceneryId: 'waterfall' });
    expect(store.get().faunaSeen).toEqual(['waterfall:wagtail']);
    line.dispose();
  });

  it('says nothing for creatures that are there from the start, and never records twice', () => {
    const { store, bus, line, recorded } = setup(['waterfall:dragonfly']);
    bus.emit('fauna:arrived', { id: 'dipper', sceneryId: 'waterfall' });
    expect(line.current()).toBeNull();
    bus.emit('fauna:arrived', { id: 'dragonfly', sceneryId: 'waterfall' });
    expect(line.current()).toBe('A red dragonfly hovers over the pool.');
    expect(recorded).toEqual([]);
    expect(store.get().faunaSeen).toEqual(['waterfall:dragonfly']);
    line.dispose();
  });
});
