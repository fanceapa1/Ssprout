# ADR 0229: A precache manifest and version written into sw.js at build time

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0092 (the service worker stays notifications-only for now, but the build now writes into it)

## Context
GitHub Pages sends `cache-control: max-age=600` on every file, hashed assets included, and custom
headers are not possible (ADR 0014). Ten minutes after a visit every request becomes a conditional
GET that returns 304. The 304s run as a chain of four round trips: HTML, then JS and CSS, then two
waves of fonts (load report P0b, "GitHub Pages caching"). Hashed files never change, but only a
service worker can tell the browser so. `public/sw.js` handles notification clicks only and is
copied to `dist/sw.js` as it is (ADR 0092). A caching worker (P10) first needs to know which files
the garden loads and a version that changes when they do. Both are known only after the bundle is
written.

## Decision
- **Two placeholder lines in `public/sw.js`:** `self.__SW_VERSION__ = 'dev';` and
  `self.__PRECACHE__ = [];`. The dev server serves them unchanged: an empty list and version
  `'dev'`. Nothing reads them yet (P10 will).
- **A small Vite plugin** in `vite.config.ts` (`sprout:sw-manifest`, `apply: 'build'`) runs in
  `writeBundle`. By then Vite has copied `public/` into `dist/`. The plugin describes the bundle
  (`describeBundle`), builds the manifest (`buildPrecacheManifest`) and replaces the two lines in
  `dist/sw.js` (`injectPrecache`). A missing placeholder fails the build.
- **A pure builder** in `src/build/sw-manifest.ts`: a list of `{ fileName, size, text?, links? }`
  goes in, and `{ urls, version, bytes }` comes out. Like `src/paint/paint-version.ts` it is
  build-time only, and app code never imports it.
- **What is listed:** every file reachable from `index.html`. A file reaches what the bundler says
  it loads (imports, dynamic imports, `importedCss`, `importedAssets`) and every bundle file whose
  name appears in its HTML, JS or CSS text. The text scan finds modulepreloads, the sprite worker's
  `new URL(…)`, `url()` in CSS and the preload helper's dependency lists. `studio.html` is never a
  root, so the studio chunk and CSS stay out, while the shared chunk is listed. Today the list is
  18 URLs, about 1.28 MB raw (about 620 kB on the wire):
  - the HTML;
  - the `main` and `sky-light` JS and CSS;
  - the sprite worker;
  - 12 woff2 fonts.
- **What is left out:** sourcemaps, `.woff` fallbacks, `sw.js` itself, anything named `studio*`,
  and woff2 fonts outside the `latin` and `latin-ext` subsets (cyrillic, vietnamese). A left-out
  file is not followed further.
- **Fonts:** every `latin` and `latin-ext` woff2 that the CSS references, all weights. The first
  view uses 5 of the 12, but which ones depends on runtime CSS, not the bundle. A rule on the subset
  in the file name is simple and does not go stale. The other 7 cost about 165 kB once per deploy,
  and font file names rarely change.
- **URLs** carry the base (`/Ssprout/`). The entry HTML is listed as the base itself (`/Ssprout/`),
  the URL a visitor navigates to, not `/Ssprout/index.html`. The HTML comes first, then the rest
  sorted.
- **Version:** the first 12 hex digits of a SHA-256 over the sorted URL list and the entry HTML's
  text. Every other listed file has a content hash in its name, so the version changes exactly when
  a listed name changes or the HTML does. Sizes, bundle order and files that are not listed do not
  change it. A new version changes the bytes of `sw.js`, which is what makes the browser install
  the new worker.

## Consequences
- P10 adds `install` (precache `self.__PRECACHE__` into a cache named after `self.__SW_VERSION__`),
  `activate` and `fetch` to `public/sw.js`. Its fetch handler must do nothing while the version is
  `'dev'`.
- A new entry point, worker or lazy chunk is listed with no edit here, as long as `index.html`
  reaches it. A file loaded only through a URL built at runtime (a string the bundle never
  contains) would be missed. P10's cache-first rule for `/assets/*` covers such a file on first use.
- The plugin sits in `vite.config.ts` next to the `__PAINT_VERSION__` define (ADR 0227). Neither
  touches the worker bundle's own plugin list.
- Tests: `src/build/sw-manifest.test.ts` (the builder on a fake bundle) and
  `tests/e2e/sw-manifest.spec.ts` (the served `sw.js` against the served `index.html`, and every
  listed URL returns 200).
