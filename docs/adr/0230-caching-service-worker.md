# ADR 0230: A caching service worker: versioned precache, network-first page, cache-first assets

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0092 (the worker now caches and has a fetch handler)

## Context
GitHub Pages sends `max-age=600` on every file. Ten minutes after a visit, a return visit
revalidates every file in a chain of about four round trips: roughly 330 ms on slow 4G before the
first paint and 500 ms before the fonts (load report P0b, "GitHub Pages caching"). Every file under
`assets/` has a content hash in its name and never changes. Since ADR 0229 the production build
writes the list of files the garden loads (`self.__PRECACHE__`) and a version that changes with
them (`self.__SW_VERSION__`) into `dist/sw.js`. Nothing in the app is private.

## Decision
- **One cache per version:** `sprout-<version>`. The `sprout-` prefix scopes the cleanup: Pages
  sites of one user share an origin, so caches of other names are never touched.
- **Install:** precache every listed URL into the version's cache.
  - A failed fetch (an error or a non-2xx status) is tried once more.
  - If a file is still missing, the install fails. The browser keeps the current worker (or none)
    and tries again on a later visit. A half-filled precache never activates.
  - The files that did land stay in the cache, so the next try fetches only what is missing.
  - The page (`/Ssprout/`) is fetched with `cache: 'no-cache'`, because its text is part of the
    version. Hashed files may come from the HTTP cache.
  - A redirected response is stored as a plain copy: one with the redirected flag cannot answer
    a navigation.
- **Activate:**
  - Delete every `sprout-*` cache except this version's, the one that was active before it, and
    `sprout-meta`.
  - `sprout-meta` holds one record, `{ version, previous }`, under `/Ssprout/sprout-active-version`.
    Activating the same version again keeps the same `previous`.
  - Then enable navigation preload where supported (`disable` in dev), and `clients.claim()`.
- **Fetch** handles same-origin GET requests inside the base path only.
  - **Navigations** go to the network first, through navigation preload. If the network fails,
    a navigation to the app page (`/Ssprout/` or `/Ssprout/index.html`, any query such as `?dev`)
    gets the cached `/Ssprout/` of this version, else of any version. The page is never served
    from the cache first, so a new deploy's HTML always wins while online. Other navigations in
    scope (`studio.html`) go to the network through the preload and get no fallback.
  - **`/Ssprout/assets/*`** is cache-first across our caches: an older tab's chunk is found in the
    previous version's cache. A miss is fetched, and a `200` same-origin response is stored in
    this version's cache. That covers lazy chunks, the fonts left out of the precache and any file
    loaded through a URL built at runtime.
  - Lookups ignore `Vary`. Pages sends `Vary: Accept-Encoding` and vite preview `Vary: Origin`,
    and a module script request carries an `Origin` the precache request lacked, so a strict
    match missed every script. Each cached URL is one fixed build file, whatever the headers.
  - Everything else is not handled and goes to the network as usual: `sw.js` itself, any other
    file outside `assets/`, cross-origin requests and non-GET requests.
- **Dev (`version 'dev'`):** install and activate cache nothing, and no fetch listener is added,
  so the dev server's modules, `?dev` and live reload behave as if there were no worker.
- **`skipWaiting()` stays,** with `clients.claim()`. A new worker takes over open tabs as soon as
  its precache is complete. This is safe because hashed files never change and the previous
  version's cache survives the activation.
- **The notification handler is unchanged** (ADR 0092).

## The update story
1. A deploy lands. On the next navigation (or the browser's own update check) the browser fetches
   `sw.js` past the HTTP cache, sees new bytes (the version changed) and installs the new worker.
2. It precaches the new build while the old worker keeps serving. Then it activates at once
   (`skipWaiting`), claims the open tabs and deletes caches older than the previous version.
3. **An open tab** keeps running the old JS. Its lazy chunks and fonts are still in the previous
   version's cache, which cache-first lookups search, so they load even though Pages no longer
   serves the old names. A reload gets the new page from the network and new assets from the new
   cache.
4. **A tab left open across two deploys** loses the oldest cache. A file it had not loaded yet
   then misses the cache and gets a 404 from Pages. A `vite:preloadError` reload (P11) covers that.
5. **Offline**, the app page comes from the cache of the active version, and its assets from the
   same cache.

## Consequences
- A return visit costs one network round trip, for the page (navigation preload starts it while
  the worker boots). The scripts, CSS and fonts come from the cache.
- The garden works offline once the worker has installed. The worker is still registered only
  when notifications are granted. Registering it at boot is P11.
- Each deploy downloads the whole precache once (about 620 kB on the wire today), in the
  background after the worker installs.
- The page's HTML could come from a CDN edge that is a few minutes older than `sw.js`. The
  precached page would then belong to the previous build. That is harmless while online (the
  page is network-first and missing assets are fetched and cached) and fixes itself on the next
  deploy.
- Tests: `src/build/sw.test.ts` runs `public/sw.js` in a fake worker scope (listeners in dev and
  live, the routing, install with a retry and a resumed failure, activate's cleanup).
  `tests/e2e/sw-cache.spec.ts` registers the worker on the production build: precache contents,
  a reload through the worker, a runtime-cached miss, an offline reload that renders the garden,
  the cleanup with fake old caches, and a notification click that focuses the garden tab.
