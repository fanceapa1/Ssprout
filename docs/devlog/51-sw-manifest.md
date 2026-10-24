# 51 — P9: a precache manifest in the service worker

The P0b load report found that GitHub Pages sends `max-age=600` on every file. Ten minutes after a
visit, every request is revalidated in a chain of four round trips, and only a caching service
worker can fix that on Pages. This task gives the worker what it needs to cache: the list of files
the garden loads and a version that changes with them. Caching itself is P10.

**What changed** (ADR 0229):
- `public/sw.js` has two placeholder lines, `self.__SW_VERSION__ = 'dev';` and
  `self.__PRECACHE__ = [];`. Nothing else in it changed, and nothing reads them yet.
- `src/build/sw-manifest.ts` is new: a pure builder, build-time only, like `paint-version.ts`.
  - `describeBundle(bundle)` turns Vite's output bundle into `{ fileName, size, text?, links? }`.
  - `buildPrecacheManifest(files, { base })` walks from `index.html` and returns
    `{ urls, version, bytes }`. A file reaches what the bundler links and every bundle file
    named in its HTML, JS or CSS text.
  - `injectPrecache(sw, manifest)` replaces the placeholders and throws if one is missing.
- `vite.config.ts` has a `swManifest()` plugin (`apply: 'build'`, `writeBundle`) that rewrites
  `dist/sw.js`. Vite copies `public/` in `renderStart`, so the file is there by then. The
  `__PAINT_VERSION__` define is unchanged.
- `docs/ARCHITECTURE.md` has a `src/build/` entry and the service worker's build contract under
  Timer surfaces.

**Decisions:**
- **Fonts:** every `latin` and `latin-ext` woff2 the CSS references, all weights. That is 12 files,
  of which the first view uses 5. Which weights are used is decided by runtime CSS, so a
  subset rule on the file name does not go stale. The extra 7 cost about 165 kB once per deploy.
- **The HTML** is listed as `/Ssprout/`, the URL a visitor navigates to, not as `index.html`.
- **The version** hashes the URL list and the HTML text. Every other listed name already carries a
  content hash.

**The current build** (`main` at 32a3a3a plus this branch): 18 URLs, 1,280,466 bytes raw, about
619 kB on the wire (gzip for text, woff2 as is). They are the HTML, `main` and `sky-light` JS and
CSS, `sprite-worker`, 10 Cormorant Garamond woff2 (latin and latin-ext, 400/500/600 and
400/500 italic) and 2 Shippori Mincho woff2 (latin 400/500). There are no lazy chunks yet, and the
walk would list them when they appear.

**Tests:**
- `src/build/sw-manifest.test.ts` (19 tests) runs the builder on a fake bundle. It covers:
  - what is listed: the entry, shared, lazy and worker chunks, CSS and latin and latin-ext woff2;
  - what is left out: studio, maps, `.woff`, cyrillic and vietnamese, `sw.js`;
  - the base;
  - the version: changes on a rename and on the HTML, holds on sizes, order and a left-out rename;
  - `injectPrecache` and `describeBundle`.
- `tests/e2e/sw-manifest.spec.ts` uses HTTP only, with no page. It checks the served `sw.js`
  against the served `index.html` (entry script and every `<link>`), the worker, CSS and a latin
  woff2, that nothing excluded is listed, and that every URL returns 200.
- Row P9.1 in docs/TESTING.md.

**Left open:**
- **P10:** `install`, `activate` and `fetch` in `public/sw.js`, and registering the worker at boot.
  Today it is registered only once notification permission is granted. P10 also covers
  `serviceWorkers: 'block'` in the Playwright config with an opt-in in `widget.spec.ts`, and a
  `vite:preloadError` reload once lazy chunks exist (load report, "Service worker options").
- **Smaller precache:** the 7 font files the first view does not use could be left out with a
  weight rule (500 and 500 italic only), if the 165 kB matters.
- A file the app loads through a URL built at runtime, a name the bundle never contains, would
  not be listed. There is none today. P10's cache-first rule for `/assets/*` would catch it on
  first use.
