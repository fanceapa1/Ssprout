# 55 — P11: register the service worker at boot

P10 made `public/sw.js` cache the build, but the app registered it only from the notifications
path, once permission was granted, so most visitors never got it. This task registers it at boot,
sets the e2e policy for workers and reloads a tab whose lazy chunk vanished in a deploy (ADR 0230,
amendment "Registration").

**What changed:**
- **`src/widget/service-worker.ts`** (new):
  - `registerServiceWorker(win)` registers `${BASE_URL}sw.js` with scope `BASE_URL` once per page
    and returns the same promise to every caller. Blocked, unsupported or failed → null.
  - `installServiceWorker({ afterPaint })` registers in production builds after the garden's first
    paint, the `load` event and an idle callback (5 s timeout; 200 ms without
    `requestIdleCallback`). The dev server never registers.
  - `installPreloadRecovery` reloads once on `vite:preloadError` and `preventDefault`s the event.
    sessionStorage `studysprout:preload-reload` holds the build that reloaded (the entry chunk's
    path from `import.meta.url`). The same build failing again surfaces the error, so it cannot
    loop. No sessionStorage, no reload.
- **`notifications.ts`:** `prepare()` uses `registerServiceWorker`, so there is one registration.
- **`src/main.ts`** (shared file, 5 lines): `installServiceWorker({ afterPaint: renderer.whenReady() })`
  after the timer surfaces, and `installServiceWorkerDebug(sw)` under `?dev`.
- **Dev hook:** `sprout.sw.ready()` (`{ scope }` or null, once registration was tried) and
  `sprout.sw.controlled()`.
- **e2e policy:** `serviceWorkers: 'block'` in `playwright.config.ts`. `sw-cache.spec.ts` and
  `widget.spec.ts` opt in with `test.use({ serviceWorkers: 'allow' })`. `sw-manifest.spec.ts` uses
  only the request fixture and needs no opt-in.

**Tests:**
- `src/widget/service-worker.test.ts` (8): one registration shared with the notifications env;
  null when unsupported, insecure, blocked or failing; only after paint, load and idle; nothing
  when disabled; reload once per build, a newer build reloads again, none without sessionStorage.
- `tests/e2e/sw-boot.spec.ts` (2): blocked by default the app boots with `sprout.sw.ready()` null
  and no registration; a dispatched `vite:preloadError` reloads once (the guard holds the hashed
  entry chunk's path) and a second one is not prevented and does not reload.
- `tests/e2e/sw-cache.spec.ts` now waits for the app's own registration. Its first test proves the
  app registers by itself: one registration at `/Ssprout/`, the reloaded page is controlled and
  the page and entry script come `fromServiceWorker()`. The cleanup test seeds its fake caches
  from `sw.js` opened as a page, before the app registers.
- `widget.spec.ts` (notifications through the worker) passes with the opt-in.
- TESTING.md rows P11.1 and P11.2, a convention on the worker policy, `sprout.sw.ready()` in the
  readiness signals.

**Left open:**
- A visitor who granted notifications earlier still registers during boot (the notifier's first
  sync calls `prepare()`), before the garden paints. Deferring that until a notification is due
  would keep the first load clear for everyone.
- No UI says "a new version is ready": a new deploy takes over silently (`skipWaiting`) and the
  next reload shows it.
- The preload recovery is tested with a dispatched event. A real failing lazy chunk can be tested
  once a later task adds one (for example by routing the chunk to a 404 in Playwright).
