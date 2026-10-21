# ADR 0060 — Species plan the whole plant first, then render it at a growth value

- Status: accepted
- Date: 2026-10-22

## Context
A session renders the same plant seed at ~24 growth values and cross-fades between them. If
any random draw depended on growth (e.g. "draw a flower only once growth > 0.7", consuming the
stream conditionally), everything after it would re-roll and the plant would visibly change
identity between steps. The engine itself also consumes the rng it is given, and how much it
consumes depends on the size of the mark (resampled outlines), so even passing one stream
through all paint calls would drift as the plant grows.

## Decision
- Every species exports a pure `plan<Species>(rng)` that draws the entire structure up front —
  stems (turtle walks with per-segment turns), leaf nodes, flower placement, petal rings,
  colourway and all growth windows — in a fixed order. `draw` calls it with
  `rng.fork('plan')` and never draws from that stream again.
- Rendering uses a separate `rng.fork('paint')`, forked again per element with a stable label
  (`leaf-3`, `petal-2`) and per engine call inside the helpers (`'body'`, `'inner'`, `'ink'`).
  Forks derive from the seed, not the position (ADR 0012), so one element's marks never depend
  on how many marks came before it.
- Growth only scales, rotates and fades planned elements: stems grow along their planned turtle
  path (`stemPoints(stem, extent, bendK)`), leaves unfurl from a folded angle, petals swing from
  the bud direction to their open pose.

## Consequences
The same seed is the same plant at every growth value, and each brush mark keeps its own
deformation as it grows (no shimmering edges between steps). Adding a new element to a species
changes nothing else, as long as it gets its own fork label. The painter's private stream (flow
noise offsets in the drying pass) still varies slightly per call order; it only affects the
mottling inside marks and is hidden by the cross-fade.
