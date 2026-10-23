import { describe, expect, it, vi } from 'vitest';
import { createDefaultState, createStore, reducer, STATE_VERSION, type Reducer } from './state';

describe('createDefaultState', () => {
  it('builds an empty, muted garden', () => {
    const s = createDefaultState(1234);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.createdAt).toBe(1234);
    expect(s.plants).toEqual([]);
    expect(s.session).toBeNull();
    expect(s.waiting).toEqual([]);
    expect(s.log).toEqual([]);
    expect('pendingReward' in s).toBe(false);
    expect(s.settings.muted).toBe(true);
    expect(s.settings.lastGoalMinutes).toBe(25);
    expect(s.settings.notifications).toBe('unasked');
  });

  it('returns fresh objects each call', () => {
    const a = createDefaultState(0);
    const b = createDefaultState(0);
    expect(a).toEqual(b);
    expect(a.plants).not.toBe(b.plants);
  });

  it('is JSON round-trippable', () => {
    const s = createDefaultState(5);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('reducer export', () => {
  it('returns the same reference for unknown actions', () => {
    const s = createDefaultState(0);
    expect(reducer(s, { type: 'nope' } as never)).toBe(s);
  });
});

type CounterAction = { type: 'inc'; by: number } | { type: 'noop' };
const counter: Reducer<{ n: number }, CounterAction> = (s, a) =>
  a.type === 'inc' ? { n: s.n + a.by } : s;

describe('createStore', () => {
  it('get() returns the current state and dispatch applies the reducer', () => {
    const store = createStore({ n: 0 }, counter);
    store.dispatch({ type: 'inc', by: 2 });
    store.dispatch({ type: 'inc', by: 3 });
    expect(store.get()).toEqual({ n: 5 });
  });

  it('notifies onChange then subscribers with (next, prev, action)', () => {
    const order: string[] = [];
    const onChange = vi.fn(() => order.push('onChange'));
    const store = createStore({ n: 0 }, counter, onChange);
    const sub = vi.fn(() => order.push('sub'));
    store.subscribe(sub);
    store.dispatch({ type: 'inc', by: 1 });
    expect(order).toEqual(['onChange', 'sub']);
    expect(sub).toHaveBeenCalledWith({ n: 1 }, { n: 0 }, { type: 'inc', by: 1 });
  });

  it('does not notify when the reducer returns the same reference', () => {
    const onChange = vi.fn();
    const store = createStore({ n: 0 }, counter, onChange);
    const sub = vi.fn();
    store.subscribe(sub);
    store.dispatch({ type: 'noop' });
    expect(onChange).not.toHaveBeenCalled();
    expect(sub).not.toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const store = createStore({ n: 0 }, counter);
    const sub = vi.fn();
    const unsub = store.subscribe(sub);
    unsub();
    store.dispatch({ type: 'inc', by: 1 });
    expect(sub).not.toHaveBeenCalled();
  });

  it('queues dispatches made from listeners until the current delivery finishes', () => {
    const store = createStore({ n: 0 }, counter);
    const seen: Array<[number, number]> = [];
    store.subscribe((s, prev) => {
      seen.push([prev.n, s.n]);
      if (s.n === 1) store.dispatch({ type: 'inc', by: 10 });
    });
    const second: number[] = [];
    store.subscribe((s) => second.push(s.n));
    store.dispatch({ type: 'inc', by: 1 });
    // both listeners saw n=1 before anyone saw n=11
    expect(seen).toEqual([
      [0, 1],
      [1, 11],
    ]);
    expect(second).toEqual([1, 11]);
    expect(store.get().n).toBe(11);
  });

  it('recovers after a throwing reducer', () => {
    let explode = true;
    const r: Reducer<{ n: number }, CounterAction> = (s, a) => {
      if (explode) throw new Error('bad');
      return counter(s, a);
    };
    const store = createStore({ n: 0 }, r);
    expect(() => store.dispatch({ type: 'inc', by: 1 })).toThrow('bad');
    explode = false;
    store.dispatch({ type: 'inc', by: 1 });
    expect(store.get().n).toBe(1);
  });
});
