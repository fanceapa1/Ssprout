# ADR 0143 — One shared daylight source

- Status: accepted
- Date: 2026-10-23

## Context
Four systems paint or behave with the daylight (scene sky, ambience light plates, plant shadows
and rims, fauna's night). v1's `setTime` moved only the lighting.

## Decision
- `createDaylightSource()` (`src/ambience/daylight-source.ts`) holds the guessed location, the dev
  override and a per-second cache: `at(now)`, `setOverride(v)`, `override()`, `location(now)`,
  `setLocation(p)` and a `version` that bumps on every change (systems then recompose at once
  instead of waiting for their next check).
- `main.ts` creates one source and passes it to `createSceneSystem`, `createPlantSystem`,
  `createFauna` and `addAmbience` (`{ daylight }` option each). Without it each system falls back
  to a pinned midday (`pinnedSource`) or, for the ambience, its own source on the clock.
- Time enters only as the frame's `now` (the injected `Clock`).

## Consequences
`sprout.setTime` moves the sky, the light, the shadows, the rims and the fauna together. A
system gets the light through an option, not through the `SystemContext` contract, which stays
unchanged.
