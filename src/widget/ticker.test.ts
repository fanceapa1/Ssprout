import { describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../core/clock';
import { createSessionController, type Ticker } from '../core/controller';
import { createEventBus } from '../core/events';
import { createDefaultState, createStore, reducer } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import { createWorkerTicker, TICK_WORKER_SOURCE, type TickerCommand, type WorkerLike } from './ticker';

/** A fake worker that records commands; `tick(id)` simulates the worker posting a tick. */
function fakeWorker() {
  const sent: TickerCommand[] = [];
  const w: WorkerLike & { sent: TickerCommand[]; terminated: boolean; tick(id: number): void; crash(): void } = {
    sent,
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(msg) {
      if (w.terminated) throw new Error('terminated');
      sent.push(msg);
    },
    terminate() {
      w.terminated = true;
    },
    tick(id) {
      w.onmessage?.({ data: { type: 'tick', id } });
    },
    crash() {
      w.onerror?.(new Error('boom'));
    },
  };
  return w;
}

/** A fallback ticker that counts starts/stops and can be fired by hand. */
function manualTicker() {
  const active = new Set<() => void>();
  let starts = 0;
  const t: Ticker & { fire(): void; active: Set<() => void>; starts(): number } = {
    active,
    starts: () => starts,
    start(tick) {
      starts++;
      active.add(tick);
      return () => active.delete(tick);
    },
    fire() {
      for (const fn of [...active]) fn();
    },
  };
  return t;
}

describe('createWorkerTicker', () => {
  it('starts a worker interval and forwards its ticks', () => {
    const w = fakeWorker();
    const ticker = createWorkerTicker({ intervalMs: 1000, createWorker: () => w, fallback: manualTicker() });
    const tick = vi.fn();
    const stop = ticker.start(tick);
    expect(ticker.mode).toBe('worker');
    expect(w.sent).toEqual([{ type: 'start', id: 1, ms: 1000 }]);
    w.tick(1);
    w.tick(1);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
    expect(w.sent.at(-1)).toEqual({ type: 'stop', id: 1 });
    w.tick(1); // a late message after stop is ignored
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('creates the worker lazily, once, and routes ticks by subscription id', () => {
    const w = fakeWorker();
    const create = vi.fn(() => w);
    const ticker = createWorkerTicker({ createWorker: create, fallback: manualTicker() });
    expect(create).not.toHaveBeenCalled();
    const a = vi.fn();
    const b = vi.fn();
    ticker.start(a);
    ticker.start(b);
    expect(create).toHaveBeenCalledTimes(1);
    w.tick(2);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed messages', () => {
    const w = fakeWorker();
    const ticker = createWorkerTicker({ createWorker: () => w, fallback: manualTicker() });
    const tick = vi.fn();
    ticker.start(tick);
    w.onmessage?.({ data: 'tick' });
    w.onmessage?.({ data: { type: 'tick', id: '1' } });
    w.onmessage?.({ data: null });
    expect(tick).not.toHaveBeenCalled();
  });

  it('stop is idempotent', () => {
    const w = fakeWorker();
    const ticker = createWorkerTicker({ createWorker: () => w, fallback: manualTicker() });
    const stop = ticker.start(() => {});
    stop();
    stop();
    expect(w.sent.filter((m) => m.type === 'stop')).toHaveLength(1);
  });

  it('falls back to the interval ticker when no worker can be created', () => {
    const fb = manualTicker();
    const ticker = createWorkerTicker({ createWorker: () => null, fallback: fb });
    const tick = vi.fn();
    const stop = ticker.start(tick);
    expect(ticker.mode).toBe('interval');
    fb.fire();
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
    expect(fb.active.size).toBe(0);
  });

  it('falls back when creating the worker throws', () => {
    const fb = manualTicker();
    const ticker = createWorkerTicker({
      createWorker: () => {
        throw new Error('blocked by CSP');
      },
      fallback: fb,
    });
    const tick = vi.fn();
    ticker.start(tick);
    expect(ticker.mode).toBe('interval');
    fb.fire();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('moves live subscriptions to the fallback when the worker errors', () => {
    const w = fakeWorker();
    const fb = manualTicker();
    const ticker = createWorkerTicker({ createWorker: () => w, fallback: fb });
    const tick = vi.fn();
    const stop = ticker.start(tick);
    w.crash();
    expect(ticker.mode).toBe('interval');
    expect(w.terminated).toBe(true);
    fb.fire();
    expect(tick).toHaveBeenCalledTimes(1);
    // later subscriptions go straight to the fallback
    ticker.start(() => {});
    expect(fb.starts()).toBe(2);
    stop();
    expect(fb.active.size).toBe(1);
  });

  it('dispose stops everything and terminates the worker', () => {
    const w = fakeWorker();
    const ticker = createWorkerTicker({ createWorker: () => w, fallback: manualTicker() });
    const tick = vi.fn();
    ticker.start(tick);
    ticker.dispose();
    expect(w.sent.at(-1)).toEqual({ type: 'stop', id: 1 });
    expect(w.terminated).toBe(true);
  });

  it('the worker script runs one interval per subscription id', () => {
    // run the worker source against a fake global scope to check its protocol
    const posted: unknown[] = [];
    const timers = new Map<number, () => void>();
    let nextTimer = 1;
    const scope: { onmessage: ((e: { data: unknown }) => void) | null; postMessage(m: unknown): void } = {
      onmessage: null,
      postMessage: (m) => posted.push(m),
    };
    const run = new Function('self', 'setInterval', 'clearInterval', TICK_WORKER_SOURCE);
    run(
      scope,
      (fn: () => void) => {
        const h = nextTimer++;
        timers.set(h, fn);
        return h;
      },
      (h: number) => timers.delete(h),
    );
    scope.onmessage?.({ data: { type: 'start', id: 7, ms: 1000 } });
    expect(timers.size).toBe(1);
    [...timers.values()][0]!();
    expect(posted).toEqual([{ type: 'tick', id: 7 }]);
    scope.onmessage?.({ data: { type: 'stop', id: 7 } });
    expect(timers.size).toBe(0);
  });

  it('drives the session controller: ticks only while a session exists, completes on a tick', () => {
    const w = fakeWorker();
    const clock = createManualClock(1_000_000);
    const store = createStore(createDefaultState(clock.now()), reducer);
    const bus = createEventBus();
    const violet: SpeciesDef = {
      id: 'violet',
      name: 'Violet',
      tier: 1,
      habitats: ['meadow'],
      sizeClass: 'small',
      size: { w: 10, h: 10 },
      anchor: { x: 0.5, y: 1 },
      description: '',
      bloomColor: '#fff',
      pollinators: false,
      draw: () => {},
    };
    const slots = [{ id: 'meadow-1', x: 0, y: 0, habitat: 'meadow' as const, maxSize: 'small' as const, scale: 1 }];
    const controller = createSessionController({ store, clock, bus, species: [violet], slots, seed: 1 });
    controller.setTicker(createWorkerTicker({ createWorker: () => w, fallback: manualTicker() }));
    expect(w.sent).toEqual([]);
    expect(controller.start({ taskName: 'Reading', goalMinutes: 10, speciesId: 'violet', slotId: 'meadow-1' })).toBe(true);
    expect(w.sent).toEqual([{ type: 'start', id: 1, ms: 1000 }]);
    const completed = vi.fn();
    bus.on('session:complete', completed);
    clock.advance(10 * 60_000);
    w.tick(1);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(w.sent.at(-1)).toEqual({ type: 'stop', id: 1 });
    controller.dispose();
  });
});
