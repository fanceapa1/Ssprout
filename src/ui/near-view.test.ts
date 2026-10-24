// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNearView } from './near-view';

/** Hand-driven frames, idle periods and intersection reports. */
let frames: Array<() => void> = [];
let idles: Array<(d: IdleDeadline) => void> = [];
let observers: FakeIO[] = [];

class FakeIO {
  targets = new Set<Element>();
  constructor(private cb: (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void) {
    observers.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  disconnect() {
    this.targets.clear();
  }
  report(el: Element, isIntersecting: boolean) {
    if (this.targets.has(el)) this.cb([{ target: el, isIntersecting }]);
  }
}

const frame = () => {
  const run = frames;
  frames = [];
  for (const f of run) f();
};
const idle = (timeRemaining = 50) => {
  const run = idles;
  idles = [];
  for (const f of run) f({ didTimeout: false, timeRemaining: () => timeRemaining });
};
const report = (el: Element, on: boolean) => {
  for (const o of observers) o.report(el, on);
};
/** the garden painted: its promise settles, a frame shows it, then the dock may draw */
async function gardenPainted(resolve: () => void): Promise<void> {
  resolve();
  await Promise.resolve();
  await Promise.resolve();
  frame();
  vi.advanceTimersByTime(1);
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  idles = [];
  observers = [];
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('requestIdleCallback', (f: (d: IdleDeadline) => void) => idles.push(f));
  vi.stubGlobal('cancelIdleCallback', () => {});
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('near view (ADR 0225)', () => {
  it('runs nothing before the garden has painted, then what is near the window first, the rest when idle', async () => {
    let resolve!: () => void;
    const near = createNearView({ ready: new Promise<void>((r) => (resolve = r)) });
    const a = document.createElement('section');
    const b = document.createElement('section');
    const ran: string[] = [];
    near.request(a, () => ran.push('a'));
    near.request(b, () => ran.push('b'));
    frame();
    idle();
    expect(ran).toEqual([]);
    expect(near.near(a)).toBe(false);
    // nothing is even observed before then (observing can cost a layout pass)
    expect(observers.every((o) => o.targets.size === 0)).toBe(true);

    await gardenPainted(resolve);
    report(a, true);
    report(b, false);
    expect(ran).toEqual(['a']);
    expect(near.near(a)).toBe(true);
    idle();
    expect(ran).toEqual(['a', 'b']);
    expect(near.pending()).toBe(0);
  });

  it('never runs a task inside the request: a near one waits for the next frame', () => {
    const near = createNearView({ ready: null });
    const el = document.createElement('div');
    const ran: number[] = [];
    near.request(el, () => ran.push(1));
    report(el, true);
    expect(ran).toEqual([1]); // the observer's report runs it
    near.request(el, () => ran.push(2));
    expect(ran).toEqual([1]);
    frame();
    expect(ran).toEqual([1, 2]);
  });

  it('a far repaint without idle waits until the element nears the window; requests coalesce', () => {
    const near = createNearView({ ready: null });
    const el = document.createElement('div');
    const ran: number[] = [];
    near.request(el, () => ran.push(1), { idle: false });
    report(el, false);
    near.request(el, () => ran.push(2), { idle: false });
    frame();
    idle();
    vi.advanceTimersByTime(5000);
    expect(ran).toEqual([]);
    report(el, true);
    expect(ran).toEqual([2]);
  });

  it('keeps idle once any request asked for it', () => {
    const near = createNearView({ ready: null });
    const el = document.createElement('div');
    const ran: number[] = [];
    near.request(el, () => ran.push(1), { idle: true });
    report(el, false);
    near.request(el, () => ran.push(2), { idle: false });
    idle();
    expect(ran).toEqual([2]);
  });

  it('an idle period runs at least one task, and more only while it has room', async () => {
    const near = createNearView({ ready: null });
    const els = [0, 1, 2].map(() => document.createElement('div'));
    const ran: number[] = [];
    els.forEach((el, i) => {
      near.request(el, () => ran.push(i));
      report(el, false);
    });
    idle(2);
    expect(ran).toEqual([0]);
    idle(50);
    expect(ran).toEqual([0, 1, 2]);
  });

  it('flush runs everything now, even before the garden has painted', () => {
    const near = createNearView({ ready: new Promise<void>(() => {}) });
    const el = document.createElement('div');
    let n = 0;
    near.request(el, () => n++);
    near.flush();
    expect(n).toBe(1);
    expect(near.pending()).toBe(0);
  });

  it('a hidden tab gets no frames: the dock opens on a timer after the garden', async () => {
    let resolve!: () => void;
    const near = createNearView({ ready: new Promise<void>((r) => (resolve = r)) });
    let opened = false;
    void near.opened().then(() => (opened = true));
    resolve();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(600);
    await Promise.resolve();
    expect(opened).toBe(true);
  });
});
