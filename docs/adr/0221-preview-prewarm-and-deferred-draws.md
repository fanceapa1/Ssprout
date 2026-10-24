# ADR 0221 — Preview prewarm, deferred draws and an idle lane

- Status: accepted
- Date: 2026-10-24

## Context
With the view cache painting in a worker (ADR 0220), the planting sheet could open without
painting synchronously if its previews were painted ahead and its draws could wait. Two things
were missing. First, a way to queue exactly the sprites a later draw will look up. Second, a draw
that does not fall back to `ensureSync` when a sprite is missing. A prewarm must also never delay
the garden's sprites, which are on screen.

## Decision
- **`plantViewSprites(size, opts)`** returns the sprites a view's first full frame needs: the
  lower growth step of `plantLayout(def, W, H)`, plus the upper step when the growth falls between
  steps. `renderPlantView` and `drawPlantView` look up exactly these. With `framing: 'growth'`
  the zoomed size depends on the lower step's painted bounds, so the list holds the unzoomed ones.
- **`prewarmPlantView(size, opts): Promise<boolean>`** (`size` is a canvas or
  `{ width, height }`) queues those sprites at the new **`PRIORITY.idle`**. For growth framing it
  follows up with the zoomed sprites once the lower step lands. The promise resolves true when a
  draw of the same size and options will draw its full first frame without painting, and false
  for an unknown species or a failed render.
- **`drawPlantView(canvas, opts): PlantViewDraw`** is `renderPlantView` that never paints a
  sprite on the main thread. When the lower step (or a nearby lower one, as in `renderPlantView`)
  is cached it draws and returns `{ state: 'drawn' }`. Otherwise it queues the sprite, or raises a
  prewarm of it to `now`, and leaves the canvas untouched. It returns
  `{ state: 'pending', ready }`, and the caller draws again when `ready` resolves.
  `{ state: 'unknown' }` matches `renderPlantView`'s false. This is opt-in, and
  `renderPlantView`'s signature and behaviour stay the same.
- **An idle lane across caches.** `sprites.ts` keeps a module-level set of live caches. A cache
  holds its `idle` jobs while any other cache has work below `idle` queued or in flight. When a
  cache goes quiet (or is disposed), it wakes the others. Raising a held job's priority dispatches
  it at once. So a prewarm waits for the garden's visible, rescale and look-ahead sprites, and a
  sheet that is actually open does not.
- **Readiness for tests.** `SpriteCache.whenReady(spec)` resolves true when the sprite lands and
  false when it fails, is dropped (`dropQueued`, `clear`, `dispose`) or was never requested.
  `SpriteCache.pending(spec)` and `whenPlantViewsReady()` (no view sprite queued or in flight)
  complete it. `plantViewStats()` adds `syncPaints`, the sprites `renderPlantView` painted on the
  main thread. In `?dev` these are `sprout.plants.view.stats()` and `.whenReady()`, and
  `.parity(o)` compares the worker and main-thread pixels.
- `setPlantViewCacheOptions(o | null)` replaces the view cache, so unit tests can inject a fake
  worker and the dev parity check can force the main thread.

## Consequences
- The planting sheet (task P2) can prewarm every selectable preview after the landscape is ready,
  render its cards at once and fill each canvas when its sprite lands. Its synchronous fallback
  in `src/ui/previews.ts` (`renderPlantPreview` on false) is not reached on `pending`.
- The 24 MB view budget now also holds prewarmed previews (25 × about 0.3–0.5 MB at DPR 2). A
  busy widget or "Your plant" can evict a prewarmed preview before the sheet opens. The draw then
  waits for a repaint instead of blocking.
- A cache whose work never drains would hold the others' prewarms forever. The garden always
  drains (workers, or idle callbacks), and tests dispose their caches.
