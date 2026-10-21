import { createIntervalTicker, type Ticker } from '../core/controller';

/**
 * A `Ticker` (see core/controller.ts) driven by a dedicated Web Worker. Browsers throttle
 * main-thread timers in background tabs (Chrome: to once a minute after a while), which would
 * delay session completion and the notification; timers inside a dedicated worker are not
 * throttled that way, and their messages are delivered to the page promptly. Falls back to
 * `setInterval` when Workers are unavailable or the worker fails. ADR 0090.
 */

/** The subset of `Worker` the ticker uses (lets tests pass a fake). */
export interface WorkerLike {
  postMessage(msg: TickerCommand): void;
  terminate(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type TickerCommand = { type: 'start'; id: number; ms: number } | { type: 'stop'; id: number };
export interface TickMessage {
  type: 'tick';
  id: number;
}

export interface WorkerTicker extends Ticker {
  /** 'worker' until the worker could not be created or failed; then 'interval'. */
  readonly mode: 'worker' | 'interval';
  /** Stop every subscription and terminate the worker. */
  dispose(): void;
}

export interface WorkerTickerOptions {
  intervalMs?: number;
  /** Creates the worker; return null (or throw) when unavailable. Default: inline Blob worker. */
  createWorker?: () => WorkerLike | null;
  /** Used when there is no worker (default `createIntervalTicker(intervalMs)`). */
  fallback?: Ticker;
}

/** Source of the worker: one `setInterval` per subscription id, posting `{type:'tick', id}`. */
export const TICK_WORKER_SOURCE = `
const timers = new Map();
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'start') {
    clearInterval(timers.get(m.id));
    timers.set(m.id, setInterval(() => self.postMessage({ type: 'tick', id: m.id }), m.ms));
  } else if (m.type === 'stop') {
    clearInterval(timers.get(m.id));
    timers.delete(m.id);
  }
};
`;

/** An inline worker from a Blob URL (no extra build entry), or null when unsupported. */
export function createInlineTickWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    return null;
  }
  const url = URL.createObjectURL(new Blob([TICK_WORKER_SOURCE], { type: 'text/javascript' }));
  try {
    return new Worker(url, { name: 'study-sprout-ticker' }) as unknown as WorkerLike;
  } finally {
    // the worker keeps its script once created; revoking only frees the URL
    URL.revokeObjectURL(url);
  }
}

const isTick = (d: unknown): d is TickMessage =>
  typeof d === 'object' && d !== null && (d as TickMessage).type === 'tick' && typeof (d as TickMessage).id === 'number';

export function createWorkerTicker(opts: WorkerTickerOptions = {}): WorkerTicker {
  const ms = opts.intervalMs ?? 1000;
  const fallback = opts.fallback ?? createIntervalTicker(ms);
  const createWorker = opts.createWorker ?? createInlineTickWorker;

  let worker: WorkerLike | null = null;
  let failed = false;
  let nextId = 1;
  /** active subscriptions: id → tick fn, plus the stop of its fallback if it was moved there */
  const subs = new Map<number, { tick: () => void; stopFallback: (() => void) | null }>();

  /** Move every subscription to the fallback ticker (worker error or creation failure). */
  const fail = (): void => {
    if (failed) return;
    failed = true;
    try {
      worker?.terminate();
    } catch {
      /* already gone */
    }
    worker = null;
    for (const sub of subs.values()) if (!sub.stopFallback) sub.stopFallback = fallback.start(sub.tick);
  };

  const ensureWorker = (): WorkerLike | null => {
    if (failed) return null;
    if (worker) return worker;
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      failed = true;
      return null;
    }
    worker.onmessage = (ev) => {
      if (isTick(ev.data)) subs.get(ev.data.id)?.tick();
    };
    worker.onerror = () => fail();
    return worker;
  };

  return {
    get mode() {
      return failed ? 'interval' : 'worker';
    },

    start(tick) {
      const id = nextId++;
      const sub = { tick, stopFallback: null as (() => void) | null };
      subs.set(id, sub);
      const w = ensureWorker();
      if (w) {
        try {
          w.postMessage({ type: 'start', id, ms });
        } catch {
          fail();
        }
      } else {
        sub.stopFallback = fallback.start(tick);
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        subs.delete(id);
        if (sub.stopFallback) sub.stopFallback();
        else if (worker) {
          try {
            worker.postMessage({ type: 'stop', id });
          } catch {
            /* worker gone: nothing to stop */
          }
        }
      };
    },

    dispose() {
      for (const [id, sub] of subs) {
        if (sub.stopFallback) sub.stopFallback();
        else worker?.postMessage({ type: 'stop', id });
      }
      subs.clear();
      worker?.terminate();
      worker = null;
    },
  };
}
