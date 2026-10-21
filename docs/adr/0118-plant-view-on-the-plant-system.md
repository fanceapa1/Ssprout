# ADR 0118 — renderPlantView on the plant system's pieces

- Status: accepted
- Date: 2026-10-22

## Context
ADR 0094 fixed the signature and left the internals to this task.

## Decision
- `renderPlantView` keeps its signature and synchronous contract (a widget frame must draw now).
  It uses its own main-thread `SpriteCache` (no workers): the lower step is painted synchronously
  only when nothing near is cached, the upper step is queued for idle time and morph-faded in.
- It draws a soft ground wash, the shared watering animation (rig fitted inside the canvas) and
  the shared wither.
- `setPlantViewSpecies(fn)` lets `main.ts` pass its `getSpecies`, so dev fixtures render too
  (the registry is consulted first).
