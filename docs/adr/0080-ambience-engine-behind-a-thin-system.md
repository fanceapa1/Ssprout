# ADR 0080 — Ambience engine behind a thin render system

- Status: accepted
- Date: 2026-10-22

## Context
Weather, motes and lighting must run in the garden (renderer, store, Clock, dev overrides) and in
the studio (synthetic phases and hours, no store). The scene geometry is being replaced in
parallel, so the ambience may only depend on the `SceneGeometry` contract.

## Decision
- `createAmbience({ scene, reducedMotion, seed })` is a self-contained engine: `update(frame)` with
  `{ dt, phase, weather, emitters, hour }`, and `drawWater / drawAir / drawLighting(ctx)` into
  world-unit contexts. It never reads the store or the DOM.
- `createAmbienceSystem()` adapts it to the `System` contract: phase via `sessionPhase`, weather from
  the session, mote emitters from `state.plants` + `slots` + the session slot, hour from `Clock`
  (`localHour`) or the dev override. It draws into `waterSurface`, `ambience` and `lighting`.
- `addAmbience(renderer, { dev })` is the single registration call in `main.ts`; it installs the
  `window.sprout` methods when `dev` (placed after `installDebug`, since `extendDebug` needs it).

## Consequences
The studio drives the exact production code over a painted test garden. When the real scene lands,
nothing changes here unless the geometry contract does.
