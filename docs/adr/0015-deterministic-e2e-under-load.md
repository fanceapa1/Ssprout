# ADR 0015 — E2E tests stay deterministic on a loaded machine

- Status: accepted
- Date: 2026-10-22

## Context
Several agents run Playwright at once on one machine, and CI runners are slow. Under load (load
average 50–70) the suite timed out in the studio, the UI flows and the widget. The causes were
not app bugs. Tests rendered too much in one step, read short animations in separate round
trips, slept for fixed times, and let unrelated state (lighting following the dev clock, wind,
visiting creatures) change pixel comparisons. Details: docs/TESTING.md › Flakiness.

## Decision
- Wait for explicit signals (`ready`, `freeze`, `plantsReady`, `plants.settle`, `scenePainted`,
  `frameStats().frames` via `waitFrames`), never for wall-clock time.
- Read transient animations in the same page task as the action, or sample them per frame in the
  page.
- Pin what a test does not test: `setTime('noon')`, `settleAmbience()`, reduced motion for still
  frames, `fauna.clear()` before pixel reads, and follow spawned creatures by id.
- Run simulation loops inside one `page.evaluate`, with the renderer frozen.
- Scope heavy pages: the studio is verified one `#section` at a time, in parallel shards.
- UI flows apply the app's own reduced-motion CSS to the DOM UI (`calmUiMotion`). The garden is
  left in full motion.
- Timeouts are sized for load (60 s per test, 10 s per expect). The few tests that really paint a
  lot use `test.slow()`.

## Consequences
The suite passes three times in a row under load. Tests are a little longer (in-page loops), and
each convention is listed in docs/TESTING.md for new specs to follow.
