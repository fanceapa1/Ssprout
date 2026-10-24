# ADR 0227 — A persistent paint cache: lossless PNG in IndexedDB, keyed by a build-time paint version

- Status: accepted
- Date: 2026-10-24

## Context
Every load paints the landscape again: about 1 s of main-thread CPU and 1.6 s of wall time before
it shows (load report P0b, "[High] 2"). The painting is deterministic. The same paint code, seed,
view rect and scale always give the same pixels, and the time of day is multiplied over it
separately. As a PNG it is about 5.9 MB and decodes in about 42 ms. The sky and light plates are
deterministic too. Later tasks (P8 for the scene, P18 for the plates) need one place to store
finished paintings across reloads. That place must never show stale art, never cost a frame and
never fail where the user can see it.

## Decision
- **Store:** IndexedDB database `studysprout-paint`. Object store `meta` holds an `EntryMeta` by
  `id`, and object store `blobs` holds the PNG Blob under the same id. One transaction writes both.
  The data is not sensitive and is meant to be visible in devtools.
- **Keys** are `version:kind:key`. `kind` names the painting (`scene`, `sky`…, with no `:`). `key`
  is everything else it depends on (seed, view rect, scale…) and is chosen by the caller.
- **Version:** `__PAINT_VERSION__` plus a short hash of the user agent. The browser's rasteriser
  also decides pixels, so a browser update repaints once. `__PAINT_VERSION__` is set with `define`
  at build time (`vite.config.ts`). It is the first 12 hex digits of a SHA-256 over the path and
  bytes of every file in the **import closure** of `src/paint`, `src/scene`, `src/ambience`,
  `src/plants`, `src/fauna`, `src/render` and `src/core`, leaving out `*.test.ts` and `*.studio.ts`
  (`src/paint/paint-version.ts`). The closure also covers files those directories import from
  elsewhere (today `src/dev/debug.ts` and `src/dev/fixture-species.ts`), so a new import from a
  painter is covered without anyone editing a list. The roots err on the side of more. A change that
  did not need a new version costs one repaint per visitor after a deploy. A change that missed one
  would show stale art.
- **Dev server and Vitest** get `'dev'`. Their sources change without a rebuild, so the cache is
  off there. That also keeps `npm run shots` painting live.
- **Entries of any other version are dropped** when the store opens.
- **`put` never blocks a frame.** It copies the canvas at once, with the `copy` composite and no
  smoothing, so the caller may draw on the canvas again. A caller that will never draw on its canvas
  again can pass `{ copy: false }` and save the copy. In idle time (`requestIdleCallback` with a 1 s
  timeout) the copy is encoded to PNG with `convertToBlob`/`toBlob`, which Chromium encodes
  asynchronously. Puts run one at a time. Of several queued puts of one entry only the latest is
  encoded.
- **`get` decodes with `colorSpaceConversion: 'none'` and `premultiplyAlpha: 'none'`.**
- **Lossless only (PNG).** Pixel tests compare frames, and a cached painting must be the painting.
- **Byte cap:** least-recently-used eviction under 48 MB of encoded bytes by default (configurable),
  enforced on put and on open. Recency is a counter, not the wall clock. A painting larger than the
  cap is not stored.
- **Best-effort.** No method throws or rejects. The cache becomes a null cache (`get` → null, `put`
  → false) in four cases: on the dev server, with `?nopaintcache` (the opt-out, also used by tests to
  compare against a fresh painting), without IndexedDB, and when the store fails to open (some
  private modes). A failed write (quota), a failed read or a failed decode is swallowed and counted
  in `stats()`, and a broken entry is removed. Nothing is logged, so the e2e console-error guard
  stays meaningful.
- **Storage goes through `PaintStoreAdapter`.** In the browser that is IndexedDB. Unit tests inject
  a Map fake, because jsdom has no IndexedDB. No dependency was added.

## Verified
In Chromium (Playwright, the production build), canvas → PNG Blob → `createImageBitmap` →
`drawImage` (`copy`) gives `getImageData` identical to the source. This holds for an opaque
watercolour-like frame and for a sprite-like canvas with every alpha value, with the module's copy,
IndexedDB and a reload in between (`tests/e2e/paint-cache.spec.ts`). An exploratory check found the
default decode options and `premultiplyAlpha: 'premultiply'` exact too, as is a DOM canvas's
`toBlob`. The cache keeps `none`/`none` as the guard against colour-managed displays. The check
ran in headless Chromium only.

## Consequences
- Callers (P8, P18) key on everything their painting depends on and store the painting *before* the
  paper (ADR 0021) and before the time-of-day plates. A cached painting is drawn with `drawImage`
  like a fresh one.
- Two tabs keep their own in-memory index, so the cap can be overshot until the next open.
- `src/paint/persist.ts` lives in `src/paint`, so changes to the cache's own format also change the
  version.
- `tsconfig.json` sets `allowImportingTsExtensions`, so `vite.config.ts` imports the version helper
  as `.ts`. Without the extension Vite warns that its future native config loader will not
  resolve the import.
