# ADR 0064 — Shrubs are built once from the rng, then revealed by growth

- Status: accepted
- Date: 2026-10-22

## Context
A session grows its plant live: the sprite cache renders ~24 growth steps of the same seed and
cross-fades between them. If a species drew different random numbers depending on growth (for
example "draw `n = growth × 10` leaves, each with fresh randomness"), each step would be a
different plant and the cross-fade would shimmer and jump. The paint engine's primitives also
consume whatever `rng` they are given, so passing the species stream to them makes every mark
after the first growth-dependent one change.

## Decision
- `draw()` first builds the complete plant from the species `rng` with growth-independent draws
  in a fixed order (pure `build<Species>(rng)` functions, exported for tests).
- Every element (branch, clump, leaf, flower, pad) carries its own `seed` and a growth window
  `[t0, t1]`. It is painted with `createRng(seed)` and only scaled, extended, opened or tinted by
  `ramp(growth, t0, t1)` — smooth functions of growth.
- Windows follow the plant's logic: children start when the parent's tip passes the fork,
  foliage fills in from the heart outward and upward (`growOutward`), flowers are staggered.
- Elements whose painting depends on a count (petals, florets, leaves) generate the full count
  at every growth; small elements are skipped only below a visibility threshold, which never
  affects other elements because their streams are separate.

## Consequences
- Consecutive growth steps are frames of one plant; tested by checking that `draw()` leaves the
  species rng at the same position for every growth.
- The engine's drying pass still takes its flow-noise offset from the painter's own stream, so
  mottling can differ slightly between steps; at cross-fade this reads as wet paint settling.
- Builders do all structural work every call (cheap, < 1 ms); nothing is cached between calls.
