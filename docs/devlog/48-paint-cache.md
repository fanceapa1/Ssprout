# 48 — P7: a persistent paint cache

The P0b load report ("[High] 2", task T5) found that every load paints the landscape again: about
1 s of main-thread CPU, deterministic, and DOM-free. Stored as a PNG it would decode in about 42 ms.
This task builds the store that P8 (the scene) and P18 (the sky and light plates) will use. Nothing
in the app reads from or writes to it yet.

**What changed** (ADR 0227):
- `src/paint/persist.ts`:
  - `paintCache()` is the app's cache. `createPaintCache({ adapter, version?, maxBytes?, encode?, decode?, copy?, idle? })`
    builds others, and `createNullPaintCache(off)` builds one that stores nothing. API: `get(kind, key)` →
    `ImageBitmap | null`, `put(kind, key, canvas, { copy? })` → `Promise<boolean>`, `clear()`,
    `stats()`, `settle()`, `version`.
  - PNG Blobs live in IndexedDB `studysprout-paint` (object stores `meta` and `blobs`, written in
    one transaction) under `version:kind:key`.
  - `put` copies the canvas at once, then encodes it in `requestIdleCallback`, one put at a time.
    Of several queued puts of one entry only the latest is encoded. `get` decodes with no colour
    conversion and no premultiplication.
  - Least recently used entries are evicted under 48 MB, using a recency counter rather than the
    clock. Entries of other versions are dropped on open.
  - The cache is the null cache on the dev server, with `?nopaintcache`, without IndexedDB, or when
    the store fails to open. Errors are swallowed and counted in `stats()`, and nothing is logged.
- `src/paint/paint-version.ts` runs at build time only. `computePaintVersion(root)` hashes, with
  SHA-256 cut to 12 hex digits, the path and bytes of every file in the import closure of
  `src/paint`, `scene`, `ambience`, `plants`, `fauna`, `render` and `core`, leaving out tests and
  studio entries. That is 153 files today, including `src/dev/debug.ts` and
  `src/dev/fixture-species.ts`, which the roots import. The closure follows static, dynamic and
  side-effect imports, worker URLs and globs without wildcards. A new import from a painter is
  therefore covered without anyone editing a list.
- `vite.config.ts` is now a function config. `define.__PAINT_VERSION__` is the hash for
  `vite build` and `'dev'` for the dev server and Vitest, so the cache is off where sources change
  without a rebuild (shots paint live). The cache's version adds a short user-agent hash, because a
  browser update can change rasterisation. `tsconfig.json` gained `allowImportingTsExtensions`, so the
  config can import the helper as `.ts`. Without it Vite warns about its future native config loader.
- `src/paint/debug.ts` adds `sprout.paintCache` (the app's cache, plus `open({ version, maxBytes })`).
  **`src/main.ts`:** two lines, the import and `installPaintCacheDebug()` in the dev block.

**Exactness.** In Chromium (Playwright, production build) these paintings come back pixel for pixel
through `put` (copy, idle PNG encode, IndexedDB), a reload, `get` and `drawImage` (`copy`), with
`getImageData` identical to a fresh build of the painting and 0 differing pixels:
- an opaque watercolour-like frame (640×400: noise plus translucent multiplied washes);
- a 256×256 canvas holding every alpha value 0–255 and random RGBA.

An exploratory check found that the default `createImageBitmap` options, `premultiplyAlpha:
'premultiply'` and a DOM canvas's `toBlob` are exact too. `none`/`none` stays as the guard against
colour-managed displays. **No constraint for P8:** opaque and alpha paintings both survive.

**Tests:**
- `paint/persist.test.ts` (24): keys, the cache version, persistence across instances, the drop
  of other versions, LRU (recency surviving a reload, a smaller cap on open), a painting over the
  cap skipped, replaced entries counted once, the 48 MB default, the copy at put, encoding only in
  idle time, serial puts with only the latest per entry encoded, `settle`. Failures: the open, the
  listing, a quota write, encode, copy, read, decode, touch and remove. Also `clear` across
  versions, the null cache, and the app's cache being off under Vitest.
- `paint/paint-version.test.ts` (5): import forms, the closure on a temp tree, which changes do and
  do not change the version, a new file, and the real project's set.
- `tests/e2e/paint-cache.spec.ts` (3): the bit-exact round trip across a reload; `?nopaintcache`;
  version drop and LRU eviction against real IndexedDB.

TESTING row P7.1. The full run passed: typecheck, 1456 unit tests (121 files), 240 e2e tests.

**Left open**
- **P8 (scene) and P18 (plates)** wire it in. The key must hold everything the pixels depend on:
  seed, paint view rect, scale, quality and, for the plates, the phase. Store the painting before
  the paper and the daylight plates. Pass `{ copy: false }` when the canvas is kept unchanged, which
  saves a 3.6 Mpx copy at load. P8's e2e should compare a cached load with a `?nopaintcache` load.
- **Two tabs** keep separate in-memory indexes, so the cap may be overshot until the next open.
  Eviction does not react to the browser's own storage pressure. If the browser evicts the whole
  origin's IndexedDB, the cache simply misses.
- **The exactness was checked in headless Chromium only.** GPU-backed canvases in desktop Chrome
  and other browsers were not measured. P8's `?nopaintcache` diff in e2e will cover Chromium again.
  A manual check on the owner's Chrome would close it.
- **The version is coarse:** any change in `src/core` or `src/fauna` repaints the landscape once
  per visitor after the deploy. This is deliberate (ADR 0227). Narrow the roots only if repaints
  after a deploy turn out to matter.
- No studio entry: the cache paints nothing.
