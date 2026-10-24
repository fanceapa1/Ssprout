# ADR 0228: The landscape from the paint cache

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0041 (the first paint), ADR 0163 (the detail painting)

## Context
Every load painted the garden landscape again: about 0.9 s of main-thread CPU at 1440×900 @2,
and the landscape showed about 1.6 s after navigation, on a repeat visit too (load report P0b, T6).
The painting is deterministic. The same code, seed, quality, world rect and scale always give the
same pixels. ADR 0227 built a persistent paint cache (`paintCache()`: lossless PNG in IndexedDB,
versioned by a build-time hash of the paint sources plus the browser). This ADR decides how the
scene uses it.

## Decision
- **What is stored.** The scene stores three kinds of entry:
  - `scene`: the overview painting, after the cut sides of a strip have been faded to paper
    (`softenCutEdges`, ADR 0189). Nothing else changes it after that.
  - `scene-sprites`: the 11 boulders and 6 foreground tufts of one paint scale, packed into one
    atlas. They are stacked top to bottom in paint order, and the layout follows from the
    geometry alone (`rockBox`, `tuftBox`, `ceil(box × scale)`), so a stored atlas is cut up again
    without painting. One entry costs one read and one decode instead of 17. The sprites do not
    depend on the painted rect, so a strip and its whole-world extension share them.
  - `scene-detail`: the camera's detail painting of a resting view (ADR 0163). It is never faded,
    so it gets its own kind.

  Everything is stored **before** the sky plate, the light plate and the paper. Those are laid
  over the painting each time it is drawn (ADRs 0021, 0145), so a change of phase or of the time
  of day never invalidates an entry.
- **Keys** (`paintingKey`, `spritesKey` in `background.ts`). A painting's key is
  `s<seed>|<quality>|<x>,<y>,<w>,<h>@<scale>|<px w>x<px h>`, and the sprites' key is
  `s<seed>|<quality>@<scale>`. Numbers are written as `String(n)`, which round-trips every
  double, so two scales never share a key by rounding. The scale already holds the device pixel
  ratio and the zoom (`min(pixelScale, cap)`), and the bitmap size follows from rect and scale.
  The art's layout (trees, shrubs, tufts) is code, so it is covered by the cache version, not the
  key. Only the seed varies at run time.
- **Lookup first, bounded.** Every overview job (the first paint, a repaint after a resize, the
  whole-world extension) and every detail job looks up its painting and its sprites together.
  When both are found, the job is done: no paint step runs. Otherwise it paints as before. The paint
  job waits for the lookup for at most `cacheWaitMs` (300 ms). A hit that arrives later stops the
  paint job and is used instead. When nothing is cached, the lookup costs one IndexedDB open and
  an index check.
- **Exactness: a hit is drawn from a canvas copy, not from the bitmap.** `get` decodes without
  premultiplication (ADR 0227). Drawn scaled with smoothing, such a bitmap filters translucent
  pixels differently from the premultiplied canvas the painting was made on: up to 35 levels on
  447k of 1.3M pixels at 1440×900. Copying it 1:1 into a canvas (`copy`, no smoothing:
  `canvasOf`) first gives frames identical to a fresh paint. The copy costs one drawImage at load.
- **A miss** paints as before, then `put`s the painting with `{ copy: false }` (nothing draws on
  it after `softenCutEdges`) and a freshly packed sprite atlas. Encoding happens in idle time
  (ADR 0227). Only the parts the lookup did not find are put.
- **The detail paintings are cached too.** One costs 3–6.6 MB of PNG at 1440×900 @2 (zoom 2–3
  at scale 2.8, including its 2.8 sprite atlas the first time). The overview with its sprites
  costs 6.8 MB. Under the 48 MB cap that keeps the overview plus about six resting views. That
  covers the three sessions that can be in progress at once (ADR 0154), each resting on its
  seedling. A repeat rest on the same view takes about 115 ms instead of about 740 ms.
- **Counters.** `sceneStats()` adds `cacheHits`, `cacheMisses` (overview jobs, the extension
  included) and `lastLookupMs`, and `sceneDetail()` adds `cacheHits` and `cacheMisses`. `paints`
  counts paintings actually painted, so a repeat visit shows `paints: 0, cacheHits: 1`. A hit still
  installs the painting through the same path, so the cross-fade, `whenPainted`/`scenePainted()`
  and the renderer's `whenReady()` behave as before.
- `createSceneSystem({ cache?, cacheWaitMs?, cacheDetail? })` injects the cache (unit tests use an
  in-memory one). The default is `paintCache()`, which is opened when the system is created, so
  the store is ready by the time `init` looks up the first painting.

## Measured
Production build, 1440×900 @2, headless Chromium, `nice -n 15` on the shared laptop. One browser
context per run: a first visit, then a traced repeat visit. Three runs each, median (range):

| | before | after |
|---|---|---|
| repeat visit: landscape on screen | 1603 ms (1601–1613) | 494 ms (493–551) |
| repeat visit: main-thread busy before it | 1522 ms (1514–1523) | 518 ms (509–566) |
| repeat visit: long tasks before it | 3, 461 ms | 2, 376 ms (both boot tasks) |
| repeat visit: lookup (open, read, decode, copy) | — | 285 ms (276–344) |
| first visit (a miss): landscape on screen | 1672 ms (1646–1706) | 1694 ms (1667–1783) |

On a first visit the lookup (an IndexedDB open while the boot tasks hold the main thread) takes
265–330 ms. The landscape lands only about 20 ms later than before, because the rest of the boot
work fills that wait.

## Consequences
- Pixel tests that compare frames across loads of one browser context compare a cached painting
  with a fresh one. They are identical, but a test of the painting itself (its timings, its steps)
  must load with `?nopaintcache` or in a fresh context. Playwright gives every test a fresh context.
- Many distinct resting views in one visit can evict the overview: about seven detail views of
  about 5 MB. The next visit then paints it again once.
- The sky and light plates (P18) are not cached yet. They are the next largest part of the boot
  work before the landscape shows.
