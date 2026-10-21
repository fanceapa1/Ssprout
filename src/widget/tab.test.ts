// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionStatus } from '../core/controller';
import { createTabSurfaces } from './tab';
import { status } from './test-helpers';

function fakeController(initial: SessionStatus) {
  let st = initial;
  const ticks = new Set<(s: SessionStatus) => void>();
  return {
    status: () => st,
    onTick(fn: (s: SessionStatus) => void) {
      ticks.add(fn);
      return () => {
        ticks.delete(fn);
      };
    },
    set(next: Partial<SessionStatus>) {
      st = { ...st, ...next };
    },
    tick() {
      for (const fn of ticks) fn(st);
    },
    listeners: () => ticks.size,
  };
}

function fakeStore() {
  const subs = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    emit() {
      for (const fn of subs) fn();
    },
    listeners: () => subs.size,
  };
}

const ORIGINAL_ICON = 'data:image/svg+xml,original';

describe('createTabSurfaces', () => {
  beforeEach(() => {
    document.head.innerHTML = `<link rel="icon" href="${ORIGINAL_ICON}" />`;
    document.title = 'Study Sprout';
  });
  afterEach(() => {
    document.head.innerHTML = '';
  });

  const icon = () => document.querySelector<HTMLLinkElement>('link[rel~="icon"]')!.getAttribute('href');

  it('counts down in the title and paints the favicon on ticks', () => {
    const controller = fakeController(status({ phase: 'running', remainingMs: 25 * 60_000, progress: 0 }));
    const render = vi.fn((m: unknown) => `icon:${JSON.stringify(m)}`);
    const tab = createTabSurfaces({ controller, store: fakeStore(), renderIcon: render });
    expect(document.title).toBe('25:00 · Study Sprout');
    expect(icon()).toBe('icon:{"kind":"progress","step":0,"paused":false}');

    controller.set({ remainingMs: (24 * 60 + 13) * 1000, progress: 0.5 });
    controller.tick();
    expect(document.title).toBe('24:13 · Study Sprout');
    expect(icon()).toContain('"step":24');
    expect(tab.faviconHref()).toBe(icon());
  });

  it('redraws the icon only when its quantised model changes, and caches icons', () => {
    const controller = fakeController(status({ phase: 'running', remainingMs: 60_000, progress: 0.1 }));
    const render = vi.fn(() => 'x');
    createTabSurfaces({ controller, store: fakeStore(), renderIcon: render });
    controller.set({ progress: 0.1001 });
    controller.tick();
    controller.tick();
    expect(render).toHaveBeenCalledTimes(1);
    controller.set({ phase: 'paused' });
    controller.tick();
    controller.set({ phase: 'running' });
    controller.tick();
    expect(render).toHaveBeenCalledTimes(2); // the running icon came from the cache
  });

  it('shows paused / ready to bloom and restores the plain title and icon when idle', () => {
    const controller = fakeController(status({ phase: 'paused', progress: 0.4 }));
    const store = fakeStore();
    createTabSurfaces({ controller, store, renderIcon: (m) => `icon:${m.kind}` });
    expect(document.title).toBe('Paused · Study Sprout');
    controller.set({ phase: 'reward' });
    store.emit(); // no ticks without a session: store changes drive the update
    expect(document.title).toBe('Ready to bloom · Study Sprout');
    expect(icon()).toBe('icon:complete');
    controller.set({ phase: 'idle' });
    store.emit();
    expect(document.title).toBe('Study Sprout');
    expect(icon()).toBe(ORIGINAL_ICON);
  });

  it('dispose restores the title and icon and unsubscribes', () => {
    const controller = fakeController(status({ phase: 'running', remainingMs: 5000, progress: 0.9 }));
    const store = fakeStore();
    const tab = createTabSurfaces({ controller, store, renderIcon: () => 'painted' });
    expect(icon()).toBe('painted');
    tab.dispose();
    expect(document.title).toBe('Study Sprout');
    expect(icon()).toBe(ORIGINAL_ICON);
    expect(controller.listeners()).toBe(0);
    expect(store.listeners()).toBe(0);
    tab.update(); // no-op after dispose
    expect(document.title).toBe('Study Sprout');
  });

  it('creates an icon link when the page has none, and removes it on dispose', () => {
    document.head.innerHTML = '';
    const controller = fakeController(status({ phase: 'reward' }));
    const tab = createTabSurfaces({ controller, store: fakeStore(), renderIcon: () => 'painted' });
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(icon()).toBe('painted');
    tab.dispose();
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(0);
  });

  it('does not rewrite the title when it is unchanged', () => {
    const controller = fakeController(status({ phase: 'running', remainingMs: 60_000, progress: 0 }));
    createTabSurfaces({ controller, store: fakeStore(), renderIcon: () => 'x' });
    const spy = vi.spyOn(document, 'title', 'set');
    controller.tick();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
