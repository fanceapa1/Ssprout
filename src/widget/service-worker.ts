/**
 * The app's one service worker registration and its recovery after a deploy (ADR 0230 ›
 * Registration, docs/systems/widget.md › The service worker).
 * - `registerServiceWorker` registers `${BASE_URL}sw.js` (scope `BASE_URL`) once per page. The
 *   notifications env (`prepare()`) and the boot path share it, so the worker is never registered
 *   twice.
 * - `installServiceWorker` (main.ts) registers it in production builds once the garden has
 *   painted, the page has loaded and the browser is idle, so the precache never competes with the
 *   first load. It also installs the preload recovery.
 * - `installPreloadRecovery` reloads the page once when a lazy chunk fails to load
 *   (`vite:preloadError`): after a deploy, Pages no longer serves the old chunk names.
 */

export interface ServiceWorkerOptions {
  /** service worker script URL (default: `${BASE_URL}sw.js`) */
  swUrl?: string;
  /** service worker scope (default: Vite BASE_URL) */
  scope?: string;
}

const baseUrl = (): string => (typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/');

/** one registration per page (keyed by the window's navigator, so test windows stay apart) */
const registrations = new WeakMap<Navigator, Promise<ServiceWorkerRegistration | null>>();

/** Can `win` register a service worker at all (API present, secure context)? */
export function serviceWorkerSupported(win: Window): boolean {
  return 'serviceWorker' in win.navigator && win.isSecureContext;
}

/**
 * Register the app's worker, once per page; later calls return the same promise. Resolves with the
 * registration, or null when service workers are unavailable, registration failed, or it was
 * blocked (Playwright's `serviceWorkers: 'block'` resolves `register()` with nothing).
 */
export function registerServiceWorker(win: Window = window, opts: ServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | null> {
  const nav = win.navigator;
  const known = registrations.get(nav);
  if (known) return known;
  if (!serviceWorkerSupported(win)) return Promise.resolve(null);
  const swUrl = opts.swUrl ?? `${baseUrl()}sw.js`;
  const scope = opts.scope ?? baseUrl();
  const registration = nav.serviceWorker.register(swUrl, { scope }).then(
    (reg) => reg ?? null,
    (err: unknown) => {
      console.warn('[sw] service worker registration failed', err);
      return null;
    },
  );
  registrations.set(nav, registration);
  return registration;
}

/** sessionStorage key: the build that last reloaded after a failed lazy chunk */
export const PRELOAD_RELOAD_KEY = 'studysprout:preload-reload';

/** This build's identity: the URL of the module (in production, the hashed entry chunk). */
const thisBuild = (): string => {
  try {
    return new URL(import.meta.url).pathname;
  } catch {
    return 'unknown';
  }
};

/**
 * Reload once when Vite reports a lazy chunk that failed to load (`vite:preloadError`). The guard
 * remembers which build reloaded: if the reload lands on the same build again (a stale CDN edge,
 * offline, a chunk really missing), the next failure is left to surface instead of looping. A
 * newer build may reload again after its own deploy. Without sessionStorage nothing reloads (no
 * guard, no reload). Returns a function that removes the handler.
 */
export function installPreloadRecovery(
  win: Window = window,
  opts: { buildId?: string; reload?: () => void } = {},
): () => void {
  const buildId = opts.buildId ?? thisBuild();
  const reload = opts.reload ?? (() => win.location.reload());
  const onError = (event: Event): void => {
    try {
      if (win.sessionStorage.getItem(PRELOAD_RELOAD_KEY) === buildId) return;
      win.sessionStorage.setItem(PRELOAD_RELOAD_KEY, buildId);
    } catch {
      return;
    }
    console.warn('[sw] a lazy chunk failed to load; reloading for the new deploy');
    event.preventDefault(); // Vite then does not throw the import error
    reload();
  };
  win.addEventListener('vite:preloadError', onError);
  return () => win.removeEventListener('vite:preloadError', onError);
}

export interface ServiceWorkerBoot {
  /**
   * Resolves once registration has been attempted: the registration, or null (not a production
   * build, unsupported, blocked or failed).
   */
  ready(): Promise<ServiceWorkerRegistration | null>;
  dispose(): void;
}

/** Run `fn` when the browser is idle (bounded wait), or soon where there is no idle callback. */
function whenIdle(win: Window, fn: () => void): void {
  if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(fn, { timeout: 5000 });
  else win.setTimeout(fn, 200);
}

/** The page's `load` event has fired. */
function loaded(win: Window): Promise<void> {
  if (win.document.readyState === 'complete') return Promise.resolve();
  return new Promise((done) => win.addEventListener('load', () => done(), { once: true }));
}

export interface ServiceWorkerBootDeps {
  /** the garden's first paint (`renderer.whenReady()`) */
  afterPaint: Promise<unknown>;
  win?: Window;
  /** register at all (default: production builds; the dev server's worker does nothing anyway) */
  enabled?: boolean;
  /** tests: replace the idle wait */
  idle?: (fn: () => void) => void;
  /** tests: replace the preload recovery's options */
  recovery?: { buildId?: string; reload?: () => void };
}

/** Boot wiring (main.ts): preload recovery now, the worker after paint + load + idle. */
export function installServiceWorker(deps: ServiceWorkerBootDeps): ServiceWorkerBoot {
  const win = deps.win ?? window;
  const removeRecovery = installPreloadRecovery(win, deps.recovery);
  const enabled = deps.enabled ?? import.meta.env.PROD;
  const idle = deps.idle ?? ((fn: () => void) => whenIdle(win, fn));
  const after = (): Promise<void> => loaded(win).then(() => new Promise<void>((done) => idle(done)));
  const registration: Promise<ServiceWorkerRegistration | null> = enabled
    ? deps.afterPaint.then(after, after).then(() => registerServiceWorker(win))
    : Promise.resolve(null);
  return { ready: () => registration, dispose: removeRecovery };
}
