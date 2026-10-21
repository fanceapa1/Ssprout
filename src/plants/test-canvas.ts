/**
 * Test-only fake canvases for the plant modules (node has no canvas). A context records every
 * call by name, keeps a current transform for `getTransform`, and returns empty pixels.
 */
export interface FakeContext {
  calls: Array<{ name: string; args: unknown[] }>;
  count(name: string): number;
  canvas: FakeCanvas;
  [key: string]: unknown;
}

export class FakeCanvas {
  width: number;
  height: number;
  readonly ctx: FakeContext;
  constructor(w = 1, h = 1) {
    this.width = w;
    this.height = h;
    this.ctx = fakeContext(this);
  }
  getContext(): FakeContext {
    return this.ctx;
  }
  transferToImageBitmap(): object {
    return { width: this.width, height: this.height };
  }
}

export function fakeContext(canvas: FakeCanvas): FakeContext {
  const calls: FakeContext['calls'] = [];
  const props: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none' };
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: Array<typeof m> = [];
  const mul = (n: typeof m) => {
    m = {
      a: m.a * n.a + m.c * n.b,
      b: m.b * n.a + m.d * n.b,
      c: m.a * n.c + m.c * n.d,
      d: m.b * n.c + m.d * n.d,
      e: m.a * n.e + m.c * n.f + m.e,
      f: m.b * n.e + m.d * n.f + m.f,
    };
  };
  const methods: Record<string, (...a: number[]) => unknown> = {
    save: () => stack.push({ ...m }),
    restore: () => {
      m = stack.pop() ?? m;
    },
    setTransform: (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) => {
      m = { a, b, c, d, e, f };
    },
    transform: (a, b, c, d, e, f) => mul({ a: a!, b: b!, c: c!, d: d!, e: e!, f: f! }),
    translate: (x, y) => mul({ a: 1, b: 0, c: 0, d: 1, e: x!, f: y! }),
    scale: (x, y) => mul({ a: x!, b: 0, c: 0, d: y!, e: 0, f: 0 }),
    rotate: (r) => mul({ a: Math.cos(r!), b: Math.sin(r!), c: -Math.sin(r!), d: Math.cos(r!), e: 0, f: 0 }),
    getTransform: () => ({ ...m }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w! * h! * 4)), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
  };
  const target = {
    calls,
    canvas,
    count: (name: string) => calls.filter((c) => c.name === name).length,
  };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return (t as Record<string | symbol, unknown>)[key];
      if (typeof key !== 'string') return undefined;
      if (key in props) return props[key];
      return (...args: unknown[]) => {
        calls.push({ name: key, args });
        return methods[key]?.(...(args as number[]));
      };
    },
    set(_t, key, value) {
      props[String(key)] = value;
      return true;
    },
  }) as unknown as FakeContext;
}

/** Install `OffscreenCanvas` = FakeCanvas for the duration of a test file; returns an undo. */
export function installFakeOffscreenCanvas(): () => void {
  const g = globalThis as { OffscreenCanvas?: unknown };
  const prev = g.OffscreenCanvas;
  g.OffscreenCanvas = FakeCanvas;
  return () => {
    g.OffscreenCanvas = prev;
  };
}
