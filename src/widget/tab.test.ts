// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabSurfaces, type TabSurfacesDeps } from './tab';
import { fakeBus, fakeController, fakeStore, status } from './test-helpers';

const ORIGINAL_ICON = 'data:image/svg+xml,original';

function setup(initial = status(), patch: Partial<TabSurfacesDeps> = {}) {
  const controller = fakeController(initial);
  const store = fakeStore();
  const bus = fakeBus();
  let attended = false;
  const render = vi.fn((m: unknown) => `icon:${JSON.stringify(m)}`);
  const tab = createTabSurfaces({ controller, store, bus, attended: () => attended, renderIcon: render, ...patch });
  return { controller, store, bus, tab, render, setAttended: (v: boolean) => (attended = v) };
}

describe('createTabSurfaces', () => {
  beforeEach(() => {
    document.head.innerHTML = `<link rel="icon" href="${ORIGINAL_ICON}" />`;
    document.title = 'Study Sprout';
  });
  afterEach(() => {
    document.head.innerHTML = '';
  });

  const icon = () => document.querySelector<HTMLLinkElement>('link[rel~="icon"]')!.getAttribute('href');

  it('counts down the focus block in the title and paints the favicon on ticks', () => {
    const { controller, tab } = setup(status('focus', { blockRemainingMs: 25 * 60_000 }));
    expect(document.title).toBe('25:00 · Study Sprout');
    expect(icon()).toBe('icon:{"kind":"progress","step":0,"tone":"focus"}');

    controller.set(status('focus', { blockRemainingMs: (24 * 60 + 13) * 1000, progress: 0.5 }));
    controller.tick();
    expect(document.title).toBe('24:13 · Study Sprout');
    expect(icon()).toContain('"step":24');
    expect(tab.faviconHref()).toBe(icon());
  });

  it('shows breaks and pauses', () => {
    const { controller } = setup(status('break', { blockRemainingMs: (4 * 60 + 12) * 1000, progress: 0.4 }));
    expect(document.title).toBe('Break 4:12 · Study Sprout');
    expect(icon()).toContain('"tone":"break"');
    controller.set(status('paused', { progress: 0.4 }));
    controller.tick();
    expect(document.title).toBe('Paused · Study Sprout');
    expect(icon()).toContain('"tone":"paused"');
  });

  it('redraws the icon only when its quantised model changes, and caches icons', () => {
    const { controller, render } = setup(status('focus', { progress: 0.1 }));
    controller.set(status('focus', { progress: 0.1001 }));
    controller.tick();
    controller.tick();
    expect(render).toHaveBeenCalledTimes(1);
    controller.set(status('paused', { progress: 0.1 }));
    controller.tick();
    controller.set(status('focus', { progress: 0.1 }));
    controller.tick();
    expect(render).toHaveBeenCalledTimes(2); // the focus icon came from the cache
  });

  it('an unseen completion leaves "Bloomed" and the vermilion icon until the user returns', () => {
    const { controller, bus, tab, setAttended } = setup(status('focus', { progress: 0.99 }));
    controller.set(status());
    bus.emit('session:complete', { sessionId: 'session-test' });
    expect(tab.bloomed()).toBe(true);
    expect(document.title).toBe('Bloomed · Study Sprout');
    expect(icon()).toBe('icon:{"kind":"complete"}');
    setAttended(true);
    window.dispatchEvent(new Event('focus'));
    expect(tab.bloomed()).toBe(false);
    expect(document.title).toBe('Study Sprout');
    expect(icon()).toBe(ORIGINAL_ICON);
  });

  it('a completion seen in the page goes straight back to the plain title', () => {
    const { controller, bus, setAttended } = setup(status('focus'));
    setAttended(true);
    controller.set(status());
    bus.emit('session:complete', {});
    expect(document.title).toBe('Study Sprout');
  });

  it('a new session clears an unseen bloom', () => {
    const { controller, bus, tab } = setup(status('focus'));
    controller.set(status());
    bus.emit('session:complete', {});
    controller.set(status('focus', { blockRemainingMs: 60_000 }));
    bus.emit('session:start', {});
    expect(tab.bloomed()).toBe(false);
    expect(document.title).toBe('1:00 · Study Sprout');
  });

  it('store changes drive updates when there are no ticks', () => {
    const { controller, store } = setup(status('paused'));
    controller.set(status());
    store.emit();
    expect(document.title).toBe('Study Sprout');
    expect(icon()).toBe(ORIGINAL_ICON);
  });

  it('dispose restores the title and icon and unsubscribes', () => {
    const { controller, store, bus, tab } = setup(status('focus', { blockRemainingMs: 5000, progress: 0.9 }));
    expect(icon()).not.toBe(ORIGINAL_ICON);
    tab.dispose();
    expect(document.title).toBe('Study Sprout');
    expect(icon()).toBe(ORIGINAL_ICON);
    expect(controller.listeners()).toBe(0);
    expect(store.listeners()).toBe(0);
    expect(bus.count()).toBe(0);
    tab.update(); // no-op after dispose
    expect(document.title).toBe('Study Sprout');
  });

  it('creates an icon link when the page has none, and removes it on dispose', () => {
    document.head.innerHTML = '';
    const { tab } = setup(status('focus', { progress: 0.5 }));
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    tab.dispose();
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(0);
  });

  it('does not rewrite the title when it is unchanged', () => {
    const { controller } = setup(status('focus', { blockRemainingMs: 60_000 }));
    const spy = vi.spyOn(document, 'title', 'set');
    controller.tick();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
