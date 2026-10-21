import type { WidgetBus, WidgetEvent, WidgetSession, WidgetStatus, WidgetTimeline } from './contract';

/** Test builders for the widget's controller contract (not shipped: imported by tests only). */

export function session(patch: Partial<WidgetSession> = {}): WidgetSession {
  return {
    id: 'session-test',
    taskName: 'Biology ch. 4',
    plan: {
      id: 'two-pomodoros',
      name: 'Two pomodoros',
      blocks: [
        { kind: 'focus', minutes: 25 },
        { kind: 'break', minutes: 10 },
        { kind: 'focus', minutes: 25 },
      ],
    },
    speciesId: 'placeholder-sprout',
    seed: 7,
    ...patch,
  };
}

export function timeline(patch: Partial<WidgetTimeline> = {}): WidgetTimeline {
  return {
    blockIndex: 0,
    block: { kind: 'focus', minutes: 25 },
    blockRemainingMs: 25 * 60_000,
    totalRemainingMs: 60 * 60_000,
    growth: 0,
    progress: 0,
    watered: false,
    complete: false,
    ...patch,
  };
}

/** A status (defaults: idle). Phases other than idle get a session and a timeline. */
export function status(phase: WidgetStatus['phase'] = 'idle', tl: Partial<WidgetTimeline> = {}, s: Partial<WidgetSession> = {}): WidgetStatus {
  if (phase === 'idle') return { phase, timeline: null, session: null };
  return { phase, timeline: timeline(tl), session: session(s) };
}

/** A scriptable controller: set the status, fire ticks, count calls. */
export function fakeController(initial: WidgetStatus = status()) {
  let st = initial;
  const ticks = new Set<() => void>();
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
    return true;
  };
  return {
    calls,
    status: () => st,
    onTick(fn: () => void) {
      ticks.add(fn);
      return () => {
        ticks.delete(fn);
      };
    },
    set(next: WidgetStatus) {
      st = next;
    },
    tick() {
      for (const fn of [...ticks]) fn();
    },
    listeners: () => ticks.size,
    pause: record('pause'),
    resume: record('resume'),
    water: record('water'),
    skipBreak: record('skipBreak'),
    setTicker: () => {
      calls.push('setTicker');
    },
    updateSettings: (patch: unknown) => {
      calls.push(`updateSettings:${JSON.stringify(patch)}`);
      return true;
    },
  };
}

export function fakeBus() {
  const handlers = new Map<WidgetEvent, Set<(p: unknown) => void>>();
  const bus: WidgetBus & { emit(name: WidgetEvent, payload?: unknown): void; count(): number } = {
    on(name, fn) {
      let set = handlers.get(name);
      if (!set) handlers.set(name, (set = new Set()));
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    emit(name, payload = {}) {
      for (const fn of [...(handlers.get(name) ?? [])]) fn(payload);
    },
    count: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  };
  return bus;
}

export function fakeStore() {
  const subs = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    emit() {
      for (const fn of [...subs]) fn();
    },
    listeners: () => subs.size,
  };
}

export type RecordingContext = CanvasRenderingContext2D & { fills: string[]; strokes: string[]; calls: number };

/**
 * A stand-in 2D context that records the fill/stroke styles used and accepts every call.
 * Enough to exercise drawing code under Node without a canvas implementation.
 */
export function recordingContext(): RecordingContext {
  const fills: string[] = [];
  const strokes: string[] = [];
  let calls = 0;
  const props: Record<string, unknown> = {};
  const target = {
    fills,
    strokes,
    get calls() {
      return calls;
    },
  };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return (t as Record<string | symbol, unknown>)[key];
      if (key === 'fill') return () => fills.push(String(props.fillStyle));
      if (key === 'stroke') return () => strokes.push(String(props.strokeStyle));
      if (key === 'createRadialGradient' || key === 'createLinearGradient' || key === 'createPattern') {
        return () => ({ addColorStop() {} });
      }
      if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
      if (typeof key === 'string' && key in props) return props[key];
      return () => {
        calls++;
      };
    },
    set(_t, key, value) {
      props[String(key)] = value;
      return true;
    },
  }) as unknown as RecordingContext;
}
