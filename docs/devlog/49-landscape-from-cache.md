# 49 — P8: the landscape from the paint cache

The P0b load report (T6) found that every load painted the garden landscape again: about 0.9 s of
main-thread CPU, with the landscape on screen about 1.6 s after navigation, on repeat visits too.
P7 (devlog 48, ADR 0227) built the persistent paint cache. This task makes the scene use it.

**What changed** (ADR 0228):
- `src/scene/background.ts`:
  - `SCENE_CACHE` kinds: `scene` (the overview), `scene-detail` (the camera's resting view) and
    `scene-sprites`.
  - `paintingKey(art, view, quality)` gives `s7|normal|0,0,1600,1000@1.5|2400x1500`, and
    `spritesKey(art, scale, quality)` gives `s7|normal@1.5`. Numbers are exact (`String`).
  - The sprite atlas: `spriteAtlasLayout` (from `rockBox`/`tuftBox` alone), `packSprites` and
    `unpackSprites`, plus `canvasOf` (a 1:1 canvas copy of a decoded bitmap).
- `src/scene/system.ts`:
  - Every overview job (first paint, repaint, whole-world extension) and every detail job goes
    through `produce`. It looks the painting and the sprites up together. A hit runs no paint
    step. A miss paints as before, then puts the painting (`{ copy: false }`, after
    `softenCutEdges`) and a packed atlas in idle time.
  - The paint job waits for the lookup for at most `cacheWaitMs` (300 ms), and a hit that arrives
    later stops it.
  - The cache is `opts.cache ?? paintCache()`, opened when the system is created.
  - `sceneStats()` has `cacheHits`, `cacheMisses` and `lastLookupMs`, and `sceneDetail()` has
    `cacheHits` and `cacheMisses`. `paints` counts only paintings actually painted.
- `src/main.ts` is unchanged.

**The one surprise: drawing the decoded bitmap is not exact.** The first e2e parity run differed in
447k of 1.3M pixels, by up to 35 levels. The cause: a bitmap decoded with
`premultiplyAlpha: 'none'` (ADR 0227), drawn scaled with smoothing, filters translucent pixels
differently from the premultiplied canvas the painting was made on. Two fresh `?nopaintcache`
loads were identical (0 differing pixels), so the capture itself was stable. Copying the bitmap
1:1 into a canvas first (`copy`, no smoothing) gives 0 differing pixels. The bitmap is closed
right after. P18 needs the same copy for the plates (noted in docs/systems/paint.md ›
Persistence).

**Detail paintings are cached too.** Measured at 1440×900 @2, in PNG bytes:

| What | Size |
|---|---|
| overview + sprites @1.5 | 6.8 MB |
| zoom 3 on the meadow (+ sprites @2.8) | 5.0 MB |
| zoom 2 on the pond | 6.6 MB |
| zoom 3 on the pavilion | 3.0 MB |

So the 48 MB cap holds the overview and about six resting views. A repeat rest on the same view
took 116 ms instead of 742 ms.

**Measured** (scratch scripts `scratchpad/perf/p8-repeat.mjs` and `p8-detail.mjs`, wrapper
`scratchpad/p8/measure.sh`). Production builds of `main` (6f08c12) and of this branch, each in
its own outDir, served on port 4328. 1440×900 @2, headless Chromium, `nice -n 15`. Each run is one
context: a first visit, then a traced repeat visit. Three runs each:

| | before | after |
|---|---|---|
| repeat: landscape on screen (ms after navigation) | 1613, 1603, 1601 | 493, 551, 494 |
| repeat: main-thread busy before it (ms) | 1523, 1514, 1522 | 509, 566, 518 |
| repeat: long tasks before it | 3 (461, 454, 481 ms) | 2 (375, 376, 379 ms: boot tasks) |
| repeat: scene paint CPU | 909–921 ms | 0 (lookup 276–344 ms: open, read, decode, copy) |
| first visit (miss): landscape on screen | 1706, 1672, 1646 | 1667, 1783, 1694 |
| first visit: lookup before painting | — | 264–333 ms |

The miss path waits 264–333 ms for IndexedDB to open while the boot tasks hold the main thread.
The landscape still lands only about 20 ms (median) later than before, because the rest of the
boot work fills that wait. In one run out of three, the 300 ms bound was hit.

**Tests:**
- `scene/scene-cache.test.ts` (9): the keys, the atlas layout, and the system on recording
  canvases with an in-memory cache. The system cases are a miss that paints and stores, a hit that
  paints nothing, a silent store waited for at most `cacheWaitMs`, and a late hit that stops the
  paint job.
- `tests/e2e/scene-cache.spec.ts` (4):
  - A repeat visit paints 0 steps, has 1 hit and draws a frame with **0 differing pixels** against
    a `?nopaintcache` load at 1440×900 @1, with noon pinned and only the scene and paper drawn.
  - At @2 the frame hash is identical.
  - An uncached size paints and is stored.
  - A detail painting comes from the cache on a repeat rest.
- `tests/e2e/paint-cache.spec.ts`: the round-trip test now counts only its own puts, hits and
  misses, because the app stores its landscape in the same cache.
- Warm caches across tests: none. Playwright gives every test a fresh context, so each test starts
  with an empty IndexedDB. Specs that reload within a test (core-loop, calendar, plants,
  sound-mixer, ui-session, scene's slot overlay) now take the landscape from the cache on the
  second load. None of them asserts on painting. docs/TESTING.md › Conventions describes this.
- **The full run** (once, under `nice -n 15`): typecheck passed and 1465 unit tests passed (122
  files). In e2e, 243 passed and 1 failed: `paint-cache › a painting stored before a reload…`
  counted 4 entries instead of 2. At Playwright's default 1280×720 the overview is a strip, and its
  whole-world extension (1.5 s later, in idle time) stored the landscape in the middle of the test.
  The two specs that count entries now run at 1440×900, where the first painting is the whole
  world. That spec then passed 9 of 9 runs (`--repeat-each 3`). The full suite was not run a
  second time, to stay within the CPU budget.

TESTING row P8.1, and the P7.1 status updated.

**Left open**
- **The sky and light plates (P18)** are now the largest boot work before the landscape. The two
  long tasks left before it (about 375 ms) are the boot tasks. P0b attributes them to sky-light
  `compose`, `paperTexture` and the ambience sprites (T12/T14). They were not profiled again here.
- **The lookup on a first visit** is mostly IndexedDB opening behind busy boot tasks. Opening the
  store earlier (from `main.ts`, before the renderer starts) could shorten it on both paths. It
  was not tried, to keep `main.ts` untouched.
- **Detail churn:** about seven distinct resting views in one visit can evict the overview, and the
  next visit then paints it again. Protecting the overview (a pinned entry or a separate cap for
  details) was not needed for three sessions.
- **Exactness was checked in headless Chromium only** (as in P7). The owner's desktop Chrome with a
  GPU canvas was not measured.
- No studio entry: nothing new is painted.
