# 42 — P1: preview prewarm in the plant view

## What
The P0b audit found that the first "Start studying" click blocks the main thread for about
640 ms. 536 ms of that is the planting sheet painting 25 species previews synchronously through
the plant view's cache, which had no worker (`createWorker: null`). This task makes those
previews paintable off the main thread and ahead of time. The sheet does not use this yet: wiring
it is task P2 (`src/ui` was not touched).

- **The view cache paints in a worker** (ADR 0220). It is the same `createSpriteCache` and
  `sprite-worker.ts` as the garden, with one worker spawned on the first queued sprite
  (`lazyWorkers`). The main thread is the fallback: no Worker/OffscreenCanvas, a species the worker
  does not know, or a failed render.
- **New API in `src/plants/view.ts`** (ADR 0221):
  - `plantViewSprites(size, opts)`: the sprites a first frame of that size looks up.
  - `prewarmPlantView(size, opts): Promise<boolean>`: queues them at the new `PRIORITY.idle`, and
    for growth framing follows up with the zoomed sprite once the lower step lands.
  - `drawPlantView(canvas, opts)`: returns `{ state: 'drawn' }`, `{ state: 'pending', ready }` or
    `{ state: 'unknown' }`. It never paints a sprite on the main thread and leaves the canvas
    untouched while pending.
  - Tests and dev get `whenPlantViewsReady()`, `plantViewStats()` (with `syncPaints`) and
    `setPlantViewCacheOptions()`.
- **The idle lane** (`src/plants/sprites.ts`). A cache holds its `idle` jobs while another cache
  has more urgent work, and wakes the others when it goes quiet or is disposed. Raising a held job
  (a draw of a sheet that is open) dispatches it at once. `SpriteCache` gained `whenReady(spec)` and
  `pending(spec)`.
- **`renderPlantView` is unchanged** for its callers (widget, PiP, "Your plant", "Growing now", the
  herbarium's plain previews, studio). It still paints a missing lower step now. Only the steps it
  queues (upper step, look-ahead) now paint in the worker instead of in idle callbacks.
- **Dev API**: `sprout.plants.view.stats()`, `.whenReady()`, `.parity(o)`.

## Tests
- `src/plants/view-prewarm.test.ts` (12) uses fake workers:
  - `whenReady` semantics, lazy spawning, the idle lane (held, woken by quiet and by dispose,
    dispatched on a raise).
  - Prewarm specs equal the draw's lookups and the sync renderer's paints (four growths).
  - Pending → drawn with no sync paint, `renderPlantView` still drawing while a prewarm is in
    flight, the growth-framing follow-up, a deferred draw with nothing prewarmed while the garden
    is busy, and the main-thread fallback (no workers, and a worker answering `unknown`).
  - The real `sprite-worker.ts` runs in-process. Its sprite strokes and the composed view's draw
    calls equal the main thread's for a real species (violet).
- `tests/e2e/plants.spec.ts › plants · view previews` has the real worker in Chromium. Camellia at
  growth 1 and violet at 0.5, 240×240: prewarmed, drawn, `syncPaints` 0, and a **maximum pixel
  difference of 0** against the main-thread view (asserted ≤ 2).
- The matrix row is P1.1 in docs/TESTING.md. The studio entries are unchanged: their call,
  `renderPlantView`, behaves as before.

## Left open
- **P2 wiring**: prewarm the selectable previews after `renderer.whenReady()` and on
  `pointerenter`/`focusin` of Start studying. Draw cards with `drawPlantView` and fill them on
  `ready`, and add `sprout.ui.previewsReady()` (it can await `whenPlantViewsReady()`). The
  prewarm's `size` must be the card canvas's pixel size, DPR included, or the keys will not match.
  `previews.ts` falls back to `renderPlantPreview` only on `unknown`, never on `pending`.
- **The ground wash and seed bed** are still painted on the main thread the first time a size
  bucket is used. That is small (one wash per bucket), but it is not prewarmed. P2 could warm one
  bucket with an off-screen `drawPlantView` after the sprites land.
- **VIEW_BUDGET** (24 MB) now holds the prewarmed previews too. If P2 sees evictions (check
  `sprout.plants.view.stats().evicted`), raise it, or prewarm closer to the click.
- **One more worker**: the view's worker is a third paint worker next to the garden's two. Merging
  the pools (one queue across caches) would save its startup. T13 also plans to merge the scene
  worker into the sprite worker.
- `src/main.ts` was not touched.
