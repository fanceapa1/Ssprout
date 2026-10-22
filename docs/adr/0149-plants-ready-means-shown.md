# ADR 0149 — `plantsReady` means the plants are shown

- Status: accepted
- Date: 2026-10-23

## Context
`sprout.addPlants(25); await sprout.plantsReady()` (not awaited in between) gave screenshots with
empty or ghostly slots: it resolved once the sprites were painted, while newly added plants were
still fading in (0.9 s, their fade starts when first drawn), and before the plant system's first
init it resolved at once with nothing requested.

## Decision
`PlantSystem.ready()` now: waits for the system's first init; syncs the store itself (a change the
frame loop has not seen yet); requests every sprite the garden needs and waits for the cache; then
waits until every visible finished plant is fully shown (no sprite pending, no fade running),
bounded by the fade + 1.5 s so a frozen frame loop never hangs it. It still does not snap growth
or blooms (`plants.settle()` does). `sprout.plants.state().finished[].shown` reports each plant's
appearance (0 waiting … 1 shown).

## Consequences
`plantsReady` takes up to ~1 s longer after adding plants; screenshots and pixel tests can rely on
it. Unit test in `src/plants/system.test.ts`, e2e in `tests/e2e/daylight.spec.ts`.
