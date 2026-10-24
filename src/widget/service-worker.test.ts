import { describe, expect, it, vi } from 'vitest';
import { createBrowserNotificationEnv } from './notifications';
import { installPreloadRecovery, installServiceWorker, PRELOAD_RELOAD_KEY, registerServiceWorker } from './service-worker';

/** A window with just what the module touches; each has its own navigator (its own registration). */
function fakeWindow(opts: { sw?: boolean; secure?: boolean; storage?: boolean; register?: () => Promise<unknown> } = {}) {
  const target = new EventTarget();
  const register = vi.fn(opts.register ?? (() => Promise.resolve({ scope: 'http://x/Ssprout/', active: {} })));
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const win = {
    navigator: opts.sw === false ? {} : { serviceWorker: { register } },
    isSecureContext: opts.secure ?? true,
    document: { readyState: 'complete' },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    get sessionStorage() {
      if (opts.storage === false) throw new Error('blocked');
      return sessionStorage;
    },
  };
  return { win: win as unknown as Window, register, store };
}

const preloadError = () => new Event('vite:preloadError', { cancelable: true });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('registerServiceWorker', () => {
  it('registers sw.js at the base once and shares the registration', async () => {
    const { win, register } = fakeWindow();
    const a = registerServiceWorker(win);
    const b = registerServiceWorker(win);
    expect(a).toBe(b);
    expect(await a).toMatchObject({ scope: 'http://x/Ssprout/' });
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('the notifications env reuses the same registration', async () => {
    const { win, register } = fakeWindow();
    createBrowserNotificationEnv(win).prepare();
    await registerServiceWorker(win);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('resolves null when unsupported, insecure, blocked or failing', async () => {
    expect(await registerServiceWorker(fakeWindow({ sw: false }).win)).toBeNull();
    expect(await registerServiceWorker(fakeWindow({ secure: false }).win)).toBeNull();
    // Playwright's serviceWorkers: 'block' resolves register() with nothing
    expect(await registerServiceWorker(fakeWindow({ register: () => Promise.resolve(undefined) }).win)).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await registerServiceWorker(fakeWindow({ register: () => Promise.reject(new Error('no')) }).win)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('installServiceWorker', () => {
  it('registers only after the first paint and an idle callback', async () => {
    const { win, register } = fakeWindow();
    let paint!: () => void;
    const afterPaint = new Promise<void>((r) => (paint = r));
    const idles: (() => void)[] = [];
    const boot = installServiceWorker({ win, afterPaint, enabled: true, idle: (fn) => idles.push(fn) });
    await flush();
    expect(idles).toHaveLength(0);
    paint();
    await flush();
    expect(register).not.toHaveBeenCalled();
    expect(idles).toHaveLength(1);
    idles[0]!();
    expect(await boot.ready()).toMatchObject({ scope: 'http://x/Ssprout/' });
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('waits for the load event when the page is still loading', async () => {
    const { win, register } = fakeWindow();
    (win.document as { readyState: string }).readyState = 'interactive';
    const boot = installServiceWorker({ win, afterPaint: Promise.resolve(), enabled: true, idle: (fn) => fn() });
    await flush();
    expect(register).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('load'));
    await boot.ready();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled (the dev server), but still recovers from preload errors', async () => {
    const { win, register } = fakeWindow();
    const reload = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const boot = installServiceWorker({ win, afterPaint: Promise.resolve(), enabled: false, idle: (fn) => fn(), recovery: { buildId: 'a', reload } });
    expect(await boot.ready()).toBeNull();
    expect(register).not.toHaveBeenCalled();
    win.dispatchEvent(preloadError());
    expect(reload).toHaveBeenCalledTimes(1);
    boot.dispose();
    warn.mockRestore();
  });
});

describe('installPreloadRecovery', () => {
  it('reloads once per build, then lets the error surface', () => {
    const { win, store } = fakeWindow();
    const reload = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const off = installPreloadRecovery(win, { buildId: '/assets/main-aaa.js', reload });

    const first = preloadError();
    win.dispatchEvent(first);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true); // Vite does not throw
    expect(store.get(PRELOAD_RELOAD_KEY)).toBe('/assets/main-aaa.js');

    // the reload landed on the same build (same sessionStorage): no second reload
    const second = preloadError();
    win.dispatchEvent(second);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
    off();

    // a newer build may reload after its own deploy
    const reloadB = vi.fn();
    installPreloadRecovery(win, { buildId: '/assets/main-bbb.js', reload: reloadB });
    win.dispatchEvent(preloadError());
    expect(reloadB).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('never reloads without sessionStorage (no guard against a loop)', () => {
    const { win } = fakeWindow({ storage: false });
    const reload = vi.fn();
    installPreloadRecovery(win, { buildId: 'a', reload });
    const e = preloadError();
    win.dispatchEvent(e);
    expect(reload).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});
