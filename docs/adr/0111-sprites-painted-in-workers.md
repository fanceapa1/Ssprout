# ADR 0111 — Sprites are painted in module workers

- Status: accepted
- Date: 2026-10-22

## Context
The frame loop must never hitch by more than ~8 ms, but one species sprite takes 10–100 ms and
cannot be split into chunks (a `draw` call is synchronous).

## Decision
- A priority queue of sprite requests is drained by `min(2, cores − 1)` module workers
  (`sprite-worker.ts`) that run the same `paintSprite` into `OffscreenCanvas` and transfer
  `ImageBitmap`s. The paint engine already prefers OffscreenCanvas and touches no DOM.
- The worker resolves species from the registry plus the dev fixtures; unknown species and
  failures are retried on the main thread; a dead worker's jobs are requeued.
- Without Worker/OffscreenCanvas the queue is drained one sprite per `requestIdleCallback`.
- Drawables never paint: a missing sprite is requested and the nearest cached one is shown.
- `init` waits (≤ 8 s) for the first batch so `sprout.ready()` means "plants are there".

## Consequences
Species code is bundled twice (main + worker chunk). Species must not use `document`/`window`.
