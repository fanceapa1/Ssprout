/**
 * Test-only recording canvas for the scene painting (node has no canvas). Every context call and
 * property set, with its exact arguments, is folded into one running hash, so two paintings hash
 * alike only if they issue the same canvas calls in the same order with the same numbers (the
 * marks, their order and the rng draws behind them). Pixel reads return a pattern seeded by the
 * hash so far, so the drying passes run on varied data and their output is hashed too.
 *
 * It also counts the cost of the work done since `mark()`: canvas calls, path points and pixels
 * read or written, for bounding how much one paint sub-step does without a wall clock.
 */

/** Work counted between two `mark()`s. */
export interface RecordedCost {
  /** context calls and property sets */
  calls: number;
  /** pixels read or written by pixel passes (getImageData / createImageData / putImageData) */
  pixels: number;
  /** pixel reads (getImageData): one per wet layer dried, the engine's heaviest single pass */
  reads: number;
}

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function invert(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c || 1;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

const matrix = (m: Matrix) => ({ ...m, inverse: () => matrix(invert(m)) });

export class PaintRecorder {
  private h = 0x811c9dc5;
  private cost: RecordedCost = { calls: 0, pixels: 0, reads: 0 };
  /** the running hash (hex) */
  get hash(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }

  /** Work since the last mark, and start counting again. */
  mark(): RecordedCost {
    const c = this.cost;
    this.cost = { calls: 0, pixels: 0, reads: 0 };
    return c;
  }

  feed(s: string): void {
    let h = this.h;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    this.h = h;
    this.cost.calls++;
  }

  feedPixels(data: ArrayLike<number>, n: number): void {
    let h = this.h;
    // a sample: every 61st byte is plenty to catch a change in a drying pass
    for (let i = 0; i < data.length; i += 61) h = Math.imul(h ^ data[i]!, 16777619);
    this.h = Math.imul(h ^ data.length, 16777619);
    this.cost.pixels += n;
  }

  pixelsRead(n: number, read: boolean): void {
    if (read) this.cost.reads++;
    this.cost.pixels += n;
  }

  /** Seed for a pixel read: the hash so far. */
  seed(): number {
    return this.h >>> 0;
  }

  /**
   * Record every canvas from now on, including the paint engine's pooled work canvases made
   * during an earlier recording: `globalThis.OffscreenCanvas` becomes `RecordingCanvas`.
   * Returns the function that puts the previous OffscreenCanvas back.
   */
  install(): () => void {
    const g = globalThis as { OffscreenCanvas?: unknown };
    const prev = g.OffscreenCanvas;
    g.OffscreenCanvas = RecordingCanvas;
    active = this;
    return () => {
      g.OffscreenCanvas = prev;
      if (active === this) active = idle;
    };
  }
}

const idle = new PaintRecorder();
/** The recorder every recording canvas reports to (pooled canvases outlive one recording). */
let active = idle;

export class RecordingCanvas {
  private w: number;
  private hh: number;
  private ctx: object | null = null;
  private reset: (() => void) | null = null;
  constructor(w: number, h: number) {
    this.w = w;
    this.hh = h;
    active.feed(`new ${w}x${h}`);
  }
  private get rec(): PaintRecorder {
    return active;
  }
  get width(): number {
    return this.w;
  }
  set width(v: number) {
    this.w = v;
    this.rec.feed(`${this.tag()} width=${v}`);
    this.reset?.();
  }
  get height(): number {
    return this.hh;
  }
  set height(v: number) {
    this.hh = v;
    this.rec.feed(`${this.tag()} height=${v}`);
    this.reset?.();
  }
  tag(): string {
    return `${this.w}x${this.hh}`;
  }
  getContext(): object {
    if (!this.ctx) this.ctx = recordingContext(this, (r) => (this.reset = r));
    return this.ctx;
  }
}

/** A value as it goes into the hash: exact numbers, gradients and canvases by what they are. */
function show(v: unknown): string {
  if (v instanceof RecordingCanvas) return `canvas ${v.tag()}`;
  if (v && typeof v === 'object') {
    if ('__desc' in v) return String((v as { __desc: string }).__desc);
    if ('data' in v && 'width' in v && 'height' in v) return `image ${String(v.width)}x${String(v.height)}`;
    if (Array.isArray(v)) return `[${v.map(show).join(',')}]`;
    return JSON.stringify(v);
  }
  return String(v);
}

function recordingContext(canvas: RecordingCanvas, onReset: (r: () => void) => void): object {
  const rec = {
    feed: (s: string) => active.feed(s),
    feedPixels: (d: ArrayLike<number>, n: number) => active.feedPixels(d, n),
    pixelsRead: (n: number, read: boolean) => active.pixelsRead(n, read),
    seed: () => active.seed(),
  };
  let m: Matrix = { ...IDENTITY };
  let stack: Matrix[] = [];
  let props: Record<string, unknown> = {};
  onReset(() => {
    m = { ...IDENTITY };
    stack = [];
    props = {};
  });
  const mul = (n: Matrix) => {
    m = {
      a: m.a * n.a + m.c * n.b,
      b: m.b * n.a + m.d * n.b,
      c: m.a * n.c + m.c * n.d,
      d: m.b * n.c + m.d * n.d,
      e: m.a * n.e + m.c * n.f + m.e,
      f: m.b * n.e + m.d * n.f + m.f,
    };
  };
  let gradients = 0;
  const gradient = (kind: string, args: unknown[]) => {
    const desc = `${kind}#${gradients++}(${args.map(show).join(',')})`;
    const g = {
      __desc: desc,
      addColorStop: (o: number, c: string) => rec.feed(`${desc}.stop ${o} ${c}`),
    };
    return g;
  };
  const image = (w: number, h: number, fill: boolean) => {
    const n = Math.max(1, Math.round(w) * Math.round(h));
    const data = new Uint8ClampedArray(n * 4);
    if (fill) {
      // a varied pattern (seeded by everything painted so far): about a third left blank,
      // so the drying passes see both paint and paper
      let s = rec.seed() | 1;
      for (let i = 0; i < data.length; i += 4) {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        const v = s >>> 0;
        data[i] = v & 255;
        data[i + 1] = (v >>> 8) & 255;
        data[i + 2] = (v >>> 16) & 255;
        data[i + 3] = (v >>> 24) % 3 === 0 ? 0 : (v >>> 24) & 255;
      }
    }
    rec.pixelsRead(n, fill);
    return { data, width: Math.round(w), height: Math.round(h) };
  };
  const methods: Record<string, (...a: never[]) => unknown> = {
    save: () => stack.push({ ...m }),
    restore: () => {
      m = stack.pop() ?? m;
    },
    setTransform: (...a: (number | Matrix)[]) => {
      const t = a[0];
      if (typeof t === 'object') m = { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f };
      else {
        const [a1 = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = a as number[];
        m = { a: a1, b, c, d, e, f };
      }
    },
    resetTransform: () => {
      m = { ...IDENTITY };
    },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => mul({ a, b, c, d, e, f }),
    translate: (x: number, y: number) => mul({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }),
    scale: (x: number, y: number) => mul({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }),
    rotate: (r: number) => mul({ a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), e: 0, f: 0 }),
    getTransform: () => matrix(m),
    getImageData: (_x: number, _y: number, w: number, h: number) => image(w, h, true),
    createImageData: (w: number, h: number) => image(w, h, false),
    putImageData: (img: { data: Uint8ClampedArray; width: number; height: number }) => rec.feedPixels(img.data, img.width * img.height),
    createLinearGradient: (...a: number[]) => gradient('linear', a),
    createRadialGradient: (...a: number[]) => gradient('radial', a),
    createPattern: (...a: unknown[]) => ({ __desc: `pattern(${a.map(show).join(',')})` }),
    measureText: (t: string) => ({ width: String(t).length * 6 }),
  };
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === 'canvas') return canvas;
        if (typeof key !== 'string') return undefined;
        if (key in props) return props[key];
        if (key === 'globalAlpha') return 1;
        if (key === 'globalCompositeOperation') return 'source-over';
        if (key === 'filter') return 'none';
        return (...args: unknown[]) => {
          rec.feed(`${canvas.tag()} ${key}(${args.map(show).join(',')})`);
          return methods[key]?.(...(args as never[]));
        };
      },
      set(_t, key, value) {
        props[String(key)] = value;
        rec.feed(`${canvas.tag()} ${String(key)}=${show(value)}`);
        return true;
      },
    },
  );
}
