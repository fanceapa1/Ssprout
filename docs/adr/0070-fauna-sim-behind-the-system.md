# ADR 0070 — A renderer-independent FaunaSim behind the fauna System

- Status: accepted
- Date: 2026-10-22

## Context
Creatures need to be reviewed alone in the studio, tested for hours of behaviour in unit tests, and
stepped forward instantly in e2e tests ("never real waiting"). The render System contract only gives
`update(f)` / `draw(layer)` / `entities(f)` inside the renderer.

## Decision
- All behaviour lives in `FaunaSim` (`src/fauna/sim.ts`): world (scene-derived targets, pond plane,
  art cache), residents upkeep, visit scheduling, ripples, per-layer drawing and entities.
- The sim keeps its **own time** (`sim.time += dt`, dt clamped to 0.1 s). The renderer's `f.now`
  (Clock) only feeds the time of day; `f.t` is not used, so `sprout.fauna.step(s)` and studio
  presimulation never desynchronise the schedule.
- `createFaunaSystem` is a thin wrapper: store → roster/targets, session → lively, Clock → night.
- Creature ids are assigned by the sim, so a seed reproduces a run exactly (they salt noise).
- Studio stages run the same `FaunaSim` on a small painted scene; tests run it in node (drawing is
  the only part that needs a canvas, and parts are painted lazily on first draw).

## Consequences
Behaviour is testable without a browser (`sim.test.ts` simulates whole afternoons). The System stays
trivially mergeable in `main.ts` (one `renderer.add` line).
