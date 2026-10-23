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
    switchTo: (id: string) => {
      calls.push(`switchTo:${id}`);
      return true;
    },
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

export type Rgb = [number, number, number];

export type RasterContext = CanvasRenderingContext2D & {
  /** the composited colour of a pixel */
  pixel(x: number, y: number): Rgb;
};

/** `#rgb`, `#rrggbb` or `rgb(a)(…)` → [r, g, b, a]. */
function parseColour(c: string): [number, number, number, number] {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
}

type Pt = { x: number; y: number };

/**
 * A tiny software rasteriser behind the 2D context API: paths of `moveTo` / `lineTo` / `closePath`,
 * `fill` (non-zero) and `stroke` (round segments), `globalAlpha`, `save` / `restore`, `translate` /
 * `scale`, composited source-over on `background` with 2×2 samples per pixel. Enough to sample the
 * pixels of the widget's brush painting under Node; every other call is accepted and ignored.
 */
export function rasterContext(width: number, height: number, background = '#ffffff'): RasterContext {
  const [br, bg, bb] = parseColour(background);
  const buf = new Float64Array(width * height * 3);
  for (let i = 0; i < width * height; i++) buf.set([br, bg, bb], i * 3);
  type State = { fillStyle: string; strokeStyle: string; lineWidth: number; globalAlpha: number; m: [number, number, number, number] };
  let st: State = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, m: [1, 1, 0, 0] };
  const stack: State[] = [];
  let paths: Pt[][] = [];
  let closed: boolean[] = [];
  const dev = (x: number, y: number): Pt => ({ x: x * st.m[0] + st.m[2], y: y * st.m[1] + st.m[3] });
  const SAMPLES = [0.25, 0.75];

  const paint = (colour: string, covers: (x: number, y: number) => boolean, pad: number) => {
    const all = paths.flat();
    if (!all.length) return;
    const [r, g, b, a0] = parseColour(colour);
    const a = a0 * st.globalAlpha;
    const x0 = Math.max(0, Math.floor(Math.min(...all.map((p) => p.x)) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(...all.map((p) => p.y)) - pad));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(...all.map((p) => p.x)) + pad));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(...all.map((p) => p.y)) + pad));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let n = 0;
        for (const sy of SAMPLES) for (const sx of SAMPLES) if (covers(px + sx, py + sy)) n++;
        if (!n) continue;
        const k = (a * n) / 4;
        const i = (py * width + px) * 3;
        buf[i] = buf[i]! * (1 - k) + r * k;
        buf[i + 1] = buf[i + 1]! * (1 - k) + g * k;
        buf[i + 2] = buf[i + 2]! * (1 - k) + b * k;
      }
    }
  };

  const api = {
    pixel(x: number, y: number): Rgb {
      const i = (Math.floor(y) * width + Math.floor(x)) * 3;
      return [Math.round(buf[i]!), Math.round(buf[i + 1]!), Math.round(buf[i + 2]!)];
    },
    save: () => stack.push({ ...st, m: [...st.m] }),
    restore: () => {
      st = stack.pop() ?? st;
    },
    translate: (x: number, y: number) => {
      st.m = [st.m[0], st.m[1], st.m[2] + x * st.m[0], st.m[3] + y * st.m[1]];
    },
    scale: (x: number, y: number) => {
      st.m = [st.m[0] * x, st.m[1] * y, st.m[2], st.m[3]];
    },
    beginPath: () => {
      paths = [];
      closed = [];
    },
    moveTo: (x: number, y: number) => {
      paths.push([dev(x, y)]);
      closed.push(false);
    },
    lineTo: (x: number, y: number) => {
      if (!paths.length) api.moveTo(x, y);
      else paths[paths.length - 1]!.push(dev(x, y));
    },
    closePath: () => {
      if (closed.length) closed[closed.length - 1] = true;
    },
    fill: () => {
      const polys = paths;
      const covers = (x: number, y: number) => {
        let w = 0;
        for (const poly of polys) {
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i]!;
            const b = poly[(i + 1) % poly.length]!;
            const side = (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y);
            if (a.y <= y) {
              if (b.y > y && side > 0) w++;
            } else if (b.y <= y && side < 0) w--;
          }
        }
        return w !== 0;
      };
      paint(st.fillStyle, covers, 0);
    },
    stroke: () => {
      const half = (st.lineWidth * Math.abs(st.m[0])) / 2;
      const segs: [Pt, Pt][] = [];
      paths.forEach((p, j) => {
        for (let i = 0; i + 1 < p.length; i++) segs.push([p[i]!, p[i + 1]!]);
        if (closed[j] && p.length > 2) segs.push([p[p.length - 1]!, p[0]!]);
        if (p.length === 1) segs.push([p[0]!, p[0]!]);
      });
      const covers = (x: number, y: number) =>
        segs.some(([a, b]) => {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
          return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) <= half;
        });
      paint(st.strokeStyle, covers, half);
    },
  };
  return new Proxy(api, {
    get(t, key) {
      if (key in t) return (t as Record<string | symbol, unknown>)[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient' || key === 'createPattern') return () => ({ addColorStop() {} });
      if (typeof key === 'string' && key in st) return (st as Record<string, unknown>)[key];
      return () => {};
    },
    set(_t, key, value) {
      if (typeof key === 'string' && key in st) (st as Record<string, unknown>)[key] = value;
      return true;
    },
  }) as unknown as RasterContext;
}
