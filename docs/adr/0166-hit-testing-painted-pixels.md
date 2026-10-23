# ADR 0166 — Hit-testing a plant's painted pixels

- Status: accepted
- Date: 2026-10-23

## Context
Hover labels hit-tested a plant's sprite box, inset by 12 %. Zoomed in, a box is mostly air:
clicking the meadow between a clover's leaves would open the clover's card, and a tall plant's
box would steal clicks from the plant in front of its air.

## Decision
`PlantSystem.hitTest(world, tolerance)` (`src/plants/hit-test.ts`): the **front-most** plant (the
largest slot y, the draw order) whose **painted pixels** are under the point, over finished plants
and every session's seedling. Each sprite bitmap gets a coarse alpha mask once (≤ 96 cells on its
long side, alpha ≥ 28 counts as paint), cached per bitmap; a test is a few array lookups.
`tolerance` (6 CSS px, converted to world units by the caller, so it follows the zoom) keeps thin
stems clickable. Plants fading out (displaced) and plants not yet shown are skipped; a plant
without a painted sprite yet falls back to the inner box.

## Consequences
The hover label (desktop) and the plant card use the same test, so what the cursor offers is
what a click opens. `hit-test.test.ts` covers front-most wins, a transparent part letting the
click through to the plant behind, tolerance and the fallback.
