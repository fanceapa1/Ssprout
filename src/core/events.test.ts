import { describe, expect, it, vi } from 'vitest';
import { createEventBus, EVENT_NAMES } from './events';

describe('event bus', () => {
  it('delivers typed payloads to subscribers in order', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on('fauna:arrived', (p) => calls.push(`a:${p.id}`));
    bus.on('fauna:arrived', (p) => calls.push(`b:${p.id}`));
    bus.emit('fauna:arrived', { id: 'koi' });
    expect(calls).toEqual(['a:koi', 'b:koi']);
  });

  it('only delivers to handlers of the emitted event', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('tip:retired', fn);
    bus.emit('fauna:arrived', { id: 'heron' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes via the returned function and via off()', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    const unsub = bus.on('tip:retired', a);
    bus.on('tip:retired', b);
    unsub();
    bus.off('tip:retired', b);
    bus.emit('tip:retired', { id: 'slider' });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('once() fires a single time', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.once('session:water', fn);
    bus.emit('session:water', { blockIndex: 1, sessionId: 's', auto: false });
    bus.emit('session:water', { blockIndex: 3, sessionId: 's', auto: false });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ blockIndex: 1, sessionId: 's', auto: false });
  });

  it('handlers added or removed during emit do not affect the current delivery', () => {
    const bus = createEventBus();
    const late = vi.fn();
    const second = vi.fn();
    bus.on('fauna:arrived', () => {
      bus.on('fauna:arrived', late);
      bus.off('fauna:arrived', second);
    });
    bus.on('fauna:arrived', second);
    bus.emit('fauna:arrived', { id: 'frog' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
  });

  it('a throwing handler does not stop the others', () => {
    const onError = vi.fn();
    const bus = createEventBus(onError);
    const after = vi.fn();
    bus.on('tip:retired', () => {
      throw new Error('boom');
    });
    bus.on('tip:retired', after);
    bus.emit('tip:retired', { id: 'x' });
    expect(after).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'tip:retired');
  });

  it('clear() removes everything; names list matches the contract', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('fauna:arrived', fn);
    bus.clear();
    bus.emit('fauna:arrived', { id: 'x' });
    expect(fn).not.toHaveBeenCalled();
    expect(EVENT_NAMES).toHaveLength(15);
  });
});
