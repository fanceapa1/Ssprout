# 53 — P10: a caching service worker

GitHub Pages sends `max-age=600` on every file, so a return visit after ten minutes revalidates
everything in a chain of about four round trips (load report P0b). P9 wrote the build's file list
and version into `dist/sw.js`. This task makes the worker use them (ADR 0230). Registering the
worker at boot, and the e2e policy that goes with it, is P11.

**What changed** (`public/sw.js`, plain JS, no dependencies):
- **Install** precaches `self.__PRECACHE__` into `sprout-<version>`.
  - Each failed fetch is tried once more. A file still missing fails the install, so a half-filled
    precache never activates, and the next try fetches only what is missing.
  - The page is fetched with `cache: 'no-cache'`, because its text is part of the version.
- **Activate** deletes the `sprout-*` caches except this version and the previous one.
  `sprout-meta` remembers the previous one. Activate then enables navigation preload and claims.
- **Fetch:**
  - App navigations are network-first (navigation preload) with the cached `/Ssprout/` offline.
  - `/Ssprout/assets/*` is cache-first across our caches. A miss is fetched and stored.
  - Everything else is not handled.
- **Version `'dev'`** caches nothing and adds no fetch listener.
- `skipWaiting()` stays: the previous version's cache survives activation, so an open tab keeps
  finding its old chunks.
- The notification handler is unchanged.

**Found on the way:** lookups must ignore `Vary`. vite preview sends `Vary: Origin` and Pages
sends `Vary: Accept-Encoding`. A module script's request carries an `Origin` the precache request
did not, so a strict `caches.match` missed every script, and the offline reload failed.

**Tests:**
- `src/build/sw.test.ts` (5 tests) runs the real `public/sw.js` text in a fake worker scope with
  an in-memory CacheStorage. The live version comes from `injectPrecache`. It covers:
  - dev: no fetch listener and nothing cached;
  - the routing;
  - install: one retry, a failure, then a resume;
  - activate's cleanup, including foreign caches and a repeated activation.
- `tests/e2e/sw-cache.spec.ts` (4 tests) registers `/Ssprout/sw.js` from the page on the
  production build and waits for control:
  - the precache equals the list, a reload goes through the worker, and an uncached font lands in
    the version cache;
  - offline, a reload renders the garden, and an uncached asset really fails;
  - fake `sprout-000…` and `sprout-111…` caches with a meta record: only the older one is deleted;
  - a `notificationclick` dispatched in the worker focuses the garden tab (`focus` is recorded,
    since it needs a real click).
- `widget.spec.ts` and `sw-manifest.spec.ts` still pass.
- TESTING.md rows P10.1–P10.4. P9.1 is now ✔.

**Left open:**
- **P11:** register the worker at boot (after the garden's first paint, so the precache does not
  compete with the first load), `serviceWorkers: 'block'` in the Playwright config with an opt-in
  for `sw-cache.spec.ts` and `widget.spec.ts`, and a `vite:preloadError` reload for a tab open
  across two deploys.
- A slow network that never fails ("lie-fi") holds a navigation until the browser gives up. A
  timeout before the cached fallback could help, at the cost of serving a stale page.
- A CDN edge can serve a page a few minutes older than `sw.js`. The precached page would then be
  the previous build's. That is harmless online and fixed on the next deploy. The worker could
  check that the page's entry script is in the list before it caches the page.
- A real notification click is not automatable headless (P10.4 ◐).
