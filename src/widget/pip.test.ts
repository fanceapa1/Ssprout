// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absolutizeCssUrls, mountCard } from './card';
import { createFloatingWidget, isDocumentPipSupported, type WidgetHost } from './pip';
import { fakeBus, fakeController, fakeStore, status } from './test-helpers';
import { widgetView } from './view';

beforeEach(() => {
  // jsdom has no canvas: painting is skipped, the DOM is what we test here
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});
afterEach(() => vi.restoreAllMocks());

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('.ss-actions button')].map((b) => b.dataset.action);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('mountCard', () => {
  it('shows task, time, state line and the actions, and reports clicks', () => {
    const onAction = vi.fn();
    const card = mountCard(window, { onAction });
    card.update(widgetView(status('focus', { blockRemainingMs: (24 * 60 + 13) * 1000, totalRemainingMs: 3_000_000 })));
    expect($('.ss-task')!.textContent).toBe('Biology ch. 4');
    expect($('.ss-time')!.textContent).toBe('24:13');
    expect($('.ss-state')!.textContent).toBe('focus 1 of 2 · 50:00 in all');
    expect($('.ss-card')!.dataset.mode).toBe('focus');
    expect(buttons()).toEqual(['pause']);
    $('.ss-actions button')!.click();
    expect(onAction).toHaveBeenCalledWith('pause');
    expect(document.title).toBe('Study Sprout');
    expect(document.querySelector('style[data-sprout="widget"]')).not.toBeNull();
  });

  it('marks the primary action and swaps buttons by mode', () => {
    const card = mountCard(window, { onAction: () => {} });
    card.update(widgetView(status('break', { block: { kind: 'break', minutes: 10 } })));
    expect(buttons()).toEqual(['water', 'skip', 'pause']);
    expect($('button[data-action="water"]')!.hasAttribute('data-primary')).toBe(true);
    card.update(widgetView(status('paused')));
    expect(buttons()).toEqual(['resume']);
  });

  it('plays a watering animation once at a time and cleans up on destroy', () => {
    const card = mountCard(window, { onAction: () => {} });
    card.update(widgetView(status('break')));
    expect(card.watering()).toBeNull();
    card.water();
    expect(card.watering()).toBe(0);
    card.destroy();
    expect($('.ss-card')).toBeNull();
    expect(document.querySelector('style[data-sprout="widget"]')).toBeNull();
  });

  it('skips the watering animation with reduced motion', () => {
    const card = mountCard(window, { onAction: () => {}, reducedMotion: true });
    card.update(widgetView(status('break')));
    card.water();
    expect(card.watering()).toBeNull();
  });
});

describe('absolutizeCssUrls', () => {
  it('resolves relative font urls against the stylesheet', () => {
    const css = `@font-face { src: url(./files/a.woff2) format("woff2"), url('b.woff') format("woff"); }`;
    expect(absolutizeCssUrls(css, 'https://x.test/Ssprout/assets/index.css')).toBe(
      `@font-face { src: url(https://x.test/Ssprout/assets/files/a.woff2) format("woff2"), url('https://x.test/Ssprout/assets/b.woff') format("woff"); }`,
    );
  });

  it('keeps absolute and data urls', () => {
    const css = 'src: url("data:font/woff2;base64,AA"), url(https://cdn.test/f.woff2)';
    expect(absolutizeCssUrls(css, 'https://x.test/')).toBe(css);
  });
});

describe('createFloatingWidget', () => {
  function setup(opts: { supported?: boolean } = {}) {
    const controller = fakeController(status('focus', { blockRemainingMs: 25 * 60_000 }, { speciesId: 'japanese-iris' }));
    const store = fakeStore();
    const bus = fakeBus();
    const closes = vi.fn();
    const openHost = vi.fn(async (): Promise<WidgetHost> => ({ window, close: closes }));
    const focusApp = vi.fn();
    const widget = createFloatingWidget({
      controller,
      store,
      bus,
      win: window,
      openHost,
      supported: opts.supported,
      focusApp,
      speciesName: (id) => (id === 'japanese-iris' ? 'Japanese Iris' : undefined),
    });
    return { controller, store, bus, widget, openHost, closes, focusApp };
  }

  it('detects Document Picture-in-Picture support', () => {
    expect(isDocumentPipSupported(window)).toBe(false);
    const fake = { documentPictureInPicture: { requestWindow: async () => window, window: null } } as unknown as Window;
    expect(isDocumentPipSupported(fake)).toBe(true);
    const unsupported = createFloatingWidget({ controller: fakeController(), store: fakeStore(), bus: fakeBus(), win: window });
    expect(unsupported.supported).toBe(false);
    unsupported.open();
    expect(unsupported.isOpen()).toBe(false);
  });

  it('opens the card with a window of the card size, notifies, and is reopen-safe', async () => {
    const { widget, openHost } = setup();
    const changes: boolean[] = [];
    widget.onChange((o) => changes.push(o));
    expect(widget.supported).toBe(true);
    widget.open();
    widget.open(); // a second click while opening does not open twice
    expect(openHost).toHaveBeenCalledTimes(1);
    expect(openHost).toHaveBeenCalledWith({ width: 260, height: 340 });
    await flush();
    expect(widget.isOpen()).toBe(true);
    expect($('.ss-time')!.textContent).toBe('25:00');
    // the user closes the PiP window
    window.dispatchEvent(new Event('pagehide'));
    expect(widget.isOpen()).toBe(false);
    expect($('.ss-card')).toBeNull();
    widget.open();
    await flush();
    expect(widget.isOpen()).toBe(true);
    expect(changes).toEqual([true, false, true]);
  });

  it('updates every tick and drives the controller from its buttons', async () => {
    const { widget, controller } = setup();
    widget.open();
    await flush();
    controller.set(status('focus', { blockRemainingMs: (24 * 60 + 59) * 1000 }));
    controller.tick();
    expect($('.ss-time')!.textContent).toBe('24:59');
    $('button[data-action="pause"]')!.click();
    expect(controller.calls).toContain('pause');

    controller.set(status('break', { block: { kind: 'break', minutes: 10 } }, { speciesId: 'japanese-iris' }));
    controller.tick();
    expect($('.ss-state')!.textContent).toContain('your Japanese Iris is thirsty');
    $('button[data-action="water"]')!.click();
    expect(controller.calls).toContain('water');
    expect(widget.card()!.watering()).toBe(0);
    $('button[data-action="skip"]')!.click();
    expect(controller.calls).toContain('skipBreak');
  });

  it('with other sessions in progress the card offers Switch, which makes the next one active', async () => {
    const { widget, controller, bus } = setup();
    widget.open();
    await flush();
    expect($('button[data-action="switch"]')).toBeNull();
    const sessions = [
      { session: { id: 'session-test', taskName: 'Biology ch. 4' }, active: true },
      { session: { id: 'other', taskName: 'Essay' }, active: false, lastLeft: true },
    ];
    controller.set({ ...status('focus', {}, { speciesId: 'japanese-iris' }), sessions });
    controller.tick();
    $('button[data-action="switch"]')!.click();
    expect(controller.calls).toContain('switchTo:other');
    // the card follows the new active session; a bloom shown before is dropped on a switch
    controller.set(status());
    bus.emit('session:complete', { sessionId: 'session-test' });
    expect(widget.view().mode).toBe('complete');
    bus.emit('session:switch', { from: null, to: 'other', at: 0 });
    expect(widget.view().mode).toBe('idle');
  });

  it('a water event from the garden plays the animation in the widget too', async () => {
    const { widget, bus } = setup();
    widget.open();
    await flush();
    bus.emit('session:water', { sessionId: 'session-test' });
    expect(widget.card()!.watering()).toBe(0);
  });

  it('blooms on completion and "Open garden" focuses the app and closes the widget', async () => {
    const { widget, controller, bus, closes, focusApp } = setup();
    widget.open();
    await flush();
    controller.set(status());
    bus.emit('session:complete', { sessionId: 'session-test' });
    expect($('.ss-card')!.dataset.mode).toBe('complete');
    expect($('.ss-state')!.textContent).toBe('Your Japanese Iris has bloomed — return to your garden');
    $('button[data-action="open"]')!.click();
    expect(focusApp).toHaveBeenCalled();
    expect(closes).toHaveBeenCalled();
    expect(widget.isOpen()).toBe(false);
    expect(widget.view().mode).toBe('idle');
  });

  it('shows "No session running" when idle', async () => {
    const { widget, controller, store } = setup();
    controller.set(status());
    widget.open();
    await flush();
    store.emit();
    expect($('.ss-state')!.textContent).toBe('No session running');
    expect(buttons()).toEqual(['open']);
  });

  it('a failed open (no user gesture) leaves it closed and retryable', async () => {
    const { widget, openHost } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    openHost.mockRejectedValueOnce(new DOMException('needs a user gesture', 'NotAllowedError'));
    widget.open();
    await flush();
    expect(widget.isOpen()).toBe(false);
    expect(warn).toHaveBeenCalled();
    widget.open();
    await flush();
    expect(widget.isOpen()).toBe(true);
  });

  it('dispose closes the window and stops listening', async () => {
    const { widget, bus, closes } = setup();
    widget.open();
    await flush();
    widget.dispose();
    expect(closes).toHaveBeenCalled();
    expect(widget.isOpen()).toBe(false);
    expect(bus.count()).toBe(0);
    widget.open();
    await flush();
    expect(widget.isOpen()).toBe(false);
  });
});
