# ADR 0220 — The plant view's sprite cache paints in a worker

- Status: accepted (amends 0118)
- Date: 2026-10-24

## Context
ADR 0118 gave the plant view its own main-thread `SpriteCache` with `createWorker: null`: every
sprite it needed was painted on the main thread, the lower step synchronously and the rest one per
idle callback. The P0b load audit measured the cost. The first "Start studying" click runs one
~600 ms task, and 536 ms of it is the planting sheet painting the 25 species previews this way.
The garden's sprites already paint in module workers (ADR 0111) with a main-thread fallback.

## Decision
- The view cache uses the same mechanism as the garden: `createSpriteCache` with the default
  worker factory (`sprite-worker.ts`, one chunk shared by both caches). It keeps its own LRU
  (24 MB) and its own queue.
- **One worker**, spawned **lazily** on the first queued sprite (`lazyWorkers: true`,
  `workers: 1`). A page that never queues a view sprite (a finished "Your plant" at growth 1, no
  sheet opened) starts no extra worker. The garden keeps its `min(2, cores − 1)` workers, spawned
  at creation as before.
- The fallback is unchanged and per sprite: without Worker/OffscreenCanvas (or in unit tests),
  the queue drains one sprite per idle callback; a species the worker does not know (one added at
  runtime through `setPlantViewSpecies`) or a failed render is retried on the main thread. The
  worker already knows the registry and the dev `fx-*` fixtures.
- `renderPlantView` keeps its synchronous contract. A missing lower step is still painted now, on
  the main thread. Only the steps it queues (the upper step, the look-ahead) now go to the worker.
  Callers that cannot wait for pixels (the widget's frames, PiP, "Your plant", the "Growing now"
  thumbnails, the studio) look the same.
- A worker sprite is an `ImageBitmap`, a main-thread one a canvas. Both come from the same
  `paintSprite`, so the view's pixels match: the e2e parity check measures a difference of 0.

## Consequences
- A third worker can exist next to the garden's two, but only once the view queues something.
  On a two-core phone that is one garden worker, one view worker and the main thread.
- The view's queued work no longer competes with the main thread. Its priority against the
  garden's sprites is ADR 0221's.
